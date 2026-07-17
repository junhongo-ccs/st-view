import type { LatLng, NavigationCue, RoutePoint, TurnCueAnchor } from '../types';

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

function nearestPointOnSegment(point: LatLng, a: LatLng, b: LatLng): { point: LatLng; distance: number } {
  const lngScale = Math.cos(toRad(a.lat));
  const abX = (b.lng - a.lng) * lngScale;
  const abY = b.lat - a.lat;
  const apX = (point.lng - a.lng) * lngScale;
  const apY = point.lat - a.lat;
  const abLengthSq = abX * abX + abY * abY;
  const ratio = abLengthSq === 0 ? 0 : Math.max(0, Math.min(1, (apX * abX + apY * abY) / abLengthSq));
  const projected = interpolate(a, b, ratio);
  return { point: projected, distance: distanceMeters(point, projected) };
}

// Pulls points back onto the reference corridor when they drift past corridorMeters, or unconditionally where forceSnap
// is set (e.g. underground passages, which sit right below the surface corridor and pass the distance check as-is).
// path and corridor represent the same start-to-end route, so - as with assignTurnCues below - a forward-only
// segment cursor (instead of a full corridor rescan per point) keeps this O(path + corridor) rather than O(path * corridor).
export function snapToRoadCorridor(
  path: LatLng[],
  corridor: LatLng[],
  corridorMeters: number,
  forceSnap: boolean[] = [],
): LatLng[] {
  if (corridor.length === 0) {
    return path;
  }
  if (corridor.length === 1) {
    return path.map((point, index) => {
      const distance = distanceMeters(point, corridor[0]);
      return forceSnap[index] || distance > corridorMeters ? corridor[0] : point;
    });
  }

  let segmentIndex = 1;

  return path.map((point, index) => {
    let best = nearestPointOnSegment(point, corridor[segmentIndex - 1], corridor[segmentIndex]);
    while (segmentIndex + 1 < corridor.length) {
      const next = nearestPointOnSegment(point, corridor[segmentIndex], corridor[segmentIndex + 1]);
      if (next.distance >= best.distance) {
        break;
      }
      segmentIndex += 1;
      best = next;
    }

    return forceSnap[index] || best.distance > corridorMeters ? best.point : point;
  });
}

const TURN_CUE_RADIUS_METERS = 18;

export function sampleRoute(
  points: LatLng[],
  intervalMeters: number,
  maxFrames: number,
  turnCueAnchors: TurnCueAnchor[] = [],
): RoutePoint[] {
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

  // Cue assignment runs on the full-resolution sampled points, before frame-limiting drops any of them -
  // otherwise a turn whose nearest point gets thinned out would silently vanish from the final route.
  const { cues: fullCues, anchorPointIndices } = assignTurnCues(sampled, turnCueAnchors);
  const keepIndices = limitFrameIndices(sampled.length, maxFrames, anchorPointIndices);
  const limited = keepIndices.map((index) => sampled[index]);
  const limitedCues = keepIndices.map((index) => fullCues[index]);

  return limited.map((point, index) => {
    const next = limited[index + 1] ?? limited[index - 1] ?? point;
    return {
      ...point,
      heading: headingDegrees(point, next),
      cue: index >= limited.length - 2 ? { label: '到着' } : limitedCues[index] ?? { label: '直進' },
    };
  });
}

// Anchors are already in route order (getTurnCueAnchors walks legs/steps sequentially), so a forward-only
// pointer over them - instead of a per-point global-nearest search - keeps a point from matching a turn it
// hasn't reached yet, or re-matching one already passed just because the route geometry loops back near it.
// Also tracks, per anchor, the single closest point index - limitFrameIndices uses this to guarantee turns
// survive frame-limiting instead of being thinned out by plain uniform-index sampling.
function assignTurnCues(
  points: LatLng[],
  turnCueAnchors: TurnCueAnchor[],
): { cues: (NavigationCue | null)[]; anchorPointIndices: number[] } {
  const cues: (NavigationCue | null)[] = new Array(points.length).fill(null);
  const anchorPointIndices: number[] = [];
  if (turnCueAnchors.length === 0) {
    return { cues, anchorPointIndices };
  }

  let anchorIndex = 0;
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  const flushBest = () => {
    if (bestIndex !== -1) {
      anchorPointIndices.push(bestIndex);
    }
    bestIndex = -1;
    bestDistance = Number.POSITIVE_INFINITY;
  };

  for (let index = 0; index < points.length; index += 1) {
    let distance = distanceMeters(points[index], turnCueAnchors[anchorIndex]);
    while (anchorIndex + 1 < turnCueAnchors.length) {
      const nextDistance = distanceMeters(points[index], turnCueAnchors[anchorIndex + 1]);
      if (nextDistance >= distance) {
        break;
      }
      flushBest();
      anchorIndex += 1;
      distance = nextDistance;
    }

    if (distance <= TURN_CUE_RADIUS_METERS) {
      cues[index] = turnCueAnchors[anchorIndex].cue;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
  }
  flushBest();

  return { cues, anchorPointIndices };
}

// Uniformly thins pointCount down to maxFrames by index, except indices in mustKeepIndices (plus the first
// and last) are always kept; the remaining budget is distributed proportionally across the gaps between them.
function limitFrameIndices(pointCount: number, maxFrames: number, mustKeepIndices: number[]): number[] {
  if (!Number.isFinite(maxFrames) || maxFrames <= 0 || pointCount <= maxFrames) {
    return Array.from({ length: pointCount }, (_, index) => index);
  }

  const required = new Set(mustKeepIndices);
  required.add(0);
  required.add(pointCount - 1);
  const requiredSorted = Array.from(required).sort((a, b) => a - b);

  if (requiredSorted.length >= maxFrames) {
    const step = (requiredSorted.length - 1) / (maxFrames - 1);
    return Array.from({ length: maxFrames }, (_, index) => requiredSorted[Math.round(index * step)]);
  }

  const resultIndices = new Set(requiredSorted);
  const budgetForFill = maxFrames - requiredSorted.length;
  const totalSpan = requiredSorted[requiredSorted.length - 1] - requiredSorted[0] || 1;

  for (let i = 0; i < requiredSorted.length - 1; i += 1) {
    const gapStart = requiredSorted[i];
    const gapEnd = requiredSorted[i + 1];
    const gapLength = gapEnd - gapStart;
    if (gapLength <= 1) {
      continue;
    }

    const fillCount = Math.min(gapLength - 1, Math.round((budgetForFill * gapLength) / totalSpan));
    for (let f = 1; f <= fillCount; f += 1) {
      resultIndices.add(gapStart + Math.round((f * gapLength) / (fillCount + 1)));
    }
  }

  return Array.from(resultIndices).sort((a, b) => a - b);
}
