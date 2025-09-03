import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import '../Form.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setUserEmail } = useContext(AuthContext);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (token) navigate('/inicio');
  }, [token, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data?.code === 'EMAIL_NOT_VERIFIED') {
          localStorage.setItem('email', email);
          navigate(`/verificar-email?email=${encodeURIComponent(email)}`);
          setLoading(false);
          return;
        }
        alert(data?.message || data?.msg || 'Credenciales incorrectas.');
        setLoading(false);
        return;
      }

      // Guardar token y user
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('email', email);
      localStorage.setItem('user', JSON.stringify(data.user || {}));
      localStorage.setItem('role', (data.user?.role) || data.role || '');
      setUserEmail(email);

      const next = new URLSearchParams(location.search).get('next');

      // Si es abogado sin KYC aprobado -> forzar KYC
      if ((data.user?.role === 'abogado') && data.user?.kyc_status !== 'approved') {
        navigate('/abogado/kyc');
        setLoading(false);
        return;
      }

      const redirect = next ||
        (data.user?.role === 'admin' ? '/admin/panel'
          : data.user?.role === 'backoffice' ? '/backoffice/panel'
          : '/inicio');

      window.location.replace(redirect);
    } catch (err) {
      console.error('Error en el inicio de sesión:', err);
      alert('Ocurrió un error al intentar iniciar sesión.');
      setLoading(false);
    }
  };

  if (token) return null;

  return (
    <div className="form-container">
      <div className="form-box">
        <h2>Iniciar Sesión</h2>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              placeholder="Tu correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <div className="password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
              />
              <span
                className="toggle-password"
                role="button"
                tabIndex={0}
                onClick={() => setShowPassword(p => !p)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShowPassword(p => !p)}
                aria-label="Mostrar/ocultar contraseña"
              >
                {showPassword ? '🙈' : '👁️'}
              </span>
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>

        <div className="form-footer-text" style={{ marginTop: 12 }}>
          <Link to="/recuperar-password">¿Olvidaste tu contraseña?</Link>
        </div>

        <div className="form-footer-text">
          Al iniciar sesión o continuar, aceptas las{' '}
          <Link to="/terminos">Condiciones de uso</Link> y la{' '}
          <Link to="/privacidad">Política de privacidad</Link>.
        </div>
      </div>
    </div>
  );
}

export default Login;