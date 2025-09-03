// frontend/src/components/LawyerKYC.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Form.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5001";

export default function LawyerKYC() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [status, setStatus] = useState("not_submitted");
  const [docFront, setDocFront] = useState(null);
  const [docBack, setDocBack] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [frontUrl, setFrontUrl] = useState("");
  const [backUrl, setBackUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/kyc/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) throw new Error("No se pudo cargar el estado KYC");
      const data = await r.json();
      setStatus(data.kyc_status || "not_submitted");
      setFrontUrl(data.kyc_doc_front_url || "");
      setBackUrl(data.kyc_doc_back_url || "");
      setSelfieUrl(data.kyc_selfie_url || "");

      // Si ya está aprobado, manda al inicio
      if (data.kyc_status === "approved") navigate("/inicio");
      // Si está pendiente, manda a pantalla de pendiente
      if (data.kyc_status === "pending") navigate("/abogado/kyc/pending");
    } catch (e) {
      console.error(e);
      setMsg("No se pudo cargar tu estado KYC.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); /* eslint-disable-next-line */ }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const fd = new FormData();
      if (docFront) fd.append("doc_front", docFront);
      if (docBack)  fd.append("doc_back", docBack);
      if (selfie)   fd.append("selfie", selfie);

      const r = await fetch(`${API_BASE}/api/kyc/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(data?.error || data?.message || "No se pudo enviar KYC.");
      } else {
        // Ir a pantalla de pendiente
        navigate("/abogado/kyc/pending");
      }
    } catch (err) {
      console.error(err);
      setMsg("Error de red.");
    } finally {
      setLoading(false);
    }
  };

  const renderBadge = (s) => {
    const map = { approved: "✅ Aprobado", pending: "🟡 Pendiente", rejected: "❌ Rechazado", not_submitted: "⏺ Sin enviar" };
    return map[s] || s;
  };

  const disabled = status === "approved" || loading;

  return (
    <div className="form-container">
      <form className="form-box" onSubmit={submit}>
        <h2>Verificación KYC (Abogado)</h2>
        <p style={{ textAlign: "center", color: "#555", marginBottom: 10 }}>
          Tus archivos están seguros y se borrarán inmediatamente después de ser verificados.
        </p>
        <p style={{ textAlign: "center" }}>
          Estado actual: <strong>{renderBadge(status)}</strong>
        </p>

        {status === "rejected" && (
          <p style={{ textAlign: "center", color: "#b00020" }}>
            Tu KYC fue rechazado. Sube nuevamente la información correcta.
          </p>
        )}


        <div className="form-group">
          <label>Documento (anverso)</label>
          <input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf"
                 onChange={(e) => setDocFront(e.target.files?.[0] || null)}
                 disabled={disabled}/>
          {frontUrl && <small>Subido: <a href={frontUrl} target="_blank" rel="noreferrer">{frontUrl}</a></small>}
        </div>

        <div className="form-group">
          <label>Documento (reverso)</label>
          <input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf"
                 onChange={(e) => setDocBack(e.target.files?.[0] || null)}
                 disabled={disabled}/>
          {backUrl && <small>Subido: <a href={backUrl} target="_blank" rel="noreferrer">{backUrl}</a></small>}
        </div>

        <div className="form-group">
          <label>Selfie con documento</label>
          <input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf"
                 onChange={(e) => setSelfie(e.target.files?.[0] || null)}
                 disabled={disabled}/>
          {selfieUrl && <small>Subido: <a href={selfieUrl} target="_blank" rel="noreferrer">{selfieUrl}</a></small>}
        </div>

        <button type="submit" className="submit-btn" disabled={disabled}>
          {loading ? "Enviando…" : (status === "approved" ? "KYC aprobado" : "Enviar KYC")}
        </button>

        {msg && <p style={{ textAlign: "center", marginTop: 12 }}>{msg}</p>}
      </form>
    </div>
  );
}