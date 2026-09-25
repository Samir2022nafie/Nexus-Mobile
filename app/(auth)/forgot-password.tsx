/**
 * Forgot Password Screen — Initiate password reset via email or phone number.
 * Fully themed for dark mode support.
 * Backend: POST /auth/forgot-password
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, ThemeColors } from '../../src/constants/theme';
import { useTheme, useThemedStyles } from '../../src/context/ThemeContext';
import { Button } from '../../src/components/ui/Button';
import authService from '../../src/services/auth';
import { ApiRequestError } from '../../src/services/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(getStyles);

  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!identifier.trim()) {
      setError('Email or phone number is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.forgotPassword({ identifier: identifier.trim() });
      setSubmitted(true);
    } catch (err: any) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTryAgain = () => {
    setSubmitted(false);
    setError('');
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (submitted) {
              setSubmitted(false);
              setError('');
            } else {
              router.back();
            }
          }}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
      </View>

      {/* Icon */}
      <View style={styles.iconContainer}>
        <MaterialIcons name="lock-reset" size={48} color={colors.primaryContainer} />
      </View>

      {/* Title */}
      <Text style={styles.title}>
        {submitted ? 'Check Your Inbox' : 'Forgot Password?'}
      </Text>
      <Text style={styles.subtitle}>
        {submitted
          ? 'If an account with that identifier exists, we\'ve sent a password reset link via email or SMS.'
          : 'Enter the email or phone number associated with your account and we\'ll send you a link to reset your password.'}
      </Text>

      {submitted ? (
        <View style={styles.submittedActions}>
          <Button
            title="Try Again"
            onPress={handleTryAgain}
            variant="primary"
            size="lg"
            fullWidth
          />
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            style={styles.backToLoginLink}
          >
            <MaterialIcons name="arrow-back" size={14} color={colors.primaryContainer} />
            <Text style={styles.backToLoginText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {error ? (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error-outline" size={18} color={colors.error} />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}

          {/* Identifier Input */}
          <View style={styles.formGroup}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="Email or phone number"
                placeholderTextColor={colors.outline}
                value={identifier}
                onChangeText={(v) => { setIdentifier(v); setError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>
          </View>

          {/* Submit */}
          <View style={styles.submitSection}>
            <Button
              title="Send Reset Link"
              onPress={handleSubmit}
              loading={loading}
              disabled={!identifier.trim()}
              variant="primary"
              size="lg"
              fullWidth
            />
          </View>

          {/* Back to Login */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backToLoginLink}
          >
            <MaterialIcons name="arrow-back" size={14} color={colors.primaryContainer} />
            <Text style={styles.backToLoginText}>Back to Sign In</Text>
          </TouchableOpacity>
        </>
      )}
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
      paddingHorizontal: Spacing.margin,
      paddingTop: Spacing.xs,
      paddingBottom: Spacing.xl * 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconContainer: {
      alignItems: 'center',
      marginTop: Spacing.xl,
      marginBottom: Spacing.md,
    },
    title: {
      ...Typography.headlineMd,
      color: colors.onSurface,
      textAlign: 'center',
      marginBottom: Spacing.xs,
      fontWeight: '700',
    },
    subtitle: {
      ...Typography.bodyMd,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      marginBottom: Spacing.xl,
      paddingHorizontal: Spacing.md,
      lineHeight: 22,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.errorContainer,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.md,
    },
    errorBannerText: {
      ...Typography.captionMd,
      color: colors.onErrorContainer,
      flex: 1,
    },
    formGroup: {
      gap: Spacing.sm,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.tertiaryFixed,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      paddingHorizontal: Spacing.md,
      height: 50,
    },
    textInput: {
      flex: 1,
      ...Typography.bodyMd,
      color: colors.onSurface,
      height: '100%',
    },
    submitSection: {
      marginTop: Spacing.xl,
    },
    submittedActions: {
      gap: Spacing.lg,
      marginTop: Spacing.md,
      alignItems: 'center',
    },
    backToLoginLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: Spacing.lg,
    },
    backToLoginText: {
      ...Typography.labelMd,
      color: colors.primaryContainer,
      fontWeight: '700',
    },
  });
