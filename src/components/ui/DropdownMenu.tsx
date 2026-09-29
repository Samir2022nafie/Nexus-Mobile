import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Typography, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

export interface DropdownMenuItem {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  iconColor?: string;
  triggerStyle?: any;
}

export function DropdownMenu({ items, iconColor, triggerStyle }: DropdownMenuProps) {
  const [visible, setVisible] = useState(false);
  const { colors } = useTheme();

  return (
    <View>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={[styles.triggerBtn, { backgroundColor: 'rgba(0,0,0,0.4)' }, triggerStyle]}
        activeOpacity={0.8}
      >
        <MaterialIcons name="more-vert" size={20} color={iconColor || colors.onSurface} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <View
            style={[
              styles.menuCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.surfaceVariant,
              },
            ]}
          >
            {items.map((item, index) => (
              <React.Fragment key={item.label}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.surfaceVariant }]} />}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setVisible(false);
                    setTimeout(() => {
                      item.onPress();
                    }, 100);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={item.icon}
                    size={18}
                    color={item.destructive ? colors.error : colors.onSurface}
                  />
                  <Text
                    style={[
                      styles.menuItemText,
                      { color: item.destructive ? colors.error : colors.onSurface },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  triggerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 80,
    paddingRight: Spacing.lg,
  },
  menuCard: {
    minWidth: 160,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  menuItemText: {
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: '600',
  },
  divider: {
    height: 1,
  },
});
