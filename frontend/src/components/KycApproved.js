// src/components/KycApproved.js
import React, { useContext } from "react";
import "../Form.css";
import { AuthContext } from "../AuthContext";

export default function KycApproved() {
  const { logout } = useContext(AuthContext);

  const handleLoginClick = () => {
    if (typeof logout === "function") {
      logout(); // hará replace("/login")
    } else {
      // Fallback defensivo por si el contexto no está disponible
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("email");
        sessionStorage.removeItem("kycChecked");
      } finally {
        window.location.replace("/login");
      }
    }
  };

  return (
    <div className="form-container">
      <div className="form-box" style={{ textAlign: "center" }}>
        <h2>¡Tu verificación KYC fue completada!</h2>
        <p>
          Para continuar, vuelve a iniciar sesión y accede con todas las funciones de AbogApp.
        </p>
        <p style={{ marginTop: 8, color: "#555" }}>
          Nota: Por tu seguridad, tus archivos fueron borrados después de la verificación.
        </p>

        <div style={{ marginTop: 16 }}>
          <button className="submit-btn" onClick={handleLoginClick}>
            Iniciar sesión
          </button>
        </div>
      </div>
    </div>
  );
}