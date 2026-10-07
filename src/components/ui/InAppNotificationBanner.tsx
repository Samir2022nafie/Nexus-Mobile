import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Dimensions,
  Easing,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useSafeRouter } from '../../hooks/useSafeRouter';
import { pushNotifications, InAppNotificationPayload } from '../../services/pushNotifications';
import { notificationsService } from '../../services/notifications';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const InAppNotificationBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const router = useSafeRouter();

  const [notification, setNotification] = useState<InAppNotificationPayload | null>(null);
  const slideY = useRef(new Animated.Value(-160)).current;
  const panX = useRef(new Animated.Value(0)).current;
  const autoDismissTimer = useRef<NodeJS.Timeout | null>(null);

  const dismiss = useCallback(() => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }
    Animated.timing(slideY, {
      toValue: -160,
      duration: 220,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
      useNativeDriver: true,
    }).start(() => {
      setNotification(null);
      panX.setValue(0);
    });
  }, [slideY, panX]);

  useEffect(() => {
    const unsubscribe = pushNotifications.addInAppListener((notif) => {
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current);
      }
      setNotification(notif);
      panX.setValue(0);
      slideY.setValue(-160);

      // Slide in from top
      Animated.spring(slideY, {
        toValue: 0,
        tension: 65,
        friction: 9,
        useNativeDriver: true,
      }).start();

      // Auto-dismiss after 3 seconds as required
      autoDismissTimer.current = setTimeout(() => {
        dismiss();
      }, 3000);
    });

    return () => {
      unsubscribe();
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current);
      }
    };
  }, [slideY, panX, dismiss]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        panX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 55 || Math.abs(gestureState.vx) > 0.4) {
          if (autoDismissTimer.current) {
            clearTimeout(autoDismissTimer.current);
          }
          const targetX = gestureState.dx > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH;
          Animated.timing(panX, {
            toValue: targetX,
            duration: 160,
            useNativeDriver: true,
          }).start(() => dismiss());
        } else {
          Animated.spring(panX, {
            toValue: 0,
            friction: 7,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handlePress = () => {
    if (!notification) return;
    const current = notification;

    // Tapping also marks the notification as read
    if (current.id) {
      notificationsService.markAsRead(current.id).catch(() => {});
    }

    dismiss();

    // Route to appropriate screen
    const entityType = (current.entityType || current.type || '').toLowerCase();
    const entityId = current.entityId || current.data?.entityId || current.data?.relatedEntityId;
    const slug = current.slug || current.communitySlug || current.data?.slug || current.data?.communitySlug;

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
  };

  if (!notification) return null;

  const getIconConfig = (type?: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('event')) {
      return { name: 'event' as const, bg: '#e8a736', iconColor: '#ffffff' };
    }
    if (t.includes('hangout')) {
      return { name: 'local-cafe' as const, bg: '#f59e0b', iconColor: '#ffffff' };
    }
    if (t.includes('post') || t.includes('comment')) {
      return { name: 'chat-bubble' as const, bg: '#0284c7', iconColor: '#ffffff' };
    }
    if (t.includes('follow') || t.includes('user')) {
      return { name: 'person' as const, bg: '#6366f1', iconColor: '#ffffff' };
    }
    return { name: 'notifications' as const, bg: '#e8a736', iconColor: '#ffffff' };
  };

  const iconCfg = getIconConfig(notification.entityType || notification.type);

  const opacity = panX.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.overlayContainer,
        {
          top: Math.max(insets.top, 12) + 6,
          transform: [{ translateY: slideY }, { translateX: panX }],
          opacity,
        },
      ]}
    >
      <View
        {...panResponder.panHandlers}
        style={[
          styles.bannerCard,
          {
            backgroundColor: isDark ? 'rgba(26, 24, 22, 0.96)' : '#ffffff',
            borderColor: isDark ? 'rgba(232, 167, 54, 0.35)' : 'rgba(232, 167, 54, 0.28)',
            shadowColor: '#000000',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.bannerContentRow}
          onPress={handlePress}
          activeOpacity={0.85}
        >
          <View style={[styles.iconBadge, { backgroundColor: iconCfg.bg }]}>
            <MaterialIcons name={iconCfg.name} size={18} color={iconCfg.iconColor} />
          </View>

          <View style={styles.textColumn}>
            <View style={styles.headerRow}>
              <Text
                style={[
                  styles.title,
                  { color: isDark ? '#ffffff' : colors.onSurface },
                ]}
                numberOfLines={1}
              >
                {notification.title || 'Nexus Notification'}
              </Text>
              <Text style={styles.timeLabel}>Just now</Text>
            </View>
            <Text
              style={[
                styles.body,
                { color: isDark ? 'rgba(255, 255, 255, 0.78)' : colors.onSurfaceVariant },
              ]}
              numberOfLines={2}
            >
              {notification.body || ''}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={dismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons
              name="close"
              size={16}
              color={isDark ? 'rgba(255, 255, 255, 0.5)' : colors.tertiary}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
    elevation: 9999,
  },
  bannerCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === 'ios' ? 0.2 : 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  bannerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  timeLabel: {
    fontSize: 10,
    color: '#e8a736',
    fontWeight: '600',
  },
  body: {
    fontSize: 12,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 2,
    alignSelf: 'center',
  },
});
export default InAppNotificationBanner;
