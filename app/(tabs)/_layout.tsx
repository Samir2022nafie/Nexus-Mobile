/**
 * Main Tab Layout — Bottom tab navigation with 5 tabs:
 * Home, Explore, Create (FAB), Hangouts, Profile
 * Redirects to auth if user is not authenticated.
 */
import React, { useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { CreateBottomSheet } from '../../src/components/CreateBottomSheet';

export default function TabLayout() {
  const { isAuthenticated } = useAuth();
  const [createModalVisible, setCreateModalVisible] = useState(false);

  // If not authenticated, redirect to auth stack
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <View style={styles.rootContainer}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: Colors.tabBarActive,
          tabBarInactiveTintColor: Colors.tabBarInactive,
          tabBarLabelStyle: styles.tabLabel,
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="home" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="explore" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: '',
            tabBarButton: () => (
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
            ),
          }}
        />
        <Tabs.Screen
          name="hangouts"
          options={{
            title: 'Hangouts',
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="forum" size={23} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="account-circle" size={24} color={color} />
            ),
          }}
        />
      </Tabs>

      {/* Layered sliding bottom sheet over the active screen */}
      <CreateBottomSheet
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerHigh,
    height: 68,
    paddingBottom: Platform.OS === 'ios' ? 14 : 8,
    paddingTop: 8,
    ...Shadows.sm,
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
