/**
 * Avatar component with crop-aware image rendering and icon fallbacks.
 * Uses MaterialIcons 'person' for users and 'groups' for communities (NO initials).
 */
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { parseCropFromUrl } from '../../utils/imageUrl';

export interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  shape?: 'circle' | 'rounded' | 'square';
  borderRadius?: number;
  borderColor?: string;
  showBorder?: boolean;
  type?: 'user' | 'community';
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 40,
  shape = 'circle',
  borderRadius: customRadius,
  borderColor,
  showBorder = false,
  type = 'user',
}) => {
  const { colors, isDark } = useTheme();
  const [loadError, setLoadError] = React.useState(false);

  React.useEffect(() => {
    setLoadError(false);
  }, [uri]);

  const resolvedRadius = customRadius !== undefined
    ? customRadius
    : shape === 'circle'
    ? size / 2
    : shape === 'rounded'
    ? Math.round(size * 0.25)
    : 0;

  const borderStyle = showBorder
    ? { borderWidth: 2, borderColor: borderColor || Colors.primaryContainer }
    : {};

  if (uri && !loadError) {
    const crop = parseCropFromUrl(uri);
    if (crop.cleanUrl) {
      return (
        <View
          style={[
            {
              width: size,
              height: size,
              borderRadius: resolvedRadius,
              overflow: 'hidden',
            },
            borderStyle,
          ]}
        >
          <Image
            source={{ uri: crop.cleanUrl }}
            style={[
              {
                width: size,
                height: size,
              },
              crop.zoom > 1 || crop.panX !== 0 || crop.panY !== 0
                ? {
                    transform: [
                      { translateX: (crop.panX / 100) * size },
                      { translateY: (crop.panY / 100) * size },
                      { scale: crop.zoom },
                    ],
                  }
                : null,
            ]}
            resizeMode="cover"
            onError={() => setLoadError(true)}
          />
        </View>
      );
    }
  }

  const iconName = type === 'community' ? 'groups' : 'person';
  const iconSize = Math.max(12, Math.round(size * 0.55));
  const fallbackBg = isDark ? '#262320' : colors.surfaceContainerHigh;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: resolvedRadius,
          backgroundColor: fallbackBg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        borderStyle,
      ]}
    >
      <MaterialIcons name={iconName} size={iconSize} color={colors.tertiary} />
    </View>
  );
};
