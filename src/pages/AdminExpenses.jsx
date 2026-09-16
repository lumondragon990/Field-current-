import React, { useEffect, useRef, useState } from 'react'
import { supabase, uploadPhotos, fmtStamp, friendlyError } from '../lib/supabase.js'
import { TopBar, Lightbox, Toast, useToast } from '../components.jsx'
import { usePinGate, PinScreen } from './Admin.jsx'

function money(n) {
  return `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function AdminExpenses() {
  const { ok, tryPin } = usePinGate()
  const [expenses, setExpenses] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    vendor: '', amount: '', note: '',
    purchased_by: localStorage.getItem('fc_emp_name') || ''
  })
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState('')
  const [big, setBig] = useState(null)
  const [toast, setToast] = useToast()
  const fileRef = useRef()

  useEffect(() => { if (ok) load() }, [ok])

  async function load() {
    const { data } = await supabase.from('expenses').select('*').order('created_at', { ascending: false })
    setExpenses(data || [])
  }

  async function addExpense(e) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.vendor.trim()) { setToast('Enter the store / vendor'); return }
    if (!amount || amount <= 0) { setToast('Enter the amount'); return }
    try {
      setBusy('Saving…')
      let photo_urls = []
      if (files.length > 0) photo_urls = await uploadPhotos('receipts', files, setBusy)
      if (form.purchased_by.trim()) localStorage.setItem('fc_emp_name', form.purchased_by.trim())
      const { error } = await supabase.from('expenses').insert({
        vendor: form.vendor.trim(), amount,
        note: form.note.trim() || null,
        purchased_by: form.purchased_by.trim() || null,
        photo_urls
      })
      if (error) throw error
      setForm(f => ({ vendor: '', amount: '', note: '', purchased_by: f.purchased_by }))
      setFiles([])
      if (fileRef.current) fileRef.current.value = ''
      setShowForm(false)
      setToast(`Receipt saved — ${money(amount)} at ${form.vendor.trim()}`)
      load()
    } catch (err) {
      setToast(friendlyError(err, 'Save'))
    } finally { setBusy('') }
  }

  async function removeExpense(x) {
    if (!window.confirm(`Delete the ${money(x.amount)} receipt from ${x.vendor}?`)) return
    const { error } = await supabase.from('expenses').delete().eq('id', x.id)
    if (error) { setToast(friendlyError(error, 'Delete')); return }
    setToast('Receipt deleted')
    load()
  }

  if (!ok) return <PinScreen tryPin={tryPin} />

  const list = expenses || []
  const total = list.reduce((s, x) => s + Number(x.amount || 0), 0)
  const now = new Date()
  const monthTotal = list
    .filter(x => {
      const d = new Date(x.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, x) => s + Number(x.amount || 0), 0)
  const byVendor = {}
  for (const x of list) {
    const v = x.vendor || 'Other'
    byVendor[v] = (byVendor[v] || 0) + Number(x.amount || 0)
  }
  const vendorRows = Object.entries(byVendor).sort((a, b) => b[1] - a[1])

  return (
    <>
      <TopBar who="RECEIPTS & PURCHASES" homeTo="/admin" />
      <div className="wrap">
        <div className="page-head row-between">
          <div>
            <div className="eyebrow">Field console</div>
            <h1>Receipts & purchases</h1>
          </div>
          <button className="btn amber small" onClick={() => setShowForm(s => !s)}>
            {showForm ? 'Cancel' : '+ Add receipt'}
          </button>
        </div>

        <div className="card">
          <div className="row-between">
            <div>
              <div className="eyebrow">Total spent</div>
              <h2 style={{ fontSize: 30 }}>{money(total)}</h2>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="eyebrow">This month</div>
              <h2 style={{ fontSize: 30 }}>{money(monthTotal)}</h2>
            </div>
          </div>
        </div>

        {vendorRows.length > 0 && (
          <div className="card">
            <h2>Where it was spent</h2>
            {vendorRows.map(([v, amt]) => (
              <div key={v} className="row-between" style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)' }}>
                <span>{v}</span>
                <span className="mono">{money(amt)}</span>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="card">
            <h2>New receipt</h2>
            <form onSubmit={addExpense}>
              <div className="field"><label>Store / vendor *</label>
                <input placeholder="e.g. Home Depot, Grainger, Shell" value={form.vendor}
                  onChange={e => setForm({ ...form, vendor: e.target.value })} /></div>
              <div className="field"><label>Amount (USD) *</label>
                <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
                  value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="field"><label>What was it for</label>
                <input placeholder="e.g. Gaskets and torque wrench for WEG job" value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })} /></div>
              <div className="field"><label>Your name</label>
                <input placeholder="Who made the purchase" value={form.purchased_by}
                  onChange={e => setForm({ ...form, purchased_by: e.target.value })} /></div>
              <div className="field">
                <label>Receipt photo — camera or camera roll</label>
                <input ref={fileRef} type="file" accept="image/*" multiple
                  onChange={e => setFiles(Array.from(e.target.files || []))} />
                {files.length > 0 && <p className="muted">{files.length} photo{files.length > 1 ? 's' : ''} selected</p>}
              </div>
              <button className="btn amber" disabled={!!busy}>{busy || 'Save receipt'}</button>
            </form>
          </div>
        )}

        <h2 style={{ marginTop: 24 }}>All receipts</h2>
        {expenses === null && <p className="muted">Loading…</p>}
        {list.length === 0 && expenses !== null && (
          <div className="empty">No receipts yet. Tap "+ Add receipt" after any purchase.</div>
        )}
        {list.map(x => (
          <div key={x.id} className="tag-card kind-report">
            <div className="tag-head">
              <span className="tag-kind">{x.vendor} — {money(x.amount)}</span>
              <span className="tag-stamp">{fmtStamp(x.created_at)}</span>
            </div>
            <div className="tag-body">
              {x.note && <p>{x.note}</p>}
              {Array.isArray(x.photo_urls) && x.photo_urls.length > 0 && (
                <div className="photo-grid">
                  {x.photo_urls.map((url, i) => (
                    <img key={i} src={url} alt={`Receipt ${i + 1}`} loading="lazy" onClick={() => setBig(url)} />
                  ))}
                </div>
              )}
              <div className="btn-row" style={{ marginBottom: 0 }}>
                <button className="btn danger small" onClick={() => removeExpense(x)}>Delete</button>
              </div>
            </div>
            {x.purchased_by && <div className="tag-author">Purchased by {x.purchased_by}</div>}
          </div>
        ))}

        <Lightbox url={big} onClose={() => setBig(null)} />
        <Toast msg={toast} />
      </div>
    </>
  )
}
