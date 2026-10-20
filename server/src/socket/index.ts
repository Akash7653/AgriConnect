import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { verifyAccessToken } from '../middleware/auth.js';

let ioInstance: SocketIOServer | null = null;

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  ioInstance = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
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
        return next(new Error('Authentication required'));
      }

      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId).select('_id name email role isVerified');
      if (!user || user.status === 'suspended') {
        return next(new Error('Invalid or suspended account'));
      }
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
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
    }

    socket.on('join:order', async (orderId: string) => {
      if (!user || !orderId) return;
      const order = await Order.findById(orderId).select('buyerId items.farmerId');
      if (!order) return;
      const isAdmin = user.role === 'admin';
      const isBuyer = order.buyerId.toString() === user._id.toString();
      const isFarmer = order.items.some((item) => item.farmerId.toString() === user._id.toString());
      if (isAdmin || isBuyer || isFarmer) {
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
