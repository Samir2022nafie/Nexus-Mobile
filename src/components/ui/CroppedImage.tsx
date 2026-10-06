import React, { useState } from 'react';
import {
  View,
  Image,
  ImageStyle,
  ViewStyle,
  StyleSheet,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import { parseCropFromUrl, extractDirectImageUrl } from '../../utils/imageUrl';

export interface CroppedImageProps {
  uri?: string | null;
  style?: ImageStyle;
  containerStyle?: ViewStyle;
  aspectRatio?: number;
  resizeMode?: 'cover' | 'contain' | 'stretch';
  fill?: boolean;
  fallback?: React.ReactNode;
}

/**
 * Universal crop-aware Image component for Mobile.
 * Preserves custom pan, zoom, and aspect ratio parameters across Mobile and Admin.
 */
export const CroppedImage: React.FC<CroppedImageProps> = ({
  uri,
  style,
  containerStyle,
  aspectRatio,
  resizeMode = 'cover',
  fill = false,
  fallback,
}) => {
  const [measuredWidth, setMeasuredWidth] = useState<number>(0);
  const [measuredHeight, setMeasuredHeight] = useState<number>(0);
  const [loadError, setLoadError] = useState<boolean>(false);

  if (!uri || typeof uri !== 'string' || !uri.trim() || loadError) {
    if (fallback) {
      const {
        width,
        height,
        borderRadius,
        borderTopLeftRadius,
        borderTopRightRadius,
        borderBottomLeftRadius,
        borderBottomRightRadius,
        margin,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight,
        marginHorizontal,
        marginVertical,
      } = (style || {}) as ImageStyle;
      return (
        <View
          style={[
            styles.container,
            width !== undefined ? { width } : null,
            height !== undefined ? { height } : null,
            borderRadius !== undefined ? { borderRadius } : null,
            borderTopLeftRadius !== undefined ? { borderTopLeftRadius } : null,
            borderTopRightRadius !== undefined ? { borderTopRightRadius } : null,
            borderBottomLeftRadius !== undefined ? { borderBottomLeftRadius } : null,
            borderBottomRightRadius !== undefined ? { borderBottomRightRadius } : null,
            margin !== undefined ? { margin } : null,
            marginTop !== undefined ? { marginTop } : null,
            marginBottom !== undefined ? { marginBottom } : null,
            marginLeft !== undefined ? { marginLeft } : null,
            marginRight !== undefined ? { marginRight } : null,
            marginHorizontal !== undefined ? { marginHorizontal } : null,
            marginVertical !== undefined ? { marginVertical } : null,
            fill && width === undefined ? { width: '100%' } : null,
            fill && height === undefined ? { height: '100%' } : null,
            containerStyle,
          ]}
        >
          {fallback}
        </View>
      );
    }
    return null;
  }

  const crop = parseCropFromUrl(uri);
  if (!crop.cleanUrl) {
    if (fallback) {
      const {
        width,
        height,
        borderRadius,
        borderTopLeftRadius,
        borderTopRightRadius,
        borderBottomLeftRadius,
        borderBottomRightRadius,
        margin,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight,
        marginHorizontal,
        marginVertical,
      } = (style || {}) as ImageStyle;
      return (
        <View
          style={[
            styles.container,
            width !== undefined ? { width } : null,
            height !== undefined ? { height } : null,
            borderRadius !== undefined ? { borderRadius } : null,
            borderTopLeftRadius !== undefined ? { borderTopLeftRadius } : null,
            borderTopRightRadius !== undefined ? { borderTopRightRadius } : null,
            borderBottomLeftRadius !== undefined ? { borderBottomLeftRadius } : null,
            borderBottomRightRadius !== undefined ? { borderBottomRightRadius } : null,
            margin !== undefined ? { margin } : null,
            marginTop !== undefined ? { marginTop } : null,
            marginBottom !== undefined ? { marginBottom } : null,
            marginLeft !== undefined ? { marginLeft } : null,
            marginRight !== undefined ? { marginRight } : null,
            marginHorizontal !== undefined ? { marginHorizontal } : null,
            marginVertical !== undefined ? { marginVertical } : null,
            fill && width === undefined ? { width: '100%' } : null,
            fill && height === undefined ? { height: '100%' } : null,
            containerStyle,
          ]}
        >
          {fallback}
        </View>
      );
    }
    return null;
  }

  const hasCrop = crop.zoom > 1 || crop.panX !== 0 || crop.panY !== 0;
  const effectiveRatio = aspectRatio || crop.aspectRatio;

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && width !== measuredWidth) {
      setMeasuredWidth(width);
    }
    if (height > 0 && height !== measuredHeight) {
      setMeasuredHeight(height);
    }
  };

  const {
    width,
    height,
    borderRadius,
    borderTopLeftRadius,
    borderTopRightRadius,
    borderBottomLeftRadius,
    borderBottomRightRadius,
    margin,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    marginHorizontal,
    marginVertical,
    ...restImageStyle
  } = (style || {}) as ImageStyle;

  const resolvedWidth = typeof containerStyle?.width === 'number'
    ? containerStyle.width
    : typeof width === 'number'
    ? width
    : measuredWidth;
  const resolvedHeight = typeof containerStyle?.height === 'number'
    ? containerStyle.height
    : typeof height === 'number'
    ? height
    : measuredHeight;

  const w = measuredWidth || resolvedWidth || 0;
  const h = measuredHeight || resolvedHeight || 0;

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.container,
        width !== undefined ? { width } : null,
        height !== undefined ? { height } : null,
        borderRadius !== undefined ? { borderRadius } : null,
        borderTopLeftRadius !== undefined ? { borderTopLeftRadius } : null,
        borderTopRightRadius !== undefined ? { borderTopRightRadius } : null,
        borderBottomLeftRadius !== undefined ? { borderBottomLeftRadius } : null,
        borderBottomRightRadius !== undefined ? { borderBottomRightRadius } : null,
        margin !== undefined ? { margin } : null,
        marginTop !== undefined ? { marginTop } : null,
        marginBottom !== undefined ? { marginBottom } : null,
        marginLeft !== undefined ? { marginLeft } : null,
        marginRight !== undefined ? { marginRight } : null,
        marginHorizontal !== undefined ? { marginHorizontal } : null,
        marginVertical !== undefined ? { marginVertical } : null,
        fill && width === undefined && containerStyle?.width === undefined ? { width: '100%' } : null,
        fill && height === undefined && containerStyle?.height === undefined ? { height: '100%' } : null,
        effectiveRatio && !fill ? { aspectRatio: effectiveRatio } : null,
        containerStyle,
      ]}
    >
      <Image
        source={{ uri: crop.cleanUrl }}
        style={[
          styles.image,
          restImageStyle,
          hasCrop && w > 0 && h > 0
            ? {
                transform: [
                  { translateX: (crop.panX / 100) * w },
                  { translateY: (crop.panY / 100) * h },
                  { scale: crop.zoom },
                ],
              }
            : null,
        ]}
        resizeMode={resizeMode}
        onError={() => setLoadError(true)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
