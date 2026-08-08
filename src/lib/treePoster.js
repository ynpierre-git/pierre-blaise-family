// Print a wide family tree as a multi-page "poster".
//
// Browsers only paginate vertically — anything wider than one page is clipped,
// which is why a large horizontal tree never prints in full. This slices the
// rendered tree into page-sized tiles (a grid you tape together) so nothing is
// lost. Each tile is one printed page; a cover page shows the assembly grid.
//
// Sizing is done in CSS pixels at the print baseline of 96dpi (1mm = 96/25.4px)
// so the px-measured tree lines up with the mm-defined @page in App.css. If the
// browser's print dialog is left on "Fit to page" the whole poster is simply
// scaled uniformly — still complete, just smaller — so it degrades gracefully.

const PX_PER_MM = 96 / 25.4

// Must match `@page { size: A4 landscape; margin: 8mm }` in App.css.
const PAGE = { wMm: 297, hMm: 210, marginMm: 8 }
const LABEL_PX = 22 // assembly caption strip at the foot of each tile

export function printTreePoster(treeEl) {
  if (!treeEl) return

  const contentWmm = PAGE.wMm - PAGE.marginMm * 2
  const contentHmm = PAGE.hMm - PAGE.marginMm * 2
  // Trim ~2px so rounding can never spill a tile onto a blank extra page.
  const tileW = Math.floor(contentWmm * PX_PER_MM) - 2
  const pageH = Math.floor(contentHmm * PX_PER_MM) - 2
  const viewportH = pageH - LABEL_PX

  // Natural drawn size of the tree (min-width:100% floors it to the container,
  // wider content expands it — scrollWidth captures whichever is larger).
  const natW = Math.max(treeEl.scrollWidth, treeEl.offsetWidth)
  const natH = Math.max(treeEl.scrollHeight, treeEl.offsetHeight)

  const cols = Math.max(1, Math.ceil(natW / tileW))
  const rows = Math.max(1, Math.ceil(natH / viewportH))

  const root = document.createElement('div')
  root.className = 'tree-poster-root'

  root.appendChild(buildCover(rows, cols))

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      root.appendChild(buildTile({ r, c, rows, cols, tileW, pageH, viewportH, natW, treeEl }))
    }
  }

  document.body.appendChild(root)
  document.body.classList.add('printing-poster')

  // Force a synchronous layout of the freshly-inserted tiles before printing.
  // Without this, Chrome can take its print snapshot before the new (large)
  // DOM has been laid out, producing a blank or stale preview.
  void root.offsetHeight

  let done = false
  const cleanup = () => {
    if (done) return
    done = true
    document.body.classList.remove('printing-poster')
    root.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)

  window.print()
  // Safety net if afterprint never fires (some browsers / cancelled dialogs).
  setTimeout(cleanup, 60000)
}

function buildTile({ r, c, rows, cols, tileW, pageH, viewportH, natW, treeEl }) {
  const page = document.createElement('div')
  page.className = 'tp-page'
  page.style.width = `${tileW}px`
  page.style.height = `${pageH}px`

  const view = document.createElement('div')
  view.className = 'tp-view'
  view.style.width = `${tileW}px`
  view.style.height = `${viewportH}px`

  const canvas = document.createElement('div')
  canvas.className = 'tp-canvas'
  canvas.style.width = `${natW}px`
  canvas.style.transform = `translate(${-c * tileW}px, ${-r * viewportH}px)`

  const clone = treeEl.cloneNode(true)
  clone.style.width = `${natW}px`
  clone.style.minWidth = `${natW}px`
  canvas.appendChild(clone)

  view.appendChild(canvas)
  page.appendChild(view)

  const label = document.createElement('div')
  label.className = 'tp-label'
  label.textContent = `Row ${r + 1} of ${rows}  ·  Column ${c + 1} of ${cols}`
  page.appendChild(label)

  return page
}

function buildCover(rows, cols) {
  const cover = document.createElement('div')
  cover.className = 'tp-page tp-cover'

  const h = document.createElement('h1')
  h.textContent = 'Family Tree — Poster'
  cover.appendChild(h)

  const p = document.createElement('p')
  p.innerHTML =
    `<strong>${rows * cols} sheet${rows * cols === 1 ? '' : 's'}</strong> ` +
    `(${rows} row${rows === 1 ? '' : 's'} × ${cols} column${cols === 1 ? '' : 's'}). ` +
    'For an exact fit, set the print dialog to <strong>100% scale</strong> (not “Fit to page”), ' +
    'paper <strong>A4, landscape</strong>. Trim the white margins and tape the sheets together in this grid:'
  cover.appendChild(p)

  const map = document.createElement('div')
  map.className = 'tp-map'
  map.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div')
      cell.className = 'tp-map-cell'
      cell.textContent = `R${r + 1}·C${c + 1}`
      map.appendChild(cell)
    }
  }
  cover.appendChild(map)

  return cover
}
