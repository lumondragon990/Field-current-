import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { TopBar } from '../components.jsx'

export default function Home() {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  async function enter(e) {
    e?.preventDefault()
    const clean = code.trim().toUpperCase()
    if (!clean) return
    setBusy(true); setErr('')
    const { data, error } = await supabase
      .from('customers').select('access_code').eq('access_code', clean).maybeSingle()
    setBusy(false)
    if (error) { setErr('Connection problem. Try again in a moment.'); return }
    if (!data) { setErr('That code was not found. Check it with your Tradelec contact.'); return }
    localStorage.setItem('fc_last_code', clean)
    nav(`/c/${clean}`)
  }

  return (
    <>
      <TopBar />
      <div className="wrap">
        <div className="hero">
          <div className="eyebrow">Tradelec LLC · Transformer Field Services</div>
          <h1>Your job site,<br /><span className="amp">as it happens.</span></h1>
          <p>
            Live photos, written reports, and status updates from our field crews —
            posted the moment the work is done, not at the end of the day.
          </p>
        </div>

        <div className="card">
          <h2>Customer access</h2>
          <p className="muted">Enter the access code from your Tradelec project contact.</p>
          <form onSubmit={enter}>
            <div className="field">
              <label htmlFor="code">Access code</label>
              <input id="code" className="mono" value={code} placeholder="e.g. ACME-4821"
                autoCapitalize="characters" autoComplete="off"
                onChange={e => setCode(e.target.value)} />
            </div>
            {err && <p className="muted" style={{ color: 'var(--red)' }}>{err}</p>}
            <button className="btn amber" disabled={busy}>{busy ? 'Checking…' : 'View my jobs'}</button>
          </form>
        </div>

        <p className="muted" style={{ textAlign: 'center' }}>
          Tradelec team member? <Link to="/admin">Open the field console</Link>
        </p>
      </div>
    </>
  )
}
