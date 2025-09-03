import React, { useEffect, useMemo, useState, useCallback } from 'react';
import '../Form.css';
import './AdminPanel.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001';

/** Normaliza rutas relativas (/uploads/...) a URL absolutas del backend */
const fileUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url; // ya es absoluta
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
};

function formatCurrency(n) {
  if (n == null || isNaN(n)) return '—';
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
  } catch {
    return `$${Number(n).toFixed(2)}`;
  }
}

function monthKey(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).slice(0, 7);
}

function prettyMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  if (!y || !m) return ym || '';
  return `${meses[m-1]} ${y}`;
}

function BarsChart({ series }) {
  const max = useMemo(() => Math.max(1, ...series.map(s => s.total || 0)), [series]);
  return (
    <div className="ap-chart">
      <div className="ap-chart-bars">
        {series.map((s, i) => {
          const h = Math.round(((s.total || 0) / max) * 100);
          return (
            <div key={i} className="ap-bar-wrap" title={`${prettyMonthLabel(s.month)} · ${formatCurrency(s.total || 0)}`}>
              <div className="ap-bar" style={{ height: `${h}%` }} />
              <div className="ap-bar-label">{prettyMonthLabel(s.month)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** ========= MODAL VISOR DE DOCUMENTOS ========= */
function isImage(url = '') {
  return /\.(png|jpe?g|webp|gif)$/i.test((url || '').split('?')[0]);
}
function isPdf(url = '') {
  return /\.pdf$/i.test((url || '').split('?')[0]);
}

function ViewerModal({ open, src, onClose }) {
  const handleEsc = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, handleEsc]);

  if (!open) return null;

  return (
    <div className="ap-modal" onClick={onClose}>
      <div className="ap-modal-body" onClick={(e) => e.stopPropagation()}>
        <button className="ap-modal-close" onClick={onClose} aria-label="Cerrar visor">×</button>

        {isImage(src) && <img src={src} alt="Documento" className="ap-modal-media" />}
        {isPdf(src) && <iframe className="ap-modal-media" src={src} title="Documento PDF" />}
        {(!isImage(src) && !isPdf(src)) && (
          <div style={{ padding: 16, textAlign: 'center', color: '#fff' }}>
            <p>No se puede previsualizar este formato.</p>
            <p style={{ wordBreak: 'break-all' }}>{src}</p>
          </div>
        )}
      </div>
    </div>
  );
}
/** ============================================ */

export default function AdminPanel() {
  // Tabs: dashboard | crear | pendientes | aprobados
  const [activeTab, setActiveTab] = useState('dashboard');

  // Crear usuario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [identificacion, setIdentificacion] = useState('');
  const [role, setRole] = useState('cliente');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [especialidad, setEspecialidad] = useState('');

  // Listas
  const [abogadosAprobados, setAbogadosAprobados] = useState([]);
  const [abogadosPendientes, setAbogadosPendientes] = useState([]);

  // Métricas
  const [meetings, setMeetings] = useState([]);
  const [metrics, setMetrics] = useState({
    revenue_month: 0,
    revenue_total: 0,
    meetings_total: 0,
    monthly_revenue: [],
  });

  // Visor modal
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState('');
  const openViewer = (url) => { setViewerSrc(url); setViewerOpen(true); };
  const closeViewer = () => { setViewerOpen(false); setViewerSrc(''); };

  const fetchAllData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const [aprobadosRes, pendientesRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/abogados`, { headers: { Authorization: `Bearer ${token}` } }),
        // este endpoint debe incluir también identificacion y campos KYC
        fetch(`${API_BASE}/api/abogados/pendientes`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (aprobadosRes.ok) setAbogadosAprobados(await aprobadosRes.json());
      if (pendientesRes.ok) setAbogadosPendientes(await pendientesRes.json());
    } catch (err) {
      console.error('Error cargando abogados:', err);
    }

    // Métricas (fallback derivadas de /api/meetings)
    try {
      const mtRes = await fetch(`${API_BASE}/api/meetings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (mtRes.ok) {
        const list = await mtRes.json();
        setMeetings(list || []);

        const now = new Date();
        const ymNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        let revenueTotal = 0;
        let revenueMonth = 0;
        const byMonth = new Map();

        (list || []).forEach(m => {
          const isDone = (m.status || '').toLowerCase().includes('termin');
          const amount = Number(m.amount ?? m.price ?? 0);
          const mk = monthKey(m.date);
          if (isDone) {
            revenueTotal += amount;
            if (mk === ymNow) revenueMonth += amount;
            byMonth.set(mk, (byMonth.get(mk) || 0) + amount);
          }
        });

        const monthsSorted = Array.from(byMonth.keys()).sort();
        const series = monthsSorted.map(month => ({ month, total: byMonth.get(month) || 0 })).slice(-12);

        setMetrics({
          revenue_month: revenueMonth,
          revenue_total: revenueTotal,
          meetings_total: (list || []).length,
          monthly_revenue: series,
        });
      }
    } catch (err) {
      console.error('Error derivando métricas:', err);
    }
  };

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpisUsers = useMemo(() => {
    const aprobados = abogadosAprobados.length;
    const activos = abogadosAprobados.filter(a => a.is_active).length;
    const inactivos = aprobados - activos;
    const pendientes = abogadosPendientes.length;
    return { aprobados, activos, inactivos, pendientes };
  }, [abogadosAprobados, abogadosPendientes]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const payload = { email, password, identificacion, role, nombres, apellidos };
    if (role === 'abogado') payload.especialidad = (especialidad || '').trim() || null;

    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      alert(data.message || (res.ok ? 'Usuario creado.' : 'No se pudo crear el usuario.'));
      if (res.ok) {
        setEmail(''); setPassword(''); setIdentificacion(''); setRole('cliente');
        setNombres(''); setApellidos(''); setEspecialidad('');
        fetchAllData();
      }
    } catch (err) {
      console.error('Error creando usuario:', err);
      alert('Error de conexión al crear usuario.');
    }
  };

  const handleToggleUserStatus = async (userId, isActive) => {
    const token = localStorage.getItem('token');
    const action = isActive ? 'deactivate' : 'reactivate';
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        alert(`Usuario ${isActive ? 'desactivado' : 'reactivado'}.`);
        fetchAllData();
      } else {
        alert('Error al actualizar el estado del usuario.');
      }
    } catch (err) {
      console.error('Error al cambiar estado del usuario:', err);
    }
  };

  // Aprobación / Rechazo KYC usando los nuevos endpoints de admin (disparan correo en backend)
  const handleKycDecision = async (userId, approve, reason = '') => {
    const token = localStorage.getItem('token');
    const url = approve
      ? `${API_BASE}/api/admin/users/approve/${userId}`
      : `${API_BASE}/api/admin/users/reject/${userId}`;
    const opts = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    if (!approve) {
      opts.body = JSON.stringify({ reason });
    }

    try {
      const res = await fetch(url, opts);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(approve ? 'Abogado aprobado y notificado.' : 'Abogado rechazado y notificado.');
        fetchAllData();
      } else {
        alert(data?.message || data?.error || 'Error procesando la decisión.');
      }
    } catch (err) {
      console.error('Error procesando KYC:', err);
      alert('Error de red procesando la decisión.');
    }
  };

  return (
    <div className="ap-container ap-no-sidebar">
      {/* Modal visor */}
      <ViewerModal open={viewerOpen} src={viewerSrc} onClose={closeViewer} />

      {/* Tabs */}
      <div className="ap-tabs">
        <button className={`ap-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        <button className={`ap-tab ${activeTab === 'crear' ? 'active' : ''}`} onClick={() => setActiveTab('crear')}>Crear Usuario</button>
        <button className={`ap-tab ${activeTab === 'pendientes' ? 'active' : ''}`} onClick={() => setActiveTab('pendientes')}>Solicitudes Pendientes</button>
        <button className={`ap-tab ${activeTab === 'aprobados' ? 'active' : ''}`} onClick={() => setActiveTab('aprobados')}>Abogados Aprobados</button>
      </div>

      {/* Dashboard */}
      {activeTab === 'dashboard' && (
        <section className="ap-section">
          <h2 className="ap-section-title">Resumen</h2>

          <div className="ap-kpi-grid-large">
            <div className="ap-kpi-card">
              <span>Facturación del mes</span>
              <strong>{formatCurrency(metrics.revenue_month)}</strong>
              <small>Reuniones con estado “terminada”</small>
            </div>
            <div className="ap-kpi-card">
              <span>Facturación total</span>
              <strong>{formatCurrency(metrics.revenue_total)}</strong>
              <small>All-time</small>
            </div>
            <div className="ap-kpi-card">
              <span>Reuniones totales</span>
              <strong>{metrics.meetings_total || (meetings?.length ?? 0)}</strong>
              <small>Todas las reuniones</small>
            </div>
            <div className="ap-kpi-card ap-kpi-split">
              <div><span>Pendientes</span><strong>{kpisUsers.pendientes}</strong></div>
              <div><span>Aprobados</span><strong>{kpisUsers.aprobados}</strong></div>
              <div><span>Activos</span><strong>{kpisUsers.activos}</strong></div>
              <div><span>Inactivos</span><strong>{kpisUsers.inactivos}</strong></div>
            </div>
          </div>

          <h3 className="ap-chart-title">Comparación de ventas por mes</h3>
          <BarsChart
            series={
              metrics.monthly_revenue?.length
                ? metrics.monthly_revenue
                : [{ month: monthKey(new Date().toISOString().slice(0,10)), total: 0 }]
            }
          />
        </section>
      )}

      {/* Crear */}
      {activeTab === 'crear' && (
        <section className="ap-section">
          <div className="form-box ap-form">
            <h2>Crear Nuevo Usuario</h2>
            <form onSubmit={handleCreateUser}>
              <div className="form-group"><label>Nombres</label><input type="text" value={nombres} onChange={(e) => setNombres(e.target.value)} required /></div>
              <div className="form-group"><label>Apellidos</label><input type="text" value={apellidos} onChange={(e) => setApellidos(e.target.value)} required /></div>
              <div className="form-group"><label>Correo Electrónico</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div className="form-group"><label>Contraseña</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              <div className="form-group"><label>Identificación</label><input type="text" value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} required /></div>
              <div className="form-group">
                <label>Rol</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="cliente">Cliente</option>
                  <option value="abogado">Abogado</option>
                  <option value="backoffice">Backoffice</option>
                </select>
              </div>
              {role === 'abogado' && (
                <div className="form-group">
                  <label>Especialidad (solo si es Abogado)</label>
                  <input type="text" placeholder="Ej: Penal, Civil, Laboral..." value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} required />
                </div>
              )}
              <button type="submit" className="submit-btn">Crear Usuario</button>
            </form>
          </div>
        </section>
      )}

      {/* Pendientes (con documentos KYC + visor) */}
      {activeTab === 'pendientes' && (
        <section className="ap-section">
          <div className="admin-list-container">
            <h2>Solicitudes Pendientes de Aprobación</h2>
            {abogadosPendientes?.length > 0 ? (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Especialidad</th>
                    <th>Email Verificado</th>
                    <th>Estado KYC</th>
                    <th>Identificación</th>
                    <th>Documentos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {abogadosPendientes.map((u) => (
                    <tr key={u.id}>
                      <td>{u.nombres} {u.apellidos}</td>
                      <td>{u.email}</td>
                      <td>{u.especialidad || '-'}</td>
                      <td>{u.email_verified ? '✅' : '❌'}</td>
                      <td>{u.kyc_status || 'not_submitted'}</td>
                      <td>{u.identificacion || '-'}</td>
                      <td>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                          {u.kyc_doc_front_url && (
                            <button
                              type="button"
                              className="ap-linklike"
                              onClick={() => openViewer(fileUrl(u.kyc_doc_front_url))}
                            >
                              Frente
                            </button>
                          )}
                          {u.kyc_doc_back_url && (
                            <button
                              type="button"
                              className="ap-linklike"
                              onClick={() => openViewer(fileUrl(u.kyc_doc_back_url))}
                            >
                              Reverso
                            </button>
                          )}
                          {u.kyc_selfie_url && (
                            <button
                              type="button"
                              className="ap-linklike"
                              onClick={() => openViewer(fileUrl(u.kyc_selfie_url))}
                            >
                              Selfie
                            </button>
                          )}
                          {(!u.kyc_doc_front_url && !u.kyc_doc_back_url && !u.kyc_selfie_url) && <span>—</span>}
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => handleKycDecision(u.id, true)}
                          className="btn-reactivate"
                          disabled={u.kyc_status === 'approved'}
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Motivo de rechazo (opcional):', '');
                            handleKycDecision(u.id, false, reason || '');
                          }}
                          className="btn-deactivate"
                          style={{ marginLeft: 8 }}
                        >
                          Rechazar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No hay solicitudes pendientes.</p>
            )}
          </div>
        </section>
      )}

      {/* Aprobados */}
      {activeTab === 'aprobados' && (
        <section className="ap-section">
          <div className="admin-list-container">
            <h2>Abogados Registrados (Aprobados)</h2>
            {abogadosAprobados?.length > 0 ? (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Especialidad</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {abogadosAprobados.map((abogado) => (
                    <tr key={abogado.id}>
                      <td>{abogado.nombres} {abogado.apellidos}</td>
                      <td>{abogado.email}</td>
                      <td>{abogado.especialidad || '-'}</td>
                      <td>
                        <span className={abogado.is_active ? 'status-active' : 'status-inactive'}>
                          {abogado.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleUserStatus(abogado.id, abogado.is_active)}
                          className={abogado.is_active ? 'btn-deactivate' : 'btn-reactivate'}
                        >
                          {abogado.is_active ? 'Desactivar' : 'Reactivar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No hay abogados aprobados para mostrar.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}