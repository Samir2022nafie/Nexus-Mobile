import { Platform } from 'react-native';
import notificationPreferences, { GlobalNotificationSettings } from './notificationPreferences';
import { notificationsService } from './notifications';

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

  if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (e) {
  console.log('[PushNotificationService] Failed to load expo-notifications modularly:', e);
}

class PushNotificationService {
  private isInitialized = false;
  private notifiedIds = new Set<string>();

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
          // Expo Go SDK 53 Android removes NotificationsChannelsProvider; fallback to OS defaults safely
        }
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
            data: { entityId: item.id, entityType: item.entityType },
            sound: true,
            channelId: 'default',
          },
          trigger: {
            type: 'date',
            date: new Date(triggerTime),
          },
        });
      } else if (Date.now() - triggerTime < 30 * 60 * 1000 && Date.now() < startTime) {
        // Trigger window was reached within the past 30 minutes, send immediate push
        await this.sendPushNotificationIfAllowed({
          title,
          body,
          type: `${item.entityType}_reminder`,
          entityId: item.id,
        });
      }
    } catch (e) {
      console.warn('Failed to schedule custom reminder:', e);
    }
  }

  /**
   * Sync unread notifications from backend and trigger device push notifications
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
            data: { notificationId: notif.id },
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

    if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') {
      return false;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: params.title,
          body: params.body,
          data: params.data || {},
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
