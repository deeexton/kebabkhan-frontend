export default function Footer() {
  return (
    <footer style={{ borderTop:'1px solid #1b1b1b', marginTop:24 }}>
      <div className="container" style={{ padding:'24px 0', display:'grid', gap:8 }}>
        <div><strong>Adress</strong><div>Storgatan 66, 171 52 Solna, Stockholm</div></div>
        <div><strong>Öppettider</strong><div>Mån–Fre: 10:00–22:00, Lör–Sön: 11:00–22:00</div></div>
        <div className="muted">© Kebabkhan Kurdistan</div>
      </div>
    </footer>
  )
}
