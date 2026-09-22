import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";

const API_URL = "http://localhost:3001/chat";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "⚠️ Error: " + (data.error || "Something went wrong") },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Server se connect nahi ho paa raha. Make sure backend is running." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const clearChat = () => {
    setMessages([]);
    inputRef.current?.focus();
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="avatar">HC</div>
          <div>
            <h1>Hitesh Sir AI</h1>
            <p className="subtitle">Coding mentor • Hinglish vibes • AI Persona</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button className="clear-btn" onClick={clearChat}>
            Clear Chat
          </button>
        )}
      </header>

      <main className="chat-area">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-avatar">HC</div>
            <h2>Namaste! 🙏</h2>
            <p>Kuch bhi pucho — coding, career, life advice, ya phir bas chill chat.</p>
            <div className="suggestions">
              {[
                "Sir beginner hu, kya karu?",
                "Docker kya hai?",
                "MERN stack seekhu ya nahi?",
                "Motivation nahi aa raha",
              ].map((s) => (
                <button
                  key={s}
                  className="suggestion-chip"
                  onClick={() => {
                    setInput(s);
                    inputRef.current?.focus();
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.role === "assistant" && <div className="msg-avatar">HC</div>}
            <div className="msg-bubble">
              {msg.role === "assistant" ? (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="message assistant">
            <div className="msg-avatar">HC</div>
            <div className="msg-bubble typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <form className="input-area" onSubmit={sendMessage}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Apna sawal pucho..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default App;
