import React, { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, uploadPhotos, friendlyError } from '../lib/supabase.js'
import { TopBar, StatusBadge, UpdateCard, Lightbox, Toast, useToast } from '../components.jsx'

export default function PortalJob() {
  const { code, id } = useParams()
  const [job, setJob] = useState(null)
  const [company, setCompany] = useState('')
  const [updates, setUpdates] = useState(null)
  const [filter, setFilter] = useState('all')
  const [comment, setComment] = useState('')
  const [files, setFiles] = useState([])
  const [sending, setSending] = useState('')
  const [big, setBig] = useState(null)
  const [toast, setToast] = useToast()
  const fileRef = useRef()

  useEffect(() => {
    load()
    const ch = supabase.channel(`job-${id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'updates', filter: `job_id=eq.${id}` },
        payload => {
          setUpdates(prev => {
            if ((prev || []).some(u => u.id === payload.new.id)) return prev
            return [payload.new, ...(prev || [])]
          })
          if (payload.new.kind !== 'comment') setToast('New update from the field')
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${id}` },
        payload => setJob(j => ({ ...j, ...payload.new })))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [id])

  async function load() {
    const { data: c } = await supabase.from('customers').select('company')
      .eq('access_code', code.toUpperCase()).maybeSingle()
    setCompany(c?.company || 'Customer')
    const { data: j } = await supabase.from('jobs').select('*').eq('id', id).single()
    setJob(j)
    const { data: u } = await supabase.from('updates').select('*')
      .eq('job_id', id).order('created_at', { ascending: false })
    setUpdates(u || [])
  }

  async function sendComment(e) {
    e.preventDefault()
    if (!comment.trim() && files.length === 0) { setToast('Write a note or add a photo first'); return }
    try {
      setSending('Sending…')
      let photo_urls = []
      if (files.length > 0) photo_urls = await uploadPhotos(id, files, setSending)
      const { error } = await supabase.from('updates').insert({
        job_id: id, kind: 'comment',
        body: comment.trim() || null,
        photo_urls,
        author: `${company} (customer)`
      })
      if (error) throw error
      setComment(''); setFiles([])
      if (fileRef.current) fileRef.current.value = ''
      setToast('Sent to the Tradelec team')
      load()
    } catch (err) {
      setToast(friendlyError(err, 'Send'))
    } finally { setSending('') }
  }

  const shown = (updates || []).filter(u => filter === 'all' ? true : u.kind === filter)
  const allPhotos = (updates || []).flatMap(u => u.photo_urls || [])

  return (
    <>
      <TopBar who="LIVE JOB VIEW" homeTo={`/c/${code}`} />
      <div className="wrap">
        <p className="no-print" style={{ marginTop: 12 }}>
          <Link to={`/c/${code}`}>← All your jobs</Link>
        </p>
        <div className="page-head">
          <h1>{job?.title || '…'}</h1>
          <p className="muted">{job?.site}{job?.job_number ? ` · #${job.job_number}` : ''}</p>
          <div className="row-between">
            {job && <StatusBadge status={job.status} />}
            <span className="live"><span className="live-dot" /> Live</span>
          </div>
          {job?.scope && <p className="muted" style={{ marginTop: 10 }}><strong>Scope:</strong> {job.scope}</p>}
        </div>

        <div className="card no-print">
          <h2>Tools</h2>
          <div className="btn-row">
            <button className="btn small" onClick={() => window.print()}>Save / print full report</button>
            <button className={`btn small ${filter === 'photos' ? 'amber' : 'ghost'}`}
              onClick={() => setFilter(f => f === 'photos' ? 'all' : 'photos')}>
              Photo gallery ({allPhotos.length})
            </button>
            <button className={`btn small ${filter === 'report' ? 'amber' : 'ghost'}`}
              onClick={() => setFilter(f => f === 'report' ? 'all' : 'report')}>
              Reports only
            </button>
            <a className="btn ghost small" href="tel:8329700859">Call Tradelec</a>
          </div>
        </div>

        <div className="card no-print">
          <h2>Send us notes or photos</h2>
          <p className="muted">Questions, requests, or photos of your transformer — they go straight to this job's timeline and the Tradelec team.</p>
          <form onSubmit={sendComment}>
            <div className="field">
              <label>Your note</label>
              <textarea placeholder="e.g. Can you send a photo of the nameplate before you close up?"
                value={comment} onChange={e => setComment(e.target.value)} />
            </div>
            <div className="field">
              <label>Photos — camera or camera roll (optional)</label>
              <input ref={fileRef} type="file" accept="image/*" multiple
                onChange={e => setFiles(Array.from(e.target.files || []))} />
              {files.length > 0 && <p className="muted">{files.length} photo{files.length > 1 ? 's' : ''} selected</p>}
            </div>
            <button className="btn" disabled={!!sending}>{sending || 'Send to Tradelec'}</button>
          </form>
        </div>

        <h2>Live field timeline</h2>
        {updates?.length === 0 && (
          <div className="empty">Nothing posted yet. Updates from the crew will appear here instantly — no refresh needed.</div>
        )}
        {shown.map(u => <UpdateCard key={u.id} u={u} onPhotoClick={setBig} />)}

        <Lightbox url={big} onClose={() => setBig(null)} />
        <Toast msg={toast} />
      </div>
    </>
  )
}
