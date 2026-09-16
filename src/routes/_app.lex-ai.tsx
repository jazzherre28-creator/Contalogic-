import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Sparkles, Send, Loader2, User2, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { ENTITY_LABEL, SECTOR_LABEL } from "@/lib/sectors";

export const Route = createFileRoute("/_app/lex-ai")({
  component: LexAiPage,
});

type Msg = { role: "user" | "assistant"; content: string };

function LexAiPage() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const suggestions = profile?.entity_type === "juridica"
    ? [
        "¿Qué requisitos exige el Art. 107 ET para deducir un gasto?",
        "Diferencias entre Renta Líquida y Renta Presuntiva",
        "¿Cuándo es obligatorio facturar electrónicamente?",
      ]
    : [
        "¿Me conviene el Régimen Simple de Tributación?",
        "Deducciones personales que puedo aplicar este año",
        "¿Cómo funcionan las cédulas en la declaración de renta?",
      ];

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput("");
    const userMsg: Msg = { role: "user", content };
    const next = [...messages, userMsg];
    setMessages(next);
    setStreaming(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lex-ai-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: next,
          entityType: profile?.entity_type,
          sector: profile?.sector,
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Demasiadas solicitudes, intenta luego.");
        else if (resp.status === 402) toast.error("Créditos AI agotados. Recarga tu workspace.");
        else toast.error("Error contactando a LEX AI");
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistant = "";
      let done = false;

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const upsert = (chunk: string) => {
        assistant += chunk;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistant };
          return copy;
        });
        scrollerRef.current?.scrollTo({
          top: scrollerRef.current.scrollHeight,
          behavior: "smooth",
        });
      };

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="glass-neon scanline relative flex h-[70vh] flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-neon" />
            <h2 className="text-sm font-semibold">LEX AI · Asesor legal-contable</h2>
          </div>
          <span className="chip">
            {profile?.entity_type ? ENTITY_LABEL[profile.entity_type] : "—"} ·{" "}
            {profile?.sector ? SECTOR_LABEL[profile.sector] : "—"}
          </span>
        </div>

        <div
          ref={scrollerRef}
          className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-white/5 bg-black/20 p-3"
        >
          {messages.length === 0 && (
            <div className="grid h-full place-items-center text-center">
              <div>
                <Sparkles className="mx-auto h-10 w-10 text-neon opacity-70" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Haz una pregunta o usa una sugerencia →
                </p>
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && (
                <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[oklch(0.7_0.22_245/0.5)] bg-[oklch(0.7_0.22_245/0.1)] text-neon">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-[var(--gradient-emerald)] text-[oklch(0.12_0.02_260)]"
                    : "border border-white/10 bg-white/[0.03]"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-li:my-0.5 prose-headings:text-neon">
                    <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                  </div>
                ) : (
                  <div>{m.content}</div>
                )}
              </div>
              {m.role === "user" && (
                <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[oklch(0.92_0.2_105/0.5)] bg-[oklch(0.92_0.2_105/0.1)] text-emerald-glow">
                  <User2 className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mt-3 flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta legal o tributaria…"
            className="input-neon flex-1"
            disabled={streaming}
          />
          <button type="submit" className="btn-emerald !px-4" disabled={streaming || !input.trim()}>
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>

      <aside className="glass space-y-3 p-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Sugerencias contextuales
        </div>
        {suggestions.map((s) => (
          <button
            key={s}
            disabled={streaming}
            onClick={() => send(s)}
            className="block w-full rounded-md border border-white/10 bg-white/[0.02] p-3 text-left text-sm transition hover:border-[oklch(0.7_0.22_245/0.5)] hover:text-neon"
          >
            {s}
          </button>
        ))}
        <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3 text-[11px] text-muted-foreground">
          LEX AI orienta con base en normativa colombiana. No reemplaza asesoría de un contador
          público titulado.
        </div>
      </aside>
    </div>
  );
}
