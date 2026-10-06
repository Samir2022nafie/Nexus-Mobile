/**
 * Avatar component with image or fallback initials.
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { parseCropFromUrl } from '../../utils/imageUrl';

export interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  shape?: 'circle' | 'rounded' | 'square';
  borderRadius?: number;
  borderColor?: string;
  showBorder?: boolean;
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

function getColorFromName(name?: string): string {
  const colors = [
    '#e8a736', '#455f85', '#695c50', '#805600',
    '#16a34a', '#ba1a1a', '#2d486c', '#504539',
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 40,
  shape = 'circle',
  borderRadius: customRadius,
  borderColor,
  showBorder = false,
}) => {
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

  const bgColor = getColorFromName(name);
  const initials = getInitials(name);
  const fontSize = size * 0.36;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: resolvedRadius,
          backgroundColor: bgColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        borderStyle,
      ]}
    >
      <Text style={{ color: Colors.white, fontSize, fontWeight: '700' }}>
        {initials}
      </Text>
    </View>
  );
};
