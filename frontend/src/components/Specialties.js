import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import './Specialties.css'; // Importa los estilos dedicados

function Specialties() {
  // Lista de especialidades con sus íconos
  const specialties = [
    { name: 'Laboral', icon: '⚖️' },
    { name: 'Familia', icon: '👨‍👩‍👧‍👦' },
    { name: 'Migratorio', icon: '✈️' },
    { name: 'Penal', icon: '⛓️' },
    { name: 'Corporativo', icon: '🏢' },
    { name: 'Propiedad Intelectual', icon: '©️' },
  ];

  const { userEmail } = useContext(AuthContext);
  const navigate = useNavigate();

  // La lógica para manejar el clic que ya funcionaba
  const handleSpecialtyClick = (specialty) => {
    if (userEmail) {
      navigate(`/abogados/${specialty.toLowerCase()}`);
    } else {
      navigate('/login');
    }
  };

  return (
    // Contenedor principal para la sección con fondo blanco
    <section className="specialties-section">
      {/* Contenedor para la grilla de 3 columnas */}
      <div className="specialties-grid">
        {specialties.map((specialty) => (
          <div
            key={specialty.name}
            className="specialty-card"
            onClick={() => handleSpecialtyClick(specialty.name)}
          >
            <span className="specialty-icon">{specialty.icon}</span>
            <h3 className="specialty-name">{specialty.name}</h3>
            <span className="specialty-arrow">→</span>
          </div>
        ))}
      </div>
      <button className="show-more-btn">+ Mostrar más</button>
    </section>
  );
}

export default Specialties;
