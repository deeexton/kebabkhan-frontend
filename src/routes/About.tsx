export default function About() {
  return (
    <>
      <section className="hero">
        <div className="container" style={{ display:'grid', gap:16 }}>
          <div className="pill"><span className="dot"/> Om oss</div>
          <h1 className="title-xl" style={{ margin:0 }}>Vår historia</h1>
          <p className="muted" style={{ maxWidth:760 }}>
            Vi växte upp med en pappa som drev sin egen autentiska restaurang i Kurdistan, Dohuk. När vi kom till
            Sverige tog vi med oss traditionen och kärleken till maten. Idag är vi två bröder – Derya och Diyar – som
            driver Kebabkhan. Vi vill hålla kvar familjekänslan och lagar maten med kärlek så att våra gäster får smaka
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
                  <strong>Derya & Diyar</strong>
                  <div className="muted">Bröder, uppvuxna i Dohuk – entreprenörer i Solna.</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:12 }}>
                <div className="pill"><span className="dot"/></div>
                <div>
                  <strong>Familjevibe</strong>
                  <div className="muted">Vi bygger vidare på pappas arv – med hjärta och stolthet.</div>
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


