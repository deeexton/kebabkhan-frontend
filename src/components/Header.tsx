import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function Header() {
  const loc = useLocation()
  const isAdmin = loc.pathname.startsWith('/admin')
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    // Close menu on route change
    setMenuOpen(false)
  }, [loc.pathname])
  return (
    <header className="sticky">
      <div className="container" style={{ padding:'12px 0' }}>
        {/* Desktop layout */}
        <div className="header-desktop" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Link to="/" style={{ display:'flex', alignItems:'center', gap:12 }}>
            <img
              src="https://res.cloudinary.com/dbo4e8iuc/image/upload/v1757346176/Header_mr676f.png"
              alt="Kebabkhan Kurdistan"
              style={{ height: 120, width: 'auto', display: 'block', objectFit: 'contain' }}
            />
          </Link>
          {!isAdmin && (
            <nav className="nav-desktop" style={{ display:'flex', gap:16 }}>
              <Link to="/" className={loc.pathname === '/' ? 'muted' : ''}>Hem</Link>
              <Link to="/meny" className={loc.pathname.startsWith('/meny') ? 'muted' : ''}>Meny</Link>
              <Link to="/catering" className={loc.pathname.startsWith('/catering') ? 'muted' : ''}>Catering</Link>
              <Link to="/kontrollera-bestallning" className={loc.pathname.startsWith('/kontrollera-bestallning') || loc.pathname.startsWith('/order/') ? 'muted' : ''}>Kontrollera beställning</Link>
              <Link to="/om-oss" className={loc.pathname.startsWith('/om-oss') ? 'muted' : ''}>Om oss</Link>
              <Link to="/kontakt" className={loc.pathname.startsWith('/kontakt') ? 'muted' : ''}>Kontakt</Link>
            </nav>
          )}
          {/* Mobile hamburger */}
          {!isAdmin && (
            <button type="button" aria-label={menuOpen ? 'Stäng meny' : 'Öppna meny'} onClick={()=>setMenuOpen(v=>!v)} className="hamburger" style={{ display:'none', background:'transparent', border:0, padding:8, marginLeft:12 }}>
              {menuOpen ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 6l12 12M18 6L6 18" stroke="#eaeaea" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6h16M4 12h16M4 18h16" stroke="#eaeaea" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Mobile overlay menu */}
        {!isAdmin && (
          <div className="mobile-menu" style={{ display: menuOpen ? 'grid' : 'none', gap:12, paddingTop:12 }}>
            <nav style={{ display:'grid', gap:12, textAlign:'center' }}>
              <Link to="/" className={loc.pathname === '/' ? 'muted' : ''}>Hem</Link>
              <Link to="/meny" className={loc.pathname.startsWith('/meny') ? 'muted' : ''}>Meny</Link>
              <Link to="/catering" className={loc.pathname.startsWith('/catering') ? 'muted' : ''}>Catering</Link>
              <Link to="/kontrollera-bestallning" className={loc.pathname.startsWith('/kontrollera-bestallning') || loc.pathname.startsWith('/order/') ? 'muted' : ''}>Kontrollera beställning</Link>
              <Link to="/om-oss" className={loc.pathname.startsWith('/om-oss') ? 'muted' : ''}>Om oss</Link>
              <Link to="/kontakt" className={loc.pathname.startsWith('/kontakt') ? 'muted' : ''}>Kontakt</Link>
            </nav>
          </div>
        )}

        {/* Mobile centered logo row */}
        <div className="header-mobile-center" style={{ display:'none', alignItems:'center', justifyContent:'center' }}>
          <Link to="/" style={{ display:'inline-flex' }}>
            <img
              src="https://res.cloudinary.com/dbo4e8iuc/image/upload/v1757346176/Header_mr676f.png"
              alt="Kebabkhan Kurdistan"
              style={{ height: 80, width: 'auto', display: 'block', objectFit: 'contain' }}
            />
          </Link>
        </div>
      </div>

      {/* Responsive styles inline to avoid external CSS edits */}
      <style>{`
        @media (max-width: 900px) {
          .header-desktop { display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; }
          .nav-desktop { display:none !important; }
          .hamburger { display:inline-flex !important; justify-self:end; }
          .header-desktop > a { display:none !important; }
          .header-mobile-center { display:flex !important; }
        }
      `}</style>
    </header>
  )
}
