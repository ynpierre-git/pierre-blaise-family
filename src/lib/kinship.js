// Relationship ("How are we related?") engine.
//
// Works off the flat member list (the same records the rest of the app uses):
// each person has fatherId / motherId / spouseId. Given two people A and B it
// returns how A is related to B ("A is B's ___"), plus the supporting lineage
// paths so the UI can show *why*.
//
// It handles: same person, spouses/partners, the direct line (parent ↔ child,
// grand-, great-grand-…), siblings (incl. half-siblings when both parents are
// known), aunts/uncles & nieces/nephews (incl. great-), cousins with the
// correct "Nth cousin M times removed" degree, and a light by-marriage
// (in-law) fallback. All graph walks are cycle-guarded.

const norm = (s) => (s == null ? '' : String(s)).trim().toLowerCase()
const fn = (m) => (m && m.firstName ? String(m.firstName).trim() : '') || 'This person'

function validId(id) {
  return id != null && id !== ''
}

// Term picked by the *subject's* gender, with a neutral fallback.
function gterm(person, male, female, neutral) {
  const g = norm(person && person.gender)
  if (g.startsWith('m')) return male
  if (g.startsWith('f')) return female
  return neutral
}

function parentIds(m, byId) {
  const out = []
  for (const pid of [m.fatherId, m.motherId]) {
    if (validId(pid) && byId.has(String(pid))) out.push(String(pid))
  }
  return out
}

// Spouse links are stored one-directionally, so check both directions.
function spouseOf(m, byId) {
  if (validId(m.spouseId) && byId.has(String(m.spouseId))) return byId.get(String(m.spouseId))
  for (const x of byId.values()) {
    if (validId(x.spouseId) && String(x.spouseId) === String(m.id)) return x
  }
  return null
}

function isSpouse(a, b) {
  return (
    (validId(a.spouseId) && String(a.spouseId) === String(b.id)) ||
    (validId(b.spouseId) && String(b.spouseId) === String(a.id))
  )
}

function spouseTerm(a) {
  if (norm(a.maritalStatus) === 'partnered') return 'partner'
  return gterm(a, 'husband', 'wife', 'spouse')
}

// Map of ancestorId -> minimal generation distance (BFS up the parent links,
// includes self at distance 0). FIFO order guarantees first-seen = shortest.
function ancestorMap(id, byId) {
  const dist = new Map([[String(id), 0]])
  const queue = [String(id)]
  while (queue.length) {
    const cur = queue.shift()
    const d = dist.get(cur)
    const m = byId.get(cur)
    if (!m) continue
    for (const pid of parentIds(m, byId)) {
      if (dist.has(pid)) continue
      dist.set(pid, d + 1)
      queue.push(pid)
    }
  }
  return dist
}

// Shortest chain of ids from `fromId` up to (and including) ancestor `toId`.
function pathUp(fromId, toId, byId) {
  const from = String(fromId)
  const to = String(toId)
  const prev = new Map([[from, null]])
  const queue = [from]
  while (queue.length) {
    const cur = queue.shift()
    if (cur === to) break
    const m = byId.get(cur)
    if (!m) continue
    for (const pid of parentIds(m, byId)) {
      if (prev.has(pid)) continue
      prev.set(pid, cur)
      queue.push(pid)
    }
  }
  if (!prev.has(to)) return [from]
  const path = []
  let c = to
  while (c != null) {
    path.push(c)
    c = prev.get(c)
  }
  return path.reverse() // [from, …, ancestor]
}

const ORDINALS = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth']
function ordinal(n) {
  return ORDINALS[n] || `${n}th`
}
function removedText(n) {
  if (n <= 0) return ''
  if (n === 1) return ' once removed'
  if (n === 2) return ' twice removed'
  if (n === 3) return ' three times removed'
  return ` ${n} times removed`
}
const greats = (n) => 'great-'.repeat(Math.max(0, n))

// A is an ancestor of B, B is `d` generations below A.
function ancestorTerm(a, d) {
  if (d === 1) return gterm(a, 'father', 'mother', 'parent')
  return greats(d - 2) + gterm(a, 'grandfather', 'grandmother', 'grandparent')
}

// A is a descendant of B, A is `d` generations below B.
function descendantTerm(a, d) {
  if (d === 1) return gterm(a, 'son', 'daughter', 'child')
  return greats(d - 2) + gterm(a, 'grandson', 'granddaughter', 'grandchild')
}

// A and B share a common ancestor, A is `dA` steps up to it, B is `dB` steps up.
function collateralTerm(a, dA, dB, half) {
  if (dA === 1 && dB === 1) {
    const sib = gterm(a, 'brother', 'sister', 'sibling')
    return half ? `half-${sib}` : sib
  }
  if (dA === 1 && dB >= 2) {
    return greats(dB - 2) + gterm(a, 'uncle', 'aunt', 'aunt or uncle')
  }
  if (dB === 1 && dA >= 2) {
    return greats(dA - 2) + gterm(a, 'nephew', 'niece', 'niece or nephew')
  }
  const degree = Math.min(dA, dB) - 1
  return `${ordinal(degree)} cousin${removedText(Math.abs(dA - dB))}`
}

// Pure blood relationship of A to B, or null if none. Shared by the main entry
// point and the in-law fallback.
function bloodResult(aId, bId, byId) {
  const a = byId.get(String(aId))
  const b = byId.get(String(bId))
  if (!a || !b || String(aId) === String(bId)) return null

  const ancA = ancestorMap(aId, byId)
  const ancB = ancestorMap(bId, byId)

  if (ancB.has(String(aId))) {
    const d = ancB.get(String(aId))
    return {
      relation: ancestorTerm(a, d),
      commonAncestorIds: [String(aId)],
      lineA: [String(aId)],
      lineB: pathUp(bId, aId, byId),
    }
  }
  if (ancA.has(String(bId))) {
    const d = ancA.get(String(bId))
    return {
      relation: descendantTerm(a, d),
      commonAncestorIds: [String(bId)],
      lineA: pathUp(aId, bId, byId),
      lineB: [String(bId)],
    }
  }

  let best = null
  for (const [ca, dA] of ancA) {
    if (!ancB.has(ca)) continue
    const dB = ancB.get(ca)
    if (!best || dA + dB < best.dA + best.dB) best = { ca, dA, dB }
  }
  if (!best) return null

  const sameLevel = [...ancA.keys()].filter(
    (ca) => ancB.has(ca) && ancA.get(ca) === best.dA && ancB.get(ca) === best.dB,
  )

  // Only claim "half-" when we can prove it: both have two known parents and
  // they share exactly one. Otherwise stay neutral (avoids wrong half-labels
  // when a parent simply isn't recorded).
  let half = false
  if (best.dA === 1 && best.dB === 1) {
    const pa = parentIds(a, byId)
    const pb = parentIds(b, byId)
    if (pa.length === 2 && pb.length === 2) {
      half = pa.filter((x) => pb.includes(x)).length === 1
    }
  }

  return {
    relation: collateralTerm(a, best.dA, best.dB, half),
    dA: best.dA,
    dB: best.dB,
    commonAncestorIds: sameLevel,
    lineA: pathUp(aId, best.ca, byId),
    lineB: pathUp(bId, best.ca, byId),
  }
}

const SIBLING_WORDS = ['brother', 'sister', 'sibling', 'half-brother', 'half-sister', 'half-sibling']

// A is `blood` of B's spouse → A's in-law term toward B.
function inLawTerm(a, blood) {
  if (SIBLING_WORDS.includes(blood)) return gterm(a, 'brother-in-law', 'sister-in-law', 'sibling-in-law')
  if (['father', 'mother', 'parent'].includes(blood)) return gterm(a, 'father-in-law', 'mother-in-law', 'parent-in-law')
  return null
}

// A's spouse is `blood` of B → A's in-law term toward B.
function inLawTermViaOwnSpouse(a, blood) {
  if (SIBLING_WORDS.includes(blood)) return gterm(a, 'brother-in-law', 'sister-in-law', 'sibling-in-law')
  if (['son', 'daughter', 'child'].includes(blood)) return gterm(a, 'son-in-law', 'daughter-in-law', 'child-in-law')
  return null
}

function marriageRelation(a, b, byId) {
  const fnA = fn(a)
  const fnB = fn(b)

  const bsp = spouseOf(b, byId)
  if (bsp && String(bsp.id) !== String(a.id)) {
    const blood = bloodResult(a.id, bsp.id, byId)
    if (blood) {
      const term = inLawTerm(a, blood.relation)
      const sw = gterm(bsp, 'husband', 'wife', 'spouse')
      return {
        via: 'marriage',
        relation: term || 'related by marriage',
        sentence: term
          ? `${fnA} is ${fnB}'s ${term}.`
          : `${fnA} is related to ${fnB} by marriage — ${fnA} is the ${blood.relation} of ${fnB}'s ${sw}.`,
        lineA: [],
        lineB: [],
        commonAncestorIds: [],
      }
    }
  }

  const asp = spouseOf(a, byId)
  if (asp && String(asp.id) !== String(b.id)) {
    const blood = bloodResult(asp.id, b.id, byId)
    if (blood) {
      const term = inLawTermViaOwnSpouse(a, blood.relation)
      const sw = gterm(asp, 'husband', 'wife', 'spouse')
      return {
        via: 'marriage',
        relation: term || 'related by marriage',
        sentence: term
          ? `${fnA} is ${fnB}'s ${term}.`
          : `${fnA} is related to ${fnB} by marriage — ${fnA}'s ${sw} is ${fnB}'s ${blood.relation}.`,
        lineA: [],
        lineB: [],
        commonAncestorIds: [],
      }
    }
  }

  return null
}

// Main entry point. Returns a result describing how A relates to B:
//   { via, relation, sentence?, lineA, lineB, commonAncestorIds }
// `via` is one of 'self' | 'spouse' | 'blood' | 'marriage' | 'none'.
export function relationship(aId, bId, byId) {
  const a = byId.get(String(aId))
  const b = byId.get(String(bId))
  if (!a || !b) return null

  if (String(aId) === String(bId)) {
    return { via: 'self', relation: 'the same person', lineA: [], lineB: [], commonAncestorIds: [] }
  }

  if (isSpouse(a, b)) {
    return { via: 'spouse', relation: spouseTerm(a), lineA: [], lineB: [], commonAncestorIds: [] }
  }

  const blood = bloodResult(aId, bId, byId)
  if (blood) return { via: 'blood', ...blood }

  const marr = marriageRelation(a, b, byId)
  if (marr) return marr

  return { via: 'none', relation: null, lineA: [], lineB: [], commonAncestorIds: [] }
}
