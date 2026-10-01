import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useSafeRouter } from '../src/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, ThemeColors } from '../src/constants/theme';
import { useTheme, useThemedStyles } from '../src/context/ThemeContext';
import notificationPreferences, {
  GlobalNotificationSettings,
  DEFAULT_GLOBAL_SETTINGS,
} from '../src/services/notificationPreferences';
import pushNotifications from '../src/services/pushNotifications';
import {
  ReminderTimePickerModal,
  formatReminderText,
} from '../src/components/ui/ReminderTimePickerModal';

export default function NotificationSettingsScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);

  const [settings, setSettings] = useState<GlobalNotificationSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [hangoutPickerVisible, setHangoutPickerVisible] = useState(false);
  const [eventPickerVisible, setEventPickerVisible] = useState(false);

  useEffect(() => {
    (async () => {
      // Ensure push notification permissions are requested/initialized
      await pushNotifications.init();
      const loaded = await notificationPreferences.getGlobalSettings();
      setSettings(loaded);
      setLoading(false);
    })();
  }, []);

  const handleToggle = async (key: keyof GlobalNotificationSettings, val: any) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
    await notificationPreferences.updateGlobalSetting(key, val);
  };

  const handleHangoutReminderConfirm = async (days: number, hours: number) => {
    setSettings((prev) => ({
      ...prev,
      hangout_remind_days: days,
      hangout_remind_hours: hours,
    }));
    await notificationPreferences.updateGlobalSetting('hangout_remind_days', days);
    await notificationPreferences.updateGlobalSetting('hangout_remind_hours', hours);
  };

  const handleEventReminderConfirm = async (days: number, hours: number) => {
    setSettings((prev) => ({
      ...prev,
      event_remind_days: days,
      event_remind_hours: hours,
    }));
    await notificationPreferences.updateGlobalSetting('event_remind_days', days);
    await notificationPreferences.updateGlobalSetting('event_remind_hours', hours);
  };

  const isHangoutsActive = Boolean(
    settings.hangout_reminder_enabled ||
    settings.hangout_start_6h ||
    settings.hangout_details_changed ||
    settings.hangout_user_joined ||
    settings.hangout_user_left ||
    settings.hangout_deleted ||
    settings.hangout_ended
  );

  const isEventsActive = Boolean(
    settings.event_reminder_enabled ||
    settings.event_start_6h ||
    settings.event_details_changed ||
    settings.event_user_joined ||
    settings.event_user_left ||
    settings.event_deleted ||
    settings.event_ended
  );

  const isCommunitiesActive = Boolean(settings.community_new_event);

  const handleToggleAllHangouts = async (val: boolean) => {
    const keys: (keyof GlobalNotificationSettings)[] = [
      'hangout_reminder_enabled',
      'hangout_start_6h',
      'hangout_details_changed',
      'hangout_user_joined',
      'hangout_user_left',
      'hangout_deleted',
      'hangout_ended',
    ];
    setSettings((prev) => {
      const next = { ...prev };
      keys.forEach((k) => ((next as any)[k] = val));
      return next;
    });
    for (const k of keys) {
      await notificationPreferences.updateGlobalSetting(k, val);
    }
  };

  const handleToggleAllEvents = async (val: boolean) => {
    const keys: (keyof GlobalNotificationSettings)[] = [
      'event_reminder_enabled',
      'event_start_6h',
      'event_details_changed',
      'event_user_joined',
      'event_user_left',
      'event_deleted',
      'event_ended',
    ];
    setSettings((prev) => {
      const next = { ...prev };
      keys.forEach((k) => ((next as any)[k] = val));
      return next;
    });
    for (const k of keys) {
      await notificationPreferences.updateGlobalSetting(k, val);
    }
  };

  const handleToggleAllCommunities = async (val: boolean) => {
    await handleToggle('community_new_event', val);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Notification Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageDescription}>
            Customize which activity triggers a push notification on your phone. Specific hangout and
            event settings can overrule these general choices.
          </Text>

          {/* HANGOUTS SECTION */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleLeft}>
                <MaterialIcons name="local-cafe" size={20} color={colors.primary} />
                <Text style={styles.sectionHeading}>Hangouts</Text>
              </View>
              <View style={styles.sectionMasterToggle}>
                <Text style={styles.masterToggleLabel}>General</Text>
                <Switch
                  value={isHangoutsActive}
                  onValueChange={handleToggleAllHangouts}
                  trackColor={{ false: colors.surfaceVariant, true: colors.primaryContainer }}
                  thumbColor={colors.white}
                />
              </View>
            </View>
            <Text style={styles.sectionSubheading}>For hangouts where you are a participant</Text>

            <View style={styles.sectionCard}>
              <View style={styles.remindCard}>
                <View style={styles.remindHeaderRow}>
                  <View style={styles.remindTitleCol}>
                    <Text style={styles.remindTitle}>Remind me in:</Text>
                    <Text style={styles.remindSubtitle}>Alert when start time matches your reminder window</Text>
                  </View>
                  <Switch
                    value={settings.hangout_reminder_enabled}
                    onValueChange={(val) => handleToggle('hangout_reminder_enabled', val)}
                    trackColor={{ false: colors.surfaceVariant, true: colors.primaryContainer }}
                    thumbColor={colors.white}
                  />
                </View>
                {settings.hangout_reminder_enabled && (
                  <TouchableOpacity
                    style={styles.remindInputBox}
                    onPress={() => setHangoutPickerVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.remindInputText}>
                      {formatReminderText(settings.hangout_remind_days ?? 0, settings.hangout_remind_hours ?? 6)}
                    </Text>
                    <MaterialIcons name="schedule" size={18} color={colors.primaryContainer} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.divider} />

              <ToggleRow
                title="Hangout Details Changed"
                subtitle="Alert when the owner edits hangout details"
                value={settings.hangout_details_changed}
                onValueChange={(val) => handleToggle('hangout_details_changed', val)}
                colors={colors}
              />
              <View style={styles.divider} />

              <ToggleRow
                title="Participant Joined"
                subtitle="Alert when a new user joins the hangout"
                value={settings.hangout_user_joined}
                onValueChange={(val) => handleToggle('hangout_user_joined', val)}
                colors={colors}
              />
              <View style={styles.divider} />

              <ToggleRow
                title="Participant Left"
                subtitle="Alert when a user leaves the hangout"
                value={settings.hangout_user_left}
                onValueChange={(val) => handleToggle('hangout_user_left', val)}
                colors={colors}
              />
              <View style={styles.divider} />

              <ToggleRow
                title="Hangout Deleted"
                subtitle="Alert when the creator deletes the hangout"
                value={settings.hangout_deleted}
                onValueChange={(val) => handleToggle('hangout_deleted', val)}
                colors={colors}
              />
              <View style={styles.divider} />

              <ToggleRow
                title="Hangout Ended"
                subtitle="Alert when the hangout reaches its conclusion"
                value={settings.hangout_ended}
                onValueChange={(val) => handleToggle('hangout_ended', val)}
                colors={colors}
              />
            </View>
          </View>

          {/* EVENTS SECTION */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleLeft}>
                <MaterialIcons name="event" size={20} color={colors.primary} />
                <Text style={styles.sectionHeading}>Events</Text>
              </View>
              <View style={styles.sectionMasterToggle}>
                <Text style={styles.masterToggleLabel}>General</Text>
                <Switch
                  value={isEventsActive}
                  onValueChange={handleToggleAllEvents}
                  trackColor={{ false: colors.surfaceVariant, true: colors.primaryContainer }}
                  thumbColor={colors.white}
                />
              </View>
            </View>
            <Text style={styles.sectionSubheading}>For events where you are an attendee</Text>

            <View style={styles.sectionCard}>
              <View style={styles.remindCard}>
                <View style={styles.remindHeaderRow}>
                  <View style={styles.remindTitleCol}>
                    <Text style={styles.remindTitle}>Remind me in:</Text>
                    <Text style={styles.remindSubtitle}>Alert when start time matches your reminder window</Text>
                  </View>
                  <Switch
                    value={settings.event_reminder_enabled}
                    onValueChange={(val) => handleToggle('event_reminder_enabled', val)}
                    trackColor={{ false: colors.surfaceVariant, true: colors.primaryContainer }}
                    thumbColor={colors.white}
                  />
                </View>
                {settings.event_reminder_enabled && (
                  <TouchableOpacity
                    style={styles.remindInputBox}
                    onPress={() => setEventPickerVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.remindInputText}>
                      {formatReminderText(settings.event_remind_days ?? 0, settings.event_remind_hours ?? 6)}
                    </Text>
                    <MaterialIcons name="schedule" size={18} color={colors.primaryContainer} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.divider} />

              <ToggleRow
                title="Event Details Changed"
                subtitle="Alert when community leadership edits event details"
                value={settings.event_details_changed}
                onValueChange={(val) => handleToggle('event_details_changed', val)}
                colors={colors}
              />
              <View style={styles.divider} />

              <ToggleRow
                title="Attendee Joined"
                subtitle="Alert when a new attendee joins the event"
                value={settings.event_user_joined}
                onValueChange={(val) => handleToggle('event_user_joined', val)}
                colors={colors}
              />
              <View style={styles.divider} />

              <ToggleRow
                title="Attendee Left"
                subtitle="Alert when an attendee leaves the event"
                value={settings.event_user_left}
                onValueChange={(val) => handleToggle('event_user_left', val)}
                colors={colors}
              />
              <View style={styles.divider} />

              <ToggleRow
                title="Event Deleted"
                subtitle="Alert when the creator deletes the event"
                value={settings.event_deleted}
                onValueChange={(val) => handleToggle('event_deleted', val)}
                colors={colors}
              />
              <View style={styles.divider} />

              <ToggleRow
                title="Event Ended"
                subtitle="Alert when the event ends (or ends for the day)"
                value={settings.event_ended}
                onValueChange={(val) => handleToggle('event_ended', val)}
                colors={colors}
              />
            </View>
          </View>

          {/* COMMUNITIES SECTION */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleLeft}>
                <MaterialIcons name="groups" size={20} color={colors.primary} />
                <Text style={styles.sectionHeading}>Communities</Text>
              </View>
              <View style={styles.sectionMasterToggle}>
                <Text style={styles.masterToggleLabel}>General</Text>
                <Switch
                  value={isCommunitiesActive}
                  onValueChange={handleToggleAllCommunities}
                  trackColor={{ false: colors.surfaceVariant, true: colors.primaryContainer }}
                  thumbColor={colors.white}
                />
              </View>
            </View>
            <Text style={styles.sectionSubheading}>For communities where you are a member</Text>

            <View style={styles.sectionCard}>
              <ToggleRow
                title="New Event Posted"
                subtitle="Alert when a new event gets posted in the community"
                value={settings.community_new_event}
                onValueChange={(val) => handleToggle('community_new_event', val)}
                colors={colors}
              />
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Reminder Pickers */}
      <ReminderTimePickerModal
        visible={hangoutPickerVisible}
        days={settings.hangout_remind_days ?? 0}
        hours={settings.hangout_remind_hours ?? 6}
        title="Remind me for Hangouts"
        onConfirm={handleHangoutReminderConfirm}
        onClose={() => setHangoutPickerVisible(false)}
      />

      <ReminderTimePickerModal
        visible={eventPickerVisible}
        days={settings.event_remind_days ?? 0}
        hours={settings.event_remind_hours ?? 6}
        title="Remind me for Events"
        onConfirm={handleEventReminderConfirm}
        onClose={() => setEventPickerVisible(false)}
      />
    </View>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
  colors,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  colors: ThemeColors;
}) {
  return (
    <View style={rowStyles.container}>
      <View style={rowStyles.textCol}>
        <Text style={[rowStyles.title, { color: colors.onSurface }]}>{title}</Text>
        {subtitle ? (
          <Text style={[rowStyles.subtitle, { color: colors.onSurfaceVariant }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.surfaceVariant, true: colors.primaryContainer }}
        thumbColor={colors.white}
      />
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  textCol: {
    flex: 1,
    marginRight: Spacing.md,
  },
  title: {
    fontSize: Typography.bodyLarge.fontSize,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: Typography.bodySmall.fontSize,
    lineHeight: 18,
  },
});

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceVariant,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBarTitle: {
      fontSize: Typography.titleMedium.fontSize,
      fontWeight: '700',
      color: colors.onSurface,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    container: {
      flex: 1,
    },
    content: {
      padding: Spacing.lg,
      gap: Spacing.lg,
    },
    pageDescription: {
      fontSize: Typography.bodyMedium.fontSize,
      color: colors.onSurfaceVariant,
      lineHeight: 20,
    },
    section: {
      gap: Spacing.xs,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    sectionMasterToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    masterToggleLabel: {
      fontSize: Typography.labelSmall.fontSize,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
    },
    sectionHeading: {
      fontSize: Typography.titleSmall.fontSize,
      fontWeight: '700',
      color: colors.onSurface,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionSubheading: {
      fontSize: Typography.bodySmall.fontSize,
      color: colors.onSurfaceVariant,
      marginBottom: Spacing.xs,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.surfaceVariant,
      overflow: 'hidden',
    },
    divider: {
      height: 1,
      backgroundColor: colors.surfaceVariant,
      marginHorizontal: Spacing.md,
    },
    remindCard: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    remindHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    remindTitleCol: {
      flex: 1,
      marginRight: Spacing.md,
    },
    remindTitle: {
      fontSize: Typography.bodyLarge.fontSize,
      fontWeight: '600',
      color: colors.onSurface,
    },
    remindSubtitle: {
      fontSize: Typography.bodySmall.fontSize,
      color: colors.onSurfaceVariant,
      marginTop: 2,
      lineHeight: 18,
    },
    remindInputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceVariant + '40',
      borderWidth: 1,
      borderColor: colors.outlineVariant || colors.surfaceVariant,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      marginTop: Spacing.sm,
    },
    remindInputText: {
      fontSize: Typography.bodyMedium.fontSize,
      color: colors.onSurface,
      fontWeight: '600',
    },
  });
}
