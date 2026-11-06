/*
 * "Remaining outreach" treemaps: one per domain (institutions, parties,
 * media). Each country is a group (a subtree) sized by how many entries it
 * has in total; inside a group, every individual entry (one organization,
 * party, or outlet) is its own leaf tile, colored green if it has
 * responded/posted or red if it hasn't — the same meaning as the
 * response-rate maps elsewhere on the site, just carried down to each entry
 * instead of averaged into one percentage.
 */

const remainingAssetsBase = new URL('../data/', document.currentScript.src);

const REMAINING_GOOD = '#2e7d32';
const REMAINING_BAD = '#c62828';
const REMAINING_TEXT = '#ffffff';

const GROUP_GAP = 4;
const GROUP_PADDING = 3;
const LABEL_HEIGHT = 16;
const LABEL_GAP = 2;

function remainingGroupColor(group) {
  const share = group.value ? group.done / group.value : 0;
  return share >= .5 ? REMAINING_GOOD : REMAINING_BAD;
}

/* One group per country: value = total entries, done = how many are
   green (responded/posted), children = every entry, one leaf each. */
function remainingGroupBy(rows, { nameField, isDone, exclude = [] }) {
  const groups = new Map();
  rows.forEach(row => {
    const country = (row.country || '').trim();
    const name = row[nameField];
    if (!country || !name) return;
    if (exclude.includes(country)) return;
    if (!groups.has(country)) groups.set(country, []);
    groups.get(country).push({ name, done: isDone(row) });
  });
  return [...groups.entries()]
    .map(([country, children]) => ({
      country,
      value: children.length,
      done: children.filter(child => child.done).length,
      children
    }))
    .sort((a, b) => b.value - a.value);
}

/* Binary-split treemap: recursively halves the running total so each half
   gets roughly proportional space, alternating the split axis with the
   longer side. Simple, robust, and squarish enough for this data's shape.
   Used both for the top-level country groups and, inside each group, for
   its individual entry leaves. */
function remainingLayout(items, x, y, w, h) {
  if (!items.length) return;
  if (items.length === 1) {
    items[0]._rect = { x, y, w, h };
    return;
  }
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let running = 0;
  let splitAt = 1;
  for (let i = 0; i < items.length; i += 1) {
    running += items[i].value;
    if (running >= total / 2) {
      splitAt = i + 1;
      break;
    }
  }
  splitAt = Math.min(Math.max(splitAt, 1), items.length - 1);
  const left = items.slice(0, splitAt);
  const right = items.slice(splitAt);
  const leftTotal = left.reduce((sum, item) => sum + item.value, 0);
  const fraction = total > 0 ? leftTotal / total : .5;

  if (w >= h) {
    const splitX = w * fraction;
    remainingLayout(left, x, y, splitX, h);
    remainingLayout(right, x + splitX, y, w - splitX, h);
  } else {
    const splitY = h * fraction;
    remainingLayout(left, x, y, w, splitY);
    remainingLayout(right, x, y + splitY, w, h - splitY);
  }
}

function remainingLabelFits(ctx, text, maxWidth) {
  return ctx.measureText(text).width <= maxWidth;
}

/* Every entry inside a group carries the same weight (one unit), so lay
   them out as a uniform grid of equal-size cells rather than a treemap —
   a treemap is for proportional sizes; equal units read better as a grid. */
function remainingGridLayout(items, w, h) {
  const n = items.length;
  if (!n) return;
  let cols = Math.max(1, Math.round(Math.sqrt((n * w) / h)));
  cols = Math.min(cols, n);
  const rows = Math.ceil(n / cols);
  const cellW = w / cols;
  const cellH = h / rows;
  items.forEach((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    item._rect = { x: col * cellW, y: row * cellH, w: cellW, h: cellH };
  });
}

function renderTreemapTooltip(container) {
  const tooltip = document.createElement('div');
  tooltip.className = 'treemap-tooltip';
  tooltip.hidden = true;
  container.append(tooltip);
  return tooltip;
}

function attachTreemapTooltip(el, tooltip, { container, x, y, render }) {
  const show = () => {
    tooltip.replaceChildren();
    render(tooltip);
    tooltip.hidden = false;
    const bounds = container.getBoundingClientRect();
    const left = Math.min(Math.max(x, 60), bounds.width - 60);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(y - 8, 4)}px`;
  };
  const hide = () => { tooltip.hidden = true; };
  el.addEventListener('pointerenter', show);
  el.addEventListener('pointerleave', hide);
  el.addEventListener('focus', show);
  el.addEventListener('blur', hide);
}

function renderTreemapCard(options) {
  const { data, doneLabel, pendingLabel, containerId, legendId, tableBodyId, measureCtx } = options;
  const container = document.getElementById(containerId);
  const legend = document.getElementById(legendId);
  const tableBody = document.getElementById(tableBodyId);
  if (!container) return;

  container.style.position = 'relative';
  container.replaceChildren();
  const tooltip = renderTreemapTooltip(container);

  if (!data.length) {
    const empty = document.createElement('p');
    empty.className = 'coverage-priority-loading';
    empty.textContent = 'Nothing to show.';
    container.append(empty);
    if (legend) legend.replaceChildren();
    if (tableBody) tableBody.replaceChildren();
    return;
  }

  const rect = container.getBoundingClientRect();
  const width = rect.width || container.clientWidth || 600;
  const height = rect.height || 260;
  const groups = data.map(group => ({ ...group, children: group.children.map(child => ({ ...child })) }));
  remainingLayout(groups, 0, 0, width, height);

  groups.forEach(group => {
    const { x, y, w, h } = group._rect;
    const groupColor = remainingGroupColor(group);

    const groupEl = document.createElement('div');
    groupEl.className = 'treemap-group';
    groupEl.style.setProperty('--group-accent', groupColor);
    groupEl.style.left = `${x + GROUP_GAP / 2}px`;
    groupEl.style.top = `${y + GROUP_GAP / 2}px`;
    groupEl.style.width = `${Math.max(0, w - GROUP_GAP)}px`;
    groupEl.style.height = `${Math.max(0, h - GROUP_GAP)}px`;
    groupEl.title = `${group.country}: ${group.done}/${group.value} ${doneLabel.toLowerCase()}`;

    const contentW = Math.max(0, (w - GROUP_GAP) - GROUP_PADDING * 2);
    const contentH = Math.max(0, (h - GROUP_GAP) - GROUP_PADDING * 2);
    const showHeader = contentW >= 38 && contentH >= (LABEL_HEIGHT + LABEL_GAP + 14);

    if (showHeader) {
      const label = document.createElement('div');
      label.className = 'treemap-group-label';
      label.textContent = `${group.country} · ${group.done}/${group.value}`;
      groupEl.append(label);
    }

    const body = document.createElement('div');
    body.className = 'treemap-group-body';
    groupEl.append(body);

    const bodyW = contentW;
    const bodyH = Math.max(0, contentH - (showHeader ? LABEL_HEIGHT + LABEL_GAP : 0));
    const children = group.children;
    if (bodyW > 0 && bodyH > 0) {
      remainingGridLayout(children, bodyW, bodyH);
      const bodyOriginX = x + GROUP_GAP / 2 + GROUP_PADDING;
      const bodyOriginY = y + GROUP_GAP / 2 + GROUP_PADDING + (showHeader ? LABEL_HEIGHT + LABEL_GAP : 0);

      children.forEach(child => {
        const { x: cx, y: cy, w: cw, h: ch } = child._rect;
        const leafW = Math.max(0, cw - 2);
        const leafH = Math.max(0, ch - 2);
        const leafColor = child.done ? REMAINING_GOOD : REMAINING_BAD;
        const leaf = document.createElement('div');
        leaf.className = 'treemap-leaf';
        leaf.style.left = `${cx + 1}px`;
        leaf.style.top = `${cy + 1}px`;
        leaf.style.width = `${leafW}px`;
        leaf.style.height = `${leafH}px`;
        leaf.style.background = leafColor;
        leaf.tabIndex = 0;
        leaf.setAttribute('role', 'img');
        leaf.setAttribute('aria-label', `${child.name} — ${group.country}: ${child.done ? doneLabel : pendingLabel}`);

        if (leafW >= 24 && leafH >= 14 && remainingLabelFits(measureCtx, child.name, leafW - 6)) {
          const label = document.createElement('span');
          label.className = 'treemap-leaf-label';
          label.style.color = REMAINING_TEXT;
          label.textContent = child.name;
          leaf.append(label);
        }

        attachTreemapTooltip(leaf, tooltip, {
          container,
          x: bodyOriginX + cx + cw / 2,
          y: bodyOriginY + cy,
          render: el => {
            const name = document.createElement('strong');
            name.textContent = child.name;
            const place = document.createElement('span');
            place.textContent = `${group.country} · ${child.done ? doneLabel : pendingLabel}`;
            el.append(name, place);
          }
        });

        body.append(leaf);
      });
    }

    container.append(groupEl);
  });

  if (legend) {
    legend.replaceChildren();
    [{ bg: REMAINING_GOOD, label: doneLabel }, { bg: REMAINING_BAD, label: pendingLabel }].forEach(level => {
      const item = document.createElement('span');
      item.className = 'coverage-map-legend-item';
      item.style.setProperty('--status-color', level.bg);
      item.textContent = level.label;
      legend.append(item);
    });
  }

  if (tableBody) {
    tableBody.replaceChildren();
    groups.forEach(group => {
      [...group.children]
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(child => {
          const row = document.createElement('tr');
          const countryCell = document.createElement('td');
          countryCell.textContent = group.country;
          const nameCell = document.createElement('td');
          nameCell.textContent = child.name;
          const statusCell = document.createElement('td');
          statusCell.textContent = child.done ? doneLabel : pendingLabel;
          row.append(countryCell, nameCell, statusCell);
          tableBody.append(row);
        });
    });
  }
}

function debounce(fn, delay) {
  let handle;
  return (...args) => {
    clearTimeout(handle);
    handle = setTimeout(() => fn(...args), delay);
  };
}

function setupRemainingTreemaps() {
  const institutionsRoot = document.getElementById('institutions-treemap');
  if (!institutionsRoot || institutionsRoot.dataset.ready) return;
  institutionsRoot.dataset.ready = '1';

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = '700 11px system-ui, -apple-system, "Segoe UI", sans-serif';

  const cards = [];

  Promise.all([
    fetch(new URL('institutions.csv', remainingAssetsBase)).then(r => r.text()),
    fetch(new URL('political_parties.csv', remainingAssetsBase)).then(r => r.text()),
    fetch(new URL('media_coverage.csv', remainingAssetsBase)).then(r => r.text())
  ]).then(([institutionsText, partiesText, mediaText]) => {
    const institutions = remainingGroupBy(csvRows(institutionsText), {
      nameField: 'organization',
      isDone: row => Boolean((row.response_link || '').trim()),
      exclude: ['Albania']
    });
    const parties = remainingGroupBy(csvRows(partiesText), {
      nameField: 'party',
      isDone: row => Boolean((row.response_link || '').trim()),
      exclude: ['Albania']
    });
    const media = remainingGroupBy(csvRows(mediaText), {
      nameField: 'outlet',
      isDone: row => Boolean((row.article_urls || '').trim()),
      exclude: ['Albania']
    });

    cards.push({
      data: institutions,
      doneLabel: 'Responded',
      pendingLabel: 'No response yet',
      containerId: 'institutions-treemap',
      legendId: 'institutions-treemap-legend',
      tableBodyId: 'institutions-treemap-table'
    });
    cards.push({
      data: parties,
      doneLabel: 'Responded',
      pendingLabel: 'No response yet',
      containerId: 'parties-treemap',
      legendId: 'parties-treemap-legend',
      tableBodyId: 'parties-treemap-table'
    });
    cards.push({
      data: media,
      doneLabel: 'Posted',
      pendingLabel: 'Not posted',
      containerId: 'media-treemap',
      legendId: 'media-treemap-legend',
      tableBodyId: 'media-treemap-table'
    });

    const renderAll = () => cards.forEach(card => renderTreemapCard({ ...card, measureCtx }));
    renderAll();
    window.addEventListener('resize', debounce(renderAll, 200));
  }).catch(() => {
    institutionsRoot.innerHTML = '<p class="coverage-priority-loading">Unable to load the outreach CSVs. Use <code>mkdocs serve</code>.</p>';
  });
}

document.addEventListener('DOMContentLoaded', setupRemainingTreemaps);
if (typeof document$ !== 'undefined') document$.subscribe(setupRemainingTreemaps);
