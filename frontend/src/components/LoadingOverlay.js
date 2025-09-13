import React from "react";
import "./LoadingOverlay.css";

export default function LoadingOverlay({ show, text = "Cargando…" }) {
  if (!show) return null;
  return (
    <div className="loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-spinner" />
      <span className="loading-text">{text}</span>
    </div>
  );
}