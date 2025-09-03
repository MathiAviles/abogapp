import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import MessagesPopover from './MessagesPopover';
import { useChat } from "./ChatProvider";

function Header() {
  const { userEmail, setUserEmail } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [showMessages, setShowMessages] = useState(false);

  // Móvil SÓLO para UI del drawer; no tocamos desktop.
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
      else mql.removeListener(handler);
    };
  }, []);

  const [drawerOpen, setDrawerOpen] = useState(false);

  const chat = useChat();
  const disconnect = chat?.disconnect;

  const isOnChat = location.pathname.startsWith('/chat');
  const userRole = localStorage.getItem('role');
  const profilePath = userRole === 'abogado' ? '/abogado/perfil' : '/cliente/perfil';

  const handleLogout = async () => {
    try { await disconnect?.(); } catch(e){ console.debug('logout ignore', e); }
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    localStorage.removeItem('role');
    sessionStorage.removeItem('kycChecked');
    setUserEmail(null);
    window.location.replace('/');
  };

  const handleMessagesLinkClick = (e) => {
    e.preventDefault();               // mantiene el comportamiento de popover en desktop
    if (isOnChat) { setShowMessages(false); return; }
    setShowMessages(v => !v);
  };

  useEffect(() => { if (isOnChat && showMessages) setShowMessages(false); }, [isOnChat, showMessages]);
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Bloquea scroll del body SOLO cuando el drawer móvil está abierto
  useEffect(() => {
    if (!isMobile) return;
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen, isMobile]);

  // ===== Estilos inline del drawer (no tocan desktop) =====
  const burgerBtnStyle = {
    display: isMobile ? 'inline-flex' : 'none',
    width: 42, height: 42, borderRadius: 12, padding: 0,
    background: 'transparent', border: 'none', cursor: 'pointer',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8
  };

  const overlayStyle = {
    position:'fixed', inset:0, background:'rgba(0,0,0,.35)', zIndex:9998,
    opacity: drawerOpen ? 1 : 0,
    pointerEvents: drawerOpen ? 'auto' : 'none',
    transition: 'opacity .2s ease',
    display: isMobile ? 'block' : 'none'
  };

  const drawerStyle = {
    position:'fixed', top:0, right:0, height:'100dvh',
    width:'86vw', maxWidth:360, background:'#fff',
    boxShadow:'-8px 0 24px rgba(0,0,0,.18)', zIndex:9999,
    transform: drawerOpen ? 'translateX(0)' : 'translateX(110%)',
    transition:'transform .25s ease',
    padding:'16px', display: isMobile ? 'flex' : 'none', flexDirection:'column',
    visibility: drawerOpen ? 'visible' : 'hidden',
    pointerEvents: drawerOpen ? 'auto' : 'none'
  };
  const drawerHead = { display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:12, borderBottom:'1px solid #e9e9ee', marginBottom:8 };
  const navItem = { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 6px', borderBottom:'1px solid #e9e9ee', fontSize:16 };
  const logoutBtn = { marginTop:12, padding:'12px 14px', borderRadius:12, border:'1px solid #e5e5e5', background:'#fff', fontWeight:700, cursor:'pointer' };
  // ========================================================

  // HREF para abrir chat desde el menú móvil (usa el último canal si existe)
  const getChatHref = () => {
    const cid = sessionStorage.getItem('lastChatCid') || localStorage.getItem('lastChatCid');
    return cid ? `/chat?cid=${encodeURIComponent(cid)}` : '/chat';
  };

  return (
    <>
      {/* ===== TU HEADER ORIGINAL (no se toca el desktop) ===== */}
      <header className="header">
        <div className="header-left-section">
          <Link to="/" className="logo">
            <img src="/Logo AbogApp Blanco Terminado PNG.png" alt="AbogApp Logo" className="logo-img" />
          </Link>

          {userEmail && !isMobile && (
            <nav className="header-nav">
              <Link to={profilePath}>Mi Perfil</Link>
              <Link to="/reuniones">Reuniones</Link>
              {/* En desktop mantenemos popover; evitamos ruta inexistente */}
              <Link to="/chat" onClick={handleMessagesLinkClick}>Mensajes</Link>
              <Link to="/favoritos">Favoritos</Link>
            </nav>
          )}
        </div>

        {!isMobile && (
          <div className="header-right">
            {userEmail ? (
              <>
                <span className="user-email">{userEmail}</span>
                <button onClick={handleLogout} className="header-btn btn-logout">Cerrar sesión</button>
              </>
            ) : (
              <>
                <Link to="/login"><button className="header-btn btn-secondary">Iniciar sesión</button></Link>
                <Link to="/register"><button className="header-btn btn-primary">Registrarse</button></Link>
              </>
            )}
          </div>
        )}

        {/* Botón hamburguesa SOLO móvil — usa /public/menu_110986.png */}
        <button
          style={burgerBtnStyle}
          aria-label="Abrir menú"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(v => !v)}
        >
          <img
            src={`${process.env.PUBLIC_URL || ''}/menu_110986.png`}
            alt="Menú"
            style={{ width: 24, height: 24, display: 'block' }}
          />
        </button>
      </header>

      {/* Drawer + overlay móvil */}
      <div style={overlayStyle} onClick={() => setDrawerOpen(false)} />
      <aside style={drawerStyle} aria-hidden={!drawerOpen}>
        <div style={drawerHead}>
          {userEmail ? (
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background:'#E85D99', color:'#fff', display:'grid', placeItems:'center', fontWeight:800 }}>
                {(userEmail || 'U')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight:700 }}>{userEmail}</div>
                <div style={{ fontSize:12, color:'#666' }}>Cuenta</div>
              </div>
            </div>
          ) : (
            // Botones alineados y sin cruzarse con la “X”
            <div style={{ display:'flex', gap:8, alignItems:'center', maxWidth:'calc(100% - 44px)', flexWrap:'nowrap' }}>
              <Link
                to="/login"
                onClick={() => setDrawerOpen(false)}
                style={{
                  fontWeight:700, color:'#E85D99', border:'1px solid #E85D99',
                  padding:'8px 12px', borderRadius:10, background:'#fff',
                  textDecoration:'none', display:'inline-block'
                }}
              >
                Iniciar sesión
              </Link>
              <Link
                to="/register"
                onClick={() => setDrawerOpen(false)}
                style={{
                  fontWeight:700, color:'#fff', background:'#E85D99',
                  padding:'8px 12px', borderRadius:10,
                  textDecoration:'none', display:'inline-block'
                }}
              >
                Registrarse
              </Link>
            </div>
          )}

          <button onClick={() => setDrawerOpen(false)} aria-label="Cerrar" style={{ fontSize:28, lineHeight:1, background:'transparent', border:'none', cursor:'pointer' }}>×</button>
        </div>

        <nav style={{ display:'flex', flexDirection:'column' }}>
          <Link to="/" onClick={() => setDrawerOpen(false)} style={navItem}><span>Inicio</span><Chevron/></Link>
          <Link to={profilePath} onClick={() => setDrawerOpen(false)} style={navItem}><span>Mi Perfil</span><Chevron/></Link>
          <Link to="/reuniones" onClick={() => setDrawerOpen(false)} style={navItem}><span>Reuniones</span><Chevron/></Link>

          {/* ✅ FIX: ir a /chat o /chat?cid=... */}
          <Link to={getChatHref()} onClick={() => setDrawerOpen(false)} style={navItem}>
            <span>Mensajes</span><Chevron/>
          </Link>

          <Link to="/favoritos" onClick={() => setDrawerOpen(false)} style={navItem}><span>Favoritos</span><Chevron/></Link>
          <Link to="/especialidades" onClick={() => setDrawerOpen(false)} style={navItem}><span>Encontrar abogados</span><Chevron/></Link>
        </nav>

        {userEmail && <button style={logoutBtn} onClick={handleLogout}>Cerrar sesión</button>}
      </aside>

      {/* Popover solo fuera de /chat */}
      {userEmail && showMessages && !isOnChat && (
        <MessagesPopover onClose={() => setShowMessages(false)} />
      )}
    </>
  );
}

function Chevron() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default Header;