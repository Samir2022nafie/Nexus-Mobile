import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
  requestLocation: (promptUser?: boolean) => Promise<GpsLocation | null>;
  refreshLocation: () => Promise<GpsLocation | null>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [userLocation, setUserLocation] = useState<GpsLocation | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const fetchPosition = useCallback(async (): Promise<GpsLocation | null> => {
    try {
      setIsLoadingLocation(true);

      // Try quick last known position first
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown?.coords) {
        const coords = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
        setUserLocation(coords);
      }

      // Then get fresh accurate position
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (current?.coords) {
        const coords = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };
        setUserLocation(coords);
        return coords;
      }

      return userLocation;
    } catch (err) {
      console.warn('Could not get GPS position:', err);
      return userLocation;
    } finally {
      setIsLoadingLocation(false);
    }
  }, [userLocation]);

  const requestLocation = useCallback(
    async (promptUser: boolean = true): Promise<GpsLocation | null> => {
      try {
        const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

        if (existingStatus === 'granted') {
          setHasLocationPermission(true);
          return await fetchPosition();
        }

        if (!promptUser) {
          setHasLocationPermission(false);
          return null;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setHasLocationPermission(true);
          return await fetchPosition();
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
    return await requestLocation(false);
  }, [requestLocation]);

  // Check initial permission quietly on mount
  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => {
        if (status === 'granted') {
          setHasLocationPermission(true);
          fetchPosition();
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
