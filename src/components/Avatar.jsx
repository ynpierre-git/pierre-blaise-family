// Shows a person's photo when available, otherwise a default avatar silhouette.
// `className` carries the size/shape styling (e.g. "avatar", "tree-avatar").
export default function Avatar({ member, className = '' }) {
  return (
    <div className={className} aria-hidden="true">
      {member.photo ? (
        <img src={member.photo} alt="" loading="lazy" />
      ) : (
        <svg className="avatar-silhouette" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12.5c2.07 0 3.75-1.68 3.75-3.75S14.07 5 12 5 8.25 6.68 8.25 8.75 9.93 12.5 12 12.5zm0 1.75c-2.92 0-7 1.47-7 4.38V20h14v-1.37c0-2.91-4.08-4.38-7-4.38z" />
        </svg>
      )}
    </div>
  )
}
