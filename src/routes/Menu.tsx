import MenuGrid from '../components/MenuGrid'
import { useCart } from '../store/cart'

export default function Menu() {
  const cart = useCart()
  return (
    <section className="container" style={{ display:'grid', gap:16 }}>
      <h2 style={{ marginTop:0 }}>Meny</h2>
      <MenuGrid onAdd={cart.add} />
    </section>
  )
}
