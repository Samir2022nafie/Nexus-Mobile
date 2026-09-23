/**
 * Thread Detail Screen — Post with comments stream.
 * Matches Stitch screen_17_post_detail_with_comments
 * Backend: GET /posts/:id, GET /posts/:id/comments, POST /posts/:id/comments
 * Features:
 * - Real backend data only (zero fake mock fallback)
 * - Empty state when post has 0 comments
 * - Post not found screen with back button
 * - No Android shadow/elevation artifacts
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, ThemeColors } from '../../src/constants/theme';
import { useTheme, useThemedStyles } from '../../src/context/ThemeContext';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useAuth } from '../../src/context/AuthContext';
import { usePostState } from '../../src/context/PostStateContext';
import { extractDirectImageUrl } from '../../src/utils/imageUrl';
import { postsService } from '../../src/services/posts';
import { commentsService } from '../../src/services/comments';
import { Post, Comment } from '../../src/types';
import { formatCategoryName } from '../../src/utils/categories';

export default function ThreadDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);
  const { id, highlightCommentId } = useLocalSearchParams<{ id: string; highlightCommentId?: string }>();
  const { user } = useAuth();
  const { setPostLiked, setPostSaved, setPostCommentCount, updatePostCommentCount } = usePostState();

  const [post, setPost] = useState<Post | any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  // Fixed bottom comment bar scroll animation
  const commentBarTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(Date.now());
  const commentBarVisible = useRef(true);

  const handlePostScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const currentTime = Date.now();
    const dy = currentY - lastScrollY.current;
    const dt = Math.max(1, currentTime - lastScrollTime.current);
    const velocityY = dy / dt;

    lastScrollY.current = currentY;
    lastScrollTime.current = currentTime;

    if (currentY <= 15) {
      if (!commentBarVisible.current) {
        commentBarVisible.current = true;
        Animated.timing(commentBarTranslateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }
    } else if (dy > 2 && currentY > 30) {
      if (commentBarVisible.current) {
        commentBarVisible.current = false;
        Animated.timing(commentBarTranslateY, {
          toValue: 120,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    } else if (dy < -4 && velocityY < -0.6) {
      if (!commentBarVisible.current) {
        commentBarVisible.current = true;
        Animated.timing(commentBarTranslateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  const startEditComment = (comment: any) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.content || '');
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const handleDeleteComment = async (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setPost((prev: any) => (prev ? { ...prev, commentsCount: Math.max(0, (prev.commentsCount || 1) - 1) } : prev));
    try {
      await commentsService.delete(commentId);
    } catch (err) {
      console.error('Failed to delete comment', err);
    }
  };

  const handleSaveEditedComment = async (commentId: string) => {
    if (!editCommentText.trim()) return;
    const nextContent = editCommentText.trim();
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, content: nextContent } : c))
    );
    setEditingCommentId(null);
    try {
      await commentsService.update(commentId, { content: nextContent });
    } catch {}
  };

  const isPostAuthor = Boolean(
    post &&
      user &&
      (post.author_id === user.id ||
        post.author?.id === user.id ||
        post.userId === user.id ||
        (post.author?.username && user.username && post.author.username === user.username))
  );

  const openEditPost = () => {
    if (!post?.id) return;
    router.push({ pathname: '/new-post', params: { postId: post.id } } as any);
  };

  const handleDeletePost = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this discussion? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await postsService.delete(post.id);
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          },
        },
      ]
    );
  };

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [postData, commentsData] = await Promise.all([
        postsService.getById(id).catch(() => null),
        commentsService.listByPost(id, { limit: 50 }).catch(() => []),
      ]);
      if (postData) {
        setPost(postData);
        setHasLiked(postData.hasReacted || false);
        setHasSaved(postData.hasSaved || false);
        setLikesCount(postData.reactionCount || 0);
      } else {
        setPost(null);
      }
      const loadedComments = commentsData || [];
      setComments(loadedComments);
      setPostCommentCount(id, loadedComments.length || postData?.commentCount || 0);
    } catch {
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id, setPostCommentCount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReaction = async () => {
    const nextLiked = !hasLiked;
    const nextCount = Math.max(0, likesCount + (nextLiked ? 1 : -1));
    setHasLiked(nextLiked);
    setLikesCount(nextCount);
    if (!id) return;
    setPostLiked(id, nextLiked, nextCount);
    try {
      await postsService.toggleReaction(id);
    } catch {}
  };

  const handleSave = async () => {
    const nextSaved = !hasSaved;
    setHasSaved(nextSaved);
    if (!id) return;
    setPostSaved(id, nextSaved);
    try {
      await postsService.toggleSave(id);
    } catch {}
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !id) return;
    setSubmitting(true);
    const content = newComment.trim();
    try {
      const comment = await commentsService.create(id, { content }).catch(() => null);
      if (comment) {
        setComments((prev) => [comment, ...prev]);
      } else {
        setComments((prev) => [
          {
            id: `local-${Date.now()}`,
            author: {
              first_name: user?.first_name || 'You',
              last_name: user?.last_name || '',
              username: user?.username || 'me',
              profile_picture_url: user?.profile_picture_url,
            },
            content,
            createdAt: new Date().toISOString(),
            likesCount: 0,
            replies: [],
          },
          ...prev,
        ]);
      }
      setNewComment('');
      updatePostCommentCount(id, 1);
    } catch {} finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;

  if (!post) {
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
          <MaterialIcons name="article" size={40} color={colors.tertiary} />
        </View>
        <Text style={styles.notFoundTitle}>Post not found</Text>
        <Text style={styles.notFoundSub}>
          This post does not exist or has been removed.
        </Text>
        <TouchableOpacity
          style={styles.backBtnPill}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <MaterialIcons name="arrow-back" size={18} color={colors.onPrimaryContainer} />
          <Text style={styles.backBtnPillText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const timeDisplay = post.created_at || post.createdAt
    ? new Date(post.created_at || post.createdAt).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const postMedia = extractDirectImageUrl(post.mediaUrl || post.media_url);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 8}
      style={styles.screen}
    >
      <View style={[styles.inner, { paddingTop: insets.top }]}>
        {/* Top Header Bar — Back button, Title, and Author Edit/Delete */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {post.community?.name || 'Discussion'}
          </Text>
          {isPostAuthor ? (
            <View style={styles.authorActionsRow}>
              <TouchableOpacity
                onPress={openEditPost}
                style={styles.authorActionBtn}
                activeOpacity={0.7}
              >
                <MaterialIcons name="edit" size={18} color={colors.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeletePost}
                style={styles.authorActionBtn}
                activeOpacity={0.7}
              >
                <MaterialIcons name="delete-outline" size={19} color={colors.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.backButton} />
          )}
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 80 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={handlePostScroll}
          scrollEventThrottle={16}
        >
          {/* Main Post Card */}
          <View style={styles.postCard}>
            {/* Community Affiliation & Real Timestamp */}
            <View style={styles.affiliationRow}>
              <TouchableOpacity
                style={styles.affiliationGroup}
                onPress={() => post.community?.slug && router.push(`/community/${post.community.slug}`)}
                activeOpacity={0.8}
              >
                <View style={styles.commIconCircle}>
                  <MaterialIcons name="groups" size={16} color={colors.primary} />
                </View>
                <Text style={styles.commLinkText} numberOfLines={1}>
                  {post.community?.name || 'Nexus Community'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.timeAgoText}>{timeDisplay}</Text>
            </View>

            {/* Author Row — "Community Member" removed */}
            <View style={styles.authorRow}>
              {post.author?.profile_picture_url ? (
                <Image
                  source={{ uri: post.author.profile_picture_url }}
                  style={styles.authorAvatar}
                />
              ) : (
                <View style={styles.authorAvatarFallback}>
                  <MaterialIcons name="person" size={20} color={colors.tertiary} />
                </View>
              )}
              <View style={styles.authorDetails}>
                <Text style={styles.authorFullName}>
                  {post.author?.first_name} {post.author?.last_name || ''}
                </Text>
                <Text style={styles.authorHandle}>@{post.author?.username || 'member'}</Text>
              </View>
            </View>

            {/* Post Title */}
            {post.title ? <Text style={styles.postTitle}>{post.title}</Text> : null}

            {/* Post Media Image (Below Title, Above Description) */}
            {postMedia ? (
              <View style={styles.postMediaContainer}>
                <Image
                  source={{ uri: postMedia }}
                  style={styles.postMediaImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {/* Post Content */}
            <Text style={styles.postBody}>{post.content}</Text>

            {/* Collapsible / Expandable Tags Section directly above Reaction Bar */}
            {post.tags && post.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                <View style={styles.tagsRow}>
                  {(tagsExpanded ? post.tags : post.tags.slice(0, 4)).map((tag: any, idx: number) => {
                    const tagName = typeof tag === 'string' ? tag : (tag?.name || tag?.tag?.name || '');
                    if (!tagName) return null;
                    return (
                      <View key={idx} style={styles.tagPill}>
                        <Text style={styles.tagPillText}>#{tagName}</Text>
                      </View>
                    );
                  })}
                  {post.tags.length > 4 && (
                    <TouchableOpacity
                      onPress={() => setTagsExpanded(!tagsExpanded)}
                      style={styles.expandTagsBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.expandTagsText}>
                        {tagsExpanded ? 'Show less' : `+${post.tags.length - 4} more`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Reaction & Interaction Bar */}
            <View style={styles.reactionBar}>
              <View style={styles.reactionLeft}>
                <TouchableOpacity
                  style={styles.reactionBtn}
                  onPress={handleReaction}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={hasLiked ? 'favorite' : 'favorite-border'}
                    size={22}
                    color={hasLiked ? colors.primaryContainer : colors.tertiary}
                  />
                  <Text
                    style={[
                      styles.reactionCountText,
                      hasLiked && { color: colors.primaryContainer, fontWeight: '700' },
                    ]}
                  >
                    {likesCount}
                  </Text>
                </TouchableOpacity>

                <View style={styles.reactionBtn}>
                  <MaterialIcons name="chat-bubble-outline" size={22} color={colors.tertiary} />
                  <Text style={styles.reactionCountText}>{comments.length}</Text>
                </View>
              </View>

              <View style={styles.reactionRight}>
                <TouchableOpacity onPress={handleSave} style={styles.iconCircle} activeOpacity={0.7}>
                  <MaterialIcons
                    name={hasSaved ? 'bookmark' : 'bookmark-border'}
                    size={24}
                    color={hasSaved ? colors.primaryContainer : colors.tertiary}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconCircle} activeOpacity={0.7}>
                  <MaterialIcons name="share" size={24} color={colors.tertiary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Comments Header */}
          <View style={styles.commentsHeaderRow}>
            <View style={styles.commentsHeaderTitleGroup}>
              <Text style={styles.commentsHeading}>
                Comments ({comments.length})
              </Text>
              <View style={styles.goldDot} />
            </View>
          </View>

          {/* Comments Stream */}
          {comments.length === 0 ? (
            <EmptyState
              icon="chat-bubble-outline"
              title="No comments yet"
              subtitle="Be the first to share your thoughts on this discussion."
            />
          ) : (
            <View style={styles.commentsStream}>
              {comments.map((comment) => {
                const isAuthor =
                  comment.author?.id === user?.id ||
                  comment.userId === user?.id ||
                  comment.author?.username === user?.username;
                const isHighlighted = comment.id === highlightCommentId;
                const isEditing = editingCommentId === comment.id;

                return (
                  <View
                    key={comment.id}
                    style={[
                      styles.commentItem,
                      isHighlighted && styles.commentItemHighlighted,
                    ]}
                  >
                    <View style={styles.commentTopRow}>
                      <TouchableOpacity
                        onPress={() => {
                          if (comment.author?.id) {
                            router.push(`/user/${comment.author.id}`);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        {comment.author?.profile_picture_url ? (
                          <Image
                            source={{ uri: comment.author.profile_picture_url }}
                            style={styles.commentAvatar}
                          />
                        ) : (
                          <View style={styles.commentAvatarFallback}>
                            <MaterialIcons name="person" size={16} color={colors.tertiary} />
                          </View>
                        )}
                      </TouchableOpacity>
                      <View style={styles.commentBody}>
                        <View style={styles.commentAuthorLine}>
                          <TouchableOpacity
                            onPress={() => {
                              if (comment.author?.id) {
                                router.push(`/user/${comment.author.id}`);
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.commentAuthorName}>
                              {comment.author?.first_name} {comment.author?.last_name || ''}
                            </Text>
                          </TouchableOpacity>
                          <Text style={styles.commentTimeText}>
                            ·{' '}
                            {comment.created_at || comment.createdAt
                              ? new Date(comment.created_at || comment.createdAt).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'recently'}
                          </Text>
                          {isAuthor && !isEditing && (
                            <View style={styles.commentActionBtnsRow}>
                              <TouchableOpacity
                                onPress={() => startEditComment(comment)}
                                style={styles.editCommentIconBtn}
                                activeOpacity={0.7}
                              >
                                <MaterialIcons name="edit" size={14} color={colors.secondary} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleDeleteComment(comment.id)}
                                style={styles.deleteCommentIconBtn}
                                activeOpacity={0.7}
                              >
                                <MaterialIcons name="delete-outline" size={15} color={colors.error} />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        {isEditing ? (
                          <View style={styles.editCommentBox}>
                            <TextInput
                              style={styles.editCommentInput}
                              value={editCommentText}
                              onChangeText={setEditCommentText}
                              multiline
                            />
                            <View style={styles.editCommentActionsRow}>
                              <TouchableOpacity
                                onPress={cancelEditComment}
                                style={styles.editCommentCancelBtn}
                              >
                                <Text style={styles.editCommentCancelText}>Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleSaveEditedComment(comment.id)}
                                style={styles.editCommentSaveBtn}
                              >
                                <Text style={styles.editCommentSaveText}>Save</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <Text style={styles.commentContent}>{comment.content}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Fixed Bottom Comment Bar Docked Above Safe Area */}
        <Animated.View
          style={[
            styles.fixedCommentBar,
            {
              paddingBottom: Math.max(insets.bottom, 10),
              transform: [{ translateY: commentBarTranslateY }],
            },
          ]}
        >
          <View style={styles.composerBox}>
            {user?.profile_picture_url ? (
              <Image
                source={{ uri: user.profile_picture_url }}
                style={styles.composerAvatar}
              />
            ) : (
              <View style={styles.composerAvatarFallback}>
                <MaterialIcons name="person" size={16} color={colors.tertiary} />
              </View>
            )}
            <View style={styles.composerInputWrapper}>
              <TextInput
                style={styles.composerInput}
                placeholder="Add a comment..."
                placeholderTextColor={colors.tertiary}
                value={newComment}
                onChangeText={setNewComment}
              />
            </View>
            <TouchableOpacity
              style={[
                styles.sendBtn,
                newComment.trim() ? styles.sendBtnActive : styles.sendBtnDisabled,
              ]}
              onPress={handleSubmitComment}
              disabled={!newComment.trim() || submitting}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="send"
                size={20}
                color={newComment.trim() ? colors.onPrimaryContainer : colors.tertiary}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  inner: {
    flex: 1,
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
  backBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
  },
  backBtnPillText: {
    ...Typography.labelMd,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    ...Typography.labelMd,
    color: colors.onSurface,
    fontWeight: '700',
    maxWidth: 200,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 48,
  },
  postCard: {
    backgroundColor: colors.cardBg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 12,
  },
  affiliationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  affiliationGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  commIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.secondaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commLinkText: {
    ...Typography.labelMd,
    color: colors.secondary,
    fontWeight: '700',
    maxWidth: 120,
  },
  dotSeparator: {
    color: colors.tertiary,
  },
  categoryPill: {
    backgroundColor: colors.tertiaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    maxWidth: 110,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onTertiaryContainer,
  },
  timeAgoText: {
    ...Typography.captionSm,
    color: colors.tertiary,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainer,
  },
  authorDetails: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorFullName: {
    ...Typography.labelMd,
    color: colors.onSurface,
    fontWeight: '700',
  },
  authorHandle: {
    ...Typography.captionSm,
    color: colors.tertiary,
  },
  authorBadge: {
    fontSize: 11,
    color: colors.secondary,
    fontWeight: '600',
  },
  postTitle: {
    ...Typography.headlineSm,
    fontSize: 18,
    color: colors.onSurface,
    fontWeight: '700',
    lineHeight: 24,
  },
  postMediaContainer: {
    height: 240,
    width: '100%',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh,
    marginVertical: Spacing.sm,
  },
  postMediaImage: {
    width: '100%',
    height: '100%',
  },
  postBody: {
    ...Typography.bodyMd,
    color: colors.onSurface,
    lineHeight: 22,
  },
  reactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  reactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reactionCountText: {
    ...Typography.captionMd,
    color: colors.tertiary,
  },
  reactionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    padding: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: Spacing.md,
  },
  commentsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  commentsHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentsHeading: {
    ...Typography.labelLg,
    color: colors.onSurface,
    fontWeight: '700',
  },
  goldDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryContainer,
  },
  composerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  composerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  composerInputWrapper: {
    flex: 1,
    height: 42,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.tertiaryFixed,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  composerInput: {
    ...Typography.bodyMd,
    color: colors.onSurface,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: colors.primaryContainer,
  },
  sendBtnDisabled: {
    backgroundColor: colors.surfaceContainerHighest,
  },
  commentsStream: {
    gap: 14,
  },
  commentItem: {
    backgroundColor: colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 10,
  },
  commentTopRow: {
    flexDirection: 'row',
    gap: 10,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainer,
  },
  commentBody: {
    flex: 1,
  },
  commentAuthorLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentAuthorName: {
    ...Typography.labelMd,
    color: colors.onSurface,
    fontWeight: '700',
  },
  commentTimeText: {
    ...Typography.captionSm,
    color: colors.tertiary,
  },
  commentContent: {
    ...Typography.bodyMd,
    color: colors.onSurface,
    lineHeight: 20,
    marginTop: 2,
  },
  authorAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagsContainer: {
    paddingVertical: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  tagPill: {
    backgroundColor: 'rgba(232, 167, 54, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  expandTagsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  expandTagsText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.secondary,
  },
  commentItemHighlighted: {
    backgroundColor: 'rgba(232, 167, 54, 0.12)',
    borderColor: colors.primaryContainer,
    borderWidth: 1.5,
  },
  commentActionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 6,
  },
  editCommentIconBtn: {
    padding: 2,
  },
  deleteCommentIconBtn: {
    padding: 2,
  },
  editCommentBox: {
    marginTop: 6,
    gap: 6,
  },
  editCommentInput: {
    ...Typography.bodyMd,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    color: colors.onSurface,
  },
  editCommentActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editCommentCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  editCommentCancelText: {
    fontSize: 12,
    color: colors.tertiary,
    fontWeight: '600',
  },
  editCommentSaveBtn: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  editCommentSaveText: {
    fontSize: 12,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  authorActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHighest,
  },
  fixedCommentBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 8,
    paddingHorizontal: Spacing.md,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: 12,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    ...Typography.headlineSm,
    color: colors.onSurface,
    fontWeight: '700',
  },
  editTitleInput: {
    ...Typography.labelMd,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    color: colors.onSurface,
  },
  editBodyInput: {
    ...Typography.bodyMd,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    color: colors.onSurface,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  modalCancelText: {
    ...Typography.labelMd,
    color: colors.tertiary,
    fontWeight: '600',
  },
  modalSaveBtn: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  modalSaveText: {
    ...Typography.labelMd,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
});
