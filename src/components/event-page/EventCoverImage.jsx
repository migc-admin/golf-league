// Cover image in a fixed-height frame on a dark green backdrop. `object-contain` means
// a tall poster and a wide photo are both shown in full, never cropped.

export default function EventCoverImage({ src, alt }) {
  if (!src) return null
  return (
    <div className="flex h-[360px] w-full items-center justify-center overflow-hidden rounded-sm bg-fairway-800 lg:h-[500px]">
      <img src={src} alt={alt ?? ''} className="block h-full w-full object-contain" />
    </div>
  )
}
