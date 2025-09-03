import React from "react";
import "./HeartButton.css"; // Este archivo CSS no necesita cambios

/**
 * Botón de favorito con un ícono de corazón más redondeado y moderno.
 */
export default function HeartButton({
  active,
  onClick,
  size = 24,
  title = "Añadir a favoritos",
  className = "",
}) {
  const handleClick = (e) => {
    e.stopPropagation();
    onClick?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      aria-label={title}
      aria-pressed={!!active}
      className={`heart-btn ${active ? "is-active" : ""} ${className}`}
      style={{ "--hb-size": `${size}px` }}
    >
      <div className="heart-icon-wrapper">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="heart-blast" cx="12" cy="12" r="10" />
          <g className="heart-particles">
            {Array.from({ length: 7 }).map((_, i) => {
              const angle = (360 / 7) * i;
              const r = 4;
              const cx = 12 + r * Math.cos((angle * Math.PI) / 180);
              const cy = 12 + r * Math.sin((angle * Math.PI) / 180);
              return <circle key={i} cx={cx} cy={cy} r="1.5" />;
            })}
          </g>

          {/* 👇 ESTA ES LA ÚNICA LÍNEA QUE CAMBIA 👇 */}
          <path
            className="heart-fill"
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          />
        </svg>
      </div>
    </button>
  );
}