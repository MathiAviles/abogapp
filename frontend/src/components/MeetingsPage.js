import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChat } from "./ChatProvider";
import "./MeetingsPage.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5001";

// === Utils ===
const DURATION_MIN = 30;

function parseTimeToHM(str) {
  if (!str) return { h: 0, m: 0 };
  const s = String(str).trim().toUpperCase();
  const ampmMatch = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    let m = parseInt(ampmMatch[2] || "0", 10);
    const ampm = ampmMatch[3];
    if (ampm === "AM" && h === 12) h = 0;
    if (ampm === "PM" && h < 12) h += 12;
    return { h, m };
  }
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) return { h: parseInt(m24[1], 10), m: parseInt(m24[2], 10) };
  return { h: 0, m: 0 };
}

function getStartDate(meeting) {
  const [y, mo, d] = (meeting.date || "").split("-").map((n) => parseInt(n, 10));
  const { h, m } = parseTimeToHM(meeting.time);
  return new Date(y, (mo || 1) - 1, d || 1, h, m, 0, 0);
}

function addMinutes(date, min) {
  return new Date(date.getTime() + min * 60 * 1000);
}

function minutesDiff(a, b) {
  return Math.round((a.getTime() - b.getTime()) / 60000);
}

function derivedStatus(meeting, now = new Date()) {
  const start = getStartDate(meeting);
  const end = addMinutes(start, meeting.duration || DURATION_MIN);
  const tenBefore = addMinutes(start, -10);
  if (now >= end) return { code: "finalizada", label: "Reunión Finalizada" };
  if (now >= start) return { code: "iniciada", label: "Reunión Iniciada" };
  if (now >= tenBefore) return { code: "por-comenzar", label: "Por comenzar" };
  return { code: "confirmada", label: "Cita confirmada" };
}

function canJoin(meeting, now = new Date()) {
  const start = getStartDate(meeting);
  const end = addMinutes(start, meeting.duration || DURATION_MIN);
  const tenBefore = addMinutes(start, -10);
  return now >= tenBefore && now < end;
}

function byStartAsc(a, b) {
  return getStartDate(a) - getStartDate(b);
}

// ==== Helpers JWT / API ====
function decodeJwtPayload() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getCurrentUserIdFromJWT() {
  const p = decodeJwtPayload();
  return p?.sub ?? p?.identity ?? p?.user_id ?? p?.id ?? null;
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("proximas");
  const { openDirectMessage } = useChat() || {};
  const navigate = useNavigate();

  // ⏱️ “Reloj” reactivo para actualizar countdowns (cada 30s)
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const now = useMemo(() => new Date(nowMs), [nowMs]);

  useEffect(() => {
    const fetchMeetings = async () => {
      const token = localStorage.getItem("token");
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/meetings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMeetings(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("Error al cargar reuniones:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchMeetings();
  }, []);

  const { proximas, anteriores } = useMemo(() => {
    const upcoming = [];
    const past = [];
    meetings.forEach((mt) => {
      const end = addMinutes(getStartDate(mt), mt.duration || DURATION_MIN);
      if (now < end) upcoming.push(mt);
      else past.push(mt);
    });
    upcoming.sort(byStartAsc);
    past.sort(byStartAsc).reverse();
    return { proximas: upcoming, anteriores: past };
  }, [meetings, now]);

  async function fetchMeetingDetails(meetingId) {
    const token = localStorage.getItem("token");
    const r = await fetch(`${API_BASE}/api/reuniones/${meetingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return r.json();
  }

  // 👉 Abrir DM con el otro participante usando **ID de BD**
  async function handleMessageClick(m) {
    try {
      // 1) Resolver el otro participante
      const other = m?.with_user || {};
      let otherDbId = other?.id;

      // Fallback si el meeting card no lo trae:
      if (!otherDbId) {
        const meId = getCurrentUserIdFromJWT();
        const details = await fetchMeetingDetails(m.id);
        if (!details) {
          navigate("/chat");
          return;
        }
        otherDbId =
          String(meId) === String(details.client_id)
            ? details.lawyer_id
            : details.client_id;
      }

      // 2) Abrir/crear el canal vía ChatProvider
      let cid = null;
      if (typeof openDirectMessage === "function") {
        cid = await openDirectMessage(otherDbId);
      }

      // 3) Navegar al chat
      if (cid) {
        navigate(`/chat?cid=${encodeURIComponent(cid)}`);
      } else {
        sessionStorage.setItem(
          "dm_target",
          JSON.stringify({ userDbId: otherDbId })
        );
        navigate("/chat");
      }
    } catch (err) {
      console.error("Error abriendo DM, redirigiendo a /chat:", err);
      navigate("/chat");
    }
  }

  async function handleJoin(m) {
    if (!canJoin(m, now)) {
      alert("Solo puedes entrar 10 minutos antes del inicio.");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/meetings/${m.id}/can-join`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || data?.allowed !== true) {
        alert("Aún no está habilitado el acceso. Intenta más tarde.");
        return;
      }
    } catch (e) {
      console.error("Error consultando can-join:", e);
      alert("No se pudo verificar el acceso. Intenta nuevamente.");
      return;
    }
    navigate(`/reunion/${m.id}`);
  }

  function MeetingCard({ m }) {
    const st = derivedStatus(m, now);
    const start = getStartDate(m);
    const diffMin = minutesDiff(start, now);
    const joinEnabled = canJoin(m, now);

    return (
      <div className="meeting-card">
        <div className="meeting-details">
          <span className="meeting-date">
            {start.toLocaleDateString("es-ES", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            {" • "}
            {start.toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>

          <p className="meeting-with">
            Cita con {m?.with_user?.role === "abogado" ? "el abogado" : "el cliente"}{" "}
            <strong>{m?.with_user?.name}</strong>
          </p>

          <div className={`meeting-status chip status-${st.code}`}>{st.label}</div>

          {diffMin > 0 && diffMin <= 60 && (
            <div className="meeting-countdown" aria-live="polite">
              Comienza en {diffMin} min
            </div>
          )}
        </div>

        <div className="meeting-actions">
          <button
            type="button"
            className="msg-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleMessageClick(m);
            }}
            title={`Enviar mensaje a ${m?.with_user?.name || "usuario"}`}
          >
            Mensaje
          </button>

          <button
            type="button"
            className={`connect-btn ${joinEnabled ? "" : "disabled"}`}
            onClick={() => handleJoin(m)}
            disabled={!joinEnabled}
            title={
              joinEnabled ? "Entrar a la reunión" : "Disponible 10 min antes del inicio"
            }
          >
            Conectarse
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="loading-container">Cargando reuniones...</div>;

  const dataset = activeTab === "proximas" ? proximas : anteriores;

  return (
    <div className="meetings-page-container">
      <h1>Mis Reuniones</h1>

      <div className="tabs" role="tablist" aria-label="Cambiar listado de reuniones">
        <button
          role="tab"
          aria-selected={activeTab === "proximas"}
          className={`tab ${activeTab === "proximas" ? "active" : ""}`}
          onClick={() => setActiveTab("proximas")}
        >
          Próximas
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "anteriores"}
          className={`tab ${activeTab === "anteriores" ? "active" : ""}`}
          onClick={() => setActiveTab("anteriores")}
        >
          Anteriores
        </button>
      </div>

      {dataset.length > 0 ? (
        <div className="meetings-list">
          {dataset.map((m) => (
            <MeetingCard key={m.id} m={m} />
          ))}
        </div>
      ) : (
        <p className="empty-text">
          {activeTab === "proximas"
            ? "No tienes próximas reuniones."
            : "No hay reuniones anteriores."}
        </p>
      )}
    </div>
  );
}