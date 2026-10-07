/**
 * Notifications Service — Maps to /notifications/* endpoints
 */
import api from './api';
import { NotificationItem, NotificationListParams } from '../types';

type UnreadListener = (count: number, hasUnread: boolean) => void;
const unreadListeners = new Set<UnreadListener>();
let currentUnreadCount = 0;

function notifyUnread(count: number) {
  currentUnreadCount = Math.max(0, count);
  const hasUnread = currentUnreadCount > 0;
  unreadListeners.forEach((listener) => {
    try {
      listener(currentUnreadCount, hasUnread);
    } catch {}
  });
}

export const notificationsService = {
  /** Subscribe to unread count changes across app */
  onUnreadChange(listener: UnreadListener): () => void {
    unreadListeners.add(listener);
    listener(currentUnreadCount, currentUnreadCount > 0);
    return () => {
      unreadListeners.delete(listener);
    };
  },

  getCurrentUnreadCount(): number {
    return currentUnreadCount;
  },

  /** GET /notifications */
  async list(params?: NotificationListParams): Promise<NotificationItem[]> {
    const res = await api.get<any>('/notifications', params as Record<string, any>);
    const rawList = Array.isArray(res) ? res : res?.data || [];
    const list = rawList.map((n: any) => ({
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

    // Update unread count based on actual unread items in the list if unreadOnly or full list
    if (params?.unreadOnly) {
      notifyUnread(list.length);
    }
    return list;
  },

  /** PATCH /notifications/:id/read */
  async markAsRead(notificationId: string): Promise<{ id: string; isRead: boolean }> {
    const res = await api.patch<{ id: string; isRead: boolean }>(`/notifications/${notificationId}/read`);
    notifyUnread(Math.max(0, currentUnreadCount - 1));
    return res;
  },

  /** PATCH /notifications/read-all */
  async markAllAsRead(): Promise<{ success: boolean }> {
    notifyUnread(0);
    return api.patch<{ success: boolean }>('/notifications/read-all').catch(() => ({ success: true }));
  },

  /** GET /notifications/unread-count */
  async getUnreadCount(): Promise<{ count: number; hasUnread: boolean }> {
    try {
      const res = await api.get<{ count: number; hasUnread: boolean }>('/notifications/unread-count');
      const count = typeof res?.count === 'number' ? res.count : 0;
      notifyUnread(count);
      return { count, hasUnread: count > 0 };
    } catch {
      return { count: currentUnreadCount, hasUnread: currentUnreadCount > 0 };
    }
  },

  /** DELETE /notifications/clear-all */
  async clearAll(): Promise<{ success: boolean }> {
    notifyUnread(0);
    return api.delete<{ success: boolean }>('/notifications/clear-all').catch(() => ({ success: true }));
  },

  /** DELETE /notifications/:id */
  async deleteNotification(notificationId: string): Promise<{ success: boolean }> {
    return api.delete<{ success: boolean }>(`/notifications/${notificationId}`).catch(() => ({ success: true }));
  },
};
