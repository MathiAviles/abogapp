import React, { useState } from 'react';

export default function RatingModal({ open, onClose, meetingId, lawyerId, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const token = localStorage.getItem('token');
  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5001';

  if (!open) return null;

  const send = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ meeting_id: meetingId, lawyer_id: lawyerId, rating, comment })
      });
      if (!res.ok) {
        console.error('No se pudo enviar la reseña', await res.text());
      }
    } catch (e) {
      console.error(e);
    } finally {
      onSubmitted?.(); // navega a /reuniones
    }
  };

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex: 9999
    }}
      onClick={onClose}
    >
      <div onClick={e=>e.stopPropagation()} style={{
        background:'#111', color:'#fff', borderRadius:12, padding:24, width: 'min(520px, 92vw)',
        boxShadow:'0 10px 30px rgba(0,0,0,.5)'
      }}>
        <h3 style={{marginTop:0}}>¿Cómo estuvo tu asesoría?</h3>
        <p style={{marginTop:0, color:'#bbb'}}>Califica al abogado y deja un comentario</p>

        <div style={{ display:'flex', gap:8, fontSize:28, marginBottom:12 }}>
          {[1,2,3,4,5].map((i)=>(
            <button key={i}
              onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(0)}
              onClick={()=>setRating(i)}
              style={{ background:'transparent', border:'none', cursor:'pointer', padding:0, lineHeight:1 }}
              aria-label={`Estrella ${i}`}
            >
              <span style={{ color: (hover || rating) >= i ? '#FFC107' : '#444' }}>★</span>
            </button>
          ))}
        </div>

        <textarea
          value={comment} onChange={e=>setComment(e.target.value)}
          rows={4} placeholder="Escribe algo sobre la atención (opcional)"
          style={{ width:'100%', borderRadius:8, border:'1px solid #333', padding:12, background:'#0b0b0b', color:'#eee' }}
        />

        <div style={{ display:'flex', gap:12, marginTop:16, justifyContent:'flex-end' }}>
          <button onClick={onClose} className="btn-secondary">Ahora no</button>
          <button onClick={send} className="btn-primary" style={{ background:'#E85D99', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px' }}>
            Enviar reseña
          </button>
        </div>
      </div>
    </div>
  );
}