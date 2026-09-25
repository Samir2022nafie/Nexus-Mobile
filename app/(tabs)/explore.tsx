/**
 * Explore Screen — Matches Stitch screen_9, screen_10, screen_11
 * Sub-tabs: Communities | Events | Posts
 * Features:
 * - Horizontal swipe paging between Communities, Events, and Posts tabs
 * - Tap Explore tab icon scrolls current active tab to top
 * - Search decoupling: search filters across Communities, Events, and Posts reliably
 * - Sub-tab selector with active gold indicator
 * - Tactile search bar with magnifying glass
 * - Horizontal category chips (All, Outdoor, Sports, Art, Tech, Music, Food)
 * - 3 distinct feed designs for Communities, Events, and Posts
 * - Fully synchronized likes, saves, and comments via PostStateContext
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { useSafeRouter } from '../../src/hooks/useSafeRouter';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../../src/constants/theme';
import { useTheme, useThemedStyles } from '../../src/context/ThemeContext';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { communitiesService } from '../../src/services/communities';
import { postsService } from '../../src/services/posts';
import { eventsService } from '../../src/services/events';
import { Community } from '../../src/types';
import { BACKEND_CATEGORIES, formatCategoryName } from '../../src/utils/categories';
import { categorizeItemByDate, sortItemsByDate } from '../../src/utils/dateUtils';
import { useTabBarVisibility } from '../../src/context/TabBarVisibilityContext';
import { usePostState } from '../../src/context/PostStateContext';
import { FeedDiscussionCard } from '../../src/components/FeedDiscussionCard';

const SUB_TABS = ['Communities', 'Events', 'Posts'] as const;
type SubTab = typeof SUB_TABS[number];

const CATEGORIES = ['All', ...BACKEND_CATEGORIES.map((c) => c.label)];

export default function ExploreScreen() {
  const router = useSafeRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);
  const params = useLocalSearchParams<{ tab?: string }>();

  const [activeTab, setActiveTab] = useState<SubTab>(
    params.tab === 'events' ? 'Events' : params.tab === 'posts' || params.tab === 'hangouts' ? 'Posts' : 'Communities'
  );
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [communities, setCommunities] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({});
  const [savedEvents, setSavedEvents] = useState<Record<string, boolean>>({});
  const [joinedCommunities, setJoinedCommunities] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const {
    likedPosts: globalLiked,
    savedPosts: globalSaved,
    toggleLike,
    toggleSave,
  } = usePostState();

  const { handleTabBarScroll } = useTabBarVisibility();
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(Date.now());

  const scrollX = useRef(new Animated.Value(0)).current;
  const horizontalScrollRef = useRef<any>(null);
  const communitiesScrollRef = useRef<ScrollView>(null);
  const eventsScrollRef = useRef<ScrollView>(null);
  const postsScrollRef = useRef<ScrollView>(null);

  // Synchronized Tab Indicator Geometry
  const trackWidth = screenWidth - Spacing.md * 2;
  const tabSlotWidth = (trackWidth - 8) / 3;
  const indicatorWidth = tabSlotWidth * 0.7;
  const indicatorOffset = (tabSlotWidth - indicatorWidth) / 2;

  const indicatorTranslateX = scrollX.interpolate({
    inputRange: [0, screenWidth, 2 * screenWidth],
    outputRange: [
      4 + indicatorOffset,
      4 + tabSlotWidth + indicatorOffset,
      4 + 2 * tabSlotWidth + indicatorOffset,
    ],
    extrapolate: 'clamp',
  });

  const pillTranslateX = scrollX.interpolate({
    inputRange: [0, screenWidth, 2 * screenWidth],
    outputRange: [4, 4 + tabSlotWidth, 4 + 2 * tabSlotWidth],
    extrapolate: 'clamp',
  });

  const onExploreScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const currentTime = Date.now();
    const dy = currentY - lastScrollY.current;
    const dt = Math.max(1, currentTime - lastScrollTime.current);
    const velocityY = dy / dt;

    lastScrollY.current = currentY;
    lastScrollTime.current = currentTime;

    handleTabBarScroll(dy, velocityY, currentY);
  };

  const handleSelectTab = (tab: SubTab) => {
    setActiveTab(tab);
    const index = SUB_TABS.indexOf(tab);
    if (index !== -1) {
      horizontalScrollRef.current?.scrollTo({ x: index * screenWidth, animated: true });
    }
  };

  // Scroll current active tab to top on navigation tabPress
  useEffect(() => {
    const unsubscribe = (navigation as any)?.addListener?.('tabPress', () => {
      if ((navigation as any)?.isFocused?.()) {
        if (activeTab === 'Communities') {
          communitiesScrollRef.current?.scrollTo({ y: 0, animated: true });
        } else if (activeTab === 'Events') {
          eventsScrollRef.current?.scrollTo({ y: 0, animated: true });
        } else {
          postsScrollRef.current?.scrollTo({ y: 0, animated: true });
        }
      }
    });
    return unsubscribe;
  }, [navigation, activeTab]);

  useEffect(() => {
    if (!params.tab) return;
    const targetTab: SubTab =
      params.tab === 'events'
        ? 'Events'
        : params.tab === 'posts' || params.tab === 'hangouts'
        ? 'Posts'
        : 'Communities';
    setActiveTab(targetTab);
    const idx = SUB_TABS.indexOf(targetTab);
    if (idx !== -1) {
      scrollX.setValue(idx * screenWidth);
      horizontalScrollRef.current?.scrollTo({ x: idx * screenWidth, animated: false });
      setTimeout(() => {
        horizontalScrollRef.current?.scrollTo({ x: idx * screenWidth, animated: false });
      }, 50);
    }
  }, [params.tab, screenWidth]);

  // Decoupled fetch: fetch base communities, events, and posts without wiping on query
  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh && communities.length === 0) {
        setLoading(true);
      }
      const commData = await communitiesService.list({ limit: 50 }).catch(() => []);
      const realComms = commData || [];
      setCommunities(realComms);

      if (realComms.length > 0) {
        try {
          const evPromises = realComms.slice(0, 12).map((c) =>
            eventsService.listByCommunity(c.slug, { limit: 12 }).then((evs) =>
              (Array.isArray(evs) ? evs : (evs as any)?.data || []).map((e: any) => ({
                ...e,
                community: c,
                communityName: c.name,
                communityCategory: c.category?.name || c.category,
                communitySlug: c.slug,
                communityAvatar:
                  c.profile_picture_url ||
                  (c as any).profilePictureUrl ||
                  (c as any).cover_image_url ||
                  (c as any).coverImageUrl ||
                  (c as any).banner_url,
              }))
            ).catch(() => [])
          );

          const postPromises = realComms.slice(0, 12).map((c) =>
            postsService.listByCommmunity(c.slug, { limit: 12 }).then((pList) =>
              (Array.isArray(pList) ? pList : (pList as any)?.data || []).map((p: any) => ({
                ...p,
                community: c,
                communityName: c.name,
                communityCategory: c.category?.name || c.category,
                communitySlug: c.slug,
              }))
            ).catch(() => [])
          );

          const [evResults, postResults] = await Promise.all([
            Promise.all(evPromises),
            Promise.all(postPromises),
          ]);

          setEvents(evResults.flat());
          const flatPosts = postResults.flat();
          setPosts(flatPosts);
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
      setEvents([]);
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [communities.length]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const toggleCommunityJoin = async (comm: any) => {
    const currentlyJoined =
      joinedCommunities[comm.id] !== undefined
        ? joinedCommunities[comm.id]
        : Boolean(comm.isMember);
    const nextJoined = !currentlyJoined;

    setJoinedCommunities((prev) => ({ ...prev, [comm.id]: nextJoined }));

    setCommunities((prev) =>
      prev.map((c) =>
        c.id === comm.id
          ? {
              ...c,
              memberCount: Math.max(0, (c.memberCount || 0) + (nextJoined ? 1 : -1)),
            }
          : c
      )
    );

    try {
      if (nextJoined) {
        await communitiesService.join(comm.slug);
      } else {
        await communitiesService.leave(comm.slug);
      }
    } catch {
      // Revert on failure
      setJoinedCommunities((prev) => ({ ...prev, [comm.id]: currentlyJoined }));
      setCommunities((prev) =>
        prev.map((c) =>
          c.id === comm.id
            ? {
                ...c,
                memberCount: Math.max(0, (c.memberCount || 0) + (currentlyJoined ? 1 : -1)),
              }
            : c
        )
      );
    }
  };

  const toggleEventSave = (eventId: string) => {
    setSavedEvents((prev) => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const handleToggleLike = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    const initialLiked = Boolean(post?.hasReacted || post?.isLiked || post?.has_reacted);
    const currentlyLiked = globalLiked[postId] ?? likedPosts[postId] ?? initialLiked;
    const baseLikes = post?.likesCount ?? post?.reactionCount ?? 0;
    const nextLiked = !currentlyLiked;

    setLikedPosts((prev) => ({ ...prev, [postId]: nextLiked }));
    try {
      await toggleLike(postId, currentlyLiked, baseLikes);
    } catch {
      setLikedPosts((prev) => ({ ...prev, [postId]: currentlyLiked }));
    }
  };

  const handleToggleSave = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    const initialSaved = Boolean(post?.isSaved || post?.hasSaved || post?.is_saved);
    const currentlySaved = globalSaved[postId] ?? savedPosts[postId] ?? initialSaved;
    const nextSaved = !currentlySaved;

    setSavedPosts((prev) => ({ ...prev, [postId]: nextSaved }));
    try {
      await toggleSave(postId, currentlySaved);
    } catch {
      setSavedPosts((prev) => ({ ...prev, [postId]: currentlySaved }));
    }
  };

  // Memory filtering decoupled across all tabs
  const filteredCommunities = communities.filter((comm) => {
    if (selectedCategory !== 'All') {
      const shortCat = formatCategoryName(comm.category, true);
      if (shortCat.toLowerCase() !== selectedCategory.toLowerCase()) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const nameMatch = comm.name?.toLowerCase().includes(q);
      const descMatch = comm.description?.toLowerCase().includes(q);
      const catMatch = formatCategoryName(comm.category, false).toLowerCase().includes(q);
      return Boolean(nameMatch || descMatch || catMatch);
    }
    return true;
  });

  const filteredEvents = events.filter((ev) => {
    if (selectedCategory !== 'All') {
      const cat = ev.community?.category || ev.category;
      const shortCat = formatCategoryName(cat, true);
      if (shortCat.toLowerCase() !== selectedCategory.toLowerCase()) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const titleMatch = ev.title?.toLowerCase().includes(q);
      const descMatch = ev.description?.toLowerCase().includes(q);
      const locMatch = (ev.location?.place_name || ev.locationName || '').toLowerCase().includes(q);
      const commMatch = (ev.communityName || ev.community?.name || '').toLowerCase().includes(q);
      return Boolean(titleMatch || descMatch || locMatch || commMatch);
    }
    return true;
  });

  const filteredPosts = posts.filter((p) => {
    if (selectedCategory !== 'All') {
      const cat = p.community?.category?.name || p.community?.category || p.communityCategory;
      const shortCat = formatCategoryName(cat, true);
      if (shortCat.toLowerCase() !== selectedCategory.toLowerCase()) return false;
    }
    if (search.trim()) {
      const query = search.toLowerCase();
      const titleMatch = p.title?.toLowerCase().includes(query);
      const contentMatch = p.content?.toLowerCase().includes(query);
      const authorMatch = (p.authorName || `${p.author?.first_name || ''} ${p.author?.last_name || ''}`).toLowerCase().includes(query);
      const commMatch = (p.communityName || p.community?.name || '').toLowerCase().includes(query);
      const tagMatch = Array.isArray(p.tags) && p.tags.some((t: any) => {
        const name = typeof t === 'string' ? t : (t?.name || t?.tag?.name || '');
        return name.toLowerCase().includes(query);
      });
      return Boolean(titleMatch || contentMatch || authorMatch || commMatch || tagMatch);
    }
    return true;
  });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Sub-tab Navigation Row */}
      <View style={styles.subTabRow}>
        {/* Animated Active Pill Backdrop */}
        <Animated.View
          style={[
            styles.animatedActivePill,
            {
              width: tabSlotWidth,
              transform: [{ translateX: pillTranslateX }],
            },
          ]}
        />

        {/* Animated Underline Bar */}
        <Animated.View
          style={[
            styles.animatedIndicatorBar,
            {
              width: indicatorWidth,
              transform: [{ translateX: indicatorTranslateX }],
            },
          ]}
        />

        {SUB_TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={styles.subTabButton}
              onPress={() => handleSelectTab(tab)}
              activeOpacity={0.75}
            >
              <Text style={[styles.subTabText, isActive && styles.subTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={colors.tertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
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

      {/* Horizontal Swiping Pager */}
      {loading && communities.length === 0 ? (
        <LoadingSpinner message="Discovering..." />
      ) : (
        <Animated.ScrollView
          ref={horizontalScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.pager}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
            if (SUB_TABS[idx] && SUB_TABS[idx] !== activeTab) {
              setActiveTab(SUB_TABS[idx]);
            }
          }}
        >
          {/* Page 0: Communities */}
          <ScrollView
            ref={communitiesScrollRef}
            style={{ width: screenWidth }}
            contentContainerStyle={styles.content}
            onScroll={onExploreScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primaryContainer}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.cardsFeed}>
              {filteredCommunities.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="groups" size={48} color={colors.tertiary} />
                  <Text style={styles.emptyTitle}>No communities found</Text>
                  <Text style={styles.emptySubtitle}>
                    {selectedCategory !== 'All'
                      ? `No communities created under "${selectedCategory}" yet.`
                      : 'No communities found matching your search.'}
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => router.push('/new-community')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emptyActionBtnText}>Create Community</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredCommunities.map((comm) => {
                  const isJoined =
                    joinedCommunities[comm.id] !== undefined
                      ? joinedCommunities[comm.id]
                      : Boolean(comm.isMember);
                  const catDisplay = formatCategoryName(comm.category, true);
                  return (
                    <TouchableOpacity
                      key={comm.id}
                      style={styles.communityCard}
                      onPress={() => router.push(`/community/${comm.slug}`)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.commTopRow}>
                        <View style={styles.commMetaGroup}>
                          {comm.profile_picture_url || comm.profilePictureUrl || comm.cover_image_url || comm.coverImageUrl || comm.banner_url || comm.bannerUrl ? (
                            <Image
                              source={{
                                uri:
                                  comm.profile_picture_url ||
                                  comm.profilePictureUrl ||
                                  comm.cover_image_url ||
                                  comm.coverImageUrl ||
                                  comm.banner_url ||
                                  comm.bannerUrl,
                              }}
                              style={styles.commAvatar}
                            />
                          ) : (
                            <View style={styles.commAvatarFallback}>
                              <MaterialIcons name="groups" size={24} color={colors.primary} />
                            </View>
                          )}
                          <View style={styles.commTextGroup}>
                            <Text style={styles.commName} numberOfLines={1}>
                              {comm.name}
                            </Text>
                            <View style={styles.commBadgeRow}>
                              <View style={styles.commCategoryPill}>
                                <Text style={styles.commCategoryText}>{catDisplay}</Text>
                              </View>
                              <Text style={styles.commMemberCount}>
                                {comm.memberCount || comm.membersCount || 1} members
                              </Text>
                            </View>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.joinToggleBtn,
                            isJoined ? styles.btnJoined : styles.btnNotJoined,
                          ]}
                          onPress={() => toggleCommunityJoin(comm)}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons
                            name={isJoined ? 'check' : 'add'}
                            size={16}
                            color={isJoined ? colors.primaryContainer : colors.onPrimaryContainer}
                          />
                          <Text
                            style={[
                              styles.joinToggleText,
                              isJoined ? styles.btnJoinedText : styles.btnNotJoinedText,
                            ]}
                          >
                            {isJoined ? 'Joined' : 'Join'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {comm.description ? (
                        <Text style={styles.commDescription} numberOfLines={2}>
                          {comm.description}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>

          {/* Page 1: Events */}
          <ScrollView
            ref={eventsScrollRef}
            style={{ width: screenWidth }}
            contentContainerStyle={styles.content}
            onScroll={onExploreScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primaryContainer}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.cardsFeed}>
              {filteredEvents.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="event" size={48} color={colors.tertiary} />
                  <Text style={styles.emptyTitle}>No events found</Text>
                  <Text style={styles.emptySubtitle}>
                    {selectedCategory !== 'All'
                      ? `No events scheduled under "${selectedCategory}" yet.`
                      : 'No events matching your search.'}
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => router.push('/new-event')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emptyActionBtnText}>Plan an Event</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                sortItemsByDate(filteredEvents).map((event: any) => {
                  const dateInfo = categorizeItemByDate(event);
                  const isSaved = savedEvents[event.id] ?? false;
                  return (
                    <TouchableOpacity
                      key={event.id}
                      style={[styles.eventCard, dateInfo.isPassed && styles.itemCardPassed]}
                      onPress={() => router.push(`/event/${event.id}`)}
                      activeOpacity={dateInfo.isPassed ? 0.38 : 0.85}
                    >
                      <View style={styles.eventCoverWrapper}>
                        {(() => {
                          const coverUrl =
                            event.cover_image_url ||
                            event.coverImageUrl ||
                            event.community?.banner_url ||
                            event.community?.bannerUrl ||
                            event.community?.cover_image_url ||
                            event.community?.coverImageUrl ||
                            'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800';
                          return (
                            <Image
                              source={{ uri: coverUrl }}
                              style={styles.eventCover}
                            />
                          );
                        })()}
                        <View style={styles.eventAccessBadge}>
                          <View
                            style={[
                              styles.accessDot,
                              {
                                backgroundColor:
                                  event.isPublic !== false ? colors.success : colors.secondary,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.accessText,
                              { color: event.isPublic !== false ? colors.success : colors.secondary },
                            ]}
                          >
                            {event.isPublic !== false ? 'Public' : 'Community'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.eventContent}>
                        {(() => {
                          const commAvatar =
                            event.communityAvatar ||
                            event.community?.profile_picture_url ||
                            event.community?.profilePictureUrl ||
                            event.community?.cover_image_url ||
                            event.community?.coverImageUrl ||
                            event.community?.banner_url ||
                            event.community?.bannerUrl;
                          const commName = event.communityName || event.community?.name || 'Nexus Community';
                          return (
                            <View style={styles.eventCommunityRow}>
                              {commAvatar ? (
                                <Image source={{ uri: commAvatar }} style={styles.eventCommunityAvatar} />
                              ) : (
                                <View style={styles.eventCommunityAvatarFallback}>
                                  <MaterialIcons name="groups" size={14} color={colors.primary} />
                                </View>
                              )}
                              <Text style={styles.eventCommunityName} numberOfLines={1}>
                                {commName}
                              </Text>
                            </View>
                          );
                        })()}

                        <Text style={styles.eventTitle}>{event.title}</Text>
                        <Text style={[styles.eventDateTime, dateInfo.isPassed && { color: colors.outline }]}>
                          {dateInfo.dateText}
                        </Text>

                        {(event.location?.place_name || event.location) && (
                          <View style={styles.locationRow}>
                            <MaterialIcons name="location-on" size={16} color={colors.secondary} />
                            <Text style={styles.locationText} numberOfLines={1}>
                              {event.location?.place_name || event.location}
                            </Text>
                          </View>
                        )}

                        <View style={styles.eventBottomRow}>
                          <View style={styles.goingRow}>
                            <MaterialIcons name="group" size={18} color={colors.onSurfaceVariant} />
                            <Text style={styles.goingText}>
                              {`${event.participantsCount ?? event.participantCount ?? 0} ${dateInfo.isPassed ? 'went' : 'going'}`}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.bookmarkBtn}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              toggleEventSave(event.id);
                            }}
                            activeOpacity={0.7}
                          >
                            <MaterialIcons
                              name={isSaved ? 'bookmark' : 'bookmark-border'}
                              size={22}
                              color={isSaved ? colors.primaryContainer : colors.tertiary}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>

          {/* Page 2: Posts */}
          <ScrollView
            ref={postsScrollRef}
            style={{ width: screenWidth }}
            contentContainerStyle={styles.content}
            onScroll={onExploreScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primaryContainer}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.discussionsFeed}>
              {filteredPosts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="forum" size={48} color={colors.tertiary} />
                  <Text style={styles.emptyTitle}>No posts found</Text>
                  <Text style={styles.emptySubtitle}>
                    {selectedCategory !== 'All'
                      ? `No posts shared under "${selectedCategory}" yet.`
                      : search
                      ? `No posts matching "${search}".`
                      : 'No discussions found in the explore feed.'}
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => router.push('/new-post')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emptyActionBtnText}>Create Post</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredPosts.map((post: any) => (
                  <FeedDiscussionCard
                    key={post.id}
                    post={post}
                    isLiked={globalLiked[post.id] ?? likedPosts[post.id] ?? post.hasReacted}
                    isSaved={globalSaved[post.id] ?? savedPosts[post.id] ?? post.isSaved}
                    onToggleLike={handleToggleLike}
                    onToggleSave={handleToggleSave}
                    onPressPost={(id) => router.push(`/post/${id}`)}
                    onPressCommunity={(slug) => router.push(`/community/${slug}`)}
                  />
                ))
              )}
            </View>
          </ScrollView>
        </Animated.ScrollView>
      )}
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  pager: {
    flex: 1,
  },
  content: {
    paddingBottom: 60,
  },
  subTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? colors.surfaceContainerLow : '#F0ECE8',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    position: 'relative',
    height: 46,
  },
  animatedActivePill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: BorderRadius.lg,
    backgroundColor: isDark ? colors.surfaceContainerHigh : colors.surface,
    ...Shadows.sm,
  },
  animatedIndicatorBar: {
    position: 'absolute',
    bottom: 5,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primaryContainer,
    zIndex: 2,
  },
  subTabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  subTabText: {
    ...Typography.labelMd,
    color: colors.tertiary,
    fontWeight: '600',
  },
  subTabTextActive: {
    color: isDark ? '#feba48' : colors.primaryContainer,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    height: 44,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: Spacing.sm,
    ...Typography.bodyMd,
    color: colors.onSurface,
  },
  categoryChipsWrapper: {
    height: 48,
  },
  categoryScroll: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 8,
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
  cardsFeed: {
    paddingHorizontal: Spacing.md,
    gap: 12,
    marginTop: 6,
  },

  // Communities
  communityCard: {
    backgroundColor: colors.cardBg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  commTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  commMetaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  commAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainerHigh,
  },
  commAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(232, 167, 54, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commTextGroup: {
    flex: 1,
  },
  commName: {
    ...Typography.labelLg,
    color: colors.onSurface,
    fontWeight: '700',
  },
  commBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  commCategoryPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  commCategoryText: {
    ...Typography.captionSm,
    color: colors.onSurface,
    fontWeight: '600',
  },
  commMemberCount: {
    ...Typography.captionSm,
    color: colors.tertiary,
  },
  joinToggleBtn: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnJoined: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  btnNotJoined: {
    backgroundColor: colors.primaryContainer,
  },
  joinToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  btnJoinedText: {
    color: colors.primaryContainer,
  },
  btnNotJoinedText: {
    color: colors.onPrimaryContainer,
  },
  commDescription: {
    ...Typography.bodyMd,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },

  // Events
  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  itemCardPassed: {
    opacity: 0.48,
  },
  eventCoverWrapper: {
    height: 160,
    width: '100%',
    position: 'relative',
  },
  eventCover: {
    width: '100%',
    height: '100%',
  },
  eventAccessBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  accessDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  accessText: {
    fontSize: 11,
    fontWeight: '700',
  },
  eventContent: {
    padding: 14,
  },
  eventCommunityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  eventCommunityAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainerHigh,
  },
  eventCommunityAvatarFallback: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(232, 167, 54, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCommunityName: {
    ...Typography.labelMd,
    color: colors.secondary,
  },
  eventTitle: {
    ...Typography.labelLg,
    color: colors.onSurface,
    fontWeight: '700',
    marginBottom: 4,
  },
  eventDateTime: {
    ...Typography.captionMd,
    color: colors.tertiary,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  locationText: {
    ...Typography.captionMd,
    color: colors.secondary,
  },
  eventBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(105, 92, 80, 0.15)',
  },
  goingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goingText: {
    ...Typography.captionMd,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  bookmarkBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Posts Feed — Matches Home Feed "What people are saying"
  discussionsFeed: {
    paddingHorizontal: Spacing.md,
    gap: 12,
  },
  emptyContainer: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    backgroundColor: colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.headlineSm,
    fontSize: 18,
    color: colors.onSurface,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySubtitle: {
    ...Typography.bodyMd,
    color: colors.tertiary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  emptyActionBtn: {
    marginTop: 8,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  emptyActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
});
