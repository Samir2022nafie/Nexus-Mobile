/**
 * Tab bar / segmented control for switching between sub-tabs.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '../../constants/theme';

interface TabBarProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  scrollable?: boolean;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  scrollable = false,
}) => {
  const content = tabs.map((tab) => {
    const isActive = tab === activeTab;
    return (
      <TouchableOpacity
        key={tab}
        onPress={() => onTabChange(tab)}
        activeOpacity={0.7}
        style={[styles.tab, isActive && styles.activeTab]}
      >
        <Text style={[styles.tabText, isActive && styles.activeTabText]}>
          {tab}
        </Text>
      </TouchableOpacity>
    );
  });

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {content}
      </ScrollView>
    );
  }

  return <View style={styles.container}>{content}</View>;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.lg,
    padding: 3,
    gap: 2,
  },
  scrollContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: Colors.primaryContainer,
  },
  tabText: {
    ...Typography.labelSm,
    color: Colors.outline,
  },
  activeTabText: {
    color: Colors.onPrimaryContainer,
  },
});
