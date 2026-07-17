import { useCallback, useEffect, useMemo, useState } from 'react';
import { LoadingOverlay } from './components/LoadingOverlay';
import { PlaceholderScene } from './components/PlaceholderScene';
import { RouteSearch } from './components/RouteSearch';
import { ShareButton } from './components/ShareButton';
import { StreetViewPlayer } from './components/StreetViewPlayer';
import { TapToStartOverlay } from './components/TapToStartOverlay';
import { Toast } from './components/Toast';
import { env } from './lib/env';
import { loadGoogleMaps, toLiteral } from './lib/googleMaps';
import { getEncodedPathFromUrl } from './lib/routeParams';
import { sampleRoute, snapToRoadCorridor } from './lib/routeSampling';
import { buildStreetViewUrl, filterOutdoorStreetViewPoints, prefetchImages } from './lib/streetViewStatic';
import type { AppPhase, LatLng, NavigationCue, RouteEndpoint, RouteMeta, RoutePoint, ToastState, TurnCueAnchor } from './types';

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('empty');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [routeMeta, setRouteMeta] = useState<RouteMeta | null>(null);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const firstImage = imageUrls[0];
  const loading = phase === 'loadingRoute' || phase === 'prefetchingImages';
  const ready = phase === 'ready';
  const playing = phase === 'playing';

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2000);
  }, []);

  const prepareRoute = useCallback(
    async (points: LatLng[], meta: RouteMeta, turnCueAnchors: TurnCueAnchor[] = []) => {
      if (!env.googleMapsApiKey) {
        setError('Google Maps API キーが設定されていません。');
        setPhase('error');
        return;
      }

      setError(null);
      setProgress(8);
      setPhase('prefetchingImages');

      const sampled = sampleRoute(points, env.sampleIntervalMeters, env.maxPrefetchFrames, turnCueAnchors);
      const filtered = await filterOutdoorStreetViewPoints(sampled);
      if (filtered.length === 0) {
        setError('このルートでは屋外の Street View が見つかりませんでした。');
        setPhase('error');
        return;
      }

      // The original 到着 point can be dropped by outdoor filtering; the last surviving point is always the arrival.
      const lastIndex = filtered.length - 1;
      const outdoorPoints = filtered.map((point, index) =>
        index === lastIndex ? { ...point, cue: { label: '到着' as const } } : point,
      );

      const urls = outdoorPoints.map(buildStreetViewUrl);
      setImageUrls(urls);
      setRoutePoints(outdoorPoints);
      setRouteMeta(meta);
      await prefetchImages(urls, (loaded, total) => {
        setProgress(Math.max(10, Math.round((loaded / total) * 100)));
      });
      setProgress(100);
      setPhase('ready');
      window.scrollTo({ top: 0 });
    },
    [],
  );

  const buildRoute = useCallback(
    async (start: RouteEndpoint, end: RouteEndpoint) => {
      if (!start.label.trim() || !end.label.trim()) {
        showToast('出発地と目的地を入力してください', 'error');
        return;
      }

      setPhase('loadingRoute');
      setProgress(5);
      setError(null);

      try {
        const maps = await loadGoogleMaps();
        const service = new maps.maps.DirectionsService();
        const [walkingResult, drivingResult] = await Promise.allSettled([
          routeWithDirections(service, start, end, maps.maps.TravelMode.WALKING),
          routeWithDirections(service, start, end, maps.maps.TravelMode.DRIVING),
        ]);

        if (walkingResult.status === 'rejected') {
          throw walkingResult.reason;
        }

        const walkingRoute = walkingResult.value.routes[0];
        const walking = getRoutePath(walkingRoute);
        const walkingPath = walking.path.map(toLiteral);
        const turnCueAnchors = getTurnCueAnchors(walkingRoute);

        // WALKING allows travel against one-way traffic; DRIVING's geometry keeps it off private shortcuts
        // and, via forceSnap, off underground passages that sit directly beneath the surface corridor.
        const drivingPath =
          drivingResult.status === 'fulfilled' ? getRoutePath(drivingResult.value.routes[0]).path.map(toLiteral) : [];
        const path = snapToRoadCorridor(walkingPath, drivingPath, env.roadCorridorMeters, walking.underground);

        const encodedPath = maps.maps.geometry.encoding.encodePath(
          path.map((point) => new maps.maps.LatLng(point.lat, point.lng)),
        );

        await prepareRoute(path, {
          startLabel: start.label.trim(),
          endLabel: end.label.trim(),
          encodedPath,
        }, turnCueAnchors);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'ルートを取得できませんでした。');
        setPhase('error');
      }
    },
    [prepareRoute, showToast],
  );

  useEffect(() => {
    const encodedPath = getEncodedPathFromUrl();
    const params = new URLSearchParams(window.location.search);
    const startLabel = params.get('startLabel') ?? 'Start';
    const endLabel = params.get('endLabel') ?? 'End';

    if (encodedPath) {
      setPhase('loadingRoute');
      loadGoogleMaps()
        .then((maps) => {
          const decoded = maps.maps.geometry.encoding.decodePath(encodedPath).map(toLiteral);
          return prepareRoute(decoded, { startLabel, endLabel, encodedPath });
        })
        .catch((caught) => {
          setError(caught instanceof Error ? caught.message : 'URL のルートを読み込めませんでした。');
          setPhase('error');
        });
      return;
    }

    if (env.defaultStart && env.defaultEnd) {
      void buildRoute({ label: env.defaultStart }, { label: env.defaultEnd });
    }
  }, [buildRoute, prepareRoute]);

  useEffect(() => {
    document.body.style.overflow = playing ? 'auto' : 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [playing]);

  const loadingMessage = useMemo(() => {
    if (phase === 'loadingRoute') {
      return 'Preparing route...';
    }
    if (phase === 'prefetchingImages') {
      return 'Loading views...';
    }
    return 'Preparing route...';
  }, [phase]);

  async function startPlayback() {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen is a progressive enhancement; playback can continue without it.
    }

    setPhase('playing');
    window.scrollTo({ top: 0 });
  }

  return (
    <main className="min-h-dvh bg-slate-950 text-white">
      {imageUrls.length > 0 ? (
        <StreetViewPlayer imageUrls={imageUrls} routePoints={routePoints} playing={playing} />
      ) : (
        <PlaceholderScene />
      )}
      {imageUrls.length > 0 && !playing ? <PlaceholderScene imageUrl={firstImage} /> : null}

      {phase === 'empty' || phase === 'error' ? (
        <div className="pointer-events-none fixed inset-x-0 top-[34%] z-20 px-6 text-center md:top-[38%]">
          <div className="mx-auto max-w-sm">
            <h2 className="text-xl font-semibold tracking-normal text-slate-800 drop-shadow-[0_2px_10px_rgba(255,255,255,0.95)] md:text-2xl">
              どこから、どこまで歩きますか？
            </h2>
            {error ? (
              <p className="mt-3 rounded-md bg-white/75 px-3 py-2 text-sm leading-relaxed text-rose-700 shadow-float backdrop-blur-md">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <RouteSearch routeMeta={routeMeta} disabled={loading} onSubmit={buildRoute} />
      <ShareButton routeMeta={routeMeta} disabled={!routeMeta} onCopied={showToast} />
      <LoadingOverlay visible={loading} progress={progress} message={loadingMessage} />
      <TapToStartOverlay visible={ready} onStart={startPlayback} />
      <Toast toast={toast} />
    </main>
  );
}

function routeWithDirections(
  service: google.maps.DirectionsService,
  start: RouteEndpoint,
  end: RouteEndpoint,
  travelMode: google.maps.TravelMode,
) {
  return new Promise<google.maps.DirectionsResult>((resolve, reject) => {
    service.route(
      {
        origin: start.location ?? start.label,
        destination: end.location ?? end.label,
        travelMode,
        provideRouteAlternatives: false,
        optimizeWaypoints: false,
        avoidHighways: true,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          resolve(result);
          return;
        }

        reject(new Error(`ルートを取得できませんでした: ${status}`));
      },
    );
  });
}

// "地下" alone rarely appears in ja walking instructions (e.g. "1階までエスカレーターで下りる" never says it);
// level changes via escalator/stairs/elevator are the reliable signal that a step goes below the surface.
const LEVEL_CHANGE_PATTERN = /エスカレーター|階段|エレベーター/;
const DOWN_PATTERN = /地下|下りる|降りる|下る/;
const UP_PATTERN = /地上|上る|昇る|上がる|のぼる/;

function isDescendStep(step: google.maps.DirectionsStep) {
  const text = step.instructions ?? '';
  return DOWN_PATTERN.test(text) && (text.includes('地下') || LEVEL_CHANGE_PATTERN.test(text));
}

function isAscendStep(step: google.maps.DirectionsStep) {
  const text = step.instructions ?? '';
  return UP_PATTERN.test(text) && (text.includes('地上') || LEVEL_CHANGE_PATTERN.test(text));
}

function getRoutePath(route: google.maps.DirectionsRoute) {
  const path: google.maps.LatLng[] = [];
  const underground: boolean[] = [];
  let belowGround = false;

  route.legs.forEach((leg) => {
    leg.steps.forEach((step) => {
      if (isDescendStep(step)) {
        belowGround = true;
      }

      step.path.forEach((point) => {
        const last = path[path.length - 1];
        if (last && last.lat() === point.lat() && last.lng() === point.lng()) {
          return;
        }
        path.push(point);
        underground.push(belowGround);
      });

      if (isAscendStep(step)) {
        belowGround = false;
      }
    });
  });

  if (path.length > 0) {
    return { path, underground };
  }

  return { path: route.overview_path, underground: route.overview_path.map(() => false) };
}

function getTurnCueAnchors(route: google.maps.DirectionsRoute): TurnCueAnchor[] {
  const anchors: TurnCueAnchor[] = [];

  route.legs.forEach((leg) => {
    leg.steps.forEach((step, index) => {
      if (index === 0) {
        return;
      }

      const cue = cueFromManeuver(step.maneuver);
      if (!cue) {
        return;
      }

      anchors.push({
        ...toLiteral(step.start_location),
        cue,
      });
    });
  });

  return anchors;
}

const MANEUVER_CUE_LABELS: Partial<Record<string, NavigationCue['label']>> = {
  'turn-slight-left': 'やや左へ',
  'turn-slight-right': 'やや右へ',
  'turn-sharp-left': '大きく左へ',
  'turn-sharp-right': '大きく右へ',
  'uturn-left': 'Uターン',
  'uturn-right': 'Uターン',
  'turn-left': '左へ',
  'turn-right': '右へ',
  'fork-left': '左へ',
  'fork-right': '右へ',
  'ramp-left': '左へ',
  'ramp-right': '右へ',
  'roundabout-left': '左へ',
  'roundabout-right': '右へ',
};

function cueFromManeuver(maneuver?: string): NavigationCue | null {
  if (!maneuver) {
    return null;
  }

  const mapped = MANEUVER_CUE_LABELS[maneuver];
  if (mapped) {
    return { label: mapped };
  }

  // Fallback for any maneuver Google adds that isn't in the table above.
  if (maneuver.includes('left')) {
    return { label: '左へ' };
  }

  if (maneuver.includes('right')) {
    return { label: '右へ' };
  }

  return null;
}
