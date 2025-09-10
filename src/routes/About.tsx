export default function About() {
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
            <source src="https://res.cloudinary.com/dbo4e8iuc/video/upload/v1757446247/aerial-footage-of-geli-ali-beg-waterfall-in-erbil-2025-08-29-03-07-03-utc_qcs5y1.mp4" type="video/mp4" />
          </video>
        </div>
        <div style={{ position:'absolute', inset:0, zIndex:1, background:'linear-gradient(180deg, rgba(0,0,0,.60), rgba(0,0,0,.45) 30%, rgba(0,0,0,.35))' }} />
        <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', width:'min(1100px, 100%)', padding:'0 16px', zIndex:3 }}>
          <div className="pill"><span className="dot"/> Om oss</div>
        </div>
        <div className="container" style={{ display:'grid', gap:16, position:'relative', zIndex:2 }}>
          <h1 className="title-xl" style={{ margin:0 }}>Vår historia</h1>
          <p className="muted" style={{ maxWidth:760 }}>
            Vi växte upp i Erbil där familjen drev restauranger. När vi kom till
            Sverige tog vi med oss traditionen och kärleken till maten. Idag drivs Kebabkhan av Diar och Riad.
            Vi vill hålla kvar familjekänslan och lagar maten med kärlek så att våra gäster får smaka
            den autentiska smaken från Kurdistan.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container two-col">
          <div style={{ display:'grid', gap:14 }}>
            <div className="eyebrow">Vår filosofi</div>
            <h2 className="title-lg">Glöd, gästfrihet och generösa smaker</h2>
            <p className="muted">
              Kolgrillen är hjärtat i vårt kök. Vi låter råvarorna tala och smaksätter med klassiska kryddor från
              Mellanöstern och Kurdistan. Vi tror på värme – i maten, i bemötandet och i atmosfären.
            </p>
            <p className="muted">
              Oavsett om du äter hos oss, tar med dig hem eller beställer catering vill vi att det ska kännas som att
              komma hem till oss. Mat som till familjen.
            </p>
          </div>
          <div className="card" style={{ display:'grid', gap:12 }}>
            <div className="eyebrow">Vilka vi är</div>
            <div style={{ display:'grid', gap:12 }}>
              <div style={{ display:'flex', gap:12 }}>
                <div className="pill"><span className="dot"/></div>
                <div>
                  <strong>Diar & Riad</strong>
                  <div className="muted">Uppvuxna i Erbil med många år i familjens restauranger – entreprenörer i Solna.</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:12 }}>
                <div className="pill"><span className="dot"/></div>
                <div>
                  <strong>Familjevibe</strong>
                  <div className="muted">Vi bygger vidare på familjens arv – med hjärta och stolthet.</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:12 }}>
                <div className="pill"><span className="dot"/></div>
                <div>
                  <strong>Äkta smaker</strong>
                  <div className="muted">Den autentiska smaken från Kurdistan – tillagad över glöd.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}


