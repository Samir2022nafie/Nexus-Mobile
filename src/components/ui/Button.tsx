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

type ButtonVariant = 'primary' | 'secondary' | 'outlined' | 'text' | 'error';
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
      activeOpacity={0.7}
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
          color={variant === 'outlined' || variant === 'text' ? Colors.primary : Colors.onPrimary}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
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
    borderRadius: BorderRadius.lg,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },

  // Variants
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.secondaryContainer,
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  size_md: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
  },
  size_lg: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
  },

  // Text
  text_base: {
    fontWeight: '600',
  },
  text_primary: {
    color: Colors.onPrimary,
  },
  text_secondary: {
    color: Colors.onSecondaryContainer,
  },
  text_outlined: {
    color: Colors.primary,
  },
  text_text: {
    color: Colors.primary,
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
