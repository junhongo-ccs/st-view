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
  const results = await Promise.allSettled(points.map(hasOutdoorStreetView));
  return points.filter((_, index) => results[index].status === 'fulfilled' && results[index].value);
}

async function hasOutdoorStreetView(point: RoutePoint) {
  const params = new URLSearchParams({
    location: `${point.lat},${point.lng}`,
    radius: String(env.streetViewRadiusMeters),
    source: 'outdoor',
    key: env.googleMapsApiKey ?? '',
  });

  const response = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${params.toString()}`);
  if (!response.ok) {
    return false;
  }

  const metadata = (await response.json()) as {
    status?: string;
    copyright?: string;
    location?: { lat: number; lng: number };
  };
  if (metadata.status !== 'OK' || !metadata.location) {
    return false;
  }

  const isNearRoute = distanceMeters(point, metadata.location) <= env.streetViewRadiusMeters;
  const isGoogleRoadImagery = metadata.copyright?.toLowerCase().includes('google') ?? false;
  return isNearRoute && isGoogleRoadImagery;
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
