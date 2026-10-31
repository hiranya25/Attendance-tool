// Tables that do not fit their panel switch to a stacked layout: one card per row, each value labelled
// with its column heading. Applies to every table inside a `.scroll` wrapper except `.no-stack` ones
// (the attendance grid scrolls sideways instead). Runs once for the whole app.

const SELECTOR = '.scroll > table:not(.no-stack)';
const watched = new WeakSet<Element>();

function label(table: HTMLTableElement) {
  const heads = Array.from(table.tHead?.rows[0]?.cells ?? []).map((th) => th.textContent?.trim() ?? '');
  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      Array.from(row.cells).forEach((cell, i) => {
        const text = heads[i] ?? '';
        if (cell.getAttribute('data-label') !== text) cell.setAttribute('data-label', text);
      });
    }
  }
}

function fit(wrap: HTMLElement) {
  const table = wrap.querySelector(':scope > table') as HTMLTableElement | null;
  if (!table) return;
  const was = table.classList.contains('stacked');
  table.classList.remove('stacked');
  // Tables fill their panel, so measure the narrowest the table can be instead of its current width.
  const width = table.style.width;
  table.style.width = 'min-content';
  const needed = table.offsetWidth;
  table.style.width = width;
  // A few pixels of slack stop it flipping back and forth when a page scrollbar appears or goes.
  const tooWide = needed > wrap.clientWidth - (was ? 8 : 0);
  table.classList.toggle('stacked', tooWide);
}

const resize = new ResizeObserver((entries) => entries.forEach((e) => fit(e.target as HTMLElement)));

function scan() {
  document.querySelectorAll<HTMLTableElement>(SELECTOR).forEach((table) => {
    label(table);
    const wrap = table.parentElement as HTMLElement;
    if (!watched.has(wrap)) {
      watched.add(wrap);
      resize.observe(wrap);
    }
    fit(wrap);
  });
}

export function startStackTables() {
  let queued = false;
  const later = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      scan();
    });
  };
  // Only content changes are watched, so the labels and classes set here do not trigger another scan.
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true, characterData: true });
  later();
}
