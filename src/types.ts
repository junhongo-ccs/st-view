export type AppPhase =
  | 'empty'
  | 'searching'
  | 'loadingRoute'
  | 'prefetchingImages'
  | 'ready'
  | 'playing'
  | 'error';

export type LatLng = {
  lat: number;
  lng: number;
};

export type RoutePoint = LatLng & {
  heading: number;
  cue: NavigationCue;
};

export type NavigationCue = {
  label: '直進' | '左へ' | '右へ' | 'やや左へ' | 'やや右へ' | '大きく左へ' | '大きく右へ' | 'Uターン' | '到着';
};

export type TurnCueAnchor = LatLng & {
  cue: NavigationCue;
};

export type RouteEndpoint = {
  label: string;
  location?: LatLng;
};

export type RouteMeta = {
  startLabel: string;
  endLabel: string;
  encodedPath?: string;
};

export type ToastState = {
  message: string;
  tone?: 'success' | 'error';
};
