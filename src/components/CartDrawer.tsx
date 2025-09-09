import { useState } from 'react'
import { useCart } from '../store/cart'
import { Link, useLocation } from 'react-router-dom'

export default function CartDrawer() {
  const [open, setOpen] = useState(false)
  const cart = useCart()
  const loc = useLocation()
  // Hide on admin pages and after order is placed (tracking page)
  if (loc.pathname.startsWith('/admin') || loc.pathname.startsWith('/order/')) return null
  return (
    <div style={{ position:'fixed', right:16, bottom:16, zIndex:50 }}>
      <button className="btn" onClick={() => setOpen(v=>!v)}>
        Varukorg ({cart.lines.reduce((s,l)=>s+l.qty,0)}) – {displayPriceSEK(cart.subtotal)} kr
      </button>
      {open && (
        <div className="card" style={{ position:'absolute', right:0, bottom:'60px', width:320 }}>
          <h3 style={{ marginTop:0 }}>Varukorg</h3>
          <div className="grid">
            {cart.lines.length===0 && <div className="muted">Tom</div>}
            {cart.lines.map(l=>(
              <div key={l.item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                <div>{l.item.name}<div className="muted">{displayPriceSEK(l.item.price)} kr</div></div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button className="btn secondary" onClick={()=>cart.dec(l.item.id)}>-</button>
                  <div>{l.qty}</div>
                  <button className="btn secondary" onClick={()=>cart.inc(l.item.id)}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:12 }}>
            <strong>Summa:</strong><strong>{displayPriceSEK(cart.subtotal)} kr</strong>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button className="btn secondary" onClick={() => { cart.clear(); setOpen(false) }}>Rensa</button>
            <Link to="/checkout" className="btn">Till kassan</Link>
          </div>
        </div>
      )}
    </div>
  )
}

function displayPriceSEK(amount: number): number {
  return amount >= 1000 ? Math.round(amount / 100) : amount
}
