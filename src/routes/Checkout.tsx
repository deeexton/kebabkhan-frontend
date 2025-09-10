import { useEffect, useState } from 'react'
import { Api, OrderItem, OrderMethod } from '../api'
import { useCart } from '../store/cart'
import { useNavigate } from 'react-router-dom'
import MenuGrid from '../components/MenuGrid'
import { useStoreStatus } from '../store/storeStatus'

const DELIVERY_POSTCODES = (import.meta.env.VITE_DELIVERY_POSTCODES || '17152,17121,17122,17123').split(',').map(s=>s.trim())

export default function Checkout() {
  const cart = useCart()
  const nav = useNavigate()
  const { status, loading, refresh } = useStoreStatus()
  const isClosed = status ? status.onlineOrdersOpen === false : false
  // Ensure we have the latest status when entering checkout
  useEffect(() => { refresh().catch(()=>{}) }, [])

  const [method, setMethod] = useState<OrderMethod>('TAKE_AWAY')
  const [name, setName] = useState(''); const [phone,setPhone]=useState(''); const [email,setEmail]=useState('')
  const [address,setAddress]=useState(''); const [postalCode,setPostalCode]=useState(''); const [notes,setNotes]=useState(''); const [table,setTable]=useState('')
  const [waitTimes, setWaitTimes] = useState<{ dineInMinutes: number; takeawayMinutes: number } | null>(null)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'CASH'|'CARD'>('CASH')

  // Fetch wait times
  useState(() => { Api.getWaitTimes().then(setWaitTimes).catch(()=>{}) })

  const placeOrder = async () => {
    if (isClosed) {
      setError(status?.message || 'Onlinebeställningar är tillfälligt stängda. Välkommen åter!')
      return
    }
    if (cart.lines.length === 0) return alert('Varukorgen är tom')
    if (method==='DELIVERY' && !DELIVERY_POSTCODES.includes(postalCode)) {
      return alert('Leverans är endast tillgänglig för specifika postnummer.')
    }
    setError(null); setPlacing(true)
    try {
      // Use V2 payload shape per backend doc, include selectedOptions per item
      const items = cart.lines.map(l => ({
        menuItemId: l.item.id,
        quantity: l.qty,
        selectedOptions: (l.selectedOptions || [])
          .filter(sel => typeof sel.groupId === 'string' && typeof sel.optionId === 'string')
          .map(sel => ({
            groupId: String(sel.groupId),
            optionId: String(sel.optionId),
            quantity: Math.max(1, Math.round(Number(sel.quantity || 1)))
          }))
      }))
      // Auto-append selected options into note so they appear in admin/history
      const linesWithOptions = cart.lines.filter(l => Array.isArray(l.selectedOptions) && l.selectedOptions.length>0)
      const stringifySelections = (l: typeof cart.lines[number]): string => {
        const groups = l.item.optionGroups || []
        const parts = (l.selectedOptions || []).map(sel => {
          const g = groups.find((x: any) => String(x.id || x._id || x.name) === String(sel.groupId))
          const o = (g?.options || []).find((opt: any) => String(opt.id || opt._id || opt.name) === String(sel.optionId))
          if (!o) return ''
          const qty = sel.quantity && sel.quantity !== 1 ? ` x${sel.quantity}` : ''
          return `${o.name}${qty}`
        }).filter(Boolean)
        return parts.join(', ')
      }
      const autoOptionsNote = linesWithOptions.length>0
        ? linesWithOptions.map(l => {
            const opts = stringifySelections(l)
            return opts ? `- ${l.qty}× ${l.item.name}: ${opts}` : ''
          }).filter(Boolean).join('\n')
        : ''
      const trayLine = method === 'DINE_IN' && table ? `Bricknummer: ${table}` : ''
      const baseNote = (() => {
        if (!autoOptionsNote) return notes?.trim() || ''
        if (notes && notes.trim()) return `${notes.trim()}\n\nValda tillbehör:\n${autoOptionsNote}`
        return `Valda tillbehör:\n${autoOptionsNote}`
      })()
      const finalNote = [trayLine, baseNote].filter(Boolean).join('\n\n') || undefined
      const res = await Api.createOrderV2({
        type: method === 'DINE_IN' ? 'DINE_IN' : 'TAKEAWAY',
        paymentMethod,
        items,
        customerName: name,
        phone,
        email: email || undefined,
        note: finalNote,
        table: method === 'DINE_IN' && table ? table : undefined
      })
      cart.clear()
      nav(`/order/${res.orderId}`)
    } catch (e: any) {
      setError(e?.message || 'Kunde inte skapa ordern')
    } finally { setPlacing(false) }
  }

  if (loading) {
    return (
      <section style={{ display:'grid', gap:16 }}>
        <h2 style={{ marginTop:0 }}>Beställ</h2>
        <div className="card">Kontrollerar beställningsstatus...</div>
      </section>
    )
  }

  if (isClosed) {
    return (
      <section style={{ display:'grid', gap:16 }}>
        <h2 style={{ marginTop:0 }}>Beställ</h2>
        <div className="card" style={{ background:'#141414', borderColor:'#333' }}>
          {status?.message || 'Restaurangen är stängd för onlinebeställningar just nu. Vi tar gärna emot din beställning under våra öppettider. Varmt välkommen tillbaka!'}
        </div>
      </section>
    )
  }

  return (
    <section style={{ display:'grid', gap:16 }}>
      <h2 style={{ marginTop:0 }}>Beställ</h2>

      <div className="grid checkout-grid" style={{ gridTemplateColumns:'1.4fr 1fr' }}>
        <div className="grid" style={{ alignContent:'start' }}>
          <div className="card" style={{ display:'grid', gap:12 }}>
            <div>
              <div className="eyebrow">Meny</div>
              <strong>Vill du lägga till något mer?</strong>
            </div>
            <div className="divider" />
            {waitTimes && (
              <div className="muted">Beräknad väntetid: {method==='DINE_IN' ? waitTimes.dineInMinutes : waitTimes.takeawayMinutes} min</div>
            )}
            <MenuGrid
              onAdd={(item, selectedOptions) => cart.add(item, selectedOptions as any)}
              allowedCategories={["Mezerätter","Drycker","Tillbehör & Sötsaker"]}
            />
          </div>
        </div>

        <div className="grid" style={{ alignContent:'start' }}>
          <div className="card">
            <h3 style={{ marginTop:0 }}>Order</h3>
            <div className="grid" style={{ gridTemplateColumns:'1fr' }}>
              {cart.lines.length===0 && <div className="muted">Varukorgen är tom</div>}
              {cart.lines.map((l, idx)=>(
                <div key={l.item.id + '-' + idx} className="order-line" style={{ display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:8 }}>
                  <div>
                    <div><strong>{l.item.name}</strong></div>
                    <div className="muted">{displayPriceSEK(l.item.price)} kr</div>
                    {Array.isArray(l.selectedOptions) && l.selectedOptions.length>0 && (
                      <div className="muted" style={{ marginTop:4 }}>
                        {l.selectedOptions.map((s, i) => (
                          <span key={i}>{renderOptionName(l, s)}{i < l.selectedOptions!.length-1 ? ', ' : ''}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="order-line-actions" style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button className="btn secondary" onClick={()=>cart.dec(l.item.id)}>-</button>
                    <div>{l.qty}</div>
                    <button className="btn secondary" onClick={()=>cart.inc(l.item.id)}>+</button>
                    <button className="btn secondary" onClick={()=>cart.remove(l.item.id)}>Ta bort</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:12 }}>
              <strong>Summa</strong><strong>{displayPriceSEK(cart.subtotal)} kr</strong>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop:0 }}>Kunduppgifter</h3>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
              {/* Swedish labels, no delivery */}
              <button className={`btn ${method==='DINE_IN'?'':'secondary'}`} onClick={()=>setMethod('DINE_IN')}>Äta här</button>
              <button className={`btn ${method==='TAKE_AWAY'?'':'secondary'}`} onClick={()=>setMethod('TAKE_AWAY')}>Avhämtning</button>
            </div>
            <div className="grid">
              <input placeholder="Namn" value={name} onChange={e=>setName(e.target.value)} />
              <input placeholder="Telefon" value={phone} onChange={e=>setPhone(e.target.value)} />
              <input placeholder="E-post (valfritt)" value={email} onChange={e=>setEmail(e.target.value)} />
              {method==='DELIVERY' && <>
                <input placeholder="Adress" value={address} onChange={e=>setAddress(e.target.value)} />
                <input placeholder="Postnummer" value={postalCode} onChange={e=>setPostalCode(e.target.value)} />
              </>}
              {method==='DINE_IN' && (
                <input
                  placeholder="Bricknummer (valfritt)"
                  inputMode="numeric"
                  value={table}
                  onChange={e=>{
                    const digits = e.target.value.replace(/\D/g,'').slice(0,2)
                    if (digits==='') { setTable(''); return }
                    const n = Math.max(1, Math.min(99, Number(digits)))
                    setTable(String(n))
                  }}
                />
              )}
              <textarea placeholder="Meddelande (valfritt)" value={notes} onChange={e=>setNotes(e.target.value)} />
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
                <label className={`btn ${paymentMethod==='CASH'?'':'secondary'}`} style={{ cursor:'pointer' }}>
                  <input type="radio" name="payment" value="CASH" checked={paymentMethod==='CASH'} onChange={()=>setPaymentMethod('CASH')} style={{ display:'none' }} />
                  Betala i restaurangen
                </label>
                <label className={`btn ${paymentMethod==='CARD'?'':'secondary'}`} style={{ cursor:'pointer' }}>
                  <input type="radio" name="payment" value="CARD" checked={paymentMethod==='CARD'} onChange={()=>setPaymentMethod('CARD')} style={{ display:'none' }} />
                  Betala nu (Kort)
                </label>
              </div>
              {error && <div className="muted" style={{ color:'crimson' }}>{error}</div>}
              <button className="btn" onClick={placeOrder} disabled={placing || isClosed} title={isClosed ? (status?.message || 'Onlinebeställningar är stängda.') : undefined}>{placing ? 'Skickar...' : (isClosed ? 'Stängt' : 'Skicka beställning')}</button>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .checkout-grid { grid-template-columns: 1fr !important; }
          .order-line { grid-template-columns: 1fr !important; align-items: start !important; }
          .order-line-actions { flex-wrap: wrap; }
        }
      `}</style>
    </section>
  )
}

function displayPriceSEK(amount: number): number {
  return amount >= 1000 ? Math.round(amount / 100) : amount
}

function renderOptionName(line: { item: any }, sel: { groupId: string; optionId: string; quantity: number }): string {
  const groups = line.item.optionGroups || []
  const g = groups.find((x: any) => String(x.id || x._id || x.name) === String(sel.groupId))
  const o = (g?.options || []).find((opt: any) => String(opt.id || opt._id || opt.name) === String(sel.optionId))
  if (!o) return ''
  const dRaw = (o as any)?.priceDelta
  const halfRaw = (o as any)?.halfPriceDelta
  const delta = typeof dRaw === 'number' && dRaw !== 0 ? dRaw : (typeof halfRaw === 'number' ? halfRaw : 0)
  return delta ? `${o.name} (+${delta} kr)` : o.name
}

function lineOptionsDelta(line: { item: any; selectedOptions?: { groupId: string; optionId: string; quantity: number }[] }): number {
  const groups = line.item.optionGroups || []
  return (line.selectedOptions || []).reduce((sum, sel) => {
    const g = groups.find((x: any) => String(x.id || x._id || x.name) === String(sel.groupId))
    const o = (g?.options || []).find((opt: any) => String(opt.id || opt._id || opt.name) === String(sel.optionId))
    if (!o) return sum
    const dRaw = (o as any)?.priceDelta
    const halfRaw = (o as any)?.halfPriceDelta
    const delta = typeof dRaw === 'number' && dRaw !== 0 ? dRaw : (typeof halfRaw === 'number' ? halfRaw : 0)
    return sum + delta * (sel.quantity || 1)
  }, 0)
}
