import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './routes/Home'
import Menu from './routes/Menu'
import Checkout from './routes/Checkout'
import OrderTracking from './routes/OrderTracking'
import AdminDashboard from './routes/AdminDashboard'
import DriverApp from './routes/DriverApp'
import AdminLogin from './routes/AdminLogin'
import { Api } from './api'
import Catering from './routes/Catering'
import About from './routes/About'
import CheckOrder from './routes/CheckOrder'
import Kontakt from './routes/Kontakt'

export default function App() {
  return (
    <>
      <Header />
      <main className="container" style={{ padding: '24px 0' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/meny" element={<Menu />} />
          <Route path="/catering" element={<Catering />} />
          <Route path="/om-oss" element={<About />} />
          <Route path="/kontakt" element={<Kontakt />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/kontrollera-bestallning" element={<CheckOrder />} />
          <Route path="/order/:orderId" element={<OrderTracking />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<RequireAdmin />} />
          <Route path="/driver" element={<DriverApp />} />
        </Routes>
      </main>
      {/* Cart drawer removed per request */}
      {!window.location.pathname.startsWith('/admin') && <Footer />}
    </>
  )
}

function RequireAdmin() {
  const [loading, setLoading] = useState(true)
  const [ok, setOk] = useState(false)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        await Api.adminMe()
        if (mounted) setOk(true)
      } catch {
        if (mounted) setOk(false)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])
  if (loading) return <div className="card">Laddar...</div>
  return ok ? <AdminDashboard /> : <Navigate to="/admin/login" replace />
}
