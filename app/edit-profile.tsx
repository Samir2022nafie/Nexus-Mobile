/**
 * Edit Profile Screen — Matches Stitch screen_25_edit_profile_filled_form
 * Backend: PATCH /users/me
 * Features:
 * - Modal top bar with Cancel and Save actions
 * - Avatar with camera edit badge
 * - Tactile warm parchment inputs for First Name, Last Name, Bio (with counter)
 * - Read-only Profile Picture URL with lock
 * - Delete Account trigger
 */
import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { useSafeRouter } from '../src/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../src/constants/theme';
import { useTheme, useThemedStyles } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { usersService } from '../src/services/users';
import { ApiRequestError } from '../src/services/api';
import { extractDirectImageUrl, resolveImageUrl, parseCropFromUrl } from '../src/utils/imageUrl';
import { LocationInput } from '../src/components/ui/LocationInput';
import { ImageCropModal } from '../src/components/ui/ImageCropModal';
import { Avatar } from '../src/components/ui/Avatar';

export default function EditProfileScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);
  const { user, updateUser, logout } = useAuth();

  const [form, setForm] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    bio: user?.bio || '',
    profilePictureUrl: user?.profile_picture_url || '',
    locationName: user?.location?.placeName || user?.location?.name || (user?.location as any)?.place_name || '',
    latitude: user?.location?.latitude ?? (null as number | null),
    longitude: user?.location?.longitude ?? (null as number | null),
    isLocationPrivate: Boolean(user?.isLocationPrivate ?? user?.is_location_private),
  });
  const initialProfileRef = useRef({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    bio: user?.bio || '',
    profilePictureUrl: user?.profile_picture_url || '',
    locationName: user?.location?.placeName || user?.location?.name || (user?.location as any)?.place_name || '',
    latitude: user?.location?.latitude ?? (null as number | null),
    longitude: user?.location?.longitude ?? (null as number | null),
    isLocationPrivate: Boolean(user?.isLocationPrivate ?? user?.is_location_private),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cropModalVisible, setCropModalVisible] = useState(false);

  const hasChanges = useMemo(() => {
    const init = initialProfileRef.current;
    if (form.firstName.trim() !== (init.firstName || '').trim()) return true;
    if (form.lastName.trim() !== (init.lastName || '').trim()) return true;
    if (form.bio.trim() !== (init.bio || '').trim()) return true;
    if (form.profilePictureUrl.trim() !== (init.profilePictureUrl || '').trim()) return true;
    if (form.locationName.trim() !== (init.locationName || '').trim()) return true;
    if (form.latitude !== init.latitude) return true;
    if (form.longitude !== init.longitude) return true;
    if (form.isLocationPrivate !== init.isLocationPrivate) return true;
    return false;
  }, [form]);

  const handleSave = async () => {
    if (!hasChanges) {
      router.back();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const updated = await usersService.updateMyProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        bio: form.bio.trim(),
        profilePictureUrl: form.profilePictureUrl.trim() ? form.profilePictureUrl.trim() : (null as any),
        locationName: form.locationName.trim() ? form.locationName.trim() : null,
        latitude: form.latitude ?? null,
        longitude: form.longitude ?? null,
        isLocationPrivate: form.isLocationPrivate,
      });
      updateUser(updated);
      router.back();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        // Fallback update local state for preview
        updateUser({
          ...user,
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          bio: form.bio.trim(),
          profile_picture_url: form.profilePictureUrl.trim() ? form.profilePictureUrl.trim() : null,
          location: form.locationName.trim()
            ? {
                id: user?.location?.id || 'preview-loc',
                name: form.locationName.trim(),
                placeName: form.locationName.trim(),
                place_name: form.locationName.trim(),
                latitude: form.latitude ?? 0,
                longitude: form.longitude ?? 0,
              }
            : null,
          isLocationPrivate: form.isLocationPrivate,
          is_location_private: form.isLocationPrivate,
        } as any);
        router.back();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Modal Custom App Bar Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.cancelButton}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading || !hasChanges}
          style={[styles.saveButton, (!hasChanges || loading) && { opacity: 0.4 }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.saveText, (!hasChanges || loading) && { color: colors.tertiary }]}>
            {loading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={() => {
              if (form.profilePictureUrl || user?.profile_picture_url) {
                setCropModalVisible(true);
              }
            }}
            activeOpacity={0.8}
          >
            <Avatar
              uri={form.profilePictureUrl || user?.profile_picture_url}
              size={84}
              name={user?.first_name || user?.name || user?.username}
            />
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error" size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Form Fields */}
        <View style={styles.form}>
          {/* First Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>FIRST NAME</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                value={form.firstName}
                onChangeText={(v) => setForm((p) => ({ ...p, firstName: v }))}
              />
              <MaterialIcons name="badge" size={18} color={colors.tertiary} />
            </View>
          </View>

          {/* Last Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>LAST NAME (OPTIONAL)</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                value={form.lastName}
                onChangeText={(v) => setForm((p) => ({ ...p, lastName: v }))}
              />
              <MaterialIcons name="person" size={18} color={colors.tertiary} />
            </View>
          </View>

          {/* Bio Field */}
          <View style={styles.fieldGroup}>
            <View style={styles.bioLabelRow}>
              <Text style={styles.fieldLabel}>BIO</Text>
              <Text style={styles.bioCounter}>{form.bio.length} / 500</Text>
            </View>
            <View style={[styles.inputBox, styles.bioBox]}>
              <TextInput
                style={[styles.textInput, styles.bioInput]}
                value={form.bio}
                onChangeText={(v) => setForm((p) => ({ ...p, bio: v }))}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Profile Picture URL (Unlocked) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PROFILE PICTURE URL</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                placeholder="https://example.com/avatar.jpg"
                placeholderTextColor={colors.outline}
                value={parseCropFromUrl(form.profilePictureUrl).cleanUrl}
                onChangeText={(v) => {
                  const direct = extractDirectImageUrl(v);
                  setForm((p) => ({ ...p, profilePictureUrl: direct }));
                  if (v.trim().startsWith('http') && !/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(v.trim())) {
                    resolveImageUrl(v.trim()).then((resolved) => {
                      if (resolved && resolved.startsWith('http')) {
                        setForm((p) => ({ ...p, profilePictureUrl: resolved }));
                      }
                    });
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {form.profilePictureUrl.length > 0 ? (
                <TouchableOpacity
                  onPress={() => setForm((p) => ({ ...p, profilePictureUrl: '' }))}
                  style={{ padding: 4 }}
                >
                  <MaterialIcons name="close" size={18} color={colors.tertiary} />
                </TouchableOpacity>
              ) : (
                <MaterialIcons name="link" size={18} color={colors.tertiary} />
              )}
            </View>
            {(form.profilePictureUrl || user?.profile_picture_url) ? (
              <TouchableOpacity
                style={styles.cropTriggerBtn}
                onPress={() => setCropModalVisible(true)}
                activeOpacity={0.75}
              >
                <MaterialIcons name="crop" size={16} color={colors.primaryContainer} />
                <Text style={[styles.cropTriggerText, { color: colors.primaryContainer }]}>
                  Crop / Adjust Avatar
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Location & Privacy */}
          <View style={styles.fieldGroup}>
            <LocationInput
              label="Home Location"
              modalTitle="Home Location"
              value={form.locationName}
              latitude={form.latitude}
              longitude={form.longitude}
              placeholder="Select your city or hometown..."
              hint="Displayed as a pill on your profile page"
              onChangeLocation={(loc) => {
                setForm((p) => ({
                  ...p,
                  locationName: loc.name,
                  latitude: loc.latitude ?? null,
                  longitude: loc.longitude ?? null,
                }));
              }}
              showPrivacyToggle={true}
              isPrivate={form.isLocationPrivate}
              onPrivacyChange={(val) => setForm((p) => ({ ...p, isLocationPrivate: val }))}
              privacyLabel="Keep location private"
              privacyHint="Hide your city from other users on your profile and map"
            />
          </View>
        </View>
      </ScrollView>

      {/* Profile Picture Circular Cropper Modal */}
      <ImageCropModal
        visible={cropModalVisible}
        imageUri={form.profilePictureUrl || user?.profile_picture_url || null}
        cropShape="circle"
        aspectRatio={1.0}
        title="Crop Profile Picture"
        onConfirm={(croppedUri) => {
          setForm((p) => ({ ...p, profilePictureUrl: croppedUri }));
          setCropModalVisible(false);
        }}
        onCancel={() => setCropModalVisible(false)}
      />
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
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
    backgroundColor: colors.surface,
  },
  cancelButton: {
    minWidth: 50,
    justifyContent: 'center',
  },
  cancelText: {
    ...Typography.bodyMd,
    color: colors.tertiary,
  },
  topBarTitle: {
    ...Typography.headlineSm,
    color: colors.onSurface,
  },
  saveButton: {
    minWidth: 50,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  saveText: {
    ...Typography.labelLg,
    color: colors.primaryContainer,
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 48,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  avatarWrapper: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: 'hidden',
    position: 'relative',
    ...Shadows.sm,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: 'rgba(49, 48, 48, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.white,
    marginTop: 2,
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#feba48',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  cropTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(254, 186, 72, 0.12)',
  },
  cropTriggerText: {
    fontSize: 12,
    fontWeight: '700',
  },
  avatarHint: {
    ...Typography.captionMd,
    color: colors.tertiary,
    marginTop: Spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: colors.errorContainer,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    ...Typography.captionMd,
    color: colors.onErrorContainer,
  },
  form: {
    gap: Spacing.md,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.tertiary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingLeft: 4,
  },
  inputBox: {
    height: 48,
    borderRadius: BorderRadius.xl,
    backgroundColor: colors.tertiaryFixed,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    ...Shadows.sm,
  },
  textInput: {
    flex: 1,
    height: '100%',
    ...Typography.bodyMd,
    color: colors.onSurface,
  },
  bioLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  bioCounter: {
    ...Typography.captionSm,
    color: colors.tertiary,
  },
  bioBox: {
    height: 96,
    paddingVertical: 10,
  },
  bioInput: {
    height: '100%',
    lineHeight: 20,
  },
  readOnlyBox: {
    backgroundColor: colors.surfaceContainer,
  },
  readOnlyText: {
    flex: 1,
    ...Typography.captionMd,
    color: colors.tertiary,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: colors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    marginTop: 4,
  },
  infoChipText: {
    ...Typography.captionSm,
    color: colors.onSurfaceVariant,
    flex: 1,
    lineHeight: 16,
  },
  deleteSection: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    paddingTop: Spacing.md,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  deleteBtnText: {
    ...Typography.labelMd,
    color: colors.error,
    fontWeight: '600',
  },
});
