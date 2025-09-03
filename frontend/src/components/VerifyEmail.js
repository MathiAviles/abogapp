// src/components/VerifyEmail.js
import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import "../Form.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5001";

export default function VerifyEmail() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState(sp.get("email") || "");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const parseMaybeJson = async (r) => {
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) return r.json();
    return { message: await r.text() };
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    try {
      const r = await fetch(`${API_BASE}/api/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await parseMaybeJson(r);

      if (r.ok) {
        // 🔒 No guardamos token ni user aquí.
        // Limpiamos cualquier sesión previa por si existía algo residual.
        const keepEmail = email;
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("role");
        // Conservamos el email para que el login pueda mostrarlo si lo necesitas.
        localStorage.setItem("email", keepEmail);

        // Mensaje único para todos (cliente/abogado). Los abogados serán
        // llevados al KYC después del login por la lógica de Login.js.
        setMsg("Email verificado. Ahora inicia sesión para continuar…");

        // Redirigir al login tras un breve delay
        setTimeout(() => navigate("/login", { replace: true }), 900);
      } else {
        setMsg(data?.message || "No se pudo verificar.");
      }
    } catch (err) {
      console.error(err);
      setMsg("Error de red.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/verify-email/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await parseMaybeJson(r);
      setMsg(data?.message || (r.ok ? "Código reenviado." : "No se pudo reenviar."));
    } catch (err) {
      console.error(err);
      setMsg("Error de red.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <form className="form-box" onSubmit={submit}>
        <h2>Verifica tu correo</h2>

        <div className="form-group">
          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label>Código</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            disabled={loading}
            inputMode="numeric"
            placeholder="000000"
          />
        </div>

        <button className="submit-btn" type="submit" disabled={loading}>
          {loading ? "Verificando…" : "Verificar"}
        </button>

        <div className="form-footer-text" style={{ marginTop: 12 }}>
          <a href="#!" onClick={resend}>Reenviar código</a>
        </div>

        {msg && <p style={{ textAlign: "center", marginTop: 12 }}>{msg}</p>}
      </form>
    </div>
  );
}