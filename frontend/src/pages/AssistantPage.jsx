import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

export default function AssistantPage({ token, initialQuestion }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (initialQuestion) setDraft(initialQuestion); }, [initialQuestion]);

  async function sendMessage(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    setDraft("");
    setError("");
    setSending(true);
    const nextMessages = [...messages, { role: "user", content: message }];
    setMessages(nextMessages);
    try {
      const response = await apiFetch("/assistant/chat", {
        method: "POST",
        token,
        body: { message, history: messages.slice(-12) },
      });
      setMessages([...nextMessages, { role: "assistant", content: response.reply }]);
    } catch (requestError) {
      setError(requestError.message || "The assistant could not reply.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="feature-page">
      <header className="feature-heading"><p className="dashboard-overline">Ahar assistant</p><h1>Nutrition, made clearer</h1><p>Ask for practical food ideas tailored to your profile and goal.</p></header>
      <div className="assistant-panel" aria-live="polite">
        {messages.length === 0 ? <p className="assistant-empty">Try asking “What can I eat for a higher-protein lunch?”</p> : messages.map((item, index) => <article className={`assistant-message assistant-message-${item.role}`} key={`${item.role}-${index}`}><strong>{item.role === "assistant" ? "Ahar" : "You"}</strong><p>{item.content}</p></article>)}
        {sending && <p className="assistant-loading">Thinking…</p>}
      </div>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      <form className="assistant-compose" onSubmit={sendMessage}><label className="sr-only" htmlFor="assistant-message">Your question</label><textarea id="assistant-message" rows="2" maxLength="4000" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about meals, nutrition, or your goal…" /><button className="dashboard-primary-button" disabled={!draft.trim() || sending}>Send</button></form>
      <p className="feature-footnote">Guidance is informational and isn’t a medical diagnosis.</p>
    </section>
  );
}
