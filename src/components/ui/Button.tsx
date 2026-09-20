/**
 * Reusable Button component with multiple variants.
 * Replaces the various button styles from both batches.
 */
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '../../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'outlined' | 'text' | 'error';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  style,
  textStyle,
}) => {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outlined' || variant === 'text' ? Colors.primaryContainer : Colors.onPrimary}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text_base,
              styles[`text_${variant}`],
              styles[`textSize_${size}`],
              isDisabled && styles.disabledText,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.4,
  },

  // Variants
  primary: {
    backgroundColor: Colors.primaryContainer,
  },
  secondary: {
    backgroundColor: Colors.secondary,
  },
  tonal: {
    backgroundColor: Colors.surfaceContainerHigh,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.outlineVariant,
  },
  text: {
    backgroundColor: 'transparent',
  },
  error: {
    backgroundColor: Colors.error,
  },

  // Sizes
  size_sm: {
    height: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  size_md: {
    height: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  size_lg: {
    height: 48,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },

  // Text
  text_base: {
    fontWeight: '600',
  },
  text_primary: {
    color: Colors.onPrimary,
  },
  text_secondary: {
    color: Colors.onSecondary,
  },
  text_tonal: {
    color: Colors.primaryContainer,
  },
  text_outlined: {
    color: Colors.primaryContainer,
  },
  text_text: {
    color: Colors.primaryContainer,
  },
  text_error: {
    color: Colors.onError,
  },

  // Text sizes
  textSize_sm: {
    ...Typography.labelSm,
  },
  textSize_md: {
    ...Typography.labelMd,
  },
  textSize_lg: {
    ...Typography.labelLg,
  },

  disabledText: {
    opacity: 0.7,
  },
});
