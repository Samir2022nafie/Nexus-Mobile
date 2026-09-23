import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useTabBarVisibility } from '../../context/TabBarVisibilityContext';
import { CreateBottomSheet } from '../CreateBottomSheet';

export type BottomBarTab = 'home' | 'explore' | 'hangouts' | 'profile' | null;

interface AppBottomBarProps {
  activeTab?: BottomBarTab;
  communityContext?: {
    id: string;
    slug: string;
    name: string;
  };
}

export function AppBottomBar({ activeTab = null, communityContext }: AppBottomBarProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { tabBarTranslateY, showTabBar } = useTabBarVisibility();
  const [createModalVisible, setCreateModalVisible] = useState(false);

  useEffect(() => {
    showTabBar();
  }, [showTabBar]);

  const getTabColor = (tab: BottomBarTab) => {
    return activeTab === tab ? colors.tabBarActive : colors.tabBarInactive;
  };

  return (
    <>
      <Animated.View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderTopColor: colors.surfaceContainerHigh,
            transform: [{ translateY: tabBarTranslateY }],
          },
        ]}
      >
        {/* Tab 1: Home */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push('/(tabs)')}
          activeOpacity={0.7}
          accessibilityLabel="Home tab"
        >
          <MaterialIcons name="home" size={24} color={getTabColor('home')} />
          <Text style={[styles.tabLabel, { color: getTabColor('home') }]}>Home</Text>
        </TouchableOpacity>

        {/* Tab 2: Explore */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push('/(tabs)/explore')}
          activeOpacity={0.7}
          accessibilityLabel="Explore tab"
        >
          <MaterialIcons name="explore" size={24} color={getTabColor('explore')} />
          <Text style={[styles.tabLabel, { color: getTabColor('explore') }]}>Explore</Text>
        </TouchableOpacity>

        {/* Tab 3: Create FAB */}
        <TouchableOpacity
          style={styles.fabWrapper}
          onPress={() => setCreateModalVisible(true)}
          activeOpacity={0.85}
          accessibilityLabel="Create options"
        >
          <View style={[styles.createButton, { backgroundColor: colors.primaryContainer }]}>
            <MaterialIcons name="add" size={26} color={colors.onPrimary} />
          </View>
        </TouchableOpacity>

        {/* Tab 4: Hangouts */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push('/(tabs)/hangouts')}
          activeOpacity={0.7}
          accessibilityLabel="Hangouts tab"
        >
          <MaterialIcons name="local-cafe" size={24} color={getTabColor('hangouts')} />
          <Text style={[styles.tabLabel, { color: getTabColor('hangouts') }]}>Hangouts</Text>
        </TouchableOpacity>

        {/* Tab 5: Profile */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.7}
          accessibilityLabel="Profile tab"
        >
          <MaterialIcons name="account-circle" size={24} color={getTabColor('profile')} />
          <Text style={[styles.tabLabel, { color: getTabColor('profile') }]}>Profile</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Layered sliding bottom sheet passing current community */}
      <CreateBottomSheet
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        communityContext={communityContext}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    height: 68,
    paddingBottom: Platform.OS === 'ios' ? 14 : 8,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    ...Shadows.sm,
    zIndex: 900,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  fabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    marginBottom: 4,
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
});

