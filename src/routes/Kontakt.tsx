export default function Kontakt() {
  return (
    <>
      <section className="hero" style={{ marginLeft:'calc(50% - 50vw)', marginRight:'calc(50% - 50vw)', position:'relative' }}>
        <div style={{ position:'absolute', inset:0, zIndex:0, overflow:'hidden' }} aria-hidden>
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            style={{ width:'100%', height:'100%', objectFit:'cover', filter:'contrast(1.05) saturate(1.05)' }}
          >
            <source src="https://res.cloudinary.com/dbo4e8iuc/video/upload/v1757424335/fire-charcoal-2025-08-28-18-47-39-utc_eoxqht.mp4" type="video/mp4" />
          </video>
        </div>
        <div style={{ position:'absolute', inset:0, zIndex:1, background:'linear-gradient(180deg, rgba(0,0,0,.60), rgba(0,0,0,.45) 30%, rgba(0,0,0,.35))' }} />
        <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', width:'min(1100px, 100%)', padding:'0 16px', zIndex:3 }}>
          <div className="pill"><span className="dot"/> Kontakt</div>
        </div>
        <div className="container" style={{ display:'grid', gap:16, position:'relative', zIndex:2 }}>
          <h1 className="title-xl" style={{ margin:0 }}>Hitta oss</h1>
          <p className="muted" style={{ maxWidth:760 }}>Varmt välkommen till oss i Solna. Här hittar du adress, kontaktuppgifter och vägbeskrivning.</p>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ display:'grid', gap:24 }}>
          <div>
            <div className="eyebrow">Kontakt</div>
            <h1 className="title-lg" style={{ margin:0 }}>Hitta oss</h1>
          </div>

          <div className="card" style={{ display:'grid', gap:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:16 }}>
              <div>
                <strong>Adress</strong>
                <div>Storgatan 66</div>
                <div>171 52 Solna</div>
              </div>
              <div>
                <strong>Ring oss</strong>
                <div><a href="tel:087300025">08-730 00 25</a></div>
              </div>
              <div>
                <strong>Maila oss</strong>
                <div><a href="mailto:info@kebabkhankurdistan.se">info@kebabkhankurdistan.se</a></div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="title-md" style={{ margin:'8px 0' }}>Vägbeskrivning</h2>
            <div className="card" style={{ overflow:'hidden' }}>
              <iframe
                title="Karta till Kebabkhan Kurdistan"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d8101.43813259787!2d17.997698!3d59.359389!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x465f9d7bbf1d6e8b%3A0x9cb1a2f955c0b2b1!2sStorgatan%2066%2C%20171%2052%20Solna!5e0!3m2!1ssv!2sse!4v1695655555555"
                width="100%"
                height="400"
                style={{ border:0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}


