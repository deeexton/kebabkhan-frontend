import { useState } from 'react'
import { Api } from '../api'

type FormState = {
  contactName: string
  phone: string
  email: string
  company: string
  eventDate: string
  eventTime: string
  guests: string
  budgetPerPersonKr: string
  street: string
  postalCode: string
  city: string
  layout: 'BUFFET' | 'PLATED' | 'FAMILY_STYLE' | 'OTHER'
  requiresServingStaff: 'YES' | 'NO'
  needsEquipment: 'YES' | 'NO'
  allergies: string
  notes: string
}

const initialState: FormState = {
  contactName: '',
  phone: '',
  email: '',
  company: '',
  eventDate: '',
  eventTime: '',
  guests: '',
  budgetPerPersonKr: '',
  street: '',
  postalCode: '',
  city: '',
  layout: 'BUFFET',
  requiresServingStaff: 'YES',
  needsEquipment: 'NO',
  allergies: '',
  notes: ''
}

export default function Catering() {
  const [form, setForm] = useState<FormState>(initialState)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function validate(): string | null {
    if (!form.contactName.trim()) return 'Ange kontaktpersonens namn.'
    if (!/^\+?[0-9\s-]{7,}$/.test(form.phone.trim())) return 'Ange ett giltigt telefonnummer.'
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Ange en giltig e-postadress.'
    return null
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setResult({ ok:false, error: err }); return }
    setSubmitting(true)
    setResult(null)
    try {
      const payload = {
        contactName: form.contactName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        company: form.company.trim() || undefined,
        eventDate: form.eventDate || undefined,
        eventTime: form.eventTime || undefined,
        guests: form.guests ? Math.round(Number(form.guests)) : undefined,
        budgetPerPersonKr: form.budgetPerPersonKr ? Math.round(Number(form.budgetPerPersonKr)) : undefined,
        street: form.street.trim() || undefined,
        city: form.city.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        layout: form.layout,
        needsEquipment: form.needsEquipment,
        requiresServingStaff: form.requiresServingStaff,
        allergies: form.allergies.trim() || undefined,
        notes: form.notes.trim() || undefined
      }
      await Api.submitCateringRequest(payload)
      setResult({ ok:true })
      setForm(initialState)
    } catch (err: any) {
      const serverError = err?.response?.data
      const message = serverError?.error?.message || serverError?.message || 'Kunde inte skicka förfrågan. Försök igen.'
      setResult({ ok:false, error: message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <section className="hero" style={{ marginLeft:'calc(50% - 50vw)', marginRight:'calc(50% - 50vw)', position:'relative' }}>
        <div style={{ position:'absolute', inset:0, zIndex:0, overflow:'hidden' }} aria-hidden>
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            style={{ width:'100%', height:'100%', objectFit:'cover', filter:'contrast(1.05) saturate(1.05)' }}
          >
            <source src="https://res.cloudinary.com/dbo4e8iuc/video/upload/v1757445234/kebab-traditional-turkish-meat-food-with-salad-on-4k-2025-08-29-08-20-40-utc_a0b2e8.mp4" type="video/mp4" />
          </video>
        </div>
        <div style={{ position:'absolute', inset:0, zIndex:1, background:'linear-gradient(180deg, rgba(0,0,0,.60), rgba(0,0,0,.45) 30%, rgba(0,0,0,.35))' }} />
        <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', width:'min(1100px, 100%)', padding:'0 16px', zIndex:3 }}>
          <div className="pill"><span className="dot"/> Catering & Event</div>
        </div>
        <div className="container" style={{ display:'grid', gap:16, position:'relative', zIndex:2 }}>
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
            <form
              onSubmit={onSubmit}
              className="grid"
              style={{ gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:16 }}
            >
              <div>
                <label>Kontaktperson</label>
                <input value={form.contactName} onChange={e=>update('contactName', e.target.value)} placeholder="Namn" required />
              </div>
              <div>
                <label>Telefon</label>
                <input type="tel" inputMode="tel" value={form.phone} onChange={e=>update('phone', e.target.value)} placeholder="ex. 070-123 45 67" required />
              </div>
              <div>
                <label>E-post</label>
                <input type="email" value={form.email} onChange={e=>update('email', e.target.value)} placeholder="namn@företag.se" required />
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
                <input type="number" min="1" value={form.guests} onChange={e=>update('guests', e.target.value)} placeholder="t.ex. 60" />
              </div>
              <div>
                <label>Budget per person (kr)</label>
                <input type="number" min="0" value={form.budgetPerPersonKr} onChange={e=>update('budgetPerPersonKr', e.target.value)} placeholder="t.ex. 150" />
              </div>
              <div style={{ gridColumn:'1 / -1' }}>
                <label>Adress (leverans/plats)</label>
                <input value={form.street} onChange={e=>update('street', e.target.value)} placeholder="Gatuadress" />
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
                <select value={form.layout} onChange={e=>update('layout', e.target.value as FormState['layout'])}>
                  <option value="BUFFET">Buffé</option>
                  <option value="PLATED">Tallriksservering</option>
                  <option value="FAMILY_STYLE">Family style</option>
                  <option value="OTHER">Annat</option>
                </select>
              </div>
              <div>
                <label>Krävs serveringspersonal?</label>
                <select value={form.requiresServingStaff} onChange={e=>update('requiresServingStaff', e.target.value as 'YES'|'NO')}>
                  <option value="YES">Ja</option>
                  <option value="NO">Nej</option>
                </select>
              </div>
              <div>
                <label>Behövs utrustning (t.ex. värmeskåp, porslin)?</label>
                <select value={form.needsEquipment} onChange={e=>update('needsEquipment', e.target.value as 'YES'|'NO')}>
                  <option value="NO">Nej</option>
                  <option value="YES">Ja</option>
                </select>
              </div>
              <div style={{ gridColumn:'1 / -1' }}>
                <label>Allergier och önskemål</label>
                <textarea rows={3} value={form.allergies} onChange={e=>update('allergies', e.target.value)} placeholder="Vegetariskt, veganskt, glutenfritt, nötallergi, etc." />
              </div>
              <div style={{ gridColumn:'1 / -1' }}>
                <label>Övrigt</label>
                <textarea rows={4} value={form.notes} onChange={e=>update('notes', e.target.value)} placeholder="Berätta gärna mer om tillställningen" />
              </div>
              <div style={{ gridColumn:'1 / -1', display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                <button className="btn" disabled={submitting} type="submit" style={{ width:'min(260px, 100%)' }}>{submitting ? 'Skickar…' : 'Skicka förfrågan'}</button>
                <span className="muted">Vi svarar vanligtvis inom 1–2 arbetsdagar.</span>
              </div>
            </form>
          </div>
        </div>
      </section>
    </>
  )
}


