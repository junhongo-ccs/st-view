import { KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { loadGoogleMaps } from '../lib/googleMaps';
import type { LatLng, RouteEndpoint } from '../types';

const WALKABLE_DESTINATION_RADIUS_METERS = 10000;

type PlaceAutocompleteInputProps = {
  label: string;
  placeholder: string;
  value: RouteEndpoint;
  proximityOrigin?: LatLng;
  onChange: (value: RouteEndpoint) => void;
};

export function PlaceAutocompleteInput({ label, placeholder, value, proximityOrigin, onChange }: PlaceAutocompleteInputProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const detailsHostRef = useRef<HTMLDivElement | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const requestIdRef = useRef(0);
  const [placesReady, setPlacesReady] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [hasRequestedPredictions, setHasRequestedPredictions] = useState(false);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !detailsHostRef.current) {
          return;
        }

        autocompleteServiceRef.current = new maps.maps.places.AutocompleteService();
        placesServiceRef.current = new maps.maps.places.PlacesService(detailsHostRef.current);
        setPlacesReady(true);
      })
      .catch(() => {
        setPlacesReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = value.label.trim();
    const service = autocompleteServiceRef.current;

    if (!placesReady || !query) {
      setPredictions([]);
      setIsLoadingPredictions(false);
      setHasRequestedPredictions(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoadingPredictions(true);

    const timer = window.setTimeout(() => {
      service?.getPlacePredictions(buildPredictionRequest(query, proximityOrigin), (results, status) => {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setIsLoadingPredictions(false);
        setHasRequestedPredictions(true);
        setHighlightedIndex(-1);
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(filterAndSortPredictions(results, proximityOrigin).slice(0, 5));
          return;
        }

        setPredictions([]);
      });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [placesReady, proximityOrigin, value.label]);

  const selectPrediction = (prediction: google.maps.places.AutocompletePrediction) => {
    setPredictions([]);
    setIsFocused(false);

    const fallbackLabel = prediction.description;
    const placesService = placesServiceRef.current;
    if (!placesService) {
      onChange({ label: fallbackLabel });
      return;
    }

    placesService.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['geometry', 'name', 'formatted_address'],
      },
      (place, status) => {
        const location = place?.geometry?.location;
        if (status !== google.maps.places.PlacesServiceStatus.OK || !location) {
          onChange({ label: fallbackLabel });
          return;
        }

        onChange({
          label: place.formatted_address || place.name || fallbackLabel,
          location: {
            lat: location.lat(),
            lng: location.lng(),
          },
        });
      },
    );
  };

  const clearValue = () => {
    onChange({ label: '' });
    setPredictions([]);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!predictions.length) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % predictions.length);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((current) => (current <= 0 ? predictions.length - 1 : current - 1));
    }

    if (event.key === 'Enter' && highlightedIndex >= 0) {
      event.preventDefault();
      selectPrediction(predictions[highlightedIndex]);
    }

    if (event.key === 'Escape') {
      setPredictions([]);
      setHighlightedIndex(-1);
    }
  };

  const hasNoPredictions =
    isFocused && value.label.trim().length > 0 && hasRequestedPredictions && !isLoadingPredictions && predictions.length === 0;
  const shouldShowPredictions =
    isFocused && value.label.trim().length > 0 && (predictions.length > 0 || isLoadingPredictions || hasNoPredictions);

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-2 block text-xs font-medium text-slate-500">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          ref={inputRef}
          value={value.label}
          onChange={(event) => onChange({ label: event.target.value })}
          onFocus={() => setIsFocused(true)}
          onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 pr-11 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10"
        />
        {value.label ? (
          <button
            type="button"
            aria-label={`${label}を消去`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearValue}
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {shouldShowPredictions ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          {isLoadingPredictions ? (
            <div className="px-4 py-3 text-sm text-slate-400">候補を検索中...</div>
          ) : hasNoPredictions ? (
            <div className="px-4 py-3 text-sm text-slate-500">
              {proximityOrigin ? '徒歩2時間圏内の候補がありません' : '候補がありません'}
            </div>
          ) : (
            predictions.map((prediction, index) => (
              <button
                key={prediction.place_id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectPrediction(prediction)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`block w-full px-4 py-3 text-left transition ${
                  highlightedIndex === index ? 'bg-brand/10' : 'hover:bg-slate-50'
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="block text-sm font-semibold text-slate-900">
                    {prediction.structured_formatting.main_text}
                  </span>
                  {typeof prediction.distance_meters === 'number' ? (
                    <span className="shrink-0 text-xs font-medium text-slate-400">
                      {formatDistance(prediction.distance_meters)}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {prediction.structured_formatting.secondary_text || prediction.description}
                </span>
              </button>
            ))
          )}
          <div className="border-t border-slate-100 px-4 py-2 text-right text-[10px] font-medium text-slate-400">
            Powered by Google
          </div>
        </div>
      ) : null}

      {!placesReady ? (
        <span className="mt-2 block text-xs text-slate-400">候補が出ない場合も、そのまま地名で検索できます。</span>
      ) : null}
      <div ref={detailsHostRef} className="hidden" />
    </div>
  );
}

function buildPredictionRequest(input: string, proximityOrigin?: LatLng): google.maps.places.AutocompletionRequest {
  if (!proximityOrigin) {
    return { input };
  }

  return {
    input,
    origin: proximityOrigin,
    locationRestriction: buildBounds(proximityOrigin, WALKABLE_DESTINATION_RADIUS_METERS),
  };
}

function filterAndSortPredictions(predictions: google.maps.places.AutocompletePrediction[], proximityOrigin?: LatLng) {
  const filtered = proximityOrigin
    ? predictions.filter((prediction) => {
        if (typeof prediction.distance_meters !== 'number') {
          return false;
        }

        return prediction.distance_meters <= WALKABLE_DESTINATION_RADIUS_METERS;
      })
    : predictions;

  return [...filtered].sort((a, b) => {
    const distanceA = a.distance_meters ?? Number.POSITIVE_INFINITY;
    const distanceB = b.distance_meters ?? Number.POSITIVE_INFINITY;
    return distanceA - distanceB;
  });
}

function buildBounds(center: LatLng, radiusMeters: number): google.maps.LatLngBoundsLiteral {
  const latDelta = radiusMeters / 111_320;
  const lngDelta = radiusMeters / (111_320 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)));

  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    east: center.lng + lngDelta,
    west: center.lng - lngDelta,
  };
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }

  return `${(meters / 1000).toFixed(1)}km`;
}
