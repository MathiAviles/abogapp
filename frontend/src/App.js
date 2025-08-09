import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';

// Component Imports
import Header from './components/Header';
import Footer from './components/Footer';
import MainContent from './components/MainContent';
import Specialties from './components/Specialties';
import Login from './components/Login';
import Register from './components/Register';
import Inicio from './components/Inicio';
import AdminPanel from './components/AdminPanel';
import BackPanel from './components/back';
import ProtectedRoute from './components/ProtectedRoute';
import LawyerList from './components/LawyerList';
import LawyerProfile from './components/LawyerProfile';
import LawyerPublicProfile from './components/LawyerPublicProfile';
import BookingPage from './components/BookingPage';
import PaymentPage from './components/PaymentPage';
import MeetingsPage from './components/MeetingsPage'; // Importa la página de reuniones
import MeetingRoom from './components/MeetingRoom'; // Importa la sala de reunión

// Context Import
import { AuthProvider } from './AuthContext';

// CSS Imports
import './App.css';

function HomePage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  useEffect(() => {
    if (token) {
      navigate('/inicio');
    }
  }, [navigate, token]);
  if (token) return null;
  return (
    <>
      <MainContent />
      <Specialties />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Header />
          <Routes>
            {/* Rutas Públicas */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Rutas Protegidas */}
            <Route path="/inicio" element={<ProtectedRoute><Inicio /></ProtectedRoute>} />
            <Route path="/admin/panel" element={<ProtectedRoute requiredRole="admin"><AdminPanel /></ProtectedRoute>} />
            <Route path="/backoffice/panel" element={<ProtectedRoute requiredRole="backoffice"><BackPanel /></ProtectedRoute>} />
            <Route path="/abogados/:especialidad" element={<ProtectedRoute><LawyerList /></ProtectedRoute>} />
            <Route path="/abogado/perfil" element={<ProtectedRoute requiredRole="abogado"><LawyerProfile /></ProtectedRoute>} />
            <Route path="/abogado/perfil/:abogadoId" element={<ProtectedRoute><LawyerPublicProfile /></ProtectedRoute>} />
            <Route path="/reservar-cita/:abogadoId" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
            <Route path="/pago" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
            
            {/* Nuevas Rutas para Reuniones */}
            <Route 
              path="/reuniones" 
              element={<ProtectedRoute><MeetingsPage /></ProtectedRoute>} 
            />
            <Route 
              path="/reunion/:meetingId" 
              element={<ProtectedRoute><MeetingRoom /></ProtectedRoute>} 
            />
          </Routes>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;