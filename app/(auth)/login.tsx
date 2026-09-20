/**
 * Login Screen — Matches Stitch screen_4_login_default_empty picture-perfect.
 * Welcome card with coffee emblem, tactile parchment inputs, helper copy,
 * goldenrod submit pill, and tonal social buttons.
 * Backend: POST /auth/login
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Button } from '../../src/components/ui/Button';
import { useAuth } from '../../src/context/AuthContext';
import { ApiRequestError } from '../../src/services/api';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim()) {
      setError('Email or phone number is required');
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
          <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log In</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Editorial Welcome Framing Card */}
      <View style={styles.welcomeCard}>
        <View style={styles.welcomeIconContainer}>
          <MaterialIcons name="local-cafe" size={26} color={Colors.onPrimaryFixed} />
        </View>
        <View style={styles.welcomeTextGroup}>
          <Text style={styles.welcomeTitle} numberOfLines={1}>
            Welcome back, explorer
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Rejoin intimate talks, firesides & local circles
          </Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={18} color={Colors.error} />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      {/* Form Fields */}
      <View style={styles.formGroup}>
        {/* Identifier Input */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder="Email or phone number"
            placeholderTextColor={Colors.outline}
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
            placeholderTextColor={Colors.outline}
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
              color={Colors.outline}
            />
          </TouchableOpacity>
        </View>

        {/* Contextual Helper Text */}
        <Text style={styles.helperText}>
          Use the email or verified phone number you registered with
        </Text>
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

      {/* Split Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Social Authentication Row */}
      <View style={styles.socialRow}>
        <TouchableOpacity
          style={styles.socialButton}
          activeOpacity={0.8}
          accessibilityLabel="Sign in with Google"
        >
          <FontAwesome5 name="google" size={18} color="#EA4335" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.socialButton}
          activeOpacity={0.8}
          accessibilityLabel="Sign in with Apple"
        >
          <FontAwesome5 name="apple" size={20} color={Colors.onSurface} />
        </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  content: {
    paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  headerTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  welcomeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeTextGroup: {
    flex: 1,
  },
  welcomeTitle: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  welcomeSubtitle: {
    ...Typography.captionMd,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorContainer,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  errorBannerText: {
    ...Typography.captionMd,
    color: Colors.onErrorContainer,
    flex: 1,
  },
  formGroup: {
    gap: Spacing.sm + 2,
  },
  inputWrapper: {
    width: '100%',
    height: 48,
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: BorderRadius.lg,
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
    color: Colors.onSurface,
    paddingVertical: 0,
    height: '100%',
  },
  passwordToggle: {
    position: 'absolute',
    right: 0,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    ...Typography.captionSm,
    color: Colors.outline,
    paddingHorizontal: 4,
    marginTop: 2,
    lineHeight: 18,
  },
  submitSection: {
    marginTop: Spacing.xl,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.outlineVariant,
  },
  dividerText: {
    ...Typography.captionMd,
    color: Colors.outline,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  socialButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.tertiaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  bottomPrompt: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  bottomPromptText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  bottomPromptLink: {
    ...Typography.labelMd,
    color: Colors.secondary,
    fontWeight: '600',
  },
});

