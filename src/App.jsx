import { useState, useRef, useEffect } from "react";
import { STYLES } from "./styles";
import "./App.css";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

export default function App() {
  const [style, setStyle] = useState(STYLES[0]);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function sendMessage() {
    if (!input.trim() || busy) return;
    setError("");

    const userMsg = { role: "user", content: input.trim() };
    const history = [...msgs, userMsg];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: style.system },
            ...history,
          ],
          max_tokens: 300,
          temperature: style.temperature,
          stream: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }

      // Handle streaming SSE response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const chunk = JSON.parse(data);
            const delta = chunk.choices?.[0]?.delta?.content || "";
            if (delta) {
              setMsgs((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + delta,
                };
                return updated;
              });
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch (err) {
      setError(err.message);
      setMsgs((prev) => prev.slice(0, -1)); // remove empty assistant bubble
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function switchStyle(s) {
    setStyle(s);
    setMsgs([]);
    setError("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div className="app">
      {/* Style selector tabs */}
      <div className="tabs">
        {STYLES.map((s) => (
          <button
            key={s.id}
            className={`tab ${style.id === s.id ? "active" : ""}`}
            style={
              style.id === s.id
                ? { borderColor: s.color, background: s.bg }
                : {}
            }
            onClick={() => switchStyle(s)}
          >
            <span
              className="tab-name"
              style={style.id === s.id ? { color: s.color } : {}}
            >
              {s.short}
            </span>
            <span className="tab-desc">{s.desc}</span>
          </button>
        ))}
        <button
          className="clear-btn"
          onClick={() => { setMsgs([]); setError(""); }}
        >
          Clear
        </button>
      </div>

      {/* Message feed */}
      <div className="feed">
        {msgs.length === 0 && (
          <div className="empty">
            <div
              className="avatar-lg"
              style={{ background: style.bg, color: style.color }}
            >
              {style.avatar}
            </div>
            <p className="empty-name">{style.name}</p>
            <p className="empty-desc">{style.desc}</p>
            <p className="empty-cta">Say something.</p>
          </div>
        )}

        {msgs.map((msg, i) => (
          <div key={i} className={`msg-row ${msg.role}`}>
            {msg.role === "assistant" && (
              <div
                className="avatar"
                style={{ background: style.bg, color: style.color }}
              >
                {style.avatar}
              </div>
            )}
            <div className={`bubble ${msg.role}`}>
              {msg.content || (
                busy && i === msgs.length - 1 ? (
                  <span className="dots">
                    {[0, 0.18, 0.36].map((d, j) => (
                      <span
                        key={j}
                        className="dot"
                        style={{
                          background: style.color,
                          animationDelay: `${d}s`,
                        }}
                      />
                    ))}
                  </span>
                ) : null
              )}
            </div>
          </div>
        ))}

        {error && <div className="error">{error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="input-bar">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
          placeholder={`Talk to ${style.name}...`}
          rows={1}
          className="input"
        />
        <button
          className="send"
          onClick={sendMessage}
          disabled={!input.trim() || busy}
          style={
            input.trim() && !busy
              ? { background: style.color, color: "#fff", border: "none" }
              : {}
          }
        >
          {busy ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
