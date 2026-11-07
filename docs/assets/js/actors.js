const actorsAssetsBase = new URL('../data/', document.currentScript.src);

const ACTOR_LEVELS = {
  green: { label: '76–100% with evidence linked', color: '#2e7d32' },
  lightgreen: { label: '51–75% with evidence linked', color: '#7cb342' },
  orange: { label: '26–50% with evidence linked', color: '#f57c00' },
  red: { label: '0–25% with evidence linked', color: '#c62828' }
};

const actorsMapState = {};

function actorValues(value) {
  return (value || '').split(';').map(part => part.trim()).filter(Boolean);
}

function actorIssues(actor) {
  return actorValues(actor.issues);
}

const isActorResponded = actor => outreachUrls(actor.evidence_url).length > 0;

function actorCountryKey(country) {
  return outreachCountryName(country).toLowerCase();
}

function actorAssignedInstitutionsNote(actor) {
  const countries = [...new Map(actorValues(actor.country_of_interest).map(country => [actorCountryKey(country), outreachCountryName(country)])).values()];
  if (!countries.length) return null;
  const note = countryElement('div', 'country-entry-links');
  note.append(countryElement('strong', '', 'Country of interest:'));
  countries.forEach(country => {
    const link = countryElement('a', '', country);
    link.href = outreachCountryPopupUrl(country, true);
    link.dataset.countryKey = actorCountryKey(country);
    note.append(link);
  });
  return note;
}

function renderActors(data, sortMode, filterSummary) {
  renderStatusDirectory({
    data,
    sortMode,
    filterSummary,
    listId: 'actors-priority-list',
    summaryId: 'actors-summary',
    mapStatsIds: (countries, allData, responded) => ({
      'actors-stat-countries': countries.length,
      'actors-stat-actors': allData.length,
      'actors-stat-responded': responded,
      'actors-stat-pending': allData.length - responded
    }),
    groupKey: 'actors',
    nameField: 'organization',
    isResponded: isActorResponded,
    levels: ACTOR_LEVELS,
    countryIdPrefix: 'actors',
    entrySort: (a, b) => Number(!isActorResponded(a)) - Number(!isActorResponded(b)) || a.organization.localeCompare(b.organization),
    summaryNoun: 'actors',
    reportSectionKey: 'actors',
    mapOptions: {
      state: actorsMapState,
      assetsBase: actorsAssetsBase,
      mapId: 'actors-map',
      legendId: 'actors-map-legend',
      aliases: { 'Czech Republic': 'Czechia', 'United States of America': 'United States' },
      unitLabel: 'actors'
    }
  });
}

function setupActors() {
  setupStatusPage({
    csvFile: 'actors.csv',
    assetsBase: actorsAssetsBase,
    listId: 'actors-priority-list',
    sortId: 'actors-country-sort',
    searchId: 'actors-search',
    filters: [
      {
        selectId: 'actors-status-filter',
        match: (item, value) => isActorResponded(item) === (value === 'recorded'),
        options: () => []
      },
      {
        selectId: 'actors-category-filter',
        match: (item, value) => item.category === value,
        options: data => [...new Set(data.map(item => item.category).filter(Boolean))].sort()
      },
      {
        selectId: 'actors-issue-filter',
        match: (item, value) => actorIssues(item).includes(value),
        options: data => [...new Set(data.flatMap(actorIssues))].sort()
      },
      {
        selectId: 'actors-interest-filter',
        match: (item, value) => actorValues(item.country_of_interest).includes(value),
        options: data => [...new Set(data.flatMap(item => actorValues(item.country_of_interest)))].sort()
      }
    ],
    searchMatch: (item, query) => item.organization.toLowerCase().includes(query) || (item.city || '').toLowerCase().includes(query),
    buildFilterSummary: ([status, category, issue, interest], query) => [status === 'recorded' ? 'Done' : status === 'missing' ? 'Todo' : '', category, issue, interest ? `interested in: ${interest}` : '', query ? `search: ${query}` : ''].filter(Boolean).join(' · '),
    onData: data => { actorNamesById = new Map(data.filter(row => row.actor_id).map(row => [row.actor_id, row.organization])); },
    render: renderActors
  });
}

new MutationObserver(() => {
  if (actorsMapState.tiles) actorsMapState.tiles.setUrl(statusTileUrl());
}).observe(document.body, { attributes: true, attributeFilter: ['data-md-color-scheme'] });

document.addEventListener('DOMContentLoaded', setupActors);
if (typeof document$ !== 'undefined') document$.subscribe(setupActors);
