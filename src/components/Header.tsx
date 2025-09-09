import { Link, useLocation } from 'react-router-dom'

export default function Header() {
  const loc = useLocation()
  const isAdmin = loc.pathname.startsWith('/admin')
  return (
    <header className="sticky">
      <div className="container" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0' }}>
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:12 }}>
          <img
            src="https://res.cloudinary.com/dbo4e8iuc/image/upload/v1757346176/Header_mr676f.png"
            alt="Kebabkhan Kurdistan"
            style={{ height: 100, width: 'auto', display: 'block', objectFit: 'contain' }}
          />
        </Link>
        {!isAdmin && (
          <nav style={{ display:'flex', gap:16 }}>
            <Link to="/menu" className={loc.pathname.startsWith('/menu') ? 'muted' : ''}>Meny</Link>
            <Link to="/catering" className={loc.pathname.startsWith('/catering') ? 'muted' : ''}>Catering</Link>
            <Link to="/om-oss" className={loc.pathname.startsWith('/om-oss') ? 'muted' : ''}>Om oss</Link>
          </nav>
        )}
      </div>
    </header>
  )
}
