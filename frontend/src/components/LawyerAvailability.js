import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './LawyerAvailability.css';

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
  let m = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]m)$/i);
  if (m) {
    let hh = parseInt(m[1], 10);
    const mi = parseInt(m[2] || '0', 10);
    const ap = m[3];
    if (ap.toLowerCase() === 'am') { if (hh === 12) hh = 0; }
    else { if (hh < 12) hh += 12; }
    return hh * 60 + mi;
  }
  m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return 0;
}

function LawyerAvailability() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allAvailabilities, setAllAvailabilities] = useState({});
  const [timeSlots, setTimeSlots] = useState([]);

  // (Se mantiene tal cual; no se usa para render pero no estorba)
  const workingHours = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute of ['00', '30']) {
      const ampm = hour >= 12 ? 'PM' : 'AM';
      let displayHour = hour % 12;
      if (displayHour === 0) {
        displayHour = 12;
      }
      const timeString = `${displayHour}:${minute} ${ampm}`;
      workingHours.push(timeString);
    }
  }

  const fetchAvailabilities = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const response = await fetch('http://localhost:5001/api/lawyer/availability', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      const data = await response.json();
      setAllAvailabilities(data);
    }
  };

  useEffect(() => {
    fetchAvailabilities();
  }, []);

  useEffect(() => {
    const dateKey = formatLocalDateYMD(selectedDate); // <- local seguro
    setTimeSlots(allAvailabilities[dateKey] || []);
  }, [selectedDate, allAvailabilities]);

  const handleSlotToggle = (slot) => {
    setTimeSlots(prevSlots =>
      prevSlots.includes(slot)
        ? prevSlots.filter(s => s !== slot)
        : [...prevSlots, slot]
    );
  };

  const handleSaveAvailability = async () => {
    const token = localStorage.getItem('token');
    const dateKey = formatLocalDateYMD(selectedDate); // <- local seguro
    const sorted = [...timeSlots].sort((a, b) => parseSlotToMinutes(a) - parseSlotToMinutes(b));

    try {
      const response = await fetch('http://localhost:5001/api/lawyer/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ date: dateKey, time_slots: sorted })
      });
      if (response.ok) {
        alert('Disponibilidad guardada.');
        fetchAvailabilities();
      } else {
        alert('Error al guardar la disponibilidad.');
      }
    } catch (error) {
      console.error("Error al guardar disponibilidad:", error);
      alert("Error de conexión al guardar.");
    }
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <div className="availability-container">
      <h3>Gestiona tu Disponibilidad</h3>
      <div className="calendar-wrapper">
        <div className="calendar-view">
          <p>1. Selecciona un día</p>
          <Calendar
            onChange={setSelectedDate}
            value={selectedDate}
            minDate={today}
            className="custom-calendar"
          />
        </div>
        <div className="slots-view">
          <p>2. Marca las horas disponibles</p>
          <div className="slots-sections-container">
            {Object.values(timeSections).map(section => (
              <div key={section.title} className="slot-section">
                <h4>{section.title}</h4>
                <div className="slots-grid">
                  {section.slots.map(slot => (
                    <label key={slot} className={`slot-button ${timeSlots.includes(slot) ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={timeSlots.includes(slot)}
                        onChange={() => handleSlotToggle(slot)}
                      />
                      {slot}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <button onClick={handleSaveAvailability} className="submit-btn">
        Guardar Disponibilidad para {selectedDate.toLocaleDateString()}
      </button>
    </div>
  );
}

/* =======================
   SOLO FIX DE SLOTS AQUÍ
   ======================= */
// Genera TODOS los intervalos cada 30' desde startHour:00 hasta endHour:30 (inclusive).
const generateTimeSlots = (startHour, endHour) => {
  const slots = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute of ['00', '30']) {
      const ampm = hour >= 12 ? 'PM' : 'AM';
      let displayHour = hour % 12;
      if (displayHour === 0) displayHour = 12;
      slots.push(`${displayHour}:${minute} ${ampm}`);
    }
  }
  return slots;
};

// Rango “Noche” extendido hasta 23 para incluir 10:30 PM, 11:00 PM y 11:30 PM.
const timeSections = {
  madrugada: { title: '🌙 Por la Madrugada', slots: generateTimeSlots(0, 5) },   // incluye 5:30 AM
  manana:    { title: '☀️ Por la Mañana',   slots: generateTimeSlots(6, 11) },  // incluye 11:30 AM
  tarde:     { title: '🏙️ Por la Tarde',    slots: generateTimeSlots(12, 18) }, // incluye 6:30 PM
  noche:     { title: '🌃 Por la Noche',     slots: generateTimeSlots(19, 23) }  // incluye 10:30 PM, 11:00 PM, 11:30 PM
};

export default LawyerAvailability;
