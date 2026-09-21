/**
 * TabBarVisibilityContext — Coordinates hide/reveal animations of the bottom navigation bar
 * on downward scroll and swipe-up / scroll-to-top.
 */
import React, { createContext, useContext, useRef, useState, useMemo } from 'react';
import { Animated } from 'react-native';

interface TabBarVisibilityContextValue {
  tabBarTranslateY: Animated.Value;
  hideTabBar: () => void;
  showTabBar: () => void;
  handleTabBarScroll: (dy: number, velocityY: number, currentY: number) => void;
  isTabBarVisible: boolean;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue | null>(null);

export const TabBarVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tabBarTranslateY = useRef(new Animated.Value(0)).current;
  const visibleRef = useRef(true);
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  const hideTabBar = useRef(() => {
    if (visibleRef.current) {
      visibleRef.current = false;
      setIsTabBarVisible(false);
      Animated.timing(tabBarTranslateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }).current;

  const showTabBar = useRef(() => {
    if (!visibleRef.current) {
      visibleRef.current = true;
      setIsTabBarVisible(true);
      Animated.timing(tabBarTranslateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
  }).current;

  const handleTabBarScroll = useRef((dy: number, velocityY: number, currentY: number) => {
    if (currentY <= 15) {
      showTabBar();
    } else if (dy > 2 && currentY > 30) {
      // Hide on scroll down
      hideTabBar();
    } else if (dy < -4 && velocityY < -0.6) {
      // Reveal on quick swipe up
      showTabBar();
    }
  }).current;

  const value = useMemo(
    () => ({
      tabBarTranslateY,
      hideTabBar,
      showTabBar,
      handleTabBarScroll,
      isTabBarVisible,
    }),
    [tabBarTranslateY, hideTabBar, showTabBar, handleTabBarScroll, isTabBarVisible]
  );

  return (
    <TabBarVisibilityContext.Provider value={value}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
};

export const useTabBarVisibility = (): TabBarVisibilityContextValue => {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) {
    // Return a dummy fallback so it can be called safely even if unmounted
    return {
      tabBarTranslateY: new Animated.Value(0),
      hideTabBar: () => {},
      showTabBar: () => {},
      handleTabBarScroll: () => {},
      isTabBarVisible: true,
    };
  }
  return ctx;
};
