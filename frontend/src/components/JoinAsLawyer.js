import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import "./JoinAsLawyer.css";

export default function JoinAsLawyer() {
  const navigate = useNavigate();

  return (
    <section className="jal-wrap">
      <motion.div
        className="jal-container"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true, margin: "-80px" }}
      >
        <div className="jal-left">
          <h2 className="jal-title">
            ¿Eres <span className="jal-accent">abogado</span>?
          </h2>
          <p className="jal-text">
            Únete a AbogApp y conecta con clientes que buscan tus servicios
            legales en línea. Maneja tu perfil, agenda tus citas y haz crecer tu
            práctica sin complicaciones.
          </p>
          <button
            className="jal-btn"
            onClick={() => navigate("/register")}
          >
            Registrarme como abogado
          </button>
        </div>

        <motion.div
          className="jal-right"
          initial={{ scale: 0.9, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <img
            src={`${process.env.PUBLIC_URL}/img/join-lawyer.webp`}
            alt="Ilustración de abogado uniéndose a AbogApp"
            loading="lazy"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}