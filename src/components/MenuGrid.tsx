import { useEffect, useMemo, useState } from 'react'
import { Api, MenuItem, OptionGroup } from '../api'
import { useStoreStatus } from '../store/storeStatus'

export default function MenuGrid({ onAdd, allowedCategories, minColumnPx = 260, dense = false, columns, extraGridItem }: { onAdd: (item: MenuItem, selectedOptions?: any) => void; allowedCategories?: string[]; minColumnPx?: number; dense?: boolean; columns?: number; extraGridItem?: React.ReactNode }) {
  const [items, setItems] = useState<MenuItem[]>([])
  useEffect(() => { Api.listMenu().then(setItems).catch(()=>{}) }, [])
  const availableItems = useMemo(() => items.filter(m => m.isAvailable !== false), [items])
  const { status } = useStoreStatus()
  const isClosed = status ? status.onlineOrdersOpen === false : false
  const [vw, setVw] = useState<number>(() => (typeof window !== 'undefined' ? window.innerWidth : 1280))
  useEffect(() => {
    const onR = () => setVw(typeof window !== 'undefined' ? window.innerWidth : 1280)
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onR)
      return () => window.removeEventListener('resize', onR)
    }
  }, [])

  const CATEGORY_ORDER = [
    'Från Grillen',
    'Varmrätter',
    'Mezerätter',
    'Drycker',
    'Tillbehör & Sötsaker',
    // Legacy/other categories appear after if present
    'Övrigt'
  ]

  const normalizeCategory = (raw?: string): string => {
    const c = (raw || 'Övrigt').trim()
    const lower = c.toLowerCase()
    // Från Grillen
    if (lower.includes('grill') || lower.includes('från grillen') || lower.includes('fran grillen') || lower.includes('frÃ¥n grillen')) return 'Från Grillen'
    if (lower.includes('förrätt') || lower.includes('forratt') || /^förrätter$/i.test(c) || /^forratter$/i.test(c)) return 'Från Grillen'
    // Varmrätter
    if (lower.includes('huvudrätt') || lower.includes('huvudratter') || /^varmrätter$/i.test(c) || /^varmratter$/i.test(c)) return 'Varmrätter'
    // Mezerätter
    if (lower.includes('meze')) return 'Mezerätter'
    // Drycker
    if (lower.startsWith('dryck') || /dryck(er)?/i.test(c) || lower.includes('dricka')) return 'Drycker'
    // Tillbehör & Sötsaker
    if (lower.includes('tillbeh') || lower.includes('sidorätt') || lower.includes('sidoratt') || lower.includes('dessert') || lower.includes('sötsak') || lower.includes('sotsak') || lower.includes('sötsaker') || lower.includes('sotsaker') || lower.includes('bröd') || lower.includes('brod')) return 'Tillbehör & Sötsaker'
    return c
  }

  const orderIndex = (c: string) => {
    const idx = CATEGORY_ORDER.indexOf(c)
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
  }

  const categories = useMemo(() => {
    const s = new Set<string>()
    availableItems.forEach(i => s.add(normalizeCategory(i.category)))
    const sorted = Array.from(s).sort((a,b) => {
      const diff = orderIndex(a) - orderIndex(b)
      return diff !== 0 ? diff : a.localeCompare(b, 'sv')
    })
    // If small screen, merge Drycker into Mezerätter to reduce columns
    try {
      const isNarrow = typeof window !== 'undefined' && window.innerWidth < 1100
      if (isNarrow && sorted.includes('Drycker') && sorted.includes('Mezerätter')) {
        return sorted.filter(c => c !== 'Drycker')
      }
    } catch {}
    return sorted
  }, [availableItems])

  const shouldMergeDrinksIntoMezze = useMemo(() => {
    try {
      const names = availableItems.map(i => normalizeCategory(i.category))
      const hasMezze = names.includes('Mezerätter')
      const hasDrinks = names.includes('Drycker')
      const isNarrow = typeof window !== 'undefined' && window.innerWidth < 1100
      return isNarrow && hasMezze && hasDrinks
    } catch { return false }
  }, [availableItems])

  const byCat = (cat: string) => availableItems.filter(m => normalizeCategory(m.category) === cat)

  const renderRow = (m: MenuItem) => (
    <div key={m.id} onClick={() => setDetailsItem(m)} role="button" style={{ display:'grid', gridTemplateColumns:`${thumb}px 1fr auto`, alignItems:'center', gap:rowGap, cursor:'pointer', height:rowHeight }}>
      <div style={{ width:thumb, height:thumb, borderRadius:8, background:'#222', display:'grid', placeItems:'center', overflow:'hidden' }}>
        {m.imageUrl ? (
          <img src={m.imageUrl} alt={m.name} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
        ) : null}
      </div>
      <div style={{ minWidth:0 }}>
        <div style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.name}</div>
        <div className="muted" style={{ whiteSpace:'nowrap' }}>{displayPriceSEK(m.price)} kr</div>
      </div>
      <OptionsLauncher item={m} onAdd={onAdd} closed={isClosed} />
    </div>
  )
  const displayPriceSEK = (p: number) => (p >= 1000 ? Math.round(p / 100) : p)
  const [detailsItem, setDetailsItem] = useState<MenuItem | null>(null)
  const thumb = dense ? 56 : 64
  const rowGap = dense ? 8 : 12
  const rowHeight = dense ? 68 : 84
  const gridCols = useMemo(() => {
    if (!columns) return undefined
    if (vw < 720) return 1
    if (vw < 1100) return Math.min(2, columns)
    return columns
  }, [columns, vw])
  return (
    <div className="grid" style={{ gridTemplateColumns: gridCols ? `repeat(${gridCols}, minmax(0, 1fr))` : `repeat(auto-fill, minmax(${minColumnPx}px,1fr))` }}>
      {(categories.filter(c => !allowedCategories || allowedCategories.includes(c))).map((cat) => (
        <div key={cat} className="card">
          <h3 style={{ marginTop:0 }}>{cat}</h3>
          <div className="grid" style={{ gridTemplateColumns:'1fr' }}>
            {cat === 'Mezerätter' && shouldMergeDrinksIntoMezze ? (
              <>
                {byCat('Mezerätter').map(renderRow)}
                <div className="muted" style={{ marginTop:8, fontWeight:700 }}>Drycker</div>
                {byCat('Drycker').map(renderRow)}
              </>
            ) : (
              byCat(cat as any).map(renderRow)
            )}
          </div>
        </div>
      ))}
      {extraGridItem}
      {detailsItem && (
        <ItemDetailsModal
          item={detailsItem}
          onClose={() => setDetailsItem(null)}
          onAdd={onAdd}
          closed={isClosed}
        />
      )}
    </div>
  )
}

function OptionsLauncher({ item, onAdd, closed }: { item: MenuItem; onAdd: (item: MenuItem, selectedOptions?: any) => void; closed?: boolean }) {
  const hasOptions = Array.isArray(item.optionGroups) && item.optionGroups.length > 0
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn" disabled={!!closed} title={closed ? 'Restaurangen är stängd för onlinebeställningar just nu.' : undefined} onClick={(e) => { e.stopPropagation(); if (closed) return; hasOptions ? setOpen(true) : onAdd(item) }}>{closed ? 'Stängt' : (hasOptions ? 'Välj' : 'Lägg till')}</button>
      {open && hasOptions && (
        <OptionsDialog item={item} onClose={() => setOpen(false)} onConfirm={(sel) => { onAdd(item, sel); setOpen(false) }} />
      )}
    </>
  )}

function OptionsDialog({ item, onClose, onConfirm }: { item: MenuItem; onClose: () => void; onConfirm: (selected: any[]) => void }) {
  type Sel = { groupId: string; optionId: string; quantity: number }
  const [selections, setSelections] = useState<Sel[]>([])
  const [selectedKey, setSelectedKey] = useState<string>('')

  const upsert = (groupId: string, optionId: string, quantity: number) => {
    setSelections(prev => {
      const copy = prev.filter(s => !(s.groupId===groupId && s.optionId===optionId))
      if (quantity > 0) copy.push({ groupId, optionId, quantity })
      return copy
    })
  }

  const renderGroup = (g: OptionGroup) => {
    const groupId = String(g.id || '')
    return (
      <div key={groupId} className="card" style={{ display:'grid', gap:8 }}>
        <div style={{ fontWeight:600 }}>{g.name}</div>
        {/* helper hidden per request */}
        <div className="grid" style={{ gridTemplateColumns:'1fr', gap:8 }}>
          {(g.options||[]).map(o => {
            const optionId = String(o.id || '')
            const key = `${groupId}:${optionId}`
            const current = selections.find(s => s.groupId===groupId && s.optionId===optionId)?.quantity || 0
            const step = g.allowHalf ? 0.5 : 1
            return (
              <div key={key} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center' }}>
                <div>{o.name} {typeof o.priceDelta==='number' && o.priceDelta!==0 ? <span className="muted">(+{o.priceDelta} kr)</span> : null}</div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <button className="btn secondary" onClick={()=>upsert(groupId, optionId, Math.max(0, current - step))}>-</button>
                  <div>{current}</div>
                  <button className="btn secondary" onClick={()=>upsert(groupId, optionId, current + step)}>+</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const confirm = () => {
    onConfirm(selections)
  }

  return (
    <div className="card" onClick={(e)=>e.stopPropagation()} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'grid', placeItems:'center', zIndex:1000 }}>
      <div className="card" onClick={(e)=>e.stopPropagation()} style={{ width:'min(720px, 92vw)', maxHeight:'90vh', overflow:'auto', display:'grid', gap:12 }}>
        <h3 style={{ marginTop:0 }}>{item.name}</h3>
        <h4 style={{ margin:0 }}>Välj tillbehör</h4>
        {/* Show radio list per group (choose one) */}
        {(item.optionGroups||[]).map((g, gi) => {
          const groupId = String(g.id || g.name || gi)
          const current = selections.find(s => s.groupId === groupId)?.optionId || ''
          const select = (optionId: string) => {
            setSelectedKey(`${groupId}:${optionId}`)
            setSelections(prev => {
              const others = prev.filter(s => s.groupId !== groupId)
              return [...others, { groupId, optionId, quantity: 1 }]
            })
          }
          return (
            <div key={groupId} className="card" style={{ display:'grid', gap:8 }}>
              <div style={{ fontWeight:600 }}>{g.name || 'Välj tillbehör'}</div>
              {(g.options||[]).map((o, oi) => {
                const optionId = String((o as any).id || (o as any)._id || o.name || `${gi}:${oi}`)
                const inputId = `opt-${gi}-${oi}`
                const checked = current === optionId
                return (
                  <div key={optionId}
                    onClick={(e) => { e.stopPropagation(); select(optionId) }}
                    role="button"
                    style={{ width:'100%', background: checked ? '#1a1a1a' : '#111', border:'1px solid #222', padding:'12px 14px', borderRadius:8, display:'grid', gridTemplateColumns:'1fr 24px', alignItems:'center', gap:12, color:'inherit', cursor:'pointer' }}>
                    <div>{o.name} {typeof (o as any).priceDelta==='number' && (o as any).priceDelta!==0 ? <span className="muted">(+{(o as any).priceDelta} kr)</span> : null}</div>
                    <input id={inputId} type="radio" name={`opt-${gi}`} checked={checked} readOnly style={{ justifySelf:'end' }} />
                  </div>
                )
              })}
            </div>
          )
        })}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Avbryt</button>
          <button className="btn" onClick={confirm}>Lägg till</button>
        </div>
      </div>
    </div>
  )
}

function ItemDetailsModal({ item, onClose, onAdd, closed }: { item: MenuItem; onClose: () => void; onAdd: (item: MenuItem, selectedOptions?: any) => void; closed?: boolean }) {
  return (
    <div className="card" onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'grid', placeItems:'center', zIndex:1000 }}>
      <div className="card" onClick={(e)=>e.stopPropagation()} style={{ width:'min(720px, 92vw)', maxHeight:'90vh', overflow:'auto', display:'grid', gap:12 }}>
        {item.imageUrl ? (
          <div style={{ width:'100%', background:'#000', display:'flex', justifyContent:'center', alignItems:'center', borderRadius:8 }}>
            <img src={item.imageUrl} alt={item.name} style={{ maxWidth:'100%', maxHeight:'60vh', width:'auto', height:'auto', objectFit:'contain', borderRadius:8 }} />
          </div>
        ) : null}
        <div style={{ display:'grid', gap:8 }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:12 }}>
            <h3 style={{ margin:0 }}>{item.name}</h3>
            <div style={{ fontWeight:600 }}>{item.price} kr</div>
          </div>
          {item.description ? (
            <div className="muted" style={{ whiteSpace:'pre-wrap' }}>{item.description}</div>
          ) : null}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button className="btn secondary" onClick={onClose}>Stäng</button>
            <OptionsLauncher item={item} onAdd={(it, sel) => { onAdd(it, sel); onClose() }} closed={closed} />
          </div>
        </div>
      </div>
    </div>
  )
}
