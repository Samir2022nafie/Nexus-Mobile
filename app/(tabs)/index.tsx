/**
 * Home Feed Screen — Matches Stitch screen_8_home_feed_loaded
 * Sections:
 * 1. AppHeader (/ Home + bell + avatar)
 * 2. Section 1: Your Communities carousel (140x160 cards)
 * 3. Section 2: Upcoming Events carousel (260x200 cards)
 * 4. Section 3: Hangouts Near You carousel (240x175 cards)
 * 5. Section 4: Trending Discussions vertical list
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
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { useAuth } from '../../src/context/AuthContext';
import { communitiesService } from '../../src/services/communities';
import { hangoutsService } from '../../src/services/hangouts';
import { eventsService } from '../../src/services/events';
import { postsService } from '../../src/services/posts';
import { Community, HangoutItem, EventItem, Post } from '../../src/types';
import { formatCategoryName } from '../../src/utils/categories';


export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [hangouts, setHangouts] = useState<HangoutItem[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [commData, hangData] = await Promise.all([
        communitiesService.list({ limit: 10 }).catch(() => []),
        hangoutsService.list({ limit: 10 }).catch(() => []),
      ]);

      const realComms = commData || [];
      const realHangs = hangData || [];
      setCommunities(realComms);
      setHangouts(realHangs);

      // Fetch genuine events and posts from the backend communities
      if (realComms.length > 0) {
        try {
          const evPromises = realComms.slice(0, 5).map((c) =>
            eventsService.listByCommunity(c.slug, { limit: 5 }).catch(() => [])
          );
          const postPromises = realComms.slice(0, 5).map((c) =>
            postsService.listByCommmunity(c.slug, { limit: 5 }).catch(() => [])
          );
          const [evArrays, postArrays] = await Promise.all([
            Promise.all(evPromises),
            Promise.all(postPromises),
          ]);
          setEvents(evArrays.flat());
          setPosts(postArrays.flat());
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

  const toggleLike = (postId: string) => {
    setLikedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const toggleSave = (postId: string) => {
    setSavedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading feed..." />;
  }

  return (
    <View style={styles.screen}>
      <AppHeader breadcrumb="Home" hasUnreadNotification={true} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primaryContainer}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Your Communities */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Communities</Text>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(tabs)/explore', params: { tab: 'communities' } })}
              style={styles.seeAllRow}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAllText}>See All</Text>
              <MaterialIcons name="chevron-right" size={16} color={Colors.secondary} />
            </TouchableOpacity>
          </View>

          {communities.length === 0 ? (
            <View style={styles.emptyFeedCard}>
              <MaterialIcons name="groups" size={32} color={Colors.tertiary} />
              <Text style={styles.emptyFeedTitle}>No communities joined yet</Text>
              <Text style={styles.emptyFeedSubtitle}>
                Discover communities aligned with your interests or create a new one!
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => router.push({ pathname: '/(tabs)/explore', params: { tab: 'communities' } })}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyActionBtnText}>Explore Communities</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
            >
              {communities.map((comm) => (
                <TouchableOpacity
                  key={comm.id}
                  style={styles.communityCard}
                  onPress={() => router.push(`/community/${comm.slug}`)}
                  activeOpacity={0.8}
                >
                  <View style={styles.commAvatarWrapper}>
                    {comm.profile_picture_url ? (
                      <Image source={{ uri: comm.profile_picture_url }} style={styles.commAvatar} />
                    ) : (
                      <View style={styles.commAvatarFallback}>
                        <MaterialIcons name="group" size={24} color={Colors.primary} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.commName} numberOfLines={1}>
                    {comm.name}
                  </Text>
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryPillText} numberOfLines={1}>
                      {formatCategoryName(comm.category, true)}
                    </Text>
                  </View>
                  <Text style={styles.commMembers}>
                    {comm.memberCount || 0} members
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Section 2: Upcoming Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(tabs)/explore', params: { tab: 'events' } })}
              style={styles.seeAllRow}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAllText}>See All</Text>
              <MaterialIcons name="chevron-right" size={16} color={Colors.secondary} />
            </TouchableOpacity>
          </View>

          {events.length === 0 ? (
            <View style={styles.emptyFeedCard}>
              <MaterialIcons name="event" size={32} color={Colors.tertiary} />
              <Text style={styles.emptyFeedTitle}>No upcoming events</Text>
              <Text style={styles.emptyFeedSubtitle}>
                Community events and workshops will appear here as they are scheduled.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
            >
              {events.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventCard}
                  onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id, slug: event.community?.slug || event.communitySlug } } as any)}
                  activeOpacity={0.85}
                >
                  <View style={styles.eventCoverWrapper}>
                    <Image
                      source={{
                        uri:
                          event.cover_image_url ||
                          event.coverImageUrl ||
                          'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=600',
                      }}
                      style={styles.eventCover}
                    />
                    <View style={styles.eventCommunityBadge}>
                      <Text style={styles.eventCommunityBadgeText} numberOfLines={1}>
                        {event.communityName || event.community?.name || 'Nexus'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.eventBody}>
                    <Text style={styles.eventTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <View style={styles.eventMetaRow}>
                      <View style={styles.metaItem}>
                        <MaterialIcons name="calendar-today" size={14} color={Colors.primary} />
                        <Text style={styles.metaText}>{event.dateText || (event.starts_at ? new Date(event.starts_at).toLocaleDateString() : 'Upcoming')}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <MaterialIcons name="group" size={14} color={Colors.secondary} />
                        <Text style={styles.metaTextSec}>{event.participantsCount ? `${event.participantsCount} going` : 'Upcoming'}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Section 3: Hangouts Near You */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hangouts Near You</Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/hangouts')}
              style={styles.seeAllRow}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAllText}>See All</Text>
              <MaterialIcons name="chevron-right" size={16} color={Colors.secondary} />
            </TouchableOpacity>
          </View>

          {hangouts.length === 0 ? (
            <View style={styles.emptyFeedCard}>
              <MaterialIcons name="explore" size={32} color={Colors.tertiary} />
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
                const isOpen = hangout.joinType === 'OPEN' || hangout.join_type === 'OPEN' || hangout.joinType === 'open' || hangout.join_type === 'open';
                return (
                  <TouchableOpacity
                    key={hangout.id}
                    style={styles.hangoutCard}
                    onPress={() => router.push(`/hangout/${hangout.id}`)}
                    activeOpacity={0.85}
                  >
                    <View>
                      <View style={styles.hangoutHeader}>
                        <View style={styles.hangoutCreatorRow}>
                          <Image
                            source={{
                              uri:
                                hangout.creatorAvatar ||
                                hangout.creator?.profile_picture_url ||
                                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
                            }}
                            style={styles.hangoutCreatorAvatar}
                          />
                          <Text style={styles.hangoutCreatorName} numberOfLines={1}>
                            {hangout.creatorName || hangout.creator?.first_name || 'Host'}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.joinTypeBadge,
                            isOpen ? styles.joinTypeOpen : styles.joinTypeRequest,
                          ]}
                        >
                          {isOpen && <View style={styles.beaconDot} />}
                          <Text
                            style={[
                              styles.joinTypeBadgeText,
                              isOpen ? styles.joinTypeOpenText : styles.joinTypeRequestText,
                            ]}
                          >
                            {isOpen ? 'Open' : 'Request'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.hangoutTitle} numberOfLines={1}>
                        {hangout.title}
                      </Text>
                      <View style={styles.hangoutScheduleRow}>
                        <MaterialIcons name="schedule" size={14} color={Colors.onSurfaceVariant} />
                        <Text style={styles.hangoutScheduleText}>
                          {hangout.timeText || (hangout.starts_at ? new Date(hangout.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.hangoutFooter}>
                      <Text style={styles.hangoutSpotsText}>
                        {hangout.spotsText || `${hangout.participantsCount || 1}/${hangout.maxParticipants || 10} spots`}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.hangoutActionButton,
                          isOpen ? styles.hangoutBtnOpen : styles.hangoutBtnRequest,
                        ]}
                        onPress={() => router.push(`/hangout/${hangout.id}`)}
                      >
                        <Text
                          style={[
                            styles.hangoutActionText,
                            isOpen ? styles.hangoutBtnOpenText : styles.hangoutBtnRequestText,
                          ]}
                        >
                          {isOpen ? 'Join' : 'Request'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Section 4: Trending Discussions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trending Discussions</Text>
          </View>

          {posts.length === 0 ? (
            <View style={styles.emptyFeedCard}>
              <MaterialIcons name="forum" size={32} color={Colors.tertiary} />
              <Text style={styles.emptyFeedTitle}>No discussions yet</Text>
              <Text style={styles.emptyFeedSubtitle}>
                Join a community to share your thoughts and participate in discussions.
              </Text>
            </View>
          ) : (
            <View style={styles.discussionsList}>
              {posts.map((post: any) => {
                const isLiked = likedPosts[post.id];
                const isSaved = savedPosts[post.id];
                const likes = (post.likesCount || 0) + (isLiked ? 1 : 0);

                return (
                  <View key={post.id} style={styles.discussionCard}>
                    {/* Top user row */}
                    <View style={styles.postAuthorRow}>
                      <View style={styles.authorInfo}>
                        <Image
                          source={{
                            uri:
                              post.authorAvatar ||
                              post.author?.profile_picture_url ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
                          }}
                          style={styles.authorAvatar}
                        />
                        <Text style={styles.authorName}>
                          {post.authorName || post.author?.first_name || 'Member'}
                        </Text>
                        <Text style={styles.timeAgoText}>{post.timeAgo || 'recently'}</Text>
                      </View>
                      <View style={styles.commPillBadge}>
                        <Text style={styles.commPillText}>
                          {post.communityName || 'Discussion'}
                        </Text>
                      </View>
                    </View>

                    {/* Body */}
                    <TouchableOpacity
                      onPress={() => router.push(`/post/${post.id}`)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.postTitle}>{post.title}</Text>
                      <Text style={styles.postContent} numberOfLines={2}>
                        {post.content}
                      </Text>
                    </TouchableOpacity>

                    {/* Action row */}
                    <View style={styles.postActionsRow}>
                      <View style={styles.postActionGroup}>
                        {/* Like */}
                        <TouchableOpacity
                          style={styles.iconCounter}
                          onPress={() => toggleLike(post.id)}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons
                            name={isLiked ? 'favorite' : 'favorite-border'}
                            size={20}
                            color={isLiked ? Colors.primaryContainer : Colors.tertiary}
                          />
                          <Text
                            style={[
                              styles.counterText,
                              isLiked && { color: Colors.primaryContainer, fontWeight: '700' },
                            ]}
                          >
                            {likes}
                          </Text>
                        </TouchableOpacity>

                        {/* Comments */}
                        <TouchableOpacity
                          style={styles.iconCounter}
                          onPress={() => router.push(`/post/${post.id}`)}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons
                            name="chat-bubble-outline"
                            size={18}
                            color={Colors.tertiary}
                          />
                          <Text style={styles.counterText}>{post.commentsCount || 0}</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.postActionGroup}>
                        {/* Bookmark */}
                        <TouchableOpacity
                          style={styles.iconOnly}
                          onPress={() => toggleSave(post.id)}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons
                            name={isSaved ? 'bookmark' : 'bookmark-border'}
                            size={20}
                            color={isSaved ? Colors.primaryContainer : Colors.tertiary}
                          />
                        </TouchableOpacity>

                        {/* Share */}
                        <TouchableOpacity style={styles.iconOnly} activeOpacity={0.7}>
                          <MaterialIcons name="share" size={20} color={Colors.tertiary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
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
  sectionTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
  },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    ...Typography.labelMd,
    color: Colors.secondary,
  },
  carousel: {
    paddingHorizontal: Spacing.md,
    gap: 12,
  },
  // Section 1: Communities
  communityCard: {
    width: 140,
    height: 160,
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    padding: Spacing.sm,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadows.sm,
  },
  commAvatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(232, 167, 54, 0.2)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commAvatar: {
    width: 48,
    height: 48,
  },
  commAvatarFallback: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commName: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  categoryPill: {
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    maxWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.onPrimaryContainer,
    textAlign: 'center',
  },
  commMembers: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },

  // Section 2: Events
  eventCard: {
    width: 260,
    height: 200,
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
  eventCommunityBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(252, 249, 248, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  eventCommunityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  eventBody: {
    padding: Spacing.sm,
    flex: 1,
    justifyContent: 'space-between',
  },
  eventTitle: {
    ...Typography.labelLg,
    color: Colors.onSurface,
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
    ...Typography.captionMd,
    color: Colors.onSurfaceVariant,
  },
  metaTextSec: {
    ...Typography.captionMd,
    color: Colors.secondary,
    fontWeight: '600',
  },

  // Section 3: Hangouts
  hangoutCard: {
    width: 240,
    height: 175,
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadows.sm,
  },
  hangoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  hangoutCreatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hangoutCreatorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  hangoutCreatorName: {
    ...Typography.captionSm,
    color: Colors.tertiary,
    fontWeight: '600',
  },
  joinTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  joinTypeOpen: {
    backgroundColor: Colors.surface,
  },
  joinTypeRequest: {
    backgroundColor: Colors.secondaryFixed,
  },
  joinTypeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  joinTypeOpenText: {
    color: Colors.onSurface,
  },
  joinTypeRequestText: {
    color: Colors.onSecondaryFixed,
  },
  beaconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  hangoutTitle: {
    ...Typography.labelMd,
    color: Colors.onSurface,
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
    color: Colors.onSurfaceVariant,
  },
  hangoutFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
  },
  hangoutSpotsText: {
    ...Typography.captionSm,
    color: Colors.tertiary,
    fontWeight: '600',
  },
  hangoutActionButton: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  hangoutBtnOpen: {
    backgroundColor: Colors.primaryContainer,
  },
  hangoutBtnRequest: {
    backgroundColor: Colors.secondary,
  },
  hangoutActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  hangoutBtnOpenText: {
    color: Colors.onPrimaryContainer,
  },
  hangoutBtnRequestText: {
    color: Colors.surface,
  },

  // Section 4: Discussions
  discussionsList: {
    paddingHorizontal: Spacing.md,
    gap: 12,
  },
  discussionCard: {
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadows.sm,
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
  timeAgoText: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },
  commPillBadge: {
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  commPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.onPrimaryContainer,
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
  postActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(105, 92, 80, 0.15)',
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
    color: Colors.tertiary,
  },
  iconOnly: {
    padding: 2,
  },
  emptyFeedCard: {
    marginHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyFeedTitle: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyFeedSubtitle: {
    ...Typography.captionMd,
    color: Colors.tertiary,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyActionBtn: {
    marginTop: 8,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  emptyActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onPrimaryContainer,
  },
});
