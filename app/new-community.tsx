/**
 * New Community Screen — Create a community modal.
 * Matches Stitch create modal aesthetics
 * Backend: POST /communities
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../src/constants/theme';
import { useTheme, useThemedStyles } from '../src/context/ThemeContext';
import { Button } from '../src/components/ui/Button';
import { communitiesService } from '../src/services/communities';
import { ApiRequestError } from '../src/services/api';
import { BACKEND_CATEGORIES } from '../src/utils/categories';
import { extractDirectImageUrl, resolveImageUrl } from '../src/utils/imageUrl';

export default function NewCommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);
  const params = useLocalSearchParams<{ slug?: string }>();
  const isEditing = Boolean(params.slug);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    rules: '',
    categoryId: BACKEND_CATEGORIES[0].id,
    profilePictureUrl: '',
    bannerUrl: '',
    isPrivate: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [generalError, setGeneralError] = useState('');

  useEffect(() => {
    if (!isEditing || !params.slug) return;
    communitiesService
      .getBySlug(params.slug)
      .then((c) => {
        if (c) {
          setForm({
            name: c.name || '',
            slug: c.slug || '',
            description: c.description || '',
            rules: c.rules || '',
            categoryId: (c as any).category_id || (c as any).categoryId || BACKEND_CATEGORIES[0].id,
            profilePictureUrl: c.profile_picture_url || (c as any).profilePictureUrl || '',
            bannerUrl: c.banner_url || (c as any).bannerUrl || '',
            isPrivate: Boolean(c.is_private ?? (c as any).isPrivate),
          });
        }
      })
      .catch(() => {
        setGeneralError('Could not load community details');
      })
      .finally(() => {
        setInitialLoading(false);
      });
  }, [params.slug, isEditing]);

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
    if (field === 'name' && !isEditing) {
      setForm((prev) => ({
        ...prev,
        slug: (value as string)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
      }));
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Community name is required';
    if (!isEditing) {
      if (!form.slug.trim()) errs.slug = 'Slug is required';
      if (!/^[a-z0-9-]+$/.test(form.slug))
        errs.slug = 'Only lowercase letters, numbers, and hyphens';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setGeneralError('');
    try {
      if (isEditing && params.slug) {
        await communitiesService.update(params.slug, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          rules: form.rules.trim() || undefined,
          isPrivate: form.isPrivate,
          profilePictureUrl: form.profilePictureUrl.trim() || undefined,
          bannerUrl: form.bannerUrl.trim() || undefined,
        } as any);
      } else {
        await communitiesService.create({
          name: form.name.trim(),
          slug: form.slug.trim(),
          description: form.description.trim() || undefined,
          rules: form.rules.trim() || undefined,
          isPrivate: form.isPrivate,
          categoryId: form.categoryId,
          profilePictureUrl: form.profilePictureUrl.trim() || undefined,
          bannerUrl: form.bannerUrl.trim() || undefined,
        });
      }
      router.back();
    } catch (err) {
      if (err instanceof ApiRequestError && err.details) {
        const fieldErrors: Record<string, string> = {};
        err.details.forEach((d) => {
          fieldErrors[d.path[0]] = d.message;
        });
        setErrors(fieldErrors);
      } else {
        setGeneralError(
          err instanceof ApiRequestError ? err.message : isEditing ? 'Failed to update community' : 'Failed to create community'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="close" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{isEditing ? 'Edit Community' : 'New Community'}</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={styles.createBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.createText}>
            {loading ? 'Saving...' : isEditing ? 'Save' : 'Create'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {generalError ? (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error" size={18} color={colors.error} />
            <Text style={styles.errorText}>{generalError}</Text>
          </View>
        ) : null}

        {/* Community Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>COMMUNITY NAME</Text>
          <View style={[styles.inputBox, errors.name && styles.inputBoxError]}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Trail Blazers"
              placeholderTextColor={colors.outline}
              value={form.name}
              onChangeText={(v) => updateField('name', v)}
            />
            <MaterialIcons name="groups" size={20} color={colors.tertiary} />
          </View>
          {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
        </View>

        {/* URL Slug */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>URL SLUG</Text>
          <View style={[styles.inputBox, errors.slug && styles.inputBoxError]}>
            <TextInput
              style={styles.textInput}
              placeholder="trail-blazers"
              placeholderTextColor={colors.outline}
              value={form.slug}
              onChangeText={(v) => updateField('slug', v)}
              autoCapitalize="none"
            />
            <MaterialIcons name="link" size={20} color={colors.tertiary} />
          </View>
          <Text style={styles.hintText}>nexus.app/community/{form.slug || 'slug'}</Text>
          {errors.slug ? <Text style={styles.errorText}>{errors.slug}</Text> : null}
        </View>

        {/* Category Selector Chips */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>CATEGORY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryChipsRow}
          >
            {BACKEND_CATEGORIES.map((cat) => {
              const isSelected = form.categoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catChip, isSelected && styles.catChipActive]}
                  onPress={() => updateField('categoryId', cat.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.catChipText, isSelected && styles.catChipTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Description */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>DESCRIPTION</Text>
          <View style={[styles.inputBox, styles.textAreaBox]}>
            <TextInput
              style={[styles.textInput, styles.textAreaInput]}
              placeholder="What is this community about? Who is it for?"
              placeholderTextColor={colors.outline}
              value={form.description}
              onChangeText={(v) => updateField('description', v)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Community Rules */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>COMMUNITY RULES (OPTIONAL)</Text>
          <View style={[styles.inputBox, styles.textAreaBox]}>
            <TextInput
              style={[styles.textInput, styles.textAreaInput]}
              placeholder="Guidelines for members to keep discussions friendly..."
              placeholderTextColor={colors.outline}
              value={form.rules}
              onChangeText={(v) => updateField('rules', v)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Profile Picture (Avatar) URL */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>PROFILE PICTURE URL (OPTIONAL)</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="https://example.com/avatar.jpg"
              placeholderTextColor={colors.outline}
              value={form.profilePictureUrl}
              onChangeText={(v) => {
                const direct = extractDirectImageUrl(v);
                updateField('profilePictureUrl', direct);
                if (v.trim().startsWith('http') && !/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(v.trim())) {
                  resolveImageUrl(v.trim()).then((resolved) => {
                    if (resolved && resolved.startsWith('http')) {
                      updateField('profilePictureUrl', resolved);
                    }
                  });
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <MaterialIcons name="image" size={20} color={colors.tertiary} />
          </View>
          {form.profilePictureUrl.trim().startsWith('http') ? (
            <View style={styles.avatarPreviewBox}>
              <Image source={{ uri: form.profilePictureUrl.trim() }} style={styles.avatarPreviewImg} resizeMode="cover" />
              <Text style={styles.previewSuccessText}>Avatar Preview</Text>
            </View>
          ) : null}
        </View>

        {/* Banner Picture URL */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>BANNER PICTURE URL (OPTIONAL)</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="https://example.com/banner.jpg"
              placeholderTextColor={colors.outline}
              value={form.bannerUrl}
              onChangeText={(v) => {
                const direct = extractDirectImageUrl(v);
                updateField('bannerUrl', direct);
                if (v.trim().startsWith('http') && !/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(v.trim())) {
                  resolveImageUrl(v.trim()).then((resolved) => {
                    if (resolved && resolved.startsWith('http')) {
                      updateField('bannerUrl', resolved);
                    }
                  });
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <MaterialIcons name="add-photo-alternate" size={20} color={colors.tertiary} />
          </View>
          {form.bannerUrl.trim().startsWith('http') ? (
            <View style={styles.bannerPreviewBox}>
              <Image source={{ uri: form.bannerUrl.trim() }} style={styles.bannerPreviewImg} resizeMode="cover" />
              <Text style={styles.previewSuccessText}>Banner Preview</Text>
            </View>
          ) : null}
        </View>

        {/* Privacy Toggle Card */}
        <View style={styles.privacyCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.privacyTitle}>Private Community</Text>
            <Text style={styles.privacySubtitle}>
              Only approved members can view and participate in discussions
            </Text>
          </View>
          <Switch
            value={form.isPrivate}
            onValueChange={(v) => updateField('isPrivate', v)}
            trackColor={{ false: colors.surfaceVariant, true: colors.primaryContainer }}
            thumbColor={colors.white}
          />
        </View>

        <Button
          title={isEditing ? 'Save Changes' : 'Create Community'}
          onPress={handleSubmit}
          loading={loading}
          fullWidth
          size="lg"
          style={{ marginTop: Spacing.md }}
        />
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
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    backgroundColor: colors.surface,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    ...Typography.headlineSm,
    color: colors.onSurface,
  },
  createBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.primaryContainer,
  },
  createText: {
    ...Typography.labelMd,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 48,
    gap: Spacing.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: colors.errorContainer,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  errorText: {
    ...Typography.captionMd,
    color: colors.onErrorContainer,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.tertiary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingLeft: 4,
  },
  inputBox: {
    height: 48,
    borderRadius: BorderRadius.xl,
    backgroundColor: colors.tertiaryFixed,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    ...Shadows.sm,
  },
  inputBoxError: {
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  textInput: {
    flex: 1,
    height: '100%',
    ...Typography.bodyMd,
    color: colors.onSurface,
  },
  textAreaBox: {
    height: 96,
    paddingVertical: 10,
  },
  textAreaInput: {
    height: '100%',
    lineHeight: 20,
  },
  hintText: {
    ...Typography.captionSm,
    color: colors.tertiary,
    paddingLeft: 4,
  },
  categoryChipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.surfaceContainer,
  },
  catChipActive: {
    backgroundColor: colors.primaryContainer,
    ...Shadows.sm,
  },
  catChipText: {
    ...Typography.captionMd,
    color: colors.onSurface,
    fontWeight: '500',
  },
  catChipTextActive: {
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  privacyTitle: {
    ...Typography.labelMd,
    color: colors.onSurface,
    fontWeight: '700',
  },
  privacySubtitle: {
    ...Typography.captionSm,
    color: colors.tertiary,
    marginTop: 2,
    lineHeight: 16,
  },
  avatarPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    padding: 8,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
  },
  avatarPreviewImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  bannerPreviewBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  bannerPreviewImg: {
    width: '100%',
    height: 120,
    borderRadius: BorderRadius.md,
  },
  previewSuccessText: {
    ...Typography.captionSm,
    color: colors.primaryContainer,
    fontWeight: '600',
    marginTop: 4,
  },
});
