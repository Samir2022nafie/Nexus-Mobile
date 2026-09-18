/**
 * Toast notification overlay.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ToastProps {
  message: string | null;
  type?: 'info' | 'success' | 'error' | 'warning';
  onDismiss?: () => void;
  duration?: number;
}

const iconMap: Record<string, { name: keyof typeof MaterialIcons.glyphMap; color: string }> = {
  info: { name: 'info', color: Colors.primary },
  success: { name: 'check-circle', color: Colors.success },
  error: { name: 'error', color: Colors.error },
  warning: { name: 'warning', color: Colors.warning },
};

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  onDismiss,
  duration = 3500,
}) => {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (message) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
        ]).start(() => onDismiss?.());
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!message) return null;

  const icon = iconMap[type];

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + 8, opacity, transform: [{ translateY }] },
      ]}
    >
      <MaterialIcons name={icon.name} size={18} color={icon.color} />
      <Text style={styles.text} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.inverseSurface,
    ...Shadows.lg,
  },
  text: {
    ...Typography.captionMd,
    color: Colors.inverseOnSurface,
    flex: 1,
    fontWeight: '500',
  },
});
