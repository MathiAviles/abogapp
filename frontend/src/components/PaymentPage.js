import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function PaymentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lawyer, date, slot } = location.state || {};

  if (!lawyer) {
    return <div>Error: No se encontraron los detalles de la cita. Vuelve a intentarlo.</div>;
  }

  const handlePayment = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('http://localhost:5001/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lawyer_id: lawyer.id,
          date: date,
          time: slot
        })
      });

      if (response.ok) {
        alert("¡Pago simulado y reunión creada exitosamente!");
        navigate('/reuniones');
      } else {
        alert("Error al crear la reunión.");
      }
    } catch (error) {
      console.error("Error al procesar el pago:", error);
      alert("Error de conexión al procesar el pago.");
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '100px', minHeight: '50vh' }}>
      <h1>PAGAR</h1>
      <h3>Confirmando cita con <strong>{lawyer.nombres} {lawyer.apellidos}</strong></h3>
      <p>Fecha: <strong>{date}</strong> a las <strong>{slot}</strong></p>
      <button 
        onClick={handlePayment} 
        style={{ padding: '15px 30px', fontSize: '1.2em', cursor: 'pointer', marginTop: '20px' }}
      >
        PAGADO
      </button>
    </div>
  );
}

export default PaymentPage;