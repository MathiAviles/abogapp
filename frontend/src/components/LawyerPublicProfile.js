import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './LawyerPublicProfile.css';

function LawyerPublicProfile() {
  const { abogadoId } = useParams();
  const [abogado, setAbogado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availabilities, setAvailabilities] = useState({});
  const [availableSlots, setAvailableSlots] = useState([]);

  useEffect(() => {
    const fetchProfileAndAvailability = async () => {
      setLoading(true);
      try {
        const profileRes = await fetch(`http://localhost:5001/api/abogado/perfil/${abogadoId}`);
        if (profileRes.ok) {
          setAbogado(await profileRes.json());
        }

        const availabilityRes = await fetch(`http://localhost:5001/api/abogado/availability/${abogadoId}`);
        if (availabilityRes.ok) {
          setAvailabilities(await availabilityRes.json());
        }
      } catch (error) {
        console.error("Error al cargar los datos del abogado:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndAvailability();
  }, [abogadoId]);

  useEffect(() => {
    const dateKey = selectedDate.toISOString().split('T')[0];
    setAvailableSlots(availabilities[dateKey] || []);
  }, [selectedDate, availabilities]);

  if (loading) {
    return <div className="loading-container">Cargando perfil...</div>;
  }

  if (!abogado) {
    return <div className="loading-container">No se pudo encontrar el perfil del abogado.</div>;
  }

  const imageUrl = abogado.profile_picture_url
    ? `http://localhost:5001/uploads/${abogado.profile_picture_url}`
    : 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <img src={imageUrl} alt={`Perfil de ${abogado.nombres}`} className="profile-image-large" />
          <div className="profile-header-info">
            <h1>{abogado.nombres} {abogado.apellidos}</h1>
            <h2>Especialista en {abogado.especialidad}</h2>
            <div className="profile-actions">
              <Link to={`/reservar-cita/${abogado.id}`}>
                <button className="btn-primary-action">Reservar Cita</button>
              </Link>
              <button className="btn-secondary-action">Mandar Mensaje</button>
            </div>
          </div>
        </div>
        
        <div className="profile-body">
          <div className="profile-section">
            <h3>Sobre Mí</h3>
            <p>{abogado.about_me || "Información no disponible."}</p>
          </div>
          <div className="profile-section">
            <h3>Títulos y Estudios</h3>
            <p>{abogado.titles || "Información no disponible."}</p>
          </div>
          <div className="profile-section">
            <h3>Disponibilidad</h3>
            <div className="public-availability-wrapper">
              <div className="public-calendar-view">
                <Calendar
                  onChange={setSelectedDate}
                  value={selectedDate}
                  minDate={new Date()}
                />
              </div>
              <div className="public-slots-view">
                <h4>Horas disponibles para {selectedDate.toLocaleDateString()}</h4>
                {availableSlots.length > 0 ? (
                  <div className="public-slots-grid">
                    {availableSlots.map(slot => (
                      <div key={slot} className="slot-tag">{slot}</div>
                    ))}
                  </div>
                ) : (
                  <p>No hay horas disponibles para este día. Por favor, selecciona otra fecha.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LawyerPublicProfile;