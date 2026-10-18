import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

let ioInstance: SocketIOServer | null = null;

const JWT_SECRET = process.env.JWT_SECRET || 'agriconnect_jwt_super_secret_dev_2026';

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  ioInstance = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Socket authentication middleware
  ioInstance.use(async (socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers['authorization']?.replace('Bearer ', '') ||
        socket.handshake.query?.token;

      if (!token || typeof token !== 'string') {
        // Allow anonymous guest connection for public marketplace inventory updates
        socket.data.isGuest = true;
        return next();
      }

      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await User.findById(decoded.userId).select('_id name email role isVerified');
      if (user) {
        socket.data.user = user;
        socket.data.isGuest = false;
      } else {
        socket.data.isGuest = true;
      }
      next();
    } catch (err) {
      // If token invalid, default to guest rather than crashing socket
      socket.data.isGuest = true;
      next();
    }
  });

  ioInstance.on('connection', (socket: Socket) => {
    const user = socket.data.user;

    // Join public marketplace room for live crop availability updates
    socket.join('room:marketplace');

    if (user) {
      // Join private user room for direct order/payout/status alerts
      socket.join(`user:${user._id.toString()}`);

      // Join role room
      socket.join(`role:${user.role}`);
      console.log(`Socket connected: ${user.name} (${user.role}) - ID: ${socket.id}`);
    } else {
      console.log(`Guest socket connected - ID: ${socket.id}`);
    }

    // Client can explicitly subscribe to an order room if authorized
    socket.on('join:order', (orderId: string) => {
      if (user && orderId) {
        socket.join(`order:${orderId}`);
      }
    });

    socket.on('leave:order', (orderId: string) => {
      if (orderId) {
        socket.leave(`order:${orderId}`);
      }
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  return ioInstance;
}

export function getIO(): SocketIOServer {
  if (!ioInstance) {
    throw new Error('Socket.IO is not initialized yet!');
  }
  return ioInstance;
}

// Real-time broadcast helpers
export const RealtimeNotifier = {
  // Broadcast inventory update to all marketplace viewers
  emitInventoryUpdate: (payload: { listingId: string; availableQuantity: number; status: string }) => {
    if (!ioInstance) return;
    ioInstance.to('room:marketplace').emit('inventory:updated', payload);
  },

  // Notify farmer about new incoming order
  emitNewOrderToFarmer: (farmerId: string, orderData: any) => {
    if (!ioInstance) return;
    ioInstance.to(`user:${farmerId}`).emit('order:new', orderData);
  },

  // Notify buyer about order status progression
  emitOrderStatusUpdate: (buyerId: string, orderId: string, statusPayload: any) => {
    if (!ioInstance) return;
    ioInstance.to(`user:${buyerId}`).emit('order:status_updated', statusPayload);
    ioInstance.to(`order:${orderId}`).emit('order:status_updated', statusPayload);
  },

  // Notify logistics partners
  emitLogisticsDispatch: (payload: any) => {
    if (!ioInstance) return;
    ioInstance.to('role:logistics').emit('logistics:dispatch_ready', payload);
  },

  // Notify specific user with generic notification
  emitUserAlert: (userId: string, notification: any) => {
    if (!ioInstance) return;
    ioInstance.to(`user:${userId}`).emit('notification:new', notification);
  },

  // Notify admins for platform alerts/metrics refresh
  emitAdminMetricsRefresh: (metricsSummary: any) => {
    if (!ioInstance) return;
    ioInstance.to('role:admin').emit('admin:metrics_refreshed', metricsSummary);
  },
};
