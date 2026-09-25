import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeRouter } from '../src/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../src/constants/theme';
import { useTheme, useThemedStyles } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { usersService } from '../src/services/users';
import { authService } from '../src/services/auth';
import { ApiRequestError } from '../src/services/api';
import { OtpInput } from '../src/components/ui/OtpInput';

const COUNTRY_CODES = [
  { code: '+251', name: 'Ethiopia', flag: '🇪🇹' },
  { code: '+1', name: 'USA / Canada', flag: '🇺🇸' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+254', name: 'Kenya', flag: '🇰🇪' },
  { code: '+234', name: 'Nigeria', flag: '🇳🇬' },
  { code: '+971', name: 'UAE', flag: '🇦🇪' },
  { code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+86', name: 'China', flag: '🇨🇳' },
  { code: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: '+20', name: 'Egypt', flag: '🇪🇬' },
];

export default function AccountSettingsScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);

  // ── Phone Modal State ──
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'input' | 'otp'>('input');
  const [selectedCountryCode, setSelectedCountryCode] = useState('+251');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [phoneNumberInput, setPhoneNumberInput] = useState('');
  const [phoneOtp, setPhoneOtp] = useState<string[]>(Array(6).fill(''));
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // ── Password Modal State ──
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passStep, setPassStep] = useState<'method' | 'otp' | 'new-password'>('method');
  const [passMethod, setPassMethod] = useState<'email' | 'phone'>('email');
  const [passIdentifier, setPassIdentifier] = useState('');
  const [passOtp, setPassOtp] = useState<string[]>(Array(6).fill(''));
  const [passTicket, setPassTicket] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // ── Delete Account Modal State ──
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'method' | 'otp' | 'confirm'>('method');
  const [deleteMethod, setDeleteMethod] = useState<'email' | 'phone'>('email');
  const [deleteIdentifier, setDeleteIdentifier] = useState('');
  const [deleteOtp, setDeleteOtp] = useState<string[]>(Array(6).fill(''));
  const [deleteTicket, setDeleteTicket] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const isPhoneConnected = Boolean(
    user?.phone_number && (user?.phone_verified_at || user?.phone_number_verified)
  );

  // ── Phone Handlers ──
  const openPhoneModal = () => {
    setPhoneError('');
    setPhoneStep('input');
    setPhoneNumberInput('');
    setPhoneOtp(Array(6).fill(''));
    setPhoneModalVisible(true);
  };

  const handleSendPhoneOtp = async () => {
    const cleanDigits = phoneNumberInput.replace(/\D/g, '');
    if (!cleanDigits) {
      setPhoneError('Please enter a phone number');
      return;
    }

    let sub = cleanDigits;
    if (selectedCountryCode === '+251') {
      sub = cleanDigits.startsWith('2510')
        ? cleanDigits.slice(4)
        : cleanDigits.startsWith('251')
        ? cleanDigits.slice(3)
        : cleanDigits.startsWith('0')
        ? cleanDigits.slice(1)
        : cleanDigits;

      if (sub.length < 9) {
        setPhoneError('Missing digits. Ethiopian phone numbers must be 9 digits (e.g. 0911223344)');
        return;
      }
      if (sub.length > 9) {
        setPhoneError('Too many digits for an Ethiopian phone number');
        return;
      }
      if (!/^[97]/.test(sub)) {
        setPhoneError('Ethiopian phone numbers must start with 9 or 7 (or 09 / 07)');
        return;
      }
    } else if (cleanDigits.length < 8) {
      setPhoneError('Please enter a complete phone number');
      return;
    }

    const fullPhone = `${selectedCountryCode}${sub}`;

    // Prevent inputting current connected number
    if (
      user?.phone_number &&
      (fullPhone === user.phone_number ||
        fullPhone.replace(/\D/g, '') === user.phone_number.replace(/\D/g, ''))
    ) {
      setPhoneError('This phone number is already connected to your account. Please enter a different phone number.');
      return;
    }

    setPhoneLoading(true);
    setPhoneError('');

    try {
      await authService.requestPhoneOtp({ phoneNumber: fullPhone });
      setPhoneStep('otp');
    } catch (err: any) {
      setPhoneError(err?.message || 'Failed to send verification code. Please try again.');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleConfirmPhoneOtp = async () => {
    const code = phoneOtp.join('');
    if (code.length !== 6) {
      setPhoneError('Please enter the 6-digit verification code');
      return;
    }

    setPhoneLoading(true);
    setPhoneError('');

    const cleanDigits = phoneNumberInput.replace(/\D/g, '');
    const sub = cleanDigits.startsWith('2510')
      ? cleanDigits.slice(4)
      : cleanDigits.startsWith('251')
      ? cleanDigits.slice(3)
      : cleanDigits.startsWith('0')
      ? cleanDigits.slice(1)
      : cleanDigits;
    const fullPhone = `${selectedCountryCode}${sub}`;

    try {
      await authService.confirmPhoneOtp({
        phoneNumber: fullPhone,
        otp: code,
      });
      await refreshUser();
      setPhoneModalVisible(false);
      Alert.alert('Phone Connected', 'Your phone number has been verified and connected.');
    } catch (err: any) {
      setPhoneError(err?.message || 'Invalid or expired verification code. Original phone number was preserved.');
    } finally {
      setPhoneLoading(false);
    }
  };

  // ── Password Handlers ──
  const openPasswordModal = () => {
    setPasswordError('');
    setPassStep('method');
    const initialMethod = user?.email ? 'email' : 'phone';
    setPassMethod(initialMethod);
    setPassIdentifier(initialMethod === 'email' ? (user?.email || '') : (user?.phone_number || ''));
    setPassOtp(Array(6).fill(''));
    setPassTicket('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordModalVisible(true);
  };

  const handleSendPassCode = async () => {
    if (!passIdentifier.trim()) {
      setPasswordError(`Please enter your account ${passMethod === 'email' ? 'email' : 'phone number'}`);
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');

    try {
      await authService.requestSecurityCode({
        action: 'change-password',
        method: passMethod,
        identifier: passIdentifier.trim(),
      });
      setPassStep('otp');
    } catch (err: any) {
      setPasswordError(err?.message || 'Verification code request failed');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleVerifyPassOtp = async () => {
    const code = passOtp.join('');
    if (code.length !== 6) {
      setPasswordError('Please enter all 6 digits of the verification code');
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');

    try {
      const res: any = await authService.verifySecurityCode({
        action: 'change-password',
        otp: code,
      });
      const ticket = res?.ticket || res?.data?.ticket;
      if (ticket) {
        setPassTicket(ticket);
        setPassStep('new-password');
      } else {
        setPasswordError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'Invalid or expired verification code');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSaveNewPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');

    try {
      await authService.changePassword({
        newPassword,
        ticket: passTicket,
      });
      setPasswordModalVisible(false);
      Alert.alert(
        'Password Changed',
        'Your password has been changed successfully. All active sessions have been logged out. Please log in with your new password.',
        [
          {
            text: 'Log In',
            onPress: async () => {
              await logout();
              router.replace('/(auth)/login');
            },
          },
        ],
        { cancelable: false }
      );
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── Delete Account Handlers ──
  const openDeleteModal = () => {
    setDeleteError('');
    setDeleteStep('method');
    setDeleteMethod(user?.email ? 'email' : 'phone');
    setDeleteIdentifier('');
    setDeleteOtp(Array(6).fill(''));
    setDeleteTicket('');
    setDeleteModalVisible(true);
  };

  const handleSendDeleteCode = async () => {
    if (!deleteIdentifier.trim()) {
      setDeleteError(`Please enter your account ${deleteMethod === 'email' ? 'email' : 'phone number'}`);
      return;
    }

    setDeleteLoading(true);
    setDeleteError('');

    try {
      await authService.requestSecurityCode({
        action: 'delete-account',
        method: deleteMethod,
        identifier: deleteIdentifier.trim(),
      });
      setDeleteStep('otp');
    } catch (err: any) {
      setDeleteError(err?.message || 'Verification code request failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleVerifyDeleteOtp = async () => {
    const code = deleteOtp.join('');
    if (code.length !== 6) {
      setDeleteError('Please enter all 6 digits of the verification code');
      return;
    }

    setDeleteLoading(true);
    setDeleteError('');

    try {
      const res: any = await authService.verifySecurityCode({
        action: 'delete-account',
        otp: code,
      });
      const ticket = res?.ticket || res?.data?.ticket;
      if (ticket) {
        setDeleteTicket(ticket);
        setDeleteStep('confirm');
      } else {
        setDeleteError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      setDeleteError(err?.message || 'Invalid or expired verification code');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleFinalDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError('');

    try {
      await usersService.deleteMyAccount(deleteTicket);
      setDeleteModalVisible(false);
      await logout();
      router.replace('/(auth)/welcome');
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete account');
      setDeleteLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Sub-navigation App Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Account Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Info Card */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>ACCOUNT DETAILS</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>@{user?.username || 'user'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || 'Not connected'}</Text>
          </View>
        </View>

        {/* Security & Verification Card */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>SECURITY & CONTACT</Text>

          {/* Dynamic Phone Row */}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={openPhoneModal}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <MaterialIcons name="phone" size={20} color={colors.primary} />
            </View>
            <View style={styles.settingTextContainer}>
              <View style={styles.rowInline}>
                <Text style={styles.settingTitle}>
                  {isPhoneConnected ? 'Phone no Connected' : 'Verify Phone'}
                </Text>
                {isPhoneConnected && (
                  <View style={styles.verifiedBadge}>
                    <MaterialIcons name="check" size={12} color="#10B981" />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
              </View>
              <Text style={styles.settingSubtitle}>
                {isPhoneConnected ? 'Edit Phone number' : 'Add a phone number'}
              </Text>
              {isPhoneConnected && user?.phone_number && (
                <Text style={styles.phoneDisplay}>{user.phone_number}</Text>
              )}
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Password Row */}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={openPasswordModal}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <MaterialIcons name="lock-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Password</Text>
              <Text style={styles.settingSubtitle}>
                Change password via identity verification
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={[styles.sectionHeader, { color: colors.error }]}>DANGER ZONE</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={openDeleteModal}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.errorContainer }]}>
              <MaterialIcons name="delete-forever" size={20} color={colors.error} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingTitle, { color: colors.error }]}>Delete Account</Text>
              <Text style={styles.settingSubtitle}>
                Permanently delete account with security verification
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── MODAL 1: Phone Verification ── */}
      <Modal
        visible={phoneModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPhoneModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {phoneStep === 'input'
                  ? isPhoneConnected
                    ? 'Edit Phone Number'
                    : 'Verify Phone'
                  : 'Enter Verification Code'}
              </Text>
              <TouchableOpacity onPress={() => setPhoneModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {phoneStep === 'input'
                ? 'Enter your phone number. Your current number remains preserved unless the new number is successfully verified.'
                : 'Enter the 6-digit code sent via SMS.'}
            </Text>

            {phoneError ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={16} color={colors.error} />
                <Text style={styles.errorText}>{phoneError}</Text>
              </View>
            ) : null}

            {phoneStep === 'input' ? (
              <View style={styles.modalBody}>
                <View style={styles.phoneInputRow}>
                  <TouchableOpacity
                    style={styles.countryPickerButton}
                    onPress={() => setCountryPickerVisible(!countryPickerVisible)}
                  >
                    <Text style={styles.countryPickerText}>{selectedCountryCode}</Text>
                    <MaterialIcons name="arrow-drop-down" size={18} color={colors.onSurface} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="911 22 33 44"
                    placeholderTextColor={colors.onSurfaceVariant}
                    value={phoneNumberInput}
                    onChangeText={(val) => {
                      setPhoneNumberInput(val);
                      setPhoneError('');
                    }}
                    keyboardType="phone-pad"
                  />
                </View>

                {countryPickerVisible && (
                  <View style={styles.countryDropdown}>
                    <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                      {COUNTRY_CODES.map((c) => (
                        <TouchableOpacity
                          key={c.code}
                          style={styles.countryItem}
                          onPress={() => {
                            setSelectedCountryCode(c.code);
                            setCountryPickerVisible(false);
                          }}
                        >
                          <Text style={styles.countryItemText}>
                            {c.flag} {c.name} ({c.code})
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.primaryButton, phoneLoading && styles.buttonDisabled]}
                  onPress={handleSendPhoneOtp}
                  disabled={phoneLoading}
                >
                  {phoneLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Code</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.modalBody}>
                {/* 6-Digit Tactile OTP Input with full paste & autofill support */}
                <OtpInput
                  value={phoneOtp}
                  onChange={(_, arr) => {
                    setPhoneOtp(arr);
                    setPhoneError('');
                  }}
                  error={Boolean(phoneError)}
                  autoFocus
                />

                <View style={styles.otpActionRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setPhoneStep('input');
                      setPhoneError('');
                    }}
                  >
                    <Text style={styles.textLink}>Change Number</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSendPhoneOtp}>
                    <Text style={styles.textLinkPrimary}>Resend Code</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (phoneLoading || phoneOtp.join('').length !== 6) && styles.buttonDisabled,
                  ]}
                  onPress={handleConfirmPhoneOtp}
                  disabled={phoneLoading || phoneOtp.join('').length !== 6}
                >
                  {phoneLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify & Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL 2: Change Password ── */}
      <Modal
        visible={passwordModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            {/* Centered Title */}
            <View style={styles.modalCenteredHeader}>
              <Text style={styles.modalTitleCentered}>
                {passStep === 'new-password' ? 'Set New Password' : 'Change Password'}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseAbsolute}
                onPress={() => setPasswordModalVisible(false)}
              >
                <MaterialIcons name="close" size={24} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { textAlign: 'center' }]}>
              {passStep === 'method' &&
                'Verify your identity via SMS or Email before updating your password.'}
              {passStep === 'otp' &&
                `Enter the 6-digit security code sent to your ${passMethod === 'email' ? 'email' : 'phone'}.`}
              {passStep === 'new-password' &&
                'Identity verified. Enter your new account password.'}
            </Text>

            {passwordError ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={16} color={colors.error} />
                <Text style={styles.errorText}>{passwordError}</Text>
              </View>
            ) : null}

            {passStep === 'method' && (
              <View style={styles.modalBody}>
                {/* Method selector */}
                <View style={styles.methodSelector}>
                  <TouchableOpacity
                    style={[
                      styles.methodTab,
                      passMethod === 'email' && styles.methodTabActive,
                    ]}
                    onPress={() => {
                      setPassMethod('email');
                      setPassIdentifier(user?.email || '');
                      setPasswordError('');
                    }}
                  >
                    <MaterialIcons
                      name="email"
                      size={18}
                      color={passMethod === 'email' ? colors.primary : colors.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.methodTabText,
                        passMethod === 'email' && styles.methodTabTextActive,
                      ]}
                    >
                      Email
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.methodTab,
                      passMethod === 'phone' && styles.methodTabActive,
                    ]}
                    onPress={() => {
                      setPassMethod('phone');
                      setPassIdentifier(user?.phone_number || '');
                      setPasswordError('');
                    }}
                  >
                    <MaterialIcons
                      name="phone-android"
                      size={18}
                      color={passMethod === 'phone' ? colors.primary : colors.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.methodTabText,
                        passMethod === 'phone' && styles.methodTabTextActive,
                      ]}
                    >
                      Phone (SMS)
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>
                  {passMethod === 'email' ? 'Account Email' : 'Account Phone Number'}
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder={
                    passMethod === 'email'
                      ? 'Enter your registered email'
                      : 'Enter your registered phone (e.g. 0911223344)'
                  }
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={passIdentifier}
                  onChangeText={(val) => {
                    setPassIdentifier(val);
                    setPasswordError('');
                  }}
                  autoCapitalize="none"
                  keyboardType={passMethod === 'email' ? 'email-address' : 'phone-pad'}
                />

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (passwordLoading || !passIdentifier.trim()) && styles.buttonDisabled,
                  ]}
                  onPress={handleSendPassCode}
                  disabled={passwordLoading || !passIdentifier.trim()}
                >
                  {passwordLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Code</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {passStep === 'otp' && (
              <View style={styles.modalBody}>
                {/* 6-Digit Tactile OTP Input with full paste & autofill support */}
                <OtpInput
                  value={passOtp}
                  onChange={(_, arr) => {
                    setPassOtp(arr);
                    setPasswordError('');
                  }}
                  error={Boolean(passwordError)}
                  autoFocus
                />

                <View style={styles.otpActionRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setPassStep('method');
                      setPasswordError('');
                    }}
                  >
                    <Text style={styles.textLink}>Change Method</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSendPassCode}>
                    <Text style={styles.textLinkPrimary}>Resend Code</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (passwordLoading || passOtp.join('').length !== 6) && styles.buttonDisabled,
                  ]}
                  onPress={handleVerifyPassOtp}
                  disabled={passwordLoading || passOtp.join('').length !== 6}
                >
                  {passwordLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify Code</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {passStep === 'new-password' && (
              <View style={styles.modalBody}>
                <Text style={styles.inputLabel}>New Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordTextInput}
                    placeholder="Minimum 8 characters"
                    placeholderTextColor={colors.onSurfaceVariant}
                    value={newPassword}
                    onChangeText={(val) => {
                      setNewPassword(val);
                      setPasswordError('');
                    }}
                    secureTextEntry={!showNewPassword}
                  />
                  <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                    <MaterialIcons
                      name={showNewPassword ? 'visibility-off' : 'visibility'}
                      size={20}
                      color={colors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordTextInput}
                    placeholder="Re-enter new password"
                    placeholderTextColor={colors.onSurfaceVariant}
                    value={confirmNewPassword}
                    onChangeText={(val) => {
                      setConfirmNewPassword(val);
                      setPasswordError('');
                    }}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <MaterialIcons
                      name={showConfirmPassword ? 'visibility-off' : 'visibility'}
                      size={20}
                      color={colors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (passwordLoading || !newPassword || newPassword !== confirmNewPassword) &&
                      styles.buttonDisabled,
                  ]}
                  onPress={handleSaveNewPassword}
                  disabled={passwordLoading || !newPassword || newPassword !== confirmNewPassword}
                >
                  {passwordLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save New Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL 3: Delete Account ── */}
      <Modal
        visible={deleteModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalCenteredHeader}>
              <Text style={[styles.modalTitleCentered, { color: colors.error }]}>
                Delete Account
              </Text>
              <TouchableOpacity
                style={styles.modalCloseAbsolute}
                onPress={() => setDeleteModalVisible(false)}
              >
                <MaterialIcons name="close" size={24} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { textAlign: 'center' }]}>
              {deleteStep === 'method' &&
                'Identity verification is required before permanently deleting your account.'}
              {deleteStep === 'otp' &&
                `Enter the 6-digit confirmation code sent to your ${deleteMethod === 'email' ? 'email' : 'phone'}.`}
              {deleteStep === 'confirm' &&
                'Final Confirmation: Are you sure you want to permanently delete your account?'}
            </Text>

            {deleteError ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={16} color={colors.error} />
                <Text style={styles.errorText}>{deleteError}</Text>
              </View>
            ) : null}

            {deleteStep === 'method' && (
              <View style={styles.modalBody}>
                <View style={styles.methodSelector}>
                  <TouchableOpacity
                    style={[
                      styles.methodTab,
                      deleteMethod === 'email' && styles.methodTabActiveError,
                    ]}
                    onPress={() => {
                      setDeleteMethod('email');
                      setDeleteIdentifier(user?.email || '');
                      setDeleteError('');
                    }}
                  >
                    <MaterialIcons
                      name="email"
                      size={18}
                      color={deleteMethod === 'email' ? colors.error : colors.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.methodTabText,
                        deleteMethod === 'email' && { color: colors.error, fontWeight: '700' },
                      ]}
                    >
                      Email
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.methodTab,
                      deleteMethod === 'phone' && styles.methodTabActiveError,
                    ]}
                    onPress={() => {
                      setDeleteMethod('phone');
                      setDeleteIdentifier(user?.phone_number || '');
                      setDeleteError('');
                    }}
                  >
                    <MaterialIcons
                      name="phone-android"
                      size={18}
                      color={deleteMethod === 'phone' ? colors.error : colors.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.methodTabText,
                        deleteMethod === 'phone' && { color: colors.error, fontWeight: '700' },
                      ]}
                    >
                      Phone (SMS)
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>
                  {deleteMethod === 'email' ? 'Account Email' : 'Account Phone Number'}
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder={
                    deleteMethod === 'email'
                      ? 'Enter your registered email'
                      : 'Enter your registered phone'
                  }
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={deleteIdentifier}
                  onChangeText={(val) => {
                    setDeleteIdentifier(val);
                    setDeleteError('');
                  }}
                  autoCapitalize="none"
                  keyboardType={deleteMethod === 'email' ? 'email-address' : 'phone-pad'}
                />

                <TouchableOpacity
                  style={[
                    styles.dangerButton,
                    (deleteLoading || !deleteIdentifier.trim()) && styles.buttonDisabled,
                  ]}
                  onPress={handleSendDeleteCode}
                  disabled={deleteLoading || !deleteIdentifier.trim()}
                >
                  {deleteLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Code</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {deleteStep === 'otp' && (
              <View style={styles.modalBody}>
                {/* 6-Digit Tactile OTP Input with full paste & autofill support */}
                <OtpInput
                  value={deleteOtp}
                  onChange={(_, arr) => {
                    setDeleteOtp(arr);
                    setDeleteError('');
                  }}
                  error={Boolean(deleteError)}
                  autoFocus
                />

                <View style={styles.otpActionRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setDeleteStep('method');
                      setDeleteError('');
                    }}
                  >
                    <Text style={styles.textLink}>Change Method</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSendDeleteCode}>
                    <Text style={styles.textLinkPrimary}>Resend Code</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.dangerButton,
                    (deleteLoading || deleteOtp.join('').length !== 6) && styles.buttonDisabled,
                  ]}
                  onPress={handleVerifyDeleteOtp}
                  disabled={deleteLoading || deleteOtp.join('').length !== 6}
                >
                  {deleteLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify Code</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {deleteStep === 'confirm' && (
              <View style={styles.modalBody}>
                <View style={styles.dangerWarningBox}>
                  <MaterialIcons name="warning" size={24} color={colors.error} />
                  <Text style={styles.dangerWarningText}>
                    Identity verified. This will permanently delete your account, posts, communities, and cannot be undone.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.dangerButton, deleteLoading && styles.buttonDisabled]}
                  onPress={handleFinalDeleteAccount}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Permanently Delete My Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function getStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant,
      backgroundColor: colors.surface,
    },
    backButton: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    topBarTitle: {
      ...Typography.titleMd,
      color: colors.onSurface,
      fontWeight: '700',
    },
    content: {
      padding: Spacing.md,
      gap: Spacing.md,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      ...Shadows.sm,
    },
    dangerCard: {
      borderColor: colors.errorContainer,
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.05)' : '#FFF5F5',
    },
    sectionHeader: {
      ...Typography.labelSm,
      color: colors.onSurfaceVariant,
      fontWeight: '700',
      marginBottom: Spacing.sm,
      letterSpacing: 0.8,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.xs,
    },
    infoLabel: {
      ...Typography.bodyMd,
      color: colors.onSurfaceVariant,
    },
    infoValue: {
      ...Typography.bodyMd,
      color: colors.onSurface,
      fontWeight: '600',
    },
    divider: {
      height: 1,
      backgroundColor: colors.outlineVariant,
      marginVertical: Spacing.sm,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.xs,
      gap: Spacing.sm,
    },
    iconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primaryContainer + '30',
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingTextContainer: {
      flex: 1,
    },
    rowInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    settingTitle: {
      ...Typography.bodyLg,
      color: colors.onSurface,
      fontWeight: '600',
    },
    verifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: BorderRadius.full,
    },
    verifiedText: {
      ...Typography.labelSm,
      color: '#10B981',
      fontSize: 10,
      fontWeight: '600',
    },
    settingSubtitle: {
      ...Typography.bodySm,
      color: colors.onSurfaceVariant,
      marginTop: 1,
    },
    phoneDisplay: {
      ...Typography.labelSm,
      color: colors.primary,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      marginTop: 2,
    },
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.lg,
      maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalCenteredHeader: {
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      paddingVertical: Spacing.xs,
    },
    modalTitle: {
      ...Typography.titleLg,
      color: colors.onSurface,
      fontWeight: '700',
    },
    modalTitleCentered: {
      ...Typography.titleLg,
      color: colors.onSurface,
      fontWeight: '700',
      textAlign: 'center',
    },
    modalCloseAbsolute: {
      position: 'absolute',
      right: 0,
      top: 0,
    },
    modalSubtitle: {
      ...Typography.bodySm,
      color: colors.onSurfaceVariant,
      marginTop: Spacing.xs,
      marginBottom: Spacing.md,
    },
    modalBody: {
      gap: Spacing.md,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.errorContainer + '40',
      padding: Spacing.sm,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
    },
    errorText: {
      ...Typography.captionSm,
      color: colors.error,
      flex: 1,
    },
    phoneInputRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    countryPickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: Spacing.sm,
      height: 48,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceVariant,
    },
    countryPickerText: {
      ...Typography.bodyMd,
      color: colors.onSurface,
      fontWeight: '600',
    },
    phoneInput: {
      flex: 1,
      height: 48,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      paddingHorizontal: Spacing.md,
      color: colors.onSurface,
      backgroundColor: colors.surfaceVariant,
      ...Typography.bodyMd,
    },
    countryDropdown: {
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.surface,
      maxHeight: 160,
    },
    countryItem: {
      padding: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant,
    },
    countryItemText: {
      ...Typography.bodySm,
      color: colors.onSurface,
    },
    // Segmented Tactile 6-Digit OTP Box
    otpRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginVertical: Spacing.sm,
    },
    otpBox: {
      width: 44,
      height: 52,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.surfaceContainerHighest || colors.surfaceVariant,
      borderWidth: 1.5,
      borderColor: colors.outlineVariant,
      ...Typography.headlineSm,
      color: colors.onSurface,
      textAlign: 'center',
      ...Shadows.sm,
    },
    otpBoxFilled: {
      backgroundColor: colors.surfaceContainerHigh || colors.surface,
      borderColor: colors.primaryContainer,
      borderWidth: 2,
    },
    otpBoxError: {
      borderColor: colors.error,
      borderWidth: 2,
    },
    otpActionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.xs,
    },
    textLink: {
      ...Typography.labelSm,
      color: colors.onSurfaceVariant,
      textDecorationLine: 'underline',
    },
    textLinkPrimary: {
      ...Typography.labelSm,
      color: colors.primary,
      fontWeight: '700',
    },
    methodSelector: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    methodTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceVariant,
    },
    methodTabActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryContainer + '25',
    },
    methodTabActiveError: {
      borderColor: colors.error,
      backgroundColor: colors.errorContainer + '25',
    },
    methodTabText: {
      ...Typography.labelMd,
      color: colors.onSurfaceVariant,
    },
    methodTabTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    inputLabel: {
      ...Typography.labelSm,
      color: colors.onSurfaceVariant,
      fontWeight: '600',
      marginTop: Spacing.xs,
    },
    textInput: {
      height: 48,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      paddingHorizontal: Spacing.md,
      color: colors.onSurface,
      backgroundColor: colors.surfaceVariant,
      ...Typography.bodyMd,
    },
    passwordInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 48,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      paddingHorizontal: Spacing.md,
      backgroundColor: colors.surfaceVariant,
    },
    passwordTextInput: {
      flex: 1,
      color: colors.onSurface,
      ...Typography.bodyMd,
    },
    primaryButton: {
      height: 48,
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    dangerButton: {
      height: 48,
      backgroundColor: colors.error,
      borderRadius: BorderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    primaryButtonText: {
      ...Typography.labelLg,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    dangerWarningBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.errorContainer + '40',
      borderWidth: 1,
      borderColor: colors.errorContainer,
    },
    dangerWarningText: {
      ...Typography.bodySm,
      color: colors.error,
      flex: 1,
      lineHeight: 18,
    },
  });
}
