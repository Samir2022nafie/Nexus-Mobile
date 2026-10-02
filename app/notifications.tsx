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
  Alert,
} from 'react-native';
import { useSafeRouter } from '../src/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../src/constants/theme';
import { useTheme, useThemedStyles } from '../src/context/ThemeContext';
import { LoadingSpinner } from '../src/components/ui/LoadingSpinner';
import { notificationsService } from '../src/services/notifications';
import { hangoutsService } from '../src/services/hangouts';
import { NotificationItem as NotifType } from '../src/types';

function formatTimeAgo(rawDate?: string) {
  if (!rawDate) return 'recently';
  const d = new Date(rawDate);
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [respondingIds, setRespondingIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const markSingleRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true, is_read: true } : n))
    );
    try {
      await notificationsService.markAsRead(id);
    } catch {}
  };

  const handleRespondJoinRequest = async (notif: any, status: 'approved' | 'rejected') => {
    const hangoutId = notif.relatedEntityId || notif.related_entity_id;
    const targetUserId = notif.data?.userId || notif.senderId || notif.sender_id;
    if (hangoutId && targetUserId) {
      setRespondingIds((prev) => ({ ...prev, [notif.id]: true }));
      try {
        await hangoutsService.respondToJoinRequest(hangoutId, targetUserId, status);
        await markSingleRead(notif.id);
        Alert.alert('Success', `Join request ${status === 'approved' ? 'approved' : 'declined'}.`);
      } catch {
        Alert.alert('Error', `Failed to ${status} join request.`);
      } finally {
        setRespondingIds((prev) => ({ ...prev, [notif.id]: false }));
      }
    } else if (hangoutId) {
      await markSingleRead(notif.id);
      router.push(`/hangout/${hangoutId}`);
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationsService.list({ limit: 50 });
      setNotifications(Array.isArray(data) ? data : []);
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

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await notificationsService.markAllAsRead();
    } catch {}
  };

  const handleClearAll = () => {
    if (notifications.length === 0) return;
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear and delete all notifications from the database?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setNotifications([]);
            try {
              await notificationsService.markAllAsRead();
              await notificationsService.clearAll();
            } catch {}
          },
        },
      ]
    );
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

    const entityType = notif.relatedEntityType || notif.related_entity_type;
    const entityId = notif.relatedEntityId || notif.related_entity_id;

    if (entityType === 'post' && entityId) {
      router.push(`/post/${entityId}`);
    } else if (entityType === 'event' && entityId) {
      router.push(`/event/${entityId}`);
    } else if (entityType === 'hangout' && entityId) {
      router.push(`/hangout/${entityId}`);
    } else if (entityType === 'community' && entityId) {
      router.push(`/community/${entityId}`);
    } else if (entityType === 'user' && entityId) {
      router.push(`/user/${entityId}`);
    }
  };

  const unreadNotifications = notifications.filter((n) => !(n.isRead ?? n.is_read));
  const readNotifications = notifications.filter((n) => Boolean(n.isRead ?? n.is_read));

  const renderIcon = (type: string) => {
    switch (type) {
      case 'post_reaction':
        return (
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2' }]}>
            <MaterialIcons name="favorite" size={22} color={isDark ? '#f87171' : '#dc2626'} />
          </View>
        );
      case 'comment_reply':
        return (
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.2)' : '#e0f2fe' }]}>
            <MaterialIcons name="chat-bubble" size={22} color={isDark ? '#38bdf8' : '#0284c7'} />
          </View>
        );
      case 'follow':
        return (
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.22)' : '#dbeafe' }]}>
            <MaterialIcons name="person-add" size={22} color={isDark ? '#60a5fa' : '#2563eb'} />
          </View>
        );
      case 'community_member':
      case 'community_join':
      case 'new_member':
      case 'new_community_member':
        return (
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(168, 85, 247, 0.22)' : '#f3e8ff' }]}>
            <MaterialIcons name="group-add" size={22} color={isDark ? '#c084fc' : '#9333ea'} />
          </View>
        );
      case 'hangout_request':
        return (
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.22)' : '#fef3c7' }]}>
            <MaterialIcons name="person-add" size={22} color={isDark ? '#fbbf24' : '#d97706'} />
          </View>
        );
      case 'hangout_approved':
        return (
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.22)' : '#dcfce7' }]}>
            <MaterialIcons name="check-circle" size={22} color={isDark ? '#4ade80' : '#16a34a'} />
          </View>
        );
      case 'event_approved':
        return (
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.22)' : '#dcfce7' }]}>
            <MaterialIcons name="event-available" size={22} color={isDark ? '#4ade80' : '#16a34a'} />
          </View>
        );
      case 'mention':
        return (
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(234, 179, 8, 0.22)' : '#fef9c3' }]}>
            <MaterialIcons name="alternate-email" size={22} color={isDark ? '#facc15' : '#ca8a04'} />
          </View>
        );
      case 'event_reminder':
      case 'hangout_reminder':
        return (
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(249, 115, 22, 0.22)' : '#ffedd5' }]}>
            <MaterialIcons name="alarm" size={22} color={isDark ? '#fb923c' : '#ea580c'} />
          </View>
        );
      default:
        return (
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.2)' : '#f1f5f9' }]}>
            <MaterialIcons name="notifications" size={22} color={isDark ? '#cbd5e1' : '#475569'} />
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
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Notifications</Text>
        </View>

        <View style={styles.topBarActions}>
          {unreadNotifications.length > 0 && (
            <TouchableOpacity
              onPress={markAllRead}
              style={styles.markReadBtn}
              activeOpacity={0.7}
            >
              <MaterialIcons name="done-all" size={16} color={colors.primary} />
              <Text style={styles.markReadText}>Mark read</Text>
            </TouchableOpacity>
          )}

          {notifications.length > 0 && (
            <TouchableOpacity
              onPress={handleClearAll}
              style={styles.clearAllBtn}
              activeOpacity={0.7}
            >
              <MaterialIcons name="delete-sweep" size={17} color={colors.error} />
              <Text style={styles.clearAllText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
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
            tintColor={colors.primaryContainer}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <LoadingSpinner message="Checking notifications..." />
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="notifications-none" size={56} color={colors.tertiary} />
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
            </View>

            <View style={styles.itemsList}>
              {unreadNotifications.map((notif) => {
                const isExpanded = Boolean(expandedIds[notif.id]);
                const isJoinRequest = notif.type === 'hangout_request';
                const isResponding = Boolean(respondingIds[notif.id]);

                return (
                  <View
                    key={notif.id}
                    style={[styles.itemCard, styles.unreadCard]}
                  >
                    <View style={styles.cardHeaderRow}>
                      <TouchableOpacity
                        style={styles.cardMainTouch}
                        onPress={() => handlePress(notif)}
                        activeOpacity={0.8}
                      >
                        {renderIcon(notif.type)}

                        <View style={styles.itemTextCol}>
                          <Text style={styles.itemTitle}>{notif.title}</Text>
                          {notif.message ? (
                            <Text
                              style={styles.itemMessage}
                              numberOfLines={isExpanded ? undefined : 2}
                            >
                              {notif.message}
                            </Text>
                          ) : null}
                          <View style={styles.itemMetaRow}>
                            <Text style={styles.itemTime}>
                              {notif.timeAgo || formatTimeAgo(notif.createdAt || notif.created_at)}
                            </Text>
                            <View style={styles.metaDot} />
                            <Text style={styles.itemCategory}>
                              {notif.type === 'hangout_request'
                                ? 'Join Request'
                                : notif.type === 'hangout_approved'
                                ? 'Approved'
                                : notif.category || 'Notification'}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.cardRightControls}>
                        <View style={styles.unreadBlueDot} />
                        <TouchableOpacity
                          style={styles.expandChevronBtn}
                          onPress={() => toggleExpand(notif.id)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <MaterialIcons
                            name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                            size={22}
                            color={colors.onSurfaceVariant}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* EXPANDED SECTION */}
                    {isExpanded && (
                      <View style={styles.expandedContainer}>
                        <View style={styles.expandedDivider} />

                        {isJoinRequest && (
                          <View style={styles.requestActionRow}>
                            <Text style={styles.requestPromptText}>Participant Join Request:</Text>
                            <View style={styles.requestButtonPair}>
                              <TouchableOpacity
                                style={styles.declineBtn}
                                onPress={() => handleRespondJoinRequest(notif, 'rejected')}
                                disabled={isResponding}
                                activeOpacity={0.8}
                              >
                                <MaterialIcons name="close" size={15} color={colors.error} />
                                <Text style={styles.declineBtnText}>Reject</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.approveBtn}
                                onPress={() => handleRespondJoinRequest(notif, 'approved')}
                                disabled={isResponding}
                                activeOpacity={0.8}
                              >
                                <MaterialIcons name="check" size={15} color="#16a34a" />
                                <Text style={styles.approveBtnText}>Accept</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}

                        <TouchableOpacity
                          style={styles.cardMarkReadBtn}
                          onPress={() => markSingleRead(notif.id)}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="done" size={16} color={colors.primary} />
                          <Text style={styles.cardMarkReadText}>Mark as read</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
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
                  {readNotifications.map((notif) => {
                    const isExpanded = Boolean(expandedIds[notif.id]);
                    const isJoinRequest = notif.type === 'hangout_request';
                    const isResponding = Boolean(respondingIds[notif.id]);

                    return (
                      <View
                        key={notif.id}
                        style={[styles.itemCard, styles.readCard]}
                      >
                        <View style={styles.cardHeaderRow}>
                          <TouchableOpacity
                            style={styles.cardMainTouch}
                            onPress={() => handlePress(notif)}
                            activeOpacity={0.8}
                          >
                            {renderIcon(notif.type)}

                            <View style={styles.itemTextCol}>
                              <Text style={styles.itemTitle}>{notif.title}</Text>
                              {notif.message ? (
                                <Text
                                  style={styles.itemMessage}
                                  numberOfLines={isExpanded ? undefined : 2}
                                >
                                  {notif.message}
                                </Text>
                              ) : null}
                              <Text style={styles.itemTime}>
                                {notif.timeAgo || formatTimeAgo(notif.createdAt || notif.created_at)}
                              </Text>
                            </View>
                          </TouchableOpacity>

                          <View style={styles.cardRightControls}>
                            <TouchableOpacity
                              style={styles.expandChevronBtn}
                              onPress={() => toggleExpand(notif.id)}
                              activeOpacity={0.7}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <MaterialIcons
                                name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                                size={22}
                                color={colors.onSurfaceVariant}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* EXPANDED SECTION */}
                        {isExpanded && (
                          <View style={styles.expandedContainer}>
                            <View style={styles.expandedDivider} />

                            {isJoinRequest && (
                              <View style={styles.requestActionRow}>
                                <Text style={styles.requestPromptText}>Participant Join Request:</Text>
                                <View style={styles.requestButtonPair}>
                                  <TouchableOpacity
                                    style={styles.declineBtn}
                                    onPress={() => handleRespondJoinRequest(notif, 'rejected')}
                                    disabled={isResponding}
                                    activeOpacity={0.8}
                                  >
                                    <MaterialIcons name="close" size={15} color={colors.error} />
                                    <Text style={styles.declineBtnText}>Reject</Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={styles.approveBtn}
                                    onPress={() => handleRespondJoinRequest(notif, 'approved')}
                                    disabled={isResponding}
                                    activeOpacity={0.8}
                                  >
                                    <MaterialIcons name="check" size={15} color="#16a34a" />
                                    <Text style={styles.approveBtnText}>Accept</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}

                            <View style={styles.readIndicatorRow}>
                              <MaterialIcons name="check-circle" size={15} color={colors.tertiary} />
                              <Text style={styles.readIndicatorText}>Already read</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    backgroundColor: colors.surface,
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
    color: colors.onSurface,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: isDark ? 'rgba(232, 167, 54, 0.16)' : 'rgba(232, 167, 54, 0.12)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(232, 167, 54, 0.35)' : 'rgba(232, 167, 54, 0.25)',
  },
  markReadText: {
    ...Typography.labelMd,
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  clearAllText: {
    ...Typography.labelMd,
    color: colors.error,
    fontWeight: '700',
    fontSize: 12,
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
    color: colors.onSurface,
    fontWeight: '700',
  },
  unreadBadge: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  sectionSub: {
    ...Typography.captionSm,
    color: colors.tertiary,
  },
  earlierTitle: {
    ...Typography.labelMd,
    color: colors.tertiary,
    fontWeight: '600',
  },
  itemsList: {
    gap: 8,
  },
  itemCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardMainTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  expandChevronBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: colors.surfaceVariant,
    marginBottom: Spacing.sm,
  },
  cardMarkReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
    backgroundColor: 'transparent',
    marginTop: Spacing.xs,
  },
  cardMarkReadText: {
    fontSize: Typography.labelSmall.fontSize,
    fontWeight: '700',
    color: colors.primary,
  },
  readIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    paddingTop: 2,
  },
  readIndicatorText: {
    fontSize: Typography.captionSm.fontSize,
    color: colors.tertiary,
    fontWeight: '500',
  },
  requestActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 6,
  },
  requestPromptText: {
    fontSize: Typography.labelSmall.fontSize,
    fontWeight: '600',
    color: colors.onSurface,
  },
  requestButtonPair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  declineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.surfaceContainerHighest,
  },
  declineBtnText: {
    fontSize: Typography.labelSmall.fontSize,
    fontWeight: '600',
    color: colors.error,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: isDark ? 'rgba(22, 163, 74, 0.2)' : '#dcfce7',
  },
  approveBtnText: {
    fontSize: Typography.labelSmall.fontSize,
    fontWeight: '700',
    color: isDark ? '#4ade80' : '#16a34a',
  },
  unreadCard: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  readCard: {
    backgroundColor: colors.surfaceContainerLow,
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
    color: colors.onSurface,
    fontWeight: '700',
    lineHeight: 18,
  },
  itemMessage: {
    ...Typography.captionMd,
    color: colors.tertiary,
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
    color: colors.tertiary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.outlineVariant,
  },
  itemCategory: {
    ...Typography.captionSm,
    color: colors.primary,
    fontWeight: '600',
  },
  unreadBlueDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.secondary,
    alignSelf: 'center',
  },
  emptyContainer: {
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.md,
    backgroundColor: colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.headlineSm,
    fontSize: 20,
    color: colors.onSurface,
    fontWeight: '700',
  },
  emptySubtitle: {
    ...Typography.bodyMd,
    color: colors.tertiary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
});
