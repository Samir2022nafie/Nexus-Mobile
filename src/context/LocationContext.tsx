import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Platform, Alert } from 'react-native';
import * as Location from 'expo-location';

export interface GpsLocation {
  latitude: number;
  longitude: number;
}

interface LocationContextType {
  userLocation: GpsLocation | null;
  hasLocationPermission: boolean | null;
  isLoadingLocation: boolean;
  requestLocation: (promptUser?: boolean, forceFresh?: boolean) => Promise<GpsLocation | null>;
  refreshLocation: () => Promise<GpsLocation | null>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [userLocation, setUserLocation] = useState<GpsLocation | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const lastFetchedAt = useRef<number>(0);
  const cachedLocationRef = useRef<GpsLocation | null>(null);

  // Sync ref with state
  useEffect(() => {
    cachedLocationRef.current = userLocation;
  }, [userLocation]);

  const fetchPosition = useCallback(async (forceFresh: boolean = false): Promise<GpsLocation | null> => {
    // If cached location is fresh (< 90s) and not forced, return immediately (saves GPS chip battery)
    const now = Date.now();
    if (!forceFresh && cachedLocationRef.current && now - lastFetchedAt.current < 90000) {
      return cachedLocationRef.current;
    }

    try {
      setIsLoadingLocation(true);

      // 1. Try instantaneous last known position first (available in ~10ms from OS cache)
      try {
        const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 180000 });
        if (lastKnown?.coords) {
          const coords = {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          };
          setUserLocation(coords);
          cachedLocationRef.current = coords;
          lastFetchedAt.current = Date.now();

          // If caller didn't strictly ask for fresh GPS or we already have high accuracy, return immediately
          if (!forceFresh) {
            return coords;
          }
        }
      } catch (err) {
        // Continue to fresh fetch
      }

      // 2. Fresh GPS acquisition with strict 5-second timeout to prevent locking UI
      const gpsPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Optimal for mobile: uses WiFi + cellular + GPS without draining battery
      });

      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 5000);
      });

      const current = await Promise.race([gpsPromise, timeoutPromise]);

      if (current && 'coords' in current && current.coords) {
        const coords = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };
        setUserLocation(coords);
        cachedLocationRef.current = coords;
        lastFetchedAt.current = Date.now();
        return coords;
      }

      return cachedLocationRef.current;
    } catch (err) {
      console.warn('Could not get GPS position:', err);
      return cachedLocationRef.current;
    } finally {
      setIsLoadingLocation(false);
    }
  }, []);

  const requestLocation = useCallback(
    async (promptUser: boolean = true, forceFresh: boolean = false): Promise<GpsLocation | null> => {
      try {
        const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

        if (existingStatus === 'granted') {
          setHasLocationPermission(true);
          return await fetchPosition(forceFresh);
        }

        if (!promptUser) {
          setHasLocationPermission(false);
          return null;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setHasLocationPermission(true);
          return await fetchPosition(forceFresh);
        } else {
          setHasLocationPermission(false);
          if (promptUser && Platform.OS !== 'web') {
            Alert.alert(
              'Location Permission',
              'Enable GPS location permissions in your device settings to discover communities, hangouts, and events near you.',
              [{ text: 'OK' }]
            );
          }
          return null;
        }
      } catch (err) {
        console.warn('Error requesting location permission:', err);
        return null;
      }
    },
    [fetchPosition]
  );

  const refreshLocation = useCallback(async (): Promise<GpsLocation | null> => {
    return await requestLocation(false, true);
  }, [requestLocation]);

  // Check initial permission quietly on mount
  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => {
        if (status === 'granted') {
          setHasLocationPermission(true);
          fetchPosition(false);
        } else {
          setHasLocationPermission(false);
        }
      })
      .catch(() => {});
  }, [fetchPosition]);

  return (
    <LocationContext.Provider
      value={{
        userLocation,
        hasLocationPermission,
        isLoadingLocation,
        requestLocation,
        refreshLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useUserLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useUserLocation must be used within a LocationProvider');
  }
  return context;
}
