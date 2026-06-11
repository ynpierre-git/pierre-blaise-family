import { useEffect, useMemo, useState } from 'react'
import Avatar from './Avatar.jsx'
import { membersApi } from '../api.js'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function WhoIs({ initialId = null }) {
  const [members, setMembers] = useState(null) // null = loading
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialId ? String(initialId) : null)
  const [copied, setCopied] = useState(false)

  const load = () => {
    setError('')
    membersApi
      .list()
      .then(setMembers)
      .catch(() => {
        setMembers([])
        setError('Could not load the family. Is the server running?')
      })
  }
  useEffect(load, [])

  const byId = useMemo(
    () => new Map((members || []).map((m) => [String(m.id), m])),
    [members],
  )

  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!q) return []
    return (members || [])
      .filter((m) => fullName(m).toLowerCase().includes(q))
      .slice(0, 12)
  }, [members, q])

  const selected = selectedId ? byId.get(String(selectedId)) : null

  const select = (id) => {
    setSelectedId(String(id))
    setQuery('')
    setCopied(false)
  }

  // Keep the URL in sync with the selected person so it can be shared/bookmarked.
  useEffect(() => {
    if (selectedId) {
      const target = `#/who/${encodeURIComponent(selectedId)}`
      if (window.location.hash !== target) {
        window.history.replaceState(null, '', target)
      }
    }
  }, [selectedId])

  const copyLink = async () => {
    if (!selectedId) return
    const url = `${window.location.origin}${window.location.pathname}#/who/${encodeURIComponent(selectedId)}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard blocked (e.g. insecure context) — show the URL so it can be copied by hand.
      window.prompt('Copy this link to share the profile:', url)
    }
  }

  const children = useMemo(() => {
    if (!selected) return []
    return (members || [])
      .filter(
        (m) =>
          String(m.fatherId) === String(selected.id) ||
          String(m.motherId) === String(selected.id),
      )
      .sort(byBirth)
  }, [members, selected])

  const lineage = useMemo(
    () => (selected ? lineageToRoot(selected, byId) : []),
    [selected, byId],
  )

  const spouse = selected && hasRef(selected.spouseId, byId)
    ? byId.get(String(selected.spouseId))
    : null
  const father = selected && hasRef(selected.fatherId, byId)
    ? byId.get(String(selected.fatherId))
    : null
  const mother = selected && hasRef(selected.motherId, byId)
    ? byId.get(String(selected.motherId))
    : null

  const loading = members === null
  const isEmpty = !loading && (members || []).length === 0

  return (
    <section className="section">
      <div className="section-head section-head-center">
        <h2 className="section-title">Who is…?</h2>
        <p className="section-sub">
          Search for anyone to see their details, their immediate family, and
          their line all the way back to the family root.
        </p>
      </div>

      {error && <p className="bday-status is-error">{error}</p>}

      {loading ? (
        <p className="roster-loading">Loading the family…</p>
      ) : isEmpty ? (
        <div className="card empty-state">
          <p className="empty-emoji" aria-hidden="true">🔎</p>
          <p>No one to look up yet. Add people in the Demographics tab first.</p>
        </div>
      ) : (
        <>
          <div className="whois-search">
            <input
              type="search"
              className="whois-search-input"
              placeholder="🔍 Search a family member by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search for a family member"
            />
            {q && (
              <ul className="whois-results">
                {matches.length === 0 ? (
                  <li className="whois-result-empty">No one matches “{query.trim()}”.</li>
                ) : (
                  matches.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="whois-result"
                        onClick={() => select(m.id)}
                      >
                        <Avatar member={m} className="avatar avatar-sm" />
                        <span className="whois-result-name">{fullName(m)}</span>
                        {lifeShort(m) && (
                          <span className="whois-result-meta">{lifeShort(m)}</span>
                        )}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {!selected ? (
            <div className="card empty-state">
              <p className="empty-emoji" aria-hidden="true">👀</p>
              <p>Search above and pick a person to see who they are.</p>
            </div>
          ) : (
            <div className="whois-profile">
              <div className="whois-card card whois-card-main">
                <Avatar member={selected} className="avatar whois-photo" />
                <div className="whois-main-info">
                  <h3 className="whois-name">{fullName(selected)}</h3>
                  {selected.birthday && (
                    <p className="whois-life">Born {formatDate(selected.birthday)}</p>
                  )}
                  {selected.deceased && (
                    <p className="whois-life">
                      <em className="whois-departed">
                        {selected.dateOfDeath
                          ? `Departed this life on ${formatDate(selected.dateOfDeath)}`
                          : 'Departed this life'}
                      </em>
                    </p>
                  )}
                  {selected.gender && (
                    <p className="whois-gender">{selected.gender}</p>
                  )}

                  <div className="whois-actions">
                    <button type="button" className="btn-ghost whois-action" onClick={copyLink}>
                      {copied ? '✓ Link copied' : '🔗 Copy link'}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost whois-action"
                      onClick={() => window.print()}
                    >
                      🖨 Print / Save PDF
                    </button>
                  </div>

                  <dl className="whois-facts">
                  <Fact label="Marital status">
                    {selected.maritalStatus || '—'}
                    {spouse && (
                      <>
                        {' to '}
                        <PersonLink p={spouse} onSelect={select} />
                      </>
                    )}
                  </Fact>
                  {selected.birthday && (
                    <Fact label="Birthday">{formatDate(selected.birthday)}</Fact>
                  )}
                  {selected.deceased && (
                    <Fact label="Date of passing">
                      {selected.dateOfDeath ? formatDate(selected.dateOfDeath) : 'Deceased'}
                    </Fact>
                  )}
                  {selected.branch && <Fact label="Branch">{selected.branch}</Fact>}
                  {(selected.city || selected.country) && (
                    <Fact label="Born in">
                      {[selected.city, selected.country].filter(Boolean).join(', ')}
                    </Fact>
                  )}
                  {selected.email && (
                    <Fact label="Email">
                      <a href={`mailto:${selected.email}`}>{selected.email}</a>
                    </Fact>
                  )}
                  {selected.phone && <Fact label="Phone">{selected.phone}</Fact>}
                  {selected.notes && <Fact label="Notes">{selected.notes}</Fact>}
                  </dl>
                </div>
              </div>

              <div className="whois-card card">
                <h4 className="whois-section-title">Immediate family</h4>

                <div className="whois-rel-group">
                  <span className="whois-rel-label">Parents</span>
                  {father || mother ? (
                    <div className="whois-people">
                      {father && <PersonChipLink p={father} role="Father" onSelect={select} />}
                      {mother && <PersonChipLink p={mother} role="Mother" onSelect={select} />}
                    </div>
                  ) : (
                    <p className="whois-none">No parents on record.</p>
                  )}
                </div>

                <div className="whois-rel-group">
                  <span className="whois-rel-label">
                    {selected.maritalStatus === 'Married' || selected.maritalStatus === 'Partnered'
                      ? 'Spouse / partner'
                      : 'Spouse'}
                  </span>
                  {spouse ? (
                    <div className="whois-people">
                      <PersonChipLink p={spouse} onSelect={select} />
                    </div>
                  ) : (
                    <p className="whois-none">No spouse on record.</p>
                  )}
                </div>

                <div className="whois-rel-group">
                  <span className="whois-rel-label">
                    Children {children.length > 0 && `(${children.length})`}
                  </span>
                  {children.length > 0 ? (
                    <div className="whois-people">
                      {children.map((c) => (
                        <PersonChipLink key={c.id} p={c} onSelect={select} />
                      ))}
                    </div>
                  ) : (
                    <p className="whois-none">No children on record.</p>
                  )}
                </div>
              </div>

              <div className="whois-card card">
                <h4 className="whois-section-title">Line to the family root</h4>
                {lineage.length === 0 ? (
                  <p className="whois-none">
                    {fullName(selected)} is a root of the family — no ancestors on record.
                  </p>
                ) : (
                  <ol className="whois-lineage">
                    {lineage.map((p, i) => (
                      <li key={p.id} className="whois-lineage-step">
                        <span className="whois-lineage-rank">
                          {i === 0 ? 'Root' : `+${lineage.length - i}`}
                        </span>
                        <PersonChipLink p={p} onSelect={select} />
                      </li>
                    ))}
                    <li className="whois-lineage-step is-self">
                      <span className="whois-lineage-rank">This person</span>
                      <span className="whois-chip is-self">{fullName(selected)}</span>
                    </li>
                  </ol>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Fact({ label, children }) {
  return (
    <div className="whois-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function PersonLink({ p, onSelect }) {
  return (
    <button type="button" className="whois-inline-link" onClick={() => onSelect(p.id)}>
      {fullName(p)}
    </button>
  )
}

function PersonChipLink({ p, role, onSelect }) {
  return (
    <button type="button" className="whois-chip" onClick={() => onSelect(p.id)}>
      <Avatar member={p} className="avatar avatar-sm" />
      <span className="whois-chip-text">
        <span className="whois-chip-name">{fullName(p)}</span>
        {(role || lifeShort(p)) && (
          <span className="whois-chip-meta">
            {[role, lifeShort(p)].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
    </button>
  )
}

// ── helpers ──
function fullName(m) {
  return `${m.firstName || ''} ${m.lastName || ''}`.trim()
}

function hasRef(id, byId) {
  return id != null && id !== '' && byId.has(String(id))
}

function year(iso) {
  if (!iso) return ''
  const y = iso.split('-')[0]
  return y && y !== '0000' ? y : ''
}

function byBirth(a, b) {
  return (Number(year(a.birthday)) || 9999) - (Number(year(b.birthday)) || 9999)
}

function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const md = `${MONTHS[Number(m) - 1]} ${Number(d)}`
  return y && y !== '0000' ? `${md}, ${y}` : md
}

// Compact "1950 – 2010" / "b. 1950" / "†" used on chips and result rows.
function lifeShort(p) {
  const b = year(p.birthday)
  const d = year(p.dateOfDeath)
  if (b && d) return `${b} – ${d}`
  if (b) return p.deceased ? `b. ${b} †` : `b. ${b}`
  if (d) return `d. ${d}`
  return p.deceased ? '†' : ''
}

// Single direct line of ancestors, father-first (falling back to mother),
// returned root-first … immediate parent last. Guards against relationship loops.
function lineageToRoot(member, byId) {
  const chain = []
  const seen = new Set([String(member.id)])
  let cur = member
  while (cur) {
    const pid = hasRef(cur.fatherId, byId)
      ? String(cur.fatherId)
      : hasRef(cur.motherId, byId)
        ? String(cur.motherId)
        : null
    if (!pid || seen.has(pid)) break
    seen.add(pid)
    const parent = byId.get(pid)
    chain.push(parent)
    cur = parent
  }
  return chain.reverse()
}
