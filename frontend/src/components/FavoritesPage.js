import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useChat } from "./ChatProvider";
import HeartButton from "./HeartButton";
import "./LawyerList.css"; // reutilizamos el mismo CSS para tarjetas

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5001";
const DEFAULT_AVATAR =
  "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

/** Mismo widget de estrellas que en LawyerList.js */
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
        <div
          style={{
            color: "#ddd",
            position: "absolute",
            inset: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
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
      {showValue && (
        <span style={{ fontSize: 12, color: "#666" }}>{safe.toFixed(2)}</span>
      )}
    </div>
  );
}

export default function FavoritesPage() {
  const [items, setItems] = useState([]);           // lista de abogados favoritos enriquecidos
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);
  const [favIds, setFavIds] = useState(new Set());  // para togglear corazón

  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const { openDirectMessage } = useChat() || {};

  // Carga lista de favoritos y enriquece con summary de reseñas
  useEffect(() => {
    const load = async () => {
      if (!token) { navigate("/login"); return; }
      setLoading(true);
      try {
        // 1) IDs (para estado del corazón)
        const rIds = await fetch(`${API_BASE}/api/favorites/ids`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (rIds.ok) {
          const j = await rIds.json();
          setFavIds(new Set(j.ids || []));
        }

        // 2) Lista de abogados favoritos
        const r = await fetch(`${API_BASE}/api/favorites`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const raw = await r.json();

          // 3) Enriquecer con promedio y conteo de últimas 5 reseñas
          const enriched = await Promise.all(
            (raw || []).map(async (a) => {
              try {
                const s = await fetch(`${API_BASE}/api/lawyers/${a.id}/reviews/summary`);
                if (s.ok) {
                  const sum = await s.json();
                  return {
                    ...a,
                    rating_last5_avg: sum?.last5?.avg ?? 0,
                    rating_last5_count: sum?.last5?.count ?? 0,
                  };
                }
              } catch {}
              return { ...a, rating_last5_avg: 0, rating_last5_count: 0 };
            })
          );

          setItems(enriched);
        } else {
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, navigate]);

  const toggleFavorite = async (lawyerId) => {
    if (!token) { navigate("/login"); return; }
    try {
      if (favIds.has(lawyerId)) {
        await fetch(`${API_BASE}/api/favorites/${lawyerId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const nextIds = new Set(favIds);
        nextIds.delete(lawyerId);
        setFavIds(nextIds);
        // quitar inmediatamente de la lista
        setItems((prev) => prev.filter((x) => x.id !== lawyerId));
      } else {
        await fetch(`${API_BASE}/api/favorites/${lawyerId}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const nextIds = new Set(favIds);
        nextIds.add(lawyerId);
        setFavIds(nextIds);
        // opcional: podríamos refetch para agregarlo; aquí no hace falta porque esta vista lista los ya favoritos
      }
    } catch {}
  };

  const handleMandarMensaje = async (abogado) => {
    if (!openDirectMessage) return;
    try {
      setSendingId(abogado.id);
      const cid = await openDirectMessage(abogado.id);
      navigate(`/chat?cid=${encodeURIComponent(cid)}`);
    } catch (e) {
      const msg = (e && (e.message || e.toString())) || "";
      if (msg.toLowerCase().includes("no autenticado")) navigate("/login");
      else alert("No pudimos abrir el chat. Inténtalo nuevamente.");
    } finally {
      setSendingId(null);
    }
  };

  if (loading) return <div className="loading-container">Cargando favoritos…</div>;

  return (
    <div className="lawyer-list-container">
      <h1 className="list-title">Favoritos</h1>

      <div className="lawyer-results">
        {items.length === 0 && (
          <p className="no-results">Aún no tienes abogados en favoritos.</p>
        )}

        {items.map((abogado) => {
          const imageUrl = abogado.profile_picture_url
            ? `${API_BASE}/uploads/${abogado.profile_picture_url}`
            : DEFAULT_AVATAR;

          const isFav = favIds.has(abogado.id);

          return (
            <div key={abogado.id} className="lawyer-card-detailed">
              {/* ♥ corazoncito en la misma posición */}
              <div className="card-heart">
                <HeartButton
                  active={isFav}
                  onClick={() => toggleFavorite(abogado.id)}
                  size={16}
                  title={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
                />
              </div>

              <div className="lawyer-card-left">
                <img
                  src={imageUrl}
                  alt={`Perfil de ${abogado.nombres}`}
                  className="lawyer-card-image"
                />
              </div>

              <div className="lawyer-card-main">
                <Link
                  to={`/abogado/perfil/${abogado.id}`}
                  className="lawyer-name-link"
                >
                  <h3 className="lawyer-name">
                    {abogado.nombres} {abogado.apellidos}{" "}
                    <span className="verified-check">✔</span>
                  </h3>
                </Link>
                <div className="lawyer-meta">
                  <span>
                    Especialista en <strong>{abogado.especialidad}</strong>
                  </span>
                </div>
                <p className="lawyer-bio">
                  {abogado.about_me ||
                    "Este profesional aún no ha añadido una descripción detallada."}
                </p>
              </div>

              <div className="lawyer-card-right">
                <div className="lawyer-right-top">
                  <div
                    className="rating-compact"
                    title="Promedio de las últimas 5 reseñas"
                  >
                    <StarBar value={abogado.rating_last5_avg || 0} size={18} />
                    <span className="rating-value">
                      {(abogado.rating_last5_avg || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="rating-caption">
                    Basado en las últimas 5 reseñas
                  </div>
                </div>

                <span className="lawyer-price">
                  {abogado.consultation_price
                    ? `${abogado.consultation_price.toFixed(2)}$ / consulta`
                    : "Precio a convenir"}
                </span>

                <Link to={`/reservar-cita/${abogado.id}`}>
                  <button className="btn-primary-action">Reservar Cita</button>
                </Link>

                <button
                  className="btn-secondary-action"
                  onClick={() => handleMandarMensaje(abogado)}
                  disabled={sendingId === abogado.id}
                  title="Enviar mensaje directo"
                >
                  {sendingId === abogado.id ? "Abriendo…" : "Mandar Mensaje"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}