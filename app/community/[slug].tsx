/**
 * Community Detail Screen — Matches Stitch screen_12 to screen_15
 * Overhauled with:
 * 1. Narrower cover banner (height ~125), removed share button.
 * 2. Row 1: Category pill, Public/Private badge, Member count.
 * 3. Row 2: Bio max 2 lines with '...', tap text directly to expand/collapse (no arrows).
 * 4. Row 3: 'Rules of this Community' header with right chevron, rules rendered as horizontal rounded pills wrapping without breaking pills.
 * 5. Combined single feed: Community Events horizontal carousel with 'more' button (opens dedicated vertical search view) at top of body, Discussions vertical feed below.
 * 6. Removed 'What's on your mind?' button.
 * 7. Persistent bottom navigation bar with Add button passing community context (activeTab={null}).
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
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../../src/constants/theme';
import { useTheme, useThemedStyles } from '../../src/context/ThemeContext';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { AppBottomBar } from '../../src/components/navigation/AppBottomBar';
import { useTabBarVisibility } from '../../src/context/TabBarVisibilityContext';
import { communitiesService } from '../../src/services/communities';
import { postsService } from '../../src/services/posts';
import { eventsService } from '../../src/services/events';
import { Community, EventItem } from '../../src/types';
import { formatCategoryName } from '../../src/utils/categories';
import { categorizeItemByDate } from '../../src/utils/dateUtils';
import { FeedDiscussionCard } from '../../src/components/FeedDiscussionCard';
import { useAuth } from '../../src/context/AuthContext';

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

export default function CommunityDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);
  const { handleTabBarScroll, showTabBar } = useTabBarVisibility();

  useEffect(() => {
    showTabBar();
  }, [showTabBar]);

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

  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [descExpanded, setDescExpanded] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(true);

  // Dedicated vertical search view for all events
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [eventSearch, setEventSearch] = useState('');

  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);

  const fetchData = useCallback(async () => {
    if (!slug) return;
    try {
      const comm = await communitiesService.getBySlug(slug).catch(() => null);
      if (!comm) {
        setCommunity(null);
        return;
      }
      setCommunity(comm);

      const [postData, eventData] = await Promise.all([
        postsService.listByCommmunity(slug, { limit: 30 }).catch(() => []),
        eventsService.listByCommunity(slug, { limit: 30 }).catch(() => []),
      ]);
      const pList = postData || [];
      setPosts(pList);
      setEvents(eventData || []);
      const initLikes: Record<string, boolean> = {};
      const initSaves: Record<string, boolean> = {};
      pList.forEach((p: any) => {
        if (p.hasReacted || p.isLiked) initLikes[p.id] = true;
        if (p.isSaved || p.hasSaved) initSaves[p.id] = true;
      });
      setLikedPosts(initLikes);
      setSavedPosts(initSaves);
    } catch {
      setCommunity(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleJoinLeave = async () => {
    if (!community || !slug) return;
    setJoining(true);
    try {
      if (community.isMember) {
        if (community.myRole === 'owner') return;
        await communitiesService.leave(slug);
        setCommunity((prev) =>
          prev
            ? {
                ...prev,
                isMember: false,
                myRole: null,
                memberCount: Math.max(0, prev.memberCount - 1),
              }
            : prev
        );
      } else {
        await communitiesService.join(slug);
        setCommunity((prev) =>
          prev
            ? {
                ...prev,
                isMember: true,
                myRole: 'member',
                memberCount: prev.memberCount + 1,
              }
            : prev
        );
      }
    } catch {
      // Revert if error
    } finally {
      setJoining(false);
    }
  };

  const toggleLike = async (postId: string) => {
    const currentlyLiked = likedPosts[postId] ?? false;
    setLikedPosts((prev) => ({ ...prev, [postId]: !currentlyLiked }));
    try {
      const res = await postsService.toggleReaction(postId);
      if (res && typeof res.reacted === 'boolean') {
        setLikedPosts((prev) => ({ ...prev, [postId]: res.reacted }));
      }
    } catch {
      setLikedPosts((prev) => ({ ...prev, [postId]: currentlyLiked }));
    }
  };

  const toggleSave = async (postId: string) => {
    const currentlySaved = savedPosts[postId] ?? false;
    setSavedPosts((prev) => ({ ...prev, [postId]: !currentlySaved }));
    try {
      const res = await postsService.toggleSave(postId);
      if (res && typeof res.saved === 'boolean') {
        setSavedPosts((prev) => ({ ...prev, [postId]: res.saved }));
      }
    } catch {
      setSavedPosts((prev) => ({ ...prev, [postId]: currentlySaved }));
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;

  if (!community) {
    return (
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top + Spacing.xl,
            paddingHorizontal: Spacing.lg,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <View style={styles.notFoundIconBox}>
          <MaterialIcons name="groups" size={36} color={colors.primary} />
        </View>
        <Text style={styles.notFoundTitle}>Community not found</Text>
        <Text style={styles.notFoundSub}>
          This community does not exist or has been removed.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <MaterialIcons name="arrow-back" size={18} color={colors.onPrimaryContainer} />
          <Text style={styles.backButtonText}>Back to Communities</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const catDisplay = formatCategoryName(community.category, true);

  // Parse real rules from database
  const rawRules = (community as any).rules;
  let rulesList: string[] = [];
  if (Array.isArray(rawRules)) {
    rulesList = rawRules.map((r: any) => (typeof r === 'string' ? r : r.rule || r.text || '')).filter(Boolean);
  } else if (typeof rawRules === 'string' && rawRules.trim()) {
    try {
      const json = JSON.parse(rawRules);
      if (Array.isArray(json)) {
        rulesList = json.map((r: any) => (typeof r === 'string' ? r : r.rule || r.text || '')).filter(Boolean);
      } else {
        rulesList = rawRules.split('\n').map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      rulesList = rawRules.split('\n').map((s) => s.trim()).filter(Boolean);
    }
  }

  // If user tapped 'more' on Events, show dedicated vertical search view
  if (showAllEvents) {
    const filteredEvents = events.filter((ev) => {
      if (!eventSearch.trim()) return true;
      const q = eventSearch.toLowerCase();
      return (
        ev.title?.toLowerCase().includes(q) ||
        ev.description?.toLowerCase().includes(q)
      );
    });

    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* Search View Top Bar */}
        <View style={styles.searchHeader}>
          <TouchableOpacity
            onPress={() => setShowAllEvents(false)}
            style={styles.backIconButton}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.searchHeaderTitle}>Community Events</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Input Box */}
        <View style={styles.eventSearchBox}>
          <MaterialIcons name="search" size={20} color={colors.tertiary} />
          <TextInput
            style={styles.eventSearchInput}
            placeholder="Search events..."
            placeholderTextColor={colors.tertiary}
            value={eventSearch}
            onChangeText={setEventSearch}
            returnKeyType="search"
          />
          {eventSearch ? (
            <TouchableOpacity onPress={() => setEventSearch('')}>
              <MaterialIcons name="close" size={18} color={colors.tertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Events List */}
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.allEventsContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {filteredEvents.length === 0 ? (
            <View style={styles.emptyEventsBox}>
              <MaterialIcons name="event-busy" size={40} color={colors.tertiary} />
              <Text style={styles.emptyFeedTitle}>No events found</Text>
              <Text style={styles.emptyFeedSubtitle}>
                Try adjusting your search terms or check back later.
              </Text>
            </View>
          ) : (
            filteredEvents.map((ev) => {
              const cat = categorizeItemByDate(ev);
              return (
                <TouchableOpacity
                  key={ev.id}
                  style={[styles.verticalEventCard, cat.isPassed && styles.itemCardPassed]}
                  onPress={() =>
                    router.push({
                      pathname: '/event/[id]',
                      params: { id: ev.id, slug: community.slug },
                    } as any)
                  }
                  activeOpacity={cat.isPassed ? 0.38 : 0.85}
                >
                <Image
                  source={{
                    uri:
                      (ev as any).cover_image_url ||
                      ev.coverImageUrl ||
                      'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=600',
                  }}
                  style={styles.verticalEventCover}
                />
                <View style={styles.verticalEventBody}>
                  <Text style={styles.verticalEventTitle} numberOfLines={1}>
                    {ev.title}
                  </Text>
                  <Text style={styles.verticalEventDesc} numberOfLines={2}>
                    {ev.description || 'Community gathering'}
                  </Text>
                  <View style={styles.verticalEventMeta}>
                    <View style={styles.metaItem}>
                      <MaterialIcons name="calendar-today" size={14} color={colors.primary} />
                      <Text style={styles.metaText}>
                        {(ev as any).starts_at
                          ? new Date((ev as any).starts_at).toLocaleDateString()
                          : 'Upcoming'}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <MaterialIcons name="group" size={14} color={colors.secondary} />
                      <Text style={styles.metaTextSec}>
                        {(() => {
                          const evDate = (ev as any).ends_at || (ev as any).endsAt || (ev as any).starts_at || (ev as any).startsAt;
                          const isPassed = evDate ? new Date(evDate) < new Date() : false;
                          return `${ev.participantsCount || 0} ${isPassed ? 'went' : 'going'}`;
                        })()}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        </ScrollView>

        <AppBottomBar
          activeTab={null}
          communityContext={{
            id: community.id,
            slug: community.slug,
            name: community.name,
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primaryContainer]}
            tintColor={colors.primaryContainer}
          />
        }
      >
        {/* Narrower Cover Hero Banner (~125 height), no share button */}
        <View style={styles.heroCard}>
          <Image
            source={{
              uri:
                community.banner_url ||
                'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
            }}
            style={styles.heroBanner}
          />
          <View style={styles.heroOverlay} />

          {/* Top Actions Row: Back Button & Admin Edit */}
          <View style={[styles.coverNavRow, { top: insets.top + 6 }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.navCircleBtn}
              activeOpacity={0.8}
            >
              <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
            </TouchableOpacity>

            {Boolean(
              user?.id &&
                ((community as any)?.role === 'owner' ||
                  (community as any)?.role === 'admin' ||
                  (community as any)?.creatorId === user.id ||
                  (community as any)?.creator_id === user.id)
            ) && (
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/new-community', params: { slug: community.slug } })}
                style={styles.navCircleBtn}
                activeOpacity={0.8}
              >
                <MaterialIcons name="edit" size={20} color={colors.onSurface} />
              </TouchableOpacity>
            )}
          </View>

          {/* Profile & Info Overlay Section */}
          <View style={styles.heroInfoBlock}>
            {/* Avatar & Membership Button Row */}
            <View style={styles.avatarRow}>
              <View style={styles.avatarOverlapContainer}>
                {community.profile_picture_url ? (
                  <Image
                    source={{ uri: community.profile_picture_url }}
                    style={styles.communityAvatar}
                  />
                ) : (
                  <View style={styles.communityAvatarFallback}>
                    <MaterialIcons name="groups" size={32} color={colors.primary} />
                  </View>
                )}
                <View style={styles.onlineRing}>
                  <View style={styles.onlineDot} />
                </View>
              </View>

              {/* Membership State Action */}
              <TouchableOpacity
                style={[
                  styles.membershipBtn,
                  community.isMember ? styles.btnJoinedState : styles.btnJoinState,
                ]}
                onPress={handleJoinLeave}
                disabled={joining}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={community.isMember ? 'check' : 'add'}
                  size={18}
                  color={community.isMember ? '#2e7d32' : colors.onPrimaryContainer}
                />
                <Text
                  style={[
                    styles.membershipBtnText,
                    community.isMember ? styles.textJoinedState : styles.textJoinState,
                  ]}
                >
                  {community.isMember ? 'Joined' : 'Join'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Title */}
            <Text style={styles.communityTitle}>{community.name}</Text>

            {/* Row 1: Category pill, Public/Private badge, Member count */}
            <View style={styles.row1Badges}>
              <View style={styles.categoryPill}>
                <Text style={styles.categoryPillText} numberOfLines={1}>
                  {catDisplay}
                </Text>
              </View>
              <View style={styles.publicPill}>
                <View style={styles.publicDot} />
                <Text style={styles.publicPillText}>
                  {community.is_private ? 'Private' : 'Public'}
                </Text>
              </View>
              <View style={styles.memberCountRow}>
                <MaterialIcons name="group" size={14} color={colors.tertiary} />
                <Text style={styles.memberCountText}>
                  {community.memberCount || 0} members
                </Text>
              </View>
            </View>

            {/* Row 2: Bio max 2 lines with '...', tap text directly to expand/collapse (no arrows) */}
            <TouchableOpacity
              onPress={() => setDescExpanded(!descExpanded)}
              activeOpacity={0.85}
              style={styles.bioContainer}
            >
              <Text
                style={styles.descriptionText}
                numberOfLines={descExpanded ? undefined : 2}
              >
                {community.description || 'Welcome to this community! Join to engage with members.'}
              </Text>
            </TouchableOpacity>

            {/* Row 3: 'Rules of this Community' header with right chevron, rules pills wrapping horizontally */}
            <View style={styles.rulesSection}>
              <TouchableOpacity
                style={styles.rulesHeaderRow}
                onPress={() => setRulesExpanded(!rulesExpanded)}
                activeOpacity={0.7}
              >
                <View style={styles.rulesTitleGroup}>
                  <MaterialIcons name="gavel" size={16} color={colors.secondary} />
                  <Text style={styles.rulesHeaderText}>Rules of this Community</Text>
                </View>
                <MaterialIcons
                  name={rulesExpanded ? 'keyboard-arrow-down' : 'chevron-right'}
                  size={20}
                  color={colors.tertiary}
                />
              </TouchableOpacity>

              {rulesExpanded && (
                <View style={styles.rulesPillsWrap}>
                  {rulesList.length === 0 ? (
                    <Text style={styles.noRulesText}>
                      No specific rules posted for this community.
                    </Text>
                  ) : (
                    rulesList.map((rule, idx) => (
                      <View key={idx} style={styles.rulePill}>
                        <Text style={styles.rulePillText}>{rule}</Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Combined Single Feed */}
        <View style={styles.feedContainer}>
          {/* Section 1: Community Events Carousel with 'more' button */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Community Events</Text>
              <TouchableOpacity
                onPress={() => setShowAllEvents(true)}
                style={styles.seeAllRow}
                activeOpacity={0.7}
              >
                <Text style={styles.seeAllText}>more</Text>
                <MaterialIcons name="chevron-right" size={16} color={colors.secondary} />
              </TouchableOpacity>
            </View>

            {events.length === 0 ? (
              <View style={styles.emptySectionCard}>
                <MaterialIcons name="event" size={28} color={colors.tertiary} />
                <Text style={styles.emptyFeedTitle}>No upcoming events</Text>
                <Text style={styles.emptyFeedSubtitle}>
                  Events scheduled in this community will appear here.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.eventsCarousel}
              >
                {events.map((ev) => {
                  const cat = categorizeItemByDate(ev);
                  return (
                    <TouchableOpacity
                      key={ev.id}
                      style={[styles.eventCard, cat.isPassed && styles.itemCardPassed]}
                      onPress={() =>
                        router.push({
                          pathname: '/event/[id]',
                          params: { id: ev.id, slug: community.slug },
                        } as any)
                      }
                      activeOpacity={cat.isPassed ? 0.38 : 0.85}
                    >
                    <Image
                      source={{
                        uri:
                          (ev as any).cover_image_url ||
                          ev.coverImageUrl ||
                          'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=600',
                      }}
                      style={styles.eventCover}
                    />
                    <View style={styles.eventBody}>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {ev.title}
                      </Text>
                      <View style={styles.eventMetaRow}>
                        <View style={styles.metaItem}>
                          <MaterialIcons name="calendar-today" size={13} color={colors.primary} />
                          <Text style={styles.metaText}>
                            {(ev as any).starts_at
                              ? new Date((ev as any).starts_at).toLocaleDateString()
                              : 'Upcoming'}
                          </Text>
                        </View>
                        <Text style={styles.metaTextSec}>
                          {(() => {
                            const evDate = (ev as any).ends_at || (ev as any).endsAt || (ev as any).starts_at || (ev as any).startsAt;
                            const isPassed = evDate ? new Date(evDate) < new Date() : false;
                            return `${ev.participantsCount || 0} ${isPassed ? 'went' : 'going'}`;
                          })()}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
              </ScrollView>
            )}
          </View>

          {/* Section 2: Discussions Vertical Feed */}
          <View style={[styles.section, { marginTop: Spacing.lg }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Discussions</Text>
            </View>

            {posts.length === 0 ? (
              <View style={styles.emptySectionCard}>
                <MaterialIcons name="forum" size={28} color={colors.tertiary} />
                <Text style={styles.emptyFeedTitle}>No discussions yet</Text>
                <Text style={styles.emptyFeedSubtitle}>
                  Share thoughts, ask questions, or start a discussion.
                </Text>
              </View>
            ) : (
              <View style={styles.discussionsList}>
                {posts.map((p: any) => (
                  <FeedDiscussionCard
                    key={p.id}
                    post={{
                      ...p,
                      communityName: p.communityName || community.name,
                      communityCategory: p.communityCategory || community.category,
                      communitySlug: p.communitySlug || community.slug,
                    }}
                    isLiked={likedPosts[p.id]}
                    isSaved={savedPosts[p.id]}
                    onToggleLike={toggleLike}
                    onToggleSave={toggleSave}
                    onPressPost={(id) => router.push(`/post/${id}`)}
                    onPressCommunity={(slug) => router.push(`/community/${slug}`)}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Persistent AppBottomBar with activeTab={null} and communityContext */}
      <AppBottomBar
        activeTab={null}
        communityContext={{
          id: community.id,
          slug: community.slug,
          name: community.name,
        }}
      />
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 90,
  },
  notFoundIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  notFoundTitle: {
    ...Typography.headlineSm,
    color: colors.onSurface,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  notFoundSub: {
    ...Typography.bodyMd,
    color: colors.tertiary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
  },
  backButtonText: {
    ...Typography.labelMd,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },

  // Hero Card with Narrow Cover Banner (~125 height)
  heroCard: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: Spacing.sm,
  },
  heroBanner: {
    width: '100%',
    height: 125,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill as any,
    height: 125,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  coverNavRow: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  navCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: isDark ? 'rgba(30, 26, 23, 0.9)' : 'rgba(252, 249, 248, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  heroInfoBlock: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -30,
    marginBottom: Spacing.xs,
  },
  avatarOverlapContainer: {
    position: 'relative',
    zIndex: 20,
    elevation: 5,
    backgroundColor: colors.surface,
    borderRadius: 34,
    padding: 2,
  },
  communityAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
  },
  communityAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: isDark ? colors.surfaceContainerHigh : '#fffbeb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineRing: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  membershipBtn: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...Shadows.sm,
  },
  btnJoinedState: {
    backgroundColor: isDark ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9',
  },
  btnJoinState: {
    backgroundColor: colors.primaryContainer,
  },
  membershipBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  textJoinedState: {
    color: isDark ? '#81c784' : '#2e7d32',
  },
  textJoinState: {
    color: colors.onPrimaryContainer,
  },
  communityTitle: {
    ...Typography.headlineSm,
    color: colors.onSurface,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 4,
  },

  // Row 1: Badges
  row1Badges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
    marginBottom: 8,
  },
  categoryPill: {
    backgroundColor: colors.surfaceContainerHighest,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    maxWidth: 140,
  },
  categoryPillText: {
    ...Typography.captionSm,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  publicPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isDark ? 'rgba(61, 168, 107, 0.25)' : 'rgba(61, 168, 107, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  publicDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  publicPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: isDark ? '#81c784' : '#1b5e20',
  },
  memberCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  memberCountText: {
    ...Typography.captionMd,
    color: colors.tertiary,
  },

  // Row 2: Bio
  bioContainer: {
    marginBottom: 10,
  },
  descriptionText: {
    ...Typography.bodyMd,
    color: colors.onSurfaceVariant,
    lineHeight: 19,
  },

  // Row 3: Rules Section
  rulesSection: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    gap: 8,
    marginTop: 2,
  },
  rulesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rulesTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rulesHeaderText: {
    ...Typography.labelMd,
    color: colors.onSurface,
    fontWeight: '700',
  },
  rulesPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 4,
  },
  rulePill: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  rulePillText: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
  noRulesText: {
    ...Typography.captionMd,
    color: colors.tertiary,
    fontStyle: 'italic',
    paddingVertical: 2,
  },

  // Feed Container
  feedContainer: {
    paddingBottom: 24,
  },
  section: {
    marginTop: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
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
  eventsCarousel: {
    paddingHorizontal: Spacing.md,
    gap: 12,
  },
  eventCard: {
    width: 220,
    height: 160,
    backgroundColor: colors.surfaceContainer,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...Shadows.sm,
  },
  itemCardPassed: {
    opacity: 0.48,
  },
  eventCover: {
    width: '100%',
    height: 90,
  },
  eventBody: {
    padding: Spacing.sm,
    flex: 1,
    justifyContent: 'space-between',
  },
  eventTitle: {
    ...Typography.labelMd,
    color: colors.onSurface,
    fontWeight: '700',
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
    ...Typography.captionSm,
    color: colors.onSurfaceVariant,
  },
  metaTextSec: {
    ...Typography.captionSm,
    color: colors.secondary,
    fontWeight: '600',
  },

  // Empty states
  emptySectionCard: {
    marginHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    backgroundColor: colors.surfaceContainer,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyFeedTitle: {
    ...Typography.labelMd,
    color: colors.onSurface,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyFeedSubtitle: {
    ...Typography.captionSm,
    color: colors.tertiary,
    textAlign: 'center',
    maxWidth: 240,
  },

  // Discussions
  discussionsList: {
    paddingHorizontal: Spacing.md,
    gap: 12,
  },
  discussionCard: {
    backgroundColor: colors.surfaceContainer,
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
    backgroundColor: isDark ? 'rgba(232, 167, 54, 0.2)' : 'rgba(232, 167, 54, 0.12)',
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
    borderTopColor: colors.cardBorder,
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

  // Dedicated All Events Search View
  searchHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  backIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchHeaderTitle: {
    ...Typography.headlineSm,
    color: colors.onSurface,
    fontWeight: '700',
  },
  eventSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    height: 44,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  eventSearchInput: {
    flex: 1,
    height: '100%',
    marginLeft: Spacing.sm,
    ...Typography.bodyMd,
    color: colors.onSurface,
  },
  allEventsContent: {
    paddingHorizontal: Spacing.md,
    gap: 12,
    paddingBottom: 90,
  },
  verticalEventCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...Shadows.sm,
  },
  verticalEventCover: {
    width: '100%',
    height: 120,
  },
  verticalEventBody: {
    padding: Spacing.md,
    gap: 6,
  },
  verticalEventTitle: {
    ...Typography.labelLg,
    color: colors.onSurface,
    fontWeight: '700',
  },
  verticalEventDesc: {
    ...Typography.bodyMd,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  verticalEventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  emptyEventsBox: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
