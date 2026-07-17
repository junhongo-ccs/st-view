import { useEffect, useRef, useState } from 'react';
import { geocode } from '../lib/googleMaps';
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
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const wheelAccumulatorRef = useRef(0);
  const touchAccumulatorRef = useRef(0);
  const activePointerRef = useRef<{ id: number; lastY: number } | null>(null);
  const geocodeCacheRef = useRef(new Map<string, string>());
  const geocodeRequestRef = useRef(0);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

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

    // Touch devices fire neither `wheel` (no mouse) nor `keydown` (no physical keys), so a vertical
    // drag - the mobile equivalent of scrolling - is tracked separately via Pointer Events, which also
    // covers mouse-drag as a bonus. Dragging the finger down (deltaY positive) advances, matching how
    // dragging down on a normal page reveals content further down.
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }
      activePointerRef.current = { id: event.pointerId, lastY: event.clientY };
      touchAccumulatorRef.current = 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      const active = activePointerRef.current;
      if (!active || active.id !== event.pointerId) {
        return;
      }
      event.preventDefault();

      const deltaY = event.clientY - active.lastY;
      active.lastY = event.clientY;
      touchAccumulatorRef.current += deltaY;

      const threshold = 40;
      if (Math.abs(touchAccumulatorRef.current) < threshold) {
        return;
      }

      const steps = Math.trunc(touchAccumulatorRef.current / threshold);
      touchAccumulatorRef.current -= steps * threshold;
      moveFrames(steps);
    };

    const endDrag = (event: PointerEvent) => {
      if (activePointerRef.current?.id === event.pointerId) {
        activePointerRef.current = null;
        touchAccumulatorRef.current = 0;
      }
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
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      wheelAccumulatorRef.current = 0;
      touchAccumulatorRef.current = 0;
      activePointerRef.current = null;
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
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

    const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
    const cached = geocodeCacheRef.current.get(key);
    if (cached) {
      setPlaceLabel(cached);
      return;
    }

    setPlaceLabel('現在地を確認中...');
    const requestId = geocodeRequestRef.current + 1;
    geocodeRequestRef.current = requestId;

    const timer = window.setTimeout(() => {
      geocode({ location: { lat: point.lat, lng: point.lng } })
        .then((result) => {
          if (geocodeRequestRef.current !== requestId) {
            return;
          }

          const label = result?.formatted_address ? formatAddressLabel(result.formatted_address) : '現在地を確認できません';
          geocodeCacheRef.current.set(key, label);
          setPlaceLabel(label);
        })
        .catch(() => {
          geocodeCacheRef.current.set(key, '現在地を確認できません');
          setPlaceLabel('現在地を確認できません');
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [frameIndex, routePoints]);

  if (imageUrls.length === 0) {
    return null;
  }

  const rawCue = routePoints[frameIndex]?.cue;
  const cue = rawCue?.label === '直進' ? null : rawCue;
  const currentPoint = routePoints[frameIndex];
  const currentStep = frameIndex + 1;
  const totalSteps = imageUrls.length;
  const progress = totalSteps > 1 ? (frameIndex / (totalSteps - 1)) * 100 : 100;

  return (
    <>
      <div className={`fixed inset-0 h-dvh w-screen overflow-hidden bg-slate-950 ${playing ? 'touch-none' : ''}`}>
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
        {playing && isFullscreen ? (
          <div className="pointer-events-none absolute right-4 top-[max(16px,env(safe-area-inset-top))] z-10 md:right-8 md:top-6">
            <span className="rounded-full border border-white/30 bg-black/35 px-3 py-1.5 text-[11px] font-medium text-white/85 shadow-float backdrop-blur-md md:text-xs">
              Esc で全画面終了
            </span>
          </div>
        ) : null}
        {cue ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <div className="select-none text-center text-3xl font-semibold tracking-normal text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.8)] md:text-4xl">
              {cue.label}
            </div>
            <div className="mx-auto mt-2 h-0.5 w-10 rounded-full bg-white/85 shadow-[0_2px_10px_rgba(0,0,0,0.55)]" />
          </div>
        ) : frameIndex === 0 ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 px-6 md:block">
            <div className="select-none text-center text-2xl font-semibold tracking-normal text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.8)]">
              マウスホイールまたは矢印キーで移動します
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
                  {placeLabel || '現在地を確認中...'}
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

function formatAddressLabel(address: string) {
  return address
    .replace(/^日本、?/, '')
    .replace(/^〒\d{3}-\d{4}\s*/, '')
    .replace(/\s+/g, '')
    .trim();
}
