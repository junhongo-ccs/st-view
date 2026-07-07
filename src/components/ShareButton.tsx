import { Link } from 'lucide-react';
import type { RouteMeta } from '../types';
import { buildShareUrl } from '../lib/shareUrl';

type ShareButtonProps = {
  disabled?: boolean;
  routeMeta: RouteMeta | null;
  onCopied: (message: string, tone?: 'success' | 'error') => void;
};

export function ShareButton({ disabled, routeMeta, onCopied }: ShareButtonProps) {
  async function copy() {
    if (disabled || !routeMeta) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildShareUrl(routeMeta));
      onCopied('Copied to clipboard');
    } catch {
      onCopied('コピーできませんでした', 'error');
    }
  }

  if (!routeMeta) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="共有 URL をコピー"
      onClick={copy}
      disabled={disabled}
      className="fixed bottom-[max(24px,env(safe-area-inset-bottom))] right-5 z-40 grid h-12 w-12 place-items-center rounded-full border border-white/45 bg-black/25 text-white shadow-float backdrop-blur-md transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Link className="h-5 w-5" strokeWidth={1.8} />
    </button>
  );
}
