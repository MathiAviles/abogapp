import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useChat } from "./ChatProvider";
import { Chat, Channel, ChannelHeader, MessageList, MessageInput } from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";
import "./ChatWindow.css";

const GLOBAL = "__abogapp_stream__";
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5001";
const DEFAULT_AVATAR =
  "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

const TABS = [
  { key: "ALL", label: "TODOS" },
  { key: "UNREAD", label: "NO LEÍDO" },
  { key: "ARCHIVED", label: "ARCHIVADO" },
];

function waitUntil(checkFn, { timeoutMs = 8000, intervalMs = 100 } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const id = setInterval(() => {
      if (checkFn()) { clearInterval(id); resolve(); }
      else if (Date.now() - start > timeoutMs) { clearInterval(id); reject(new Error("Timeout esperando al cliente de chat")); }
    }, intervalMs);
  });
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

// Normaliza rutas de imagen (http, /uploads, uploads, filename)
function resolveUserImage(user) {
  const raw = user?.image || user?.avatar || user?.profile_picture_url || "";
  if (!raw) return DEFAULT_AVATAR;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/uploads/")) return `${API_BASE}${raw}`;
  if (raw.startsWith("uploads/")) return `${API_BASE}/${raw}`;
  return `${API_BASE}/uploads/${raw}`;
}

export default function ChatWindow() {
  const { client, isArchived, toggleArchive, filterChannels, unreadCount } = useChat();
  const sc = (window[GLOBAL] && window[GLOBAL].client) || client;

  // 🔎 estado UI
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 800px)").matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 800px)");
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener ? mql.addEventListener("change", handler) : mql.addListener(handler);
    return () => {
      mql.removeEventListener ? mql.removeEventListener("change", handler) : mql.removeListener(handler);
    };
  }, []);

  const [tab, setTab] = useState("ALL");
  const [query, setQuery] = useState("");
  const [connecting, setConnecting] = useState(true);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState([]);
  const [selected, setSelected] = useState(null);
  const [params, setParams] = useSearchParams();

  const currentCidRef = useRef(null);
  const me = useMemo(() => String(sc?.userID || ""), [sc]);

  const otherOf = useCallback((ch) => {
    const members = ch?.state?.members || {};
    const ids = Object.keys(members);
    const otherId = ids.find((id) => id !== me) || ids[0];
    return members[otherId]?.user || {};
  }, [me]);

  // Carga canales. En móvil NO auto-selecciona ninguno si no hay ?cid
  const load = useCallback(async (cidToSelect) => {
    const c = window[GLOBAL]?.client || client;
    if (!c || !c.userID) return;
    try {
      setLoading(true);
      const list = await c.queryChannels(
        { type: "messaging", members: { $in: [c.userID] } },
        { last_message_at: -1 },
        { limit: 50, watch: true, state: true }
      );
      setChannels(list);

      let initial = null;
      if (cidToSelect) {
        initial = list.find((ch) => ch.cid === cidToSelect) || null;
      } else if (!isMobile) {
        // En desktop conservamos el comportamiento anterior: abrir el primero
        initial = list[0] || null;
      }

      if (initial) {
        try { await initial.watch(); } catch {}
        setSelected(initial);
        currentCidRef.current = initial.cid;
      } else {
        setSelected(null);
        currentCidRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  }, [client, isMobile]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setConnecting(true);
        await waitUntil(() => !!(window[GLOBAL]?.client?.userID));
        if (!alive) return;
        setConnecting(false);
        const cidFromUrl = new URLSearchParams(window.location.search).get("cid");
        await load(cidFromUrl || undefined); // en móvil, si no hay cid => lista primero
      } catch {
        setConnecting(false);
      }
    })();
    return () => { alive = false; };
  }, [load]);

  // Refrescos por eventos (incluye user.updated para fotos)
  useEffect(() => {
    const c = window[GLOBAL]?.client || client;
    if (!c) return;

    let pending = false;
    const handler = async () => {
      if (pending) return;
      pending = true;
      setTimeout(async () => {
        try { await load(currentCidRef.current); } finally { pending = false; }
      }, 250);
    };

    const subs = [
      "message.new",
      "notification.message_new",
      "notification.added_to_channel",
      "channel.visible",
      "channel.hidden",
      "channel.updated",
      "user.updated",
    ].map((t) => c.on(t, handler));

    return () => subs.forEach((u) => u?.unsubscribe?.());
  }, [client, load]);

  // Mantener ?cid sincronizado
  useEffect(() => {
    if (!selected) return;
    const cid = selected.cid;
    if (currentCidRef.current !== cid) currentCidRef.current = cid;
    if (params.get("cid") !== cid) {
      const p = new URLSearchParams(params);
      p.set("cid", cid);
      setParams(p, { replace: true });
    }
  }, [selected, params, setParams]);

  // Navegación directa escribiendo ?cid en la URL
  const cidParam = params.get("cid");
  useEffect(() => {
    if (!cidParam || cidParam === currentCidRef.current) return;
    if (!channels.length) return;
    const match = channels.find((ch) => ch.cid === cidParam);
    if (match) {
      (async () => {
        try { await match.watch(); } catch {}
        setSelected(match);
        currentCidRef.current = match.cid;
      })();
    }
  }, [cidParam, channels]);

  const selectChannel = async (ch) => {
    const cid = ch.cid;
    const p = new URLSearchParams(params);
    p.set("cid", cid);
    setParams(p, { replace: true });

    currentCidRef.current = cid;
    setSelected(ch);
    try { await ch.watch(); } catch {}
    try { await ch.markRead(); } catch {}
  };

  // Botón ATRÁS (solo móvil)
  const backToList = () => {
    setSelected(null);
    currentCidRef.current = null;
    const p = new URLSearchParams(params);
    p.delete("cid");
    setParams(p, { replace: true });
  };

  const visibleChannels = useMemo(() => {
    const byTab = filterChannels(channels, tab);
    const q = query.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter((ch) => {
      const other = otherOf(ch);
      const name = String(other?.name || "").toLowerCase();
      const email = String(other?.email || "").toLowerCase();
      const last = String(ch.state?.messages?.[ch.state.messages.length - 1]?.text || "").toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        last.includes(q) ||
        String(ch.cid).toLowerCase().includes(q)
      );
    });
  }, [channels, tab, query, filterChannels, otherOf]);

  const other = selected ? otherOf(selected) : null;
  const lawyerId = selected ? String(other?.id || other?.user_id || "") : "";

  // Clases para CSS móvil: lista o chat
  const layoutClass =
    `chatpage-layout card ${isMobile ? 'is-mobile' : ''} ` +
    (isMobile ? (selected ? 'has-channel' : 'no-channel') : '');

  return (
    <div className="chatpage font-sans">
      <div className={layoutClass}>
        {/* Lista izquierda */}
        <aside className="chatlist">
          <div className="chatlist-header">
            <span className="title">Mensajes</span>
          </div>

          <div className="chatlist-search">
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

          <div className="chatlist-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`chatlist-tab ${tab === t.key ? "active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {connecting && <div className="chatlist-empty">Conectando…</div>}
          {!connecting && loading && <div className="chatlist-empty">Cargando…</div>}
          {!connecting && !loading && visibleChannels.length === 0 && (
            <div className="chatlist-empty">No hay conversaciones en esta vista.</div>
          )}

          {!connecting && !loading && visibleChannels.length > 0 && (
            <ul className="chatlist-ul">
              {visibleChannels.map((ch) => {
                const o = otherOf(ch);
                const last = ch.state?.messages?.[ch.state.messages.length - 1];
                const unread = unreadCount(ch);
                const active = selected?.cid === ch.cid;
                const archived = isArchived(ch.cid);
                const imgSrc = resolveUserImage(o);
                return (
                  <li
                    key={ch.cid}
                    className={`chatlist-item ${active ? "active" : ""} ${archived ? "archived" : ""}`}
                    onClick={() => selectChannel(ch)}
                  >
                    <img
                      className="chatlist-avatar"
                      src={imgSrc}
                      alt={o.name || "Usuario"}
                      onError={(e) => { if (e.currentTarget.src !== DEFAULT_AVATAR) e.currentTarget.src = DEFAULT_AVATAR; }}
                    />
                    <div className="chatlist-main">
                      <div className="chatlist-row">
                        <span className="chatlist-name">{o.name || "Usuario"}</span>
                        {last && <span className="chatlist-time">{timeAgo(last.created_at)}</span>}
                      </div>
                      <div className="chatlist-snippet">{last?.text || "Sin mensajes aún"}</div>
                    </div>
                    <div className="chatlist-actions" onClick={(e) => e.stopPropagation()}>
                      {unread > 0 && !archived && (
                        <span className="chatlist-badge">{unread > 9 ? "9+" : unread}</span>
                      )}
                      <button
                        className="chatlist-arch-btn"
                        title={archived ? "Desarchivar" : "Archivar"}
                        onClick={() => toggleArchive(ch.cid)}
                      >
                        {archived ? "Desarchivar" : "Archivar"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Panel de conversación */}
        <main className="chatmain">
          {/* Barra superior solo móvil con botón ATRÁS */}
          {isMobile && selected && (
            <div className="chatmobile-topbar">
              <button className="chatmobile-back" onClick={backToList} aria-label="Volver">‹</button>
              <div className="chatmobile-title">{(other?.name || "Conversación")}</div>
            </div>
          )}

          {selected ? (
            <Chat client={sc}>
              <Channel channel={selected}>
                <div className="str-chat__main-panel chatmain-panel">
                  <ChannelHeader live={false} />
                  <MessageList />
                  <MessageInput focus placeholder="Escribe tu mensaje" />
                </div>
              </Channel>
            </Chat>
          ) : (
            <div className="chatmain-empty">Selecciona una conversación para empezar</div>
          )}
        </main>

        {/* Panel derecho (oculto en móvil) */}
        <RightDetailsPanel
          key={lawyerId}
          lawyerId={lawyerId}
          fallbackName={other?.name}
          fallbackImage={resolveUserImage(other)}
        />
      </div>
    </div>
  );
}

function RightDetailsPanel({ lawyerId, fallbackName, fallbackImage }) {
  const [lawyer, setLawyer] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!lawyerId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/abogado/perfil/${lawyerId}`);
        if (!res.ok) throw new Error("perfil no disponible");
        const data = await res.json();
        if (alive) setLawyer(data);
      } catch {
        if (alive) setLawyer(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [lawyerId]);

  const name = lawyer?.nombres
    ? `${lawyer.nombres} ${lawyer.apellidos || ""}`.trim()
    : (fallbackName || "Profesional");
  const imageUrl = lawyer?.profile_picture_url
    ? `${API_BASE}/uploads/${lawyer.profile_picture_url}`
    : (fallbackImage || DEFAULT_AVATAR);
  const priceText = (() => {
    const p = lawyer?.consultation_price;
    return typeof p === "number" ? `${p.toFixed(2)}$ / consulta` : "Precio a convenir";
  })();
  const ratingText = lawyer?.rating ? `${lawyer.rating.toFixed(1)} ★` : "4.8 ★";
  const specialtyText = lawyer?.especialidad ? `Especialista en ${lawyer.especialidad}` : "";

  return (
    <aside className="chatdetails">
      <div className="chatdetails-header">Detalles</div>

      {!lawyerId && <div className="chatdetails-empty">Selecciona un chat.</div>}
      {lawyerId && loading && <div className="chatdetails-empty">Cargando…</div>}

      {lawyerId && !loading && (
        <div className="chatdetails-card">
          <img
            className="chatdetails-avatar"
            src={imageUrl}
            alt={name}
            onError={(e) => { if (e.currentTarget.src !== DEFAULT_AVATAR) e.currentTarget.src = DEFAULT_AVATAR; }}
          />
          <div className="chatdetails-name">{name}</div>

          {specialtyText && <div className="chatdetails-specialty">{specialtyText}</div>}

          <div className="chatdetails-meta">
            <span className="chatdetails-rating">{ratingText}</span>
            <span className="chatdetails-dot">•</span>
            <span className="chatdetails-price">{priceText}</span>
          </div>

          <Link to={`/abogado/perfil/${lawyerId}`} className="chatdetails-btn chatdetails-btn--secondary">
            Ver perfil del abogado
          </Link>

          <Link to={`/reservar-cita/${lawyerId}`} className="chatdetails-btn">
            Reservar Cita
          </Link>
        </div>
      )}
    </aside>
  );
}