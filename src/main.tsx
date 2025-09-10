import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { CartProvider } from './store/cart'
import { StoreStatusProvider } from './store/storeStatus'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreStatusProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </StoreStatusProvider>
    </BrowserRouter>
  </React.StrictMode>
)
