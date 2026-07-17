import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../lib/googleMaps';
import type { RoutePoint } from '../types';

type StreetViewPlayerProps = {
  imageUrls: string[];
  routePoints: RoutePoint[];
  playing: boolean;
};

export function StreetViewPlayer({ imageUrls, routePoints, playing }: StreetViewPlayerProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [frontLayer, setFrontLayer] = useState(0);
  const [layerUrls, setLayerUrls] = useState<[string, string]>([imageUrls[0] ?? '', imageUrls[1] ?? imageUrls[0] ?? '']);
  const [placeLabel, setPlaceLabel] = useState('');
  const wheelAccumulatorRef = useRef(0);
  const geocodeCacheRef = useRef(new Map<string, string>());
  const geocodeRequestRef = useRef(0);

  useEffect(() => {
    setFrameIndex(0);
    setFrontLayer(0);
    setLayerUrls([imageUrls[0] ?? '', imageUrls[1] ?? imageUrls[0] ?? '']);
  }, [imageUrls]);

  useEffect(() => {
    if (!playing || imageUrls.length === 0) {
      return;
    }

    const moveFrames = (delta: number) => {
      setFrameIndex((current) => Math.min(imageUrls.length - 1, Math.max(0, current + delta)));
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      wheelAccumulatorRef.current -= event.deltaY;

      const threshold = 60;
      if (Math.abs(wheelAccumulatorRef.current) < threshold) {
        return;
      }

      const steps = Math.trunc(wheelAccumulatorRef.current / threshold);
      wheelAccumulatorRef.current -= steps * threshold;
      moveFrames(steps);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        moveFrames(1);
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        moveFrames(-1);
      }

      if (event.key === 'Home') {
        event.preventDefault();
        setFrameIndex(0);
      }

      if (event.key === 'End') {
        event.preventDefault();
        setFrameIndex(imageUrls.length - 1);
      }
    };

    window.scrollTo({ top: 0 });
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      wheelAccumulatorRef.current = 0;
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [imageUrls, playing]);

  useEffect(() => {
    const nextUrl = imageUrls[frameIndex];
    if (!nextUrl) {
      return;
    }

    setLayerUrls((current) => {
      if (current[frontLayer] === nextUrl) {
        return current;
      }

      const nextLayer = frontLayer === 0 ? 1 : 0;
      const updated: [string, string] = [...current];
      updated[nextLayer] = nextUrl;
      window.setTimeout(() => setFrontLayer(nextLayer), 20);
      return updated;
    });
  }, [frameIndex, frontLayer, imageUrls]);

  useEffect(() => {
    const point = routePoints[frameIndex];
    if (!point) {
      setPlaceLabel('');
      return;
    }

    const fallback = formatPointLabel(point);
    const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
    const cached = geocodeCacheRef.current.get(key);
    if (cached) {
      setPlaceLabel(cached);
      return;
    }

    setPlaceLabel(fallback);
    const requestId = geocodeRequestRef.current + 1;
    geocodeRequestRef.current = requestId;

    const timer = window.setTimeout(() => {
      loadGoogleMaps()
        .then((maps) => {
          const geocoder = new maps.maps.Geocoder();
          geocoder.geocode({ location: { lat: point.lat, lng: point.lng } }, (results, status) => {
            if (geocodeRequestRef.current !== requestId) {
              return;
            }

            const label =
              status === maps.maps.GeocoderStatus.OK && results?.[0]?.formatted_address
                ? results[0].formatted_address
                : fallback;
            geocodeCacheRef.current.set(key, label);
            setPlaceLabel(label);
          });
        })
        .catch(() => {
          geocodeCacheRef.current.set(key, fallback);
          setPlaceLabel(fallback);
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [frameIndex, routePoints]);

  if (imageUrls.length === 0) {
    return null;
  }

  const cue = routePoints[frameIndex]?.cue;
  const currentPoint = routePoints[frameIndex];
  const currentStep = frameIndex + 1;
  const totalSteps = imageUrls.length;
  const progress = totalSteps > 1 ? (frameIndex / (totalSteps - 1)) * 100 : 100;

  return (
    <>
      <div className="fixed inset-0 h-dvh w-screen overflow-hidden bg-slate-950">
        {layerUrls.map((url, index) => (
          <img
            key={`${index}-${url}`}
            src={url}
            alt=""
            draggable={false}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out ${
              frontLayer === index ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/45 to-transparent" />
        {cue ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <div className="select-none text-center text-3xl font-semibold tracking-normal text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.8)] md:text-4xl">
              {cue.label}
            </div>
            <div className="mx-auto mt-2 h-0.5 w-10 rounded-full bg-white/85 shadow-[0_2px_10px_rgba(0,0,0,0.55)]" />
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-x-4 bottom-[max(76px,calc(env(safe-area-inset-bottom)+76px))] z-10 md:inset-x-8 md:bottom-6">
          <div className="flex items-end justify-between gap-4 text-white">
            <div className="min-w-0 rounded-md bg-black/35 px-3 py-2 text-xs font-medium leading-relaxed shadow-float backdrop-blur-md md:text-sm">
              <div className="text-white/90">{currentStep} / {totalSteps}</div>
              {currentPoint ? (
                <div className="truncate text-[11px] text-white/65 md:text-xs">
                  {placeLabel || formatPointLabel(currentPoint)}
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/25 shadow-[0_1px_8px_rgba(0,0,0,0.35)]">
            <div className="h-full rounded-full bg-white transition-[width] duration-150" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="h-dvh" />
    </>
  );
}

function formatPointLabel(point: RoutePoint) {
  return `現在地 ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}
