import React from "react";
import { motion } from "framer-motion";
import "./HowItWorks.css";

const steps = [
  {
    n: 1,
    title: "Encuentra a tu abogado.",
    body:
      "Te conectamos con un abogado que se ajuste a tu caso, te oriente y te dé claridad desde la primera consulta.",
    img: "/img/how-1.webp",
    alt: "Búsqueda de abogado en AbogApp",
  },
  {
    n: 2,
    title: "Empieza a aprender tu caso.",
    body:
      "En la primera videollamada revisan antecedentes, plan de acción y próximos pasos con tiempos y costos.",
    img: "/img/how-2.webp",
    alt: "Videollamada de asesoría legal",
  },
  {
    n: 3,
    title: "Habla. Firma. Repite.",
    body:
      "Elige cuántas sesiones necesitas cada semana y avanza hasta resolver tu objetivo legal.",
    img: "/img/how-3.webp",
    alt: "Firma y seguimiento del caso",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

const card = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

export default function HowItWorks() {
  return (
    <section className="hiw-wrap">
      <motion.div
        className="hiw-container"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
      >
        <header className="hiw-header">
          <h2 className="hiw-title">
            ¿Cómo funciona <span className="hiw-accent">AbogApp</span>?
          </h2>
          <p className="hiw-sub">Rápido, claro y 100% en línea.</p>
        </header>

        <div className="hiw-grid">
          {steps.map((s) => (
            <motion.article key={s.n} className="hiw-card" variants={card}>
              <div className="hiw-badge">{s.n}</div>
              <h3 className="hiw-card-title">{s.title}</h3>
              <p className="hiw-card-body">{s.body}</p>

              {/* Imagen del paso */}
              <div className="hiw-media">
                <img
                  src={s.img}
                  alt={s.alt}
                  loading="lazy"
                  width="1280"
                  height="720"
                />
              </div>
            </motion.article>
          ))}
        </div>
      </motion.div>
    </section>
  );
}