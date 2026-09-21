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
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
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
  style,
}) => {
  const router = useRouter();
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

  // Tags
  const tagsList = Array.isArray(post.tags) ? post.tags : [];

  // Names and Avatars
  const commDisplayName =
    post.communityName || post.community?.name || 'Nexus Community';
  const commSlug =
    post.communitySlug || post.community?.slug || '';

  const rawCat =
    post.communityCategory ||
    post.community?.category?.name ||
    post.community?.category ||
    post.category;
  const categoryBadge = rawCat ? formatCategoryName(rawCat, true) : '';

  const authorPic =
    post.authorAvatar || post.author?.profile_picture_url;
  const authorDisplayName =
    post.authorName ||
    (post.author
      ? `${post.author.first_name || ''} ${post.author.last_name || ''}`.trim() || 'Member'
      : 'Member');

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
      {/* Top Line: Community Name on Left, Category Pill on Right Edge */}
      <View style={styles.topHeaderRow}>
        <TouchableOpacity
          onPress={handleCommunityPress}
          activeOpacity={0.8}
          style={styles.communityLinkPressable}
        >
          <Text style={styles.communityHeaderText} numberOfLines={1}>
            {commDisplayName}
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

      {/* Author & Right-aligned Tags Row */}
      <View style={styles.authorRow}>
        <View style={styles.authorInfo}>
          {authorPic ? (
            <Image source={{ uri: authorPic }} style={styles.authorAvatar} />
          ) : (
            <View style={styles.authorAvatarFallback}>
              <MaterialIcons name="person" size={18} color={Colors.tertiary} />
            </View>
          )}
          <Text style={styles.authorName} numberOfLines={1}>
            {authorDisplayName}
          </Text>
        </View>

        {tagsList.length > 0 && (
          <View style={styles.tagsWrapper}>
            {tagsList.slice(0, 2).map((tag: any, idx: number) => {
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
              color={currentLiked ? Colors.primaryContainer : Colors.tertiary}
            />
            <Text
              style={[
                styles.counterText,
                currentLiked && { color: Colors.primaryContainer, fontWeight: '700' },
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
              color={Colors.tertiary}
            />
            <Text style={styles.counterText}>{commentsCount}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionGroup}>
          {/* Bookmark */}
          <TouchableOpacity
            style={styles.iconOnly}
            onPress={() => (onToggleSave ? onToggleSave(post.id) : toggleSave(post.id, currentSaved))}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={currentSaved ? 'bookmark' : 'bookmark-border'}
              size={20}
              color={currentSaved ? Colors.primaryContainer : Colors.tertiary}
            />
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity
            style={styles.iconOnly}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <MaterialIcons name="share" size={20} color={Colors.tertiary} />
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadows.sm,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  communityLinkPressable: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  communityHeaderText: {
    ...Typography.captionSm,
    color: Colors.primary,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  categoryPill: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignSelf: 'flex-start',
  },
  categoryPillText: {
    fontSize: 10,
    color: Colors.onSurfaceVariant,
    fontWeight: '700',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  authorAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: {
    ...Typography.captionMd,
    color: Colors.onSurface,
    fontWeight: '600',
    flex: 1,
  },
  tagsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'flex-end',
    maxWidth: 160,
  },
  tagBadge: {
    backgroundColor: 'rgba(232, 167, 54, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  tagBadgeText: {
    fontSize: 10,
    color: Colors.secondary,
    fontWeight: '600',
  },
  postTitle: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    fontWeight: '700',
    marginBottom: 4,
  },
  postMediaContainer: {
    height: 180,
    width: '100%',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceContainerHigh,
    marginVertical: Spacing.xs,
  },
  postMediaImage: {
    width: '100%',
    height: '100%',
  },
  postContent: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
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
    color: Colors.tertiary,
    fontWeight: '600',
  },
  iconOnly: {
    padding: 2,
  },
  timestampText: {
    ...Typography.captionSm,
    color: Colors.tertiary,
    fontSize: 11,
    marginTop: -2,
  },
});
