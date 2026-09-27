/**
 * Snapchat-Style 3D Globe Explore Map Screen.
 * Plotted with communities, events, hangouts, and users.
 * Globe on zoom out, flat map on zoom in.
 * Completely free (MapLibre GL v5 + OpenFreeMap vector styles). Zero billing.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
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

// Ordered tabs: All -> Hangouts -> Events -> Communities -> People (Users)
type FilterType = 'all' | 'hangouts' | 'events' | 'communities' | 'users';

interface SelectedMapEntity {
  type: 'user' | 'hangout' | 'event' | 'community';
  data: any;
}

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

  const initialFilter: FilterType = (() => {
    const ft = params.focusType ? params.focusType.toLowerCase() : '';
    if (ft === 'hangout' || ft === 'hangouts') return 'hangouts';
    if (ft === 'event' || ft === 'events') return 'events';
    if (ft === 'community' || ft === 'communities') return 'communities';
    if (ft === 'user' || ft === 'users') return 'users';
    return 'all';
  })();

  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [mapData, setMapData] = useState<ExploreMapResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [locatingGps, setLocatingGps] = useState<boolean>(false);
  const [selectedEntity, setSelectedEntity] = useState<SelectedMapEntity | null>(null);
  const [mapReady, setMapReady] = useState<boolean>(false);

  // Initial target coordinates for MapLibre map initialization
  const targetLat = params.focusLat ? parseFloat(params.focusLat) : null;
  const targetLng = params.focusLng ? parseFloat(params.focusLng) : null;
  const hasValidTarget = targetLat !== null && targetLng !== null && !isNaN(targetLat) && !isNaN(targetLng);

  const initialCenterLng = hasValidTarget ? targetLng : 20;
  const initialCenterLat = hasValidTarget ? targetLat : 20;
  const initialZoom = hasValidTarget ? 15.5 : 1.5;
  const initialPitch = hasValidTarget ? 35 : 0;

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

  // Bottom card slide animation
  const cardSlideAnim = useRef(new Animated.Value(300)).current;

  const openSelectedCard = useCallback((entity: SelectedMapEntity) => {
    setSelectedEntity(entity);
    Animated.spring(cardSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 65,
    }).start();
  }, [cardSlideAnim]);

  const closeSelectedCard = useCallback(() => {
    Animated.timing(cardSlideAnim, {
      toValue: 300,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setSelectedEntity(null));
    const js = `if (window.clearHighlight) { window.clearHighlight(); } true;`;
    webViewRef.current?.injectJavaScript(js);
  }, [cardSlideAnim]);

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

  // Send data to WebView when mapData or filter changes
  const sendDataToWebView = useCallback((data: ExploreMapResponse | null, currentFilter: FilterType) => {
    if (!data) return;
    const payload = {
      type: 'set_items',
      filter: currentFilter,
      communities: data.communities,
      events: data.events,
      hangouts: data.hangouts,
      users: data.users,
    };
    const js = `if (window.updateMapMarkers) { window.updateMapMarkers(${JSON.stringify(payload)}); } true;`;
    webViewRef.current?.injectJavaScript(js);
  }, []);

  // Fetch explore map items from backend
  const loadMapData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await locationsService.getExploreMap();
      setMapData(data);
      sendDataToWebView(data, filter);
      tryOpenPendingCard(data, pendingFocusRef.current);
    } catch (err) {
      console.error('Failed to load explore map items:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, sendDataToWebView, tryOpenPendingCard]);

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
        const mappedFilter: FilterType =
          ft === 'hangout' || ft === 'hangouts'
            ? 'hangouts'
            : ft === 'event' || ft === 'events'
            ? 'events'
            : ft === 'community' || ft === 'communities'
            ? 'communities'
            : ft === 'user' || ft === 'users'
            ? 'users'
            : 'all';

        setFilter(mappedFilter);

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

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    sendDataToWebView(mapData, newFilter);
    closeSelectedCard();
    pendingFocusRef.current = null;
    handledCardKeyRef.current = null;
    // Clear route focus params so tab switches freely without lock
    router.setParams({
      focusLat: undefined,
      focusLng: undefined,
      focusId: undefined,
      focusType: undefined,
    });
  };

  // Handle message from WebView (e.g. marker tapped, map ready)
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
          sendDataToWebView(mapData, filter);
          tryOpenPendingCard(mapData, pendingFocusRef.current);
        }
      }
    } catch (e) {
      console.error('WebView message parse error:', e);
    }
  };

  // Zoom into user's real phone GPS location instantly with battery & timeout optimization
  const handleFlyToGpsLocation = async () => {
    // 1. If we already have a cached location from context, fly to it immediately!
    if (userLocation?.latitude && userLocation?.longitude) {
      const js = `if (window.map) {
        window.map.flyTo({ center: [${userLocation.longitude}, ${userLocation.latitude}], zoom: 15, essential: true });
        if (window.setUserGpsMarker) { window.setUserGpsMarker(${userLocation.latitude}, ${userLocation.longitude}); }
      } true;`;
      webViewRef.current?.injectJavaScript(js);
    }

    setLocatingGps(true);
    try {
      const loc = await requestLocation(true, true);
      if (loc && loc.latitude && loc.longitude) {
        const js = `if (window.map) {
          window.map.flyTo({ center: [${loc.longitude}, ${loc.latitude}], zoom: 15, essential: true });
          if (window.setUserGpsMarker) { window.setUserGpsMarker(${loc.latitude}, ${loc.longitude}); }
        } true;`;
        webViewRef.current?.injectJavaScript(js);
      } else if (user?.location?.latitude && user?.location?.longitude) {
        // Fallback to home address if GPS permission denied
        const js = `if (window.map) { window.map.flyTo({ center: [${user.location.longitude}, ${user.location.latitude}], zoom: 14, essential: true }); } true;`;
        webViewRef.current?.injectJavaScript(js);
      }
    } catch (e) {
      console.warn('GPS location fly error:', e);
    } finally {
      // Guaranteed immediate reset so button never gets stuck
      setLocatingGps(false);
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

  // Free OpenFreeMap vector styles: Dark mode style for dark theme, Liberty style for light theme
  const mapStyleUrl = isDark
    ? 'https://tiles.openfreemap.org/styles/dark'
    : 'https://tiles.openfreemap.org/styles/liberty';

  // Primary yellow accent & dark brown companion tokens
  const yellowAccent = '#e8a736';
  const darkBrown = '#281800';
  const darkBrownBg = isDark ? '#201e1c' : '#ffffff';
  const darkBrownBorder = isDark ? '#38332d' : '#e5d5c3';

  const mapHtml = `
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
            background: ${isDark ? '#02040a' : '#f8f9fa'};
          }
          #map {
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 1;
            background: transparent !important;
          }
          .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-bottom-left { display: none !important; }

          /* Cosmic Starry Atmosphere for Dark Mode */
          .cosmos-bg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(ellipse at 50% 50%, #0d1538 0%, #070c20 60%, #02040a 100%);
            z-index: 0;
            pointer-events: none;
          }
          .cosmos-stars {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image:
              radial-gradient(1.2px 1.2px at 30px 40px, #ffffff, transparent),
              radial-gradient(1.5px 1.5px at 100px 140px, #38bdf8, transparent),
              radial-gradient(1px 1px at 170px 80px, #ffffff, transparent),
              radial-gradient(2px 2px at 230px 210px, #fde047, transparent),
              radial-gradient(1.2px 1.2px at 340px 90px, #ffffff, transparent),
              radial-gradient(1.8px 1.8px at 290px 260px, #38bdf8, transparent),
              radial-gradient(1px 1px at 110px 310px, #ffffff, transparent),
              radial-gradient(2px 2px at 200px 360px, #ffffff, transparent),
              radial-gradient(1.2px 1.2px at 360px 330px, #fde047, transparent);
            background-repeat: repeat;
            background-size: 380px 380px;
            opacity: 0.85;
            pointer-events: none;
            z-index: 0;
          }
          .cosmos-atmosphere {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 360px;
            height: 360px;
            transform: translate(-50%, -50%);
            border-radius: 50%;
            background: radial-gradient(circle, rgba(56, 189, 248, 0.28) 0%, rgba(99, 102, 241, 0.14) 50%, transparent 72%);
            filter: blur(28px);
            pointer-events: none;
            z-index: 0;
          }

          :root {
            --map-zoom-scale: 1;
          }

          /* Clean Marker Containers - Zero transforms on root to protect MapLibre anchor placement */
          .marker-container {
            user-select: none;
            cursor: pointer;
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

          /* Smooth Label Hiding when zoomed out so pins fit within city/country borders */
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

          /* Explosive Outward Burst for Expanded Cluster Items */
          .explode-bloom {
            animation: explodeOut 0.44s cubic-bezier(0.18, 0.92, 0.28, 1.26) forwards;
            will-change: transform, opacity;
          }
          @keyframes explodeOut {
            0% {
              opacity: 0.15;
              transform: translate(0px, 0px) scale(0.22);
            }
            64% {
              opacity: 1;
              transform: translate(calc(var(--target-x) * 1.18), calc(var(--target-y) * 1.18)) scale(1.08);
            }
            84% {
              transform: translate(calc(var(--target-x) * 0.96), calc(var(--target-y) * 0.96)) scale(0.98);
            }
            100% {
              opacity: 1;
              transform: translate(var(--target-x), var(--target-y)) scale(1);
            }
          }
          .stacked-return {
            animation: stackedReturnIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            will-change: transform, opacity;
          }
          @keyframes stackedReturnIn {
            0% { opacity: 0.2; transform: scale(0.4); }
            100% { opacity: 1; transform: scale(var(--map-zoom-scale, 1)); }
          }

          /* Pin Wrap allowing badge to protrude cleanly outside */
          .pin-wrap {
            position: relative;
            display: inline-flex;
            overflow: visible;
          }

          /* Overlapping Diamond Badge - Protrudes ~50% outside the corner like messaging online dot */
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

          /* User / People Marker (Circle - Made SMALLER: 36px x 36px) */
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

          /* Hangout Marker (Made BETTER & PROMINENT: 58px x 58px) */
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

          /* Event Marker (Made BIGGER: 80px x 52px) */
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

          /* Active selection glow in expanded state - Stays strictly in place with brilliant luminous aura */
          .active-pin {
            border-color: #ffffff !important;
            box-shadow: 0 0 28px #e8a736, 0 0 12px #ffffff, 0 0 45px rgba(232, 167, 54, 0.85) !important;
            outline: 2.5px solid #ffffff !important;
            outline-offset: 1px !important;
            z-index: 9999 !important;
          }
          .marker-container:has(.active-pin) {
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
        </style>
      </head>
      <body>
        ${isDark ? '<div class="cosmos-bg"><div class="cosmos-stars"></div><div class="cosmos-atmosphere"></div></div>' : ''}
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
            projection: { type: 'globe' },
            antialias: true
          });

          // Decremental smooth zoom scale calculation (Snapchat Bitmoji style)
          function updateZoomScale() {
            var z = map.getZoom();
            var minZ = 1.5;
            var maxZ = 13.0;
            var clampedZ = Math.max(minZ, Math.min(maxZ, z));
            var t = (clampedZ - minZ) / (maxZ - minZ);
            var smoothT = t * t * (3 - 2 * t);
            var scale = 0.44 + (1.0 - 0.44) * smoothT;
            document.documentElement.style.setProperty('--map-zoom-scale', scale.toFixed(3));

            // Smooth label hiding when zoomed out to keep globe clean and fit inside city/country borders
            if (z < 10.5) {
              document.body.classList.add('hide-labels');
            } else {
              document.body.classList.remove('hide-labels');
            }
          }

          map.on('zoom', updateZoomScale);
          updateZoomScale();

          // Style load: Set dark mode globe contrast and clean up labels
          map.on('style.load', function() {
            try {
              map.setProjection({ type: 'globe' });
            } catch(e) {}

            var isDark = ${isDark ? 'true' : 'false'};
            if (isDark) {
              try {
                if (map.getLayer('water')) {
                  map.setPaintProperty('water', 'fill-color', '#0e1d44');
                }
                if (map.getLayer('background')) {
                  map.setPaintProperty('background', 'background-color', '#131826');
                }
              } catch(e) {}
            }

            // Country Borders & Boundary Presentation:
            // 1. Hide state, county, maritime, and sub-national clutter
            // 2. Make country borders clearly visible, crisp, solid lines (removes blue dotted effect)
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
                    // Remove dotted / dashed pattern so lines are solid and clean
                    map.setPaintProperty(l.id, 'line-dasharray', null);
                  } catch(e) {
                    try { map.setPaintProperty(l.id, 'line-dasharray', [1, 0]); } catch(e2) {}
                  }
                  try {
                    // High-contrast visible borders: luminous white in dark mode, crisp slate in light mode
                    map.setPaintProperty(l.id, 'line-color', isDark ? 'rgba(255, 255, 255, 0.72)' : 'rgba(30, 41, 59, 0.80)');
                  } catch(e) {}
                  try {
                    var w = l.id.indexOf('z0-4') !== -1 ? 1.5 : 2.0;
                    map.setPaintProperty(l.id, 'line-width', w);
                  } catch(e) {}
                  try {
                    map.setPaintProperty(l.id, 'line-opacity', 0.95);
                  } catch(e) {}
                } else {
                  // Hide county, state, maritime, and sub-national clutter
                  try {
                    map.setLayoutProperty(l.id, 'visibility', 'none');
                  } catch(e) {}
                }
              });
            } catch(e) {}

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
                    ['get', 'name:latin'],
                    ['get', 'name']
                  ]);
                  map.setLayoutProperty(layerId, 'text-padding', 10);
                  map.setLayoutProperty(layerId, 'text-optional', true);
                } catch(e) {}
              }
            });
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
          var activeMarkers = [];
          var expandedMarkers = [];
          var prevItemCoords = {};
          var currentlyHiddenMarker = null;
          var userGpsMarker = null;
          var lastActionTime = 0;
          var reclusterTimer = null;
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

          function collapseExpanded() {
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

          // Clicking anywhere on map collapses expanded state and clears selection glow
          map.on('click', function(e) {
            if (Date.now() - lastActionTime < 450) {
              return;
            }
            window.pendingFocus = null;
            isProgrammaticFlight = false;
            collapseExpanded();
            window.clearHighlight();
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'map_click' }));
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
            pinWrapHtml += '<div class="' + pinClass + '">' + contentHtml + '</div>';
            if (isOverlapping && count > 1) {
              pinWrapHtml += '<div class="overlap-badge">✦ ' + count + '</div>';
            }
            pinWrapHtml += '</div>';

            var labelHtml = '<div class="' + labelClass + '">' + title + '</div>';

            inner.innerHTML = pinWrapHtml + labelHtml;
            container.appendChild(inner);

            return {
              container: container,
              inner: inner,
              pin: inner.querySelector('.' + pinClass)
            };
          }

          // Adaptive responsive layout calculation for exploded stack at same venue
          function computeAdaptiveOffsets(count) {
            var offsets = [];
            if (count <= 1) {
              return [{ dx: 0, dy: 0, delay: 0 }];
            }
            if (count === 2) {
              return [
                { dx: -56, dy: 0, delay: 0 },
                { dx: 56, dy: 0, delay: 35 }
              ];
            }
            if (count === 3) {
              var r = 66;
              return [
                { dx: 0, dy: -r, delay: 0 },
                { dx: Math.round(r * 0.866), dy: Math.round(r * 0.5), delay: 35 },
                { dx: Math.round(-r * 0.866), dy: Math.round(r * 0.5), delay: 70 }
              ];
            }
            if (count === 4) {
              var r = 78;
              return [
                { dx: 0, dy: -r, delay: 0 },
                { dx: r, dy: 0, delay: 25 },
                { dx: 0, dy: r, delay: 50 },
                { dx: -r, dy: 0, delay: 75 }
              ];
            }
            if (count === 5) {
              var r = 92;
              for (var i = 0; i < 5; i++) {
                var angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
                offsets.push({
                  dx: Math.round(Math.cos(angle) * r),
                  dy: Math.round(Math.sin(angle) * r),
                  delay: i * 22
                });
              }
              return offsets;
            }
            if (count <= 8) {
              var r = 48 + count * 10;
              for (var i = 0; i < count; i++) {
                var angle = (i / count) * 2 * Math.PI - Math.PI / 2;
                offsets.push({
                  dx: Math.round(Math.cos(angle) * r),
                  dy: Math.round(Math.sin(angle) * r),
                  delay: i * 20
                });
              }
              return offsets;
            }

            // Stacks with 9 to 20+ items: Concentric Dual Rings
            var innerCount = Math.max(3, Math.min(5, Math.round(count * 0.35)));
            var outerCount = count - innerCount;
            var rInner = 78;
            var rOuter = 152 + Math.min(outerCount * 3, 30);

            for (var i = 0; i < innerCount; i++) {
              var angle = (i / innerCount) * 2 * Math.PI - Math.PI / 2;
              offsets.push({
                dx: Math.round(Math.cos(angle) * rInner),
                dy: Math.round(Math.sin(angle) * rInner),
                delay: i * 18
              });
            }
            var phase = Math.PI / outerCount;
            for (var j = 0; j < outerCount; j++) {
              var angle = (j / outerCount) * 2 * Math.PI - Math.PI / 2 + phase;
              offsets.push({
                dx: Math.round(Math.cos(angle) * rOuter),
                dy: Math.round(Math.sin(angle) * rOuter),
                delay: 70 + j * 18
              });
            }
            return offsets;
          }

          // Expand overlapping elements with explosive burst outward from center point (NO orange dot!)
          function expandCluster(cluster, markerRef) {
            collapseExpanded();

            if (markerRef && markerRef._element) {
              markerRef._element.style.display = 'none';
              currentlyHiddenMarker = markerRef;
            }

            var items = cluster.items;
            var offsets = computeAdaptiveOffsets(items.length);

            items.forEach(function(item, idx) {
              var off = offsets[idx] || { dx: 0, dy: 0, delay: 0 };
              var itemDom = createItemDom(item, false, 1);

              itemDom.inner.style.setProperty('--target-x', off.dx + 'px');
              itemDom.inner.style.setProperty('--target-y', off.dy + 'px');
              itemDom.inner.style.animationDelay = off.delay + 'ms';
              itemDom.inner.classList.add('explode-bloom');

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

          var activeItemMarkers = [];

          // Continuous Smooth Clustering Function (Fish-Swarm Interpolation)
          // As user zooms out, elements smoothly converge toward their regional center like fish approaching food.
          // As user zooms in, they smoothly disperse into their exact venues. Rational number precise!
          function updateContinuousClustering() {
            if (!activeItemMarkers.length) return;
            var z = map.getZoom();
            var maxZ = 13.5;
            var minZ = 1.5;
            var t = Math.max(0, Math.min(1, (maxZ - z) / (maxZ - minZ)));
            var alpha = t * t * (3 - 2 * t) * 0.94; // Smooth cubic S-curve

            for (var i = 0; i < activeItemMarkers.length; i++) {
              var m = activeItemMarkers[i];
              var targetLng = m.centroidLng + m.scatterLng;
              var targetLat = m.centroidLat + m.scatterLat;
              var curLng = m.origLng + alpha * (targetLng - m.origLng);
              var curLat = m.origLat + alpha * (targetLat - m.origLat);
              m.marker.setLngLat([curLng, curLat]);
            }
          }

          // Dynamic Marker Rendering with Hierarchical Regional Clustering
          function renderMarkers() {
            if (!currentPayload) return;
            collapseExpanded();
            activeItemMarkers.forEach(function(m) { m.marker.remove(); });
            activeItemMarkers = [];

            var filter = currentPayload.filter || 'all';
            var allItems = [];

            if (filter === 'all' || filter === 'hangouts') {
              (currentPayload.hangouts || []).forEach(function(h) {
                if (h.location && typeof h.location.latitude === 'number' && typeof h.location.longitude === 'number') {
                  allItems.push(Object.assign({}, h, { entityType: 'hangout' }));
                }
              });
            }
            if (filter === 'all' || filter === 'events') {
              (currentPayload.events || []).forEach(function(e) {
                if (e.location && typeof e.location.latitude === 'number' && typeof e.location.longitude === 'number') {
                  allItems.push(Object.assign({}, e, { entityType: 'event' }));
                }
              });
            }
            if (filter === 'all' || filter === 'communities') {
              (currentPayload.communities || []).forEach(function(c) {
                if (c.location && typeof c.location.latitude === 'number' && typeof c.location.longitude === 'number') {
                  allItems.push(Object.assign({}, c, { entityType: 'community' }));
                }
              });
            }
            if (filter === 'all' || filter === 'users') {
              (currentPayload.users || []).forEach(function(u) {
                if (u.location && typeof u.location.latitude === 'number' && typeof u.location.longitude === 'number') {
                  allItems.push(Object.assign({}, u, { entityType: 'user' }));
                }
              });
            }

            // 1. Group items that share the EXACT same location into venue units
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

            // 2. Group venue units by regional proximity for continuous zoom clustering (~2.2 degrees)
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

            // 3. Build markers for each venue unit with continuous swarm metadata
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
                    // Zoomed out in regional cluster: fly directly into this venue's exact location!
                    map.flyTo({
                      center: [vu.lng, vu.lat],
                      zoom: 14.5,
                      speed: 1.2,
                      curve: 1.4,
                      essential: true
                    });
                  } else {
                    // At street level:
                    if (isOverlapping) {
                      // Items share exact same location: explode into radial expanded petal state!
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

            // Immediately apply smooth continuous clustering according to current map zoom
            updateZoomScale();
            updateContinuousClustering();

            // If a detail screen requested focus, automatically expand cluster & highlight target!
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
            renderMarkers();
          };

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
                // Target item belongs to a cluster: auto-expand cluster and activate selection glow on target pin!
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
                }, 100);
              } else {
                // Standalone item: activate selection glow directly!
                collapseExpanded();
                highlightPin(foundEntry.dom.pin);
                isProgrammaticFlight = false;
              }
            }

            var center = map.getCenter();
            var dist = Math.abs(center.lng - targetVu.lng) + Math.abs(center.lat - targetVu.lat);
            var zoom = map.getZoom();

            if (zoom >= 14 && dist < 0.005) {
              // Already at target location: expand & glow immediately!
              doExpandAndHighlight();
            } else {
              isProgrammaticFlight = true;
              map.once('moveend', function() {
                setTimeout(function() {
                  doExpandAndHighlight();
                }, 70);
              });
              map.flyTo({
                center: [targetVu.lng, targetVu.lat],
                zoom: 15.5,
                pitch: 35,
                speed: 1.3,
                curve: 1.4,
                essential: true
              });
              // Safety timeout in case moveend doesn't fire
              setTimeout(function() {
                if (isProgrammaticFlight) {
                  doExpandAndHighlight();
                }
              }, 2200);
            }

            return true;
          }

          // Programmatic focus & selection (e.g. forwarded by tapping location on a specific detail page)
          window.focusEntityOnMap = function(targetId, targetType, targetLat, targetLng) {
            window.pendingFocus = {
              id: targetId ? String(targetId) : '',
              type: targetType || '',
              lat: typeof targetLat === 'number' ? targetLat : null,
              lng: typeof targetLng === 'number' ? targetLng : null
            };
            performFocusEntity(targetId, targetType, targetLat, targetLng);
          };

          map.on('move', function() {
            updateContinuousClustering();
          });
          map.on('zoom', function() {
            updateZoomScale();
            updateContinuousClustering();
          });
          map.on('zoomstart', function() {
            if (isProgrammaticFlight) return;
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
        onLoadEnd={() => sendDataToWebView(mapData, filter)}
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

          {/* Refresh Map Data Button */}
          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: darkBrownBg, borderColor: yellowAccent + '50' }]}
            onPress={loadMapData}
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

      {/* Horizontally Scrollable Filter Category Chips */}
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
            filter === 'all' && [styles.filterChipActive, { backgroundColor: yellowAccent, borderColor: '#feba48' }],
          ]}
          onPress={() => handleFilterChange('all')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterText,
              { color: isDark ? '#d5c4b4' : '#695c50' },
              filter === 'all' && [styles.filterTextActive, { color: darkBrown }],
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {/* 2. Hangouts */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: darkBrownBg, borderColor: darkBrownBorder },
            filter === 'hangouts' && [styles.filterChipActive, { backgroundColor: yellowAccent, borderColor: '#feba48' }],
          ]}
          onPress={() => handleFilterChange('hangouts')}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="local-cafe"
            size={14}
            color={filter === 'hangouts' ? darkBrown : isDark ? '#d5c4b4' : '#695c50'}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.filterText,
              { color: isDark ? '#d5c4b4' : '#695c50' },
              filter === 'hangouts' && [styles.filterTextActive, { color: darkBrown }],
            ]}
          >
            Hangouts
          </Text>
        </TouchableOpacity>

        {/* 3. Events */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: darkBrownBg, borderColor: darkBrownBorder },
            filter === 'events' && [styles.filterChipActive, { backgroundColor: yellowAccent, borderColor: '#feba48' }],
          ]}
          onPress={() => handleFilterChange('events')}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="event"
            size={14}
            color={filter === 'events' ? darkBrown : isDark ? '#d5c4b4' : '#695c50'}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.filterText,
              { color: isDark ? '#d5c4b4' : '#695c50' },
              filter === 'events' && [styles.filterTextActive, { color: darkBrown }],
            ]}
          >
            Events
          </Text>
        </TouchableOpacity>

        {/* 4. Communities */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: darkBrownBg, borderColor: darkBrownBorder },
            filter === 'communities' && [styles.filterChipActive, { backgroundColor: yellowAccent, borderColor: '#feba48' }],
          ]}
          onPress={() => handleFilterChange('communities')}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="groups"
            size={14}
            color={filter === 'communities' ? darkBrown : isDark ? '#d5c4b4' : '#695c50'}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.filterText,
              { color: isDark ? '#d5c4b4' : '#695c50' },
              filter === 'communities' && [styles.filterTextActive, { color: darkBrown }],
            ]}
          >
            Communities
          </Text>
        </TouchableOpacity>

        {/* 5. People */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: darkBrownBg, borderColor: darkBrownBorder },
            filter === 'users' && [styles.filterChipActive, { backgroundColor: yellowAccent, borderColor: '#feba48' }],
          ]}
          onPress={() => handleFilterChange('users')}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="person"
            size={14}
            color={filter === 'users' ? darkBrown : isDark ? '#d5c4b4' : '#695c50'}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.filterText,
              { color: isDark ? '#d5c4b4' : '#695c50' },
              filter === 'users' && [styles.filterTextActive, { color: darkBrown }],
            ]}
          >
            People
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Snapchat-Style Sliding Entity Preview Card */}
      {selectedEntity && (
        <Animated.View
          style={[
            styles.previewCardWrap,
            {
              bottom: Math.max(insets.bottom, 16) + 56,
              transform: [{ translateY: cardSlideAnim }],
              backgroundColor: isDark ? '#1e1c1a' : colors.surfaceContainerLowest,
              borderColor: isDark ? '#38332d' : colors.cardBorder,
            },
          ]}
        >
          {/* Card Close */}
          <TouchableOpacity style={styles.cardCloseBtn} onPress={closeSelectedCard}>
            <MaterialIcons name="close" size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>

          <View style={styles.cardContentRow}>
            {/* Entity Avatar / Image */}
            <View style={styles.entityImageWrap}>
              {selectedEntity.type === 'user' ? (
                selectedEntity.data.profilePictureUrl ? (
                  <Image
                    source={{ uri: selectedEntity.data.profilePictureUrl }}
                    style={styles.entityImageRound}
                  />
                ) : (
                  <View
                    style={[
                      styles.entityImageRound,
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
                {selectedEntity.data.title || selectedEntity.data.name || selectedEntity.data.username}
              </Text>

              <View style={styles.locationPillRow}>
                <MaterialIcons name="place" size={13} color={colors.outline} style={{ marginRight: 3 }} />
                <Text style={[styles.entityLocationText, { color: colors.outline }]} numberOfLines={1}>
                  {selectedEntity.data.location?.name || 'Selected Area'}
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
    borderWidth: 1,
    ...Shadows.sm,
  },
  filterChipActive: {
    ...Shadows.md,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterTextActive: {
    fontWeight: '800',
  },
  previewCardWrap: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    ...Shadows.lg,
    zIndex: 110,
    borderWidth: 1,
  },
  cardCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  cardContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  entityImageWrap: {
    marginRight: Spacing.md,
  },
  entityImageRound: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  entityImageSquare: {
    width: 60,
    height: 60,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  entityImageRect: {
    width: 76,
    height: 54,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e8a736',
  },
  hangoutIconBox: {
    width: 60,
    height: 60,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entityInfoCol: {
    flex: 1,
    paddingRight: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  typeBadgeUser: {
    backgroundColor: 'rgba(232, 167, 54, 0.2)',
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
