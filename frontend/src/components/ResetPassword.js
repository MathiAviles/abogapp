import React, { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import "../Form.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5001";

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState(sp.get("email") || "");
  const [code, setCode] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: pass }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg("Listo, contraseña cambiada. Redirigiendo al login…");
        setTimeout(() => navigate("/login"), 800);
      } else {
        setMsg(data?.message || "Error al restablecer la contraseña.");
      }
    } catch (err) {
      console.error(err);
      setMsg("Hubo un problema. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <form className="form-box" onSubmit={submit}>
        <h2>Restablecer contraseña</h2>

        <div className="form-group">
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            type="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="code">Código recibido</label>
          <input
            id="code"
            type="text"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            disabled={loading}
            inputMode="numeric"
          />
        </div>

        <div className="form-group">
          <label htmlFor="pass">Nueva contraseña</label>
          <input
            id="pass"
            type="password"
            placeholder="Tu nueva contraseña"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            required
            disabled={loading}
            autoComplete="new-password"
          />
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? "Guardando…" : "Cambiar contraseña"}
        </button>

        <div className="form-footer-text" style={{ marginTop: 12 }}>
          ¿No te llegó el código?{" "}
          <Link to={`/recuperar-password`}>Reenviar</Link>
        </div>

        {msg && <p style={{ textAlign: "center", marginTop: 12 }}>{msg}</p>}
      </form>
    </div>
  );
}
