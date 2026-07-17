type LoadingOverlayProps = {
  visible: boolean;
  progress: number;
  message?: string;
};

export function LoadingOverlay({ visible, progress, message = 'Preparing route...' }: LoadingOverlayProps) {
  return (
    <div
      className={`fixed inset-0 z-30 grid h-dvh place-items-center bg-slate-950/35 text-white transition duration-300 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="w-min min-w-56 text-center">
        <p className="mb-4 text-sm font-medium text-white/90">{message}</p>
        <div className="h-1 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
