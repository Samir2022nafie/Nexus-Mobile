/**
 * MapPickerModal — Interactive map modal to pick location with pin and search.
 * Uses OpenStreetMap tiles + Nominatim geocoding (100% free, zero billing).
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
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

  // Reverse geocode coords to place name (including real place name detection)
  const reverseGeocode = async (lat: number, lng: number, clickedPlaceName?: string) => {
    setIsReverseGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'NexusMobile/1.0',
            'Accept-Language': 'en',
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const venue =
          clickedPlaceName ||
          addr.amenity ||
          addr.leisure ||
          addr.building ||
          addr.tourism ||
          addr.shop ||
          addr.office ||
          addr.commercial ||
          addr.historic ||
          addr.club ||
          addr.craft ||
          (data.name && data.name !== addr.road && data.name !== addr.city && data.name !== addr.country ? data.name : '');

        const street = addr.road || addr.pedestrian || '';
        const suburb = addr.suburb || addr.neighbourhood || addr.city_district || '';
        const city = addr.city || addr.town || addr.village || addr.county || '';
        const country = addr.country || '';

        // Address parts preserving street, suburb, and city
        const addressParts: string[] = [];
        if (street) addressParts.push(street);
        else if (suburb) addressParts.push(suburb);
        if (city) addressParts.push(city);

        let baseAddress = addressParts.join(', ');
        if (!baseAddress) {
          if (data.display_name) {
            const parts = data.display_name.split(',').map((p: string) => p.trim());
            baseAddress = parts.slice(0, 2).join(', ');
          } else {
            baseAddress = country || 'Pinned Location';
          }
        }

        let formattedName = '';
        if (venue) {
          // If venue is not already included in baseAddress, prepend it
          if (!baseAddress.toLowerCase().includes(venue.toLowerCase())) {
            formattedName = `${venue}, ${baseAddress}`;
          } else {
            formattedName = baseAddress;
          }
        } else {
          formattedName = baseAddress;
        }

        setSelectedName(formattedName);
      }
    } catch (err) {
      console.error('Reverse geocode failed:', err);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Handle message from WebView Leaflet/MapLibre map
  const onWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'location_selected') {
        const lat = Number(data.lat.toFixed(6));
        const lng = Number(data.lng.toFixed(6));
        setSelectedCoords({ lat, lng });
        reverseGeocode(lat, lng, data.placeName);
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
      window.map.flyTo({ center: [20, 20], zoom: 1.45, pitch: 0, bearing: 0, essential: true });
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
  const mapStyleUrl = 'https://tiles.openfreemap.org/styles/liberty';  const mapHtml = useMemo(() => {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
        <link rel="preconnect" href="https://tiles.openfreemap.org" crossorigin />
        <link rel="dns-prefetch" href="https://tiles.openfreemap.org" />
        <link href="https://cdn.jsdelivr.net/npm/maplibre-gl@5.1.0/dist/maplibre-gl.css" rel="stylesheet" />
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
            background: transparent !important;
            contain: strict;
            transform: translate3d(0, 0, 0);
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
          }
          .maplibregl-ctrl-attrib,
          .maplibregl-ctrl-bottom-right,
          .maplibregl-ctrl-bottom-left,
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
            contain: strict;
          }
          .cosmos-stars {
            position: absolute;
            inset: -300px;
            contain: strict;
            will-change: transform;
            transform: translate3d(0, 0, 0);
            backface-visibility: hidden;
            background-image: 
              radial-gradient(1.8px 1.8px at 28px 36px, #ffffff, transparent),
              radial-gradient(2.2px 2.2px at 145px 78px, #ffffff, transparent),
              radial-gradient(1.5px 1.5px at 82px 185px, #ffffff, transparent),
              radial-gradient(2.4px 2.4px at 278px 128px, #ffffff, transparent),
              radial-gradient(1.6px 1.6px at 218px 288px, #ffffff, transparent),
              radial-gradient(1.4px 1.4px at 48px 258px, #ffffff, transparent),
              radial-gradient(2.1px 2.1px at 328px 218px, #ffffff, transparent),
              radial-gradient(1.7px 1.7px at 188px 348px, #ffffff, transparent),
              radial-gradient(2.3px 2.3px at 388px 308px, #ffffff, transparent),
              radial-gradient(1.5px 1.5px at 98px 418px, #ffffff, transparent);
            background-repeat: repeat;
            background-size: 420px 420px;
            opacity: 0.9;
            pointer-events: none;
            z-index: 0;
          }
          .globe-atmosphere-halo {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 92vmin;
            height: 92vmin;
            contain: strict;
            transform: translate3d(-50%, -50%, 0);
            backface-visibility: hidden;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(56, 189, 248, 0.40) 58%, rgba(14, 165, 233, 0.20) 72%, rgba(2, 132, 199, 0.05) 86%, transparent 100%);
            filter: blur(12px);
            pointer-events: none;
            z-index: 0;
            transition: opacity 0.4s ease;
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
        <div class="cosmos-bg">
          <div class="globe-atmosphere-halo"></div>
          <div class="cosmos-stars"></div>
        </div>
        <div id="map"></div>
        <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@5.1.0/dist/maplibre-gl.min.js"></script>
        <script>
          var map = new maplibregl.Map({
            container: 'map',
            style: '${mapStyleUrl}',
            center: [${initialLng}, ${initialLat}],
            zoom: 14,
            minZoom: 1.45,
            maxZoom: 20,
            projection: { type: 'globe' },
            antialias: false,
            fadeDuration: 0,
            trackResize: true,
            attributionControl: false,
            renderWorldCopies: false,
            maxParallelImageRequests: 16,
            crossSourceCollisions: false,
            refreshExpiredTiles: false
          });

          // Sync atmosphere halo on load
          var haloEl = document.querySelector('.globe-atmosphere-halo');
          if (haloEl && 14 > 5.5) {
            haloEl.style.opacity = '0';
          }

          function createOceanWavePattern() {
            var canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 32;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#070b11'; // deep black ocean background
            ctx.fillRect(0, 0, 64, 32);
            ctx.lineWidth = 3.2;
            ctx.strokeStyle = '#18283e'; // dark navy wave
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            [8, 24].forEach(function(baseY) {
              ctx.beginPath();
              for (var x = 0; x <= 64; x += 2) {
                var y = baseY + Math.sin((x / 64) * Math.PI * 2) * 4.2;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              }
              ctx.stroke();
            });
            return ctx.getImageData(0, 0, 64, 32);
          }

          map.on('style.load', function() {
            try {
              map.setProjection({ type: 'globe' });
            } catch(e) {}

            // Add seamless ocean wave pattern to MapLibre
            try {
              if (!map.hasImage('snap-ocean-waves')) {
                map.addImage('snap-ocean-waves', createOceanWavePattern());
              }
            } catch(e) {}

            // Single-pass optimization over layers for rapid rendering
            var hideLandIds = {
              'park': 1, 'park_outline': 1, 'park_national': 1, 'park_nature_reserve': 1,
              'landcover_wood': 1, 'landcover_grass': 1, 'landcover_wetland': 1,
              'landcover_scrub': 1, 'landcover_cemetery': 1, 'landcover_glacier': 1,
              'landuse_pitch': 1, 'landuse_track': 1, 'landuse_grass': 1,
              'landuse_residential': 1, 'landcover_sand': 1, 'landcover_ice': 1,
              'landuse_hospital': 1, 'landuse_school': 1, 'landuse_industrial': 1,
              'landuse_commercial': 1, 'boundary_disputed': 1
            };

            try {
              var styleLayers = (map.getStyle && map.getStyle().layers) || [];
              for (var i = 0; i < styleLayers.length; i++) {
                var l = styleLayers[i];
                var lid = l.id;
                if (l.type === 'raster' || lid.indexOf('natural_earth') !== -1 || lid.indexOf('hillshade') !== -1 || hideLandIds[lid] || lid.indexOf('park') !== -1 || lid.indexOf('garden') !== -1 || lid.indexOf('grass') !== -1) {
                  try { map.setLayoutProperty(lid, 'visibility', 'none'); } catch(e) {}
                } else if (l.type === 'line' && (lid.indexOf('road') !== -1 || lid.indexOf('highway') !== -1 || lid.indexOf('bridge') !== -1 || lid.indexOf('tunnel') !== -1)) {
                  try {
                    if (lid.indexOf('case') !== -1) {
                      map.setPaintProperty(lid, 'line-color', '#12171e');
                    } else if (lid.indexOf('motorway') !== -1 || lid.indexOf('trunk') !== -1) {
                      map.setPaintProperty(lid, 'line-color', '#2c3545');
                    } else if (lid.indexOf('primary') !== -1 || lid.indexOf('secondary') !== -1) {
                      map.setPaintProperty(lid, 'line-color', '#222b37');
                    } else {
                      map.setPaintProperty(lid, 'line-color', '#1a222b');
                    }
                    map.setPaintProperty(lid, 'line-opacity', 0.85);
                  } catch(e) {}
                }
              }
            } catch(e) {}

            // Continents: Dark slate grey (#28323c)
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
                map.setPaintProperty('water', 'fill-pattern', 'snap-ocean-waves');
              } catch(e) {
                try { map.setPaintProperty('water', 'fill-color', '#070b11'); } catch(e2) {}
              }
            }

            // Waterways
            ['waterway_river', 'waterway_tunnel', 'waterway_other'].forEach(function(id) {
              if (map.getLayer(id)) {
                try { map.setPaintProperty(id, 'line-color', '#18283e'); } catch(e) {}
              }
            });

            if (map.getLayer('building')) {
              try { map.setPaintProperty('building', 'fill-color', '#1e242c'); } catch(e) {}
            }
            if (map.getLayer('building-3d')) {
              try { map.setPaintProperty('building-3d', 'fill-extrusion-color', '#232b35'); } catch(e) {}
            }

            // Country & Region Boundaries
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

            // High-Contrast English Text Labels with Dark Halo
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

            // Native WebGL Selective Label Zoom Ranges (60 FPS on GPU)
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

            // Atmosphere Halo: Fades as user zooms into street level
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

            // Starry background smoothly tracks swiping / sliding gestures in real time
            var starEl = document.querySelector('.cosmos-stars');
            var lastParallaxX = -999;
            var lastParallaxY = -999;
            function updateCosmicParallax() {
              if (!starEl) starEl = document.querySelector('.cosmos-stars');
              if (!starEl) return;
              var center = map.getCenter();
              var bearing = map.getBearing() || 0;
              var pitch = map.getPitch() || 0;
              var shiftX = Math.round((center.lng * 2.8 + bearing * 1.2) % 240);
              var shiftY = Math.round((center.lat * 2.8 + pitch * 0.8) % 240);
              if (shiftX !== lastParallaxX || shiftY !== lastParallaxY) {
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
            map.on('moveend', scheduleCosmicParallax);
            map.on('rotate', scheduleCosmicParallax);
            map.on('pitch', scheduleCosmicParallax);
            updateCosmicParallax();

            // 3D extruded buildings (at zoom >= 15.0)
            try {
              if (!map.getLayer('building-3d') && map.getSource('openmaptiles')) {
                map.addLayer({
                  id: 'building-3d',
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

          function sendLocation(lat, lng, placeName) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'location_selected',
                lat: lat,
                lng: lng,
                placeName: placeName || ''
              }));
            }
          }

          map.on('click', function(e) {
            marker.setLngLat(e.lngLat);
            var clickedPlaceName = '';
            try {
              var bbox = [[e.point.x - 12, e.point.y - 12], [e.point.x + 12, e.point.y + 12]];
              var features = map.queryRenderedFeatures(bbox);
              if (features && features.length > 0) {
                for (var i = 0; i < features.length; i++) {
                  var f = features[i];
                  var p = f.properties || {};
                  var fn = p['name:en'] || p['name_en'] || p['name:latin'] || p['name'];
                  if (fn && f.layer && (f.layer.id.indexOf('poi') !== -1 || f.layer.id.indexOf('label') !== -1 || f.layer.id.indexOf('place') !== -1 || f.layer.type === 'symbol')) {
                    clickedPlaceName = fn;
                    break;
                  }
                }
              }
            } catch(err) {}

            sendLocation(e.lngLat.lat, e.lngLat.lng, clickedPlaceName);
          });

          marker.on('dragend', function() {
            var lngLat = marker.getLngLat();
            sendLocation(lngLat.lat, lngLat.lng, '');
          });
        </script>
      </body>
    </html>
    `;
  }, [initialLat, initialLng]);

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
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            cacheEnabled={true}
            androidLayerType="hardware"
            renderToHardwareTextureAndroid={true}
            overScrollMode="never"
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bounces={false}
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
                { backgroundColor: isDark ? '#201e1c' : '#ffffff', borderColor: isDark ? '#e8a73680' : '#e2e8f0' },
              ]}
              onPress={handleResetGlobe}
              activeOpacity={0.8}
            >
              <MaterialIcons name="public" size={20} color={isDark ? '#e8a736' : '#92400e'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.floatingControlBtn,
                { backgroundColor: isDark ? '#201e1c' : '#ffffff', borderColor: isDark ? '#e8a73680' : '#e2e8f0' },
              ]}
              onPress={handleFlyToGpsLocation}
              disabled={locatingGps || isLoadingLocation}
              activeOpacity={0.8}
            >
              {locatingGps || isLoadingLocation ? (
                <ActivityIndicator size="small" color={isDark ? '#e8a736' : '#92400e'} />
              ) : (
                <MaterialIcons name="my-location" size={20} color={isDark ? '#e8a736' : '#92400e'} />
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
