import { Response } from 'express';
import { Notification } from '../models/Notification.js';
import { AuthRequest } from '../middleware/auth.js';

export async function getUserNotifications(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const notifications = await Notification.find({ recipientId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ recipientId: req.user._id, read: false });

    res.json({ success: true, notifications, unreadCount });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function markNotificationRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    if (id === 'all') {
      await Notification.updateMany({ recipientId: req.user._id, read: false }, { read: true });
      res.json({ success: true, message: 'All notifications marked as read' });
      return;
    }

    await Notification.findOneAndUpdate({ _id: id, recipientId: req.user._id }, { read: true });
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}
