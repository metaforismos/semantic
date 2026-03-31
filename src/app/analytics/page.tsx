"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  data?: {
    type: "report" | "funnel" | "metadata" | "error";
    explanation: string;
    query?: Record<string, unknown>;
    data?: {
      headers?: string[];
      rows?: string[][];
      rowCount?: number;
      dimensionCount?: number;
      metricCount?: number;
      sampleDimensions?: { apiName: string; uiName: string }[];
      sampleMetrics?: { apiName: string; uiName: string }[];
    };
    funnelSteps?: string[];
  };
}

interface ConnectionStatus {
  connected: boolean;
  propertyId?: string;
  dimensionCount?: number;
  metricCount?: number;
  error?: string;
}

export default function AnalyticsPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/analytics/metadata")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false, error: "Could not reach API" }))
      .finally(() => setStatusLoading(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput("");

    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/analytics/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, conversationHistory }),
      });

      const result = await res.json();

      if (result.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${result.error}` },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.explanation || "Query executed.",
            data: result,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error connecting to the analytics API." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="shrink-0 py-6">
        <h1 className="text-lg font-semibold text-text">Analytics Explorer</h1>
        <p className="text-sm text-text-muted mt-1">
          Ask questions about myHotel&apos;s Google Analytics data in natural language.
        </p>

        {/* Connection status */}
        <div className="mt-3">
          {statusLoading ? (
            <span className="text-xs text-text-dim">Checking connection...</span>
          ) : status?.connected ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Connected to property {status.propertyId} — {status.dimensionCount} dimensions, {status.metricCount} metrics
            </span>
          ) : (
            <div className="text-xs text-amber-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Not connected
              </span>
              {status?.error && (
                <p className="mt-1 text-text-dim">{status.error}</p>
              )}
              <p className="mt-1 text-text-dim">
                Set <code className="bg-surface-2 px-1 rounded">GA4_PROPERTY_ID</code> and{" "}
                <code className="bg-surface-2 px-1 rounded">GA4_SERVICE_ACCOUNT_JSON</code> in{" "}
                <code className="bg-surface-2 px-1 rounded">.env.local</code>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-16 text-text-dim text-sm">
            <p className="mb-4">Try asking:</p>
            <div className="space-y-2">
              {[
                "How many users visited the site in the last 30 days?",
                "Top 10 pages by pageviews this week",
                "Traffic by source/medium last month",
                "What countries are our users from?",
                "Show me a funnel: landing page → signup → purchase",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="block mx-auto text-left text-text-muted hover:text-text bg-surface hover:bg-surface-2 border border-border rounded-lg px-4 py-2 text-sm transition-colors max-w-md w-full"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-accent/15 text-accent-light"
                  : "bg-surface border border-border text-text"
              }`}
            >
              <p>{msg.content}</p>

              {/* Data table */}
              {msg.data?.data?.headers && msg.data.data.rows && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        {msg.data.data.headers.map((h) => (
                          <th key={h} className="text-left py-1.5 pr-4 text-text-muted font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {msg.data.data.rows.map((row, ri) => (
                        <tr key={ri} className="border-b border-border/50">
                          {row.map((cell, ci) => (
                            <td key={ci} className="py-1.5 pr-4 text-text">
                              {formatCell(cell, msg.data!.data!.headers![ci])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[10px] text-text-dim">
                    {msg.data.data.rowCount} rows returned
                  </p>
                </div>
              )}

              {/* Metadata display */}
              {msg.data?.type === "metadata" && msg.data.data && (
                <div className="mt-3 text-xs space-y-2">
                  <p className="text-text-muted">
                    {msg.data.data.dimensionCount} dimensions, {msg.data.data.metricCount} metrics available
                  </p>
                  {msg.data.data.sampleDimensions && (
                    <div>
                      <p className="text-text-muted font-medium mb-1">Sample dimensions:</p>
                      <div className="flex flex-wrap gap-1">
                        {msg.data.data.sampleDimensions.map((d) => (
                          <span key={d.apiName} className="bg-surface-2 px-1.5 py-0.5 rounded text-[10px]">
                            {d.apiName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Query debug */}
              {msg.data?.query && (
                <details className="mt-3">
                  <summary className="text-[10px] text-text-dim cursor-pointer hover:text-text-muted">
                    Show query
                  </summary>
                  <pre className="mt-1 text-[10px] bg-bg p-2 rounded overflow-x-auto">
                    {JSON.stringify(msg.data.query, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface border border-border rounded-lg px-4 py-3 text-sm text-text-dim">
              Querying GA4...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="shrink-0 pb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your analytics data..."
            disabled={loading || !status?.connected}
            className="flex-1 bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || !status?.connected}
            className="bg-accent/20 text-accent-light px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-accent/30 transition-colors disabled:opacity-30"
          >
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}

function formatCell(value: string, header: string): string {
  // Format numbers nicely
  const num = Number(value);
  if (!isNaN(num) && value !== "") {
    if (header.toLowerCase().includes("rate") || header.toLowerCase().includes("percentage")) {
      return `${(num * 100).toFixed(1)}%`;
    }
    if (header.toLowerCase().includes("duration") || header.toLowerCase().includes("time")) {
      const mins = Math.floor(num / 60);
      const secs = Math.round(num % 60);
      return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    }
    if (num > 1000) {
      return num.toLocaleString("en-US");
    }
  }
  // Format date dimensions
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return value;
}
