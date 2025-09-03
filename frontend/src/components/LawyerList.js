import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useChat } from "./ChatProvider";
import HeartButton from "./HeartButton";
import "./LawyerList.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5001";
const DEFAULT_AVATAR =
  "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

/* -------- Hook: media query (para evitar duplicados de bio) -------- */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);
  return matches;
}

/* ------------------- Estrellas (para desktop) ------------------- */
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

/* ------------------- Helpers/const ------------------- */
const getPrice = (a) => Number(a?.consultation_price ?? 0);
const getRating = (a) => Number(a?.rating_last5_avg ?? 0);
const getReviews = (a) => Number(a?.rating_last5_count ?? 0);
const getAvailabilitySlots = (a) =>
  a?.availability ?? a?.disponibilidad ?? a?.available_slots ?? a?.slots ?? [];

const DAYS = [
  { id: 0, label: "Dom", short: "D" },
  { id: 1, label: "Lun", short: "L" },
  { id: 2, label: "Mar", short: "M" },
  { id: 3, label: "Mié", short: "X" },
  { id: 4, label: "Jue", short: "J" },
  { id: 5, label: "Vie", short: "V" },
  { id: 6, label: "Sáb", short: "S" },
];

const HOUR_BLOCKS = [
  { id: "9-12", label: "9-12", start: 9, end: 12 },
  { id: "12-15", label: "12-15", start: 12, end: 15 },
  { id: "15-18", label: "15-18", start: 15, end: 18 },
  { id: "18-21", label: "18-21", start: 18, end: 21 },
  { id: "21-24", label: "21-24", start: 21, end: 24 },
  { id: "0-3", label: "0-3", start: 0, end: 3 },
  { id: "3-6", label: "3-6", start: 3, end: 6 },
  { id: "6-9", label: "6-9", start: 6, end: 9 },
];

const parseTimeToHour = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(":").map(Number);
  return h + (m || 0) / 60;
};
const normalizeDay = (d) => {
  if (typeof d === "number") return d;
  const s = String(d).toLowerCase().slice(0, 3);
  const dayMap = { dom: 0, lun: 1, mar: 2, mié: 3, jue: 4, vie: 5, sáb: 6 };
  return dayMap[s] ?? null;
};
const slotMatchesBlock = (slot, daySet, blockSet) => {
  if (daySet.size === 0 && blockSet.size === 0) return true;
  const day = normalizeDay(slot?.day);
  const start = parseTimeToHour(slot?.start);
  const end = parseTimeToHour(slot?.end);
  if (day == null || start == null || end == null) return false;
  if (daySet.size > 0 && !daySet.has(day)) return false;
  if (blockSet.size > 0) {
    for (const bId of blockSet) {
      const b = HOUR_BLOCKS.find((x) => x.id === bId);
      if (b && Math.max(start, b.start) < Math.min(end, b.end)) return true;
    }
    return false;
  }
  return true;
};

/* ======================= Componente ======================= */
function LawyerList() {
  const { especialidad } = useParams();
  const [abogados, setAbogados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);
  const [favIds, setFavIds] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set()); // “Leer más” por tarjeta (móvil)
  const navigate = useNavigate();
  const { openDirectMessage } = useChat() || {};
  const token = localStorage.getItem("token");

  // ¿estamos en móvil?
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Fetch autenticado (redirecciona en 401)
  const authFetch = async (url, options = {}) => {
    const headers = {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem("token");
      alert("Tu sesión ha expirado. Inicia sesión nuevamente.");
      navigate("/login");
      throw new Error("Unauthorized");
    }
    return res;
  };

  // Filtros
  const [openDropdown, setOpenDropdown] = useState(null); // 'price' | 'availability' | 'sort' | null
  const [sortKey, setSortKey] = useState("relevance");
  const [priceRange, setPriceRange] = useState([0, 100]);
  const [selectedBlocks, setSelectedBlocks] = useState(new Set());
  const [selectedDays, setSelectedDays] = useState(new Set());
  const [query, setQuery] = useState(""); // 🔎 buscador por nombre
  const filtersRef = useRef(null);

  // min/max de precios reales
  const [minPrice, maxPrice] = useMemo(() => {
    if (!abogados.length) return [0, 100];
    const prices = abogados.map(getPrice).filter((p) => p > 0);
    return prices.length
      ? [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))]
      : [0, 100];
  }, [abogados]);

  /* ------------ Fetch ------------ */
  useEffect(() => {
    const fetchAbogados = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/abogados/${especialidad}`);
        const list = response.ok ? await response.json() : [];
        const enriched = await Promise.all(
          (list || []).map(async (a) => {
            try {
              const r = await fetch(`${API_BASE}/api/lawyers/${a.id}/reviews/summary`);
              if (r.ok) {
                const s = await r.json();
                return {
                  ...a,
                  rating_last5_avg: s?.last5?.avg,
                  rating_last5_count: s?.last5?.count,
                };
              }
            } catch {}
            return a;
          })
        );
        setAbogados(enriched);
      } catch {
        setAbogados([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAbogados();
  }, [especialidad]);

  useEffect(() => {
    setPriceRange([minPrice, maxPrice]);
  }, [minPrice, maxPrice]);

  useEffect(() => {
    const loadFavs = async () => {
      if (!token) return;
      try {
        const r = await authFetch(`${API_BASE}/api/favorites/ids`);
        if (r.ok) setFavIds(new Set((await r.json()).ids || []));
      } catch {}
    };
    loadFavs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // cerrar dropdowns al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ------------ Filtrado/orden ------------ */
  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();

    let arr = abogados.filter((a) => {
      if (q) {
        const full = `${a?.nombres ?? ""} ${a?.apellidos ?? ""}`.toLowerCase().trim();
        const other = (a?.full_name ?? a?.nombre ?? "").toLowerCase().trim();
        if (!full.includes(q) && !other.includes(q)) return false;
      }
      const priceOk = getPrice(a) >= priceRange[0] && getPrice(a) <= priceRange[1];
      const availabilityOk =
        selectedDays.size > 0 || selectedBlocks.size > 0
          ? getAvailabilitySlots(a).some((s) =>
              slotMatchesBlock(s, selectedDays, selectedBlocks)
            )
          : true;

      return priceOk && availabilityOk;
    });

    const sortFn =
      {
        priceAsc: (a, b) => getPrice(a) - getPrice(b),
        priceDesc: (a, b) => getPrice(b) - getPrice(a),
        reviews: (a, b) => getReviews(b) - getReviews(a),
        rating: (a, b) => getRating(b) - getRating(a),
      }[sortKey] || null;

    if (sortFn) arr.sort(sortFn);
    return arr;
  }, [abogados, priceRange, selectedBlocks, selectedDays, sortKey, query]);

  /* ------------ Handlers ------------ */
  const handleToggleDropdown = (name) =>
    setOpenDropdown((prev) => (prev === name ? null : name));

  const handleClearFilters = () => {
    setPriceRange([minPrice, maxPrice]);
    setSelectedBlocks(new Set());
    setSelectedDays(new Set());
    setSortKey("relevance");
    setQuery("");
    setOpenDropdown(null);
  };

  const toggleBlock = (id) =>
    setSelectedBlocks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleDay = (id) =>
    setSelectedDays((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleExpand = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleMandarMensaje = async (abogado) => {
    if (!openDirectMessage) return;
    try {
      setSendingId(abogado.id);
      const cid = await openDirectMessage(abogado.id);
      navigate(`/chat?cid=${encodeURIComponent(cid)}`);
    } catch (e) {
      if (e?.message?.toLowerCase().includes("no autenticado")) {
        navigate("/login");
      } else {
        alert("No pudimos abrir el chat. Inténtalo nuevamente.");
      }
    } finally {
      setSendingId(null);
    }
  };

  const toggleFavorite = async (lawyerId) => {
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      const method = favIds.has(lawyerId) ? "DELETE" : "POST";
      await authFetch(`${API_BASE}/api/favorites/${lawyerId}`, { method });
      const next = new Set(favIds);
      favIds.has(lawyerId) ? next.delete(lawyerId) : next.add(lawyerId);
      setFavIds(next);
    } catch {}
  };

  const isPriceFiltered = useMemo(
    () => priceRange[0] > minPrice || priceRange[1] < maxPrice,
    [priceRange, minPrice, maxPrice]
  );
  const isAvailabilityFiltered = useMemo(
    () => selectedDays.size > 0 || selectedBlocks.size > 0,
    [selectedDays, selectedBlocks]
  );
  const isSortActive = useMemo(() => sortKey !== "relevance", [sortKey]);

  const pricePreview = useMemo(() => {
    if (!isPriceFiltered) return "Cualquier precio";
    return `$${priceRange[0]} - $${priceRange[1]}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPriceFiltered, priceRange[0], priceRange[1]]);

  const availabilityPreview = useMemo(() => {
    if (!isAvailabilityFiltered) return "Cualquier hora";
    const dayText = selectedDays.size > 0 ? `${selectedDays.size} día(s)` : "";
    const blockText = selectedBlocks.size > 0 ? `${selectedBlocks.size} hora(s)` : "";
    return [dayText, blockText].filter(Boolean).join(", ");
  }, [isAvailabilityFiltered, selectedDays, selectedBlocks]);

  const sortPreview = useMemo(() => {
    const options = {
      relevance: "Relevancia",
      priceAsc: "Precio: más bajo",
      priceDesc: "Precio: más alto",
      rating: "Mejor calificación",
      reviews: "Más reseñas",
    };
    return options[sortKey] || "Relevancia";
  }, [sortKey]);

  if (loading) return <div className="loading-container" role="status">Buscando abogados...</div>;

  return (
    <div className="lawyer-list-container">
      <h1 className="list-title">
        Abogados de {especialidad.charAt(0).toUpperCase() + especialidad.slice(1)}
      </h1>

      {/* ===== Barra de filtros ===== */}
      <div className="ll-filters-bar" ref={filtersRef}>
        {/* Precio */}
        <div className="ll-filter-container">
          <button
            className={`ll-filter-button ${openDropdown === "price" ? "active" : ""}`}
            onClick={() => handleToggleDropdown("price")}
          >
            <div className="ll-button-content">
              <span className="ll-button-label">Precio</span>
              <span className="ll-button-value">{pricePreview}</span>
            </div>
            <span className="ll-dropdown-arrow">▼</span>
          </button>
          {openDropdown === "price" && (
            <div className="ll-dropdown ll-dropdown--price">
              <span className="ll-dropdown-title">Precio de la consulta</span>
              <div className="ll-range-labels">
                <span>${priceRange[0].toFixed(0)}</span>
                <span>${priceRange[1].toFixed(0)}</span>
              </div>
              <div className="ll-range-inputs">
                <input
                  type="range"
                  min={minPrice}
                  max={maxPrice}
                  value={priceRange[0]}
                  onChange={(e) =>
                    setPriceRange(([_, hi]) => [Math.min(Number(e.target.value), hi), hi])
                  }
                />
                <input
                  type="range"
                  min={minPrice}
                  max={maxPrice}
                  value={priceRange[1]}
                  onChange={(e) =>
                    setPriceRange(([lo, _]) => [lo, Math.max(Number(e.target.value), lo)])
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Disponibilidad */}
        <div className="ll-filter-container">
          <button
            className={`ll-filter-button ${openDropdown === "availability" ? "active" : ""}`}
            onClick={() => handleToggleDropdown("availability")}
          >
            <div className="ll-button-content">
              <span className="ll-button-label">Disponibilidad</span>
              <span className="ll-button-value">{availabilityPreview}</span>
            </div>
            <span className="ll-dropdown-arrow">▼</span>
          </button>
          {openDropdown === "availability" && (
            <div className="ll-dropdown ll-dropdown--availability">
              <div className="ll-dropdown-section">
                <span className="ll-dropdown-title">Día</span>
                <div className="ll-days-grid">
                  {DAYS.map((d) => (
                    <button
                      key={d.id}
                      className={`ll-chip ${selectedDays.has(d.id) ? "active" : ""}`}
                      onClick={() => toggleDay(d.id)}
                    >
                      {d.short}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ll-dropdown-section">
                <span className="ll-dropdown-title">Hora</span>
                <div className="ll-hours-grid">
                  {HOUR_BLOCKS.map((b) => (
                    <button
                      key={b.id}
                      className={`ll-chip ${selectedBlocks.has(b.id) ? "active" : ""}`}
                      onClick={() => toggleBlock(b.id)}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ordenar por */}
        <div className="ll-filter-container">
          <button
            className={`ll-filter-button ${openDropdown === "sort" ? "active" : ""}`}
            onClick={() => handleToggleDropdown("sort")}
          >
            <div className="ll-button-content">
              <span className="ll-button-label">Ordenar por</span>
              <span className="ll-button-value">{sortPreview}</span>
            </div>
            <span className="ll-dropdown-arrow">▼</span>
          </button>
          {openDropdown === "sort" && (
            <div className="ll-dropdown ll-dropdown--sort">
              <button
                className={`ll-sort-option ${sortKey === "relevance" ? "active" : ""}`}
                onClick={() => {
                  setSortKey("relevance");
                  setOpenDropdown(null);
                }}
              >
                Relevancia
              </button>
              <button
                className={`ll-sort-option ${sortKey === "priceAsc" ? "active" : ""}`}
                onClick={() => {
                  setSortKey("priceAsc");
                  setOpenDropdown(null);
                }}
              >
                Precio: más bajo primero
              </button>
              <button
                className={`ll-sort-option ${sortKey === "priceDesc" ? "active" : ""}`}
                onClick={() => {
                  setSortKey("priceDesc");
                  setOpenDropdown(null);
                }}
              >
                Precio: más alto primero
              </button>
              <button
                className={`ll-sort-option ${sortKey === "rating" ? "active" : ""}`}
                onClick={() => {
                  setSortKey("rating");
                  setOpenDropdown(null);
                }}
              >
                Mejor calificación
              </button>
              <button
                className={`ll-sort-option ${sortKey === "reviews" ? "active" : ""}`}
                onClick={() => {
                  setSortKey("reviews");
                  setOpenDropdown(null);
                }}
              >
                Más reseñas
              </button>
            </div>
          )}
        </div>

        {/* 🔎 Buscador por nombre */}
        <div className="ll-search">
          <span className="ll-search-icon" aria-hidden>🔍</span>
          <input
            className="ll-search-input"
            type="text"
            placeholder="Buscar por nombre…"
            aria-label="Buscar por nombre de abogado"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }}
          />
          {query && (
            <button className="ll-search-clear" type="button" title="Limpiar búsqueda" onClick={() => setQuery("")}>
              ×
            </button>
          )}
        </div>

        {(isPriceFiltered || isAvailabilityFiltered || isSortActive || query) && (
          <button className="ll-clear-button" onClick={handleClearFilters}>Limpiar</button>
        )}
      </div>

      {/* ===== Resultados ===== */}
      {abogados.length > 0 ? (
        filteredAndSorted.length > 0 ? (
          <div className="lawyer-results">
            {filteredAndSorted.map((abogado) => {
              const imageUrl = abogado.profile_picture_url
                ? `${API_BASE}/uploads/${abogado.profile_picture_url}`
                : DEFAULT_AVATAR;
              const isFav = favIds.has(abogado.id);
              const avg = getRating(abogado) || 0;
              const cnt = getReviews(abogado) || 0;
              const price = getPrice(abogado);
              const isExpanded = expanded.has(abogado.id);

              return (
                <div key={abogado.id} className="lawyer-card-detailed">
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
                      onError={(e) => {
                        if (e.currentTarget.src !== DEFAULT_AVATAR) e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />
                  </div>

                  <div className="lawyer-card-main">
                    <Link to={`/abogado/perfil/${abogado.id}`} className="lawyer-name-link">
                      <h3 className="lawyer-name">
                        {abogado.nombres} {abogado.apellidos} <span className="verified-check">✔</span>
                      </h3>
                    </Link>

                    {isMobile ? (
                      <>
                        {/* Píldoras y fila compacta (solo móvil) */}
                        <div className="ll-pills">
                          <span className="ll-pill">Profesional</span>
                          <span className="ll-pill ll-pill-ghost">Recomendado</span>
                        </div>

                        <div className="ll-row-compact">
                          <div className="ll-compact-rating" title="Promedio últimas reseñas">
                            <span className="star">★</span>
                            <strong>{avg.toFixed(1)}</strong>
                            <span className="muted">{cnt} reseña{cnt === 1 ? "" : "s"}</span>
                          </div>
                          <div className="ll-compact-price">
                            <strong>{price ? `${price.toFixed(0)} $` : "A convenir"}</strong>
                            {price ? <span className="muted">/ consulta</span> : null}
                          </div>
                        </div>

                        <ul className="ll-info-list">
                          <li>
                            <span className="ic">⚖️</span>
                            <span><strong>{abogado.especialidad}</strong></span>
                          </li>
                          {cnt > 0 && (
                            <li>
                              <span className="ic">⭐</span>
                              <span>{cnt} reseña{cnt === 1 ? "" : "s"} · {avg.toFixed(1)} promedio</span>
                            </li>
                          )}
                          <li>
                            <span className="ic">⏱️</span>
                            <span>Consulta online</span>
                          </li>
                        </ul>

                        <div className="ll-bio-wrap">
                          <p className={`lawyer-bio ${isExpanded ? "expanded" : ""}`}>
                            {abogado.about_me || "Este profesional aún no ha añadido una descripción detallada."}
                          </p>
                          {abogado.about_me && abogado.about_me.trim().length > 120 && (
                            <button
                              type="button"
                              className="ll-readmore"
                              onClick={() => toggleExpand(abogado.id)}
                            >
                              {isExpanded ? "Mostrar menos" : "Leer más"}
                            </button>
                          )}
                        </div>

                        <div className="ll-actions">
                          <button
                            className="ll-icon-btn"
                            onClick={() => handleMandarMensaje(abogado)}
                            disabled={sendingId === abogado.id}
                            title="Enviar mensaje"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M4 4h16v10H7l-3 3V4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <Link to={`/reservar-cita/${abogado.id}`} className="ll-primary-btn-link">
                            <button className="ll-primary-btn">Reservar una cita</button>
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Meta + bio solo en desktop */}
                        <div className="lawyer-meta">
                          <span>Especialista en <strong>{abogado.especialidad}</strong></span>
                        </div>
                        <p className="lawyer-bio">
                          {abogado.about_me || "Este profesional aún no ha añadido una descripción detallada."}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Columna derecha — desktop intacto */}
                  <div className="lawyer-card-right">
                    <div className="lawyer-right-top">
                      <div className="rating-compact" title="Promedio de las últimas 5 reseñas">
                        <StarBar value={avg} size={18} />
                        <span className="rating-value">{avg.toFixed(2)}</span>
                      </div>
                      <div className="rating-caption">Basado en las últimas 5 reseñas</div>
                    </div>

                    <span className="lawyer-price">
                      {price ? `${price.toFixed(2)}$ / consulta` : "Precio a convenir"}
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
        ) : (
          <p className="no-results">No hay abogados que coincidan con los filtros seleccionados.</p>
        )
      ) : (
        <p className="no-results">No se encontraron abogados para esta especialidad.</p>
      )}
    </div>
  );
}

export default LawyerList;