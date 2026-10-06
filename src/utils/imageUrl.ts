import { uploadService } from '../services/upload';

export interface CropParams {
  cleanUrl: string;
  zoom: number;
  panX: number; // percentage offset
  panY: number; // percentage offset
  aspectRatio?: number;
}

/**
 * Extracts crop parameters from an image URL with #crop=zoom,panX,panY[,aspectRatio].
 */
export function parseCropFromUrl(rawUrl?: string | null): CropParams {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { cleanUrl: '', zoom: 1, panX: 0, panY: 0 };
  }
  const trimmed = rawUrl.trim();
  const cropIdx = trimmed.indexOf('#crop=');
  if (cropIdx === -1) {
    return { cleanUrl: trimmed, zoom: 1, panX: 0, panY: 0 };
  }
  const cleanUrl = trimmed.slice(0, cropIdx);
  const cropPart = trimmed.slice(cropIdx + 6);
  const [z, x, y, ar] = cropPart.split(',').map(Number);
  return {
    cleanUrl,
    zoom: isNaN(z) || z <= 0 ? 1 : z,
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
  const cleanBase = parseCropFromUrl(baseUrl).cleanUrl;
  const baseCrop = `${cleanBase}#crop=${zoom.toFixed(2)},${panXPercent.toFixed(1)},${panYPercent.toFixed(1)}`;
  if (aspectRatio && aspectRatio > 0) {
    return `${baseCrop},${aspectRatio.toFixed(3)}`;
  }
  return baseCrop;
}

/**
 * Synchronous client-side extraction for Google Images imgurl parameter and clean direct links.
 * Strips client crop fragments for raw asset fetching.
 */
export function extractDirectImageUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let trimmed = rawUrl.trim();
  const cropIdx = trimmed.indexOf('#crop=');
  if (cropIdx !== -1) {
    trimmed = trimmed.slice(0, cropIdx);
  }
  const match = trimmed.match(/[?&]imgurl=([^&]+)/);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {}
  }
  return trimmed;
}

/**
 * Asynchronously resolves redirect URLs (share.google, pin.it, etc.) into direct image URLs.
 */
export async function resolveImageUrl(rawUrl?: string | null): Promise<string> {
  const direct = extractDirectImageUrl(rawUrl);
  if (!direct) return '';
  if (/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(direct)) {
    return direct;
  }
  try {
    return await uploadService.resolveUrl(direct);
  } catch {
    return direct;
  }
}
