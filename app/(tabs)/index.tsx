/**
 * Home Feed Screen — Matches Stitch screen_8_home_feed_loaded
 * Features:
 * 1. Absolute AppHeader with smooth scroll hide/reveal and tap-to-scroll-to-top.
 * 2. Instagram-style community circles (enlarged 76x76, no yellow ring, 'groups' placeholder, singular explore circle when empty).
 * 3. Upcoming Events strictly from joined communities, white background, category badge, community name beneath title, smart date ordering (today/future/past).
 * 4. Hangouts Near You square cards (~180x180), 'Open' pill removed, smart date ordering.
 * 5. "What people are saying" section with stock rising arrow icon.
 * 6. Double-click Home tab in navigation bar scrolls to top and refreshes feed.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  TouchableOpacity,
  Animated,
  Alert,
  PanResponder,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../../src/constants/theme';
import { useTheme, useThemedStyles } from '../../src/context/ThemeContext';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { useAuth } from '../../src/context/AuthContext';
import { communitiesService } from '../../src/services/communities';
import { hangoutsService } from '../../src/services/hangouts';
import { eventsService } from '../../src/services/events';
import { postsService } from '../../src/services/posts';
import { Community, HangoutItem } from '../../src/types';
import { formatCategoryName } from '../../src/utils/categories';
import { useTabBarVisibility } from '../../src/context/TabBarVisibilityContext';
import { usePostState } from '../../src/context/PostStateContext';
import { RaisingHandIcon } from '../../src/components/RaisingHandIcon';
import { FeedDiscussionCard } from '../../src/components/FeedDiscussionCard';

/**
 * Format relative date for post timestamps
 */
function formatPostDate(rawDate?: string) {
  if (!rawDate) return '';
  const d = new Date(rawDate);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Smart Date Categorization and Formatting
 */
function categorizeItemByDate(item: any) {
  const rawStarts = item.startsAt || item.starts_at;
  const rawEnds = item.endsAt || item.ends_at;
  const now = new Date();

  if (!rawStarts) {
    return {
      status: 'future' as const,
      dateText: 'Upcoming',
      sortKey: 9999999999999,
      isPassed: false,
    };
  }

  const startDate = new Date(rawStarts);
  const endDate = rawEnds ? new Date(rawEnds) : null;

  const isToday =
    startDate.getFullYear() === now.getFullYear() &&
    startDate.getMonth() === now.getMonth() &&
    startDate.getDate() === now.getDate();

  const isOngoing = startDate <= now && Boolean(endDate && endDate > now);
  const cutoff = endDate || new Date(startDate.getTime() + 3 * 3600 * 1000);
  const isPassed = !isToday && !isOngoing && cutoff < now;

  const timeStr = startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday || isOngoing) {
    return {
      status: 'today' as const,
      dateText: `Today • ${timeStr}`,
      sortKey: Math.abs(startDate.getTime() - now.getTime()),
      isPassed: false,
    };
  }

  if (isPassed) {
    return {
      status: 'passed' as const,
      dateText: 'Passed',
      sortKey: startDate.getTime(),
      isPassed: true,
    };
  }

  const dateStr = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return {
    status: 'future' as const,
    dateText: `${dateStr} • ${timeStr}`,
    sortKey: startDate.getTime(),
    isPassed: false,
  };
}

function sortItemsByDate(items: any[]) {
  return [...items].sort((a, b) => {
    const catA = categorizeItemByDate(a);
    const catB = categorizeItemByDate(b);

    const rank = { today: 1, future: 2, passed: 3 };
    if (rank[catA.status] !== rank[catB.status]) {
      return rank[catA.status] - rank[catB.status];
    }
    return catA.sortKey - catB.sortKey;
  });
}

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);

  // Swipe right-to-left in posts section navigates to Explore tab
  const postsPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dx < -30 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5) {
          (navigation as any).navigate('explore');
        }
      },
    })
  ).current;

  const scrollViewRef = useRef<ScrollView>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [hangouts, setHangouts] = useState<HangoutItem[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const {
    likedPosts: globalLiked,
    savedPosts: globalSaved,
    toggleLike,
    toggleSave,
  } = usePostState();
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({});
  const [joinedHangouts, setJoinedHangouts] = useState<Record<string, boolean>>({});
  const [requestedHangouts, setRequestedHangouts] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const { handleTabBarScroll } = useTabBarVisibility();

  // Dynamic header hide/reveal on scroll
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(Date.now());
  const headerVisible = useRef(true);

  const handleScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const currentTime = Date.now();
    const dy = currentY - lastScrollY.current;
    const dt = Math.max(1, currentTime - lastScrollTime.current);
    const velocityY = dy / dt;

    lastScrollY.current = currentY;
    lastScrollTime.current = currentTime;

    // Synchronize bottom navigation bar hide/reveal
    handleTabBarScroll(dy, velocityY, currentY);

    if (currentY <= 15) {
      if (!headerVisible.current) {
        headerVisible.current = true;
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }
    } else if (dy > 2 && currentY > 30) {
      // Hide whenever user scrolls down (fast or slow)
      if (headerVisible.current) {
        headerVisible.current = false;
        Animated.timing(headerTranslateY, {
          toValue: -110,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    } else if (dy < -4 && velocityY < -0.6) {
      // Reveal on quick swipe up
      if (!headerVisible.current) {
        headerVisible.current = true;
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  const handleScrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const fetchData = useCallback(async () => {
    try {
      const [commData, hangData] = await Promise.all([
        communitiesService.list({ limit: 50 }).catch(() => []),
        hangoutsService.list({ limit: 50 }).catch(() => []),
      ]);

      // Only show communities the user has joined
      const userJoinedComms = (commData || []).filter((c) => c.isMember);
      setCommunities(userJoinedComms);

      // Initialize joined and requested hangouts map
      const initialJoined: Record<string, boolean> = {};
      const initialRequested: Record<string, boolean> = {};
      (hangData || []).forEach((h: any) => {
        if (h.isParticipant) {
          initialJoined[h.id] = true;
        }
        if (
          h.hasRequested ||
          h.isRequested ||
          h.requestStatus === 'pending' ||
          (h as any).userRequestStatus === 'pending'
        ) {
          initialRequested[h.id] = true;
        }
      });
      setJoinedHangouts(initialJoined);
      setRequestedHangouts(initialRequested);

      // Order hangouts with smart date awareness
      const sortedHangs = sortItemsByDate(hangData || []);
      setHangouts(sortedHangs);

      // Fetch events strictly from communities the user has joined
      if (userJoinedComms.length > 0) {
        try {
          const evPromises = userJoinedComms.slice(0, 8).map((c) =>
            eventsService.listByCommunity(c.slug, { limit: 6 }).then((evs) =>
              (Array.isArray(evs) ? evs : (evs as any)?.data || []).map((e: any) => ({
                ...e,
                community: c,
                communityName: c.name,
                communityCategory: c.category?.name || c.category,
                communitySlug: c.slug,
              }))
            ).catch(() => [])
          );
          const postPromises = userJoinedComms.slice(0, 8).map((c) =>
            postsService.listByCommmunity(c.slug, { limit: 6 }).then((pList) =>
              (Array.isArray(pList) ? pList : (pList as any)?.data || []).map((p: any) => ({
                ...p,
                community: c,
                communityName: c.name,
                communityCategory: c.category?.name || c.category,
                communitySlug: c.slug,
              }))
            ).catch(() => [])
          );
          const [evArrays, postArrays] = await Promise.all([
            Promise.all(evPromises),
            Promise.all(postPromises),
          ]);

          const sortedEvents = sortItemsByDate(evArrays.flat());
          setEvents(sortedEvents);
          const flatPosts = postArrays.flat();
          setPosts(flatPosts);

          // Populate reaction & bookmark states
          const initLikes: Record<string, boolean> = {};
          const initSaves: Record<string, boolean> = {};
          flatPosts.forEach((p: any) => {
            if (p.hasReacted || p.isLiked) initLikes[p.id] = true;
            if (p.isSaved || p.hasSaved) initSaves[p.id] = true;
          });
          setLikedPosts((prev) => ({ ...initLikes, ...prev }));
          setSavedPosts((prev) => ({ ...initSaves, ...prev }));
        } catch {
          setEvents([]);
          setPosts([]);
        }
      } else {
        setEvents([]);
        setPosts([]);
      }
    } catch {
      setCommunities([]);
      setHangouts([]);
      setEvents([]);
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Home tab press listener: if user is already on Home, scroll to top and refresh
  useEffect(() => {
    const unsubscribe = (navigation as any)?.addListener?.('tabPress', (e: any) => {
      if ((navigation as any)?.isFocused?.()) {
        e.preventDefault();
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        onRefresh();
      }
    });
    return unsubscribe;
  }, [navigation, onRefresh]);

  // Screen focus listener: sync data when returning from hangout detail or other tabs
  useEffect(() => {
    const unsubscribe = (navigation as any)?.addListener?.('focus', () => {
      fetchData();
    });
    return unsubscribe;
  }, [navigation, fetchData]);

  const handleToggleLike = async (postId: string) => {
    const postObj = posts.find((p) => p.id === postId);
    const initial = Boolean(postObj?.hasReacted || postObj?.isLiked);
    const currentlyLiked = globalLiked[postId] ?? likedPosts[postId] ?? initial;
    const baseLikes = postObj?.likesCount ?? postObj?.reactionCount ?? 0;
    const nextLiked = !currentlyLiked;

    setLikedPosts((prev) => ({ ...prev, [postId]: nextLiked }));
    try {
      await toggleLike(postId, currentlyLiked, baseLikes);
    } catch {
      setLikedPosts((prev) => ({ ...prev, [postId]: currentlyLiked }));
    }
  };

  const handleToggleSave = async (postId: string) => {
    const postObj = posts.find((p) => p.id === postId);
    const initial = Boolean(postObj?.isSaved || postObj?.hasSaved);
    const currentlySaved = globalSaved[postId] ?? savedPosts[postId] ?? initial;
    const nextSaved = !currentlySaved;

    setSavedPosts((prev) => ({ ...prev, [postId]: nextSaved }));
    try {
      await toggleSave(postId, currentlySaved);
    } catch {
      setSavedPosts((prev) => ({ ...prev, [postId]: currentlySaved }));
    }
  };

  const handleToggleHangoutJoin = async (e: any, hangout: any) => {
    e.stopPropagation?.();
    const isOpen =
      hangout.joinType === 'open' ||
      hangout.join_type === 'open' ||
      (!hangout.joinType && !hangout.join_type);
    const isHost = Boolean(user && (hangout.creatorId === user.id || hangout.creator_id === user.id || hangout.creator?.id === user.id));
    const isDirectJoin = isOpen || isHost;

    const currentlyJoined =
      joinedHangouts[hangout.id] !== undefined
        ? joinedHangouts[hangout.id]
        : Boolean(hangout.isParticipant);

    if (isDirectJoin) {
      if (currentlyJoined) {
        Alert.alert('Leave Hangout', 'Are you sure you want to leave this hangout?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: async () => {
              setJoinedHangouts((prev) => ({ ...prev, [hangout.id]: false }));
              try {
                await hangoutsService.leave(hangout.id);
              } catch {
                setJoinedHangouts((prev) => ({ ...prev, [hangout.id]: true }));
              }
            },
          },
        ]);
      } else {
        setJoinedHangouts((prev) => ({ ...prev, [hangout.id]: true }));
        try {
          await hangoutsService.join(hangout.id);
        } catch {
          setJoinedHangouts((prev) => ({ ...prev, [hangout.id]: false }));
        }
      }
    } else {
      // Request-based hangout: 3-state logic
      if (currentlyJoined) {
        Alert.alert('Leave Hangout', 'Are you sure you want to leave this hangout?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: async () => {
              setJoinedHangouts((prev) => ({ ...prev, [hangout.id]: false }));
              try {
                await hangoutsService.leave(hangout.id);
              } catch {
                setJoinedHangouts((prev) => ({ ...prev, [hangout.id]: true }));
              }
            },
          },
        ]);
      } else {
        const currentlyRequested =
          requestedHangouts[hangout.id] !== undefined
            ? requestedHangouts[hangout.id]
            : Boolean(hangout.hasRequested || hangout.isRequested || (hangout as any).requestStatus === 'pending');

        if (currentlyRequested) {
          Alert.alert('Cancel Request', 'Cancel your request to join this hangout?', [
            { text: 'No', style: 'cancel' },
            {
              text: 'Cancel Request',
              style: 'destructive',
              onPress: async () => {
                setRequestedHangouts((prev) => ({ ...prev, [hangout.id]: false }));
                try {
                  await hangoutsService.leave(hangout.id);
                } catch {
                  setRequestedHangouts((prev) => ({ ...prev, [hangout.id]: true }));
                }
              },
            },
          ]);
        } else {
          setRequestedHangouts((prev) => ({ ...prev, [hangout.id]: true }));
          try {
            await hangoutsService.requestJoin(hangout.id);
          } catch {
            setRequestedHangouts((prev) => ({ ...prev, [hangout.id]: false }));
          }
        }
      }
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading feed..." />;
  }

  return (
    <View style={styles.screen}>
      {/* Persistent Status Bar Spacer so content never scrolls under phone battery/wifi icons */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: Colors.surface,
          zIndex: 9999,
        }}
      />

      {/* Absolute sliding AppHeader */}
      <AppHeader
        translateY={headerTranslateY}
        onPressHeader={handleScrollToTop}
      />

      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 10) + 54 },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryContainer}
            progressViewOffset={Math.max(insets.top, 10) + 40}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Joined Communities (Instagram Stories style, 76x76, no yellow ring) */}
        <View style={styles.storiesSection}>
          {communities.length === 0 ? (
            <View style={styles.emptyStoryWrap}>
              <TouchableOpacity
                style={styles.singleExploreCircle}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/explore', params: { tab: 'communities' } })
                }
                activeOpacity={0.8}
              >
                <MaterialIcons name="add" size={32} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.storyName} numberOfLines={1}>
                Explore
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.storiesCarousel}
            >
              {communities.map((comm) => (
                <TouchableOpacity
                  key={comm.id}
                  style={styles.storyItem}
                  onPress={() => router.push(`/community/${comm.slug}`)}
                  activeOpacity={0.8}
                >
                  <View style={styles.storyRing}>
                    {comm.profile_picture_url ? (
                      <Image source={{ uri: comm.profile_picture_url }} style={styles.storyAvatar} />
                    ) : (
                      <View style={styles.storyAvatarFallback}>
                        <MaterialIcons name="groups" size={34} color={colors.primary} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.storyName} numberOfLines={1}>
                    {comm.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Section 2: Upcoming Events (strictly joined communities, white card, category pill, community name) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(tabs)/explore', params: { tab: 'events' } })}
              style={styles.seeAllRow}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAllText}>more</Text>
              <MaterialIcons name="chevron-right" size={16} color={colors.secondary} />
            </TouchableOpacity>
          </View>

          {events.length === 0 ? (
            <View style={styles.emptyFeedCard}>
              <MaterialIcons name="event" size={32} color={colors.tertiary} />
              <Text style={styles.emptyFeedTitle}>No upcoming events</Text>
              <Text style={styles.emptyFeedSubtitle}>
                Join communities to see their scheduled meetups and events here.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
            >
              {events.map((event) => {
                const cat = categorizeItemByDate(event);
                const categoryBadge = event.category || event.community?.category || 'Community';
                const commName = event.communityName || event.community?.name || 'Nexus Community';

                return (
                  <TouchableOpacity
                    key={event.id}
                    style={[styles.eventCard, cat.isPassed && styles.itemCardPassed]}
                    onPress={() => {
                      router.push({
                        pathname: '/event/[id]',
                        params: { id: event.id, slug: event.community?.slug || event.communitySlug },
                      } as any);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.eventCoverWrapper}>
                      <Image
                        source={{
                          uri:
                            (event as any).cover_image_url ||
                            event.coverImageUrl ||
                            'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=600',
                        }}
                        style={styles.eventCover}
                      />
                      <View style={styles.eventCategoryBadge}>
                        <Text style={styles.eventCategoryBadgeText} numberOfLines={1}>
                          {formatCategoryName(categoryBadge, true)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.eventBody}>
                      <View>
                        <Text style={styles.eventTitle} numberOfLines={1}>
                          {event.title}
                        </Text>
                        <Text style={styles.eventCommunityNameText} numberOfLines={1}>
                          {commName}
                        </Text>
                      </View>
                      <View style={styles.eventMetaRow}>
                        <View style={styles.metaItem}>
                          <MaterialIcons
                            name="calendar-today"
                            size={13}
                            color={cat.isPassed ? colors.tertiary : colors.primary}
                          />
                          <Text
                            style={[
                              styles.metaText,
                              cat.status === 'today' && { color: colors.primary, fontWeight: '700' },
                            ]}
                          >
                            {cat.dateText}
                          </Text>
                        </View>
                        <View style={styles.metaItem}>
                          <MaterialIcons name="group" size={13} color={colors.secondary} />
                          <Text style={styles.metaTextSec}>
                            {`${event.participantsCount ?? event.participantCount ?? 0} ${cat.isPassed ? 'went' : 'going'}`}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Section 3: Hangouts Near You (Square cards, no "Open" pill, smart date ordering) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hangouts Near You</Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/hangouts')}
              style={styles.seeAllRow}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAllText}>more</Text>
              <MaterialIcons name="chevron-right" size={16} color={colors.secondary} />
            </TouchableOpacity>
          </View>

          {hangouts.length === 0 ? (
            <View style={styles.emptyFeedCard}>
              <MaterialIcons name="local-cafe" size={32} color={colors.tertiary} />
              <Text style={styles.emptyFeedTitle}>No hangouts active nearby</Text>
              <Text style={styles.emptyFeedSubtitle}>
                Host a spontaneous meetup, coffee chat, or co-working session!
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => router.push('/new-hangout')}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyActionBtnText}>Host a Hangout</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
            >
              {hangouts.map((hangout: any) => {
                const cat = categorizeItemByDate(hangout);
                const isJoined =
                  joinedHangouts[hangout.id] !== undefined
                    ? joinedHangouts[hangout.id]
                    : Boolean(hangout.isParticipant);
                const isRequested =
                  !isJoined &&
                  (requestedHangouts[hangout.id] !== undefined
                    ? requestedHangouts[hangout.id]
                    : Boolean(
                        hangout.hasRequested ||
                          hangout.isRequested ||
                          (hangout as any).requestStatus === 'pending' ||
                          (hangout as any).userRequestStatus === 'pending'
                      ));
                const isOpen =
                  hangout.joinType === 'OPEN' ||
                  hangout.join_type === 'OPEN' ||
                  hangout.joinType === 'open' ||
                  hangout.join_type === 'open';

                return (
                  <TouchableOpacity
                    key={hangout.id}
                    style={[
                      styles.hangoutCardSquare,
                      cat.isPassed && styles.itemCardPassed,
                      cat.isPassed && { elevation: 0, shadowOpacity: 0, shadowColor: 'transparent' },
                    ]}
                    onPress={() => {
                      router.push(`/hangout/${hangout.id}`);
                    }}
                    activeOpacity={0.85}
                  >
                    <View>
                      <View style={styles.hangoutHeader}>
                        <View style={styles.hangoutCreatorRow}>
                          {hangout.creatorAvatar || hangout.creator?.profile_picture_url ? (
                            <Image
                              source={{
                                uri: hangout.creatorAvatar || hangout.creator?.profile_picture_url,
                              }}
                              style={styles.hangoutCreatorAvatar}
                            />
                          ) : (
                            <View style={styles.hangoutAvatarFallback}>
                              <MaterialIcons name="person" size={15} color={colors.tertiary} />
                            </View>
                          )}
                          <Text style={styles.hangoutCreatorName} numberOfLines={1}>
                            {hangout.creatorName || hangout.creator?.first_name || 'Host'}
                          </Text>
                        </View>

                        <View style={[styles.hangoutPill, isOpen ? styles.hangoutPillOpen : styles.hangoutPillRequest]}>
                          {isOpen && <View style={styles.openDot} />}
                          <Text style={[styles.hangoutPillText, isOpen ? styles.hangoutPillOpenText : styles.hangoutPillRequestText]}>
                            {isOpen ? 'Open' : 'Request'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.hangoutTitle} numberOfLines={2}>
                        {hangout.title}
                      </Text>
                      <View style={styles.hangoutScheduleRow}>
                        <MaterialIcons
                          name="schedule"
                          size={13}
                          color={cat.status === 'today' ? colors.primary : colors.onSurfaceVariant}
                        />
                        <Text
                          style={[
                            styles.hangoutScheduleText,
                            cat.status === 'today' && { color: colors.primary, fontWeight: '700' },
                          ]}
                        >
                          {cat.dateText}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.hangoutFooter}>
                      {(() => {
                        const pCount = hangout.participantsCount ?? hangout.participantCount ?? 0;
                        const rawMax = hangout.maxParticipants ?? hangout.max_participants;
                        const hasLimit = typeof rawMax === 'number' && rawMax > 0;
                        return (
                          <Text style={styles.hangoutSpotsText}>
                            {hangout.spotsText || (hasLimit ? `${pCount}/${rawMax} spots` : `${pCount} going`)}
                          </Text>
                        );
                      })()}
                      <TouchableOpacity
                        style={[
                          styles.hangoutActionIconBtn,
                          cat.isPassed
                            ? styles.hangoutActionIconBtnPassed
                            : isJoined
                            ? styles.hangoutIconBtnJoined
                            : isRequested
                            ? styles.hangoutIconBtnRequested
                            : isOpen
                            ? styles.hangoutIconBtnOpen
                            : styles.hangoutIconBtnRequest,
                        ]}
                        onPress={(e) => handleToggleHangoutJoin(e, hangout)}
                        disabled={cat.isPassed}
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
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Section 4: What people are saying (swiping right-to-left switches to Explore tab) */}
        <View style={styles.section} {...postsPanResponder.panHandlers}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons
                name="trending-up"
                size={22}
                color={colors.primaryContainer}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.sectionTitle}>What people are saying</Text>
            </View>
          </View>

          {posts.length === 0 ? (
            <View style={styles.emptyFeedCard}>
              <MaterialIcons name="forum" size={32} color={colors.tertiary} />
              <Text style={styles.emptyFeedTitle}>No discussions yet</Text>
              <Text style={styles.emptyFeedSubtitle}>
                Join a community to share your thoughts and participate in discussions.
              </Text>
            </View>
          ) : (
            <View style={styles.discussionsList}>
              {posts.map((post: any) => (
                <FeedDiscussionCard
                  key={post.id}
                  post={post}
                  isLiked={globalLiked[post.id] ?? likedPosts[post.id]}
                  isSaved={globalSaved[post.id] ?? savedPosts[post.id]}
                  onToggleLike={handleToggleLike}
                  onToggleSave={handleToggleSave}
                  onPressPost={(id) => router.push(`/post/${id}`)}
                  onPressCommunity={(slug) => router.push(`/community/${slug}`)}
                />
              ))}
            </View>
          )}
        </View>
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
    container: {
      flex: 1,
    },
    content: {
      paddingBottom: 40,
    },
    section: {
      marginTop: Spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sectionTitle: {
      ...Typography.headlineSm,
      color: colors.onSurface,
    },
    seeAllRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    seeAllText: {
      ...Typography.labelMd,
      color: colors.secondary,
    },
    carousel: {
      paddingHorizontal: Spacing.md,
      gap: 12,
    },

    // Section 1: Communities (Stories) — Enlarged 76x76, no yellow ring
    storiesSection: {
      paddingTop: Spacing.xs,
      paddingBottom: Spacing.xs,
    },
    storiesCarousel: {
      paddingHorizontal: Spacing.md,
      gap: 16,
      alignItems: 'center',
    },
    storyItem: {
      alignItems: 'center',
      width: 82,
    },
    storyRing: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
    },
    storyAvatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
    },
    storyAvatarFallback: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: isDark ? 'rgba(232, 167, 54, 0.22)' : 'rgba(232, 167, 54, 0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    storyName: {
      ...Typography.captionSm,
      color: colors.onSurface,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 6,
      width: 82,
    },
    emptyStoryWrap: {
      paddingHorizontal: Spacing.md,
      alignItems: 'flex-start',
    },
    singleExploreCircle: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },

    // Section 2: Events — Dynamic card background, category badge, community name beneath title
    eventCard: {
      width: 260,
      height: 205,
      backgroundColor: isDark ? colors.surfaceContainer : '#ffffff',
      borderRadius: BorderRadius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...Shadows.sm,
    },
    eventCoverWrapper: {
      height: 104,
      width: '100%',
      position: 'relative',
    },
    eventCover: {
      width: '100%',
      height: '100%',
    },
    eventCategoryBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: isDark ? 'rgba(42, 39, 37, 0.94)' : 'rgba(252, 249, 248, 0.94)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: BorderRadius.md,
      ...Shadows.sm,
    },
    eventCategoryBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.onSurface,
    },
    eventBody: {
      padding: Spacing.sm,
      flex: 1,
      justifyContent: 'space-between',
    },
    eventTitle: {
      ...Typography.labelLg,
      color: colors.onSurface,
      fontWeight: '700',
    },
    eventCommunityNameText: {
      ...Typography.captionSm,
      color: colors.tertiary,
      marginTop: 1,
    },
    eventMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      ...Typography.captionMd,
      color: colors.onSurfaceVariant,
    },
    metaTextSec: {
      ...Typography.captionMd,
      color: colors.secondary,
      fontWeight: '600',
    },

    // Section 3: Hangouts — Square cards (~180x180)
    hangoutCardSquare: {
      width: 180,
      height: 180,
      backgroundColor: isDark ? colors.surfaceContainer : colors.tertiaryFixed,
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...Shadows.sm,
    },
    hangoutHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    hangoutCreatorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    hangoutCreatorAvatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
    },
    hangoutAvatarFallback: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hangoutCreatorName: {
      ...Typography.captionSm,
      color: colors.tertiary,
      fontWeight: '600',
    },
    hangoutPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    hangoutPillOpen: {
      backgroundColor: isDark ? colors.surfaceContainerHigh : colors.surface,
      ...Shadows.sm,
    },
    hangoutPillRequest: {
      backgroundColor: colors.secondaryFixed,
    },
    openDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#059669',
    },
    hangoutPillText: {
      fontSize: 10,
      fontWeight: '700',
    },
    hangoutPillOpenText: {
      color: colors.onSurface,
    },
    hangoutPillRequestText: {
      color: colors.secondary,
    },
    hangoutTitle: {
      ...Typography.labelMd,
      color: colors.onSurface,
      fontWeight: '700',
    },
    hangoutScheduleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    hangoutScheduleText: {
      ...Typography.captionSm,
      color: colors.onSurfaceVariant,
    },
    hangoutFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 4,
    },
    hangoutSpotsText: {
      ...Typography.captionSm,
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
    hangoutActionIconBtnPassed: {
      elevation: 0,
      shadowOpacity: 0,
      shadowColor: 'transparent',
      backgroundColor: isDark ? '#33302c' : '#e2e8f0',
      opacity: 0.5,
      borderWidth: 0,
      borderColor: 'transparent',
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
      backgroundColor: isDark ? '#451a03' : '#fef3c7',
      borderWidth: 1.5,
      borderColor: '#f59e0b',
    },
    hangoutIconBtnJoined: {
      backgroundColor: '#059669',
      borderWidth: 0,
      borderColor: 'transparent',
    },
    raisingHandContainer: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    raisingHandPlusBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
    },

    // Passed / Grayed-out state
    itemCardPassed: {
      opacity: 0.45,
    },

    // Section 4: Discussions
    discussionsList: {
      paddingHorizontal: Spacing.md,
      gap: 12,
    },
    discussionCard: {
      backgroundColor: isDark ? colors.surfaceContainer : colors.tertiaryFixed,
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...Shadows.sm,
    },
    postCommunityHeader: {
      ...Typography.captionSm,
      color: colors.primary,
      fontWeight: '700',
      marginBottom: 2,
      letterSpacing: 0.3,
    },
    postAuthorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    authorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    authorAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    authorAvatarFallback: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    authorName: {
      ...Typography.labelMd,
      color: colors.onSurface,
      fontWeight: '600',
    },
    postTagsWrapper: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      maxWidth: '52%',
      maxHeight: 46,
      gap: 4,
      overflow: 'hidden',
    },
    postTagBadge: {
      backgroundColor: isDark ? 'rgba(232, 167, 54, 0.22)' : 'rgba(232, 167, 54, 0.12)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    postTagBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.primary,
    },
    postTitle: {
      ...Typography.labelLg,
      color: colors.onSurface,
      fontWeight: '700',
    },
    postContent: {
      ...Typography.bodyMd,
      color: colors.onSurfaceVariant,
      lineHeight: 20,
      marginTop: 2,
    },
    postActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(105, 92, 80, 0.15)',
    },
    postActionGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    iconCounter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    counterText: {
      ...Typography.captionMd,
      color: colors.tertiary,
    },
    iconOnly: {
      padding: 2,
    },
    postTimestampBelow: {
      fontSize: 11,
      color: colors.tertiary,
      marginTop: 2,
    },
    emptyFeedCard: {
      marginHorizontal: Spacing.md,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.md,
      backgroundColor: isDark ? colors.surfaceContainer : colors.tertiaryFixed,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    emptyFeedTitle: {
      ...Typography.labelLg,
      color: colors.onSurface,
      fontWeight: '700',
      marginTop: 4,
    },
    emptyFeedSubtitle: {
      ...Typography.captionMd,
      color: colors.tertiary,
      textAlign: 'center',
      maxWidth: 280,
    },
    emptyActionBtn: {
      marginTop: 8,
      backgroundColor: colors.primaryContainer,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: BorderRadius.full,
    },
    emptyActionBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.onPrimaryContainer,
    },
  });
