/**
 * New Hangout Screen — Create hangout modal form.
 * Matches Stitch create modal aesthetics
 * Backend: POST /hangouts
 * Enforces: dates validation, join type selection
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../src/constants/theme';
import { Button } from '../src/components/ui/Button';
import { hangoutsService } from '../src/services/hangouts';
import { ApiRequestError } from '../src/services/api';

export default function NewHangoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState({
    title: '',
    location: '',
    description: '',
    startsAt: '2026-10-20 14:00',
    endsAt: '2026-10-20 17:00',
    maxParticipants: '15',
    joinType: 'open' as 'open' | 'request_based',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.startsAt.trim()) errs.startsAt = 'Start time is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setGeneralError('');
    try {
      await hangoutsService.create({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        maxParticipants: form.maxParticipants ? parseInt(form.maxParticipants) : undefined,
        visibility: 'public',
        joinType: form.joinType,
      });
      router.back();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setGeneralError(err.message);
      } else {
        router.back();
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
        <Text style={styles.topBarTitle}>New Hangout</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={styles.createBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.createText}>{loading ? 'Posting...' : 'Create'}</Text>
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

        {/* Title */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>HANGOUT TITLE</Text>
          <View style={[styles.inputBox, errors.title && styles.inputBoxError]}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Casual Friday Coffee & Code"
              placeholderTextColor={Colors.outline}
              value={form.title}
              onChangeText={(v) => updateField('title', v)}
            />
            <MaterialIcons name="local-cafe" size={20} color={Colors.primaryContainer} />
          </View>
          {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
        </View>

        {/* Location */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>LOCATION / VENUE</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Tomoca Coffee, Piazza"
              placeholderTextColor={Colors.outline}
              value={form.location}
              onChangeText={(v) => updateField('location', v)}
            />
            <MaterialIcons name="storefront" size={20} color={Colors.secondary} />
          </View>
        </View>

        {/* Join Type Selector */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>JOIN TYPE</Text>
          <View style={styles.joinTypeSelector}>
            <TouchableOpacity
              style={[styles.typeOption, form.joinType === 'open' && styles.typeOptionActive]}
              onPress={() => updateField('joinType', 'open')}
              activeOpacity={0.8}
            >
              <View style={styles.typeIconRow}>
                <MaterialIcons
                  name="lock-open"
                  size={16}
                  color={form.joinType === 'open' ? Colors.onPrimaryContainer : Colors.tertiary}
                />
                <Text
                  style={[
                    styles.typeTitle,
                    form.joinType === 'open' && styles.typeTitleActive,
                  ]}
                >
                  Open Meetup
                </Text>
              </View>
              <Text style={styles.typeDesc}>Anyone can drop in</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeOption,
                form.joinType === 'request_based' && styles.typeOptionActive,
              ]}
              onPress={() => updateField('joinType', 'request_based')}
              activeOpacity={0.8}
            >
              <View style={styles.typeIconRow}>
                <MaterialIcons
                  name="how-to-reg"
                  size={16}
                  color={
                    form.joinType === 'request_based'
                      ? Colors.onPrimaryContainer
                      : Colors.tertiary
                  }
                />
                <Text
                  style={[
                    styles.typeTitle,
                    form.joinType === 'request_based' && styles.typeTitleActive,
                  ]}
                >
                  Request to Join
                </Text>
              </View>
              <Text style={styles.typeDesc}>Host approves members</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date & Time */}
        <View style={styles.twoCols}>
          <View style={styles.col}>
            <Text style={styles.label}>WHEN</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                placeholder="YYYY-MM-DD HH:MM"
                placeholderTextColor={Colors.outline}
                value={form.startsAt}
                onChangeText={(v) => updateField('startsAt', v)}
              />
            </View>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>MAX SPOTS</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                placeholder="15"
                placeholderTextColor={Colors.outline}
                keyboardType="number-pad"
                value={form.maxParticipants}
                onChangeText={(v) => updateField('maxParticipants', v)}
              />
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>ABOUT HANGOUT</Text>
          <View style={[styles.inputBox, styles.textAreaBox]}>
            <TextInput
              style={[styles.textInput, styles.textAreaInput]}
              placeholder="What are we doing? Tell people what to bring..."
              placeholderTextColor={Colors.outline}
              value={form.description}
              onChangeText={(v) => updateField('description', v)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        <Button
          title="Create Hangout"
          onPress={handleSubmit}
          loading={loading}
          fullWidth
          size="lg"
          style={{ marginTop: Spacing.sm }}
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
  joinTypeSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  typeOption: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surfaceContainerLow,
    gap: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  typeOptionActive: {
    backgroundColor: Colors.tertiaryFixed,
    borderColor: Colors.primaryContainer,
    ...Shadows.sm,
  },
  typeIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeTitle: {
    ...Typography.labelMd,
    color: Colors.onSurface,
  },
  typeTitleActive: {
    color: Colors.onTertiaryContainer,
    fontWeight: '700',
  },
  typeDesc: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },
  twoCols: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  col: {
    flex: 1,
    gap: 6,
  },
});
