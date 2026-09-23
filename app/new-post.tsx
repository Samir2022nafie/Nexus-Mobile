/**
 * New Post Modal — Matches Stitch screen_16_create_post_filled_state.
 * Create discussion with community selector, title, body, image attachment, and tags.
 * Backend: POST /communities/:id/posts
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../src/constants/theme';
import { useTheme, useThemedStyles } from '../src/context/ThemeContext';
import { postsService } from '../src/services/posts';
import { communitiesService } from '../src/services/communities';
import { uploadService } from '../src/services/upload';
import { Community } from '../src/types';
import { LoadingSpinner } from '../src/components/ui/LoadingSpinner';
import { extractDirectImageUrl, resolveImageUrl } from '../src/utils/imageUrl';
import { setCommunitySelectionListener } from '../src/utils/communitySelectionStore';

export default function NewPostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);

  const params = useLocalSearchParams<{
    communityId?: string;
    communitySlug?: string;
    postId?: string;
  }>();

  const isEditing = Boolean(params.postId);
  const isCommunityLocked = Boolean(params.communitySlug || params.communityId || isEditing);

  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [tags, setTags] = useState<string[]>(['discussion']);
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Listen for community selection from the dedicated screen
  useEffect(() => {
    setCommunitySelectionListener((community) => {
      setSelectedCommunity(community);
    });
    return () => {
      setCommunitySelectionListener(null);
    };
  }, []);

  // Load user's communities to pick target, or prefill from existing post
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const list = await communitiesService.list();
        setCommunities(list);

        if (isEditing && params.postId) {
          const post = await postsService.getById(params.postId);
          if (post) {
            setTitle(post.title || '');
            setContent(post.content || '');
            if (post.mediaUrl) {
              setImages([post.mediaUrl]);
              setImageUrlInput(post.mediaUrl);
            }
            if (post.tags && post.tags.length > 0) {
              setTags(post.tags);
            }
            const postCommunityId = (post as any).communityId || post.community?.id;
            const postCommunitySlug = (post as any).communitySlug || post.community?.slug;
            const match = list.find(
              (c) =>
                (postCommunityId && c.id === postCommunityId) ||
                (postCommunitySlug && c.slug === postCommunitySlug)
            );
            if (match) {
              setSelectedCommunity(match);
            } else if (post.community) {
              setSelectedCommunity(post.community as Community);
            }
          }
        } else {
          const targetIdentifier = params.communitySlug || params.communityId;
          if (targetIdentifier) {
            const match = list.find(
              (c) => c.slug === targetIdentifier || c.id === targetIdentifier
            );
            if (match) {
              setSelectedCommunity(match);
            } else if (params.communitySlug) {
              try {
                const fetched = await communitiesService.getBySlug(params.communitySlug);
                if (fetched) setSelectedCommunity(fetched);
              } catch {
                // fallback
              }
            }
          } else if (list.length > 0) {
            setSelectedCommunity(list[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load communities or post details', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [params.communityId, params.communitySlug, params.postId, isEditing]);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setImages((prev) => [...prev, result.assets[0].uri]);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not pick image.');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim().replace(/^#/, '').toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
      setNewTagInput('');
      setShowTagInput(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async () => {
    if (!isEditing && !selectedCommunity) {
      Alert.alert('Required', 'Please select a community to post in.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a post title.');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Required', 'Please enter post content.');
      return;
    }

    setSubmitting(true);
    try {
      // Upload local image if any or use URL directly
      let mediaUrl: string | null | undefined = undefined;
      const rawUri = imageUrlInput.trim() || (images.length > 0 ? images[0] : undefined);
      const effectiveUri = rawUri ? extractDirectImageUrl(rawUri) : undefined;
      if (effectiveUri) {
        if (effectiveUri.startsWith('http')) {
          mediaUrl = effectiveUri;
        } else {
          try {
            const filename = effectiveUri.split('/').pop() || 'post-image.jpg';
            const presigned = await uploadService.getPresignedUrl(filename, 'image/jpeg');
            await uploadService.uploadFile(presigned.uploadUrl, effectiveUri, 'image/jpeg');
            mediaUrl = presigned.publicUrl;
          } catch {
            mediaUrl = effectiveUri;
          }
        }
      } else if (isEditing) {
        mediaUrl = null;
      }

      if (isEditing && params.postId) {
        await postsService.update(params.postId, {
          title: title.trim(),
          content: content.trim(),
          mediaUrl: (mediaUrl ?? null) as any,
          tags: tags.length > 0 ? tags : [],
        });
      } else if (selectedCommunity) {
        await postsService.create(selectedCommunity.slug, {
          title: title.trim(),
          content: content.trim(),
          mediaUrl: (mediaUrl || undefined) as any,
          tags: tags.length > 0 ? tags : undefined,
        });
      }

      router.back();
    } catch (err: any) {
      Alert.alert(isEditing ? 'Update Failed' : 'Post Failed', err?.message || 'Could not save post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading communities..." />;
  }

  const communityAvatarUri =
    selectedCommunity?.profile_picture_url ||
    (selectedCommunity as any)?.profilePictureUrl ||
    selectedCommunity?.banner_url ||
    (selectedCommunity as any)?.bannerUrl;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          accessibilityLabel="Discard post"
        >
          <MaterialIcons name="close" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Post' : 'New Post'}</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting || !title.trim() || !content.trim()}
          style={[
            styles.postBtn,
            (!title.trim() || !content.trim() || submitting) && styles.postBtnDisabled,
          ]}
        >
          <Text style={styles.postBtnText}>
            {submitting ? (isEditing ? 'Saving...' : 'Posting...') : isEditing ? 'Save' : 'Post'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Community Context Pill — Opens dedicated select-community screen */}
        <TouchableOpacity
          style={[styles.communityPill, isCommunityLocked && styles.communityPillLocked]}
          onPress={() => !isCommunityLocked && router.push('/select-community')}
          activeOpacity={isCommunityLocked ? 1 : 0.8}
          disabled={isCommunityLocked}
        >
          {communityAvatarUri ? (
            <Image source={{ uri: communityAvatarUri }} style={styles.communityPillAvatar} />
          ) : (
            <View style={styles.communityPillAvatarFallback}>
              <MaterialIcons name="groups" size={16} color={colors.primary} />
            </View>
          )}
          <Text style={styles.communityName}>
            {selectedCommunity ? selectedCommunity.name : 'Select a community'}
          </Text>
          {!isCommunityLocked && (
            <MaterialIcons name="arrow-drop-down" size={20} color={colors.tertiary} />
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Title Input */}
        <TextInput
          style={styles.titleInput}
          placeholder="Post title"
          placeholderTextColor={colors.outline}
          value={title}
          onChangeText={setTitle}
          maxLength={200}
          multiline
        />

        {/* Content Body Input — Below Title */}
        <TextInput
          style={styles.bodyInput}
          placeholder="What's on your mind? Share thoughts, trail notes, or questions..."
          placeholderTextColor={colors.outline}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />

        {/* Image Attachment Input & Preview — Moved Below Content Body */}
        <View style={styles.imageInputCard}>
          <Text style={styles.imageInputLabel}>ATTACH IMAGE VIA WEB LINK</Text>
          <View style={styles.urlInputRow}>
            <MaterialIcons name="link" size={20} color={colors.tertiary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.urlTextInput}
              placeholder="Paste image URL (https://...)"
              placeholderTextColor={colors.outline}
              value={imageUrlInput}
              onChangeText={(text) => {
                setImageUrlInput(text);
                if (!text.trim()) {
                  setImages([]);
                  return;
                }
                const direct = extractDirectImageUrl(text);
                if (direct.startsWith('http')) {
                  setImages([direct]);
                }
                if (text.trim().startsWith('http') && !/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(text.trim())) {
                  resolveImageUrl(text.trim()).then((resolved) => {
                    if (resolved && resolved.startsWith('http')) {
                      setImages([resolved]);
                    }
                  });
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {imageUrlInput.length > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  setImageUrlInput('');
                  setImages([]);
                }}
                style={{ padding: 4 }}
              >
                <MaterialIcons name="close" size={18} color={colors.tertiary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handlePickImage} style={{ padding: 4 }}>
                <MaterialIcons name="photo-camera" size={20} color={colors.primaryContainer} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Image Previews */}
        {images.map((uri, idx) => (
          <View key={uri} style={styles.imagePreviewContainer}>
            <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => {
                handleRemoveImage(idx);
                setImageUrlInput('');
              }}
              accessibilityLabel="Remove image"
            >
              <MaterialIcons name="close" size={16} color={colors.onSurface} />
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.divider} />

        {/* Topic Tags Section */}
        <View style={styles.tagsSection}>
          <Text style={styles.tagsLabel}>Topic Tags</Text>
          <View style={styles.tagsWrapper}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>#{tag}</Text>
                <TouchableOpacity onPress={() => handleRemoveTag(tag)} style={styles.tagRemoveBtn}>
                  <MaterialIcons name="close" size={14} color={colors.onTertiaryFixedVariant} />
                </TouchableOpacity>
              </View>
            ))}

            {showTagInput ? (
              <View style={styles.newTagInputRow}>
                <TextInput
                  style={styles.newTagInput}
                  placeholder="tag"
                  placeholderTextColor={colors.outline}
                  value={newTagInput}
                  onChangeText={setNewTagInput}
                  onSubmitEditing={handleAddTag}
                  autoFocus
                />
                <TouchableOpacity onPress={handleAddTag} style={styles.addTagConfirmBtn}>
                  <MaterialIcons name="check" size={16} color={colors.primaryContainer} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowTagInput(true)}
                style={styles.addTagChip}
              >
                <MaterialIcons name="add" size={16} color={colors.tertiary} />
                <Text style={styles.addTagText}>Add tag</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.margin,
      paddingVertical: Spacing.sm,
      backgroundColor: colors.surfaceContainerLow,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    closeBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    headerTitle: {
      ...Typography.headlineSm,
      color: colors.onSurface,
      fontWeight: '700',
    },
    postBtn: {
      paddingHorizontal: Spacing.lg,
      height: 36,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.sm,
    },
    postBtnDisabled: {
      opacity: 0.4,
    },
    postBtnText: {
      ...Typography.labelMd,
      color: colors.onPrimary,
      fontWeight: '700',
    },
    scrollArea: {
      flex: 1,
    },
    content: {
      padding: Spacing.margin,
    },
    communityPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.surfaceContainerLow,
      paddingVertical: 5,
      paddingLeft: 6,
      paddingRight: Spacing.md,
      borderRadius: BorderRadius.full,
      gap: Spacing.xs,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    communityPillLocked: {
      backgroundColor: isDark ? 'rgba(232, 167, 54, 0.2)' : 'rgba(232, 167, 54, 0.12)',
      borderColor: 'rgba(232, 167, 54, 0.3)',
    },
    communityPillAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.surfaceContainerHigh,
    },
    communityPillAvatarFallback: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(232, 167, 54, 0.2)' : '#fef3c7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    communityName: {
      ...Typography.labelMd,
      color: colors.onSurface,
      fontWeight: '600',
    },
    divider: {
      height: 1,
      backgroundColor: colors.cardBorder,
      marginVertical: Spacing.md,
    },
    titleInput: {
      ...Typography.headlineSm,
      color: colors.onSurface,
      padding: 0,
      marginBottom: Spacing.sm,
      fontWeight: '700',
    },
    bodyInput: {
      ...Typography.bodyLg,
      color: colors.onSurface,
      padding: 0,
      minHeight: 140,
      lineHeight: 24,
    },
    imagePreviewContainer: {
      position: 'relative',
      height: 200,
      borderRadius: BorderRadius.xl,
      overflow: 'hidden',
      marginTop: Spacing.sm,
      marginBottom: Spacing.sm,
      ...Shadows.sm,
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    removeImageBtn: {
      position: 'absolute',
      top: Spacing.sm,
      right: Spacing.sm,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(30, 26, 23, 0.85)' : 'rgba(255,255,255,0.9)',
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.sm,
    },
    tagsSection: {
      gap: Spacing.xs,
    },
    tagsLabel: {
      ...Typography.captionSm,
      color: colors.tertiary,
      marginBottom: 4,
    },
    tagsWrapper: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    tagChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceContainerHigh,
      paddingLeft: Spacing.md,
      paddingRight: Spacing.xs,
      height: 32,
      borderRadius: BorderRadius.full,
      gap: 4,
    },
    tagText: {
      ...Typography.labelMd,
      color: colors.onSurface,
    },
    tagRemoveBtn: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addTagChip: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 32,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderStyle: 'dashed',
      gap: 4,
    },
    addTagText: {
      ...Typography.captionMd,
      color: colors.tertiary,
    },
    newTagInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 32,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: colors.primaryContainer,
    },
    newTagInput: {
      ...Typography.captionMd,
      color: colors.onSurface,
      paddingVertical: 0,
      minWidth: 50,
    },
    addTagConfirmBtn: {
      padding: 2,
    },
    imageInputCard: {
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    imageInputLabel: {
      ...Typography.captionSm,
      color: colors.tertiary,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    urlInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    urlTextInput: {
      flex: 1,
      ...Typography.bodyMd,
      color: colors.onSurface,
      paddingVertical: 0,
    },
  });
