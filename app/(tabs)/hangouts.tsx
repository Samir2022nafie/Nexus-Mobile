/**
 * Hangouts Hub Screen — Matches Stitch screen_11_explore_hangouts_tab
 * Features:
 * - AppHeader (/ Hangouts)
 * - Live Beacon: "5 Hangouts Near You" with pulsing emerald beacon + filter toggle
 * - Status pill on each card ("Open Meet" [emerald] vs "Request to Join" [warm amber])
 * - 3-state functional action button (Unjoined with RaisingHandIcon, Pending with hourglass, Joined with walking person)
 * - Dynamic tab bar hide/reveal on scroll with useTabBarVisibility
 * - Tab press scrolls to top
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { hangoutsService } from '../../src/services/hangouts';
import { useAuth } from '../../src/context/AuthContext';
import { HangoutItem } from '../../src/types';
import { categorizeItemByDate, sortItemsByDate } from '../../src/utils/dateUtils';
import { useTabBarVisibility } from '../../src/context/TabBarVisibilityContext';
import { RaisingHandIcon } from '../../src/components/RaisingHandIcon';

export default function HangoutsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const { handleTabBarScroll } = useTabBarVisibility();
  const { user } = useAuth();

  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(Date.now());

  const handleScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const currentTime = Date.now();
    const dy = currentY - lastScrollY.current;
    const dt = Math.max(1, currentTime - lastScrollTime.current);
    const velocityY = dy / dt;
    lastScrollY.current = currentY;
    lastScrollTime.current = currentTime;
    handleTabBarScroll(dy, velocityY, currentY);
  };

  // Tab press listener: scroll to top
  useEffect(() => {
    const unsubscribe = (navigation as any)?.addListener?.('tabPress', () => {
      if ((navigation as any)?.isFocused?.()) {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    });
    return unsubscribe;
  }, [navigation]);

  const [hangouts, setHangouts] = useState<any[]>([]);
  const [joinedHangouts, setJoinedHangouts] = useState<Record<string, boolean>>({});
  const [requestedHangouts, setRequestedHangouts] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHangouts = useCallback(async () => {
    try {
      const data = await hangoutsService.list({ limit: 30 });
      setHangouts(data || []);
      const initialJoined: Record<string, boolean> = {};
      const initialRequested: Record<string, boolean> = {};
      (data || []).forEach((h: any) => {
        if (h.isParticipant) initialJoined[h.id] = true;
        if (h.hasRequested || h.isRequested || h.requestStatus === 'pending') initialRequested[h.id] = true;
      });
      setJoinedHangouts(initialJoined);
      setRequestedHangouts(initialRequested);
    } catch {
      setHangouts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHangouts();
  }, [fetchHangouts]);

  // Screen focus listener: sync data when returning
  useEffect(() => {
    const unsubscribe = (navigation as any)?.addListener?.('focus', () => {
      fetchHangouts();
    });
    return unsubscribe;
  }, [navigation, fetchHangouts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHangouts();
  };

  const handleToggleJoin = async (e: any, h: any) => {
    e.stopPropagation?.();
    const isOpen = h.isOpen ?? (h.joinType === 'OPEN' || h.join_type === 'OPEN' || h.joinType === 'open' || h.join_type === 'open');
    const isHost = Boolean(user && (h.creatorId === user.id || h.creator_id === user.id || h.creator?.id === user.id));
    const isDirectJoin = isOpen || isHost;
    const currentlyJoined = joinedHangouts[h.id] !== undefined ? joinedHangouts[h.id] : Boolean(h.isParticipant);

    if (isDirectJoin) {
      if (currentlyJoined) {
        Alert.alert('Leave Hangout', 'Are you sure you want to leave this hangout?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: async () => {
              setJoinedHangouts((prev) => ({ ...prev, [h.id]: false }));
              try {
                await hangoutsService.leave(h.id);
              } catch {
                setJoinedHangouts((prev) => ({ ...prev, [h.id]: true }));
              }
            },
          },
        ]);
      } else {
        setJoinedHangouts((prev) => ({ ...prev, [h.id]: true }));
        try {
          await hangoutsService.join(h.id);
        } catch {
          setJoinedHangouts((prev) => ({ ...prev, [h.id]: false }));
        }
      }
    } else {
      // Request-based meetup: 3-state logic
      if (currentlyJoined) {
        Alert.alert('Leave Hangout', 'Are you sure you want to leave this hangout?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: async () => {
              setJoinedHangouts((prev) => ({ ...prev, [h.id]: false }));
              try {
                await hangoutsService.leave(h.id);
              } catch {
                setJoinedHangouts((prev) => ({ ...prev, [h.id]: true }));
              }
            },
          },
        ]);
      } else {
        const currentlyRequested =
          requestedHangouts[h.id] !== undefined
            ? requestedHangouts[h.id]
            : Boolean(h.hasRequested || h.isRequested || h.requestStatus === 'pending');

        if (currentlyRequested) {
          Alert.alert('Cancel Request', 'Cancel your request to join this hangout?', [
            { text: 'No', style: 'cancel' },
            {
              text: 'Cancel Request',
              style: 'destructive',
              onPress: async () => {
                setRequestedHangouts((prev) => ({ ...prev, [h.id]: false }));
                try {
                  await hangoutsService.leave(h.id);
                } catch {
                  setRequestedHangouts((prev) => ({ ...prev, [h.id]: true }));
                }
              },
            },
          ]);
        } else {
          setRequestedHangouts((prev) => ({ ...prev, [h.id]: true }));
          try {
            await hangoutsService.requestJoin(h.id);
          } catch {
            setRequestedHangouts((prev) => ({ ...prev, [h.id]: false }));
          }
        }
      }
    }
  };

  const filteredHangouts = hangouts.filter((h) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const titleMatch = h.title?.toLowerCase().includes(q);
    const descMatch = h.description?.toLowerCase().includes(q);
    const hostMatch = (h.creatorName || h.creator?.first_name || '').toLowerCase().includes(q);
    const placeMatch = (h.location?.place_name || '').toLowerCase().includes(q);
    return Boolean(titleMatch || descMatch || hostMatch || placeMatch);
  });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Persistent Header: Search Bar + Live Beacon */}
      <View style={styles.persistentHeader}>
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color={Colors.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search hangouts..."
            placeholderTextColor={Colors.tertiary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            underlineColorAndroid="transparent"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={18} color={Colors.tertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.statusBar}>
          <View style={styles.beaconGroup}>
            <View style={styles.beaconRing}>
              <View style={styles.beaconDot} />
            </View>
            <Text style={styles.beaconText}>
              {filteredHangouts.length} {filteredHangouts.length === 1 ? 'Hangout' : 'Hangouts'} Near You
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primaryContainer}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <LoadingSpinner message="Loading hangouts..." />
        ) : hangouts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="explore" size={56} color={Colors.tertiary} />
            <Text style={styles.emptyTitle}>No Hangouts Nearby</Text>
            <Text style={styles.emptySubtitle}>
              Nobody has organized a hangout nearby right now. Host a casual meetup, coffee chat, or study session!
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => router.push('/new-hangout')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="add" size={20} color={Colors.onPrimaryContainer} />
              <Text style={styles.emptyActionText}>Host a Hangout</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {sortItemsByDate(filteredHangouts).map((h) => {
              const isOpen = h.isOpen ?? (h.joinType === 'OPEN' || h.join_type === 'OPEN' || h.joinType === 'open' || h.join_type === 'open');
              const dateInfo = categorizeItemByDate(h);
              const creatorAvatar = h.creatorAvatar || h.creator?.profile_picture_url;
              const isJoined =
                joinedHangouts[h.id] !== undefined
                  ? joinedHangouts[h.id]
                  : Boolean(h.isParticipant);
              const isRequested =
                !isJoined &&
                (requestedHangouts[h.id] !== undefined
                  ? requestedHangouts[h.id]
                  : Boolean(h.hasRequested || h.isRequested || h.requestStatus === 'pending'));

              const pCount = h.participantsCount ?? h.participantCount ?? 0;
              const rawMax = h.maxParticipants ?? h.max_participants;
              const hasLimit = typeof rawMax === 'number' && rawMax > 0;
              const spotsDisplay = h.spotsText || (hasLimit ? `${pCount}/${rawMax} spots` : `${pCount} going`);

              return (
                <TouchableOpacity
                  key={h.id}
                  style={[styles.card, dateInfo.isPassed && styles.cardPassed]}
                  activeOpacity={0.88}
                  onPress={() => router.push(`/hangout/${h.id}`)}
                >
                  {/* Header Row */}
                  <View style={styles.cardHeader}>
                    <View style={styles.hostGroup}>
                      {creatorAvatar ? (
                        <Image
                          source={{ uri: creatorAvatar }}
                          style={styles.hostAvatar}
                        />
                      ) : (
                        <View style={styles.hostAvatarFallback}>
                          <MaterialIcons name="person" size={20} color={Colors.tertiary} />
                        </View>
                      )}
                      <View>
                        <Text style={styles.hostName}>
                          {h.creatorName || h.creator?.first_name || 'Host'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.headerRightBadges}>
                      <View style={[styles.hangoutPill, isOpen ? styles.hangoutPillOpen : styles.hangoutPillRequest]}>
                        {isOpen && <View style={styles.openDot} />}
                        <Text style={[styles.hangoutPillText, isOpen ? styles.hangoutPillOpenText : styles.hangoutPillRequestText]}>
                          {isOpen ? 'Open Meet' : 'Request to Join'}
                        </Text>
                      </View>
                      <View style={styles.distanceBadge}>
                        <MaterialIcons name="near-me" size={13} color={Colors.tertiary} />
                        <Text style={styles.distanceText}>{h.distanceText || (h.location?.place_name ? h.location.place_name.slice(0, 12) : 'Nearby')}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Title & Description */}
                  <Text style={styles.cardTitle}>{h.title}</Text>
                  {h.description ? (
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {h.description}
                    </Text>
                  ) : null}

                  {/* Schedule */}
                  <View style={styles.scheduleRow}>
                    <MaterialIcons name="schedule" size={16} color={dateInfo.isPassed ? Colors.outline : Colors.onSurfaceVariant} />
                    <Text style={[styles.scheduleText, dateInfo.isPassed && styles.textPassed]}>
                      {dateInfo.isPassed ? 'Ended' : dateInfo.dateText}
                    </Text>
                  </View>

                  {/* Footer with spots and 3-state CTA */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.spotsText}>
                      {spotsDisplay}
                    </Text>
                    {!dateInfo.isPassed ? (
                      <TouchableOpacity
                        style={[
                          styles.hangoutActionIconBtn,
                          isJoined
                            ? styles.hangoutIconBtnJoined
                            : isRequested
                            ? styles.hangoutIconBtnRequested
                            : styles.hangoutIconBtnOpen,
                        ]}
                        onPress={(e) => handleToggleJoin(e, h)}
                        activeOpacity={0.8}
                      >
                        {isJoined ? (
                          <MaterialIcons name="directions-walk" size={18} color="#ffffff" />
                        ) : isRequested ? (
                          <MaterialIcons name="hourglass-empty" size={15} color={Colors.primary} />
                        ) : (
                          <RaisingHandIcon size={18} color={Colors.onPrimaryContainer} />
                        )}
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.passedPill}>
                        <Text style={styles.passedPillText}>Ended</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
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
  persistentHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: 48,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  beaconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  beaconRing: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(61, 168, 107, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  beaconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  beaconText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMd,
    color: Colors.onSurface,
    paddingVertical: 0,
  },
  hostAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: 12,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hostGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hostAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  hostName: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  headerRightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hangoutPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hangoutPillOpen: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
  },
  hangoutPillRequest: {
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
  },
  hangoutPillText: {
    ...Typography.captionSm,
    fontSize: 10,
    fontWeight: '700',
  },
  hangoutPillOpenText: {
    color: '#059669',
  },
  hangoutPillRequestText: {
    ...Typography.captionSm,
    fontSize: 10,
    fontWeight: '700',
    color: '#d97706',
  },
  openDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#059669',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },
  cardTitle: {
    ...Typography.headlineSm,
    fontSize: 18,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  cardDesc: {
    ...Typography.bodyMd,
    color: Colors.tertiary,
    lineHeight: 20,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  scheduleText: {
    ...Typography.captionMd,
    color: Colors.onSurfaceVariant,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(105, 92, 80, 0.15)',
  },
  spotsText: {
    ...Typography.captionMd,
    color: Colors.tertiary,
    fontWeight: '600',
  },
  hangoutActionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    ...Shadows.sm,
  },
  hangoutIconBtnOpen: {
    backgroundColor: Colors.primaryContainer,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  hangoutIconBtnRequest: {
    backgroundColor: Colors.primaryContainer,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  hangoutIconBtnRequested: {
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },
  hangoutIconBtnJoined: {
    backgroundColor: '#059669',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  cardPassed: {
    opacity: 0.5,
  },
  textPassed: {
    color: Colors.outline,
  },
  passedPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceVariant,
  },
  passedPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
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
    marginTop: Spacing.md,
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
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.onPrimaryContainer,
  },
});
