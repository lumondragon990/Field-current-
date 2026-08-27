import React from 'react'
import { Link } from 'react-router-dom'
import { TopBar } from '../components.jsx'

export default function Home() {
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
          <h2>Customers</h2>
          <p className="muted">
            Your live job page is one tap away — just open the link your Tradelec
            project contact sent you. No sign-in, no codes. If you can't find your
            link, call or text your project manager and we'll resend it.
          </p>
          <div className="btn-row">
            <a className="btn small" href="tel:8329700859">Call Tradelec</a>
            <a className="btn ghost small" href="mailto:lmondragon@tradelec.net">Email us</a>
          </div>
        </div>

        <p className="muted" style={{ textAlign: 'center' }}>
          Tradelec team member? <Link to="/admin">Open the field console</Link>
        </p>
      </div>
    </>
  )
}
