export function getEncodedPathFromUrl() {
  const raw = new URLSearchParams(window.location.search).get('path');
  if (!raw?.startsWith('enc:')) {
    return null;
  }
  return raw.slice(4);
}
