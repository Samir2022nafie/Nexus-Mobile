/**
 * New Event Screen — Create event modal form.
 * Backend: POST /communities/:slug/events
 * Enforces: date validation, community selection
 */
import React, { useState, useEffect } from 'react';
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
import { usersService } from '../src/services/users';
import { eventsService } from '../src/services/events';
import { communitiesService } from '../src/services/communities';
import { ApiRequestError } from '../src/services/api';
import { ManagedCommunity } from '../src/types';

export default function NewEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [communities, setCommunities] = useState<ManagedCommunity[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [form, setForm] = useState({
    title: '',
    location: '',
    description: '',
    startsAt: '',
    endsAt: '',
    maxParticipants: '30',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  useEffect(() => {
    usersService
      .getMyCommunities()
      .then((data) => {
        if (data && data.length > 0) {
          setCommunities(data);
          setSelectedSlug(data[0].slug);
        } else {
          communitiesService.list().then((allComms) => {
            if (allComms && allComms.length > 0) {
              const mapped: ManagedCommunity[] = allComms.map((c) => ({
                id: c.id,
                name: c.name,
                slug: c.slug,
                role: 'member',
                memberCount: c.memberCount || 0,
                isPrivate: c.is_private || false,
              }));
              setCommunities(mapped);
              setSelectedSlug(mapped[0].slug);
            }
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!selectedSlug) errs.community = 'Select a community';
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.startsAt.trim()) errs.startsAt = 'Start date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setGeneralError('');
    try {
      await eventsService.create(selectedSlug, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        maxParticipants: form.maxParticipants ? parseInt(form.maxParticipants) : undefined,
      });
      router.back();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setGeneralError(err.message);
      } else {
        setGeneralError(err instanceof Error ? err.message : 'Failed to create event');
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
        <Text style={styles.topBarTitle}>New Event</Text>
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

        {/* Community Selector */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>HOSTING COMMUNITY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {communities.map((c) => {
              const isSelected = selectedSlug === c.slug;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.commChip, isSelected && styles.commChipActive]}
                  onPress={() => setSelectedSlug(c.slug)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name="groups"
                    size={16}
                    color={isSelected ? Colors.onPrimaryContainer : Colors.tertiary}
                  />
                  <Text style={[styles.commChipText, isSelected && styles.commChipTextActive]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Title */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>EVENT TITLE</Text>
          <View style={[styles.inputBox, errors.title && styles.inputBoxError]}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Summit Ridge Sunrise Hike"
              placeholderTextColor={Colors.outline}
              value={form.title}
              onChangeText={(v) => updateField('title', v)}
            />
          </View>
          {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
        </View>

        {/* Location */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>LOCATION / MEETING POINT</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Entoto Park Trailhead"
              placeholderTextColor={Colors.outline}
              value={form.location}
              onChangeText={(v) => updateField('location', v)}
            />
            <MaterialIcons name="location-on" size={20} color={Colors.secondary} />
          </View>
        </View>

        {/* Date & Time */}
        <View style={styles.twoCols}>
          <View style={styles.col}>
            <Text style={styles.label}>STARTS AT</Text>
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
            <Text style={styles.label}>ENDS AT</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                placeholder="YYYY-MM-DD HH:MM"
                placeholderTextColor={Colors.outline}
                value={form.endsAt}
                onChangeText={(v) => updateField('endsAt', v)}
              />
            </View>
          </View>
        </View>

        {/* Max participants */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>MAX ATTENDEES</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="30"
              placeholderTextColor={Colors.outline}
              keyboardType="number-pad"
              value={form.maxParticipants}
              onChangeText={(v) => updateField('maxParticipants', v)}
            />
            <MaterialIcons name="group" size={20} color={Colors.tertiary} />
          </View>
        </View>

        {/* Description */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>EVENT DETAILS & WHAT TO BRING</Text>
          <View style={[styles.inputBox, styles.textAreaBox]}>
            <TextInput
              style={[styles.textInput, styles.textAreaInput]}
              placeholder="Describe the activity, difficulty level, and what members should pack..."
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
          title="Publish Event"
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
  chipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  commChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  commChipActive: {
    backgroundColor: Colors.primaryContainer,
    ...Shadows.sm,
  },
  commChipText: {
    ...Typography.captionMd,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  commChipTextActive: {
    color: Colors.onPrimaryContainer,
    fontWeight: '700',
  },
  twoCols: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  col: {
    flex: 1,
    gap: 6,
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
});
