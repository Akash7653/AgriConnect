import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('agriconnect_token');
    socket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('⚡ Socket connected to AgriConnect Realtime Network:', socket?.id);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected from AgriConnect');
    });
  }
  return socket;
}

export function refreshSocketAuth(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    getSocket();
  }
}
