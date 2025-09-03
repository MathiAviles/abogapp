import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './BookingPage.css';

// ---- Helpers locales (sin UTC) ----
function formatLocalDateYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseSlotToMinutes(s) {
  if (!s) return 0;
  const raw = String(s).trim().toLowerCase();
  // 12h "5:30pm" / "5:30 pm" / "11pm"
  let m = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]m)$/i);
  if (m) {
    let hh = parseInt(m[1], 10);
    const mi = parseInt(m[2] || '0', 10);
    const ap = m[3];
    if (ap.toLowerCase() === 'am') {
      if (hh === 12) hh = 0;
    } else {
      if (hh < 12) hh += 12;
    }
    return hh * 60 + mi;
  }
  // 24h "18:30" / "07:00" [/ "07:00:00"]
  m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) {
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }
  return 0;
}

export default function BookingPage() {
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
    const dateKey = formatLocalDateYMD(selectedDate); // <- local seguro
    const slots = availabilities[dateKey] || [];
    const ordered = [...slots].sort((a, b) => parseSlotToMinutes(a) - parseSlotToMinutes(b));
    setAvailableSlots(ordered);
    setSelectedSlot(null);
  }, [selectedDate, availabilities]);

  const handleBooking = () => {
    if (!selectedSlot) {
      alert("Por favor, selecciona una hora para tu cita.");
      return;
    }
    navigate('/pago', {
      state: {
        lawyer: abogado,
        date: formatLocalDateYMD(selectedDate), // <- local seguro
        slot: selectedSlot
      }
    });
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);

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
              minDate={today}
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
