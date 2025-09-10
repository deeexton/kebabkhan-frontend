import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Api, StoreStatus } from '../api'

type Ctx = {
  status: StoreStatus | null
  loading: boolean
  refresh: () => Promise<void>
}

const StoreStatusContext = createContext<Ctx | undefined>(undefined)

export function StoreStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<StoreStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      // Avoid unnecessary fetch on admin kitchen routes which don't use public store status
      const path = typeof window !== 'undefined' ? window.location.pathname : ''
      if (path.startsWith('/admin') && typeof localStorage !== 'undefined') {
        const role = localStorage.getItem('admin.role')
        if (role === 'KITCHEN') { setLoading(false); return }
      }
      const s = await Api.getStoreStatus(); setStatus(s)
    } catch {
      // keep previous
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const value = useMemo(() => ({ status, loading, refresh }), [status, loading])
  return <StoreStatusContext.Provider value={value}>{children}</StoreStatusContext.Provider>
}

export function useStoreStatus() {
  const ctx = useContext(StoreStatusContext)
  if (!ctx) throw new Error('useStoreStatus must be used within StoreStatusProvider')
  return ctx
}


