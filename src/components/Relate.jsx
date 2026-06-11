import { useEffect, useMemo, useState } from 'react'
import Avatar from './Avatar.jsx'
import { membersApi } from '../api.js'
import { relationship } from '../lib/kinship.js'

export default function Relate() {
  const [members, setMembers] = useState(null) // null = loading
  const [error, setError] = useState('')
  const [aId, setAId] = useState(null)
  const [bId, setBId] = useState(null)

  useEffect(() => {
    setError('')
    membersApi
      .list()
      .then(setMembers)
      .catch(() => {
        setMembers([])
        setError('Could not load the family. Is the server running?')
      })
  }, [])

  const byId = useMemo(
    () => new Map((members || []).map((m) => [String(m.id), m])),
    [members],
  )

  const a = aId ? byId.get(String(aId)) : null
  const b = bId ? byId.get(String(bId)) : null

  const result = useMemo(() => {
    if (!a || !b) return null
    return relationship(a.id, b.id, byId)
  }, [a, b, byId])

  const swap = () => {
    setAId(bId)
    setBId(aId)
  }

  const loading = members === null
  const isEmpty = !loading && (members || []).length === 0

  return (
    <section className="section">
      <div className="section-head section-head-center">
        <h2 className="section-title">How are we related?</h2>
        <p className="section-sub">
          Pick two family members and see exactly how they’re connected — and the
          line that ties them together.
        </p>
      </div>

      {error && <p className="bday-status is-error">{error}</p>}

      {loading ? (
        <p className="roster-loading">Loading the family…</p>
      ) : isEmpty ? (
        <div className="card empty-state">
          <p className="empty-emoji" aria-hidden="true">🧬</p>
          <p>No one to compare yet. Add people in the Demographics tab first.</p>
        </div>
      ) : (
        <>
          <div className="relate-pickers">
            <PersonPicker
              label="First person"
              members={members}
              selected={a}
              onSelect={setAId}
              onClear={() => setAId(null)}
            />
            <button
              type="button"
              className="relate-swap"
              onClick={swap}
              disabled={!a && !b}
              title="Swap the two people"
              aria-label="Swap the two people"
            >
              ⇄
            </button>
            <PersonPicker
              label="Second person"
              members={members}
              selected={b}
              onSelect={setBId}
              onClear={() => setBId(null)}
            />
          </div>

          {!a || !b ? (
            <div className="card empty-state">
              <p className="empty-emoji" aria-hidden="true">🤝</p>
              <p>Choose two people above to discover their relationship.</p>
            </div>
          ) : (
            <Result a={a} b={b} result={result} byId={byId} />
          )}
        </>
      )}
    </section>
  )
}

function Result({ a, b, result, byId }) {
  if (!result) return null
  const nameA = fullName(a)
  const nameB = fullName(b)

  let headline
  if (result.via === 'self') {
    headline = `That’s the same person.`
  } else if (result.sentence) {
    headline = result.sentence
  } else if (result.via === 'none' || !result.relation) {
    headline = `No relationship could be traced between ${nameA} and ${nameB} from the records on file.`
  } else {
    headline = `${nameA} is ${nameB}’s ${result.relation}.`
  }

  const showLines =
    result.via === 'blood' &&
    (result.lineA?.length > 1 || result.lineB?.length > 1) &&
    result.commonAncestorIds?.length > 0

  return (
    <div className="relate-result card">
      {result.via !== 'none' && result.via !== 'self' && result.relation && (
        <span className={`relate-badge relate-badge-${result.via}`}>
          {result.via === 'spouse'
            ? '💍 '
            : result.via === 'marriage'
              ? '💞 '
              : '🧬 '}
          {result.relation}
        </span>
      )}
      <p className="relate-headline">{headline}</p>

      {result.via === 'spouse' && (
        <p className="relate-note">
          {nameB} is {nameA}’s {result.relation === 'partner' ? 'partner' : 'spouse'} in return.
        </p>
      )}

      {showLines && (
        <div className="relate-lines">
          <p className="relate-lines-title">
            {result.commonAncestorIds.length > 1
              ? 'Shared ancestors'
              : 'Shared ancestor'}
            : {result.commonAncestorIds.map((id) => fullName(byId.get(String(id)))).join(' & ')}
          </p>
          <div className="relate-ladders">
            <Ladder title={nameA} ids={result.lineA} byId={byId} />
            <Ladder title={nameB} ids={result.lineB} byId={byId} />
          </div>
        </div>
      )}
    </div>
  )
}

// A small "person → parent → … → shared ancestor" chain.
function Ladder({ title, ids, byId }) {
  if (!ids || ids.length === 0) return null
  return (
    <div className="relate-ladder">
      <p className="relate-ladder-head">{title}</p>
      <ol className="relate-ladder-list">
        {ids.map((id, i) => {
          const p = byId.get(String(id))
          if (!p) return null
          return (
            <li key={id} className={`relate-ladder-step ${i === ids.length - 1 ? 'is-ancestor' : ''}`}>
              <Avatar member={p} className="avatar avatar-sm" />
              <span className="relate-ladder-name">{fullName(p)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function PersonPicker({ label, members, selected, onSelect, onClear }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!q) return []
    return (members || [])
      .filter((m) => fullName(m).toLowerCase().includes(q))
      .slice(0, 10)
  }, [members, q])

  if (selected) {
    return (
      <div className="relate-picker">
        <span className="relate-picker-label">{label}</span>
        <div className="relate-chosen">
          <Avatar member={selected} className="avatar avatar-md" />
          <div className="relate-chosen-text">
            <span className="relate-chosen-name">{fullName(selected)}</span>
            {lifeShort(selected) && (
              <span className="relate-chosen-meta">{lifeShort(selected)}</span>
            )}
          </div>
          <button
            type="button"
            className="relate-change"
            onClick={() => {
              onClear()
              setQuery('')
            }}
          >
            Change
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relate-picker">
      <span className="relate-picker-label">{label}</span>
      <div className="whois-search">
        <input
          type="search"
          className="whois-search-input"
          placeholder="🔍 Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search for ${label.toLowerCase()}`}
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
                    onClick={() => {
                      onSelect(m.id)
                      setQuery('')
                    }}
                  >
                    <Avatar member={m} className="avatar avatar-sm" />
                    <span className="whois-result-name">{fullName(m)}</span>
                    {lifeShort(m) && <span className="whois-result-meta">{lifeShort(m)}</span>}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── helpers ──
function fullName(m) {
  if (!m) return 'Unknown'
  return `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Unknown'
}

function year(iso) {
  if (!iso) return ''
  const y = String(iso).split('-')[0]
  return y && y !== '0000' ? y : ''
}

function lifeShort(p) {
  const b = year(p.birthday)
  const d = year(p.dateOfDeath)
  if (b && d) return `${b} – ${d}`
  if (b) return p.deceased ? `b. ${b} †` : `b. ${b}`
  if (d) return `d. ${d}`
  return p.deceased ? '†' : ''
}
