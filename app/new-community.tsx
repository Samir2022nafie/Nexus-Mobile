/**
 * New Community Screen — Create a community modal.
 * Matches Stitch create modal aesthetics
 * Backend: POST /communities
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../src/constants/theme';
import { Button } from '../src/components/ui/Button';
import { communitiesService } from '../src/services/communities';
import { ApiRequestError } from '../src/services/api';
import { BACKEND_CATEGORIES } from '../src/utils/categories';

export default function NewCommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    rules: '',
    categoryId: BACKEND_CATEGORIES[0].id,
    isPrivate: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
    if (field === 'name') {
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
    if (!form.slug.trim()) errs.slug = 'Slug is required';
    if (!/^[a-z0-9-]+$/.test(form.slug))
      errs.slug = 'Only lowercase letters, numbers, and hyphens';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setGeneralError('');
    try {
      await communitiesService.create({
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || undefined,
        rules: form.rules.trim() || undefined,
        isPrivate: form.isPrivate,
        categoryId: form.categoryId,
      });
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
          err instanceof ApiRequestError ? err.message : 'Failed to create community'
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
          <MaterialIcons name="close" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>New Community</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={styles.createBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.createText}>{loading ? 'Creating...' : 'Create'}</Text>
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
            <MaterialIcons name="error" size={18} color={Colors.error} />
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
              placeholderTextColor={Colors.outline}
              value={form.name}
              onChangeText={(v) => updateField('name', v)}
            />
            <MaterialIcons name="groups" size={20} color={Colors.tertiary} />
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
              placeholderTextColor={Colors.outline}
              value={form.slug}
              onChangeText={(v) => updateField('slug', v)}
              autoCapitalize="none"
            />
            <MaterialIcons name="link" size={20} color={Colors.tertiary} />
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
              placeholderTextColor={Colors.outline}
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
              placeholderTextColor={Colors.outline}
              value={form.rules}
              onChangeText={(v) => updateField('rules', v)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
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
            trackColor={{ false: Colors.surfaceVariant, true: Colors.primaryContainer }}
            thumbColor={Colors.white}
          />
        </View>

        <Button
          title="Create Community"
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
    backgroundColor: Colors.surface,
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
    color: Colors.onSurface,
  },
  createBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryContainer,
  },
  createText: {
    ...Typography.labelMd,
    color: Colors.onPrimaryContainer,
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
    backgroundColor: Colors.errorContainer,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  errorText: {
    ...Typography.captionMd,
    color: Colors.onErrorContainer,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.tertiary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingLeft: 4,
  },
  inputBox: {
    height: 48,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.tertiaryFixed,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    ...Shadows.sm,
  },
  inputBoxError: {
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  textInput: {
    flex: 1,
    height: '100%',
    ...Typography.bodyMd,
    color: Colors.onSurface,
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
    color: Colors.tertiary,
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
    backgroundColor: Colors.surfaceContainer,
  },
  catChipActive: {
    backgroundColor: Colors.primaryContainer,
    ...Shadows.sm,
  },
  catChipText: {
    ...Typography.captionMd,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  catChipTextActive: {
    color: Colors.onPrimaryContainer,
    fontWeight: '700',
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  privacyTitle: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  privacySubtitle: {
    ...Typography.captionSm,
    color: Colors.tertiary,
    marginTop: 2,
    lineHeight: 16,
  },
});
