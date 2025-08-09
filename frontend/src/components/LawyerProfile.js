import React, { useState, useEffect } from 'react';
import '../Form.css';
import './LawyerProfile.css';
import LawyerAvailability from './LawyerAvailability'; // Importa el componente del calendario

function LawyerProfile() {
  const [profile, setProfile] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('http://localhost:5001/api/lawyer/profile', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        setProfile(await response.json());
      }
    } catch (error) {
      console.error("Error al cargar el perfil:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prevProfile => ({ ...prevProfile, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handlePictureUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Por favor, selecciona un archivo primero.");
      return;
    }
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('profile_picture', selectedFile);

    try {
      const response = await fetch('http://localhost:5001/api/lawyer/profile/upload-picture', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (response.ok) {
        alert('Foto de perfil actualizada.');
        fetchProfile();
        setSelectedFile(null);
        setPreviewUrl(null);
      } else {
        alert('Error al subir la foto.');
      }
    } catch (error) {
      console.error("Error al subir la foto:", error);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('http://localhost:5001/api/lawyer/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          about_me: profile.about_me,
          titles: profile.titles,
          consultation_price: profile.consultation_price
        }),
      });
      if (response.ok) {
        alert('Perfil actualizado exitosamente.');
      } else {
        alert('Error al actualizar el perfil.');
      }
    } catch (error) {
      console.error("Error al guardar el perfil:", error);
    }
  };

  if (loading) {
    return <div className="loading-container">Cargando perfil...</div>;
  }

  const imageUrl = previewUrl || (profile.profile_picture_url 
    ? `http://localhost:5001/uploads/${profile.profile_picture_url}?t=${new Date().getTime()}` 
    : 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png');

  return (
    <div className="form-container">
      <div className="form-box">
        <h2>Editar mi Perfil</h2>
        
        <div className="profile-picture-section">
          <img 
            src={imageUrl} 
            alt="Foto de perfil"
            className="profile-picture"
          />
          <form onSubmit={handlePictureUpload} className="upload-form">
            <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
            <button type="submit" className="submit-btn-secondary">Aceptar</button>
          </form>
        </div>

        <form onSubmit={handleProfileUpdate}>
          <div className="form-group">
            <label htmlFor="consultation_price">Precio por Consulta ($)</label>
            <input
              id="consultation_price"
              name="consultation_price"
              type="number"
              step="0.01"
              placeholder="Ej: 50.00"
              value={profile.consultation_price || ''}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="about_me">Sobre Mí</label>
            <textarea
              id="about_me"
              name="about_me"
              rows="5"
              placeholder="Describe tu experiencia, enfoque y por qué los clientes deberían elegirte."
              value={profile.about_me || ''}
              onChange={handleChange}
            ></textarea>
          </div>
          <div className="form-group">
            <label htmlFor="titles">Títulos y Estudios</label>
            <textarea
              id="titles"
              name="titles"
              rows="5"
              placeholder="Ej: Licenciatura en Derecho - Universidad de Panamá, Maestría en Derecho Mercantil - UDELAS"
              value={profile.titles || ''}
              onChange={handleChange}
            ></textarea>
          </div>
          <button type="submit" className="submit-btn">Guardar Cambios</button>
        </form>

        <LawyerAvailability />
      </div>
    </div>
  );
}

export default LawyerProfile;