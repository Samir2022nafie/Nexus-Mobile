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
import { MaterialIcons } from '@expo/vector-icons';
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
let lastExploreCameraState: {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
} | null = null;

export const CATEGORY_FILTER_ITEMS: {
  id: string;
  name: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { id: 'movies_tv', name: 'movies', label: 'Movies', icon: 'movie' },
  { id: 'sports', name: 'sports', label: 'Sports', icon: 'sports-soccer' },
  { id: 'music_entertainment', name: 'music', label: 'Music', icon: 'music-note' },
  { id: 'gaming', name: 'gaming', label: 'Gaming', icon: 'sports-esports' },
  { id: 'technology', name: 'tech', label: 'Tech', icon: 'computer' },
  { id: 'food', name: 'food', label: 'Food', icon: 'restaurant' },
  { id: 'arts_creativity', name: 'art', label: 'Art', icon: 'palette' },
  { id: 'outdoor_adventure', name: 'outdoor', label: 'Outdoor', icon: 'terrain' },
  { id: 'health_fitness', name: 'fitness', label: 'Fitness', icon: 'fitness-center' },
  { id: 'education_study_groups', name: 'education', label: 'Education', icon: 'school' },
  { id: 'books_writing', name: 'books', label: 'Books', icon: 'menu-book' },
  { id: 'anime_manga', name: 'anime', label: 'Anime', icon: 'auto-stories' },
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

  const initialEntityTypes: string[] = (() => {
    const ft = params.focusType ? params.focusType.toLowerCase() : '';
    if (ft === 'hangout' || ft === 'hangouts') return ['hangouts'];
    if (ft === 'event' || ft === 'events') return ['events'];
    if (ft === 'community' || ft === 'communities') return ['communities'];
    if (ft === 'user' || ft === 'users') return ['users'];
    return ['all'];
  })();

  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>(initialEntityTypes);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [isCategoryStackExpanded, setIsCategoryStackExpanded] = useState<boolean>(false);
  const categoryScrollRef = useRef<ScrollView>(null);
  const categoryStackAnim = useRef(new Animated.Value(0)).current;

  const handleExpandCategories = useCallback(() => {
    setIsCategoryStackExpanded(true);
    categoryStackAnim.setValue(0);
    Animated.spring(categoryStackAnim, {
      toValue: 1,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [categoryStackAnim]);

  const handleCollapseCategories = useCallback(() => {
    Animated.timing(categoryStackAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
      useNativeDriver: true,
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

  // Requirement 1: Restore camera position from lastExploreCameraState if available
  const initialCenterLng = hasValidTarget
    ? targetLng
    : lastExploreCameraState
    ? lastExploreCameraState.center[0]
    : userLng;
  const initialCenterLat = hasValidTarget
    ? targetLat
    : lastExploreCameraState
    ? lastExploreCameraState.center[1]
    : userLat;
  const initialZoom = hasValidTarget
    ? 15.5
    : lastExploreCameraState
    ? lastExploreCameraState.zoom
    : 12.8;
  const initialPitch = hasValidTarget
    ? 35
    : lastExploreCameraState
    ? lastExploreCameraState.pitch
    : 0;
  const initialBearing = lastExploreCameraState ? lastExploreCameraState.bearing : 0;

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
        }

        const ft = params.focusType ? params.focusType.toLowerCase() : '';
        const mappedTypes: string[] =
          ft === 'hangout' || ft === 'hangouts'
            ? ['hangouts']
            : ft === 'event' || ft === 'events'
            ? ['events']
            : ft === 'community' || ft === 'communities'
            ? ['communities']
            : ft === 'user' || ft === 'users'
            ? ['users']
            : ['all'];

        setSelectedEntityTypes(mappedTypes);

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
  }, [params.focusLat, params.focusLng, params.focusId, params.focusType, mapReady, mapData, tryOpenPendingCard]);

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
    const js = `if (window.resetToGlobe) { window.resetToGlobe(); } else if (window.map) { window.map.flyTo({ center: [20, 20], zoom: 1.5, pitch: 0, bearing: 0, essential: true }); } true;`;
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
  const mapStyleUrl = 'https://tiles.openfreemap.org/styles/dark';

  // Primary yellow accent & dark brown companion tokens
  const yellowAccent = '#e8a736';
  const darkBrown = '#281800';
  const darkBrownBg = isDark ? '#201e1c' : '#ffffff';
  const darkBrownBorder = isDark ? '#38332d' : '#e5d5c3';

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
            inset: -350px;
            background-image: 
              radial-gradient(2.5px 2.5px at 25px 35px, #ffffff, rgba(0,0,0,0)),
              radial-gradient(3.5px 3.5px at 140px 75px, #ffffff, rgba(255,255,255,0.4) 50%, rgba(0,0,0,0)),
              radial-gradient(2.2px 2.2px at 80px 180px, #fde047, rgba(0,0,0,0)),
              radial-gradient(3px 3px at 280px 130px, #ffffff, rgba(0,0,0,0)),
              radial-gradient(2.5px 2.5px at 220px 290px, #93c5fd, rgba(0,0,0,0)),
              radial-gradient(2px 2px at 45px 260px, #ffffff, rgba(0,0,0,0)),
              radial-gradient(3.2px 3.2px at 320px 40px, #e0f2fe, rgba(0,0,0,0)),
              radial-gradient(2.5px 2.5px at 190px 170px, #ffffff, rgba(0,0,0,0)),
              radial-gradient(2px 2px at 110px 310px, #fed7aa, rgba(0,0,0,0)),
              radial-gradient(3.5px 3.5px at 50px 120px, #ffffff, rgba(255,255,255,0.5) 40%, rgba(0,0,0,0)),
              radial-gradient(2.2px 2.2px at 165px 230px, #93c5fd, rgba(0,0,0,0)),
              radial-gradient(2.5px 2.5px at 310px 250px, #ffffff, rgba(0,0,0,0)),
              radial-gradient(2px 2px at 260px 320px, #fde047, rgba(0,0,0,0)),
              radial-gradient(3px 3px at 340px 180px, #ffffff, rgba(0,0,0,0)),
              radial-gradient(2px 2px at 15px 210px, #bae6fd, rgba(0,0,0,0)),
              radial-gradient(3px 3px at 130px 15px, #ffffff, rgba(0,0,0,0)),
              radial-gradient(2.5px 2.5px at 240px 85px, #ffffff, rgba(0,0,0,0)),
              radial-gradient(2.2px 2.2px at 300px 335px, #fef08a, rgba(0,0,0,0));
            background-repeat: repeat;
            background-size: 350px 350px;
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
          var map = new maplibregl.Map({
            container: 'map',
            style: '${mapStyleUrl}',
            center: [${initialCenterLng}, ${initialCenterLat}],
            zoom: ${initialZoom},
            pitch: ${initialPitch},
            bearing: ${initialBearing},
            projection: { type: 'globe' },
            antialias: true
          });

          // Decremental smooth zoom scale calculation
          function updateZoomScale() {
            var z = map.getZoom();
            var minZ = 1.5;
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
          }

          map.on('zoom', updateZoomScale);
          updateZoomScale();

          // Requirement 1e: Starry background responsive to swiping / parallax like Snapchat
          function updateCosmicParallax() {
            var starEl = document.querySelector('.cosmos-stars');
            if (!starEl) return;
            var center = map.getCenter();
            var bearing = map.getBearing() || 0;
            var pitch = map.getPitch() || 0;
            var shiftX = (center.lng * 2.2 + bearing * 0.9) % 350;
            var shiftY = (center.lat * 2.2 + pitch * 0.6) % 350;
            starEl.style.transform = 'translate3d(' + shiftX + 'px, ' + shiftY + 'px, 0px)';
          }
          map.on('move', updateCosmicParallax);
          map.on('rotate', updateCosmicParallax);
          map.on('pitch', updateCosmicParallax);

          // Style load: Set dark mode globe contrast and distinguish boundaries
          map.on('style.load', function() {
            try {
              map.setProjection({ type: 'globe' });
            } catch(e) {}

            var allStyleLayers = map.getStyle().layers || [];

            // Requirement 1b: Snapchat & Google Maps dark skin (deep navy water, charcoal land, dark emerald parks)
            try {
              if (map.getLayer('water')) {
                map.setPaintProperty('water', 'fill-color', '#0b1426');
              }
              if (map.getLayer('background')) {
                map.setPaintProperty('background', 'background-color', '#161922');
              }
              if (map.getLayer('landuse_park')) {
                map.setPaintProperty('landuse_park', 'fill-color', '#11231c');
              }
              if (map.getLayer('landcover_wood')) {
                map.setPaintProperty('landcover_wood', 'fill-color', '#11231c');
              }
              // Muted roads matching Google Maps / Snapchat UI
              allStyleLayers.forEach(function(lay) {
                if (lay.id && lay.id.indexOf('highway') !== -1 && lay.type === 'line') {
                  try {
                    if (lay.id.indexOf('casing') !== -1) {
                      map.setPaintProperty(lay.id, 'line-color', '#18202e');
                    } else {
                      map.setPaintProperty(lay.id, 'line-color', '#232b3c');
                    }
                  } catch(e){}
                }
              });
            } catch(e) {}

            // Requirement 1b: 3D extruded buildings when zoomed in
            try {
              if (!map.getLayer('3d-buildings') && map.getSource('openmaptiles')) {
                map.addLayer({
                  id: '3d-buildings',
                  source: 'openmaptiles',
                  'source-layer': 'building',
                  type: 'fill-extrusion',
                  minzoom: 14.8,
                  paint: {
                    'fill-extrusion-color': '#1c2333',
                    'fill-extrusion-height': [
                      'interpolate', ['linear'], ['zoom'],
                      14.8, 0,
                      15.5, ['case', ['has', 'render_height'], ['get', 'render_height'], 12]
                    ],
                    'fill-extrusion-opacity': 0.72
                  }
                });
              }
            } catch(e) {}

            // Requirement 1a: Country borders fade in only when zoomed in, soft tone, not plastered on globe
            try {
              allStyleLayers.forEach(function(l) {
                if (!l.id) return;
                var isBoundary = l.id.indexOf('boundary') !== -1 || l.id.indexOf('border') !== -1 || l.id.indexOf('admin') !== -1;
                if (!isBoundary) return;

                var isCountry = l.id === 'boundary_country' || 
                               l.id === 'boundary_country_z0-4' || 
                               l.id === 'boundary_country_z5-' ||
                               (l.id.indexOf('country') !== -1 && l.type === 'line');

                var isState = l.id === 'boundary_state' || 
                             l.id === 'boundary_state_z0-4' || 
                             l.id.indexOf('province') !== -1 ||
                             (l.id.indexOf('state') !== -1 && l.type === 'line');

                var isCity = l.id === 'boundary_city' || 
                            l.id === 'boundary_county' || 
                            l.id === 'boundary_district' ||
                            l.id.indexOf('county') !== -1 ||
                            l.id.indexOf('admin_level_6') !== -1 ||
                            l.id.indexOf('admin_level_8') !== -1 ||
                            (l.id.indexOf('admin') !== -1 && l.type === 'line' && !isCountry && !isState);

                if (isCountry) {
                  // Requirement 1a: Country: Soft white-blue line, visible ONLY when zoomed in enough (fade in zoom 3.2+)
                  try {
                    map.setLayoutProperty(l.id, 'visibility', 'visible');
                    map.setPaintProperty(l.id, 'line-dasharray', null);
                    map.setPaintProperty(l.id, 'line-color', 'rgba(255, 255, 255, 0.65)');
                    map.setPaintProperty(l.id, 'line-width', 1.2);
                    map.setPaintProperty(l.id, 'line-opacity', [
                      'interpolate', ['linear'], ['zoom'],
                      3.2, 0,
                      4.2, 0.45,
                      7.0, 0.75
                    ]);
                  } catch(e) {}
                } else if (isState) {
                  // State / Region: Softer golden dashed line
                  try {
                    map.setLayoutProperty(l.id, 'visibility', 'visible');
                    map.setPaintProperty(l.id, 'line-dasharray', [3, 2]);
                    map.setPaintProperty(l.id, 'line-color', '#d99726');
                    map.setPaintProperty(l.id, 'line-width', 1.2);
                    map.setPaintProperty(l.id, 'line-opacity', [
                      'interpolate', ['linear'], ['zoom'],
                      4.8, 0,
                      5.6, 0.45,
                      8.0, 0.65
                    ]);
                  } catch(e) {}
                } else if (isCity) {
                  // City / Urban: Distinct periwinkle/indigo dotted line
                  try {
                    map.setLayoutProperty(l.id, 'visibility', 'visible');
                    map.setPaintProperty(l.id, 'line-dasharray', [2, 2]);
                    map.setPaintProperty(l.id, 'line-color', '#818cf8');
                    map.setPaintProperty(l.id, 'line-width', 1.5);
                    map.setPaintProperty(l.id, 'line-opacity', [
                      'interpolate', ['linear'], ['zoom'],
                      8.8, 0,
                      9.6, 0.75,
                      13.0, 0.85
                    ]);
                  } catch(e) {}
                } else {
                  try { map.setLayoutProperty(l.id, 'visibility', 'none'); } catch(e) {}
                }
              });
            } catch(e) {}

            // Requirement 1c: Add Google Maps places (hospitals, buildings, cafes, schools, etc.)
            // Rendered selectively in moderation with small circles smaller than people elements, and appropriate icons
            try {
              if (!map.getLayer('poi-circles') && map.getSource('openmaptiles')) {
                // (a) Circle layer: small colored circles with 1.5px white ring
                map.addLayer({
                  id: 'poi-circles',
                  source: 'openmaptiles',
                  'source-layer': 'poi',
                  type: 'circle',
                  minzoom: 13.5,
                  filter: [
                    'step', ['zoom'],
                    ['all', ['<=', ['get', 'rank'], 2], ['in', ['get', 'class'], ['literal', ['hospital', 'university', 'college', 'railway', 'airport']]]],
                    14.5, ['<=', ['get', 'rank'], 4],
                    15.8, ['all']
                  ],
                  paint: {
                    'circle-radius': [
                      'interpolate', ['linear'], ['zoom'],
                      13.5, 7,
                      15.0, 8.5,
                      17.0, 10
                    ],
                    'circle-color': [
                      'match', ['get', 'class'],
                      ['hospital', 'doctors'], '#ef4444',
                      ['pharmacy'], '#14b8a6',
                      ['cafe', 'coffee'], '#f97316',
                      ['restaurant', 'fast_food', 'food', 'bar'], '#ea580c',
                      ['school', 'college', 'university', 'library'], '#3b82f6',
                      ['bank', 'atm'], '#10b981',
                      ['park', 'pitch'], '#22c55e',
                      ['hotel', 'lodging'], '#8b5cf6',
                      ['shop', 'supermarket', 'grocery', 'mall'], '#ec4899',
                      ['cinema', 'theatre', 'museum'], '#a855f7',
                      '#64748b'
                    ],
                    'circle-stroke-width': 1.5,
                    'circle-stroke-color': '#ffffff',
                    'circle-opacity': 0.95
                  }
                });

                // (b) Symbol layer: Appropriate icons inside the circle
                map.addLayer({
                  id: 'poi-icons',
                  source: 'openmaptiles',
                  'source-layer': 'poi',
                  type: 'symbol',
                  minzoom: 13.5,
                  filter: [
                    'step', ['zoom'],
                    ['all', ['<=', ['get', 'rank'], 2], ['in', ['get', 'class'], ['literal', ['hospital', 'university', 'college', 'railway', 'airport']]]],
                    14.5, ['<=', ['get', 'rank'], 4],
                    15.8, ['all']
                  ],
                  layout: {
                    'text-field': [
                      'match', ['get', 'class'],
                      ['hospital', 'doctors'], '✚',
                      ['pharmacy'], '💊',
                      ['cafe', 'coffee'], '☕',
                      ['restaurant', 'fast_food', 'food', 'bar'], '🍴',
                      ['school', 'college', 'university', 'library'], '🎓',
                      ['bank', 'atm'], '$',
                      ['park', 'pitch'], '🌲',
                      ['hotel', 'lodging'], '🛏',
                      ['shop', 'supermarket', 'grocery', 'mall'], '🛍',
                      ['cinema', 'theatre', 'museum'], '🎬',
                      '🏢'
                    ],
                    'text-size': [
                      'interpolate', ['linear'], ['zoom'],
                      13.5, 9,
                      16.0, 11
                    ],
                    'text-allow-overlap': false,
                    'text-ignore-placement': false
                  },
                  paint: {
                    'text-color': '#ffffff'
                  }
                });

                // (c) Text labels under the circles (only when zoomed in close, non-overlapping)
                map.addLayer({
                  id: 'poi-labels',
                  source: 'openmaptiles',
                  'source-layer': 'poi',
                  type: 'symbol',
                  minzoom: 14.8,
                  filter: ['<=', ['get', 'rank'], 4],
                  layout: {
                    'text-field': ['get', 'name'],
                    'text-font': ['Noto Sans Regular'],
                    'text-size': 9.5,
                    'text-offset': [0, 1.4],
                    'text-anchor': 'top',
                    'text-max-width': 8,
                    'text-optional': true,
                    'text-allow-overlap': false
                  },
                  paint: {
                    'text-color': '#e2e8f0',
                    'text-halo-color': '#0b1426',
                    'text-halo-width': 1.5
                  }
                });
              }
            } catch(e) {}

            // Requirement 1d: Selective non-overlapping texts for countries, regions/states, cities, sub-cities
            try {
              // Country texts: Only zoom 0 to 4.2
              ['place_country_major', 'place_country_minor', 'place_country_other'].forEach(function(cId) {
                if (map.getLayer(cId)) {
                  try {
                    map.setPaintProperty(cId, 'text-opacity', [
                      'interpolate', ['linear'], ['zoom'],
                      1.0, 0.92,
                      3.8, 0.92,
                      4.4, 0
                    ]);
                  } catch(e){}
                }
              });

              // Region / State texts: Only zoom 4.2 to 6.8
              if (map.getLayer('place_state')) {
                try {
                  map.setPaintProperty('place_state', 'text-opacity', [
                    'interpolate', ['linear'], ['zoom'],
                    4.2, 0,
                    4.8, 0.85,
                    6.8, 0.85,
                    7.4, 0
                  ]);
                } catch(e){}
              }

              // City texts: Only zoom 6.8 to 11.5
              ['place_city_large', 'place_city'].forEach(function(cityId) {
                if (map.getLayer(cityId)) {
                  try {
                    map.setPaintProperty(cityId, 'text-opacity', [
                      'interpolate', ['linear'], ['zoom'],
                      6.8, 0,
                      7.6, 0.9,
                      11.2, 0.9,
                      12.0, 0
                    ]);
                  } catch(e){}
                }
              });

              // Sub-cities / Towns / Districts: Only zoom 11.2 to 14.0
              ['place_town', 'place_suburb'].forEach(function(subId) {
                if (map.getLayer(subId)) {
                  try {
                    map.setPaintProperty(subId, 'text-opacity', [
                      'interpolate', ['linear'], ['zoom'],
                      11.2, 0,
                      12.0, 0.85,
                      14.0, 0.85,
                      14.6, 0
                    ]);
                  } catch(e){}
                }
              });

              // Villages / Neighborhoods / Local: Only zoom 13.8+
              ['place_village', 'place_other'].forEach(function(vId) {
                if (map.getLayer(vId)) {
                  try {
                    map.setPaintProperty(vId, 'text-opacity', [
                      'interpolate', ['linear'], ['zoom'],
                      13.8, 0,
                      14.5, 0.85
                    ]);
                  } catch(e){}
                }
              });
            } catch(e) {}
          });

          // Reset to 3D Globe
          window.resetToGlobe = function() {
            collapseExpanded();
            try {
              map.setProjection({ type: 'globe' });
            } catch(e) {}
            map.flyTo({
              center: [20, 20],
              zoom: 1.5,
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
          function collapseExpanded(callback) {
            if (!expandedMarkers.length) {
              if (currentlyHiddenMarker && currentlyHiddenMarker._element) {
                currentlyHiddenMarker._element.style.display = 'block';
                currentlyHiddenMarker = null;
              }
              if (callback) callback();
              return;
            }

            // Animate expanded cards back into the deck smoothly
            expandedMarkers.forEach(function(m) {
              if (m._element) {
                var inEl = m._element.querySelector('.marker-inner');
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
              if (currentlyHiddenMarker && currentlyHiddenMarker._element) {
                currentlyHiddenMarker._element.style.display = 'block';
                var inEl = currentlyHiddenMarker._element.querySelector('.marker-inner');
                if (inEl) {
                  inEl.classList.remove('stacked-return');
                  void inEl.offsetWidth;
                  inEl.classList.add('stacked-return');
                }
                currentlyHiddenMarker = null;
              }
              if (callback) callback();
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
            collapseExpanded(function() {
              if (markerRef && markerRef._element) {
                markerRef._element.style.display = 'none';
                currentlyHiddenMarker = markerRef;
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
            if (!isProgrammaticFlight && !window.pendingFocus) {
              collapseExpanded();
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
                // Requirement 8c-ii: Only render elements inside selected cities
                if (itemMatchesSelectedCities(wrapped)) {
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
            renderMarkers();
          };

          window.syncSelectedCities = function(cities) {
            currentSelectedCities = cities;
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

            function doExpandAndHighlight() {
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
                  isProgrammaticFlight = false;
                  window.pendingFocus = null;
                }, 120);
              } else {
                collapseExpanded();
                highlightPin(foundEntry.dom.pin);
                isProgrammaticFlight = false;
                window.pendingFocus = null;
              }
            }

            var center = map.getCenter();
            var dist = Math.abs(center.lng - targetVu.lng) + Math.abs(center.lat - targetVu.lat);
            var zoom = map.getZoom();

            if (zoom >= 14 && dist < 0.005) {
              doExpandAndHighlight();
            } else {
              isProgrammaticFlight = true;
              map.once('moveend', function() {
                setTimeout(function() {
                  doExpandAndHighlight();
                }, 80);
              });
              map.flyTo({
                center: [targetVu.lng, targetVu.lat],
                zoom: 15.5,
                pitch: 35,
                speed: 1.3,
                curve: 1.4,
                essential: true
              });
              setTimeout(function() {
                if (isProgrammaticFlight) {
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

          map.on('move', function() {
            updateContinuousClustering();
          });
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
        <View style={[styles.headerTitleWrap, { backgroundColor: darkBrownBg, borderColor: yellowAccent + '70' }]}>
          <MaterialIcons name="explore" size={18} color={yellowAccent} style={{ marginRight: 6 }} />
          <Text style={[styles.appTitle, { color: yellowAccent }]}>Explore Map</Text>
        </View>

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
        {/* Left: Category Icon Circles Stack */}
        {!isCategoryStackExpanded ? (
          // Overlapped State: Max 4 circles poking out vertically downwards
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleExpandCategories}
            style={styles.categoryStackOverlapBox}
          >
            {/* 4th circle */}
            <View style={[styles.categoryOverlapPill, styles.categoryOverlap4, { backgroundColor: darkBrownBg, borderColor: yellowAccent + '30' }]} />
            {/* 3rd circle */}
            <View style={[styles.categoryOverlapPill, styles.categoryOverlap3, { backgroundColor: darkBrownBg, borderColor: yellowAccent + '45' }]} />
            {/* 2nd circle */}
            <View style={[styles.categoryOverlapPill, styles.categoryOverlap2, { backgroundColor: darkBrownBg, borderColor: yellowAccent + '65' }]} />
            {/* Top 1st circle */}
            <View
              style={[
                styles.categoryOverlapPill,
                styles.categoryOverlap1,
                {
                  backgroundColor: selectedCategories.length > 0 && !selectedCategories.includes('all') ? yellowAccent : darkBrownBg,
                  borderColor: yellowAccent,
                },
              ]}
            >
              <MaterialIcons
                name={
                  selectedCategories.length > 0 && !selectedCategories.includes('all')
                    ? (CATEGORY_FILTER_ITEMS.find((c) => selectedCategories.includes(c.id) || selectedCategories.includes(c.name))?.icon || 'category')
                    : 'category'
                }
                size={18}
                color={selectedCategories.length > 0 && !selectedCategories.includes('all') ? darkBrown : yellowAccent}
              />
              {selectedCategories.length > 0 && !selectedCategories.includes('all') && (
                <View style={styles.categoryStackBadge}>
                  <Text style={styles.categoryStackBadgeText}>{selectedCategories.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ) : (
          // Expanded State: Smooth cluster card animation, top arrow REMOVED per requirement 1h!
          <Animated.View
            style={[
              styles.categoryStackExpandedBox,
              {
                backgroundColor: isDark ? 'rgba(32, 28, 24, 0.95)' : 'rgba(255, 255, 255, 0.96)',
                borderColor: yellowAccent + '70',
                opacity: categoryStackAnim.interpolate({
                  inputRange: [0, 0.4, 1],
                  outputRange: [0.6, 0.9, 1],
                }),
              },
            ]}
          >
            {/* Top arrow removed per requirement 1h */}

            {/* Scrollable list of categories with smooth deck slide out animation */}
            <ScrollView
              ref={categoryScrollRef}
              showsVerticalScrollIndicator={false}
              style={styles.categoryScrollList}
              contentContainerStyle={styles.categoryScrollContent}
            >
              {CATEGORY_FILTER_ITEMS.map((item, idx) => {
                const isSelected = selectedCategories.includes(item.id) || selectedCategories.includes(item.name);
                const itemTranslateY = categoryStackAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-(idx * 16), 0],
                });
                const itemScale = categoryStackAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.82, 1],
                });
                return (
                  <Animated.View
                    key={item.id}
                    style={{
                      transform: [{ translateY: itemTranslateY }, { scale: itemScale }],
                    }}
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
                      <MaterialIcons
                        name={item.icon}
                        size={17}
                        color={isSelected ? darkBrown : yellowAccent}
                      />
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </ScrollView>

            {/* Bottom Pull Tab Arrow: Collapses stack with smooth slide back */}
            <TouchableOpacity
              style={[styles.categoryActionCircle, styles.categoryPullTabBottom, { backgroundColor: darkBrownBg, borderColor: yellowAccent + '60' }]}
              onPress={handleCollapseCategories}
              activeOpacity={0.8}
            >
              <MaterialIcons name="keyboard-arrow-up" size={20} color={yellowAccent} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Right: "Categories" text pill or horizontally stacking selected categories pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categorySelectedPillsScroll}
          style={styles.categorySelectedPillsWrap}
        >
          {activeCategoriesList.length === 0 ? (
            <View style={styles.categoryLabelPill}>
              <MaterialIcons name="category" size={13} color={yellowAccent} style={{ marginRight: 4 }} />
              <Text style={styles.categoryLabelPillText}>Categories</Text>
            </View>
          ) : (
            activeCategoriesList.map((catItem) => (
              <View key={catItem.id} style={styles.categoryActivePill}>
                <MaterialIcons name={catItem.icon} size={13} color={darkBrown} style={{ marginRight: 4 }} />
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
              bottom: Math.max(insets.bottom, 12) + 63,
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
                ]}
              >
                <MaterialIcons
                  name={city.isCurrent ? 'my-location' : 'location-city'}
                  size={14}
                  color={city.isCurrent ? '#feba48' : '#e2e8f0'}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.cityPillText,
                    city.isCurrent ? styles.cityPillTextCurrent : styles.cityPillTextNormal,
                  ]}
                  numberOfLines={1}
                >
                  {city.isCurrent ? `Current: ${city.name}` : city.name}
                </Text>
                <TouchableOpacity
                  style={styles.cityPillCloseBtn}
                  onPress={() => handleRemoveCity(city.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="close" size={13} color={city.isCurrent ? '#feba48' : '#94a3b8'} />
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
              bottom: 16,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  categoryPullTabBottom: {
    marginTop: 4,
    marginBottom: 0,
  },
  categoryScrollList: {
    maxHeight: 280,
  },
  categoryScrollContent: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  categoryItemCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    paddingLeft: 10,
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
