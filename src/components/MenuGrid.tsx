import { useEffect, useMemo, useState } from 'react'
import { Api, MenuItem, OptionGroup } from '../api'

export default function MenuGrid({ onAdd }: { onAdd: (item: MenuItem, selectedOptions?: any) => void }) {
  const [items, setItems] = useState<MenuItem[]>([])
  useEffect(() => { Api.listMenu().then(setItems).catch(()=>{}) }, [])
  const availableItems = useMemo(() => items.filter(m => m.isAvailable !== false), [items])

  const CATEGORY_ORDER = [
    'Förrätter',
    'Huvudrätter',
    'Sidorätter',
    'Barnmeny',
    'Drycker',
    'Efterrätter',
    'Bröd & tillbehör',
    // Legacy categories for compatibility
    'Grill', 'Kall Meze', 'Dryck', 'Övrigt'
  ]

  const orderIndex = (c: string) => {
    const idx = CATEGORY_ORDER.indexOf(c)
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
  }

  const categories = useMemo(() => {
    const s = new Set<string>()
    availableItems.forEach(i => s.add(i.category || 'Övrigt'))
    return Array.from(s).sort((a,b) => {
      const diff = orderIndex(a) - orderIndex(b)
      return diff !== 0 ? diff : a.localeCompare(b, 'sv')
    })
  }, [availableItems])

  const byCat = (cat: string) => availableItems.filter(m => (m.category || 'Övrigt') === cat)
  const displayPriceSEK = (p: number) => (p >= 1000 ? Math.round(p / 100) : p)
  return (
    <div className="grid" style={{ gridTemplateColumns:'repeat(auto-fill, minmax(260px,1fr))' }}>
      {categories.map((cat) => (
        <div key={cat} className="card">
          <h3 style={{ marginTop:0 }}>{cat}</h3>
          <div className="grid" style={{ gridTemplateColumns:'1fr' }}>
            {byCat(cat as any).map(m => (
              <div key={m.id} style={{ display:'grid', gridTemplateColumns:'64px 1fr auto', alignItems:'center', gap:12 }}>
                {m.imageUrl ? (
                  <img src={m.imageUrl} alt={m.name} style={{ width:64, height:64, objectFit:'cover', borderRadius:8 }} />
                ) : (
                  <div style={{ width:64, height:64, borderRadius:8, background:'#222' }} />
                )}
                <div>
                  <div>{m.name}</div>
                  <div className="muted">{displayPriceSEK(m.price)} kr</div>
                </div>
                <OptionsLauncher item={m} onAdd={onAdd} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function OptionsLauncher({ item, onAdd }: { item: MenuItem; onAdd: (item: MenuItem, selectedOptions?: any) => void }) {
  const hasOptions = Array.isArray(item.optionGroups) && item.optionGroups.length > 0
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn" onClick={() => (hasOptions ? setOpen(true) : onAdd(item))}>{hasOptions ? 'Välj' : 'Lägg till'}</button>
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
    <div className="card" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'grid', placeItems:'center', zIndex:1000 }}>
      <div className="card" style={{ width:'min(720px, 92vw)', maxHeight:'90vh', overflow:'auto', display:'grid', gap:12 }}>
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
                    onClick={() => select(optionId)}
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
