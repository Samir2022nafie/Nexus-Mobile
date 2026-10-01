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
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, ThemeColors } from '../src/constants/theme';
import { useTheme, useThemedStyles } from '../src/context/ThemeContext';
import notificationPreferences, {
  GlobalNotificationSettings,
  SpecificEntitySettings,
} from '../src/services/notificationPreferences';
import {
  ReminderTimePickerModal,
  formatReminderText,
} from '../src/components/ui/ReminderTimePickerModal';

export default function HangoutNotificationsScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { colors } = useTheme();
  const styles = useThemedStyles(getStyles);

  const [loading, setLoading] = useState(true);
  const [receiveNotifications, setReceiveNotifications] = useState(false);
  const [remindDays, setRemindDays] = useState(0);
  const [remindHours, setRemindHours] = useState(6);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderPickerVisible, setReminderPickerVisible] = useState(false);
  const [triggers, setTriggers] = useState<Partial<GlobalNotificationSettings>>({});

  useEffect(() => {
    if (!id) return;
    (async () => {
      const global = await notificationPreferences.getGlobalSettings();
      const specific = await notificationPreferences.getSpecificSettings(id);
      const isCustomized = specific.receive_notifications !== undefined || specific.muted !== undefined;
      const initialReceive = isCustomized ? (specific.receive_notifications ?? !specific.muted) : true;
      setReceiveNotifications(initialReceive);
      setRemindDays(specific.remind_days ?? global.hangout_remind_days ?? 0);
      setRemindHours(specific.remind_hours ?? global.hangout_remind_hours ?? 6);
      setReminderEnabled(specific.reminder_enabled ?? global.hangout_reminder_enabled ?? true);
      setTriggers({
        hangout_start_6h: specific.triggers.hangout_start_6h ?? global.hangout_start_6h,
        hangout_details_changed: specific.triggers.hangout_details_changed ?? global.hangout_details_changed,
        hangout_user_joined: specific.triggers.hangout_user_joined ?? global.hangout_user_joined,
        hangout_user_left: specific.triggers.hangout_user_left ?? global.hangout_user_left,
        hangout_deleted: specific.triggers.hangout_deleted ?? global.hangout_deleted,
        hangout_ended: specific.triggers.hangout_ended ?? global.hangout_ended,
      });
      setLoading(false);
    })();
  }, [id]);

  const handleToggleReceive = async (val: boolean) => {
    setReceiveNotifications(val);
    if (id) {
      await notificationPreferences.updateSpecificSettings(id, {
        receive_notifications: val,
        muted: !val,
      });
    }
  };

  const handleReminderConfirm = async (days: number, hours: number) => {
    setRemindDays(days);
    setRemindHours(hours);
    if (id) {
      await notificationPreferences.updateSpecificSettings(id, {
        remind_days: days,
        remind_hours: hours,
      });
    }
  };

  const handleToggleReminderEnabled = async (val: boolean) => {
    setReminderEnabled(val);
    if (id) {
      await notificationPreferences.updateSpecificSettings(id, {
        reminder_enabled: val,
      });
    }
  };

  const handleToggleTrigger = async (key: keyof GlobalNotificationSettings, val: boolean) => {
    const updated = { ...triggers, [key]: val };
    setTriggers(updated);
    if (id) {
      await notificationPreferences.updateSpecificSettings(id, {
        triggers: { [key]: val },
      });
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Hangout Notifications</Text>
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
          {title ? (
            <View style={styles.entityHeader}>
              <MaterialIcons name="local-cafe" size={22} color={colors.primary} />
              <Text style={styles.entityTitle} numberOfLines={1}>
                {title}
              </Text>
            </View>
          ) : null}

          <Text style={styles.pageDescription}>
            Notifications toggled here will overrule your general notification settings specifically for
            this hangout.
          </Text>

          {/* MASTER RECEIVE TOGGLE */}
          <View style={styles.sectionCard}>
            <View style={styles.muteRow}>
              <View style={[styles.muteIconCircle, { backgroundColor: receiveNotifications ? colors.primaryContainer + '20' : colors.surfaceVariant }]}>
                <MaterialIcons
                  name={receiveNotifications ? 'notifications-active' : 'notifications-off'}
                  size={20}
                  color={receiveNotifications ? colors.primary : colors.outline}
                />
              </View>
              <View style={styles.muteTextCol}>
                <Text style={styles.muteTitle}>Receive notifications from this Hangout</Text>
                <Text style={styles.muteSubtitle}>
                  {receiveNotifications
                    ? 'Receive notifications according to triggers below'
                    : 'Push alerts for this hangout are turned off'}
                </Text>
              </View>
              <Switch
                value={receiveNotifications}
                onValueChange={handleToggleReceive}
                trackColor={{ false: colors.surfaceVariant, true: colors.primaryContainer }}
                thumbColor={colors.white}
              />
            </View>
          </View>

          {/* TRIGGERS LIST */}
          <View style={[styles.section, !receiveNotifications && { opacity: 0.4 }]} pointerEvents={!receiveNotifications ? 'none' : 'auto'}>
            <Text style={styles.sectionHeading}>Notification Triggers</Text>
            <View style={styles.sectionCard}>
              <View style={styles.remindCard}>
                <View style={styles.remindHeaderRow}>
                  <View style={styles.remindTitleCol}>
                    <Text style={styles.remindTitle}>Remind me in:</Text>
                    <Text style={styles.remindSubtitle}>Alert when start time matches your reminder window</Text>
                  </View>
                  <Switch
                    value={reminderEnabled}
                    onValueChange={handleToggleReminderEnabled}
                    trackColor={{ false: colors.surfaceVariant, true: colors.primaryContainer }}
                    thumbColor={colors.white}
                  />
                </View>
                {reminderEnabled && (
                  <TouchableOpacity
                    style={styles.remindInputBox}
                    onPress={() => setReminderPickerVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.remindInputText}>
                      {formatReminderText(remindDays, remindHours)}
                    </Text>
                    <MaterialIcons name="schedule" size={18} color={colors.primaryContainer} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.divider} />

              <TriggerItem
                title="Hangout Details Changed"
                subtitle="Alert when the owner edits details of this hangout"
                value={Boolean(triggers.hangout_details_changed)}
                onValueChange={(val) => handleToggleTrigger('hangout_details_changed', val)}
                colors={colors}
              />
              <View style={styles.divider} />

              <TriggerItem
                title="User Joined"
                subtitle="Alert when a new participant joins this hangout"
                value={Boolean(triggers.hangout_user_joined)}
                onValueChange={(val) => handleToggleTrigger('hangout_user_joined', val)}
                colors={colors}
              />
              <View style={styles.divider} />

              <TriggerItem
                title="User Left"
                subtitle="Alert when a participant leaves this hangout"
                value={Boolean(triggers.hangout_user_left)}
                onValueChange={(val) => handleToggleTrigger('hangout_user_left', val)}
                colors={colors}
              />
              <View style={styles.divider} />

              <TriggerItem
                title="Hangout Deleted"
                subtitle="Alert if the creator deletes this hangout"
                value={Boolean(triggers.hangout_deleted)}
                onValueChange={(val) => handleToggleTrigger('hangout_deleted', val)}
                colors={colors}
              />
              <View style={styles.divider} />

              <TriggerItem
                title="Hangout Ended"
                subtitle="Alert when this hangout reaches its end time"
                value={Boolean(triggers.hangout_ended)}
                onValueChange={(val) => handleToggleTrigger('hangout_ended', val)}
                colors={colors}
              />
            </View>
          </View>
        </ScrollView>
      )}

      {/* Reminder Picker Modal */}
      <ReminderTimePickerModal
        visible={reminderPickerVisible}
        days={remindDays}
        hours={remindHours}
        title="Remind me for this Hangout"
        onConfirm={handleReminderConfirm}
        onClose={() => setReminderPickerVisible(false)}
      />
    </View>
  );
}

function TriggerItem({
  title,
  subtitle,
  value,
  onValueChange,
  colors,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  colors: ThemeColors;
}) {
  return (
    <View style={itemStyles.container}>
      <View style={itemStyles.textCol}>
        <Text style={[itemStyles.title, { color: colors.onSurface }]}>{title}</Text>
        <Text style={[itemStyles.subtitle, { color: colors.onSurfaceVariant }]}>{subtitle}</Text>
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

const itemStyles = StyleSheet.create({
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
    entityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.xs,
    },
    entityTitle: {
      fontSize: Typography.titleMedium.fontSize,
      fontWeight: '700',
      color: colors.onSurface,
      flex: 1,
    },
    pageDescription: {
      fontSize: Typography.bodyMedium.fontSize,
      color: colors.onSurfaceVariant,
      lineHeight: 20,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.surfaceVariant,
      overflow: 'hidden',
    },
    muteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
    },
    muteIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    muteTextCol: {
      flex: 1,
      marginRight: Spacing.md,
    },
    muteTitle: {
      fontSize: Typography.bodyLarge.fontSize,
      fontWeight: '700',
      color: colors.onSurface,
      marginBottom: 2,
    },
    muteSubtitle: {
      fontSize: Typography.bodySmall.fontSize,
      color: colors.onSurfaceVariant,
    },
    section: {
      gap: Spacing.xs,
    },
    sectionHeading: {
      fontSize: Typography.titleSmall.fontSize,
      fontWeight: '700',
      color: colors.onSurface,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
      borderColor: colors.surfaceVariant,
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
