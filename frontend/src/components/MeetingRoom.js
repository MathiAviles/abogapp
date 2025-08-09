import React from 'react';
import { useParams } from 'react-router-dom';

function MeetingRoom() {
  // Obtenemos el ID de la reunión desde la URL para mostrar que funciona
  const { meetingId } = useParams();

  return (
    <div style={{ padding: '100px 20px', textAlign: 'center', minHeight: '50vh' }}>
      <h1>Sala de Reunión Virtual (ID: {meetingId})</h1>
      <p>La funcionalidad de videoconferencia estará disponible aquí próximamente.</p>
    </div>
  );
}

export default MeetingRoom;