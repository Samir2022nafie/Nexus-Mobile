import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface RaisingHandIconProps {
  size?: number;
  color?: string;
  plusColor?: string;
}

/**
 * RaisingHandIcon — Vector icon for the Unjoined hangout state.
 * Features:
 * - Authentic person raising their hand (MaterialIcons "hail").
 * - Displays a small plus (+) badge positioned on the left side of the person.
 */
export const RaisingHandIcon: React.FC<RaisingHandIconProps> = ({
  size = 18,
  color = '#2d1600',
  plusColor,
}) => {
  const pColor = plusColor || color;
  const plusSize = Math.max(8, Math.round(size * 0.48));

  return (
    <View style={[styles.container, { width: size + 4, height: size }]}>
      <MaterialIcons name="hail" size={size} color={color} />
      <View style={styles.plusBadge}>
        <MaterialIcons name="add" size={plusSize} color={pColor} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBadge: {
    position: 'absolute',
    left: -2,
    top: 0,
  },
});

export default RaisingHandIcon;
