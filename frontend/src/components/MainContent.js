import React from 'react';

/**
 * Componente MainContent (Sección Hero)
 * Muestra el título principal de la página con un fondo destacado.
 * Su único propósito es captar la atención del usuario.
 */
function MainContent() {
  return (
    // El contenedor principal de la sección. Los estilos en App.css le dan el fondo rosa.
    <main className="main-content">
      <h1>Encuentra abogados expertos para tus necesidades legales.</h1>
    </main>
  );
}

export default MainContent;
