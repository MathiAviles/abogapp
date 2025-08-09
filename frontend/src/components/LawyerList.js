import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import './LawyerList.css';

function LawyerList() {
  const { especialidad } = useParams();
  const [abogados, setAbogados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAbogados = async () => {
      setLoading(true);
      try {
        const response = await fetch(`http://localhost:5001/api/abogados/${especialidad}`);
        if (response.ok) {
          setAbogados(await response.json());
        }
      } catch (error) {
        console.error("Error al obtener la lista de abogados:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAbogados();
  }, [especialidad]);

  if (loading) {
    return <div className="loading-container">Buscando abogados...</div>;
  }

  return (
    <div className="lawyer-list-container">
      <h1 className="list-title">
        Abogados de {especialidad.charAt(0).toUpperCase() + especialidad.slice(1)}
      </h1>

      {abogados.length > 0 ? (
        <div className="lawyer-results">
          {abogados.map(abogado => {
            const imageUrl = abogado.profile_picture_url
              ? `http://localhost:5001/uploads/${abogado.profile_picture_url}`
              : 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

            return (
              <div key={abogado.id} className="lawyer-card-detailed">
                <div className="lawyer-card-left">
                  <img src={imageUrl} alt={`Perfil de ${abogado.nombres}`} className="lawyer-card-image" />
                </div>

                <div className="lawyer-card-main">
                  <Link to={`/abogado/perfil/${abogado.id}`} className="lawyer-name-link">
                    <h3 className="lawyer-name">{abogado.nombres} {abogado.apellidos} <span className="verified-check">✔</span></h3>
                  </Link>
                  <div className="lawyer-meta">
                    <span>Especialista en <strong>{abogado.especialidad}</strong></span>
                  </div>
                  <p className="lawyer-bio">
                    {abogado.about_me || "Este profesional aún no ha añadido una descripción detallada."}
                  </p>
                </div>

                <div className="lawyer-card-right">
                  <div className="lawyer-rating">
                    <span className="star">★</span> 4.9 {/* Placeholder */}
                  </div>
                  <span className="review-count">163 reseñas</span> {/* Placeholder */}
                  <span className="lawyer-price">
                    {abogado.consultation_price ? `${abogado.consultation_price.toFixed(2)}$ / consulta` : 'Precio a convenir'}
                  </span>
                  <Link to={`/reservar-cita/${abogado.id}`}>
                    <button className="btn-primary-action">Reservar Cita</button>
                  </Link>
                  <button className="btn-secondary-action">Mandar Mensaje</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="no-results">No se encontraron abogados para esta especialidad.</p>
      )}
    </div>
  );
}

export default LawyerList;