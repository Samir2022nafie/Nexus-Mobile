/**
 * Main Tab Layout — Bottom tab navigation with 5 tabs:
 * Home, Explore, Create (FAB), Hangouts, Profile
 * Redirects to auth if user is not authenticated.
 * Includes synchronized scroll hide/reveal animation.
 */
import React, { useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { View, StyleSheet, TouchableOpacity, Platform, Animated, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Shadows } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { CreateBottomSheet } from '../../src/components/CreateBottomSheet';
import {
  TabBarVisibilityProvider,
  useTabBarVisibility,
} from '../../src/context/TabBarVisibilityContext';

function TabBarItem({ iconName, label, isFocused, onPress, color }: any) {
  const scaleAnim = React.useRef(new Animated.Value(isFocused ? 1.06 : 1)).current;

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isFocused ? 1.08 : 1,
      useNativeDriver: true,
      friction: 7,
      tension: 120,
    }).start();
  }, [isFocused]);

  return (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: scaleAnim }] }}>
        <MaterialIcons name={iconName} size={24} color={color} />
        <Text style={[styles.tabLabel, { color, fontWeight: isFocused ? '700' : '500' }]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function AnimatedTabBar({ state, descriptors, navigation }: any) {
  const { tabBarTranslateY } = useTabBarVisibility();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [createModalVisible, setCreateModalVisible] = useState(false);

  return (
    <>
      <Animated.View
        style={[
          styles.tabBarAnimatedWrapper,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderTopColor: colors.surfaceContainerHigh,
            paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 12) : 8,
            transform: [{ translateY: tabBarTranslateY }],
          },
        ]}
      >
        <View style={styles.tabBarRow}>
          {state.routes.map((route: any, index: number) => {
            const isFocused = state.index === index;
            const color = isFocused ? colors.tabBarActive : colors.tabBarInactive;

            if (route.name === 'create') {
              return (
                <TouchableOpacity
                  key={route.key}
                  style={styles.fabWrapper}
                  onPress={() => setCreateModalVisible(true)}
                  activeOpacity={0.85}
                  accessibilityLabel="Create options"
                >
                  <View style={[styles.createButton, { backgroundColor: colors.primaryContainer }]}>
                    <MaterialIcons name="add" size={26} color={colors.onPrimary} />
                  </View>
                </TouchableOpacity>
              );
            }

            let iconName: any = 'home';
            let label = 'Home';
            if (route.name === 'explore') {
              iconName = 'explore';
              label = 'Explore';
            } else if (route.name === 'hangouts') {
              iconName = 'local-cafe';
              label = 'Hangouts';
            } else if (route.name === 'profile') {
              iconName = 'account-circle';
              label = 'Profile';
            }

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TabBarItem
                key={route.key}
                iconName={iconName}
                label={label}
                isFocused={isFocused}
                color={color}
                onPress={onPress}
              />
            );
          })}
        </View>
      </Animated.View>

      <CreateBottomSheet
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
      />
    </>
  );
}

export default function TabLayout() {
  const { isAuthenticated } = useAuth();

  // If not authenticated, redirect to auth stack
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <TabBarVisibilityProvider>
      <View style={styles.rootContainer}>
        <Tabs
          tabBar={(props) => <AnimatedTabBar {...props} />}
          screenOptions={{
            headerShown: false,
            tabBarHideOnKeyboard: true,
          }}
        >
          <Tabs.Screen name="index" options={{ title: 'Home' }} />
          <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
          <Tabs.Screen name="create" options={{ title: '' }} />
          <Tabs.Screen name="hangouts" options={{ title: 'Hangouts' }} />
          <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        </Tabs>
      </View>
    </TabBarVisibilityProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  tabBarAnimatedWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerHigh,
    ...Shadows.sm,
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingTop: 6,
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
