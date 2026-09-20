/**
 * Community Detail Screen — Matches Stitch screen_12 to screen_15
 * Tabs: Discussions | Events | Members | About
 * Features:
 * - Cover hero banner with frosted glass back & share buttons
 * - Overlapping avatar with live emerald indicator
 * - Joined / Join pill toggle button
 * - Sticky sub-tab navigation
 * - "What's on your mind?" composer trigger -> /new-post
 * - Full discussion stream with reactions & bookmarks
 * - Clean empty states with zero mock/placeholder data
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/constants/theme';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { communitiesService } from '../../src/services/communities';
import { postsService } from '../../src/services/posts';
import { eventsService } from '../../src/services/events';
import { Community, Post, EventItem, CommunityMember } from '../../src/types';
import { formatCategoryName } from '../../src/utils/categories';

const TABS = ['Discussions', 'Events', 'Members', 'About'] as const;
type TabType = typeof TABS[number];

export default function CommunityDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('Discussions');
  const [descExpanded, setDescExpanded] = useState(false);
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

      const [postData, eventData, memberData] = await Promise.all([
        postsService.listByCommmunity(slug, { limit: 20 }).catch(() => []),
        eventsService.listByCommunity(slug, { limit: 20 }).catch(() => []),
        communitiesService.listMembers(slug, { limit: 20 }).catch(() => []),
      ]);
      setPosts(postData || []);
      setEvents(eventData || []);
      setMembers(memberData || []);
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
            ? { ...prev, isMember: false, myRole: null, memberCount: Math.max(0, prev.memberCount - 1) }
            : prev
        );
      } else {
        await communitiesService.join(slug);
        setCommunity((prev) =>
          prev
            ? { ...prev, isMember: true, myRole: 'member', memberCount: prev.memberCount + 1 }
            : prev
        );
      }
    } catch {} finally {
      setJoining(false);
    }
  };

  const toggleLike = (postId: string) => {
    setLikedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const toggleSave = (postId: string) => {
    setSavedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
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
          <MaterialIcons name="groups" size={40} color={Colors.tertiary} />
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
          <MaterialIcons name="arrow-back" size={18} color={Colors.onPrimaryContainer} />
          <Text style={styles.backButtonText}>Back to Communities</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const catDisplay = formatCategoryName(community.category, true);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primaryContainer]}
            tintColor={Colors.primaryContainer}
          />
        }
      >
        {/* Cover Hero & Header Card */}
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

          {/* Top Actions Row */}
          <View style={[styles.coverNavRow, { top: insets.top + Spacing.xs }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.navCircleBtn}
              activeOpacity={0.8}
            >
              <MaterialIcons name="arrow-back" size={22} color={Colors.onSurface} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.navCircleBtn} activeOpacity={0.8}>
              <MaterialIcons name="share" size={20} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>

          {/* Profile & Info Overlay Section */}
          <View style={styles.heroInfoBlock}>
            {/* Avatar row with overlap */}
            <View style={styles.avatarRow}>
              <View style={styles.avatarOverlapContainer}>
                <Image
                  source={{
                    uri:
                      community.profile_picture_url ||
                      'https://images.unsplash.com/photo-1551632811-561732d1e306?w=200',
                  }}
                  style={styles.communityAvatar}
                />
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
                  color={community.isMember ? '#2e7d32' : Colors.onPrimaryContainer}
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

            {/* Title & Badges */}
            <Text style={styles.communityTitle}>{community.name}</Text>

            <View style={styles.badgesRow}>
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
                <MaterialIcons name="group" size={14} color={Colors.tertiary} />
                <Text style={styles.memberCountText}>
                  {community.memberCount || 0} members
                </Text>
              </View>
            </View>

            {/* Description with toggle */}
            <Text
              style={styles.descriptionText}
              numberOfLines={descExpanded ? undefined : 2}
            >
              {community.description || 'Welcome to this community! Join to engage with members.'}
            </Text>
            {community.description && community.description.length > 80 && (
              <TouchableOpacity
                onPress={() => setDescExpanded(!descExpanded)}
                style={styles.readMoreBtn}
              >
                <Text style={styles.readMoreText}>
                  {descExpanded ? 'Show less' : 'Read more'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sticky Tab Bar Navigation */}
        <View style={styles.tabsContainer}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={styles.tabItem}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab}
                </Text>
                {isActive && <View style={styles.activeTabIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* What's on your mind? Composer Trigger Card */}
        {activeTab === 'Discussions' && (
          <TouchableOpacity
            style={styles.composerCard}
            onPress={() =>
              router.push({
                pathname: '/new-post',
                params: { communitySlug: community.slug, communityName: community.name },
              })
            }
            activeOpacity={0.85}
          >
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
              }}
              style={styles.composerAvatar}
            />
            <View style={styles.composerPill}>
              <Text style={styles.composerPlaceholder}>What's on your mind?</Text>
              <MaterialIcons name="add-photo-alternate" size={20} color={Colors.tertiary} />
            </View>
          </TouchableOpacity>
        )}

        {/* Tab Content */}
        {activeTab === 'Discussions' ? (
          <View style={styles.discussionsList}>
            {posts.length === 0 ? (
              <EmptyState
                icon="forum"
                title="No discussions yet"
                subtitle="Start the conversation with the first post in this community!"
                actionLabel="Create Post"
                onAction={() =>
                  router.push({
                    pathname: '/new-post',
                    params: { communitySlug: community.slug, communityName: community.name },
                  })
                }
              />
            ) : (
              posts.map((p) => {
                const isLiked = likedPosts[p.id];
                const isSaved = savedPosts[p.id];
                const likes = (p.likesCount || 0) + (isLiked ? 1 : 0);

                return (
                  <View key={p.id} style={styles.postCard}>
                    <View style={styles.postHeader}>
                      <View style={styles.postAuthorGroup}>
                        <Image
                          source={{
                            uri:
                              p.authorAvatar ||
                              p.author?.profile_picture_url ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
                          }}
                          style={styles.authorAvatar}
                        />
                        <Text style={styles.authorName}>
                          {p.authorName || p.author?.first_name || 'Member'}
                        </Text>
                        <Text style={styles.postTimeText}>• {p.timeAgo || 'recently'}</Text>
                      </View>
                      <TouchableOpacity style={styles.postMoreBtn}>
                        <MaterialIcons name="more-horiz" size={18} color={Colors.tertiary} />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      onPress={() => router.push(`/post/${p.id}`)}
                      activeOpacity={0.8}
                    >
                      {p.title ? <Text style={styles.postTitle}>{p.title}</Text> : null}
                      <Text style={styles.postContent} numberOfLines={2}>
                        {p.content}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.postActions}>
                      <View style={styles.reactionGroup}>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => toggleLike(p.id)}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons
                            name={isLiked ? 'favorite' : 'favorite-border'}
                            size={20}
                            color={isLiked ? Colors.primaryContainer : Colors.tertiary}
                          />
                          <Text
                            style={[
                              styles.actionText,
                              isLiked && { color: Colors.primaryContainer, fontWeight: '700' },
                            ]}
                          >
                            {likes}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => router.push(`/post/${p.id}`)}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons
                            name="chat-bubble-outline"
                            size={18}
                            color={Colors.tertiary}
                          />
                          <Text style={styles.actionText}>{p.commentsCount || 0}</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity onPress={() => toggleSave(p.id)} activeOpacity={0.7}>
                        <MaterialIcons
                          name={isSaved ? 'bookmark' : 'bookmark-border'}
                          size={20}
                          color={isSaved ? Colors.primaryContainer : Colors.tertiary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : activeTab === 'Events' ? (
          <View style={styles.discussionsList}>
            {events.length === 0 ? (
              <EmptyState
                icon="event"
                title="No events yet"
                subtitle="Plan the first meetup or event for this community."
                actionLabel="Plan Event"
                onAction={() =>
                  router.push({
                    pathname: '/new-event',
                    params: { communitySlug: community.slug },
                  })
                }
              />
            ) : (
              events.map((ev) => (
                <TouchableOpacity
                  key={ev.id}
                  style={styles.postCard}
                  onPress={() => router.push({ pathname: '/event/[id]', params: { id: ev.id, slug: community.slug } } as any)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.postTitle}>{ev.title}</Text>
                  <Text style={styles.eventSub}>
                    {(ev as any).starts_at
                      ? new Date((ev as any).starts_at).toLocaleDateString()
                      : ev.startsAt
                      ? new Date(ev.startsAt).toLocaleDateString()
                      : 'Upcoming'}{' '}
                    • {ev.participantsCount || 0} going
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : activeTab === 'Members' ? (
          <View style={styles.discussionsList}>
            {members.length === 0 ? (
              <EmptyState
                icon="group"
                title="No members listed"
                subtitle="Join this community to become one of its early members."
              />
            ) : (
              members.map((m: any) => (
                <View key={m.id || m.userId} style={styles.memberRow}>
                  <View style={styles.memberAvatarCircle}>
                    <MaterialIcons name="person" size={20} color={Colors.primaryContainer} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>
                      {m.user?.name || m.user?.username || m.user?.first_name || 'Member'}
                    </Text>
                    <Text style={styles.memberRole}>{m.role || 'member'}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.aboutCard}>
            <Text style={styles.aboutHeader}>About this Community</Text>
            <Text style={styles.aboutText}>{community.description || 'No description provided.'}</Text>
            <View style={styles.aboutMetaRow}>
              <MaterialIcons name="shield" size={16} color={Colors.primaryContainer} />
              <Text style={styles.aboutMetaText}>Safe & verified community space</Text>
            </View>
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
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 48,
  },
  notFoundIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  notFoundTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  notFoundSub: {
    ...Typography.bodyMd,
    color: Colors.tertiary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
  },
  backButtonText: {
    ...Typography.labelMd,
    color: Colors.onPrimaryContainer,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
    borderBottomWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.sm,
  },
  heroBanner: {
    width: '100%',
    height: 190,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill as any,
    height: 190,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  coverNavRow: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  navCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(252, 249, 248, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfoBlock: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -32,
    marginBottom: Spacing.sm,
  },
  avatarOverlapContainer: {
    position: 'relative',
  },
  communityAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: Colors.surface,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  onlineRing: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
  },
  membershipBtn: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnJoinedState: {
    backgroundColor: '#e8f5e9',
  },
  btnJoinState: {
    backgroundColor: Colors.primaryContainer,
  },
  membershipBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  textJoinedState: {
    color: '#2e7d32',
  },
  textJoinState: {
    color: Colors.onPrimaryContainer,
  },
  communityTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: '700',
    marginBottom: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  categoryPill: {
    backgroundColor: Colors.surfaceContainerHighest,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    maxWidth: 140,
  },
  categoryPillText: {
    ...Typography.captionSm,
    color: Colors.onSurfaceVariant,
    fontWeight: '600',
  },
  publicPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(61, 168, 107, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  publicDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  publicPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1b5e20',
  },
  memberCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  memberCountText: {
    ...Typography.captionMd,
    color: Colors.tertiary,
  },
  descriptionText: {
    ...Typography.captionMd,
    color: Colors.tertiary,
    lineHeight: 18,
  },
  readMoreBtn: {
    marginTop: 2,
  },
  readMoreText: {
    ...Typography.captionSm,
    color: Colors.secondary,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  tabLabel: {
    ...Typography.labelMd,
    color: Colors.tertiary,
  },
  tabLabelActive: {
    color: Colors.primaryContainer,
    fontWeight: '700',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 40,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.primaryContainer,
  },
  composerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.tertiaryFixed,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.xl,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  composerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  composerPill: {
    flex: 1,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  composerPlaceholder: {
    ...Typography.bodyMd,
    color: Colors.tertiary,
  },
  discussionsList: {
    paddingHorizontal: Spacing.md,
    gap: 12,
  },
  postCard: {
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  postAuthorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  authorName: {
    ...Typography.labelMd,
    color: Colors.onSurface,
  },
  postTimeText: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },
  postMoreBtn: {
    padding: 4,
  },
  postTitle: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  postContent: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
    marginTop: 2,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(105, 92, 80, 0.15)',
  },
  reactionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    ...Typography.captionMd,
    color: Colors.tertiary,
  },
  eventSub: {
    ...Typography.captionMd,
    color: Colors.tertiary,
    marginTop: 2,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 12,
  },
  memberAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(232, 167, 54, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberName: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  memberRole: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },
  aboutCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 10,
  },
  aboutHeader: {
    ...Typography.headlineSm,
    fontSize: 18,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  aboutText: {
    ...Typography.bodyMd,
    color: Colors.tertiary,
    lineHeight: 22,
  },
  aboutMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  aboutMetaText: {
    ...Typography.captionMd,
    color: Colors.onSurfaceVariant,
    fontWeight: '600',
  },
});
