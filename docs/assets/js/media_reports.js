const mentionsAssetsBase = new URL('../data/', document.currentScript.src);

function mentionUrls(value) {
  return (value || '').split(';').map(item => item.trim()).filter(Boolean);
}

function mentionCountryId(country) {
  return `mentions-${country.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function renderMediaReports(rows, countryFilter = '', searchValue = '') {
  const root = document.getElementById('media-reports-list');
  const summary = document.getElementById('mentions-summary');
  if (!root) return;

  const query = searchValue.trim().toLowerCase();
  const covered = rows.filter(row => {
    if (!mentionUrls(row.article_urls).length) return false;
    if (countryFilter && row.country !== countryFilter) return false;
    return !query || row.outlet.toLowerCase().includes(query);
  });

  const groups = new Map();
  covered.forEach(row => {
    if (!groups.has(row.country)) groups.set(row.country, []);
    groups.get(row.country).push(row);
  });

  root.replaceChildren();
  [...groups.entries()]
    .sort(([countryA], [countryB]) => countryA.localeCompare(countryB))
    .forEach(([country, outlets]) => {
      const details = document.createElement('details');
      details.className = 'status-disclosure';
      details.id = mentionCountryId(country);
      details.open = Boolean(countryFilter || query);

      const countrySummary = document.createElement('summary');
      countrySummary.className = 'status-disclosure-summary';
      const content = document.createElement('div');
      content.className = 'coverage-priority-content';
      const heading = document.createElement('div');
      heading.className = 'coverage-priority-heading';
      const name = document.createElement('strong');
      name.className = 'coverage-country-name';
      name.textContent = country;
      const count = document.createElement('span');
      count.className = 'coverage-priority-percentage';
      const itemCount = outlets.reduce((total, outlet) => total + mentionUrls(outlet.article_urls).length, 0);
      count.textContent = `${outlets.length} ${outlets.length === 1 ? 'outlet' : 'outlets'} · ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
      heading.append(name, count);
      content.append(heading);
      countrySummary.append(content);

      const list = document.createElement('div');
      list.className = 'status-entry-list';
      const blocks = outlets.sort((a, b) => a.outlet.localeCompare(b.outlet)).map(outlet => countryEntryDisclosure(outlet, COUNTRY_SECTIONS.find(section => section.key === 'media')));
      list.replaceChildren(...blocks);
      countryDisclosureAccordion(blocks);

      details.append(countrySummary, list);
      root.append(details);
    });

  countryDisclosureAccordion([...root.children]);
  if (!groups.size) {
    const empty = document.createElement('p');
    empty.className = 'coverage-priority-loading';
    empty.textContent = 'No recorded coverage matches this filter.';
    root.append(empty);
  }
  if (summary) {
    const itemCount = covered.reduce((total, row) => total + mentionUrls(row.article_urls).length, 0);
    summary.textContent = `${groups.size} countries · ${covered.length} outlets · ${itemCount} articles and posts`;
  }
}

function setupMediaReports() {
  const root = document.getElementById('media-reports-list');
  const countryFilter = document.getElementById('mentions-country-filter');
  const search = document.getElementById('mentions-search');
  if (!root || root.dataset.reportsReady) return;
  root.dataset.reportsReady = '1';

  fetch(new URL('media_coverage.csv', mentionsAssetsBase))
    .then(response => response.ok ? response.text() : Promise.reject(Error(response.status)))
    .then(text => {
      const rows = csvRows(text);
      const covered = rows.filter(row => mentionUrls(row.article_urls).length);
      const countries = [...new Set(covered.map(row => row.country))].sort((a, b) => a.localeCompare(b));
      countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        countryFilter?.append(option);
      });

      const itemCount = covered.reduce((total, row) => total + mentionUrls(row.article_urls).length, 0);
      const stats = {
        'mentions-stat-countries': countries.length,
        'mentions-stat-outlets': covered.length,
        'mentions-stat-items': itemCount
      };
      Object.entries(stats).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value.toLocaleString();
      });

      const update = () => renderMediaReports(rows, countryFilter?.value || '', search?.value || '');
      update();
      countryFilter?.addEventListener('change', update);
      search?.addEventListener('input', update);
    })
    .catch(() => {
      root.innerHTML = '<p class="coverage-priority-loading">Unable to load the media coverage data.</p>';
    });
}

document.addEventListener('DOMContentLoaded', setupMediaReports);
if (typeof document$ !== 'undefined') document$.subscribe(setupMediaReports);
