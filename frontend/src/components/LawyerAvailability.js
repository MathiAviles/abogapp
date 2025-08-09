import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './LawyerAvailability.css';

function LawyerAvailability() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allAvailabilities, setAllAvailabilities] = useState({});
  const [timeSlots, setTimeSlots] = useState([]);

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
    const dateKey = selectedDate.toISOString().split('T')[0];
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
    const dateKey = selectedDate.toISOString().split('T')[0];
    
    try {
      const response = await fetch('http://localhost:5001/api/lawyer/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ date: dateKey, time_slots: timeSlots.sort() })
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

  return (
    <div className="availability-container">
      <h3>Gestiona tu Disponibilidad</h3>
      <div className="calendar-wrapper">
        <div className="calendar-view">
          <p>1. Selecciona un día</p>
          <Calendar
            onChange={setSelectedDate}
            value={selectedDate}
            minDate={new Date()}
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
      {/* Asegúrate de que este botón tenga el onClick */}
      <button onClick={handleSaveAvailability} className="submit-btn">
        Guardar Disponibilidad para {selectedDate.toLocaleDateString()}
      </button>
    </div>
  );
}

// Nota: Esta parte también estaba faltando en el código anterior que te dí, ¡mis disculpas!
const generateTimeSlots = (startHour, endHour) => {
  const slots = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute of ['00', '30']) {
      if (hour === endHour + 1 && minute === '00') continue;
      if (hour === endHour && minute === '30') continue;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      let displayHour = hour % 12;
      if (displayHour === 0) displayHour = 12;
      slots.push(`${displayHour}:${minute} ${ampm}`);
    }
  }
  return slots;
};

const timeSections = {
  madrugada: { title: '🌙 Por la Madrugada', slots: generateTimeSlots(0, 5) },
  manana: { title: '☀️ Por la Mañana', slots: generateTimeSlots(6, 11) },
  tarde: { title: '🏙️ Por la Tarde', slots: generateTimeSlots(12, 18) },
  noche: { title: '🌃 Por la Noche', slots: generateTimeSlots(19, 22) }
};

export default LawyerAvailability;