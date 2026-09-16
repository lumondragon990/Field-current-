import React, { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase, uploadPhotos, fmtStamp, friendlyError } from '../lib/supabase.js'
import { TopBar, Lightbox, Toast, useToast } from '../components.jsx'
import { usePinGate, PinScreen } from './Admin.jsx'

function money(n) {
  return `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Shrink the photo before sending it to the AI (keeps it fast and under size limits)
function toScanImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const urlObj = URL.createObjectURL(file)
    img.onload = () => {
      const max = 1600
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(urlObj)
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
    }
    img.onerror = () => { URL.revokeObjectURL(urlObj); reject(new Error('bad image')) }
    img.src = urlObj
  })
}

export default function AdminExpenses() {
  const { ok, tryPin } = usePinGate()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const jobId = params.get('job')
  const general = params.get('general') === '1'
  const [job, setJob] = useState(null)
  const [jobs, setJobs] = useState(null)
  const [expenses, setExpenses] = useState(null)
  const [form, setForm] = useState({
    project: '', note: '', vendor: '', amount: '', receipt_date: '',
    purchased_by: localStorage.getItem('fc_emp_name') || ''
  })
  const [files, setFiles] = useState([])
  const [scan, setScan] = useState({ state: 'idle', msg: '' })
  const [busy, setBusy] = useState('')
  const [big, setBig] = useState(null)
  const [toast, setToast] = useToast()
  const fileRef = useRef()

  const formOpen = Boolean(jobId || general)

  useEffect(() => { if (ok) load() }, [ok, jobId, general])

  async function load() {
    const { data } = await supabase.from('expenses').select('*').order('created_at', { ascending: false })
    setExpenses(data || [])
    if (jobId) {
      const { data: j } = await supabase.from('jobs').select('title, customers(company)').eq('id', jobId).maybeSingle()
      setJob(j || null)
      if (j) setForm(f => f.project ? f : { ...f, project: j.title })
    } else {
      setJob(null)
      const { data: js } = await supabase.from('jobs')
        .select('id, title, job_number, customers(company)')
        .order('created_at', { ascending: false })
      setJobs(js || [])
    }
  }

  async function scanReceipt(file) {
    try {
      setScan({ state: 'busy', msg: 'AI is reading the receipt…' })
      const base64 = await toScanImage(file)
      const r = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, media_type: 'image/jpeg' })
      })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      setForm(f => ({
        ...f,
        vendor: j.vendor || f.vendor,
        amount: j.amount ? String(j.amount) : f.amount,
        receipt_date: j.date || f.receipt_date,
        note: f.note || j.summary || ''
      }))
      setScan({
        state: 'done',
        msg: `AI read: ${j.vendor || 'store not found'} — ${j.amount ? money(j.amount) : 'amount not found'}${j.date ? ` — ${j.date}` : ''}`
      })
    } catch (err) {
      setScan({ state: 'fail', msg: (err && err.message) || 'Could not read the receipt — fill the fields in manually.' })
    }
  }

  function onPickFiles(e) {
    const arr = Array.from(e.target.files || [])
    setFiles(arr)
    if (arr.length > 0) scanReceipt(arr[0])
  }

  async function addExpense(e) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (files.length === 0) { setToast('Add the receipt photo first'); return }
    if (!form.vendor.trim()) { setToast('The AI could not read the store — type it in'); return }
    if (!amount || amount <= 0) { setToast('The AI could not read the amount — type it in'); return }
    try {
      setBusy('Saving…')
      const photo_urls = await uploadPhotos('receipts', files, setBusy)
      if (form.purchased_by.trim()) localStorage.setItem('fc_emp_name', form.purchased_by.trim())
      const { error } = await supabase.from('expenses').insert({
        vendor: form.vendor.trim(), amount,
        job_id: jobId || null,
        project: (jobId ? (job?.title || form.project) : form.project).trim() || null,
        receipt_date: form.receipt_date || null,
        note: form.note.trim() || null,
        purchased_by: form.purchased_by.trim() || null,
        photo_urls
      })
      if (error) throw error
      setForm(f => ({ project: '', note: '', vendor: '', amount: '', receipt_date: '', purchased_by: f.purchased_by }))
      setFiles([])
      setScan({ state: 'idle', msg: '' })
      if (fileRef.current) fileRef.current.value = ''
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

  const all = expenses || []
  const list = jobId ? all.filter(x => x.job_id === jobId) : (general ? all : all)
  const total = list.reduce((s, x) => s + Number(x.amount || 0), 0)
  const now = new Date()
  const monthTotal = list
    .filter(x => {
      const d = new Date(x.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, x) => s + Number(x.amount || 0), 0)
  const byProject = {}
  for (const x of all) {
    const p = x.project || 'No project'
    byProject[p] = (byProject[p] || 0) + Number(x.amount || 0)
  }
  const projectRows = Object.entries(byProject).sort((a, b) => b[1] - a[1])

  const scanColor = scan.state === 'fail' ? 'var(--red)' : scan.state === 'done' ? 'var(--green)' : 'var(--ink-soft)'

  return (
    <>
      <TopBar who="RECEIPTS & PURCHASES" homeTo="/admin" />
      <div className="wrap">
        <div className="page-head">
          <div className="eyebrow">Field console</div>
          <h1>Receipts & purchases</h1>
          {jobId && (
            <p className="muted">
              Job: <strong>{job?.title || '…'}</strong>{job?.customers?.company ? ` — ${job.customers.company}` : ''}
              {' · '}<Link to="/admin/expenses">← All jobs</Link>
            </p>
          )}
          {general && (
            <p className="muted">General purchase (not tied to a job) · <Link to="/admin/expenses">← All jobs</Link></p>
          )}
        </div>

        {/* ============ STEP 1: PICK THE JOB ============ */}
        {!formOpen && (
          <>
            <div className="card" style={{ background: '#FFF9EC', borderColor: 'var(--amber)' }}>
              <h2>Adding a receipt? Tap the job below</h2>
              <p className="muted" style={{ margin: '4px 0 0' }}>The form opens with the job already set — just add the photo and the AI does the typing.</p>
            </div>

            {jobs === null && <p className="muted">Loading jobs…</p>}
            {jobs?.length === 0 && (
              <div className="empty">No jobs yet. Create one first: Customers → tap the customer → + New job.</div>
            )}
            {jobs?.map(j => (
              <div key={j.id} className="card click" onClick={() => nav(`/admin/expenses?job=${j.id}`)}>
                <div className="row-between">
                  <div>
                    <h2>{j.title}</h2>
                    <p className="muted">{j.customers?.company}{j.job_number ? ` · #${j.job_number}` : ''}</p>
                  </div>
                  <span className="badge in_progress">Add receipt →</span>
                </div>
              </div>
            ))}

            <p className="muted" style={{ textAlign: 'center' }}>
              Purchase not for any job? <Link to="/admin/expenses?general=1">Add a general receipt</Link>
            </p>
          </>
        )}

        {/* ============ STEP 2: THE RECEIPT FORM ============ */}
        {formOpen && (
          <div className="card">
            <h2>New receipt — AI does the reading</h2>
            <form onSubmit={addExpense}>
              <div className="field">
                <label>Receipt photo — camera or camera roll *</label>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={onPickFiles} />
              </div>

              {scan.state !== 'idle' && (
                <p className="mono" style={{ color: scanColor, fontSize: 13 }}>
                  {scan.state === 'busy' ? '⏳ ' : scan.state === 'done' ? '✓ ' : '⚠ '}{scan.msg}
                </p>
              )}

              {general && (
                <div className="field"><label>Project / what area is this for</label>
                  <input placeholder="e.g. Shop supplies" value={form.project}
                    onChange={e => setForm({ ...form, project: e.target.value })} /></div>
              )}

              <div className="field"><label>What was it for</label>
                <input placeholder="AI fills this from the receipt — edit if needed" value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })} /></div>
              <div className="field"><label>Store (AI-filled — check it)</label>
                <input value={form.vendor}
                  onChange={e => setForm({ ...form, vendor: e.target.value })} /></div>
              <div className="field"><label>Amount USD (AI-filled — check it)</label>
                <input type="number" inputMode="decimal" step="0.01" min="0"
                  value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="field"><label>Receipt date (AI-filled)</label>
                <input type="date" value={form.receipt_date}
                  onChange={e => setForm({ ...form, receipt_date: e.target.value })} /></div>
              <div className="field"><label>Your name</label>
                <input placeholder="Who made the purchase" value={form.purchased_by}
                  onChange={e => setForm({ ...form, purchased_by: e.target.value })} /></div>

              <button className="btn amber" disabled={!!busy || scan.state === 'busy'}>{busy || 'Save receipt'}</button>
            </form>
          </div>
        )}

        {/* ============ TOTALS & LIST ============ */}
        {formOpen && jobId && (
          <div className="card">
            <div className="eyebrow">Spent on this job</div>
            <h2 style={{ fontSize: 30 }}>{money(total)}</h2>
          </div>
        )}

        {!formOpen && (
          <>
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

            {projectRows.length > 0 && (
              <div className="card">
                <h2>Spent by job / project</h2>
                {projectRows.map(([p, amt]) => (
                  <div key={p} className="row-between" style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)' }}>
                    <span>{p}</span>
                    <span className="mono">{money(amt)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <h2 style={{ marginTop: 24 }}>{jobId ? 'Receipts on this job' : 'All receipts'}</h2>
        {expenses === null && <p className="muted">Loading…</p>}
        {expenses !== null && list.length === 0 && (
          <div className="empty">{jobId ? 'No receipts on this job yet.' : 'No receipts yet.'}</div>
        )}
        {list.map(x => (
          <div key={x.id} className="tag-card kind-report">
            <div className="tag-head">
              <span className="tag-kind">{x.vendor} — {money(x.amount)}</span>
              <span className="tag-stamp">{x.receipt_date || fmtStamp(x.created_at)}</span>
            </div>
            <div className="tag-body">
              {!jobId && x.project && <p><strong>Job:</strong> {x.project}</p>}
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
