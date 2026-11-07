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
  return `${fmt(start)}–${fmt(end)} ${end.getUTCFullYear()}`;
}

function buildMomentumRows(protestData, politicalData, movementStart = '') {
  const protestDates = protestData.map(item => momentumParseDate(item.date_iso));
  const firstWeek = movementStart ? momentumWeekStart(momentumParseDate(movementStart)) : protestDates.length ? momentumWeekStart(protestDates.reduce((a, b) => (a < b ? a : b))) : new Date(0);

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
  document.getElementById('momentum-popup-overlay')?.close();
}

function momentumEventDisclosure(item) {
  const heading = countryElement('span', 'momentum-event-heading', item.title);
  const date = countryElement('time', 'momentum-event-date', item.date_label || item.date_iso);
  date.dateTime = item.date_iso;
  const content = countryElement('article', 'momentum-event-content');
  content.append(countryElement('p', 'status-page-note', [item.category, item.location].filter(Boolean).join(' · ')));
  content.append(countryElement('p', '', item.summary));
  const source = countryElement('a', '', (item.source_name || 'Read source') + ' ↗');
  source.href = momentumResolveUrl(item.source_url);
  source.target = '_blank'; source.rel = 'noopener noreferrer';
  if (item.source_url) content.append(source);
  if (item.source_status) content.append(countryElement('p', 'status-page-note', item.source_status));
  if (item.track === 'political') content.append(countryElement('p', 'status-page-note', 'Editorial classification: ' + (MOMENTUM_STANCE_LABEL[item.stance] || MOMENTUM_STANCE_LABEL.mixed)));
  const type = countryElement('span', 'momentum-event-type', item.track === 'protest' ? 'Protest' : 'Political action');
  return countryDisclosure([date, heading, type], content, 'momentum-event');
}

function renderMomentumEvents(root, items) {
  const blocks = [...items].sort((a, b) => b.date_iso.localeCompare(a.date_iso) || a.title.localeCompare(b.title)).map(momentumEventDisclosure);
  root.replaceChildren(...blocks);
  if (!blocks.length) root.append(countryElement('p', 'country-empty', 'No events match. Change the dates or reset the filters.'));
  countryDisclosureAccordion(blocks);
}

function filterMomentumEvents(data, { query = '', from = '', to = '' } = {}) {
  const term = query.trim().toLowerCase();
  return data.filter(item => ['protest', 'political'].includes(item.track) &&
    (!from || item.date_iso >= from) && (!to || item.date_iso <= to) &&
    (!term || [item.title, item.summary, item.location, item.category, item.source_name].join(' ').toLowerCase().includes(term)));
}

function openMomentumPopup(heading, items, trigger) {
  const dialog = document.getElementById('momentum-popup-overlay');
  momentumPopupTrigger = trigger;
  document.getElementById('momentum-popup-title').textContent = heading;
  const body = document.getElementById('momentum-popup-body');
  renderMomentumEvents(body, items);
  if (items.length === 1) body.querySelector('details').open = true;
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('momentum-dialog-open');
  document.getElementById('momentum-popup-close').focus();
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
  if (!rows.length) { root.append(countryElement('p', 'country-empty', 'No chart data for these filters.')); return; }

  const rowHeight = 38;
  const barThickness = 24;
  const halfWidth = 210;
  const labelColWidth = 130;
  const paddingTop = 12;
  const tipGutter = 36;
  const barMax = halfWidth - tipGutter;
  const gap = 0;
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
    role: 'group',
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
      if (!chartRoot.isConnected) return;
      const data = csvRows(text);
      const movementStart = data.filter(item => item.track === 'protest').map(item => item.date_iso).sort()[0] || '';
      const search = document.getElementById('momentum-search');
      const from = document.getElementById('momentum-from');
      const to = document.getElementById('momentum-to');
      const render = () => {
        const visible = filterMomentumEvents(data, { query: search.value, from: from.value, to: to.value });
        const protests = visible.filter(item => item.track === 'protest');
        const political = visible.filter(item => item.track === 'political');
        const rows = buildMomentumRows(protests, political, movementStart);
        const weeks = new Set(visible.map(item => momentumWeekStart(momentumParseDate(item.date_iso)).toISOString()));
        document.getElementById('momentum-stat-protest').textContent = protests.length;
        document.getElementById('momentum-stat-political').textContent = political.length;
        document.getElementById('momentum-stat-weeks').textContent = weeks.size;
        const dates = visible.map(item => item.date_iso).sort();
        document.getElementById('momentum-summary').textContent = from.value && to.value && from.value > to.value
          ? 'The start date must be before the end date.'
          : visible.length + ' matching events' + (dates.length ? ' · ' + dates[0] + ' to ' + dates[dates.length - 1] : '');
        renderMomentumChart(rows);
        renderMomentumEvents(document.getElementById('momentum-events'), visible);
      };
      search.addEventListener('input', render);
      from.addEventListener('change', render);
      to.addEventListener('change', render);
      render();
    })
    .catch(() => {
      if (!chartRoot.isConnected) return;
      const message = 'Unable to load events. Reload to try again or open the full timeline below.';
      chartRoot.textContent = message;
      document.getElementById('momentum-events').textContent = message;
      document.getElementById('momentum-summary').textContent = 'Timeline data unavailable.';
    });

  const overlay = document.getElementById('momentum-popup-overlay');
  if (overlay && !overlay.dataset.ready) {
    overlay.dataset.ready = '1';
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeMomentumPopup();
    });
    document.getElementById('momentum-popup-close').addEventListener('click', closeMomentumPopup);
    overlay.addEventListener('close', () => {
      document.body.classList.remove('momentum-dialog-open');
      if (momentumPopupTrigger?.isConnected) momentumPopupTrigger.focus();
      momentumPopupTrigger = null;
    });
  }
}

document.addEventListener('DOMContentLoaded', setupMomentum);
if (typeof document$ !== 'undefined') document$.subscribe(setupMomentum);
