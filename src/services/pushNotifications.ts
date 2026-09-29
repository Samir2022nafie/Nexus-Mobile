import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import notificationPreferences, { GlobalNotificationSettings } from './notificationPreferences';

// Safe dynamic require for expo-notifications to prevent crash on Expo Go (SDK 53)
const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: any = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
  } catch (e) {
    // Expo Go (SDK 53) removed native push notification modules
    console.log('[PushNotificationService] Native push notifications not available in this environment.');
  }
}

class PushNotificationService {
  private isInitialized = false;

  async init() {
    if (this.isInitialized) return false;
    this.isInitialized = true;

    if (!Notifications) {
      return false;
    }

    try {
      if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Nexus Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#8C52FF',
        });
      }

      if (Notifications.getPermissionsAsync) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted' && Notifications.requestPermissionsAsync) {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        return finalStatus === 'granted';
      }
      return false;
    } catch (e) {
      console.warn('PushNotificationService init error:', e);
      return false;
    }
  }

  mapNotificationToTrigger(type: string, title?: string, message?: string): keyof GlobalNotificationSettings | null {
    const t = (type || '').toLowerCase();
    const titleLower = (title || '').toLowerCase();
    const msgLower = (message || '').toLowerCase();

    // 6 hour start alerts
    if (titleLower.includes('starting soon') || msgLower.includes('starts today in less than 6 hours')) {
      if (t.includes('hangout') || msgLower.includes('hangout')) return 'hangout_start_6h';
      return 'event_start_6h';
    }

    // Hangouts
    if (t === 'hangout_update' || msgLower.includes('details of the hangout') && msgLower.includes('changed')) {
      return 'hangout_details_changed';
    }
    if (t === 'hangout_join' || msgLower.includes('joined the hangout')) {
      return 'hangout_user_joined';
    }
    if (t === 'hangout_leave' || msgLower.includes('left the hangout')) {
      return 'hangout_user_left';
    }
    if (t === 'hangout_deleted' || msgLower.includes('details of the hangout') && msgLower.includes('deleted')) {
      return 'hangout_deleted';
    }
    if (t === 'hangout_ended' || (t.includes('hangout') && msgLower.includes('has ended'))) {
      return 'hangout_ended';
    }

    // Events
    if (t === 'event_update' || msgLower.includes('details of the') && msgLower.includes('event got changed')) {
      return 'event_details_changed';
    }
    if (t === 'event_join' || msgLower.includes('joined the event')) {
      return 'event_user_joined';
    }
    if (t === 'event_leave' || msgLower.includes('left the event')) {
      return 'event_user_left';
    }
    if (t === 'event_deleted' || msgLower.includes('event got deleted')) {
      return 'event_deleted';
    }
    if (t === 'event_ended' || msgLower.includes('event ended for the day') || (t.includes('event') && msgLower.includes('has ended'))) {
      return 'event_ended';
    }

    // Communities
    if (t === 'community_new_event' || msgLower.includes('a new event') && msgLower.includes('got posted in')) {
      return 'community_new_event';
    }

    return null;
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
        },
        trigger: null, // deliver immediately
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
