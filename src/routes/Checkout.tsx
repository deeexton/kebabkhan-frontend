import { useState } from 'react'
import { Api, OrderItem, OrderMethod } from '../api'
import { useCart } from '../store/cart'
import { useNavigate } from 'react-router-dom'
import MenuGrid from '../components/MenuGrid'

const DELIVERY_POSTCODES = (import.meta.env.VITE_DELIVERY_POSTCODES || '17152,17121,17122,17123').split(',').map(s=>s.trim())

export default function Checkout() {
  const cart = useCart()
  const nav = useNavigate()
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
    if (cart.lines.length === 0) return alert('Varukorgen är tom')
    if (method==='DELIVERY' && !DELIVERY_POSTCODES.includes(postalCode)) {
      return alert('Leverans är endast tillgänglig för specifika postnummer.')
    }
    setError(null); setPlacing(true)
    try {
      // Use V2 payload shape per backend doc
      const items = cart.lines.map(l => ({ menuItemId: l.item.id, quantity: l.qty }))
      const res = await Api.createOrderV2({
        type: method === 'DINE_IN' ? 'DINE_IN' : 'TAKEAWAY',
        paymentMethod,
        items,
        customerName: name,
        phone,
        email: email || undefined,
        note: notes || undefined
      })
      cart.clear()
      nav(`/order/${res.orderId}`)
    } catch (e: any) {
      setError(e?.message || 'Kunde inte skapa ordern')
    } finally { setPlacing(false) }
  }

  return (
    <section style={{ display:'grid', gap:16 }}>
      <h2 style={{ marginTop:0 }}>Beställ</h2>

      <div className="grid" style={{ gridTemplateColumns:'1.4fr 1fr' }}>
        <div className="grid" style={{ alignContent:'start' }}>
          <div className="card" style={{ display:'grid', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
              <div>
                <div className="eyebrow">Meny</div>
                <strong>Välj dina rätter</strong>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {(['DINE_IN','TAKE_AWAY','DELIVERY'] as OrderMethod[]).map(m=>(
                  <button key={m} className={`btn ${method===m?'':'secondary'}`} onClick={()=>setMethod(m)}>{m.replaceAll('_',' ')}</button>
                ))}
              </div>
            </div>
            <div className="divider" />
            {waitTimes && (
              <div className="muted">Beräknad väntetid: {method==='DINE_IN' ? waitTimes.dineInMinutes : waitTimes.takeawayMinutes} min</div>
            )}
            <MenuGrid onAdd={(item, selectedOptions) => cart.add(item, selectedOptions as any)} />
          </div>
        </div>

        <div className="grid" style={{ alignContent:'start' }}>
          <div className="card">
            <h3 style={{ marginTop:0 }}>Order</h3>
            <div className="grid" style={{ gridTemplateColumns:'1fr' }}>
              {cart.lines.length===0 && <div className="muted">Varukorgen är tom</div>}
              {cart.lines.map((l, idx)=>(
                <div key={l.item.id + '-' + idx} style={{ display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:8 }}>
                  <div>
                    <div><strong>{l.item.name}</strong></div>
                    <div className="muted">
                      {displayPriceSEK(l.item.price)} kr
                      {(() => { const d = lineOptionsDelta(l); return d>0 ? ` + ${displayPriceSEK(d)} kr` : '' })()}
                    </div>
                    {Array.isArray(l.selectedOptions) && l.selectedOptions.length>0 && (
                      <div className="muted" style={{ marginTop:4 }}>
                        {l.selectedOptions.map((s, i) => (
                          <span key={i}>{renderOptionName(l, s)}{i < l.selectedOptions!.length-1 ? ', ' : ''}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
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
            <div className="grid">
              <input placeholder="Namn" value={name} onChange={e=>setName(e.target.value)} />
              <input placeholder="Telefon" value={phone} onChange={e=>setPhone(e.target.value)} />
              <input placeholder="E-post (valfritt)" value={email} onChange={e=>setEmail(e.target.value)} />
              {method!=='DINE_IN' && <>
                <input placeholder="Adress" value={address} onChange={e=>setAddress(e.target.value)} />
                <input placeholder="Postnummer" value={postalCode} onChange={e=>setPostalCode(e.target.value)} />
              </>}
              {method==='DINE_IN' && <input placeholder="Bord (valfritt)" value={table} onChange={e=>setTable(e.target.value)} />}
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
              <button className="btn" onClick={placeOrder} disabled={placing}>{placing ? 'Skickar...' : 'Skicka beställning'}</button>
            </div>
          </div>
        </div>
      </div>
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
