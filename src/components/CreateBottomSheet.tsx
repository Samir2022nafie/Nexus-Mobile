/**
 * CreateBottomSheet — Stitch screen_30_fab_expanded_bottom_sheet.
 * Renders as an in-tree overlay with decoupled 60fps native animations:
 * - Scrim backdrop fades in smoothly directly over the active screen (no slide)
 * - Card bottom sheet slides up briskly from the bottom with natural deceleration
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Easing,
  Dimensions,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface CreateOption {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
  route: string;
}

const CREATE_OPTIONS: CreateOption[] = [
  {
    icon: 'edit',
    title: 'New Post',
    description: 'Share a discussion with your community',
    route: '/new-post',
  },
  {
    icon: 'calendar-month',
    title: 'New Event',
    description: 'Organize a meetup or activity',
    route: '/new-event',
  },
  {
    icon: 'local-cafe',
    title: 'New Hangout',
    description: 'Create a spontaneous get-together',
    route: '/new-hangout',
  },
  {
    icon: 'diversity-3',
    title: 'New Community',
    description: 'Start a new community around your interests',
    route: '/new-community',
  },
];

interface CreateBottomSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function CreateBottomSheet({ visible, onClose }: CreateBottomSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isRendered, setIsRendered] = useState(visible);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const isClosingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      setIsRendered(true);
      fadeAnim.setValue(0);
      slideAnim.setValue(SCREEN_HEIGHT);

      // Trigger animation on next frame to guarantee smooth entrance
      const frame = requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 280,
            easing: Easing.bezier(0.16, 1, 0.3, 1), // Snappy entrance with smooth deceleration
            useNativeDriver: true,
          }),
        ]).start();
      });

      return () => cancelAnimationFrame(frame);
    } else if (isRendered && !isClosingRef.current) {
      handleDismiss();
    }
  }, [visible]);

  // Handle Android hardware back press
  useEffect(() => {
    if (!isRendered) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleDismiss();
      return true;
    });
    return () => sub.remove();
  }, [isRendered]);

  const handleDismiss = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

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
      setIsRendered(false);
      isClosingRef.current = false;
      onClose();
    });
  };

  const handleSelect = (route: string) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsRendered(false);
      isClosingRef.current = false;
      onClose();
      router.push(route as any);
    });
  };

  if (!isRendered) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Backdrop shadow with independent fade animation */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={styles.backdropPressable} onPress={handleDismiss} />
      </Animated.View>

      {/* Card panel with snappy slide-up animation */}
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: Math.max(insets.bottom, 24),
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Drag Handle Pill */}
        <View style={styles.handleContainer}>
          <View style={styles.dragHandle} />
        </View>

        {/* Header with Title and Dismiss */}
        <View style={styles.header}>
          <Text style={styles.title}>Create</Text>
          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.closeButton}
            accessibilityLabel="Close sheet"
            activeOpacity={0.7}
          >
            <MaterialIcons name="close" size={22} color={Colors.tertiary} />
          </TouchableOpacity>
        </View>

        {/* 4 Options Stack */}
        <View style={styles.optionsList}>
          {CREATE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.title}
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={() => handleSelect(option.route)}
            >
              {/* Gold Circular Icon */}
              <View style={styles.iconCircle}>
                <MaterialIcons name={option.icon} size={22} color={Colors.onPrimary} />
              </View>

              {/* Title & Description */}
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDescription} numberOfLines={1}>
                  {option.description}
                </Text>
              </View>

              {/* Chevron */}
              <MaterialIcons name="chevron-right" size={20} color={Colors.outlineVariant} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Soft Tactile Cancel Hint */}
        <View style={styles.cancelHint}>
          <MaterialIcons name="info-outline" size={14} color={Colors.tertiary} />
          <Text style={styles.cancelHintText}>Tap anywhere outside to cancel</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: Colors.scrim,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFill as any,
  },
  sheet: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    ...Shadows.lg,
    zIndex: 10000,
    elevation: 10000,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.outlineVariant,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  optionsList: {
    gap: Spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm + 4,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceContainerLow,
    gap: Spacing.md,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  optionDescription: {
    ...Typography.captionMd,
    color: Colors.tertiary,
    marginTop: 2,
  },
  cancelHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  cancelHintText: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },
});
