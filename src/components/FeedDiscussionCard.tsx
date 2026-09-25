/**
 * FeedDiscussionCard — Universal post display component used across:
 * - Home Feed (What people are saying)
 * - Explore Feed (Posts tab)
 * - Community Detail Feed (Discussions)
 * - Profile Activity (Posts tab)
 * - Profile Saved (Posts tab)
 *
 * Feature: Top line contains community name on left, and category pill on right edge.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ViewStyle, Share } from 'react-native';
import { useSafeRouter } from '../hooks/useSafeRouter';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../constants/theme';
import { useTheme, useThemedStyles } from '../context/ThemeContext';
import { formatCategoryName } from '../utils/categories';
import { usePostState } from '../context/PostStateContext';
import { extractDirectImageUrl } from '../utils/imageUrl';

export function formatPostRelativeDate(rawDate?: string): string {
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

export interface FeedDiscussionCardProps {
  post: any;
  isLiked?: boolean;
  isSaved?: boolean;
  onToggleLike?: (postId: string) => void;
  onToggleSave?: (postId: string) => void;
  onPressComment?: (postId: string) => void;
  onPressPost?: (postId: string) => void;
  onPressCommunity?: (slug: string) => void;
  onPressShare?: (post: any) => void;
  showAuthor?: boolean;
  style?: ViewStyle;
}

export const FeedDiscussionCard: React.FC<FeedDiscussionCardProps> = ({
  post,
  isLiked,
  isSaved,
  onToggleLike,
  onToggleSave,
  onPressComment,
  onPressPost,
  onPressCommunity,
  onPressShare,
  showAuthor = false,
  style,
}) => {
  const router = useSafeRouter();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);
  const { likedPosts, savedPosts, commentCounts, likesCounts, toggleLike, toggleSave } = usePostState();

  // State-aware likes calculation with reversible increment/decrement
  const initialLiked = Boolean(
    post.hasReacted || post.isLiked || post.has_reacted || post.is_liked
  );
  const currentLiked = isLiked !== undefined ? isLiked : (likedPosts[post.id] ?? initialLiked);
  const baseLikes =
    post.likesCount ??
    post.reactionCount ??
    post.likes_count ??
    post._count?.reactions ??
    0;
  const diff = (currentLiked ? 1 : 0) - (initialLiked ? 1 : 0);
  const likes = likesCounts[post.id] ?? Math.max(0, baseLikes + diff);

  // State-aware save calculation
  const initialSaved = Boolean(
    post.isSaved || post.hasSaved || post.is_saved || post.has_saved
  );
  const currentSaved = isSaved !== undefined ? isSaved : (savedPosts[post.id] ?? initialSaved);

  // Comments count: synchronized context -> post.commentCount -> fallbacks
  const commentsCount =
    commentCounts[post.id] ??
    post.commentCount ??
    post.commentsCount ??
    post.comments_count ??
    post._count?.comments ??
    (Array.isArray(post.comments) ? post.comments.length : 0);

  const isPostEdited = Boolean(
    post.isEdited ||
    post.is_edited ||
    (post.updatedAt && post.createdAt && new Date(post.updatedAt).getTime() - new Date(post.createdAt).getTime() > 2000) ||
    (post.updated_at && post.created_at && new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 2000)
  );

  const [commImgFailed, setCommImgFailed] = React.useState(false);
  const [authorImgFailed, setAuthorImgFailed] = React.useState(false);

  // Tags
  const tagsList = Array.isArray(post.tags) ? post.tags : [];

  // Names and Avatars
  const commDisplayName =
    post.communityName || post.community?.name || 'Nexus Community';
  const commSlug =
    post.communitySlug || post.community?.slug || '';
  const rawCommPic =
    post.community?.profile_picture_url ||
    post.community?.profilePictureUrl ||
    post.communityAvatar ||
    post.communityProfilePictureUrl ||
    post.community?.avatar_url ||
    post.community?.avatarUrl ||
    post.community?.logo_url ||
    post.community?.banner_url ||
    post.community?.bannerUrl ||
    post.communityBanner ||
    post.communityBannerUrl;
  const commPic = extractDirectImageUrl(rawCommPic);

  const authorName =
    post.author?.name ||
    (post.author?.first_name || post.author?.last_name
      ? `${post.author?.first_name || ''} ${post.author?.last_name || ''}`.trim()
      : '') ||
    post.author?.username ||
    post.authorName ||
    post.authorUsername ||
    'Member';

  const rawAuthorPic =
    post.author?.profile_picture_url ||
    post.author?.profilePictureUrl ||
    post.authorAvatar ||
    post.authorProfilePictureUrl ||
    post.author?.avatar_url ||
    post.author?.avatarUrl ||
    post.authorPic;
  const authorPic = extractDirectImageUrl(rawAuthorPic);

  const rawCat =
    post.communityCategory ||
    post.community?.category?.name ||
    post.community?.category ||
    post.category;
  const categoryBadge = rawCat ? formatCategoryName(rawCat, true) : '';

  const rawMedia = post.mediaUrl || post.media_url || (Array.isArray(post.mediaUrls) ? post.mediaUrls[0] : null);
  const postMedia = extractDirectImageUrl(rawMedia);

  const handlePostPress = () => {
    if (onPressPost) {
      onPressPost(post.id);
    } else {
      router.push(`/post/${post.id}`);
    }
  };

  const handleCommunityPress = () => {
    if (commSlug) {
      if (onPressCommunity) {
        onPressCommunity(commSlug);
      } else {
        router.push(`/community/${commSlug}`);
      }
    }
  };

  const handleHeaderPress = () => {
    if (showAuthor) {
      const authorId = post.author?.id || post.author_id || post.authorId;
      if (authorId) {
        router.push(`/user/${authorId}` as any);
      }
    } else {
      handleCommunityPress();
    }
  };

  const handleShare = async () => {
    if (onPressShare) {
      onPressShare(post);
      return;
    }
    try {
      await Share.share({
        title: post.title || 'Nexus Discussion',
        message: `${post.title ? post.title + '\n\n' : ''}${post.content}\n\nShared via Nexus`,
      });
    } catch {}
  };

  return (
    <View style={[styles.card, style]}>
      {/* Top Header Row: Author/Community PFP + Name on Left, Category/Tags on Right */}
      <View style={styles.communityHeaderRow}>
        <TouchableOpacity
          style={styles.communityInfo}
          onPress={handleHeaderPress}
          activeOpacity={0.75}
        >
          {showAuthor ? (
            !authorImgFailed && authorPic ? (
              <Image
                source={{ uri: authorPic }}
                style={styles.commAvatar}
                onError={() => setAuthorImgFailed(true)}
              />
            ) : (
              <View style={styles.commAvatarFallback}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                  {authorName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )
          ) : (
            !commImgFailed && commPic ? (
              <Image
                source={{ uri: commPic }}
                style={styles.commAvatar}
                onError={() => setCommImgFailed(true)}
              />
            ) : (
              <View style={styles.commAvatarFallback}>
                <MaterialIcons name="groups" size={16} color={colors.primary} />
              </View>
            )
          )}
          <Text style={styles.communityNameText} numberOfLines={1}>
            {showAuthor ? authorName : commDisplayName}
          </Text>
        </TouchableOpacity>

        {categoryBadge ? (
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText} numberOfLines={1}>
              {categoryBadge}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Body: Title + Image (Below Title, Above Description) + Truncated Content */}
      <TouchableOpacity onPress={handlePostPress} activeOpacity={0.85}>
        {post.title ? <Text style={styles.postTitle}>{post.title}</Text> : null}
        {postMedia ? (
          <View style={styles.postMediaContainer}>
            <Image
              source={{ uri: postMedia }}
              style={styles.postMediaImage}
              resizeMode="cover"
            />
          </View>
        ) : null}
        {post.content ? (
          <Text style={styles.postContent} numberOfLines={2}>
            {post.content}
          </Text>
        ) : null}
      </TouchableOpacity>

      {/* Dedicated Tags Row below post content */}
      {tagsList.length > 0 && (
        <View style={styles.tagsRow}>
          {tagsList.slice(0, 3).map((tag: any, idx: number) => {
            const tagName = typeof tag === 'string' ? tag : tag.name || tag.tag?.name;
            if (!tagName) return null;
            return (
              <View key={idx} style={styles.tagBadge}>
                <Text style={styles.tagBadgeText} numberOfLines={1}>
                  #{tagName}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Actions Row: Like, Comment, Bookmark, Share */}
      <View style={styles.actionsRow}>
        <View style={styles.actionGroup}>
          {/* Like */}
          <TouchableOpacity
            style={styles.iconCounter}
            onPress={() => (onToggleLike ? onToggleLike(post.id) : toggleLike(post.id, currentLiked, baseLikes))}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={currentLiked ? 'favorite' : 'favorite-border'}
              size={20}
              color={currentLiked ? colors.primaryContainer : colors.tertiary}
            />
            <Text
              style={[
                styles.counterText,
                currentLiked && { color: colors.primaryContainer, fontWeight: '700' },
              ]}
            >
              {likes}
            </Text>
          </TouchableOpacity>

          {/* Comments */}
          <TouchableOpacity
            style={styles.iconCounter}
            onPress={() => (onPressComment ? onPressComment(post.id) : handlePostPress())}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="chat-bubble-outline"
              size={18}
              color={colors.tertiary}
            />
            <Text style={styles.counterText}>{commentsCount}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionGroup}>
          {isPostEdited ? (
            <Text style={styles.editedText}>(edited)</Text>
          ) : null}

          {/* Bookmark */}
          <TouchableOpacity
            style={styles.iconOnly}
            onPress={() => (onToggleSave ? onToggleSave(post.id) : toggleSave(post.id, currentSaved))}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={currentSaved ? 'bookmark' : 'bookmark-border'}
              size={20}
              color={currentSaved ? colors.primaryContainer : colors.tertiary}
            />
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity
            style={styles.iconOnly}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <MaterialIcons name="share" size={20} color={colors.tertiary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Timestamp below action row */}
      <Text style={styles.timestampText}>
        {formatPostRelativeDate(post.createdAt || post.created_at)}
      </Text>
    </View>
  );
};

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    card: {
      backgroundColor: isDark ? colors.surfaceContainer : colors.tertiaryFixed,
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...Shadows.sm,
    },
    communityHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.xs,
    },
    communityInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      marginRight: Spacing.sm,
    },
    commAvatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.surfaceContainerHigh,
    },
    commAvatarFallback: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: isDark ? 'rgba(232, 167, 54, 0.18)' : 'rgba(232, 167, 54, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(232, 167, 54, 0.35)' : 'rgba(232, 167, 54, 0.25)',
    },
    communityNameText: {
      ...Typography.labelMd,
      color: colors.primary,
      fontWeight: '700',
      letterSpacing: 0.2,
      flex: 1,
    },
    categoryPill: {
      backgroundColor: isDark ? colors.surfaceContainerHigh : colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignSelf: 'center',
    },
    categoryPillText: {
      fontSize: 10,
      color: colors.onSurfaceVariant,
      fontWeight: '700',
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      alignItems: 'center',
      marginTop: 6,
      marginBottom: 2,
    },
    tagBadge: {
      backgroundColor: isDark ? 'rgba(232, 167, 54, 0.16)' : 'rgba(232, 167, 54, 0.10)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(232, 167, 54, 0.30)' : 'rgba(232, 167, 54, 0.20)',
    },
    tagBadgeText: {
      fontSize: 10,
      color: isDark ? '#fbbf24' : '#b45309',
      fontWeight: '700',
    },
    postTitle: {
      ...Typography.labelMd,
      color: colors.onSurface,
      fontWeight: '700',
      marginBottom: 4,
    },
    postMediaContainer: {
      height: 180,
      width: '100%',
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
      backgroundColor: colors.surfaceContainerHigh,
      marginVertical: Spacing.xs,
    },
    postMediaImage: {
      width: '100%',
      height: '100%',
    },
    postContent: {
      ...Typography.bodySm,
      color: colors.onSurfaceVariant,
      lineHeight: 18,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 2,
    },
    actionGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    iconCounter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    counterText: {
      ...Typography.captionSm,
      color: colors.tertiary,
      fontWeight: '600',
    },
    iconOnly: {
      padding: 2,
    },
    editedText: {
      ...Typography.labelSm,
      color: colors.tertiary,
      fontStyle: 'italic',
      alignSelf: 'center',
    },
    timestampText: {
      ...Typography.captionSm,
      color: colors.tertiary,
      fontSize: 11,
      marginTop: -2,
    },
  });
