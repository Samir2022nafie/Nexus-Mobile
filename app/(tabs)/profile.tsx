/**
 * Profile Screen (Self) — Matches Stitch screen_24_own_profile_posts_tab
 * Features:
 * - Profile Bar with settings gear button
 * - Tactile profile card with 80x80 avatar + camera edit trigger
 * - Verified Trust Score pill badge ("Member • 58 Score")
 * - 3-column stats matrix (Followers, Following, Communities)
 * - Gold pill "Edit Profile" button
 * - Sub-tab selector: Posts | Communities | Events
 * - Media-rich post stream & lists
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { usersService } from '../../src/services/users';
import { ManagedCommunity } from '../../src/types';

const PROFILE_TABS = ['Posts', 'Communities', 'Events'] as const;
type ProfileTab = typeof PROFILE_TABS[number];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<ProfileTab>('Posts');
  const [communities, setCommunities] = useState<ManagedCommunity[]>([]);
  const [userStats, setUserStats] = useState<{
    followersCount: number;
    followingCount: number;
    communitiesCount: number;
  } | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    try {
      const [comms, pubProfile] = await Promise.all([
        usersService.getMyCommunities().catch(() => []),
        user?.id ? usersService.getPublicProfile(user.id).catch(() => null) : null,
      ]);
      setCommunities(comms || []);
      if (pubProfile?.stats) {
        setUserStats(pubProfile.stats);
      }
    } catch {} finally {
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    refreshUser();
    fetchData();
  };

  const displayName =
    user?.name ||
    `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
    user?.username ||
    'Explorer';

  const toggleLike = (postId: string) => {
    setLikedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const toggleSave = (postId: string) => {
    setSavedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Profile Bar & Settings Header */}
      <View style={styles.topBar}>
        <View style={styles.titleGroup}>
          <Text style={styles.titleText}>Profile</Text>
          <View style={styles.goldBeacon} />
        </View>
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          style={styles.settingsButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="settings" size={24} color={Colors.tertiary} />
        </TouchableOpacity>
      </View>

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
        {/* Profile Card & Bio Section */}
        <View style={styles.profileCard}>
          {/* Subtle Ambient Accent */}
          <View style={styles.ambientBlur} />

          {/* Avatar with Camera Trigger */}
          <View style={styles.avatarWrapper}>
            <Image
              source={{
                uri:
                  user?.profile_picture_url ||
                  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
              }}
              style={styles.avatarImage}
            />
            <TouchableOpacity
              style={styles.cameraBadge}
              onPress={() => router.push('/edit-profile')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="photo-camera" size={16} color={Colors.onPrimary} />
            </TouchableOpacity>
          </View>

          {/* User Identity */}
          <Text style={styles.displayNameText}>{displayName}</Text>
          <Text style={styles.usernameText}>@{user?.username || 'user'}</Text>

          {/* Bio Statement */}
          <Text style={styles.bioText}>
            {user?.bio || 'No bio yet. Tap Edit Profile to introduce yourself to communities.'}
          </Text>

          {/* Trust Score & Community Standing */}
          <View style={styles.trustBadge}>
            <MaterialIcons name="verified" size={16} color={Colors.primaryContainer} />
            <Text style={styles.trustBadgeText}>
              Member • {user?.trust_score ?? 50} Score
            </Text>
          </View>

          {/* Community Stats Row */}
          <View style={styles.statsMatrix}>
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{userStats?.followersCount ?? 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{userStats?.followingCount ?? 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{userStats?.communitiesCount ?? communities.length}</Text>
              <Text style={styles.statLabel}>Communities</Text>
            </View>
          </View>

          {/* Edit Profile Action Button */}
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.85}
          >
            <MaterialIcons name="edit" size={18} color={Colors.onPrimary} />
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Sticky Tab Selector */}
        <View style={styles.tabSelector}>
          {PROFILE_TABS.map((tab) => {
            const isActive = activeTab === tab;
            const iconName =
              tab === 'Posts' ? 'article' : tab === 'Communities' ? 'groups' : 'calendar-month';
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={iconName as any}
                  size={18}
                  color={isActive ? Colors.primaryContainer : Colors.tertiary}
                />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tab Contents */}
        {activeTab === 'Posts' ? (
          <View style={styles.streamList}>
            {posts.length === 0 ? (
              <View style={styles.emptyTabCard}>
                <MaterialIcons name="article" size={36} color={Colors.tertiary} />
                <Text style={styles.emptyTabTitle}>No Posts Published Yet</Text>
                <Text style={styles.emptyTabDesc}>
                  Discussions, photos, or updates you share in your communities will appear here.
                </Text>
                <TouchableOpacity
                  style={styles.emptyTabBtn}
                  onPress={() => router.push('/new-post')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyTabBtnText}>Create Post</Text>
                </TouchableOpacity>
              </View>
            ) : (
              posts.map((post) => {
                const isLiked = likedPosts[post.id];
                const isSaved = savedPosts[post.id];
                const likes = (post.likesCount || 0) + (isLiked ? 1 : 0);

                return (
                  <View key={post.id} style={styles.postCard}>
                    <View style={styles.postMetaHeader}>
                      <View style={styles.postMetaLeft}>
                        <View style={styles.postCommunityTag}>
                          <Text style={styles.postCommunityText}>{post.communityName || 'Nexus'}</Text>
                        </View>
                        <Text style={styles.postTimeText}>• {post.timeAgo || 'recently'}</Text>
                      </View>
                      <TouchableOpacity style={styles.postOptionsBtn}>
                        <MaterialIcons name="more-horiz" size={18} color={Colors.tertiary} />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.postTitle}>{post.title}</Text>

                    {post.imageUrl && (
                      <View style={styles.postMediaWrapper}>
                        <Image source={{ uri: post.imageUrl }} style={styles.postMediaImage} />
                      </View>
                    )}

                    <View style={styles.postEngagementRow}>
                      <View style={styles.engagementGroup}>
                        <TouchableOpacity
                          style={styles.engagementBtn}
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
                              styles.engagementText,
                              isLiked && { color: Colors.primaryContainer, fontWeight: '700' },
                            ]}
                          >
                            {likes}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.engagementBtn} activeOpacity={0.7}>
                          <MaterialIcons name="chat-bubble-outline" size={18} color={Colors.tertiary} />
                          <Text style={styles.engagementText}>{post.commentsCount || 0}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.engagementBtn} activeOpacity={0.7}>
                          <MaterialIcons name="share" size={18} color={Colors.tertiary} />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity onPress={() => toggleSave(post.id)} activeOpacity={0.7}>
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
        ) : activeTab === 'Communities' ? (
          <View style={styles.streamList}>
            {communities.length === 0 ? (
              <View style={styles.emptyTabCard}>
                <MaterialIcons name="groups" size={36} color={Colors.tertiary} />
                <Text style={styles.emptyTabTitle}>No Communities Joined Yet</Text>
                <Text style={styles.emptyTabDesc}>
                  Discover local groups that match your hobbies, sports, and creative interests.
                </Text>
                <TouchableOpacity
                  style={styles.emptyTabBtn}
                  onPress={() => router.push({ pathname: '/(tabs)/explore', params: { tab: 'communities' } })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyTabBtnText}>Discover Communities</Text>
                </TouchableOpacity>
              </View>
            ) : (
              communities.map((c: any) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.communityRowCard}
                  onPress={() => router.push(`/community/${c.slug}`)}
                  activeOpacity={0.8}
                >
                  <View style={styles.commAvatarBox}>
                    <MaterialIcons name="groups" size={24} color={Colors.primaryContainer} />
                  </View>
                  <View style={styles.commDetails}>
                    <Text style={styles.commCardName}>{c.name}</Text>
                    <Text style={styles.commCardMeta}>
                      {c.role || 'Member'} • {c.memberCount || 0} members
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={Colors.tertiary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          <View style={styles.streamList}>
            <View style={styles.emptyTabCard}>
              <MaterialIcons name="event-available" size={36} color={Colors.tertiary} />
              <Text style={styles.emptyTabTitle}>Registered Events</Text>
              <Text style={styles.emptyTabDesc}>
                Events you join or RSVP to in your communities will appear here.
              </Text>
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
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
  },
  goldBeacon: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primaryContainer,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 48,
  },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
  },
  ambientBlur: {
    position: 'absolute',
    top: -48,
    right: -48,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(232, 167, 54, 0.15)',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: Colors.surfaceContainerHigh,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  displayNameText: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  usernameText: {
    ...Typography.captionMd,
    color: Colors.tertiary,
    marginTop: 2,
  },
  bioText: {
    ...Typography.captionMd,
    color: Colors.onSurface,
    textAlign: 'center',
    maxWidth: 280,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  trustBadge: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainer,
    ...Shadows.sm,
  },
  trustBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statsMatrix: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  statColumn: {
    alignItems: 'center',
  },
  statValue: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  statLabel: {
    ...Typography.captionSm,
    color: Colors.tertiary,
    marginTop: 2,
  },
  editProfileButton: {
    width: '100%',
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Shadows.sm,
  },
  editProfileText: {
    ...Typography.labelMd,
    color: Colors.onPrimaryContainer,
    fontWeight: '700',
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.xl,
    padding: 4,
    marginBottom: Spacing.md,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
  },
  tabButtonActive: {
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  tabText: {
    ...Typography.labelMd,
    color: Colors.tertiary,
  },
  tabTextActive: {
    color: Colors.primaryContainer,
    fontWeight: '700',
  },
  streamList: {
    gap: 12,
  },
  postCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadows.sm,
    gap: 8,
  },
  postMetaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  postMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postCommunityTag: {
    backgroundColor: Colors.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  postCommunityText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  postTimeText: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },
  postOptionsBtn: {
    padding: 4,
  },
  postTitle: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  postMediaWrapper: {
    width: '100%',
    height: 180,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceContainer,
  },
  postMediaImage: {
    width: '100%',
    height: '100%',
  },
  postEngagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(105, 92, 80, 0.15)',
  },
  engagementGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  engagementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  engagementText: {
    ...Typography.captionMd,
    color: Colors.tertiary,
  },
  communityRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  commAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(232, 167, 54, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  commDetails: {
    flex: 1,
  },
  commCardName: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  commCardMeta: {
    ...Typography.captionSm,
    color: Colors.tertiary,
    marginTop: 2,
  },
  emptyTabCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 6,
  },
  emptyTabTitle: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    marginTop: Spacing.sm,
    fontWeight: '700',
  },
  emptyTabDesc: {
    ...Typography.captionMd,
    color: Colors.tertiary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyTabBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  emptyTabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onPrimaryContainer,
  },
});
