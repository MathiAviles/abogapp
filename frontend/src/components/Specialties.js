import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import { useLoader } from './LoaderProvider';
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
  const { setBusy } = useLoader();

  // La lógica para manejar el clic que ya funcionaba
  const handleSpecialtyClick = (specialty) => {
    setBusy(true);
    if (userEmail) {
      navigate(`/abogados/${specialty.toLowerCase()}`);
    } else {
      navigate('/login');
    }
  };

  return (
    // Contenedor principal para la sección con fondo blanco
    <section className="specialties-section" aria-label="Especialidades">
      {/* Contenedor (grilla en desktop, lista en móvil) */}
      <div className="specialties-grid">
        {specialties.map((specialty) => (
          <div
            key={specialty.name}
            className="specialty-card"
            onClick={() => handleSpecialtyClick(specialty.name)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSpecialtyClick(specialty.name)}
          >
            <div className="spec-left">
              <span className="specialty-icon" aria-hidden="true">{specialty.icon}</span>
              <h3 className="specialty-name">{specialty.name}</h3>
            </div>
            <span className="specialty-arrow" aria-hidden="true">›</span>
          </div>
        ))}
      </div>

      <button className="show-more-btn">+ Mostrar más</button>
    </section>
  );
}

export default Specialties;