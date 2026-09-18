/**
 * Reusable text input with label, error state, and password toggle.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  StyleSheet,
  TouchableOpacity,
  TextInputProps as RNTextInputProps,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Spacing } from '../../constants/theme';

interface InputProps extends Omit<RNTextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof MaterialIcons.glyphMap;
  isPassword?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  leftIcon,
  isPassword = false,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error ? styles.inputError : null,
        ]}
      >
        {leftIcon && (
          <MaterialIcons
            name={leftIcon}
            size={20}
            color={error ? Colors.error : isFocused ? Colors.primary : Colors.outline}
            style={styles.leftIcon}
          />
        )}
        <RNTextInput
          style={[styles.input, leftIcon ? styles.inputWithIcon : null]}
          placeholderTextColor={Colors.outline}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.toggleButton}
          >
            <MaterialIcons
              name={showPassword ? 'visibility' : 'visibility-off'}
              size={20}
              color={Colors.outline}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {hint && !error && <Text style={styles.hintText}>{hint}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: Spacing.md,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  inputError: {
    borderColor: Colors.error,
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.bodyMd,
    color: Colors.onSurface,
    paddingVertical: 14,
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
  toggleButton: {
    padding: Spacing.xs,
  },
  errorText: {
    ...Typography.captionSm,
    color: Colors.error,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  hintText: {
    ...Typography.captionSm,
    color: Colors.outline,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
});
