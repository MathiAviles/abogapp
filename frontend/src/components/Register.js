import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Form.css'; // Importa los estilos del formulario

function Register() {
  // Estados para todos los campos del formulario
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [identificacion, setIdentificacion] = useState('');
  const [role, setRole] = useState('cliente');
  const navigate = useNavigate();

  const especialidadesDisponibles = ['Laboral', 'Familia', 'Migratorio', 'Penal', 'Civil', 'Mercantil', 'Administrativo'];

  // --- ESTA ES LA FUNCIÓN QUE FALTABA ---
  const handleRegister = async (e) => {
    e.preventDefault(); // Previene que la página se recargue

    // Prepara los datos que se enviarán al backend
    const payload = {
      nombres,
      apellidos,
      email,
      password,
      identificacion,
      role,
    };

    // Si el rol es 'abogado', añade la especialidad al payload
    if (role === 'abogado') {
      if (!especialidad) {
        alert('Por favor, selecciona una especialidad.');
        return; // Detiene el envío si no hay especialidad
      }
      payload.especialidad = especialidad;
    }

    // Intenta enviar los datos al backend
    try {
      const response = await fetch('http://localhost:5001/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      alert(data.message); // Muestra el mensaje del servidor (éxito o error)

      if (response.ok) {
        navigate('/login'); // Si todo salió bien, redirige al login
      }
    } catch (error) {
      console.error('Error en el registro:', error);
      alert('Error de conexión. No se pudo completar el registro.');
    }
  };
  // --- FIN DE LA FUNCIÓN ---

  return (
    <div className="form-container">
      <div className="form-box">
        <h2>Crear una cuenta</h2>
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label htmlFor="nombres">Nombres</label>
            <input id="nombres" type="text" value={nombres} onChange={(e) => setNombres(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="apellidos">Apellidos</label>
            <input id="apellidos" type="text" value={apellidos} onChange={(e) => setApellidos(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="email-register">Correo electrónico</label>
            <input id="email-register" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="password-register">Contraseña</label>
            <input id="password-register" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="identificacion">Identificación</label>
            <input id="identificacion" type="text" value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="role">Tipo de cuenta</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="cliente">Soy Cliente</option>
              <option value="abogado">Soy Abogado</option>
            </select>
          </div>
          {role === 'abogado' && (
            <div className="form-group">
              <label htmlFor="especialidad">Especialidad</label>
              <select id="especialidad" value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} required>
                <option value="" disabled>-- Selecciona tu especialidad --</option>
                {especialidadesDisponibles.map(esp => <option key={esp} value={esp}>{esp}</option>)}
              </select>
            </div>
          )}
          <button type="submit" className="submit-btn">Registrarse</button>
        </form>
      </div>
    </div>
  );
}

export default Register;
