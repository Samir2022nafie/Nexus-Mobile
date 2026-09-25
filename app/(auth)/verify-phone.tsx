/**
 * Verify Phone Screen — 6-digit OTP verification.
 * Matches Stitch: screen_6_phone_verification_empty
 * Fully themed for dark mode support.
 * Backend: POST /auth/verify-phone, POST /auth/verify-phone/confirm
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../../src/constants/theme';
import { useTheme, useThemedStyles } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { Button } from '../../src/components/ui/Button';
import { authService } from '../../src/services/auth';
import { ApiRequestError } from '../../src/services/api';
import { OtpInput } from '../../src/components/ui/OtpInput';

const OTP_LENGTH = 6;

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    phone?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    email?: string;
    password?: string;
    birthDate?: string;
  }>();
  const phoneNumber = params.phone || '+251911234567';
  const { colors, isDark } = useTheme();
  const { register, completePhoneVerification } = useAuth();
  const styles = useThemedStyles(getStyles);

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(45);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Format phone display like +251 9** *** **78
  const formattedPhoneDisplay = (() => {
    if (phoneNumber.length >= 8) {
      const prefix = phoneNumber.slice(0, 5);
      const suffix = phoneNumber.slice(-2);
      return `${prefix} *** *** ${suffix}`;
    }
    return phoneNumber;
  })();

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleVerify = async (code?: string) => {
    const otpCode = code || otp.join('');
    if (otpCode.length !== OTP_LENGTH) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (params.password && params.username && params.firstName) {
        // Flow: Create account now with verified phone OTP
        await register({
          firstName: params.firstName,
          lastName: params.lastName || '',
          username: params.username,
          email: params.email || undefined,
          phoneNumber,
          password: params.password,
          birthDate: params.birthDate || '',
          otp: otpCode,
        });
        await completePhoneVerification();
        router.replace('/(tabs)');
      } else {
        // Flow: Existing user verifying phone
        await authService.confirmPhoneOtp({
          phoneNumber,
          otp: otpCode,
        });
        await completePhoneVerification();
        router.replace('/(tabs)');
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Verification failed. Please check the code.');
      }
      setOtp(Array(OTP_LENGTH).fill(''));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await authService.requestPhoneOtp({ phoneNumber });
      setResendTimer(45);
      setOtp(Array(OTP_LENGTH).fill(''));
      setError('');
    } catch (err) {
      setError('Failed to resend code. Please try again.');
    }
  };

  const isComplete = otp.every((d) => d !== '');

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Top App Bar Navigation */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Verify Phone</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        {/* Warm Tactile Icon Badge — Phone receiving SMS */}
        <View style={styles.badgeWrapper}>
          <View
            style={[
              styles.outerBadge,
              {
                backgroundColor: isDark ? 'rgba(36,33,30,0.85)' : 'rgba(241, 223, 207, 0.7)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <View
              style={[
                styles.innerBadge,
                { backgroundColor: isDark ? 'rgba(232, 167, 54, 0.25)' : 'rgba(232, 167, 54, 0.2)' },
              ]}
            >
              <MaterialIcons name="textsms" size={38} color={colors.primaryContainer} />
            </View>
            <View style={[styles.sparkDot, { borderColor: colors.surface }]} />
          </View>
        </View>

        {/* Editorial Typography Block */}
        <View style={styles.headerBlock}>
          <Text style={styles.heading}>Verify your phone number</Text>
          <Text style={styles.subheading}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phoneHighlight}>{formattedPhoneDisplay}</Text>
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* 6-Digit Tactile OTP Input with full paste & autofill support */}
        <OtpInput
          value={otp}
          onChange={(code, arr) => {
            setOtp(arr);
            setError('');
            if (code.length === OTP_LENGTH) {
              handleVerify(code);
            }
          }}
          boxWidth={48}
          error={Boolean(error)}
          autoFocus
        />

        {/* Active Resend Timer Indicator */}
        <View style={styles.resendRow}>
          <MaterialIcons name="schedule" size={16} color={colors.tertiary} />
          {resendTimer > 0 ? (
            <Text style={styles.timerText}>
              Resend code in <Text style={styles.timerCount}>0:{resendTimer < 10 ? `0${resendTimer}` : resendTimer}</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
              <Text style={styles.resendAction}>Resend code</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Primary Action */}
        <View style={styles.buttonWrapper}>
          <Button
            title="Verify"
            onPress={() => handleVerify()}
            loading={loading}
            disabled={!isComplete}
            fullWidth
            size="lg"
          />
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    topBar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBarTitle: {
      ...Typography.headlineSm,
      color: colors.onSurface,
      textAlign: 'center',
    },
    content: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
    },
    badgeWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    outerBadge: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      ...Shadows.sm,
    },
    innerBadge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sparkDot: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.primaryContainer,
      borderWidth: 2,
    },
    headerBlock: {
      alignItems: 'center',
      marginBottom: Spacing.lg,
      maxWidth: 320,
    },
    heading: {
      ...Typography.headlineMd,
      color: colors.onSurface,
      textAlign: 'center',
      marginBottom: Spacing.xs,
    },
    subheading: {
      ...Typography.bodyMd,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      lineHeight: 22,
    },
    phoneHighlight: {
      ...Typography.labelMd,
      color: colors.onSurface,
      fontWeight: '700',
      marginTop: 2,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.errorContainer,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.md,
    },
    errorText: {
      ...Typography.captionMd,
      color: colors.onErrorContainer,
    },
    otpRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: Spacing.lg,
    },
    otpBox: {
      width: 48,
      height: 52,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.tertiaryFixed,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      ...Typography.headlineSm,
      color: colors.onSurface,
      textAlign: 'center',
      ...Shadows.sm,
    },
    otpBoxFilled: {
      backgroundColor: colors.surfaceContainerHigh,
      borderColor: colors.primaryContainer,
      borderWidth: 1.5,
    },
    otpBoxError: {
      borderWidth: 1.5,
      borderColor: colors.error,
    },
    resendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: Spacing.xl,
    },
    timerText: {
      ...Typography.captionMd,
      color: colors.onSurfaceVariant,
    },
    timerCount: {
      fontWeight: '700',
      color: colors.primaryContainer,
    },
    resendAction: {
      ...Typography.labelMd,
      color: colors.primaryContainer,
      textDecorationLine: 'underline',
      fontWeight: '700',
    },
    buttonWrapper: {
      width: '100%',
      marginBottom: Spacing.md,
    },
  });
