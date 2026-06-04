import { useEffect, useMemo, useState } from 'react'
import Avatar from './Avatar.jsx'
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
        <div>
          <h2 className="section-title">The Family Tree</h2>
          <p className="section-sub">
            Built automatically from the records and their father / mother / spouse links.
          </p>
        </div>
        <div className="ftree-controls">
          <button type="button" className="btn-ghost" onClick={load}>
            ↻ Refresh
          </button>
          {!isEmpty && !loading && (
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
      ) : (
        <>
          <Legend />
          <div className="ftree-scroll">
            <div className="ftree">
              {roots.map((root) => (
                <ul key={root.person.id} className="ftree-rootlist">
                  <TreeNode
                    node={root}
                    depth={1}
                    collapsed={collapsed}
                    onToggle={toggle}
                    ancestors={EMPTY_SET}
                  />
                </ul>
              ))}
            </div>
          </div>
          <p className="ftree-count">
            {members.length} family {members.length === 1 ? 'member' : 'members'}
          </p>
        </>
      )}
    </section>
  )
}

const EMPTY_SET = new Set()

function TreeNode({ node, depth, collapsed, onToggle, ancestors }) {
  const key = node.person.id
  if (ancestors.has(key)) return null // guard against relationship cycles

  const kids = node.children || []
  const hasKids = kids.length > 0
  const isCollapsed = collapsed.has(key)
  const nextAncestors = new Set(ancestors).add(key)

  return (
    <li>
      <div className="ftree-node">
        <CoupleCard person={node.person} spouse={node.spouse} depth={depth} />
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
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function CoupleCard({ person, spouse, depth }) {
  return (
    <div className={`couple-card gen-${Math.min(depth, 4)} ${spouse ? 'is-couple' : ''}`}>
      <PersonChip p={person} />
      {spouse && (
        <>
          <span className="marriage" aria-label="married to">
            &amp;
          </span>
          <PersonChip p={spouse} married />
        </>
      )}
    </div>
  )
}

function PersonChip({ p, married }) {
  return (
    <div className={`chip ${married ? 'chip-married' : ''}`}>
      <Avatar member={{ firstName: p.firstName, photo: p.photo }} className="chip-avatar" />
      <div className="chip-info">
        <span className="chip-name">{p.firstName}</span>
        <span className="chip-sur">{p.lastName}</span>
        {p.born && <span className="chip-born">b. {p.born}</span>}
      </div>
    </div>
  )
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
    born: m.birthday ? m.birthday.split('-')[0] : '',
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
