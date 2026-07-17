export const env = {
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined,
  defaultStart: import.meta.env.VITE_DEFAULT_START as string | undefined,
  defaultEnd: import.meta.env.VITE_DEFAULT_END as string | undefined,
  streetViewSize: (import.meta.env.VITE_STREET_VIEW_SIZE as string | undefined) ?? '640x640',
  streetViewFov: Number(import.meta.env.VITE_STREET_VIEW_FOV ?? 90),
  streetViewPitch: Number(import.meta.env.VITE_STREET_VIEW_PITCH ?? 0),
  streetViewRadiusMeters: Number(import.meta.env.VITE_STREET_VIEW_RADIUS_METERS ?? 10),
  sampleIntervalMeters: Number(import.meta.env.VITE_ROUTE_SAMPLE_INTERVAL_METERS ?? 5),
  maxPrefetchFrames: Number(import.meta.env.VITE_MAX_PREFETCH_FRAMES ?? 200),
};
