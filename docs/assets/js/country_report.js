function countryReportDate(value) {
  if (/^\d+(\.\d+)?$/.test(value || '')) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(value)) * 86400000).toISOString().slice(0, 10);
  }
  return value;
}

function countryReportLink(root, value, label, email = false) {
  const urls = email ? (value || '').split(';').map(item => item.trim()).filter(item => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)) : outreachUrls(value);
  urls.forEach((url, index) => {
    const link = countryElement('a', '', urls.length > 1 ? `${label} ${index + 1}` : label);
    link.href = email ? `mailto:${url}` : url;
    if (!email) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    root.append(link);
  });
}

function countryReportNote(text) {
  const paragraph = countryElement('p', 'country-entry-note');
  let offset = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s;<>]+/g)) {
    const url = match[0].replace(/[.,)]+$/, '');
    paragraph.append(document.createTextNode(text.slice(offset, match.index)));
    countryReportLink(paragraph, url, 'Source ↗');
    offset = match.index + url.length;
  }
  paragraph.append(document.createTextNode(text.slice(offset)));
  return paragraph;
}

const COUNTRY_ENTRY_STATUS_LABELS = {
  media: ['Coverage linked', 'No coverage link recorded'],
  actors: ['Evidence linked', 'No evidence link recorded']
};

function countryReportEntry(row, section, detailed = false) {
  if (!detailed && section.key !== 'actors') return countryEntryLinkList(row, section);
  const hasRecord = outreachUrls(row[section.evidence]).length > 0;
  const card = countryElement('article', 'country-entry');
  const header = countryElement('div', 'country-entry-header');
  const title = countryElement('h3', '', row[section.name]);
  const [recordedLabel, missingLabel] = COUNTRY_ENTRY_STATUS_LABELS[section.key] || ['Response linked', 'No response link recorded'];
  const status = countryElement('span', `country-entry-status${hasRecord ? ' country-entry-status--recorded' : ''}`,
    hasRecord ? recordedLabel : missingLabel);
  header.append(title, status);
  card.append(header);
  const meta = [row.category, row.city, row.role, section.key === 'mps' ? row.party : '', row.priority ? `${row.priority} priority` : '', row.part_of ? `Part of: ${resolveActorName(row.part_of)}` : ''].filter(Boolean);
  if (meta.length) card.append(countryElement('p', 'country-entry-meta', meta.join(' · ')));
  const tags = row.issues || row.tags;
  if (tags) card.append(countryElement('p', 'country-entry-meta', tags));
  [row.status, row.evidence, row.contribution, row.notes].filter(Boolean).forEach(note => card.append(countryReportNote(note)));
  [
    ['response_verification', 'Response verification'], ['evidence_notes', 'Evidence notes'],
    ['verification_status', 'Verification status'], ['verification_notes', 'Verification notes'],
    ['follow_up_assessment', 'Follow-up assessment'], ['follow_up_research_action', 'Follow-up action'],
    ['latest_evidence_scope', 'Latest evidence scope'], ['latest_verification_result', 'Latest verification result']
  ].forEach(([key, label]) => { if (row[key]) card.append(countryReportNote(label + ': ' + row[key])); });
  if (row.checked_on) card.append(countryElement('p', 'country-entry-meta', 'Checked: ' + countryReportDate(row.checked_on)));
  if (row.requested_action) card.append(countryElement('p', 'country-entry-note', `Suggested action: ${row.requested_action}`));
  const links = countryElement('div', 'country-entry-links');
  const dates = (section.key === 'media' ? row.dates || '' : section.key === 'actors' ? '' : row.response_date || '').split(';').map(date => countryReportDate(date.trim()));
  const types = (row.response_type || '').split(';').map(value => value.trim());
  const evidenceLabel = section.key === 'media' ? 'Coverage' : section.key === 'actors' ? 'Evidence' : 'Response';
  outreachUrls(row[section.evidence]).forEach((url, index) => {
    countryReportLink(links, url, [section.key === 'actors' ? `${evidenceLabel} ${index + 1}` : types[index] || `${evidenceLabel} ${index + 1}`, dates[index]].filter(Boolean).join(' · '));
  });
  if (section.key === 'actors' && row.response_link) {
    outreachUrls(row.response_link).forEach((url, index) => countryReportLink(links, url, `Response to outreach ${index + 1}`));
  }
  countryReportLink(links, row.follow_up_evidence_url, ['Follow-up evidence', countryReportDate(row.follow_up_evidence_date)].filter(Boolean).join(' · '));
  countryReportLink(links, row.latest_source_url, ['Latest source', countryReportDate(row.latest_source_date)].filter(Boolean).join(' · '));
  countryReportLink(links, row.website || row.outlet_url, 'Website');
  countryReportLink(links, row.instagram_url, 'Instagram');
  countryReportLink(links, row.email || row.contact_email, 'Email', true);
  if (row.instagram_evidence) {
    const url = row.instagram_evidence.match(/https?:\/\/[^\s;]+/)?.[0];
    if (url) countryReportLink(links, url, 'Instagram evidence');
  }
  if (row.contact_route) {
    card.append(countryElement('p', 'country-entry-note', `Contact route: ${row.contact_route}`));
    const url = row.contact_route.match(/https?:\/\/[^\s;]+/)?.[0];
    if (url) countryReportLink(links, url, 'Contact route');
    const email = row.contact_route.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0];
    if (email && email !== row.email) countryReportLink(links, email, 'Contact email', true);
  }
  if (row.assigned_to) card.append(countryElement('p', 'country-entry-meta', `Assigned to: ${row.assigned_to}`));
  if (row.contributors) card.append(countryElement('p', 'country-entry-meta', `Data contributors: ${row.contributors}`));
  if (section.key === 'actors' && row.country_of_interest && typeof actorAssignedInstitutionsNote === 'function') {
    card.append(actorAssignedInstitutionsNote(row));
  }
  card.append(links);
  return card;
}

function countryEntryLinkList(row, section, tag = 'article') {
  const entry = countryElement(tag, 'country-link-item');
  const done = outreachUrls(row[section.evidence]).length > 0;
  const status = countryElement('span', `country-link-status${done ? ' country-link-status--done' : ''}`);
  status.setAttribute('role', 'img');
  status.setAttribute('aria-label', done ? 'Done: source link recorded' : 'Not done: no source link recorded');
  status.title = done ? 'Done: source link recorded' : 'Not done: no source link recorded';
  entry.append(status);
  entry.append(countryElement('strong', '', row[section.name]));
  const links = countryElement('span', 'country-link-item-links');
  const seen = new Set();
  const add = (value, label, email = false) => {
    const holder = countryElement('span');
    countryReportLink(holder, value, label, email);
    [...holder.childNodes].forEach(link => {
      if (seen.has(link.href)) return;
      seen.add(link.href);
      links.append(link);
    });
  };
  add(row.website || row.outlet_url, 'Website');
  add(row.instagram_url, 'Instagram');
  add(row.email || row.contact_email, 'Email', true);
  if (row.contact_route) {
    add((row.contact_route.match(/https?:\/\/[^\s;<>]+/g) || []).map(url => url.replace(/[.,)]+$/, '')).join(';'), 'Contact');
    add((row.contact_route.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g) || []).join(';'), 'Email', true);
  }
  add(row[section.evidence], section.key === 'media' ? 'Coverage' : section.key === 'actors' ? 'Evidence' : 'Response');
  add(row.follow_up_evidence_url, 'Evidence');
  add(row.latest_source_url, 'Source');
  add((row.instagram_evidence || '').match(/https?:\/\/[^\s;<>]+/)?.[0], 'Instagram evidence');
  if (section.key === 'actors') {
    [...new Set((row.country_of_interest || '').split(';').map(outreachCountryName).filter(Boolean))].forEach(country => {
      add(outreachCountryPopupUrl(country, true), country);
    });
  }
  entry.append(links);
  return entry;
}

async function setupCountryReport() {
  const root = document.getElementById('country-report');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';
  const status = document.getElementById('country-report-status');
  const content = document.getElementById('country-report-content');
  try {
    const countries = await loadOutreachCountries();
    if (!root.isConnected) return;
    const requested = outreachCountryName(new URL(location.href).searchParams.get('country'));
    const item = countries.find(country => country.country.toLowerCase() === requested.toLowerCase());
    const toolbar = countryElement('div', 'outreach-toolbar');
    const label = countryElement('label', '', 'Country or group');
    label.htmlFor = 'country-report-picker';
    const picker = countryElement('select');
    picker.id = 'country-report-picker';
    const placeholder = countryElement('option', '', 'Choose a country or group');
    placeholder.value = '';
    picker.append(placeholder);
    countries.forEach(country => {
      const option = countryElement('option', '', country.country);
      option.value = country.country;
      picker.append(option);
    });
    picker.value = item?.country || '';
    picker.addEventListener('change', () => { if (picker.value) location.assign(outreachCountryUrl(picker.value)); });
    toolbar.append(label, picker);
    content.append(toolbar);
    if (!item) {
      status.textContent = requested ? `No country report is available for “${requested}”. Choose a country above or return to the map.` : 'Choose a country above or open a report from the country map.';
      return;
    }
    document.querySelector('h1').textContent = `${item.country} · Outreach report`;
    document.title = `${item.country} · Outreach report - Outreach`;
    status.textContent = `${item.total} listed entries · ${item.recorded} with linked coverage or responses · ${item.total - item.recorded} without a linked record`;
    const context = countryElement('nav', 'country-report-context');
    context.setAttribute('aria-label', 'Country report navigation');
    const back = countryElement('a', '', '← Country map');
    back.href = new URL('./', countrySiteBase).href;
    context.append(back, countryElement('strong', '', item.country));
    COUNTRY_SECTIONS.forEach(section => {
      const link = countryElement('a', '', section.key === 'parties' ? 'Parties' : section.title);
      link.href = `#${section.key}`;
      context.append(link);
    });
    content.append(context);
    const introduction = countryElement('p', 'outreach-note', 'All outreach information for this country, grouped below. Missing links do not establish that an organization has not acted or been contacted. Linked responses do not imply support for the protests.');
    content.append(countryMetrics(item, false), introduction);
    const controls = countryElement('div', 'outreach-toolbar');
    const searchLabel = countryElement('label', '', 'Find an entry');
    searchLabel.htmlFor = 'country-report-search';
    const search = countryElement('input');
    search.type = 'search'; search.id = 'country-report-search'; search.placeholder = 'Name, issue, party or city';
    const filterLabel = countryElement('label', '', 'Show');
    filterLabel.htmlFor = 'country-report-filter';
    const filter = countryElement('select');
    filter.id = 'country-report-filter';
    [['', 'All entries'], ['missing', 'Without linked coverage / response'], ['recorded', 'With linked coverage / response']].forEach(([value, text]) => {
      const option = countryElement('option', '', text); option.value = value; filter.append(option);
    });
    controls.append(searchLabel, search, filterLabel, filter);
    content.append(controls);
    const resultStatus = countryElement('p', 'outreach-summary');
    resultStatus.setAttribute('role', 'status');
    content.append(resultStatus);
    const sections = countryElement('div', 'country-report-sections');
    content.append(sections);
    const render = () => {
      sections.replaceChildren();
      let matched = 0;
      const query = search.value.trim().toLowerCase();
      COUNTRY_SECTIONS.forEach(section => {
        const entries = item.entries[section.key];
        const visible = entries.filter(row => {
          const recorded = outreachUrls(row[section.evidence]).length > 0;
          return (!filter.value || (filter.value === 'recorded' ? recorded : !recorded)) &&
            (!query || Object.values(row).some(value => String(value).toLowerCase().includes(query)));
        }).sort((a, b) => Number(Boolean(outreachUrls(a[section.evidence]).length)) - Number(Boolean(outreachUrls(b[section.evidence]).length)) || a[section.name].localeCompare(b[section.name]));
        matched += visible.length;
        const block = countryElement('section', 'country-report-section');
        block.id = section.key;
        block.append(countryElement('h2', '', `${section.title} · ${entries.length}`));
        const stat = item.stats[section.key];
        block.append(countryElement('p', 'outreach-summary', entries.length ? `${stat.recorded} ${section.verb} · ${stat.missing} without linked records` : 'No entries recorded yet'));
        if (!entries.length) {
          block.append(countryElement('p', 'country-empty', section.key === 'mps' ? `No individual MPs are recorded for ${item.country} yet. Parties and parliamentary groups are listed separately below.` : `No ${section.title.toLowerCase()} are recorded for this country yet.`));
        } else if (!visible.length) {
          block.append(countryElement('p', 'country-empty', 'No entries match your filters.'));
        } else visible.forEach(row => block.append(countryReportEntry(row, section)));
        const footer = countryElement('div', 'country-section-footer');
        countryReportLink(footer, new URL(section.file, countryAssetsBase).href, 'Download full dataset');
        const letter = countryElement('a', '', 'Choose a letter →');
        letter.href = new URL('messages/', countrySiteBase).href;
        footer.append(letter);
        block.append(footer);
        sections.append(block);
      });
      resultStatus.textContent = `${matched} of ${item.total} entries shown`;
    };
    search.addEventListener('input', render);
    filter.addEventListener('change', render);
    render();
    // The requested section is populated after the browser's initial anchor scroll.
    const anchor = location.hash.slice(1);
    if (COUNTRY_SECTIONS.some(section => section.key === anchor)) {
      requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
    }
  } catch (_) {
    status.textContent = 'Unable to load this country report. Reload to try again, or return to the country map.';
    delete root.dataset.ready;
  }
}

document.addEventListener('DOMContentLoaded', setupCountryReport);
if (typeof document$ !== 'undefined') document$.subscribe(setupCountryReport);

function countryEntryDisclosure(row, section, extra, detailed = false) {
  if (row.popupSection) section = COUNTRY_SECTIONS.find(item => item.key === row.popupSection);
  if (!detailed && section.key !== 'actors') {
    const entry = countryReportEntry(row, section);
    if (extra) entry.append(extra);
    return entry;
  }
  const hasRecord = outreachUrls(row[section.evidence]).length > 0;

  const heading = countryElement('span', 'country-popup-entry-title', row[section.name]);
  const status = countryElement('span', `country-entry-status${hasRecord ? ' country-entry-status--recorded' : ''}`,
    hasRecord ? (COUNTRY_ENTRY_STATUS_LABELS[section.key] || ['Response linked'])[0] : 'Todo');
  const meta = [row.popupSection ? (row.popupSection === 'mps' ? 'MP' : 'Party / parliamentary group') : '', row.category, row.city, row.role, section.key === 'mps' ? row.party : '', row.priority ? `${row.priority} priority` : '', row.part_of ? `Part of: ${resolveActorName(row.part_of)}` : ''].filter(Boolean);
  const summaryNodes = [heading, status];
  if (meta.length) summaryNodes.push(countryElement('small', 'country-popup-entry-meta', meta.join(' · ')));
  const content = countryReportEntry(row, section, true);
  if (extra) content.append(extra);
  const details = countryDisclosure(summaryNodes, content, 'country-popup-entry');
  details.querySelector('summary').classList.add('country-popup-entry-summary');
  return details;
}
