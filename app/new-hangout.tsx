/**
 * New Hangout Screen — Create hangout modal form.
 * Matches Stitch create modal aesthetics
 * Backend: POST /hangouts
 * Enforces: dates validation, join type selection
 */
import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../src/constants/theme';
import { useTheme, useThemedStyles } from '../src/context/ThemeContext';
import { Button } from '../src/components/ui/Button';
import { hangoutsService } from '../src/services/hangouts';
import { ApiRequestError } from '../src/services/api';
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
  const pickerStyles = useThemedStyles(getPickerStyles);

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

export default function NewHangoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);
  const pickerStyles = useThemedStyles(getPickerStyles);
  const params = useLocalSearchParams<{ hangoutId?: string }>();
  const isEditing = Boolean(params.hangoutId);

  const now = new Date();
  const defaultStartsAt = new Date(Date.now() + 3600 * 1000 * 3).toISOString();

  const [form, setForm] = useState({
    title: '',
    location: '',
    description: '',
    coverImageUrl: '',
    startsAt: defaultStartsAt,
    endsAt: undefined as string | undefined,
    maxParticipants: '',
    joinType: 'open' as 'open' | 'request_based',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [generalError, setGeneralError] = useState('');

  useEffect(() => {
    if (!params.hangoutId) return;
    hangoutsService
      .getById(params.hangoutId)
      .then((h: any) => {
        if (h) {
          const loc =
            typeof h.location === 'string'
              ? h.location
              : h.location?.place_name || h.location?.name || '';
          setForm({
            title: h.title || '',
            location: loc,
            description: h.description || '',
            coverImageUrl: h.coverImageUrl || h.cover_image_url || '',
            startsAt: h.startsAt || h.starts_at || defaultStartsAt,
            endsAt: h.endsAt || h.ends_at || undefined,
            maxParticipants: h.maxParticipants ? String(h.maxParticipants) : '',
            joinType: String(h.joinType || h.join_type || 'open')
              .toLowerCase()
              .includes('open')
              ? 'open'
              : 'request_based',
          });
        }
      })
      .catch(() => {
        setGeneralError('Could not load hangout details');
      })
      .finally(() => {
        setInitialLoading(false);
      });
  }, [params.hangoutId]);

  // Decoupled animated Date & Time picker state
  const [datePickerRendered, setDatePickerRendered] = useState(false);
  const dateFadeAnim = useRef(new Animated.Value(0)).current;
  const dateSlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const [tempMonth, setTempMonth] = useState(now.getMonth() + 1);
  const [tempDay, setTempDay] = useState(now.getDate());
  const [tempYear, setTempYear] = useState(now.getFullYear());
  const [tempHour, setTempHour] = useState(now.getHours() % 12 || 12);
  const [tempMinute, setTempMinute] = useState(now.getMinutes() >= 30 ? '30' : '00');
  const [tempPeriod, setTempPeriod] = useState(now.getHours() >= 12 ? 'PM' : 'AM');

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const openDatePicker = () => {
    const d = new Date(form.startsAt);
    const validD = isNaN(d.getTime()) ? new Date() : d;
    setTempMonth(validD.getMonth() + 1);
    setTempDay(validD.getDate());
    setTempYear(validD.getFullYear());
    setTempHour(validD.getHours() % 12 || 12);
    setTempMinute(validD.getMinutes() >= 45 ? '45' : validD.getMinutes() >= 30 ? '30' : validD.getMinutes() >= 15 ? '15' : '00');
    setTempPeriod(validD.getHours() >= 12 ? 'PM' : 'AM');

    setDatePickerRendered(true);
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

  const closeDatePicker = () => {
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
      setDatePickerRendered(false);
    });
  };

  const confirmDatePicker = () => {
    let hour24 = tempHour;
    if (tempPeriod === 'PM' && tempHour < 12) hour24 += 12;
    if (tempPeriod === 'AM' && tempHour === 12) hour24 = 0;

    const formattedMonth = String(tempMonth).padStart(2, '0');
    const formattedDay = String(Math.min(tempDay, getDaysInMonth(tempMonth, tempYear))).padStart(2, '0');
    const formattedHour = String(hour24).padStart(2, '0');
    const formattedMinute = tempMinute;

    const isoString = `${tempYear}-${formattedMonth}-${formattedDay}T${formattedHour}:${formattedMinute}:00`;
    updateField('startsAt', isoString);
    closeDatePicker();
  };

  const formatStartsAtDisplay = (value: string) => {
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return 'Select date & time';
      return (
        d.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }) +
        ' · ' +
        d.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })
      );
    } catch {
      return 'Select date & time';
    }
  };

  const currentYear = now.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const daysInMonth = getDaysInMonth(tempMonth, tempYear);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const years = [currentYear, currentYear + 1];
  const hours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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
      if (isEditing && params.hangoutId) {
        await hangoutsService.update(params.hangoutId, {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          location: form.location.trim() || undefined,
          coverImageUrl: form.coverImageUrl.trim() ? form.coverImageUrl.trim() : (null as any),
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
          maxParticipants: form.maxParticipants && form.maxParticipants.trim() ? parseInt(form.maxParticipants.trim(), 10) : null,
          joinType: form.joinType,
        });
      } else {
        await hangoutsService.create({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          location: form.location.trim() || undefined,
          coverImageUrl: form.coverImageUrl.trim() || undefined,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
          maxParticipants: form.maxParticipants ? parseInt(form.maxParticipants) : undefined,
          visibility: 'public',
          joinType: form.joinType,
        });
      }
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

  if (initialLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primaryContainer} />
        <Text style={{ marginTop: 12, color: colors.secondary }}>Loading hangout details...</Text>
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
          <MaterialIcons name="close" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{isEditing ? 'Edit Hangout' : 'New Hangout'}</Text>
        <View style={{ width: 40 }} />
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

        {/* Title */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>HANGOUT TITLE</Text>
          <View style={[styles.inputBox, errors.title && styles.inputBoxError]}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Casual Friday Coffee & Code"
              placeholderTextColor={colors.outline}
              value={form.title}
              onChangeText={(v) => updateField('title', v)}
            />
            <MaterialIcons name="local-cafe" size={20} color={colors.primaryContainer} />
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
              placeholderTextColor={colors.outline}
              value={form.location}
              onChangeText={(v) => updateField('location', v)}
            />
            <MaterialIcons name="storefront" size={20} color={colors.secondary} />
          </View>
        </View>

        {/* Description / About Hangout */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>ABOUT HANGOUT</Text>
          <View style={[styles.inputBox, styles.textAreaBox]}>
            <TextInput
              style={[styles.textInput, styles.textAreaInput]}
              placeholder="What are we doing? Tell people what to bring..."
              placeholderTextColor={colors.outline}
              value={form.description}
              onChangeText={(v) => updateField('description', v)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Cover Image URL */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>COVER IMAGE (OPTIONAL)</Text>
          {form.coverImageUrl.trim() ? (
            <View style={styles.coverPreviewContainer}>
              <Image
                source={{ uri: form.coverImageUrl.trim() }}
                style={styles.coverPreviewImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.coverRemoveBtn}
                onPress={() => updateField('coverImageUrl', '')}
                activeOpacity={0.8}
              >
                <MaterialIcons name="close" size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="Paste cover image URL (https://...)"
              placeholderTextColor={colors.outline}
              value={form.coverImageUrl}
              onChangeText={(v) => {
                const direct = extractDirectImageUrl(v);
                updateField('coverImageUrl', direct);
                if (v.trim().startsWith('http') && !/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(v.trim())) {
                  resolveImageUrl(v.trim()).then((resolved) => {
                    if (resolved && resolved.startsWith('http')) {
                      updateField('coverImageUrl', resolved);
                    }
                  });
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <MaterialIcons name="image" size={20} color={colors.primaryContainer} />
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
                  color={form.joinType === 'open' ? colors.onPrimaryContainer : colors.tertiary}
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
                      ? colors.onPrimaryContainer
                      : colors.tertiary
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
            <TouchableOpacity
              style={[styles.inputBox, errors.startsAt && styles.inputBoxError]}
              onPress={openDatePicker}
              activeOpacity={0.8}
            >
              <Text style={styles.startsAtText} numberOfLines={1}>
                {formatStartsAtDisplay(form.startsAt)}
              </Text>
              <MaterialIcons name="schedule" size={18} color={colors.primaryContainer} />
            </TouchableOpacity>
            {errors.startsAt ? <Text style={styles.errorText}>{errors.startsAt}</Text> : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>MAX SPOTS</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                placeholder="No limit"
                placeholderTextColor={colors.outline}
                keyboardType="number-pad"
                value={form.maxParticipants}
                onChangeText={(v) => updateField('maxParticipants', v)}
              />
            </View>
          </View>
        </View>

        <Button
          title={isEditing ? 'Save Changes' : 'Create Hangout'}
          onPress={handleSubmit}
          loading={loading}
          fullWidth
          size="lg"
          style={{ marginTop: Spacing.sm }}
        />
      </ScrollView>

      {/* Date & Time Picker Modal with Decoupled Fade Scrim and Slide Sheet */}
      <Modal
        visible={datePickerRendered}
        transparent
        animationType="none"
        onRequestClose={closeDatePicker}
      >
        <View style={pickerStyles.overlay} pointerEvents="box-none">
          <Animated.View style={[pickerStyles.backdrop, { opacity: dateFadeAnim }]}>
            <Pressable style={pickerStyles.backdropPressable} onPress={closeDatePicker} />
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
              <TouchableOpacity onPress={closeDatePicker} style={pickerStyles.headerBtn}>
                <Text style={pickerStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={pickerStyles.title}>Hangout Date & Time</Text>
              <TouchableOpacity onPress={confirmDatePicker} style={pickerStyles.headerBtn}>
                <Text style={pickerStyles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>

            <Text style={pickerStyles.preview}>
              {MONTHS[tempMonth - 1]} {Math.min(tempDay, daysInMonth)}, {tempYear} · {tempHour}:{tempMinute} {tempPeriod}
            </Text>

            <View style={pickerStyles.columnsRow}>
              {/* Month */}
              <PickerColumn
                data={months}
                selectedIndex={tempMonth - 1}
                onSelect={(i) => setTempMonth(i + 1)}
                renderLabel={(m) => MONTHS[m - 1]}
              />
              {/* Day */}
              <PickerColumn
                data={days}
                selectedIndex={Math.min(tempDay - 1, days.length - 1)}
                onSelect={(i) => setTempDay(i + 1)}
                renderLabel={(d) => String(d)}
              />
              {/* Hour */}
              <PickerColumn
                data={hours}
                selectedIndex={hours.indexOf(tempHour) >= 0 ? hours.indexOf(tempHour) : 0}
                onSelect={(i) => setTempHour(hours[i])}
                renderLabel={(h) => String(h)}
              />
              {/* Minute */}
              <PickerColumn
                data={MINUTES}
                selectedIndex={MINUTES.indexOf(tempMinute) >= 0 ? MINUTES.indexOf(tempMinute) : 0}
                onSelect={(i) => setTempMinute(MINUTES[i])}
                renderLabel={(m) => m}
              />
              {/* AM / PM */}
              <PickerColumn
                data={PERIODS}
                selectedIndex={PERIODS.indexOf(tempPeriod) >= 0 ? PERIODS.indexOf(tempPeriod) : 0}
                onSelect={(i) => setTempPeriod(PERIODS[i])}
                renderLabel={(p) => p}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>
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
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputBoxError: {
    borderColor: colors.error,
  },
  startsAtText: {
    flex: 1,
    ...Typography.bodyMd,
    color: colors.onSurface,
    fontWeight: '500',
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
  joinTypeSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  typeOption: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: colors.surfaceContainerLow,
    gap: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  typeOptionActive: {
    backgroundColor: colors.tertiaryFixed,
    borderColor: colors.primaryContainer,
  },
  typeIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeTitle: {
    ...Typography.labelMd,
    color: colors.onSurface,
  },
  typeTitleActive: {
    color: colors.onTertiaryContainer,
    fontWeight: '700',
  },
  typeDesc: {
    ...Typography.captionSm,
    color: colors.tertiary,
  },
  twoCols: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  col: {
    flex: 1,
    gap: 6,
  },
  coverPreviewContainer: {
    height: 150,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surfaceContainerHigh,
    marginBottom: Spacing.xs,
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
});

const getPickerStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
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
    ...StyleSheet.absoluteFill as any,
    backgroundColor: colors.scrim,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFill as any,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    zIndex: 10000,
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  headerBtn: {
    padding: Spacing.xs,
  },
  cancelText: {
    ...Typography.bodyMd,
    color: colors.outline,
  },
  title: {
    ...Typography.titleMd,
    color: colors.onSurface,
    fontWeight: '700',
  },
  doneText: {
    ...Typography.bodyMd,
    color: colors.primaryContainer,
    fontWeight: '700',
  },
  preview: {
    ...Typography.titleLg,
    color: colors.primaryContainer,
    textAlign: 'center',
    marginBottom: Spacing.md,
    fontWeight: '700',
  },
  columnsRow: {
    flexDirection: 'row',
    height: ITEM_HEIGHT * 5,
    paddingHorizontal: Spacing.xs,
  },
  column: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  selectionHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 2,
    right: 2,
    height: ITEM_HEIGHT,
    backgroundColor: colors.tertiaryFixed,
    borderRadius: BorderRadius.md,
    zIndex: 0,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    ...Typography.bodyMd,
    color: colors.outline,
  },
  itemTextSelected: {
    ...Typography.titleMd,
    color: colors.onTertiaryFixed,
    fontWeight: '700',
  },
});
