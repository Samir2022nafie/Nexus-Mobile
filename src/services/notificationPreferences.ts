import * as SecureStore from 'expo-secure-store';

export interface GlobalNotificationSettings {
  // Hangout triggers
  hangout_start_6h: boolean;
  hangout_details_changed: boolean;
  hangout_user_joined: boolean;
  hangout_user_left: boolean;
  hangout_deleted: boolean;
  hangout_ended: boolean;

  // Event triggers
  event_start_6h: boolean;
  event_details_changed: boolean;
  event_user_joined: boolean;
  event_user_left: boolean;
  event_deleted: boolean;
  event_ended: boolean;

  // Community triggers
  community_new_event: boolean;
}

export interface SpecificEntitySettings {
  muted: boolean; // Master mute toggle for this specific hangout/event
  triggers: Partial<GlobalNotificationSettings>;
}

const GLOBAL_PREFS_KEY = 'nexus_notification_global_prefs_v1';
const SPECIFIC_PREFS_KEY = 'nexus_notification_specific_prefs_v1';
const COMMUNITY_PREFS_KEY = 'nexus_notification_community_prefs_v1';

export const DEFAULT_GLOBAL_SETTINGS: GlobalNotificationSettings = {
  hangout_start_6h: true,
  hangout_details_changed: true,
  hangout_user_joined: true,
  hangout_user_left: true,
  hangout_deleted: true,
  hangout_ended: true,

  event_start_6h: true,
  event_details_changed: true,
  event_user_joined: true,
  event_user_left: true,
  event_deleted: true,
  event_ended: true,

  community_new_event: true,
};

class NotificationPreferencesService {
  private globalCache: GlobalNotificationSettings | null = null;
  private specificCache: Record<string, SpecificEntitySettings> | null = null;
  private communityCache: Record<string, boolean> | null = null;

  async getGlobalSettings(): Promise<GlobalNotificationSettings> {
    if (this.globalCache) return this.globalCache;
    try {
      const stored = await SecureStore.getItemAsync(GLOBAL_PREFS_KEY);
      if (stored) {
        this.globalCache = { ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(stored) };
      } else {
        this.globalCache = { ...DEFAULT_GLOBAL_SETTINGS };
      }
    } catch {
      this.globalCache = { ...DEFAULT_GLOBAL_SETTINGS };
    }
    return this.globalCache!;
  }

  async updateGlobalSetting(
    key: keyof GlobalNotificationSettings,
    value: boolean,
  ): Promise<GlobalNotificationSettings> {
    const current = await this.getGlobalSettings();
    const updated = { ...current, [key]: value };
    this.globalCache = updated;
    try {
      await SecureStore.setItemAsync(GLOBAL_PREFS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save global notification settings', e);
    }
    return updated;
  }

  async getSpecificSettings(entityId: string): Promise<SpecificEntitySettings> {
    const all = await this.getAllSpecificSettings();
    return all[entityId] || { muted: false, triggers: {} };
  }

  async updateSpecificSettings(
    entityId: string,
    update: Partial<SpecificEntitySettings>,
  ): Promise<SpecificEntitySettings> {
    const all = await this.getAllSpecificSettings();
    const current = all[entityId] || { muted: false, triggers: {} };
    const merged: SpecificEntitySettings = {
      muted: update.muted !== undefined ? update.muted : current.muted,
      triggers: {
        ...current.triggers,
        ...(update.triggers || {}),
      },
    };
    all[entityId] = merged;
    this.specificCache = all;
    try {
      await SecureStore.setItemAsync(SPECIFIC_PREFS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('Failed to save specific notification settings', e);
    }
    return merged;
  }

  private async getAllSpecificSettings(): Promise<Record<string, SpecificEntitySettings>> {
    if (this.specificCache) return this.specificCache;
    try {
      const stored = await SecureStore.getItemAsync(SPECIFIC_PREFS_KEY);
      if (stored) {
        this.specificCache = JSON.parse(stored);
      } else {
        this.specificCache = {};
      }
    } catch {
      this.specificCache = {};
    }
    return this.specificCache!;
  }

  async getCommunityNotification(communityIdOrSlug: string): Promise<boolean> {
    const all = await this.getAllCommunitySettings();
    if (all[communityIdOrSlug] !== undefined) {
      return all[communityIdOrSlug];
    }
    // Fall back to general community new event toggle
    const globalSettings = await this.getGlobalSettings();
    return globalSettings.community_new_event;
  }

  async setCommunityNotification(
    communityIdOrSlug: string,
    enabled: boolean,
  ): Promise<boolean> {
    const all = await this.getAllCommunitySettings();
    all[communityIdOrSlug] = enabled;
    this.communityCache = all;
    try {
      await SecureStore.setItemAsync(COMMUNITY_PREFS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('Failed to save community notification settings', e);
    }
    return enabled;
  }

  private async getAllCommunitySettings(): Promise<Record<string, boolean>> {
    if (this.communityCache) return this.communityCache;
    try {
      const stored = await SecureStore.getItemAsync(COMMUNITY_PREFS_KEY);
      if (stored) {
        this.communityCache = JSON.parse(stored);
      } else {
        this.communityCache = {};
      }
    } catch {
      this.communityCache = {};
    }
    return this.communityCache!;
  }

  /**
   * Precedence evaluation:
   * 1. If community notification check, specific community setting overrules global
   * 2. If entityId specified:
   *    - if muted === true -> false
   *    - if triggers[trigger] is explicitly set -> that value overrules global!
   * 3. Fallback to globalSettings[trigger]
   */
  async isNotificationAllowed(
    trigger: keyof GlobalNotificationSettings,
    entityId?: string,
    communityIdOrSlug?: string,
  ): Promise<boolean> {
    if (trigger === 'community_new_event' && communityIdOrSlug) {
      return this.getCommunityNotification(communityIdOrSlug);
    }

    if (entityId) {
      const specific = await this.getSpecificSettings(entityId);
      if (specific.muted) {
        return false;
      }
      if (specific.triggers && specific.triggers[trigger] !== undefined) {
        return Boolean(specific.triggers[trigger]);
      }
    }

    const globalSettings = await this.getGlobalSettings();
    return globalSettings[trigger] !== undefined ? globalSettings[trigger] : true;
  }
}

export const notificationPreferences = new NotificationPreferencesService();
export default notificationPreferences;
