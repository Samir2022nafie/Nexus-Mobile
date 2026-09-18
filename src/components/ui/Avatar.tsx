/**
 * Avatar component with image or fallback initials.
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors, Typography } from '../../constants/theme';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
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
  borderColor,
  showBorder = false,
}) => {
  const borderStyle = showBorder
    ? { borderWidth: 2, borderColor: borderColor || Colors.primaryContainer }
    : {};

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          borderStyle,
        ]}
      />
    );
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
          borderRadius: size / 2,
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
