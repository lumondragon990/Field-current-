import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { STATUS_LABELS, fmtStamp } from './lib/supabase.js'

export function TopBar({ who, homeTo = '/' }) {
  return (
    <div className="topbar">
      <div className="topbar-inner">
        <Link to={homeTo} className="brand">
          <span className="bolt">⚡</span> FieldCurrent
        </Link>
        <div className="who">{who || <span className="brand-sub">LIVE FROM THE FIELD · TRADELEC</span>}</div>
      </div>
    </div>
  )
}

export function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{STATUS_LABELS[status] || status}</span>
}

export function Toast({ msg }) {
  if (!msg) return null
  return <div className="toast">{msg}</div>
}

export function useToast() {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(''), 2600)
    return () => clearTimeout(t)
  }, [msg])
  return [msg, setMsg]
}

export function Lightbox({ url, onClose }) {
  if (!url) return null
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="btn small close" onClick={onClose}>Close ✕</button>
      <img src={url} alt="Job photo, full size" />
    </div>
  )
}

const KIND_LABELS = { note: 'Field note', photos: 'Photos', report: 'Report', status: 'Status change' }

export function UpdateCard({ u, onPhotoClick }) {
  return (
    <div className={`tag-card kind-${u.kind}`}>
      <div className="tag-head">
        <span className="tag-kind">{u.title || KIND_LABELS[u.kind] || 'Update'}</span>
        <span className="tag-stamp">{fmtStamp(u.created_at)}</span>
      </div>
      <div className="tag-body">
        {u.body && <p>{u.body}</p>}
        {Array.isArray(u.photo_urls) && u.photo_urls.length > 0 && (
          <div className="photo-grid">
            {u.photo_urls.map((url, i) => (
              <img key={i} src={url} alt={`Job photo ${i + 1}`} loading="lazy"
                onClick={() => onPhotoClick?.(url)} />
            ))}
          </div>
        )}
      </div>
      {u.author && <div className="tag-author">Posted by {u.author}</div>}
    </div>
  )
}
