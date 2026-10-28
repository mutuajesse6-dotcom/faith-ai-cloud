"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
type Attached = { name: string; text: string };

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<Attached | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 100_000) {
      alert("File too big. Please use a text file under 100 KB.");
    } else {
      setFile({ name: f.name, text: await f.text() });
    }
    e.target.value = "";
  }

  async function send() {
    const text = input.trim();
    if ((!text && !file) || loading) return;

    const content = file
      ? `${text}\n\n[Attached file: ${file.name}]\n${file.text}`
      : text;

    const history: Msg[] = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setFile(null);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: reply }]);
      }
    } catch {
      setMessages([...history, { role: "assistant", content: "Sorry, the server did not respond." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app">
      <header>
        <h1>Faith AI Cloud</h1>
        <button onClick={() => setMessages([])}>New chat</button>
      </header>

      <section className="messages">
        {messages.length === 0 && <p className="hint">Ask me anything.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.content || "…"}
          </div>
        ))}
        <div ref={bottomRef} />
      </section>

      {file && (
        <div className="chip">
          📎 {file.name}
          <button onClick={() => setFile(null)}>✕</button>
        </div>
      )}

      <footer>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.csv,.json,.js,.ts,.tsx,.py,.html,.css"
          onChange={pickFile}
          hidden
        />
        <button className="plus" onClick={() => fileRef.current?.click()} title="Attach a text file">
          +
        </button>
        <textarea
          value={input}
          placeholder="Type a message…"
          rows={2}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button onClick={send} disabled={loading}>
          {loading ? "…" : "Send"}
        </button>
      </footer>
    </main>
  );
}