import React, { createContext, useState, useEffect } from "react";

export const AuthContext = createContext({
  userEmail: null,
  setUserEmail: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }) => {
  const [userEmail, setUserEmail] = useState(null);

  useEffect(() => {
    const email = localStorage.getItem("email");
    if (email) setUserEmail(email);
  }, []);

  const logout = () => {
    try {
      // Limpia todo rastro de la sesión
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("email");
      sessionStorage.removeItem("kycChecked"); // importante para que el gate no bloquee
    } finally {
      // Redirige siempre al login
      window.location.replace("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ userEmail, setUserEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};