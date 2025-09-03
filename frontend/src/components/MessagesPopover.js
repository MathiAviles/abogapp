import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useChat } from "./ChatProvider";
import { Chat, Channel, MessageList, MessageInput } from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";
import "./MessagesPopover.css";

const GLOBAL = "__abogapp_stream__";

const TABS = [
  { key: "ALL", label: "TODOS" },
  { key: "UNREAD", label: "NO LEÍDO" },
  { key: "ARCHIVED", label: "ARCHIVADO" },
];

function useOnClickOutside(ref, handler) {
  useEffect(() => {
    function listener(e) {
      if (!ref.current || ref.current.contains(e.target)) return;
      handler(e);
    }
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener, { passive: true });
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

function timeAgo(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString();
}

function waitUntil(checkFn, { timeoutMs = 8000, intervalMs = 100 } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const id = setInterval(() => {
      if (checkFn()) { clearInterval(id); resolve(); }
      else if (Date.now() - start > timeoutMs) { clearInterval(id); reject(new Error("Timeout esperando al cliente de chat")); }
    }, intervalMs);
  });
}

export default function MessagesPopover({ onClose }) {
  const { client, filterChannels, isArchived, unreadCount, toggleArchive } = useChat();
  const [connecting, setConnecting] = useState(true);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState([]);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("ALL");
  const [query, setQuery] = useState("");
  const boxRef = useRef(null);
  const navigate = useNavigate();

  useOnClickOutside(boxRef, onClose);

  // Bloquea el scroll del body mientras el popover está montado (móvil)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const sc = (window[GLOBAL] && window[GLOBAL].client) || client;

  const otherMemberOf = useCallback((ch) => {
    const members = ch?.state?.members || {};
    const ids = Object.keys(members);
    const me = String(sc?.userID || "");
    const otherId = ids.find((id) => id !== me) || ids[0];
    return members[otherId]?.user || {};
  }, [sc]);

  const load = useCallback(async () => {
    const cl = window[GLOBAL]?.client || client;
    if (!cl || !cl.userID) return;
    try {
      setLoading(true);
      setError(null);
      const list = await cl.queryChannels(
        { type: "messaging", members: { $in: [cl.userID] } },
        { last_message_at: -1 },
        { limit: 30, watch: true, state: true }
      );
      setChannels(list);
    } catch (e) {
      console.error("[MessagesPopover] load failed:", e);
      setError("No se pudieron cargar los mensajes.");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setConnecting(true);
        await waitUntil(() => !!(window[GLOBAL]?.client?.userID));
        if (!alive) return;
        setConnecting(false);
        await load();
      } catch (e) {
        if (alive) {
          setConnecting(false);
          setError("No se pudo conectar al chat.");
          setLoading(false);
        }
      }
    })();
    return () => { alive = false; };
  }, [load]);

  useEffect(() => {
    const cl = window[GLOBAL]?.client || client;
    if (!cl) return;
    const handler = () => load();
    const subs = [
      "message.new",
      "notification.message_new",
      "notification.added_to_channel",
      "notification.mark_read",
      "channel.visible",
      "channel.hidden",
      "channel.updated",
      "health.check",
    ].map((t) => cl.on(t, handler));
    return () => subs.forEach((u) => u && u.unsubscribe && u.unsubscribe());
  }, [client, load]);

  const openInline = async (ch) => { try { await ch.watch(); } catch {} setSelected(ch); };
  const expandToFull = () => {
    onClose && onClose();
    if (selected) navigate(`/chat?cid=${encodeURIComponent(selected.cid)}`);
    else navigate(`/chat`);
  };

  // --- Filtro por pestaña + búsqueda ---
  const visible = useMemo(() => {
    const byTab = filterChannels(channels, tab);
    const q = query.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter((ch) => {
      const other = otherMemberOf(ch);
      const name = String(other?.name || "").toLowerCase();
      const email = String(other?.email || "").toLowerCase();
      const last = String(ch.state?.messages?.[ch.state.messages.length - 1]?.text || "").toLowerCase();
      return name.includes(q) || email.includes(q) || last.includes(q) || String(ch.cid).toLowerCase().includes(q);
    });
  }, [channels, tab, query, filterChannels, otherMemberOf]);

  // Contadores por pestaña (no afectados por la búsqueda)
  const counts = useMemo(() => {
    const all = channels.filter((c) => !isArchived(c.cid)).length;
    const unread = channels.filter((c) => !isArchived(c.cid) && unreadCount(c) > 0).length;
    const archived = channels.filter((c) => isArchived(c.cid)).length;
    return { ALL: all, UNREAD: unread, ARCHIVED: archived };
  }, [channels, isArchived, unreadCount]);

  const headerTitle = selected ? (otherMemberOf(selected).name || "Conversación") : "Mensajes";

  return (
    <div className="msgpop-overlay">
      <div
        className="msgpop card"
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label="Mensajes"
      >
        {/* Header */}
        <div className="msgpop-header">
          <div className="msgpop-left">
            {selected ? (
              <button className="btn-ghost sm" aria-label="Atrás" onClick={() => setSelected(null)}>‹</button>
            ) : (
              <span className="msgpop-spacer" />
            )}
          </div>

          <div className="msgpop-title msgpop-title--ellipsis">{headerTitle}</div>

          <div className="msgpop-actions">
            {selected && (
              <button
                className="btn-ghost sm"
                title={isArchived(selected.cid) ? "Desarchivar" : "Archivar"}
                onClick={() => toggleArchive(selected.cid)}
                aria-label="Archivar/Desarchivar"
              >
                {isArchived(selected.cid) ? "Desarchivar" : "Archivar"}
              </button>
            )}
            <button className="btn-ghost sm" aria-label="Agrandar" onClick={expandToFull} title="Abrir en grande">⤢</button>
            <button className="btn-ghost sm" aria-label="Cerrar" onClick={onClose} title="Cerrar">✕</button>
          </div>
        </div>

        {/* 🔎 Buscador (solo en vista de lista) */}
        {!selected && (
          <div className="msgpop-search">
            <svg className="search-ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M15.5 14h-.79l-.28-.27a6 6 0 1 0-.71.71l.27.28v.79l5 5 1.5-1.5-5-5Zm-5.5 0a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"/>
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, email o mensaje…"
              aria-label="Buscar conversaciones"
            />
            {query && (
              <button className="clear-ic" onClick={() => setQuery("")} aria-label="Limpiar búsqueda">✕</button>
            )}
          </div>
        )}

        {/* Tabs (solo en vista de lista) */}
        {!selected && (
          <div className="msgpop-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`pill ${tab === t.key ? "active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                <span className="pill-badge">{counts[t.key] || 0}</span>
              </button>
            ))}
          </div>
        )}

        {/* Estados */}
        {connecting && <div className="msgpop-empty">Conectando al chat…</div>}
        {!connecting && !selected && loading && <div className="msgpop-empty">Cargando…</div>}
        {!connecting && !selected && !loading && error && <div className="msgpop-error">{error}</div>}
        {!connecting && !selected && !loading && !error && visible.length === 0 && (
          <div className="msgpop-empty">No hay conversaciones en esta vista.</div>
        )}

        {/* Lista */}
        {!connecting && !selected && !loading && !error && visible.length > 0 && (
          <ul className="msgpop-list">
            {visible.map((ch) => {
              const other = otherMemberOf(ch);
              const last = ch.state?.messages?.[ch.state.messages.length - 1];
              const unread = unreadCount(ch);
              const archived = isArchived(ch.cid);
              return (
                <li
                  key={ch.cid}
                  className={`msgpop-item ${archived ? "archived" : ""}`}
                  onClick={() => openInline(ch)}
                >
                  <img
                    className="avatar"
                    src={other.image || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"}
                    alt={other.name || "Usuario"}
                  />
                  <div className="content">
                    <div className="row">
                      <span className="name">{other.name || "Usuario"}</span>
                      <span className="time">{last ? timeAgo(last.created_at) : ""}</span>
                    </div>
                    <div className="snippet">{last?.text || "Sin mensajes aún"}</div>
                  </div>

                  <div className="item-actions" onClick={(e) => e.stopPropagation()}>
                    {unread > 0 && !archived && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
                    <button
                      className="btn-ghost sm"
                      title={archived ? "Desarchivar" : "Archivar"}
                      onClick={() => toggleArchive(ch.cid)}
                      aria-label="Archivar/Desarchivar"
                    >
                      {archived ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7H4v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM3 5h18V3H3v2Zm7 7h4v2h-4v-2Z"/></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18v2H3V3Zm2 4h14v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7Zm4 4h6v2H9v-2Z"/></svg>
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Mini-chat embebido */}
        {selected && (
          <div className="msgpop-chat">
            <Chat client={sc}>
              <Channel channel={selected}>
                <div className="str-chat__main-panel msgpop-panel">
                  <MessageList />
                  <MessageInput focus placeholder="Escribe tu mensaje" />
                </div>
              </Channel>
            </Chat>
          </div>
        )}
      </div>
    </div>
  );
}