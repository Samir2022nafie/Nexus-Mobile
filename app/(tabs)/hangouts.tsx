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
  TextInput,
  Modal,
  KeyboardAvoidingView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  ScrollView,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '../../src/constants/theme';
import { Avatar, CroppedImage } from '../../src/components/ui';
import { useTheme } from '../../src/context/ThemeContext';
import { useTabBarVisibility } from '../../src/context/TabBarVisibilityContext';
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
import { hasActualMapLocation } from '../../src/utils/distance';

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
  const { showTabBar } = useTabBarVisibility();

  useFocusEffect(
    useCallback(() => {
      showTabBar();
    }, [showTabBar])
  );

  // Tabs always default to 'all' — opening an entity does NOT force the tab filter
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>(['all']);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [isCategoryStackExpanded, setIsCategoryStackExpanded] = useState<boolean>(false);
  const categoryScrollRef = useRef<ScrollView>(null);
  const categoryStackAnim = useRef(new Animated.Value(0)).current;

  const handleExpandCategories = useCallback(() => {
    setIsCategoryStackExpanded(true);
    Animated.timing(categoryStackAnim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [categoryStackAnim]);

  const handleCollapseCategories = useCallback(() => {
    Animated.timing(categoryStackAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.inOut(Easing.cubic),
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

  // Requirement 1c: Search pop-up modal state
  const [isSearchModalVisible, setIsSearchModalVisible] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const searchDebounceRef = useRef<any>(null);

  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`,
          { headers: { 'User-Agent': 'NexusMobile/1.0', 'Accept-Language': 'en' } }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data || []);
        }
      } catch (err) {
        console.warn('Place search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 280);
  };

  const handleSelectSearchResult = (item: any) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    if (isNaN(lat) || isNaN(lng)) return;

    let zoom = 14.5;
    const type = (item.type || '').toLowerCase();
    if (type === 'country') zoom = 5.0;
    else if (type === 'state' || type === 'county') zoom = 8.5;
    else if (type === 'city' || type === 'town' || type === 'administrative') zoom = 13.0;
    else zoom = 16.0;

    const js = `if (window.map) {
      window.map.flyTo({ center: [${lng}, ${lat}], zoom: ${zoom}, speed: 1.2, essential: true });
    } true;`;
    webViewRef.current?.injectJavaScript(js);

    const addr = item.address || {};
    const cityName =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.city_district ||
      addr.county ||
      addr.state ||
      item.name;

    if (cityName) {
      const cId = cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      setSelectedCities((prev) => {
        if (prev.some((c) => c.id === cId || (Math.abs(c.lat - lat) < 0.25 && Math.abs(c.lng - lng) < 0.25))) {
          return prev;
        }
        const newCityObj: SelectedCity = {
          id: cId,
          name: cityName,
          isCurrent: false,
          lat,
          lng,
        };
        let next = [...prev, newCityObj];
        if (next.length > 5) {
          const currentItem = next.find((c) => c.isCurrent);
          const nonCurrent = next.filter((c) => !c.isCurrent);
          const trimmed = nonCurrent.slice(nonCurrent.length - (5 - (currentItem ? 1 : 0)));
          next = currentItem ? [currentItem, ...trimmed] : trimmed;
        }
        const syncJs = `if (window.syncSelectedCities) { window.syncSelectedCities(${JSON.stringify(next)}); } true;`;
        webViewRef.current?.injectJavaScript(syncJs);
        return next;
      });
    }

    setIsSearchModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleExecuteSearch = async () => {
    if (searchResults.length > 0) {
      handleSelectSearchResult(searchResults[0]);
      return;
    }
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&addressdetails=1`,
        { headers: { 'User-Agent': 'NexusMobile/1.0', 'Accept-Language': 'en' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          handleSelectSearchResult(data[0]);
          return;
        }
      }
    } catch (err) {
      console.warn('Execute search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

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
        communities: (data.communities || []).filter((c) => hasActualMapLocation(c)),
        events: (data.events || []).filter((e) => hasActualMapLocation(e)),
        hangouts: (data.hangouts || []).filter((h) => hasActualMapLocation(h)),
        users: (data.users || []).filter((u) => hasActualMapLocation(u)),
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
      const rawData = await locationsService.getExploreMap();
      const data: ExploreMapResponse = {
        communities: (rawData.communities || []).filter((c) => hasActualMapLocation(c)),
        events: (rawData.events || []).filter((e) => hasActualMapLocation(e)),
        hangouts: (rawData.hangouts || []).filter((h) => hasActualMapLocation(h)),
        users: (rawData.users || []).filter((u) => hasActualMapLocation(u)),
      };
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
        const rawName = String(msg.city || 'Selected City');
        const cId = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const isCurrent = cId === currentCityId || (Math.abs(msg.lat - userLat) < 0.35 && Math.abs(msg.lng - userLng) < 0.35);

        // Requirement 1b: Support up to 5 cities rendered simultaneously
        setSelectedCities((prev) => {
          if (prev.some((c) => c.id === cId || (Math.abs(c.lat - msg.lat) < 0.25 && Math.abs(c.lng - msg.lng) < 0.25))) return prev;
          const newCityObj: SelectedCity = {
            id: cId,
            name: rawName,
            isCurrent,
            lat: msg.lat,
            lng: msg.lng,
          };
          let next = isCurrent
            ? [newCityObj, ...prev.filter((c) => c.id !== cId)]
            : [...prev, newCityObj];

          if (next.length > 5) {
            const currentItem = next.find((c) => c.isCurrent);
            const nonCurrent = next.filter((c) => !c.isCurrent);
            const trimmed = nonCurrent.slice(nonCurrent.length - (5 - (currentItem ? 1 : 0)));
            next = currentItem ? [currentItem, ...trimmed] : trimmed;
          }

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
        const filteredData: ExploreMapResponse = {
          communities: (freshData.communities || []).filter((c) => hasActualMapLocation(c)),
          events: (freshData.events || []).filter((e) => hasActualMapLocation(e)),
          hangouts: (freshData.hangouts || []).filter((h) => hasActualMapLocation(h)),
          users: (freshData.users || []).filter((u) => hasActualMapLocation(u)),
        };
        setMapData(filteredData);
        sendDataToWebView(filteredData, selectedEntityTypes, selectedCategories, selectedCities);
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

  // Primary yellow accent & dark brown companion tokens (light mode equivalent for category icons & controls)
  const yellowAccent = '#e8a736';
  const darkBrown = '#281800';
  const darkBrownBg = isDark ? '#201e1c' : '#ffffff';
  const darkBrownBorder = isDark ? '#38332d' : '#e2e8f0';

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

          /* Hide MapLibre Attribution & Copyright Controls */
          .maplibregl-ctrl-attrib,
          .maplibregl-ctrl-bottom-right,
          .maplibregl-ctrl {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }

          /* Cosmic Deep Space Background */
          .cosmos-bg {
            position: absolute;
            inset: 0;
            z-index: 0;
            background: #02040a;
            overflow: hidden;
            pointer-events: none;
          }
          .cosmos-stars {
            position: absolute;
            inset: -300px;
            background-image: 
              radial-gradient(1.8px 1.8px at 28px 36px, #ffffff, transparent),
              radial-gradient(2.2px 2.2px at 145px 78px, #ffffff, transparent),
              radial-gradient(1.5px 1.5px at 82px 185px, #ffffff, transparent),
              radial-gradient(2.4px 2.4px at 278px 128px, #ffffff, transparent),
              radial-gradient(1.6px 1.6px at 218px 288px, #ffffff, transparent),
              radial-gradient(1.4px 1.4px at 48px 258px, #ffffff, transparent),
              radial-gradient(2.0px 2.0px at 318px 42px, #ffffff, transparent),
              radial-gradient(1.6px 1.6px at 188px 168px, #ffffff, transparent),
              radial-gradient(1.5px 1.5px at 112px 308px, #ffffff, transparent),
              radial-gradient(2.1px 2.1px at 52px 122px, #ffffff, transparent),
              radial-gradient(1.6px 1.6px at 168px 228px, #ffffff, transparent),
              radial-gradient(1.9px 1.9px at 308px 248px, #ffffff, transparent),
              radial-gradient(1.4px 1.4px at 258px 318px, #ffffff, transparent),
              radial-gradient(2.2px 2.2px at 338px 178px, #ffffff, transparent),
              radial-gradient(1.6px 1.6px at 16px 208px, #ffffff, transparent),
              radial-gradient(2.3px 2.3px at 128px 18px, #ffffff, transparent),
              radial-gradient(1.5px 1.5px at 238px 88px, #ffffff, transparent),
              radial-gradient(1.4px 1.4px at 298px 332px, #ffffff, transparent),
              radial-gradient(2.0px 2.0px at 95px 65px, #ffffff, transparent),
              radial-gradient(1.6px 1.6px at 175px 45px, #ffffff, transparent),
              radial-gradient(2.1px 2.1px at 60px 290px, #ffffff, transparent),
              radial-gradient(1.5px 1.5px at 245px 195px, #ffffff, transparent),
              radial-gradient(1.8px 1.8px at 15px 95px, #ffffff, transparent),
              radial-gradient(1.6px 1.6px at 195px 260px, #ffffff, transparent),
              radial-gradient(2.2px 2.2px at 285px 215px, #ffffff, transparent),
              radial-gradient(1.5px 1.5px at 135px 270px, #ffffff, transparent),
              radial-gradient(2.0px 2.0px at 215px 115px, #ffffff, transparent),
              radial-gradient(1.4px 1.4px at 30px 160px, #ffffff, transparent);
            background-repeat: repeat;
            background-size: 260px 260px;
            opacity: 1;
            will-change: transform;
          }
          /* Snapchat Soft Spherical Atmospheric Glow */
          .globe-atmosphere-halo {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 380px;
            height: 380px;
            max-width: 96vw;
            max-height: 96vw;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(56, 189, 248, 0.40) 0%, rgba(56, 189, 248, 0.28) 40%, rgba(14, 116, 144, 0.15) 60%, rgba(8, 47, 73, 0.05) 75%, transparent 88%);
            pointer-events: none;
            z-index: 0;
            transition: opacity 0.3s ease;
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
            filter: grayscale(100%) brightness(0.88) !important;
            opacity: 0.78 !important;
            border: 2.5px solid #94a3b8 !important;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.7) !important;
          }
          .item-passed-label {
            opacity: 0.88 !important;
            background: rgba(18, 22, 30, 0.95) !important;
            color: #e2e8f0 !important;
            border: 1px solid rgba(148, 163, 184, 0.6) !important;
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
        <div class="cosmos-bg"><div class="cosmos-stars"></div><div class="globe-atmosphere-halo"></div></div>
        <div id="map"></div>

        <script src="https://unpkg.com/maplibre-gl@5.1.0/dist/maplibre-gl.js"></script>
        <script>
          // Initialize MapLibre GL v5 with 3D Globe Projection
          // minZoom lowered to 1.45 so the entire globe sphere fits comfortably on screen without clipping
          var map = new maplibregl.Map({
            container: 'map',
            style: 'https://tiles.openfreemap.org/styles/liberty',
            center: [${initialCenterLng}, ${initialCenterLat}],
            zoom: Math.max(1.45, ${initialZoom}),
            minZoom: 1.45,
            maxZoom: 19.0,
            pitch: ${initialZoom < 5.0 ? 0 : initialPitch},
            maxPitch: 60,
            bearing: ${initialBearing},
            projection: { type: ${initialZoom < 7.0 ? "'globe'" : "'mercator'"} },
            antialias: false,
            fadeDuration: 0,
            trackResize: false,
            attributionControl: false,
            cooperativeGestures: false,
            renderWorldCopies: true
          });

          // Decremental smooth zoom scale calculation (throttled for 60fps performance)
          var currentProjection = ${initialZoom < 7.0 ? "'globe'" : "'mercator'"};
          function updateProjectionForZoom() {
            var z = map.getZoom();
            var targetProj = z < 7.0 ? 'globe' : 'mercator';
            if (currentProjection !== targetProj) {
              currentProjection = targetProj;
              try {
                map.setProjection({ type: targetProj });
              } catch(e) {}
            }
          }

          var lastZoomScale = -1;
          var zoomScaleRaf = null;
          function updateZoomScale() {
            updateProjectionForZoom();
            var z = map.getZoom();
            var minZ = 1.45;
            var maxZ = 13.0;
            var clampedZ = Math.max(minZ, Math.min(maxZ, z));
            var t = (clampedZ - minZ) / (maxZ - minZ);
            var smoothT = t * t * (3 - 2 * t);
            var scale = 0.44 + (1.0 - 0.44) * smoothT;

            if (Math.abs(scale - lastZoomScale) >= 0.02) {
              lastZoomScale = scale;
              document.documentElement.style.setProperty('--map-zoom-scale', scale.toFixed(2));
            }

            var shouldHide = z < 10.5;
            if (shouldHide !== document.body.classList.contains('hide-labels')) {
              if (shouldHide) {
                document.body.classList.add('hide-labels');
              } else {
                document.body.classList.remove('hide-labels');
              }
            }
          }
          function scheduleZoomScale() {
            if (zoomScaleRaf) return;
            zoomScaleRaf = requestAnimationFrame(function() {
              zoomScaleRaf = null;
              updateZoomScale();
            });
          }
          map.on('zoom', scheduleZoomScale);
          map.on('zoomend', updateZoomScale);
          updateZoomScale();

          // Starry background responsive to swiping / parallax (throttled)
          var lastParallaxX = -999;
          var lastParallaxY = -999;
          function updateCosmicParallax() {
            var starEl = document.querySelector('.cosmos-stars');
            if (!starEl) return;
            var center = map.getCenter();
            var bearing = map.getBearing() || 0;
            var pitch = map.getPitch() || 0;
            var shiftX = Math.round((center.lng * 2.8 + bearing * 1.2) % 240);
            var shiftY = Math.round((center.lat * 2.8 + pitch * 0.8) % 240);
            if (Math.abs(shiftX - lastParallaxX) >= 4 || Math.abs(shiftY - lastParallaxY) >= 4) {
              lastParallaxX = shiftX;
              lastParallaxY = shiftY;
              starEl.style.transform = 'translate3d(' + shiftX + 'px, ' + shiftY + 'px, 0px)';
            }
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
            // Silently absorb individual tile network drops
          });

          // Style load: Snapchat Dark Globe Aesthetics + Selective Labels
          map.on('style.load', function() {
            var initialTargetProj = map.getZoom() < 7.0 ? 'globe' : 'mercator';
            currentProjection = initialTargetProj;
            try {
              map.setProjection({ type: initialTargetProj });
            } catch(e) {}

            // 1. Snapchat Continent & Landscape Dark Mode Styling
            // Keep natural_earth visible for low zooms (< 7) on 3D globe, styled to dark aesthetic
            try {
              map.getStyle().layers.forEach(function(l) {
                if (l.id.indexOf('hillshade') !== -1 || (l.type === 'raster' && l.id.indexOf('natural_earth') === -1)) {
                  try { map.setLayoutProperty(l.id, 'visibility', 'none'); } catch(e) {}
                }
              });
            } catch(e) {}

            if (map.getLayer('natural_earth')) {
              try {
                map.setLayoutProperty('natural_earth', 'visibility', 'visible');
                map.setPaintProperty('natural_earth', 'raster-opacity', 0.85);
                map.setPaintProperty('natural_earth', 'raster-saturation', -0.6);
                map.setPaintProperty('natural_earth', 'raster-brightness-max', 0.65);
                map.setPaintProperty('natural_earth', 'raster-contrast', 0.25);
              } catch(e) {}
            }

            // Hide green vegetation, park, and landcover polygons and dotted outlines for clean solid vector continents
            [
              'park', 'park_outline', 'park_national', 'park_nature_reserve', 'landcover_wood', 'landcover_grass',
              'landcover_wetland', 'landcover_scrub', 'landcover_cemetery', 'landcover_glacier',
              'landuse_pitch', 'landuse_track', 'landuse_grass', 'landuse_residential',
              'landcover_sand', 'landcover_ice', 'landuse_hospital', 'landuse_school',
              'landuse_industrial', 'landuse_commercial'
            ].forEach(function(id) {
              if (map.getLayer(id)) {
                try { map.setLayoutProperty(id, 'visibility', 'none'); } catch(e) {}
              }
            });

            // Sweep and remove any remaining park / garden line or fill layers
            try {
              map.getStyle().layers.forEach(function(l) {
                if (l.id.indexOf('park') !== -1 || l.id.indexOf('garden') !== -1 || l.id.indexOf('grass') !== -1) {
                  try { map.setLayoutProperty(l.id, 'visibility', 'none'); } catch(e) {}
                }
              });
            } catch(e) {}

            // Continents: Dark slate grey (#28323c) matching Snapchat
            if (map.getLayer('background')) {
              try { map.setPaintProperty('background', 'background-color', '#28323c'); } catch(e) {}
            }
            ['land', 'landuse'].forEach(function(id) {
              if (map.getLayer(id)) {
                try { map.setPaintProperty(id, 'fill-color', '#28323c'); } catch(e) {}
              }
            });
            if (map.getLayer('water')) {
              try {
                map.setPaintProperty('water', 'fill-color', '#070b11');
                map.setPaintProperty('water', 'fill-opacity', 0.95);
              } catch(e) {}
            }

            // Waterways
            ['waterway_river', 'waterway_tunnel', 'waterway_other'].forEach(function(id) {
              if (map.getLayer(id)) {
                try { map.setPaintProperty(id, 'line-color', '#18283e'); } catch(e) {}
              }
            });

            // Tone down bright yellow and white road lines to dark charcoal / slate
            try {
              map.getStyle().layers.forEach(function(l) {
                if (l.type === 'line' && (l.id.indexOf('road') !== -1 || l.id.indexOf('highway') !== -1 || l.id.indexOf('bridge') !== -1 || l.id.indexOf('tunnel') !== -1)) {
                  try {
                    if (l.id.indexOf('case') !== -1) {
                      map.setPaintProperty(l.id, 'line-color', '#12171e');
                    } else if (l.id.indexOf('motorway') !== -1 || l.id.indexOf('trunk') !== -1) {
                      map.setPaintProperty(l.id, 'line-color', '#2c3545');
                    } else if (l.id.indexOf('primary') !== -1 || l.id.indexOf('secondary') !== -1) {
                      map.setPaintProperty(l.id, 'line-color', '#222b37');
                    } else {
                      map.setPaintProperty(l.id, 'line-color', '#1a222b');
                    }
                    map.setPaintProperty(l.id, 'line-opacity', 0.85);
                  } catch(e) {}
                }
              });
            } catch(e) {}

            if (map.getLayer('building')) {
              try { map.setPaintProperty('building', 'fill-color', '#1e242c'); } catch(e) {}
            }
            if (map.getLayer('building-3d')) {
              try { map.setPaintProperty('building-3d', 'fill-extrusion-color', '#232b35'); } catch(e) {}
            }

            // Country & Region Boundaries:
            // Crisp, solid, thin borders between countries (removes dotted clutter)
            if (map.getLayer('boundary_2')) {
              try {
                map.setLayoutProperty('boundary_2', 'visibility', 'visible');
                map.setPaintProperty('boundary_2', 'line-color', 'rgba(120, 140, 160, 0.65)');
                map.setPaintProperty('boundary_2', 'line-width', 1.1);
                map.setPaintProperty('boundary_2', 'line-dasharray', null);
              } catch(e) {}
            }
            if (map.getLayer('boundary_3')) {
              try {
                map.setLayoutProperty('boundary_3', 'visibility', 'visible');
                map.setPaintProperty('boundary_3', 'line-color', 'rgba(80, 95, 115, 0.35)');
                map.setPaintProperty('boundary_3', 'line-width', 0.8);
                map.setPaintProperty('boundary_3', 'line-dasharray', null);
              } catch(e) {}
            }
            if (map.getLayer('boundary_disputed')) {
              try { map.setLayoutProperty('boundary_disputed', 'visibility', 'none'); } catch(e) {}
            }

            // 3. High-Contrast English Text Labels with Dark Halo
            var textLayers = [
              'label_country_1', 'label_country_2', 'label_country_3',
              'label_city_capital', 'label_city', 'label_state',
              'label_town', 'label_village', 'label_other',
              'waterway_line_label', 'water_name_point_label', 'water_name_line_label',
              'poi_r20', 'poi_r7', 'poi_r1', 'poi_transit'
            ];
            textLayers.forEach(function(id) {
              if (map.getLayer(id)) {
                try {
                  map.setPaintProperty(id, 'text-color', '#e2e8f0');
                  map.setPaintProperty(id, 'text-halo-color', '#090d13');
                  map.setPaintProperty(id, 'text-halo-width', 1.6);
                  map.setPaintProperty(id, 'text-halo-blur', 0);
                  map.setLayoutProperty(id, 'text-field', [
                    'coalesce',
                    ['get', 'name:en'],
                    ['get', 'name_en'],
                    ['get', 'name:latin'],
                    ['get', 'name'],
                    ''
                  ]);
                } catch(e) {}
              }
            });

            // 4. Native WebGL Selective Label Zoom Ranges (60 FPS on GPU, zero JS overhead!)
            var labelRanges = {
              'label_country_1': [2.1, 24],
              'label_country_2': [3.0, 24],
              'label_country_3': [4.2, 24],
              'label_city_capital': [4.5, 24],
              'label_city': [4.8, 24],
              'label_state': [5.5, 24],
              'label_town': [8.5, 24],
              'label_village': [10.0, 24],
              'label_other': [11.0, 24],
              'water_name_point_label': [4.0, 24],
              'water_name_line_label': [4.0, 24],
              'waterway_line_label': [6.0, 24]
            };
            Object.keys(labelRanges).forEach(function(id) {
              if (map.getLayer(id)) {
                try {
                  map.setLayerZoomRange(id, labelRanges[id][0], labelRanges[id][1]);
                } catch(e) {}
              }
            });

            // Atmosphere Halo: Fades smoothly as user zooms into street level
            var haloRaf = null;
            function updateAtmosphereHalo() {
              var halo = document.querySelector('.globe-atmosphere-halo');
              if (!halo) return;
              var currentZ = map.getZoom();
              if (currentZ > 5.5) {
                halo.style.opacity = '0';
              } else if (currentZ > 3.5) {
                halo.style.opacity = String(Math.max(0, 1 - (currentZ - 3.5) / 2.0));
              } else {
                halo.style.opacity = '1';
              }
            }
            map.on('zoom', function() {
              if (!haloRaf) {
                haloRaf = requestAnimationFrame(function() {
                  haloRaf = null;
                  updateAtmosphereHalo();
                });
              }
            });
            map.on('zoomend', updateAtmosphereHalo);
            updateAtmosphereHalo();

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
                    'fill-extrusion-color': '#232b35',
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

            function formatCroppedImgHtml(url, fallbackHtml) {
              if (!url) return fallbackHtml;
              var trimmed = (url || '').trim();
              if (trimmed.indexOf('data:image/') === 0) {
                return '<img src="' + trimmed + '" />';
              }
              var hashIdx = trimmed.indexOf('#crop=');
              var queryMatch = trimmed.match(/[?&]crop=([^&#]+)/);
              var cropPart = '';
              var clean = trimmed;
              if (hashIdx !== -1) {
                clean = trimmed.slice(0, hashIdx);
                cropPart = trimmed.slice(hashIdx + 6).split('&')[0];
              } else if (queryMatch) {
                try {
                  cropPart = decodeURIComponent(queryMatch[1]);
                } catch(e) {
                  cropPart = queryMatch[1];
                }
                clean = trimmed.replace(/[?&]crop=[^&#]+/, '').replace(/\?&/, '?').replace(/[?&]$/, '');
              }
              if (!cropPart) {
                return '<img src="' + clean + '" />';
              }
              var parts = cropPart.split(',');
              var zoom = parseFloat(parts[0]) || 1;
              var x = parseFloat(parts[1]) || 0;
              var y = parseFloat(parts[2]) || 0;
              return '<img src="' + clean + '" style="transform: translate(' + x + '%, ' + y + '%) scale(' + zoom + '); transform-origin: center center;" />';
            }

            if (type === 'hangout') {
              pinClass = 'hangout-pin';
              labelClass = 'hangout-label';
              title = item.title || 'Hangout';
              var banner = item.coverImageUrl || item.bannerUrl || item.cover_image_url;
              var hangoutFallback = '<div class="hangout-placeholder"><svg viewBox="0 0 24 24" width="28" height="28" fill="#34d399"><path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/></svg></div>';
              contentHtml = formatCroppedImgHtml(banner, hangoutFallback);
            } else if (type === 'event') {
              pinClass = 'event-pin';
              labelClass = 'event-label';
              title = item.title || 'Event';
              var banner = item.coverImageUrl || item.bannerUrl || item.cover_image_url;
              var eventFallback = '<div class="event-placeholder"><svg viewBox="0 0 24 24" width="28" height="28" fill="#feba48"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg></div>';
              contentHtml = formatCroppedImgHtml(banner, eventFallback);
            } else if (type === 'community') {
              pinClass = 'community-pin';
              labelClass = 'community-label';
              title = item.name || 'Community';
              var pic = item.profilePictureUrl || item.profile_picture_url || item.bannerUrl || item.banner_url;
              var commFallback = '<div class="community-placeholder"><svg viewBox="0 0 24 24" width="26" height="26" fill="#60a5fa"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></div>';
              contentHtml = formatCroppedImgHtml(pic, commFallback);
            } else {
              pinClass = 'user-pin';
              labelClass = 'user-label';
              title = item.name || item.username || 'User';
              var userPic = item.profilePictureUrl || item.profile_picture_url || item.avatarUrl || item.avatar_url;
              var userFallback = '<div class="user-avatar-fallback"><svg viewBox="0 0 24 24" width="20" height="20" fill="#d5c4b4"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>';
              contentHtml = formatCroppedImgHtml(userPic, userFallback);
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
              if (
                item.location &&
                typeof item.location.latitude === 'number' &&
                typeof item.location.longitude === 'number' &&
                item.location.placeId !== 'plain_text' &&
                item.location.place_id !== 'plain_text' &&
                item.place_id !== 'plain_text' &&
                item.placeId !== 'plain_text'
              ) {
                var lat = item.location.latitude;
                var lng = item.location.longitude;
                if (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001) return;
                var locName = (item.location.name || item.location.placeName || '').toLowerCase().trim();
                if (locName === 'online' || locName === 'virtual') return;

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
              // City level (z >= 10.5): Check city empty space tap with real city name resolution
              var nearbyLabels = map.queryRenderedFeatures([
                [e.point.x - 140, e.point.y - 140],
                [e.point.x + 140, e.point.y + 140]
              ], {
                layers: ['label_city_capital', 'label_city', 'label_town', 'label_village', 'label_state']
              });
              var quickCity = '';
              if (nearbyLabels.length && nearbyLabels[0].properties) {
                quickCity = nearbyLabels[0].properties['name:en'] || nearbyLabels[0].properties.name_en || nearbyLabels[0].properties['name:latin'] || nearbyLabels[0].properties.name || '';
              }

              var isAlreadySelected = (currentSelectedCities || []).some(function(c) {
                if (quickCity && (c.name || '').toLowerCase() === quickCity.toLowerCase()) return true;
                var dLat = Math.abs(c.lat - e.lngLat.lat);
                var dLng = Math.abs(c.lng - e.lngLat.lng);
                return dLat < 0.28 && dLng < 0.28;
              });

              if (isAlreadySelected) {
                return;
              }

              // Trigger special UI: Radar Scanner Animation at tap coordinate!
              var radarEl = document.createElement('div');
              radarEl.className = 'city-radar-container';
              var radarLabelText = quickCity ? ('Scanning ' + quickCity + '...') : 'Scanning Location...';
              radarEl.innerHTML = '<div class="city-radar-ring"></div><div class="city-radar-core"></div><div class="city-radar-label">' + radarLabelText + '</div>';

              var radarMarker = new maplibregl.Marker({ element: radarEl })
                .setLngLat([e.lngLat.lng, e.lngLat.lat])
                .addTo(map);

              setTimeout(function() {
                radarMarker.remove();
              }, 2000);

              // Perform reverse geocoding to resolve exact city / town / region name
              var tapLat = e.lngLat.lat;
              var tapLng = e.lngLat.lng;
              fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + tapLat + '&lon=' + tapLng + '&zoom=12&addressdetails=1', {
                headers: { 'Accept-Language': 'en' }
              })
              .then(function(res) { return res.json(); })
              .then(function(data) {
                var addr = data.address || {};
                var realCity = addr.city || addr.town || addr.village || addr.municipality || addr.city_district || addr.suburb || addr.county || addr.state || data.name || quickCity || 'Selected City';
                var lab = radarEl.querySelector('.city-radar-label');
                if (lab) lab.innerText = 'Rendering ' + realCity + '...';
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'city_selected',
                    city: realCity,
                    lat: tapLat,
                    lng: tapLng
                  }));
                }
              })
              .catch(function() {
                var fallbackCity = quickCity || 'Selected City';
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'city_selected',
                    city: fallbackCity,
                    lat: tapLat,
                    lng: tapLng
                  }));
                }
              });
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
          // Clustering update on zoomend prevents tearing down markers 60x/sec during pinch
          map.on('zoomend', function() {
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
          window.addEventListener('resize', function() {
            if (map) map.resize();
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
        renderToHardwareTextureAndroid={true}
        overScrollMode="never"
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        onLoadEnd={() => sendDataToWebView(mapData, selectedEntityTypes, selectedCategories, selectedCities)}
      />

      {/* Full-width gradient fade background behind Header & Status Bar */}
      <View
        pointerEvents="none"
        style={[
          styles.topHeaderGradient,
          {
            height: Math.max(insets.top, 16) + 64,
          },
        ]}
      >
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinearGradient id="headerFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#04070c" stopOpacity="0.52" />
              <Stop offset="55%" stopColor="#04070c" stopOpacity="0.38" />
              <Stop offset="82%" stopColor="#04070c" stopOpacity="0.16" />
              <Stop offset="100%" stopColor="#04070c" stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#headerFade)" />
        </Svg>
      </View>

      {/* Floating Header Controls with App's Yellow Accent & Dark Brown Theme */}
      <View style={[styles.headerOverlay, { top: Math.max(insets.top, 16) }]}>
        <Text style={styles.nexusMapTitle}>Nexus Map</Text>

        {/* Action Controls (Globe, GPS Current Location, Refresh) */}
        <View style={styles.controlsRow}>
          {/* Globe Zoom-Out Button */}
          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: darkBrownBg, borderColor: isDark ? yellowAccent + '50' : '#e2e8f0' }]}
            onPress={handleResetGlobe}
            activeOpacity={0.8}
          >
            <MaterialIcons name="public" size={20} color={isDark ? yellowAccent : '#92400e'} />
          </TouchableOpacity>

          {/* Current Location GPS Button */}
          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: darkBrownBg, borderColor: isDark ? yellowAccent + '50' : '#e2e8f0' }]}
            onPress={handleFlyToGpsLocation}
            activeOpacity={0.8}
            disabled={locatingGps || isLoadingLocation}
          >
            {locatingGps || isLoadingLocation ? (
              <ActivityIndicator size="small" color={isDark ? yellowAccent : '#92400e'} />
            ) : (
              <MaterialIcons name="my-location" size={20} color={isDark ? yellowAccent : '#92400e'} />
            )}
          </TouchableOpacity>

          {/* Refresh Map Data Button: updates locations in place without moving camera */}
          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: darkBrownBg, borderColor: isDark ? yellowAccent + '50' : '#e2e8f0' }]}
            onPress={handleRefreshDataInPlace}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color={isDark ? yellowAccent : '#92400e'} />
            ) : (
              <MaterialIcons name="refresh" size={20} color={isDark ? yellowAccent : '#92400e'} />
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
                color={isActive ? darkBrown : (isDark ? yellowAccent : '#92400e')}
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
                color={isActive ? darkBrown : (isDark ? yellowAccent : '#92400e')}
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
                color={isActive ? darkBrown : (isDark ? yellowAccent : '#92400e')}
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
                color={isActive && !hasSpecificCategory ? darkBrown : (isDark ? yellowAccent : '#92400e')}
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
                backgroundColor: isDark ? 'rgba(32, 28, 24, 0.95)' : 'rgba(255, 255, 255, 0.96)',
                borderColor: isDark ? yellowAccent + '70' : '#e2e8f0',
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
                minHeight: (CATEGORY_FILTER_ITEMS.length - 1) * 44 + 38 + 44,
                paddingBottom: 42,
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
                        : [styles.categoryItemInactive, { backgroundColor: darkBrownBg, borderColor: isDark ? '#3d3835' : '#e2e8f0' }],
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
                style={[styles.categoryActionCircle, styles.categoryPullTabBottom, { backgroundColor: darkBrownBg, borderColor: isDark ? yellowAccent + '60' : '#e2e8f0' }]}
                onPress={handleCollapseCategories}
                activeOpacity={0.8}
              >
                <MaterialIcons name="keyboard-arrow-up" size={20} color={isDark ? yellowAccent : '#92400e'} />
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

      {/* Requirement 1c: Circular Search Button positioned on the right side just above the location pills */}
      <Animated.View
        style={[
          styles.searchFloatingBtnWrap,
          {
            bottom: Math.max(insets.bottom, 12) + (selectedCities.length > 0 ? 116 : 68),
            transform: [{ translateY: cityPillsSlideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.searchFloatingBtn,
            {
              backgroundColor: darkBrownBg,
              borderColor: isDark ? yellowAccent + '70' : '#cbd5e1',
            },
          ]}
          onPress={() => setIsSearchModalVisible(true)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="search" size={22} color={isDark ? yellowAccent : '#92400e'} />
        </TouchableOpacity>
      </Animated.View>

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

      {/* Place Search Pop-Up Modal */}
      <Modal
        visible={isSearchModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setIsSearchModalVisible(false);
          setSearchQuery('');
          setSearchResults([]);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.searchModalBackdrop}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setIsSearchModalVisible(false);
              setSearchQuery('');
              setSearchResults([]);
            }}
          />
          <View
            style={[
              styles.searchModalCard,
              {
                backgroundColor: isDark ? '#1a1816' : '#ffffff',
                borderColor: isDark ? '#38332d' : '#e2e8f0',
              },
            ]}
          >
            <View style={styles.searchModalHeader}>
              <MaterialIcons name="travel-explore" size={22} color={isDark ? yellowAccent : '#92400e'} />
              <Text
                style={[
                  styles.searchModalTitle,
                  { color: colors.onSurface },
                ]}
              >
                Search Map & Places
              </Text>
            </View>

            {/* Input Row */}
            <View
              style={[
                styles.searchInputRow,
                {
                  backgroundColor: isDark ? '#262320' : '#f8fafc',
                  borderColor: isDark ? '#3f3a36' : '#cbd5e1',
                },
              ]}
            >
              <MaterialIcons name="search" size={20} color={isDark ? '#a8a29e' : '#64748b'} />
              <TextInput
                style={[styles.searchInput, { color: colors.onSurface }]}
                placeholder="Search city, landmark, country, or cafe..."
                placeholderTextColor={isDark ? '#78716c' : '#94a3b8'}
                value={searchQuery}
                onChangeText={handleSearchQueryChange}
                autoFocus={true}
                returnKeyType="search"
                onSubmitEditing={handleExecuteSearch}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="close" size={18} color={isDark ? '#a8a29e' : '#64748b'} />
                </TouchableOpacity>
              )}
            </View>

            {/* Loading Indicator */}
            {isSearching && (
              <ActivityIndicator size="small" color={isDark ? yellowAccent : '#92400e'} style={{ marginVertical: 14 }} />
            )}

            {/* Suggestions List */}
            {searchResults.length > 0 && (
              <ScrollView
                style={styles.searchSuggestionsList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
                {searchResults.map((item, idx) => {
                  const placeName = item.name || (item.display_name ? item.display_name.split(',')[0] : 'Place');
                  const placeSubtitle = item.display_name || '';
                  const type = (item.type || '').toLowerCase();
                  let iconName = 'place';
                  if (type === 'city' || type === 'town' || type === 'administrative') iconName = 'location-city';
                  else if (type === 'country') iconName = 'public';
                  else if (type === 'restaurant' || type === 'cafe') iconName = 'local-cafe';
                  else if (type === 'hospital') iconName = 'local-hospital';
                  else if (type === 'park') iconName = 'park';

                  return (
                    <TouchableOpacity
                      key={item.place_id || idx}
                      style={[
                        styles.searchSuggestionItem,
                        { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
                      ]}
                      onPress={() => handleSelectSearchResult(item)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.suggestionIconWrap,
                          { backgroundColor: isDark ? '#262320' : '#f1f5f9' },
                        ]}
                      >
                        <MaterialIcons name={iconName as any} size={16} color={isDark ? yellowAccent : '#92400e'} />
                      </View>
                      <View style={styles.suggestionTextWrap}>
                        <Text style={[styles.suggestionMainText, { color: colors.onSurface }]} numberOfLines={1}>
                          {placeName}
                        </Text>
                        <Text style={[styles.suggestionSubText, { color: colors.tertiary }]} numberOfLines={1}>
                          {placeSubtitle}
                        </Text>
                      </View>
                      <MaterialIcons name="north-west" size={14} color={isDark ? '#57534e' : '#94a3b8'} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Empty state when searched and no results */}
            {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
              <Text style={[styles.searchEmptyText, { color: colors.tertiary }]}>
                No matching places found. Tap Search to query coordinates.
              </Text>
            )}

            {/* Buttons Row */}
            <View style={styles.searchModalActionsRow}>
              <TouchableOpacity
                style={[
                  styles.searchModalCancelBtn,
                  {
                    backgroundColor: isDark ? '#262320' : '#f1f5f9',
                    borderColor: isDark ? '#38332d' : '#cbd5e1',
                  },
                ]}
                onPress={() => {
                  setIsSearchModalVisible(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.searchModalCancelText, { color: colors.onSurface }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.searchModalSubmitBtn,
                  { backgroundColor: yellowAccent },
                ]}
                onPress={handleExecuteSearch}
                activeOpacity={0.85}
              >
                <MaterialIcons name="search" size={16} color={darkBrown} />
                <Text style={styles.searchModalSubmitText}>Search</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
                <Avatar
                  uri={selectedEntity.data.profilePictureUrl || selectedEntity.data.avatar_url || selectedEntity.data.avatarUrl}
                  size={56}
                  name={selectedEntity.data.name || selectedEntity.data.username || 'User'}
                  type="user"
                />
              ) : selectedEntity.type === 'community' ? (
                (selectedEntity.data.profilePictureUrl || selectedEntity.data.profile_picture_url || selectedEntity.data.bannerUrl || selectedEntity.data.banner_url) ? (
                  <CroppedImage
                    uri={selectedEntity.data.profilePictureUrl || selectedEntity.data.profile_picture_url || selectedEntity.data.bannerUrl || selectedEntity.data.banner_url}
                    style={styles.entityImageSquare}
                    fallback={
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
                    }
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
                (selectedEntity.data.coverImageUrl || selectedEntity.data.cover_image_url || selectedEntity.data.bannerUrl || selectedEntity.data.banner_url) ? (
                  <CroppedImage
                    uri={selectedEntity.data.coverImageUrl || selectedEntity.data.cover_image_url || selectedEntity.data.bannerUrl || selectedEntity.data.banner_url}
                    style={styles.entityImageRect}
                    fallback={
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
                    }
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
                (selectedEntity.data.coverImageUrl || selectedEntity.data.cover_image_url || selectedEntity.data.bannerUrl || selectedEntity.data.banner_url) ? (
                  <CroppedImage
                    uri={selectedEntity.data.coverImageUrl || selectedEntity.data.cover_image_url || selectedEntity.data.bannerUrl || selectedEntity.data.banner_url}
                    style={styles.entityImageSquare}
                    fallback={
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
                    }
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
  topHeaderGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 70,
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
    fontFamily: 'DIN Next Rounded',
    fontSize: 34,
    color: '#ffffff',
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  searchFloatingBtnWrap: {
    position: 'absolute',
    right: Spacing.md,
    zIndex: 98,
  },
  searchFloatingBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  searchModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  searchModalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 18,
    ...Shadows.lg,
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  searchModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    height: '100%',
    paddingVertical: 0,
  },
  searchSuggestionsList: {
    maxHeight: 220,
    marginTop: 8,
  },
  searchSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  suggestionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTextWrap: {
    flex: 1,
  },
  suggestionMainText: {
    fontSize: 14,
    fontWeight: '700',
  },
  suggestionSubText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  searchEmptyText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    marginVertical: 14,
  },
  searchModalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  searchModalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchModalCancelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  searchModalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 6,
    justifyContent: 'center',
    ...Shadows.sm,
  },
  searchModalSubmitText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#281800',
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
