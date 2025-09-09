import { Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './routes/Home'
import Menu from './routes/Menu'
import Checkout from './routes/Checkout'
import OrderTracking from './routes/OrderTracking'
import AdminDashboard from './routes/AdminDashboard'
import DriverApp from './routes/DriverApp'
import CartDrawer from './components/CartDrawer'
import AdminLogin from './routes/AdminLogin'
import { getAdminToken } from './api'
import Catering from './routes/Catering'
import About from './routes/About'

export default function App() {
  return (
    <>
      <Header />
      <main className="container" style={{ padding: '24px 0' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/catering" element={<Catering />} />
          <Route path="/om-oss" element={<About />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:orderId" element={<OrderTracking />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={getAdminToken() ? <AdminDashboard /> : <Navigate to="/admin/login" replace />} />
          <Route path="/driver" element={<DriverApp />} />
        </Routes>
      </main>
      <CartDrawer />
      {!window.location.pathname.startsWith('/admin') && <Footer />}
    </>
  )
}
