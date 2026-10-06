/**
 * ImageCropModal — Universal image cropping modal for Mobile.
 * Supports:
 * - 'circle': 1:1 circular crop for user & community avatars/PFPs
 * - 'wide-rectangle': 16:9 crop for community banners, event covers, hangout covers
 * - 'rectangle': Post images (enforced full container width, vertical height crop)
 * Features:
 * - GPU-accelerated two-finger pinch-to-zoom (1.0x to 3.0x limit)
 * - Single-finger panning strictly bounded so image fills container completely with zero edge gaps
 * - Dedicated zoom controls (-, +, Reset)
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

  // Display zoom readout state (only updated on gesture end or button step to prevent render lag)
  const [displayZoom, setDisplayZoom] = useState<number>(1.0);

  // Animated values for GPU transforms
  const zoomAnim = useRef(new Animated.Value(1.0)).current;
  const panXAnim = useRef(new Animated.Value(0)).current;
  const panYAnim = useRef(new Animated.Value(0)).current;

  // Mutable refs for tracking gesture state without re-rendering
  const zoomRef = useRef<number>(1.0);
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Pinch tracking refs
  const isPinching = useRef<boolean>(false);
  const pinchStartDist = useRef<number>(0);
  const pinchStartZoom = useRef<number>(1.0);
  const pinchStartCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartPan = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Single-touch drag tracking refs
  const dragStartPan = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Post crop aspect ratio choice
  const [aspectChoice, setAspectChoice] = useState<'original' | '16:9' | '4:3' | '1:1'>('original');

  // Compute crop box dimensions
  const maxBoxWidth = SCREEN_WIDTH - 32;
  const boxWidth = cropShape === 'rectangle' ? maxBoxWidth : Math.min(320, maxBoxWidth);

  let boxHeight = 220;
  if (cropShape === 'circle') {
    boxHeight = boxWidth;
  } else if (cropShape === 'wide-rectangle') {
    const targetRatio = aspectRatio ?? (16 / 9);
    boxHeight = Math.min(480, Math.round(boxWidth / targetRatio));
  } else {
    // cropShape === 'rectangle' (Post image)
    const naturalRatio = origSize ? origSize.width / origSize.height : (16 / 9);
    const naturalBoxHeight = Math.min(480, Math.max(140, Math.round(boxWidth / naturalRatio)));

    if (aspectChoice === '16:9') {
      boxHeight = Math.round(boxWidth / (16 / 9));
    } else if (aspectChoice === '4:3') {
      boxHeight = Math.round(boxWidth / (4 / 3));
    } else if (aspectChoice === '1:1') {
      boxHeight = Math.min(boxWidth, 380);
    } else {
      boxHeight = naturalBoxHeight;
    }
  }

  // Base dimensions calculation: image always covers the box completely at baseScale
  const baseScale = origSize ? Math.max(boxWidth / origSize.width, boxHeight / origSize.height) : 1;
  const baseW = origSize ? origSize.width * baseScale : boxWidth;
  const baseH = origSize ? origSize.height * baseScale : boxHeight;

  // Clamping helper: guarantees image never detaches from container edges
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

  // Robust PanResponder supporting pinch-to-zoom and drag
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
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
        } else {
          isPinching.current = false;
          dragStartPan.current = { ...panRef.current };
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          const currentDist = Math.hypot(
            touches[1].pageX - touches[0].pageX,
            touches[1].pageY - touches[0].pageY
          );

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

          const scaleRatio = currentDist / pinchStartDist.current;
          const targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartZoom.current * scaleRatio));

          const currentCenter = {
            x: (touches[0].pageX + touches[1].pageX) / 2,
            y: (touches[0].pageY + touches[1].pageY) / 2,
          };
          const deltaX = currentCenter.x - pinchStartCenter.current.x;
          const deltaY = currentCenter.y - pinchStartCenter.current.y;

          const rawPanX = pinchStartPan.current.x + deltaX;
          const rawPanY = pinchStartPan.current.y + deltaY;

          const clamped = clampPan(rawPanX, rawPanY, targetZoom);

          zoomRef.current = targetZoom;
          panRef.current = clamped;

          zoomAnim.setValue(targetZoom);
          panXAnim.setValue(clamped.x);
          panYAnim.setValue(clamped.y);
        } else if (touches && touches.length === 1) {
          if (isPinching.current) {
            isPinching.current = false;
            pinchStartDist.current = 0;
            dragStartPan.current = { ...panRef.current };
            return;
          }

          const rawPanX = dragStartPan.current.x + gestureState.dx;
          const rawPanY = dragStartPan.current.y + gestureState.dy;

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

  const handleStepZoom = (delta: number) => {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((zoomRef.current + delta).toFixed(1))));
    zoomRef.current = nextZoom;
    const clamped = clampPan(panRef.current.x, panRef.current.y, nextZoom);
    panRef.current = clamped;
    setDisplayZoom(nextZoom);

    Animated.parallel([
      Animated.timing(zoomAnim, { toValue: nextZoom, duration: 140, useNativeDriver: false }),
      Animated.timing(panXAnim, { toValue: clamped.x, duration: 140, useNativeDriver: false }),
      Animated.timing(panYAnim, { toValue: clamped.y, duration: 140, useNativeDriver: false }),
    ]).start();
  };

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

        {/* Viewport Area */}
        <View style={styles.viewportContainer}>
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
              {...panResponder.panHandlers}
            >
              {/* Scalable & Draggable Image */}
              <Animated.View
                style={[
                  styles.imageWrapper,
                  {
                    width: baseW,
                    height: baseH,
                    transform: [
                      { scale: zoomAnim },
                      { translateX: panXAnim },
                      { translateY: panYAnim },
                    ],
                  },
                ]}
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
            {/* Zoom Stepper & Pill */}
            <View style={styles.zoomControlsRow}>
              <TouchableOpacity
                onPress={() => handleStepZoom(-0.2)}
                disabled={displayZoom <= MIN_ZOOM}
                style={[styles.zoomStepBtn, displayZoom <= MIN_ZOOM && styles.zoomStepBtnDisabled]}
                activeOpacity={0.7}
                accessibilityLabel="Zoom out"
              >
                <MaterialIcons name="remove" size={18} color={colors.primary} />
              </TouchableOpacity>

              <View style={styles.zoomPill}>
                <Text style={styles.zoomPillText}>{displayZoom.toFixed(1)}x</Text>
              </View>

              <TouchableOpacity
                onPress={() => handleStepZoom(0.2)}
                disabled={displayZoom >= MAX_ZOOM}
                style={[styles.zoomStepBtn, displayZoom >= MAX_ZOOM && styles.zoomStepBtnDisabled]}
                activeOpacity={0.7}
                accessibilityLabel="Zoom in"
              >
                <MaterialIcons name="add" size={18} color={colors.primary} />
              </TouchableOpacity>
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
      paddingHorizontal: 16,
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
      position: 'absolute',
    },
    apertureBorder: {
      position: 'absolute',
      top: 0,
      left: 0,
      borderWidth: 2,
    },
    aspectPillsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
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
      marginTop: 14,
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
    zoomControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    zoomStepBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    zoomStepBtnDisabled: {
      opacity: 0.35,
    },
    zoomPill: {
      minWidth: 54,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: BorderRadius.full,
      backgroundColor: isDark ? 'rgba(254, 186, 72, 0.15)' : 'rgba(232, 167, 54, 0.15)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(254, 186, 72, 0.3)' : 'rgba(232, 167, 54, 0.3)',
      alignItems: 'center',
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
      paddingHorizontal: 14,
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
