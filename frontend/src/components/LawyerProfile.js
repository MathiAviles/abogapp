import React, { useState, useEffect, useMemo } from 'react';
import '../Form.css';
import './LawyerProfile.css';
import LawyerAvailability from './LawyerAvailability'; // ¡No tocar su diseño!

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5001";

/** Normaliza URLs del backend (relativas → absolutas con API_BASE). */
const toAbsolute = (maybeUrl, filename) => {
  if (maybeUrl) {
    if (/^https?:\/\//i.test(maybeUrl)) return maybeUrl;
    const needsSlash = maybeUrl.startsWith('/') ? '' : '/';
    return `${API_BASE}${needsSlash}${maybeUrl}`;
  }
  if (filename) return `${API_BASE}/uploads/${filename}`;
  return null;
};

function LawyerProfile() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'availability' | 'edit' | 'media'
  const [profile, setProfile] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [meetings, setMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);

  // ---- Media (fotos + video) ----
  const [gallery, setGallery] = useState([]);        // [{id, url, filename}]
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoUploading, setVideoUploading] = useState(false);

  // ---- Lightbox (álbum) ----
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);
  useEffect(() => {
    if (!lbOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setLbOpen(false);
      if (e.key === 'ArrowRight') setLbIndex((i) => (i + 1) % Math.max(gallery.length, 1));
      if (e.key === 'ArrowLeft') setLbIndex((i) => (i - 1 + Math.max(gallery.length, 1)) % Math.max(gallery.length, 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lbOpen, gallery.length]);

  const token = useMemo(() => localStorage.getItem('token'), []);

  // -------- Fetch Perfil --------
  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/lawyer/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        setProfile(await response.json());
      }
    } catch (error) {
      console.error("Error al cargar el perfil:", error);
    } finally {
      setLoadingProfile(false);
    }
  };

  // -------- Fetch Meetings (Dashboard) --------
  const fetchMeetings = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/meetings`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMeetings(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error al obtener reuniones:", error);
    } finally {
      setLoadingMeetings(false);
    }
  };

  // -------- Fetch Gallery --------
  const fetchGallery = async () => {
    setGalleryLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/lawyer/gallery`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (r.ok) {
        const items = await r.json();
        const norm = (items || []).map(it => ({
          id: it.id ?? it.image_id ?? it.filename ?? it.url,
          url: toAbsolute(it.url, it.filename || it.path || it.file),
          filename: it.filename || it.path || it.file || null,
        }));
        setGallery(norm);
      } else {
        setGallery([]);
      }
    } catch (e) {
      console.warn("No se pudo cargar el álbum:", e);
      setGallery([]);
    } finally {
      setGalleryLoading(false);
    }
  };

  // -------- Fetch Video --------
  const fetchVideo = async () => {
    setVideoLoading(true);
    try {
      // 1) si viene dentro del perfil
      if (profile && profile.intro_video_url) {
        setVideoUrl(toAbsolute(`/uploads/${profile.intro_video_url}`));
        setVideoLoading(false);
        return;
      }
      // 2) endpoint dedicado
      const r = await fetch(`${API_BASE}/api/lawyer/video`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (r.ok) {
        const j = await r.json();
        setVideoUrl(toAbsolute(j?.url, j?.filename));
      } else {
        setVideoUrl(null);
      }
    } catch (e) {
    } finally {
      setVideoLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchMeetings();
    fetchGallery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchVideo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.intro_video_url]);

  // liberar URL de preview si existe
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  // -------- Editar Perfil: handlers --------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prevProfile => ({ ...prevProfile, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handlePictureUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Por favor, selecciona un archivo primero.");
      return;
    }
    const formData = new FormData();
    formData.append('profile_picture', selectedFile);

    try {
      const response = await fetch(`${API_BASE}/api/lawyer/profile/upload-picture`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (response.ok) {
        alert('Foto de perfil actualizada.');
        fetchProfile();
        setSelectedFile(null);
        setPreviewUrl(null);
      } else {
        alert('Error al subir la foto.');
      }
    } catch (error) {
      console.error("Error al subir la foto:", error);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/api/lawyer/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          about_me: profile.about_me,
          titles: profile.titles,
          consultation_price: profile.consultation_price
        }),
      });
      if (response.ok) {
        alert('Perfil actualizado exitosamente.');
      } else {
        alert('Error al actualizar el perfil.');
      }
    } catch (error) {
      console.error("Error al guardar el perfil:", error);
    }
  };

  // -------- Álbum: subir/borrar --------
  const handleGallerySelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const form = new FormData();
    files.forEach((f) => form.append('images', f)); // backend: request.files.getlist('images')
    setUploading(true);
    try {
      const r = await fetch(`${API_BASE}/api/lawyer/gallery/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
      });
      if (!r.ok) throw new Error('Upload falló');
      await fetchGallery();
    } catch (e1) {
      console.error("Error subiendo imágenes:", e1);
      alert("No pudimos subir las imágenes. Intenta de nuevo.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleGalleryDelete = async (imageId) => {
    if (!window.confirm("¿Eliminar esta foto del álbum?")) return;
    try {
      const r = await fetch(`${API_BASE}/api/lawyer/gallery/${encodeURIComponent(imageId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('Delete falló');
      setGallery((prev) => prev.filter((g) => String(g.id) !== String(imageId)));
    } catch (e) {
      console.error("No se pudo borrar la foto:", e);
      alert("No se pudo eliminar. Intenta nuevamente.");
    }
  };

  // -------- Video: subir/borrar --------
  const handleVideoSelect = async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    const okTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov'];
    if (!okTypes.includes(file.type)) {
      alert("Formato no permitido. Usa MP4, WEBM o MOV.");
      e.target.value = "";
      return;
    }
    const form = new FormData();
    form.append('video', file);
    setVideoUploading(true);
    try {
      const r = await fetch(`${API_BASE}/api/lawyer/video/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
      });
      if (!r.ok) throw new Error('Upload de video falló');
      await fetchVideo();
      alert("Video subido correctamente.");
    } catch (err) {
      console.error(err);
      alert("No se pudo subir el video. Intenta nuevamente.");
    } finally {
      setVideoUploading(false);
      e.target.value = "";
    }
  };

  const handleVideoDelete = async () => {
    if (!window.confirm("¿Eliminar tu video introductorio?")) return;
    try {
      const r = await fetch(`${API_BASE}/api/lawyer/video`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('Delete video falló');
      setVideoUrl(null);
      alert("Video eliminado.");
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar el video.");
    }
  };

  // -------- Helpers (dashboard) --------
  // ✅ Parser robusto que soporta "05:30am", "5:30 pm", "18:30" y variantes
  const parseMeetingDateTime = (m) => {
    try {
      const dateStr = String(m.date || '').trim();        // "YYYY-MM-DD"
      const timeRaw = String(m.time || '').trim();        // "05:30am" | "5:30 pm" | "18:30" | etc.

      // Normaliza separador de fecha y descompone
      const [Y, M, D] = dateStr.replace(/\//g, '-').split('-').map(n => parseInt(n, 10));
      if (!Y || !M || !D) return null;

      // Intenta 12h con o sin espacio antes de AM/PM
      // Captura: hh:mm [am|pm]  (am/pm opcional; insensible a mayúsculas)
      let hh, mm;
      let ampm = null;

      // Si trae am/pm pegado (ej: "05:30am"), inserta espacio virtual para el regex
      const normalized = timeRaw.replace(/([ap]m)$/i, ' $1');

      let m12 = normalized.match(/^(\d{1,2}):(\d{2})\s*([ap]m)?$/i);
      if (m12) {
        hh = parseInt(m12[1], 10);
        mm = parseInt(m12[2], 10);
        ampm = m12[3]?.toLowerCase() || null;

        // Ajuste 12h → 24h
        if (ampm) {
          const isPM = ampm === 'pm';
          if (hh === 12) {
            hh = isPM ? 12 : 0;    // 12pm=12, 12am=0
          } else {
            hh = isPM ? hh + 12 : hh;
          }
        }
      } else {
        // Fallback 24h: "HH:MM" o "HH:MM:SS"
        const m24 = timeRaw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (!m24) return null;
        hh = parseInt(m24[1], 10);
        mm = parseInt(m24[2], 10);
      }

      if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
      return new Date(Y, M - 1, D, hh, mm, 0, 0);
    } catch {
      return null;
    }
  };

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const displayPrice = Number(profile?.consultation_price || 0); // solo para mostrar tu tarifa actual

  const meetingsAugmented = useMemo(() => {
    return meetings.map(m => ({ ...m, when: parseMeetingDateTime(m) })).filter(m => m.when !== null);
  }, [meetings]);

  const isIncomeStatus = (s) => {
    if (!s) return false;
    const v = String(s).toLowerCase();
    // Contamos como ingreso estados finales
    return v === 'completada' || v === 'completed' || v == 'finalizada';
  };

  const upcomingMeetings = useMemo(() => {
    return meetingsAugmented
      .filter(m => m.when >= now && String(m.status).toLowerCase() !== 'cancelada')
      .sort((a, b) => a.when - b.when)
      .slice(0, 5);
  }, [meetingsAugmented, now]);

  const meetingsThisMonth = useMemo(() => {
    return meetingsAugmented.filter(m => m.when.getMonth() === thisMonth && m.when.getFullYear() === thisYear);
  }, [meetingsAugmented, thisMonth, thisYear]);

  // ======= NUEVO: usar precio congelado de cada reunión =======
  const revenueTotal = useMemo(() => {
    return meetingsAugmented.reduce((acc, m) => {
      if (!isIncomeStatus(m.status)) return acc;
      const cents = Number(m.price_cents ?? 0);
      return acc + (cents / 100);
    }, 0);
  }, [meetingsAugmented]);

  const revenueThisMonth = useMemo(() => {
    return meetingsThisMonth.reduce((acc, m) => {
      if (!isIncomeStatus(m.status)) return acc;
      const cents = Number(m.price_cents ?? 0);
      return acc + (cents / 100);
    }, 0);
  }, [meetingsThisMonth]);

  const completedOrConfirmedThisMonth = meetingsThisMonth.filter(m => isIncomeStatus(m.status)).length;

  const daysInMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
  const revenueByDay = useMemo(() => {
    const arr = Array.from({ length: daysInMonth }, () => 0);
    meetingsThisMonth.forEach(m => {
      if (isIncomeStatus(m.status)) {
        const dayIdx = m.when.getDate() - 1;
        const cents = Number(m.price_cents ?? 0);
        arr[dayIdx] += (cents / 100);
      }
    });
    return arr;
  }, [meetingsThisMonth, daysInMonth]);

  const maxRevenueDay = Math.max(1, ...revenueByDay);

  const imageUrl = previewUrl || (profile.profile_picture_url 
    ? toAbsolute(`/uploads/${profile.profile_picture_url}?t=${new Date().getTime()}`)
    : 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png');

  return (
    <div className="lp-container">
      <aside className="lp-sidebar">
        <h3 className="lp-sidebar-title">Mi Panel</h3>
        <nav className="lp-tabs">
          <button className={`lp-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
          <button className={`lp-tab ${activeTab === 'availability' ? 'active' : ''}`} onClick={() => setActiveTab('availability')}>Ajustar Disponibilidad</button>
          <button className={`lp-tab ${activeTab === 'edit' ? 'active' : ''}`} onClick={() => setActiveTab('edit')}>Editar Perfil</button>
          <button className={`lp-tab ${activeTab === 'media' ? 'active' : ''}`} onClick={() => setActiveTab('media')}>Mis Fotos y Video</button>
        </nav>
      </aside>

      <main className="lp-content">
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="lp-dashboard">
            {(loadingProfile || loadingMeetings) ? (
              <div className="lp-loading">Cargando dashboard...</div>
            ) : (
              <>
                <div className="lp-welcome">
                  <div className="lp-welcome-left">
                    <h2>Dashboard</h2>
                    <p className="lp-welcome-sub">
                      Bienvenido{profile?.nombres ? `, ${profile.nombres}` : ''}. Aquí verás tus métricas clave.
                    </p>
                  </div>
                  <div className="lp-welcome-right">
                    <img src={imageUrl} alt="Foto de perfil" className="lp-avatar" />
                  </div>
                </div>

                <div className="lp-metrics-grid">
                  <div className="metric-card">
                    <div className="metric-label">Ingresos mes</div>
                    <div className="metric-value">${revenueThisMonth.toFixed(2)}</div>
                    <div className="metric-hint">Solo reuniones completadas de {now.toLocaleString(undefined, { month: 'long' })}.</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Ingresos totales</div>
                    <div className="metric-value">${revenueTotal.toFixed(2)}</div>
                    <div className="metric-hint">Histórico de reuniones completadas.</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Reuniones este mes</div>
                    <div className="metric-value">{meetingsThisMonth.length}</div>
                    <div className="metric-hint">{completedOrConfirmedThisMonth} completadas.</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Tarifa por consulta</div>
                    <div className="metric-value">{displayPrice ? `$${displayPrice.toFixed(2)}` : '—'}</div>
                    <div className="metric-hint">Define tu precio en Editar Perfil.</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Estado de cuenta</div>
                    <div className={`metric-badge ${profile?.is_approved ? 'ok' : 'warn'}`}>{profile?.is_approved ? 'Aprobada' : 'Pendiente'}</div>
                    <div className="metric-hint">Control interno del sistema.</div>
                  </div>
                </div>

                {/* Gráfica simple */}
                <section className="lp-chart-card">
                  <div className="lp-chart-header">
                    <h3 className="lp-chart-title">Ingresos por día (mes actual)</h3>
                    <div className="lp-chart-sub">Total mes: <strong>${revenueThisMonth.toFixed(2)}</strong></div>
                  </div>
                  <div className="lp-chart-wrap">
                    <svg className="lp-chart-svg" viewBox="0 0 100 40" preserveAspectRatio="none">
                      {[10, 20, 30].map(y => (
                        <line key={y} x1="0" x2="100" y1={y} y2={y} className="lp-gridline" />
                      ))}
                      {revenueByDay.map((val, i) => {
                        const w = 100 / revenueByDay.length;
                        const h = maxRevenueDay ? (val / maxRevenueDay) * 36 : 0;
                        const x = i * w;
                        const y = 40 - h - 2;
                        const bw = Math.max(w - 0.5, 0.4);
                        return <rect key={i} x={x + 0.25} y={y} width={bw} height={h} className="lp-bar" />;
                      })}
                    </svg>
                    <div className="lp-chart-footer"><span>1</span><span>{daysInMonth}</span></div>
                  </div>
                </section>

                <section className="lp-upcoming">
                  <h3>Próximas reuniones</h3>
                  {upcomingMeetings.length === 0 ? (
                    <div className="lp-empty">No tienes reuniones próximas.</div>
                  ) : (
                    <ul className="lp-upcoming-list">
                      {upcomingMeetings.map(m => (
                        <li key={m.id} className="lp-upcoming-item">
                          <div className="lp-up-row">
                            <span className="lp-up-date">
                              {m.when.toLocaleDateString()} · {m.when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`lp-status ${String(m.status).toLowerCase()}`}>{m.status}</span>
                          </div>
                          <div className="lp-up-name">Con: {m?.with_user?.name || '—'} ({m?.with_user?.role || '—'})</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        )}

        {/* AJUSTAR DISPONIBILIDAD */}
        {activeTab === 'availability' && (
          <div className="lp-section">
            <h2 className="lp-section-title">Ajustar Disponibilidad</h2>
            <div className="lp-section-body"><LawyerAvailability /></div>
          </div>
        )}

        {/* EDITAR PERFIL */}
        {activeTab === 'edit' && (
          <div className="form-container">
            <div className="form-box">
              <h2>Editar mi Perfil</h2>
              {loadingProfile ? (
                <div className="loading-container">Cargando perfil...</div>
              ) : (
                <>
                  <div className="profile-picture-section">
                    <img src={imageUrl} alt="Foto de perfil" className="profile-picture" />
                    <form onSubmit={handlePictureUpload} className="upload-form" encType="multipart/form-data">
                      <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
                      <button type="submit" className="submit-btn-secondary">Aceptar</button>
                    </form>
                  </div>

                  <form onSubmit={handleProfileUpdate}>
                    <div className="form-group">
                      <label htmlFor="consultation_price">Precio por Consulta ($)</label>
                      <input id="consultation_price" name="consultation_price" type="number" step="0.01" placeholder="Ej: 50.00"
                        value={profile.consultation_price || ''} onChange={handleChange}/>
                    </div>
                    <div className="form-group">
                      <label htmlFor="about_me">Sobre Mí</label>
                      <textarea id="about_me" name="about_me" rows="5"
                        placeholder="Describe tu experiencia, enfoque y por qué los clientes deberían elegirte."
                        value={profile.about_me || ''} onChange={handleChange}/>
                    </div>
                    <div className="form-group">
                      <label htmlFor="titles">Títulos y Estudios</label>
                      <textarea id="titles" name="titles" rows="5"
                        placeholder="Ej: Licenciatura en Derecho - Universidad de Panamá, Maestría en Derecho Mercantil - UDELAS"
                        value={profile.titles || ''} onChange={handleChange}/>
                    </div>
                    <button type="submit" className="submit-btn">Guardar Cambios</button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {/* MIS FOTOS Y VIDEO */}
        {activeTab === 'media' && (
          <div className="lp-section">
            <h2 className="lp-section-title">Mis Fotos y Video</h2>
            <p className="lp-tip">Pon tus mejores fotos y un breve video de presentación: una imagen clara y un mensaje cercano aumentan la confianza y atraen más clientes.</p>

            {/* Álbum */}
            <h3 className="lp-subtitle">Álbum de fotos</h3>
            <div className="lp-album-uploader">
              <label className="lp-drop">
                <input type="file" accept="image/png, image/jpeg, image/webp" multiple onChange={handleGallerySelect} style={{ display: 'none' }} />
                <div className="lp-drop-inner">
                  <strong>{uploading ? 'Subiendo…' : 'Haz clic o arrastra aquí'}</strong>
                  <span>Formatos: JPG, PNG, WEBP (puedes seleccionar varias)</span>
                </div>
              </label>
            </div>

            <div className="lp-album-grid">
              {galleryLoading ? (
                <div className="lp-album-empty">Cargando álbum…</div>
              ) : gallery.length === 0 ? (
                <div className="lp-album-empty">Aún no tienes fotos en tu álbum.</div>
              ) : (
                gallery.map((img, idx) => (
                  <figure
                    className="lp-album-item"
                    key={img.id}
                    onClick={() => { setLbIndex(idx); setLbOpen(true); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (setLbIndex(idx), setLbOpen(true))}
                  >
                    <img src={img.url} alt="Foto del abogado" />
                    <button
                      type="button"
                      className="lp-album-delete"
                      title="Eliminar foto"
                      onClick={(e) => { e.stopPropagation(); handleGalleryDelete(img.id); }}
                    >
                      ✕
                    </button>
                  </figure>
                ))
              )}
            </div>

            {/* Lightbox (visor) */}
            {lbOpen && gallery.length > 0 && (
              <div className="lb-overlay" onClick={() => setLbOpen(false)} role="dialog" aria-modal="true">
                <button className="lb-close" aria-label="Cerrar" onClick={(e) => { e.stopPropagation(); setLbOpen(false); }}>×</button>
                <button
                  className="lb-prev"
                  aria-label="Anterior"
                  onClick={(e) => { e.stopPropagation(); setLbIndex((lbIndex - 1 + gallery.length) % gallery.length); }}
                >
                  ‹
                </button>
                <img src={gallery[lbIndex].url} alt="" />
                <button
                  className="lb-next"
                  aria-label="Siguiente"
                  onClick={(e) => { e.stopPropagation(); setLbIndex((lbIndex + 1) % gallery.length); }}
                >
                  ›
                </button>
              </div>
            )}

            {/* Video */}
            <h3 className="lp-subtitle" style={{ marginTop: 24 }}>Video introductorio</h3>
            <p className="lp-tip">Añade un video presentándote y explicando por qué eres la mejor opción. Habla de tu experiencia, tu enfoque y cómo ayudas a tus clientes.</p>

            <div className="lp-video-uploader">
              <label className="lp-drop">
                <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={handleVideoSelect} style={{ display: 'none' }} />
                <div className="lp-drop-inner">
                  <strong>{videoUploading ? 'Subiendo video…' : 'Haz clic para subir tu video'}</strong>
                  <span>Formatos: MP4, WEBM o MOV</span>
                </div>
              </label>
            </div>

            <div className="lp-video-preview">
              {videoLoading ? (
                <div className="lp-album-empty">Cargando video…</div>
              ) : videoUrl ? (
                <div className="lp-video-player">
                  <video
                    key={videoUrl}
                    src={videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    poster={profile?.profile_picture_url ? toAbsolute(`/uploads/${profile.profile_picture_url}`) : undefined}
                  />
                  <button className="lp-video-delete" onClick={handleVideoDelete}>Eliminar video</button>
                </div>
              ) : (
                <div className="lp-album-empty">Aún no has subido un video.</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default LawyerProfile;
