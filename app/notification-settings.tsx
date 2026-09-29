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

export default function NotificationSettingsScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);

  const [settings, setSettings] = useState<GlobalNotificationSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Ensure push notification permissions are requested/initialized
      await pushNotifications.init();
      const loaded = await notificationPreferences.getGlobalSettings();
      setSettings(loaded);
      setLoading(false);
    })();
  }, []);

  const handleToggle = async (key: keyof GlobalNotificationSettings, val: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
    await notificationPreferences.updateGlobalSetting(key, val);
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
              <MaterialIcons name="groups" size={20} color={colors.primary} />
              <Text style={styles.sectionHeading}>Hangouts</Text>
            </View>
            <Text style={styles.sectionSubheading}>For hangouts where you are a participant</Text>

            <View style={styles.sectionCard}>
              <ToggleRow
                title="Starting in 6 Hours"
                subtitle="Alert when start date is today and start time is in 6 hours"
                value={settings.hangout_start_6h}
                onValueChange={(val) => handleToggle('hangout_start_6h', val)}
                colors={colors}
              />
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
              <MaterialIcons name="event" size={20} color={colors.primary} />
              <Text style={styles.sectionHeading}>Events</Text>
            </View>
            <Text style={styles.sectionSubheading}>For events where you are an attendee</Text>

            <View style={styles.sectionCard}>
              <ToggleRow
                title="Starting in 6 Hours"
                subtitle="Alert when start date is today and start time is in 6 hours"
                value={settings.event_start_6h}
                onValueChange={(val) => handleToggle('event_start_6h', val)}
                colors={colors}
              />
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
              <MaterialIcons name="public" size={20} color={colors.primary} />
              <Text style={styles.sectionHeading}>Communities</Text>
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
      gap: Spacing.xs,
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
  });
}
