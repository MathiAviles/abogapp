import React from 'react';
import MainContent from './MainContent'; // 1. Importa la sección del título
import Specialties from './Specialties'; // 2. Importa la sección de especialidades

/**
 * Componente Inicio
 * Esta es la página principal para un usuario que ya ha iniciado sesión.
 * Muestra el mismo contenido que la página de bienvenida.
 */
function Inicio() {
  return (
    <>
      <MainContent />
      <Specialties />
    </>
  );
}

export default Inicio;