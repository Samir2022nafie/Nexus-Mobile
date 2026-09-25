/**
 * Register Screen — Create Account form.
 * Backend: POST /auth/register
 * Matches Stitch: screen_2_register_default_empty
 * Enforces: age >= 13, required fields, phone format, password confirmation
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Animated,
  Easing,
  Dimensions,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../../src/constants/theme';
import { useTheme, useThemedStyles } from '../../src/context/ThemeContext';
import { Button } from '../../src/components/ui/Button';
import { useAuth } from '../../src/context/AuthContext';
import { authService } from '../../src/services/auth';
import { ApiRequestError } from '../../src/services/api';

const SCREEN_HEIGHT = Dimensions.get('window').height;

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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ITEM_HEIGHT = 44;

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDateDisplay(day: number, month: number, year: number): string {
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function formatDateISO(day: number, month: number, year: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function PickerColumn({
  data,
  selectedIndex,
  onSelect,
  renderLabel,
}: {
  data: number[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  renderLabel: (item: number) => string;
}) {
  const pickerStyles = useThemedStyles(getPickerStyles);
  const flatListRef = useRef<FlatList>(null);

  const handleScrollEnd = (e: any) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
    onSelect(clampedIndex);
  };

  return (
    <View style={pickerStyles.column}>
      <View style={pickerStyles.selectionHighlight} pointerEvents="none" />
      <FlatList
        ref={flatListRef}
        data={data}
        keyExtractor={(item, i) => `${item}-${i}`}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT * 2,
        }}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        initialScrollIndex={selectedIndex}
        renderItem={({ item, index }) => {
          const isSelected = index === selectedIndex;
          return (
            <TouchableOpacity
              style={pickerStyles.item}
              onPress={() => {
                onSelect(index);
                flatListRef.current?.scrollToIndex({ index, animated: true });
              }}
              activeOpacity={0.7}
            >
              <Text style={isSelected ? pickerStyles.itemTextSelected : pickerStyles.itemText}>
                {renderLabel(item)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);
  const pickerStyles = useThemedStyles(getPickerStyles);

  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState({
    username: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    birthDay: 15,
    birthMonth: 6,
    birthYear: currentYear - 20,
  });

  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState('+251');
  const [countryPickerRendered, setCountryPickerRendered] = useState(false);
  const countryFadeAnim = useRef(new Animated.Value(0)).current;
  const countrySlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const [datePickerRendered, setDatePickerRendered] = useState(false);
  const dateFadeAnim = useRef(new Animated.Value(0)).current;
  const dateSlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [tempDay, setTempDay] = useState(15);
  const [tempMonth, setTempMonth] = useState(6);
  const [tempYear, setTempYear] = useState(currentYear - 20);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const birthDateDisplay = formatDateDisplay(form.birthDay, form.birthMonth, form.birthYear);
  const birthDateISO = formatDateISO(form.birthDay, form.birthMonth, form.birthYear);

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};

    if (!form.firstName.trim()) {
      errs.firstName = 'First name is required';
    }

    if (!form.username.trim()) {
      errs.username = 'Username is required';
    } else if (form.username.length > 30) {
      errs.username = 'Username must be at most 30 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
      errs.username = 'Only letters, numbers, and underscores';
    }

    if (authMethod === 'email') {
      if (!form.email.trim()) {
        errs.email = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        errs.email = 'Invalid email address';
      }
    } else {
      const cleanDigits = form.phoneNumber.replace(/\D/g, '');
      if (!cleanDigits) {
        errs.phoneNumber = 'Phone number is required';
      } else if (selectedCountryCode === '+251') {
        const sub = cleanDigits.startsWith('2510')
          ? cleanDigits.slice(4)
          : cleanDigits.startsWith('251')
          ? cleanDigits.slice(3)
          : cleanDigits.startsWith('0')
          ? cleanDigits.slice(1)
          : cleanDigits;
        if (sub.length < 9) {
          errs.phoneNumber = 'Missing digits. Ethiopian phone numbers must be 9 digits (e.g. 0911223344)';
        } else if (sub.length > 9) {
          errs.phoneNumber = 'Too many digits for an Ethiopian phone number';
        } else if (!/^[97]/.test(sub)) {
          errs.phoneNumber = 'Ethiopian phone numbers must start with 9 or 7 (or 09 / 07)';
        }
      } else if (cleanDigits.length < 8) {
        errs.phoneNumber = 'Please enter a complete phone number';
      }
    }

    if (!form.password) {
      errs.password = 'Password is required';
    } else if (form.password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }

    if (!form.confirmPassword) {
      errs.confirmPassword = 'Confirm your password';
    } else if (form.password !== form.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    // Age validation: must be at least 13
    const today = new Date();
    const birthDate = new Date(form.birthYear, form.birthMonth - 1, form.birthDay);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 13) {
      errs.birthDate = 'You must be at least 13 years old to join Nexus';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setGeneralError('');

    try {
      if (authMethod === 'phone') {
        const fullPhone = form.phoneNumber.trim().startsWith('+')
          ? form.phoneNumber.trim()
          : `${selectedCountryCode}${form.phoneNumber.trim().replace(/^0+/, '')}`;

        await authService.requestPhoneOtp({ phoneNumber: fullPhone });
        router.push({
          pathname: '/(auth)/verify-phone',
          params: {
            phone: fullPhone,
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            username: form.username.trim(),
            password: form.password,
            birthDate: birthDateISO,
          },
        });
      } else {
        await register({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          username: form.username.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          birthDate: birthDateISO,
        });
        router.replace('/(tabs)');
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.details) {
          const fieldErrors: Record<string, string> = {};
          err.details.forEach((d: any) => {
            const field = d.field || d.path?.[0] || 'general';
            fieldErrors[field] = d.message;
          });
          setErrors(fieldErrors);
        }
        setGeneralError(err.message);
      } else {
        setGeneralError('Registration failed. Please check your network and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const openDatePicker = () => {
    setTempDay(form.birthDay);
    setTempMonth(form.birthMonth);
    setTempYear(form.birthYear);
    setDatePickerRendered(true);
    dateFadeAnim.setValue(0);
    dateSlideAnim.setValue(SCREEN_HEIGHT);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(dateFadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(dateSlideAnim, {
          toValue: 0,
          duration: 280,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const closeDatePicker = () => {
    Animated.parallel([
      Animated.timing(dateFadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(dateSlideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDatePickerRendered(false);
    });
  };

  const confirmDatePicker = () => {
    const maxDay = getDaysInMonth(tempMonth, tempYear);
    const clampedDay = Math.min(tempDay, maxDay);
    setForm((prev) => ({
      ...prev,
      birthDay: clampedDay,
      birthMonth: tempMonth,
      birthYear: tempYear,
    }));
    setErrors((prev) => ({ ...prev, birthDate: '' }));
    closeDatePicker();
  };

  const openCountryPicker = () => {
    setCountryPickerRendered(true);
    countryFadeAnim.setValue(0);
    countrySlideAnim.setValue(SCREEN_HEIGHT);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(countryFadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(countrySlideAnim, {
          toValue: 0,
          duration: 280,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const closeCountryPicker = () => {
    Animated.parallel([
      Animated.timing(countryFadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(countrySlideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCountryPickerRendered(false);
    });
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const maxDay = getDaysInMonth(tempMonth, tempYear);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  const years = Array.from({ length: currentYear - 1920 + 1 }, (_, i) => currentYear - i);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top sticky bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Create Account</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {generalError ? (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error" size={18} color={colors.error} />
            <Text style={styles.errorBannerText}>{generalError}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          {/* First Name & Last Name (2 columns) — Placed FIRST */}
          <View style={styles.rowTwoCols}>
            <View style={styles.col}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>First Name</Text>
                <Text style={styles.requiredBadge}>Required</Text>
              </View>
              <View style={[styles.inputBox, errors.firstName && styles.inputBoxError]}>
                <TextInput
                  style={styles.textInput}
                  placeholder="First name"
                  placeholderTextColor={colors.outline}
                  value={form.firstName}
                  onChangeText={(v) => updateField('firstName', v)}
                />
              </View>
              {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
            </View>

            <View style={styles.col}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Last Name</Text>
                <Text style={styles.optionalBadge}>Optional</Text>
              </View>
              <View style={[styles.inputBox, errors.lastName && styles.inputBoxError]}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Last name"
                  placeholderTextColor={colors.outline}
                  value={form.lastName}
                  onChangeText={(v) => updateField('lastName', v)}
                />
              </View>
              {errors.lastName ? <Text style={styles.errorText}>{errors.lastName}</Text> : null}
            </View>
          </View>

          {/* Username */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Username</Text>
              <Text style={styles.requiredBadge}>Required</Text>
            </View>
            <View style={[styles.inputBox, errors.username && styles.inputBoxError]}>
              <TextInput
                style={styles.textInput}
                placeholder="Choose a username"
                placeholderTextColor={colors.outline}
                value={form.username}
                onChangeText={(v) => updateField('username', v)}
                autoCapitalize="none"
              />
            </View>
            <Text style={styles.helperText}>Letters, numbers, underscores. Max 30 characters.</Text>
            {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}
          </View>

          {/* Account Identifier Toggle: Email vs Phone */}
          <View style={styles.authMethodSection}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Sign Up With</Text>
              <Text style={styles.requiredBadge}>Required</Text>
            </View>
            <View style={styles.authMethodToggle}>
              <TouchableOpacity
                style={[
                  styles.authMethodTab,
                  authMethod === 'email' && styles.authMethodTabActive,
                ]}
                onPress={() => {
                  setAuthMethod('email');
                  setErrors((prev) => ({ ...prev, email: '', phoneNumber: '' }));
                }}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="email"
                  size={16}
                  color={authMethod === 'email' ? colors.onPrimaryContainer : colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.authMethodTabText,
                    authMethod === 'email' && styles.authMethodTabTextActive,
                  ]}
                >
                  Email
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.authMethodTab,
                  authMethod === 'phone' && styles.authMethodTabActive,
                ]}
                onPress={() => {
                  setAuthMethod('phone');
                  setErrors((prev) => ({ ...prev, email: '', phoneNumber: '' }));
                }}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="phone"
                  size={16}
                  color={authMethod === 'phone' ? colors.onPrimaryContainer : colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.authMethodTabText,
                    authMethod === 'phone' && styles.authMethodTabTextActive,
                  ]}
                >
                  Phone Number
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Conditional Email or Phone Input */}
          {authMethod === 'email' ? (
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Email Address</Text>
                <Text style={styles.requiredBadge}>Required</Text>
              </View>
              <View style={[styles.inputBox, errors.email && styles.inputBoxError]}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your email address"
                  placeholderTextColor={colors.outline}
                  value={form.email}
                  onChangeText={(v) => updateField('email', v)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <Text style={styles.helperText}>Used for login and notifications</Text>
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>
          ) : (
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Phone Number</Text>
                <Text style={styles.requiredBadge}>Required</Text>
              </View>
              <View style={[styles.inputBox, styles.phoneInputBox, errors.phoneNumber && styles.inputBoxError]}>
                <TouchableOpacity
                  style={styles.countryCodeBadge}
                  onPress={openCountryPicker}
                  activeOpacity={0.7}
                  accessibilityLabel="Select country code"
                >
                  <Text style={styles.countryCodeText}>{selectedCountryCode}</Text>
                  <MaterialIcons name="arrow-drop-down" size={16} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
                <View style={styles.dividerVertical} />
                <TextInput
                  style={styles.textInput}
                  placeholder="911 234 567"
                  placeholderTextColor={colors.outline}
                  value={form.phoneNumber}
                  onChangeText={(v) => updateField('phoneNumber', v)}
                  keyboardType="phone-pad"
                />
              </View>
              <Text style={styles.helperText}>We will send a 6-digit SMS verification code</Text>
              {errors.phoneNumber ? <Text style={styles.errorText}>{errors.phoneNumber}</Text> : null}
            </View>
          )}

          {/* Password */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <Text style={styles.requiredBadge}>Required</Text>
            </View>
            <View style={[styles.inputBox, errors.password && styles.inputBoxError]}>
              <TextInput
                style={styles.textInput}
                placeholder="Create a password"
                placeholderTextColor={colors.outline}
                value={form.password}
                onChangeText={(v) => updateField('password', v)}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility' : 'visibility-off'}
                  size={20}
                  color={colors.onSurfaceVariant}
                />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
          </View>

          {/* Confirm Password */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Confirm Password</Text>
              <Text style={styles.requiredBadge}>Required</Text>
            </View>
            <View style={[styles.inputBox, errors.confirmPassword && styles.inputBoxError]}>
              <TextInput
                style={styles.textInput}
                placeholder="Re-enter your password"
                placeholderTextColor={colors.outline}
                value={form.confirmPassword}
                onChangeText={(v) => updateField('confirmPassword', v)}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
              >
                <MaterialIcons
                  name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                  size={20}
                  color={colors.onSurfaceVariant}
                />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
          </View>

          {/* Date of Birth */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Date of Birth</Text>
            <TouchableOpacity
              style={[styles.inputBox, errors.birthDate && styles.inputBoxError]}
              onPress={openDatePicker}
              activeOpacity={0.7}
            >
              <Text style={styles.datePickerText}>{birthDateDisplay}</Text>
              <MaterialIcons name="calendar-today" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Text style={styles.helperText}>You must be at least 13 years old</Text>
            {errors.birthDate ? <Text style={styles.errorText}>{errors.birthDate}</Text> : null}
          </View>

          {/* Submit Button */}
          <View style={styles.actionContainer}>
            <Button
              title="Create Account"
              onPress={handleSubmit}
              loading={loading}
              fullWidth
              size="lg"
            />
            <View style={styles.bottomLinkRow}>
              <Text style={styles.bottomLinkLead}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.bottomLinkAction}>Log In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Date Picker Modal with Decoupled Fade Scrim and Slide Sheet */}
      <Modal
        visible={datePickerRendered}
        transparent
        animationType="none"
        onRequestClose={closeDatePicker}
      >
        <View style={pickerStyles.overlay} pointerEvents="box-none">
          <Animated.View style={[pickerStyles.backdrop, { opacity: dateFadeAnim }]}>
            <Pressable style={pickerStyles.backdropPressable} onPress={closeDatePicker} />
          </Animated.View>

          <Animated.View
            style={[
              pickerStyles.sheet,
              {
                paddingBottom: Math.max(insets.bottom, 24),
                transform: [{ translateY: dateSlideAnim }],
              },
            ]}
          >
            <View style={pickerStyles.header}>
              <TouchableOpacity onPress={closeDatePicker} style={pickerStyles.headerBtn}>
                <Text style={pickerStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={pickerStyles.title}>Date of Birth</Text>
              <TouchableOpacity onPress={confirmDatePicker} style={pickerStyles.headerBtn}>
                <Text style={pickerStyles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>

            <Text style={pickerStyles.preview}>
              {formatDateDisplay(
                Math.min(tempDay, getDaysInMonth(tempMonth, tempYear)),
                tempMonth,
                tempYear,
              )}
            </Text>

            <View style={pickerStyles.columnsRow}>
              <PickerColumn
                data={months}
                selectedIndex={tempMonth - 1}
                onSelect={(i) => setTempMonth(i + 1)}
                renderLabel={(m) => MONTHS[m - 1]}
              />
              <PickerColumn
                data={days}
                selectedIndex={Math.min(tempDay - 1, days.length - 1)}
                onSelect={(i) => setTempDay(i + 1)}
                renderLabel={(d) => String(d)}
              />
              <PickerColumn
                data={years}
                selectedIndex={years.indexOf(tempYear) >= 0 ? years.indexOf(tempYear) : 0}
                onSelect={(i) => setTempYear(years[i])}
                renderLabel={(y) => String(y)}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Country Code Picker Modal with Decoupled Fade Scrim and Slide Sheet */}
      <Modal
        visible={countryPickerRendered}
        transparent
        animationType="none"
        onRequestClose={closeCountryPicker}
      >
        <View style={pickerStyles.overlay} pointerEvents="box-none">
          <Animated.View style={[pickerStyles.backdrop, { opacity: countryFadeAnim }]}>
            <Pressable style={pickerStyles.backdropPressable} onPress={closeCountryPicker} />
          </Animated.View>

          <Animated.View
            style={[
              pickerStyles.sheet,
              {
                maxHeight: SCREEN_HEIGHT * 0.65,
                paddingBottom: Math.max(insets.bottom, 20),
                transform: [{ translateY: countrySlideAnim }],
              },
            ]}
          >
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.title}>Select Country Code</Text>
              <TouchableOpacity onPress={closeCountryPicker} style={pickerStyles.headerBtn}>
                <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {COUNTRY_CODES.map((item) => (
                <TouchableOpacity
                  key={item.code}
                  style={[
                    styles.countryItemRow,
                    selectedCountryCode === item.code && styles.countryItemRowActive,
                  ]}
                  onPress={() => {
                    setSelectedCountryCode(item.code);
                    closeCountryPicker();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryCodeValue}>{item.code}</Text>
                  {selectedCountryCode === item.code && (
                    <MaterialIcons name="check" size={20} color={colors.primaryContainer} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
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
      paddingHorizontal: Spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant,
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
      fontWeight: '700',
      textAlign: 'center',
      flex: 1,
    },
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.xxl,
    },
    stepBlock: {
      paddingTop: Spacing.md,
      paddingBottom: Spacing.lg,
    },
    stepBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    stepPill: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.onPrimaryContainer,
    },
    stepTitle: {
      ...Typography.labelMd,
      color: colors.onSurface,
      fontWeight: '700',
    },
    stepSubtitle: {
      ...Typography.captionMd,
      color: colors.onSurfaceVariant,
      lineHeight: 18,
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
    form: {
      gap: Spacing.md,
    },
    fieldGroup: {
      gap: 6,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    label: {
      ...Typography.labelMd,
      color: colors.onSurface,
      fontWeight: '600',
    },
    requiredBadge: {
      ...Typography.captionSm,
      color: colors.onSurfaceVariant,
    },
    optionalBadge: {
      ...Typography.captionSm,
      color: colors.outline,
    },
    authMethodSection: {
      gap: 6,
    },
    authMethodToggle: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceContainerHigh,
      borderRadius: BorderRadius.md,
      padding: 3,
      gap: 4,
    },
    authMethodTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: BorderRadius.sm,
    },
    authMethodTabActive: {
      backgroundColor: colors.primaryContainer,
    },
    authMethodTabText: {
      ...Typography.labelMd,
      color: colors.onSurfaceVariant,
      fontWeight: '600',
    },
    authMethodTabTextActive: {
      color: colors.onPrimaryContainer,
      fontWeight: '700',
    },
    inputBox: {
      height: 50,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.tertiaryFixed,
      paddingHorizontal: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    inputBoxError: {
      borderColor: colors.error,
    },
    textInput: {
      flex: 1,
      height: '100%',
      ...Typography.bodyMd,
      color: colors.onSurface,
    },
    datePickerText: {
      flex: 1,
      ...Typography.bodyMd,
      color: colors.onSurface,
    },
    eyeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    phoneInputBox: {
      paddingLeft: Spacing.sm,
    },
    countryCodeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceContainerHigh,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: BorderRadius.sm,
      gap: 2,
    },
    countryCodeText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.onSurface,
    },
    countryItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant,
      gap: Spacing.md,
    },
    countryItemRowActive: {
      backgroundColor: colors.surfaceContainerLow,
    },
    countryFlag: {
      fontSize: 22,
    },
    countryName: {
      flex: 1,
      ...Typography.bodyMd,
      color: colors.onSurface,
    },
    countryCodeValue: {
      ...Typography.labelMd,
      color: colors.primaryContainer,
      fontWeight: '600',
    },
    dividerVertical: {
      width: 1,
      height: 24,
      backgroundColor: colors.outlineVariant,
      marginHorizontal: Spacing.sm,
    },
    rowTwoCols: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    col: {
      flex: 1,
      gap: 6,
    },
    helperText: {
      ...Typography.captionSm,
      color: colors.outline,
      paddingLeft: 4,
    },
    errorText: {
      ...Typography.captionSm,
      color: colors.error,
      paddingLeft: 4,
    },
    actionContainer: {
      marginTop: Spacing.lg,
      gap: Spacing.md,
      alignItems: 'center',
    },
    bottomLinkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
    },
    bottomLinkLead: {
      ...Typography.bodyMd,
      color: colors.onSurfaceVariant,
    },
    bottomLinkAction: {
      ...Typography.labelMd,
      color: colors.primaryContainer,
      fontWeight: '700',
    },
  });

const getPickerStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'flex-end',
      zIndex: 9999,
    },
    backdrop: {
      ...(StyleSheet.absoluteFill as any),
      backgroundColor: colors.scrim,
    },
    backdropPressable: {
      ...(StyleSheet.absoluteFill as any),
    },
    sheet: {
      backgroundColor: colors.surfaceContainer,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      borderColor: colors.outlineVariant,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      zIndex: 10000,
      ...Shadows.lg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      paddingTop: Spacing.xs,
      paddingBottom: Spacing.sm,
    },
    headerBtn: {
      padding: Spacing.xs,
    },
    cancelText: {
      ...Typography.bodyMd,
      color: colors.outline,
    },
    title: {
      ...Typography.titleMd,
      color: colors.onSurface,
      fontWeight: '700',
    },
    doneText: {
      ...Typography.bodyMd,
      color: colors.primaryContainer,
      fontWeight: '700',
    },
    preview: {
      ...Typography.titleLg,
      color: colors.primaryContainer,
      textAlign: 'center',
      marginBottom: Spacing.md,
      fontWeight: '700',
    },
    columnsRow: {
      flexDirection: 'row',
      height: ITEM_HEIGHT * 5,
      paddingHorizontal: Spacing.sm,
    },
    column: {
      flex: 1,
      overflow: 'hidden',
      position: 'relative',
    },
    selectionHighlight: {
      position: 'absolute',
      top: ITEM_HEIGHT * 2,
      left: 4,
      right: 4,
      height: ITEM_HEIGHT,
      backgroundColor: colors.tertiaryFixed,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: BorderRadius.md,
      zIndex: 0,
    },
    item: {
      height: ITEM_HEIGHT,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemText: {
      ...Typography.bodyMd,
      color: colors.outline,
    },
    itemTextSelected: {
      ...Typography.titleMd,
      color: colors.onSurface,
      fontWeight: '700',
    },
  });
