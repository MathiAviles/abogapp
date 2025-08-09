import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './MeetingsPage.css';

function MeetingsPage() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const userRole = localStorage.getItem('role');

  useEffect(() => {
    const fetchMeetings = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await fetch('http://localhost:5001/api/meetings', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          setMeetings(await response.json());
        }
      } catch (error) {
        console.error("Error al cargar reuniones:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMeetings();
  }, []);

  if (loading) {
    return <div className="loading-container">Cargando reuniones...</div>;
  }

  return (
    <div className="meetings-page-container">
      <h1>Mis Reuniones</h1>
      {meetings.length > 0 ? (
        <div className="meetings-list">
          {meetings.map(meeting => (
            <div key={meeting.id} className="meeting-card">
              <div className="meeting-details">
                <span className="meeting-date">{new Date(meeting.date + 'T00:00:00').toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })} - {meeting.time}</span>
                <p className="meeting-with">
                  Cita con {userRole === 'cliente' ? 'el abogado' : 'el cliente'} <strong>{meeting.with_user.name}</strong>
                </p>
                <span className={`meeting-status status-${meeting.status}`}>{meeting.status}</span>
              </div>
              <div className="meeting-actions">
                <Link to={`/reunion/${meeting.id}`}>
                  <button className="connect-btn">Conectarse</button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>Aún no tienes reuniones programadas.</p>
      )}
    </div>
  );
}

export default MeetingsPage;