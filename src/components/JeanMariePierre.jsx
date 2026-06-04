import { useState } from 'react'

// A tribute page for Jean-Marie Pierre, the family historian. The photo is
// served from public/ (drop a file named jean-marie-pierre.jpg there); until
// one exists it falls back to a silhouette. The upbringing / accolades copy is
// authored here — update the text below to refine it.
const PHOTO_SRC = '/jean-marie-pierre.jpg'

export default function JeanMariePierre() {
  const [photoOk, setPhotoOk] = useState(true)

  return (
    <section className="section jmp">
      <div className="section-head">
        <h2 className="section-title">Jean-Marie Pierre</h2>
        <p className="section-sub">Keeper of our family's history</p>
      </div>

      <div className="jmp-hero card">
        <div className="jmp-photo">
          {photoOk ? (
            <img
              src={PHOTO_SRC}
              alt="Jean-Marie Pierre"
              loading="lazy"
              onError={() => setPhotoOk(false)}
            />
          ) : (
            <svg
              className="jmp-silhouette"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 12.5c2.07 0 3.75-1.68 3.75-3.75S14.07 5 12 5 8.25 6.68 8.25 8.75 9.93 12.5 12 12.5zm0 1.75c-2.92 0-7 1.47-7 4.38V20h14v-1.37c0-2.91-4.08-4.38-7-4.38z" />
            </svg>
          )}
        </div>
        <div className="jmp-intro">
          <p className="jmp-lead">
            With dedication, patience, and vision, Jean-Marie Pierre gathered and
            preserved the story of our family — giving us a priceless gift that
            strengthens our identity and keeps our legacy alive for generations
            to come.
          </p>
        </div>
      </div>

      <div className="jmp-grid">
        <article className="card jmp-block">
          <h3 className="jmp-h3">🌱 His Upbringing</h3>
          <p>
            Rooted in <strong>Arcahaie, Haïti</strong> 🇭🇹, Jean-Marie grew up
            surrounded by the values that still shape our family today — faith,
            hard work, and a deep love of kin.
          </p>
          <p className="jmp-note">
            More of his story will be shared here soon.
          </p>
        </article>

        <article className="card jmp-block">
          <h3 className="jmp-h3">🏅 Accolades &amp; Contributions</h3>
          <ul className="jmp-list">
            <li>
              Researched and assembled the Pierre-Blaise family tree across
              multiple generations.
            </li>
            <li>
              Preserved photographs, names, and memories that might otherwise
              have been lost.
            </li>
            <li>
              Brought the family together for our reunion through his tireless
              work.
            </li>
          </ul>
          <p className="jmp-note">
            More accolades will be added here soon.
          </p>
        </article>
      </div>
    </section>
  )
}
