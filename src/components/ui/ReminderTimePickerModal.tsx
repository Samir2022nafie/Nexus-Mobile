import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Easing,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { Typography, Spacing, BorderRadius, ThemeColors, Shadows } from '../../constants/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const ITEM_HEIGHT = 44;

export const REMIND_DAYS_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7];
export const REMIND_HOURS_OPTIONS = Array.from({ length: 25 }, (_, i) => i); // 0 to 24

export function formatReminderText(days: number, hours: number): string {
  const dayText = days === 0 ? 'At start date' : `${days} day${days > 1 ? 's' : ''} before`;
  const hourText = hours === 0 ? 'At start time' : `${hours} hour${hours > 1 ? 's' : ''} before`;
  return `${dayText} · ${hourText}`;
}

export function formatDayLabel(days: number): string {
  if (days === 0) return 'At start date';
  if (days === 1) return '1 day before';
  return `${days} days before`;
}

export function formatHourLabel(hours: number): string {
  if (hours === 0) return 'At start time';
  if (hours === 1) return '1 hour before';
  return `${hours} hrs before`;
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
  const styles = useThemedStyles(getPickerStyles);

  const handleScrollEnd = (e: any) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
    onSelect(clampedIndex);
  };

  return (
    <View style={styles.column}>
      <View style={styles.selectionHighlight} pointerEvents="none" />
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
              style={styles.item}
              onPress={() => {
                onSelect(index);
                flatListRef.current?.scrollToIndex({ index, animated: true });
              }}
              activeOpacity={0.7}
            >
              <Text
                style={isSelected ? styles.itemTextSelected : styles.itemText}
                numberOfLines={1}
              >
                {renderLabel(item)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

interface ReminderTimePickerModalProps {
  visible: boolean;
  days: number;
  hours: number;
  title?: string;
  onConfirm: (days: number, hours: number) => void;
  onClose: () => void;
}

export function ReminderTimePickerModal({
  visible,
  days,
  hours,
  title = 'Remind me in:',
  onConfirm,
  onClose,
}: ReminderTimePickerModalProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(getPickerStyles);

  const [tempDays, setTempDays] = useState(days);
  const [tempHours, setTempHours] = useState(hours);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setTempDays(days);
      setTempHours(hours);
      fadeAnim.setValue(0);
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, days, hours]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleConfirm = () => {
    onConfirm(tempDays, tempHours);
    handleClose();
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.backdropPressable}
            activeOpacity={1}
            onPress={handleClose}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 24),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={handleConfirm} style={styles.headerBtn}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Current preview label */}
          <Text style={styles.preview}>
            {formatReminderText(tempDays, tempHours)}
          </Text>

          {/* Columns */}
          <View style={styles.columnsRow}>
            {/* Days Column */}
            <PickerColumn
              data={REMIND_DAYS_OPTIONS}
              selectedIndex={REMIND_DAYS_OPTIONS.indexOf(tempDays) >= 0 ? REMIND_DAYS_OPTIONS.indexOf(tempDays) : 0}
              onSelect={(i) => setTempDays(REMIND_DAYS_OPTIONS[i])}
              renderLabel={formatDayLabel}
            />

            {/* Hours Column */}
            <PickerColumn
              data={REMIND_HOURS_OPTIONS}
              selectedIndex={REMIND_HOURS_OPTIONS.indexOf(tempHours) >= 0 ? REMIND_HOURS_OPTIONS.indexOf(tempHours) : 0}
              onSelect={(i) => setTempHours(REMIND_HOURS_OPTIONS[i])}
              renderLabel={formatHourLabel}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

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
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.scrim,
    },
    backdropPressable: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
      ...Typography.titleMedium,
      color: colors.primaryContainer,
      textAlign: 'center',
      marginBottom: Spacing.md,
      fontWeight: '700',
      fontSize: 16,
    },
    columnsRow: {
      flexDirection: 'row',
      height: ITEM_HEIGHT * 5,
      paddingHorizontal: Spacing.xs,
      gap: 12,
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
      paddingHorizontal: 8,
    },
    itemText: {
      ...Typography.bodyMd,
      color: colors.outline,
    },
    itemTextSelected: {
      ...Typography.titleMd,
      color: colors.onTertiaryFixed,
      fontWeight: '700',
      fontSize: 15,
    },
  });
