import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/config/app';

type RealtimeListener = () => void;

let socket: Socket | null = null;
let activeToken = '';
const listeners = new Set<RealtimeListener>();

function connect(token: string) {
  if (socket && activeToken === token) return;
  socket?.disconnect();

  const apiUrl = new URL(API_BASE_URL);
  const socketPath = apiUrl.pathname.replace(/\/api\/?$/, '').replace(/\/$/, '');
  activeToken = token;
  socket = io(`${apiUrl.origin}${socketPath}`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 8,
    timeout: 8000,
  });

  const refreshEvents = [
    'inventory:updated',
    'order:new',
    'order:status_updated',
    'notification:new',
    'admin:metrics_refreshed',
  ];
  refreshEvents.forEach((event) => socket?.on(event, () => listeners.forEach((listener) => listener())));
}

export function subscribeRealtime(token: string, listener: RealtimeListener): () => void {
  listeners.add(listener);
  connect(token);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      socket?.disconnect();
      socket = null;
      activeToken = '';
    }
  };
}
