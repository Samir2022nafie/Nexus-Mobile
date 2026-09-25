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
import { Typography, BorderRadius, Spacing, ThemeColors } from '../../constants/theme';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';

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
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);
  const isDisabled = disabled || loading;

  const spinnerColor =
    variant === 'outlined' || variant === 'text' || variant === 'tonal'
      ? colors.primaryContainer
      : colors.onPrimary;

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
        <ActivityIndicator size="small" color={spinnerColor} />
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

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
      backgroundColor: colors.primaryContainer,
    },
    secondary: {
      backgroundColor: colors.secondary,
    },
    tonal: {
      backgroundColor: colors.surfaceContainerHigh,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    outlined: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.outlineVariant,
    },
    text: {
      backgroundColor: 'transparent',
    },
    error: {
      backgroundColor: colors.error,
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
      color: colors.onPrimary,
      fontWeight: '700',
    },
    text_secondary: {
      color: colors.onSecondary,
      fontWeight: '600',
    },
    text_tonal: {
      color: colors.onSurface,
      fontWeight: '600',
    },
    text_outlined: {
      color: colors.primaryContainer,
      fontWeight: '600',
    },
    text_text: {
      color: colors.primaryContainer,
      fontWeight: '600',
    },
    text_error: {
      color: colors.onError,
      fontWeight: '600',
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
