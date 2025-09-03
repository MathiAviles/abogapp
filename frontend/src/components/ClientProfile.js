import React, { useEffect, useState } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5001";

export default function ClientProfile() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const token = localStorage.getItem("token");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setMe(data);
      } catch (e) {
        console.error("[ClientProfile] load", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("profile_picture", file);
    setUploading(true);
    try {
      const res = await fetch(`${API_BASE}/api/user/profile-picture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setMe((m) => ({ ...m, profile_picture_url: data.filename }));
      } else {
        alert(data.error || "No se pudo subir la imagen");
      }
    } catch (err) {
      console.error("[ClientProfile] upload", err);
      alert("Error subiendo la imagen");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="loading-container">Cargando…</div>;
  if (!me) return <div className="loading-container">No se pudo cargar tu perfil.</div>;

  const imageUrl = me.profile_picture_url
    ? `${API_BASE}/uploads/${me.profile_picture_url}`
    : "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

  return (
    <div className="profile-container" style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="profile-card" style={{ padding: 24, background: "#fff", borderRadius: 12, boxShadow: "0 6px 20px rgba(0,0,0,.08)" }}>
        <h1 style={{ marginTop: 0 }}>Mi Perfil</h1>

        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <img
            src={imageUrl}
            alt="Mi foto de perfil"
            style={{ width: 120, height: 120, borderRadius: "50%", objectFit: "cover", border: "3px solid #eee" }}
          />
          <div>
            <p style={{ margin: "4px 0", fontSize: 18 }}><strong>{me.nombres} {me.apellidos}</strong></p>
            <p style={{ margin: "4px 0", color: "#666" }}>{me.email}</p>

            <label
              style={{
                display: "inline-block",
                marginTop: 12,
                background: "#f06292", /* mismo tono rosado del header si usas la variable, cámbialo a tu var --pink */
                color: "#fff",
                padding: "10px 16px",
                borderRadius: 8,
                cursor: "pointer",
                opacity: uploading ? 0.7 : 1,
              }}
            >
              {uploading ? "Subiendo..." : "Cambiar foto de perfil"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFile}
                style={{ display: "none" }}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        <p style={{ marginTop: 16, color: "#888" }}>
          Como cliente, sólo puedes cambiar tu foto de perfil.
        </p>
      </div>
    </div>
  );
}
