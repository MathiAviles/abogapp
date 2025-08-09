import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './BookingPage.css';

function BookingPage() {
  const { abogadoId } = useParams();
  const [abogado, setAbogado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availabilities, setAvailabilities] = useState({});
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLawyerData = async () => {
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
    fetchLawyerData();
  }, [abogadoId]);

  useEffect(() => {
    const dateKey = selectedDate.toISOString().split('T')[0];
    setAvailableSlots(availabilities[dateKey] || []);
    setSelectedSlot(null);
  }, [selectedDate, availabilities]);

  const handleBooking = () => {
    if (!selectedSlot) {
      alert("Por favor, selecciona una hora para tu cita.");
      return;
    }
    // Pasamos los datos de la cita a través del estado de la ruta
    navigate('/pago', { 
        state: { 
            lawyer: abogado, 
            date: selectedDate.toISOString().split('T')[0],
            slot: selectedSlot 
        } 
    });
  };

  if (loading) {
    return <div className="loading-container">Cargando disponibilidad...</div>;
  }

  if (!abogado) {
    return <div className="loading-container">No se pudo encontrar al abogado.</div>;
  }

  return (
    <div className="booking-container">
      <div className="booking-card">
        <h1>Reserva tu cita con</h1>
        <h2>{abogado.nombres} {abogado.apellidos}</h2>
        <p>Especialista en {abogado.especialidad}</p>
        
        <div className="booking-calendar-wrapper">
          <div className="booking-calendar-view">
            <h3>1. Selecciona un día</h3>
            <Calendar
              onChange={setSelectedDate}
              value={selectedDate}
              minDate={new Date()}
            />
          </div>
          <div className="booking-slots-view">
            <h3>2. Selecciona una hora</h3>
            {availableSlots.length > 0 ? (
              <div className="booking-slots-grid">
                {availableSlots.map(slot => (
                  <button 
                    key={slot} 
                    className={`slot-button-book ${selectedSlot === slot ? 'selected' : ''}`}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            ) : (
              <p>No hay horas disponibles para este día.</p>
            )}
          </div>
        </div>

        <button onClick={handleBooking} className="submit-btn booking-confirm-btn" disabled={!selectedSlot}>
          Confirmar Cita para las {selectedSlot || '...'}
        </button>
      </div>
    </div>
  );
}

export default BookingPage;