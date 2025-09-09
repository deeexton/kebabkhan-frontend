import { useEffect, useState } from 'react'
import { Api, getAdminToken } from '../api'
import { useNavigate } from 'react-router-dom'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (getAdminToken()) navigate('/admin', { replace: true })
  }, [navigate])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await Api.adminLogin(email, password)
      await Api.adminMe()
      navigate('/admin', { replace: true })
    } catch (e: any) {
      setError(e?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card" style={{ maxWidth: 400, margin: '0 auto' }}>
      <h3 style={{ marginTop:0 }}>Admin Login</h3>
      <form onSubmit={onSubmit} style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
        {error && <div className="muted" style={{ color: 'crimson' }}>{error}</div>}
        <button className="btn" type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
      </form>
    </section>
  )
}


