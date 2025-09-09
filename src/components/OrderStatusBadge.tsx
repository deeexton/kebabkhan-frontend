import { OrderStatus } from '../api'

const COLORS: Partial<Record<OrderStatus,string>> = {
  PENDING:'#94a3b8',
  RECEIVED:'#94a3b8',
  ACCEPTED:'#22c55e',
  PREPARING:'#eab308',
  IN_KITCHEN:'#eab308',
  READY:'#06b6d4',
  OUT_FOR_DELIVERY:'#f59e0b',
  DELIVERED:'#16a34a',
  REJECTED:'#ef4444',
  CANCELLED:'#ef4444',
  CANCELED:'#ef4444'
}
export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const color = COLORS[status] || '#94a3b8'
  const label = SWEDISH_LABELS[status] || status.replaceAll('_',' ')
  return <span style={{ padding:'4px 8px', borderRadius:999, background:color, color:'#111', fontWeight:700 }}>{label}</span>
}

const SWEDISH_LABELS: Partial<Record<OrderStatus, string>> = {
  PENDING: 'Väntar',
  RECEIVED: 'Mottagen',
  ACCEPTED: 'Accepterad',
  PREPARING: 'Tillagar',
  IN_KITCHEN: 'Tillagar',
  READY: 'Klar',
  OUT_FOR_DELIVERY: 'På väg',
  DELIVERED: 'Levererad',
  REJECTED: 'Avvisad',
  CANCELLED: 'Avbruten',
  CANCELED: 'Avbruten'
}
