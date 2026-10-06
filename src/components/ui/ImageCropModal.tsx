/**
 * ImageCropModal — Universal image cropping modal for Mobile.
 * Supports:
 * - 'circle': 1:1 circular crop for user & community avatars/PFPs (large 360px viewport)
 * - 'wide-rectangle': 16:9 crop for community banners, event covers, hangout covers
 * - 'rectangle': Post images (expansive container width, height crop presets)
 * Features:
 * - Multi-touch two-finger pinch-to-zoom (1.0x to 3.0x limit) working across the entire viewport
 * - Single-finger dragging strictly clamped so image can NEVER detach from container borders
 * - Expansive, prominent canvas sizing
 * - Pure gesture zoom (no +/- buttons) with live zoom indicator & Reset action
 * - Full light & dark theme support using Nexus warm palette
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  PanResponder,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, BorderRadius, Shadows, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { parseCropFromUrl, encodeCropUrl, extractDirectImageUrl } from '../../utils/imageUrl';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MIN_ZOOM = 1.0;
const MAX_ZOOM = 3.0;

export interface ImageCropModalProps {
  visible: boolean;
  imageUri: string | null;
  cropShape?: 'circle' | 'wide-rectangle' | 'rectangle';
  aspectRatio?: number; // e.g. 1 for circle, 16/9 for wide-rectangle
  title?: string;
  onConfirm: (croppedUri: string) => void;
  onCancel: () => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  visible,
  imageUri,
  cropShape = 'circle',
  aspectRatio,
  title,
  onConfirm,
  onCancel,
}) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  // Natural image dimensions
  const [origSize, setOrigSize] = useState<{ width: number; height: number } | null>(null);
  const [loadingOrig, setLoadingOrig] = useState(true);

  // Display zoom readout state
  const [displayZoom, setDisplayZoom] = useState<number>(1.0);

  // Animated values for GPU transforms
  const zoomAnim = useRef(new Animated.Value(1.0)).current;
  const panXAnim = useRef(new Animated.Value(0)).current;
  const panYAnim = useRef(new Animated.Value(0)).current;

  // Mutable refs for tracking gesture state without re-rendering
  const zoomRef = useRef<number>(1.0);
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Multi-touch pinch tracking refs
  const isPinching = useRef<boolean>(false);
  const pinchStartDist = useRef<number>(0);
  const pinchStartZoom = useRef<number>(1.0);
  const pinchStartCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartPan = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Single-touch drag tracking refs
  const dragStartTouch = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartPan = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Post crop aspect ratio choice
  const [aspectChoice, setAspectChoice] = useState<'original' | '16:9' | '4:3' | '1:1'>('original');

  // Large, generous canvas sizing
  let boxWidth: number;
  let boxHeight: number;

  if (cropShape === 'circle') {
    boxWidth = Math.min(360, SCREEN_WIDTH - 28);
    boxHeight = boxWidth;
  } else if (cropShape === 'wide-rectangle') {
    boxWidth = SCREEN_WIDTH - 24;
    const targetRatio = aspectRatio ?? (16 / 9);
    boxHeight = Math.round(boxWidth / targetRatio);
  } else {
    // Post image (rectangle)
    boxWidth = SCREEN_WIDTH - 24;
    const naturalRatio = origSize ? origSize.width / origSize.height : (16 / 9);
    const maxPostHeight = Math.min(Math.round(SCREEN_HEIGHT * 0.52), 480);
    const naturalBoxHeight = Math.min(maxPostHeight, Math.max(180, Math.round(boxWidth / naturalRatio)));

    if (aspectChoice === '16:9') {
      boxHeight = Math.round(boxWidth / (16 / 9));
    } else if (aspectChoice === '4:3') {
      boxHeight = Math.round(boxWidth / (4 / 3));
    } else if (aspectChoice === '1:1') {
      boxHeight = boxWidth;
    } else {
      boxHeight = naturalBoxHeight;
    }
  }

  // Base dimensions calculation: image always covers the box completely at baseScale
  const baseScale = origSize ? Math.max(boxWidth / origSize.width, boxHeight / origSize.height) : 1;
  const baseW = origSize ? origSize.width * baseScale : boxWidth;
  const baseH = origSize ? origSize.height * baseScale : boxHeight;

  // Strict clamping helper: guarantees image can NEVER detach from container borders
  const clampPan = (rawX: number, rawY: number, z: number) => {
    const scaledW = baseW * z;
    const scaledH = baseH * z;
    const maxX = Math.max(0, (scaledW - boxWidth) / 2);
    const maxY = Math.max(0, (scaledH - boxHeight) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, rawX)),
      y: Math.max(-maxY, Math.min(maxY, rawY)),
    };
  };

  // Keep pan bounded when container dimensions or base size change
  useEffect(() => {
    if (!origSize) return;
    const clamped = clampPan(panRef.current.x, panRef.current.y, zoomRef.current);
    panRef.current = clamped;
    panXAnim.setValue(clamped.x);
    panYAnim.setValue(clamped.y);
  }, [boxWidth, boxHeight, baseW, baseH]);

  // Clean image URL without any previous crop hash
  const parsedImage = parseCropFromUrl(imageUri);
  const cleanImageUri = parsedImage.cleanUrl;

  // Initialize or reset state when modal opens
  useEffect(() => {
    if (!visible || !imageUri) {
      setOrigSize(null);
      zoomRef.current = 1.0;
      panRef.current = { x: 0, y: 0 };
      setDisplayZoom(1.0);
      setAspectChoice('original');
      zoomAnim.setValue(1.0);
      panXAnim.setValue(0);
      panYAnim.setValue(0);
      return;
    }

    setLoadingOrig(true);

    if (parsedImage.aspectRatio) {
      const ar = parsedImage.aspectRatio;
      if (Math.abs(ar - 16 / 9) < 0.08) setAspectChoice('16:9');
      else if (Math.abs(ar - 4 / 3) < 0.08) setAspectChoice('4:3');
      else if (Math.abs(ar - 1.0) < 0.08) setAspectChoice('1:1');
      else setAspectChoice('original');
    } else {
      setAspectChoice('original');
    }

    const initialZ = parsedImage.zoom > 0 ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parsedImage.zoom)) : 1.0;
    zoomRef.current = initialZ;
    setDisplayZoom(initialZ);
    zoomAnim.setValue(initialZ);

    const initialX = (parsedImage.panX / 100) * boxWidth;
    const initialY = (parsedImage.panY / 100) * boxHeight;
    panRef.current = { x: initialX, y: initialY };
    panXAnim.setValue(initialX);
    panYAnim.setValue(initialY);

    const direct = extractDirectImageUrl(cleanImageUri);
    Image.getSize(
      direct,
      (w, h) => {
        setOrigSize({ width: w, height: h });
        setLoadingOrig(false);
      },
      () => {
        setOrigSize({ width: 800, height: 800 });
        setLoadingOrig(false);
      }
    );
  }, [visible, imageUri]);

  // Viewport-wide PanResponder for intuitive two-finger pinch-to-zoom and single-finger dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          isPinching.current = true;
          pinchStartDist.current = Math.hypot(
            touches[1].pageX - touches[0].pageX,
            touches[1].pageY - touches[0].pageY
          );
          pinchStartZoom.current = zoomRef.current;
          pinchStartCenter.current = {
            x: (touches[0].pageX + touches[1].pageX) / 2,
            y: (touches[0].pageY + touches[1].pageY) / 2,
          };
          pinchStartPan.current = { ...panRef.current };
        } else if (touches && touches.length === 1) {
          isPinching.current = false;
          pinchStartDist.current = 0;
          dragStartTouch.current = { x: touches[0].pageX, y: touches[0].pageY };
          dragStartPan.current = { ...panRef.current };
        }
      },

      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (!touches || touches.length === 0) return;

        // Two-Finger Pinch-to-Zoom
        if (touches.length >= 2) {
          const currentDist = Math.hypot(
            touches[1].pageX - touches[0].pageX,
            touches[1].pageY - touches[0].pageY
          );

          // If second finger just touched down
          if (!isPinching.current || pinchStartDist.current <= 0) {
            isPinching.current = true;
            pinchStartDist.current = currentDist;
            pinchStartZoom.current = zoomRef.current;
            pinchStartCenter.current = {
              x: (touches[0].pageX + touches[1].pageX) / 2,
              y: (touches[0].pageY + touches[1].pageY) / 2,
            };
            pinchStartPan.current = { ...panRef.current };
            return;
          }

          if (pinchStartDist.current > 0) {
            const scaleRatio = currentDist / pinchStartDist.current;
            const targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartZoom.current * scaleRatio));

            // Midpoint shift while pinching
            const midX = (touches[0].pageX + touches[1].pageX) / 2;
            const midY = (touches[0].pageY + touches[1].pageY) / 2;
            const deltaMidX = midX - pinchStartCenter.current.x;
            const deltaMidY = midY - pinchStartCenter.current.y;

            const rawPanX = pinchStartPan.current.x + deltaMidX;
            const rawPanY = pinchStartPan.current.y + deltaMidY;

            const clamped = clampPan(rawPanX, rawPanY, targetZoom);

            zoomRef.current = targetZoom;
            panRef.current = clamped;

            zoomAnim.setValue(targetZoom);
            panXAnim.setValue(clamped.x);
            panYAnim.setValue(clamped.y);
          }
        } else if (touches.length === 1) {
          // Transition back to single-finger drag
          if (isPinching.current) {
            isPinching.current = false;
            pinchStartDist.current = 0;
            dragStartTouch.current = { x: touches[0].pageX, y: touches[0].pageY };
            dragStartPan.current = { ...panRef.current };
            return;
          }

          const deltaX = touches[0].pageX - dragStartTouch.current.x;
          const deltaY = touches[0].pageY - dragStartTouch.current.y;

          const rawPanX = dragStartPan.current.x + deltaX;
          const rawPanY = dragStartPan.current.y + deltaY;

          const clamped = clampPan(rawPanX, rawPanY, zoomRef.current);

          panRef.current = clamped;
          panXAnim.setValue(clamped.x);
          panYAnim.setValue(clamped.y);
        }
      },

      onPanResponderRelease: () => {
        isPinching.current = false;
        pinchStartDist.current = 0;
        setDisplayZoom(Number(zoomRef.current.toFixed(1)));
      },
      onPanResponderTerminate: () => {
        isPinching.current = false;
        pinchStartDist.current = 0;
        setDisplayZoom(Number(zoomRef.current.toFixed(1)));
      },
    })
  ).current;

  const handleReset = () => {
    zoomRef.current = MIN_ZOOM;
    panRef.current = { x: 0, y: 0 };
    setDisplayZoom(MIN_ZOOM);
    setAspectChoice('original');
    Animated.parallel([
      Animated.spring(zoomAnim, { toValue: MIN_ZOOM, useNativeDriver: false }),
      Animated.spring(panXAnim, { toValue: 0, useNativeDriver: false }),
      Animated.spring(panYAnim, { toValue: 0, useNativeDriver: false }),
    ]).start();
  };

  const handleApplyCrop = () => {
    if (!cleanImageUri) return;

    // Calculate percentage offsets relative to crop window
    const panXPercent = boxWidth > 0 ? (panRef.current.x / boxWidth) * 100 : 0;
    const panYPercent = boxHeight > 0 ? (panRef.current.y / boxHeight) * 100 : 0;

    const finalRatio =
      cropShape === 'rectangle' && aspectChoice !== 'original'
        ? Number((boxWidth / boxHeight).toFixed(3))
        : cropShape === 'circle'
        ? 1.0
        : cropShape === 'wide-rectangle'
        ? Number((boxWidth / boxHeight).toFixed(3))
        : undefined;

    const encodedCropUrl = encodeCropUrl(
      cleanImageUri,
      Number(zoomRef.current.toFixed(2)),
      Number(panXPercent.toFixed(1)),
      Number(panYPercent.toFixed(1)),
      finalRatio
    );
    onConfirm(encodedCropUrl);
  };

  if (!visible || !imageUri) return null;

  const resolvedTitle =
    title ||
    (cropShape === 'circle'
      ? 'Crop Profile Picture'
      : cropShape === 'wide-rectangle'
      ? 'Crop Banner'
      : 'Crop Image');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerBtn} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{resolvedTitle}</Text>
          <TouchableOpacity
            onPress={handleApplyCrop}
            style={styles.applyBtn}
            disabled={loadingOrig}
            activeOpacity={0.8}
          >
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>

        {/* Viewport Area — Captures multi-touch gestures across the entire area */}
        <View style={styles.viewportContainer} {...panResponder.panHandlers}>
          {loadingOrig ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <View
              style={[
                styles.cropWindow,
                {
                  width: boxWidth,
                  height: boxHeight,
                  borderRadius: cropShape === 'circle' ? boxWidth / 2 : 16,
                },
              ]}
              pointerEvents="box-none"
            >
              {/* Centered Scalable & Draggable Image */}
              <Animated.View
                style={[
                  styles.imageWrapper,
                  {
                    width: baseW,
                    height: baseH,
                    position: 'absolute',
                    left: (boxWidth - baseW) / 2,
                    top: (boxHeight - baseH) / 2,
                    transform: [
                      { translateX: panXAnim },
                      { translateY: panYAnim },
                      { scale: zoomAnim },
                    ],
                  },
                ]}
                pointerEvents="none"
              >
                <Image
                  source={{ uri: extractDirectImageUrl(cleanImageUri) }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </Animated.View>

              {/* Crop Aperture Border / Outline */}
              <View
                style={[
                  styles.apertureBorder,
                  {
                    width: boxWidth,
                    height: boxHeight,
                    borderRadius: cropShape === 'circle' ? boxWidth / 2 : 16,
                    borderColor: colors.primary,
                  },
                ]}
                pointerEvents="none"
              />
            </View>
          )}

          {/* Optional manual aspect ratio presets for posts */}
          {cropShape === 'rectangle' && !loadingOrig && (
            <View style={styles.aspectPillsRow}>
              {(['original', '16:9', '4:3', '1:1'] as const).map((choice) => {
                const isActive = aspectChoice === choice;
                const label = choice === 'original' ? 'Original Height' : choice;
                return (
                  <TouchableOpacity
                    key={choice}
                    style={[styles.aspectPill, isActive && styles.aspectPillActive]}
                    onPress={() => setAspectChoice(choice)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.aspectPillText, isActive && styles.aspectPillTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={styles.hintText}>Pinch with 2 fingers to zoom • Drag to position</Text>
        </View>

        {/* Bottom Control Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarInner}>
            {/* Live Zoom Readout */}
            <View style={styles.zoomPill}>
              <MaterialIcons name="zoom-in" size={18} color={colors.primary} />
              <Text style={styles.zoomPillText}>{displayZoom.toFixed(1)}x</Text>
            </View>

            <TouchableOpacity
              onPress={handleReset}
              style={styles.resetBtn}
              activeOpacity={0.7}
              accessibilityLabel="Reset crop zoom and position"
            >
              <MaterialIcons name="refresh" size={18} color={colors.primary} />
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.surface,
      justifyContent: 'space-between',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 64 : 52,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLow,
    },
    headerBtn: {
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    cancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.onSurface,
      letterSpacing: -0.2,
    },
    applyBtn: {
      backgroundColor: colors.primaryContainer,
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: BorderRadius.full,
      minWidth: 70,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.onPrimaryContainer,
    },
    viewportContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    cropWindow: {
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.surfaceContainerHighest : colors.surfaceContainerHigh,
      ...Shadows.md,
    },
    imageWrapper: {
      // Positioned and sized dynamically
    },
    apertureBorder: {
      position: 'absolute',
      top: 0,
      left: 0,
      borderWidth: 2.5,
    },
    aspectPillsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 18,
    },
    aspectPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.surfaceContainerHigh,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    aspectPillActive: {
      backgroundColor: isDark ? 'rgba(254, 186, 72, 0.2)' : 'rgba(232, 167, 54, 0.2)',
      borderColor: colors.primary,
    },
    aspectPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
    },
    aspectPillTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    hintText: {
      marginTop: 16,
      fontSize: 12,
      fontWeight: '500',
      color: colors.outline,
      textAlign: 'center',
    },
    bottomBar: {
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 42 : 24,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLow,
    },
    bottomBarInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    zoomPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 72,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: BorderRadius.full,
      backgroundColor: isDark ? 'rgba(254, 186, 72, 0.15)' : 'rgba(232, 167, 54, 0.15)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(254, 186, 72, 0.3)' : 'rgba(232, 167, 54, 0.3)',
      justifyContent: 'center',
    },
    zoomPillText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    resetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.surfaceContainerHigh,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    resetBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.onSurface,
    },
  });
