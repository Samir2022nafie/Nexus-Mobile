/**
 * ImageCropModal — Universal image cropping modal for Mobile.
 * Supports:
 * - 'circle': 1:1 circular crop for user & community avatars/PFPs
 * - 'wide-rectangle': 16:9 crop for community banners, event covers, hangout covers
 * - 'rectangle': 16:9 / flexible crop for post cards
 * Features:
 * - Tactile pan / seek gestures (PanResponder)
 * - Zoom slider & buttons (1x to 3x)
 * - Pixel-accurate cropping via expo-image-manipulator
 */
import React, { useState, useEffect, useRef } from 'react';
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
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

  // Natural image dimensions
  const [origSize, setOrigSize] = useState<{ width: number; height: number } | null>(null);
  const [loadingOrig, setLoadingOrig] = useState(true);
  const [cropping, setCropping] = useState(false);

  // Zoom level (1.0x to 3.5x)
  const [zoom, setZoom] = useState(1.0);
  const zoomRef = useRef(1.0);
  zoomRef.current = zoom;

  // Pan offsets
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const currentPan = useRef({ x: 0, y: 0 });

  // Crop aperture dimensions
  const targetRatio = aspectRatio ?? (cropShape === 'circle' ? 1.0 : 16 / 9);
  const maxBoxWidth = SCREEN_WIDTH - 48;
  const boxWidth = Math.min(320, maxBoxWidth);
  const boxHeight = Math.round(boxWidth / targetRatio);

  // Reset state when modal opens with new image
  useEffect(() => {
    if (!visible || !imageUri) {
      setOrigSize(null);
      setZoom(1.0);
      currentPan.current = { x: 0, y: 0 };
      panX.setValue(0);
      panY.setValue(0);
      return;
    }

    setLoadingOrig(true);
    setZoom(1.0);
    currentPan.current = { x: 0, y: 0 };
    panX.setValue(0);
    panY.setValue(0);

    Image.getSize(
      imageUri,
      (w, h) => {
        setOrigSize({ width: w, height: h });
        setLoadingOrig(false);
      },
      (err) => {
        console.warn('Could not get image size:', err);
        setOrigSize({ width: 800, height: 800 });
        setLoadingOrig(false);
      }
    );
  }, [visible, imageUri]);

  // PanResponder for dragging/seeking image inside the crop window
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        panX.setOffset(currentPan.current.x);
        panY.setOffset(currentPan.current.y);
        panX.setValue(0);
        panY.setValue(0);
      },
      onPanResponderMove: Animated.event([null, { dx: panX, dy: panY }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        panX.flattenOffset();
        panY.flattenOffset();
        currentPan.current.x += gestureState.dx;
        currentPan.current.y += gestureState.dy;
      },
    })
  ).current;

  const handleZoomChange = (delta: number) => {
    setZoom((prev) => {
      const next = Math.max(1.0, Math.min(3.5, Number((prev + delta).toFixed(2))));
      return next;
    });
  };

  const handleReset = () => {
    setZoom(1.0);
    currentPan.current = { x: 0, y: 0 };
    Animated.parallel([
      Animated.spring(panX, { toValue: 0, useNativeDriver: false }),
      Animated.spring(panY, { toValue: 0, useNativeDriver: false }),
    ]).start();
  };

  const handleApplyCrop = async () => {
    if (!imageUri || !origSize || cropping) return;
    setCropping(true);

    try {
      const origW = origSize.width;
      const origH = origSize.height;

      // Base scale that covers the crop box
      const baseScale = Math.max(boxWidth / origW, boxHeight / origH);
      const totalScale = baseScale * zoom;

      const dispW = origW * totalScale;
      const dispH = origH * totalScale;

      // Image top-left relative to crop box top-left
      const imgLeft = (boxWidth - dispW) / 2 + currentPan.current.x;
      const imgTop = (boxHeight - dispH) / 2 + currentPan.current.y;

      // In original image coordinates:
      const originX = Math.round(Math.max(0, -imgLeft / totalScale));
      const originY = Math.round(Math.max(0, -imgTop / totalScale));
      const cropW = Math.round(Math.min(origW - originX, boxWidth / totalScale));
      const cropH = Math.round(Math.min(origH - originY, boxHeight / totalScale));

      const safeCropW = Math.max(10, Math.min(origW - originX, cropW));
      const safeCropH = Math.max(10, Math.min(origH - originY, cropH));

      const result = await manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: Math.min(origW - safeCropW, Math.max(0, originX)),
              originY: Math.min(origH - safeCropH, Math.max(0, originY)),
              width: safeCropW,
              height: safeCropH,
            },
          },
        ],
        { compress: 0.9, format: SaveFormat.JPEG }
      );

      onConfirm(result.uri);
    } catch (err) {
      console.error('Cropping failed:', err);
      // Fallback: use original image uri if manipulation fails
      onConfirm(imageUri);
    } finally {
      setCropping(false);
    }
  };

  if (!visible || !imageUri) return null;

  // Base dimensions when displayed inside viewport
  const baseScale = origSize ? Math.max(boxWidth / origSize.width, boxHeight / origSize.height) : 1;
  const renderWidth = origSize ? origSize.width * baseScale * zoom : boxWidth * zoom;
  const renderHeight = origSize ? origSize.height * baseScale * zoom : boxHeight * zoom;

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
            style={[styles.applyBtn, cropping && { opacity: 0.6 }]}
            disabled={cropping || loadingOrig}
            activeOpacity={0.8}
          >
            {cropping ? (
              <ActivityIndicator size="small" color="#18130e" />
            ) : (
              <Text style={styles.applyBtnText}>Apply</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Viewport Area */}
        <View style={styles.viewportContainer}>
          {loadingOrig ? (
            <ActivityIndicator size="large" color="#feba48" />
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
              {/* Draggable & Scalable Image */}
              <Animated.View
                style={[
                  styles.imageWrapper,
                  {
                    width: renderWidth,
                    height: renderHeight,
                    transform: [{ translateX: panX }, { translateY: panY }],
                  },
                ]}
              >
                <Image
                  source={{ uri: imageUri }}
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
                  },
                ]}
                pointerEvents="none"
              />
            </View>
          )}

          <Text style={styles.hintText}>Drag to position • Zoom to scale</Text>
        </View>

        {/* Bottom Control Bar: Zoom Controls & Reset */}
        <View style={styles.bottomBar}>
          <View style={styles.zoomRow}>
            <TouchableOpacity
              onPress={() => handleZoomChange(-0.2)}
              style={styles.zoomIconBtn}
              activeOpacity={0.7}
              disabled={zoom <= 1.0}
            >
              <MaterialIcons
                name="remove"
                size={22}
                color={zoom <= 1.0 ? 'rgba(255,255,255,0.3)' : '#ffffff'}
              />
            </TouchableOpacity>

            <View style={styles.zoomTrack}>
              <View
                style={[
                  styles.zoomIndicator,
                  { width: `${Math.round(((zoom - 1.0) / 2.5) * 100)}%` },
                ]}
              />
            </View>

            <TouchableOpacity
              onPress={() => handleZoomChange(0.2)}
              style={styles.zoomIconBtn}
              activeOpacity={0.7}
              disabled={zoom >= 3.5}
            >
              <MaterialIcons
                name="add"
                size={22}
                color={zoom >= 3.5 ? 'rgba(255,255,255,0.3)' : '#ffffff'}
              />
            </TouchableOpacity>

            <Text style={styles.zoomText}>{zoom.toFixed(1)}x</Text>

            <TouchableOpacity
              onPress={handleReset}
              style={styles.resetBtn}
              activeOpacity={0.7}
              accessibilityLabel="Reset crop zoom and position"
            >
              <MaterialIcons name="refresh" size={18} color="#feba48" />
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#0a0d14',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0e121b',
  },
  headerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  applyBtn: {
    backgroundColor: '#feba48',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18130e',
  },
  viewportContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cropWindow: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161b26',
    ...Shadows.lg,
  },
  imageWrapper: {
    position: 'absolute',
  },
  apertureBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 2,
    borderColor: '#feba48',
  },
  hintText: {
    marginTop: 18,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    backgroundColor: '#0e121b',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  zoomIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  zoomIndicator: {
    height: '100%',
    backgroundColor: '#feba48',
    borderRadius: 2,
  },
  zoomText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    minWidth: 32,
    textAlign: 'center',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(254, 186, 72, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#feba48',
  },
});
