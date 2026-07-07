import type { ToastState } from '../types';

type ToastProps = {
  toast: ToastState | null;
};

export function Toast({ toast }: ToastProps) {
  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-float transition duration-300 ${
        toast ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      } ${toast?.tone === 'error' ? 'bg-rose-600' : 'bg-brand'}`}
    >
      {toast?.message}
    </div>
  );
}
