import asyncio
import json
import re
from typing import Any, AsyncGenerator, Dict, List

try:
    import httpx
    _HTTPX_OK = True
except ImportError:
    _HTTPX_OK = False

try:
    import requests as _requests
    _REQUESTS_OK = True
except ImportError:
    _REQUESTS_OK = False

try:
    from qdrant_client import QdrantClient
    from qdrant_client.http.models import Filter, FieldCondition, MatchValue, MatchAny
    _QDRANT_OK = True
except ImportError:
    _QDRANT_OK = False

QDRANT_URL = "http://localhost:6333"
OLLAMA_URL = "http://localhost:11434"
COLLECTION = "chemical_documents"
LLM_MODEL = "llama3.1:8b"
LLM_MODEL_FALLBACK = "llama3.2"
MIN_SCORE_THRESHOLD = 0.25
MAX_HISTORY_TURNS = 3  # last N user+assistant pairs to include
COUNTING_TOP_K = 20    # retrieve more chunks for counting/listing queries
RETRIEVAL_CANDIDATES = 20  # Qdrant retrieves more candidates, then RRF+reranker selects top_k
_RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

_COUNTING_RE = re.compile(
    r'\b(how many|quante? volte|quanti|conta|count|occurrenc|elenca|list all|tutti|tutte)\b',
    re.IGNORECASE,
)

_SYSTEM_PROMPT = """\
You are ChemAssist, a regulatory intelligence assistant for cosmetic and food industry laboratories.
You specialize in EU Cosmetics Regulation (EC 1223/2009), CLP/GHS, REACH, and food additive regulations.

STRICT RULES:
1. Never open with a greeting unless the user sends a greeting with no question.
2. Answer ONLY from retrieved context. Never invent regulatory limits, CAS numbers, or concentration thresholds.
3. Cite sources inline as [filename]. For regulatory claims, always include the Annex/Article reference if present.
4. When reporting numeric limits (%, ppm, mg/kg): state the exact value from context, do not interpolate or round.
5. Distinguish between EU regulations and other jurisdictions (FDA, NMPA, etc.) when the context allows.
6. Use INCI nomenclature when referring to cosmetic ingredients.
7. If context contains partial information, report exactly what was found: "The document states: X"
8. If the answer is absent: "Not found in the loaded documents."
9. For counting queries: count visible occurrences, state number, note if context may be incomplete.
10. Never make GMP release decisions or formal safety assessments.
11. Be concise. Use bullet points for lists. Use tables for comparative data if ≥3 items.
"""

# ── Lazy reranker ───────────────────────────────────────────────────────────────

_reranker = None


def _get_reranker():
    global _reranker
    if _reranker is None:
        try:
            from sentence_transformers import CrossEncoder
            _reranker = CrossEncoder(_RERANKER_MODEL)
        except Exception:
            _reranker = False
    return _reranker if _reranker is not False else None


# ── Hybrid RRF ──────────────────────────────────────────────────────────────────

def _hybrid_rrf(chunks: list, query: str, top_k: int) -> list:
    """
    Reciprocal Rank Fusion of BM25 + dense Qdrant scores.
    chunks: already retrieved from Qdrant, sorted by dense score desc.
    """
    if not chunks:
        return chunks
    try:
        from rank_bm25 import BM25Okapi
    except ImportError:
        return chunks[:top_k]

    tokenized = [c["text"].lower().split() for c in chunks]
    bm25 = BM25Okapi(tokenized)
    bm25_scores = bm25.get_scores(query.lower().split())

    bm25_ranked = sorted(range(len(chunks)), key=lambda i: bm25_scores[i], reverse=True)
    bm25_rank = {idx: rank for rank, idx in enumerate(bm25_ranked)}

    k = 60
    rrf_scores = []
    for dense_rank, chunk in enumerate(chunks):
        rrf = 1 / (k + dense_rank) + 1 / (k + bm25_rank.get(dense_rank, len(chunks)))
        rrf_scores.append((rrf, chunk))

    rrf_scores.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in rrf_scores[:top_k]]


def _rerank(chunks: list, query: str) -> list:
    """Cross-encoder reranking. Returns chunks sorted by cross-encoder score."""
    reranker = _get_reranker()
    if not reranker or len(chunks) <= 1:
        return chunks
    try:
        pairs = [(query, c["text"]) for c in chunks]
        scores = reranker.predict(pairs)
        return [c for _, c in sorted(zip(scores, chunks), key=lambda x: x[0], reverse=True)]
    except Exception:
        return chunks


# ── Qdrant helpers ─────────────────────────────────────────────────────────────

_qdrant_client: "QdrantClient | None" = None

def _get_qdrant() -> "QdrantClient":
    global _qdrant_client
    if not _QDRANT_OK:
        raise RuntimeError("qdrant-client not installed")
    if _qdrant_client is None:
        _qdrant_client = QdrantClient(url=QDRANT_URL)
    return _qdrant_client


def _collection_exists() -> bool:
    try:
        info = _get_qdrant().get_collection(COLLECTION)
        return (info.points_count or 0) > 0
    except Exception:
        return False


def _build_filter(mode: str, document_types: List[str]):
    if not _QDRANT_OK:
        return None
    conditions = []
    if mode == "regulatory":
        conditions.append(FieldCondition(key="document_type", match=MatchValue(value="REGULATION")))
    elif mode == "sds_extract":
        conditions.append(FieldCondition(key="document_type", match=MatchValue(value="SDS")))
    elif document_types:
        conditions.append(FieldCondition(key="document_type", match=MatchAny(any=document_types)))
    return Filter(must=conditions) if conditions else None


# ── Embedding ──────────────────────────────────────────────────────────────────

def _embed_query(query: str) -> List[float]:
    if not _REQUESTS_OK:
        raise RuntimeError("requests not installed")
    resp = _requests.post(
        f"{OLLAMA_URL}/api/embeddings",
        json={"model": "nomic-embed-text", "prompt": query},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["embedding"]


# ── Retrieval ──────────────────────────────────────────────────────────────────

def retrieve(
    query: str,
    mode: str = "general",
    document_types: List[str] = [],
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    client = _get_qdrant()
    vec = _embed_query(query)
    filt = _build_filter(mode, document_types)

    # Step 1: Dense retrieval (more candidates than needed)
    results = client.search(
        collection_name=COLLECTION,
        query_vector=vec,
        limit=max(RETRIEVAL_CANDIDATES, top_k),
        query_filter=filt,
        with_payload=True,
        score_threshold=MIN_SCORE_THRESHOLD,
    )
    chunks = []
    for hit in results:
        p = hit.payload or {}
        chunks.append({
            "text": p.get("text", ""),
            "source_file": p.get("source_file", ""),
            "section_title": p.get("section_title", ""),
            "document_type": p.get("document_type", ""),
            "score": hit.score,
        })

    # Step 2: Hybrid RRF (BM25 + dense)
    try:
        chunks = _hybrid_rrf(chunks, query, min(RETRIEVAL_CANDIDATES, len(chunks)))
    except Exception:
        pass  # fallback to dense-only

    # Step 3: Cross-encoder reranking
    try:
        chunks = _rerank(chunks, query)
    except Exception:
        pass

    # Step 4: Take top_k
    return chunks[:top_k]


# ── Chat message building ───────────────────────────────────────────────────────

def _build_messages(
    query: str,
    chunks: List[Dict[str, Any]],
    history: List[Dict],
) -> List[Dict[str, str]]:
    """
    Build the messages list for Ollama api/chat.
    Structure: system → (history turns) → user (context + query)
    """
    result: List[Dict[str, str]] = [{"role": "system", "content": _SYSTEM_PROMPT}]

    # Conversation history — last N turns, truncating long assistant replies
    for msg in history[-(MAX_HISTORY_TURNS * 2):]:
        content = msg["content"]
        if msg["role"] == "assistant" and len(content) > 500:
            content = content[:500] + "…"
        result.append({"role": msg["role"], "content": content})

    # Context block + query as the final user message
    if chunks:
        context_parts = [
            f"[{i}] {c['source_file']} / {c['section_title']}\n{c['text']}"
            for i, c in enumerate(chunks, 1)
        ]
        context_block = "RETRIEVED CONTEXT:\n" + "\n\n---\n\n".join(context_parts)
    else:
        context_block = "RETRIEVED CONTEXT: (none — no relevant documents found)"

    result.append({"role": "user", "content": f"{context_block}\n\nUSER QUERY: {query}"})
    return result


# ── Entity extraction ──────────────────────────────────────────────────────────

def _extract_entities(text: str) -> Dict[str, Any]:
    cas = re.findall(r'\b\d{2,7}-\d{2}-\d\b', text)
    hazard = re.findall(r'\bH\d{3}[A-Z0-9]*\b', text)
    precautionary = re.findall(r'\bP\d{3}[A-Z0-9]*\b', text)
    formulas = re.findall(r'\b[A-Z][a-z]?\d*(?:[A-Z][a-z]?\d*)+\b', text)
    return {
        "cas_numbers": list(set(cas)),
        "hazard_statements": list(set(hazard)),
        "precautionary_statements": list(set(precautionary)),
        "chemical_formulas": list(set(formulas)),
    }


# ── Confidence ─────────────────────────────────────────────────────────────────

def compute_confidence(
    n_chunks: int,
    avg_score: float,
    n_unique_docs: int,
    mode: str,
) -> float:
    if n_chunks == 0:
        return 0.0
    base = avg_score
    coverage_bonus = min(0.1 * max(n_unique_docs - 1, 0), 0.3)
    if mode == "regulatory" and n_unique_docs < 2:
        base *= 0.7
    return round(min(max(base + coverage_bonus, 0.0), 0.99), 2)


# ── Streaming pipeline ─────────────────────────────────────────────────────────

async def stream_query_pipeline(
    query: str,
    mode: str = "general",
    document_types: List[str] = [],
    top_k: int = 5,
    messages: List[Dict] = [],
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Async generator yielding SSE-style dicts:
      {"type": "token",  "content": "..."}
      {"type": "meta",   "sources": [...], "confidence": 0.x, "entities": {...}}
      {"type": "error",  "message": "..."}
      {"type": "done"}
    """
    from app.chemical_compliance.audit_service import log_event
    from app.chemical_compliance.regulatory_mode import apply_regulatory_constraints

    loop = asyncio.get_running_loop()

    # 1. Short-circuit: empty knowledge base
    has_docs = await loop.run_in_executor(None, _collection_exists)
    if not has_docs:
        yield {"type": "token", "content": (
            "The knowledge base is empty. Upload documents in **Upload & Ingest** "
            "to get started — try the sample SOP, SDS, or regulation files."
        )}
        yield {"type": "meta", "sources": [], "confidence": 0.0, "entities": {}}
        yield {"type": "done"}
        return

    # 2. Retrieve relevant chunks (more for counting/listing queries)
    effective_top_k = COUNTING_TOP_K if _COUNTING_RE.search(query) else top_k
    try:
        chunks = await loop.run_in_executor(
            None, lambda: retrieve(query, mode, document_types, effective_top_k)
        )
    except Exception as e:
        yield {"type": "error", "message": str(e)}
        yield {"type": "done"}
        return

    # 3. No relevant chunks above threshold
    if not chunks:
        no_doc_msg = (
            "I could not find relevant information in the loaded documents "
            "for this query.\n\n"
            "Try uploading more specific documents, or rephrase using "
            "technical terminology (substance names, CAS numbers, H/P codes)."
        )
        yield {"type": "token", "content": no_doc_msg}
        yield {"type": "meta", "sources": [], "confidence": 0.0, "entities": {}}
        yield {"type": "done"}
        log_event("query", {"query": query, "mode": mode, "chunks_retrieved": 0,
                             "confidence": 0.0, "unique_sources": 0})
        return

    # 4. Build chat messages
    if mode == "regulatory":
        _, chunks = apply_regulatory_constraints(chunks, "", query)
    chat_messages = _build_messages(query, chunks, messages)

    # 5. Stream tokens from Ollama via api/chat (with model fallback)
    full_response = ""
    generation_ok = False
    if not _HTTPX_OK:
        yield {"type": "error", "message": "httpx not installed"}
        yield {"type": "done"}
        return

    async with httpx.AsyncClient(timeout=180) as http_client:
        for model in [LLM_MODEL, LLM_MODEL_FALLBACK]:
            try:
                async with http_client.stream(
                    "POST",
                    f"{OLLAMA_URL}/api/chat",
                    json={"model": model, "messages": chat_messages, "stream": True},
                ) as resp:
                    if resp.status_code == 404:
                        continue  # model not available, try fallback
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        data = json.loads(line)
                        token = data.get("message", {}).get("content", "")
                        if token:
                            full_response += token
                            yield {"type": "token", "content": token}
                        if data.get("done"):
                            break
                generation_ok = True
                break
            except Exception:
                continue

    if not generation_ok:
        yield {"type": "error", "message": "Generation failed: no LLM model available"}
        yield {"type": "done"}
        return

    # 6. Compute metadata
    scores = [c["score"] for c in chunks]
    avg_score = sum(scores) / len(scores) if scores else 0.0
    unique_docs = len(set(c["source_file"] for c in chunks))
    confidence = compute_confidence(len(chunks), avg_score, unique_docs, mode)
    entities = _extract_entities(full_response)
    sources = [
        {
            "source_file": c["source_file"],
            "section_title": c["section_title"],
            "score": round(c["score"], 4),
            "text_snippet": c["text"][:200],
        }
        for c in chunks
    ]

    log_event("query", {
        "query": query,
        "mode": mode,
        "chunks_retrieved": len(chunks),
        "confidence": confidence,
        "unique_sources": unique_docs,
    })

    yield {"type": "meta", "sources": sources, "confidence": confidence, "entities": entities}
    yield {"type": "done"}


# ── Non-streaming pipeline (kept for /query endpoint) ─────────────────────────

def query_pipeline(
    query: str,
    mode: str = "general",
    document_types: List[str] = [],
    top_k: int = 5,
    messages: List[Dict] = [],
) -> Dict[str, Any]:
    from app.chemical_compliance.regulatory_mode import apply_regulatory_constraints
    from app.chemical_compliance.audit_service import log_event

    if not _collection_exists():
        return {
            "answer": "The knowledge base is empty. Upload documents in Upload & Ingest first.",
            "sources": [], "extracted_entities": {}, "confidence_score": 0.0,
        }

    chunks = retrieve(query, mode, document_types, top_k)

    if not chunks:
        return {
            "answer": "I could not find relevant information in the loaded documents for this query.",
            "sources": [], "extracted_entities": {}, "confidence_score": 0.0,
        }

    if mode == "regulatory":
        _, chunks = apply_regulatory_constraints(chunks, "", query)

    chat_messages = _build_messages(query, chunks, messages)

    if not _REQUESTS_OK:
        raise RuntimeError("requests not installed")
    answer = ""
    for model in [LLM_MODEL, LLM_MODEL_FALLBACK]:
        resp = _requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={"model": model, "messages": chat_messages, "stream": False},
            timeout=180,
        )
        if resp.status_code == 404:
            continue
        resp.raise_for_status()
        answer = resp.json().get("message", {}).get("content", "").strip()
        break

    scores = [c["score"] for c in chunks]
    avg_score = sum(scores) / len(scores) if scores else 0.0
    unique_docs = len(set(c["source_file"] for c in chunks))
    confidence = compute_confidence(len(chunks), avg_score, unique_docs, mode)
    entities = _extract_entities(answer)
    sources = [
        {"source_file": c["source_file"], "section_title": c["section_title"],
         "score": round(c["score"], 4), "text_snippet": c["text"][:200]}
        for c in chunks
    ]

    log_event("query", {"query": query, "mode": mode, "chunks_retrieved": len(chunks),
                        "confidence": confidence, "unique_sources": unique_docs})
    return {"answer": answer, "sources": sources, "extracted_entities": entities,
            "confidence_score": confidence}
