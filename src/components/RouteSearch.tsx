import { ArrowLeftRight, Menu, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { geocode } from '../lib/googleMaps';
import type { LatLng, RouteEndpoint, RouteMeta } from '../types';
import { PlaceAutocompleteInput } from './PlaceAutocompleteInput';

type RouteSearchProps = {
  routeMeta: RouteMeta | null;
  disabled?: boolean;
  onSubmit: (start: RouteEndpoint, end: RouteEndpoint) => void;
};

const emptyEndpoint = { label: '' };

export function RouteSearch({ routeMeta, disabled, onSubmit }: RouteSearchProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);

  const summary = routeMeta ? `${routeMeta.startLabel} → ${routeMeta.endLabel}` : 'ルートを検索';

  function submit(start: RouteEndpoint, end: RouteEndpoint) {
    onSubmit(start, end);
    setMobileOpen(false);
    setDesktopOpen(false);
  }

  return (
    <>
      <button
        type="button"
        aria-label="ルート検索を開く"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-[max(24px,env(safe-area-inset-bottom))] left-5 z-40 grid h-12 w-12 place-items-center rounded-full border border-white/45 bg-black/25 text-white shadow-float backdrop-blur-md transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-brand md:hidden"
      >
        <Menu className="h-5 w-5" strokeWidth={1.8} />
      </button>

      <div className="pointer-events-none fixed inset-x-0 top-[max(18px,env(safe-area-inset-top))] z-40 hidden justify-center px-4 md:flex">
        <div className="pointer-events-auto">
          {!desktopOpen ? (
            <button
              type="button"
              onClick={() => setDesktopOpen(true)}
              disabled={disabled}
              className="flex h-12 max-w-[min(680px,calc(100vw-32px))] items-center gap-3 rounded-full border border-white/45 bg-black/25 px-5 text-sm font-medium text-white shadow-float backdrop-blur-md transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50"
            >
              <Search className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              <span className="truncate">{summary}</span>
            </button>
          ) : (
            <div className="w-[min(760px,calc(100vw-32px))] rounded-2xl bg-white p-4 text-slate-900 shadow-float">
              <RouteForm
                onSubmit={submit}
                onClose={() => setDesktopOpen(false)}
                disabled={disabled}
                initialStart={routeMeta?.startLabel}
                initialEnd={routeMeta?.endLabel}
              />
            </div>
          )}
        </div>
      </div>

      <div
        className={`fixed inset-0 z-30 hidden bg-slate-950/20 transition md:block ${
          desktopOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setDesktopOpen(false)}
      />

      <div
        className={`fixed inset-0 z-50 bg-slate-950/55 transition md:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileOpen(false)}
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white p-5 pb-[max(24px,env(safe-area-inset-bottom))] text-slate-900 shadow-float transition duration-300 md:hidden ${
          mobileOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <RouteForm
          onSubmit={submit}
          onClose={() => setMobileOpen(false)}
          disabled={disabled}
          initialStart={routeMeta?.startLabel}
          initialEnd={routeMeta?.endLabel}
        />
      </div>
    </>
  );
}

type RouteFormProps = {
  disabled?: boolean;
  initialStart?: string;
  initialEnd?: string;
  onClose: () => void;
  onSubmit: (start: RouteEndpoint, end: RouteEndpoint) => void;
};

function RouteForm({ disabled, initialStart, initialEnd, onClose, onSubmit }: RouteFormProps) {
  const [start, setStart] = useState<RouteEndpoint>(initialStart ? { label: initialStart } : emptyEndpoint);
  const [end, setEnd] = useState<RouteEndpoint>(initialEnd ? { label: initialEnd } : emptyEndpoint);

  // A typed-but-not-yet-selected 出発地 has no location, so the destination's 10km radius filter
  // (see PlaceAutocompleteInput) would otherwise sit disabled - geocode the raw text as a stand-in.
  const [startFallbackLocation, setStartFallbackLocation] = useState<LatLng | undefined>();

  useEffect(() => {
    if (start.location) {
      setStartFallbackLocation(undefined);
      return;
    }

    const query = start.label.trim();
    if (!query) {
      setStartFallbackLocation(undefined);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      geocode({ address: query })
        .then((result) => {
          if (cancelled || !result?.geometry?.location) {
            return;
          }
          const location = result.geometry.location;
          setStartFallbackLocation({ lat: location.lat(), lng: location.lng() });
        })
        .catch(() => {});
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [start.label, start.location]);

  const canSubmit = start.label.trim().length > 0 && end.label.trim().length > 0 && !disabled;

  function swapEndpoints() {
    setStart(end);
    setEnd(start);
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) {
          onSubmit(start, end);
        }
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-base font-semibold text-slate-900">ルート検索</p>
        <button
          type="button"
          aria-label="閉じる"
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto] md:items-end">
        <PlaceAutocompleteInput label="出発地" placeholder="例: 自由が丘駅" value={start} onChange={setStart} />
        <button
          type="button"
          aria-label="出発地と目的地を入れ替え"
          onClick={swapEndpoints}
          disabled={disabled}
          className="mx-auto grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50 md:mx-0 md:self-end"
        >
          <ArrowLeftRight className="h-4 w-4 rotate-90 md:rotate-0" strokeWidth={1.8} />
        </button>
        <PlaceAutocompleteInput
          label="目的地"
          placeholder="例: STAMP COFFEE"
          value={end}
          proximityOrigin={start.location ?? startFallbackLocation}
          onChange={setEnd}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="relative z-40 h-12 rounded-full bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand/90 focus:outline-none focus:ring-4 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          ルート生成
        </button>
      </div>
    </form>
  );
}
