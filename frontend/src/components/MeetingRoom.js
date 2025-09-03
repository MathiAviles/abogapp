import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  StreamVideo,
  StreamCall,
  StreamVideoClient,
  StreamTheme,
  SpeakerLayout,
  CallControls,
} from "@stream-io/video-react-sdk";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import "./MeetingRoom.fix.css";

/* --- Fix ResizeObserver "undelivered notifications" (Chrome/Safari quirk) --- */
if (typeof window !== "undefined" && "ResizeObserver" in window) {
  const NativeRO = window.ResizeObserver;
  window.ResizeObserver = class PatchedResizeObserver extends NativeRO {
    constructor(callback) {
      super((entries, observer) => {
        requestAnimationFrame(() => callback(entries, observer));
      });
    }
  };
}

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5001";
const FALLBACK_NAV = "/reuniones";  // a dónde va el CLIENTE tras calificar
const HOMEPAGE_NAV = "/";           // a dónde va el ABOGADO al colgar

/* Helpers JWT */
function decodeJwtPayload(jwt) {
  try {
    return JSON.parse(atob(jwt.split(".")[1] || ""));
  } catch {
    return {};
  }
}
function decodeJwtSub(jwt) {
  const p = decodeJwtPayload(jwt);
  try {
    return String(p.sub || p.identity || "user");
  } catch {
    return "user";
  }
}
const sanitizeId = (raw) =>
  String(raw || "user").toLowerCase().replace(/[^a-z0-9_@-]/g, "_");

const authHeaders = (jwt) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${jwt || ""}`,
});

async function apiPost(jwt, path, body, extra = {}) {
  try {
    await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: authHeaders(jwt),
      body: body ? JSON.stringify(body) : null,
      ...extra,
    });
  } catch (e) {
    console.error("API POST error", path, e);
  }
}
async function apiPostKeepalive(jwt, path, body) {
  return apiPost(jwt, path, body, { keepalive: true });
}

/* ---------------- Intentos suaves de orientación ---------------- */
async function tryLockOrientation(type = "portrait") {
  try {
    const o = window?.screen?.orientation;
    if (o?.lock) {
      await o.lock(type);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/* ---------------- Modal de reseña ---------------- */
function RatingModal({ open, onClose, meetingId, lawyerId, token, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setRating(5);
      setHover(0);
      setComment("");
      setSending(false);
    }
  }, [open]);

  if (!open) return null;

  const send = async () => {
    if (!meetingId || !lawyerId) {
      onSubmitted?.();
      return;
    }
    setSending(true);
    try {
      await fetch(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          meeting_id: Number(meetingId),
          lawyer_id: Number(lawyerId),
          rating: Number(rating),
          comment: (comment || "").trim(),
        }),
      });
    } catch (e) {
      console.error("No se pudo enviar la reseña:", e);
    } finally {
      setSending(false);
      onSubmitted?.();
    }
  };

  return (
    <div className="abog-rate-backdrop" onClick={onClose}>
      <div className="abog-rate-card" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>¿Cómo estuvo tu asesoría?</h3>
        <p style={{ marginTop: 0, color: "#bbb" }}>
          Califica al abogado y deja un comentario
        </p>

        <div className="abog-stars">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(i)}
              aria-label={`Estrella ${i}`}
              className="abog-star-btn"
            >
              <span style={{ color: (hover || rating) >= i ? "#FFC107" : "#444" }}>★</span>
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="Escribe algo sobre la atención (opcional)"
          className="abog-rate-textarea"
        />

        <div className="abog-rate-actions">
          <button onClick={onClose} className="btn-secondary">Ahora no</button>
          <button
            onClick={send}
            className="btn-primary"
            disabled={sending}
            style={{ background: "#E85D99" }}
          >
            {sending ? "Enviando…" : "Enviar reseña"}
          </button>
        </div>
      </div>
    </div>
  );
}
/* ------------------------------------------------ */

export default function MeetingRoom() {
  // Soporta rutas con :id o :meetingId
  const { id, meetingId: meetingIdAlt, meeting, roomId } = useParams();
  const meetingIdParam = id ?? meetingIdAlt ?? meeting ?? roomId ?? null;

  const navigate = useNavigate();

  const [status, setStatus] = useState("idle"); // idle | loading | joined | error | leaving
  const [error, setError] = useState("");
  const [showRating, setShowRating] = useState(false);
  const [lawyerId, setLawyerId] = useState(null);

  // === Mobile helpers: auto-hide chrome, orientación (solo overlay) ===
  const [showChrome, setShowChrome] = useState(true);
  const chromeTimerRef = useRef(null);

  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const mqMobile = window.matchMedia("(max-width: 768px)");
    const mqPortrait = window.matchMedia("(orientation: portrait)");
    const updMobile = () => setIsMobile(mqMobile.matches);
    const updPortrait = () => setIsPortrait(mqPortrait.matches);
    updMobile();
    updPortrait();
    mqMobile.addEventListener("change", updMobile);
    mqPortrait.addEventListener("change", updPortrait);
    return () => {
      mqMobile.removeEventListener("change", updMobile);
      mqPortrait.removeEventListener("change", updPortrait);
    };
  }, []);

  const kickChrome = () => {
    setShowChrome(true);
    if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
    chromeTimerRef.current = setTimeout(() => setShowChrome(false), 4000);
  };
  useEffect(() => {
    if (!isMobile) return;
    const onInteract = () => kickChrome();
    document.addEventListener("pointermove", onInteract);
    document.addEventListener("touchstart", onInteract, { passive: true });
    document.addEventListener("keydown", onInteract);
    kickChrome();
    return () => {
      document.removeEventListener("pointermove", onInteract);
      document.removeEventListener("touchstart", onInteract);
      document.removeEventListener("keydown", onInteract);
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
    };
  }, [isMobile]);

  const jwt = localStorage.getItem("token") || "";
  const email = localStorage.getItem("email") || "";
  const jwtPayload = useMemo(() => decodeJwtPayload(jwt), [jwt]);
  const userId = useMemo(() => decodeJwtSub(jwt), [jwt]);

  const meetingId = useMemo(
    () => sanitizeId(meetingIdParam || localStorage.getItem("meetingId") || "sala"),
    [meetingIdParam]
  );
  const meetingIdNum = useMemo(() => {
    const n = Number(meetingIdParam);
    return Number.isFinite(n) ? n : null;
  }, [meetingIdParam]);

  // === ¿Es abogado? ===
  const isLawyerFromToken =
    ["role", "user_type", "type"].some((k) => {
      const v = String(jwtPayload?.[k] ?? "").toLowerCase();
      return v === "lawyer" || v === "abogado";
    }) ||
    jwtPayload?.is_lawyer === true ||
    jwtPayload?.isLawyer === true ||
    jwtPayload?.lawyer === true;

  const isLawyerFromStorage =
    ["role", "user_role"].some((k) => {
      const v = String(localStorage.getItem(k) || "").toLowerCase();
      return v === "lawyer" || v === "abogado";
    }) ||
    localStorage.getItem("isLawyer") === "true";

  const idCandidates = [jwtPayload?.id, jwtPayload?.user_id, jwtPayload?.uid, jwtPayload?.sub];
  const matchesLawyerId =
    lawyerId != null &&
    idCandidates.some((v) => v != null && String(v) === String(lawyerId));

  const isLawyerForThisMeeting = isLawyerFromToken || isLawyerFromStorage || matchesLawyerId;

  const clientRef = useRef(null);
  const callRef = useRef(null);
  const initializedRef = useRef(false);

  // Fondo + no scroll solo aquí
  useEffect(() => {
    document.body.classList.add("abog-no-scroll", "abog-video-dark");
    document.querySelector(".App")?.classList.add("abog-video-dark");
    window.scrollTo(0, 0);
    return () => {
      document.body.classList.remove("abog-no-scroll", "abog-video-dark");
      document.querySelector(".App")?.classList.remove("abog-video-dark");
    };
  }, []);

  // Meta reunión
  useEffect(() => {
    const loadMeetingMeta = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/reuniones/${meetingIdParam}`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (resp.ok) {
          const j = await resp.json();
          setLawyerId(j?.lawyer_id ?? null);
        }
      } catch (e) {
        console.warn("No se pudo obtener meta de la reunión:", e);
      }
    };
    if (meetingIdParam) loadMeetingMeta();
  }, [meetingIdParam, jwt]);

  // Inicializar Stream + JOIN
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        if (clientRef.current && callRef.current) {
          setStatus("joined");
          return;
        }
        setStatus("loading");

        const resp = await fetch(`${API_BASE}/api/stream-token`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (!resp.ok) throw new Error("No se pudo obtener el token de video");
        const data = await resp.json().catch(() => ({}));
        const initialToken = data?.token || "";

        const apiKey = process.env.REACT_APP_STREAM_API_KEY || "";
        if (!apiKey) throw new Error("Falta REACT_APP_STREAM_API_KEY en el frontend");

        const ctor = StreamVideoClient.getOrCreateInstance
          ? StreamVideoClient.getOrCreateInstance
          : (cfg) => new StreamVideoClient(cfg);

        const client = ctor({
          apiKey,
          user: { id: String(userId), name: email || String(userId) },
          tokenProvider: async () => {
            if (initialToken) return initialToken;
            const r = await fetch(`${API_BASE}/api/stream-token`, {
              headers: { Authorization: `Bearer ${jwt}` },
            });
            if (!r.ok) throw new Error("No se pudo refrescar token");
            const j = await r.json().catch(() => ({}));
            return j?.token || "";
          },
        });

        if (!mounted) return;
        clientRef.current = client;

        const call = client.call("default", meetingId);
        await call.join({ create: true });

        if (!mounted) return;
        callRef.current = call;
        initializedRef.current = true;

        if (meetingIdNum != null) {
          apiPost(jwt, `/api/meetings/${meetingIdNum}/presence/join`);
        }

        setStatus("joined");
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        setError(e?.message || "Ocurrió un error al inicializar la videollamada. Intenta nuevamente.");
        setStatus("error");
      }
    }

    init();

    // Cleanup real solo si inicializamos
    return () => {
      mounted = false;
      (async () => {
        if (!initializedRef.current) return;
        try { await callRef.current?.leave(); } catch {}
        try { await clientRef.current?.disconnectUser?.(); } catch {}
        if (meetingIdNum != null) {
          await apiPostKeepalive(jwt, `/api/meetings/${meetingIdNum}/presence/leave`);
          await apiPostKeepalive(jwt, `/api/meetings/${meetingIdNum}/finish`);
        }
        callRef.current = null;
        clientRef.current = null;
        initializedRef.current = false;
      })();
    };
  }, [jwt, email, meetingId, meetingIdNum, userId]);

  // Cierre/reload de pestaña
  useEffect(() => {
    if (meetingIdNum == null) return;
    const handler = () => {
      if (!initializedRef.current) return;
      apiPostKeepalive(jwt, `/api/meetings/${meetingIdNum}/presence/leave`);
      apiPostKeepalive(jwt, `/api/meetings/${meetingIdNum}/finish`);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [jwt, meetingIdNum]);

  // Colgar manualmente
  const handleLeave = async () => {
    setStatus("leaving");
    try { await callRef.current?.leave(); } catch {}
    finally {
      if (meetingIdNum != null) {
        await apiPost(jwt, `/api/meetings/${meetingIdNum}/presence/leave`);
        await apiPost(jwt, `/api/meetings/${meetingIdNum}/finish`);
      }

      // Limpieza rápida antes de salir
      try { await clientRef.current?.disconnectUser?.(); } catch {}
      callRef.current = null;
      clientRef.current = null;
      initializedRef.current = false;

      // 👉 Al colgar, intentamos fijar orientación vertical (best-effort)
      tryLockOrientation("portrait");

      if (isLawyerForThisMeeting) {
        // Si es ABOGADO -> directo al HOME, sin modal
        navigate(HOMEPAGE_NAV, { replace: true });
        return;
      }

      // Cliente: mostrar modal de reseña
      setStatus("joined");
      setShowRating(true);
    }
  };

  const closeAndGo = () => {
    setShowRating(false);
    // Por si el usuario cerró el modal sin haber rotado aún
    tryLockOrientation("portrait");
    navigate(FALLBACK_NAV, { replace: true });
  };

  // Tap en el stage: toggle rápido del chrome (solo mobile)
  const handleStagePointerDown = () => {
    if (!isMobile) return;
    setShowChrome((v) => {
      const next = !v;
      if (next) kickChrome();
      else if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
      return next;
    });
  };

  return (
    <>
      <div className={`abog-video-page ${showChrome ? "" : "abog-chrome-hidden"}`}>
        {/* Topbar móvil (desktop: oculto por CSS) */}
        <div className="abog-mobile-topbar" role="toolbar" aria-label="Controles rápidos">
          <button
            className="abog-topbar-leave"
            onClick={handleLeave}
            title="Colgar"
            aria-label="Colgar y salir"
          >
            {/* icono teléfono colgar */}
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 15.46l-5.27-.61a1 1 0 0 0-.9.29l-2.38 2.38a16 16 0 0 1-7.07-7.07l2.38-2.38a1 1 0 0 0 .29-.9L7.54 3H3a1 1 0 0 0-1 1 19 19 0 0 0 18 18 1 1 0 0 0 1-1v-4.54z" fill="currentColor"/>
            </svg>
          </button>
          <span className="abog-topbar-title">En reunión</span>
          <span className="abog-topbar-spacer" />
        </div>

        {status !== "joined" && (
          <div className="abog-connecting">
            <div className="abog-connecting-spinner" />
            <p>Conectando a la sala…</p>
            {error ? <small style={{ color: "#ffb3c9" }}>{error}</small> : null}
          </div>
        )}

        {clientRef.current && callRef.current && (
          <StreamVideo client={clientRef.current}>
            <StreamCall call={callRef.current}>
              <StreamTheme className="abog-theme">
                <div className="abog-stage" onPointerDown={handleStagePointerDown}>
                  <SpeakerLayout />
                </div>

                <div className="abog-controls-dock">
                  <CallControls onLeave={handleLeave} />
                </div>
              </StreamTheme>
            </StreamCall>
          </StreamVideo>
        )}

        {/* Overlay: el usuario debe rotar manualmente a horizontal */}
        {isMobile && isPortrait && (
          <div className="abog-orientation-overlay" role="dialog" aria-modal="true">
            <div className="abog-orientation-card">
              <div className="abog-orientation-icon" aria-hidden>
                <svg width="46" height="46" viewBox="0 0 24 24">
                  <path d="M2 7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7zm14.5-1H21a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-4.5" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <h4>Gira tu teléfono</h4>
              <p>Para continuar con la reunión, usa la pantalla en horizontal.</p>
            </div>
          </div>
        )}
      </div>

      <RatingModal
        open={showRating}
        onClose={closeAndGo}
        onSubmitted={closeAndGo}
        meetingId={meetingIdParam ? Number(meetingIdParam) : null}
        lawyerId={lawyerId}
        token={jwt}
      />
    </>
  );
}