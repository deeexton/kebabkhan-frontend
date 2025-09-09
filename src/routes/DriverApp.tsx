import { useEffect, useRef, useState } from 'react'
import { Api } from '../api'

declare global { interface Window { google?: any; } }

export default function DriverApp() {
  const [token, setToken] = useState<string | null>(null)
  const [orderId, setOrderId] = useState('')
  const watchId = useRef<number | null>(null)

  useEffect(() => {
    const t = localStorage.getItem('driver_token'); if (t) setToken(t)
  }, [])

  const start = () => {
    if (!token) return alert('Ange driver token (backend JWT)')
    if (!orderId) return alert('Fyll i order ID')
    if (!navigator.geolocation) return alert('Geolocation saknas')
    watchId.current = navigator.geolocation.watchPosition(async pos => {
      await Api.driverUpsertLocation(token, orderId, pos.coords.latitude, pos.coords.longitude)
    }, err => console.error(err), { enableHighAccuracy: true, maximumAge: 2000, timeout: 5000 })
  }

  const stop = () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
  }

  return (
    <section className="card">
      <h3 style={{ marginTop:0 }}>Driver App</h3>
      <input placeholder="Backend driver token (JWT)" value={token ?? ''} onChange={e=>{ setToken(e.target.value); localStorage.setItem('driver_token', e.target.value) }} />
      <input placeholder="Order ID" value={orderId} onChange={e=>setOrderId(e.target.value)} />
      <div style={{ display:'flex', gap:8, marginTop:8 }}>
        <button className="btn" onClick={start}>Starta sändning</button>
        <button className="btn secondary" onClick={stop}>Stoppa</button>
      </div>
      <div className="muted" style={{ marginTop:8 }}>I backend, begränsa detta till specifika Google-konton.</div>
    </section>
  )
}
