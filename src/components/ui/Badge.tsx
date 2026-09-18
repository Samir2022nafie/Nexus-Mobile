/**
 * Badge component for status labels (Public, Community, Open, Pending, etc.)
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '../../constants/theme';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  primary: { bg: Colors.primaryFixed, text: Colors.onPrimaryFixed },
  secondary: { bg: Colors.secondaryFixed, text: Colors.onSecondaryFixed },
  success: { bg: Colors.successContainer, text: '#166534' },
  warning: { bg: Colors.warningContainer, text: '#92400e' },
  error: { bg: Colors.errorContainer, text: Colors.onErrorContainer },
  neutral: { bg: Colors.surfaceContainerHigh, text: Colors.onSurfaceVariant },
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  size = 'sm',
  icon,
}) => {
  const colors = variantColors[variant];

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: colors.bg },
        size === 'sm' ? styles.sm : styles.md,
      ]}
    >
      {icon}
      <Text
        style={[
          size === 'sm' ? styles.textSm : styles.textMd,
          { color: colors.text },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  md: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: BorderRadius.md,
  },
  textSm: {
    ...Typography.captionSm,
    fontWeight: '600',
  },
  textMd: {
    ...Typography.captionMd,
    fontWeight: '600',
  },
});
