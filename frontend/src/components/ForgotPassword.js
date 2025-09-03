import React, { useState } from "react";
import { Link } from "react-router-dom";
import "../Form.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5001";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      await r.json().catch(() => ({}));
      setMsg("Si el email existe, te enviamos un código.");
    } catch (err) {
      setMsg("Hubo un problema. Inténtalo de nuevo.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <form className="form-box" onSubmit={submit}>
        <h2>Recuperar contraseña</h2>

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

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? "Enviando…" : "Enviar código"}
        </button>

        <div className="form-footer-text" style={{ marginTop: 12 }}>
          ¿Ya tienes el código?{" "}
          <Link to={`/restablecer-password?email=${encodeURIComponent(email)}`}>
            Restablecer ahora
          </Link>
        </div>

        {msg && <p style={{ textAlign: "center", marginTop: 12 }}>{msg}</p>}
      </form>
    </div>
  );
}
