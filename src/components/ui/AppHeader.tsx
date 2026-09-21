/**
 * AppHeader — Artistic branded top bar.
 * Center: "Nexus" in flowy, artistic Higgsfield-style cursive typography.
 * Right: Notification bell with unread badge pushed to the edge.
 * Tapping the header area triggers smooth scroll-to-top on the active feed.
 * Slides up completely via translateY without leaving an empty white block.
 */
import React from 'react';
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
  const showUnread = hasUnreadNotification ?? hasUnreadNotifications ?? true;

  const headerContent = (
    <View style={[styles.container, style]}>
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
            <MaterialIcons name="notifications-none" size={24} color={Colors.onSurface} />
            {showUnread && <View style={styles.unreadDot} />}
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
  unreadDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
});
