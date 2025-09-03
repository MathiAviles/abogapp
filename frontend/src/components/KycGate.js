// src/components/KycGate.js
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5001";

/**
 * Componente sin UI que ejecuta el chequeo KYC UNA sola vez por sesión.
 * - Solo se aplica a usuarios 'abogado'.
 * - Ignora rutas de KYC para no generar bucles.
 * - Marca sessionStorage con 'kycChecked' para no repetir.
 */
export default function KycGate() {
  const nav = useNavigate();
  const loc = useLocation();
  const ranRef = useRef(false);

  useEffect(() => {
    // si ya corrió esta sesión, no vuelvas a chequear
    if (ranRef.current) return;

    const token = localStorage.getItem("token");
    const role = (localStorage.getItem("role") || "").trim();

    // Solo abogados
    if (!token || role !== "abogado") return;

    // No chequear cuando YA estamos en rutas KYC
    const path = loc.pathname;
    const isKycRoute =
      path.startsWith("/abogado/kyc") || path.startsWith("/abogado/kyc/");

    // Si ya marcamos chequeo de esta sesión, no repetir
    if (sessionStorage.getItem("kycChecked") === "1") return;

    // Evitar bucles/duplicados por renders
    ranRef.current = true;

    // Hacer el check una única vez
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/kyc/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error("No se pudo consultar KYC");

        const data = await r.json();
        const st = (data?.kyc_status || "not_submitted").toLowerCase();

        if (st === "approved") {
          // Todo OK -> marca como revisado y no vuelvas a chequear
          sessionStorage.setItem("kycChecked", "1");
          return;
        }

        // Si NO está aprobado, redirige a la ruta KYC adecuada.
        // Aun así marcamos 'kycChecked' para que no siga bloqueando
        // el resto de la app con múltiples consultas.
        sessionStorage.setItem("kycChecked", "1");

        if (!isKycRoute) {
          if (st === "pending") {
            nav("/abogado/kyc/pending", { replace: true });
          } else if (st === "rejected" || st === "not_submitted") {
            nav("/abogado/kyc", { replace: true });
          }
        }
      } catch (e) {
        // En caso de error, para no bloquear la app, marcamos como chequeado
        // y dejamos navegar normal. (Podrías mostrar un toast si quieres)
        sessionStorage.setItem("kycChecked", "1");
        console.error("[KycGate] Error consultando KYC:", e);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname]);

  return null; // no renderiza nada
}