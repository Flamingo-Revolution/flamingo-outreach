/* Linked activity, independent of the map's display filter. One entry per
 * entity (actor, outlet, institution…), with its links nested inside —
 * never one row per post, and never several entities smashed into one row. */
function buildOutreachActivity(countries, actions = [], extraActors = []) {
  const entities = new Map();
  const add = (value, source, date = '') => {
    outreachUrls(value).forEach(url => {
      const key = JSON.stringify([source.type, source.country, source.name]);
      if (!entities.has(key)) entities.set(key, { name: source.name, type: source.type, country: source.country, links: new Map() });
      const links = entities.get(key).links;
      const normalized = countryReportDate(date);
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(normalized || '') && Number.isFinite(Date.parse(normalized)) ? normalized : '';
      const existing = links.get(url) || '';
      links.set(url, valid > existing ? valid : existing);
    });
  };
  const addRow = (row, section, country) => {
    const source = { name: row[section.name], type: section.key, country };
    const dates = (section.key === 'media' ? row.dates || '' : row.response_date || '').split(';').map(value => value.trim());
    outreachUrls(row[section.evidence]).forEach((url, index) => add(url, source, section.key === 'actors' ? '' : dates[index] || (dates.length === 1 ? dates[0] : '')));
    if (section.key === 'actors') add(row.response_link, source, row.response_date);
    add(row.follow_up_evidence_url, source, row.follow_up_evidence_date);
    add(row.latest_source_url, source, row.latest_source_date);
  };
  countries.forEach(country => COUNTRY_SECTIONS.forEach(section => (country.entries[section.key] || []).forEach(row => addRow(row, section, country.country))));
  const actors = COUNTRY_SECTIONS.find(section => section.key === 'actors');
  extraActors.filter(row => !(row.country || '').trim()).forEach(row => addRow(row, actors, ''));
  actions.forEach(row => add(row.evidence_urls, { name: row.action, type: 'actions', country: '' }, row.date_precision === 'day' ? row.date : ''));
  return [...entities.values()].map(entity => {
    const links = [...entity.links.entries()].map(([url, date]) => ({ url, date }))
      .sort((a, b) => b.date.localeCompare(a.date) || a.url.localeCompare(b.url));
    const date = links.reduce((latest, link) => link.date > latest ? link.date : latest, '');
    return { ...entity, links, date };
  });
}

// Sorted by link count ("connections") first, so the most-active entities
// lead the list, then by most-recently-dated activity, then by name.
function sortOutreachActivity(entities) {
  return [...entities].sort((a, b) =>
    b.links.length - a.links.length || b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

function filterOutreachActivity(entities, type = '', query = '') {
  const search = query.trim().toLowerCase();
  return entities.filter(entity => (!type || entity.type === type) &&
    (!search || [entity.name, entity.country, ...entity.links.map(link => link.url)].join(' ').toLowerCase().includes(search)));
}

function outreachHostname(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

async function setupOutreachActivity(root, countries) {
  const rail = root.querySelector('#outreach-activity');
  if (!rail || rail.dataset.ready) return;
  rail.dataset.ready = '1';
  const list = rail.querySelector('#outreach-activity-list');
  const status = rail.querySelector('#outreach-activity-status');
  const count = rail.querySelector('#outreach-activity-count');
  const type = rail.querySelector('#outreach-activity-type');
  const search = rail.querySelector('#outreach-activity-search');
  const more = rail.querySelector('#outreach-activity-more');
  const labels = { media: 'Media', institutions: 'Institutions', parties: 'Parties', mps: 'MPs', actors: 'Actors', actions: 'Actions' };
  let limit = 20;
  const results = await Promise.allSettled(['actions.csv', 'actors.csv'].map(async file => {
    const response = await fetch(new URL(file, countryAssetsBase));
    if (!response.ok) throw Error(file);
    return csvRows(await response.text());
  }));
  if (!root.isConnected) return;
  const entities = sortOutreachActivity(buildOutreachActivity(countries, results[0].status === 'fulfilled' ? results[0].value : [], results[1].status === 'fulfilled' ? results[1].value : []));
  const unavailable = results.some(result => result.status === 'rejected');

  const makeIcon = entityType => {
    const icon = countryElement('span', `outreach-activity-icon outreach-activity-icon--${entityType}`, (labels[entityType] || '?').slice(0, 1));
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  };
  const addFavicon = (icon, url) => {
    const host = outreachHostname(url);
    if (!host) return;
    const favicon = countryElement('img');
    favicon.alt = ''; favicon.loading = 'lazy'; favicon.decoding = 'async'; favicon.referrerPolicy = 'no-referrer';
    favicon.addEventListener('error', () => favicon.remove());
    favicon.src = `https://icons.duckduckgo.com/ip3/${host}.ico`;
    icon.append(favicon);
  };

  // One line per row: icon, name (ellipsis, never wraps), date. Type and
  // country move into the title tooltip instead of taking their own line.
  const makeDate = date => {
    const time = countryElement('time', '', date);
    time.dateTime = date;
    return time;
  };
  const render = () => {
    const visible = filterOutreachActivity(entities, type.value, search.value);
    count.textContent = String(visible.length);
    status.hidden = Boolean(visible.length);
    status.textContent = unavailable ? 'Some sources could not load. Reload to try again.' : 'No activity links found.';
    more.hidden = visible.length <= limit;
    list.replaceChildren(...visible.slice(0, limit).map(entity => {
      const meta = [labels[entity.type], entity.country].filter(Boolean).join(' · ');
      const icon = makeIcon(entity.type);
      addFavicon(icon, entity.links[0].url);

      if (entity.links.length === 1) {
        const [{ url, date }] = entity.links;
        const row = countryElement('li', 'outreach-activity-item');
        const link = countryElement('a', 'outreach-activity-name', entity.name);
        link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        if (meta) link.title = meta;
        row.append(icon, link);
        if (date) row.append(makeDate(date));
        return row;
      }

      // Several links for the same entity: one collapsible entry, not several
      // rows repeating the same name, and not a single row hiding the rest.
      const row = countryElement('li', 'outreach-activity-item outreach-activity-item--group');
      const group = countryElement('details', 'outreach-activity-group');
      const summary = countryElement('summary');
      const name = countryElement('span', 'outreach-activity-name', entity.name);
      if (meta) name.title = meta;
      const badge = countryElement('span', 'outreach-activity-count', String(entity.links.length));
      summary.append(icon, name, badge);
      const sublist = countryElement('ul', 'outreach-activity-sublist');
      sublist.replaceChildren(...entity.links.map(({ url, date }) => {
        const item = countryElement('li');
        const link = countryElement('a', '', outreachHostname(url) || url);
        link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        item.append(link);
        if (date) item.append(makeDate(date));
        return item;
      }));
      group.append(summary, sublist);
      row.append(group);
      return row;
    }));
  };
  type.addEventListener('change', () => { limit = 20; render(); });
  search.addEventListener('input', () => { limit = 20; render(); });
  more.addEventListener('click', () => { limit += 100; render(); });
  render();
}
