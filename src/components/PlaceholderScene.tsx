type PlaceholderSceneProps = {
  imageUrl?: string;
};

export function PlaceholderScene({ imageUrl }: PlaceholderSceneProps) {
  const isStreetViewPreview = Boolean(imageUrl);

  return (
    <div className="fixed inset-0 h-dvh w-screen overflow-hidden bg-sky-50">
      <img
        src={imageUrl ?? '/placeholder-street.png'}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      {isStreetViewPreview ? (
        <>
          <div className="absolute inset-0 bg-slate-950/45" />
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-slate-950/60 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-slate-950/75 to-transparent" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-white/10" />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/75 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-sky-100/85 to-transparent" />
        </>
      )}
    </div>
  );
}
