/**
 * AppBottomBar — Reusable bottom navigation bar matching the system tab bar.
 * Used on screens like Community Detail where the user desires the bottom
 * navigation bar to persist, with none of the 4 tab buttons highlighted,
 * and passing the community context into the CreateBottomSheet (+) trigger.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../constants/theme';
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
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const getTabColor = (tab: BottomBarTab) => {
    return activeTab === tab ? Colors.tabBarActive : Colors.tabBarInactive;
  };

  return (
    <>
      <View style={styles.tabBar}>
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
          <View style={styles.createButton}>
            <MaterialIcons name="add" size={26} color={Colors.onPrimary} />
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
      </View>

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
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerHigh,
    height: 68,
    paddingBottom: Platform.OS === 'ios' ? 14 : 8,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    ...Shadows.sm,
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
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
});
