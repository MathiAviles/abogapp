import React from "react";
import "./LoadingOverlay.css";

export default function PageProgress({ busy }) {
  return <div className={`page-progress ${busy ? "busy" : ""}`} />;
}