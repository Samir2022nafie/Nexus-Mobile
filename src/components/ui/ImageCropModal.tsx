/**
 * ImageCropModal — Universal image cropping modal for Mobile.
 * Supports:
 * - 'circle': 1:1 circular crop for user & community avatars/PFPs (large 360px viewport)
 * - 'wide-rectangle': 16:9 crop for community banners, event covers, hangout covers
 * - 'rectangle': Post images (fixed full container width, vertically resizable gallery-style grid with 1:1 minimum height)
 * Features:
 * - Gallery-style vertically resizable crop grid with top/bottom drag handles, corner accents, and rule-of-thirds gridlines
 * - Minimum height strictly enforced at 1:1 aspect ratio (square) for posts
 * - Multi-touch two-finger pinch-to-zoom (1.0x to 3.0x) working across the entire viewport
 * - Single-finger dragging strictly clamped so image can NEVER detach from container borders
 * - Physical image cropping via expo-image-manipulator returning real cropped JPEG files
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
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
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
  const [isApplying, setIsApplying] = useState(false);

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

  // Fixed horizontal width
  const boxWidth = cropShape === 'circle' ? Math.min(360, SCREEN_WIDTH - 28) : SCREEN_WIDTH - 24;

  // Max and min allowable height for rectangle post crop
  const maxPostHeight = Math.min(Math.round(SCREEN_HEIGHT * 0.56), 500);
  // User requirement: "the minimum height you can crop an image should be a 1:1 ratio"
  const minPostHeight = boxWidth; // 1:1 ratio minimum height

  // Post crop dynamic height state (gallery-style resizable grid)
  const [cropHeight, setCropHeight] = useState<number>(boxWidth);
  const cropHeightRef = useRef<number>(boxWidth);
  const startResizeHeight = useRef<number>(boxWidth);

  // Keep ref synchronized with state
  useEffect(() => {
    cropHeightRef.current = cropHeight;
  }, [cropHeight]);

  // Calculate box height based on crop shape
  const activeBoxHeight = useMemo(() => {
    if (cropShape === 'circle') {
      return boxWidth;
    }
    if (cropShape === 'wide-rectangle') {
      const targetRatio = aspectRatio ?? (16 / 9);
      return Math.round(boxWidth / targetRatio);
    }
    // rectangle (posts)
    return cropHeight;
  }, [cropShape, boxWidth, aspectRatio, cropHeight]);

  // Base dimensions calculation: image always covers the box completely at baseScale
  const baseScale = origSize ? Math.max(boxWidth / origSize.width, activeBoxHeight / origSize.height) : 1;
  const baseW = origSize ? origSize.width * baseScale : boxWidth;
  const baseH = origSize ? origSize.height * baseScale : activeBoxHeight;

  // Strict clamping helper: guarantees image can NEVER detach from container borders
  const clampPan = (rawX: number, rawY: number, z: number, bH: number = activeBoxHeight) => {
    const scale = origSize ? Math.max(boxWidth / origSize.width, bH / origSize.height) : 1;
    const currentBaseW = origSize ? origSize.width * scale : boxWidth;
    const currentBaseH = origSize ? origSize.height * scale : bH;

    const scaledW = currentBaseW * z;
    const scaledH = currentBaseH * z;
    const maxX = Math.max(0, (scaledW - boxWidth) / 2);
    const maxY = Math.max(0, (scaledH - bH) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, rawX)),
      y: Math.max(-maxY, Math.min(maxY, rawY)),
    };
  };

  // Keep pan bounded when container dimensions or base size change
  useEffect(() => {
    if (!origSize) return;
    const clamped = clampPan(panRef.current.x, panRef.current.y, zoomRef.current, activeBoxHeight);
    panRef.current = clamped;
    panXAnim.setValue(clamped.x);
    panYAnim.setValue(clamped.y);
  }, [boxWidth, activeBoxHeight, origSize]);

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
      zoomAnim.setValue(1.0);
      panXAnim.setValue(0);
      panYAnim.setValue(0);
      setIsApplying(false);
      return;
    }

    setLoadingOrig(true);
    setIsApplying(false);

    const initialZ = parsedImage.zoom > 0 ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parsedImage.zoom)) : 1.0;
    zoomRef.current = initialZ;
    setDisplayZoom(initialZ);
    zoomAnim.setValue(initialZ);

    const initialX = (parsedImage.panX / 100) * boxWidth;
    const initialY = (parsedImage.panY / 100) * boxWidth;
    panRef.current = { x: initialX, y: initialY };
    panXAnim.setValue(initialX);
    panYAnim.setValue(initialY);

    const direct = extractDirectImageUrl(cleanImageUri);
    Image.getSize(
      direct,
      (w, h) => {
        setOrigSize({ width: w, height: h });
        setLoadingOrig(false);

        if (cropShape === 'rectangle') {
          // Calculate natural height at full container width
          const naturalRatio = w / h;
          const naturalH = Math.round(boxWidth / naturalRatio);
          // Default post height: clamp between 1:1 minimum height and max allowed height
          const defaultH = Math.min(maxPostHeight, Math.max(minPostHeight, naturalH));
          setCropHeight(defaultH);
          cropHeightRef.current = defaultH;
        }
      },
      () => {
        setOrigSize({ width: 800, height: 800 });
        setLoadingOrig(false);
        if (cropShape === 'rectangle') {
          setCropHeight(boxWidth);
          cropHeightRef.current = boxWidth;
        }
      }
    );
  }, [visible, imageUri]);

  // Viewport-wide PanResponder for intuitive two-finger pinch-to-zoom and single-finger image dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => false,
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

            const midX = (touches[0].pageX + touches[1].pageX) / 2;
            const midY = (touches[0].pageY + touches[1].pageY) / 2;
            const deltaMidX = midX - pinchStartCenter.current.x;
            const deltaMidY = midY - pinchStartCenter.current.y;

            const rawPanX = pinchStartPan.current.x + deltaMidX;
            const rawPanY = pinchStartPan.current.y + deltaMidY;

            const clamped = clampPan(rawPanX, rawPanY, targetZoom, cropHeightRef.current);

            zoomRef.current = targetZoom;
            panRef.current = clamped;

            zoomAnim.setValue(targetZoom);
            panXAnim.setValue(clamped.x);
            panYAnim.setValue(clamped.y);
          }
        } else if (touches.length === 1) {
          // Single-finger drag
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

          const clamped = clampPan(rawPanX, rawPanY, zoomRef.current, cropHeightRef.current);

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

  // Draggable top edge handle PanResponder for vertical grid resizing
  const topHandlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        startResizeHeight.current = cropHeightRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        // Dragging top handle down decreases height; dragging up increases height
        const nextH = Math.min(
          maxPostHeight,
          Math.max(minPostHeight, startResizeHeight.current - gestureState.dy)
        );
        setCropHeight(Math.round(nextH));
      },
      onPanResponderRelease: () => {
        cropHeightRef.current = cropHeight;
      },
    })
  ).current;

  // Draggable bottom edge handle PanResponder for vertical grid resizing
  const bottomHandlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        startResizeHeight.current = cropHeightRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        // Dragging bottom handle down increases height; dragging up decreases height
        const nextH = Math.min(
          maxPostHeight,
          Math.max(minPostHeight, startResizeHeight.current + gestureState.dy)
        );
        setCropHeight(Math.round(nextH));
      },
      onPanResponderRelease: () => {
        cropHeightRef.current = cropHeight;
      },
    })
  ).current;

  const handleReset = () => {
    zoomRef.current = MIN_ZOOM;
    panRef.current = { x: 0, y: 0 };
    setDisplayZoom(MIN_ZOOM);

    if (cropShape === 'rectangle' && origSize) {
      const naturalRatio = origSize.width / origSize.height;
      const naturalH = Math.round(boxWidth / naturalRatio);
      const defaultH = Math.min(maxPostHeight, Math.max(minPostHeight, naturalH));
      setCropHeight(defaultH);
      cropHeightRef.current = defaultH;
    }

    Animated.parallel([
      Animated.spring(zoomAnim, { toValue: MIN_ZOOM, useNativeDriver: false }),
      Animated.spring(panXAnim, { toValue: 0, useNativeDriver: false }),
      Animated.spring(panYAnim, { toValue: 0, useNativeDriver: false }),
    ]).start();
  };

  const handleApplyCrop = async () => {
    if (!cleanImageUri || isApplying) return;
    setIsApplying(true);

    const currentBoxH = activeBoxHeight;
    const finalRatio = Number((boxWidth / currentBoxH).toFixed(3));

    // Try physical image cropping via expo-image-manipulator first
    if (origSize && origSize.width > 0 && origSize.height > 0) {
      try {
        const currentScale = baseScale * zoomRef.current;
        const renderW = origSize.width * currentScale;
        const renderH = origSize.height * currentScale;

        // Position of crop box relative to rendered image
        const cropXInRender = (renderW - boxWidth) / 2 - panRef.current.x;
        const cropYInRender = (renderH - currentBoxH) / 2 - panRef.current.y;

        // Translate into original pixel dimensions
        const originX = Math.max(0, Math.round(cropXInRender / currentScale));
        const originY = Math.max(0, Math.round(cropYInRender / currentScale));
        const cropW = Math.min(origSize.width - originX, Math.max(1, Math.round(boxWidth / currentScale)));
        const cropH = Math.min(origSize.height - originY, Math.max(1, Math.round(currentBoxH / currentScale)));

        const manipResult = await manipulateAsync(
          cleanImageUri,
          [
            {
              crop: {
                originX,
                originY,
                width: cropW,
                height: cropH,
              },
            },
          ],
          { compress: 0.92, format: SaveFormat.JPEG }
        );

        if (manipResult && manipResult.uri) {
          setIsApplying(false);
          onConfirm(manipResult.uri);
          return;
        }
      } catch (manipErr) {
        console.warn('Physical crop failed, falling back to encoded URL:', manipErr);
      }
    }

    // Fallback: encode standard crop parameters onto URL
    const panXPercent = boxWidth > 0 ? (panRef.current.x / boxWidth) * 100 : 0;
    const panYPercent = currentBoxH > 0 ? (panRef.current.y / currentBoxH) * 100 : 0;
    const encodedCropUrl = encodeCropUrl(
      cleanImageUri,
      Number(zoomRef.current.toFixed(2)),
      Number(panXPercent.toFixed(1)),
      Number(panYPercent.toFixed(1)),
      finalRatio
    );

    setIsApplying(false);
    onConfirm(encodedCropUrl);
  };

  if (!visible || !imageUri) return null;

  const resolvedTitle =
    title ||
    (cropShape === 'circle'
      ? 'Crop Profile Picture'
      : cropShape === 'wide-rectangle'
      ? 'Crop Banner'
      : 'Crop Post Image');

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
            disabled={loadingOrig || isApplying}
            activeOpacity={0.8}
          >
            {isApplying ? (
              <ActivityIndicator size="small" color={colors.onPrimaryContainer} />
            ) : (
              <Text style={styles.applyBtnText}>Apply</Text>
            )}
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
                  height: activeBoxHeight,
                  borderRadius: cropShape === 'circle' ? boxWidth / 2 : 12,
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
                    top: (activeBoxHeight - baseH) / 2,
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

              {/* Gallery-style 3x3 Rule-of-Thirds Grid (for rectangle post crops) */}
              {cropShape === 'rectangle' && (
                <View style={styles.gridOverlay} pointerEvents="none">
                  {/* Horizontal grid lines */}
                  <View style={[styles.gridLineH, { top: '33.33%' }]} />
                  <View style={[styles.gridLineH, { top: '66.66%' }]} />
                  {/* Vertical grid lines */}
                  <View style={[styles.gridLineV, { left: '33.33%' }]} />
                  <View style={[styles.gridLineV, { left: '66.66%' }]} />

                  {/* Corner Accent Brackets */}
                  <View style={[styles.cornerBracket, styles.cornerTL]} />
                  <View style={[styles.cornerBracket, styles.cornerTR]} />
                  <View style={[styles.cornerBracket, styles.cornerBL]} />
                  <View style={[styles.cornerBracket, styles.cornerBR]} />
                </View>
              )}

              {/* Aperture Border / Outline */}
              <View
                style={[
                  styles.apertureBorder,
                  {
                    width: boxWidth,
                    height: activeBoxHeight,
                    borderRadius: cropShape === 'circle' ? boxWidth / 2 : 12,
                    borderColor: cropShape === 'rectangle' ? '#ffffff' : colors.primary,
                  },
                ]}
                pointerEvents="none"
              />

              {/* Draggable Top Handle (Vertical resize for posts) */}
              {cropShape === 'rectangle' && (
                <View
                  style={styles.topHandleBar}
                  {...topHandlePanResponder.panHandlers}
                  hitSlop={{ top: 15, bottom: 15, left: 20, right: 20 }}
                >
                  <View style={styles.handlePill} />
                </View>
              )}

              {/* Draggable Bottom Handle (Vertical resize for posts) */}
              {cropShape === 'rectangle' && (
                <View
                  style={styles.bottomHandleBar}
                  {...bottomHandlePanResponder.panHandlers}
                  hitSlop={{ top: 15, bottom: 15, left: 20, right: 20 }}
                >
                  <View style={styles.handlePill} />
                </View>
              )}
            </View>
          )}

          <Text style={styles.hintText}>
            {cropShape === 'rectangle'
              ? 'Drag top/bottom bars to crop height (min 1:1) • Pinch to zoom'
              : 'Pinch with 2 fingers to zoom • Drag to position'}
          </Text>
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
      position: 'relative',
    },
    imageWrapper: {
      // Positioned and sized dynamically
    },
    apertureBorder: {
      position: 'absolute',
      borderWidth: 2,
    },
    gridOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    gridLineH: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    gridLineV: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    cornerBracket: {
      position: 'absolute',
      width: 22,
      height: 22,
      borderColor: '#ffffff',
    },
    cornerTL: {
      top: 0,
      left: 0,
      borderTopWidth: 3.5,
      borderLeftWidth: 3.5,
    },
    cornerTR: {
      top: 0,
      right: 0,
      borderTopWidth: 3.5,
      borderRightWidth: 3.5,
    },
    cornerBL: {
      bottom: 0,
      left: 0,
      borderBottomWidth: 3.5,
      borderLeftWidth: 3.5,
    },
    cornerBR: {
      bottom: 0,
      right: 0,
      borderBottomWidth: 3.5,
      borderRightWidth: 3.5,
    },
    topHandleBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 28,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: 4,
      zIndex: 20,
    },
    bottomHandleBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 28,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 4,
      zIndex: 20,
    },
    handlePill: {
      width: 48,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: '#ffffff',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.5,
      shadowRadius: 2,
      elevation: 4,
    },
    hintText: {
      marginTop: 18,
      fontSize: 12,
      color: colors.outline,
      fontWeight: '500',
      textAlign: 'center',
      paddingHorizontal: 20,
    },
    bottomBar: {
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 40 : 20,
      paddingTop: 12,
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
      backgroundColor: colors.surfaceContainerHigh,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: BorderRadius.full,
      gap: 5,
    },
    zoomPillText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    resetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceContainerHigh,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: BorderRadius.full,
      gap: 4,
    },
    resetBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
  });
