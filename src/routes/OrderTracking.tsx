import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Api, Order, MenuItem } from '../api'
import { socket } from '../socket'
import OrderStatusBadge from '../components/OrderStatusBadge'

export default function OrderTracking() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [now, setNow] = useState<number>(() => Date.now())
  const [acceptedAtMs, setAcceptedAtMs] = useState<number | null>(null)
  const [readyAtMs, setReadyAtMs] = useState<number | null>(null)
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstance = useRef<google.maps.Map | null>(null)
  const marker = useRef<google.maps.Marker | null>(null)

  useEffect(() => {
    if (!orderId) return
    let activeId = orderId
    const isFiveDigit = /^\d{5}$/.test(orderId)
    const load = async () => {
      try {
        if (isFiveDigit) {
          activeId = await Api.lookupOrderId(orderId)
          navigate(`/order/${activeId}`, { replace: true })
        }
        const o = await Api.getOrder(activeId)
        setOrder(o)
        const acceptedTs = o.acceptedAt ? new Date(o.acceptedAt).getTime() : (o.status === 'ACCEPTED' ? Date.now() : null)
        const readyTs = o.readyAt
          ? new Date(o.readyAt).getTime()
          : (acceptedTs && typeof o.etaMinutes === 'number' ? acceptedTs + o.etaMinutes * 60_000 : null)
        if (acceptedTs) setAcceptedAtMs(acceptedTs)
        if (readyTs) setReadyAtMs(readyTs)
        socket.emit('join_order_room', activeId)
        socket.emit('joinOrder', activeId)
      } catch (e) {
        try {
          const o = await Api.getOrder(orderId)
          setOrder(o)
          socket.emit('join_order_room', orderId)
          socket.emit('joinOrder', orderId)
        } catch {
          setOrder(null)
        }
      }
    }
    load()
    Api.listMenu().then(setMenu).catch(()=>{})
    const onAnyUpdate = (u: Partial<Order> & { etaMinutes?: number; acceptedAt?: string; readyAt?: string; status?: string }) => {
      setOrder(prev => ({ ...(prev || {} as any), ...(u as any) } as Order))
      if (u.acceptedAt && !acceptedAtMs) {
        setAcceptedAtMs(new Date(u.acceptedAt).getTime())
      }
      if (!acceptedAtMs && u.status === 'ACCEPTED' && !u.acceptedAt) {
        setAcceptedAtMs(Date.now())
      }
      if (u.readyAt) {
        setReadyAtMs(new Date(u.readyAt).getTime())
      } else if (typeof u.etaMinutes === 'number') {
        let base = acceptedAtMs
        if (!base && u.acceptedAt) base = new Date(u.acceptedAt).getTime()
        if (!base && u.status === 'ACCEPTED') {
          const nowBase = Date.now()
          setAcceptedAtMs(nowBase)
          base = nowBase
        }
        if (base) setReadyAtMs(base + u.etaMinutes * 60_000)
      }
    }
    socket.on('order_update', onAnyUpdate as any)
    socket.on('order:update', onAnyUpdate as any)
    socket.on('driver_location', (loc: { lat:number; lng:number }) => {
      if (mapInstance.current && marker.current) {
        marker.current.setPosition(loc)
        mapInstance.current.setCenter(loc)
      }
    })
    return () => {
      socket.off('order_update'); socket.off('order:update'); socket.off('driver_location')
      if (activeId) socket.emit('leave_order_room', activeId)
    }
  }, [orderId])

  // ticking clock for countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (order?.driverLocation && mapRef.current && !mapInstance.current) {
      mapInstance.current = new google.maps.Map(mapRef.current, {
        center: order.driverLocation, zoom: 14, disableDefaultUI: true
      })
      marker.current = new google.maps.Marker({ position: order.driverLocation, map: mapInstance.current, title: 'Kurir' })
    }
  }, [order?.driverLocation])

  if (!order) return <div>Laddar...</div>

  const displayItems = resolveDisplayItems(order, menu)
  const remaining = computeRemaining(order, readyAtMs, acceptedAtMs, now)
  const friendly = makeFriendlyMessage(order, remaining)
  const inProgressStatuses = ['ACCEPTED','PREPARING','IN_KITCHEN','OUT_FOR_DELIVERY'] as const
  const isInProgress = inProgressStatuses.includes(order.status as any)
  const isFinal = ['READY','DELIVERED','CANCELED','CANCELLED','REJECTED'].includes(order.status as any)
  const hasStructuredExtras = Array.isArray(order.items) && order.items.some((it: any) => Array.isArray(it?.selectedOptions) && it.selectedOptions.length > 0)
  const totalAmount = computeOrderTotalSEK(order, displayItems)
  // When totals are VAT-inclusive, the VAT share is total * (rate / (100 + rate))
  const vat12 = Math.round(totalAmount * (12 / 112))
  const cleanNote = (() => { let raw = order.note || ''; raw = raw.replace(/Bricknummer:[^\n]*/gi, ''); const idx = raw.indexOf('Valda tillbehör:'); return (idx === -1 ? raw : raw.slice(0, idx)).trim() })()
  const tray = (order as any)?.customer?.table || (order as any)?.table || extractTrayFromNote(order.note)

  return (
    <section className="grid" style={{ gap:16 }}>
      <h2 style={{ marginTop:0 }}>Order #{order.orderNumber || order.id}</h2>
      <div className="card">
        <div style={{ display:'flex', gap:12, alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <OrderStatusBadge status={order.status} />
            {tray && <span style={{ padding:'4px 8px', borderRadius:999, background:'#334155', color:'#fff', fontWeight:700 }}>{tray}</span>}
          </div>
          <div>
            {order.orderNumber && <div style={{ fontWeight:600 }}>Upphämtningsnummer: {order.orderNumber}</div>}
            {isInProgress && remaining !== null && remaining.totalSeconds > 0 && (
              <div className="muted">Tid kvar: {remaining.minutes} min {String(remaining.seconds).padStart(2,'0')} s</div>
            )}
            {!isInProgress && !isFinal && typeof order.estimatedWaitMinutes === 'number' && (
              <div className="muted">Beräknad väntetid: ~{order.estimatedWaitMinutes} min</div>
            )}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="muted" style={{ marginBottom:8 }}>{friendly}</div>
        {displayItems.length > 0 && (
          <div className="grid" style={{ gridTemplateColumns:'1fr' }}>
            {displayItems.map((it, idx) => (
              <div key={idx} style={{ display:'grid', gap:4 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <div>{it.qty}× {it.name}</div>
                  {typeof it.price === 'number' && <div className="muted">{displayPriceSEK(it.price)} kr</div>}
                </div>
                {Array.isArray((order.items || [])[idx]?.selectedOptions) && (order.items || [])[idx].selectedOptions.length>0 && (
                  <div className="muted" style={{ marginLeft:8 }}>
                    {(order.items || [])[idx].selectedOptions.map((s: any, i: number) => (
                      <span key={i}>{s.groupName ? `${s.groupName}: ` : ''}{s.name || s.optionId}{s.quantity && s.quantity>1 ? ` x${s.quantity}` : ''}{i < (order.items || [])[idx].selectedOptions.length-1 ? ', ' : ''}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!hasStructuredExtras && extractSelectedOptions(order.note).length > 0 && (
              <div className="muted" style={{ marginTop:8 }}>
                <div style={{ fontWeight:600 }}>Tillbehör</div>
                <div className="grid" style={{ gridTemplateColumns:'1fr' }}>
                  {extractSelectedOptions(order.note).map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            )}
            {cleanNote && (
              <div className="muted" style={{ marginTop:8 }}>
                <strong>Meddelande:</strong> {cleanNote}
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:12, fontSize:16, fontWeight:700 }}>
              <div>Totalsumma</div>
              <div>{totalAmount} kr</div>
            </div>
            <div className="muted" style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
              <div>Varav moms (12%)</div>
              <div>{vat12} kr</div>
            </div>
          </div>
        )}
      </div>
      {order.status==='OUT_FOR_DELIVERY' && (
        <div className="card">
          <h3 style={{ marginTop:0 }}>Kurirens position</h3>
          <div ref={mapRef} style={{ width:'100%', height:320, borderRadius:8, overflow:'hidden' }} />
        </div>
      )}
    </section>
  )
}

function resolveDisplayItems(order: Order, menu: MenuItem[]): { name: string; qty: number; price?: number }[] {
  const items = Array.isArray(order.items) ? order.items : []
  const findName = (item: any): string => {
    const id = String(item?.itemId || item?.menuItemId || '')
    const m = menu.find(x => String(x.id) === id)
    return item?.name || m?.name || 'Artikel'
  }
  return items.map((it: any) => ({ name: findName(it), qty: Number(it?.qty ?? it?.quantity ?? 1), price: Number(it?.price ?? it?.priceAtOrder ?? NaN) }))
}

function computeRemaining(order: Order, readyAtMs: number | null, acceptedAtMs: number | null, now: number): { totalSeconds: number; minutes: number; seconds: number } | null {
  const end = readyAtMs ?? (acceptedAtMs && typeof order.etaMinutes === 'number' ? acceptedAtMs + order.etaMinutes * 60_000 : null)
  if (!end) return null
  const remainMs = Math.max(0, end - now)
  const totalSeconds = Math.floor(remainMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return { totalSeconds, minutes, seconds }
}

function displayPriceSEK(amount: number): number {
  return amount >= 1000 ? Math.round(amount / 100) : amount
}

function makeFriendlyMessage(order: Order, remaining: { totalSeconds: number } | null): string {
  const t = (order.type as any) || (order.method as any)
  if (order.status === 'READY') {
    return 'Din mat är klar. Hoppas det smakar.'
  }
  if (remaining && remaining.totalSeconds === 0 && (order.status === 'ACCEPTED' || order.status === 'IN_KITCHEN' || order.status === 'PREPARING')) {
    return 'Förlåt, det tar lite längre tid än väntat. Vi jobbar så snabbt vi kan.'
  }
  if (t === 'DELIVERY') return 'Tack för din beställning! Vi förbereder den och meddelar när den är på väg.'
  if (t === 'DINE_IN') return 'Tack för din beställning! Vi börjar tillaga den. Vi säger till när den är redo.'
  return 'Tack för din beställning! Vi börjar tillaga den. Vi meddelar när den är klar för upphämtning.'
}

function extractTrayFromNote(note?: string): string | null {
  if (!note) return null
  const m = /Bricknummer:\s*(\d{1,2})/i.exec(note)
  return m ? m[1] : null
}

function extractSelectedOptions(note?: string): string[] {
  if (!note) return []
  const idx = note.indexOf('Valda tillbehör:')
  if (idx === -1) return []
  const tail = note.slice(idx + 'Valda tillbehör:'.length).trim()
  const lines = tail.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  // Expect lines like "- 2× Qozî (lamm): Ris, Pommes"; strip leading dash
  return lines.map(l => l.replace(/^[-\s]+/, ''))
}

function computeOrderTotalSEK(order: Order, items: { name: string; qty: number; price?: number }[]): number {
  if (typeof order.total === 'number') return displayPriceSEK(order.total)
  if (typeof order.subtotal === 'number') return displayPriceSEK(order.subtotal)
  const fromItems = items.reduce((sum, it) => sum + (typeof it.price === 'number' ? it.price * it.qty : 0), 0)
  return displayPriceSEK(fromItems)
}
