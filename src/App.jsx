import { useState, useRef, useEffect } from "react";
import { STYLES } from "./styles";
import "./App.css";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

export default function App() {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const style = STYLES[0]; // Johnny only
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

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

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
      setMsgs((prev) => prev.slice(0, -1));
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

  return (
    <div className="shell">

      {/* Top bar */}
      <div className="topbar">
        <div className="topbar-dots">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
        <div className="topbar-title">SILVERHAND_CONSTRUCT // SESSION_ACTIVE</div>
        <button className="clear-btn" onClick={() => { setMsgs([]); setError(""); }}>
          CLR
        </button>
      </div>

      {/* Main area */}
      <div className="main">

        {/* Portrait panel */}
        <div className="portrait-panel">
          <div className="portrait-frame">
            {/* 
              Drop a johnny.jpg into your public/ folder.
              It will appear here automatically.
              If no image found, the fallback avatar shows instead.
            */}
            <img
              src="/johnny.jpg"
              alt="Johnny Silverhand"
              className="portrait-img"
              onError={(e) => {
                e.target.style.display = "none";
                document.getElementById("portrait-fallback").style.display = "flex";
              }}
            />
            <div id="portrait-fallback" className="portrait-fallback">
              <div className="portrait-avatar">JS</div>
              <div className="portrait-hint">Add public/johnny.jpg</div>
            </div>
            <div className="scanlines" />
            <div className="portrait-glow" />
          </div>

          {/* Stats */}
          <div className="stats">
            <div className="stat-row">
              <span className="stat-key">NAME</span>
              <span className="stat-val">SILVERHAND</span>
            </div>
            <div className="stat-row">
              <span className="stat-key">STATUS</span>
              <span className="stat-val">ENGRAM</span>
            </div>
            <div className="stat-row">
              <span className="stat-key">MODEL</span>
              <span className="stat-val">LLAMA 3.3</span>
            </div>
            <div className="stat-row">
              <span className="stat-key">CTX</span>
              <span className="stat-val">128K</span>
            </div>
            <div className="connection-status">
              <span className="status-dot" />
              GROQ CONNECTED
            </div>
          </div>
        </div>

        {/* Dialogue panel */}
        <div className="dialogue-panel">
          <div className="dialogue-header">
            <span>DIALOGUE FEED</span>
            <span>{msgs.filter(m => m.role === "assistant").length} RESPONSES</span>
          </div>

          <div className="feed">
            {msgs.length === 0 && (
              <div className="empty">
                <div className="empty-line">// AWAITING INPUT</div>
                <div className="empty-line muted">Jack in, choom.</div>
              </div>
            )}

            {msgs.map((msg, i) => (
              <div key={i} className={`msg ${msg.role}`}>
                <div className="msg-label">
                  {msg.role === "assistant" ? "JOHNNY SILVERHAND" : "YOU"}
                </div>
                <div className={`msg-text ${msg.role}`}>
                  {msg.content || (
                    busy && i === msgs.length - 1 ? (
                      <span className="typing">
                        <span className="tdot" style={{ animationDelay: "0s" }} />
                        <span className="tdot" style={{ animationDelay: "0.18s" }} />
                        <span className="tdot" style={{ animationDelay: "0.36s" }} />
                      </span>
                    ) : null
                  )}
                </div>
              </div>
            ))}

            {error && (
              <div className="error-line">ERR // {error}</div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="input-bar">
            <span className="prompt-sym">▶</span>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={busy}
              placeholder="Say something..."
              rows={1}
              className="input"
            />
            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={!input.trim() || busy}
            >
              {busy ? "..." : "TRANSMIT"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
