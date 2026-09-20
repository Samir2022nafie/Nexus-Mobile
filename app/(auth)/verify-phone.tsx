/**
 * Verify Phone Screen — 6-digit OTP verification.
 * Matches Stitch: screen_6_phone_verification_empty
 * Backend: POST /auth/verify-phone, POST /auth/verify-phone/confirm
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Button } from '../../src/components/ui/Button';
import { authService } from '../../src/services/auth';
import { ApiRequestError } from '../../src/services/api';

const OTP_LENGTH = 6;

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const phoneNumber = phone || '+251911234567';

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

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value[value.length - 1];
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every((d) => d) && newOtp.join('').length === OTP_LENGTH) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code || otp.join('');
    if (otpCode.length !== OTP_LENGTH) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authService.confirmPhoneOtp({
        phoneNumber,
        otp: otpCode,
      });
      // Verification succeeded, router switches to tabs automatically via AuthContext
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Verification failed. Please check the code.');
      }
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
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
          <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Verify Phone</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        {/* Warm Tactile Icon Badge */}
        <View style={styles.badgeWrapper}>
          <View style={styles.outerBadge}>
            <View style={styles.innerBadge}>
              <MaterialIcons name="shield" size={40} color={Colors.primaryContainer} />
            </View>
            <View style={styles.sparkDot} />
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
            <MaterialIcons name="error-outline" size={18} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* 6-Digit OTP Matrix */}
        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[
                styles.otpBox,
                digit ? styles.otpBoxFilled : null,
                error ? styles.otpBoxError : null,
              ]}
              value={digit}
              onChangeText={(val) => handleOtpChange(index, val)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Active Resend Timer Indicator */}
        <View style={styles.resendRow}>
          <MaterialIcons name="schedule" size={16} color={Colors.tertiary} />
          {resendTimer > 0 ? (
            <Text style={styles.timerText}>
              Resend code in <Text style={styles.timerCount}>0:{resendTimer < 10 ? `0${resendTimer}` : resendTimer}</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
              <Text style={styles.resendAction}>Resend code via SMS</Text>
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

        {/* Wrong Number Action */}
        <TouchableOpacity
          style={styles.wrongNumberButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <MaterialIcons name="edit-note" size={18} color={Colors.secondary} />
          <Text style={styles.wrongNumberText}>Wrong number? Edit phone details</Text>
        </TouchableOpacity>

        {/* Security Micro-Trust Footer Badge */}
        <View style={styles.securityBadge}>
          <View style={styles.lockCircle}>
            <MaterialIcons name="lock" size={18} color={Colors.tertiary} />
          </View>
          <Text style={styles.securityText}>
            End-to-end encrypted session for local community onboarding.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.surface,
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
    color: Colors.onSurface,
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
    backgroundColor: 'rgba(241, 223, 207, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Shadows.sm,
  },
  innerBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(232, 167, 54, 0.2)',
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
    backgroundColor: Colors.primaryContainer,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    maxWidth: 320,
  },
  heading: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subheading: {
    ...Typography.bodyMd,
    color: Colors.tertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
  phoneHighlight: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.errorContainer,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    ...Typography.captionMd,
    color: Colors.onErrorContainer,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  otpBox: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.tertiaryFixed,
    ...Typography.headlineSm,
    color: Colors.onSurface,
    ...Shadows.sm,
  },
  otpBoxFilled: {
    backgroundColor: Colors.surfaceContainerHighest,
    borderColor: Colors.primaryContainer,
    borderWidth: 1.5,
  },
  otpBoxError: {
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xl,
  },
  timerText: {
    ...Typography.captionMd,
    color: Colors.tertiary,
  },
  timerCount: {
    fontWeight: '700',
    color: Colors.onSurface,
  },
  resendAction: {
    ...Typography.labelMd,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  buttonWrapper: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  wrongNumberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
  },
  wrongNumberText: {
    ...Typography.captionMd,
    color: Colors.secondary,
  },
  securityBadge: {
    marginTop: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(246, 243, 242, 0.8)',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxWidth: 320,
    ...Shadows.sm,
  },
  lockCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityText: {
    ...Typography.captionSm,
    color: Colors.onSurfaceVariant,
    flex: 1,
    lineHeight: 16,
  },
});
