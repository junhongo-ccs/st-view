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
import { sampleRoute } from './lib/routeSampling';
import { buildStreetViewUrl, filterOutdoorStreetViewPoints, prefetchImages } from './lib/streetViewStatic';
import type { AppPhase, LatLng, RouteEndpoint, RouteMeta, RoutePoint, ToastState } from './types';

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
    async (points: LatLng[], meta: RouteMeta) => {
      if (!env.googleMapsApiKey) {
        setError('Google Maps API キーが設定されていません。');
        setPhase('error');
        return;
      }

      setError(null);
      setProgress(8);
      setPhase('prefetchingImages');

      const sampled = sampleRoute(points, env.sampleIntervalMeters, env.maxPrefetchFrames);
      const outdoorPoints = await filterOutdoorStreetViewPoints(sampled);
      if (outdoorPoints.length === 0) {
        setError('このルートでは屋外の Street View が見つかりませんでした。');
        setPhase('error');
        return;
      }

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
        const result = await routeWithDirections(service, start, end);
        const route = result.routes[0];
        const routePath = getRoutePath(route);
        const path = routePath.map(toLiteral);
        const encodedPath = maps.maps.geometry.encoding.encodePath(routePath);

        await prepareRoute(path, {
          startLabel: start.label.trim(),
          endLabel: end.label.trim(),
          encodedPath,
        });
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
        <div className="fixed inset-0 z-20 grid h-dvh place-items-center px-6 text-center">
          <div className="max-w-sm">
            <p className="text-sm font-medium text-white/90">どこから、どこまで歩きますか？</p>
            {error ? <p className="mt-3 text-sm leading-relaxed text-rose-100">{error}</p> : null}
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
) {
  return new Promise<google.maps.DirectionsResult>((resolve, reject) => {
    service.route(
      {
        origin: start.location ?? start.label,
        destination: end.location ?? end.label,
        travelMode: google.maps.TravelMode.DRIVING,
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

function getRoutePath(route: google.maps.DirectionsRoute) {
  const path: google.maps.LatLng[] = [];

  route.legs.forEach((leg) => {
    leg.steps.forEach((step) => {
      step.path.forEach((point) => {
        const last = path[path.length - 1];
        if (last && last.lat() === point.lat() && last.lng() === point.lng()) {
          return;
        }
        path.push(point);
      });
    });
  });

  return path.length > 0 ? path : route.overview_path;
}
