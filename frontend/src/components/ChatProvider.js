import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { StreamChat } from "stream-chat";
import { jwtDecode } from "jwt-decode";

export const ChatCtx = createContext(null);
export const useChat = () => useContext(ChatCtx);

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5001";

// ==========================
//  Singleton global seguro
// ==========================
const GLOBAL = "__abogapp_stream__";
if (!window[GLOBAL]) {
  window[GLOBAL] = {
    client: null,
    userId: null,
    connecting: false,
    apiKey: null,
  };
}

function getUserIdFromToken(jwtToken) {
  try {
    const d = jwtDecode(jwtToken);
    return String(d.sub || d.id || d.user_id);
  } catch {
    return null;
  }
}

function waitUntil(checkFn, { timeoutMs = 10000, intervalMs = 100 } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const id = setInterval(() => {
      if (checkFn()) {
        clearInterval(id);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(id);
        reject(new Error("Timeout esperando al cliente de chat"));
      }
    }, intervalMs);
  });
}

async function ensureStreamUser(userId) {
  const jwtToken = localStorage.getItem("token");
  if (!jwtToken || !userId) return null;

  // Intenta leer la cookie CSRF (si existiera)
  const m = document.cookie.match(/(?:^|;\s*)csrf_access_token=([^;]+)/);
  const csrf = m ? decodeURIComponent(m[1]) : null;

  const headers = {
    Authorization: `Bearer ${jwtToken}`,
    ...(csrf ? { "X-CSRF-TOKEN": csrf } : {}),
  };

  const doCall = (method) =>
    fetch(`${API_BASE}/api/chat/users/ensure/${userId}`, {
      method,
      credentials: "include",
      headers,
    });

  // 1) POST (si el server aún pide CSRF lo verá en el header)
  let res = await doCall("POST");

  // 2) Fallback a GET si el server devuelve 401/403 por política
  if (res.status === 401 || res.status === 403) {
    res = await doCall("GET");
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.warn(`[Chat] ensureStreamUser fallo ${res.status}:`, txt);
    throw new Error(
      `No se pudo asegurar el usuario de chat (${res.status}). ${txt}`
    );
  }
  return res.json(); // { ensured: true, user: { id, name, image? } }
}

export default function ChatProvider({ children }) {
  const [client, setClient] = useState(window[GLOBAL].client || null);
  const [ready, setReady] = useState(!!window[GLOBAL].client);

  const [archivedSet, setArchivedSet] = useState(new Set());

  // ==========================
  //  Archive helpers (local+BE)
  // ==========================
  const saveLocalArchived = (uid, setLike) => {
    try {
      localStorage.setItem(
        `abogapp:archived:${uid}`,
        JSON.stringify([...setLike])
      );
    } catch {}
  };
  const loadLocalArchived = (uid) => {
    try {
      const raw = localStorage.getItem(`abogapp:archived:${uid}`);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  };

  const fetchArchivedFromBackend = useCallback(async (uid) => {
    const jwtToken = localStorage.getItem("token");
    if (!jwtToken || !uid) return loadLocalArchived(uid);
    try {
      const res = await fetch(`${API_BASE}/api/chat/archived`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      if (!res.ok) throw new Error("archived not ok");
      const data = await res.json();
      const setLike = new Set((data?.cids || []).map(String));
      saveLocalArchived(uid, setLike);
      return setLike;
    } catch {
      return loadLocalArchived(uid);
    }
  }, []);

  // =========================================
  //  Desconexión fuerte (cambia de usuario)
  // =========================================
  const hardDisconnect = async () => {
    try {
      const g = window[GLOBAL];
      if (g?.client) {
        // Limpia storage offline para que no “herede” canales
        await g.client.disconnectUser({ flushOfflineStorage: true });
      }
    } catch (e) {
      console.warn("[Chat] error al desconectar:", e);
    } finally {
      window[GLOBAL] = {
        client: null,
        userId: null,
        connecting: false,
        apiKey: window[GLOBAL]?.apiKey || null,
      };
      setClient(null);
      setReady(false);
      setArchivedSet(new Set());
    }
  };

  // Alias público
  const disconnect = hardDisconnect;

  // =====================================================================
  //  Conectar asegurando que NO se reutilice el cliente de otro usuario
  // =====================================================================
  const connectIfNeeded = useCallback(async () => {
    const jwtToken = localStorage.getItem("token");
    if (!jwtToken) throw new Error("No autenticado");

    const nextUserId = getUserIdFromToken(jwtToken);
    if (!nextUserId) throw new Error("Token inválido");

    const g = window[GLOBAL];

    // Si ya estoy conectado como el mismo usuario, listo.
    if (g.client && g.client.userID === nextUserId) {
      return g.client;
    }

    // Si hay un cliente conectado a OTRO usuario → desconectar primero
    if (g.client && g.client.userID && g.client.userID !== nextUserId) {
      await hardDisconnect();
    }

    // Si alguien ya está conectando, espera a que termine
    if (window[GLOBAL].connecting) {
      await waitUntil(() => !!(window[GLOBAL]?.client?.userID));
      return window[GLOBAL].client;
    }

    window[GLOBAL].connecting = true;
    try {
      // Pido token y apiKey al backend (nuevo endpoint o fallback)
      let res = await fetch(`${API_BASE}/api/chat/token`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) {
        // fallback legacy
        res = await fetch(`${API_BASE}/api/stream-token`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (!res.ok) throw new Error(`GET token -> ${res.status}`);
      }
      const data = await res.json();
      const apiKey = data.apiKey || process.env.REACT_APP_STREAM_API_KEY;
      if (!apiKey) throw new Error("No API key disponible");

      // ¡OJO! getInstance(apiKey) devuelve SIEMPRE el mismo cliente por apiKey.
      // Por eso, hay que asegurar que está desconectado antes de reusar.
      const sc = StreamChat.getInstance(apiKey, { enableWSFallback: true });
      if (sc.userID && sc.userID !== String(nextUserId)) {
        // Desconecto cualquier sesión previa en ese singleton
        await sc.disconnectUser({ flushOfflineStorage: true });
      }

      // Asegura que mi propio usuario exista/esté actualizado (name/image)
      await ensureStreamUser(nextUserId).catch(() => {});

      const name =
        data.user?.name ||
        localStorage.getItem("email") ||
        `user_${nextUserId}`;
      const image = data.user?.image;

      await sc.connectUser({ id: String(nextUserId), name, image }, data.token);

      window[GLOBAL] = {
        client: sc,
        userId: String(nextUserId),
        connecting: false,
        apiKey,
      };
      setClient(sc);
      setReady(true);

      const setLike = await fetchArchivedFromBackend(String(nextUserId));
      setArchivedSet(setLike);

      return sc;
    } finally {
      window[GLOBAL].connecting = false;
    }
  }, [fetchArchivedFromBackend]);

  // Conectar en montaje y reaccionar a cambios de token (login/logout)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await connectIfNeeded();
      } catch {
        if (mounted) setReady(false);
      }
    })();

    const onStorage = async (ev) => {
      if (ev.key === "token") {
        // Si cambia el token, aseguro desconexión antes de reconectar
        await hardDisconnect();
        try {
          await connectIfNeeded();
        } catch (e) {
          console.warn("[Chat] reconexión tras cambio de token falló:", e);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      mounted = false;
      window.removeEventListener("storage", onStorage);
    };
  }, [connectIfNeeded]);

  // ==========================
  //  Helpers de estado
  // ==========================
  const isArchived = (cid) => archivedSet.has(String(cid));
  const isUnread = (ch) => {
    try {
      return (ch?.countUnread?.() || 0) > 0;
    } catch {
      return false;
    }
  };
  const unreadCount = (ch) => {
    try {
      return ch?.countUnread?.() || 0;
    } catch {
      return 0;
    }
  };

  const toggleArchive = async (cid) => {
    const uid = window[GLOBAL]?.userId || client?.userID;
    if (!uid) return;
    const target = String(cid);
    const willArchive = !archivedSet.has(target);

    setArchivedSet((prev) => {
      const next = new Set(prev);
      if (willArchive) next.add(target);
      else next.delete(target);
      saveLocalArchived(uid, next);
      return next;
    });

    const jwtToken = localStorage.getItem("token");
    try {
      await fetch(`${API_BASE}/api/chat/archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({ cid: target, archived: willArchive }),
      });
    } catch (e) {
      console.warn("[Chat] fallo al persistir archive, se mantiene local:", e);
    }
  };

  const filterChannels = (chs, tab) => {
    if (!Array.isArray(chs)) return [];
    switch (tab) {
      case "ARCHIVED":
        return chs.filter((c) => isArchived(c.cid));
      case "UNREAD":
        return chs.filter((c) => !isArchived(c.cid) && isUnread(c));
      case "ALL":
      default:
        return chs.filter((c) => !isArchived(c.cid));
    }
  };

  // ===========================================================
  //  Abrir DM por id de BD (asegura perfil del otro usuario)
  // ===========================================================
  const openDirectMessage = useCallback(
    async (otherDbIdOrObj) => {
      const sc = await connectIfNeeded();
      const me = sc.userID;
      if (!me) throw new Error("Usuario de chat no conectado");

      const otherDbId =
        typeof otherDbIdOrObj === "object"
          ? otherDbIdOrObj.id ||
            otherDbIdOrObj.userId ||
            otherDbIdOrObj.userDbId
          : otherDbIdOrObj;
      if (!otherDbId) throw new Error("Falta el ID del otro usuario (BD)");

      // 1) Asegura y obtiene datos del otro user (incluye image)
      let otherUser = null;
      try {
        const { user } = await ensureStreamUser(otherDbId);
        otherUser = user || null;
      } catch (e) {
        console.warn("[Chat] ensure user falló:", e);
      }

      // 2) Crea/abre el canal entre ambos
      const channel = sc.channel(
        "messaging",
        { members: [String(me), String(otherDbId)] },
        {
          // data inicial (si ya existía el canal, luego hacemos updatePartial)
          image: otherUser?.image || undefined,
          name: otherUser?.name || undefined,
        }
      );

      await channel.watch();

      // Si el canal ya existía y no tomó la data inicial, forzamos un update
      if (otherUser?.image || otherUser?.name) {
        try {
          await channel.updatePartial({
            set: {
              ...(otherUser?.image ? { image: otherUser.image } : {}),
              ...(otherUser?.name ? { name: otherUser.name } : {}),
            },
          });
        } catch (e) {
          console.warn("[Chat] updatePartial ignorado:", e?.message || e);
        }
      }

      return channel.cid;
    },
    [connectIfNeeded]
  );

  // =========================================================================
  //  Abrir por CID solo si el canal pertenece al usuario logueado (anti-leak)
  // =========================================================================
  const openByCidIfMine = useCallback(
    async (cid) => {
      const sc = await connectIfNeeded();
      const q = await sc.queryChannels(
        { cid: { $eq: String(cid) }, members: { $in: [sc.userID] } },
        { last_message_at: -1 },
        { limit: 1 }
      );
      if (!q.length) {
        throw new Error("Ese canal no pertenece al usuario actual");
      }
      await q[0].watch();
      return q[0].cid;
    },
    [connectIfNeeded]
  );

  // Auto DM si alguien dejó un objetivo en sessionStorage
  useEffect(() => {
    if (!ready) return;
    const raw = sessionStorage.getItem("dm_target");
    if (!raw) return;
    sessionStorage.removeItem("dm_target");
    try {
      const target = JSON.parse(raw);
      const userDbId = target?.userDbId || target?.id || target?.userId;
      if (!userDbId) return;
      openDirectMessage({ id: userDbId }).catch((e) =>
        console.warn("[Chat] auto DM failed:", e)
      );
    } catch {}
  }, [ready, openDirectMessage]);

  const value = useMemo(
    () => ({
      ready,
      client,
      // público
      disconnect,
      openDirectMessage,
      openByCidIfMine, // <- úsalo en la página de mensajes cuando leas ?cid=...
      isArchived,
      isUnread,
      unreadCount,
      toggleArchive,
      filterChannels,
    }),
    [ready, client, openDirectMessage, openByCidIfMine, archivedSet]
  );

  return <ChatCtx.Provider value={value}>{children}</ChatCtx.Provider>;
}
