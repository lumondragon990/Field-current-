import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './styles.css'
import Home from './pages/Home.jsx'
import Admin from './pages/Admin.jsx'
import AdminCustomer from './pages/AdminCustomer.jsx'
import AdminJob from './pages/AdminJob.jsx'
import Portal from './pages/Portal.jsx'
import PortalJob from './pages/PortalJob.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/customer/:id" element={<AdminCustomer />} />
        <Route path="/admin/job/:id" element={<AdminJob />} />
        <Route path="/c/:code" element={<Portal />} />
        <Route path="/c/:code/job/:id" element={<PortalJob />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
