// Shows a person's photo when available, otherwise a default person emoji chosen
// by sex (dark skin tone, reflecting our family). `className` carries the
// size/shape styling (e.g. "avatar", "avatar-lg").
export default function Avatar({ member, className = '' }) {
  const hasPhoto = Boolean(member.photo)
  return (
    <div className={hasPhoto ? className : `${className} avatar-fallback`} aria-hidden="true">
      {hasPhoto ? (
        <img src={member.photo} alt="" loading="lazy" />
      ) : (
        <span className="avatar-emoji">{genderEmoji(member.gender)}</span>
      )}
    </div>
  )
}

// Default avatar emoji by sex — medium-dark skin tone. Anything other than
// male/female (incl. blank, "Other", "Prefer not to say") falls back to a
// neutral person.
function genderEmoji(gender) {
  const g = (gender || '').trim().toLowerCase()
  if (g.startsWith('m')) return '👨🏾'
  if (g.startsWith('f')) return '👩🏾'
  return '🧑🏾'
}
