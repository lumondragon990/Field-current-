import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { TopBar, StatusBadge } from '../components.jsx'

export default function Portal() {
  const { code } = useParams()
  const nav = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [jobs, setJobs] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => { load() }, [code])

  async function load() {
    const { data: c } = await supabase.from('customers').select('*')
      .eq('access_code', code.toUpperCase()).maybeSingle()
    if (!c) { setNotFound(true); return }
    setCustomer(c)
    const { data: j } = await supabase.from('jobs').select('*')
      .eq('customer_id', c.id).order('created_at', { ascending: false })
    setJobs(j || [])
  }

  if (notFound) return (
    <>
      <TopBar />
      <div className="wrap">
        <div className="empty" style={{ marginTop: 40 }}>
          That access code was not found. Double-check it with your Tradelec contact,
          or go back to the <a href="/">home page</a>.
        </div>
      </div>
    </>
  )

  return (
    <>
      <TopBar who={customer?.company?.toUpperCase()} />
      <div className="wrap">
        <div className="page-head">
          <div className="eyebrow">Your projects with Tradelec</div>
          <h1>{customer?.company || '…'}</h1>
          <span className="live"><span className="live-dot" /> Live updates on</span>
        </div>

        {jobs?.length === 0 && (
          <div className="empty">No jobs on the board yet. They will appear here the moment Tradelec schedules your work.</div>
        )}
        {jobs?.map(j => (
          <div key={j.id} className="card click" onClick={() => nav(`/c/${code}/job/${j.id}`)}>
            <div className="row-between">
              <div>
                <h2>{j.title}</h2>
                <p className="muted">{j.site}{j.job_number ? ` · #${j.job_number}` : ''}</p>
              </div>
              <StatusBadge status={j.status} />
            </div>
          </div>
        ))}

        <div className="card no-print">
          <h2>Need something?</h2>
          <p className="muted">Your Tradelec project team is one tap away.</p>
          <div className="btn-row">
            <a className="btn small" href="tel:8329700859">Call Tradelec</a>
            <a className="btn ghost small" href="mailto:lmondragon@tradelec.net">Email project manager</a>
          </div>
        </div>
      </div>
    </>
  )
}
