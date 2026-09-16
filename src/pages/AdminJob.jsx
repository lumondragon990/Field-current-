import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, uploadPhotos, STATUS_LABELS, friendlyError } from '../lib/supabase.js'
import { TopBar, StatusBadge, UpdateCard, Lightbox, Toast, useToast } from '../components.jsx'
import { usePinGate, PinScreen } from './Admin.jsx'

export default function AdminJob() {
  const { ok, role, tryPin } = usePinGate()
  const { id } = useParams()
  const nav = useNavigate()
  const [jobSpend, setJobSpend] = useState(null)
  const [job, setJob] = useState(null)
  const [updates, setUpdates] = useState(null)
  const [kind, setKind] = useState('photos')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState('')
  const [big, setBig] = useState(null)
  const [toast, setToast] = useToast()
  const fileRef = useRef()

  useEffect(() => {
    if (!ok) return
    load()
    const ch = supabase.channel(`admin-job-${id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'updates', filter: `job_id=eq.${id}` },
        payload => {
          setUpdates(prev => {
            if ((prev || []).some(u => u.id === payload.new.id)) return prev
            return [payload.new, ...(prev || [])]
          })
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [ok, id])

  async function load() {
    const { data: j } = await supabase.from('jobs').select('*, customers(company)').eq('id', id).single()
    setJob(j)
    const { data: u } = await supabase.from('updates').select('*')
      .eq('job_id', id).order('created_at', { ascending: false })
    setUpdates(u || [])
    const { data: ex } = await supabase.from('expenses').select('amount').eq('job_id', id)
    if (ex) setJobSpend({ count: ex.length, total: ex.reduce((s2, x) => s2 + Number(x.amount || 0), 0) })
  }

  async function post(e) {
    e.preventDefault()
    if (!body.trim() && files.length === 0) { setToast('Add a note or photos first'); return }
    try {
      setBusy('Posting…')
      let photo_urls = []
      if (files.length > 0) photo_urls = await uploadPhotos(id, files, setBusy)
      const { error } = await supabase.from('updates').insert({
        job_id: id, kind, title: title.trim() || null, body: body.trim() || null, photo_urls
      })
      if (error) throw error
      setTitle(''); setBody(''); setFiles([])
      if (fileRef.current) fileRef.current.value = ''
      setToast('Posted — your customer sees it now')
      load()
    } catch (err) {
      setToast(friendlyError(err, 'Post'))
    } finally { setBusy('') }
  }

  async function setStatus(status) {
    await supabase.from('jobs').update({ status }).eq('id', id)
    await supabase.from('updates').insert({
      job_id: id, kind: 'status',
      body: `Job status changed to: ${STATUS_LABELS[status]}`
    })
    setToast(`Status set to ${STATUS_LABELS[status]}`)
    load()
  }

  async function deleteJob() {
    if (!job) return
    const sure = window.confirm(
      `Delete the job "${job.title}"?\n\nThis removes it and ALL its updates and photos — for you and for the customer. This cannot be undone.`
    )
    if (!sure) return
    const { error } = await supabase.from('jobs').delete().eq('id', id)
    if (error) { setToast(friendlyError(error, 'Delete')); return }
    nav(`/admin/customer/${job.customer_id}`)
  }

  if (!ok) return <PinScreen tryPin={tryPin} />

  return (
    <>
      <TopBar who="FIELD CONSOLE" homeTo="/admin" />
      <div className="wrap">
        <div className="page-head">
          <div className="eyebrow">{job?.customers?.company}</div>
          <h1>{job?.title || '…'}</h1>
          <p className="muted">{job?.site}{job?.job_number ? ` · #${job.job_number}` : ''}</p>
          {job && <StatusBadge status={job.status} />}
        </div>

        <div className="card">
          <h2>Set status</h2>
          <div className="btn-row">
            {Object.entries(STATUS_LABELS).map(([k, label]) => (
              <button key={k} className={`btn small ${job?.status === k ? 'amber' : 'ghost'}`}
                onClick={() => setStatus(k)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="row-between">
            <div>
              <h2>Receipts for this job</h2>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                {jobSpend ? `${jobSpend.count} receipt${jobSpend.count === 1 ? '' : 's'} · $${jobSpend.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} spent` : 'Loading…'}
              </p>
            </div>
            <button className="btn amber small" type="button" onClick={() => nav(`/admin/expenses?job=${id}`)}>
              + Add receipt for this job
            </button>
          </div>
        </div>

        <div className="card">
          <h2>Upload photos & reports</h2>
          <form onSubmit={post}>
            <div className="field">
              <label>Type</label>
              <select value={kind} onChange={e => setKind(e.target.value)}>
                <option value="photos">Photos from the field</option>
                <option value="report">Written report</option>
                <option value="note">Quick note</option>
              </select>
            </div>
            <div className="field">
              <label>Headline (optional)</label>
              <input placeholder="e.g. OLTC inspection complete — Phase B" value={title}
                onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label>{kind === 'report' ? 'Report' : 'Notes'}</label>
              <textarea placeholder="What did the crew find or complete?" value={body}
                onChange={e => setBody(e.target.value)} />
            </div>
            <div className="field">
              <label>Photos — camera or camera roll</label>
              <input ref={fileRef} type="file" accept="image/*" multiple
                onChange={e => setFiles(Array.from(e.target.files || []))} />
              {files.length > 0 && <p className="muted">{files.length} photo{files.length > 1 ? 's' : ''} selected</p>}
            </div>
            <button className="btn amber" disabled={!!busy}>{busy || 'Post update'}</button>
          </form>
        </div>

        <h2 style={{ marginTop: 24 }}>Timeline — includes customer comments</h2>
        {updates?.length === 0 && <div className="empty">No updates posted yet.</div>}
        {updates?.map(u => <UpdateCard key={u.id} u={u} onPhotoClick={setBig} />)}

        {role === 'admin' && (
          <div className="card" style={{ marginTop: 24 }}>
            <h2>Delete this job (admin only)</h2>
            <p className="muted">Removes the job and everything posted on it, for you and the customer. Receipts already saved stay in Receipts &amp; purchases.</p>
            <button className="btn danger" type="button" onClick={deleteJob}>Delete job</button>
          </div>
        )}

        <Lightbox url={big} onClose={() => setBig(null)} />
        <Toast msg={toast} />
      </div>
    </>
  )
}
