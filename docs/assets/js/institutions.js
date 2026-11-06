const institutionsAssetsBase = new URL('../data/', document.currentScript.src);

const INSTITUTION_LEVELS = {
  green: { label: '76–100% responded', color: '#2e7d32' },
  lightgreen: { label: '51–75% responded', color: '#7cb342' },
  orange: { label: '26–50% responded', color: '#f57c00' },
  red: { label: '0–25% responded', color: '#c62828' }
};

const institutionsMapState = {};

function institutionValues(value) {
  return (value || '').split(';').map(part => part.trim());
}

function institutionIssues(organization) {
  return institutionValues(organization.issues).filter(Boolean);
}

function addInstitutionLink(root, url, label, email = false) {
  if (!url) return;
  const link = document.createElement('a');
  link.href = email && !url.startsWith('mailto:') ? `mailto:${url}` : url;
  link.target = email ? '_self' : '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label;
  root.append(link);
}

function addInstitutionResponses(info, links, organization) {
  const urls = institutionValues(organization.response_link).filter(Boolean);
  if (!urls.length) return;
  const dates = institutionValues(organization.response_date);
  const types = institutionValues(organization.response_type);
  const sources = institutionValues(organization.response_source);
  const responseMeta = document.createElement('span');
  responseMeta.className = 'coverage-outlet-headline';
  responseMeta.textContent = urls.map((url, index) => {
    const parts = [types[index] || (urls.length > 1 ? `Response ${index + 1}` : 'Response'), dates[index], sources[index]];
    return parts.filter(Boolean).join(' · ');
  }).join(' | ');
  info.append(responseMeta);
  urls.forEach((url, index) => {
    const type = types[index] || 'Response';
    const label = urls.length > 1 ? `${type} ${index + 1}${dates[index] ? ` · ${dates[index]}` : ''}` : `${type}${dates[index] ? ` · ${dates[index]}` : ''}`;
    addInstitutionLink(links, url, label);
  });
}

function addInstitutionContactRoute(info, route) {
  if (!route) return;
  const line = document.createElement('span');
  line.className = 'coverage-outlet-headline';
  line.append(document.createTextNode('Contact: '));
  const url = route.match(/https?:\/\/\S+/)?.[0];
  const email = route.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0];
  if (url || email) {
    const value = url || email;
    const link = document.createElement('a');
    link.href = email ? `mailto:${email}` : value;
    link.target = email ? '_self' : '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = route;
    line.append(link);
  } else {
    line.append(document.createTextNode(route));
  }
  info.append(line);
}

function addInstitutionContribution(info, contribution) {
  if (!contribution) return;
  const line = document.createElement('span');
  line.className = 'coverage-outlet-headline institution-contribution';
  const label = document.createElement('strong');
  label.textContent = 'Contribution: ';
  line.append(label);
  const urlPattern = /https?:\/\/[^\s]+/g;
  let offset = 0;
  for (const match of contribution.matchAll(urlPattern)) {
    line.append(document.createTextNode(contribution.slice(offset, match.index)));
    const link = document.createElement('a');
    link.href = match[0];
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Source';
    line.append(link);
    offset = match.index + match[0].length;
  }
  line.append(document.createTextNode(contribution.slice(offset)));
  info.append(line);
}

function renderInstitutionEntry(org, info, links) {
  const name = document.createElement('strong');
  name.textContent = org.organization;
  const meta = document.createElement('span');
  meta.className = 'coverage-outlet-status';
  meta.textContent = [org.category, org.city, org.eu_member === '1' ? 'EU member' : '', org.office_in_albania === '1' ? 'Office in Albania' : ''].filter(Boolean).join(' · ');
  info.append(name, meta);

  if (org.issues) {
    const issues = document.createElement('span');
    issues.className = 'coverage-outlet-tags';
    institutionIssues(org).forEach(issue => {
      const tag = document.createElement('span');
      tag.className = 'institution-issue-tag';
      tag.textContent = issue;
      issues.append(tag);
    });
    info.append(issues);
  }

  addInstitutionContactRoute(info, org.contact_route);
  addInstitutionContribution(info, org.contribution);
  addInstitutionResponses(info, links, org);
  addInstitutionLink(links, org.website, 'Website');
  addInstitutionLink(links, org.email, 'Email', true);
}

const isInstitutionResponded = org => Boolean((org.response_link || '').trim());

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
    renderEntry: renderInstitutionEntry,
    summaryNoun: 'organizations',
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
    buildFilterSummary: ([category, issue], query) => [category, issue, query ? `search: ${query}` : ''].filter(Boolean).join(' · '),
    render: renderInstitutions
  });
}

new MutationObserver(() => {
  if (institutionsMapState.tiles) institutionsMapState.tiles.setUrl(statusTileUrl());
}).observe(document.body, { attributes: true, attributeFilter: ['data-md-color-scheme'] });

document.addEventListener('DOMContentLoaded', setupInstitutions);
if (typeof document$ !== 'undefined') document$.subscribe(setupInstitutions);
