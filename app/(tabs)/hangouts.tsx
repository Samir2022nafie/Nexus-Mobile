/**
 * Snapchat-Style 3D Globe Explore Map Screen.
 * Plotted with communities, events, hangouts, and users.
 * Globe on zoom out, flat map on zoom in.
 * Completely free (MapLibre GL v5 + OpenFreeMap vector styles). Zero billing.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { useUserLocation } from '../../src/context/LocationContext';
import {
  locationsService,
  ExploreMapResponse,
  MapCommunityItem,
  MapEventItem,
  MapHangoutItem,
  MapUserItem,
} from '../../src/services/locations';
import { BACKEND_CATEGORIES } from '../../src/utils/categories';

// Ordered tabs: All -> Hangouts -> Events -> Communities -> People (Users)
type FilterType = 'all' | 'hangouts' | 'events' | 'communities' | 'users';

interface SelectedMapEntity {
  type: 'user' | 'hangout' | 'event' | 'community';
  data: any;
}

export interface SelectedCity {
  id: string;
  name: string;
  isCurrent: boolean;
  lat: number;
  lng: number;
}

// Module-level cache to persist camera position across tab switches and app minimize
const MAX_CAMERA_MEMORY_MS = 5 * 60 * 1000; // 5 minutes camera memory window
let lastExploreCameraState: {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  timestamp: number;
} | null = null;

export const CATEGORY_FILTER_ITEMS: {
  id: string;
  name: string;
  label: string;
  icon: string;
  iconLibrary?: 'MaterialIcons' | 'MaterialCommunityIcons';
}[] = [
  { id: 'movies_tv', name: 'movies', label: 'Movies', icon: 'movie' },
  { id: 'sports', name: 'sports', label: 'Sports', icon: 'sports-soccer' },
  { id: 'music_entertainment', name: 'music', label: 'Music', icon: 'music-note' },
  { id: 'gaming', name: 'gaming', label: 'Gaming', icon: 'sports-esports' },
  { id: 'technology', name: 'tech', label: 'Tech', icon: 'computer' },
  { id: 'arts_creativity', name: 'art', label: 'Art', icon: 'palette' },
  { id: 'outdoor_adventure', name: 'outdoor', label: 'Outdoor', icon: 'terrain' },
  { id: 'health_fitness', name: 'fitness', label: 'Fitness', icon: 'fitness-center' },
  { id: 'education_study_groups', name: 'education', label: 'Education', icon: 'school' },
  { id: 'books_writing', name: 'books', label: 'Books', icon: 'menu-book' },
  { id: 'anime_manga', name: 'anime', label: 'Anime', icon: 'shuriken', iconLibrary: 'MaterialCommunityIcons' },
  { id: 'social_lifestyle', name: 'social', label: 'Social', icon: 'groups' },
  { id: 'culture_language', name: 'culture', label: 'Culture', icon: 'translate' },
  { id: 'other', name: 'other', label: 'Others', icon: 'category' },
];

export default function ExploreMapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    focusLat?: string;
    focusLng?: string;
    focusId?: string;
    focusType?: string;
  }>();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { userLocation, requestLocation, isLoadingLocation } = useUserLocation();
  const webViewRef = useRef<WebView>(null);

  // Tabs always default to 'all' — opening an entity does NOT force the tab filter
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>(['all']);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [isCategoryStackExpanded, setIsCategoryStackExpanded] = useState<boolean>(false);
  const categoryScrollRef = useRef<ScrollView>(null);
  const categoryStackAnim = useRef(new Animated.Value(0)).current;

  const handleExpandCategories = useCallback(() => {
    setIsCategoryStackExpanded(true);
    Animated.spring(categoryStackAnim, {
      toValue: 1,
      tension: 65,
      friction: 10,
      useNativeDriver: false,
    }).start();
  }, [categoryStackAnim]);

  const handleCollapseCategories = useCallback(() => {
    Animated.timing(categoryStackAnim, {
      toValue: 0,
      duration: 260,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
      useNativeDriver: false,
    }).start(() => {
      setIsCategoryStackExpanded(false);
      categoryScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, [categoryStackAnim]);

  const activeCategoriesList = useMemo(() => {
    return CATEGORY_FILTER_ITEMS.filter(
      (c) => selectedCategories.includes(c.id) || selectedCategories.includes(c.name)
    );
  }, [selectedCategories]);

  const [mapData, setMapData] = useState<ExploreMapResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [locatingGps, setLocatingGps] = useState<boolean>(false);
  const [selectedEntity, setSelectedEntity] = useState<SelectedMapEntity | null>(null);
  const [mapReady, setMapReady] = useState<boolean>(false);

  // User's default or current coordinates
  const userLat = userLocation?.latitude ?? user?.location?.latitude ?? 9.0222;
  const userLng = userLocation?.longitude ?? user?.location?.longitude ?? 38.7468;
  const currentCityName = 'Addis Ababa';
  const currentCityId = 'addis-ababa';

  // Horizontally scrollable city pills state.
  // Initially user's current city is rendered and appears first!
  const [selectedCities, setSelectedCities] = useState<SelectedCity[]>([
    {
      id: currentCityId,
      name: currentCityName,
      isCurrent: true,
      lat: userLat,
      lng: userLng,
    },
  ]);

  // Initial target coordinates for MapLibre map initialization
  const targetLat = params.focusLat ? parseFloat(params.focusLat) : null;
  const targetLng = params.focusLng ? parseFloat(params.focusLng) : null;
  const hasValidTarget = targetLat !== null && targetLng !== null && !isNaN(targetLat) && !isNaN(targetLng);

  // Welcoming camera position: starts at last visit's exact camera position if within memory window (< 5 min),
  // or user's current city/location. The map greets the user here and then smoothly flies (flyTo) to the target element!
  const isCameraMemoryValid =
    !!lastExploreCameraState &&
    Date.now() - (lastExploreCameraState.timestamp || 0) < MAX_CAMERA_MEMORY_MS;

  const initialCenterLng = isCameraMemoryValid
    ? lastExploreCameraState!.center[0]
    : userLng;
  const initialCenterLat = isCameraMemoryValid
    ? lastExploreCameraState!.center[1]
    : userLat;
  const initialZoom = isCameraMemoryValid
    ? lastExploreCameraState!.zoom
    : 12.8;
  const initialPitch = isCameraMemoryValid
    ? lastExploreCameraState!.pitch
    : 0;
  const initialBearing = isCameraMemoryValid ? lastExploreCameraState!.bearing : 0;

  // Track pending focus request across lifecycle
  const pendingFocusRef = useRef<{
    id?: string;
    type?: string;
    lat: number;
    lng: number;
    key: string;
  } | null>(
    hasValidTarget
      ? {
          id: params.focusId,
          type: params.focusType,
          lat: targetLat!,
          lng: targetLng!,
          key: `${params.focusId}_${params.focusLat}_${params.focusLng}_${params.focusType}`,
        }
      : null
  );
  const handledCardKeyRef = useRef<string | null>(null);

  // Bottom card slide animation & City pills slide animation
  const cardSlideAnim = useRef(new Animated.Value(300)).current;
  const cityPillsSlideAnim = useRef(new Animated.Value(0)).current;

  // Requirement 14: When preview card slides in from bottom, city pills slide down behind it.
  const openSelectedCard = useCallback((entity: SelectedMapEntity) => {
    setSelectedEntity(entity);
    Animated.parallel([
      Animated.spring(cardSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 65,
      }),
      Animated.timing(cityPillsSlideAnim, {
        toValue: 120, // slides down behind preview card & navigation bar
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardSlideAnim, cityPillsSlideAnim]);

  // When preview card is closed, city pills slide back up behind it to original position just above navigation bar
  const closeSelectedCard = useCallback(() => {
    Animated.parallel([
      Animated.timing(cardSlideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(cityPillsSlideAnim, {
        toValue: 0, // slides back up
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setSelectedEntity(null));
    const js = `if (window.clearHighlight) { window.clearHighlight(); } true;`;
    webViewRef.current?.injectJavaScript(js);
  }, [cardSlideAnim, cityPillsSlideAnim]);

  // Try opening preview card for targeted focus item
  const tryOpenPendingCard = useCallback((data: ExploreMapResponse | null, pending: typeof pendingFocusRef.current) => {
    if (!data || !pending || !pending.id) return;
    if (handledCardKeyRef.current === pending.key) return;

    const rawType = (pending.type || 'event').toLowerCase();
    let foundItem: any = null;
    let entityCategory: 'user' | 'hangout' | 'event' | 'community' = 'event';

    if (rawType === 'event' || rawType === 'events') {
      foundItem = (data.events || []).find((e: any) => String(e.id) === String(pending.id));
      entityCategory = 'event';
    } else if (rawType === 'hangout' || rawType === 'hangouts') {
      foundItem = (data.hangouts || []).find((h: any) => String(h.id) === String(pending.id));
      entityCategory = 'hangout';
    } else if (rawType === 'community' || rawType === 'communities') {
      foundItem = (data.communities || []).find(
        (c: any) => String(c.id) === String(pending.id) || c.slug === pending.id
      );
      entityCategory = 'community';
    } else if (rawType === 'user' || rawType === 'users') {
      foundItem = (data.users || []).find((u: any) => String(u.id) === String(pending.id));
      entityCategory = 'user';
    }

    if (foundItem) {
      handledCardKeyRef.current = pending.key;
      openSelectedCard({
        type: entityCategory,
        data: foundItem,
      });

      // Forward focus to WebView: auto-expand cluster if applicable and activate selection glow!
      const js = `if (window.focusEntityOnMap) {
        window.focusEntityOnMap(${JSON.stringify(String(pending.id))}, ${JSON.stringify(pending.type)}, ${pending.lat}, ${pending.lng});
      } true;`;
      webViewRef.current?.injectJavaScript(js);
    }
  }, [openSelectedCard]);

  // Send data & selected cities to WebView
  const sendDataToWebView = useCallback(
    (
      data: ExploreMapResponse | null,
      entityTypes: string[],
      categories: string[],
      cities: SelectedCity[]
    ) => {
      if (!data) return;
      const payload = {
        type: 'set_items',
        selectedEntityTypes: entityTypes,
        selectedCategories: categories,
        communities: data.communities,
        events: data.events,
        hangouts: data.hangouts,
        users: data.users,
        selectedCities: cities,
      };
      const js = `if (window.updateMapMarkers) { window.updateMapMarkers(${JSON.stringify(payload)}); } true;`;
      webViewRef.current?.injectJavaScript(js);
    },
    []
  );

  // Fetch explore map items from backend
  const loadMapData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await locationsService.getExploreMap();
      setMapData(data);
      sendDataToWebView(data, selectedEntityTypes, selectedCategories, selectedCities);
      tryOpenPendingCard(data, pendingFocusRef.current);
    } catch (err) {
      console.error('Failed to load explore map items:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedEntityTypes, selectedCategories, selectedCities, sendDataToWebView, tryOpenPendingCard]);

  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  // Handle focus parameters from external screens (events, hangouts, communities, user)
  useEffect(() => {
    if (params.focusLat && params.focusLng) {
      const lat = parseFloat(params.focusLat);
      const lng = parseFloat(params.focusLng);
      if (!isNaN(lat) && !isNaN(lng)) {
        const focusKey = `${params.focusId}_${params.focusLat}_${params.focusLng}_${params.focusType}`;
        const isNewFocus = !pendingFocusRef.current || pendingFocusRef.current.key !== focusKey;

        if (isNewFocus) {
          pendingFocusRef.current = {
            id: params.focusId,
            type: params.focusType,
            lat,
            lng,
            key: focusKey,
          };
          handledCardKeyRef.current = null;

          if (mapReady) {
            const js = `if (window.focusEntityOnMap) {
              window.focusEntityOnMap(${JSON.stringify(String(params.focusId || ''))}, ${JSON.stringify(params.focusType || '')}, ${lat}, ${lng});
            } true;`;
            webViewRef.current?.injectJavaScript(js);
          }

          if (mapData) {
            tryOpenPendingCard(mapData, pendingFocusRef.current);
          }
        }
      }
    }
  }, [params.focusLat, params.focusLng, params.focusId, params.focusType, mapReady, mapData]);

  // Requirement 14: Multi-select entity tabs
  const handleToggleEntityType = (entityType: string) => {
    setSelectedEntityTypes((prev) => {
      let next: string[];
      if (entityType === 'all') {
        next = ['all'];
      } else {
        const isAll = prev.includes('all');
        const hasType = prev.includes(entityType);
        if (isAll) {
          next = [entityType];
        } else if (hasType) {
          next = prev.filter((t) => t !== entityType);
          if (next.length === 0) {
            next = ['all'];
          }
        } else {
          next = [...prev.filter((t) => t !== 'all'), entityType];
        }
      }
      sendDataToWebView(mapData, next, selectedCategories, selectedCities);
      return next;
    });
    closeSelectedCard();
    pendingFocusRef.current = null;
    handledCardKeyRef.current = null;
    router.setParams({
      focusLat: undefined,
      focusLng: undefined,
      focusId: undefined,
      focusType: undefined,
    });
  };

  // Requirement 14: Multi-select category filter tabs
  const handleToggleCategory = (catId: string) => {
    setSelectedCategories((prev) => {
      const isAll = prev.includes('all');
      const hasCat = prev.includes(catId);
      let next: string[];
      if (isAll) {
        next = [catId];
      } else if (hasCat) {
        next = prev.filter((c) => c !== catId);
        if (next.length === 0) {
          next = ['all'];
        }
      } else {
        next = [...prev.filter((c) => c !== 'all'), catId];
      }
      sendDataToWebView(mapData, selectedEntityTypes, next, selectedCities);
      return next;
    });
    closeSelectedCard();
  };

  // Requirement 8c-iv: Remove city pill
  const handleRemoveCity = (cityId: string) => {
    const nextCities = selectedCities.filter((c) => c.id !== cityId);
    setSelectedCities(nextCities);
    const js = `if (window.syncSelectedCities) { window.syncSelectedCities(${JSON.stringify(nextCities)}); } true;`;
    webViewRef.current?.injectJavaScript(js);
  };

  // Handle message from WebView (marker tapped, map ready, city selected, camera moved)
  const onWebViewMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'marker_click') {
        openSelectedCard({
          type: msg.entityType,
          data: msg.data,
        });
      } else if (msg.type === 'map_click') {
        closeSelectedCard();
      } else if (msg.type === 'camera_move') {
        // Requirement 1: Persist camera position across navigation and app minimize
        lastExploreCameraState = {
          center: msg.center,
          zoom: msg.zoom,
          pitch: msg.pitch,
          bearing: msg.bearing,
          timestamp: Date.now(),
        };
      } else if (msg.type === 'city_selected') {
        const rawName = String(msg.city || 'City Area');
        const cId = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const isCurrent = cId === currentCityId || (Math.abs(msg.lat - userLat) < 0.35 && Math.abs(msg.lng - userLng) < 0.35);

        setSelectedCities((prev) => {
          if (prev.some((c) => c.id === cId)) return prev;
          const newCityObj: SelectedCity = {
            id: cId,
            name: rawName,
            isCurrent,
            lat: msg.lat,
            lng: msg.lng,
          };
          const next = isCurrent
            ? [newCityObj, ...prev.filter((c) => c.id !== cId)]
            : [...prev, newCityObj];
          const js = `if (window.syncSelectedCities) { window.syncSelectedCities(${JSON.stringify(next)}); } true;`;
          webViewRef.current?.injectJavaScript(js);
          return next;
        });
      } else if (msg.type === 'map_ready') {
        setMapReady(true);
        if (pendingFocusRef.current) {
          const { id, type, lng, lat } = pendingFocusRef.current;
          const js = `if (window.focusEntityOnMap) {
            window.focusEntityOnMap(${JSON.stringify(String(id || ''))}, ${JSON.stringify(type || '')}, ${lat}, ${lng});
          } true;`;
          webViewRef.current?.injectJavaScript(js);
        }
        if (mapData) {
          sendDataToWebView(mapData, selectedEntityTypes, selectedCategories, selectedCities);
          tryOpenPendingCard(mapData, pendingFocusRef.current);
        }
      }
    } catch (e) {
      console.error('WebView message parse error:', e);
    }
  };

  // Requirement 8c-iv: Top GPS Current Location button:
  // Zooms map to current location, selects current city, renders elements, and ensures its pill is placed FIRST!
  const handleFlyToGpsLocation = async () => {
    const lat = userLocation?.latitude ?? userLat;
    const lng = userLocation?.longitude ?? userLng;

    const js = `if (window.map) {
      window.map.flyTo({ center: [${lng}, ${lat}], zoom: 15, essential: true });
      if (window.setUserGpsMarker) { window.setUserGpsMarker(${lat}, ${lng}); }
    } true;`;
    webViewRef.current?.injectJavaScript(js);

    const currentCityObj: SelectedCity = {
      id: currentCityId,
      name: currentCityName,
      isCurrent: true,
      lat,
      lng,
    };

    setSelectedCities((prev) => {
      const rest = prev.filter((c) => c.id !== currentCityId);
      return [currentCityObj, ...rest];
    });

    const updatedCities = [currentCityObj, ...selectedCities.filter((c) => c.id !== currentCityId)];
    const syncJs = `if (window.syncSelectedCities) { window.syncSelectedCities(${JSON.stringify(updatedCities)}); } true;`;
    webViewRef.current?.injectJavaScript(syncJs);

    setLocatingGps(true);
    try {
      const loc = await requestLocation(true, true);
      if (loc?.latitude && loc?.longitude) {
        const freshJs = `if (window.map) {
          window.map.flyTo({ center: [${loc.longitude}, ${loc.latitude}], zoom: 15, essential: true });
          if (window.setUserGpsMarker) { window.setUserGpsMarker(${loc.latitude}, ${loc.longitude}); }
        } true;`;
        webViewRef.current?.injectJavaScript(freshJs);
      }
    } catch (e) {
      console.warn('GPS location fly error:', e);
    } finally {
      setLocatingGps(false);
    }
  };

  // Requirement 8d: Refresh button to the right of globe button
  // ONLY updates locations of all elements and user's GPS in place; does NOT move camera or zoom!
  const handleRefreshDataInPlace = async () => {
    setLoading(true);
    try {
      const [freshData, loc] = await Promise.all([
        locationsService.getExploreMap().catch(() => null),
        requestLocation(false, true).catch(() => null),
      ]);
      if (freshData) {
        setMapData(freshData);
        sendDataToWebView(freshData, selectedEntityTypes, selectedCategories, selectedCities);
      }
      if (loc?.latitude && loc?.longitude) {
        const js = `if (window.setUserGpsMarker) { window.setUserGpsMarker(${loc.latitude}, ${loc.longitude}); } true;`;
        webViewRef.current?.injectJavaScript(js);
      }
    } catch (e) {
      console.warn('Refresh error:', e);
    } finally {
      setLoading(false);
    }
  };

  // 3D Globe zoom out
  const handleResetGlobe = () => {
    const js = `if (window.resetToGlobe) { window.resetToGlobe(); } else if (window.map) { window.map.flyTo({ center: [20, 20], zoom: 1.85, pitch: 0, bearing: 0, essential: true }); } true;`;
    webViewRef.current?.injectJavaScript(js);
    closeSelectedCard();
  };

  const navigateToEntity = () => {
    if (!selectedEntity) return;
    const { type, data } = selectedEntity;
    if (type === 'community') {
      router.push(`/community/${data.slug || data.id}`);
    } else if (type === 'event') {
      router.push(`/event/${data.id}`);
    } else if (type === 'hangout') {
      router.push(`/hangout/${data.id}`);
    } else if (type === 'user') {
      router.push(`/user/${data.id}`);
    }
    closeSelectedCard();
  };

  // Requirement 8f: Even if the app is on light mode, ALWAYS use dark mode version of map & globe!
  const mapStyleUrl = 'https://tiles.openfreemap.org/styles/liberty';

  // Primary yellow accent & dark brown companion tokens (dark mode map is default whether app is in dark or light mode)
  const yellowAccent = '#e8a736';
  const darkBrown = '#281800';
  const darkBrownBg = '#201e1c';
  const darkBrownBorder = '#38332d';

  const mapHtml = useMemo(() => {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link href="https://unpkg.com/maplibre-gl@5.1.0/dist/maplibre-gl.css" rel="stylesheet" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body, html {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #02040a;
          }
          #map {
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 1;
          }

          /* High-Contrast Crisp Dark Mode for MapLibre Canvas - Preserves All Real Places, POIs & Layers */
          .maplibregl-canvas {
            filter: invert(90%) hue-rotate(180deg) brightness(95%) contrast(92%);
          }

          /* Cosmic Deep Space Background */
          .cosmos-bg {
            position: absolute;
            inset: 0;
            z-index: 0;
            background: radial-gradient(ellipse at 50% 50%, #0a1128 0%, #02040a 100%);
            overflow: hidden;
            pointer-events: none;
          }
          .cosmos-stars {
            position: absolute;
            inset: -300px;
            background-image: 
              radial-gradient(1.0px 1.0px at 28px 36px, #ffffff, transparent),
              radial-gradient(1.2px 1.2px at 145px 78px, #ffffff, transparent),
              radial-gradient(0.8px 0.8px at 82px 185px, #ffffff, transparent),
              radial-gradient(1.3px 1.3px at 278px 128px, #ffffff, transparent),
              radial-gradient(0.9px 0.9px at 218px 288px, #ffffff, transparent),
              radial-gradient(0.8px 0.8px at 48px 258px, #ffffff, transparent),
              radial-gradient(1.2px 1.2px at 318px 42px, #ffffff, transparent),
              radial-gradient(0.9px 0.9px at 188px 168px, #ffffff, transparent),
              radial-gradient(0.8px 0.8px at 112px 308px, #ffffff, transparent),
              radial-gradient(1.2px 1.2px at 52px 122px, #ffffff, transparent),
              radial-gradient(0.9px 0.9px at 168px 228px, #ffffff, transparent),
              radial-gradient(1.1px 1.1px at 308px 248px, #ffffff, transparent),
              radial-gradient(0.8px 0.8px at 258px 318px, #ffffff, transparent),
              radial-gradient(1.2px 1.2px at 338px 178px, #ffffff, transparent),
              radial-gradient(0.9px 0.9px at 16px 208px, #ffffff, transparent),
              radial-gradient(1.3px 1.3px at 128px 18px, #ffffff, transparent),
              radial-gradient(0.9px 0.9px at 238px 88px, #ffffff, transparent),
              radial-gradient(0.8px 0.8px at 298px 332px, #ffffff, transparent),
              radial-gradient(1.1px 1.1px at 95px 65px, #ffffff, transparent),
              radial-gradient(0.9px 0.9px at 175px 45px, #ffffff, transparent),
              radial-gradient(1.2px 1.2px at 60px 290px, #ffffff, transparent),
              radial-gradient(0.8px 0.8px at 245px 195px, #ffffff, transparent),
              radial-gradient(1.0px 1.0px at 15px 95px, #ffffff, transparent),
              radial-gradient(0.9px 0.9px at 195px 260px, #ffffff, transparent),
              radial-gradient(1.2px 1.2px at 285px 215px, #ffffff, transparent),
              radial-gradient(0.8px 0.8px at 135px 270px, #ffffff, transparent),
              radial-gradient(1.1px 1.1px at 215px 115px, #ffffff, transparent),
              radial-gradient(0.8px 0.8px at 30px 160px, #ffffff, transparent);
            background-repeat: repeat;
            background-size: 240px 240px;
            opacity: 1;
            will-change: transform;
            transition: transform 0.05s linear;
          }
          .cosmos-atmosphere {
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at center, transparent 38%, rgba(2, 6, 23, 0.7) 72%, #02040a 100%);
            pointer-events: none;
          }

          .marker-container {
            cursor: pointer;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
          }
          .marker-inner {
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            transform: scale(var(--map-zoom-scale, 1));
            transform-origin: center bottom;
            transition: transform 0.05s linear;
            will-change: transform;
          }

          /* Smooth Label Hiding when zoomed out */
          .hide-labels .hangout-label,
          .hide-labels .event-label,
          .hide-labels .community-label,
          .hide-labels .user-label {
            opacity: 0 !important;
            max-height: 0 !important;
            margin-top: 0 !important;
            padding: 0 !important;
            border: none !important;
            overflow: hidden !important;
            pointer-events: none !important;
            transition: opacity 0.2s ease, max-height 0.2s ease;
          }

          /* Requirement 8b: Card Deck Sliding Out & In Animation (like cards sliding to and from a deck of cards) */
          .card-slide-out {
            animation: cardSlideOutAnim 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards;
            will-change: transform, opacity;
          }
          @keyframes cardSlideOutAnim {
            0% {
              opacity: 0.82;
              transform: translate(0px, 0px) rotate(var(--card-deck-rot, 0deg));
            }
            100% {
              opacity: 1;
              transform: translate(var(--target-x), var(--target-y)) rotate(0deg);
            }
          }

          .card-slide-in {
            animation: cardSlideInAnim 0.32s cubic-bezier(0.25, 1, 0.5, 1) forwards;
            will-change: transform, opacity;
          }
          @keyframes cardSlideInAnim {
            0% {
              opacity: 1;
              transform: translate(var(--target-x), var(--target-y)) rotate(0deg);
            }
            100% {
              opacity: 0;
              transform: translate(0px, 0px) rotate(var(--card-deck-rot, 0deg));
            }
          }

          .stacked-return {
            animation: stackedReturnIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            will-change: transform, opacity;
          }
          @keyframes stackedReturnIn {
            0% { opacity: 0.4; }
            100% { opacity: 1; }
          }

          /* Pin Wrap allowing badge to protrude cleanly outside */
          .pin-wrap {
            position: relative;
            display: inline-flex;
            overflow: visible;
          }

          /* Overlapping Diamond Badge - Protrudes ~50% outside the corner */
          .overlap-badge {
            position: absolute;
            top: -9px;
            right: -9px;
            background: #e8a736;
            color: #141312;
            font-size: 11px;
            font-weight: 900;
            padding: 2.5px 7px;
            border-radius: 12px;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
            z-index: 25;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            line-height: 1;
          }

          /* Stacked Cards Visual for Same-Location Overlapped State */
          .stack-card {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            box-sizing: border-box;
          }
          .hangout-pin-stack { border-radius: 16px; }
          .event-pin-stack { border-radius: 12px; }
          .community-pin-stack { border-radius: 15px; }
          .user-pin-stack { border-radius: 50%; }

          .stack-card-1 {
            transform: translate(3.5px, 3.5px) rotate(3deg);
            background: #25221f;
            border: 1.5px solid rgba(232, 167, 54, 0.7);
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.6);
            z-index: 1;
          }
          .stack-card-2 {
            transform: translate(7px, 7px) rotate(6deg);
            background: #181614;
            border: 1.5px solid rgba(232, 167, 54, 0.4);
            box-shadow: 0 6px 14px rgba(0, 0, 0, 0.7);
            z-index: 0;
          }

          /* User / People Marker (Circle: 36px x 36px) */
          .user-pin {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 2px solid #ffffff;
            background: #201e1c;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.55);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            z-index: 2;
          }
          .user-pin img { width: 100%; height: 100%; object-fit: cover; }
          .user-avatar-fallback {
            width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
            background: #38332d; color: #feba48; font-size: 14px; font-weight: 800;
          }
          .user-label {
            margin-top: 3px;
            background: rgba(20, 22, 32, 0.92);
            backdrop-filter: blur(8px);
            color: #ffffff;
            font-size: 10px;
            font-weight: 700;
            padding: 1.5px 6px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.25);
            white-space: nowrap;
            max-width: 85px;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* Hangout Marker (58px x 58px) */
          .hangout-pin {
            width: 58px;
            height: 58px;
            border-radius: 16px;
            border: 2.5px solid #10b981;
            background: #201e1c;
            box-shadow: 0 0 18px rgba(16, 185, 129, 0.75);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            z-index: 2;
          }
          .hangout-pin img { width: 100%; height: 100%; object-fit: cover; }
          .hangout-placeholder {
            width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
            background: #064e3b; color: #34d399; font-size: 24px;
          }
          .hangout-label {
            margin-top: 4px;
            background: rgba(20, 22, 32, 0.92);
            backdrop-filter: blur(8px);
            color: #34d399;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 12px;
            border: 1px solid rgba(16, 185, 129, 0.45);
            white-space: nowrap;
            max-width: 110px;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* Event Marker (80px x 52px) */
          .event-pin {
            width: 80px;
            height: 52px;
            border-radius: 12px;
            border: 2.5px solid #e8a736;
            background: #201e1c;
            box-shadow: 0 0 18px rgba(232, 167, 54, 0.7);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            z-index: 2;
          }
          .event-pin img { width: 100%; height: 100%; object-fit: cover; }
          .event-placeholder {
            width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
            background: #5f3f00; color: #feba48; font-size: 22px;
          }
          .event-label {
            margin-top: 4px;
            background: rgba(20, 22, 32, 0.92);
            backdrop-filter: blur(8px);
            color: #feba48;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 12px;
            border: 1px solid rgba(232, 167, 54, 0.45);
            white-space: nowrap;
            max-width: 120px;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* Community Marker (52px x 52px) */
          .community-pin {
            width: 52px;
            height: 52px;
            border-radius: 15px;
            border: 2.5px solid #3b82f6;
            background: #201e1c;
            box-shadow: 0 0 16px rgba(59, 130, 246, 0.7);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            z-index: 2;
          }
          .community-pin img { width: 100%; height: 100%; object-fit: cover; }
          .community-placeholder {
            width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
            background: #1e3a8a; color: #60a5fa; font-size: 22px;
          }
          .community-label {
            margin-top: 4px;
            background: rgba(20, 22, 32, 0.92);
            backdrop-filter: blur(8px);
            color: #60a5fa;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 12px;
            border: 1px solid rgba(59, 130, 246, 0.45);
            white-space: nowrap;
            max-width: 105px;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* Requirement 8c-i: Grayed out element styling for events and hangouts whose end dates/times passed */
          .item-passed {
            filter: grayscale(100%) opacity(0.48) !important;
            border-color: #64748b !important;
            box-shadow: none !important;
          }
          .item-passed-label {
            filter: grayscale(100%) opacity(0.65) !important;
            color: #94a3b8 !important;
            border-color: rgba(148, 163, 184, 0.4) !important;
          }

          /* Active selection glow in expanded state */
          .active-pin {
            border-color: #ffffff !important;
            box-shadow: 0 0 28px #e8a736, 0 0 12px #ffffff, 0 0 45px rgba(232, 167, 54, 0.85) !important;
            outline: 2.5px solid #ffffff !important;
            outline-offset: 1px !important;
            z-index: 9999 !important;
          }

          /* GPS Real Phone Marker */
          .gps-pin-wrap {
            width: 24px;
            height: 24px;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .gps-pin-center {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #3b82f6;
            border: 2.5px solid #ffffff;
            box-shadow: 0 0 8px rgba(59, 130, 246, 0.8);
            z-index: 2;
          }
          .gps-pin-pulse {
            position: absolute;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(59, 130, 246, 0.35);
            animation: gpsPulse 2s infinite;
            z-index: 1;
          }
          @keyframes gpsPulse {
            0% { transform: scale(0.6); opacity: 0.9; }
            70% { transform: scale(1.6); opacity: 0; }
            100% { transform: scale(1.6); opacity: 0; }
          }

          /* Requirement 8c-iii: Special UI for rendering elements of a tapped city (Radar Pulse Scanner) */
          .city-radar-container {
            position: absolute;
            pointer-events: none;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            transform: translate(-50%, -50%);
          }
          .city-radar-ring {
            width: 110px;
            height: 110px;
            border-radius: 50%;
            border: 2px solid #e8a736;
            box-shadow: 0 0 24px rgba(232, 167, 54, 0.9), inset 0 0 16px rgba(232, 167, 54, 0.4);
            animation: radarScan 1.6s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
          }
          .city-radar-core {
            position: absolute;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #ffffff;
            border: 2.5px solid #e8a736;
            box-shadow: 0 0 16px #e8a736;
          }
          .city-radar-label {
            margin-top: 14px;
            background: rgba(15, 23, 42, 0.92);
            border: 1px solid rgba(232, 167, 54, 0.8);
            border-radius: 20px;
            padding: 4px 12px;
            color: #feba48;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            white-space: nowrap;
            animation: radarFade 1.8s forwards;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
          }
          @keyframes radarScan {
            0% { transform: scale(0.2); opacity: 1; }
            100% { transform: scale(2.4); opacity: 0; }
          }
          @keyframes radarFade {
            0% { opacity: 0; transform: translateY(6px); }
            25% { opacity: 1; transform: translateY(0); }
            85% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-4px); }
          }
        </style>
      </head>
      <body>
        <div class="cosmos-bg"><div class="cosmos-stars"></div><div class="cosmos-atmosphere"></div></div>
        <div id="map"></div>

        <script src="https://unpkg.com/maplibre-gl@5.1.0/dist/maplibre-gl.js"></script>
        <script>
          // Initialize MapLibre GL v5 with 3D Globe Projection
          // Initialize MapLibre GL with the exact free OpenFreeMap Liberty style used in MapPickerModal (Light Mode)
          var map = new maplibregl.Map({
            container: 'map',
            style: 'https://tiles.openfreemap.org/styles/liberty',
            center: [${initialCenterLng}, ${initialCenterLat}],
            zoom: Math.max(1.8, ${initialZoom}),
            minZoom: 1.8,
            maxZoom: 19.0,
            pitch: ${initialZoom < 5.0 ? 0 : initialPitch},
            maxPitch: ${initialZoom < 5.0 ? 0 : 60},
            bearing: ${initialBearing},
            projection: { type: ${initialZoom >= 7.0 ? "'mercator'" : "'globe'"} },
            antialias: true
          });

          // Adaptive projection switcher: 3D globe at low zoom (< 7.0), Mercator flat map at high zoom (>= 7.0)
          var currentProjection = ${initialZoom >= 7.0 ? "'mercator'" : "'globe'"};
          function updateAdaptiveProjection() {
            var z = map.getZoom();
            var targetProj = z >= 7.0 ? 'mercator' : 'globe';
            if (currentProjection !== targetProj) {
              currentProjection = targetProj;
              try {
                map.setProjection({ type: targetProj });
              } catch(e) {}
            }
          }
          map.on('zoom', updateAdaptiveProjection);

          // Decremental smooth zoom scale calculation
          function updateZoomScale() {
            var z = map.getZoom();
            var minZ = 1.8;
            var maxZ = 13.0;
            var clampedZ = Math.max(minZ, Math.min(maxZ, z));
            var t = (clampedZ - minZ) / (maxZ - minZ);
            var smoothT = t * t * (3 - 2 * t);
            var scale = 0.44 + (1.0 - 0.44) * smoothT;
            document.documentElement.style.setProperty('--map-zoom-scale', scale.toFixed(3));

            if (z < 10.5) {
              document.body.classList.add('hide-labels');
            } else {
              document.body.classList.remove('hide-labels');
            }

            if (z < 5.0) {
              if (map.getMaxPitch() !== 0) map.setMaxPitch(0);
              if (map.getPitch() !== 0) map.setPitch(0);
            } else {
              if (map.getMaxPitch() !== 60) map.setMaxPitch(60);
            }
          }
          map.on('zoom', updateZoomScale);
          updateZoomScale();

          // Starry background responsive to swiping / parallax
          function updateCosmicParallax() {
            var starEl = document.querySelector('.cosmos-stars');
            if (!starEl) return;
            var center = map.getCenter();
            var bearing = map.getBearing() || 0;
            var pitch = map.getPitch() || 0;
            var shiftX = (center.lng * 2.8 + bearing * 1.2) % 240;
            var shiftY = (center.lat * 2.8 + pitch * 0.8) % 240;
            starEl.style.transform = 'translate3d(' + shiftX + 'px, ' + shiftY + 'px, 0px)';
          }

          var parallaxRaf = null;
          function scheduleCosmicParallax() {
            if (parallaxRaf) return;
            parallaxRaf = requestAnimationFrame(function() {
              parallaxRaf = null;
              updateCosmicParallax();
            });
          }
          map.on('move', scheduleCosmicParallax);
          map.on('rotate', scheduleCosmicParallax);
          map.on('pitch', scheduleCosmicParallax);

          map.on('error', function(err) {
            // Silently absorb individual tile network drops so map canvas never halts
          });

          // Style load: Plaster the exact working light mode Liberty setup from MapPickerModal,
          // preserving all natural places, colors, vegetation, real POIs, crisp borders and English labels
          map.on('style.load', function() {
            var z = map.getZoom();
            var targetProj = z >= 7.0 ? 'mercator' : 'globe';
            currentProjection = targetProj;
            try {
              map.setProjection({ type: targetProj });
            } catch(e) {}

            // Country Borders & Boundary Presentation (from MapPickerModal):
            // 1. Hide state, county, maritime, and sub-national clutter
            // 2. Make country borders clearly visible, crisp, solid lines
            try {
              var allStyleLayers = map.getStyle().layers || [];
              allStyleLayers.forEach(function(l) {
                if (!l.id) return;
                var isBoundary = l.id.indexOf('boundary') !== -1 || l.id.indexOf('border') !== -1;
                if (!isBoundary) return;

                var isCountryBorder = l.id === 'boundary_country' || 
                                     l.id === 'boundary_country_z0-4' || 
                                     (l.id.indexOf('country') !== -1 && l.type === 'line');

                if (isCountryBorder) {
                  try {
                    map.setLayoutProperty(l.id, 'visibility', 'visible');
                  } catch(e) {}
                  try {
                    map.setPaintProperty(l.id, 'line-dasharray', null);
                  } catch(e) {
                    try { map.setPaintProperty(l.id, 'line-dasharray', [1, 0]); } catch(e2) {}
                  }
                  try {
                    map.setPaintProperty(l.id, 'line-color', 'rgba(30, 41, 59, 0.80)');
                  } catch(e) {}
                  try {
                    var w = l.id.indexOf('z0-4') !== -1 ? 1.5 : 2.0;
                    map.setPaintProperty(l.id, 'line-width', w);
                  } catch(e) {}
                  try {
                    map.setPaintProperty(l.id, 'line-opacity', 0.95);
                  } catch(e) {}
                } else {
                  try {
                    map.setLayoutProperty(l.id, 'visibility', 'none');
                  } catch(e) {}
                }
              });
            } catch(e) {}

            // Clean progressive English labels without blur/glow
            var labelConfigs = {
              'place_country_major': { minzoom: 0, maxzoom: 6 },
              'place_country_minor': { minzoom: 3.8, maxzoom: 8 },
              'place_country_other': { minzoom: 4.8, maxzoom: 9 },
              'place_state': { minzoom: 4.8, maxzoom: 12 },
              'place_city_large': { minzoom: 5.2, maxzoom: 12 },
              'place_city': { minzoom: 6.8, maxzoom: 14 },
              'place_town': { minzoom: 9.0, maxzoom: 15 },
              'place_village': { minzoom: 11.0, maxzoom: 15 },
              'place_suburb': { minzoom: 12.0, maxzoom: 15 },
              'place_other': { minzoom: 12.5, maxzoom: 15 }
            };

            Object.keys(labelConfigs).forEach(function(layerId) {
              if (map.getLayer(layerId)) {
                var cfg = labelConfigs[layerId];
                try {
                  map.setLayerZoomRange(layerId, cfg.minzoom, cfg.maxzoom);
                  map.setLayoutProperty(layerId, 'text-field', [
                    'coalesce',
                    ['get', 'name:en'],
                    ['get', 'name_en'],
                    ['get', 'name:latin'],
                    ['get', 'name'],
                    ''
                  ]);
                  map.setLayoutProperty(layerId, 'text-padding', 10);
                  map.setLayoutProperty(layerId, 'text-optional', true);
                  map.setPaintProperty(layerId, 'text-halo-blur', 0);
                } catch(e) {}
              }
            });

            // Ensure all other symbol/text layers strictly use English coalesce & zero blur
            try {
              var allLayers = map.getStyle().layers || [];
              allLayers.forEach(function(l) {
                if (!l.id || l.type !== 'symbol') return;
                try {
                  map.setLayoutProperty(l.id, 'text-field', [
                    'coalesce',
                    ['get', 'name:en'],
                    ['get', 'name_en'],
                    ['get', 'name:latin'],
                    ['get', 'name'],
                    ''
                  ]);
                  map.setPaintProperty(l.id, 'text-halo-blur', 0);
                } catch(e) {}
              });
            } catch(e) {}

            // 3D extruded buildings (at zoom >= 15.0)
            try {
              if (!map.getLayer('3d-buildings') && map.getSource('openmaptiles')) {
                map.addLayer({
                  id: '3d-buildings',
                  source: 'openmaptiles',
                  'source-layer': 'building',
                  type: 'fill-extrusion',
                  minzoom: 15.0,
                  maxzoom: 22,
                  paint: {
                    'fill-extrusion-color': '#cbd5e1',
                    'fill-extrusion-height': [
                      'interpolate', ['linear'], ['zoom'],
                      15.0, 0,
                      15.8, ['case', ['has', 'render_height'], ['get', 'render_height'], 14]
                    ],
                    'fill-extrusion-opacity': 0.75
                  }
                });
              }
            } catch(e) {}

            if (currentPayload) {
              window.renderElements(currentPayload.items, currentPayload.selectedCityNames);
            }
            if (window.pendingFocus) {
              var pf = window.pendingFocus;
              window.pendingFocus = null;
              window.focusLocation(pf.lat, pf.lng, pf.zoom, pf.targetItemId);
            }
          });

          // Reset to 3D Globe
          window.resetToGlobe = function() {
            collapseExpanded();
            try {
              map.setProjection({ type: 'globe' });
            } catch(e) {}
            map.flyTo({
              center: [20, 20],
              zoom: 2.3,
              pitch: 0,
              bearing: 0,
              speed: 0.8,
              curve: 1,
              essential: true
            });
          };

          window.map = map;
          var currentPayload = null;
          var currentSelectedCities = [];
          var activeItemMarkers = [];
          var expandedMarkers = [];
          var currentlyHiddenMarker = null;
          var currentlyExpandedClusterKey = null;
          var userGpsMarker = null;
          var lastActionTime = 0;
          var isProgrammaticFlight = false;
          window.pendingFocus = null;

          // User Real Phone GPS Marker
          window.setUserGpsMarker = function(lat, lng) {
            if (userGpsMarker) {
              userGpsMarker.setLngLat([lng, lat]);
            } else {
              var el = document.createElement('div');
              el.className = 'gps-pin-wrap';
              el.innerHTML = '<div class="gps-pin-pulse"></div><div class="gps-pin-center"></div>';
              userGpsMarker = new maplibregl.Marker({ element: el })
                .setLngLat([lng, lat])
                .addTo(map);
            }
          };

          // Requirement 13: Collapse expanded cluster with smooth card slide back into deck without glitches
          function collapseExpanded(callback, immediate) {
            currentlyExpandedClusterKey = null;

            function restoreParent() {
              if (currentlyHiddenMarker) {
                var el = (currentlyHiddenMarker.getElement && currentlyHiddenMarker.getElement()) || currentlyHiddenMarker._element;
                if (el) {
                  el.style.display = 'block';
                  var inEl = el.querySelector('.marker-inner');
                  if (inEl) {
                    inEl.classList.remove('stacked-return');
                    void inEl.offsetWidth;
                    inEl.classList.add('stacked-return');
                  }
                }
                currentlyHiddenMarker = null;
              }
              if (callback) callback();
            }

            if (!expandedMarkers.length) {
              restoreParent();
              return;
            }

            if (immediate) {
              expandedMarkers.forEach(function(m) { m.remove(); });
              expandedMarkers = [];
              restoreParent();
              return;
            }

            // Animate expanded cards back into the deck smoothly
            expandedMarkers.forEach(function(m) {
              var el = (m.getElement && m.getElement()) || m._element;
              if (el) {
                var inEl = el.querySelector('.marker-inner');
                if (inEl) {
                  inEl.style.animationDelay = '0ms';
                  inEl.classList.remove('card-slide-out');
                  inEl.classList.add('card-slide-in');
                }
              }
            });

            setTimeout(function() {
              expandedMarkers.forEach(function(m) { m.remove(); });
              expandedMarkers = [];
              restoreParent();
            }, 320);
          }

          function highlightPin(pinEl) {
            document.querySelectorAll('.active-pin').forEach(function(p) {
              p.classList.remove('active-pin');
            });
            if (pinEl) {
              pinEl.classList.add('active-pin');
            }
          }

          window.clearHighlight = function() {
            window.pendingFocus = null;
            document.querySelectorAll('.active-pin').forEach(function(p) {
              p.classList.remove('active-pin');
            });
          };

          // Requirement 8c-i: Helper to determine if an event or hangout has ended
          function checkIsPassed(item) {
            if (!item || (item.entityType !== 'event' && item.entityType !== 'hangout')) return false;
            var endStr = item.endsAt || item.ends_at || item.startsAt || item.starts_at;
            if (!endStr) return false;
            var t = new Date(endStr).getTime();
            return !isNaN(t) && t < Date.now();
          }

          // Build clean marker DOM with protruding badge
          function createItemDom(item, isOverlapping, count) {
            var container = document.createElement('div');
            container.className = 'marker-container';

            var inner = document.createElement('div');
            inner.className = 'marker-inner';

            var type = item.entityType;
            var pinClass = '';
            var labelClass = '';
            var contentHtml = '';
            var title = '';
            var isPassed = checkIsPassed(item);

            if (type === 'hangout') {
              pinClass = 'hangout-pin';
              labelClass = 'hangout-label';
              title = item.title || 'Hangout';
              var banner = item.coverImageUrl || item.bannerUrl || item.cover_image_url;
              contentHtml = banner ? '<img src="' + banner + '" />' : '<div class="hangout-placeholder">☕</div>';
            } else if (type === 'event') {
              pinClass = 'event-pin';
              labelClass = 'event-label';
              title = item.title || 'Event';
              var banner = item.coverImageUrl || item.bannerUrl || item.cover_image_url;
              contentHtml = banner ? '<img src="' + banner + '" />' : '<div class="event-placeholder">🎟️</div>';
            } else if (type === 'community') {
              pinClass = 'community-pin';
              labelClass = 'community-label';
              title = item.name || 'Community';
              var pic = item.profilePictureUrl || item.bannerUrl;
              contentHtml = pic ? '<img src="' + pic + '" />' : '<div class="community-placeholder">🌐</div>';
            } else {
              pinClass = 'user-pin';
              labelClass = 'user-label';
              title = item.name || item.username || 'User';
              var initial = (title || 'U').charAt(0).toUpperCase();
              contentHtml = item.profilePictureUrl ? '<img src="' + item.profilePictureUrl + '" />' : '<div class="user-avatar-fallback">' + initial + '</div>';
            }

            var pinWrapHtml = '<div class="pin-wrap' + (isOverlapping && count > 1 ? ' is-stacked' : '') + '">';
            if (isOverlapping && count > 1) {
              if (count >= 3) {
                pinWrapHtml += '<div class="stack-card stack-card-2 ' + pinClass + '-stack"></div>';
              }
              pinWrapHtml += '<div class="stack-card stack-card-1 ' + pinClass + '-stack"></div>';
            }

            var appliedPinClasses = pinClass + (isPassed ? ' item-passed' : '');
            pinWrapHtml += '<div class="' + appliedPinClasses + '">' + contentHtml + '</div>';
            if (isOverlapping && count > 1) {
              pinWrapHtml += '<div class="overlap-badge">✦ ' + count + '</div>';
            }
            pinWrapHtml += '</div>';

            var appliedLabelClasses = labelClass + (isPassed ? ' item-passed-label' : '');
            var labelHtml = '<div class="' + appliedLabelClasses + '">' + title + '</div>';

            inner.innerHTML = pinWrapHtml + labelHtml;
            container.appendChild(inner);

            return {
              container: container,
              inner: inner,
              pin: inner.querySelector('.' + pinClass)
            };
          }

          // Adaptive offsets for card deck fan / exploded stack
          function computeAdaptiveOffsets(count) {
            var offsets = [];
            if (count <= 1) return [{ dx: 0, dy: 0, delay: 0, rot: 0 }];
            if (count === 2) {
              return [
                { dx: -56, dy: 0, delay: 0, rot: -4 },
                { dx: 56, dy: 0, delay: 35, rot: 4 }
              ];
            }
            if (count === 3) {
              var r = 66;
              return [
                { dx: 0, dy: -r, delay: 0, rot: 0 },
                { dx: Math.round(r * 0.866), dy: Math.round(r * 0.5), delay: 35, rot: 6 },
                { dx: Math.round(-r * 0.866), dy: Math.round(r * 0.5), delay: 70, rot: -6 }
              ];
            }
            if (count === 4) {
              var r = 78;
              return [
                { dx: 0, dy: -r, delay: 0, rot: 0 },
                { dx: r, dy: 0, delay: 25, rot: 6 },
                { dx: 0, dy: r, delay: 50, rot: 0 },
                { dx: -r, dy: 0, delay: 75, rot: -6 }
              ];
            }
            var r = 50 + count * 9;
            for (var i = 0; i < count; i++) {
              var angle = (i / count) * 2 * Math.PI - Math.PI / 2;
              var rot = Math.round((angle * 180) / Math.PI / 8);
              offsets.push({
                dx: Math.round(Math.cos(angle) * r),
                dy: Math.round(Math.sin(angle) * r),
                delay: i * 20,
                rot: rot
              });
            }
            return offsets;
          }

          // Requirement 8b: Expand overlapping elements with smooth card deck sliding
          function expandCluster(cluster, markerRef) {
            var vuKey = cluster.lng.toFixed(5) + '_' + cluster.lat.toFixed(5);
            if (currentlyExpandedClusterKey === vuKey && expandedMarkers.length > 0) {
              return;
            }

            // Immediately clear any existing expanded markers
            if (expandedMarkers.length > 0) {
              expandedMarkers.forEach(function(m) { m.remove(); });
              expandedMarkers = [];
            }

            currentlyExpandedClusterKey = vuKey;

            if (markerRef) {
              var el = (markerRef.getElement && markerRef.getElement()) || markerRef._element;
              if (el) el.style.display = 'none';
              currentlyHiddenMarker = markerRef;
            } else {
              for (var i = 0; i < activeItemMarkers.length; i++) {
                var aim = activeItemMarkers[i];
                if (Math.abs(aim.origLng - cluster.lng) < 0.0001 && Math.abs(aim.origLat - cluster.lat) < 0.0001) {
                  var el2 = (aim.marker.getElement && aim.marker.getElement()) || aim.marker._element;
                  if (el2) el2.style.display = 'none';
                  currentlyHiddenMarker = aim.marker;
                  break;
                }
              }
            }

            var items = cluster.items;
            var offsets = computeAdaptiveOffsets(items.length);

            items.forEach(function(item, idx) {
              var off = offsets[idx] || { dx: 0, dy: 0, delay: 0, rot: 0 };
              var itemDom = createItemDom(item, false, 1);

              itemDom.inner.style.setProperty('--target-x', off.dx + 'px');
              itemDom.inner.style.setProperty('--target-y', off.dy + 'px');
              itemDom.inner.style.setProperty('--card-deck-rot', off.rot + 'deg');
              itemDom.inner.style.animationDelay = off.delay + 'ms';
              itemDom.inner.classList.add('card-slide-out');

              itemDom.container.addEventListener('click', function(ev) {
                ev.stopPropagation();
                lastActionTime = Date.now();
                highlightPin(itemDom.pin);
                sendMarkerClick(item.entityType, item);
              });

              itemDom.container.addEventListener('touchend', function(ev) {
                ev.stopPropagation();
                lastActionTime = Date.now();
              });

              var expandedMarker = new maplibregl.Marker({
                element: itemDom.container,
                offset: [0, 0]
              })
                .setLngLat([cluster.lng, cluster.lat])
                .addTo(map);

              expandedMarker._item = item;
              expandedMarker._pin = itemDom.pin;
              expandedMarkers.push(expandedMarker);
            });
          }

          // Continuous Smooth Clustering
          function updateContinuousClustering() {
            if (!activeItemMarkers.length) return;
            var z = map.getZoom();
            var maxZ = 13.5;
            var minZ = 1.5;
            var t = Math.max(0, Math.min(1, (maxZ - z) / (maxZ - minZ)));
            var alpha = t * t * (3 - 2 * t) * 0.94;

            for (var i = 0; i < activeItemMarkers.length; i++) {
              var m = activeItemMarkers[i];
              var targetLng = m.centroidLng + m.scatterLng;
              var targetLat = m.centroidLat + m.scatterLat;
              var curLng = m.origLng + alpha * (targetLng - m.origLng);
              var curLat = m.origLat + alpha * (targetLat - m.origLat);
              m.marker.setLngLat([curLng, curLat]);
            }
          }

          // Check if an item belongs to one of the selected cities
          function itemMatchesSelectedCities(item) {
            if (!currentSelectedCities || !currentSelectedCities.length) return false;
            var lat = item.location && typeof item.location.latitude === 'number' ? item.location.latitude : null;
            var lng = item.location && typeof item.location.longitude === 'number' ? item.location.longitude : null;
            if (lat === null || lng === null) return false;

            var locName = (item.location && item.location.name ? item.location.name : '').toLowerCase();

            for (var i = 0; i < currentSelectedCities.length; i++) {
              var city = currentSelectedCities[i];
              var dLat = Math.abs(lat - city.lat);
              var dLng = Math.abs(lng - city.lng);
              if (dLat < 0.35 && dLng < 0.35) return true;
              if (city.name && locName.indexOf(city.name.toLowerCase()) !== -1) return true;
            }
            return false;
          }

          // Dynamic Marker Rendering with City Scoping
          function renderMarkers() {
            if (!currentPayload) return;
            if (isProgrammaticFlight) return;
            if (!window.pendingFocus) {
              collapseExpanded(null, true);
            }
            activeItemMarkers.forEach(function(m) { m.marker.remove(); });
            activeItemMarkers = [];

            var entityTypes = currentPayload.selectedEntityTypes || ['all'];
            var categories = currentPayload.selectedCategories || ['all'];
            var allItems = [];

            function isEntityActive(type) {
              if (!entityTypes || !entityTypes.length || entityTypes.indexOf('all') !== -1) return true;
              return entityTypes.indexOf(type) !== -1;
            }

            function itemMatchesCategory(item) {
              if (!categories || !categories.length || categories.indexOf('all') !== -1) {
                return true;
              }
              var cat = (item.category || item.categoryName || '').toLowerCase().trim();
              if (!cat) return false;
              return categories.some(function(sc) {
                var norm = sc.toLowerCase().trim();
                return cat === norm ||
                       cat.indexOf(norm) !== -1 ||
                       norm.indexOf(cat) !== -1 ||
                       (norm === 'movies_tv' && (cat.indexOf('movie') !== -1 || cat.indexOf('tv') !== -1)) ||
                       (norm === 'movies' && cat.indexOf('movie') !== -1) ||
                       (norm === 'sports' && cat.indexOf('sport') !== -1) ||
                       (norm === 'music_entertainment' && cat.indexOf('music') !== -1) ||
                       (norm === 'music' && cat.indexOf('music') !== -1) ||
                       (norm === 'gaming' && (cat.indexOf('game') !== -1 || cat.indexOf('gaming') !== -1)) ||
                       (norm === 'technology' && (cat.indexOf('tech') !== -1 || cat.indexOf('computer') !== -1)) ||
                       (norm === 'tech' && cat.indexOf('tech') !== -1) ||
                       (norm === 'arts_creativity' && cat.indexOf('art') !== -1) ||
                       (norm === 'art' && cat.indexOf('art') !== -1) ||
                       (norm === 'health_fitness' && (cat.indexOf('fit') !== -1 || cat.indexOf('health') !== -1)) ||
                       (norm === 'fitness' && cat.indexOf('fit') !== -1) ||
                       (norm === 'outdoor_adventure' && (cat.indexOf('outdoor') !== -1 || cat.indexOf('adventure') !== -1)) ||
                       (norm === 'outdoor' && cat.indexOf('outdoor') !== -1) ||
                       (norm === 'food' && (cat.indexOf('food') !== -1 || cat.indexOf('dine') !== -1 || cat.indexOf('restaurant') !== -1)) ||
                       (norm === 'anime_manga' && (cat.indexOf('anime') !== -1 || cat.indexOf('manga') !== -1)) ||
                       (norm === 'education_study_groups' && (cat.indexOf('edu') !== -1 || cat.indexOf('study') !== -1)) ||
                       (norm === 'books_writing' && (cat.indexOf('book') !== -1 || cat.indexOf('writ') !== -1)) ||
                       (norm === 'social_lifestyle' && (cat.indexOf('social') !== -1 || cat.indexOf('life') !== -1)) ||
                       (norm === 'culture_language' && (cat.indexOf('cultur') !== -1 || cat.indexOf('lang') !== -1)) ||
                       (norm === 'other' && (cat.indexOf('other') !== -1 || cat.indexOf('misc') !== -1));
              });
            }

            function pushIfSelected(item, type) {
              if (item.location && typeof item.location.latitude === 'number' && typeof item.location.longitude === 'number') {
                var wrapped = Object.assign({}, item, { entityType: type });
                var isTargetItem = window.pendingFocus && (
                  String(window.pendingFocus.id) === String(item.id) ||
                  (item.slug && String(window.pendingFocus.id) === String(item.slug)) ||
                  (window.pendingFocus.lat !== null && Math.abs(item.location.latitude - window.pendingFocus.lat) < 0.0005 &&
                   window.pendingFocus.lng !== null && Math.abs(item.location.longitude - window.pendingFocus.lng) < 0.0005)
                );
                // Requirement 8c-ii: Only render elements inside selected cities, unless it is a focused target
                if (isTargetItem || itemMatchesSelectedCities(wrapped)) {
                  allItems.push(wrapped);
                }
              }
            }

            if (isEntityActive('hangouts')) {
              (currentPayload.hangouts || []).forEach(function(h) {
                if (itemMatchesCategory(h)) pushIfSelected(h, 'hangout');
              });
            }
            if (isEntityActive('events')) {
              (currentPayload.events || []).forEach(function(e) {
                if (itemMatchesCategory(e)) pushIfSelected(e, 'event');
              });
            }
            if (isEntityActive('communities')) {
              (currentPayload.communities || []).forEach(function(c) {
                if (itemMatchesCategory(c)) pushIfSelected(c, 'community');
              });
            }
            // Requirement 14: People do NOT have categories. If a specific category filter is active, exclude users completely!
            var hasSpecificCategory = categories && categories.length > 0 && categories.indexOf('all') === -1;
            if (isEntityActive('users') && !hasSpecificCategory) {
              (currentPayload.users || []).forEach(function(u) {
                pushIfSelected(u, 'user');
              });
            }

            // 1. Group items that share the EXACT same location
            var venueUnits = [];
            for (var i = 0; i < allItems.length; i++) {
              var item = allItems[i];
              var lat = item.location.latitude;
              var lng = item.location.longitude;
              var matchedVenue = false;

              for (var v = 0; v < venueUnits.length; v++) {
                var vu = venueUnits[v];
                if (Math.abs(vu.lat - lat) < 0.00004 && Math.abs(vu.lng - lng) < 0.00004) {
                  vu.items.push(item);
                  matchedVenue = true;
                  break;
                }
              }

              if (!matchedVenue) {
                venueUnits.push({
                  lat: lat,
                  lng: lng,
                  items: [item]
                });
              }
            }

            // 2. Group venue units by regional proximity
            var regionalGroups = [];
            for (var i = 0; i < venueUnits.length; i++) {
              var vu = venueUnits[i];
              var placed = false;

              for (var j = 0; j < regionalGroups.length; j++) {
                var g = regionalGroups[j];
                var dLat = Math.abs(g.centerLat - vu.lat);
                var dLng = Math.abs(g.centerLng - vu.lng);
                if (dLat <= 2.2 && dLng <= 2.2) {
                  g.venues.push(vu);
                  g.centerLat = (g.centerLat * (g.venues.length - 1) + vu.lat) / g.venues.length;
                  g.centerLng = (g.centerLng * (g.venues.length - 1) + vu.lng) / g.venues.length;
                  placed = true;
                  break;
                }
              }

              if (!placed) {
                regionalGroups.push({
                  centerLat: vu.lat,
                  centerLng: vu.lng,
                  venues: [vu]
                });
              }
            }

            // 3. Build markers
            regionalGroups.forEach(function(group) {
              var vCount = group.venues.length;
              var cLat = group.centerLat;
              var cLng = group.centerLng;

              group.venues.forEach(function(vu, idx) {
                var scatterLng = 0;
                var scatterLat = 0;

                if (vCount > 1) {
                  var angle = (2 * Math.PI * idx) / vCount - Math.PI / 2;
                  var radius = Math.min(0.024, 0.007 + vCount * 0.0035);
                  scatterLng = Math.cos(angle) * radius;
                  scatterLat = Math.sin(angle) * radius;
                }

                var isOverlapping = vu.items.length > 1;
                var count = vu.items.length;
                var topItem = vu.items[0];

                var dom = createItemDom(topItem, isOverlapping, count);

                dom.container.addEventListener('click', function(ev) {
                  ev.stopPropagation();
                  lastActionTime = Date.now();
                  var z = map.getZoom();

                  if (z < 11.0) {
                    map.flyTo({
                      center: [vu.lng, vu.lat],
                      zoom: 14.5,
                      speed: 1.2,
                      curve: 1.4,
                      essential: true
                    });
                  } else {
                    if (isOverlapping) {
                      expandCluster(vu, marker);
                    } else {
                      collapseExpanded();
                      highlightPin(dom.pin);
                      sendMarkerClick(topItem.entityType, topItem);
                    }
                  }
                });

                dom.container.addEventListener('touchend', function(ev) {
                  ev.stopPropagation();
                  lastActionTime = Date.now();
                });

                var marker = new maplibregl.Marker({ element: dom.container })
                  .setLngLat([vu.lng, vu.lat])
                  .addTo(map);

                var vuKey = vu.lng.toFixed(5) + '_' + vu.lat.toFixed(5);
                if (currentlyExpandedClusterKey && currentlyExpandedClusterKey === vuKey) {
                  var mEl = (marker.getElement && marker.getElement()) || marker._element;
                  if (mEl) mEl.style.display = 'none';
                  currentlyHiddenMarker = marker;
                }

                activeItemMarkers.push({
                  venueUnit: vu,
                  item: topItem,
                  marker: marker,
                  dom: dom,
                  origLng: vu.lng,
                  origLat: vu.lat,
                  centroidLng: cLng,
                  centroidLat: cLat,
                  scatterLng: scatterLng,
                  scatterLat: scatterLat
                });
              });
            });

            updateZoomScale();
            updateContinuousClustering();

            if (window.pendingFocus) {
              performFocusEntity(
                window.pendingFocus.id,
                window.pendingFocus.type,
                window.pendingFocus.lat,
                window.pendingFocus.lng
              );
            }
          }

          window.updateMapMarkers = function(payload) {
            currentPayload = payload;
            if (payload.selectedCities) {
              currentSelectedCities = payload.selectedCities;
            }
            if (isProgrammaticFlight) return;
            renderMarkers();
          };

          window.syncSelectedCities = function(cities) {
            currentSelectedCities = cities;
            if (isProgrammaticFlight) return;
            renderMarkers();
          };

          // Requirement 8a: Direct expansion and solid selection glow without flickering
          function performFocusEntity(targetId, targetType, targetLat, targetLng) {
            if (!activeItemMarkers.length) return false;
            var tId = targetId ? String(targetId) : '';
            var tLat = typeof targetLat === 'number' ? targetLat : null;
            var tLng = typeof targetLng === 'number' ? targetLng : null;

            var foundEntry = null;
            var matchIdx = -1;

            if (tId) {
              for (var i = 0; i < activeItemMarkers.length; i++) {
                var entry = activeItemMarkers[i];
                var vu = entry.venueUnit;
                for (var k = 0; k < vu.items.length; k++) {
                  if (String(vu.items[k].id) === tId || (vu.items[k].slug && String(vu.items[k].slug) === tId)) {
                    foundEntry = entry;
                    matchIdx = k;
                    break;
                  }
                }
                if (foundEntry) break;
              }
            }

            if (!foundEntry && tLat !== null && tLng !== null) {
              for (var j = 0; j < activeItemMarkers.length; j++) {
                var entry2 = activeItemMarkers[j];
                var vu2 = entry2.venueUnit;
                if (Math.abs(vu2.lat - tLat) < 0.0001 && Math.abs(vu2.lng - tLng) < 0.0001) {
                  foundEntry = entry2;
                  matchIdx = 0;
                  break;
                }
              }
            }

            if (!foundEntry) return false;

            var targetVu = foundEntry.venueUnit;
            var markerRef = foundEntry.marker;
            var flightCompleted = false;

            function doExpandAndHighlight() {
              if (flightCompleted) return;
              flightCompleted = true;
              isProgrammaticFlight = false;
              window.pendingFocus = null;

              if (targetVu.items.length > 1) {
                expandCluster(targetVu, markerRef);
                setTimeout(function() {
                  var targetPin = null;
                  if (matchIdx >= 0 && expandedMarkers[matchIdx] && expandedMarkers[matchIdx]._pin) {
                    targetPin = expandedMarkers[matchIdx]._pin;
                  } else if (expandedMarkers.length > 0 && expandedMarkers[0]._pin) {
                    targetPin = expandedMarkers[0]._pin;
                  }
                  if (targetPin) {
                    highlightPin(targetPin);
                  }
                }, 80);
              } else {
                collapseExpanded(null, true);
                highlightPin(foundEntry.dom.pin);
              }
            }

            var center = map.getCenter();
            var dist = Math.abs(center.lng - targetVu.lng) + Math.abs(center.lat - targetVu.lat);
            var zoom = map.getZoom();

            if (zoom >= 14 && dist < 0.005) {
              doExpandAndHighlight();
            } else {
              isProgrammaticFlight = true;
              var moveTimeout = null;

              function onMoveEnd() {
                if (moveTimeout) clearTimeout(moveTimeout);
                setTimeout(function() {
                  doExpandAndHighlight();
                }, 60);
              }

              map.once('moveend', onMoveEnd);

              map.flyTo({
                center: [targetVu.lng, targetVu.lat],
                zoom: 15.5,
                pitch: 35,
                speed: 1.3,
                curve: 1.4,
                essential: true
              });

              moveTimeout = setTimeout(function() {
                if (!flightCompleted) {
                  map.off('moveend', onMoveEnd);
                  doExpandAndHighlight();
                }
              }, 2200);
            }

            return true;
          }

          window.focusEntityOnMap = function(targetId, targetType, targetLat, targetLng) {
            window.pendingFocus = {
              id: targetId ? String(targetId) : '',
              type: targetType || '',
              lat: typeof targetLat === 'number' ? targetLat : null,
              lng: typeof targetLng === 'number' ? targetLng : null
            };
            performFocusEntity(targetId, targetType, targetLat, targetLng);
          };

          // Requirement 8c-iii: Progressive Zoom & Empty Space Tapping Logic
          map.on('click', function(e) {
            if (Date.now() - lastActionTime < 450) return;
            if (isProgrammaticFlight) return;

            // 1. Invalidate ocean taps completely
            var features = map.queryRenderedFeatures(e.point);
            var isWater = features.some(function(f) {
              return f.layer && (
                f.layer.id.indexOf('water') !== -1 ||
                f.layer.id.indexOf('ocean') !== -1 ||
                f.layer['source-layer'] === 'water'
              );
            });
            if (isWater) {
              return; // Avoid taking tap inputs on water bodies / oceans
            }

            window.pendingFocus = null;
            collapseExpanded();
            window.clearHighlight();

            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'map_click' }));
            }

            var z = map.getZoom();

            // Progressive Zoom on Land:
            if (z < 4.0) {
              // Globe / Continent level -> Zoom to Country level
              map.flyTo({ center: [e.lngLat.lng, e.lngLat.lat], zoom: 5.8, essential: true });
            } else if (z < 7.0) {
              // Country level -> Zoom to Region / State level
              map.flyTo({ center: [e.lngLat.lng, e.lngLat.lat], zoom: 8.8, essential: true });
            } else if (z < 10.5) {
              // Region / State level -> Zoom to City level
              map.flyTo({ center: [e.lngLat.lng, e.lngLat.lat], zoom: 12.8, essential: true });
            } else {
              // City level (z >= 10.5): Check city empty space tap
              var cityName = '';
              var cityFeature = features.find(function(f) {
                return f.layer && f.layer.id && (
                  f.layer.id.indexOf('place_city') !== -1 ||
                  f.layer.id.indexOf('place_town') !== -1 ||
                  f.layer.id.indexOf('place_suburb') !== -1
                );
              });
              if (cityFeature && cityFeature.properties) {
                cityName = cityFeature.properties['name:en'] || cityFeature.properties.name || '';
              }
              if (!cityName) {
                var nearbyPlaces = map.queryRenderedFeatures([
                  [e.point.x - 120, e.point.y - 120],
                  [e.point.x + 120, e.point.y + 120]
                ], {
                  layers: ['place_city_large', 'place_city', 'place_town', 'place_suburb']
                });
                if (nearbyPlaces.length && nearbyPlaces[0].properties) {
                  cityName = nearbyPlaces[0].properties['name:en'] || nearbyPlaces[0].properties.name || '';
                }
              }
              if (!cityName) {
                cityName = 'Selected Area';
              }

              // Check if already selected:
              var isAlreadySelected = (currentSelectedCities || []).some(function(c) {
                var cName = (c.name || '').toLowerCase();
                var hitName = cityName.toLowerCase();
                if (cName === hitName) return true;
                var dLat = Math.abs(c.lat - e.lngLat.lat);
                var dLng = Math.abs(c.lng - e.lngLat.lng);
                return dLat < 0.35 && dLng < 0.35;
              });

              if (isAlreadySelected) {
                // Tapping in empty space inside already selected city should do nothing
                return;
              }

              // Trigger special UI: Radar Scanner Animation at tap coordinate!
              var radarEl = document.createElement('div');
              radarEl.className = 'city-radar-container';
              radarEl.innerHTML = '<div class="city-radar-ring"></div><div class="city-radar-core"></div><div class="city-radar-label">Scanning & Rendering ' + cityName + '...</div>';

              var radarMarker = new maplibregl.Marker({ element: radarEl })
                .setLngLat([e.lngLat.lng, e.lngLat.lat])
                .addTo(map);

              setTimeout(function() {
                radarMarker.remove();
              }, 1800);

              // Notify React Native that this city was selected
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'city_selected',
                  city: cityName,
                  lat: e.lngLat.lat,
                  lng: e.lngLat.lng
                }));
              }
            }
          });

          function sendMarkerClick(entityType, data) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'marker_click',
                entityType: entityType,
                data: data
              }));
            }
          }

          // Clustering only depends on zoom level; move-based clustering removed to ensure smooth 60fps dragging
          map.on('moveend', function() {
            if (isProgrammaticFlight) return;
            var c = map.getCenter();
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'camera_move',
                center: [c.lng, c.lat],
                zoom: map.getZoom(),
                pitch: map.getPitch(),
                bearing: map.getBearing()
              }));
            }
          });
          map.on('zoom', function() {
            updateZoomScale();
            updateContinuousClustering();
          });
          map.on('zoomstart', function() {
            if (isProgrammaticFlight || window.pendingFocus) return;
            collapseExpanded();
          });

          map.on('load', function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'map_ready' }));
            }
          });
        </script>
      </body>
    </html>
    `;
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* 3D Map Viewport */}
      <WebView
        ref={webViewRef}
        source={{ html: mapHtml }}
        style={styles.webView}
        onMessage={onWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onLoadEnd={() => sendDataToWebView(mapData, selectedEntityTypes, selectedCategories, selectedCities)}
      />

      {/* Floating Header Controls with App's Yellow Accent & Dark Brown Theme */}
      <View style={[styles.headerOverlay, { top: Math.max(insets.top, 16) }]}>
        <Text style={styles.nexusMapTitle}>Nexus Map</Text>

        {/* Action Controls (Globe, GPS Current Location, Refresh) */}
        <View style={styles.controlsRow}>
          {/* Globe Zoom-Out Button */}
          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: darkBrownBg, borderColor: yellowAccent + '50' }]}
            onPress={handleResetGlobe}
            activeOpacity={0.8}
          >
            <MaterialIcons name="public" size={20} color={yellowAccent} />
          </TouchableOpacity>

          {/* Current Location GPS Button */}
          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: darkBrownBg, borderColor: yellowAccent + '50' }]}
            onPress={handleFlyToGpsLocation}
            activeOpacity={0.8}
            disabled={locatingGps || isLoadingLocation}
          >
            {locatingGps || isLoadingLocation ? (
              <ActivityIndicator size="small" color={yellowAccent} />
            ) : (
              <MaterialIcons name="my-location" size={20} color={yellowAccent} />
            )}
          </TouchableOpacity>

          {/* Refresh Map Data Button: updates locations in place without moving camera */}
          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: darkBrownBg, borderColor: yellowAccent + '50' }]}
            onPress={handleRefreshDataInPlace}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color={yellowAccent} />
            ) : (
              <MaterialIcons name="refresh" size={20} color={yellowAccent} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Horizontally Scrollable Multi-Select Entity Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScrollContent}
        style={[styles.filterScrollView, { top: Math.max(insets.top, 16) + 52 }]}
      >
        {/* 1. All */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: darkBrownBg, borderColor: darkBrownBorder },
            (selectedEntityTypes.includes('all') || selectedEntityTypes.length === 0) && [
              styles.filterChipActive,
              { backgroundColor: yellowAccent, borderColor: '#feba48' },
            ],
          ]}
          onPress={() => handleToggleEntityType('all')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterText,
              { color: isDark ? '#d5c4b4' : '#695c50' },
              (selectedEntityTypes.includes('all') || selectedEntityTypes.length === 0) && [
                styles.filterTextActive,
                { color: darkBrown },
              ],
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {/* 2. Hangouts (Item 12: icon color yellowAccent / darkBrown) */}
        {(() => {
          const isActive = selectedEntityTypes.includes('hangouts') && !selectedEntityTypes.includes('all');
          return (
            <TouchableOpacity
              style={[
                styles.filterChip,
                { backgroundColor: darkBrownBg, borderColor: darkBrownBorder },
                isActive && [styles.filterChipActive, { backgroundColor: yellowAccent, borderColor: '#feba48' }],
              ]}
              onPress={() => handleToggleEntityType('hangouts')}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="local-cafe"
                size={14}
                color={isActive ? darkBrown : yellowAccent}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.filterText,
                  { color: isDark ? '#d5c4b4' : '#695c50' },
                  isActive && [styles.filterTextActive, { color: darkBrown }],
                ]}
              >
                Hangouts
              </Text>
            </TouchableOpacity>
          );
        })()}

        {/* 3. Events (Item 12: icon color yellowAccent / darkBrown) */}
        {(() => {
          const isActive = selectedEntityTypes.includes('events') && !selectedEntityTypes.includes('all');
          return (
            <TouchableOpacity
              style={[
                styles.filterChip,
                { backgroundColor: darkBrownBg, borderColor: darkBrownBorder },
                isActive && [styles.filterChipActive, { backgroundColor: yellowAccent, borderColor: '#feba48' }],
              ]}
              onPress={() => handleToggleEntityType('events')}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="event"
                size={14}
                color={isActive ? darkBrown : yellowAccent}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.filterText,
                  { color: isDark ? '#d5c4b4' : '#695c50' },
                  isActive && [styles.filterTextActive, { color: darkBrown }],
                ]}
              >
                Events
              </Text>
            </TouchableOpacity>
          );
        })()}

        {/* 4. Communities (Item 12: icon color yellowAccent / darkBrown) */}
        {(() => {
          const isActive = selectedEntityTypes.includes('communities') && !selectedEntityTypes.includes('all');
          return (
            <TouchableOpacity
              style={[
                styles.filterChip,
                { backgroundColor: darkBrownBg, borderColor: darkBrownBorder },
                isActive && [styles.filterChipActive, { backgroundColor: yellowAccent, borderColor: '#feba48' }],
              ]}
              onPress={() => handleToggleEntityType('communities')}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="groups"
                size={14}
                color={isActive ? darkBrown : yellowAccent}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.filterText,
                  { color: isDark ? '#d5c4b4' : '#695c50' },
                  isActive && [styles.filterTextActive, { color: darkBrown }],
                ]}
              >
                Communities
              </Text>
            </TouchableOpacity>
          );
        })()}

        {/* 5. People / Users (Item 12: icon color yellowAccent / darkBrown; Item 14: Dimmed when category filter active) */}
        {(() => {
          const hasSpecificCategory = selectedCategories.length > 0 && !selectedCategories.includes('all');
          const isActive = selectedEntityTypes.includes('users') && !selectedEntityTypes.includes('all');
          return (
            <TouchableOpacity
              style={[
                styles.filterChip,
                { backgroundColor: darkBrownBg, borderColor: darkBrownBorder, opacity: hasSpecificCategory ? 0.45 : 1 },
                isActive && !hasSpecificCategory && [styles.filterChipActive, { backgroundColor: yellowAccent, borderColor: '#feba48' }],
              ]}
              onPress={() => {
                if (hasSpecificCategory) {
                  // Tapping People resets specific category filter since people do not have categories
                  setSelectedCategories(['all']);
                  handleToggleEntityType('users');
                } else {
                  handleToggleEntityType('users');
                }
              }}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="person"
                size={14}
                color={isActive && !hasSpecificCategory ? darkBrown : yellowAccent}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.filterText,
                  { color: isDark ? '#d5c4b4' : '#695c50' },
                  isActive && !hasSpecificCategory && [styles.filterTextActive, { color: darkBrown }],
                ]}
              >
                People
              </Text>
            </TouchableOpacity>
          );
        })()}
      </ScrollView>

      {/* Requirement 14 & 1h: Category Filter Stack & Horizontal Category Text Pills */}
      <View
        style={[
          styles.categoryStackWrapper,
          {
            top: Math.max(insets.top, 16) + 104,
            left: Spacing.md,
            right: Spacing.md,
            flexDirection: 'row',
            alignItems: 'flex-start',
            pointerEvents: 'box-none',
          },
        ]}
      >
        {/* Left: Unified Smooth Sliding Category Card Deck */}
        <Animated.View
          style={[
            styles.categoryDeckBox,
            {
              height: categoryStackAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [58, Math.min(320, (CATEGORY_FILTER_ITEMS.length - 1) * 44 + 38 + 44)],
                extrapolate: 'clamp',
              }),
            },
          ]}
        >
          {/* Special capsule background for exploded state only — invisible in collapsed overlap state */}
          <Animated.View
            style={[
              styles.categoryDeckBg,
              {
                backgroundColor: 'rgba(32, 28, 24, 0.95)',
                borderColor: yellowAccent + '70',
                opacity: categoryStackAnim.interpolate({
                  inputRange: [0.15, 1],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
              },
            ]}
            pointerEvents="none"
          />

          {/* Collapsed tap overlay: when collapsed, tap to expand */}
          {!isCategoryStackExpanded && (
            <TouchableOpacity
              style={[StyleSheet.absoluteFill, { zIndex: 50 }]}
              onPress={handleExpandCategories}
              activeOpacity={0.85}
            />
          )}

          <ScrollView
            ref={categoryScrollRef}
            showsVerticalScrollIndicator={false}
            scrollEnabled={isCategoryStackExpanded}
            style={styles.categoryScrollList}
            contentContainerStyle={[
              styles.categoryScrollContent,
              {
                minHeight: isCategoryStackExpanded ? (CATEGORY_FILTER_ITEMS.length - 1) * 44 + 38 + 42 : 58,
                paddingBottom: isCategoryStackExpanded ? 42 : 0,
              },
            ]}
          >
            {CATEGORY_FILTER_ITEMS.map((item, idx) => {
              const isSelected = selectedCategories.includes(item.id) || selectedCategories.includes(item.name);
              const reverseIdx = Math.min(3, idx);
              const stackedTop = reverseIdx * 4;
              const itemTop = categoryStackAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [stackedTop, idx * 44],
                extrapolate: 'clamp',
              });
              const itemScale = categoryStackAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [idx === 0 ? 1 : Math.max(0.82, 1 - idx * 0.05), 1],
                extrapolate: 'clamp',
              });
              const itemOpacity = idx < 4
                ? 1
                : categoryStackAnim.interpolate({
                    inputRange: [0, 0.3, 1],
                    outputRange: [0, 0.4, 1],
                    extrapolate: 'clamp',
                  });
              const zIndex = idx === 0 ? 25 : (15 - idx);

              return (
                <Animated.View
                  key={item.id}
                  style={[
                    styles.categoryDeckItemWrap,
                    {
                      top: itemTop,
                      transform: [{ scale: itemScale }],
                      opacity: itemOpacity,
                      zIndex,
                    },
                  ]}
                  pointerEvents={isCategoryStackExpanded ? 'auto' : 'none'}
                >
                  <TouchableOpacity
                    style={[
                      styles.categoryItemCircle,
                      isSelected
                        ? [styles.categoryItemActive, { backgroundColor: yellowAccent, borderColor: '#feba48' }]
                        : [styles.categoryItemInactive, { backgroundColor: darkBrownBg, borderColor: isDark ? '#3d3835' : '#e5d5c3' }],
                    ]}
                    onPress={() => handleToggleCategory(item.id)}
                    activeOpacity={0.8}
                  >
                    {item.iconLibrary === 'MaterialCommunityIcons' ? (
                      <MaterialCommunityIcons
                        name={item.icon as any}
                        size={18}
                        color={isSelected ? darkBrown : (isDark ? yellowAccent : '#92400e')}
                      />
                    ) : (
                      <MaterialIcons
                        name={item.icon as any}
                        size={18}
                        color={isSelected ? darkBrown : (isDark ? yellowAccent : '#92400e')}
                      />
                    )}
                  </TouchableOpacity>

                  {/* Badge count on Card 0 when collapsed */}
                  {idx === 0 && selectedCategories.length > 0 && !selectedCategories.includes('all') && (
                    <Animated.View
                      style={[
                        styles.categoryStackBadge,
                        {
                          opacity: categoryStackAnim.interpolate({
                            inputRange: [0, 0.3],
                            outputRange: [1, 0],
                          }),
                        },
                      ]}
                      pointerEvents="none"
                    >
                      <Text style={styles.categoryStackBadgeText}>{selectedCategories.length}</Text>
                    </Animated.View>
                  )}
                </Animated.View>
              );
            })}
          </ScrollView>

          {/* Bottom Pull Tab Arrow: Only visible in exploded state to collapse back to overlap state */}
          {isCategoryStackExpanded && (
            <Animated.View
              style={[
                styles.categoryPullTabBottomWrap,
                {
                  opacity: categoryStackAnim.interpolate({
                    inputRange: [0.5, 1],
                    outputRange: [0, 1],
                    extrapolate: 'clamp',
                  }),
                  transform: [
                    {
                      scale: categoryStackAnim.interpolate({
                        inputRange: [0.5, 1],
                        outputRange: [0.5, 1],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
              pointerEvents="auto"
            >
              <TouchableOpacity
                style={[styles.categoryActionCircle, styles.categoryPullTabBottom, { backgroundColor: darkBrownBg, borderColor: yellowAccent + '60' }]}
                onPress={handleCollapseCategories}
                activeOpacity={0.8}
              >
                <MaterialIcons name="keyboard-arrow-up" size={20} color={yellowAccent} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>

        {/* Right: "Categories" text pill or horizontally stacking selected categories pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categorySelectedPillsScroll}
          style={styles.categorySelectedPillsWrap}
        >
          {activeCategoriesList.length === 0 ? (
            <View style={[
              styles.categoryLabelPill,
              !isDark && { backgroundColor: '#ffffff', borderColor: yellowAccent }
            ]}>
              <MaterialIcons name="category" size={13} color={isDark ? yellowAccent : '#92400e'} style={{ marginRight: 4 }} />
              <Text style={[styles.categoryLabelPillText, !isDark && { color: '#92400e' }]}>Categories</Text>
            </View>
          ) : (
            activeCategoriesList.map((catItem) => (
              <View key={catItem.id} style={styles.categoryActivePill}>
                {catItem.iconLibrary === 'MaterialCommunityIcons' ? (
                  <MaterialCommunityIcons name={catItem.icon as any} size={13} color={darkBrown} style={{ marginRight: 4 }} />
                ) : (
                  <MaterialIcons name={catItem.icon as any} size={13} color={darkBrown} style={{ marginRight: 4 }} />
                )}
                <Text style={styles.categoryActivePillText}>{catItem.label}</Text>
                <TouchableOpacity
                  onPress={() => handleToggleCategory(catItem.id)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={styles.categoryActivePillClose}
                >
                  <MaterialIcons name="close" size={12} color={darkBrown} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* Requirement 14 & 1g: Horizontally Scrollable City Pills Bar positioned a teeny tiny amount higher above navigation bar and teeny tiny amount to the left */}
      {selectedCities.length > 0 && (
        <Animated.View
          style={[
            styles.cityPillsWrapper,
            {
              bottom: Math.max(insets.bottom, 12) + 66,
              transform: [{ translateY: cityPillsSlideAnim }],
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cityPillsContent}
          >
            {selectedCities.map((city) => (
              <View
                key={city.id}
                style={[
                  styles.cityPill,
                  city.isCurrent ? styles.cityPillCurrent : styles.cityPillNormal,
                  !isDark && (city.isCurrent ? { backgroundColor: '#fffbeb', borderColor: yellowAccent } : { backgroundColor: '#ffffff', borderColor: '#cbd5e1' })
                ]}
              >
                <MaterialIcons
                  name={city.isCurrent ? 'my-location' : 'location-city'}
                  size={14}
                  color={city.isCurrent ? (isDark ? '#feba48' : '#92400e') : (isDark ? '#e2e8f0' : '#475569')}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.cityPillText,
                    city.isCurrent ? styles.cityPillTextCurrent : styles.cityPillTextNormal,
                    !isDark && (city.isCurrent ? { color: '#92400e' } : { color: '#334155' })
                  ]}
                  numberOfLines={1}
                >
                  {city.isCurrent ? `Current: ${city.name}` : city.name}
                </Text>
                <TouchableOpacity
                  style={[styles.cityPillCloseBtn, !isDark && { backgroundColor: 'rgba(0, 0, 0, 0.08)' }]}
                  onPress={() => handleRemoveCity(city.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="close" size={13} color={city.isCurrent ? (isDark ? '#feba48' : '#92400e') : (isDark ? '#94a3b8' : '#64748b')} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Bottom Selected Entity Preview Card */}
      {selectedEntity && (
        <Animated.View
          style={[
            styles.bottomCard,
            {
              backgroundColor: isDark ? '#1a1816' : '#ffffff',
              borderColor: yellowAccent + '70',
              transform: [{ translateY: cardSlideAnim }],
              bottom: Math.max(insets.bottom, 12) + 66,
            },
          ]}
        >
          {/* Close button */}
          <TouchableOpacity style={styles.cardCloseBtn} onPress={closeSelectedCard}>
            <MaterialIcons name="close" size={18} color={colors.onSurface} />
          </TouchableOpacity>

          <View style={styles.cardMainRow}>
            {/* Visual Thumbnail */}
            <View style={styles.entityImageWrap}>
              {selectedEntity.type === 'user' ? (
                selectedEntity.data.profilePictureUrl ? (
                  <Image
                    source={{ uri: selectedEntity.data.profilePictureUrl }}
                    style={styles.entityAvatarCircle}
                  />
                ) : (
                  <View
                    style={[
                      styles.entityAvatarCircle,
                      {
                        backgroundColor: isDark ? '#2a2622' : colors.surfaceContainerHigh,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                    ]}
                  >
                    <MaterialIcons name="person" size={28} color={colors.tertiary} />
                  </View>
                )
              ) : selectedEntity.type === 'community' ? (
                selectedEntity.data.profilePictureUrl || selectedEntity.data.bannerUrl ? (
                  <Image
                    source={{ uri: selectedEntity.data.profilePictureUrl || selectedEntity.data.bannerUrl }}
                    style={styles.entityImageSquare}
                  />
                ) : (
                  <View
                    style={[
                      styles.entityImageSquare,
                      {
                        backgroundColor: isDark ? '#2a2622' : colors.surfaceContainerHigh,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                    ]}
                  >
                    <MaterialIcons name="groups" size={28} color={colors.primary} />
                  </View>
                )
              ) : selectedEntity.type === 'event' ? (
                selectedEntity.data.coverImageUrl ? (
                  <Image
                    source={{ uri: selectedEntity.data.coverImageUrl }}
                    style={styles.entityImageRect}
                  />
                ) : (
                  <View
                    style={[
                      styles.entityImageRect,
                      {
                        backgroundColor: isDark ? '#2a2622' : colors.surfaceContainerHigh,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                    ]}
                  >
                    <MaterialIcons name="event" size={28} color={colors.primary} />
                  </View>
                )
              ) : (
                selectedEntity.data.coverImageUrl ? (
                  <Image
                    source={{ uri: selectedEntity.data.coverImageUrl }}
                    style={styles.entityImageSquare}
                  />
                ) : (
                  <View
                    style={[
                      styles.entityImageSquare,
                      {
                        backgroundColor: isDark ? '#2a2622' : colors.surfaceContainerHigh,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                    ]}
                  >
                    <MaterialIcons name="local-cafe" size={28} color={colors.primary} />
                  </View>
                )
              )}
            </View>

            {/* Info Column */}
            <View style={styles.entityInfoCol}>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.typeBadge,
                    selectedEntity.type === 'user'
                      ? styles.typeBadgeUser
                      : selectedEntity.type === 'hangout'
                      ? styles.typeBadgeHangout
                      : selectedEntity.type === 'event'
                      ? styles.typeBadgeEvent
                      : styles.typeBadgeCommunity,
                  ]}
                >
                  <Text style={styles.typeBadgeText}>
                    {selectedEntity.type === 'user'
                      ? 'Member'
                      : selectedEntity.type === 'hangout'
                      ? 'Hangout'
                      : selectedEntity.type === 'event'
                      ? 'Event'
                      : 'Community'}
                  </Text>
                </View>

                {selectedEntity.type === 'user' && selectedEntity.data.trustScore !== undefined && (
                  <View style={styles.trustScorePill}>
                    <MaterialIcons name="verified" size={12} color="#10b981" style={{ marginRight: 3 }} />
                    <Text style={styles.trustScoreText}>{selectedEntity.data.trustScore}% Trust</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.entityTitle, { color: colors.onSurface }]} numberOfLines={1}>
                {selectedEntity.type === 'user'
                  ? selectedEntity.data.name || selectedEntity.data.username
                  : selectedEntity.type === 'community'
                  ? selectedEntity.data.name
                  : selectedEntity.data.title}
              </Text>

              <View style={styles.locationPillRow}>
                <MaterialIcons name="place" size={13} color={yellowAccent} style={{ marginRight: 3 }} />
                <Text style={[styles.entityLocationText, { color: colors.tertiary }]} numberOfLines={1}>
                  {selectedEntity.data.location?.name ||
                    selectedEntity.data.location?.place_name ||
                    (selectedEntity.type === 'user'
                      ? 'Nearby Member'
                      : selectedEntity.type === 'community'
                      ? `${selectedEntity.data.memberCount || 0} members`
                      : 'Nearby venue')}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: yellowAccent }]}
            onPress={navigateToEntity}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryActionBtnText, { color: darkBrown }]}>
              {selectedEntity.type === 'user'
                ? 'View Profile'
                : selectedEntity.type === 'hangout'
                ? 'Join Hangout'
                : selectedEntity.type === 'event'
                ? 'View Event'
                : 'Enter Community'}
            </Text>
            <MaterialIcons name="chevron-right" size={20} color={darkBrown} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  headerOverlay: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    ...Shadows.md,
  },
  nexusMapTitle: {
    fontFamily: 'DINNextRoundedLTW01',
    fontSize: 34,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  appTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  controlBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    ...Shadows.md,
  },
  filterScrollView: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 99,
  },
  filterScrollContent: {
    paddingHorizontal: Spacing.md,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    ...Shadows.sm,
  },
  filterChipActive: {
    ...Shadows.md,
  },
  filterText: {
    ...Typography.captionMd,
    fontWeight: '700',
  },
  filterTextActive: {
    fontWeight: '800',
  },
  // Vertical Category Stack
  categoryStackWrapper: {
    position: 'absolute',
    zIndex: 96,
  },
  categoryDeckBox: {
    width: 48,
    borderRadius: 24,
    borderWidth: 0,
    alignItems: 'center',
    paddingTop: 5,
    paddingBottom: 0,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  categoryDeckBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 24,
    borderWidth: 1.5,
    ...Shadows.lg,
  },
  categoryDeckItemWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPullTabBottomWrap: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
  },
  categoryStackOverlapBox: {
    width: 44,
    height: 70,
    position: 'relative',
    alignItems: 'center',
  },
  categoryOverlapPill: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  categoryOverlap1: {
    top: 0,
    zIndex: 4,
  },
  categoryOverlap2: {
    top: 8,
    zIndex: 3,
    transform: [{ scale: 0.94 }],
  },
  categoryOverlap3: {
    top: 16,
    zIndex: 2,
    transform: [{ scale: 0.88 }],
  },
  categoryOverlap4: {
    top: 24,
    zIndex: 1,
    transform: [{ scale: 0.82 }],
  },
  categoryStackBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#281800',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#e8a736',
  },
  categoryStackBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#e8a736',
  },
  categoryStackExpandedBox: {
    width: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    paddingVertical: 6,
    ...Shadows.lg,
  },
  categoryActionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  categoryPullTabBottom: {
    marginTop: 0,
    marginBottom: 0,
  },
  categoryScrollList: {
    width: '100%',
    alignSelf: 'stretch',
    flex: 1,
  },
  categoryScrollContent: {
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 0,
  },
  categoryItemCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  categoryItemActive: {
    ...Shadows.md,
  },
  categoryItemInactive: {},
  categorySelectedPillsWrap: {
    marginLeft: 8,
    maxHeight: 38,
    marginTop: 2,
    flex: 1,
  },
  categorySelectedPillsScroll: {
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
  },
  categoryLabelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 10,
    backgroundColor: '#281800',
    borderWidth: 1.5,
    borderColor: '#e8a736',
    ...Shadows.sm,
  },
  categoryLabelPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#e8a736',
    letterSpacing: 0.2,
  },
  categoryActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 9,
    paddingRight: 6,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#e8a736',
    borderWidth: 1.5,
    borderColor: '#feba48',
    ...Shadows.sm,
  },
  categoryActivePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#281800',
    marginRight: 4,
  },
  categoryActivePillClose: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(40, 24, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // City Pills Bar
  cityPillsWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 95,
  },
  cityPillsContent: {
    paddingLeft: 6,
    paddingRight: Spacing.md,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    ...Shadows.sm,
  },
  cityPillCurrent: {
    backgroundColor: '#281800',
    borderColor: '#e8a736',
  },
  cityPillNormal: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  cityPillText: {
    ...Typography.captionSm,
    fontWeight: '700',
    marginRight: 6,
  },
  cityPillTextCurrent: {
    color: '#feba48',
  },
  cityPillTextNormal: {
    color: '#f1f5f9',
  },
  cityPillCloseBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  bottomCard: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1.5,
    zIndex: 1000,
    ...Shadows.lg,
  },
  cardCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  entityImageWrap: {
    position: 'relative',
  },
  entityAvatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  entityImageSquare: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
  },
  entityImageRect: {
    width: 76,
    height: 54,
    borderRadius: BorderRadius.md,
  },
  entityInfoCol: {
    flex: 1,
    gap: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  typeBadgeUser: {
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
  },
  typeBadgeHangout: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  typeBadgeEvent: {
    backgroundColor: 'rgba(232, 167, 54, 0.2)',
  },
  typeBadgeCommunity: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  trustScorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  trustScoreText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
  },
  entityTitle: {
    ...Typography.titleMd,
    fontWeight: '700',
  },
  locationPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  entityLocationText: {
    ...Typography.captionSm,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    height: 44,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  primaryActionBtnText: {
    ...Typography.labelMd,
    fontWeight: '800',
    marginRight: 4,
  },
});
