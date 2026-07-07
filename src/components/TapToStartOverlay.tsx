type TapToStartOverlayProps = {
  visible: boolean;
  onStart: () => void;
};

export function TapToStartOverlay({ visible, onStart }: TapToStartOverlayProps) {
  return (
    <button
      type="button"
      onClick={onStart}
      className={`fixed inset-0 z-30 grid h-dvh w-screen place-items-center bg-black/20 text-white backdrop-blur-[1px] transition duration-500 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      aria-label="再生を開始"
    >
      <span className="rounded-full border border-white/35 bg-black/20 px-5 py-2 text-sm font-medium shadow-float backdrop-blur-md">
        Tap to Start
      </span>
    </button>
  );
}
