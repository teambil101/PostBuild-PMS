import { useEffect, useRef, useState } from "react";
import { Send, X, Loader2, Sparkles, Code2, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToolCall = { id: string; query: string; status: "running" | "done" | "error"; result?: any };

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
};

const SESSION_KEY = "yahya.session_id";

const SUGGESTED = [
  "How many new contracts were signed this month?",
  "Service requests over 5,000 AED that are in progress or completed this month",
  "Which units are vacant right now?",
  "Top 5 vendors by completed jobs in the last 90 days",
];

function uid() {
  return Math.random().toString(36).slice(2);
}

export function YahyaDock() {
  const { user, session } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) setSessionId(stored);
  }, []);

  useEffect(() => {
    if (sessionId) localStorage.setItem(SESSION_KEY, sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const newChat = () => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (!session?.access_token) return;

    const userMsg: Msg = { id: uid(), role: "user", content: trimmed };
    const assistantMsg: Msg = { id: uid(), role: "assistant", content: "", toolCalls: [] };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setBusy(true);

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yahya-assistant`;

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: trimmed, session_id: sessionId }),
      });

      if (!resp.ok || !resp.body) {
        const text = await resp.text().catch(() => "");
        throw new Error(text || `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let event = "message";
          let data = "";
          for (const raw of block.split("\n")) {
            if (raw.startsWith("event: ")) event = raw.slice(7).trim();
            else if (raw.startsWith("data: ")) data += raw.slice(6);
          }
          if (!data) continue;
          let parsed: any;
          try { parsed = JSON.parse(data); } catch { continue; }

          if (event === "session") {
            if (parsed.session_id) setSessionId(parsed.session_id);
          } else if (event === "delta") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id ? { ...m, content: m.content + (parsed.content ?? "") } : m,
              ),
            );
          } else if (event === "tool_call") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      toolCalls: [
                        ...(m.toolCalls ?? []),
                        { id: parsed.id, query: parsed.query, status: "running" },
                      ],
                    }
                  : m,
              ),
            );
          } else if (event === "tool_result") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      toolCalls: (m.toolCalls ?? []).map((t) =>
                        t.id === parsed.id
                          ? {
                              ...t,
                              status: parsed.result?.error ? "error" : "done",
                              result: parsed.result,
                            }
                          : t,
                      ),
                    }
                  : m,
              ),
            );
          } else if (event === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: m.content + `\n\n_${parsed.message ?? "Something went wrong."}_` }
                  : m,
              ),
            );
          }
        }
      }
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: `Sorry, I hit an error: ${e instanceof Error ? e.message : "unknown"}` }
            : m,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 group flex items-center gap-2 bg-architect text-chalk h-12 pl-4 pr-5 rounded-full shadow-xl border border-architect/40 hover:scale-[1.02] transition-transform"
        >
          <Sparkles className="h-4 w-4 text-gold" strokeWidth={1.5} />
          <span className="font-display text-sm tracking-wide">Ask Yahya</span>
        </button>
      )}

      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-background border-l hairline shadow-2xl flex flex-col transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="h-14 px-5 flex items-center justify-between border-b hairline bg-architect text-chalk shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" strokeWidth={1.5} />
            <div>
              <div className="font-display text-sm leading-none">Yahya</div>
              <div className="mono text-[9px] uppercase tracking-wider text-chalk/60 mt-0.5">
                Property Ops Assistant
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={newChat}
                title="New chat"
                className="h-8 w-8 flex items-center justify-center rounded-sm hover:bg-chalk/10"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="h-8 w-8 flex items-center justify-center rounded-sm hover:bg-chalk/10"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
          {messages.length === 0 && (
            <div className="space-y-5">
              <div>
                <div className="label-eyebrow text-muted-foreground mb-2">Welcome</div>
                <p className="text-sm text-architect/80 leading-relaxed">
                  Ask me anything about your buildings, units, contracts, services, or
                  finances. I read the live database so the numbers are always current.
                </p>
              </div>
              <div>
                <div className="label-eyebrow text-muted-foreground mb-2">Try</div>
                <div className="flex flex-col gap-2">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-xs text-architect/80 border hairline rounded-sm px-3 py-2 hover:bg-muted/50 hover:text-architect transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Yahya is thinking…</span>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t hairline p-3 flex items-end gap-2 bg-background shrink-0"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask about contracts, services, finances…"
            disabled={busy}
            className="flex-1 resize-none rounded-sm border hairline bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:bg-background focus:border-architect/40 max-h-32"
          />
          <Button
            type="submit"
            size="sm"
            disabled={busy || !input.trim()}
            className="h-9 w-9 p-0 bg-architect text-chalk hover:bg-architect/90"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-architect text-chalk rounded-sm px-3 py-2 text-sm whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {msg.toolCalls && msg.toolCalls.length > 0 && (
        <div className="space-y-1.5">
          {msg.toolCalls.map((tc) => (
            <ToolCallBlock key={tc.id} tc={tc} />
          ))}
        </div>
      )}
      {msg.content && (
        <div className="prose prose-sm max-w-none prose-headings:font-display prose-headings:text-architect prose-p:text-architect/90 prose-table:text-xs prose-th:text-architect prose-td:text-architect/80 prose-td:py-1 prose-th:py-1 prose-table:my-2 prose-strong:text-architect">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function ToolCallBlock({ tc }: { tc: ToolCall }) {
  const [show, setShow] = useState(false);
  const rowCount = tc.result?.row_count;
  return (
    <div className="border hairline rounded-sm bg-muted/30 text-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-muted/60"
      >
        <div className="flex items-center gap-2 min-w-0">
          {tc.status === "running" ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : tc.status === "error" ? (
            <Code2 className="h-3 w-3 text-destructive" />
          ) : (
            <Code2 className="h-3 w-3 text-gold" />
          )}
          <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {tc.status === "running"
              ? "Querying database…"
              : tc.status === "error"
                ? "Query failed"
                : `Returned ${rowCount ?? 0} row${rowCount === 1 ? "" : "s"}`}
          </span>
        </div>
        <span className="mono text-[10px] text-muted-foreground">{show ? "hide" : "show"}</span>
      </button>
      {show && (
        <div className="border-t hairline bg-background px-3 py-2 max-h-60 overflow-auto">
          <pre className="mono text-[10px] text-architect/80 whitespace-pre-wrap break-words">
            {tc.query}
          </pre>
          {tc.result?.error && (
            <div className="mt-2 text-[10px] text-destructive">Error: {tc.result.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
