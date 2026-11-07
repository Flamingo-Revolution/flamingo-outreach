const partiesAssetsBase = new URL('../data/', document.currentScript.src);

const PARTY_LEVELS = {
  green: { label: '76–100% with response links', color: '#2e7d32' },
  lightgreen: { label: '51–75% with response links', color: '#7cb342' },
  orange: { label: '26–50% with response links', color: '#f57c00' },
  red: { label: '0–25% with response links', color: '#c62828' }
};

const partiesMapState = {};

function partyValues(value) {
  return (value || '').split(';').map(part => part.trim()).filter(Boolean);
}

const isPartyResponded = party => outreachUrls(party.response_link).length > 0;

function renderParties(data, sortMode, filterSummary) {
  renderStatusDirectory({
    data,
    sortMode,
    filterSummary,
    listId: 'parties-priority-list',
    summaryId: 'parties-summary',
    mapStatsIds: (countries, allData, responded) => ({
      'parties-stat-countries': countries.length,
      'parties-stat-parties': allData.length,
      'parties-stat-responded': responded,
      'parties-stat-pending': allData.length - responded
    }),
    groupKey: 'parties',
    nameField: 'party',
    isResponded: isPartyResponded,
    levels: PARTY_LEVELS,
    countryIdPrefix: 'parties',
    entrySort: (a, b) => Number(!isPartyResponded(a)) - Number(!isPartyResponded(b)) || a.party.localeCompare(b.party),
    summaryNoun: 'parties',
    reportSectionKey: 'parties',
    mapOptions: {
      state: partiesMapState,
      assetsBase: partiesAssetsBase,
      mapId: 'parties-outreach-map',
      legendId: 'parties-map-legend',
      aliases: { 'Czech Republic': 'Czechia', Macedonia: 'North Macedonia', 'United States of America': 'United States' },
      excludeCountry: country => country.includes('/') || country === 'European Parliament',
      unitLabel: 'parties'
    }
  });
}

function setupParties() {
  setupStatusPage({
    csvFile: 'political_parties.csv',
    assetsBase: partiesAssetsBase,
    listId: 'parties-priority-list',
    sortId: 'parties-country-sort',
    searchId: 'parties-search',
    filters: [
      {
        selectId: 'parties-status-filter',
        match: (item, value) => (outreachUrls(item.response_link).length > 0) === (value === 'recorded'),
        options: () => []
      },
      {
        selectId: 'parties-priority-filter',
        match: (item, value) => item.priority === value,
        options: data => [...new Set(data.map(item => item.priority).filter(Boolean))].sort()
      },
      {
        selectId: 'parties-issue-filter',
        match: (item, value) => partyValues(item.issues).includes(value),
        options: data => [...new Set(data.flatMap(item => partyValues(item.issues)))].sort()
      }
    ],
    searchMatch: (item, query) => item.party.toLowerCase().includes(query) || (item.country || '').toLowerCase().includes(query),
    buildFilterSummary: ([status, priority, issue], query) => [status === 'recorded' ? 'Done' : status === 'missing' ? 'Todo' : '', priority, issue, query ? `search: ${query}` : ''].filter(Boolean).join(' · '),
    render: renderParties
  });
}

new MutationObserver(() => {
  if (partiesMapState.tiles) partiesMapState.tiles.setUrl(statusTileUrl());
}).observe(document.body, { attributes: true, attributeFilter: ['data-md-color-scheme'] });

document.addEventListener('DOMContentLoaded', setupParties);
if (typeof document$ !== 'undefined') document$.subscribe(setupParties);
