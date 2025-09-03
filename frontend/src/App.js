import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate, useLocation } from 'react-router-dom';

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
import MeetingsPage from './components/MeetingsPage';
import MeetingRoom from './components/MeetingRoom';
import ClientProfile from './components/ClientProfile';
import FavoritesPage from './components/FavoritesPage';

// Nuevos (verificación y recuperación)
import VerifyEmail from './components/VerifyEmail';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';

// Chat (GetStream)
import ChatProvider from './components/ChatProvider';
import ChatWindow from './components/ChatWindow';

import LawyerKYC from './components/LawyerKYC'; // Si tienes el componente de KYC, descoméntalo
import KycPending from './components/KycPending';
import KYCApproved from './components/KycApproved'; // Si tienes el componente de KYC aprobado, descoméntalo
import KycGate from './components/KycGate';

// Context
import { AuthProvider } from './AuthContext';

// (Si tienes el componente de KYC, descomenta esta línea)
// import LawyerKYC from './components/LawyerKYC';

import './App.css';
import HomeHeroSlider from './components/HomeHeroSlider';
import HowItWorks from './components/HowItWorks';
import JoinAsLawyer from './components/JoinAsLawyer';

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
      <HomeHeroSlider />
      <HowItWorks />
      <JoinAsLawyer />
    </>
  );
}

function AppShell() {
  const location = useLocation();
  const hideFooter = /^\/reunion\/[^/]+$/.test(location.pathname);

  return (
    <div className="App">
      <Header />
      <Routes>
        {/* Públicas */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verificar-email" element={<VerifyEmail />} />
        <Route path="/recuperar-password" element={<ForgotPassword />} />
        <Route path="/restablecer-password" element={<ResetPassword />} />

        {/* Protegidas */}
        <Route path="/inicio" element={<ProtectedRoute><Inicio /></ProtectedRoute>} />
        <Route path="/admin/panel" element={<ProtectedRoute requiredRole="admin"><AdminPanel /></ProtectedRoute>} />
        <Route path="/backoffice/panel" element={<ProtectedRoute requiredRole="backoffice"><BackPanel /></ProtectedRoute>} />
        <Route path="/abogados/:especialidad" element={<ProtectedRoute><LawyerList /></ProtectedRoute>} />
        <Route path="/abogado/perfil" element={<ProtectedRoute requiredRole="abogado"><LawyerProfile /></ProtectedRoute>} />
        <Route path="/abogado/perfil/:abogadoId" element={<ProtectedRoute><LawyerPublicProfile /></ProtectedRoute>} />
        <Route path="/reservar-cita/:abogadoId" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
        <Route path="/pago" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />

        {/* Reuniones */}
        <Route path="/reuniones" element={<ProtectedRoute><MeetingsPage /></ProtectedRoute>} />
        <Route path="/reunion/:id" element={<ProtectedRoute><MeetingRoom /></ProtectedRoute>} />

        {/* Favoritos */}
        <Route path="/favoritos" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />

        {/* Chat */}
        <Route path="/chat" element={<ProtectedRoute><ChatWindow /></ProtectedRoute>} />
        <Route path="/cliente/perfil" element={<ProtectedRoute><ClientProfile /></ProtectedRoute>} />

        {/* KYC (si ya tienes el componente) */}
        <Route path="/abogado/kyc" element={<ProtectedRoute><LawyerKYC /></ProtectedRoute>} />
        <Route path="/abogado/kyc/pending" element={<ProtectedRoute><KycPending /></ProtectedRoute>} />
        <Route path="/abogado/kyc/done" element={<ProtectedRoute><KYCApproved /></ProtectedRoute>} />
      </Routes>

      {!hideFooter && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <ChatProvider>
          <KycGate />
          <AppShell />
        </ChatProvider>
      </Router>
    </AuthProvider>
  );
}