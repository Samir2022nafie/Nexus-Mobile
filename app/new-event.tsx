/**
 * New Event Screen — Create and Edit event modal form.
 * Backend: POST /communities/:slug/events, PATCH /communities/:slug/events/:id
 * Features:
 * - Full-screen edit mode support when eventId param is provided
 * - Native iOS/wheel-style Date & Time picker for startsAt and endsAt
 * - Unlimited attendees support when maxParticipants is left empty
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Animated,
  Easing,
  Dimensions,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../src/constants/theme';
import { Button } from '../src/components/ui/Button';
import { usersService } from '../src/services/users';
import { eventsService } from '../src/services/events';
import { communitiesService } from '../src/services/communities';
import { uploadService } from '../src/services/upload';
import { ApiRequestError } from '../src/services/api';
import { ManagedCommunity } from '../src/types';
import { extractDirectImageUrl, resolveImageUrl } from '../src/utils/imageUrl';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const ITEM_HEIGHT = 44;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MINUTES = ['00', '15', '30', '45'];
const PERIODS = ['AM', 'PM'];

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function PickerColumn<T>({
  data,
  selectedIndex,
  onSelect,
  renderLabel,
}: {
  data: T[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  renderLabel: (item: T) => string;
}) {
  const flatListRef = useRef<FlatList>(null);

  const handleScrollEnd = (e: any) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
    onSelect(clampedIndex);
  };

  return (
    <View style={pickerStyles.column}>
      <View style={pickerStyles.selectionHighlight} pointerEvents="none" />
      <FlatList
        ref={flatListRef}
        data={data}
        keyExtractor={(_, i) => `${i}`}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT * 2,
        }}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        initialScrollIndex={selectedIndex >= 0 ? selectedIndex : 0}
        renderItem={({ item, index }) => {
          const isSelected = index === selectedIndex;
          return (
            <TouchableOpacity
              style={pickerStyles.item}
              onPress={() => {
                onSelect(index);
                flatListRef.current?.scrollToIndex({ index, animated: true });
              }}
              activeOpacity={0.7}
            >
              <Text style={isSelected ? pickerStyles.itemTextSelected : pickerStyles.itemText}>
                {renderLabel(item)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

export default function NewEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ eventId?: string; slug?: string }>();
  const isEditing = Boolean(params.eventId);

  const now = new Date();
  const defaultStartsAt = new Date(Date.now() + 3600 * 1000 * 4).toISOString();
  const defaultEndsAt = new Date(Date.now() + 3600 * 1000 * 6).toISOString();

  const [communities, setCommunities] = useState<ManagedCommunity[]>([]);
  const [selectedSlug, setSelectedSlug] = useState(params.slug || '');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    location: '',
    description: '',
    startsAt: defaultStartsAt,
    endsAt: defaultEndsAt as string | undefined,
    maxParticipants: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [generalError, setGeneralError] = useState('');

  // Date & Time picker modal state
  const [pickerRendered, setPickerRendered] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'startsAt' | 'endsAt'>('startsAt');
  const dateFadeAnim = useRef(new Animated.Value(0)).current;
  const dateSlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const [tempMonth, setTempMonth] = useState(now.getMonth() + 1);
  const [tempDay, setTempDay] = useState(now.getDate());
  const [tempYear, setTempYear] = useState(now.getFullYear());
  const [tempHour, setTempHour] = useState(now.getHours() % 12 || 12);
  const [tempMinute, setTempMinute] = useState(now.getMinutes() >= 30 ? '30' : '00');
  const [tempPeriod, setTempPeriod] = useState(now.getHours() >= 12 ? 'PM' : 'AM');

  useEffect(() => {
    usersService
      .getMyCommunities()
      .then((data) => {
        if (data && data.length > 0) {
          setCommunities(data);
          if (!selectedSlug) setSelectedSlug(data[0].slug);
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
              if (!selectedSlug) setSelectedSlug(mapped[0].slug);
            }
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [selectedSlug]);

  // Load existing event data when editing
  useEffect(() => {
    if (!params.eventId) return;
    const targetSlug = params.slug || selectedSlug;
    if (!targetSlug) return;

    eventsService
      .getById(targetSlug, params.eventId)
      .then((ev: any) => {
        if (ev) {
          const loc =
            typeof ev.location === 'string'
              ? ev.location
              : ev.location?.place_name || ev.location?.name || '';
          setSelectedSlug(ev.communitySlug || ev.community?.slug || targetSlug);
          setCoverImage(ev.coverImageUrl || ev.cover_image_url || null);
          setForm({
            title: ev.title || '',
            location: loc,
            description: ev.description || '',
            startsAt: ev.startsAt || ev.starts_at || defaultStartsAt,
            endsAt: ev.endsAt || ev.ends_at || undefined,
            maxParticipants: ev.maxParticipants || ev.max_participants ? String(ev.maxParticipants || ev.max_participants) : '',
          });
        }
      })
      .catch(() => {
        setGeneralError('Could not load event details');
      })
      .finally(() => {
        setInitialLoading(false);
      });
  }, [params.eventId, params.slug]);

  const handlePickCoverImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setCoverImage(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Could not pick image.');
    }
  };

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const openPicker = (target: 'startsAt' | 'endsAt') => {
    setPickerTarget(target);
    const dateStr = target === 'startsAt' ? form.startsAt : (form.endsAt || defaultEndsAt);
    const d = new Date(dateStr);
    const validD = isNaN(d.getTime()) ? new Date() : d;

    setTempMonth(validD.getMonth() + 1);
    setTempDay(validD.getDate());
    setTempYear(validD.getFullYear());
    setTempHour(validD.getHours() % 12 || 12);
    setTempMinute(
      validD.getMinutes() >= 45 ? '45' : validD.getMinutes() >= 30 ? '30' : validD.getMinutes() >= 15 ? '15' : '00'
    );
    setTempPeriod(validD.getHours() >= 12 ? 'PM' : 'AM');

    setPickerRendered(true);
    dateFadeAnim.setValue(0);
    dateSlideAnim.setValue(SCREEN_HEIGHT);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(dateFadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(dateSlideAnim, {
          toValue: 0,
          duration: 280,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const closePicker = () => {
    Animated.parallel([
      Animated.timing(dateFadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(dateSlideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setPickerRendered(false);
    });
  };

  const confirmPicker = () => {
    let hour24 = tempHour;
    if (tempPeriod === 'PM' && tempHour < 12) hour24 += 12;
    if (tempPeriod === 'AM' && tempHour === 12) hour24 = 0;

    const formattedMonth = String(tempMonth).padStart(2, '0');
    const formattedDay = String(Math.min(tempDay, getDaysInMonth(tempMonth, tempYear))).padStart(2, '0');
    const formattedHour = String(hour24).padStart(2, '0');
    const formattedMinute = tempMinute;

    const isoString = `${tempYear}-${formattedMonth}-${formattedDay}T${formattedHour}:${formattedMinute}:00`;
    updateField(pickerTarget, isoString);
    closePicker();
  };

  const formatDisplay = (value?: string) => {
    if (!value) return 'Select date & time';
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return 'Select date & time';
      return (
        d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }) +
        ', ' +
        d.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })
      );
    } catch {
      return 'Select date & time';
    }
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
      let uploadedCoverUrl = coverImage;
      if (coverImage && !coverImage.startsWith('http')) {
        try {
          const filename = coverImage.split('/').pop() || 'event-cover.jpg';
          const presigned = await uploadService.getPresignedUrl(filename, 'image/jpeg');
          await uploadService.uploadFile(presigned.uploadUrl, coverImage, 'image/jpeg');
          uploadedCoverUrl = presigned.publicUrl;
        } catch {
          uploadedCoverUrl = coverImage;
        }
      }

      const payload: any = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        maxParticipants: form.maxParticipants.trim() ? parseInt(form.maxParticipants.trim(), 10) : undefined,
        coverImageUrl: isEditing
          ? (uploadedCoverUrl ? uploadedCoverUrl : null)
          : (uploadedCoverUrl || undefined),
      };

      if (isEditing && params.eventId) {
        await eventsService.update(selectedSlug, params.eventId, payload);
      } else {
        await eventsService.create(selectedSlug, payload);
      }
      router.back();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setGeneralError(err.message);
      } else {
        setGeneralError(err instanceof Error ? err.message : 'Failed to save event');
      }
    } finally {
      setLoading(false);
    }
  };

  const currentYear = now.getFullYear();
  const years = [currentYear, currentYear + 1];
  const hours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const daysInCurrentMonth = getDaysInMonth(tempMonth, tempYear);
  const days = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

  if (initialLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primaryContainer} />
        <Text style={{ marginTop: 12, color: Colors.secondary }}>Loading event details...</Text>
      </View>
    );
  }

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
        <Text style={styles.topBarTitle}>{isEditing ? 'Edit Event' : 'New Event'}</Text>
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
          {errors.community ? <Text style={styles.errorText}>{errors.community}</Text> : null}
        </View>

        {/* Event Banner / Cover Image */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>EVENT BANNER (OPTIONAL)</Text>
          {coverImage ? (
            <View style={styles.coverPreviewContainer}>
              <Image source={{ uri: coverImage }} style={styles.coverPreviewImage} />
              <TouchableOpacity
                style={styles.coverRemoveBtn}
                onPress={() => setCoverImage(null)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="close" size={16} color="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.coverChangeBtn}
                onPress={handlePickCoverImage}
                activeOpacity={0.8}
              >
                <MaterialIcons name="photo-camera" size={14} color="#ffffff" />
                <Text style={styles.coverChangeText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.coverUploadBox}
              onPress={handlePickCoverImage}
              activeOpacity={0.8}
            >
              <MaterialIcons name="add-photo-alternate" size={28} color={Colors.primaryContainer} />
              <Text style={styles.coverUploadTitle}>Upload Event Banner</Text>
              <Text style={styles.coverUploadSubtitle}>16:9 ratio recommended (JPG, PNG)</Text>
            </TouchableOpacity>
          )}

          {/* Direct Banner Image URL Input */}
          <View style={[styles.inputBox, { marginTop: 8 }]}>
            <TextInput
              style={styles.textInput}
              placeholder="Or paste banner image URL (https://...)"
              placeholderTextColor={Colors.outline}
              value={coverImage && coverImage.startsWith('http') ? coverImage : ''}
              onChangeText={(text) => {
                const direct = extractDirectImageUrl(text);
                setCoverImage(direct || null);
                if (text.trim().startsWith('http') && !/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(text.trim())) {
                  resolveImageUrl(text.trim()).then((resolved) => {
                    if (resolved && resolved.startsWith('http')) {
                      setCoverImage(resolved);
                    }
                  });
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {coverImage && coverImage.startsWith('http') ? (
              <TouchableOpacity onPress={() => setCoverImage(null)} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={18} color={Colors.tertiary} />
              </TouchableOpacity>
            ) : (
              <MaterialIcons name="link" size={20} color={Colors.tertiary} />
            )}
          </View>
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

        {/* Date & Time with Interactive Pickers */}
        <View style={styles.twoCols}>
          <View style={styles.col}>
            <Text style={styles.label}>STARTS AT</Text>
            <TouchableOpacity
              style={[styles.inputBox, errors.startsAt && styles.inputBoxError]}
              onPress={() => openPicker('startsAt')}
              activeOpacity={0.8}
            >
              <Text style={styles.dateTimeText} numberOfLines={1}>
                {formatDisplay(form.startsAt)}
              </Text>
              <MaterialIcons name="schedule" size={18} color={Colors.primaryContainer} />
            </TouchableOpacity>
            {errors.startsAt ? <Text style={styles.errorText}>{errors.startsAt}</Text> : null}
          </View>

          <View style={styles.col}>
            <Text style={styles.label}>ENDS AT</Text>
            <TouchableOpacity
              style={styles.inputBox}
              onPress={() => openPicker('endsAt')}
              activeOpacity={0.8}
            >
              <Text style={styles.dateTimeText} numberOfLines={1}>
                {formatDisplay(form.endsAt)}
              </Text>
              <MaterialIcons name="schedule" size={18} color={Colors.primaryContainer} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Max participants */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>MAX ATTENDEES</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="No limit (unlimited attendees)"
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
          title={isEditing ? 'Save Changes' : 'Publish Event'}
          onPress={handleSubmit}
          loading={loading}
          fullWidth
          size="lg"
          style={{ marginTop: Spacing.sm }}
        />
      </ScrollView>

      {/* Date & Time Picker Modal */}
      <Modal
        visible={pickerRendered}
        transparent
        animationType="none"
        onRequestClose={closePicker}
      >
        <View style={pickerStyles.overlay} pointerEvents="box-none">
          <Animated.View style={[pickerStyles.backdrop, { opacity: dateFadeAnim }]}>
            <Pressable style={pickerStyles.backdropPressable} onPress={closePicker} />
          </Animated.View>

          <Animated.View
            style={[
              pickerStyles.sheet,
              {
                paddingBottom: Math.max(insets.bottom, 24),
                transform: [{ translateY: dateSlideAnim }],
              },
            ]}
          >
            <View style={pickerStyles.header}>
              <TouchableOpacity onPress={closePicker} style={pickerStyles.headerBtn}>
                <Text style={pickerStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={pickerStyles.title}>
                {pickerTarget === 'startsAt' ? 'Event Starts At' : 'Event Ends At'}
              </Text>
              <TouchableOpacity onPress={confirmPicker} style={pickerStyles.headerBtn}>
                <Text style={pickerStyles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={pickerStyles.pickersContainer}>
              {/* Month */}
              <PickerColumn
                data={MONTHS}
                selectedIndex={tempMonth - 1}
                onSelect={(idx) => setTempMonth(idx + 1)}
                renderLabel={(m) => m}
              />
              {/* Day */}
              <PickerColumn
                data={days}
                selectedIndex={tempDay - 1}
                onSelect={(idx) => setTempDay(idx + 1)}
                renderLabel={(d) => `${d}`}
              />
              {/* Year */}
              <PickerColumn
                data={years}
                selectedIndex={years.indexOf(tempYear) >= 0 ? years.indexOf(tempYear) : 0}
                onSelect={(idx) => setTempYear(years[idx])}
                renderLabel={(y) => `${y}`}
              />
              {/* Hour */}
              <PickerColumn
                data={hours}
                selectedIndex={hours.indexOf(tempHour) >= 0 ? hours.indexOf(tempHour) : 0}
                onSelect={(idx) => setTempHour(hours[idx])}
                renderLabel={(h) => `${h}`}
              />
              {/* Minute */}
              <PickerColumn
                data={MINUTES}
                selectedIndex={MINUTES.indexOf(tempMinute) >= 0 ? MINUTES.indexOf(tempMinute) : 0}
                onSelect={(idx) => setTempMinute(MINUTES[idx])}
                renderLabel={(m) => m}
              />
              {/* Period */}
              <PickerColumn
                data={PERIODS}
                selectedIndex={PERIODS.indexOf(tempPeriod)}
                onSelect={(idx) => setTempPeriod(PERIODS[idx])}
                renderLabel={(p) => p}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>
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
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: 40,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  errorText: {
    ...Typography.captionSm,
    color: Colors.error,
    marginTop: 2,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    ...Typography.labelSm,
    color: Colors.secondary,
    letterSpacing: 0.8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputBoxError: {
    borderColor: Colors.error,
  },
  textInput: {
    flex: 1,
    ...Typography.bodyMd,
    color: Colors.onSurface,
    padding: 0,
  },
  dateTimeText: {
    flex: 1,
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  twoCols: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
    gap: 6,
  },
  textAreaBox: {
    alignItems: 'flex-start',
    paddingVertical: Spacing.md,
  },
  textAreaInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  commChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  commChipActive: {
    backgroundColor: Colors.primaryContainer,
  },
  commChipText: {
    ...Typography.labelMd,
    color: Colors.onSurface,
  },
  commChipTextActive: {
    color: Colors.onPrimaryContainer,
    fontWeight: '700',
  },
  coverUploadBox: {
    height: 130,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.tertiaryFixed,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Spacing.md,
  },
  coverUploadTitle: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  coverUploadSubtitle: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },
  coverPreviewContainer: {
    height: 150,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.surfaceContainerHigh,
  },
  coverPreviewImage: {
    width: '100%',
    height: '100%',
  },
  coverRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverChangeBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  coverChangeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});

const pickerStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backdropPressable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
  },
  headerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  cancelText: {
    ...Typography.labelMd,
    color: Colors.tertiary,
  },
  doneText: {
    ...Typography.labelMd,
    color: Colors.primary,
    fontWeight: '700',
  },
  title: {
    ...Typography.headlineSm,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  pickersContainer: {
    flexDirection: 'row',
    height: ITEM_HEIGHT * 5,
    marginVertical: Spacing.sm,
    overflow: 'hidden',
  },
  column: {
    flex: 1,
    position: 'relative',
    height: ITEM_HEIGHT * 5,
  },
  selectionHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 2,
    right: 2,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(232, 167, 54, 0.15)',
    borderRadius: 8,
    zIndex: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  itemText: {
    fontSize: 14,
    color: Colors.tertiary,
    fontWeight: '400',
  },
  itemTextSelected: {
    fontSize: 15,
    color: Colors.onSurface,
    fontWeight: '700',
  },
});
