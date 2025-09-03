import React, { useMemo, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import "./HomeHeroSlider.css";

const slidesData = [
  {
    name: "Brianna",
    badge: "Abogada de familia",
    quote:
      "“La energía y la claridad en cada consulta fueron increíbles. Sentí que por fin alguien entendía mi caso.”",
  },
  {
    name: "Mateo",
    badge: "Derecho laboral",
    quote:
      "“Me orientaron paso a paso. AbogApp me ahorró tiempo, plata y dolores de cabeza.”",
  },
  {
    name: "Valentina",
    badge: "Derecho migratorio",
    quote:
      "“Agendé en minutos y tuve una videollamada el mismo día. Servicio 10/10.”",
  },
];

export default function HomeHeroSlider() {
  const [i, setI] = useState(0);
  const controls = useAnimation();

  const slide = slidesData[i];
  const next = () => setI((p) => (p + 1) % slidesData.length);
  const prev = () => setI((p) => (p - 1 + slidesData.length) % slidesData.length);

  // Variants para “reveal on scroll”
  const container = useMemo(
    () => ({
      hidden: { opacity: 0, y: 40 },
      show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
    }),
    []
  );

  const stackItem = (delay = 0) => ({
    hidden: { opacity: 0, y: 20, rotate: -1 },
    show: {
      opacity: 1,
      y: 0,
      rotate: 0,
      transition: { duration: 0.5, delay },
    },
  });

  const quoteVariants = {
    key: {
      opacity: [0, 1],
      x: [-10, 0],
      transition: { duration: 0.35 },
    },
  };

  return (
    <section className="hs-wrap">
      <motion.div
        className="hs-container"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        animate={controls}
      >
        {/* Stack de tarjetas con “foto” + mazo SVG decorativo */}
        <div className="hs-left">
          <motion.div className="hs-stack">
            <motion.div className="hs-card hs-card--back2" variants={stackItem(0.05)} />
            <motion.div className="hs-card hs-card--back1" variants={stackItem(0.1)} />
            <motion.div
              key={i}
              className="hs-card hs-card--front"
              variants={stackItem(0.15)}
              animate="show"
              initial="hidden"
            >
              <div className="hs-gavel">
                {/* SVG mazo (sin dependencias) */}
                <svg viewBox="0 0 512 512" className="hs-gavel-svg" aria-hidden>
                  <path d="M169 94l60 60 40-40-60-60-40 40zm-27 27l-40 40 60 60 40-40-60-60zm114 26l-40 40 60 60 40-40-60-60zM64 256L0 320l64 64 64-64-64-64zm234 10l-28 28 178 178 28-28L298 266z" />
                </svg>
              </div>
              <div className="hs-photo" />
              <div className="hs-chipbar">
                <span className="hs-chip">{slide.name}</span>
                <span className="hs-chip hs-chip--pink">{slide.badge}</span>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Texto / testimonio */}
        <div className="hs-right">
          <motion.h2 className="hs-title" variants={stackItem(0.2)}>
            Encuentra a tu <span className="hs-title-accent">abogado ideal</span>.
          </motion.h2>

          <motion.p
            key={i + "-q"}
            className="hs-quote"
            variants={quoteVariants}
            animate="key"
          >
            {slide.quote}
          </motion.p>

          <motion.div className="hs-author" variants={stackItem(0.25)}>
            <div className="hs-dot hs-dot--active" />
            <div className={`hs-dot ${i === 1 ? "hs-dot--active" : ""}`} />
            <div className={`hs-dot ${i === 2 ? "hs-dot--active" : ""}`} />
          </motion.div>

          <motion.div className="hs-ctrls" variants={stackItem(0.3)}>
            <button className="hs-btn" onClick={prev} aria-label="Anterior">‹</button>
            <button className="hs-btn hs-btn--primary" onClick={next} aria-label="Siguiente">›</button>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}