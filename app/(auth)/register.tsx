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
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Button } from '../../src/components/ui/Button';
import { useAuth } from '../../src/context/AuthContext';
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

    if (!form.lastName.trim()) {
      errs.lastName = 'Last name is required';
    }

    if (!form.username.trim()) {
      errs.username = 'Username is required';
    } else if (form.username.length > 30) {
      errs.username = 'Username must be at most 30 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
      errs.username = 'Only letters, numbers, and underscores';
    }

    if (!form.email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'Invalid email address';
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
      const fullPhone = form.phoneNumber.trim()
        ? (form.phoneNumber.startsWith('+') ? form.phoneNumber.trim() : `${selectedCountryCode}${form.phoneNumber.trim()}`)
        : undefined;

      const result = await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        username: form.username.trim(),
        email: form.email.trim() || undefined,
        phoneNumber: fullPhone,
        password: form.password,
        birthDate: birthDateISO,
      });

      if (result.phone) {
        router.replace({
          pathname: '/(auth)/verify-phone',
          params: { phone: result.phone },
        });
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.details) {
          const fieldErrors: Record<string, string> = {};
          err.details.forEach((d) => {
            const field = d.path[0];
            fieldErrors[field] = d.message;
          });
          setErrors(fieldErrors);
        } else {
          setGeneralError(err.message);
        }
      } else {
        setGeneralError('Something went wrong. Please try again.');
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
          <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Create Account</Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step indicator */}
        <View style={styles.stepBlock}>
          <View style={styles.stepBadgeRow}>
            <View style={styles.stepPill}>
              <Text style={styles.stepPillText}>1</Text>
            </View>
            <Text style={styles.stepTitle}>Your Profile Details</Text>
          </View>
          <Text style={styles.stepSubtitle}>
            Step into curated neighborhood salons, intimate threads, and physical meetups.
          </Text>
        </View>

        {generalError ? (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error" size={18} color={Colors.error} />
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
                  placeholderTextColor={Colors.outline}
                  value={form.firstName}
                  onChangeText={(v) => updateField('firstName', v)}
                />
              </View>
              {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
            </View>

            <View style={styles.col}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Last Name</Text>
                <Text style={styles.requiredBadge}>Required</Text>
              </View>
              <View style={[styles.inputBox, errors.lastName && styles.inputBoxError]}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Last name"
                  placeholderTextColor={Colors.outline}
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
                placeholderTextColor={Colors.outline}
                value={form.username}
                onChangeText={(v) => updateField('username', v)}
                autoCapitalize="none"
              />
            </View>
            <Text style={styles.helperText}>Letters, numbers, underscores. Max 30 characters.</Text>
            {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}
          </View>

          {/* Email — Required */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.requiredBadge}>Required</Text>
            </View>
            <View style={[styles.inputBox, errors.email && styles.inputBoxError]}>
              <TextInput
                style={styles.textInput}
                placeholder="Enter your email address"
                placeholderTextColor={Colors.outline}
                value={form.email}
                onChangeText={(v) => updateField('email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <Text style={styles.helperText}>Used for login and account recovery</Text>
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>

          {/* Phone with Country Code Picker */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Phone</Text>
            <View style={[styles.inputBox, styles.phoneInputBox]}>
              <TouchableOpacity
                style={styles.countryCodeBadge}
                onPress={openCountryPicker}
                activeOpacity={0.7}
                accessibilityLabel="Select country code"
              >
                <Text style={styles.countryCodeText}>{selectedCountryCode}</Text>
                <MaterialIcons name="arrow-drop-down" size={16} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
              <View style={styles.dividerVertical} />
              <TextInput
                style={styles.textInput}
                placeholder="Phone number (optional)"
                placeholderTextColor={Colors.outline}
                value={form.phoneNumber}
                onChangeText={(v) => updateField('phoneNumber', v)}
                keyboardType="phone-pad"
              />
            </View>
            <Text style={styles.helperText}>Can be verified later for phone login</Text>
          </View>

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
                placeholderTextColor={Colors.outline}
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
                  color={Colors.onSurfaceVariant}
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
                placeholderTextColor={Colors.outline}
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
                  color={Colors.onSurfaceVariant}
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
              <MaterialIcons name="calendar-today" size={20} color={Colors.onSurfaceVariant} />
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
                <MaterialIcons name="close" size={22} color={Colors.tertiary} />
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
                    <MaterialIcons name="check" size={20} color={Colors.primaryContainer} />
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
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
    marginLeft: Spacing.xs,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  stepBlock: {
    paddingTop: Spacing.xs,
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
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onPrimaryFixed,
  },
  stepTitle: {
    ...Typography.labelMd,
    color: Colors.onSurface,
  },
  stepSubtitle: {
    ...Typography.captionMd,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
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
    color: Colors.onSurface,
  },
  requiredBadge: {
    ...Typography.captionSm,
    color: Colors.onSurfaceVariant,
  },
  inputBox: {
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceVariant,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputBoxError: {
    borderColor: Colors.error,
  },
  textInput: {
    flex: 1,
    height: '100%',
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  datePickerText: {
    flex: 1,
    ...Typography.bodyMd,
    color: Colors.onSurface,
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
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    gap: 2,
  },
  countryCodeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  countryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerHigh,
    gap: Spacing.md,
  },
  countryItemRowActive: {
    backgroundColor: Colors.surfaceContainerLow,
  },
  countryFlag: {
    fontSize: 22,
  },
  countryName: {
    flex: 1,
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  countryCodeValue: {
    ...Typography.labelMd,
    color: Colors.tertiary,
    fontWeight: '600',
  },
  dividerVertical: {
    width: 1,
    height: 24,
    backgroundColor: Colors.outlineVariant,
    marginHorizontal: Spacing.sm,
    opacity: 0.5,
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
    color: Colors.onSurfaceVariant,
    opacity: 0.8,
    paddingLeft: 4,
  },
  errorText: {
    ...Typography.captionSm,
    color: Colors.error,
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
    color: Colors.onSurfaceVariant,
  },
  bottomLinkAction: {
    ...Typography.labelMd,
    color: Colors.secondary,
  },
});

const pickerStyles = StyleSheet.create({
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
    ...StyleSheet.absoluteFill as any,
    backgroundColor: Colors.scrim,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFill as any,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
    color: Colors.outline,
  },
  title: {
    ...Typography.titleMd,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  doneText: {
    ...Typography.bodyMd,
    color: Colors.primaryContainer,
    fontWeight: '700',
  },
  preview: {
    ...Typography.titleLg,
    color: Colors.primaryContainer,
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
    backgroundColor: Colors.tertiaryFixed,
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
    color: Colors.outline,
  },
  itemTextSelected: {
    ...Typography.titleMd,
    color: Colors.onTertiaryFixed,
    fontWeight: '700',
  },
});
