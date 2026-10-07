/**
 * AppHeader — Artistic branded top bar.
 * Center: "Nexus" in flowy, artistic Higgsfield-style cursive typography.
 * Right: Notification bell with unread badge pushed to the edge.
 * Tapping the header area triggers smooth scroll-to-top on the active feed.
 * Slides up completely via translateY without leaving an empty white block.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { notificationsService } from '../../services/notifications';
import { NexusLogo } from './NexusLogo';

export interface AppHeaderProps {
  title?: string;
  breadcrumb?: string;
  hasUnreadNotifications?: boolean;
  hasUnreadNotification?: boolean;
  style?: StyleProp<ViewStyle>;
  translateY?: Animated.Value | Animated.AnimatedInterpolation<number>;
  onPressHeader?: () => void;
  isAbsolute?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  hasUnreadNotifications,
  hasUnreadNotification,
  style,
  translateY,
  onPressHeader,
  isAbsolute = true,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [unreadCount, setUnreadCount] = useState(notificationsService.getCurrentUnreadCount());

  useEffect(() => {
    // Subscribe to live unread changes
    const unsub = notificationsService.onUnreadChange((count) => {
      setUnreadCount(count);
    });

    // Also fetch fresh from server
    notificationsService.getUnreadCount();
    const interval = setInterval(() => {
      notificationsService.getUnreadCount();
    }, 15000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const displayCount =
    unreadCount > 0
      ? unreadCount
      : hasUnreadNotification || hasUnreadNotifications
      ? 1
      : 0;

  const headerContent = (
    <View style={[styles.container, { backgroundColor: colors.surface }, style]}>
      <View style={styles.content}>
        {/* Tappable Header Area (scrolls feed back to top) */}
        <TouchableOpacity
          style={styles.headerPressableArea}
          onPress={onPressHeader}
          activeOpacity={0.9}
        >
          {/* Left balance spacer matching right icon width (44px) */}
          <View style={styles.leftSpacer} />

          {/* Center: Vector SVG Nexus Logo from logo.svg */}
          <View style={styles.centerBrand}>
            <NexusLogo width={160} height={48} />
          </View>
        </TouchableOpacity>

        {/* Right: Notification Bell at right edge */}
        <View style={styles.rightActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
            accessibilityLabel="Notifications"
          >
            <MaterialIcons name="notifications-none" size={24} color={colors.onSurface} />
            {displayCount > 0 && (
              <View style={[styles.unreadBadge, { borderColor: colors.surface }]}>
                <Text style={styles.unreadBadgeText}>
                  {displayCount > 99 ? '99+' : displayCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (translateY) {
    return (
      <Animated.View
        style={[
          isAbsolute ? [styles.absoluteWrap, { top: insets.top }] : styles.relativeWrap,
          { transform: [{ translateY }] },
        ]}
      >
        {headerContent}
      </Animated.View>
    );
  }

  if (isAbsolute) {
    return <View style={[styles.absoluteWrap, { top: insets.top }]}>{headerContent}</View>;
  }

  return headerContent;
};

const styles = StyleSheet.create({
  absoluteWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  relativeWrap: {
    zIndex: 100,
  },
  container: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 0,
  },
  content: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
  },
  headerPressableArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftSpacer: {
    width: 44,
    height: 44,
  },
  centerBrand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandFlourish: {
    fontSize: 22,
    fontWeight: '300',
    color: Colors.primaryContainer,
    opacity: 0.5,
    marginHorizontal: 6,
    fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'serif',
  },
  brandTitle: {
    fontSize: 28,
    fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'cursive',
    fontStyle: 'italic',
    fontWeight: '700',
    color: Colors.primaryContainer,
    letterSpacing: 4,
  },
  rightActions: {
    width: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 101,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: 3,
    right: 2,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
    lineHeight: 12,
    textAlign: 'center',
  },
});
