import type { RouteMeta } from '../types';

export function buildShareUrl(meta: RouteMeta | null) {
  const url = new URL(window.location.href);
  url.search = '';

  if (meta?.encodedPath) {
    url.searchParams.set('path', `enc:${meta.encodedPath}`);
  }

  if (meta?.startLabel) {
    url.searchParams.set('startLabel', meta.startLabel);
  }

  if (meta?.endLabel) {
    url.searchParams.set('endLabel', meta.endLabel);
  }

  return url.toString();
}
