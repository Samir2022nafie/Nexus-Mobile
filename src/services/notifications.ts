/**
 * Notifications Service — Maps to /notifications/* endpoints
 */
import api from './api';
import { NotificationItem, NotificationListParams } from '../types';

export const notificationsService = {
  /** GET /notifications */
  list(params?: NotificationListParams): Promise<NotificationItem[]> {
    return api.get<NotificationItem[]>('/notifications', params as Record<string, any>);
  },

  /** PATCH /notifications/:id/read */
  markAsRead(notificationId: string): Promise<{ id: string; isRead: boolean }> {
    return api.patch<{ id: string; isRead: boolean }>(`/notifications/${notificationId}/read`);
  },
};
