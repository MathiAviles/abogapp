import React from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children, requiredRole }) {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');

  // --- INICIO DE DEPURACIÓN ---
  console.log("--- Verificando Ruta Protegida ---");
  console.log("Token encontrado:", token ? 'Sí' : 'No');
  console.log("Rol requerido:", requiredRole || 'Ninguno');
  console.log("Rol del usuario:", userRole);
  // --- FIN DE DEPURACIÓN ---

  if (!token) {
    console.log("Decisión: No hay token. Redirigiendo a /login.");
    return <Navigate to="/login" />;
  }

  // Comparamos los roles. Ojo con espacios invisibles (usamos .trim())
  if (requiredRole && userRole?.trim() !== requiredRole) {
    console.log(`Decisión: El rol no coincide ('${userRole}' !== '${requiredRole}'). Redirigiendo a /inicio.`);
    return <Navigate to="/inicio" />;
  }

  console.log("Decisión: Acceso concedido. Mostrando componente.");
  return children;
}

export default ProtectedRoute;