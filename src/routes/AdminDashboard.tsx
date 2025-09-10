import { useEffect, useState } from 'react'
import { Api, Order, OrderStatus, MenuItem, WaitTimesConfig, WaitTimeScheduleItem, OptionGroup, CateringRequest, CateringStatus, AdminUser } from '../api'
import OrderStatusBadge from '../components/OrderStatusBadge'
import MenuGrid from '../components/MenuGrid'
import { clearAdminToken } from '../api'
import { socket } from '../socket'

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [me, setMe] = useState<AdminUser | null>(null)
  const [stats, setStats] = useState<{ day:{orders:number;revenue:number}; week:{orders:number;revenue:number}; month:{orders:number;revenue:number}; topItems: { name:string; quantity:number }[] } | null>(null)
  const [eta, setEta] = useState<Record<string, number>>({})
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [activeTab, setActiveTab] = useState<'dashboard'|'orders'|'menu'|'inventory'|'wait'|'history'|'catering'|'settings'>('dashboard')
  const [catering, setCatering] = useState<CateringRequest[]>([])
  const [toasts, setToasts] = useState<Array<{ id: string; text: string }>>([])
  const [activeOrderDetail, setActiveOrderDetail] = useState<Order | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())
  const [defaultEta, setDefaultEta] = useState<{ dineIn: number; takeaway: number }>(() => {
    try {
      const raw = localStorage.getItem('admin.defaultEta')
      if (raw) return JSON.parse(raw)
    } catch {}
    return { dineIn: 15, takeaway: 20 }
  })

  const loadOrders = async (opts?: { activeOnly?: boolean }) => {
    const list = opts?.activeOnly ? await Api.listActiveOrders() : await Api.listOrders()
    setOrders(list)
    // Prefill ETA for active orders if not set yet
    setEta(prev => {
      const next = { ...prev }
      for (const o of list) {
        const isActive = ['PENDING','RECEIVED','ACCEPTED','PREPARING','IN_KITCHEN','READY','OUT_FOR_DELIVERY'].includes(o.status)
        const id = o.id
        if (!isActive) continue
        if (next[id] !== undefined) continue
        const method = (o.type || (o.method as any)) as string | undefined
        if (method === 'DINE_IN') next[id] = defaultEta.dineIn
        else if (method === 'TAKEAWAY' || method === 'TAKE_AWAY') next[id] = defaultEta.takeaway
      }
      return next
    })
  }
  const accept = async (id: string) => { await Api.acceptOrder(id, eta[id]); await loadOrders() }
  const reject = async (id: string) => { await Api.rejectOrder(id, 'Rejected'); await loadOrders() }
  const setStatus = async (id: string, status: OrderStatus) => { await Api.updateOrderStatus(id, status); await loadOrders() }
  const togglePaid = async (id: string, current?: boolean) => { await Api.adminSetPaid(id, !current); await loadOrders() }
  const confirmAndTogglePaid = async (id: string, current?: boolean) => {
    const message = current ? 'Markera ordern som obetald?' : 'Är denna order betald?'
    const ok = typeof window !== 'undefined' ? window.confirm(message) : true
    if (!ok) return
    // Optimistic update so the order disappears immediately when marking paid
    setOrders(prev => prev.map(o => (o.id === id ? { ...o, paid: !current } : o)))
    try {
      await togglePaid(id, current)
    } catch (e: any) {
      // Revert and notify
      setOrders(prev => prev.map(o => (o.id === id ? { ...o, paid: current } : o)))
      if (typeof window !== 'undefined') {
        window.alert('Kunde inte uppdatera betalstatus (saknar endpoint?).')
      }
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const current = await Api.adminMe().catch(()=>null)
        if (!mounted) return
        setMe(current)
        const role = current?.role
        const isSuperadmin = role === 'SUPERADMIN'
        await Promise.all([
          (async () => { await loadOrders({ activeOnly: !isSuperadmin }) })(),
          (async () => { const m = await Api.listMenu().catch(()=>null); if (m && mounted) setMenu(m) })(),
          (async () => { if (role !== 'KITCHEN') { const cfg = await Api.adminGetWaitTimes().catch(()=>null); if (!mounted || !cfg) return; setDefaultEta({ dineIn: typeof cfg.dineInMinutes === 'number' ? cfg.dineInMinutes : defaultEta.dineIn, takeaway: typeof cfg.takeawayMinutes === 'number' ? cfg.takeawayMinutes : defaultEta.takeaway }) } })(),
          ...(isSuperadmin ? [
            (async () => { const s = await Api.getOverviewStats().catch(()=>null); if (mounted) setStats(s as any) })(),
            (async () => { const c = await Api.adminListCateringRequests().catch(()=>null); if (c && mounted) setCatering(c) })()
          ] : [])
        ])
      } finally {
        // continue
      }
    })()

    // Live updates via sockets per backend docs
    socket.emit('joinAdmin')
    const onNew = (order: any) => {
      const normalized = normalizeIncomingOrder(order)
      setOrders(prev => [normalized, ...prev])
      // Prefill ETA for the new active order
      setEta(prev => {
        const method = (normalized.type || (normalized.method as any)) as string | undefined
        const next: any = { ...prev }
        if (method === 'DINE_IN') next[normalized.id] = defaultEta.dineIn
        else if (method === 'TAKEAWAY' || method === 'TAKE_AWAY') next[normalized.id] = defaultEta.takeaway
        return next
      })
    }
    const onUpdate = (payload: any) => {
      const id = String(payload._id || payload.id)
      setOrders(prev => {
        const next = prev.map(o => (String(o.id) === id ? { ...o, ...payload } as any : o))
        // If order is now READY and paid, remove from active list UI immediately by keeping it in array but filters will exclude it
        return next
      })
      // Refresh stats on changes
      if (isSuperadmin) Api.getOverviewStats().then(setStats as any).catch(()=>{})
    }
    socket.on('orders:new', onNew)
    socket.on('orders:update', onUpdate)
    const onCateringNew = (doc: any) => {
      // Minimal normalize to keep UI consistent
      setCatering(prev => [{
        id: String(doc?.id || doc?._id || ''),
        contactName: String(doc?.contactName || doc?.name || ''),
        phone: String(doc?.phone || ''),
        email: String(doc?.email || ''),
        company: doc?.company || undefined,
        eventDate: doc?.eventDate || undefined,
        eventTime: doc?.eventTime || undefined,
        guests: typeof doc?.guests === 'number' ? doc.guests : (doc?.guests ? Number(doc.guests) : undefined),
        budgetPerPersonKr: typeof doc?.budgetPerPersonKr === 'number' ? doc.budgetPerPersonKr : (doc?.budgetPerPersonKr ? Number(doc.budgetPerPersonKr) : undefined),
        street: doc?.street || doc?.locationAddress || undefined,
        city: doc?.city || undefined,
        postalCode: doc?.postalCode || undefined,
        layout: doc?.layout,
        needsEquipment: doc?.needsEquipment,
        requiresServingStaff: doc?.requiresServingStaff,
        allergies: doc?.allergies || doc?.dietary || undefined,
        notes: doc?.notes || doc?.message || undefined,
        status: (doc?.status || 'NEW') as CateringStatus,
        createdAt: doc?.createdAt
      }, ...prev])

      // Show a toast
      try {
        const name = String(doc?.contactName || doc?.name || 'Ny förfrågan')
        const guests = doc?.guests ? ` • ${doc.guests} gäster` : ''
        const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`
        const text = `Ny cateringförfrågan: ${name}${guests}`
        setToasts(prev => [{ id, text }, ...prev])
      } catch {}
    }
    socket.on('catering:new', onCateringNew)
    return () => {
      socket.off('orders:new', onNew)
      socket.off('orders:update', onUpdate)
      socket.off('catering:new', onCateringNew)
    }
  }, [])

  // If user is not superadmin, default to orders tab
  useEffect(() => {
    if (me && me.role !== 'SUPERADMIN' && activeTab === 'dashboard') {
      setActiveTab('orders')
    }
  }, [me, activeTab])

  // ticking clock for admin countdowns
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Restore persisted catering toasts on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('admin.cateringToasts')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setToasts(parsed)
      }
    } catch {}
  }, [])

  // Persist toasts whenever they change
  useEffect(() => {
    try {
      if (toasts.length > 0) localStorage.setItem('admin.cateringToasts', JSON.stringify(toasts))
      else localStorage.removeItem('admin.cateringToasts')
    } catch {}
  }, [toasts])

  // Clear toasts when visiting the Catering tab
  useEffect(() => {
    if (activeTab === 'catering') {
      setToasts([])
      try { localStorage.removeItem('admin.cateringToasts') } catch {}
    }
  }, [activeTab])

  const role = me?.role
  const isKassa = role === 'KASSA'
  const isKitchen = role === 'KITCHEN'
  const isSuperadmin = role === 'SUPERADMIN'

  return (
    <section className="grid" style={{ gap:16 }}>
      {/* Toasts */}
      <div style={{ position:'fixed', top:16, right:16, zIndex:1000, display:'grid', gap:8 }}>
        {toasts.map(t => (
          <div key={t.id} className="pill" style={{ background:'#141414', borderColor:'#444', cursor:'pointer' }} onClick={() => { setActiveTab('catering') }}>
            <span className="dot"/>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns: isSuperadmin ? '240px 1fr' : '1fr', gap:16 }}>
        {isSuperadmin && (
        <aside className="card" style={{ position:'sticky', top:16, alignSelf:'start' }}>
          <nav style={{ display:'grid', gap:8 }}>
            {isSuperadmin && (
              <button className="btn" style={{ height:48, textAlign:'left', justifyContent:'flex-start' }} onClick={()=>setActiveTab('dashboard')}>Översikt</button>
            )}
            <button className="btn" style={{ height:48, textAlign:'left', justifyContent:'flex-start' }} onClick={()=>setActiveTab('orders')}>Beställningar</button>
            <button className="btn" style={{ height:48, textAlign:'left', justifyContent:'flex-start' }} onClick={()=>setActiveTab('menu')}>Meny</button>
            {isSuperadmin && (
              <button className="btn" style={{ height:48, textAlign:'left', justifyContent:'flex-start' }} onClick={()=>setActiveTab('inventory')}>Lager</button>
            )}
            <button className="btn" style={{ height:48, textAlign:'left', justifyContent:'flex-start' }} onClick={()=>setActiveTab('wait')}>Väntetider</button>
            {isSuperadmin && (
              <>
                <button className="btn" style={{ height:48, textAlign:'left', justifyContent:'flex-start' }} onClick={()=>setActiveTab('history')}>Historik</button>
                <button className="btn" style={{ height:48, textAlign:'left', justifyContent:'flex-start' }} onClick={()=>setActiveTab('catering')}>Catering</button>
                <button className="btn" style={{ height:48, textAlign:'left', justifyContent:'flex-start' }} onClick={()=>setActiveTab('settings')}>Inställningar</button>
              </>
            )}
            <LogoutButton />
          </nav>
        </aside>
        )}
        <div style={{ display:'grid', gap:16 }}>
          {!isSuperadmin && (
            <div className="card" style={{ position:'sticky', top:16, zIndex:40, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button className={`btn ${activeTab==='orders' ? '' : 'secondary'}`} onClick={()=>setActiveTab('orders')}>Beställningar</button>
                {isKassa && <button className={`btn ${activeTab==='menu' ? '' : 'secondary'}`} onClick={()=>setActiveTab('menu')}>Meny</button>}
                {isKassa && <button className={`btn ${activeTab==='wait' ? '' : 'secondary'}`} onClick={()=>setActiveTab('wait')}>Väntetider</button>}
              </div>
              <LogoutButton />
            </div>
          )}
          {activeTab === 'dashboard' && isSuperadmin && (
            <DashboardPanel orders={orders} stats={stats} />
          )}

      {activeTab === 'orders' && (
        <div>
          <h3 style={{ marginTop:0 }}>Aktiva beställningar</h3>
          {(() => {
            const visible = isKitchen
              ? orders.filter(o => isOrderActive(o))
              : orders.filter(o => isOrderActive(o) || (o.status === 'READY' && !o.paid))
            if (visible.length === 0) return <div className="card">Inga beställningar ännu.</div>
            return (
              <div className="grid">
                {visible.map(o=> (
                <div className="card" key={o.id} style={{ cursor:'pointer' }} onClick={() => setActiveOrderDetail(o)}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <strong>#{String(o.orderNumber || o.id).slice(-5).padStart(5,'0')}</strong>
                        <OrderStatusBadge status={o.status} />
                        <MethodBadge value={(o.type as any) || (o.method as any)} />
                        {/* Tray number bubble next to payment badge if present */}
                        <PaidBadge paid={o.paid} method={o.paymentMethod} onClick={() => confirmAndTogglePaid(o.id, o.paid)} />
                        {(() => {
                          const tray = (o as any)?.customer?.table || (o as any)?.table || extractTrayFromNote((o as any)?.note)
                          return tray ? (<span style={{ padding:'4px 8px', borderRadius:999, background:'#334155', color:'#fff', fontWeight:700 }}>{tray}</span>) : null
                        })()}
                      </div>
                      <div className="muted">
                        {o.customerName || o.customer?.name}
                        {typeof (o.total ?? o.subtotal) === 'number' && <> • {displayPriceSEK(o.total ?? o.subtotal)} kr</>}
                        {o.createdAt && <> • {formatSwedishTimeOnly(o.createdAt)}</>}
                        {renderCountdown(o, now)}
                      </div>
                      {/* Items list – one per row with extras beneath, similar to customer view */}
                      <div className="grid" style={{ gridTemplateColumns:'1fr', gap:6, marginTop:6 }}>
                        {(o.items || []).map((raw: any, idx: number) => {
                          const display = resolveDisplayItems(o, menu)[idx]
                          const name = display?.name || raw?.name || ''
                          const qty = Number(raw?.qty ?? raw?.quantity ?? 1)
                          const extras = Array.isArray(raw?.selectedOptions) ? raw.selectedOptions : []
                          return (
                            <div key={idx} style={{ display:'grid', gap:4 }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <div><strong>{qty}× {name}</strong></div>
                              </div>
                              {extras.length > 0 && (
                                <div className="muted" style={{ marginLeft:8 }}>
                                  {extras.map((s: any, i: number) => (
                                    <span key={i}>{s.groupName ? `${s.groupName}: ` : ''}{s.name || s.optionId}{s.quantity && s.quantity>1 ? ` x${s.quantity}` : ''}{i < extras.length-1 ? ', ' : ''}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {(() => { const clean = cleanNoteForDisplay((o as any)?.note); return clean ? <div className="muted" style={{ marginTop:6 }}><strong>Meddelande:</strong> {clean}</div> : null })()}
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }} onClick={(e)=>e.stopPropagation()}>
                      <input type="number" min={5} max={90} placeholder="ETA (min)" value={eta[o.id] ?? o.etaMinutes ?? ''} onChange={e=>setEta(prev=>({ ...prev, [o.id]: Number(e.target.value) }))} />
                      <button className="btn" onClick={()=>accept(o.id)}>Acceptera</button>
                      <button className="btn" onClick={()=>setStatus(o.id,'IN_KITCHEN')}>Tillagar</button>
                      <button className="btn" onClick={()=>setStatus(o.id,'READY')}>Klar</button>
                      {(o.type === 'DELIVERY' || o.method === 'DELIVERY') && (
                        <>
                          <button className="btn" onClick={()=>setStatus(o.id,'OUT_FOR_DELIVERY')}>Skickad</button>
                          <button className="btn" onClick={()=>setStatus(o.id,'DELIVERED')}>Levererad</button>
                        </>
                      )}
                      <button className="btn secondary" onClick={()=>setStatus(o.id,'CANCELED')}>Avbryt</button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            )
          })()}
        </div>
      )}

      {activeTab === 'menu' && (isSuperadmin || isKassa) && (
        <div>
          <h3 style={{ marginTop:0 }}>{isSuperadmin ? 'Menyhanterare' : 'Meny (Order)'}</h3>
          {isSuperadmin ? (
            <MenuManager menu={menu} onMenuChange={setMenu} />
          ) : (
            <KassaMenuOrder menu={menu} />
          )}
        </div>
      )}

      {activeTab === 'inventory' && isSuperadmin && (
        <div>
          <h3 style={{ marginTop:0 }}>Lager</h3>
          <InventoryPanel menu={menu} onToggle={(id, isAvailable) => {
            setMenu(prev => prev.map(m => (getMenuItemId(m)===String(id) ? { ...m, isAvailable } : m)))
          }} />
        </div>
      )}

      {activeTab === 'wait' && (isSuperadmin || isKassa) && (
        <div>
          <h3 style={{ marginTop:0 }}>Väntetider</h3>
          <WaitTimesPanel readOnly={!isSuperadmin} />
        </div>
      )}

      {activeTab === 'history' && isSuperadmin && (
        <div>
          <h3 style={{ marginTop:0 }}>Historik</h3>
          <div className="grid">
            {Object.entries(groupHistoryByDate(orders)).map(([date, list]) => (
              <div key={date} className="card">
                <h4 style={{ marginTop:0 }}>{date}</h4>
                <div className="grid" style={{ gridTemplateColumns:'1fr' }}>
                  {list.map(o => (
                    <div key={o.id} className="card" style={{ cursor:'pointer' }} onClick={() => setActiveOrderDetail(o)}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'space-between' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <strong>#{o.orderNumber || o.id}</strong>
                          <OrderStatusBadge status={o.status} />
                        </div>
                        <div className="muted">{typeof (o.total ?? o.subtotal) === 'number' ? `${displayPriceSEK(o.total ?? o.subtotal)} kr` : ''}</div>
                      </div>
                      <div className="muted">{formatSwedishTimeOnly(o.createdAt)}</div>
                      <div className="grid" style={{ gridTemplateColumns:'1fr', gap:6, marginTop:6 }}>
                        {(o.items || []).map((raw: any, idx: number) => {
                          const display = resolveDisplayItems(o, menu)[idx]
                          const name = display?.name || raw?.name || ''
                          const qty = Number(raw?.qty ?? raw?.quantity ?? 1)
                          const extras = Array.isArray(raw?.selectedOptions) ? raw.selectedOptions : []
                          return (
                            <div key={idx} style={{ display:'grid', gap:4 }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <div><strong>{qty}× {name}</strong></div>
                              </div>
                              {extras.length > 0 && (
                                <div className="muted" style={{ marginLeft:8 }}>
                                  {extras.map((s: any, i: number) => (
                                    <span key={i}>{s.groupName ? `${s.groupName}: ` : ''}{s.name || s.optionId}{s.quantity && s.quantity>1 ? ` x${s.quantity}` : ''}{i < extras.length-1 ? ', ' : ''}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {(() => { const raw = o.note || ''; const clean = raw.split('Valda tillbehör:')[0].trim(); return clean ? <div className="muted" style={{ marginTop:6 }}><strong>Meddelande:</strong> {clean}</div> : null })()}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeTab === 'catering' && isSuperadmin && (
        <CateringPanel list={catering} onStatusChange={async (id, status) => {
          const updated = await Api.adminUpdateCateringStatus(id, status)
          setCatering(prev => prev.map(c => (c.id === id ? updated : c)))
        }} />
      )}
      {activeTab === 'settings' && isSuperadmin && (
        <SettingsPanel />
      )}
      {activeOrderDetail && (
        <OrderDetailsModal order={activeOrderDetail} menu={menu} onClose={() => setActiveOrderDetail(null)} />
      )}
        </div>
      </div>
    </section>
  )
}

function OrderDetailsModal({ order, menu, onClose }: { order: Order; menu: MenuItem[]; onClose: () => void }) {
  return (
    <div className="card" onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'grid', placeItems:'center', zIndex:1000 }}>
      <div className="card" onClick={(e)=>e.stopPropagation()} style={{ width:'min(760px, 92vw)', maxHeight:'90vh', overflow:'auto', display:'grid', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3 style={{ marginTop:0 }}>Order #{order.orderNumber || order.id}</h3>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="muted">{new Date(order.createdAt).toLocaleString('sv-SE')}</div>
        <div className="card" style={{ display:'grid', gap:6 }}>
          <div><strong>Kund:</strong> {order.customerName || order.customer?.name || '-'}</div>
          <div><strong>Telefon:</strong> {order.phone || order.customer?.phone || '-'}</div>
          {order.email && <div><strong>E-post:</strong> {order.email}</div>}
          <div><strong>Metod:</strong> {(() => { const v = (order.type as any) || (order.method as any); return v==='DINE_IN' ? 'Äta här' : (v==='TAKEAWAY' || v==='TAKE_AWAY') ? 'Avhämtning' : v==='DELIVERY' ? 'Utkörning' : String(v||''); })()}</div>
          {(() => { const clean = cleanNoteForDisplay(order.note); return clean ? <div><strong>Meddelande:</strong> {clean}</div> : null })()}
        </div>
        <div className="grid" style={{ gridTemplateColumns:'1fr', gap:6 }}>
          {(order.items || []).map((raw: any, idx: number) => {
            const name = (menu.find(m => String((m as any).id) === String(raw?.itemId || raw?.menuItemId))?.name) || raw?.name || 'Artikel'
            const qty = Number(raw?.qty ?? raw?.quantity ?? 1)
            const extras = Array.isArray(raw?.selectedOptions) ? raw.selectedOptions : []
            return (
              <div key={idx} style={{ display:'grid', gap:4 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div><strong>{qty}× {name}</strong></div>
                  {typeof raw?.price === 'number' && <div className="muted">{displayPriceSEK(raw.price)} kr</div>}
                </div>
                {extras.length > 0 && (
                  <div className="muted" style={{ marginLeft:8 }}>
                    {extras.map((s: any, i: number) => (
                      <span key={i}>{s.groupName ? `${s.groupName}: ` : ''}{s.name || s.optionId}{s.quantity && s.quantity>1 ? ` x${s.quantity}` : ''}{i < extras.length-1 ? ', ' : ''}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontWeight:600 }}>
          <div>Summa</div>
          <div>{typeof (order.total ?? order.subtotal) === 'number' ? displayPriceSEK(order.total ?? order.subtotal) : ''} kr</div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button className="btn" onClick={onClose}>Stäng</button>
        </div>
      </div>
    </div>
  )
}

function CateringPanel({ list, onStatusChange }: { list: CateringRequest[]; onStatusChange: (id: string, status: CateringStatus) => void | Promise<void> }) {
  const statuses: CateringStatus[] = ['NEW','VIEWED','CONTACTED','QUOTED','CONFIRMED','REJECTED','ARCHIVED']
  const [filter, setFilter] = useState<CateringStatus | 'ALL'>('ALL')
  const filtered = list
    .slice()
    .sort((a,b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
    .filter(x => filter === 'ALL' ? true : x.status === filter)
  const svStatus = (s: CateringStatus): string => {
    switch (s) {
      case 'NEW': return 'Ny'
      case 'VIEWED': return 'Visad'
      case 'CONTACTED': return 'Kontaktad'
      case 'QUOTED': return 'Offert skickad'
      case 'CONFIRMED': return 'Bekräftad'
      case 'REJECTED': return 'Avslagen'
      case 'ARCHIVED': return 'Arkiverad'
      default: return String(s)
    }
  }
  const svLayout = (l: any): string => {
    switch (l) {
      case 'BUFFET': return 'Buffé'
      case 'PLATED': return 'Tallriksservering'
      case 'FAMILY_STYLE': return 'Familjeservering'
      case 'OTHER': return 'Annat'
      default: return l ? String(l) : ''
    }
  }

  return (
    <div>
      <h3 style={{ marginTop:0 }}>Cateringförfrågningar</h3>
      <div className="card" style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <label>Statusfilter:</label>
        <select value={filter} onChange={e=>setFilter(e.target.value as any)}>
          <option value="ALL">Alla</option>
          {statuses.map(s => <option key={s} value={s}>{svStatus(s)}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? (
        <div className="card">Inga förfrågningar.</div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns:'1fr', gap:12 }}>
          {filtered.map(c => (
            <div key={c.id} className="card" style={{ display:'grid', gap:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                <div style={{ display:'grid' }}>
                  <strong>{c.contactName}</strong>
                  <div className="muted" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <span>{c.phone}</span>
                    {c.email && <span>• {c.email}</span>}
                    {c.company && <span>• {c.company}</span>}
                    {c.createdAt && <span>• {new Date(c.createdAt).toLocaleString('sv-SE')}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <select value={c.status} onChange={e=>onStatusChange(c.id, e.target.value as CateringStatus)}>
                    {statuses.map(s => <option key={s} value={s}>{svStatus(s)}</option>)}
                  </select>
                </div>
              </div>
              <div className="muted" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {c.eventDate && <span>Datum: {c.eventDate}{c.eventTime ? ` ${c.eventTime}` : ''}</span>}
                {typeof c.guests === 'number' && <span>• Gäster: {c.guests}</span>}
                {typeof c.budgetPerPersonKr === 'number' && <span>• Budget/pp: {c.budgetPerPersonKr} kr</span>}
                {c.layout && <span>• Upplägg: {svLayout(c.layout)}</span>}
                {c.requiresServingStaff && <span>• Personal: {c.requiresServingStaff === 'YES' ? 'Ja' : 'Nej'}</span>}
                {c.needsEquipment && <span>• Utrustning: {c.needsEquipment === 'YES' ? 'Ja' : 'Nej'}</span>}
              </div>
              {(c.street || c.postalCode || c.city) && (
                <div className="muted">Adress: {[c.street, c.postalCode, c.city].filter(Boolean).join(', ')}</div>
              )}
              {c.allergies && (
                <div><strong>Allergier/önskemål:</strong> {c.allergies}</div>
              )}
              {c.notes && (
                <div><strong>Övrigt:</strong> {c.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InventoryPanel({ menu, onToggle }: { menu: MenuItem[]; onToggle: (id: string | number, isAvailable: boolean) => void }) {
  const toggle = async (m: MenuItem) => {
    const next = !m.isAvailable
    try {
      await Api.updateMenuItem(getMenuItemId(m), { isAvailable: next })
      onToggle(getMenuItemId(m), next)
    } catch {
      onToggle(getMenuItemId(m), next)
    }
  }
  return (
    <div className="grid">
      {menu.map(m => (
        <div key={getMenuItemId(m)} className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {m.imageUrl && <img src={m.imageUrl} alt={m.name} style={{ width:48, height:48, objectFit:'cover', borderRadius:8 }} />}
            <div>
              <div>{m.name}</div>
              <div className="muted">{displayPriceSEK(m.price)} kr</div>
            </div>
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="checkbox" checked={!!m.isAvailable} onChange={()=>toggle(m)} />
            <span>{m.isAvailable ? 'Tillgänglig' : 'Dold'}</span>
          </label>
        </div>
      ))}
    </div>
  )
}

function KassaMenuOrder({ menu }: { menu: MenuItem[] }) {
  const [lines, setLines] = useState<Array<{ item: MenuItem; qty: number; selectedOptions?: { groupId: string; optionId: string; quantity: number }[] }>>([])
  // Kassa flow: always dine-in; collect optional tray number (bordplacering)
  const [table, setTable] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const add = (item: MenuItem, selected?: any[]) => {
    setLines(prev => {
      const idx = prev.findIndex(l => String(l.item.id) === String(item.id) && JSON.stringify(l.selectedOptions||[]) === JSON.stringify((selected||[]).map(s=>({ groupId:String(s.groupId), optionId:String(s.optionId), quantity:Number(s.quantity||1) }))))
      if (idx !== -1) {
        const next = [...prev]; next[idx] = { ...next[idx], qty: next[idx].qty + 1 }; return next
      }
      const sel = Array.isArray(selected) ? selected.map(s => ({ groupId: String(s.groupId), optionId: String(s.optionId), quantity: Number(s.quantity || 1) })) : undefined
      return [...prev, { item, qty: 1, selectedOptions: sel }]
    })
  }
  const dec = (i: number) => setLines(prev => prev.map((l,idx)=> idx===i ? { ...l, qty: Math.max(0, l.qty-1) } : l).filter(l=>l.qty>0))
  const inc = (i: number) => setLines(prev => prev.map((l,idx)=> idx===i ? { ...l, qty: l.qty+1 } : l))
  const remove = (i: number) => setLines(prev => prev.filter((_,idx)=>idx!==i))

  const total = lines.reduce((sum, l) => sum + (l.item.price >= 1000 ? Math.round(l.item.price/100) : l.item.price) * l.qty, 0)

  const submitPayment = async (paymentMethod: 'CASH' | 'CARD') => {
    if (lines.length === 0) return
    setSubmitting(true)
    try {
      const payload = {
        type: 'DINE_IN' as const,
        items: lines.map(l => ({ menuItemId: String(l.item.id), quantity: l.qty, selectedOptions: l.selectedOptions })),
        note: table ? `Bricknummer: ${table}` : undefined,
        paymentMethod
      } as const
      const res = await Api.kassaCreateOrder(payload)
      if (res.paymentMethod === 'CASH') {
        alert(`Order #${res.orderNumber || res.orderId} skapad. Tack!`)
        setLines([]); setTable('')
      } else if (res.paymentMethod === 'CARD') {
        alert('Kortbetalning initierad. (Stripe-integration krävs)')
        setLines([]); setTable('')
      }
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Kunde inte skapa order')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns:'1fr', gap:16 }}>
      <div className="card">
        <MenuGrid
          onAdd={add}
          minColumnPx={220}
          dense
          columns={3}
          extraGridItem={(
            <div className="card" style={{ alignSelf:'start' }}>
              <KassaCartPanel lines={lines} dec={dec} inc={inc} remove={remove} table={table} setTable={setTable} total={total} submitting={submitting} submitPayment={submitPayment} />
            </div>
          )}
        />
      </div>
      {/* Cart panel now rendered as extra grid item inside MenuGrid */}
    </div>
  )
}

function KassaCartPanel({
  lines,
  dec,
  inc,
  remove,
  table,
  setTable,
  total,
  submitting,
  submitPayment
}: {
  lines: { item: MenuItem; qty: number }[]
  dec: (i: number) => void
  inc: (i: number) => void
  remove: (i: number) => void
  table: string
  setTable: (v: string) => void
  total: number
  submitting: boolean
  submitPayment: (method: 'CASH' | 'CARD') => Promise<void>
}) {
  return (
    <div style={{ display:'grid', gap:8 }}>
      <div className="muted">Äta här</div>
      <div className="grid" style={{ gridTemplateColumns:'1fr', gap:8 }}>
        {lines.length === 0 ? (
          <div className="muted">Tomt. Lägg till rätter från menyn.</div>
        ) : (
          lines.map((l, idx) => (
            <div key={idx} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center' }}>
              <div>
                <div><strong>{l.qty}× {l.item.name}</strong></div>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <button className="btn secondary" onClick={()=>dec(idx)}>-</button>
                <div>{l.qty}</div>
                <button className="btn secondary" onClick={()=>inc(idx)}>+</button>
                <button className="btn secondary" onClick={()=>remove(idx)}>Ta bort</button>
              </div>
            </div>
          ))
        )}
      </div>
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
      <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700 }}>
        <div>Summa</div>
        <div>{total} kr</div>
      </div>
      <div className="card" style={{ display:'grid', gap:8 }}>
        <div className="muted">Välj betalningssätt</div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" disabled={submitting || lines.length===0} onClick={()=>submitPayment('CASH')}>Kontant</button>
          <button className="btn" disabled={submitting || lines.length===0} onClick={()=>submitPayment('CARD')}>Kort</button>
        </div>
      </div>
    </div>
  )
}

function currencySEK(amount: number): string {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(amount)
}

function DashboardPanel({ orders, stats }: { orders: Order[]; stats: any | null }) {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfDay)
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7))
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Count revenue for orders that are actually paid (covers cash paid pickups before marking delivered)
  const isCountableRevenue = (o: Order) => o.paid === true || o.status === 'DELIVERED'
  const countable = orders.filter(isCountableRevenue)
  const revenueInRange = (from: Date) => countable
    .filter(o => new Date(o.createdAt) >= from)
    .reduce((sum, o) => sum + (o.total || o.subtotal || 0), 0)

  // Compute from local orders (totals in SEK) to avoid currency unit drift
  const today = revenueInRange(startOfDay)
  const week = revenueInRange(startOfWeek)
  const month = revenueInRange(startOfMonth)

  // Most common items – prefer backend stats when available
  let topItems: [string, number][] = []
  if (stats?.topItems && Array.isArray(stats.topItems)) {
    topItems = stats.topItems.map((t: any) => [t.name, t.quantity])
  } else {
    const itemCount = new Map<string, number>()
    orders.forEach(o => {
      (o.items || []).forEach(it => {
        itemCount.set(it.name, (itemCount.get(it.name) || 0) + it.qty)
      })
    })
    topItems = Array.from(itemCount.entries()).sort((a,b) => b[1]-a[1]).slice(0,5)
  }

  const pending = orders.filter(o => isOrderActive(o) || (o.status === 'READY' && !o.paid))

  return (
    <div style={{ display:'grid', gap:12 }}>
      <h2 style={{ marginTop:0, marginBottom:4 }}>Dashboard</h2>
      <div className="grid" style={{ gridTemplateColumns:'repeat(3, minmax(220px, 1fr))' }}>
        <div className="card" style={{ display:'grid', gap:6 }}>
          <div className="muted">Dagens försäljning</div>
          <div style={{ fontSize:28, fontWeight:700 }}>{currencySEK(today)}</div>
        </div>
        <div className="card" style={{ display:'grid', gap:6 }}>
          <div className="muted">Veckans försäljning</div>
          <div style={{ fontSize:28, fontWeight:700 }}>{currencySEK(week)}</div>
        </div>
        <div className="card" style={{ display:'grid', gap:6 }}>
          <div className="muted">Månadens försäljning</div>
          <div style={{ fontSize:28, fontWeight:700 }}>{currencySEK(month)}</div>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div className="card">
          <h3 style={{ marginTop:0 }}>Vanligaste rätter</h3>
          {topItems.length === 0 ? <div className="muted">Inga data</div> : (
            <div className="grid" style={{ gridTemplateColumns:'1fr' }}>
              {topItems.map(([name,count]) => (
                <div key={name} style={{ display:'flex', justifyContent:'space-between' }}>
                  <div>{name}</div>
                  <div>x{count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3 style={{ marginTop:0 }}>Pågående & inkommande</h3>
          {pending.length === 0 ? <div className="muted">Inget just nu</div> : (
            <div className="grid" style={{ gridTemplateColumns:'1fr' }}>
              {pending.map(o => (
                <div key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <div><strong>#{o.id}</strong></div>
                  <OrderStatusBadge status={o.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function isOrderActive(o: Order): boolean {
  return ['PENDING','RECEIVED','ACCEPTED','PREPARING','IN_KITCHEN','OUT_FOR_DELIVERY'].includes(o.status)
}

function groupHistoryByDate(orders: Order[]): Record<string, Order[]> {
  // History should exclude active and READY-but-unpaid orders
  const historyList = orders.filter(o => !isOrderActive(o) && !(o.status === 'READY' && !o.paid))
  const groups: Record<string, Order[]> = {}
  for (const o of historyList) {
    const d = new Date(o.createdAt)
    const key = d.toLocaleDateString('sv-SE')
    if (!groups[key]) groups[key] = []
    groups[key].push(o)
  }
  // Sort each group by time desc
  Object.values(groups).forEach(list => list.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
  // Return groups in date desc order by reconstructing an ordered object (render via Object.entries maintains insertion order)
  const sortedKeys = Object.keys(groups).sort((a,b) => {
    // Parse sv-SE date by constructing Date from components (YYYY-MM-DD not available), so fallback to Date.parse on locale string can be unreliable; instead use createdAt of first item
    const at = groups[a][0]?.createdAt || ''
    const bt = groups[b][0]?.createdAt || ''
    return new Date(bt).getTime() - new Date(at).getTime()
  })
  const ordered: Record<string, Order[]> = {}
  for (const k of sortedKeys) ordered[k] = groups[k]
  return ordered
}

function MethodBadge({ value }: { value: 'DINE_IN' | 'TAKEAWAY' | 'TAKE_AWAY' | 'DELIVERY' | string | undefined }) {
  const label = value === 'DINE_IN' ? 'Äta här' : (value === 'TAKEAWAY' || value === 'TAKE_AWAY') ? 'Ta med' : value === 'DELIVERY' ? 'Utkörning' : String(value || '')
  if (!label) return null
  return (
    <span style={{ padding:'4px 8px', borderRadius:999, background:'#475569', color:'#fff', fontWeight:700 }}>{label}</span>
  )
}

function PaidBadge({ paid, method, onClick }: { paid?: boolean; method?: 'CASH'|'CARD'|string; onClick?: () => void }) {
  // Always show a badge; paid === true => Betald, otherwise Obetald
  const label = paid === true ? 'Betald' : 'Obetald'
  if (!label) return null
  const bg = paid ? '#16a34a' : '#ef4444'
  const style: React.CSSProperties = { padding:'4px 8px', borderRadius:999, background:bg, color:'#111', fontWeight:700, cursor: onClick ? 'pointer' : 'default' }
  const handleClick: React.MouseEventHandler<HTMLSpanElement> | undefined = onClick
    ? (e) => { e.stopPropagation(); onClick() }
    : undefined
  return <span style={style} onClick={handleClick} title={paid ? 'Markera som obetald' : 'Markera som betald'}>{label}</span>
}

function MenuManager({ menu, onMenuChange }: { menu: MenuItem[]; onMenuChange: (next: MenuItem[]) => void }) {
  const [name, setName] = useState('')
  const [sekPrice, setSekPrice] = useState<number | ''>('')
  const [category, setCategory] = useState('Från Grillen')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isAvailable, setIsAvailable] = useState(true)
  const [previewUrl, setPreviewUrl] = useState('')
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setFile(f || null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(f ? URL.createObjectURL(f) : '')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || sekPrice === '' || Number.isNaN(Number(sekPrice))) return
    setLoading(true); setError(null)
    try {
      if (editingId) {
        const updated = await Api.updateMenuItemMultipart(editingId, {
          name,
          sekPrice: Number(sekPrice),
          category,
          description: description || undefined,
          file: file || undefined,
          isAvailable,
          optionGroups
        })
        onMenuChange(menu.map(m => (getMenuItemId(m) === getMenuItemId(updated as any) ? updated : m)))
      } else {
        const created = await Api.createMenuItemMultipart({
          name,
          sekPrice: Number(sekPrice),
          category,
          description: description || undefined,
          file: file || undefined,
          isAvailable,
          optionGroups
        })
        onMenuChange([created, ...menu])
      }
      resetForm()
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Kunde inte lägga till'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally { setLoading(false) }
  }

  const CATEGORIES = [
    'Från Grillen',
    'Varmrätter',
    'Mezerätter',
    'Drycker',
    'Tillbehör & Sötsaker'
  ]

  const normalizeAdminCategory = (raw?: string): string => {
    const c = (raw || '').trim().toLowerCase()
    if (!c) return 'Från Grillen'
    if (c.includes('förrätt') || c.includes('forratt') || c.includes('grill') || c.includes('från grillen') || c.includes('fran grillen')) return 'Från Grillen'
    if (c.includes('huvudrätt') || c.includes('varmrätt')) return 'Varmrätter'
    if (c.includes('meze')) return 'Mezerätter'
    if (c.startsWith('dryck') || c.includes('drycker') || c.includes('dricka')) return 'Drycker'
    if (c.includes('tillbeh') || c.includes('sidorätt') || c.includes('dessert') || c.includes('sötsak') || c.includes('sotsak') || c.includes('bröd') || c.includes('brod')) return 'Tillbehör & Sötsaker'
    return 'Från Grillen'
  }

  const onEdit = (m: MenuItem) => {
    setEditingId(getMenuItemId(m))
    setName(m.name)
    setSekPrice(m.price >= 1000 ? Math.round(m.price / 100) : m.price)
    setCategory(normalizeAdminCategory(m.category))
    setDescription(m.description || '')
    setIsAvailable(!!m.isAvailable)
    setFile(null)
    setOptionGroups(m.optionGroups || [])
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
  }

  const onDelete = async () => {
    if (!editingId) return
    const ok = typeof window !== 'undefined' ? window.confirm('Ta bort den här artikeln?') : true
    if (!ok) return
    setLoading(true); setError(null)
    try {
      await Api.deleteMenuItem(editingId)
      onMenuChange(menu.filter(m => getMenuItemId(m) !== String(editingId)))
      resetForm()
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Kunde inte ta bort'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally { setLoading(false) }
  }

  const deleteItemImmediate = async (m: MenuItem) => {
    const ok = typeof window !== 'undefined' ? window.confirm(`Ta bort "${m.name}"?`) : true
    if (!ok) return
    setLoading(true); setError(null)
    try {
      await Api.deleteMenuItem(m.id)
      onMenuChange(menu.filter(x => String(x.id) !== String(m.id)))
      if (editingId && String(editingId) === String(m.id)) resetForm()
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Kunde inte ta bort'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally { setLoading(false) }
  }

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setSekPrice('')
    setCategory('Från Grillen')
    setDescription('')
    setIsAvailable(true)
    setFile(null)
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl('') }
    setOptionGroups([])
  }

  return (
    <div className="grid" style={{ gap:16 }}>
      <form onSubmit={submit} className="card" style={{ display:'grid', gap:8 }}>
        <h4 style={{ marginTop:0 }}>{editingId ? 'Redigera menyartikel' : 'Lägg till menyartikel'}</h4>
        <input placeholder="Namn" value={name} onChange={e=>setName(e.target.value)} />
        <input type="number" placeholder="Pris (SEK)" value={sekPrice} onChange={e=>setSekPrice(e.target.value === '' ? '' : Number(e.target.value))} />
        <select value={category} onChange={e=>setCategory(e.target.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <textarea placeholder="Beskrivning" value={description} onChange={e=>setDescription(e.target.value)} rows={3} />
        <label className="btn" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
          Välj bild
          <input type="file" accept="image/*" onChange={onPickFile} style={{ display:'none' }} />
        </label>
        {previewUrl && (
          <div className="card" style={{ padding:8 }}>
            <div className="muted" style={{ marginBottom:8 }}>Förhandsvisning</div>
            <img src={previewUrl} alt="preview" style={{ width:'100%', maxHeight:200, objectFit:'cover', borderRadius:8 }} />
          </div>
        )}
        <OptionGroupsEditor value={optionGroups} onChange={setOptionGroups} />
        <div>
          <label style={{ display:'inline-flex', alignItems:'center', gap:8, justifyContent:'flex-start' }}>
            <input type="checkbox" checked={isAvailable} onChange={e=>setIsAvailable(e.target.checked)} />
            <span>Tillgänglig</span>
          </label>
          <div className="muted" style={{ marginTop:4 }}>
            När detta är ikryssat visas rätten i menyn och kan beställas. Avmarkera för att dölja den.
          </div>
        </div>
        {error && <div className="muted" style={{ color:'crimson' }}>{error}</div>}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Sparar...' : (editingId ? 'Spara ändringar' : 'Lägg till')}</button>
          {editingId && (
            <>
              <button type="button" className="btn secondary" onClick={resetForm} disabled={loading}>Avbryt</button>
              <button type="button" className="btn secondary" onClick={onDelete} disabled={loading}>
                Ta bort
              </button>
            </>
          )}
        </div>
      </form>
      <div className="grid">
        {menu.length === 0 ? (
          <div className="card">Inga artiklar laddade.</div>
        ) : (
          menu.map(m => (
            <div key={getMenuItemId(m)} className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, cursor:'pointer' }} onClick={() => onEdit(m)}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                {m.imageUrl && <img src={m.imageUrl} alt={m.name} style={{ width:56, height:56, objectFit:'cover', borderRadius:8 }} />}
                <div>
                  <div>{m.name}</div>
                  <div className="muted">{displayPriceSEK(m.price)} kr</div>
                </div>
              </div>
              <button className="btn secondary" onClick={(e) => { e.stopPropagation(); deleteItemImmediate(m) }}>Ta bort</button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function OptionGroupsEditor({ value, onChange }: { value: OptionGroup[]; onChange: (next: OptionGroup[]) => void }) {
  const addGroup = () => onChange([...(value || []), { name: '', min: 0, max: 1, allowHalf: false, options: [] }])
  const updateGroup = (idx: number, patch: Partial<OptionGroup>) => {
    const next = [...value]; next[idx] = { ...(next[idx] || { options: [] }), ...patch } as OptionGroup; onChange(next)
  }
  const removeGroup = (idx: number) => { const next = [...value]; next.splice(idx,1); onChange(next) }
  const addOption = (gIdx: number) => {
    const next = [...value]; const g = { ...(next[gIdx] || { options: [] }) } as OptionGroup; g.options = [...(g.options||[]), { name:'', priceDelta:0 }]; next[gIdx]=g; onChange(next)
  }
  const updateOption = (gIdx: number, oIdx: number, patch: any) => {
    const next = [...value]; const g = { ...(next[gIdx] || { options: [] }) } as OptionGroup; const opts = [...(g.options||[])]; opts[oIdx] = { ...(opts[oIdx]||{}), ...patch }; g.options = opts; next[gIdx]=g; onChange(next)
  }
  const removeOption = (gIdx: number, oIdx: number) => {
    const next = [...value]; const g = { ...(next[gIdx] || { options: [] }) } as OptionGroup; const opts = [...(g.options||[])]; opts.splice(oIdx,1); g.options = opts; next[gIdx]=g; onChange(next)
  }

  return (
    <div className="card" style={{ display:'grid', gap:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h4 style={{ margin:0 }}>Alternativ</h4>
        <button type="button" className="btn secondary" onClick={addGroup}>Lägg till grupp</button>
      </div>
      {(value || []).length === 0 && <div className="muted">Inga alternativ</div>}
      {(value || []).map((g, gi) => (
        <div key={gi} className="card" style={{ display:'grid', gap:8 }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr auto', gap:8 }}>
            <input placeholder="Gruppnamn (t.ex. Tillbehör)" value={g.name} onChange={e=>updateGroup(gi,{ name:e.target.value })} />
            <input type="number" min={0} placeholder="Min" value={g.min ?? ''} onChange={e=>updateGroup(gi,{ min: e.target.value===''?undefined:Number(e.target.value) })} />
            <input type="number" min={0} placeholder="Max" value={g.max ?? ''} onChange={e=>updateGroup(gi,{ max: e.target.value===''?undefined:Number(e.target.value) })} />
            <label style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="checkbox" checked={!!g.allowHalf} onChange={e=>updateGroup(gi,{ allowHalf: e.target.checked })} />
              Tillåt halv
            </label>
            <button type="button" className="btn secondary" onClick={()=>removeGroup(gi)}>Ta bort grupp</button>
          </div>
          <div className="grid" style={{ gridTemplateColumns:'1fr', gap:8 }}>
            {(g.options||[]).map((o, oi) => (
              <div key={oi} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:8 }}>
                <input placeholder="Alternativnamn (t.ex. Ris)" value={o.name || ''} onChange={e=>updateOption(gi,oi,{ name:e.target.value })} />
                <input type="number" placeholder="Pris +kr" value={o.priceDelta ?? ''} onChange={e=>updateOption(gi,oi,{ priceDelta: e.target.value===''?undefined:Number(e.target.value) })} />
                <input type="number" placeholder="Halv +kr" value={o.halfPriceDelta ?? ''} onChange={e=>updateOption(gi,oi,{ halfPriceDelta: e.target.value===''?undefined:Number(e.target.value) })} />
                <button type="button" className="btn secondary" onClick={()=>removeOption(gi,oi)}>Ta bort</button>
              </div>
            ))}
            <button type="button" className="btn secondary" onClick={()=>addOption(gi)}>Lägg till alternativ</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function displayPriceSEK(price: number): number {
  return price >= 1000 ? Math.round(price / 100) : price
}

function getMenuItemId(item: Partial<MenuItem> & Record<string, any>): string {
  const candidates = [(item as any).id, (item as any)._id, (item as any).itemId]
  const chosen = candidates.find(v => {
    if (v === undefined || v === null) return false
    const s = String(v)
    return s !== '' && s.toLowerCase() !== 'undefined' && s.toLowerCase() !== 'null'
  })
  return String(chosen ?? '')
}

function normalizeIncomingOrder(raw: any): Order {
  const items = Array.isArray(raw?.items) ? raw.items : []
  return {
    id: String(raw?.id || raw?._id || ''),
    items: items.map((it: any) => ({
      itemId: String(it?.itemId ?? it?.menuItemId ?? it?.id ?? ''),
      name: it?.name,
      price: Number(it?.price ?? it?.priceAtOrder ?? 0),
      qty: Number(it?.qty ?? it?.quantity ?? 1)
    })),
    subtotal: typeof raw?.subtotal === 'number' ? raw.subtotal : undefined,
    method: raw?.method,
    customer: raw?.customer,
    type: raw?.type,
    total: typeof raw?.total === 'number' ? raw.total : undefined,
    customerName: raw?.customerName,
    phone: raw?.phone,
    email: raw?.email,
    status: raw?.status,
    etaMinutes: raw?.etaMinutes,
    note: raw?.note || raw?.customer?.notes || raw?.customer?.note,
    orderNumber: raw?.orderNumber,
    driverGoogleEmail: raw?.driverGoogleEmail,
    driverLocation: raw?.driverLocation,
    createdAt: raw?.createdAt || new Date().toISOString()
  } as Order
}

function resolveDisplayItems(order: Order, menu: MenuItem[]): { name: string; qty: number }[] {
  const items = Array.isArray(order.items) ? order.items : []
  const findName = (raw: any): string => {
    const maybeId = String(raw?.itemId ?? raw?.menuItemId ?? raw?.id ?? '')
    const m = menu.find(x => getMenuItemId(x) === maybeId)
    return m?.name || raw?.name || 'Okänd rätt'
  }
  return items.map(it => ({ name: findName(it), qty: Number((it as any).qty ?? (it as any).quantity ?? 1) }))
}

function formatSwedishTimeOnly(dateIso: string): string {
  try {
    const d = new Date(dateIso)
    return d.toLocaleTimeString('sv-SE', { hour12: false, hour: '2-digit', minute: '2-digit' })
  } catch {
    return String(dateIso)
  }
}

function extractTrayFromNote(note?: string): string | null {
  if (!note) return null
  const m = /Bricknummer:\s*(\d{1,2})/i.exec(note)
  return m ? m[1] : null
}

function cleanNoteForDisplay(note?: string): string {
  if (!note) return ''
  // Remove tray line and any appended option list
  let s = String(note)
  s = s.replace(/Bricknummer:[^\n]*/gi, '')
  const idx = s.indexOf('Valda tillbehör:')
  if (idx !== -1) s = s.slice(0, idx)
  return s.trim()
}

function renderCountdown(o: Order, nowMs: number): React.ReactNode {
  try {
    const acceptedAt = o.acceptedAt ? new Date(o.acceptedAt).getTime() : undefined
    const etaMinutes = typeof o.etaMinutes === 'number' ? o.etaMinutes : undefined
    if (!etaMinutes) return null
    const base = acceptedAt || new Date(o.createdAt).getTime()
    const end = base + etaMinutes * 60_000
    const remainingMs = Math.max(0, end - nowMs)
    const totalSeconds = Math.floor(remainingMs / 1000)
    const mm = Math.floor(totalSeconds / 60)
    const ss = String(totalSeconds % 60).padStart(2, '0')
    return <> • {mm}:{ss}</>
  } catch { return null }
}

function extractSelectedOptions(note?: string): string[] {
  if (!note) return []
  const idx = note.indexOf('Valda tillbehör:')
  if (idx === -1) return []
  const tail = note.slice(idx + 'Valda tillbehör:'.length).trim()
  return tail.split(/\r?\n/).map(l => l.replace(/^[-\s]+/, '').trim()).filter(Boolean)
}

function WaitTimesPanel({ readOnly }: { readOnly?: boolean }) {
  const dayList: { label: string; value: number }[] = [
    { label: 'Söndag', value: 0 },
    { label: 'Måndag', value: 1 },
    { label: 'Tisdag', value: 2 },
    { label: 'Onsdag', value: 3 },
    { label: 'Torsdag', value: 4 },
    { label: 'Fredag', value: 5 },
    { label: 'Lördag', value: 6 }
  ]
  const [config, setConfig] = useState<WaitTimesConfig>({ dineInMinutes: 0, takeawayMinutes: 0, deliveryMinutes: 0, schedules: [], overrideSchedules: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const current = await Api.adminGetWaitTimes()
        if (!mounted) return
        if (current) setConfig({
          dineInMinutes: current.dineInMinutes ?? 0,
          takeawayMinutes: current.takeawayMinutes ?? 0,
          deliveryMinutes: current.deliveryMinutes ?? 0,
          overrideSchedules: current.overrideSchedules ?? false,
          schedules: Array.isArray(current.schedules) ? current.schedules : []
        })
      } catch {
        // keep defaults
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const onBaseChange = (field: 'dineInMinutes'|'takeawayMinutes'|'deliveryMinutes', value: string) => {
    const num = value === '' ? undefined : Number(value)
    setConfig(prev => ({ ...prev, [field]: num }))
  }

  const addSlot = (dayOfWeek: number) => {
    setConfig(prev => ({
      ...prev,
      schedules: [...(prev.schedules || []), { dayOfWeek, start: '', end: '', dineInMinutes: 10, takeawayMinutes: 10 }]
    }))
  }

  const updateSlot = (globalIdx: number, field: 'start'|'end'|'dineInMinutes'|'takeawayMinutes'|'deliveryMinutes', value: string | number) => {
    setConfig(prev => {
      const schedules = [...(prev.schedules || [])]
      const nextVal = (field === 'start' || field === 'end') ? String(value) : Number(value)
      schedules[globalIdx] = { ...schedules[globalIdx], [field]: nextVal }
      return { ...prev, schedules }
    })
  }

  const removeSlot = (globalIdx: number) => {
    setConfig(prev => {
      const schedules = [...(prev.schedules || [])]
      schedules.splice(globalIdx, 1)
      return { ...prev, schedules }
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload: WaitTimesConfig = {}
      if (config.dineInMinutes && config.dineInMinutes > 0) payload.dineInMinutes = config.dineInMinutes
      if (config.takeawayMinutes && config.takeawayMinutes > 0) payload.takeawayMinutes = config.takeawayMinutes
      if (config.deliveryMinutes && config.deliveryMinutes > 0) payload.deliveryMinutes = config.deliveryMinutes
      payload.overrideSchedules = !!config.overrideSchedules
      payload.schedules = config.schedules || []
      await Api.adminSetWaitTimes(payload)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card">Laddar...</div>

  return (
    <div className="grid" style={{ gap:16 }}>
      <div className="card" style={{ display:'grid', gap:8, gridTemplateColumns:'repeat(4, minmax(160px, 1fr))' }}>
        <div>
          <div className="muted">Standard Väntetid (Äta på plats)</div>
          <input type="number" min={0} value={config.dineInMinutes ?? ''} onChange={e=>onBaseChange('dineInMinutes', e.target.value)} disabled={!!readOnly} />
        </div>
        <div>
          <div className="muted">Standard Väntetid (Avhämtning)</div>
          <input type="number" min={0} value={config.takeawayMinutes ?? ''} onChange={e=>onBaseChange('takeawayMinutes', e.target.value)} disabled={!!readOnly} />
        </div>
        <div>
          <div className="muted">Standard Väntetid (Leverans, valfritt)</div>
          <input type="number" min={0} value={config.deliveryMinutes ?? ''} onChange={e=>onBaseChange('deliveryMinutes', e.target.value)} disabled={!!readOnly} />
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <input id="override" type="checkbox" checked={!!config.overrideSchedules} onChange={e=>setConfig(prev=>({ ...prev, overrideSchedules: e.target.checked }))} disabled={!!readOnly} />
          <label htmlFor="override">Nödläge: använd endast standardvärdena</label>
        </div>
      </div>

      {dayList.map(day => {
        const entries = (config.schedules || []).map((it, idx) => ({ it, idx })).filter(x => x.it.dayOfWeek === day.value)
        return (
          <div key={day.value} className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h4 style={{ marginTop:0, marginBottom:8 }}>{day.label}</h4>
              <button className="btn secondary" onClick={()=>addSlot(day.value)}>Lägg till tidsintervall</button>
            </div>
            <div className="grid" style={{ gridTemplateColumns:'1fr', gap:8 }}>
              {entries.length === 0 && <div className="muted">Inga intervall</div>}
              {entries.map(({ it, idx }) => (
                <div key={idx} style={{ display:'grid', gridTemplateColumns:'120px 120px 140px 140px 140px auto', alignItems:'center', gap:8 }}>
                  <input type="time" value={it.start} onChange={e=>updateSlot(idx, 'start', e.target.value)} disabled={!!readOnly} />
                  <input type="time" value={it.end} onChange={e=>updateSlot(idx, 'end', e.target.value)} disabled={!!readOnly} />
                  <input type="number" min={0} value={it.dineInMinutes ?? ''} onChange={e=>updateSlot(idx, 'dineInMinutes', Number(e.target.value))} placeholder="Dine-in (min)" disabled={!!readOnly} />
                  <input type="number" min={0} value={it.takeawayMinutes ?? ''} onChange={e=>updateSlot(idx, 'takeawayMinutes', Number(e.target.value))} placeholder="Avhämtning (min)" disabled={!!readOnly} />
                  <input type="number" min={0} value={it.deliveryMinutes ?? ''} onChange={e=>updateSlot(idx, 'deliveryMinutes', Number(e.target.value))} placeholder="Leverans (min)" disabled={!!readOnly} />
                  {!readOnly && <button className="btn secondary" onClick={()=>removeSlot(idx)}>Ta bort</button>}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <div>
        {!readOnly && <button className="btn" onClick={save} disabled={saving}>{saving ? 'Sparar...' : 'Spara'}</button>}
      </div>
    </div>
  )
}

function SettingsPanel() {
  const [username, setUsername] = useState('admin')
  const [email, setEmail] = useState('admin@example.com')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Online ordering status
  const [storeOpen, setStoreOpen] = useState<boolean>(true)
  const [storeMessage, setStoreMessage] = useState<string>('')
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusSaved, setStatusSaved] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const s = await Api.getStoreStatus()
        if (!mounted) return
        setStoreOpen(!!s.onlineOrdersOpen)
        setStoreMessage(s.message || '')
      } catch {
        // keep defaults
      } finally {
        if (mounted) setStatusLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const saveStoreStatus = async () => {
    setStatusSaving(true)
    setStatusSaved(false)
    try {
      await Api.adminSetStoreStatus({ onlineOrdersOpen: !!storeOpen, message: storeMessage || undefined })
      setStatusSaved(true)
    } finally {
      setStatusSaving(false)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setSaved(false)
    // Placeholder – wire to backend when endpoint exists
    await new Promise(r => setTimeout(r, 500))
    setSaving(false); setSaved(true)
  }

  return (
    <div className="grid" style={{ display:'grid', gap:12, maxWidth:680 }}>
      <div className="card" style={{ display:'grid', gap:12 }}>
        <h3 style={{ marginTop:0 }}>Onlinebeställningar</h3>
        {statusLoading ? (
          <div className="muted">Laddar status...</div>
        ) : (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'10px 12px', border:'1px solid #2a2a2a', borderRadius:8 }}>
              <div style={{ fontWeight:600 }}>Ta emot beställningar</div>
              <label style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                <span className="muted">Av</span>
                <input type="checkbox" checked={!!storeOpen} onChange={e=>setStoreOpen(e.target.checked)} />
                <span className="muted">På</span>
              </label>
            </div>
            <div className="muted">Stäng av när köket inte kan ta emot order online.</div>
            <div>
              <div className="muted" style={{ marginBottom:4 }}>Meddelande till kunder (visas när stängt)</div>
              <textarea placeholder="Vi tar emot onlinebeställningar under våra öppettider. Välkommen tillbaka då." value={storeMessage} onChange={e=>setStoreMessage(e.target.value)} rows={3} />
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <button className="btn" onClick={saveStoreStatus} disabled={statusSaving}>{statusSaving ? 'Sparar...' : 'Spara'}</button>
              {statusSaved && <div className="muted">Sparat!</div>}
            </div>
          </>
        )}
      </div>

      <form onSubmit={onSubmit} className="card" style={{ display:'grid', gap:8 }}>
        <h3 style={{ marginTop:0 }}>Övrigt</h3>
        <input placeholder="Användarnamn" value={username} onChange={e=>setUsername(e.target.value)} />
        <input type="email" placeholder="E-post" value={email} onChange={e=>setEmail(e.target.value)} />
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Sparar...' : 'Spara'}</button>
        {saved && <div className="muted">Sparat!</div>}
      </form>
    </div>
  )
}

function LogoutButton() {
  const onLogout = () => {
    clearAdminToken()
    if (typeof window !== 'undefined') window.location.assign('/admin/login')
  }
  return <button className="btn secondary" style={{ height:48 }} onClick={onLogout}>Logga ut</button>
}
