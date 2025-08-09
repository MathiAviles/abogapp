import React, { useState, useEffect } from 'react';
import '../Form.css';
import './AdminPanel.css';

function AdminPanel() {
  // --- Estados para el formulario de CREAR USUARIO ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [identificacion, setIdentificacion] = useState('');
  const [role, setRole] = useState('cliente');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');

  // --- Estados para las LISTAS ---
  const [abogadosAprobados, setAbogadosAprobados] = useState([]);
  const [abogadosPendientes, setAbogadosPendientes] = useState([]);

  // --- LÓGICA DE FETCH (Carga de datos) ---
  const fetchAllData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // Fetch para abogados aprobados
      const aprobadosRes = await fetch('http://localhost:5001/api/admin/abogados', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (aprobadosRes.ok) {
        setAbogadosAprobados(await aprobadosRes.json());
      }

      // Fetch para abogados pendientes
      const pendientesRes = await fetch('http://localhost:5001/api/abogados/pendientes', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (pendientesRes.ok) {
        setAbogadosPendientes(await pendientesRes.json());
      }
    } catch (error) {
      console.error("Error al cargar los datos del panel:", error);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // --- LÓGICA DE ACCIONES (Handlers) ---

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('http://localhost:5001/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, password, identificacion, role, nombres, apellidos }),
      });
      const data = await response.json();
      alert(data.message);
      if (response.ok) {
        // Limpiar formulario y recargar todos los datos
        setEmail('');
        setPassword('');
        setIdentificacion('');
        setNombres('');
        setApellidos('');
        fetchAllData();
      }
    } catch (error) {
      alert('Error de conexión al crear usuario.');
    }
  };

  const handleToggleUserStatus = async (userId, isActive) => {
    const token = localStorage.getItem('token');
    const action = isActive ? 'deactivate' : 'reactivate';
    try {
      const response = await fetch(`http://localhost:5001/api/admin/users/${userId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        alert(`Usuario ${isActive ? 'desactivado' : 'reactivado'}.`);
        fetchAllData(); // Recargar todos los datos
      } else {
        alert('Error al actualizar el estado del usuario.');
      }
    } catch (error) {
      console.error("Error al cambiar estado del usuario:", error);
    }
  };
  
  const handleApproval = async (abogadoId, decision) => {
    const token = localStorage.getItem('token');
    const action = decision === 'aprobar' ? 'aprobar' : 'rechazar';
    try {
      const response = await fetch(`http://localhost:5001/api/abogados/${action}/${abogadoId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        alert(`Abogado ${decision === 'aprobar' ? 'aprobado' : 'rechazado'}.`);
        fetchAllData(); // Recargar todos los datos
      } else {
        alert('Error al procesar la solicitud.');
      }
    } catch (error) {
      console.error(`Error al ${action} abogado:`, error);
    }
  };

  return (
    <div className="admin-panel-container">
      {/* --- SECCIÓN 1: Formulario para Crear Usuario --- */}
      <div className="form-box">
        <h2>Crear Nuevo Usuario</h2>
        <form onSubmit={handleCreateUser}>
           <div className="form-group">
            <label>Nombres</label>
            <input type="text" value={nombres} onChange={(e) => setNombres(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Apellidos</label>
            <input type="text" value={apellidos} onChange={(e) => setApellidos(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Correo Electrónico</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Identificación</label>
            <input type="text" value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Rol</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="cliente">Cliente</option>
              <option value="abogado">Abogado</option>
              <option value="backoffice">Backoffice</option>
            </select>
          </div>
          <button type="submit" className="submit-btn">Crear Usuario</button>
        </form>
      </div>

      {/* --- SECCIÓN 2: Solicitudes Pendientes de Aprobación --- */}
      <div className="admin-list-container">
        <h2>Solicitudes Pendientes de Aprobación</h2>
        {abogadosPendientes.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {abogadosPendientes.map(abogado => (
                <tr key={abogado.id}>
                  <td>{abogado.nombres} {abogado.apellidos}</td>
                  <td>{abogado.email}</td>
                  <td>
                    <button onClick={() => handleApproval(abogado.id, 'aprobar')} className="btn-reactivate">Aprobar</button>
                    <button onClick={() => handleApproval(abogado.id, 'rechazar')} className="btn-deactivate">Rechazar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No hay solicitudes pendientes.</p>
        )}
      </div>

      {/* --- SECCIÓN 3: Lista de Abogados Ya Aprobados --- */}
      <div className="admin-list-container">
        <h2>Abogados Registrados (Aprobados)</h2>
        {abogadosAprobados.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {abogadosAprobados.map(abogado => (
                <tr key={abogado.id}>
                  <td>{abogado.nombres} {abogado.apellidos}</td>
                  <td>{abogado.email}</td>
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
    </div>
  );
}

export default AdminPanel;