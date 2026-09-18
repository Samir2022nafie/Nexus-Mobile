/**
 * Empty state placeholder component.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox',
  title,
  subtitle,
  actionLabel,
  onAction,
}) => {
  return (
    <View style={styles.container}>
      <MaterialIcons name={icon} size={56} color={Colors.outlineVariant} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} variant="outlined" size="sm" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  title: {
    ...Typography.titleMd,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.bodyMd,
    color: Colors.outline,
    textAlign: 'center',
    maxWidth: 280,
  },
});
