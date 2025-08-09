import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import '../Form.css'; // Importa los estilos del formulario

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Estado para la visibilidad de la contraseña
  const navigate = useNavigate();
  const { setUserEmail } = useContext(AuthContext);
  const token = localStorage.getItem('token');

  // Redirige si el usuario ya está logueado
  useEffect(() => {
    if (token) {
      navigate('/inicio');
    }
  }, [token, navigate]);

  // --- ESTA ES LA FUNCIÓN QUE FALTABA ---
  const handleLogin = async (e) => {
    e.preventDefault(); // Previene que la página se recargue
    try {
      const response = await fetch('http://localhost:5001/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Guardar la sesión en localStorage
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('email', email);
        localStorage.setItem('role', data.role);
        
        // Actualizar el estado global
        setUserEmail(email);

        // Redirigir según el rol
        if (data.role === 'admin') {
          navigate('/admin/panel');
        } else if (data.role === 'backoffice') {
          navigate('/backoffice/panel');
        } else {
          navigate('/inicio');
        }
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Credenciales incorrectas.');
      }
    } catch (error) {
      console.error('Error en el inicio de sesión:', error);
      alert('Ocurrió un error al intentar iniciar sesión.');
    }
  };
  // --- FIN DE LA FUNCIÓN ---

  // Si ya hay token, no renderizar nada para evitar un "flash" del formulario
  if (token) {
    return null;
  }

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
              />
              <span 
                className="toggle-password" 
                onClick={() => setShowPassword(!showPassword)}
              >
                {/* Puedes reemplazar '👁️' por un ícono de FontAwesome o Material Icons */}
                {showPassword ? '🙈' : '👁️'}
              </span>
            </div>
          </div>
          
          <button type="submit" className="submit-btn">Iniciar sesión</button>
        </form>
        <div className="form-footer-text">
          Al iniciar sesión o continuar, aceptas las <Link to="/terminos">Condiciones de uso</Link> y la <Link to="/privacidad">Política de privacidad</Link>.
        </div>
      </div>
    </div>
  );
}

export default Login;
