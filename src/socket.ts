import { io, Socket } from 'socket.io-client'
import { getAdminToken } from './api'

export const socket: Socket = io('/', {
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
