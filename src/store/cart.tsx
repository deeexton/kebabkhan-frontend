import { createContext, useContext, useMemo, useState } from 'react'
import { MenuItem } from '../api'

export type CartLine = { item: MenuItem; qty: number; selectedOptions?: Array<{ groupId: string; optionId: string; quantity: number }> }

type CartContextValue = {
  lines: CartLine[]
  add: (item: MenuItem, selectedOptions?: CartLine['selectedOptions']) => void
  remove: (itemId: string) => void
  inc: (itemId: string) => void
  dec: (itemId: string) => void
  clear: () => void
  subtotal: number
  lineUnitPrice: (line: CartLine) => number
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const add = (item: MenuItem, selectedOptions?: CartLine['selectedOptions']) => {
    setLines(prev => {
      const idx = prev.findIndex(l => l.item.id === item.id && JSON.stringify(l.selectedOptions||[]) === JSON.stringify(selectedOptions||[]))
      if (idx >= 0) {
        const copy = [...prev]; copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 }; return copy
      }
      return [...prev, { item, qty: 1, selectedOptions }]
    })
  }
  const remove = (itemId: string) => setLines(prev => prev.filter(l => l.item.id !== itemId))
  const inc = (itemId: string) => setLines(prev => prev.map(l => l.item.id===itemId?{...l, qty:l.qty+1}:l))
  const dec = (itemId: string) => setLines(prev => prev.flatMap(l => l.item.id===itemId? (l.qty>1?[{...l, qty:l.qty-1}]:[]): [l]))
  const clear = () => setLines([])
  const lineUnitPrice = (line: CartLine): number => {
    const base = line.item.price || 0
    const delta = (line.selectedOptions || []).reduce((sum, sel) => {
      const g = (line.item.optionGroups || []).find((x: any) => String(x.id || x._id || x.name) === String(sel.groupId))
      const o = (g?.options || []).find((opt: any) => String(opt.id || opt._id || opt.name) === String(sel.optionId))
      const dRaw = (o as any)?.priceDelta
      const halfRaw = (o as any)?.halfPriceDelta
      const d = typeof dRaw === 'number' && dRaw !== 0 ? dRaw : (typeof halfRaw === 'number' ? halfRaw : 0)
      return sum + d * (sel.quantity || 1)
    }, 0)
    return base + delta
  }
  const subtotal = lines.reduce((s,l)=>s+lineUnitPrice(l)*l.qty,0)
  const value = useMemo(() => ({ lines, add, remove, inc, dec, clear, subtotal, lineUnitPrice }), [lines, subtotal])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}


