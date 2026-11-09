const politiciansAssetsBase = new URL('../data/', document.currentScript.src);

const POLITICIAN_LEVELS = {
  green: { label: '76–100% with evidence linked', color: '#2e7d32' },
  lightgreen: { label: '51–75% with evidence linked', color: '#7cb342' },
  orange: { label: '26–50% with evidence linked', color: '#f57c00' },
  red: { label: '0–25% with evidence linked', color: '#c62828' }
};

const politiciansMapState = {};

const isPoliticianRecorded = politician => outreachUrls(politician.evidence_urls).length > 0;

function renderPoliticians(data, sortMode, filterSummary) {
  renderStatusDirectory({
    data,
    sortMode,
    filterSummary,
    listId: 'politicians-priority-list',
    summaryId: 'politicians-summary',
    mapStatsIds: (countries, allData, responded) => ({
      'politicians-stat-countries': countries.length,
      'politicians-stat-politicians': allData.length,
      'politicians-stat-responded': responded,
      'politicians-stat-pending': allData.length - responded
    }),
    groupKey: 'politicians',
    nameField: 'name',
    isResponded: isPoliticianRecorded,
    levels: POLITICIAN_LEVELS,
    countryIdPrefix: 'politicians',
    entrySort: (a, b) => Number(!isPoliticianRecorded(a)) - Number(!isPoliticianRecorded(b)) || a.name.localeCompare(b.name),
    summaryNoun: 'politicians',
    reportSectionKey: 'politicians',
    mapOptions: {
      state: politiciansMapState,
      assetsBase: politiciansAssetsBase,
      mapId: 'politicians-map',
      legendId: 'politicians-map-legend',
      aliases: { 'Czech Republic': 'Czechia', 'United States of America': 'United States' },
      excludeCountry: country => country.includes('/') || country === 'EU',
      unitLabel: 'politicians'
    }
  });
}

function setupPoliticians() {
  setupStatusPage({
    csvFile: 'politicians.csv',
    assetsBase: politiciansAssetsBase,
    listId: 'politicians-priority-list',
    sortId: 'politicians-country-sort',
    searchId: 'politicians-search',
    filters: [
      {
        selectId: 'politicians-status-filter',
        match: (item, value) => isPoliticianRecorded(item) === (value === 'recorded'),
        options: () => []
      },
      {
        selectId: 'politicians-category-filter',
        match: (item, value) => item.entity_category === value,
        options: data => [...new Set(data.map(item => item.entity_category).filter(Boolean))].sort()
      },
      {
        selectId: 'politicians-role-filter',
        match: (item, value) => item.political_role_type === value,
        options: data => [...new Set(data.map(item => item.political_role_type).filter(Boolean))].sort()
      }
    ],
    searchMatch: (item, query) => item.name.toLowerCase().includes(query) || (item.party_group || '').toLowerCase().includes(query),
    buildFilterSummary: ([status, category, role], query) => [status === 'recorded' ? 'Done' : status === 'missing' ? 'Todo' : '', category, role, query ? `search: ${query}` : ''].filter(Boolean).join(' · '),
    render: renderPoliticians
  });
}

new MutationObserver(() => {
  if (politiciansMapState.tiles) politiciansMapState.tiles.setUrl(statusTileUrl());
}).observe(document.body, { attributes: true, attributeFilter: ['data-md-color-scheme'] });

document.addEventListener('DOMContentLoaded', setupPoliticians);
if (typeof document$ !== 'undefined') document$.subscribe(setupPoliticians);
