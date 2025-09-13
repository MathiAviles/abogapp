import React from "react";
import LoadingOverlay from "./LoadingOverlay";
import PageProgress from "./PageProgress";

const LoaderCtx = React.createContext({ busy: false, setBusy: () => {} });
export const useLoader = () => React.useContext(LoaderCtx);

/**
 * Muestra el loader con:
 * - delay mínimo (150ms) para evitar parpadeos
 * - tiempo visible mínimo (200ms) para verse suave
 */
export default function LoaderProvider({ children }) {
  const [busy, setBusy] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    let t1, t2;
    if (busy) {
      t1 = setTimeout(() => setVisible(true), 150);
    } else {
      t2 = setTimeout(() => setVisible(false), 200);
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [busy]);

  return (
    <LoaderCtx.Provider value={{ busy, setBusy }}>
      <PageProgress busy={visible} />
      <LoadingOverlay show={visible} text="Cargando…" />
      {children}
    </LoaderCtx.Provider>
  );
}