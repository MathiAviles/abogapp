import React from 'react';
import MainContent from './MainContent';
import Specialties from './Specialties';
import HomeHeroSlider from './HomeHeroSlider';
import HowItWorks from './HowItWorks';
import JoinAsLawyer from './JoinAsLawyer';

function Inicio() {
  return (
    <>
      {/* Solo usamos tu contenido original */}
      <MainContent />
      <Specialties />
      <HomeHeroSlider />
      <HowItWorks />
      <JoinAsLawyer />
    </>
  );
}

export default Inicio;