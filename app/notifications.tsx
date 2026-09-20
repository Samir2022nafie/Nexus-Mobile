/**
 * Notifications Screen — Matches Stitch screen_27_notifications_with_items
 * Backend: GET /notifications, PATCH /notifications/:id/read
 * Features:
 * - Header with "Mark all read" action
 * - "New for you" section with unread counter pill
 * - Rich notification items with type badges and unread indicator dot
 * - "Earlier this week" archived section
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../src/constants/theme';
import { LoadingSpinner } from '../src/components/ui/LoadingSpinner';
import { notificationsService } from '../src/services/notifications';
import { NotificationItem as NotifType } from '../src/types';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationsService.list({ limit: 50 });
      setNotifications(data || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handlePress = async (notif: any) => {
    if (!notif.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      try {
        await notificationsService.markAsRead(notif.id);
      } catch {}
    }

    if (notif.relatedEntityType === 'post' && notif.relatedEntityId) {
      router.push(`/post/${notif.relatedEntityId}`);
    } else if (notif.relatedEntityType === 'event' && notif.relatedEntityId) {
      router.push(`/event/${notif.relatedEntityId}`);
    } else if (notif.relatedEntityType === 'hangout' && notif.relatedEntityId) {
      router.push(`/hangout/${notif.relatedEntityId}`);
    }
  };

  const unreadNotifications = notifications.filter((n) => !n.isRead);
  const readNotifications = notifications.filter((n) => n.isRead);

  const renderIcon = (type: string) => {
    switch (type) {
      case 'post_reaction':
        return (
          <View style={[styles.iconBox, { backgroundColor: Colors.primaryFixed }]}>
            <MaterialIcons name="favorite" size={22} color={Colors.primary} />
          </View>
        );
      case 'comment_reply':
        return (
          <View style={[styles.iconBox, { backgroundColor: Colors.secondaryFixed }]}>
            <MaterialIcons name="chat-bubble" size={22} color={Colors.secondary} />
          </View>
        );
      case 'follow':
        return (
          <View style={[styles.iconBox, { backgroundColor: Colors.secondaryFixed }]}>
            <MaterialIcons name="person-add" size={22} color={Colors.secondary} />
          </View>
        );
      case 'event_approved':
        return (
          <View style={[styles.iconBox, { backgroundColor: Colors.secondaryFixed }]}>
            <MaterialIcons name="event-available" size={22} color={Colors.secondary} />
          </View>
        );
      default:
        return (
          <View style={[styles.iconBox, { backgroundColor: Colors.surfaceContainer }]}>
            <MaterialIcons name="notifications" size={22} color={Colors.tertiary} />
          </View>
        );
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Notifications</Text>
        </View>

        <TouchableOpacity
          onPress={markAllRead}
          style={styles.markReadBtn}
          activeOpacity={0.7}
        >
          <MaterialIcons name="done-all" size={18} color={Colors.secondary} />
          <Text style={styles.markReadText}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchNotifications();
            }}
            tintColor={Colors.primaryContainer}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <LoadingSpinner message="Checking notifications..." />
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="notifications-none" size={56} color={Colors.tertiary} />
            <Text style={styles.emptyTitle}>You're all caught up!</Text>
            <Text style={styles.emptySubtitle}>
              No notifications right now. Activity and mentions in your communities and hangouts will appear here.
            </Text>
          </View>
        ) : (
          <>
            {/* Section 1: Unread */}
            {unreadNotifications.length > 0 && (
              <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleGroup}>
                <Text style={styles.sectionTitle}>New for you</Text>
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadNotifications.length} unread
                  </Text>
                </View>
              </View>
              <Text style={styles.sectionSub}>Real-time alerts</Text>
            </View>

            <View style={styles.itemsList}>
              {unreadNotifications.map((notif) => (
                <TouchableOpacity
                  key={notif.id}
                  style={[styles.itemCard, styles.unreadCard]}
                  onPress={() => handlePress(notif)}
                  activeOpacity={0.8}
                >
                  {renderIcon(notif.type)}

                  <View style={styles.itemTextCol}>
                    <Text style={styles.itemTitle}>{notif.title}</Text>
                    {notif.message ? (
                      <Text style={styles.itemMessage} numberOfLines={1}>
                        {notif.message}
                      </Text>
                    ) : null}
                    <View style={styles.itemMetaRow}>
                      <Text style={styles.itemTime}>{notif.timeAgo || 'recently'}</Text>
                      <View style={styles.metaDot} />
                      <Text style={styles.itemCategory}>
                        {notif.category || 'Notification'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.unreadBlueDot} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

            {/* Section 2: Earlier */}
            {readNotifications.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.earlierTitle}>Earlier this week</Text>
                  <Text style={styles.sectionSub}>Archived</Text>
                </View>

                <View style={styles.itemsList}>
                  {readNotifications.map((notif) => (
                    <TouchableOpacity
                      key={notif.id}
                      style={[styles.itemCard, styles.readCard]}
                      onPress={() => handlePress(notif)}
                      activeOpacity={0.8}
                    >
                      {renderIcon(notif.type)}

                      <View style={styles.itemTextCol}>
                        <Text style={styles.itemTitle}>{notif.title}</Text>
                        {notif.message ? (
                          <Text style={styles.itemMessage} numberOfLines={1}>
                            {notif.message}
                          </Text>
                        ) : null}
                        <Text style={styles.itemTime}>{notif.timeAgo || 'earlier'}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  markReadText: {
    ...Typography.labelMd,
    color: Colors.secondary,
    fontWeight: '600',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 48,
  },
  section: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: Spacing.sm,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  unreadBadge: {
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.onPrimaryContainer,
  },
  sectionSub: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },
  earlierTitle: {
    ...Typography.labelMd,
    color: Colors.tertiary,
    fontWeight: '600',
  },
  itemsList: {
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  unreadCard: {
    backgroundColor: Colors.surfaceContainerHigh,
  },
  readCard: {
    backgroundColor: Colors.surfaceContainerLow,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextCol: {
    flex: 1,
  },
  itemTitle: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    fontWeight: '700',
    lineHeight: 18,
  },
  itemMessage: {
    ...Typography.captionMd,
    color: Colors.tertiary,
    marginTop: 2,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  itemTime: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.outlineVariant,
  },
  itemCategory: {
    ...Typography.captionSm,
    color: Colors.primary,
    fontWeight: '600',
  },
  unreadBlueDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.secondary,
    alignSelf: 'center',
  },
  emptyContainer: {
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.headlineSm,
    fontSize: 20,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  emptySubtitle: {
    ...Typography.bodyMd,
    color: Colors.tertiary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
});
