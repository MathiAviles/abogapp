import React, { useState, useEffect } from 'react';

// Componente para el panel de Backoffice
function BackPanel() {
  // Estado para guardar la lista de solicitudes de abogados
  const [solicitudes, setSolicitudes] = useState([]);

  // useEffect para obtener los datos cuando el componente se carga
  useEffect(() => {
    const fetchSolicitudes = async () => {
      const token = localStorage.getItem('token');
      if (!token) return; // No hacer nada si no hay token

      try {
        const response = await fetch('http://localhost:5001/api/abogados/pendientes', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setSolicitudes(data);
        } else {
          console.error('Error al obtener las solicitudes');
        }
      } catch (error) {
        console.error('Error de red:', error);
      }
    };

    fetchSolicitudes();
  }, []); // El array vacío asegura que se ejecute solo una vez

  // Función para aprobar un abogado
  const handleAprobar = async (abogadoId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:5001/api/abogados/aprobar/${abogadoId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert('Abogado aprobado exitosamente.');
        // Actualiza la lista en el frontend para no mostrar al abogado ya aprobado
        setSolicitudes(solicitudes.filter(solicitud => solicitud.id !== abogadoId));
      } else {
        alert('Error al aprobar el abogado.');
      }
    } catch (error) {
      console.error('Error de red:', error);
    }
  };

  // Función para rechazar un abogado
  const handleRechazar = async (abogadoId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:5001/api/abogados/rechazar/${abogadoId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert('Abogado rechazado y eliminado.');
        // Actualiza la lista en el frontend
        setSolicitudes(solicitudes.filter(solicitud => solicitud.id !== abogadoId));
      } else {
        alert('Error al rechazar el abogado.');
      }
    } catch (error) {
      console.error('Error de red:', error);
    }
  };

  return (
    <div className="backoffice-panel">
      <h2>Solicitudes Pendientes de Abogados</h2>
      {solicitudes.length > 0 ? (
        <ul>
          {solicitudes.map(solicitud => (
            <li key={solicitud.id}>
              <span>Email: {solicitud.email}</span>
              <span>Identificación: {solicitud.identificacion}</span>
              <div>
                <button onClick={() => handleAprobar(solicitud.id)}>Aceptar</button>
                <button onClick={() => handleRechazar(solicitud.id)}>Rechazar</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>No hay solicitudes pendientes.</p>
      )}
    </div>
  );
}

export default BackPanel;
