import { Platform, AppState } from 'react-native';
import notificationPreferences, { GlobalNotificationSettings } from './notificationPreferences';
import { notificationsService } from './notifications';

export interface InAppNotificationPayload {
  id?: string;
  title: string;
  body: string;
  type?: string;
  entityType?: string;
  entityId?: string;
  slug?: string;
  communitySlug?: string;
  data?: any;
}

type InAppListener = (payload: InAppNotificationPayload) => void;

// Dynamic modular require for expo-notifications to ensure compatibility across all environments
// Specifically bypasses TopicSubscriptionModule which fails in Expo Go SDK 53 on Android
let Notifications: any = null;
try {
  const Perms = require('expo-notifications/build/NotificationPermissions');
  const Handler = require('expo-notifications/build/NotificationsHandler');
  const Channel = require('expo-notifications/build/setNotificationChannelAsync');
  const Sched = require('expo-notifications/build/scheduleNotificationAsync');
  const Scheduler = require('expo-notifications/build/NotificationScheduler');
  const Emitter = require('expo-notifications/build/NotificationsEmitter');
  const ChannelTypes = require('expo-notifications/build/NotificationChannelManager.types');

  Notifications = {
    ...Perms,
    ...Handler,
    ...Channel,
    ...Sched,
    ...Scheduler,
    ...Emitter,
    AndroidImportance: ChannelTypes.AndroidImportance || {
      UNKNOWN: 0,
      UNSPECIFIED: 1,
      NONE: 2,
      MIN: 3,
      LOW: 4,
      DEFAULT: 5,
      HIGH: 6,
      MAX: 7,
    },
  };

  try {
    const Cat = require('expo-notifications/build/setNotificationCategoryAsync');
    const Dismiss = require('expo-notifications/build/dismissNotificationAsync');
    Object.assign(Notifications, Cat, Dismiss);
  } catch {}

  // Suppress OS push alert banners while inside the app so our in-app top modal shows instead
  if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: true,
        shouldShowBanner: false, // Suppress OS push banner while in app!
        shouldShowList: false,   // Suppress OS notification list while in app!
      }),
    });
  }
} catch (e) {
  console.log('[PushNotificationService] Failed to load expo-notifications modularly:', e);
}

class PushNotificationService {
  private isInitialized = false;
  private notifiedIds = new Set<string>();
  private inAppListeners = new Set<InAppListener>();

  /**
   * Register a listener for in-app top sliding notification banners
   */
  addInAppListener(listener: InAppListener): () => void {
    this.inAppListeners.add(listener);
    return () => {
      this.inAppListeners.delete(listener);
    };
  }

  /**
   * Broadcast an in-app notification to the top sliding banner
   */
  triggerInAppNotification(payload: InAppNotificationPayload) {
    this.inAppListeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.warn('[PushNotificationService] Error in in-app listener:', err);
      }
    });
  }

  async init(): Promise<boolean> {
    if (this.isInitialized) return true;

    if (!Notifications) {
      return false;
    }

    try {
      if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Nexus Notifications',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#e8a736',
            sound: 'default',
            enableVibrate: true,
            showBadge: true,
          });
        } catch {
          // Fallback to OS defaults safely
        }
      }

      // Configure Notification Category with "Mark as read" action
      // On Android/iOS, this reveals the action when expanding the push notification
      if (typeof Notifications.setNotificationCategoryAsync === 'function') {
        try {
          await Notifications.setNotificationCategoryAsync('NEXUS_NOTIFICATION', [
            {
              identifier: 'MARK_AS_READ',
              buttonTitle: 'Mark as read',
              options: {
                opensAppToForeground: false,
              },
            },
          ]);
        } catch (catErr) {
          console.warn('[PushNotificationService] setNotificationCategoryAsync error:', catErr);
        }
      }

      // Catch foreground notifications received by expo-notifications and route to in-app banner
      if (typeof Notifications.addNotificationReceivedListener === 'function') {
        try {
          Notifications.addNotificationReceivedListener((notification: any) => {
            const content = notification?.request?.content || {};
            const data = content.data || {};
            this.triggerInAppNotification({
              id: data.notificationId || data.id,
              title: content.title || 'Nexus Notification',
              body: content.body || '',
              type: data.type,
              entityType: data.entityType,
              entityId: data.entityId,
              slug: data.slug || data.communitySlug,
              data,
            });
          });
        } catch {}
      }

      if (Notifications.getPermissionsAsync) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted' && Notifications.requestPermissionsAsync) {
          const res = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
          });
          finalStatus = res.status;
        }

        if (finalStatus === 'granted') {
          this.isInitialized = true;
          return true;
        }
        return false;
      }
      return false;
    } catch (e) {
      console.warn('[PushNotificationService] init error:', e);
      return false;
    }
  }

  /**
   * Listen for user responses on phone OS push notifications (e.g. tapping "Mark as read" or tapping notification)
   */
  setupResponseListener(router: any): () => void {
    if (!Notifications || typeof Notifications.addNotificationResponseReceivedListener !== 'function') {
      return () => {};
    }

    try {
      const subscription = Notifications.addNotificationResponseReceivedListener(async (response: any) => {
        try {
          const actionId = response.actionIdentifier;
          const content = response.notification?.request?.content || {};
          const data = content.data || {};
          const notifId = data.notificationId || data.id;

          // 1. If user clicked the "Mark as read" action from the collapsed/expanded push notification
          if (actionId === 'MARK_AS_READ') {
            if (notifId) {
              await notificationsService.markAsRead(notifId).catch(() => {});
            }
            if (typeof Notifications.dismissNotificationAsync === 'function' && response.notification?.request?.identifier) {
              await Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
            }
            return;
          }

          // 2. User tapped the push notification itself — open app & navigate
          if (notifId) {
            await notificationsService.markAsRead(notifId).catch(() => {});
          }

          const entityType = (data.entityType || data.type || '').toLowerCase();
          const entityId = data.entityId || data.relatedEntityId;
          const slug = data.slug || data.communitySlug;

          if (entityType.includes('event') && entityId) {
            router.push(`/event/${entityId}`);
          } else if (entityType.includes('hangout') && entityId) {
            router.push(`/hangout/${entityId}`);
          } else if (entityType.includes('post') && entityId) {
            router.push(`/post/${entityId}`);
          } else if (entityType.includes('community') && (slug || entityId)) {
            router.push(`/community/${slug || entityId}`);
          } else if (entityType.includes('user') && entityId) {
            router.push(`/user/${entityId}`);
          } else {
            router.push('/notifications');
          }
        } catch (err) {
          console.warn('[PushNotificationService] Error processing notification response:', err);
        }
      });

      return () => {
        if (subscription && typeof subscription.remove === 'function') {
          subscription.remove();
        }
      };
    } catch {
      return () => {};
    }
  }

  mapNotificationToTrigger(type: string, title?: string, message?: string): keyof GlobalNotificationSettings | null {
    const t = (type || '').toLowerCase();
    const titleLower = (title || '').toLowerCase();
    const msgLower = (message || '').toLowerCase();

    // Custom or 6 hour start alerts
    if (titleLower.includes('starting soon') || msgLower.includes('starts today') || msgLower.includes('reminder:')) {
      if (t.includes('hangout') || msgLower.includes('hangout')) return 'hangout_start_6h';
      return 'event_start_6h';
    }

    // Hangouts
    if (t === 'hangout_update' || (msgLower.includes('details of the hangout') && msgLower.includes('changed'))) {
      return 'hangout_details_changed';
    }
    if (t === 'hangout_join' || msgLower.includes('joined the hangout')) {
      return 'hangout_user_joined';
    }
    if (t === 'hangout_leave' || msgLower.includes('left the hangout')) {
      return 'hangout_user_left';
    }
    if (t === 'hangout_deleted' || (msgLower.includes('hangout') && (msgLower.includes('deleted') || msgLower.includes('was deleted')))) {
      return 'hangout_deleted';
    }
    if (t === 'hangout_ended' || (t.includes('hangout') && msgLower.includes('has ended'))) {
      return 'hangout_ended';
    }

    // Events
    if (t === 'event_update' || (msgLower.includes('details of the') && msgLower.includes('event got changed'))) {
      return 'event_details_changed';
    }
    if (t === 'event_join' || msgLower.includes('joined the event')) {
      return 'event_user_joined';
    }
    if (t === 'event_leave' || msgLower.includes('left the event')) {
      return 'event_user_left';
    }
    if (t === 'event_deleted' || (msgLower.includes('event') && (msgLower.includes('deleted') || msgLower.includes('was deleted')))) {
      return 'event_deleted';
    }
    if (t === 'event_ended' || msgLower.includes('event ended for the day') || (t.includes('event') && msgLower.includes('has ended'))) {
      return 'event_ended';
    }

    // Communities
    if (t === 'community_new_event' || (msgLower.includes('a new event') && msgLower.includes('got posted in'))) {
      return 'community_new_event';
    }

    return null;
  }

  /**
   * Schedule local reminder for event or hangout based on user's custom reminder settings (remind_days, remind_hours)
   */
  async scheduleCustomReminder(item: {
    id: string;
    title: string;
    startsAt?: string;
    starts_at?: string;
    entityType: 'event' | 'hangout';
  }) {
    await this.init();
    if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') return;

    const rawStarts = item.startsAt || item.starts_at;
    if (!rawStarts) return;
    const startTime = new Date(rawStarts).getTime();
    if (isNaN(startTime) || startTime <= Date.now()) return;

    // Retrieve specific entity settings or fallback to global settings
    const specific = await notificationPreferences.getSpecificSettings(item.id);
    if (specific.muted) return; // Muted

    const global = await notificationPreferences.getGlobalSettings();
    const isHangout = item.entityType === 'hangout';

    const reminderEnabled = isHangout
      ? (specific.reminder_enabled ?? global.hangout_reminder_enabled)
      : (specific.reminder_enabled ?? global.event_reminder_enabled);

    if (!reminderEnabled) return;

    const days = specific.remind_days !== undefined
      ? specific.remind_days
      : (isHangout ? global.hangout_remind_days : global.event_remind_days);

    const hours = specific.remind_hours !== undefined
      ? specific.remind_hours
      : (isHangout ? global.hangout_remind_hours : global.event_remind_hours);

    // Calculate notification trigger time
    const totalOffsetMs = (days * 24 + hours) * 60 * 60 * 1000;
    const triggerTime = startTime - totalOffsetMs;

    // Human readable reminder label
    let timeLabel = '';
    if (days === 0 && hours === 0) {
      timeLabel = 'is starting right now!';
    } else {
      const parts: string[] = [];
      if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
      if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
      timeLabel = `starts in ${parts.join(' ')}!`;
    }

    const title = `${isHangout ? 'Hangout' : 'Event'} Reminder`;
    const body = `"${item.title}" ${timeLabel}`;

    try {
      if (triggerTime > Date.now()) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data: {
              entityId: item.id,
              entityType: item.entityType,
              type: `${item.entityType}_reminder`,
            },
            categoryIdentifier: 'NEXUS_NOTIFICATION',
            sound: true,
            channelId: 'default',
          },
          trigger: {
            type: 'date',
            date: new Date(triggerTime),
          },
        });
      } else if (Date.now() - triggerTime < 30 * 60 * 1000 && Date.now() < startTime) {
        // Trigger window was reached within the past 30 minutes, deliver now
        await this.sendPushNotificationIfAllowed({
          title,
          body,
          type: `${item.entityType}_reminder`,
          entityId: item.id,
          data: {
            entityId: item.id,
            entityType: item.entityType,
            type: `${item.entityType}_reminder`,
          },
        });
      }
    } catch (e) {
      console.warn('Failed to schedule custom reminder:', e);
    }
  }

  /**
   * Sync unread notifications from backend and trigger either in-app banner or device push notification
   */
  async syncUnreadNotifications() {
    try {
      await this.init();
      const list = await notificationsService.list({ unreadOnly: true, limit: 10 });
      for (const notif of list) {
        if (!notif.isRead && !this.notifiedIds.has(notif.id)) {
          this.notifiedIds.add(notif.id);
          await this.sendPushNotificationIfAllowed({
            title: notif.title || 'Nexus Notification',
            body: notif.message || '',
            type: notif.type,
            entityId: notif.relatedEntityId || undefined,
            data: {
              notificationId: notif.id,
              entityId: notif.relatedEntityId,
              entityType: notif.relatedEntityType,
              type: notif.type,
            },
          });
        }
      }
    } catch {
      // Non-blocking sync
    }
  }

  async sendPushNotificationIfAllowed(params: {
    title: string;
    body: string;
    type?: string;
    entityId?: string;
    communityIdOrSlug?: string;
    data?: any;
  }) {
    await this.init();

    const trigger = this.mapNotificationToTrigger(params.type || '', params.title, params.body);
    if (trigger) {
      const allowed = await notificationPreferences.isNotificationAllowed(
        trigger,
        params.entityId,
        params.communityIdOrSlug,
      );
      if (!allowed) {
        return false;
      }
    }

    // REQUIREMENT 3: If user is inside the app, do NOT show OS push notification in device tray!
    // Instead, slide down the in-app modal from top of screen hovering below the status bar!
    if (AppState.currentState === 'active') {
      this.triggerInAppNotification({
        id: params.data?.notificationId,
        title: params.title,
        body: params.body,
        type: params.type,
        entityType: params.data?.entityType || params.type,
        entityId: params.entityId || params.data?.entityId,
        slug: params.communityIdOrSlug || params.data?.slug,
        data: params.data,
      });
      return true;
    }

    // If user is outside the app (background/killed), show OS device tray notification
    if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') {
      return false;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: params.title,
          body: params.body,
          data: params.data || {},
          categoryIdentifier: 'NEXUS_NOTIFICATION',
          sound: true,
          channelId: 'default',
        },
        trigger: null, // deliver immediately to device tray
      });
      return true;
    } catch (e) {
      console.warn('Failed to schedule local push notification:', e);
      return false;
    }
  }
}

export const pushNotifications = new PushNotificationService();
export default pushNotifications;
