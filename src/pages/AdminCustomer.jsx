import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { TopBar, StatusBadge, Toast, useToast } from '../components.jsx'
import { usePinGate, PinScreen } from './Admin.jsx'

export default function AdminCustomer() {
  const { ok, tryPin } = usePinGate()
  const { id } = useParams()
  const nav = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [jobs, setJobs] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', site: '', scope: '', job_number: '' })
  const [toast, setToast] = useToast()

  useEffect(() => { if (ok) load() }, [ok, id])

  async function load() {
    const { data: c } = await supabase.from('customers').select('*').eq('id', id).single()
    setCustomer(c)
    const { data: j } = await supabase.from('jobs').select('*')
      .eq('customer_id', id).order('created_at', { ascending: false })
    setJobs(j || [])
  }

  async function addJob(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    const { error } = await supabase.from('jobs').insert({ ...form, customer_id: id, status: 'scheduled' })
    if (error) { setToast('Could not save. Try again.'); return }
    setForm({ title: '', site: '', scope: '', job_number: '' })
    setShowForm(false)
    setToast('Job created')
    load()
  }

  function copyInvite() {
    const link = `${window.location.origin}/c/${customer.access_code}`
    const text = `Hi${customer.contact_name ? ' ' + customer.contact_name : ''} — you can follow your Tradelec jobs live here:\n${link}\nAccess code: ${customer.access_code}`
    navigator.clipboard.writeText(text)
    setToast('Invite copied — paste into a text or email')
  }

  if (!ok) return <PinScreen tryPin={tryPin} />

  return (
    <>
      <TopBar who="FIELD CONSOLE" homeTo="/admin" />
      <div className="wrap">
        <div className="page-head">
          <div className="eyebrow no-print">Field console · Customer</div>
          <h1>{customer?.company || '…'}</h1>
          {customer && (
            <p className="muted">
              {customer.contact_name} {customer.contact_email && `· ${customer.contact_email}`} {customer.contact_phone && `· ${customer.contact_phone}`}
            </p>
          )}
        </div>

        {customer && (
          <div className="card">
            <div className="row-between">
              <div>
                <div className="eyebrow">Customer portal access</div>
                <span className="code-chip" style={{ marginTop: 6 }}>{customer.access_code}</span>
              </div>
              <button className="btn small" onClick={copyInvite}>Copy invite link</button>
            </div>
          </div>
        )}

        <div className="row-between" style={{ marginTop: 20 }}>
          <h2>Jobs</h2>
          <button className="btn amber small" onClick={() => setShowForm(s => !s)}>
            {showForm ? 'Cancel' : '+ New job'}
          </button>
        </div>

        {showForm && (
          <div className="card">
            <form onSubmit={addJob}>
              <div className="field"><label>Job title *</label>
                <input placeholder="e.g. 138kV Transformer Commissioning" value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div className="field"><label>Site / location</label>
                <input placeholder="e.g. Substation 4, Baytown TX" value={form.site}
                  onChange={e => setForm({ ...form, site: e.target.value })} /></div>
              <div className="field"><label>Job number</label>
                <input value={form.job_number} onChange={e => setForm({ ...form, job_number: e.target.value })} /></div>
              <div className="field"><label>Scope of work</label>
                <textarea value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })} /></div>
              <button className="btn">Create job</button>
            </form>
          </div>
        )}

        {jobs?.length === 0 && !showForm && <div className="empty">No jobs yet for this customer.</div>}
        {jobs?.map(j => (
          <div key={j.id} className="card click" onClick={() => nav(`/admin/job/${j.id}`)}>
            <div className="row-between">
              <div>
                <h2>{j.title}</h2>
                <p className="muted">{j.site}{j.job_number ? ` · #${j.job_number}` : ''}</p>
              </div>
              <StatusBadge status={j.status} />
            </div>
          </div>
        ))}
        <Toast msg={toast} />
      </div>
    </>
  )
}
