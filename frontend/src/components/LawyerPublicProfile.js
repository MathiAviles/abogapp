import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { useChat } from "./ChatProvider";
import HeartButton from "./HeartButton";
import "./LawyerPublicProfile.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5001";
const DEFAULT_AVATAR =
  "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

/** Convierte URLs relativas del backend a absolutas con API_BASE. */
const toAbsolute = (maybeUrl, filename) => {
  if (maybeUrl) {
    if (/^https?:\/\//i.test(maybeUrl)) return maybeUrl;
    const needsSlash = maybeUrl.startsWith("/") ? "" : "/";
    return `${API_BASE}${needsSlash}${maybeUrl}`;
  }
  if (filename) return `${API_BASE}/uploads/${filename}`;
  return null;
};

/** Widget de estrellas (0..5 con decimales) */
function StarBar({ value = 0, size = 18, showValue = false }) {
  const safe = Math.max(0, Math.min(5, Number(value) || 0));
  const pct = (safe / 5) * 100;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, lineHeight: 1 }}>
      <div
        style={{
          position: "relative",
          display: "inline-block",
          fontSize: size,
          lineHeight: 1,
          width: "5em",
          height: "1.2em",
          verticalAlign: "middle",
        }}
        aria-hidden
      >
        <div style={{ color: "#ddd", position: "absolute", inset: 0, whiteSpace: "nowrap", overflow: "hidden" }}>
          ★★★★★
        </div>
        <div
          style={{
            color: "#FFC107",
            position: "absolute",
            inset: 0,
            whiteSpace: "nowrap",
            width: `${pct}%`,
            overflow: "hidden",
          }}
        >
          ★★★★★
        </div>
      </div>
      {showValue && <span style={{ fontSize: 12, color: "#666" }}>{safe.toFixed(2)}</span>}
    </div>
  );
}

function LawyerPublicProfile() {
  const { abogadoId } = useParams();
  const navigate = useNavigate();
  const { openDirectMessage } = useChat() || {};

  const [abogado, setAbogado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availabilities, setAvailabilities] = useState({});
  const [availableSlots, setAvailableSlots] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);

  // favoritos
  const [isFav, setIsFav] = useState(false);
  const token = localStorage.getItem("token");

  // intro video
  const [introVideoUrl, setIntroVideoUrl] = useState(null);
  const [videoLoading, setVideoLoading] = useState(true);

  // álbum público
  const [gallery, setGallery] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(true);

  // Lightbox público
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);

  // Pestañas + tracking de sección activa (para resaltar en mobile)
  const TABS = [
    { id: "sobre-mi", label: "SOBRE MI" },
    { id: "album", label: "ALBUM DE FOTOS" },
    { id: "disponibilidad", label: "DISPONIBILIDAD" },
    { id: "valoraciones", label: "VALORACIONES" },
  ];
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const sectionRefs = useRef({});

  useEffect(() => {
    if (!lbOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setLbOpen(false);
      if (e.key === "ArrowRight") setLbIndex((i) => (i + 1) % Math.max(gallery.length, 1));
      if (e.key === "ArrowLeft")
        setLbIndex((i) => (i - 1 + Math.max(gallery.length, 1)) % Math.max(gallery.length, 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lbOpen, gallery.length]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Perfil
        const profileRes = await fetch(`${API_BASE}/api/abogado/perfil/${abogadoId}`);
        let prof = null;
        if (profileRes.ok) {
          prof = await profileRes.json();
          setAbogado(prof);
        }

        // Video intro
        try {
          if (prof && prof.intro_video_url) {
            setIntroVideoUrl(toAbsolute(`/uploads/${prof.intro_video_url}`));
          } else {
            const v = await fetch(`${API_BASE}/api/abogado/video/${abogadoId}`);
            if (v.ok) {
              const j = await v.json();
              setIntroVideoUrl(toAbsolute(j?.url, j?.filename));
            } else {
              setIntroVideoUrl(null);
            }
          }
        } catch {
          setIntroVideoUrl(null);
        } finally {
          setVideoLoading(false);
        }

        // Disponibilidad
        const availabilityRes = await fetch(`${API_BASE}/api/abogado/availability/${abogadoId}`);
        if (availabilityRes.ok) setAvailabilities(await availabilityRes.json());

        // Reviews
        const sum = await fetch(`${API_BASE}/api/lawyers/${abogadoId}/reviews/summary`);
        if (sum.ok) {
          setReviewSummary(await sum.json());
        } else {
          setReviewSummary({ lifetime: { avg: 0, count: 0 }, last5: { avg: 0, count: 0, items: [] } });
        }

        // Álbum
        setGalleryLoading(true);
        try {
          const gal = await fetch(`${API_BASE}/api/abogado/galeria/${abogadoId}`);
          if (gal.ok) {
            const items = await gal.json();
            const norm = (items || []).map((it) => ({
              id: it.id ?? it.image_id ?? it.filename ?? it.url,
              url: toAbsolute(it.url, it.filename || it.path || it.file),
            }));
            setGallery(norm);
          } else {
            setGallery([]);
          }
        } catch {
          setGallery([]);
        } finally {
          setGalleryLoading(false);
        }
      } catch (error) {
        console.error("Error al cargar los datos del abogado:", error);
        setReviewSummary({ lifetime: { avg: 0, count: 0 }, last5: { avg: 0, count: 0, items: [] } });
        setGallery([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [abogadoId]);

  useEffect(() => {
    const dateKey = selectedDate.toISOString().split("T")[0];
    setAvailableSlots(availabilities[dateKey] || []);
  }, [selectedDate, availabilities]);

  // favoritos
  useEffect(() => {
    const checkFav = async () => {
      if (!token) return;
      try {
        const r = await fetch(`${API_BASE}/api/favorites/ids`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const j = await r.json();
          setIsFav((j.ids || []).includes(Number(abogadoId)));
        }
      } catch {}
    };
    checkFav();
  }, [token, abogadoId]);

  // Destacar quicktab activa según scroll (en móvil también)
  useEffect(() => {
    const ids = TABS.map((t) => t.id);
    const observer = new IntersectionObserver(
      (entries) => {
        // Elegimos la sección más cercana al top visible
        let candidate = activeTab;
        let minTop = Number.POSITIVE_INFINITY;
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const rectTop = Math.abs(entry.target.getBoundingClientRect().top);
          if (rectTop < minTop) {
            minTop = rectTop;
            candidate = entry.target.dataset.sectionId;
          }
        });
        if (candidate && candidate !== activeTab) setActiveTab(candidate);
      },
      {
        root: null,
        // Compensa la barra sticky y el header del sitio en mobile
        rootMargin: "-140px 0px -60% 0px",
        threshold: [0, 0.25, 0.5, 1],
      }
    );
    ids.forEach((id) => {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [TABS.map((t) => t.id).join(",")]);

  const onClickTab = (id) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveTab(id);
  };

  const toggleFavorite = async () => {
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      if (isFav) {
        await fetch(`${API_BASE}/api/favorites/${abogadoId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsFav(false);
      } else {
        await fetch(`${API_BASE}/api/favorites/${abogadoId}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsFav(true);
      }
    } catch {}
  };

  const handleMandarMensaje = async () => {
    if (!abogado) return;
    if (!openDirectMessage) {
      console.warn("ChatProvider no disponible. ¿Está montado en el árbol?");
      return;
    }
    try {
      setSending(true);
      const cid = await openDirectMessage(abogado.id);
      navigate(`/chat?cid=${encodeURIComponent(cid)}`);
    } catch (e) {
      console.error("[UI] openDirectMessage falló (PublicProfile):", e);
      const msg = (e && (e.message || e.toString())) || "";
      if (msg.toLowerCase().includes("no autenticado")) navigate("/login");
      else alert("No pudimos abrir el chat. Inténtalo nuevamente.");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="loading-container">Cargando perfil...</div>;
  if (!abogado) return <div className="loading-container">No se pudo encontrar el perfil del abogado.</div>;

  const imageUrl = abogado.profile_picture_url
    ? toAbsolute(`/uploads/${abogado.profile_picture_url}`)
    : DEFAULT_AVATAR;

  return (
    <div className="profile-container">
      <div className="profile-card">
        {/* ---- Intro Video (si existe) ---- */}
        {!!introVideoUrl && !videoLoading && (
          <div className="public-intro-video">
            <video
              key={introVideoUrl}
              src={introVideoUrl}
              controls
              playsInline
              preload="metadata"
              poster={imageUrl}
            />
          </div>
        )}

        <div className="profile-header">
          <img src={imageUrl} alt={`Perfil de ${abogado.nombres}`} className="profile-image-large" />
          <div className="profile-header-info">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ margin: 0 }}>
                {abogado.nombres} {abogado.apellidos}
              </h1>
              <HeartButton
                active={isFav}
                onClick={toggleFavorite}
                size={24}
                title={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
              />
            </div>

            <h2>Especialista en {abogado.especialidad}</h2>

            {reviewSummary && (
              <div className="profile-rating-row">
                <StarBar value={reviewSummary.lifetime?.avg || 0} />
                <span>
                  {(reviewSummary.lifetime?.avg || 0).toFixed(2)} • {reviewSummary.lifetime?.count || 0} reseñas
                </span>
              </div>
            )}

            {/* Acciones desktop (igual que antes) */}
            <div className="profile-actions profile-actions-desktop" style={{ marginTop: 8 }}>
              <Link to={`/reservar-cita/${abogado.id}`}>
                <button className="btn-primary-action">Reservar Cita</button>
              </Link>
              <button
                className="btn-secondary-action"
                onClick={handleMandarMensaje}
                disabled={sending}
                title="Enviar mensaje directo"
              >
                {sending ? "Abriendo…" : "Mandar Mensaje"}
              </button>
            </div>

            {/* Acciones mobile (CTA grande + icono chat) */}
            <div className="profile-actions-mobile">
              <button
                className="icon-btn"
                onClick={handleMandarMensaje}
                disabled={sending}
                title="Enviar mensaje"
                aria-label="Enviar mensaje"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 4h16v10H7l-3 3V4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <Link to={`/reservar-cita/${abogado.id}`} className="primary-cta-link">
                <button className="primary-cta">Reservar Cita</button>
              </Link>
            </div>
          </div>
        </div>

        {/* ==== Pestañitas (atajos) con activo ==== */}
        <nav className="profile-quicknav" aria-label="Secciones del perfil">
          <div className="quicknav-scroll">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                className={`quicktab ${activeTab === id ? "active" : ""}`}
                onClick={() => onClickTab(id)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        <div className="profile-body">
          {/* SOBRE MI */}
          <section
            id="sobre-mi"
            data-section-id="sobre-mi"
            ref={(el) => (sectionRefs.current["sobre-mi"] = el)}
            className="profile-section"
          >
            <h3>Sobre Mí</h3>
            <p>{abogado.about_me || "Información no disponible."}</p>
          </section>

          {/* TÍTULOS */}
          <section className="profile-section">
            <h3>Títulos y Estudios</h3>
            <p>{abogado.titles || "Información no disponible."}</p>
          </section>

          {/* ÁLBUM */}
          <section
            id="album"
            data-section-id="album"
            ref={(el) => (sectionRefs.current["album"] = el)}
            className="profile-section"
          >
            <h3>Álbum de fotos</h3>
            {galleryLoading ? (
              <p>Cargando álbum…</p>
            ) : gallery.length === 0 ? (
              <p>Este abogado aún no tiene fotos en su álbum.</p>
            ) : (
              <>
                <div className="public-album-grid">
                  {gallery.map((img, idx) => (
                    <figure
                      key={img.id}
                      className="public-album-item"
                      onClick={() => {
                        setLbIndex(idx);
                        setLbOpen(true);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (setLbIndex(idx), setLbOpen(true))}
                    >
                      <img src={img.url} alt="Foto del abogado" loading="lazy" />
                    </figure>
                  ))}
                </div>

                {/* Lightbox público */}
                {lbOpen && gallery.length > 0 && (
                  <div className="lb-overlay" onClick={() => setLbOpen(false)} role="dialog" aria-modal="true">
                    <button
                      className="lb-close"
                      aria-label="Cerrar"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLbOpen(false);
                      }}
                    >
                      ×
                    </button>
                    <button
                      className="lb-prev"
                      aria-label="Anterior"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLbIndex((lbIndex - 1 + gallery.length) % gallery.length);
                      }}
                    >
                      ‹
                    </button>
                    <img src={gallery[lbIndex].url} alt="" />
                    <button
                      className="lb-next"
                      aria-label="Siguiente"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLbIndex((lbIndex + 1) % gallery.length);
                      }}
                    >
                      ›
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* DISPONIBILIDAD */}
          <section
            id="disponibilidad"
            data-section-id="disponibilidad"
            ref={(el) => (sectionRefs.current["disponibilidad"] = el)}
            className="profile-section"
          >
            <h3>Disponibilidad</h3>
            <div className="public-availability-wrapper">
              <div className="public-calendar-view">
                <Calendar onChange={setSelectedDate} value={selectedDate} minDate={new Date()} />
              </div>
              <div className="public-slots-view">
                <h4>Horas disponibles para {selectedDate.toLocaleDateString()}</h4>
                {availableSlots.length > 0 ? (
                  <div className="public-slots-grid">
                    {availableSlots.map((slot) => (
                      <div key={slot} className="slot-tag">
                        {slot}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No hay horas disponibles para este día. Por favor, selecciona otra fecha.</p>
                )}
              </div>
            </div>
          </section>

          {/* VALORACIONES */}
          <section
            id="valoraciones"
            data-section-id="valoraciones"
            ref={(el) => (sectionRefs.current["valoraciones"] = el)}
            className="profile-section"
          >
            <h3>Valoración histórica</h3>
            {reviewSummary ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, lineHeight: 1 }}>
                <StarBar value={reviewSummary.lifetime?.avg || 0} showValue />
                <span style={{ color: "#666" }}>({reviewSummary.lifetime?.count || 0} reseñas en total)</span>
              </div>
            ) : (
              <p>Cargando resumen…</p>
            )}
          </section>

          <section className="profile-section">
            <h3>Últimas 5 reseñas</h3>
            {reviewSummary ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, lineHeight: 1 }}>
                  <StarBar value={reviewSummary.last5?.avg || 0} showValue />
                  <span style={{ color: "#666" }}>({reviewSummary.last5?.count || 0})</span>
                </div>
                {(reviewSummary.last5?.items || []).length === 0 && <p>No hay reseñas recientes.</p>}
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                  {(reviewSummary.last5?.items || []).map((it, idx) => (
                    <li key={idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, lineHeight: 1 }}>
                        <StarBar value={it.rating || 0} />
                        <small style={{ color: "#888" }}>
                          {it.created_at ? new Date(it.created_at).toLocaleDateString() : ""}
                        </small>
                        <small style={{ color: "#888", marginLeft: "auto" }}>{it.client || "Cliente"}</small>
                      </div>
                      {it.comment ? <p style={{ margin: 0 }}>{it.comment}</p> : <p style={{ margin: 0, color: "#999" }}><em>Sin comentario</em></p>}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Cargando reseñas…</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default LawyerPublicProfile;