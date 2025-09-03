import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Form.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001';

function Register() {
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [identificacion, setIdentificacion] = useState('');
  const [role, setRole] = useState('cliente');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const especialidadesDisponibles = [
    'Laboral','Familia','Migratorio','Penal','Civil','Mercantil','Administrativo'
  ];

  const parseMaybeJson = async (r) => {
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) return r.json();
    return { message: await r.text() };
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== password2) {
      alert('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);

    const payload = {
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      email: email.trim().toLowerCase(),
      password,
      identificacion: identificacion.trim(),
      role,
    };

    if (role === 'abogado') {
      if (!especialidad) {
        alert('Por favor, selecciona una especialidad.');
        setLoading(false);
        return;
      }
      payload.especialidad = especialidad;
    }

    try {
      const response = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await parseMaybeJson(response);

      if (response.status === 201 || response.status === 202 || data?.needsVerification) {
        if (data?.message) alert(data.message);
        localStorage.setItem('email', payload.email);
        navigate(`/verificar-email?email=${encodeURIComponent(payload.email)}`);
        return;
      }

      alert(data?.message || 'No se pudo completar el registro.');
    } catch (err) {
      console.error('Error en el registro:', err);
      alert('Error de conexión. No se pudo completar el registro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-box">
        <h2>Crear una cuenta</h2>
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label htmlFor="nombres">Nombres</label>
            <input
              id="nombres"
              type="text"
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              required
              disabled={loading}
              autoComplete="given-name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="apellidos">Apellidos</label>
            <input
              id="apellidos"
              type="text"
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
              required
              disabled={loading}
              autoComplete="family-name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email-register">Correo electrónico</label>
            <input
              id="email-register"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
              placeholder="tu@correo.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password-register">Contraseña</label>
            <div className="password-wrapper">
              <input
                id="password-register"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
              />
              <span
                className="toggle-password"
                role="button"
                tabIndex={0}
                onClick={() => setShowPass(p => !p)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShowPass(p => !p)}
                aria-label="Mostrar/ocultar contraseña"
              >
                {showPass ? '🙈' : '👁️'}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password-register-2">Confirmar contraseña</label>
            <div className="password-wrapper">
              <input
                id="password-register-2"
                type={showPass2 ? 'text' : 'password'}
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
                placeholder="Repite tu contraseña"
              />
              <span
                className="toggle-password"
                role="button"
                tabIndex={0}
                onClick={() => setShowPass2(p => !p)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShowPass2(p => !p)}
                aria-label="Mostrar/ocultar contraseña"
              >
                {showPass2 ? '🙈' : '👁️'}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="identificacion">Identificación</label>
            <input
              id="identificacion"
              type="text"
              value={identificacion}
              onChange={(e) => setIdentificacion(e.target.value)}
              required
              disabled={loading}
              inputMode="numeric"
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Tipo de cuenta</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
            >
              <option value="cliente">Soy Cliente</option>
              <option value="abogado">Soy Abogado</option>
            </select>
          </div>

          {role === 'abogado' && (
            <div className="form-group">
              <label htmlFor="especialidad">Especialidad</label>
              <select
                id="especialidad"
                value={especialidad}
                onChange={(e) => setEspecialidad(e.target.value)}
                required
                disabled={loading}
              >
                <option value="" disabled>-- Selecciona tu especialidad --</option>
                {especialidadesDisponibles.map(esp => (
                  <option key={esp} value={esp}>{esp}</option>
                ))}
              </select>
            </div>
          )}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Registrando…' : 'Registrarse'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Register;
