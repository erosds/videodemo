import React, { useState, useRef, useEffect } from "react";
import { LuSend, LuChevronDown, LuChevronRight, LuTrash2 } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

const DOC_TYPES = ["SOP", "SDS", "REGULATION", "METHOD", "COA"];
const MODES = [
  { id: "general", label: "General Search" },
  { id: "regulatory", label: "Regulatory" },
  { id: "sds_extract", label: "SDS Extract" },
];

// ── Confidence badge ───────────────────────────────────────────────────────────
const ConfidenceBadge = ({ score }) => {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.7
      ? "bg-green-900/40 text-green-400 border-green-800"
      : score >= 0.4
      ? "bg-amber-900/40 text-amber-400 border-amber-800"
      : "bg-red-900/40 text-red-400 border-red-800";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${color}`}>
      {pct}% confidence
    </span>
  );
};

// ── Entity chips ───────────────────────────────────────────────────────────────
const EntityChips = ({ entities }) => {
  const all = [
    ...(entities.cas_numbers || []).map((v) => ({ type: "CAS", value: v })),
    ...(entities.hazard_statements || []).map((v) => ({ type: "H", value: v })),
    ...(entities.precautionary_statements || []).map((v) => ({ type: "P", value: v })),
  ];
  if (!all.length) return null;
  const colors = {
    CAS: "bg-blue-900/30 text-blue-400",
    H: "bg-red-900/30 text-red-400",
    P: "bg-amber-900/30 text-amber-400",
  };
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {all.map((e, i) => (
        <span key={i} className={`text-[10px] px-2 py-0.5 rounded font-mono ${colors[e.type]}`}>
          {e.type}: {e.value}
        </span>
      ))}
    </div>
  );
};

// ── Sources accordion ──────────────────────────────────────────────────────────
const SourceEntry = ({ s }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="text-[10px] text-gray-500">
      <div className="flex items-center gap-1">
        {s.text_snippet && (
          <button onClick={() => setExpanded((o) => !o)} className="text-gray-700 hover:text-gray-500 transition-colors">
            {expanded ? <LuChevronDown className="w-2.5 h-2.5" /> : <LuChevronRight className="w-2.5 h-2.5" />}
          </button>
        )}
        <span className="text-gray-400 font-mono">{s.source_file}</span>
        {s.section_title && (
          <span className="text-gray-600"> / {s.section_title}</span>
        )}
        <span className="text-gray-700 ml-1">({Math.round(s.score * 100)}%)</span>
      </div>
      {expanded && s.text_snippet && (
        <pre className="mt-1 ml-3.5 text-[10px] text-gray-600 whitespace-pre-wrap font-mono leading-relaxed border-l border-gray-800 pl-2">
          {s.text_snippet}
        </pre>
      )}
    </div>
  );
};

const SourcesAccordion = ({ sources }) => {
  const [open, setOpen] = useState(false);
  if (!sources?.length) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
      >
        {open ? <LuChevronDown className="w-3 h-3" /> : <LuChevronRight className="w-3 h-3" />}
        {sources.length} source{sources.length !== 1 ? "s" : ""}
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-2 pl-3 border-l border-gray-800">
          {sources.map((s, i) => <SourceEntry key={i} s={s} />)}
        </div>
      )}
    </div>
  );
};

// ── Streaming cursor ───────────────────────────────────────────────────────────
const StreamingCursor = () => (
  <span className="inline-block w-2 h-4 bg-emerald-400 ml-0.5 animate-pulse align-middle" />
);

// ── Message bubble ─────────────────────────────────────────────────────────────
const MessageBubble = ({ msg }) => {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-md bg-emerald-900/30 border border-emerald-800/50 rounded px-4 py-2 text-sm text-gray-200">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-2xl bg-[#0e0e0e] border border-gray-800 rounded px-4 py-3">
        <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
          {msg.content}
          {msg.streaming && <StreamingCursor />}
        </div>
        {!msg.streaming && msg.confidence_score !== undefined && (
          <div className="mt-2">
            <ConfidenceBadge score={msg.confidence_score} />
          </div>
        )}
        {!msg.streaming && msg.extracted_entities && (
          <EntityChips entities={msg.extracted_entities} />
        )}
        {!msg.streaming && msg.sources && (
          <SourcesAccordion sources={msg.sources} />
        )}
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const ComplianceChat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("general");
  const [selectedDocTypes, setSelectedDocTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleDocType = (dt) =>
    setSelectedDocTypes((prev) =>
      prev.includes(dt) ? prev.filter((d) => d !== dt) : [...prev, dt]
    );

  const clearConversation = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setLoading(false);
  };

  const sendMessage = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setError(null);

    // Build history from current messages (all except current query)
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);

    // Placeholder assistant message with unique id
    const msgId = `msg-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: msgId, role: "assistant", content: "", streaming: true },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(`${BACKEND}/compliance/query/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          query: q,
          mode,
          document_types: selectedDocTypes,
          top_k: 5,
          messages: history,
        }),
      });

      if (!resp.ok) throw new Error(await resp.text());

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (event.type === "token") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId ? { ...m, content: m.content + event.content } : m
              )
            );
          } else if (event.type === "meta") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId
                  ? {
                      ...m,
                      streaming: false,
                      sources: event.sources,
                      confidence_score: event.confidence,
                      extracted_entities: event.entities,
                    }
                  : m
              )
            );
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (e) {
      if (e.name === "AbortError") return;
      setError(e.message);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      className="absolute inset-0 flex justify-center"
      style={{ paddingTop: "clamp(60px, 10vh, 160px)", paddingBottom: "clamp(40px, 8vh, 120px)" }}
    >
      <div className="w-full max-w-6xl flex px-8">
      {/* Left panel */}
      <div className="w-48 flex-shrink-0 flex flex-col gap-5 pr-4 pt-1 border-r border-gray-800/60">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">Mode</div>
          <div className="flex flex-col gap-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`text-left px-3 py-2 rounded text-xs transition-colors ${
                  mode === m.id
                    ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">
            Filter by type
          </div>
          <div className="flex flex-col gap-1">
            {DOC_TYPES.map((dt) => (
              <label key={dt} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedDocTypes.includes(dt)}
                  onChange={() => toggleDocType(dt)}
                  className="accent-emerald-500"
                />
                <span
                  className={`text-xs transition-colors ${
                    selectedDocTypes.includes(dt)
                      ? "text-emerald-300"
                      : "text-gray-500 group-hover:text-gray-400"
                  }`}
                >
                  {dt}
                </span>
              </label>
            ))}
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={clearConversation}
            className="flex items-center gap-1.5 text-[10px] text-gray-600 hover:text-red-400 transition-colors mt-auto"
          >
            <LuTrash2 className="w-3 h-3" />
            Clear chat
          </button>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-3 flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-700 text-sm mt-10">
              Ask a compliance question about your ingested documents.
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={msg.id ?? i} msg={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-800/60">
          {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
          <div className="flex gap-2 items-stretch">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a compliance question…"
              rows={2}
              disabled={loading}
              className="flex-1 bg-[#0e0e0e] border border-gray-700 rounded px-4 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-emerald-700 transition-colors disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="w-9 self-stretch rounded bg-emerald-700 flex items-center justify-center hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <LuSend className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="text-[10px] text-gray-700 mt-1">
            Enter to send · Shift+Enter new line · Mode: {mode}
            {messages.length > 0 && (
              <span className="ml-2 text-gray-800">
                · {Math.floor(messages.length / 2)} turn{Math.floor(messages.length / 2) !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ComplianceChat;
