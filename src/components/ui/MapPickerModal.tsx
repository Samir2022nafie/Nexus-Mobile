/**
 * MapPickerModal — Interactive map modal to pick location with pin and search.
 * Uses OpenStreetMap tiles + Nominatim geocoding (100% free, zero billing).
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useUserLocation } from '../../context/LocationContext';

export interface LocationResult {
  name: string;
  latitude: number;
  longitude: number;
}

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: LocationResult) => void;
  initialLocation?: {
    latitude?: number | null;
    longitude?: number | null;
    name?: string | null;
  };
  title?: string;
}

export const MapPickerModal: React.FC<MapPickerModalProps> = ({
  visible,
  onClose,
  onSelect,
  initialLocation,
  title = 'Select Location',
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { userLocation, requestLocation, isLoadingLocation } = useUserLocation();
  const webViewRef = useRef<WebView>(null);
  const [locatingGps, setLocatingGps] = useState<boolean>(false);

  // Selected state
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLocation?.latitude ?? 40.7128,
    lng: initialLocation?.longitude ?? -74.006,
  });
  const [selectedName, setSelectedName] = useState<string>(initialLocation?.name || 'Selected Location');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      const lat = initialLocation?.latitude ?? 40.7128;
      const lng = initialLocation?.longitude ?? -74.006;
      setSelectedCoords({ lat, lng });
      setSelectedName(initialLocation?.name || '');
      setShowSearchResults(false);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [visible, initialLocation]);

  // Search Nominatim for places
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setShowSearchResults(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery.trim(),
        )}&limit=5&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'HobbyHubMobile/1.0',
            'Accept-Language': 'en',
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Reverse geocode coords to place name
  const reverseGeocode = async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'HobbyHubMobile/1.0',
            'Accept-Language': 'en',
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const venue =
          addr.amenity ||
          addr.leisure ||
          addr.building ||
          addr.tourism ||
          addr.shop ||
          addr.office ||
          data.name;

        const street = addr.road || addr.pedestrian || addr.suburb || '';
        const city = addr.city || addr.town || addr.village || addr.county || '';
        const country = addr.country || '';

        let formattedName = '';
        if (venue) {
          formattedName = city ? `${venue}, ${city}` : venue;
        } else if (street && city) {
          formattedName = `${street}, ${city}`;
        } else if (data.display_name) {
          // Take first two parts of display name
          const parts = data.display_name.split(',').map((p: string) => p.trim());
          formattedName = parts.slice(0, 2).join(', ');
        } else {
          formattedName = city || country || 'Pinned Location';
        }

        setSelectedName(formattedName);
      }
    } catch (err) {
      console.error('Reverse geocode failed:', err);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Handle message from WebView Leaflet map
  const onWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'location_selected') {
        const lat = Number(data.lat.toFixed(6));
        const lng = Number(data.lng.toFixed(6));
        setSelectedCoords({ lat, lng });
        reverseGeocode(lat, lng);
      }
    } catch (e) {
      console.error('WebView message parse error:', e);
    }
  };

  // User selects search result
  const handleSelectSearchResult = (item: any) => {
    const lat = Number(parseFloat(item.lat).toFixed(6));
    const lng = Number(parseFloat(item.lon).toFixed(6));
    const parts = (item.display_name || '').split(',').map((p: string) => p.trim());
    const name = parts.slice(0, 2).join(', ') || item.name || 'Selected Place';

    setSelectedCoords({ lat, lng });
    setSelectedName(name);
    setShowSearchResults(false);
    setSearchQuery('');

    // Pan map to new search selection
    const script = `if (window.map) {
      window.map.flyTo({ center: [${lng}, ${lat}], zoom: 15, essential: true });
      if (window.marker) window.marker.setLngLat([${lng}, ${lat}]);
    } true;`;
    webViewRef.current?.injectJavaScript(script);
  };

  const handleFlyToGpsLocation = async () => {
    if (userLocation?.latitude && userLocation?.longitude) {
      const lat = userLocation.latitude;
      const lng = userLocation.longitude;
      setSelectedCoords({ lat, lng });
      reverseGeocode(lat, lng);
      const js = `if (window.map) {
        window.map.flyTo({ center: [${lng}, ${lat}], zoom: 15, essential: true });
        if (window.marker) window.marker.setLngLat([${lng}, ${lat}]);
      } true;`;
      webViewRef.current?.injectJavaScript(js);
    }
    setLocatingGps(true);
    try {
      const loc = await requestLocation(true, true);
      if (loc?.latitude && loc?.longitude) {
        setSelectedCoords({ lat: loc.latitude, lng: loc.longitude });
        reverseGeocode(loc.latitude, loc.longitude);
        const js = `if (window.map) {
          window.map.flyTo({ center: [${loc.longitude}, ${loc.latitude}], zoom: 15, essential: true });
          if (window.marker) window.marker.setLngLat([${loc.longitude}, ${loc.latitude}]);
        } true;`;
        webViewRef.current?.injectJavaScript(js);
      }
    } catch (e) {
      console.warn('GPS location error in picker:', e);
    } finally {
      setLocatingGps(false);
    }
  };

  const handleResetGlobe = () => {
    const js = `if (window.map) {
      window.map.flyTo({ center: [20, 20], zoom: 1.5, pitch: 0, bearing: 0, essential: true });
    } true;`;
    webViewRef.current?.injectJavaScript(js);
  };

  const handleConfirm = () => {
    if (Math.abs(selectedCoords.lat) < 0.5 && Math.abs(selectedCoords.lng) < 0.5) {
      Alert.alert('Invalid Location', 'Locations cannot be placed on the ocean. Please select a valid place on land.');
      return;
    }
    onSelect({
      name: selectedName || 'Selected Location',
      latitude: selectedCoords.lat,
      longitude: selectedCoords.lng,
    });
    onClose();
  };

  const initialLat = initialLocation?.latitude ?? 40.7128;
  const initialLng = initialLocation?.longitude ?? -74.006;
  const mapStyleUrl = 'https://tiles.openfreemap.org/styles/liberty';

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

          ${isDark ? `
          .maplibregl-canvas {
            filter: invert(90%) hue-rotate(180deg) brightness(95%) contrast(92%);
          }
          ` : ''}

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

          /* Interactive Location Pin (Explore/Nexus Gold Pin) - Anchored at tip via MapLibre anchor: bottom */
          .picker-pin-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: grab;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
          }
          .picker-pin-wrap:active { cursor: grabbing; }
          .picker-pin-body {
            width: 38px;
            height: 38px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            background: #e8a736;
            border: 2.5px solid #ffffff;
            box-shadow: 0 4px 16px rgba(232, 167, 54, 0.75);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .picker-pin-inner {
            transform: rotate(45deg);
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #201e1c;
          }
          .picker-pin-shadow {
            width: 18px;
            height: 6px;
            background: rgba(0, 0, 0, 0.4);
            border-radius: 50%;
            margin-top: 3px;
          }
        </style>
      </head>
      <body>
        ${isDark ? '<div class="cosmos-bg"><div class="cosmos-stars"></div><div class="cosmos-atmosphere"></div></div>' : ''}
        <div id="map"></div>
        <script src="https://unpkg.com/maplibre-gl@5.1.0/dist/maplibre-gl.js"></script>
        <script>
          var map = new maplibregl.Map({
            container: 'map',
            style: '${mapStyleUrl}',
            center: [${initialLng}, ${initialLat}],
            zoom: 14,
            projection: { type: 'globe' },
            antialias: true
          });

          map.on('style.load', function() {
            try {
              map.setProjection({ type: 'globe' });
            } catch(e) {}

            var isDark = ${isDark ? 'true' : 'false'};

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

            // Clean progressive labels
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

          var pinEl = document.createElement('div');
          pinEl.className = 'picker-pin-wrap';
          pinEl.innerHTML = '<div class="picker-pin-body"><div class="picker-pin-inner"></div></div><div class="picker-pin-shadow"></div>';

          var marker = new maplibregl.Marker({
            element: pinEl,
            anchor: 'bottom',
            draggable: true
          })
            .setLngLat([${initialLng}, ${initialLat}])
            .addTo(map);

          window.map = map;
          window.marker = marker;

          function sendLocation(lat, lng) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'location_selected',
                lat: lat,
                lng: lng
              }));
            }
          }

          map.on('click', function(e) {
            marker.setLngLat(e.lngLat);
            sendLocation(e.lngLat.lat, e.lngLat.lng);
          });

          marker.on('dragend', function() {
            var lngLat = marker.getLngLat();
            sendLocation(lngLat.lat, lngLat.lng);
          });
        </script>
      </body>
    </html>
  `;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        {/* Top Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16), backgroundColor: colors.surfaceContainerLowest }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <MaterialIcons name="close" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.surfaceContainerLowest }]}>
          <View style={[styles.searchBar, { backgroundColor: colors.surfaceContainerLow }]}>
            <MaterialIcons name="search" size={20} color={colors.onSurfaceVariant} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: colors.onSurface }]}
              placeholder="Search place, street, or city..."
              placeholderTextColor={colors.outline}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {isSearching ? (
              <ActivityIndicator size="small" color={colors.primaryContainer} />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="clear" size={18} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Search Results Overlay */}
        {showSearchResults && searchResults.length > 0 && (
          <View style={[styles.resultsOverlay, { backgroundColor: colors.surfaceContainerLowest }]}>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => String(item.place_id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.resultItem, { borderBottomColor: colors.surfaceContainerHigh }]}
                  onPress={() => handleSelectSearchResult(item)}
                >
                  <MaterialIcons name="place" size={20} color={colors.primaryContainer} style={{ marginRight: 10 }} />
                  <Text style={[styles.resultText, { color: colors.onSurface }]} numberOfLines={2}>
                    {item.display_name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Map View */}
        <View style={styles.mapWrapper}>
          <WebView
            ref={webViewRef}
            source={{ html: mapHtml }}
            style={styles.webView}
            onMessage={onWebViewMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />

          <View style={styles.instructionsBadge}>
            <MaterialIcons name="touch-app" size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.instructionsText}>Tap map or drag pin to choose location</Text>
          </View>

          {/* Floating Actions: Reset to Globe and Current Phone GPS */}
          <View style={styles.floatingControls}>
            <TouchableOpacity
              style={[
                styles.floatingControlBtn,
                { backgroundColor: isDark ? '#201e1c' : '#ffffff', borderColor: '#e8a73680' },
              ]}
              onPress={handleResetGlobe}
              activeOpacity={0.8}
            >
              <MaterialIcons name="public" size={20} color="#e8a736" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.floatingControlBtn,
                { backgroundColor: isDark ? '#201e1c' : '#ffffff', borderColor: '#e8a73680' },
              ]}
              onPress={handleFlyToGpsLocation}
              disabled={locatingGps || isLoadingLocation}
              activeOpacity={0.8}
            >
              {locatingGps || isLoadingLocation ? (
                <ActivityIndicator size="small" color="#e8a736" />
              ) : (
                <MaterialIcons name="my-location" size={20} color="#e8a736" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Selection Sheet */}
        <View
          style={[
            styles.bottomSheet,
            {
              backgroundColor: colors.surfaceContainerLowest,
              paddingBottom: Math.max(insets.bottom, 16),
              borderTopColor: colors.surfaceContainerHigh,
            },
          ]}
        >
          <View style={styles.selectionInfoRow}>
            <View style={[styles.locationIconWrap, { backgroundColor: colors.primaryContainer + '20' }]}>
              <MaterialIcons name="location-on" size={26} color={colors.primaryContainer} />
            </View>
            <View style={styles.locationTextWrap}>
              <Text style={[styles.locationLabel, { color: colors.onSurfaceVariant }]}>Selected Place</Text>
              {isReverseGeocoding ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <ActivityIndicator size="small" color={colors.primaryContainer} style={{ marginRight: 8 }} />
                  <Text style={[styles.loadingText, { color: colors.outline }]}>Finding address...</Text>
                </View>
              ) : (
                <Text style={[styles.locationName, { color: colors.onSurface }]} numberOfLines={2}>
                  {selectedName || 'Selected Location'}
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: colors.primaryContainer }]}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <MaterialIcons name="check" size={20} color={colors.onPrimary} style={{ marginRight: 8 }} />
            <Text style={[styles.confirmButtonText, { color: colors.onPrimary }]}>Select This Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.titleMd,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMd,
    paddingVertical: 0,
  },
  resultsOverlay: {
    position: 'absolute',
    top: 110,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 99,
    borderRadius: BorderRadius.md,
    maxHeight: 220,
    ...Shadows.md,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  resultText: {
    ...Typography.bodySm,
    flex: 1,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  instructionsBadge: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    ...Shadows.sm,
  },
  instructionsText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  floatingControls: {
    position: 'absolute',
    right: 14,
    top: 14,
    flexDirection: 'column',
    gap: 10,
    zIndex: 10,
  },
  floatingControlBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    ...Shadows.md,
  },
  bottomSheet: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    ...Shadows.md,
  },
  selectionInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  locationIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  locationTextWrap: {
    flex: 1,
  },
  locationLabel: {
    ...Typography.captionSm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  locationName: {
    ...Typography.titleMd,
    fontWeight: '700',
    marginTop: 2,
  },
  loadingText: {
    ...Typography.bodySm,
  },
  confirmButton: {
    flexDirection: 'row',
    height: 50,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  confirmButtonText: {
    ...Typography.labelLg,
    fontWeight: '700',
  },
});
