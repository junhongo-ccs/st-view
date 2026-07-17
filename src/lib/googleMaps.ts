import { env } from './env';

let loaderPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (window.google?.maps?.places && window.google.maps.geometry) {
    return Promise.resolve(window.google);
  }

  if (!env.googleMapsApiKey) {
    return Promise.reject(new Error('Google Maps API key is not set.'));
  }

  const apiKey = env.googleMapsApiKey;

  if (loaderPromise) {
    return loaderPromise;
  }

  loaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps-loader]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps.')));
      return;
    }

    const callbackName = `initGoogleMaps_${Date.now()}`;
    const params = new URLSearchParams({
      key: apiKey,
      libraries: 'geometry,places',
      language: 'ja',
      callback: callbackName,
    });

    window[callbackName as keyof Window] = (() => {
      delete window[callbackName as keyof Window];
      resolve(window.google);
    }) as never;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = 'true';
    script.onerror = () => reject(new Error('Failed to load Google Maps.'));
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export function toLiteral(point: google.maps.LatLng | google.maps.LatLngLiteral) {
  const candidate = point as google.maps.LatLng;
  if (typeof candidate.lat === 'function') {
    return { lat: candidate.lat(), lng: candidate.lng() };
  }
  const literal = point as google.maps.LatLngLiteral;
  return { lat: literal.lat, lng: literal.lng };
}
