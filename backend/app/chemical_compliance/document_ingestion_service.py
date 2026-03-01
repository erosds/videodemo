import base64
import io
import os
import re
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

# Optional heavy deps — degrade gracefully
try:
    from qdrant_client import QdrantClient
    from qdrant_client.http.models import (
        Distance, VectorParams, PointStruct,
        Filter, FieldCondition, MatchValue,
    )
    _QDRANT_OK = True
except ImportError:
    _QDRANT_OK = False

try:
    import requests as _requests
    _REQUESTS_OK = True
except ImportError:
    _REQUESTS_OK = False

try:
    import pymupdf4llm as _pymupdf4llm
    import fitz as _fitz
    _PYMUPDF4LLM_OK = True
except ImportError:
    _PYMUPDF4LLM_OK = False

try:
    from PIL import Image as _PILImage
    from ocrmac.ocrmac import text_from_image as _ocrmac_text
    _OCRMAC_OK = True
except ImportError:
    _OCRMAC_OK = False

try:
    import numpy as _np
    from rapidocr import RapidOCR as _RapidOCR
    _RAPIDOCR_OK = True
except ImportError:
    _RAPIDOCR_OK = False

try:
    from pdfminer.high_level import extract_text as _pdf_extract
    _PDF_OK = True
except ImportError:
    _PDF_OK = False

try:
    import pdfplumber as _pdfplumber
    _PDFPLUMBER_OK = True
except ImportError:
    _PDFPLUMBER_OK = False

try:
    from docx import Document as _DocxDocument
    _DOCX_OK = True
except ImportError:
    _DOCX_OK = False


QDRANT_URL = "http://localhost:6333"
OLLAMA_URL = "http://localhost:11434"
COLLECTION = "chemical_documents"
EMBED_DIM = 768
CHUNK_SIZE = 600   # slightly larger to keep more context per chunk
CHUNK_OVERLAP_LINES = 3

# H/P code pattern — never split these lines from surrounding context
_HP_PATTERN = re.compile(r'\b[HP]\d{3}[A-Z0-9]*\b')
# Markdown heading pattern
_MD_HEADING = re.compile(r'^(#{1,4})\s+(.+)$')


def _get_qdrant() -> "QdrantClient":
    if not _QDRANT_OK:
        raise RuntimeError("qdrant-client not installed. Run: pip install qdrant-client")
    client = QdrantClient(url=QDRANT_URL)
    _ensure_collection(client)
    return client


def _ensure_collection(client: "QdrantClient"):
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION not in existing:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
        )


def _embed(texts: List[str]) -> List[List[float]]:
    """Call Ollama nomic-embed-text to get embeddings."""
    if not _REQUESTS_OK:
        raise RuntimeError("requests not installed")
    vectors = []
    for text in texts:
        resp = _requests.post(
            f"{OLLAMA_URL}/api/embeddings",
            json={"model": "nomic-embed-text", "prompt": text},
            timeout=60,
        )
        resp.raise_for_status()
        vectors.append(resp.json()["embedding"])
    return vectors


def _ocr_pdf_pages(raw: bytes) -> str:
    """
    OCR a scanned PDF using Apple Vision (ocrmac) + PyMuPDF page rendering.
    Renders each page at 2.5x zoom and runs Vision framework OCR (Italian + English).
    Returns plain text sorted top-to-bottom, left-to-right.
    """
    doc = _fitz.open(stream=raw, filetype="pdf")
    pages_text: List[str] = []

    for page_num, page in enumerate(doc):
        mat = _fitz.Matrix(2.5, 2.5)
        pix = page.get_pixmap(matrix=mat, colorspace=_fitz.csRGB)
        img = _PILImage.frombytes("RGB", [pix.width, pix.height], pix.samples)

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
                img.save(f.name)
                tmp_path = f.name
            annotations = _ocrmac_text(
                tmp_path, language_preference=["it-IT", "en-US"]
            )
        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

        if not annotations:
            continue

        # Coordinates: [x, y, w, h] — y=1.0 is page top, y=0.0 is bottom.
        # Sort top→bottom (y desc), then left→right (x asc) within same row.
        # Group items within 1.5% of y as the same row.
        ROW_THRESHOLD = 0.015
        rows: List[List[tuple]] = []
        for ann in sorted(annotations, key=lambda a: -a[2][1]):
            y = ann[2][1]
            if rows and abs(rows[-1][0][2][1] - y) <= ROW_THRESHOLD:
                rows[-1].append(ann)
            else:
                rows.append([ann])

        line_parts: List[str] = []
        for row in rows:
            row_sorted = sorted(row, key=lambda a: a[2][0])
            line_parts.append("  ".join(a[0] for a in row_sorted))

        pages_text.append(f"--- Pagina {page_num + 1} ---\n" + "\n".join(line_parts))

    doc.close()
    return "\n\n".join(pages_text)


def _ocr_pdf_rapidocr(raw: bytes) -> str:
    """
    OCR a scanned PDF using RapidOCR (cross-platform: Windows / Linux / macOS).
    Uses PyMuPDF to render pages at 2.5x zoom, then runs RapidOCR on each page.
    """
    engine = _RapidOCR()
    doc = _fitz.open(stream=raw, filetype="pdf")
    pages_text: List[str] = []

    for page_num, page in enumerate(doc):
        mat = _fitz.Matrix(2.5, 2.5)
        pix = page.get_pixmap(matrix=mat, colorspace=_fitz.csRGB)
        # PyMuPDF gives RGB; RapidOCR expects BGR numpy array
        img_rgb = _np.frombuffer(pix.samples, dtype=_np.uint8).reshape(
            pix.height, pix.width, 3
        )
        img_bgr = img_rgb[:, :, ::-1]

        result, _ = engine(img_bgr)
        if not result:
            continue

        # result: list of [bbox_pts, text, confidence]
        # Sort top→bottom by first bbox y-coordinate, then left→right by x
        sorted_result = sorted(result, key=lambda r: (r[0][0][1], r[0][0][0]))
        lines = [r[1] for r in sorted_result if r[1].strip()]
        pages_text.append(f"--- Pagina {page_num + 1} ---\n" + "\n".join(lines))

    doc.close()
    return "\n\n".join(pages_text)


def _extract_tables_pdfplumber(raw: bytes):
    """Extract text + tables from PDF as Markdown. Returns text or None on failure."""
    if not _PDFPLUMBER_OK:
        return None
    try:
        with _pdfplumber.open(io.BytesIO(raw)) as pdf:
            parts = []
            for page in pdf.pages:
                text = page.extract_text() or ""
                if text.strip():
                    parts.append(text)
                for table in page.extract_tables():
                    if table:
                        rows = [
                            "| " + " | ".join(str(c or "") for c in row) + " |"
                            for row in table
                        ]
                        parts.append("\n".join(rows))
            return "\n\n".join(parts) if parts else None
    except Exception:
        return None


def _parse_pdf(raw: bytes) -> tuple[str, bool]:
    """
    Extract text from PDF bytes. Returns (text, is_markdown).
    Pipeline:
      1. pdfplumber (table-aware, best for regulatory tables)
      2. pymupdf4llm → Markdown (text-based PDFs, columns)
      3. ocrmac Apple Vision OCR (scanned/image PDFs) → plain text
      4. pdfminer.six fallback → plain text
    """
    # 1. Try pdfplumber first (priority for tables)
    plumber_text = _extract_tables_pdfplumber(raw)
    if plumber_text and len(plumber_text.strip()) > 100:
        return plumber_text, True

    # 2. Try pymupdf4llm (fast, no OCR)
    if _PYMUPDF4LLM_OK:
        try:
            doc = _fitz.open(stream=raw, filetype="pdf")
            md = _pymupdf4llm.to_markdown(doc)
            doc.close()
            if md.strip():
                return md, True
        except Exception:
            pass

    # 2a. OCR with Apple Vision — macOS only, highest quality
    if _OCRMAC_OK and _PYMUPDF4LLM_OK:
        try:
            text = _ocr_pdf_pages(raw)
            if text.strip():
                return text, False
        except Exception:
            pass

    # 2b. RapidOCR — cross-platform (Windows / Linux), no system deps
    if _RAPIDOCR_OK and _PYMUPDF4LLM_OK:
        try:
            text = _ocr_pdf_rapidocr(raw)
            if text.strip():
                return text, False
        except Exception:
            pass

    # 3. Fallback: pdfminer.six
    if not _PDF_OK:
        raise RuntimeError(
            "No PDF parser available. Install pymupdf4llm or pdfminer.six."
        )
    return _pdf_extract(io.BytesIO(raw)), False


def _parse_content(name: str, content: str) -> tuple[str, bool]:
    """
    Parse file content based on extension.
    Returns (text, is_markdown).
    PDFs/DOCX arrive as base64; plain text files arrive as-is.
    """
    lower = name.lower()

    if lower.endswith(".pdf"):
        raw = base64.b64decode(content)
        return _parse_pdf(raw)

    if lower.endswith(".docx"):
        if not _DOCX_OK:
            raise RuntimeError("python-docx not installed. Run: pip install python-docx")
        raw = base64.b64decode(content)
        doc = _DocxDocument(io.BytesIO(raw))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip()), False

    # Plain text (.txt and anything else)
    return content, False


def _split_by_paragraphs(text: str, section_title: str) -> List[Dict[str, str]]:
    """Split a long text block into overlapping paragraph-based chunks."""
    paras = [p.strip() for p in re.split(r'\n\n+', text) if p.strip()]
    chunks: List[Dict[str, str]] = []
    buf: List[str] = []
    buf_len = 0
    for para in paras:
        if buf_len + len(para) > CHUNK_SIZE and buf:
            chunks.append({"text": "\n\n".join(buf), "section_title": section_title})
            buf = buf[-1:]  # keep last paragraph as overlap
            buf_len = len(buf[0]) if buf else 0
        buf.append(para)
        buf_len += len(para) + 2
    if buf:
        chunks.append({"text": "\n\n".join(buf), "section_title": section_title})
    return chunks or [{"text": text[:CHUNK_SIZE], "section_title": section_title}]


def _chunk_markdown(text: str) -> List[Dict[str, str]]:
    """
    Markdown-aware chunker (for Docling output).
    - Splits on # headings → section boundaries
    - Preserves Markdown tables as atomic units (never split mid-table)
    - Sub-chunks long sections by paragraph with overlap
    """
    chunks: List[Dict[str, str]] = []
    current_title = "General"
    current_buf: List[str] = []

    def flush_section():
        text_block = "\n".join(current_buf).strip()
        if not text_block:
            return
        if len(text_block) <= CHUNK_SIZE:
            chunks.append({"text": text_block, "section_title": current_title})
        else:
            chunks.extend(_split_by_paragraphs(text_block, current_title))

    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        heading = _MD_HEADING.match(line)

        # Heading: flush current section, start new
        if heading:
            flush_section()
            current_title = heading.group(2).strip()
            current_buf = []
            i += 1
            continue

        # Markdown table: collect all consecutive table rows as one unit
        if line.startswith("|"):
            table_lines: List[str] = []
            while i < len(lines) and (lines[i].startswith("|") or lines[i].strip() == ""):
                if lines[i].startswith("|"):
                    table_lines.append(lines[i])
                i += 1
            table_text = "\n".join(table_lines)
            if len(table_text) <= CHUNK_SIZE * 3:
                # Table fits in a reasonable chunk
                current_buf.append(table_text)
            else:
                # Very large table: keep header rows + split data rows
                header = table_lines[:2]
                data = table_lines[2:]
                rows_per_chunk = max(5, CHUNK_SIZE // max(1, max(len(r) for r in data[:10]) if data else 1))
                for j in range(0, len(data), rows_per_chunk):
                    chunk_rows = header + data[j : j + rows_per_chunk]
                    chunks.append({"text": "\n".join(chunk_rows), "section_title": current_title})
            continue

        current_buf.append(line)
        i += 1

    flush_section()
    return chunks or [{"text": text[:CHUNK_SIZE], "section_title": "General"}]


def _smart_chunk(text: str) -> List[Dict[str, str]]:
    """
    Split text into chunks of ~CHUNK_SIZE chars with CHUNK_OVERLAP lines.
    Section titles are detected conservatively (ALL-CAPS or ends with ':')
    to avoid fragmenting list-style documents into single-line chunks.
    Never splits H/P code lines from adjacent context.
    Returns list of {text, section_title}.
    """
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    chunks: List[Dict[str, str]] = []
    current_section = "General"
    buf: List[str] = []
    buf_len = 0

    # Conservative title detection: all-caps words only, or explicit "SECTION N:" pattern
    _title_re = re.compile(r'^(?:[A-Z][A-Z\s\d\-/]{2,}:|SECTION\s+\d|SEZIONE\s+\d)', re.IGNORECASE)

    def flush():
        joined = "\n".join(buf).strip()
        if joined:
            chunks.append({"text": joined, "section_title": current_section})

    for line in lines:
        words = line.split()

        # A section title: matches pattern AND is short AND not a list item (no leading digit/bullet)
        is_title = (
            len(line) <= 70
            and len(words) <= 8
            and not re.match(r'^[\d\-\*\•]', line)
            and (_title_re.match(line) or (line.isupper() and len(words) <= 6))
        )

        if is_title:
            # Flush current buffer when it has enough content
            if buf and buf_len >= CHUNK_SIZE // 4:
                flush()
                # Keep last few lines as overlap for continuity
                overlap = buf[-3:]
                buf = overlap
                buf_len = sum(len(l) + 1 for l in buf)
            current_section = line.rstrip(":")

        buf.append(line)
        buf_len += len(line) + 1

        if buf_len >= CHUNK_SIZE:
            # Don't split if current line has an H/P code
            if _HP_PATTERN.search(line):
                continue
            flush()
            # Overlap: keep last 3 lines
            overlap = buf[-3:]
            buf = overlap
            buf_len = sum(len(l) + 1 for l in buf)

    if buf:
        flush()

    return chunks if chunks else [{"text": text[:CHUNK_SIZE], "section_title": "General"}]


def ingest_document(
    name: str,
    content: str,
    document_type: str,
    matrix_type: str,
    revision: str,
) -> Dict[str, Any]:
    """Parse, chunk, embed and store a document. Returns {doc_id, chunks_created, status}."""
    from app.chemical_compliance.audit_service import log_event

    text, is_markdown = _parse_content(name, content)
    chunks = _chunk_markdown(text) if is_markdown else _smart_chunk(text)
    doc_id = str(uuid.uuid4())
    upload_date = datetime.now(timezone.utc).isoformat()

    vectors = _embed([c["text"] for c in chunks])

    client = _get_qdrant()
    points = []
    for i, (chunk, vec) in enumerate(zip(chunks, vectors)):
        points.append(
            PointStruct(
                id=str(uuid.uuid4()),
                vector=vec,
                payload={
                    "text": chunk["text"],
                    "document_type": document_type,
                    "matrix_type": matrix_type,
                    "revision": revision,
                    "source_file": name,
                    "section_title": chunk["section_title"],
                    "upload_date": upload_date,
                    "doc_id": doc_id,
                    "chunk_index": i,
                },
            )
        )

    client.upsert(collection_name=COLLECTION, points=points)

    log_event("ingest", {
        "doc_id": doc_id,
        "name": name,
        "document_type": document_type,
        "chunks_created": len(chunks),
    })

    return {"doc_id": doc_id, "chunks_created": len(chunks), "status": "ok"}


def list_documents() -> List[Dict[str, Any]]:
    """Return distinct documents from Qdrant (one entry per doc_id)."""
    client = _get_qdrant()
    seen_ids: set = set()
    docs = []
    offset = None

    while True:
        result, next_offset = client.scroll(
            collection_name=COLLECTION,
            limit=100,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        for point in result:
            p = point.payload or {}
            doc_id = p.get("doc_id")
            if doc_id and doc_id not in seen_ids:
                seen_ids.add(doc_id)
                docs.append({
                    "doc_id": doc_id,
                    "name": p.get("source_file", ""),
                    "document_type": p.get("document_type", ""),
                    "matrix_type": p.get("matrix_type", ""),
                    "revision": p.get("revision", ""),
                    "upload_date": p.get("upload_date", ""),
                })
        if next_offset is None:
            break
        offset = next_offset

    return docs


def delete_document(doc_id: str) -> Dict[str, Any]:
    """Remove all chunks belonging to a doc_id."""
    from app.chemical_compliance.audit_service import log_event

    client = _get_qdrant()
    client.delete(
        collection_name=COLLECTION,
        points_selector=Filter(
            must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]
        ),
    )
    log_event("delete", {"doc_id": doc_id})
    return {"status": "deleted", "doc_id": doc_id}


def get_document_preview(doc_id: str, max_chunks: int = 15) -> List[str]:
    """Return up to max_chunks text chunks for a document, sorted by chunk_index."""
    client = _get_qdrant()
    result, _ = client.scroll(
        collection_name=COLLECTION,
        scroll_filter=Filter(
            must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]
        ),
        limit=max_chunks,
        with_payload=True,
        with_vectors=False,
    )
    chunks = sorted(result, key=lambda p: p.payload.get("chunk_index", 0))
    return [p.payload.get("text", "") for p in chunks if p.payload.get("text", "").strip()]
