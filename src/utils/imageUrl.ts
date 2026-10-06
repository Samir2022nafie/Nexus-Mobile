import { uploadService } from '../services/upload';

export interface CropParams {
  cleanUrl: string;
  zoom: number;
  panX: number; // percentage offset
  panY: number; // percentage offset
  aspectRatio?: number;
}

/**
 * Universal crop parser for image URLs.
 * Supports #crop=zoom,panX,panY[,aspectRatio], ?crop=..., and base64 data:image URIs.
 */
export function parseCropFromUrl(rawUrl?: string | null): CropParams {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { cleanUrl: '', zoom: 1, panX: 0, panY: 0 };
  }
  const trimmed = rawUrl.trim();

  // If it's a data URI (e.g. base64 cropped gallery photo), return as-is
  if (trimmed.startsWith('data:image/')) {
    return { cleanUrl: trimmed, zoom: 1, panX: 0, panY: 0 };
  }

  let cleanUrl = trimmed;
  let cropPart = '';

  // 1. Primary: hash fragment #crop=
  const hashIdx = trimmed.indexOf('#crop=');
  if (hashIdx !== -1) {
    cleanUrl = trimmed.slice(0, hashIdx);
    cropPart = trimmed.slice(hashIdx + 6).split('&')[0];
  } else {
    // 2. Query parameter ?crop= or &crop=
    const queryMatch = trimmed.match(/[?&]crop=([^&#]+)/);
    if (queryMatch) {
      cropPart = decodeURIComponent(queryMatch[1]);
    }
  }

  // Strip any crop query parameters cleanly without breaking other params
  cleanUrl = cleanUrl
    .replace(/[?&]crop=[^&#]+/, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');

  // Also handle Google Images redirect parameter if present
  const imgUrlMatch = cleanUrl.match(/[?&]imgurl=([^&]+)/);
  if (imgUrlMatch) {
    try {
      cleanUrl = decodeURIComponent(imgUrlMatch[1]);
    } catch {}
  }

  if (!cropPart) {
    return { cleanUrl, zoom: 1, panX: 0, panY: 0 };
  }

  const [z, x, y, ar] = cropPart.split(',').map((p) => parseFloat(p.trim()));
  return {
    cleanUrl,
    zoom: isNaN(z) || z < 1 ? 1 : z,
    panX: isNaN(x) ? 0 : x,
    panY: isNaN(y) ? 0 : y,
    aspectRatio: !isNaN(ar) && ar > 0 ? ar : undefined,
  };
}

/**
 * Encodes crop parameters onto a clean image URL.
 */
export function encodeCropUrl(
  baseUrl: string,
  zoom: number,
  panXPercent: number,
  panYPercent: number,
  aspectRatio?: number
): string {
  if (!baseUrl) return '';
  const parsed = parseCropFromUrl(baseUrl);
  const cleanBase = parsed.cleanUrl;
  const z = Math.max(1, zoom).toFixed(2);
  const x = panXPercent.toFixed(1);
  const y = panYPercent.toFixed(1);
  const ar = aspectRatio && aspectRatio > 0 ? `,${aspectRatio.toFixed(3)}` : '';
  return `${cleanBase}#crop=${z},${x},${y}${ar}`;
}

/**
 * Synchronous client-side extraction for clean direct links.
 * Strips client crop fragments for raw asset fetching.
 */
export function extractDirectImageUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('data:image/')) return trimmed;
  return parseCropFromUrl(trimmed).cleanUrl;
}

/**
 * Asynchronously resolves redirect URLs (share.google, pin.it, etc.) into direct image URLs.
 */
export async function resolveImageUrl(rawUrl?: string | null): Promise<string> {
  const direct = extractDirectImageUrl(rawUrl);
  if (!direct) return '';
  if (direct.startsWith('data:image/')) return direct;
  if (/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(direct)) {
    return direct;
  }
  try {
    return await uploadService.resolveUrl(direct);
  } catch {
    return direct;
  }
}
