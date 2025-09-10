import axios from 'axios'

const RAW_API_BASE = (import.meta.env.VITE_API_BASE || '').toString().trim()

function ensureApiPrefix(base: string): string {
  if (!base) return '/api'
  // Absolute URL handling
  if (/^https?:\/\//i.test(base)) {
    try {
      const url = new URL(base)
      const path = url.pathname || '/'
      let newPath = path
      if (path === '/') newPath = '/api'
      else if (!path.startsWith('/api')) newPath = `${path.replace(/\/$/, '')}/api`
      url.pathname = newPath
      return `${url.origin}${url.pathname}`.replace(/\/$/, '')
    } catch {
      // fall through to relative handling
    }
  }
  // Relative path handling
  let p = base.startsWith('/') ? base : `/${base}`
  if (!p.startsWith('/api')) p = `${p.replace(/\/$/, '')}/api`
  return p
}

export const API_BASE = ensureApiPrefix(RAW_API_BASE)

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true
})

const ADMIN_TOKEN_KEY = 'adminToken'
let ADMIN_TOKEN_MEM: string | null = null

export function getAdminToken(): string | null {
  try {
    if (ADMIN_TOKEN_MEM && ADMIN_TOKEN_MEM !== 'undefined' && ADMIN_TOKEN_MEM !== 'null') return ADMIN_TOKEN_MEM
    const v = localStorage.getItem(ADMIN_TOKEN_KEY)
    if (!v || v === 'undefined' || v === 'null') return null
    return v
  } catch {
    return ADMIN_TOKEN_MEM
  }
}

export function setAdminToken(token: string): void {
  ADMIN_TOKEN_MEM = token
  try { localStorage.setItem(ADMIN_TOKEN_KEY, token) } catch {}
}

export function clearAdminToken(): void {
  ADMIN_TOKEN_MEM = null
  try { localStorage.removeItem(ADMIN_TOKEN_KEY) } catch {}
}

// Admin roles supported by backend: SUPERADMIN, KASSA, KITCHEN
export type AdminRole = 'SUPERADMIN' | 'KASSA' | 'KITCHEN'

export type AdminUser = {
  id: string
  email: string
  role: AdminRole
  createdAt?: string
}

api.interceptors.request.use(config => {
  const token = getAdminToken()
  if (token) {
    config.headers = { ...config.headers, Authorization: `Bearer ${token}` }
  }
  return config
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err?.response?.status === 401) {
      try {
        const url: string = err?.config?.url || ''
        // Only clear token if our identity endpoint says we are unauthorized
        if (/\/admin\/me\b/.test(url)) {
          clearAdminToken()
        }
      } catch {}
      // Let route guards handle navigation
    }
    return Promise.reject(err)
  }
)

export type MenuItem = {
  id: string
  name: string
  price: number
  category: string
  description?: string
  imageUrl?: string
  isAvailable?: boolean
  optionGroups?: OptionGroup[]
}

export type OptionGroup = {
  id?: string
  name: string
  min?: number
  max?: number
  allowHalf?: boolean
  options: Array<{ id?: string; name: string; priceDelta?: number; halfPriceDelta?: number; isAvailable?: boolean }>
}

export type OrderItem = {
  itemId: string
  name: string
  price: number
  qty: number
  selectedOptions?: Array<{ groupId: string; optionId: string; quantity: number; name?: string; groupName?: string; priceDeltaAtOrder?: number }>
}
// Support both legacy and backend enums
export type OrderMethod = 'DINE_IN' | 'TAKE_AWAY' | 'DELIVERY' | 'TAKEAWAY'
export type OrderStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'IN_KITCHEN'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'CANCELED'

// Order type accommodates both the legacy frontend shape and the backend shape
export type Order = {
  id: string
  // Legacy fields (customer basket flow)
  items?: OrderItem[]
  subtotal?: number
  method?: OrderMethod
  customer?: {
    name: string
    phone: string
    email?: string
    address?: string
    postalCode?: string
    notes?: string
    table?: string
  }
  // Backend fields
  type?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
  total?: number
  customerName?: string
  phone?: string
  email?: string
  status: OrderStatus
  etaMinutes?: number
  estimatedWaitMinutes?: number
  acceptedAt?: string
  readyAt?: string
  paid?: boolean
  paymentMethod?: 'CASH' | 'CARD'
  note?: string
  orderNumber?: string
  driverGoogleEmail?: string
  driverLocation?: { lat: number; lng: number }
  createdAt: string
}

export type WaitTimeScheduleItem = {
  dayOfWeek: number
  start: string
  end: string
  dineInMinutes?: number
  takeawayMinutes?: number
  deliveryMinutes?: number
}

export type WaitTimesConfig = {
  dineInMinutes?: number
  takeawayMinutes?: number
  deliveryMinutes?: number
  schedules?: WaitTimeScheduleItem[]
  overrideSchedules?: boolean
}

// Catering types (per backend docs)
export type CateringLayout = 'BUFFET' | 'PLATED' | 'FAMILY_STYLE' | 'OTHER'
export type YesNo = 'YES' | 'NO'
export type CateringStatus = 'NEW' | 'VIEWED' | 'CONTACTED' | 'QUOTED' | 'CONFIRMED' | 'REJECTED' | 'ARCHIVED'

export interface CateringRequestCreate {
  contactName: string
  phone: string
  email: string
  company?: string
  eventDate?: string
  eventTime?: string
  guests?: number
  budgetPerPersonKr?: number
  street?: string
  city?: string
  postalCode?: string
  layout?: CateringLayout
  needsEquipment?: YesNo
  requiresServingStaff?: YesNo
  allergies?: string
  notes?: string
}

export interface CateringRequest extends CateringRequestCreate {
  id: string
  status: CateringStatus
  createdAt?: string
}

export type StoreStatus = { onlineOrdersOpen: boolean; message?: string }

export const Api = {
  getWaitTimes: () => api.get<{ dineInMinutes: number; takeawayMinutes: number; deliveryMinutes?: number }>('wait-times').then(r => r.data),
  adminGetWaitTimes: () => api.get<WaitTimesConfig>('admin/wait-times').then(r => r.data).catch(()=>null),
  adminSetWaitTimes: (payload: WaitTimesConfig) => api.post<WaitTimesConfig>('admin/wait-times', payload).then(r => r.data).catch(()=>null),
  listMenu: () => api.get<any[]>('menu').then(r => r.data.map(normalizeMenuItem)),
  addMenuItem: (payload: { name: string; price: number; category?: string; description?: string; imageUrl?: string }) =>
    api.post<any>('menu-items', payload).then(r => normalizeMenuItem(r.data)),
  createMenuItemMultipart: async ({
    name,
    sekPrice,
    category,
    description,
    file,
    isAvailable = true,
    optionGroups
  }: {
    name: string
    sekPrice: number | string
    category: string
    description?: string
    file?: File
    isAvailable?: boolean
    optionGroups?: OptionGroup[]
  }): Promise<MenuItem> => {
    const form = new FormData()
    form.append('name', name)
    // Send integer kronor value as-is per currency guide
    form.append('price', String(Math.round(Number(sekPrice))))
    form.append('category', category)
    if (description) form.append('description', description)
    form.append('isAvailable', String(!!isAvailable))
    if (optionGroups && Array.isArray(optionGroups)) form.append('optionGroups', JSON.stringify(optionGroups))
    if (file) form.append('image', file)
    const { data } = await api.post<any>('menu-items', form, {
      headers: {
        // Let the browser set Content-Type with boundary for multipart
      }
    })
    return normalizeMenuItem(data)
  },
  updateMenuItemMultipart: async (
    id: string | number,
    {
      name,
      sekPrice,
      category,
      description,
      file,
      isAvailable,
      optionGroups
    }: {
      name?: string
      sekPrice?: number | string
      category?: string
      description?: string
      file?: File
      isAvailable?: boolean
      optionGroups?: OptionGroup[]
    }
  ): Promise<MenuItem> => {
    const form = new FormData()
    if (name !== undefined) form.append('name', name)
    if (sekPrice !== undefined) form.append('price', String(Math.round(Number(sekPrice))))
    if (category !== undefined) form.append('category', category)
    if (description !== undefined) form.append('description', description)
    if (isAvailable !== undefined) form.append('isAvailable', String(!!isAvailable))
    if (optionGroups && Array.isArray(optionGroups)) form.append('optionGroups', JSON.stringify(optionGroups))
    if (file) form.append('image', file)
    const { data } = await api.patch<any>(`menu-items/${id}`, form, { headers: {} })
    return normalizeMenuItem(data)
  },
  updateMenuItem: (id: string | number, payload: Partial<MenuItem>) =>
    api.patch<any>(`menu-items/${id}`, payload).then(r => normalizeMenuItem(r.data)),
  deleteMenuItem: (id: string | number) => api.delete<void>(`menu-items/${id}`).then(r => r.data),
  createOrder: (payload: {
    items: OrderItem[]
    method: OrderMethod
    customer: Order['customer']
  }) => api.post<{ orderId: string }>('orders', payload).then(r => r.data),
  createOrderV2: (payload: {
    type: 'DINE_IN' | 'TAKEAWAY'
    paymentMethod: 'CASH' | 'CARD'
    items: { menuItemId: string; quantity: number; selectedOptions?: { groupId: string; optionId: string; quantity: number }[] }[]
    customerName: string
    phone: string
    email?: string
    note?: string
    table?: string
  }) => api.post<{ orderId: string; clientSecret?: string | null; status: string; paymentMethod: 'CASH' | 'CARD'; orderNumber?: string }>('orders', payload).then(r => r.data),
  getOrder: (orderId: string) => api.get<any>(`orders/${orderId}`).then(r => normalizeOrder(r.data)),
  lookupOrderId: async (code: string): Promise<string> => {
    const { data } = await api.get<{ orderId: string }>(`orders/lookup/${code}`)
    return data.orderId
  },
  getOrderByNumber: async (orderNumber: string): Promise<Order> => {
    // Primary path per backend docs
    const { data } = await api.get<{ orderId: string }>(`orders/lookup/${orderNumber}`)
    const orderRes = await api.get<any>(`orders/${data.orderId}`)
    return normalizeOrder(orderRes.data)
  },
  adminLogin: async (email: string, password: string) => {
    const res = await api.post<any>('auth/login', { email, password })
    // Accept multiple token shapes for robustness
    let token: string | undefined = res.data?.token || res.data?.accessToken || res.data?.jwt || res.data?.idToken
    if (!token) {
      const authHeader: string | undefined = (res.headers?.authorization as any) || (res.headers?.Authorization as any)
      if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        token = authHeader.slice(7)
      }
    }
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new Error('Login succeeded but no token was returned')
    }
    setAdminToken(token)
    try { localStorage.setItem('admin.role', res.data?.role || '') } catch {}
    return token
  },
  adminMe: () => api.get<AdminUser>('admin/me').then(r => { try { localStorage.setItem('admin.role', r.data?.role || '') } catch {}; return r.data }),
  listOrders: () => api.get<any[]>('admin/orders').then(r => r.data.map(normalizeOrder)),
  listActiveOrders: () => api.get<any[]>('admin/orders/active').then(r => r.data.map(normalizeOrder)),
  getOverviewStats: () => api.get<{ day:{orders:number;revenue:number}; week:{orders:number;revenue:number}; month:{orders:number;revenue:number}; topItems: { menuItemId:string; name:string; quantity:number; revenue:number }[] }>('admin/stats/overview').then(r => r.data),
  // Accept and reject use dedicated endpoints in the backend
  acceptOrder: (orderId: string, etaMinutes?: number) =>
    api.post(`admin/orders/${orderId}/accept`, { etaMinutes }).then(r => r.data),
  rejectOrder: (orderId: string, reason?: string) =>
    api.post(`admin/orders/${orderId}/reject`, { reason }).then(r => r.data),
  updateOrderStatus: (orderId: string, status: OrderStatus) =>
    api.post(`admin/orders/${orderId}/status`, { status }).then(r => r.data),
  adminSetPaid: (orderId: string, paid: boolean) =>
    api.post(`admin/orders/${orderId}/paid`, { paid }).then(r => r.data),
  driverUpsertLocation: (token: string, orderId: string, lat: number, lng: number) =>
    api.post(`driver/orders/${orderId}/location`, { lat, lng }, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.data)
  ,
  // Catering (public)
  submitCateringRequest: (payload: CateringRequestCreate) =>
    api.post<{ id: string }>('catering-requests', payload).then(r => r.data),

  // Catering (admin)
  adminListCateringRequests: () =>
    api.get<CateringRequest[]>('admin/catering-requests').then(r => r.data.map(normalizeCateringRequest)),
  adminGetCateringRequest: (id: string) =>
    api.get<CateringRequest>(`admin/catering-requests/${id}`).then(r => normalizeCateringRequest(r.data)),
  adminUpdateCateringStatus: (id: string, status: CateringStatus) =>
    api.post<CateringRequest>(`admin/catering-requests/${id}/status`, { status }).then(r => normalizeCateringRequest(r.data))
  ,
  // Store status (online ordering)
  getStoreStatus: () => {
    try {
      const role = typeof localStorage !== 'undefined' ? localStorage.getItem('admin.role') : null
      const isAdminRoute = typeof window !== 'undefined' ? window.location.pathname.startsWith('/admin') : false
      if (isAdminRoute && role === 'KITCHEN') {
        return Promise.resolve({ onlineOrdersOpen: true } as StoreStatus)
      }
    } catch {}
    return api.get<StoreStatus>('store/status').then(r => r.data)
  },
  adminSetStoreStatus: (payload: Partial<StoreStatus>) => api.post<StoreStatus>('admin/store/status', payload).then(r => r.data),

  // Kassa (cashier) endpoints
  kassaCreateOrder: (payload: {
    type: 'DINE_IN' | 'TAKEAWAY'
    items: { menuItemId: string; quantity: number; selectedOptions?: { groupId: string; optionId: string; quantity: number }[] }[]
    note?: string
    paymentMethod: 'CASH' | 'CARD'
  }): Promise<{ orderId: string; status: string; orderNumber?: string; paymentMethod: 'CASH' | 'CARD'; clientSecret?: string | null; estimatedWaitMinutes?: number }> =>
    api.post('kassa/orders', payload).then(r => r.data),

  adminListActiveOrders: () => api.get<any[]>('admin/orders/active').then(r => r.data.map(normalizeOrder)),
  adminMarkPaid: (orderId: string, paid: boolean) => api.post(`admin/orders/${orderId}/paid`, { paid }).then(r => r.data)
}

function normalizeMenuItem(raw: any): MenuItem {
  const idCandidate = raw?.id ?? raw?._id ?? raw?.itemId
  return {
    id: String(idCandidate ?? ''),
    name: raw?.name,
    price: Number(raw?.price),
    category: raw?.category ?? 'Övrigt',
    description: raw?.description ?? undefined,
    imageUrl: raw?.imageUrl ?? raw?.image ?? undefined,
    isAvailable: raw?.isAvailable !== false,
    optionGroups: Array.isArray(raw?.optionGroups) ? raw.optionGroups.map((g: any) => ({
      id: g?._id || g?.id,
      name: g?.name,
      min: g?.min,
      max: g?.max,
      allowHalf: g?.allowHalf,
      options: Array.isArray(g?.options) ? g.options.map((o: any) => ({ id: o?._id || o?.id, name: o?.name, priceDelta: o?.priceDelta, halfPriceDelta: o?.halfPriceDelta, isAvailable: o?.isAvailable })) : []
    })) : undefined
  }
}

function normalizeOrder(raw: any): Order {
  const idCandidate = raw?.id ?? raw?._id ?? raw?.orderId
  const legacyItems = Array.isArray(raw?.items)
    ? raw.items.map((it: any) => ({
        itemId: String(it?.itemId ?? it?.menuItemId ?? it?.id ?? ''),
        name: String(it?.name ?? ''),
        price: Number(it?.price ?? it?.priceAtOrder ?? 0),
        qty: Number(it?.qty ?? it?.quantity ?? 1),
        selectedOptions: Array.isArray(it?.selectedOptions)
          ? it.selectedOptions.map((s: any) => ({
              groupId: String(s?.groupId ?? ''),
              optionId: String(s?.optionId ?? ''),
              quantity: Number(s?.quantity ?? 1),
              name: s?.name,
              groupName: s?.groupName,
              priceDeltaAtOrder: typeof s?.priceDeltaAtOrder === 'number' ? s.priceDeltaAtOrder : undefined
            }))
          : undefined
      }))
    : []
  const typeValue = raw?.type || raw?.method
  return {
    id: String(idCandidate ?? ''),
    items: legacyItems,
    subtotal: typeof raw?.subtotal === 'number' ? raw.subtotal : undefined,
    method: typeValue,
    customer: raw?.customer || undefined,
    type: raw?.type,
    total: typeof raw?.total === 'number' ? raw.total : undefined,
    customerName: raw?.customerName || raw?.customer?.name,
    phone: raw?.phone || raw?.customer?.phone,
    email: raw?.email || raw?.customer?.email,
    status: raw?.status,
    etaMinutes: typeof raw?.etaMinutes === 'number' ? raw.etaMinutes : undefined,
    estimatedWaitMinutes: typeof raw?.estimatedWaitMinutes === 'number' ? raw.estimatedWaitMinutes : undefined,
    acceptedAt: raw?.acceptedAt,
    readyAt: raw?.readyAt,
    paid: typeof raw?.paid === 'boolean' ? raw.paid : undefined,
    paymentMethod: raw?.paymentMethod,
    note: raw?.note || raw?.customer?.notes || raw?.customer?.note,
    orderNumber: raw?.orderNumber,
    driverGoogleEmail: raw?.driverGoogleEmail,
    driverLocation: raw?.driverLocation,
    createdAt: raw?.createdAt || new Date().toISOString()
  }
}

function normalizeCateringRequest(raw: any): CateringRequest {
  return {
    id: String(raw?.id || raw?._id || ''),
    contactName: String(raw?.contactName || raw?.name || ''),
    phone: String(raw?.phone || ''),
    email: String(raw?.email || ''),
    company: raw?.company || undefined,
    eventDate: raw?.eventDate || undefined,
    eventTime: raw?.eventTime || undefined,
    guests: typeof raw?.guests === 'number' ? raw.guests : (raw?.guests ? Number(raw.guests) : undefined),
    budgetPerPersonKr: typeof raw?.budgetPerPersonKr === 'number' ? raw.budgetPerPersonKr : (raw?.budgetPerPersonKr ? Number(raw.budgetPerPersonKr) : undefined),
    street: raw?.street || raw?.locationAddress || undefined,
    city: raw?.city || undefined,
    postalCode: raw?.postalCode || undefined,
    layout: raw?.layout,
    needsEquipment: raw?.needsEquipment,
    requiresServingStaff: raw?.requiresServingStaff,
    allergies: raw?.allergies || raw?.dietary || undefined,
    notes: raw?.notes || raw?.message || undefined,
    status: (raw?.status || 'NEW') as CateringStatus,
    createdAt: raw?.createdAt
  }
}
