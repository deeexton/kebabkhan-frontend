import { useEffect, useState } from 'react'
import { Api, Order, OrderStatus, MenuItem, WaitTimesConfig, WaitTimeScheduleItem, OptionGroup } from '../api'
import OrderStatusBadge from '../components/OrderStatusBadge'
import { clearAdminToken } from '../api'
import { socket } from '../socket'

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<{ day:{orders:number;revenue:number}; week:{orders:number;revenue:number}; month:{orders:number;revenue:number}; topItems: { name:string; quantity:number }[] } | null>(null)
  const [eta, setEta] = useState<Record<string, number>>({})
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [activeTab, setActiveTab] = useState<'dashboard'|'orders'|'menu'|'inventory'|'wait'|'history'|'settings'>('dashboard')
  const [defaultEta, setDefaultEta] = useState<{ dineIn: number; takeaway: number }>(() => {
    try {
      const raw = localStorage.getItem('admin.defaultEta')
      if (raw) return JSON.parse(raw)
    } catch {}
    return { dineIn: 15, takeaway: 20 }
  })

  const loadOrders = async () => {
    const list = await Api.listOrders()
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
    loadOrders();
    Api.listMenu().then(setMenu).catch(()=>{})
    Api.getOverviewStats().then(setStats as any).catch(()=>{})
    // Pull current wait times to prefill ETAs
    Api.adminGetWaitTimes().then(cfg => {
      if (!cfg) return
      setDefaultEta({
        dineIn: typeof cfg.dineInMinutes === 'number' ? cfg.dineInMinutes : defaultEta.dineIn,
        takeaway: typeof cfg.takeawayMinutes === 'number' ? cfg.takeawayMinutes : defaultEta.takeaway
      })
    }).catch(()=>{})

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
      Api.getOverviewStats().then(setStats as any).catch(()=>{})
    }
    socket.on('orders:new', onNew)
    socket.on('orders:update', onUpdate)
    return () => {
      socket.off('orders:new', onNew)
      socket.off('orders:update', onUpdate)
    }
  }, [])

  return (
    <section className="grid" style={{ gap:16 }}>
      <div style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap:16 }}>
        <aside className="card" style={{ position:'sticky', top:16, alignSelf:'start' }}>
          <nav style={{ display:'grid', gap:8 }}>
            <button className="btn" style={{ height:48, textAlign:'left', justifyContent:'flex-start' }} onClick={()=>setActiveTab('dashboard')}>Översikt</button>
            <button className="btn" style={{ height:48, textAlign:'left', justifyContent:'flex-start' }} onClick={()=>setActiveTab('orders')}>Beställningar</button>
            <button className="btn" style={{ height:48, textAlign:'left', justifyContent:'flex-start' }} onClick={()=>setActiveTab('menu')}>Meny</button>
            <button className="btn" style={{ height:48, textAlign:'left', justifyContent:'flex-start' }} onClick={()=>setActiveTab('inventory')}>Lager</button>
            <button className="btn" style={{ height:48, textAlign:'left', justifyContent:'flex-start' }} onClick={()=>setActiveTab('wait')}>Väntetider</button>
            <button className="btn" style={{ height:48, textAlign:'left', justifyContent:'flex-start' }} onClick={()=>setActiveTab('history')}>Historik</button>
            <button className="btn" style={{ height:48, textAlign:'left', justifyContent:'flex-start' }} onClick={()=>setActiveTab('settings')}>Inställningar</button>
            <LogoutButton />
          </nav>
        </aside>
        <div style={{ display:'grid', gap:16 }}>
          {activeTab === 'dashboard' && (
            <DashboardPanel orders={orders} stats={stats} />
          )}

      {activeTab === 'orders' && (
        <div>
          <h3 style={{ marginTop:0 }}>Aktiva beställningar</h3>
          {orders.filter(o => isOrderActive(o) || (o.status === 'READY' && !o.paid)).length === 0 ? (
            <div className="card">Inga beställningar ännu.</div>
          ) : (
            <div className="grid">
              {orders.filter(o => isOrderActive(o) || (o.status === 'READY' && !o.paid)).map(o=> (
                <div className="card" key={o.id}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <strong>#{o.orderNumber || o.id}</strong>
                        <OrderStatusBadge status={o.status} />
                        <MethodBadge value={(o.type as any) || (o.method as any)} />
                        <PaidBadge paid={o.paid} method={o.paymentMethod} onClick={() => confirmAndTogglePaid(o.id, o.paid)} />
                      </div>
                      <div className="muted">
                        {o.customerName || o.customer?.name}
                        {typeof (o.total ?? o.subtotal) === 'number' && <> • {displayPriceSEK(o.total ?? o.subtotal)} kr</>}
                        {o.createdAt && <> • {formatSwedishTimeOnly(o.createdAt)}</>}
                      </div>
                      {resolveDisplayItems(o, menu).length > 0 && (
                        <div className="muted" style={{ marginTop:6 }}>
                          {resolveDisplayItems(o, menu).map((it, idx) => (
                            <span key={idx}>
                              {it.qty}× {it.name}{idx < resolveDisplayItems(o, menu).length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      {o.note && (
                        <div className="muted" style={{ marginTop:6 }}>
                          <strong>Meddelande:</strong> {o.note}
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
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
          )}
        </div>
      )}

      {activeTab === 'menu' && (
        <div>
          <h3 style={{ marginTop:0 }}>Menyhanterare</h3>
          <MenuManager menu={menu} onMenuChange={setMenu} />
        </div>
      )}

      {activeTab === 'inventory' && (
        <div>
          <h3 style={{ marginTop:0 }}>Lager</h3>
          <InventoryPanel menu={menu} onToggle={(id, isAvailable) => {
            setMenu(prev => prev.map(m => (getMenuItemId(m)===String(id) ? { ...m, isAvailable } : m)))
          }} />
        </div>
      )}

      {activeTab === 'wait' && (
        <div>
          <h3 style={{ marginTop:0 }}>Väntetider</h3>
          <WaitTimesPanel />
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          <h3 style={{ marginTop:0 }}>Historik</h3>
          <div className="grid">
            {Object.entries(groupHistoryByDate(orders)).map(([date, list]) => (
              <div key={date} className="card">
                <h4 style={{ marginTop:0 }}>{date}</h4>
                <div className="grid" style={{ gridTemplateColumns:'1fr' }}>
                  {list.map(o => (
                    <div key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <strong>#{o.orderNumber || o.id}</strong>
                          <OrderStatusBadge status={o.status} />
                        </div>
                        <div className="muted">{formatSwedishTimeOnly(o.createdAt)}</div>
                        {resolveDisplayItems(o, menu).length > 0 && (
                          <div className="muted" style={{ marginTop:6 }}>
                            {resolveDisplayItems(o, menu).map((it, idx) => (
                              <span key={idx}>
                                {it.qty}× {it.name}{idx < resolveDisplayItems(o, menu).length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="muted">{typeof (o.total ?? o.subtotal) === 'number' ? `${displayPriceSEK(o.total ?? o.subtotal)} kr` : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeTab === 'settings' && (
        <SettingsPanel />
      )}
        </div>
      </div>
    </section>
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
    <div style={{ display:'grid', gap:16 }}>
      <h2 style={{ marginTop:0 }}>Dashboard</h2>
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
  const label = typeof paid === 'boolean' ? (paid ? 'Betald' : 'Obetald') : (method === 'CASH' ? 'Obetald' : undefined)
  if (!label) return null
  const bg = paid ? '#16a34a' : '#ef4444'
  const style: React.CSSProperties = { padding:'4px 8px', borderRadius:999, background:bg, color:'#111', fontWeight:700, cursor: onClick ? 'pointer' : 'default' }
  return <span style={style} onClick={onClick} title={paid ? 'Markera som obetald' : 'Markera som betald'}>{label}</span>
}

function MenuManager({ menu, onMenuChange }: { menu: MenuItem[]; onMenuChange: (next: MenuItem[]) => void }) {
  const [name, setName] = useState('')
  const [sekPrice, setSekPrice] = useState<number | ''>('')
  const [category, setCategory] = useState('Förrätter')
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
    'Tillbehör',
    'Dryck',
    'Efterrätter',
    'Bröd & tillbehör'
  ]

  const onEdit = (m: MenuItem) => {
    setEditingId(getMenuItemId(m))
    setName(m.name)
    setSekPrice(m.price >= 1000 ? Math.round(m.price / 100) : m.price)
    setCategory(m.category)
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
    setCategory('Förrätter')
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

function WaitTimesPanel() {
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
          <input type="number" min={0} value={config.dineInMinutes ?? ''} onChange={e=>onBaseChange('dineInMinutes', e.target.value)} />
        </div>
        <div>
          <div className="muted">Standard Väntetid (Avhämtning)</div>
          <input type="number" min={0} value={config.takeawayMinutes ?? ''} onChange={e=>onBaseChange('takeawayMinutes', e.target.value)} />
        </div>
        <div>
          <div className="muted">Standard Väntetid (Leverans, valfritt)</div>
          <input type="number" min={0} value={config.deliveryMinutes ?? ''} onChange={e=>onBaseChange('deliveryMinutes', e.target.value)} />
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <input id="override" type="checkbox" checked={!!config.overrideSchedules} onChange={e=>setConfig(prev=>({ ...prev, overrideSchedules: e.target.checked }))} />
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
                  <input type="time" value={it.start} onChange={e=>updateSlot(idx, 'start', e.target.value)} />
                  <input type="time" value={it.end} onChange={e=>updateSlot(idx, 'end', e.target.value)} />
                  <input type="number" min={0} value={it.dineInMinutes ?? ''} onChange={e=>updateSlot(idx, 'dineInMinutes', Number(e.target.value))} placeholder="Dine-in (min)" />
                  <input type="number" min={0} value={it.takeawayMinutes ?? ''} onChange={e=>updateSlot(idx, 'takeawayMinutes', Number(e.target.value))} placeholder="Avhämtning (min)" />
                  <input type="number" min={0} value={it.deliveryMinutes ?? ''} onChange={e=>updateSlot(idx, 'deliveryMinutes', Number(e.target.value))} placeholder="Leverans (min)" />
                  <button className="btn secondary" onClick={()=>removeSlot(idx)}>Ta bort</button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <div>
        <button className="btn" onClick={save} disabled={saving}>{saving ? 'Sparar...' : 'Spara'}</button>
      </div>
    </div>
  )
}

function SettingsPanel() {
  const [username, setUsername] = useState('admin')
  const [email, setEmail] = useState('admin@example.com')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setSaved(false)
    // Placeholder – wire to backend when endpoint exists
    await new Promise(r => setTimeout(r, 500))
    setSaving(false); setSaved(true)
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ display:'grid', gap:8, maxWidth:480 }}>
      <h3 style={{ marginTop:0 }}>Inställningar</h3>
      <input placeholder="Användarnamn" value={username} onChange={e=>setUsername(e.target.value)} />
      <input type="email" placeholder="E-post" value={email} onChange={e=>setEmail(e.target.value)} />
      <button className="btn" type="submit" disabled={saving}>{saving ? 'Sparar...' : 'Spara'}</button>
      {saved && <div className="muted">Sparat!</div>}
    </form>
  )
}

function LogoutButton() {
  const onLogout = () => {
    clearAdminToken()
    if (typeof window !== 'undefined') window.location.assign('/admin/login')
  }
  return <button className="btn secondary" style={{ height:48 }} onClick={onLogout}>Logga ut</button>
}
