import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Api } from '../api'

export default function CheckOrder() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalized = code.replace(/\D/g, '').padStart(5, '0').slice(-5)
    if (!/^\d{5}$/.test(normalized)) return setError('Ange en giltig 5-siffrig kod')
    try {
      setError(null)
      const id = await Api.lookupOrderId(normalized)
      navigate(`/order/${id}`)
    } catch (e) {
      setError('Hittade ingen beställning med den koden.')
    }
  }

  const onChange = (v: string) => {
    const digitsOnly = v.replace(/\D/g, '').slice(0, 5)
    setCode(digitsOnly)
    if (error) setError(null)
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 520 }}>
        <h2 style={{ marginTop: 0 }}>Kontrollera beställning</h2>
        <p className="muted">Ange din 5-siffriga kod för att följa din beställning.</p>
        <form onSubmit={onSubmit} noValidate className="card" style={{ display: 'grid', gap: 12 }}>
          <label htmlFor="orderCode"><strong>Kod</strong></label>
          <input
            id="orderCode"
            inputMode="numeric"
            placeholder="t.ex. 12345"
            value={code}
            onChange={e => onChange(e.target.value)}
            className={error ? 'input error' : 'input'}
            aria-invalid={!!error}
            aria-describedby={error ? 'orderCodeError' : undefined}
          />
          {error && (
            <div id="orderCodeError" className="muted" style={{ color: 'var(--red-600)' }}>{error}</div>
          )}
          <button type="submit" className="btn" disabled={code.length !== 5}>Visa beställning</button>
        </form>
      </div>
    </section>
  )
}


