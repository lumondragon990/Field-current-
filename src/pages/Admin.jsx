import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, makeAccessCode, cleanCode, friendlyError } from '../lib/supabase.js'
import { TopBar, Toast, useToast } from '../components.jsx'

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '0000'
const TEAM_PIN = import.meta.env.VITE_TEAM_PIN || ''

export function usePinGate() {
  const [ok, setOk] = useState(() => localStorage.getItem('fc_admin') === 'yes')
  const [role, setRole] = useState(() => localStorage.getItem('fc_role') || 'admin')
  function tryPin(v) {
    if (v === ADMIN_PIN) {
      localStorage.setItem('fc_admin', 'yes'); localStorage.setItem('fc_role', 'admin')
      setRole('admin'); setOk(true); return true
    }
    if (TEAM_PIN && v === TEAM_PIN) {
      localStorage.setItem('fc_admin', 'yes'); localStorage.setItem('fc_role', 'team')
      setRole('team'); setOk(true); return true
    }
    return false
  }
  function logout() {
    localStorage.removeItem('fc_admin'); localStorage.removeItem('fc_role')
    setOk(false); setRole('admin')
  }
  return { ok, role, tryPin, logout }
}

export function PinScreen({ tryPin }) {
  const [v, setV] = useState('')
  const [err, setErr] = useState(false)
  return (
    <>
      <TopBar who="FIELD CONSOLE" />
      <div className="wrap">
        <div className="page-head"><h1>Team sign-in</h1></div>
        <div className="card">
          <form onSubmit={e => { e.preventDefault(); if (!tryPin(v.trim())) setErr(true) }}>
            <div className="field">
              <label htmlFor="pin">Team PIN</label>
              <input id="pin" type="password" inputMode="numeric" value={v}
                onChange={e => { setV(e.target.value); setErr(false) }} />
            </div>
            {err && <p className="muted" style={{ color: 'var(--red)' }}>Wrong PIN.</p>}
            <button className="btn">Sign in</button>
          </form>
        </div>
      </div>
    </>
  )
}

export default function Admin() {
  const { ok, tryPin, logout } = usePinGate()
  const [customers, setCustomers] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ company: '', contact_name: '', contact_email: '', contact_phone: '', access_code: '' })
  const [toast, setToast] = useToast()
  const nav = useNavigate()

  useEffect(() => { if (ok) load() }, [ok])

  async function load() {
    const { data } = await supabase.from('customers').select('*').order('company')
    setCustomers(data || [])
  }

  async function addCustomer(e) {
    e.preventDefault()
    if (!form.company.trim()) return
    const access_code = cleanCode(form.access_code) || makeAccessCode(form.company)
    const { error } = await supabase.from('customers').insert({
      company: form.company, contact_name: form.contact_name,
      contact_email: form.contact_email, contact_phone: form.contact_phone,
      access_code
    })
    if (error) { setToast(friendlyError(error, 'Save')); return }
    setForm({ company: '', contact_name: '', contact_email: '', contact_phone: '', access_code: '' })
    setShowForm(false)
    setToast(`Customer added with code ${access_code}`)
    load()
  }

  if (!ok) return <PinScreen tryPin={tryPin} />

  return (
    <>
      <TopBar who="FIELD CONSOLE" homeTo="/admin" />
      <div className="wrap">
        <div className="page-head row-between">
          <div>
            <div className="eyebrow">Field console</div>
            <h1>Customers</h1>
          </div>
          <div className="btn-row">
            <button className="btn amber small" onClick={() => setShowForm(s => !s)}>
              {showForm ? 'Cancel' : '+ Add customer'}
            </button>
            <button className="btn small" onClick={() => nav('/admin/expenses')}>Receipts & purchases</button>
            <button className="btn ghost small" onClick={() => { logout(); nav('/') }}>Sign out</button>
          </div>
        </div>

        {showForm && (
          <div className="card">
            <h2>New customer</h2>
            <form onSubmit={addCustomer}>
              <div className="field"><label>Company *</label>
                <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
              <div className="field"><label>Client code — you choose it (optional)</label>
                <input className="mono" placeholder="e.g. ACME-2026 (blank = auto)" value={form.access_code}
                  autoCapitalize="characters"
                  onChange={e => setForm({ ...form, access_code: e.target.value })} /></div>
              <div className="field"><label>Contact name</label>
                <input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></div>
              <div className="field"><label>Contact email</label>
                <input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
              <div className="field"><label>Contact phone</label>
                <input type="tel" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} /></div>
              <button className="btn">Save customer</button>
            </form>
          </div>
        )}

        {customers === null && <p className="muted">Loading…</p>}
        {customers?.length === 0 && !showForm && (
          <div className="empty">No customers yet. Add your first one and assign their client code.</div>
        )}
        {customers?.map(c => (
          <div key={c.id} className="card click" onClick={() => nav(`/admin/customer/${c.id}`)}>
            <div className="row-between">
              <div>
                <h2>{c.company}</h2>
                <p className="muted">{c.contact_name}{c.contact_phone ? ` · ${c.contact_phone}` : ''}</p>
              </div>
              <span className="code-chip">{c.access_code}</span>
            </div>
          </div>
        ))}
        <Toast msg={toast} />
      </div>
    </>
  )
}
