/**
 * Card container with optional elevation.
 */
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, BorderRadius, Spacing, Shadows } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'filled' | 'outlined' | 'parchment';
  padding?: number;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'parchment',
  padding = Spacing.md,
  style,
}) => {
  return (
    <View
      style={[
        styles.base,
        { padding },
        variant === 'elevated' && styles.elevated,
        variant === 'filled' && styles.filled,
        variant === 'outlined' && styles.outlined,
        variant === 'parchment' && styles.parchment,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.xl,
  },
  parchment: {
    backgroundColor: Colors.tertiaryFixed,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  elevated: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
  },
  filled: {
    backgroundColor: Colors.surfaceContainerLow,
  },
  outlined: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
});
