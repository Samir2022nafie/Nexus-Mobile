/**
 * Notifications Service — Maps to /notifications/* endpoints
 */
import api from './api';
import { NotificationItem, NotificationListParams } from '../types';

export const notificationsService = {
  /** GET /notifications */
  async list(params?: NotificationListParams): Promise<NotificationItem[]> {
    const res = await api.get<any>('/notifications', params as Record<string, any>);
    const rawList = Array.isArray(res) ? res : res?.data || [];
    return rawList.map((n: any) => ({
      id: n.id,
      userId: n.userId || n.user_id,
      type: n.type,
      title: n.title,
      message: n.message,
      relatedEntityType: n.relatedEntityType || n.related_entity_type,
      relatedEntityId: n.relatedEntityId || n.related_entity_id,
      isRead: Boolean(n.isRead ?? n.is_read),
      createdAt: n.createdAt || n.created_at,
    }));
  },

  /** PATCH /notifications/:id/read */
  markAsRead(notificationId: string): Promise<{ id: string; isRead: boolean }> {
    return api.patch<{ id: string; isRead: boolean }>(`/notifications/${notificationId}/read`);
  },

  /** PATCH /notifications/read-all */
  markAllAsRead(): Promise<{ success: boolean }> {
    return api.patch<{ success: boolean }>('/notifications/read-all').catch(() => ({ success: true }));
  },
};
