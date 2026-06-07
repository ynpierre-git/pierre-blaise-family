import { useEffect, useMemo, useState } from 'react'
import { membersApi } from '../api.js'

const GENERATION_LABELS = [
  'First Generation',
  'Second Generation',
  'Third Generation',
  'Fourth Generation+',
]

export default function FamilyTree() {
  const [members, setMembers] = useState(null) // null = loading
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [query, setQuery] = useState('')

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

  const { roots, collapsibleKeys } = useMemo(
    () => buildForest(members || []),
    [members],
  )

  const q = query.trim().toLowerCase()
  const searching = q.length > 0

  // When searching, find matching people and prune the forest to just the
  // branch(es) they belong to: each match keeps its ancestors (so you can see
  // where they sit) and its full set of descendants.
  const { displayRoots, matchIds, matchCount } = useMemo(() => {
    if (!searching) return { displayRoots: roots, matchIds: EMPTY_SET, matchCount: 0 }
    const ids = new Set()
    const test = (p) => {
      if (!p) return false
      const full = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase()
      const hit =
        full.includes(q) ||
        (p.firstName || '').toLowerCase().includes(q) ||
        (p.lastName || '').toLowerCase().includes(q)
      if (hit) ids.add(p.id)
      return hit
    }
    const prune = (node) => {
      const selfMatch = [test(node.person), test(node.spouse)].some(Boolean)
      if (selfMatch) return node // keep the whole subtree under a match
      const kids = (node.children || []).map(prune).filter(Boolean)
      return kids.length ? { ...node, children: kids } : null
    }
    const pruned = roots.map(prune).filter(Boolean)
    return { displayRoots: pruned, matchIds: ids, matchCount: ids.size }
  }, [roots, q, searching])

  const toggle = (key) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const expandAll = () => setCollapsed(new Set())
  const collapseAll = () => setCollapsed(new Set(collapsibleKeys))

  const loading = members === null
  const isEmpty = !loading && roots.length === 0

  return (
    <section className="section">
      <div className="section-head section-head-row">
        <div className="ftree-controls">
          <button type="button" className="btn-ghost" onClick={load}>
            ↻ Refresh
          </button>
          {!isEmpty && !loading && !searching && (
            <>
              <button type="button" className="btn-ghost" onClick={expandAll}>
                Expand all
              </button>
              <button type="button" className="btn-ghost" onClick={collapseAll}>
                Collapse all
              </button>
            </>
          )}
        </div>
        {!isEmpty && !loading && (
          <div className="ftree-search">
            <input
              type="search"
              className="ftree-search-input"
              placeholder="Search by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search the family tree by name"
            />
            {searching && (
              <button
                type="button"
                className="ftree-search-clear"
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="bday-status is-error">{error}</p>}

      {loading ? (
        <p className="roster-loading">Loading the family…</p>
      ) : isEmpty ? (
        <div className="card empty-state">
          <p className="empty-emoji" aria-hidden="true">🌳</p>
          <p>
            No one to show yet. Add people in the Demographics tab — set their father,
            mother and spouse to grow the tree.
          </p>
        </div>
      ) : searching && displayRoots.length === 0 ? (
        <div className="card empty-state">
          <p className="empty-emoji" aria-hidden="true">🔍</p>
          <p>
            No one matches “{query.trim()}”. Try a first or last name.
          </p>
        </div>
      ) : (
        <>
          <Legend />
          <div className="ftree-scroll">
            <div className="ftree">
              {displayRoots.map((root) => (
                <ul key={root.person.id} className="ftree-rootlist">
                  <TreeNode
                    node={root}
                    depth={1}
                    collapsed={searching ? EMPTY_SET : collapsed}
                    onToggle={toggle}
                    ancestors={EMPTY_SET}
                    matchIds={matchIds}
                  />
                </ul>
              ))}
            </div>
          </div>
          <p className="ftree-count">
            {searching
              ? `${matchCount} ${matchCount === 1 ? 'match' : 'matches'} for “${query.trim()}”`
              : `${members.length} family ${members.length === 1 ? 'member' : 'members'}`}
          </p>
        </>
      )}
    </section>
  )
}

const EMPTY_SET = new Set()

function TreeNode({ node, depth, collapsed, onToggle, ancestors, matchIds }) {
  const key = node.person.id
  if (ancestors.has(key)) return null // guard against relationship cycles

  const kids = node.children || []
  const hasKids = kids.length > 0
  const isCollapsed = collapsed.has(key)
  const nextAncestors = new Set(ancestors).add(key)

  return (
    <li>
      <div className="ftree-node">
        <CoupleCard
          person={node.person}
          spouse={node.spouse}
          depth={depth}
          matchIds={matchIds}
        />
        {hasKids && (
          <button
            type="button"
            className={`ftree-toggle ${isCollapsed ? 'is-collapsed' : ''}`}
            onClick={() => onToggle(key)}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? 'Expand branch' : 'Collapse branch'}
            aria-label={
              isCollapsed
                ? `Expand ${node.person.firstName}'s branch (${countDescendants(node)} hidden)`
                : `Collapse ${node.person.firstName}'s branch`
            }
          >
            {isCollapsed ? `+${countDescendants(node)}` : '–'}
          </button>
        )}
      </div>

      {hasKids && !isCollapsed && (
        <ul>
          {kids.map((child) => (
            <TreeNode
              key={child.person.id}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
              ancestors={nextAncestors}
              matchIds={matchIds}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function CoupleCard({ person, spouse, depth, matchIds }) {
  const isMatch = (p) => p && matchIds && matchIds.has(p.id)
  return (
    <div className={`couple-card gen-${Math.min(depth, 4)} ${spouse ? 'is-couple' : ''}`}>
      <PersonChip p={person} match={isMatch(person)} />
      {spouse && (
        <>
          <span className="marriage" aria-label="married to">
            &amp;
          </span>
          <PersonChip p={spouse} married match={isMatch(spouse)} />
        </>
      )}
    </div>
  )
}

function PersonChip({ p, married, match }) {
  return (
    <div className={`chip ${married ? 'chip-married' : ''} ${match ? 'chip-match' : ''}`}>
      <span className="chip-line">
        <span className="chip-name">{p.firstName}</span>
        {p.lastName && <span className="chip-sur">{p.lastName}</span>}
      </span>
      {lifespan(p) && <span className="chip-born">{lifespan(p)}</span>}
    </div>
  )
}

// A compact life span for the chip: "1950 – 2010", "b. 1950", "b. 1950 †",
// "d. 2010", or just "†" when someone is marked deceased without dates.
function lifespan(p) {
  if (p.born && p.died) return `${p.born} – ${p.died}`
  if (p.born) return p.deceased ? `b. ${p.born} †` : `b. ${p.born}`
  if (p.died) return `d. ${p.died}`
  return p.deceased ? '†' : ''
}

function Legend() {
  return (
    <div className="ftree-legend">
      {GENERATION_LABELS.map((label, i) => (
        <span key={label} className="ftree-legend-item">
          <span className={`ftree-dot ftree-dot-${i + 1}`} />
          {label}
        </span>
      ))}
      <span className="ftree-legend-item">
        <span className="ftree-married-key">&amp;</span> married
      </span>
    </div>
  )
}

function countDescendants(node) {
  const kids = node.children || []
  let n = 0
  for (const c of kids) {
    n += 1 + (c.spouse ? 1 : 0) + countDescendants(c)
  }
  return n
}

// Birth year for display/sorting — empty when unknown (incl. the 0000 placeholder
// used for birthdays saved without a year).
function birthYear(birthday) {
  if (!birthday) return ''
  const y = birthday.split('-')[0]
  return y && y !== '0000' ? y : ''
}

// ── Build a nested forest of couples/people from the flat member list ──
function buildForest(members) {
  if (!members.length) return { roots: [], collapsibleKeys: [] }

  const byId = new Map(members.map((m) => [String(m.id), m]))
  const idOf = (m) => String(m.id)
  const has = (id) => id && byId.has(String(id))

  // Symmetric spouse map (from spouseId both directions, plus inferred co-parents).
  const spouse = new Map()
  const linkSpouse = (a, b) => {
    if (!spouse.has(a)) spouse.set(a, b)
    if (!spouse.has(b)) spouse.set(b, a)
  }
  for (const m of members) {
    if (has(m.spouseId)) linkSpouse(idOf(m), String(m.spouseId))
  }
  for (const m of members) {
    if (has(m.fatherId) && has(m.motherId)) {
      linkSpouse(String(m.fatherId), String(m.motherId))
    }
  }

  const hasParent = (m) => has(m.fatherId) || has(m.motherId)
  const parentId = (m) =>
    has(m.fatherId) ? String(m.fatherId) : has(m.motherId) ? String(m.motherId) : null

  // Assign each member to a couple, anchored on the bloodline partner when possible.
  const anchorOf = new Map() // memberId -> anchor (couple) id
  const coupleSpouse = new Map() // anchorId -> spouseId | null
  const seen = new Set()
  for (const m of members) {
    const id = idOf(m)
    if (seen.has(id)) continue
    const sp = spouse.get(id)
    if (sp && byId.has(sp) && !seen.has(sp)) {
      const aHas = hasParent(byId.get(id))
      const bHas = hasParent(byId.get(sp))
      // Anchor = the partner with parents in the data (so the couple roots on a bloodline).
      const anchorId = bHas && !aHas ? sp : id
      const spouseId = anchorId === id ? sp : id
      anchorOf.set(id, anchorId)
      anchorOf.set(sp, anchorId)
      coupleSpouse.set(anchorId, spouseId)
      seen.add(id)
      seen.add(sp)
    } else {
      anchorOf.set(id, id)
      coupleSpouse.set(id, null)
      seen.add(id)
    }
  }

  const makePerson = (m) => ({
    id: idOf(m),
    firstName: m.firstName,
    lastName: m.lastName,
    born: birthYear(m.birthday),
    died: birthYear(m.dateOfDeath),
    deceased: !!m.deceased,
    photo: m.photo,
  })

  // One node per couple anchor.
  const nodeByAnchor = new Map()
  for (const [anchorId, spouseId] of coupleSpouse) {
    nodeByAnchor.set(anchorId, {
      person: makePerson(byId.get(anchorId)),
      spouse: spouseId ? makePerson(byId.get(spouseId)) : null,
      children: [],
    })
  }

  // Attach each couple under its anchor's parents; otherwise it's a root.
  const roots = []
  for (const [anchorId, node] of nodeByAnchor) {
    const anchor = byId.get(anchorId)
    const pid = parentId(anchor)
    const parentAnchor = pid ? anchorOf.get(pid) : null
    const parentNode = parentAnchor ? nodeByAnchor.get(parentAnchor) : null
    if (parentNode && parentNode !== node) parentNode.children.push(node)
    else roots.push(node)
  }

  // Sort by birth year (unknown years sink to the bottom), and collect collapsible keys.
  const byBorn = (a, b) =>
    (Number(a.person.born) || 9999) - (Number(b.person.born) || 9999)
  const collapsibleKeys = []
  const sortAndCollect = (n) => {
    if (n.children.length) {
      n.children.sort(byBorn)
      collapsibleKeys.push(n.person.id)
      n.children.forEach(sortAndCollect)
    }
  }
  roots.sort(byBorn)
  roots.forEach(sortAndCollect)

  return { roots, collapsibleKeys }
}
