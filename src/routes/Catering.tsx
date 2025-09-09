import { useState } from 'react'
import { Api } from '../api'

type FormState = {
  name: string
  phone: string
  email: string
  company: string
  eventDate: string
  eventTime: string
  guests: string
  budgetPerPerson: string
  locationAddress: string
  postalCode: string
  city: string
  serviceStyle: 'BUFFET' | 'DROP_OFF' | 'LIVE_GRILL' | 'OTHER'
  dietary: string
  message: string
  needStaff: boolean
  needEquipment: boolean
}

const initialState: FormState = {
  name: '',
  phone: '',
  email: '',
  company: '',
  eventDate: '',
  eventTime: '',
  guests: '',
  budgetPerPerson: '',
  locationAddress: '',
  postalCode: '',
  city: '',
  serviceStyle: 'BUFFET',
  dietary: '',
  message: '',
  needStaff: true,
  needEquipment: false
}

export default function Catering() {
  const [form, setForm] = useState<FormState>(initialState)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function validate(): string | null {
    if (!form.name.trim()) return 'Ange kontaktpersonens namn.'
    if (!/^\+?[0-9\s-]{7,}$/.test(form.phone.trim())) return 'Ange ett giltigt telefonnummer.'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Ange en giltig e-postadress.'
    if (!form.eventDate) return 'Välj ett datum för tillställningen.'
    if (!form.guests || Number(form.guests) <= 0) return 'Ange antal gäster.'
    return null
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setResult({ ok:false, error: err }); return }
    setSubmitting(true)
    setResult(null)
    try {
      await Api.submitCateringRequest({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        company: form.company.trim() || undefined,
        eventDate: form.eventDate || undefined,
        eventTime: form.eventTime || undefined,
        guests: form.guests ? Number(form.guests) : undefined,
        budgetPerPerson: form.budgetPerPerson ? Number(form.budgetPerPerson) : undefined,
        locationAddress: form.locationAddress.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        city: form.city.trim() || undefined,
        serviceStyle: form.serviceStyle,
        dietary: form.dietary.trim() || undefined,
        message: form.message.trim() || undefined,
        needStaff: !!form.needStaff,
        needEquipment: !!form.needEquipment
      })
      setResult({ ok:true })
      setForm(initialState)
    } catch (err: any) {
      setResult({ ok:false, error: err?.response?.data?.message || 'Kunde inte skicka förfrågan. Försök igen.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <section className="hero">
        <div className="container" style={{ display:'grid', gap:16 }}>
          <div className="pill"><span className="dot"/> Catering & Event</div>
          <h1 className="title-xl" style={{ margin:0 }}>Låt oss ta hand om ert nästa event</h1>
          <p className="muted" style={{ maxWidth:760 }}>
            Från företagsluncher och bröllop till födelsedagar och festivaler. Vi levererar
            smakrik kurdisk kolgrill – som buffé, drop-off eller livegrill på plats.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ display:'grid', gap:20 }}>
          <div className="card" style={{ display:'grid', gap:16 }}>
            <div className="eyebrow">Förfrågan</div>
            <h2 className="title-lg">Berätta om ert event</h2>
            {result?.ok && (
              <div className="pill" role="status">Tack! Vi återkommer inom kort.</div>
            )}
            {result && !result.ok && result.error && (
              <div className="pill" style={{ background:'#3a0f0f', borderColor:'#5a1a1a' }}>{result.error}</div>
            )}
            <form onSubmit={onSubmit} className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div>
                <label>Kontaktperson</label>
                <input value={form.name} onChange={e=>update('name', e.target.value)} placeholder="Namn" required />
              </div>
              <div>
                <label>Telefon</label>
                <input value={form.phone} onChange={e=>update('phone', e.target.value)} placeholder="ex. 070-123 45 67" required />
              </div>
              <div>
                <label>E-post</label>
                <input type="email" value={form.email} onChange={e=>update('email', e.target.value)} placeholder="namn@företag.se" />
              </div>
              <div>
                <label>Företag/Organisation</label>
                <input value={form.company} onChange={e=>update('company', e.target.value)} placeholder="Valfritt" />
              </div>
              <div>
                <label>Datum</label>
                <input type="date" value={form.eventDate} onChange={e=>update('eventDate', e.target.value)} required />
              </div>
              <div>
                <label>Tid</label>
                <input type="time" value={form.eventTime} onChange={e=>update('eventTime', e.target.value)} />
              </div>
              <div>
                <label>Antal gäster</label>
                <input type="number" min="1" value={form.guests} onChange={e=>update('guests', e.target.value)} placeholder="t.ex. 60" required />
              </div>
              <div>
                <label>Budget per person (kr)</label>
                <input type="number" min="0" value={form.budgetPerPerson} onChange={e=>update('budgetPerPerson', e.target.value)} placeholder="t.ex. 150" />
              </div>
              <div style={{ gridColumn:'1 / -1' }}>
                <label>Adress (leverans/plats)</label>
                <input value={form.locationAddress} onChange={e=>update('locationAddress', e.target.value)} placeholder="Gatuadress" />
              </div>
              <div>
                <label>Postnummer</label>
                <input value={form.postalCode} onChange={e=>update('postalCode', e.target.value)} />
              </div>
              <div>
                <label>Stad</label>
                <input value={form.city} onChange={e=>update('city', e.target.value)} />
              </div>
              <div>
                <label>Upplägg</label>
                <select value={form.serviceStyle} onChange={e=>update('serviceStyle', e.target.value as FormState['serviceStyle'])}>
                  <option value="BUFFET">Buffé</option>
                  <option value="DROP_OFF">Drop-off (leverans)</option>
                  <option value="LIVE_GRILL">Livegrill på plats</option>
                  <option value="OTHER">Annat</option>
                </select>
              </div>
              <div>
                <label>Krävs serveringspersonal?</label>
                <select value={form.needStaff ? 'yes' : 'no'} onChange={e=>update('needStaff', e.target.value === 'yes')}>
                  <option value="yes">Ja</option>
                  <option value="no">Nej</option>
                </select>
              </div>
              <div>
                <label>Behövs utrustning (t.ex. värmeskåp, porslin)?</label>
                <select value={form.needEquipment ? 'yes' : 'no'} onChange={e=>update('needEquipment', e.target.value === 'yes')}>
                  <option value="no">Nej</option>
                  <option value="yes">Ja</option>
                </select>
              </div>
              <div style={{ gridColumn:'1 / -1' }}>
                <label>Allergier och önskemål</label>
                <textarea rows={3} value={form.dietary} onChange={e=>update('dietary', e.target.value)} placeholder="Vegetariskt, veganskt, glutenfritt, nötallergi, etc." />
              </div>
              <div style={{ gridColumn:'1 / -1' }}>
                <label>Övrigt</label>
                <textarea rows={4} value={form.message} onChange={e=>update('message', e.target.value)} placeholder="Berätta gärna mer om tillställningen" />
              </div>
              <div style={{ gridColumn:'1 / -1', display:'flex', gap:12, alignItems:'center' }}>
                <button className="btn" disabled={submitting} type="submit">{submitting ? 'Skickar…' : 'Skicka förfrågan'}</button>
                <span className="muted">Vi svarar vanligtvis inom 1–2 arbetsdagar.</span>
              </div>
            </form>
          </div>
        </div>
      </section>
    </>
  )
}


