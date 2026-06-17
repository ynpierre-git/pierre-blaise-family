// Full-screen media viewer shared by Events and member photo galleries.
// `item` is { type?: 'video' | 'image', url, name? }. With count > 1 it shows
// prev/next arrows and a counter.
export default function Lightbox({ item, count, index, onPrev, onNext, onClose }) {
  const multiple = count > 1
  return (
    <div
      className="lightbox-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <button type="button" className="lightbox-close" aria-label="Close" onClick={onClose}>
        ×
      </button>

      {multiple && (
        <button
          type="button"
          className="lightbox-nav lightbox-prev"
          aria-label="Previous"
          onClick={onPrev}
        >
          ‹
        </button>
      )}

      <figure className="lightbox-figure">
        {item.type === 'video' ? (
          <video src={item.url} controls autoPlay playsInline />
        ) : (
          <img src={sizedImage(item.url, 1600, 80)} alt={item.name || ''} />
        )}
        {(item.name || multiple) && (
          <figcaption className="lightbox-caption">
            {item.name}
            {multiple && <span className="lightbox-counter">{index + 1} / {count}</span>}
          </figcaption>
        )}
      </figure>

      {multiple && (
        <button
          type="button"
          className="lightbox-nav lightbox-next"
          aria-label="Next"
          onClick={onNext}
        >
          ›
        </button>
      )}
    </div>
  )
}

// Photos are stored at full resolution (often many MB). Supabase Storage can
// resize on the fly via its image-render endpoint, so we request a small version
// for thumbnails and a medium one for the lightbox instead of the originals.
// Only applies to public Storage image URLs; base64/other URLs pass through.
export function sizedImage(url, width, quality = 72) {
  if (!url || !url.includes('/storage/v1/object/public/')) return url
  const rendered = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/',
  )
  // resize=contain keeps the full image and correct aspect ratio (the default
  // 'cover' mode leaves the original height, producing a distorted sliver).
  return `${rendered}?width=${width}&quality=${quality}&resize=contain`
}
