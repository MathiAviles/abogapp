// src/components/VideoProvider.js
import { useEffect, useRef } from 'react';
import { StreamVideoClient } from '@stream-io/video-react-sdk'; // o el paquete que uses

const API_KEY = process.env.REACT_APP_STREAM_API_KEY; // mismo que usas para chat/video
const tokenEndpoint = `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/stream-token`;

export default function VideoProvider({ children }) {
  const clientRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (clientRef.current) return; // ya existe

      // Consigue token de tu backend (ya tienes /api/stream-token)
      const t = localStorage.getItem('token');
      const r = await fetch(tokenEndpoint, { headers: { Authorization: `Bearer ${t}` } });
      const data = await r.json();

      // getOrCreate evita duplicados
      clientRef.current = StreamVideoClient.getOrCreateInstance({
        apiKey: data.apiKey,      // o API_KEY
        user: { id: data.user_id, name: data.name, image: data.image },
        token: data.token,        // o tokenProvider si lo usas así
      });
    };

    init();
    return () => { mounted = false; /* no destruyas si lo usas global */ };
  }, []);

  return children;
}
