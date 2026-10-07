/**
 * Hangouts Listing Page — Accessed via "more" in the Home feed Hangouts section.
 * Includes back navigation to return to Home.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  BackHandler,
} from 'react-native';
import { useSafeRouter } from '../../src/hooks/useSafeRouter';
import { useNavigation, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../../src/constants/theme';
import { useTheme, useThemedStyles } from '../../src/context/ThemeContext';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { Avatar } from '../../src/components/ui/Avatar';
import { hangoutsService } from '../../src/services/hangouts';
import { useAuth } from '../../src/context/AuthContext';
import { useUserLocation } from '../../src/context/LocationContext';
import { categorizeItemByDate } from '../../src/utils/dateUtils';
import {
  sortItemsByLocationAndDate,
  formatDistance,
  extractItemCoordinates,
  getDistanceInKm,
  isItemPassed,
} from '../../src/utils/distance';
import { RaisingHandIcon } from '../../src/components/RaisingHandIcon';
import { BACKEND_CATEGORIES, formatCategoryName } from '../../src/utils/categories';

const CATEGORIES = ['All', ...BACKEND_CATEGORIES.map((c) => c.label)];

export default function HangoutsPage() {
  const router = useSafeRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const { user } = useAuth();
  const { userLocation } = useUserLocation();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);

  const [hangouts, setHangouts] = useState<any[]>([]);
  const [joinedHangouts, setJoinedHangouts] = useState<Record<string, boolean>>({});
  const [requestedHangouts, setRequestedHangouts] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState('All');
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

  useFocusEffect(
    useCallback(() => {
      fetchHangouts();
    }, [fetchHangouts])
  );

  useEffect(() => {
    const onBackPress = () => {
      if (router.canGoBack()) {
        router.back();
      } else {
        (router as any).navigate('/(tabs)');
      }
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [router]);

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

  const userCityName =
    user?.location?.name ||
    user?.location?.placeName ||
    (user as any)?.locationName ||
    null;

  const isHangoutInUserCity = useCallback(
    (h: any) => {
      // 1. If user GPS coords are available, check distance <= 50 km (standard metropolitan radius)
      const coords = extractItemCoordinates(h);
      if (userLocation && coords) {
        const distKm = getDistanceInKm(
          userLocation.latitude,
          userLocation.longitude,
          coords.latitude,
          coords.longitude
        );
        if (distKm <= 50) return true;
      }

      // 2. Check textual city match
      if (userCityName && typeof userCityName === 'string' && userCityName.trim()) {
        const primaryCity = userCityName.toLowerCase().split(',')[0].trim();
        if (primaryCity) {
          const hLocStr = (
            typeof h.location === 'string'
              ? h.location
              : (h.location?.name ||
                 h.location?.place_name ||
                 h.location?.placeName ||
                 h.locationName ||
                 '')
          ).toLowerCase();
          if (hLocStr.includes(primaryCity)) return true;
        }
      }

      // 3. Fallback: if user has no location configured at all, count all
      if (!userLocation && (!userCityName || !userCityName.trim())) {
        return true;
      }

      return false;
    },
    [userLocation, userCityName]
  );

  const filteredHangouts = hangouts.filter((h) => {
    // Category filter
    if (selectedCategory !== 'All') {
      const catLabel = formatCategoryName(
        h.category?.name ||
          h.category ||
          h.categoryName ||
          (h as any).category_name ||
          (h as any).categoryId ||
          'Other',
        true
      );
      if (catLabel.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
    }

    // Search query filter
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const titleMatch = h.title?.toLowerCase().includes(q);
    const descMatch = h.description?.toLowerCase().includes(q);
    const hostMatch = (h.creatorName || h.creator?.first_name || '').toLowerCase().includes(q);
    const placeMatch = (h.location?.place_name || h.location?.name || '').toLowerCase().includes(q);
    return Boolean(titleMatch || descMatch || hostMatch || placeMatch);
  });

  const nearYouHangouts = useMemo(() => {
    return filteredHangouts.filter((h) => {
      if (isItemPassed(h)) return false;
      return isHangoutInUserCity(h);
    });
  }, [filteredHangouts, isHangoutInUserCity]);

  const nearYouCount = nearYouHangouts.length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Header with Back Button */}
      <View style={styles.topNavRow}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              (router as any).navigate('/(tabs)');
            }
          }}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Hangouts</Text>
        <TouchableOpacity
          onPress={() => router.push('/new-hangout')}
          style={styles.createButton}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={22} color={colors.primaryContainer} />
        </TouchableOpacity>
      </View>

      {/* Persistent Header: Search Bar + Category Chips + Live Beacon */}
      <View style={styles.persistentHeader}>
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color={colors.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search hangouts..."
            placeholderTextColor={colors.tertiary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            underlineColorAndroid="transparent"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={18} color={colors.tertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category Filter Chips */}
        <View style={styles.categoryChipsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORIES.map((cat) => {
              const isCatActive = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, isCatActive && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(cat)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      isCatActive && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.statusBar}>
          <View style={styles.beaconGroup}>
            <View style={styles.beaconRing}>
              <View style={styles.beaconDot} />
            </View>
            <Text style={styles.beaconText}>
              {nearYouCount} {nearYouCount === 1 ? 'Hangout' : 'Hangouts'} Near You
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryContainer}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <LoadingSpinner message="Loading hangouts..." />
        ) : hangouts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="explore" size={56} color={colors.tertiary} />
            <Text style={styles.emptyTitle}>No Hangouts Nearby</Text>
            <Text style={styles.emptySubtitle}>
              Nobody has organized a hangout nearby right now. Host a casual meetup, coffee chat, or study session!
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => router.push('/new-hangout')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="add" size={20} color={colors.onPrimaryContainer} />
              <Text style={styles.emptyActionText}>Host a Hangout</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {sortItemsByLocationAndDate(filteredHangouts, userLocation).map((h) => {
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
                  style={[styles.card, dateInfo.isPassed && styles.itemCardPassed]}
                  activeOpacity={dateInfo.isPassed ? 0.38 : 0.88}
                  onPress={() => router.push(`/hangout/${h.id}`)}
                >
                  {/* Protruding Lock / Open Padlock Badge (Top-Right) — Only on active hangouts */}
                  {!dateInfo.isPassed && (
                    <View
                      style={[
                        styles.protrudingPadlockBadge,
                        isOpen ? styles.padlockOpenBadge : styles.padlockLockedBadge,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={isOpen ? 'lock-open-variant' : 'lock'}
                        size={12}
                        color="#ffffff"
                      />
                    </View>
                  )}

                  {/* Header Row */}
                  <View style={styles.cardHeader}>
                    <View style={styles.hostGroup}>
                      <Avatar
                        uri={creatorAvatar}
                        size={36}
                        name={h.creatorName || h.creator?.first_name || 'Host'}
                      />
                      <View>
                        <Text style={styles.hostName}>
                          {h.creatorName || h.creator?.first_name || 'Host'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.headerRightBadges}>
                      <View style={styles.hangoutCategoryPill}>
                        <Text style={styles.hangoutCategoryPillText} numberOfLines={1}>
                          {formatCategoryName(
                            h.category?.name ||
                              h.category ||
                              h.categoryName ||
                              (h as any).category_name ||
                              'Other',
                            true
                          )}
                        </Text>
                      </View>
                      {(() => {
                        const coords = extractItemCoordinates(h);
                        const hasLoc = Boolean(typeof h.location === 'string' ? h.location.trim() : (h.location?.name?.trim() || h.location?.place_name?.trim() || h.locationName?.trim()));
                        if (!hasLoc || !coords || !userLocation) return null;
                        const d = getDistanceInKm(userLocation.latitude, userLocation.longitude, coords.latitude, coords.longitude);
                        const txt = formatDistance(d);
                        if (!txt) return null;
                        return (
                          <View style={styles.distanceBadge}>
                            <MaterialIcons name="near-me" size={13} color={colors.tertiary} />
                            <Text style={styles.distanceText}>{txt}</Text>
                          </View>
                        );
                      })()}
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
                    <MaterialIcons name="schedule" size={16} color={dateInfo.isPassed ? colors.outline : colors.onSurfaceVariant} />
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
                          <MaterialIcons name="hourglass-empty" size={15} color={colors.primary} />
                        ) : (
                          <RaisingHandIcon size={18} color={colors.onPrimaryContainer} />
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

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    topNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceContainerHigh,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pageTitle: {
      ...Typography.headlineSm,
      fontSize: 18,
      fontWeight: '700',
      color: colors.onSurface,
    },
    createButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    persistentHeader: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      backgroundColor: colors.surface,
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
      backgroundColor: colors.success,
    },
    beaconText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.onSurfaceVariant,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: BorderRadius.full,
      paddingHorizontal: 14,
      height: 44,
      marginBottom: Spacing.xs,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: 8,
    },
    categoryChipsWrapper: {
      height: 40,
      marginBottom: Spacing.xs,
    },
    categoryScroll: {
      gap: 8,
      alignItems: 'center',
    },
    categoryChip: {
      height: 32,
      paddingHorizontal: 14,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    categoryChipActive: {
      backgroundColor: colors.primaryContainer,
      borderColor: colors.primaryContainer,
    },
    categoryChipText: {
      ...Typography.captionMd,
      color: colors.onSurface,
      fontWeight: '500',
    },
    categoryChipTextActive: {
      color: colors.onPrimaryContainer,
      fontWeight: '700',
    },
    searchInput: {
      flex: 1,
      ...Typography.bodyMd,
      color: colors.onSurface,
      paddingVertical: 0,
    },
    hostAvatarFallback: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      gap: 12,
      marginTop: 4,
    },
    card: {
      backgroundColor: colors.cardBg,
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      overflow: 'visible',
      ...Shadows.sm,
    },
    protrudingPadlockBadge: {
      position: 'absolute',
      top: -7,
      right: -7,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0,
      borderColor: 'transparent',
      zIndex: 20,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 2,
    },
    padlockOpenBadge: {
      backgroundColor: '#16a34a',
    },
    padlockLockedBadge: {
      backgroundColor: '#d97706',
    },
    hangoutCategoryPill: {
      paddingHorizontal: 8,
      paddingVertical: 2.5,
      borderRadius: BorderRadius.full,
      backgroundColor: isDark ? 'rgba(232, 167, 54, 0.16)' : 'rgba(232, 167, 54, 0.22)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(232, 167, 54, 0.35)' : 'rgba(217, 119, 6, 0.4)',
      maxWidth: 105,
    },
    hangoutCategoryPillText: {
      fontSize: 10,
      fontWeight: '700',
      color: isDark ? '#f6c368' : '#92400e',
      letterSpacing: 0.3,
    },
    itemCardPassed: {
      opacity: isDark ? 0.38 : 0.45,
      backgroundColor: isDark ? 'rgba(28, 25, 23, 0.45)' : 'rgba(226, 232, 240, 0.6)',
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
      color: colors.onSurface,
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
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.20)' : 'rgba(5, 150, 105, 0.12)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(5, 150, 105, 0.35)' : 'rgba(5, 150, 105, 0.20)',
    },
    hangoutPillRequest: {
      backgroundColor: isDark ? 'rgba(232, 167, 54, 0.16)' : 'rgba(232, 167, 54, 0.12)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(232, 167, 54, 0.35)' : 'rgba(232, 167, 54, 0.22)',
    },
    hangoutPillText: {
      ...Typography.captionSm,
      fontSize: 10,
      fontWeight: '700',
    },
    hangoutPillOpenText: {
      color: isDark ? '#34d399' : '#059669',
    },
    hangoutPillRequestText: {
      ...Typography.captionSm,
      fontSize: 10,
      fontWeight: '700',
      color: isDark ? '#fbbf24' : '#d97706',
    },
    openDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: isDark ? '#34d399' : '#059669',
    },
    requestDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: isDark ? '#fbbf24' : '#d97706',
    },
    distanceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    distanceText: {
      ...Typography.captionSm,
      color: colors.tertiary,
    },
    cardTitle: {
      ...Typography.headlineSm,
      fontSize: 18,
      color: colors.onSurface,
      fontWeight: '700',
    },
    cardDesc: {
      ...Typography.bodyMd,
      color: colors.tertiary,
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
      color: colors.onSurfaceVariant,
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
      color: colors.tertiary,
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
      backgroundColor: colors.primaryContainer,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    hangoutIconBtnRequest: {
      backgroundColor: colors.primaryContainer,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    hangoutIconBtnRequested: {
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.22)' : '#fef3c7',
      borderWidth: 1.5,
      borderColor: '#f59e0b',
    },
    hangoutIconBtnJoined: {
      backgroundColor: '#059669',
      borderWidth: 0,
      borderColor: 'transparent',
    },
    cardPassed: {},
    textPassed: {
      color: colors.outline,
    },
    passedPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.surfaceVariant,
    },
    passedPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
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
      marginTop: Spacing.md,
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
    emptyActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      backgroundColor: colors.primaryContainer,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: BorderRadius.full,
    },
    emptyActionText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.onPrimaryContainer,
    },
  });
