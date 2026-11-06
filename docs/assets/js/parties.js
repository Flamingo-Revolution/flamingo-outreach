const partiesAssetsBase = new URL('../data/', document.currentScript.src);

const PARTY_LEVELS = {
  green: { label: '76–100% responded', color: '#2e7d32' },
  lightgreen: { label: '51–75% responded', color: '#7cb342' },
  orange: { label: '26–50% responded', color: '#f57c00' },
  red: { label: '0–25% responded', color: '#c62828' }
};

const partiesMapState = {};

function partyValues(value) {
  return (value || '').split(';').map(part => part.trim()).filter(Boolean);
}

function addPartyLink(root, url, label) {
  if (!url) return;
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label;
  root.append(link);
}

function addPartyResponseLinks(root, party) {
  const urls = partyValues(party.response_link);
  urls.forEach((url, index) => addPartyLink(root, url, urls.length > 1 ? `Response ${index + 1}` : 'Response'));
}

function addPartyInstagramEvidence(root, value) {
  if (!value) return;
  const url = value.match(/https?:\/\/[^\s)]+/)?.[0];
  if (!url) return;
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Instagram evidence';
  link.title = value;
  root.append(link);
}

function renderPartyEntry(party, info, links) {
  const name = document.createElement('strong');
  name.textContent = party.party;
  const meta = document.createElement('span');
  meta.className = 'coverage-outlet-status';
  meta.textContent = [party.priority ? `${party.priority} priority` : '', party.response_link ? 'Responded' : 'No response'].filter(Boolean).join(' · ');
  info.append(name, meta);

  if (party.status) {
    const status = document.createElement('span');
    status.className = 'coverage-outlet-headline';
    status.textContent = party.status;
    info.append(status);
  }

  if (party.issues) {
    const tags = document.createElement('span');
    tags.className = 'coverage-outlet-tags';
    partyValues(party.issues).forEach(issue => {
      const tag = document.createElement('span');
      tag.className = 'institution-issue-tag';
      tag.textContent = issue;
      tags.append(tag);
    });
    info.append(tags);
  }

  addPartyResponseLinks(links, party);
  addPartyLink(links, party.website, 'Website');
  addPartyInstagramEvidence(links, party.instagram_evidence);
}

const isPartyResponded = party => Boolean((party.response_link || '').trim());

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
    renderEntry: renderPartyEntry,
    summaryNoun: 'parties',
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
    buildFilterSummary: ([priority, issue], query) => [priority, issue, query ? `search: ${query}` : ''].filter(Boolean).join(' · '),
    render: renderParties
  });
}

new MutationObserver(() => {
  if (partiesMapState.tiles) partiesMapState.tiles.setUrl(statusTileUrl());
}).observe(document.body, { attributes: true, attributeFilter: ['data-md-color-scheme'] });

document.addEventListener('DOMContentLoaded', setupParties);
if (typeof document$ !== 'undefined') document$.subscribe(setupParties);
