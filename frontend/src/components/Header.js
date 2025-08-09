import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';

function Header() {
  const { userEmail, setUserEmail } = useContext(AuthContext);
  const navigate = useNavigate();

  // Obtenemos el rol del usuario desde localStorage para la lógica del perfil
  const userRole = localStorage.getItem('role');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    localStorage.removeItem('role');
    setUserEmail(null);
    navigate('/');
  };

  // Lógica para determinar la ruta del perfil
  const profilePath = userRole === 'abogado' ? '/abogado/perfil' : '/inicio';

  return (
    <header className="header">
      <div className="header-left-section">
        <Link to="/" className="logo">
          AbogApp
        </Link>
        {/* Mostramos el nuevo menú solo si el usuario está logueado */}
        {userEmail && (
          <nav className="header-nav">
            <Link to={profilePath}>Mi Perfil</Link>
            <Link to="/reuniones">Reuniones</Link>
            <Link to="/mensajes">Mensajes</Link>
            <Link to="/favoritos">Favoritos</Link>
          </nav>
        )}
      </div>

      <div className="header-right">
        {userEmail ? (
          <>
            <span className="user-email">{userEmail}</span>
            <button onClick={handleLogout} className="header-btn btn-logout">
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <Link to="/login">
              <button className="header-btn btn-secondary">Iniciar sesión</button>
            </Link>
            <Link to="/register">
              <button className="header-btn btn-primary">Registrarse</button>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export default Header;