import asyncio
import json
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.chemical_compliance.compliance_models import (
    IngestRequest,
    IngestResponse,
    QueryRequest,
    QueryResponse,
    BatchCompareRequest,
    BatchCompareResponse,
    SdsExtractRequest,
    SdsExtractResponse,
    HealthResponse,
    IngredientCheckRequest,
    IngredientCheckResponse,
    FormulaScreenRequest,
    FormulaScreenResponse,
)

router = APIRouter(tags=["chemical-compliance"])


# ── Health ─────────────────────────────────────────────────────────────────────

@router.get("/health", response_model=HealthResponse)
async def compliance_health():
    """Ping Qdrant and Ollama to verify services are reachable."""
    import requests as _r

    qdrant_status = "ok"
    ollama_status = "ok"

    try:
        resp = _r.get("http://localhost:6333/collections", timeout=3)
        if not resp.ok:
            qdrant_status = f"error {resp.status_code}"
    except Exception as e:
        qdrant_status = f"unreachable: {e}"

    try:
        resp = _r.get("http://localhost:11434/api/tags", timeout=3)
        if not resp.ok:
            ollama_status = f"error {resp.status_code}"
    except Exception as e:
        ollama_status = f"unreachable: {e}"

    return HealthResponse(qdrant=qdrant_status, ollama=ollama_status)


# ── Document ingestion ─────────────────────────────────────────────────────────

@router.post("/upload", response_model=IngestResponse)
async def upload_document(req: IngestRequest):
    """Parse, chunk, embed and store a document in Qdrant."""
    try:
        loop = asyncio.get_running_loop()
        from app.chemical_compliance import document_ingestion_service as dis
        result = await loop.run_in_executor(
            None,
            lambda: dis.ingest_document(
                req.name, req.content, req.document_type, req.matrix_type, req.revision
            ),
        )
        return IngestResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents")
async def list_documents():
    """List all ingested documents (one entry per doc_id)."""
    try:
        loop = asyncio.get_running_loop()
        from app.chemical_compliance import document_ingestion_service as dis
        docs = await loop.run_in_executor(None, dis.list_documents)
        return {"documents": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """Remove all chunks for a document by doc_id."""
    try:
        loop = asyncio.get_running_loop()
        from app.chemical_compliance import document_ingestion_service as dis
        result = await loop.run_in_executor(None, lambda: dis.delete_document(doc_id))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/{doc_id}/preview")
async def document_preview(doc_id: str):
    """Return first N chunk texts for a document (for UI preview)."""
    try:
        loop = asyncio.get_running_loop()
        from app.chemical_compliance import document_ingestion_service as dis
        chunks = await loop.run_in_executor(None, lambda: dis.get_document_preview(doc_id))
        return {"text": "\n\n---\n\n".join(chunks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── RAG query ─────────────────────────────────────────────────────────────────

@router.post("/query", response_model=QueryResponse)
async def compliance_query(req: QueryRequest):
    """Run the full RAG pipeline (non-streaming fallback)."""
    try:
        loop = asyncio.get_running_loop()
        from app.chemical_compliance import rag_query_service as rqs
        messages = [m.model_dump() for m in req.messages]
        result = await loop.run_in_executor(
            None,
            lambda: rqs.query_pipeline(
                req.query, req.mode, req.document_types, req.top_k, messages
            ),
        )
        return QueryResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query/stream")
async def compliance_query_stream(req: QueryRequest):
    """Streaming RAG pipeline via Server-Sent Events."""
    from app.chemical_compliance import rag_query_service as rqs
    messages = [m.model_dump() for m in req.messages]

    async def event_generator():
        try:
            async for event in rqs.stream_query_pipeline(
                req.query, req.mode, req.document_types, req.top_k, messages
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── SDS extraction ─────────────────────────────────────────────────────────────

@router.post("/sds-extract", response_model=SdsExtractResponse)
async def sds_extract(req: SdsExtractRequest):
    """Extract structured hazard data from SDS text without LLM."""
    try:
        from app.chemical_compliance import sds_extract_mode as sem
        from app.chemical_compliance import audit_service as aus
        result = sem.extract_sds_data(req.content)
        aus.log_event("sds_extract", {"substance": result.get("substance_name", "unknown")})
        return SdsExtractResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Batch CoA comparison ───────────────────────────────────────────────────────

@router.post("/batch-compare", response_model=BatchCompareResponse)
async def batch_compare(req: BatchCompareRequest):
    """Compare two CoA documents and return per-parameter deviation analysis."""
    try:
        loop = asyncio.get_running_loop()
        from app.chemical_compliance import batch_compare_mode as bcm
        from app.chemical_compliance import audit_service as aus
        result = await loop.run_in_executor(
            None,
            lambda: bcm.compare_coas(req.file1.content, req.file2.content, req.threshold),
        )
        aus.log_event("batch_compare", {
            "file1": req.file1.name,
            "file2": req.file2.name,
            "threshold": req.threshold,
            "flagged": sum(1 for p in result["parameters"] if p["flagged"]),
        })
        return BatchCompareResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Ingredient compliance ──────────────────────────────────────────────────────

@router.post("/ingredient-check", response_model=IngredientCheckResponse)
async def ingredient_check(req: IngredientCheckRequest):
    """Check a single ingredient against EU Cosmetics Regulation 1223/2009."""
    try:
        from app.chemical_compliance.ingredient_compliance_service import check_ingredient
        from app.chemical_compliance.audit_service import log_event
        result = check_ingredient(req.inci_name, req.concentration_pct, req.product_type.value)
        log_event("ingredient_check", {
            "inci": req.inci_name,
            "conc": req.concentration_pct,
            "product_type": req.product_type.value,
            "status": result["status"],
        })
        return IngredientCheckResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/formula-screen", response_model=FormulaScreenResponse)
async def formula_screen(req: FormulaScreenRequest):
    """Screen a complete formula for EU Cosmetics Regulation compliance."""
    try:
        from app.chemical_compliance.ingredient_compliance_service import screen_formula
        from app.chemical_compliance.audit_service import log_event
        ingredients = [i.model_dump() for i in req.ingredients]
        result = screen_formula(ingredients, req.product_type.value)
        log_event("formula_screen", {
            "n_ingredients": len(req.ingredients),
            "product_type": req.product_type.value,
            "status": result["overall_status"],
        })
        return FormulaScreenResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ingredients/search")
async def ingredients_search(q: str = "", limit: int = 10):
    """Fuzzy search ingredients by INCI name or CAS number."""
    try:
        from app.chemical_compliance.ingredient_compliance_service import search_ingredient
        return {"results": search_ingredient(q, limit)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Audit trail ───────────────────────────────────────────────────────────────

@router.get("/audit-log")
async def get_audit_log():
    """Return the audit log (newest first)."""
    try:
        from app.chemical_compliance import audit_service as aus
        return {"events": aus.get_log()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/audit-log")
async def clear_audit_log():
    """Clear the audit log."""
    try:
        from app.chemical_compliance import audit_service as aus
        aus.clear_log()
        return {"status": "cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
