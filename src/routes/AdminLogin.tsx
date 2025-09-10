import { useEffect, useState } from 'react'
import { Api, getAdminToken } from '../api'
import { useNavigate } from 'react-router-dom'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  type LoginProfile = { id: string; label?: string; email: string; password: string; lastUsedAt: number }
  const PROFILES_KEY = 'admin.login.profiles'
  const [profiles, setProfiles] = useState<LoginProfile[]>([])

  useEffect(() => {
    if (getAdminToken()) navigate('/admin', { replace: true })
  }, [navigate])

  // Prefill from localStorage and keep inputs persisted for convenience
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('admin.login.email')
      const savedPassword = localStorage.getItem('admin.login.password')
      if (savedEmail) setEmail(savedEmail)
      if (savedPassword) setPassword(savedPassword)
    } catch {}
  }, [])

  // Load up to three saved quick-login profiles
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROFILES_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as LoginProfile[]
        if (Array.isArray(parsed)) {
          const sorted = [...parsed].sort((a, b) => (b?.lastUsedAt || 0) - (a?.lastUsedAt || 0))
          setProfiles(sorted.slice(0, 3))
        }
      }
    } catch {}
  }, [])

  const onEmailChange = (value: string) => {
    setEmail(value)
    try { localStorage.setItem('admin.login.email', value) } catch {}
  }

  const onPasswordChange = (value: string) => {
    setPassword(value)
    try { localStorage.setItem('admin.login.password', value) } catch {}
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await Api.adminLogin(email, password)
      await Api.adminMe()
      // Update or add profile on successful login
      try {
        const id = email.trim().toLowerCase()
        const existing = profiles.find(p => p.id === id)
        const updated: LoginProfile = { id, email, password, lastUsedAt: Date.now(), label: existing?.label }
        const next = existing ? [updated, ...profiles.filter(p => p.id !== id)] : [updated, ...profiles].slice(0, 3)
        setProfiles(next)
        localStorage.setItem(PROFILES_KEY, JSON.stringify(next))
      } catch {}
      navigate('/admin', { replace: true })
    } catch (e: any) {
      setError(e?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const useProfile = (id: string) => {
    const p = profiles.find(x => x.id === id)
    if (!p) return
    setEmail(p.email)
    setPassword(p.password)
    try {
      localStorage.setItem('admin.login.email', p.email)
      localStorage.setItem('admin.login.password', p.password)
      const reordered = [{ ...p, lastUsedAt: Date.now() }, ...profiles.filter(x => x.id !== id)].slice(0, 3)
      setProfiles(reordered)
      localStorage.setItem(PROFILES_KEY, JSON.stringify(reordered))
    } catch {}
  }

  const saveCurrentAsProfile = () => {
    if (!email || !password) return
    const id = email.trim().toLowerCase()
    const label = window.prompt('Name this quick login (optional):', '') || undefined
    try {
      const existing = profiles.find(p => p.id === id)
      const updated: LoginProfile = { id, label, email, password, lastUsedAt: Date.now() }
      const next = existing ? [updated, ...profiles.filter(p => p.id !== id)] : [updated, ...profiles].slice(0, 3)
      setProfiles(next)
      localStorage.setItem(PROFILES_KEY, JSON.stringify(next))
    } catch {}
  }

  const removeProfile = (id: string) => {
    try {
      const next = profiles.filter(p => p.id !== id)
      setProfiles(next)
      localStorage.setItem(PROFILES_KEY, JSON.stringify(next))
    } catch {}
  }

  return (
    <section className="card" style={{ maxWidth: 400, margin: '0 auto' }}>
      <h3 style={{ marginTop:0 }}>Admin Login</h3>
      {profiles.length > 0 && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
          {profiles.map(p => (
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:4 }}>
              <button type="button" className="btn secondary" onClick={()=>useProfile(p.id)}>
                {p.label || p.email}
              </button>
              <button type="button" onClick={()=>removeProfile(p.id)} aria-label={`Remove ${p.label || p.email}`}
                style={{ background:'transparent', border:'none', color:'#aaa', cursor:'pointer', padding:'4px 6px' }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={onSubmit} style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e=>onEmailChange(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e=>onPasswordChange(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <div className="muted" style={{ color: 'crimson' }}>{error}</div>}
        <button className="btn" type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
      </form>
      <div style={{ marginTop:8, display:'flex', gap:8, flexWrap:'wrap' }}>
        <button type="button" className="btn secondary" onClick={saveCurrentAsProfile} disabled={!email || !password}>
          Save as quick login
        </button>
        <span className="muted" style={{ fontSize:12 }}>Up to 3 quick logins are kept on this device.</span>
      </div>
    </section>
  )
}


