import type { RoutePoint } from '../types';
import { env } from './env';
import { distanceMeters } from './routeSampling';

export function buildStreetViewUrl(point: RoutePoint) {
  const params = new URLSearchParams({
    location: `${point.lat},${point.lng}`,
    heading: String(Math.round(point.heading)),
    size: env.streetViewSize,
    fov: String(env.streetViewFov),
    pitch: String(env.streetViewPitch),
    radius: String(env.streetViewRadiusMeters),
    return_error_code: 'true',
    source: 'outdoor',
    key: env.googleMapsApiKey ?? '',
  });

  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

export async function filterOutdoorStreetViewPoints(points: RoutePoint[]) {
  const results = await Promise.allSettled(points.map(fetchOutdoorPanoId));
  const qualifying = points
    .map((point, index) => {
      const result = results[index];
      return result.status === 'fulfilled' && result.value !== null ? { point, panoId: result.value } : null;
    })
    .filter((entry): entry is { point: RoutePoint; panoId: string | undefined } => entry !== null);

  // Real Street View coverage is much sparser than the route's sampling interval, so consecutive sample
  // points routinely snap to the exact same photo; drop the repeats so playback doesn't stall on one frame.
  return qualifying
    .filter((entry, index) => index === 0 || entry.panoId === undefined || entry.panoId !== qualifying[index - 1].panoId)
    .map((entry) => entry.point);
}

async function fetchOutdoorPanoId(point: RoutePoint): Promise<string | undefined | null> {
  const params = new URLSearchParams({
    location: `${point.lat},${point.lng}`,
    radius: String(env.streetViewRadiusMeters),
    source: 'outdoor',
    key: env.googleMapsApiKey ?? '',
  });

  const response = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${params.toString()}`);
  if (!response.ok) {
    return null;
  }

  const metadata = (await response.json()) as {
    status?: string;
    copyright?: string;
    location?: { lat: number; lng: number };
    pano_id?: string;
  };
  if (metadata.status !== 'OK' || !metadata.location) {
    return null;
  }

  const isNearRoute = distanceMeters(point, metadata.location) <= env.streetViewRadiusMeters;
  const isGoogleRoadImagery = metadata.copyright?.toLowerCase().includes('google') ?? false;
  return isNearRoute && isGoogleRoadImagery ? metadata.pano_id : null;
}

export function prefetchImages(urls: string[], onProgress?: (loaded: number, total: number) => void) {
  let loaded = 0;

  return Promise.allSettled(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.onload = () => {
            loaded += 1;
            onProgress?.(loaded, urls.length);
            resolve();
          };
          image.onerror = () => {
            loaded += 1;
            onProgress?.(loaded, urls.length);
            resolve();
          };
          image.src = url;
        }),
    ),
  );
}
