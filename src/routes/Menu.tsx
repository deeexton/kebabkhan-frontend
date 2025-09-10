import MenuGrid from '../components/MenuGrid'
import { useCart } from '../store/cart'
import { useEffect } from 'react'
import { useStoreStatus } from '../store/storeStatus'

export default function Menu() {
  const cart = useCart()
  const { status, refresh } = useStoreStatus()
  const isClosed = status ? status.onlineOrdersOpen === false : false
  // Refresh status on entering menu
  useEffect(() => { refresh().catch(()=>{}) }, [])
  return (
    <section className="container" style={{ display:'grid', gap:16 }}>
      <div style={{ textAlign:'center', marginTop:0 }}>
        <h2 style={{
          margin:'0 0 6px 0',
          fontSize:36,
          lineHeight:1.15,
          fontFamily:'"Poppins", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
          letterSpacing:.2,
          background:'linear-gradient(90deg, #fff, #f4f4f4 40%, #eab308 90%)',
          WebkitBackgroundClip:'text',
          backgroundClip:'text',
          color:'transparent',
          textShadow:'0 8px 30px rgba(234,179,8,.10), 0 2px 10px rgba(0,0,0,.35)'
        }}>
          Utforska vår meny och beställ online enkelt och smidigt👇
        </h2>
        <div style={{ display:'inline-flex', gap:6, alignItems:'center', opacity:.9 }}>
          <span style={{ width:6, height:6, borderRadius:999, background:'#eab308', boxShadow:'0 0 0 6px rgba(234,179,8,.12)' }} />
          <span className="muted">Scrolla och välj dina favoriter</span>
          <span style={{ width:6, height:6, borderRadius:999, background:'#eab308', boxShadow:'0 0 0 6px rgba(234,179,8,.12)' }} />
        </div>
      </div>
      {isClosed && (
        <div className="card" style={{ background:'#141414', borderColor:'#333' }}>
          {status?.message || 'Restaurangen är stängd för onlinebeställningar just nu. Vi tar gärna emot din beställning under våra öppettider. Varmt välkommen tillbaka!'}
        </div>
      )}
      <MenuGrid onAdd={cart.add} />
    </section>
  )
}
