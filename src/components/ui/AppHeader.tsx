/**
 * AppHeader — Persistent branded top bar matching Stitch exports.
 * Left: Gold circular emblem + "Nexus" in Goldenrod + `/ {breadcrumb}` in tertiary muted text.
 * Right: Notification bell with unread badge + User avatar.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

export interface AppHeaderProps {
  title?: string;
  breadcrumb?: string;
  hasUnreadNotifications?: boolean;
  hasUnreadNotification?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  breadcrumb = 'Home',
  hasUnreadNotifications,
  hasUnreadNotification,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const activeBreadcrumb = breadcrumb || title || 'Home';
  const showUnread = hasUnreadNotification ?? hasUnreadNotifications ?? true;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.content}>
        {/* Left: Emblem + Brand + Breadcrumb */}
        <TouchableOpacity
          style={styles.brandRow}
          onPress={() => router.push('/(tabs)')}
          activeOpacity={0.8}
        >
          <View style={styles.emblem}>
            <MaterialIcons name="groups" size={18} color={Colors.onPrimaryContainer} />
          </View>
          <Text style={styles.brandName}>Nexus</Text>
          {activeBreadcrumb ? <Text style={styles.breadcrumb}>/ {activeBreadcrumb}</Text> : null}
        </TouchableOpacity>

        {/* Right: Notifications & Profile Avatar */}
        <View style={styles.rightActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
            accessibilityLabel="Notifications"
          >
            <MaterialIcons name="notifications-none" size={24} color={Colors.onSurfaceVariant} />
            {showUnread && <View style={styles.unreadDot} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarButton}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
            accessibilityLabel="Profile"
          >
            {user?.profile_picture_url ? (
              <Image source={{ uri: user.profile_picture_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>
                  {user?.first_name?.[0] || user?.name?.[0] || user?.username?.[0] || 'U'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    ...Shadows.sm,
  },
  content: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emblem: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  brandName: {
    ...Typography.headlineSm,
    color: Colors.primaryContainer,
    letterSpacing: -0.5,
    fontWeight: '700',
  },
  breadcrumb: {
    ...Typography.labelMd,
    color: Colors.tertiary,
    marginLeft: 2,
    fontWeight: '600',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.secondaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSecondaryFixed,
  },
});
