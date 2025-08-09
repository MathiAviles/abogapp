import React, { useState, useEffect } from 'react';

function BackofficePanel() {
  const [solicitudes, setSolicitudes] = useState([]);

  useEffect(() => {
    // Obtener solicitudes pendientes
    const fetchSolicitudes = async () => {
      try {
        const response = await fetch('http://localhost:5001/api/abogados/pendientes', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setSolicitudes(data);
        }
      } catch (error) {
        console.error('Error al obtener solicitudes:', error);
      }
    };

    fetchSolicitudes();
  }, []);

  const handleAceptar = async (id) => {
    try {
      const response = await fetch(`http://localhost:5001/api/abogados/aprobar/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        alert('Abogado aprobado');
        setSolicitudes(solicitudes.filter(solicitud => solicitud.id !== id));
      }
    } catch (error) {
      console.error('Error al aprobar abogado:', error);
    }
  };

  const handleRechazar = async (id) => {
    try {
      const response = await fetch(`http://localhost:5001/api/abogados/rechazar/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        alert('Abogado rechazado');
        setSolicitudes(solicitudes.filter(solicitud => solicitud.id !== id));
      }
    } catch (error) {
      console.error('Error al rechazar abogado:', error);
    }
  };

  return (
    <div className="backoffice-panel">
      <h2>Solicitudes de Abogados</h2>
      <ul>
        {solicitudes.map(solicitud => (
          <li key={solicitud.id}>
            {solicitud.email} - {solicitud.identificacion}
            <button onClick={() => handleAceptar(solicitud.id)}>Aceptar</button>
            <button onClick={() => handleRechazar(solicitud.id)}>Rechazar</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default BackofficePanel;
