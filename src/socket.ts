import { io, Socket } from 'socket.io-client'
import { getAdminToken, API_BASE } from './api'

// Derive socket server URL: prefer VITE_SOCKET_URL, else use origin of API_BASE, else current origin
const RAW_SOCKET_URL = (import.meta as any)?.env?.VITE_SOCKET_URL as string | undefined
let socketUrl: string | undefined
if (RAW_SOCKET_URL && /^https?:\/\//i.test(RAW_SOCKET_URL)) {
  socketUrl = RAW_SOCKET_URL
} else if (/^https?:\/\//i.test(API_BASE)) {
  try { socketUrl = new URL(API_BASE).origin } catch {}
}

export const socket: Socket = io(socketUrl || '/', {
  path: '/socket.io',
  transports: ['websocket'],
  autoConnect: true
})

// Join admin room if a token is present
socket.on('connect', () => {
  const token = getAdminToken()
  if (token) {
    socket.emit('joinAdmin')
  }
})
