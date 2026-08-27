import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, uploadPhotos, STATUS_LABELS } from '../lib/supabase.js'
import { TopBar, StatusBadge, UpdateCard, Lightbox, Toast, useToast } from '../components.jsx'
import { usePinGate, PinScreen } from './Admin.jsx'

export default function AdminJob() {
  const { ok, tryPin } = usePinGate()
  const { id } = useParams()
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

  useEffect(() => { if (ok) load() }, [ok, id])

  async function load() {
    const { data: j } = await supabase.from('jobs').select('*, customers(company)').eq('id', id).single()
    setJob(j)
    const { data: u } = await supabase.from('updates').select('*')
      .eq('job_id', id).order('created_at', { ascending: false })
    setUpdates(u || [])
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
    } catch {
      setToast('Something failed while posting. Check your connection and try again.')
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
          <h2>Post an update</h2>
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

        <h2 style={{ marginTop: 24 }}>Timeline</h2>
        {updates?.length === 0 && <div className="empty">No updates posted yet.</div>}
        {updates?.map(u => <UpdateCard key={u.id} u={u} onPhotoClick={setBig} />)}

        <Lightbox url={big} onClose={() => setBig(null)} />
        <Toast msg={toast} />
      </div>
    </>
  )
}
