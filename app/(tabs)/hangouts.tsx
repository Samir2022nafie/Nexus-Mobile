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
import { useRouter } from 'expo-router';
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
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { userLocation, requestLocation, isLoadingLocation } = useUserLocation();
  const webViewRef = useRef<WebView>(null);

  const [filter, setFilter] = useState<FilterType>('all');
  const [mapData, setMapData] = useState<ExploreMapResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [locatingGps, setLocatingGps] = useState<boolean>(false);
  const [selectedEntity, setSelectedEntity] = useState<SelectedMapEntity | null>(null);

  // Bottom card slide animation
  const cardSlideAnim = useRef(new Animated.Value(300)).current;

  // Fetch explore map items from backend
  const loadMapData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await locationsService.getExploreMap();
      setMapData(data);
      sendDataToWebView(data, filter);
    } catch (err) {
      console.error('Failed to load explore map items:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  // Send data to WebView when mapData or filter changes
  const sendDataToWebView = (data: ExploreMapResponse | null, currentFilter: FilterType) => {
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
  };

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    sendDataToWebView(mapData, newFilter);
    closeSelectedCard();
  };

  const openSelectedCard = (entity: SelectedMapEntity) => {
    setSelectedEntity(entity);
    Animated.spring(cardSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 65,
    }).start();
  };

  const closeSelectedCard = () => {
    Animated.timing(cardSlideAnim, {
      toValue: 300,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setSelectedEntity(null));
  };

  // Handle message from WebView (e.g. marker tapped)
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
      }
    } catch (e) {
      console.error('WebView message parse error:', e);
    }
  };

  // Zoom into user's real phone GPS location
  const handleFlyToGpsLocation = async () => {
    setLocatingGps(true);
    try {
      const loc = await requestLocation(true);
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
    } finally {
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

  // 100% Free OpenFreeMap vector styles (No API keys, no registration, no watermarks, unlimited)
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
          body, html, #map { width: 100%; height: 100%; overflow: hidden; background: #141312; }
          .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-bottom-left { display: none !important; }

          /* Snapchat-style glowing markers */
          .marker-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            user-select: none;
          }
          .marker-wrap:active {
            transform: scale(0.92);
          }

          /* User / People Marker (Circle with Profile Picture) */
          .user-pin {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            border: 2.5px solid #8b5cf6;
            background: #201e1c;
            box-shadow: 0 0 16px rgba(139, 92, 246, 0.7);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .user-pin img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .user-avatar-fallback {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #38332d;
            color: #feba48;
            font-size: 18px;
            font-weight: 800;
          }
          .user-label {
            margin-top: 4px;
            background: rgba(32, 30, 28, 0.9);
            backdrop-filter: blur(8px);
            color: #ffffff;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 12px;
            border: 1px solid rgba(139, 92, 246, 0.4);
            white-space: nowrap;
            max-width: 95px;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* Hangout Marker (Square with rounded edges & Banner Picture) */
          .hangout-pin {
            width: 52px;
            height: 52px;
            border-radius: 14px;
            border: 2.5px solid #10b981;
            background: #201e1c;
            box-shadow: 0 0 16px rgba(16, 185, 129, 0.7);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          }
          .hangout-pin img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .hangout-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #064e3b;
            color: #34d399;
            font-size: 24px;
          }
          .hangout-label {
            margin-top: 4px;
            background: rgba(32, 30, 28, 0.9);
            backdrop-filter: blur(8px);
            color: #34d399;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 12px;
            border: 1px solid rgba(16, 185, 129, 0.4);
            white-space: nowrap;
            max-width: 100px;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* Event Marker (Rectangular with Banner Picture) */
          .event-pin {
            width: 66px;
            height: 44px;
            border-radius: 10px;
            border: 2.5px solid #e8a736;
            background: #201e1c;
            box-shadow: 0 0 16px rgba(232, 167, 54, 0.7);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          }
          .event-pin img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .event-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #5f3f00;
            color: #feba48;
            font-size: 20px;
          }
          .event-label {
            margin-top: 4px;
            background: rgba(32, 30, 28, 0.9);
            backdrop-filter: blur(8px);
            color: #feba48;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 12px;
            border: 1px solid rgba(232, 167, 54, 0.4);
            white-space: nowrap;
            max-width: 105px;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* Community Marker */
          .community-pin {
            width: 50px;
            height: 50px;
            border-radius: 14px;
            border: 2.5px solid #3b82f6;
            background: #201e1c;
            box-shadow: 0 0 16px rgba(59, 130, 246, 0.7);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .community-pin img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .community-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #1e3a8a;
            color: #60a5fa;
            font-size: 22px;
          }
          .community-label {
            margin-top: 4px;
            background: rgba(32, 30, 28, 0.9);
            backdrop-filter: blur(8px);
            color: #60a5fa;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 12px;
            border: 1px solid rgba(59, 130, 246, 0.4);
            white-space: nowrap;
            max-width: 105px;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* Pulsing User Real Phone GPS Marker */
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
        <div id="map"></div>
        <script src="https://unpkg.com/maplibre-gl@5.1.0/dist/maplibre-gl.js"></script>
        <script>
          // Initialize MapLibre GL v5 with native 3D Globe Projection
          var map = new maplibregl.Map({
            container: 'map',
            style: '${mapStyleUrl}',
            center: [20, 20],
            zoom: 1.5,
            projection: { type: 'globe' },
            antialias: true
          });

          // Ensure globe projection when style is loaded
          map.on('style.load', function() {
            try {
              map.setProjection({ type: 'globe' });
            } catch(e) {
              console.log('Globe projection error:', e);
            }
          });

          // Reset to 3D Globe
          window.resetToGlobe = function() {
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

          // Fallback to OSM raster tiles if vector style is unreachable
          map.on('error', function(err) {
            if (err && err.error && err.error.message && err.error.message.includes('style')) {
              console.warn('Fallback to standard OSM raster layer');
              map.setStyle({
                version: 8,
                sources: {
                  'osm-tiles': {
                    type: 'raster',
                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: ''
                  }
                },
                layers: [{ id: 'osm-layer', type: 'raster', source: 'osm-tiles' }]
              });
            }
          });

          window.map = map;
          var activeMarkers = [];
          var userGpsMarker = null;

          // User Real Phone GPS Marker
          window.setUserGpsMarker = function(lat, lng) {
            if (userGpsMarker) {
              userGpsMarker.remove();
            }
            var el = document.createElement('div');
            el.className = 'gps-pin-wrap';
            el.innerHTML = '<div class="gps-pin-pulse"></div><div class="gps-pin-center"></div>';
            userGpsMarker = new maplibregl.Marker({ element: el })
              .setLngLat([lng, lat])
              .addTo(map);
          };

          map.on('click', function(e) {
            if (e.originalEvent.target.closest('.marker-wrap')) return;
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

          // Dynamic Marker Rendering
          window.updateMapMarkers = function(payload) {
            activeMarkers.forEach(function(m) { m.remove(); });
            activeMarkers = [];

            var filter = payload.filter || 'all';

            // 1. Hangouts (Square with rounded edges, Banner or Coffee placeholder)
            if (filter === 'all' || filter === 'hangouts') {
              (payload.hangouts || []).forEach(function(h) {
                if (!h.location || !h.location.latitude || !h.location.longitude) return;
                var el = document.createElement('div');
                el.className = 'marker-wrap';
                var banner = h.coverImageUrl || h.bannerUrl || h.cover_image_url;
                var innerHtml = banner
                  ? '<img src="' + banner + '" />'
                  : '<div class="hangout-placeholder">☕</div>';
                el.innerHTML = '<div class="hangout-pin">' + innerHtml + '</div><div class="hangout-label">' + h.title + '</div>';
                el.addEventListener('click', function(ev) {
                  ev.stopPropagation();
                  map.flyTo({ center: [h.location.longitude, h.location.latitude], zoom: Math.max(map.getZoom(), 13), essential: true });
                  sendMarkerClick('hangout', h);
                });
                var marker = new maplibregl.Marker({ element: el })
                  .setLngLat([h.location.longitude, h.location.latitude])
                  .addTo(map);
                activeMarkers.push(marker);
              });
            }

            // 2. Events (Rectangular, Banner or Calendar placeholder)
            if (filter === 'all' || filter === 'events') {
              (payload.events || []).forEach(function(e) {
                if (!e.location || !e.location.latitude || !e.location.longitude) return;
                var el = document.createElement('div');
                el.className = 'marker-wrap';
                var banner = e.coverImageUrl || e.bannerUrl || e.cover_image_url;
                var innerHtml = banner
                  ? '<img src="' + banner + '" />'
                  : '<div class="event-placeholder">🎟️</div>';
                el.innerHTML = '<div class="event-pin">' + innerHtml + '</div><div class="event-label">' + e.title + '</div>';
                el.addEventListener('click', function(ev) {
                  ev.stopPropagation();
                  map.flyTo({ center: [e.location.longitude, e.location.latitude], zoom: Math.max(map.getZoom(), 13), essential: true });
                  sendMarkerClick('event', e);
                });
                var marker = new maplibregl.Marker({ element: el })
                  .setLngLat([e.location.longitude, e.location.latitude])
                  .addTo(map);
                activeMarkers.push(marker);
              });
            }

            // 3. Communities
            if (filter === 'all' || filter === 'communities') {
              (payload.communities || []).forEach(function(c) {
                if (!c.location || !c.location.latitude || !c.location.longitude) return;
                var el = document.createElement('div');
                el.className = 'marker-wrap';
                var pic = c.profilePictureUrl || c.bannerUrl;
                var iconHtml = pic
                  ? '<img src="' + pic + '" />'
                  : '<div class="community-placeholder">🌐</div>';
                el.innerHTML = '<div class="community-pin">' + iconHtml + '</div><div class="community-label">' + c.name + '</div>';
                el.addEventListener('click', function(ev) {
                  ev.stopPropagation();
                  map.flyTo({ center: [c.location.longitude, c.location.latitude], zoom: Math.max(map.getZoom(), 13), essential: true });
                  sendMarkerClick('community', c);
                });
                var marker = new maplibregl.Marker({ element: el })
                  .setLngLat([c.location.longitude, c.location.latitude])
                  .addTo(map);
                activeMarkers.push(marker);
              });
            }

            // 4. People (Users - Circle, Profile Picture or Initials placeholder)
            if (filter === 'all' || filter === 'users') {
              (payload.users || []).forEach(function(u) {
                if (!u.location || !u.location.latitude || !u.location.longitude) return;
                var el = document.createElement('div');
                el.className = 'marker-wrap';
                var initial = (u.name || u.username || 'U').charAt(0).toUpperCase();
                var innerHtml = u.profilePictureUrl
                  ? '<img src="' + u.profilePictureUrl + '" />'
                  : '<div class="user-avatar-fallback">' + initial + '</div>';
                el.innerHTML = '<div class="user-pin">' + innerHtml + '</div><div class="user-label">' + (u.name || u.username) + '</div>';
                el.addEventListener('click', function(ev) {
                  ev.stopPropagation();
                  map.flyTo({ center: [u.location.longitude, u.location.latitude], zoom: Math.max(map.getZoom(), 13), essential: true });
                  sendMarkerClick('user', u);
                });
                var marker = new maplibregl.Marker({ element: el })
                  .setLngLat([u.location.longitude, u.location.latitude])
                  .addTo(map);
                activeMarkers.push(marker);
              });
            }
          };

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
                <Image
                  source={{
                    uri:
                      selectedEntity.data.profilePictureUrl ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
                  }}
                  style={styles.entityImageRound}
                />
              ) : selectedEntity.type === 'community' ? (
                <Image
                  source={{
                    uri:
                      selectedEntity.data.profilePictureUrl ||
                      selectedEntity.data.bannerUrl ||
                      'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=200',
                  }}
                  style={styles.entityImageSquare}
                />
              ) : selectedEntity.type === 'event' ? (
                <Image
                  source={{
                    uri:
                      selectedEntity.data.coverImageUrl ||
                      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200',
                  }}
                  style={styles.entityImageRect}
                />
              ) : (
                <Image
                  source={{
                    uri:
                      selectedEntity.data.coverImageUrl ||
                      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200',
                  }}
                  style={styles.entityImageSquare}
                />
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
    borderColor: '#8b5cf6',
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
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
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
