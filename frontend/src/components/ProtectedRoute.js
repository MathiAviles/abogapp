import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

function ProtectedRoute({ children, requiredRole }) {
  const token = localStorage.getItem('token');
  const loc = useLocation();

  // user persistido por Login / VerifyEmail
  const userRaw = localStorage.getItem('user');
  let user = null;
  try { user = JSON.parse(userRaw || 'null'); } catch { user = null; }

  // Debug
  console.log("--- Verificando Ruta Protegida ---");
  console.log("Token encontrado:", token ? 'Sí' : 'No');
  console.log("Rol requerido:", requiredRole || 'Ninguno');
  console.log("User:", user);

  if (!token) {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (requiredRole && user?.role?.trim() !== requiredRole) {
    return <Navigate to="/inicio" replace />;
  }

  // Si es abogado y aún no está aprobado, permitir solo /abogado/kyc
  if (user?.role === 'abogado' && user?.kyc_status !== 'approved') {
    if (!loc.pathname.startsWith('/abogado/kyc')) {
      return <Navigate to="/abogado/kyc" replace />;
    }
  }

  return children;
}

export default ProtectedRoute;