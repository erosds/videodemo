import React, { useState, useRef, useCallback } from "react";
import { LuCloudUpload, LuArrowRightLeft } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

const FileDropZone = ({ label, file, onFile }) => {
  const inputRef = useRef(null);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className={`flex-1 border-2 border-dashed rounded flex flex-col items-center gap-2 py-8 px-4 cursor-pointer transition-colors ${
        file
          ? "border-amber-700/60 bg-amber-900/10"
          : "border-gray-700 hover:border-amber-700/50"
      }`}
    >
      <LuCloudUpload className="w-6 h-6 text-gray-600" />
      <div className="text-[10px] uppercase tracking-widest text-gray-600">{label}</div>
      {file ? (
        <div className="text-xs text-amber-400 font-mono text-center truncate max-w-full px-2">
          {file.name}
        </div>
      ) : (
        <div className="text-xs text-gray-500">Drop .txt / .pdf / .docx</div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.pdf,.docx"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </div>
  );
};

const DeviationColor = ({ deviation, threshold }) => {
  if (deviation === null || deviation === undefined) {
    return <span className="text-[10px] text-gray-600 font-mono">N/A</span>;
  }
  const color =
    deviation > threshold * 3
      ? "text-red-400"
      : deviation > threshold * 2
      ? "text-amber-400"
      : deviation > threshold
      ? "text-yellow-400"
      : "text-green-400";
  return (
    <span className={`text-xs font-mono ${color}`}>{deviation.toFixed(2)}%</span>
  );
};

const BatchCompare = () => {
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [threshold, setThreshold] = useState(5.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const readFile = (f) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(f);
    });

  const compare = async () => {
    if (!file1 || !file2) {
      setError("Please upload both files first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const [content1, content2] = await Promise.all([readFile(file1), readFile(file2)]);
      const resp = await fetch(`${BACKEND}/compliance/batch-compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file1: { name: file1.name, content: content1 },
          file2: { name: file2.name, content: content2 },
          threshold,
        }),
      });
      if (!resp.ok) {
        const detail = await resp.text();
        throw new Error(detail);
      }
      const data = await resp.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-start overflow-y-auto no-scrollbar px-12"
      style={{ paddingTop: "clamp(60px, 10vh, 160px)", paddingBottom: "clamp(40px, 8vh, 120px)" }}
    >
      <div className="w-full max-w-3xl">
        {/* File zones */}
        <div className="flex gap-4 mb-6">
          <FileDropZone label="File A" file={file1} onFile={setFile1} />
          <div className="flex items-center text-gray-700">
            <LuArrowRightLeft className="w-5 h-5" />
          </div>
          <FileDropZone label="File B" file={file2} onFile={setFile2} />
        </div>

        {/* Threshold + Compare */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-gray-600">
              Threshold: {threshold.toFixed(1)}%
            </label>
            <input
              type="range"
              min={0.5}
              max={20}
              step={0.5}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-36 accent-amber-500"
            />
          </div>
          <button
            onClick={compare}
            disabled={loading || !file1 || !file2}
            className="px-5 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
          >
            {loading ? "Comparing…" : "Compare"}
          </button>
        </div>

        {error && <div className="text-xs text-red-500 mb-4">{error}</div>}

        {result && (
          <>
            {/* Summary */}
            <div className="bg-[#0e0e0e] border border-gray-800 rounded p-4 mb-4 text-sm text-gray-400 leading-relaxed">
              {result.summary}
            </div>

            {/* Table */}
            <div className="bg-[#0e0e0e] border border-gray-800 rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-2 text-[10px] uppercase tracking-widest text-gray-600 font-normal">Parameter</th>
                    <th className="text-right px-4 py-2 text-[10px] uppercase tracking-widest text-gray-600 font-normal">File A</th>
                    <th className="text-right px-4 py-2 text-[10px] uppercase tracking-widest text-gray-600 font-normal">File B</th>
                    <th className="text-right px-4 py-2 text-[10px] uppercase tracking-widest text-gray-600 font-normal">Deviation</th>
                    <th className="text-center px-4 py-2 text-[10px] uppercase tracking-widest text-gray-600 font-normal">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {result.parameters.map((p, i) => (
                    <tr
                      key={i}
                      className={`border-b border-gray-800/50 ${
                        p.flagged ? "bg-red-950/10" : ""
                      }`}
                    >
                      <td className="px-4 py-2 text-gray-300 font-mono capitalize">{p.name}</td>
                      <td className="px-4 py-2 text-right text-gray-400 font-mono">
                        {p.val1 !== null && p.val1 !== undefined ? p.val1 : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-400 font-mono">
                        {p.val2 !== null && p.val2 !== undefined ? p.val2 : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <DeviationColor deviation={p.deviation} threshold={threshold} />
                      </td>
                      <td className="px-4 py-2 text-center">
                        {p.flagged ? (
                          <span className="text-red-500 text-[10px]">⚠</span>
                        ) : (
                          <span className="text-green-600 text-[10px]">✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-3 text-[10px] text-gray-600">
              <span><span className="text-green-400">●</span> Within threshold</span>
              <span><span className="text-yellow-400">●</span> &gt;{threshold.toFixed(0)}%</span>
              <span><span className="text-amber-400">●</span> &gt;{(threshold * 2).toFixed(0)}%</span>
              <span><span className="text-red-400">●</span> &gt;{(threshold * 3).toFixed(0)}%</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BatchCompare;
