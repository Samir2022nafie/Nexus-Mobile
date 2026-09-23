/**
 * Public User Profile Screen
 * Displays a user's public identity, bio, stats, follow/unfollow toggle,
 * and their public posts feed.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../../src/constants/theme';
import { useTheme, useThemedStyles } from '../../src/context/ThemeContext';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { FeedDiscussionCard } from '../../src/components/FeedDiscussionCard';
import { usersService } from '../../src/services/users';
import { reportsService } from '../../src/services/reports';
import { useAuth } from '../../src/context/AuthContext';
import { PublicProfile, Post } from '../../src/types';

export default function PublicUserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const isSelf = currentUser?.id === id;

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [profileData, postsData] = await Promise.all([
        usersService.getPublicProfile(id).catch(() => null),
        usersService.getUserPosts(id).catch(() => []),
      ]);

      if (profileData) {
        setProfile(profileData);
      }
      setPosts(postsData || []);
    } catch {
      // Non-blocking fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleToggleFollow = async () => {
    if (!profile || isSelf || actionLoading) return;
    const nextFollowing = !profile.isFollowing;
    const currentFollowers = profile.stats?.followersCount ?? 0;
    const nextFollowers = nextFollowing
      ? currentFollowers + 1
      : Math.max(0, currentFollowers - 1);

    // Optimistic UI update
    setProfile({
      ...profile,
      isFollowing: nextFollowing,
      stats: {
        ...profile.stats,
        followersCount: nextFollowers,
      },
    });

    setActionLoading(true);
    try {
      if (nextFollowing) {
        await usersService.follow(profile.id);
      } else {
        await usersService.unfollow(profile.id);
      }
    } catch {
      // Revert on error
      setProfile({
        ...profile,
        isFollowing: !nextFollowing,
        stats: {
          ...profile.stats,
          followersCount: currentFollowers,
        },
      });
      Alert.alert('Error', 'Unable to update follow status. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportUser = () => {
    if (!profile) return;
    Alert.alert(
      'Report User',
      `Report @${profile.username} for inappropriate content or behavior?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await reportsService.create({
                reportedUserId: profile.id,
                reason: 'Inappropriate behavior',
              });
              Alert.alert('Report Submitted', 'Thank you. Our moderation team will review this user.');
            } catch {
              Alert.alert('Error', 'Failed to submit report.');
            }
          },
        },
      ]
    );
  };

  if (loading && !profile) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: insets.top }]}>
        <LoadingSpinner message="Loading profile..." />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.notFoundScreen, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.notFoundCenter}>
          <MaterialIcons name="person-off" size={64} color={colors.tertiary} />
          <Text style={styles.notFoundTitle}>User Not Found</Text>
          <Text style={styles.notFoundSubtitle}>
            This profile might have been deleted or does not exist.
          </Text>
          <TouchableOpacity
            style={styles.notFoundBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.notFoundBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const displayName =
    profile.name ||
    [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
    profile.username ||
    'Nexus User';

  const avatarUrl = profile.profilePictureUrl || (profile as any).profile_picture_url;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {profile.username ? `@${profile.username}` : 'User Profile'}
        </Text>

        {!isSelf ? (
          <TouchableOpacity
            onPress={handleReportUser}
            style={styles.moreButton}
            activeOpacity={0.7}
          >
            <MaterialIcons name="flag" size={20} color={colors.tertiary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryContainer}
          />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <MaterialIcons name="person" size={50} color={colors.tertiary} />
              </View>
            )}
          </View>

          {/* User Details */}
          <Text style={styles.displayNameText}>{displayName}</Text>
          <Text style={styles.usernameText}>@{profile.username}</Text>

          {/* Trust Score Badge */}
          <View style={styles.trustBadge}>
            <MaterialIcons name="verified" size={14} color={colors.primaryContainer} />
            <Text style={styles.trustBadgeText}>
              Nexus Member
            </Text>
          </View>

          {/* Bio */}
          {profile.bio ? (
            <Text style={styles.bioText}>{profile.bio}</Text>
          ) : (
            <Text style={styles.noBioText}>No bio provided yet.</Text>
          )}

          {/* Follow / Unfollow Action Button */}
          {!isSelf ? (
            <TouchableOpacity
              style={[
                styles.followButton,
                profile.isFollowing ? styles.followingButton : styles.unfollowedButton,
              ]}
              onPress={handleToggleFollow}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator
                  size="small"
                  color={profile.isFollowing ? colors.onSurface : colors.onPrimaryContainer}
                />
              ) : (
                <View style={styles.followButtonContent}>
                  <MaterialIcons
                    name={profile.isFollowing ? 'check' : 'person-add'}
                    size={18}
                    color={profile.isFollowing ? colors.primaryContainer : colors.onPrimaryContainer}
                  />
                  <Text
                    style={[
                      styles.followButtonText,
                      profile.isFollowing
                        ? styles.followingButtonText
                        : styles.unfollowedButtonText,
                    ]}
                  >
                    {profile.isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.selfProfileBanner}
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="badge" size={16} color={colors.primaryContainer} />
              <Text style={styles.selfProfileText}>This is your public profile · View Full Dashboard</Text>
            </TouchableOpacity>
          )}

          {/* Stats Matrix */}
          <View style={styles.statsMatrix}>
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{profile.stats?.followersCount ?? 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{profile.stats?.followingCount ?? 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{profile.stats?.communitiesCount ?? 0}</Text>
              <Text style={styles.statLabel}>Communities</Text>
            </View>
          </View>
        </View>

        {/* User's Public Posts Section */}
        <View style={styles.postsSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="dynamic-feed" size={20} color={colors.primaryContainer} />
              <Text style={styles.sectionTitle}>Posts</Text>
            </View>
            <View style={styles.postCountBadge}>
              <Text style={styles.postCountText}>{posts.length}</Text>
            </View>
          </View>

          {posts.length === 0 ? (
            <View style={styles.emptyPostsCard}>
              <MaterialIcons name="forum" size={44} color={colors.tertiary} />
              <Text style={styles.emptyPostsTitle}>No Posts Published</Text>
              <Text style={styles.emptyPostsSubtitle}>
                When @{profile.username} shares discussions or questions, they will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.postsList}>
              {posts.map((post) => (
                <FeedDiscussionCard
                  key={post.id}
                  post={post}
                  onPressPost={(pId) => router.push(`/post/${pId}`)}
                  onPressComment={(pId) => router.push(`/post/${pId}`)}
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
    loadingScreen: {
      flex: 1,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notFoundScreen: {
      flex: 1,
      backgroundColor: colors.surface,
      paddingHorizontal: Spacing.md,
    },
    notFoundCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    notFoundTitle: {
      ...Typography.headlineSm,
      color: colors.onSurface,
      fontWeight: '700',
    },
    notFoundSubtitle: {
      ...Typography.bodyMd,
      color: colors.tertiary,
      textAlign: 'center',
      maxWidth: 280,
    },
    notFoundBtn: {
      marginTop: 8,
      backgroundColor: colors.primaryContainer,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: BorderRadius.full,
    },
    notFoundBtnText: {
      color: colors.onPrimaryContainer,
      fontWeight: '700',
      fontSize: 14,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
    },
    moreButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
    },
    headerTitle: {
      ...Typography.titleMd,
      fontSize: 16,
      fontWeight: '700',
      color: colors.onSurface,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    profileCard: {
      backgroundColor: colors.surfaceContainer,
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
      borderRadius: BorderRadius.xxl,
      padding: Spacing.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...Shadows.sm,
    },
    avatarWrapper: {
      width: 88,
      height: 88,
      borderRadius: 44,
      overflow: 'hidden',
      borderWidth: 2.5,
      borderColor: colors.primaryContainer,
      backgroundColor: colors.surfaceContainerHigh,
      marginBottom: 10,
      ...Shadows.sm,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarFallback: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    displayNameText: {
      ...Typography.headlineSm,
      color: colors.onSurface,
      fontWeight: '800',
      fontSize: 20,
    },
    usernameText: {
      ...Typography.bodyMd,
      color: colors.tertiary,
      fontWeight: '500',
      marginTop: 2,
    },
    trustBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? 'rgba(232, 167, 54, 0.18)' : 'rgba(232, 167, 54, 0.12)',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: BorderRadius.full,
      marginTop: 8,
    },
    trustBadgeText: {
      ...Typography.captionSm,
      color: colors.primary,
      fontWeight: '700',
      fontSize: 11,
    },
    bioText: {
      ...Typography.bodyMd,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: 10,
      lineHeight: 20,
      maxWidth: 300,
    },
    noBioText: {
      ...Typography.bodySm,
      color: colors.tertiary,
      fontStyle: 'italic',
      marginTop: 8,
    },
    followButton: {
      marginTop: 16,
      width: '100%',
      maxWidth: 240,
      height: 40,
      borderRadius: BorderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.sm,
    },
    unfollowedButton: {
      backgroundColor: colors.primaryContainer,
    },
    followingButton: {
      backgroundColor: colors.surfaceContainerHigh,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
    },
    followButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    followButtonText: {
      fontSize: 14,
      fontWeight: '700',
    },
    unfollowedButtonText: {
      color: colors.onPrimaryContainer,
    },
    followingButtonText: {
      color: colors.onSurface,
    },
    selfProfileBanner: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surfaceContainerHigh,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: BorderRadius.full,
    },
    selfProfileText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
    },
    statsMatrix: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: BorderRadius.xl,
      marginTop: 18,
      paddingVertical: 12,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    statColumn: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      ...Typography.titleLg,
      fontSize: 18,
      fontWeight: '800',
      color: colors.onSurface,
    },
    statLabel: {
      ...Typography.captionSm,
      color: colors.tertiary,
      fontWeight: '600',
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 24,
      backgroundColor: colors.cardBorder,
    },
    postsSection: {
      marginTop: Spacing.lg,
      paddingHorizontal: Spacing.md,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.xs,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      ...Typography.headlineSm,
      fontSize: 18,
      fontWeight: '800',
      color: colors.onSurface,
    },
    postCountBadge: {
      backgroundColor: colors.surfaceContainerHigh,
      paddingHorizontal: 10,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    postCountText: {
      ...Typography.captionSm,
      color: colors.primary,
      fontWeight: '700',
    },
    emptyPostsCard: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginTop: 4,
    },
    emptyPostsTitle: {
      ...Typography.labelLg,
      color: colors.onSurface,
      fontWeight: '700',
      marginTop: 4,
    },
    emptyPostsSubtitle: {
      ...Typography.captionMd,
      color: colors.tertiary,
      textAlign: 'center',
      maxWidth: 280,
      lineHeight: 18,
    },
    postsList: {
      gap: 12,
    },
  });
