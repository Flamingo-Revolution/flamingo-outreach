/* Shared country model for the map and country reports. */
const countryAssetsBase = new URL('../data/', document.currentScript.src);
const countrySiteBase = new URL('../../', document.currentScript.src);
const COUNTRY_SECTIONS = [
  { key: 'media', title: 'Media', file: 'media_coverage.csv', name: 'outlet', evidence: 'article_urls', verb: 'with coverage' },
  { key: 'institutions', title: 'Institutions', file: 'institutions.csv', name: 'organization', evidence: 'response_link', verb: 'with responses' },
  { key: 'mps', title: 'MPs', file: 'mps.csv', name: 'name', evidence: 'response_link', verb: 'with responses' },
  { key: 'parties', title: 'Parties & parliamentary groups', file: 'political_parties.csv', name: 'party', evidence: 'response_link', verb: 'with responses' },
  { key: 'actors', title: 'Actors', file: 'actors.csv', name: 'organization', evidence: 'evidence_url', verb: 'with evidence linked' }
];
const COUNTRY_ALIASES = {
  'Czech Republic': 'Czechia', Macedonia: 'North Macedonia',
  'United States of America': 'United States', 'Republic of Serbia': 'Serbia',
  'United Arab Emirates': 'UAE'
};

function outreachCountryName(name) {
  const trimmed = (name || '').trim();
  return COUNTRY_ALIASES[trimmed] || trimmed;
}

function outreachUrls(value) {
  return [...new Set((value || '').split(';').map(part => part.trim()).filter(part => {
    try { return ['http:', 'https:'].includes(new URL(part).protocol); } catch (_) { return false; }
  }))];
}

function outreachCountryUrl(country, section = '') {
  const url = new URL('country/', countrySiteBase);
  url.searchParams.set('country', country);
  if (section) url.hash = section;
  return url.href;
}

function buildOutreachCountries(datasets) {
  const countries = new Map();
  COUNTRY_SECTIONS.forEach(section => {
    const merged = new Map();
    (datasets[section.key] || []).forEach(row => {
      const country = outreachCountryName(row.country);
      const name = (row[section.name] || '').trim();
      if (!country || !name) return;
      const id = JSON.stringify([country, name.toLowerCase()]);
      if (!merged.has(id)) merged.set(id, { ...row, country, [section.name]: name });
      else {
        const actor = merged.get(id);
        Object.entries(row).forEach(([key, value]) => {
          if (key === 'country' || key === section.name || !value || actor[key] === value) return;
          actor[key] = [actor[key], value].filter(Boolean).join('; ');
        });
      }
    });
    merged.forEach(row => {
      if (!countries.has(row.country)) {
        countries.set(row.country, { country: row.country, entries: Object.fromEntries(COUNTRY_SECTIONS.map(item => [item.key, []])) });
      }
      countries.get(row.country).entries[section.key].push(row);
    });
  });
  return [...countries.values()].map(item => {
    item.stats = Object.fromEntries(COUNTRY_SECTIONS.map(section => {
      const entries = item.entries[section.key];
      const recorded = entries.filter(row => outreachUrls(row[section.evidence]).length).length;
      return [section.key, { total: entries.length, recorded, missing: entries.length - recorded }];
    }));
    item.total = Object.values(item.stats).reduce((sum, stat) => sum + stat.total, 0);
    item.recorded = Object.values(item.stats).reduce((sum, stat) => sum + stat.recorded, 0);
    return item;
  }).sort((a, b) => a.country.localeCompare(b.country));
}

async function loadOutreachCountries() {
  const datasets = await Promise.all(COUNTRY_SECTIONS.map(async section => {
    const response = await fetch(new URL(section.file, countryAssetsBase));
    if (!response.ok) throw Error(`Unable to load ${section.file}`);
    return [section.key, csvRows(await response.text())];
  }));
  return buildOutreachCountries(Object.fromEntries(datasets));
}

function countryElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function countryMetrics(item, linkToReport = true) {
  const metrics = countryElement('div', 'country-metrics');
  COUNTRY_SECTIONS.forEach(section => {
    const stat = item.stats[section.key];
    const link = countryElement('a', 'country-metric');
    link.href = linkToReport ? outreachCountryUrl(item.country, section.key) : `#${section.key}`;
    link.append(
      countryElement('span', '', section.title),
      countryElement('strong', '', stat.total ? `${stat.recorded}/${stat.total}` : '—'),
      countryElement('small', '', stat.total ? section.verb : 'No entries yet')
    );
    metrics.append(link);
  });
  return metrics;
}

/* Shared native disclosure shell for popup entries, directories and filters. */
function countryDisclosure(heading, content, className = '') {
  const details = countryElement('details', ('status-disclosure ' + className).trim());
  const summary = countryElement('summary', 'status-disclosure-summary');
  summary.append(...heading);
  details.append(summary, content);
  return details;
}

function countryDisclosureAccordion(blocks) {
  blocks.forEach(block => block.addEventListener('toggle', () => {
    if (!block.open) return;
    blocks.forEach(other => { if (other !== block) other.open = false; });
  }));
}
