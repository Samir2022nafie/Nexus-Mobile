import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { ThemeColors, Typography, BorderRadius, Shadows, Spacing } from '../../constants/theme';

export interface OtpInputProps {
  value: string | string[];
  onChange: (code: string, codeArr: string[]) => void;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
  boxWidth?: number;
  boxHeight?: number;
  style?: StyleProp<ViewStyle>;
  onComplete?: (code: string) => void;
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  error = false,
  autoFocus = false,
  boxWidth,
  boxHeight,
  style,
  onComplete,
}: OtpInputProps) {
  const inputRef = useRef<TextInput | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const { colors } = useTheme();
  const styles = useThemedStyles(getStyles);

  // Normalize string value
  const codeString = Array.isArray(value) ? value.join('') : (value || '');
  const digits = codeString.replace(/\D/g, '').slice(0, length);

  // Blinking cursor when focused
  useEffect(() => {
    if (!isFocused) {
      setCursorVisible(false);
      return;
    }
    setCursorVisible(true);
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 530);
    return () => clearInterval(interval);
  }, [isFocused]);

  useEffect(() => {
    if (autoFocus) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const updateCode = (cleanCode: string) => {
    const arr = Array.from({ length }, (_, i) => cleanCode[i] || '');
    onChange(cleanCode, arr);
    if (cleanCode.length === length) {
      onComplete?.(cleanCode);
    }
  };

  const handleChangeText = (rawText: string) => {
    const onlyDigits = rawText.replace(/\D/g, '');

    // Smart paste detection:
    // If the change added more than 1 character at once, it's a paste or autofill!
    if (onlyDigits.length > digits.length + 1 || onlyDigits.length >= length) {
      // If the user had digits already and pasted after, extract the newly pasted digits
      if (digits.length > 0 && onlyDigits.startsWith(digits) && onlyDigits.length > digits.length) {
        const pastedPart = onlyDigits.slice(digits.length);
        if (pastedPart.length >= length) {
          updateCode(pastedPart.slice(0, length));
          return;
        }
      }
      // If the pasted string contains at least `length` digits, take the most relevant block
      if (onlyDigits.length >= length) {
        // Prefer the last `length` digits if appended, or the first `length`
        const clean =
          onlyDigits.length > length && digits.length > 0
            ? onlyDigits.slice(-length)
            : onlyDigits.slice(0, length);
        updateCode(clean);
        return;
      }
    }

    const clean = onlyDigits.slice(0, length);
    updateCode(clean);
  };

  const handleContainerPress = () => {
    inputRef.current?.focus();
  };

  return (
    <Pressable
      onPress={handleContainerPress}
      style={[styles.container, style]}
      accessible={true}
      accessibilityRole="none"
      accessibilityLabel={`Verification code input, ${digits.length} of ${length} digits entered`}
    >
      {/* Separated Visual Tactile Digit Boxes */}
      <View style={styles.boxesRow} pointerEvents="none">
        {Array.from({ length }).map((_, idx) => {
          const char = digits[idx] || '';
          const isCurrentActive =
            isFocused &&
            (idx === digits.length || (idx === length - 1 && digits.length === length));

          return (
            <View
              key={idx}
              style={[
                styles.otpBox,
                boxWidth ? { width: boxWidth } : null,
                boxHeight ? { height: boxHeight } : null,
                char ? styles.otpBoxFilled : null,
                error ? styles.otpBoxError : null,
                isCurrentActive ? styles.otpBoxActive : null,
              ]}
            >
              {char ? (
                <Text style={styles.digitText}>{char}</Text>
              ) : isCurrentActive && cursorVisible ? (
                <View style={styles.cursor} />
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Real Full-Coverage TextInput — Enables Native Paste, Typing, and SMS Auto-fill */}
      <TextInput
        ref={inputRef}
        value={digits}
        onChangeText={handleChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={32}
        selectionColor="transparent"
        style={styles.hiddenInput}
        autoFocus={autoFocus}
      />
    </Pressable>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: Spacing.sm,
      width: '100%',
    },
    boxesRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      width: '100%',
    },
    otpBox: {
      width: 44,
      height: 52,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.surfaceContainerHighest || colors.surfaceVariant,
      borderWidth: 1.5,
      borderColor: colors.outlineVariant,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.sm,
    },
    otpBoxFilled: {
      backgroundColor: colors.surfaceContainerHigh || colors.surface,
      borderColor: colors.primaryContainer,
      borderWidth: 2,
    },
    otpBoxActive: {
      borderColor: colors.primaryContainer,
      borderWidth: 2,
      backgroundColor: colors.surfaceContainerHigh || colors.surface,
    },
    otpBoxError: {
      borderColor: colors.error,
      borderWidth: 2,
    },
    cursor: {
      width: 2,
      height: 22,
      backgroundColor: colors.primary,
      borderRadius: 1,
    },
    digitText: {
      ...Typography.headlineSm,
      color: colors.onSurface,
      fontWeight: '700',
      textAlign: 'center',
    },
    hiddenInput: {
      ...StyleSheet.absoluteFill,
      opacity: 0.01,
      fontSize: 24,
      color: 'transparent',
    },
  });
