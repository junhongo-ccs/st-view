import type { LatLng, NavigationCue, RoutePoint } from '../types';

const EARTH_RADIUS_METERS = 6371000;

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function toDeg(value: number) {
  return (value * 180) / Math.PI;
}

export function distanceMeters(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function headingDegrees(a: LatLng, b: LatLng) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function interpolate(a: LatLng, b: LatLng, ratio: number): LatLng {
  return {
    lat: a.lat + (b.lat - a.lat) * ratio,
    lng: a.lng + (b.lng - a.lng) * ratio,
  };
}

export function sampleRoute(points: LatLng[], intervalMeters: number, maxFrames: number): RoutePoint[] {
  if (points.length < 2) {
    return points.map((point) => ({ ...point, heading: 0, cue: { label: '到着' } }));
  }

  const sampled: LatLng[] = [points[0]];
  let carried = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentDistance = distanceMeters(start, end);
    if (segmentDistance === 0) {
      continue;
    }

    let cursor = intervalMeters - carried;
    while (cursor <= segmentDistance) {
      sampled.push(interpolate(start, end, cursor / segmentDistance));
      cursor += intervalMeters;
    }
    carried = segmentDistance - (cursor - intervalMeters);
  }

  const last = points[points.length - 1];
  if (distanceMeters(sampled[sampled.length - 1], last) > 1) {
    sampled.push(last);
  }

  const limited = limitFrames(sampled, maxFrames);

  return limited.map((point, index) => {
    const next = limited[index + 1] ?? limited[index - 1] ?? point;
    return {
      ...point,
      heading: headingDegrees(point, next),
      cue: buildCue(limited, index),
    };
  });
}

function buildCue(points: LatLng[], index: number): NavigationCue {
  if (index >= points.length - 2) {
    return { label: '到着' };
  }

  if (index < 1 || index >= points.length - 1) {
    return { label: '直進' };
  }

  const currentHeading = headingDegrees(points[index - 1], points[index]);
  const nextHeading = headingDegrees(points[index], points[index + 1]);
  const turn = normalizeTurn(nextHeading - currentHeading);

  if (Math.abs(turn) < 35) {
    return { label: '直進' };
  }

  return { label: turn > 0 ? '右へ' : '左へ' };
}

function normalizeTurn(value: number) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

function limitFrames(points: LatLng[], maxFrames: number) {
  if (!Number.isFinite(maxFrames) || maxFrames <= 0 || points.length <= maxFrames) {
    return points;
  }

  const step = (points.length - 1) / (maxFrames - 1);
  return Array.from({ length: maxFrames }, (_, index) => points[Math.round(index * step)]);
}
