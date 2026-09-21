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

import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../src/constants/theme';
import { postsService } from '../src/services/posts';
import { communitiesService } from '../src/services/communities';
import { uploadService } from '../src/services/upload';
import { Community } from '../src/types';
import { LoadingSpinner } from '../src/components/ui/LoadingSpinner';
import { extractDirectImageUrl, resolveImageUrl } from '../src/utils/imageUrl';

export default function NewPostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    communityId?: string;
    communitySlug?: string;
    postId?: string;
  }>();

  const isEditing = Boolean(params.postId);
  const isCommunityLocked = Boolean(params.communitySlug || params.communityId || isEditing);

  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [showCommunityPicker, setShowCommunityPicker] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [tags, setTags] = useState<string[]>(['discussion']);
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          accessibilityLabel="Discard post"
        >
          <MaterialIcons name="close" size={24} color={Colors.onSurface} />
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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Community Context Pill */}
        <TouchableOpacity
          style={[styles.communityPill, isCommunityLocked && styles.communityPillLocked]}
          onPress={() => !isCommunityLocked && setShowCommunityPicker(!showCommunityPicker)}
          activeOpacity={isCommunityLocked ? 1 : 0.8}
          disabled={isCommunityLocked}
        >
          <View style={styles.communityIconWrap}>
            <MaterialIcons name="landscape" size={16} color={Colors.onPrimaryContainer} />
          </View>
          <Text style={styles.communityName}>
            {selectedCommunity ? selectedCommunity.name : 'Select a community'}
          </Text>
          {!isCommunityLocked && (
            <MaterialIcons name="arrow-drop-down" size={20} color={Colors.tertiary} />
          )}
        </TouchableOpacity>

        {/* Dropdown for selecting community */}
        {showCommunityPicker && (
          <View style={styles.communityDropdown}>
            {communities.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.dropdownItem,
                  selectedCommunity?.id === c.id && styles.dropdownItemActive,
                ]}
                onPress={() => {
                  setSelectedCommunity(c);
                  setShowCommunityPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    selectedCommunity?.id === c.id && styles.dropdownItemTextActive,
                  ]}
                >
                  {c.name}
                </Text>
                {selectedCommunity?.id === c.id && (
                  <MaterialIcons name="check" size={18} color={Colors.primaryContainer} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        {/* Title Input */}
        <TextInput
          style={styles.titleInput}
          placeholder="Post title"
          placeholderTextColor={Colors.outline}
          value={title}
          onChangeText={setTitle}
          maxLength={200}
          multiline
        />

        {/* Image Attachment Input & Preview — Positioned Below Title and Above Description */}
        <View style={styles.imageInputCard}>
          <Text style={styles.imageInputLabel}>ATTACH IMAGE VIA WEB LINK</Text>
          <View style={styles.urlInputRow}>
            <MaterialIcons name="link" size={20} color={Colors.tertiary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.urlTextInput}
              placeholder="Paste image URL (https://...)"
              placeholderTextColor={Colors.outline}
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
                <MaterialIcons name="close" size={18} color={Colors.tertiary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handlePickImage} style={{ padding: 4 }}>
                <MaterialIcons name="photo-camera" size={20} color={Colors.primaryContainer} />
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
              <MaterialIcons name="close" size={16} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>
        ))}

        {/* Content Body Input — Below Image Attachment */}
        <TextInput
          style={styles.bodyInput}
          placeholder="What's on your mind? Share thoughts, trail notes, or questions..."
          placeholderTextColor={Colors.outline}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.divider} />

        {/* Topic Tags Section */}
        <View style={styles.tagsSection}>
          <Text style={styles.tagsLabel}>Topic Tags</Text>
          <View style={styles.tagsWrapper}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>#{tag}</Text>
                <TouchableOpacity onPress={() => handleRemoveTag(tag)} style={styles.tagRemoveBtn}>
                  <MaterialIcons name="close" size={14} color={Colors.onTertiaryFixedVariant} />
                </TouchableOpacity>
              </View>
            ))}

            {showTagInput ? (
              <View style={styles.newTagInputRow}>
                <TextInput
                  style={styles.newTagInput}
                  placeholder="tag"
                  placeholderTextColor={Colors.outline}
                  value={newTagInput}
                  onChangeText={setNewTagInput}
                  onSubmitEditing={handleAddTag}
                  autoFocus
                />
                <TouchableOpacity onPress={handleAddTag} style={styles.addTagConfirmBtn}>
                  <MaterialIcons name="check" size={16} color={Colors.primaryContainer} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowTagInput(true)}
                style={styles.addTagChip}
              >
                <MaterialIcons name="add" size={16} color={Colors.tertiary} />
                <Text style={styles.addTagText}>Add tag</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Quick Action Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.toolbarIcons}>
          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={handlePickImage}
            accessibilityLabel="Attach photo"
          >
            <MaterialIcons name="image" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerHigh,
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
    color: Colors.onSurface,
    fontWeight: '700',
  },
  postBtn: {
    paddingHorizontal: Spacing.lg,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  postBtnDisabled: {
    opacity: 0.4,
  },
  postBtnText: {
    ...Typography.labelMd,
    color: Colors.onPrimary,
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
    backgroundColor: Colors.surfaceContainerLow,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
  },
  communityPillLocked: {
    backgroundColor: 'rgba(232, 167, 54, 0.12)',
    borderColor: 'rgba(232, 167, 54, 0.3)',
  },
  communityIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityName: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  communityDropdown: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadows.md,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerLow,
  },
  dropdownItemActive: {
    backgroundColor: Colors.surfaceContainerLow,
  },
  dropdownItemText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  dropdownItemTextActive: {
    fontWeight: '600',
    color: Colors.primaryContainer,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceContainerHigh,
    marginVertical: Spacing.md,
  },
  titleInput: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    padding: 0,
    marginBottom: Spacing.sm,
    fontWeight: '700',
  },
  bodyInput: {
    ...Typography.bodyLg,
    color: Colors.onSurface,
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  tagsSection: {
    gap: Spacing.xs,
  },
  tagsLabel: {
    ...Typography.captionSm,
    color: Colors.tertiary,
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
    backgroundColor: Colors.tertiaryFixed,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    height: 32,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  tagText: {
    ...Typography.labelMd,
    color: Colors.onTertiaryFixed,
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
    borderColor: Colors.outlineVariant,
    borderStyle: 'dashed',
    gap: 4,
  },
  addTagText: {
    ...Typography.captionMd,
    color: Colors.tertiary,
  },
  newTagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.primaryContainer,
  },
  newTagInput: {
    ...Typography.captionMd,
    color: Colors.onSurface,
    paddingVertical: 0,
    minWidth: 50,
  },
  addTagConfirmBtn: {
    padding: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surfaceContainerLow,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerHigh,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.sm,
  },
  toolbarIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  toolbarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  draftText: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },
  imageInputCard: {
    marginHorizontal: Spacing.margin,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  imageInputLabel: {
    ...Typography.captionSm,
    color: Colors.tertiary,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  urlTextInput: {
    flex: 1,
    ...Typography.bodyMd,
    color: Colors.onSurface,
    paddingVertical: 0,
  },
});
