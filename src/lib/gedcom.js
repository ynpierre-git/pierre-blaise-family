// GEDCOM 5.5.1 export.
//
// Turns the flat member list into a standard genealogy file that other tools
// (Ancestry, Gramps, Family Tree Maker, …) can import. Individuals become INDI
// records; couples and parent/child groups become FAM records. Internal ids are
// remapped to clean sequential @I#@ / @F#@ xrefs so the output is portable
// regardless of what the database uses for ids.

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const validId = (id) => id != null && id !== ''

// "1950-06-12" -> "12 JUN 1950"; year-optional ("0000-06-12") -> "12 JUN".
function gedDate(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).split('-')
  const mon = MONTHS[Number(m) - 1]
  if (!mon) return ''
  const day = d ? String(Number(d)) : ''
  const year = y && y !== '0000' ? y : ''
  return [day, mon, year].filter(Boolean).join(' ')
}

function sex(gender) {
  const g = (gender || '').trim().toLowerCase()
  if (g.startsWith('m')) return 'M'
  if (g.startsWith('f')) return 'F'
  return 'U'
}

// GEDCOM splits names as "Given /Surname/".
function nameLine(m) {
  const given = (m.firstName || '').trim()
  const sur = (m.lastName || '').trim()
  return `${given} /${sur}/`.trim()
}

// CONT-split a free-text value so embedded newlines stay valid GEDCOM.
function noteLines(level, text) {
  const parts = String(text).split(/\r?\n/)
  const out = [`${level} NOTE ${parts[0]}`]
  for (let i = 1; i < parts.length; i++) out.push(`${level + 1} CONT ${parts[i]}`)
  return out
}

export function buildGedcom(members, { treeName = 'Pierre-Blaise Family Tree' } = {}) {
  const list = Array.isArray(members) ? members : []
  const byId = new Map(list.map((m) => [String(m.id), m]))

  // Stable sequential xrefs.
  const indiXref = new Map()
  list.forEach((m, i) => indiXref.set(String(m.id), `@I${i + 1}@`))

  // Families keyed by "father|mother". Father → HUSB, mother → WIFE (matching
  // the data model). Childless spouse couples are added afterward.
  const famByKey = new Map()
  const ensureFam = (father, mother) => {
    const key = `${father || ''}|${mother || ''}`
    if (!famByKey.has(key)) famByKey.set(key, { husb: father || null, wife: mother || null, children: [] })
    return famByKey.get(key)
  }

  for (const m of list) {
    const father = validId(m.fatherId) && byId.has(String(m.fatherId)) ? String(m.fatherId) : null
    const mother = validId(m.motherId) && byId.has(String(m.motherId)) ? String(m.motherId) : null
    if (father || mother) ensureFam(father, mother).children.push(String(m.id))
  }

  // Set of couples already represented (either order) so we don't duplicate.
  const couplePairs = new Set()
  for (const fam of famByKey.values()) {
    if (fam.husb && fam.wife) couplePairs.add([fam.husb, fam.wife].sort().join('|'))
  }
  for (const m of list) {
    if (!validId(m.spouseId) || !byId.has(String(m.spouseId))) continue
    const a = String(m.id)
    const b = String(m.spouseId)
    const pairKey = [a, b].sort().join('|')
    if (couplePairs.has(pairKey)) continue
    couplePairs.add(pairKey)
    // Husband = the male partner when known, else keep a as husband.
    const aMale = sex(m.gender) === 'M'
    const bMale = sex((byId.get(b) || {}).gender) === 'M'
    let husb = a
    let wife = b
    if (bMale && !aMale) {
      husb = b
      wife = a
    }
    ensureFam(husb, wife)
  }

  // Assign @F#@ xrefs and build per-individual FAMC / FAMS links.
  const famXref = new Map()
  const famcOf = new Map() // child id -> family xref
  const famsOf = new Map() // partner id -> [family xrefs]
  let fi = 0
  const families = []
  for (const fam of famByKey.values()) {
    const xref = `@F${++fi}@`
    famXref.set(fam, xref)
    families.push({ ...fam, xref })
    for (const c of fam.children) famcOf.set(c, xref)
    for (const partner of [fam.husb, fam.wife]) {
      if (!partner) continue
      if (!famsOf.has(partner)) famsOf.set(partner, [])
      famsOf.get(partner).push(xref)
    }
  }

  const lines = []
  lines.push('0 HEAD')
  lines.push('1 SOUR PierreBlaiseFamilyTree')
  lines.push(`2 NAME ${treeName}`)
  lines.push('1 GEDC')
  lines.push('2 VERS 5.5.1')
  lines.push('2 FORM LINEAGE-LINKED')
  lines.push('1 CHAR UTF-8')
  lines.push(`1 DATE ${gedDate(new Date().toISOString().slice(0, 10))}`)

  for (const m of list) {
    const id = String(m.id)
    lines.push(`0 ${indiXref.get(id)} INDI`)
    lines.push(`1 NAME ${nameLine(m)}`)
    lines.push(`1 SEX ${sex(m.gender)}`)

    const bdate = gedDate(m.birthday)
    const bplace = [m.city, m.country].filter(Boolean).join(', ')
    if (bdate || bplace) {
      lines.push('1 BIRT')
      if (bdate) lines.push(`2 DATE ${bdate}`)
      if (bplace) lines.push(`2 PLAC ${bplace}`)
    }

    if (m.deceased || m.dateOfDeath) {
      lines.push('1 DEAT')
      const ddate = gedDate(m.dateOfDeath)
      if (ddate) lines.push(`2 DATE ${ddate}`)
      else lines.push('2 NOTE Deceased (date unknown)')
    }

    if (famcOf.has(id)) lines.push(`1 FAMC ${famcOf.get(id)}`)
    for (const fx of famsOf.get(id) || []) lines.push(`1 FAMS ${fx}`)

    if (m.email) lines.push(`1 EMAIL ${m.email}`)
    if (m.phone) lines.push(`1 PHON ${m.phone}`)
    if (m.notes) lines.push(...noteLines(1, m.notes))
  }

  for (const fam of families) {
    lines.push(`0 ${fam.xref} FAM`)
    if (fam.husb) lines.push(`1 HUSB ${indiXref.get(fam.husb)}`)
    if (fam.wife) lines.push(`1 WIFE ${indiXref.get(fam.wife)}`)
    for (const c of fam.children) lines.push(`1 CHIL ${indiXref.get(c)}`)
  }

  lines.push('0 TRLR')
  return lines.join('\n')
}

// Triggers a browser download of the members as a .ged file.
export function downloadGedcom(members, filename = 'pierre-blaise-family.ged') {
  const text = buildGedcom(members)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
