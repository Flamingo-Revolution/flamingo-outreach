const institutionsAssetsBase = new URL('../data/', document.currentScript.src);

const INSTITUTION_LEVELS = {
  green: { label: '76–100% with response links', color: '#2e7d32' },
  lightgreen: { label: '51–75% with response links', color: '#7cb342' },
  orange: { label: '26–50% with response links', color: '#f57c00' },
  red: { label: '0–25% with response links', color: '#c62828' }
};

const institutionsMapState = {};

function institutionValues(value) {
  return (value || '').split(';').map(part => part.trim());
}

function institutionIssues(organization) {
  return institutionValues(organization.issues).filter(Boolean);
}

const isInstitutionResponded = org => outreachUrls(org.response_link).length > 0;

function renderInstitutions(data, sortMode, filterSummary) {
  renderStatusDirectory({
    data,
    sortMode,
    filterSummary,
    listId: 'institutions-priority-list',
    summaryId: 'institutions-summary',
    mapStatsIds: (countries, allData, responded) => ({
      'institutions-stat-countries': countries.length,
      'institutions-stat-organizations': allData.length,
      'institutions-stat-responded': responded,
      'institutions-stat-pending': allData.length - responded
    }),
    groupKey: 'organizations',
    nameField: 'organization',
    isResponded: isInstitutionResponded,
    levels: INSTITUTION_LEVELS,
    countryIdPrefix: 'institutions',
    entrySort: (a, b) => Number(!isInstitutionResponded(a)) - Number(!isInstitutionResponded(b)) || a.organization.localeCompare(b.organization),
    summaryNoun: 'organizations',
    reportSectionKey: 'institutions',
    mapOptions: {
      state: institutionsMapState,
      assetsBase: institutionsAssetsBase,
      mapId: 'institutions-map',
      legendId: 'institutions-map-legend',
      aliases: { 'Czech Republic': 'Czechia', 'United States of America': 'United States' },
      unitLabel: 'organizations'
    }
  });
}

function setupInstitutions() {
  setupStatusPage({
    csvFile: 'institutions.csv',
    assetsBase: institutionsAssetsBase,
    listId: 'institutions-priority-list',
    sortId: 'institutions-country-sort',
    searchId: 'institutions-search',
    filters: [
      {
        selectId: 'institutions-status-filter',
        match: (item, value) => (outreachUrls(item.response_link).length > 0) === (value === 'recorded'),
        options: () => []
      },
      {
        selectId: 'institutions-category-filter',
        match: (item, value) => item.category === value,
        options: data => [...new Set(data.map(item => item.category).filter(Boolean))].sort()
      },
      {
        selectId: 'institutions-issue-filter',
        match: (item, value) => institutionIssues(item).includes(value),
        options: data => [...new Set(data.flatMap(institutionIssues))].sort()
      }
    ],
    searchMatch: (item, query) => item.organization.toLowerCase().includes(query) || (item.city || '').toLowerCase().includes(query),
    buildFilterSummary: ([status, category, issue], query) => [status === 'recorded' ? 'Done' : status === 'missing' ? 'Todo' : '', category, issue, query ? `search: ${query}` : ''].filter(Boolean).join(' · '),
    render: renderInstitutions
  });
}

new MutationObserver(() => {
  if (institutionsMapState.tiles) institutionsMapState.tiles.setUrl(statusTileUrl());
}).observe(document.body, { attributes: true, attributeFilter: ['data-md-color-scheme'] });

document.addEventListener('DOMContentLoaded', setupInstitutions);
if (typeof document$ !== 'undefined') document$.subscribe(setupInstitutions);
