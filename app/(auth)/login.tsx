/**
 * Login Screen — Matches Stitch screen_4_login_default_empty picture-perfect.
 * Welcome card with coffee emblem, tactile parchment inputs, helper copy,
 * goldenrod submit pill, and tonal social buttons.
 * Fully themed for dark mode support.
 * Backend: POST /auth/login
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../../src/constants/theme';
import { useTheme, useThemedStyles } from '../../src/context/ThemeContext';
import { Button } from '../../src/components/ui/Button';
import { NexusLogo } from '../../src/components/ui/NexusLogo';
import { useAuth } from '../../src/context/AuthContext';
import { ApiRequestError } from '../../src/services/api';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(getStyles);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim()) {
      setError('Email, phone number, or username is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login({ identifier: identifier.trim(), password });
      // Auth context will redirect to tabs automatically
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isFormFilled = Boolean(identifier.trim() && password.trim());

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Top Navigation Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log In</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Main Centered Body with Logo & Fields */}
      <View style={styles.mainBody}>
        {/* Vector SVG Brand Logo in Top Space */}
        <View style={styles.logoSection}>
          <NexusLogo width={200} height={62} />
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={18} color={colors.error} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        {/* Form Fields */}
        <View style={styles.formGroup}>
          {/* Identifier Input */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Email, phone, or username"
              placeholderTextColor={colors.outline}
              value={identifier}
              onChangeText={(v) => { setIdentifier(v); setError(''); }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password Input */}
          <View style={[styles.inputWrapper, styles.passwordWrapper]}>
            <TextInput
              style={[styles.textInput, { flex: 1, paddingRight: 40 }]}
              placeholder="Password"
              placeholderTextColor={colors.outline}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(''); }}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword(!showPassword)}
              accessibilityLabel="Toggle password visibility"
            >
              <MaterialIcons
                name={showPassword ? 'visibility' : 'visibility-off'}
                size={20}
                color={colors.outline}
              />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            style={styles.forgotPasswordLink}
            accessibilityLabel="Forgot Password"
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <View style={styles.submitSection}>
          <Button
            title="Log In"
            onPress={handleLogin}
            loading={loading}
            disabled={!isFormFilled}
            variant="primary"
            size="lg"
            fullWidth
          />
        </View>
      </View>

      {/* Bottom Account Prompt */}
      <View style={styles.bottomPrompt}>
        <Text style={styles.bottomPromptText}>
          Don't have an account?{' '}
          <Text
            style={styles.bottomPromptLink}
            onPress={() => router.push('/(auth)/register')}
          >
            Create Account
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: Spacing.margin,
      paddingTop: Spacing.xs,
      justifyContent: 'space-between',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    headerTitle: {
      ...Typography.headlineSm,
      color: colors.onSurface,
      fontWeight: '700',
    },
    mainBody: {
      flex: 1,
      justifyContent: 'center',
      paddingVertical: Spacing.md,
    },
    logoSection: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xl,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.errorContainer,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.md,
    },
    errorBannerText: {
      ...Typography.captionMd,
      color: colors.onErrorContainer,
      flex: 1,
    },
    formGroup: {
      gap: Spacing.sm + 2,
    },
    inputWrapper: {
      width: '100%',
      height: 50,
      backgroundColor: colors.tertiaryFixed,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      paddingHorizontal: Spacing.md,
      justifyContent: 'center',
      ...Shadows.sm,
    },
    passwordWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    textInput: {
      ...Typography.bodyMd,
      color: colors.onSurface,
      paddingVertical: 0,
      height: '100%',
    },
    passwordToggle: {
      position: 'absolute',
      right: 0,
      width: 48,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitSection: {
      marginTop: Spacing.xl,
    },
    bottomPrompt: {
      alignItems: 'center',
      paddingVertical: Spacing.md,
    },
    bottomPromptText: {
      ...Typography.bodyMd,
      color: colors.onSurfaceVariant,
    },
    bottomPromptLink: {
      ...Typography.labelMd,
      color: colors.primaryContainer,
      fontWeight: '700',
    },
    forgotPasswordLink: {
      alignSelf: 'flex-end',
      marginTop: Spacing.xs,
    },
    forgotPasswordText: {
      ...Typography.captionMd,
      color: colors.primaryContainer,
      fontWeight: '600',
    },
  });
