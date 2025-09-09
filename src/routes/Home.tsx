import { Link } from 'react-router-dom'
import { MENU } from '../data/menu'
import { useEffect, useRef, useState } from 'react'
import { Api, MenuItem } from '../api'

export default function Home() {
  const [items, setItems] = useState<MenuItem[]>([])
  useEffect(() => { Api.listMenu().then(setItems).catch(()=>{}) }, [])
  const data = items.length ? items : MENU
  const grillItems = data.filter(m => {
    const c = (m.category || '').toLowerCase()
    return c.includes('grill') || c.includes('kolgrill') || c.includes('från grillen')
  })
  const visibleItems = (grillItems.length ? grillItems : data).slice(0, 12)
  const rowRef = useRef<HTMLDivElement>(null)
  const scrollRow = (dir: 'left' | 'right') => {
    const el = rowRef.current
    if (!el) return
    const dx = dir === 'left' ? -Math.max(320, el.clientWidth * 0.8) : Math.max(320, el.clientWidth * 0.8)
    el.scrollBy({ left: dx, behavior: 'smooth' })
  }
  return (
    <>
      <section className="hero" style={{ marginLeft:'calc(50% - 50vw)', marginRight:'calc(50% - 50vw)' }}>
        <div style={{ position:'absolute', inset:0, zIndex:0, overflow:'hidden' }} aria-hidden>
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            style={{ width:'100%', height:'100%', objectFit:'cover', filter:'contrast(1.05) saturate(1.05)', transform:'translateX(0)' }}
          >
            <source src="https://res.cloudinary.com/dbo4e8iuc/video/upload/q_auto:eco,vc_auto/shish_kebab_3_goibpt.mp4" type="video/mp4" />
          </video>
        </div>
        <div style={{ position:'absolute', inset:0, zIndex:1, background:'linear-gradient(180deg, rgba(0,0,0,.60), rgba(0,0,0,.45) 30%, rgba(0,0,0,.35))' }} />
        <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', width:'min(1100px, 100%)', padding:'0 16px', zIndex:3 }}>
          <div className="pill"><span className="dot"/> Äkta kurdisk kolgrill – smaker från hjärtat av Mellanöstern, serverade i Stockholm.</div>
        </div>
        <div className="container" style={{ display:'grid', gap:16, position:'relative', zIndex:2 }}>
          <h1 className="title-xl" style={{ margin:0, textShadow:'0 2px 14px rgba(0,0,0,.6)' }}>
            En hyllning till eld, kryddor och <span className="accent-text">gästfrihet</span>
          </h1>
          <p className="muted" style={{ maxWidth:760, textShadow:'0 2px 12px rgba(0,0,0,.5)' }}>
            Hos Kebabkhan för vi arvet från Mellanöstern och Kurdistan vidare – där kolgrillen är hjärtat,
            brödet bakas varmt och varje rätt byggs med stolthet. Välkommen till en upplevelse lika varm som vår glöd.
          </p>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <Link to="/catering" className="btn">Catering</Link>
            <Link to="/checkout" className="btn secondary">Beställ online</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ display:'grid', gap:24 }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
            <div>
              <div className="eyebrow">Från grillen</div>
              <h2 className="title-lg">Ett urval av vår kolgrill</h2>
            </div>
            <Link to="/menu" className="btn secondary">Se hela menyn</Link>
          </div>
          <div style={{ position:'relative', padding:'0 28px', overflow:'hidden' }}>
            <div ref={rowRef} className="no-scrollbar" style={{ width:'100%', boxSizing:'border-box', display:'grid', gridAutoFlow:'column', gridAutoColumns:'calc((100% - 48px)/4)', gap:16, overflowX:'auto', scrollSnapType:'x mandatory', paddingBottom:8 }}>
              {visibleItems.map(item => (
                <div key={item.id} className="menu-card" style={{ scrollSnapAlign:'start' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:8 }}>
                    <strong>{item.name}</strong>
                    <span className="price" style={{ whiteSpace:'nowrap' }}>{item.price} kr</span>
                  </div>
                  <div className="muted">Från grillen</div>
                  {(() => {
                    const desc = (item as any).description || (item.name?.toLowerCase().includes('bröd') ? 'Serveras med bröd från stenugn' : '')
                    return desc ? (
                      <div className="muted" style={{ fontSize:13, opacity:.9, marginTop:4 }}>{desc}</div>
                    ) : null
                  })()}
                  <div className="divider" style={{ marginTop:'auto' }} />
                  <div style={{ display:'grid', gridTemplateRows:'auto auto', gap:8 }}>
                    <span className="pill"><span className="dot"/> Nygrillat</span>
                    <span className="pill">Bröd från stenugn</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ position:'absolute', left:8, right:8, top:'50%', transform:'translateY(-50%)', display:'flex', justifyContent:'space-between', pointerEvents:'none' }}>
              <button type="button" className="btn secondary" style={{ pointerEvents:'auto', padding:'8px 10px' }} onClick={()=>scrollRow('left')} aria-label="Scrolla vänster">‹</button>
              <button type="button" className="btn secondary" style={{ pointerEvents:'auto', padding:'8px 10px' }} onClick={()=>scrollRow('right')} aria-label="Scrolla höger">›</button>
            </div>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container two-col">
          <div style={{ display:'grid', gap:14 }}>
            <div className="eyebrow">Vår berättelse</div>
            <h2 className="title-lg">Från Dohuk till Solna – samma eld, samma kärlek</h2>
            <p className="muted">
              Kebabkhan föddes ur längtan efter smakerna vi vuxit upp med: den rökiga doften från kolen,
              syran från granatäppel och värmen från kummin, sumak och vitlök. Vi förenar tradition med kvalitet –
              färska råvaror, generösa portioner och en meny som speglar hjärtat av Mellanöstern och Kurdistan.
            </p>
            <p className="muted">
              Hos oss är gästfrihet mer än ett ord. Den känns i hur vi hälsar dig välkommen, hur vi lägger upp din tallrik
              och i hur vi vill att du ska trivas – oavsett om du äter här, tar med dig hem eller beställer till dörren.
            </p>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <Link to="/menu" className="btn">Smaka vår kultur</Link>
              <Link to="/checkout" className="btn secondary">Beställ till bordet eller hem</Link>
            </div>
          </div>
          <div className="card" style={{ display:'grid', gap:12 }}>
            <div className="eyebrow">Våra löften</div>
            <div style={{ display:'grid', gap:12 }}>
              <div style={{ display:'flex', gap:12 }}>
                <div className="pill"><span className="dot"/></div>
                <div>
                  <strong>Äkta kolgrill</strong>
                  <div className="muted">Smaker som bara riktig glöd kan ge.</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:12 }}>
                <div className="pill"><span className="dot"/></div>
                <div>
                  <strong>Generös gästfrihet</strong>
                  <div className="muted">Vi lagar mat som till familjen.</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:12 }}>
                <div className="pill"><span className="dot"/></div>
                <div>
                  <strong>Råvaror vi står för</strong>
                  <div className="muted">Färskt, noga utvalt och med respekt för tradition.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
