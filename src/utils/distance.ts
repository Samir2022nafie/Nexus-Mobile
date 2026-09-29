/**
 * Distance and Location-Based Sorting Utilities
 * Uses the Haversine formula to compute great-circle distance between two GPS coordinates.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculates distance between two points on Earth in kilometers.
 */
export function getDistanceInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return Infinity;
  }

  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Human-readable distance text (e.g. "450 m away", "2.4 km away")
 */
export function formatDistance(distanceKm: number): string {
  if (!isFinite(distanceKm) || distanceKm === Infinity) return '';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

export function extractItemCoordinates(item: any): Coordinates | null {
  if (!item) return null;

  // Verify that a location was actually inputted
  const locVal = item.location;
  const locName =
    typeof locVal === 'string'
      ? locVal.trim()
      : (locVal?.name || locVal?.place_name || item.locationName || '').trim();

  // Direct lat/lng
  const rawLat =
    item.location?.latitude ??
    item.latitude ??
    item.lat;
  const rawLng =
    item.location?.longitude ??
    item.longitude ??
    item.lng ??
    item.lon;

  if (rawLat === undefined || rawLng === undefined || rawLat === null || rawLng === null) {
    return null;
  }

  const lat = typeof rawLat === 'number' ? rawLat : parseFloat(rawLat);
  const lng = typeof rawLng === 'number' ? rawLng : parseFloat(rawLng);

  if (isNaN(lat) || isNaN(lng)) return null;

  // If item has no location name inputted and coordinates are 0,0 or missing, omit
  if (!locName && Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001) {
    return null;
  }

  return { latitude: lat, longitude: lng };
}

/**
 * Checks whether an event or hangout has already passed.
 */
export function isItemPassed(item: any): boolean {
  const rawStarts = item.startsAt || item.starts_at;
  const rawEnds = item.endsAt || item.ends_at;
  if (!rawStarts) return false;

  const now = new Date();
  const startDate = new Date(rawStarts);
  const endDate = rawEnds ? new Date(rawEnds) : null;

  const cutoff = endDate || new Date(startDate.getTime() + 3 * 3600 * 1000);
  return cutoff < now;
}

/**
 * Calculates absolute time difference in milliseconds between item's start time and current time.
 */
function getStartTimeDifference(item: any): number {
  const rawStarts = item.startsAt || item.starts_at;
  if (!rawStarts) return 9999999999999;
  const start = new Date(rawStarts).getTime();
  const now = Date.now();
  // Upcoming events in near future get priority over distant future
  const diff = start - now;
  return diff >= 0 ? diff : Math.abs(diff) + 100000000000;
}

/**
 * Smart Sorting for Events and Hangouts:
 * 1. Active/Upcoming items are placed before Passed items.
 * 2. If user GPS location is provided:
 *    - Order by distance (closest first).
 *    - Tiebreaker: closest upcoming start date/time.
 * 3. If no GPS location or no coordinates:
 *    - Order by closest upcoming start date/time.
 * 4. Passed items are placed at the bottom, ordered by recent date.
 */
export function sortItemsByLocationAndDate<T = any>(
  items: T[],
  userLocation?: Coordinates | null
): T[] {
  if (!Array.isArray(items)) return [];

  return [...items].sort((a: any, b: any) => {
    const aPassed = isItemPassed(a);
    const bPassed = isItemPassed(b);

    // Passed items always go to the bottom
    if (aPassed && !bPassed) return 1;
    if (!aPassed && bPassed) return -1;

    // Both are passed: sort by start date descending (most recently passed first)
    if (aPassed && bPassed) {
      const aTime = new Date(a.startsAt || a.starts_at || 0).getTime();
      const bTime = new Date(b.startsAt || b.starts_at || 0).getTime();
      return bTime - aTime;
    }

    // Both are upcoming/active:
    if (userLocation) {
      const aCoords = extractItemCoordinates(a);
      const bCoords = extractItemCoordinates(b);

      const aDist = aCoords
        ? getDistanceInKm(userLocation.latitude, userLocation.longitude, aCoords.latitude, aCoords.longitude)
        : Infinity;
      const bDist = bCoords
        ? getDistanceInKm(userLocation.latitude, userLocation.longitude, bCoords.latitude, bCoords.longitude)
        : Infinity;

      // Both have distances and they differ
      if (isFinite(aDist) && isFinite(bDist)) {
        const diff = aDist - bDist;
        if (Math.abs(diff) > 0.05) { // 50-meter threshold for equality
          return diff;
        }
      } else if (isFinite(aDist) && !isFinite(bDist)) {
        return -1; // a has coordinates, b doesn't
      } else if (!isFinite(aDist) && isFinite(bDist)) {
        return 1; // b has coordinates, a doesn't
      }
    }

    // Tiebreaker or when location is not available: sort by start date near now
    const aTimeDiff = getStartTimeDifference(a);
    const bTimeDiff = getStartTimeDifference(b);
    return aTimeDiff - bTimeDiff;
  });
}

/**
 * Smart Sorting for Communities:
 * - Ordered by distance to user GPS location (closest first).
 * - Communities without location placed after.
 * - Tiebreaker: member count or name.
 */
export function sortCommunitiesByLocation<T = any>(
  communities: T[],
  userLocation?: Coordinates | null
): T[] {
  if (!Array.isArray(communities)) return [];

  if (!userLocation) return communities;

  return [...communities].sort((a: any, b: any) => {
    const aCoords = extractItemCoordinates(a);
    const bCoords = extractItemCoordinates(b);

    const aDist = aCoords
      ? getDistanceInKm(userLocation.latitude, userLocation.longitude, aCoords.latitude, aCoords.longitude)
      : Infinity;
    const bDist = bCoords
      ? getDistanceInKm(userLocation.latitude, userLocation.longitude, bCoords.latitude, bCoords.longitude)
      : Infinity;

    if (isFinite(aDist) && isFinite(bDist)) {
      const diff = aDist - bDist;
      if (Math.abs(diff) > 0.05) {
        return diff;
      }
    } else if (isFinite(aDist) && !isFinite(bDist)) {
      return -1;
    } else if (!isFinite(aDist) && isFinite(bDist)) {
      return 1;
    }

    // Tiebreaker: members count descending
    const aMembers = a.membersCount ?? a._count?.members ?? 0;
    const bMembers = b.membersCount ?? b._count?.members ?? 0;
    if (bMembers !== aMembers) {
      return bMembers - aMembers;
    }

    return (a.name || '').localeCompare(b.name || '');
  });
}
