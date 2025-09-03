// src/components/KYCPending.js
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Form.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5001";

export default function KYCPending() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState("");
  const timerRef = useRef(null);
  const token = localStorage.getItem("token");

  const checkStatus = async () => {
    if (checking) return;
    setChecking(true);
    setMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/kyc/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("No se pudo consultar el estado");
      const data = await r.json();
      const st = (data?.kyc_status || "not_submitted").toLowerCase();

      if (st === "approved") {
        // ⬇️ ahora mandamos a la página de “aprobado”
        navigate("/abogado/kyc/done", { replace: true });
        return;
      }
      if (st === "rejected") {
        navigate("/abogado/kyc", { replace: true });
        return;
      }

      setMsg("Aún en revisión…");
    } catch (e) {
      console.error(e);
      setMsg("No se pudo actualizar el estado en este momento.");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    timerRef.current = setInterval(checkStatus, 5000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="form-container">
      <div className="form-box" style={{ textAlign: "center" }}>
        <h2>Estamos verificando tu KYC</h2>
        <p>Gracias por enviar tu documentación. Nuestro equipo la está revisando.</p>
        <p>Te notificaremos por correo cuando sea aprobada o si necesitamos algo más.</p>
        <p>Mientras tanto, tendrás acceso limitado en la plataforma.</p>

        <div style={{ marginTop: 16 }}>
          <button className="submit-btn" onClick={checkStatus} disabled={checking}>
            {checking ? "Comprobando…" : "Revisar ahora"}
          </button>
        </div>

        {msg && <p style={{ marginTop: 10, color: "#666" }}>{msg}</p>}
      </div>
    </div>
  );
}