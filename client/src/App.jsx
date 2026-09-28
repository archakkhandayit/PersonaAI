import { useState, useRef, useEffect, useLayoutEffect } from "react";
import ReactMarkdown from "react-markdown";
import CodeBlock from "./components/CodeBlock";
import {
  SendIcon,
  StopIcon,
  TrashIcon,
  CopyIcon,
  CheckIcon,
  CodeIcon,
  LayersIcon,
  CompassIcon,
  CoffeeIcon,
} from "./components/Icons";
import "./App.css";

const API_URL = `${import.meta.env.VITE_API_URL}/chat`;

const SUGGESTIONS = [
  {
    icon: CodeIcon,
    category: "Web & JavaScript",
    prompt: "Sir, JavaScript me event loop aur closures real projects me kaise kaam aate hai?",
    tag: "Core JS",
  },
  {
    icon: LayersIcon,
    category: "Full Stack & Architecture",
    prompt: "Docker aur microservices seekhna kab zaroori hota hai ek MERN developer ke liye?",
    tag: "Backend & DevOps",
  },
  {
    icon: CompassIcon,
    category: "Career & Roadmap",
    prompt: "Sir beginner hu, pehle React seekhu ya vanilla JavaScript master karu?",
    tag: "Roadmap",
  },
  {
    icon: CoffeeIcon,
    category: "Chai & Motivation",
    prompt: "Coding me consistency nahi ban pa rahi aur burnout lag raha hai, kya karu?",
    tag: "Mindset",
  },
];

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const abortControllerRef = useRef(null);
  const readerRef = useRef(null);

  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea as content grows
  useLayoutEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleCopyMessage = async (content, idx) => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const stopGeneration = () => {
    // 1. Abort HTTP fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 2. Explicitly cancel stream reader to break reading loop instantly
    if (readerRef.current) {
      try {
        readerRef.current.cancel();
      } catch {
        // ignore
      }
      readerRef.current = null;
    }

    // 3. Immediately reset loading state so typing indicators stop
    setLoading(false);

    // 4. If assistant placeholder has no content yet, remove it so empty typing bubble never lingers
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role === "assistant" && (!last.content || !last.content.trim())) {
        return prev.slice(0, -1);
      }
      return prev;
    });
  };

  const handleSendPrompt = (promptText) => {
    setInput(promptText);
    executeSendMessage(promptText);
  };

  const executeSendMessage = async (rawText) => {
    const trimmed = rawText.trim();
    if (!trimmed || loading) return;

    const userMessage = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];
    if (updatedMessages.length > 10) {
      updatedMessages.shift();
    }

    // Add user message + empty assistant placeholder
    setMessages([...updatedMessages, { role: "assistant", content: "" }]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "⚠️ Error: " + (data.error || "Something went wrong with the server"),
          };
          return updated;
        });
        return;
      }

      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;

            const data = trimmedLine.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (!last || last.role !== "assistant") return prev;
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + parsed.content,
                  };
                  return updated;
                });
              }
              if (parsed.error) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (!last || last.role !== "assistant") return prev;
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: "⚠️ " + parsed.error,
                  };
                  return updated;
                });
              }
            } catch {
              // skip malformed chunk
            }
          }
        }
      } finally {
        readerRef.current = null;
      }
    } catch (err) {
      if (err.name === "AbortError") {
        // Stream aborted by user deliberately - remove empty assistant message if no tokens arrived
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (last.role === "assistant" && (!last.content || !last.content.trim())) {
            return prev.slice(0, -1);
          }
          return prev;
        });
        return;
      }
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "⚠️ Server se connect nahi ho paa raha. Make sure backend is running on port 3001.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      readerRef.current = null;
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role === "assistant" && (!last.content || !last.content.trim())) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      textareaRef.current?.focus();
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    executeSendMessage(input);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      executeSendMessage(input);
    }
  };

  const clearChat = () => {
    if (loading) {
      stopGeneration();
    }
    setMessages([]);
    setInput("");
    textareaRef.current?.focus();
  };

  const markdownComponents = {
    code({ inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");
      if (inline || (!match && !codeString.includes("\n"))) {
        return (
          <code className="inline-code" {...props}>
            {children}
          </code>
        );
      }
      return (
        <CodeBlock
          language={match ? match[1] : ""}
          value={codeString}
        />
      );
    },
    table({ children }) {
      return (
        <div className="table-wrapper">
          <table>{children}</table>
        </div>
      );
    },
    a({ href, children }) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },
  };

  return (
    <div className="app">
      {/* Top Navigation Bar - Full Width Widescreen Header */}
      <header className="navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">
            <div className="brand-avatar-wrap">
              <div className="brand-avatar">HC</div>
              <span className="online-beacon" title="Mentor Online"></span>
            </div>
            <div className="brand-details">
              <h1>Hitesh Sir AI</h1>
              <p className="brand-tagline">Chai aur Code vibes • Real-world mentorship</p>
            </div>
          </div>

          <div className="navbar-actions">
            <div className="status-indicator">
              <span className="status-dot"></span>
              <span className="status-text">Online</span>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                className="clear-btn"
                onClick={clearChat}
                title="Clear conversation"
              >
                <TrashIcon size={15} />
                <span className="clear-text">Clear Chat</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Chat Scroll Area - Expands Comfortably on Widescreen */}
      <main className="chat-viewport">
        <div className="chat-container">
          {messages.length === 0 ? (
            <div className="welcome-hero">
              <div className="hero-avatar">HC</div>
              <h2 className="hero-title">Namaste! Kaise ho sabhi? 🙏</h2>
              <p className="hero-desc">
                Kuch bhi pucho — JavaScript, System Design, MERN Stack, Career roadmap ya coding motivation.
              </p>

              <div className="suggestions-grid">
                {SUGGESTIONS.map((s, idx) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      className="suggestion-card"
                      onClick={() => handleSendPrompt(s.prompt)}
                    >
                      <div className="suggestion-card-header">
                        <span className="card-icon">
                          <Icon size={16} />
                        </span>
                        <span className="card-tag">{s.tag}</span>
                      </div>
                      <span className="card-category">{s.category}</span>
                      <p className="card-prompt">{s.prompt}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="messages-stream">
              {messages.map((msg, idx) => (
                <article
                  key={idx}
                  className={`message-row ${msg.role === "assistant" ? "assistant" : "user"}`}
                >
                  <div className={`msg-content ${msg.role}`}>
                    {msg.role === "assistant" ? (
                      msg.content ? (
                        <>
                          <ReactMarkdown components={markdownComponents}>
                            {msg.content}
                          </ReactMarkdown>
                          {loading && idx === messages.length - 1 && (
                            <span className="streaming-cursor" aria-hidden="true"></span>
                          )}
                          <div className="msg-actions">
                            <button
                              type="button"
                              className={`bubble-action-btn ${copiedIdx === idx ? "copied" : ""}`}
                              onClick={() => handleCopyMessage(msg.content, idx)}
                              title="Copy response"
                            >
                              {copiedIdx === idx ? (
                                <>
                                  <CheckIcon size={12} />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <CopyIcon size={12} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </>
                      ) : loading ? (
                        <div className="typing-indicator" aria-label="Thinking">
                          <span className="dot"></span>
                          <span className="dot"></span>
                          <span className="dot"></span>
                        </div>
                      ) : null
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                </article>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Docked Input Component - Centered with Wide-Screen Ergonomics */}
      <footer className="dock-container">
        <div className="dock-inner">
          <form className="input-form-box" onSubmit={onSubmit}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Apna sawal pucho... (Shift + Enter for new line)"
              disabled={loading}
              className="chat-textarea"
            />

            <div className="input-actions">
              {loading ? (
                <button
                  type="button"
                  className="stop-btn"
                  onClick={stopGeneration}
                  title="Stop generating"
                >
                  <StopIcon size={16} />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="send-btn"
                  title="Send message (Enter)"
                >
                  <SendIcon size={17} />
                  <span className="send-text">Send</span>
                </button>
              )}
            </div>
          </form>

          <div className="dock-disclaimer">
            <span>Hitesh Sir AI persona can make mistakes. Always verify critical code.</span>
            <span className="disclaimer-sep">•</span>
            <span className="chai-tag">Chai aur Code ☕</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
