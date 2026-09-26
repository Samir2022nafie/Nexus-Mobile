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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

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
  const webViewRef = useRef<WebView>(null);

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

    // Pan map
    const script = `if (window.map) { window.map.setView([${lat}, ${lng}], 15); if (window.marker) window.marker.setLatLng([${lat}, ${lng}]); } true;`;
    webViewRef.current?.injectJavaScript(script);
  };

  const handleConfirm = () => {
    onSelect({
      name: selectedName || 'Selected Location',
      latitude: selectedCoords.lat,
      longitude: selectedCoords.lng,
    });
    onClose();
  };

  const initialLat = initialLocation?.latitude ?? 40.7128;
  const initialLng = initialLocation?.longitude ?? -74.006;
  // 100% Free OpenStreetMap standard tiles (Zero API keys, zero watermarks)
  const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const mapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body, html, #map { width: 100%; height: 100%; background: ${isDark ? '#121212' : '#f5f5f5'}; overflow: hidden; }
          ${isDark ? `
          .leaflet-tile-pane {
            filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(110%);
          }
          ` : ''}
          .custom-pin {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #8b5cf6;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 12px rgba(139, 92, 246, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .custom-pin::after {
            content: '';
            width: 10px;
            height: 10px;
            background: #ffffff;
            border-radius: 50%;
          }
          .leaflet-control-attribution { display: none !important; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          var map = L.map('map', {
            zoomControl: false,
            attributionControl: false
          }).setView([${initialLat}, ${initialLng}], 14);

          L.tileLayer('${tileUrl}', {
            maxZoom: 19,
            subdomains: 'abc'
          }).addTo(map);

          var pinIcon = L.divIcon({
            className: 'custom-pin-wrap',
            html: '<div class="custom-pin"></div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          var marker = L.marker([${initialLat}, ${initialLng}], {
            icon: pinIcon,
            draggable: true
          }).addTo(map);

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
            marker.setLatLng(e.latlng);
            sendLocation(e.latlng.lat, e.latlng.lng);
          });

          marker.on('dragend', function(e) {
            var latlng = marker.getLatLng();
            sendLocation(latlng.lat, latlng.lng);
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
