const momentumScriptSrc = document.currentScript.src;
const momentumAssetsBase = new URL('../data/', momentumScriptSrc);

const MOMENTUM_COLORS = {
  protest: '#1976d2',
  pro: '#2e7d32',
  mixed: '#f57c00',
  against: '#c62828'
};

const MOMENTUM_STANCE_LABEL = {
  pro: 'Favorable to protesters’ demands',
  mixed: 'Mixed or unclear',
  against: 'Against protesters’ demands'
};

function momentumParseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function momentumWeekStart(d) {
  const day = (d.getUTCDay() + 6) % 7;
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - day);
  return start;
}

function momentumWeekLabel(start) {
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = dt => dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${fmt(start)}–${fmt(end)}`;
}

function buildMomentumRows(protestData, politicalData) {
  const protestDates = protestData.map(item => momentumParseDate(item.date_iso));
  const firstWeek = momentumWeekStart(protestDates.reduce((a, b) => (a < b ? a : b)));

  const rows = new Map();
  const beforeItems = [];

  function ensureRow(weekStart) {
    const key = weekStart.toISOString().slice(0, 10);
    if (!rows.has(key)) {
      rows.set(key, {
        start: weekStart,
        label: momentumWeekLabel(weekStart),
        protest: 0,
        pro: 0,
        mixed: 0,
        against: 0,
        protestItems: [],
        politicalItems: []
      });
    }
    return rows.get(key);
  }

  protestData.forEach(item => {
    const row = ensureRow(momentumWeekStart(momentumParseDate(item.date_iso)));
    row.protest += 1;
    row.protestItems.push(item);
  });

  politicalData.forEach(item => {
    const d = momentumParseDate(item.date_iso);
    if (d < firstWeek) { beforeItems.push(item); return; }
    const row = ensureRow(momentumWeekStart(d));
    const stance = ['pro', 'mixed', 'against'].includes(item.stance) ? item.stance : 'mixed';
    row[stance] += 1;
    row.politicalItems.push(item);
  });

  const sorted = [...rows.values()].sort((a, b) => a.start - b.start);

  if (beforeItems.length) {
    sorted.unshift({
      label: 'Before the protests',
      protest: 0,
      pro: beforeItems.filter(item => item.stance === 'pro').length,
      mixed: beforeItems.filter(item => !['pro', 'against'].includes(item.stance)).length,
      against: beforeItems.filter(item => item.stance === 'against').length,
      protestItems: [],
      politicalItems: beforeItems
    });
  }

  return sorted;
}

function momentumSvgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs || {}).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function momentumBarPath(xBase, xTip, yTop, height, radius) {
  const dir = xTip >= xBase ? 1 : -1;
  const r = Math.min(radius, Math.abs(xTip - xBase));
  const xRoundStart = xTip - dir * r;
  return [
    `M ${xBase} ${yTop}`,
    `L ${xRoundStart} ${yTop}`,
    `Q ${xTip} ${yTop} ${xTip} ${yTop + r}`,
    `L ${xTip} ${yTop + height - r}`,
    `Q ${xTip} ${yTop + height} ${xRoundStart} ${yTop + height}`,
    `L ${xBase} ${yTop + height}`,
    'Z'
  ].join(' ');
}

function momentumResolveUrl(sourceUrl) {
  return sourceUrl.startsWith('http') ? sourceUrl : new URL(sourceUrl, new URL('../../', momentumScriptSrc)).href;
}

let momentumPopupTrigger = null;

function closeMomentumPopup() {
  const overlay = document.getElementById('momentum-popup-overlay');
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  document.removeEventListener('keydown', momentumPopupKeydown);
  if (momentumPopupTrigger) momentumPopupTrigger.focus();
  momentumPopupTrigger = null;
}

function momentumPopupKeydown(event) {
  if (event.key === 'Escape') closeMomentumPopup();
}

function openMomentumPopup(heading, items, trigger) {
  const overlay = document.getElementById('momentum-popup-overlay');
  const titleEl = document.getElementById('momentum-popup-title');
  const bodyEl = document.getElementById('momentum-popup-body');
  if (!overlay || !titleEl || !bodyEl) return;

  momentumPopupTrigger = trigger;
  titleEl.textContent = heading;
  bodyEl.replaceChildren();

  items.forEach(item => {
    const card = document.createElement('article');
    card.className = 'timeline-card';

    const marker = document.createElement('span');
    marker.className = 'timeline-marker';
    marker.setAttribute('aria-hidden', 'true');

    const date = document.createElement('time');
    date.dateTime = item.date_iso;
    date.textContent = item.date_label;

    const tag = document.createElement('span');
    tag.className = 'timeline-tag';
    tag.textContent = item.category;

    const title = document.createElement('h2');
    title.textContent = item.title;

    const place = document.createElement('strong');
    place.className = 'timeline-place';
    place.textContent = item.location;

    const summary = document.createElement('p');
    summary.textContent = item.summary;

    const source = document.createElement('a');
    source.href = momentumResolveUrl(item.source_url);
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = `${item.source_name} ↗`;

    const status = document.createElement('small');
    status.textContent = item.source_status;

    card.append(marker, date, tag, title, place, summary, source, status);

    if (item.stance) {
      const stanceTag = document.createElement('span');
      stanceTag.className = `momentum-stance-tag momentum-stance-${item.stance}`;
      stanceTag.textContent = MOMENTUM_STANCE_LABEL[item.stance] || item.stance;
      card.append(stanceTag);
    }

    bodyEl.append(card);
  });

  overlay.hidden = false;
  document.getElementById('momentum-popup-close').focus();
  document.addEventListener('keydown', momentumPopupKeydown);
}

function momentumMakeBarInteractive(shape, label, items) {
  shape.setAttribute('tabindex', '0');
  shape.setAttribute('role', 'button');
  shape.classList.add('momentum-bar');
  shape.addEventListener('click', () => openMomentumPopup(label, items, shape));
  shape.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMomentumPopup(label, items, shape);
    }
  });
}

function renderMomentumChart(rows) {
  const root = document.getElementById('momentum-chart');
  if (!root) return;
  root.replaceChildren();

  const rowHeight = 30;
  const barThickness = 18;
  const halfWidth = 210;
  const labelColWidth = 130;
  const paddingTop = 12;
  const tipGutter = 36;
  const barMax = halfWidth - tipGutter;
  const gap = 2;
  const radius = 4;

  const maxProtest = Math.max(1, ...rows.map(row => row.protest));
  const maxPolitical = Math.max(1, ...rows.map(row => row.pro + row.mixed + row.against));
  const pxPerUnit = barMax / Math.max(maxProtest, maxPolitical);

  const totalWidth = halfWidth * 2 + labelColWidth;
  const totalHeight = paddingTop * 2 + rows.length * rowHeight;
  const leftBaseline = halfWidth;
  const rightBaseline = halfWidth + labelColWidth;

  const svg = momentumSvgEl('svg', {
    viewBox: `0 0 ${totalWidth} ${totalHeight}`,
    role: 'img',
    'aria-label': 'Weekly counts of protest events (left) and political or institutional actions (right), the right side colored by whether the action favored or opposed the protesters’ demands. Activate a bar for the full list behind it.',
    class: 'momentum-chart-svg'
  });

  svg.append(momentumSvgEl('line', {
    x1: leftBaseline, x2: leftBaseline, y1: paddingTop, y2: totalHeight - paddingTop, class: 'momentum-baseline'
  }));
  svg.append(momentumSvgEl('line', {
    x1: rightBaseline, x2: rightBaseline, y1: paddingTop, y2: totalHeight - paddingTop, class: 'momentum-baseline'
  }));

  rows.forEach((row, index) => {
    const yTop = paddingTop + index * rowHeight + (rowHeight - barThickness) / 2;
    const rowCenter = paddingTop + index * rowHeight + rowHeight / 2;

    const label = momentumSvgEl('text', { x: halfWidth + labelColWidth / 2, y: rowCenter, class: 'momentum-row-label' });
    label.textContent = row.label;
    svg.append(label);

    if (row.protest > 0) {
      const width = row.protest * pxPerUnit;
      const path = momentumSvgEl('path', {
        d: momentumBarPath(leftBaseline, leftBaseline - width, yTop, barThickness, radius),
        fill: MOMENTUM_COLORS.protest,
        'aria-label': `${row.label}: ${row.protest} protest event${row.protest === 1 ? '' : 's'}. Activate for details.`
      });
      const title = momentumSvgEl('title', {});
      title.textContent = `${row.label} — ${row.protest} protest event${row.protest === 1 ? '' : 's'}. Click for details.`;
      path.append(title);
      momentumMakeBarInteractive(path, `${row.label} — Protest events`, row.protestItems);
      svg.append(path);

      const value = momentumSvgEl('text', { x: leftBaseline - width - 6, y: rowCenter, class: 'momentum-value-label', 'text-anchor': 'end' });
      value.textContent = row.protest;
      svg.append(value);
    }

    let offset = rightBaseline;
    const stances = ['pro', 'mixed', 'against'].filter(stance => row[stance] > 0);
    stances.forEach((stance, stanceIndex) => {
      if (stanceIndex > 0) offset += gap;
      const width = row[stance] * pxPerUnit;
      const isLast = stanceIndex === stances.length - 1;
      const shape = isLast
        ? momentumSvgEl('path', { d: momentumBarPath(offset, offset + width, yTop, barThickness, radius) })
        : momentumSvgEl('rect', { x: offset, y: yTop, width, height: barThickness });
      shape.setAttribute('fill', MOMENTUM_COLORS[stance]);
      shape.setAttribute('aria-label', `${row.label}: ${row[stance]} ${MOMENTUM_STANCE_LABEL[stance].toLowerCase()}. Activate for details.`);
      const title = momentumSvgEl('title', {});
      title.textContent = `${row.label} — ${row[stance]} ${MOMENTUM_STANCE_LABEL[stance].toLowerCase()}. Click for details.`;
      shape.append(title);
      const stanceItems = row.politicalItems.filter(item => (['pro', 'mixed', 'against'].includes(item.stance) ? item.stance : 'mixed') === stance);
      momentumMakeBarInteractive(shape, `${row.label} — ${MOMENTUM_STANCE_LABEL[stance]}`, stanceItems);
      svg.append(shape);
      offset += width;
    });

    const politicalTotal = row.pro + row.mixed + row.against;
    if (politicalTotal > 0) {
      const value = momentumSvgEl('text', { x: offset + 6, y: rowCenter, class: 'momentum-value-label', 'text-anchor': 'start' });
      value.textContent = politicalTotal;
      svg.append(value);
    }
  });

  root.append(svg);
}

function setupMomentum() {
  const chartRoot = document.getElementById('momentum-chart');
  if (!chartRoot || chartRoot.dataset.ready) return;
  chartRoot.dataset.ready = '1';

  fetch(new URL('timeline.csv', momentumAssetsBase))
    .then(response => {
      if (!response.ok) throw Error(response.status);
      return response.text();
    })
    .then(text => {
      const data = csvRows(text);
      const protestData = data.filter(item => item.track === 'protest');
      const politicalData = data.filter(item => item.track === 'political');
      renderMomentumChart(buildMomentumRows(protestData, politicalData));
    })
    .catch(() => {
      chartRoot.textContent = 'Unable to load the momentum chart data. Use mkdocs serve.';
    });

  const overlay = document.getElementById('momentum-popup-overlay');
  if (overlay && !overlay.dataset.ready) {
    overlay.dataset.ready = '1';
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeMomentumPopup();
    });
    document.getElementById('momentum-popup-close').addEventListener('click', closeMomentumPopup);
  }
}

document.addEventListener('DOMContentLoaded', setupMomentum);
if (typeof document$ !== 'undefined') document$.subscribe(setupMomentum);
