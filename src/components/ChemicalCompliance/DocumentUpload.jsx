import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  LuCloudUpload,
  LuX,
  LuFileText,
  LuTrash2,
  LuChevronDown,
  LuEye,
} from "react-icons/lu";

const BACKEND = "http://localhost:8000";

const DOC_TYPES = ["SOP", "SDS", "REGULATION", "METHOD", "COA", "OTHER"];
const MATRIX_TYPES = ["cosmetic", "food", "solvent", "polymer", "pharma", "general"];

// ── Custom dropdown ─────────────────────────────────────────────────────────────
const MatrixDropdown = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1 rounded text-[10px] font-mono border bg-white/5 border-gray-700 text-gray-300 hover:border-gray-600 transition-colors min-w-[90px] justify-between"
      >
        <span>{value}</span>
        <LuChevronDown
          className={`w-3 h-3 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-[#141414] border border-gray-700 rounded shadow-xl z-20 min-w-[110px] overflow-hidden">
          {MATRIX_TYPES.map((m) => (
            <button
              key={m}
              onClick={() => { onChange(m); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[10px] font-mono transition-colors hover:bg-white/5 ${
                m === value ? "text-teal-300" : "text-gray-400"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Preview dialog ─────────────────────────────────────────────────────────────
const PreviewDialog = ({ doc, onClose }) => {
  const [content, setContent] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setLoadingPreview(true);
    fetch(`${BACKEND}/compliance/documents/${doc.doc_id}/preview`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setContent(data?.text || null); setLoadingPreview(false); })
      .catch(() => { setContent(null); setLoadingPreview(false); });
  }, [doc.doc_id]);

  const typeColor = {
    SOP: "text-teal-400",
    SDS: "text-amber-400",
    REGULATION: "text-purple-400",
    METHOD: "text-blue-400",
    COA: "text-green-400",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative bg-[#111] border border-gray-700 rounded-lg w-full max-w-2xl mx-6 shadow-2xl flex flex-col"
        style={{ maxHeight: "75vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
          <div>
            <div className="text-sm text-gray-200 font-mono">{doc.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-mono ${typeColor[doc.document_type] || "text-gray-400"}`}>
                {doc.document_type}
              </span>
              <span className="text-[10px] text-gray-700">·</span>
              <span className="text-[10px] text-gray-500">{doc.matrix_type}</span>
              <span className="text-[10px] text-gray-700">·</span>
              <span className="text-[10px] text-gray-500">rev {doc.revision}</span>
              {doc.upload_date && (
                <>
                  <span className="text-[10px] text-gray-700">·</span>
                  <span className="text-[10px] text-gray-600">
                    {new Date(doc.upload_date).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-300 transition-colors p-1"
          >
            <LuX className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 no-scrollbar">
          {loadingPreview ? (
            <div className="text-xs text-gray-600 text-center mt-10 animate-pulse">
              Loading preview…
            </div>
          ) : content ? (
            <pre className="text-[11px] text-gray-400 whitespace-pre-wrap leading-relaxed font-mono">
              {content}
            </pre>
          ) : (
            <div className="text-xs text-gray-600 text-center mt-10">
              Preview not available for this document.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const DocumentUpload = ({ onDocsChange }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [docType, setDocType] = useState("SOP");
  const [matrixType, setMatrixType] = useState("general");
  const [revision, setRevision] = useState("1.0");
  const [uploadProgress, setUploadProgress] = useState({});
  const [previewDoc, setPreviewDoc] = useState(null);
  const fileInputRef = useRef(null);

  const fetchDocs = useCallback(async () => {
    try {
      const resp = await fetch(`${BACKEND}/compliance/documents`);
      if (resp.ok) {
        const { documents } = await resp.json();
        setDocs(documents || []);
        onDocsChange?.(documents || []);
      }
    } catch {
      // Qdrant may not be running
    }
  }, [onDocsChange]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const processFiles = useCallback(
    async (rawFiles) => {
      setError(null);
      const fileArr = Array.from(rawFiles);

      for (const file of fileArr) {
        setUploadProgress((p) => ({ ...p, [file.name]: "reading" }));

        try {
          const content = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            if (file.name.match(/\.(pdf|docx)$/i)) {
              reader.readAsDataURL(file);
            } else {
              reader.readAsText(file);
            }
          });

          const rawContent = content.startsWith("data:")
            ? content.split(",")[1]
            : content;

          setUploadProgress((p) => ({ ...p, [file.name]: "uploading" }));

          const resp = await fetch(`${BACKEND}/compliance/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: file.name,
              content: rawContent,
              document_type: docType,
              matrix_type: matrixType,
              revision,
            }),
          });

          if (!resp.ok) {
            const detail = await resp.text();
            throw new Error(`Upload failed: ${detail}`);
          }

          const result = await resp.json();
          setUploadProgress((p) => ({
            ...p,
            [file.name]: `done (${result.chunks_created} chunks)`,
          }));

          await fetchDocs();
        } catch (e) {
          setError(e.message);
          setUploadProgress((p) => ({ ...p, [file.name]: "error" }));
        }
      }

      setLoading(false);
    },
    [docType, matrixType, revision, fetchDocs]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        setLoading(true);
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleDragOver = (e) => e.preventDefault();

  const handleDelete = async (e, docId) => {
    e.stopPropagation();
    try {
      await fetch(`${BACKEND}/compliance/documents/${docId}`, { method: "DELETE" });
      await fetchDocs();
    } catch (e) {
      setError(e.message);
    }
  };

  const docTypeColor = (dt) => ({
    SOP: "text-teal-400",
    SDS: "text-amber-400",
    REGULATION: "text-purple-400",
    METHOD: "text-blue-400",
    COA: "text-green-400",
    OTHER: "text-gray-400",
  }[dt] || "text-gray-400");

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-start overflow-y-auto no-scrollbar px-12"
      style={{ paddingTop: "clamp(60px, 10vh, 160px)", paddingBottom: "clamp(40px, 8vh, 120px)" }}
    >
      <div className="w-full max-w-2xl">
        {/* Selectors */}
        <div className="flex flex-wrap gap-4 mb-5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-gray-600">
              Document type
            </label>
            <div className="flex gap-1">
              {DOC_TYPES.map((dt) => (
                <button
                  key={dt}
                  onClick={() => setDocType(dt)}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-colors border ${
                    docType === dt
                      ? "bg-teal-900/40 border-teal-700 text-teal-300"
                      : "bg-white/5 border-gray-700 text-gray-500 hover:border-gray-600"
                  }`}
                >
                  {dt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-gray-600">
              Matrix
            </label>
            <MatrixDropdown value={matrixType} onChange={setMatrixType} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-gray-600">
              Revision
            </label>
            <input
              value={revision}
              onChange={(e) => setRevision(e.target.value)}
              className="bg-[#0e0e0e] border border-gray-700 rounded px-2 py-1 text-[10px] font-mono text-gray-300 w-16 focus:outline-none focus:border-teal-700"
            />
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-700 rounded flex items-center gap-4 py-4 px-6 cursor-pointer hover:border-teal-700/70 transition-colors mb-6"
        >
          <LuCloudUpload className="w-6 h-6 text-gray-600 flex-shrink-0" />
          <div>
            <div className="text-xs text-gray-400">
              Drag & drop files here, or{" "}
              <span className="text-teal-500 underline underline-offset-2">browse</span>
            </div>
            <div className="text-[10px] text-gray-600 mt-0.5 uppercase tracking-widest">
              .pdf · .docx · .txt
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length > 0) {
                setLoading(true);
                processFiles(e.target.files);
              }
            }}
          />
        </div>

        {/* Upload progress */}
        {Object.keys(uploadProgress).length > 0 && (
          <div className="mb-4 flex flex-col gap-1">
            {Object.entries(uploadProgress).map(([name, status]) => (
              <div key={name} className="flex items-center justify-between text-xs text-gray-500 font-mono">
                <span className="truncate max-w-xs">{name}</span>
                <span
                  className={
                    status === "error"
                      ? "text-red-500"
                      : status.startsWith("done")
                      ? "text-teal-500"
                      : "text-amber-500 animate-pulse"
                  }
                >
                  {status}
                </span>
              </div>
            ))}
          </div>
        )}

        {error && <div className="text-xs text-red-500 mb-4">{error}</div>}

        {/* Document list */}
        {docs.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">
              Ingested documents ({docs.length})
            </div>
            {docs.map((doc) => (
              <div
                key={doc.doc_id}
                onClick={() => setPreviewDoc(doc)}
                className="group bg-[#0e0e0e] border border-gray-800 rounded px-4 py-3 flex items-center justify-between cursor-pointer hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <LuFileText className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-gray-300 font-mono truncate">{doc.name}</div>
                    <div className="flex gap-2 mt-0.5">
                      <span className={`text-[10px] font-mono ${docTypeColor(doc.document_type)}`}>
                        {doc.document_type}
                      </span>
                      <span className="text-[10px] text-gray-600">·</span>
                      <span className="text-[10px] text-gray-600">{doc.matrix_type}</span>
                      <span className="text-[10px] text-gray-600">·</span>
                      <span className="text-[10px] text-gray-600">rev {doc.revision}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <LuEye className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-500 transition-colors" />
                  <button
                    onClick={(e) => handleDelete(e, doc.doc_id)}
                    className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-900/40 transition-colors"
                    title="Delete document"
                  >
                    <LuTrash2 className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {docs.length === 0 && !loading && (
          <div className="text-[11px] text-gray-700 text-center mt-4">
            No documents ingested yet. Upload files above to get started.
          </div>
        )}
      </div>

      {/* Preview dialog */}
      {previewDoc && (
        <PreviewDialog
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
};

export default DocumentUpload;
