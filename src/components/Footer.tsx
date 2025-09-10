export default function Footer() {
  return (
    <footer style={{ borderTop:'1px solid #1b1b1b', marginTop:24 }}>
      <div className="container footer-grid" style={{ padding:'24px 0' }}>
        <div>
          <div><strong>Adress</strong><div>Storgatan 66, 171 52 Solna, Stockholm</div></div>
          <div><strong>Öppettider</strong><div>Mån–Fre: 10:00–22:00, Lör–Sön: 11:00–22:00</div></div>
          <div className="muted" style={{ marginTop:8 }}>© Kebabkhan Kurdistan</div>
          <div className="muted">Utvecklad av <a href="https://www.digitalinsikt.se/" target="_blank" rel="noopener noreferrer">Digitalinsikt</a></div>
        </div>
        <div className="footer-logo">
          <img
            src="https://res.cloudinary.com/dbo4e8iuc/image/upload/v1757431015/7db2c066-f8c2-475b-8f95-510f87ce8a9d_s69ytc.png"
            alt="Digitalinsikt logotyp"
            style={{ height:140, width:'auto' }}
          />
        </div>
        <div className="footer-right">
          <div><strong>Kebabkhan Kurdistan AB</strong></div>
          <div className="muted">Org nr: 559048-7244</div>
          <div><a href="tel:087300025">08-730 00 25</a></div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8 }}>
            <a href="https://www.instagram.com/kebabkhankurdistan/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram" style={{ display:'inline-flex', alignItems:'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="18" height="18" rx="5" stroke="#cfcfcf" strokeWidth="1.5"/>
                <circle cx="12" cy="12" r="4.2" stroke="#cfcfcf" strokeWidth="1.5"/>
                <circle cx="17.5" cy="6.5" r="1.2" fill="#cfcfcf"/>
              </svg>
            </a>
            <a href="#" aria-label="TikTok" title="TikTok" style={{ display:'inline-flex', alignItems:'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 5.5c1.1 1.2 2.5 1.9 4 2v3.1c-1.7-.1-3.3-.7-4.7-1.8v5.7c0 3-2.4 5.3-5.3 5.3S4.7 17.5 4.7 14.6c0-2.8 2.1-5 4.9-5.3v3.1c-1.1.2-1.8 1-1.8 2.1 0 1.2 1 2.2 2.2 2.2s2.2-1 2.2-2.2V3.8H16v1.7z" fill="#cfcfcf"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
