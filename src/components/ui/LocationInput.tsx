/**
 * LocationInput — Rich location input field with editable name,
 * map picker launch button, hidden coordinates abstraction,
 * and optional privacy toggle.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Spacing } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { MapPickerModal, LocationResult } from './MapPickerModal';

export interface LocationData {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface LocationInputProps {
  label?: string;
  value?: string;
  latitude?: number | null;
  longitude?: number | null;
  placeholder?: string;
  error?: string;
  hint?: string;
  onChangeLocation?: (location: LocationData) => void;
  modalTitle?: string;
  // Privacy toggle (for User registration and profile edit)
  showPrivacyToggle?: boolean;
  isPrivate?: boolean;
  onPrivacyChange?: (isPrivate: boolean) => void;
  privacyLabel?: string;
  privacyHint?: string;
}

export const LocationInput: React.FC<LocationInputProps> = ({
  label = 'Location',
  modalTitle,
  value = '',
  latitude = null,
  longitude = null,
  placeholder = 'Enter or select a location...',
  error,
  hint,
  onChangeLocation,
  showPrivacyToggle = false,
  isPrivate = false,
  onPrivacyChange,
  privacyLabel = 'Keep my location private',
  privacyHint = 'Your city will not be shown on your profile or explore map',
}) => {
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // When user edits the text directly (plain text without map picker)
  const handleTextChange = (text: string) => {
    onChangeLocation?.({
      name: text,
      latitude: null,
      longitude: null,
    });
  };

  // When user confirms location in the map picker
  const handleMapSelect = (result: LocationResult) => {
    onChangeLocation?.({
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
    });
  };

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: colors.onSurface }]}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surfaceContainerLow,
            borderColor: error ? Colors.error : isFocused ? colors.primaryContainer : 'transparent',
          },
          isFocused && { backgroundColor: colors.surfaceContainerLowest },
        ]}
      >
        <MaterialIcons
          name="place"
          size={20}
          color={error ? Colors.error : isFocused ? colors.primaryContainer : colors.outline}
          style={styles.leftIcon}
        />

        {/* Editable location name */}
        <TextInput
          style={[styles.input, { color: colors.onSurface }]}
          placeholder={placeholder}
          placeholderTextColor={colors.outline}
          value={value}
          onChangeText={handleTextChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />

        {/* Map Picker launch button */}
        <TouchableOpacity
          style={[styles.mapButton, { backgroundColor: colors.primaryContainer + '20' }]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
          accessibilityLabel="Open map to pick location"
        >
          <MaterialIcons name="map" size={18} color={colors.primaryContainer} style={{ marginRight: 4 }} />
          <Text style={[styles.mapButtonText, { color: colors.primaryContainer }]}>Map</Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
      {hint && !error && <Text style={[styles.hintText, { color: colors.outline }]}>{hint}</Text>}

      {/* Optional Privacy Toggle */}
      {showPrivacyToggle && (
        <View style={[styles.privacyContainer, { backgroundColor: colors.surfaceContainerLow }]}>
          <View style={styles.privacyTextContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons
                name={isPrivate ? 'lock' : 'public'}
                size={16}
                color={isPrivate ? colors.primaryContainer : colors.outline}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.privacyLabel, { color: colors.onSurface }]}>{privacyLabel}</Text>
            </View>
            <Text style={[styles.privacySubtext, { color: colors.outline }]}>{privacyHint}</Text>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={onPrivacyChange}
            trackColor={{ false: colors.surfaceContainerHigh, true: colors.primaryContainer }}
            thumbColor={Platform.OS === 'ios' ? '#ffffff' : isPrivate ? colors.onPrimary : '#f4f3f4'}
          />
        </View>
      )}

      {/* Map Picker Modal */}
      <MapPickerModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSelect={handleMapSelect}
        initialLocation={{
          latitude,
          longitude,
          name: value,
        }}
        title={modalTitle || `Select ${label}`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.labelMd,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    minHeight: 50,
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.bodyMd,
    paddingVertical: 12,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    marginLeft: Spacing.xs,
  },
  mapButtonText: {
    ...Typography.captionSm,
    fontWeight: '700',
  },
  errorText: {
    ...Typography.captionSm,
    color: Colors.error,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  hintText: {
    ...Typography.captionSm,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  privacyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  privacyTextContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  privacyLabel: {
    ...Typography.bodyMd,
    fontWeight: '600',
  },
  privacySubtext: {
    ...Typography.captionSm,
    marginTop: 2,
  },
});
