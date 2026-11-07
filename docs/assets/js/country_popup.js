function countryEntryLatestDate(row, section) {
  const values = (section.key === 'media' ? row.dates : row.response_date) || '';
  return values.split(';').reduce((latest, value) => {
    const date = countryReportDate(value.trim());
    const timestamp = /^\d{4}-\d{2}-\d{2}/.test(date) ? Date.parse(date) : NaN;
    return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
  }, 0);
}

function compareCountryEntries(a, b, section, order) {
  const linked = row => Number(outreachUrls(row[section.evidence]).length > 0);
  const byName = () => a[section.name].localeCompare(b[section.name]);
  if (order === 'recorded') return linked(b) - linked(a) || byName();
  if (order === 'missing') return linked(a) - linked(b) || byName();
  if (order === 'newest') return countryEntryLatestDate(b, section) - countryEntryLatestDate(a, section) || byName();
  return order === 'name-desc' ? -byName() : byName();
}

function countryPopupSections() {
  return [
    ...COUNTRY_SECTIONS.filter(section => !['mps', 'parties'].includes(section.key)),
    { key: 'parliament', title: 'MPs & parliamentary groups', name: 'popupName', evidence: 'response_link' }
  ];
}

function countryPopupEntries(country, key) {
  if (key !== 'parliament') return country.entries[key];
  return COUNTRY_SECTIONS.filter(section => ['mps', 'parties'].includes(section.key)).flatMap(section =>
    country.entries[section.key].map(row => ({ ...row, popupName: row[section.name], popupSection: section.key }))
  );
}

/* Country details stay over the map, like the Flamingo Map city dialog. */
function createCountryPopup(host) {
  const dialog = countryElement('dialog', 'country-popup');
  dialog.setAttribute('aria-labelledby', 'country-popup-title');
  const panel = countryElement('section', 'country-popup-panel');
  panel.append(countryElement('div', 'country-popup-handle'));
  const header = countryElement('header', 'country-popup-header');
  const heading = countryElement('div');
  heading.append(countryElement('p', 'country-popup-eyebrow', 'Country outreach'));
  const title = countryElement('h2', '', 'Country');
  title.id = 'country-popup-title';
  heading.append(title);
  const close = countryElement('button', 'country-popup-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close country details');
  header.append(heading, close);
  const summary = countryElement('p', 'outreach-summary');
  const tabs = countryElement('div', 'country-metrics country-popup-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Country information');
  const filterDisclosure = countryElement('details', 'status-disclosure country-popup-filter-disclosure');
  const filterSummary = countryElement('summary', 'status-disclosure-summary country-popup-filter-summary');
  const filterState = countryElement('span', 'status-disclosure-state country-popup-filter-state', 'All entries');
  filterSummary.append(countryElement('span', '', 'Search & filters'), filterState);
  const controls = countryElement('div', 'outreach-toolbar country-popup-controls');
  filterDisclosure.append(filterSummary, controls);
  const searchLabel = countryElement('label', '', 'Find an entry');
  searchLabel.htmlFor = 'country-popup-search';
  const search = countryElement('input');
  search.id = 'country-popup-search'; search.type = 'search'; search.placeholder = 'Name, issue or city';
  let statusFilter = '';
  const statusGroup = countryElement('fieldset', 'country-popup-status-filters');
  statusGroup.append(countryElement('legend', '', 'Source link status'));
  const statusOptions = [['', 'All'], ['recorded', 'Done'], ['missing', 'Todo']].map(([value, text]) => {
    const label = countryElement('label', 'country-popup-status-option');
    const input = countryElement('input');
    input.type = 'radio'; input.name = 'country-popup-status'; input.value = value;
    input.checked = value === '';
    const caption = countryElement('span', 'country-popup-status-caption');
    const count = countryElement('span', 'country-popup-status-count');
    caption.append(countryElement('span', '', text), count);
    label.append(input, caption);
    statusGroup.append(label);
    input.addEventListener('change', () => { statusFilter = input.value; render(); });
    return { input, count, value };
  });
  const sortLabel = countryElement('label', '', 'Sort by');
  sortLabel.htmlFor = 'country-popup-sort';
  const sort = countryElement('select');
  sort.id = 'country-popup-sort';
  [['name', 'Name A–Z'], ['name-desc', 'Name Z–A'], ['recorded', 'Done first'], ['missing', 'Todo first'], ['newest', 'Newest dated activity']].forEach(([value, text]) => {
    const option = countryElement('option', '', text); option.value = value; sort.append(option);
  });
  [[searchLabel, search], [sortLabel, sort]].forEach(([label, input]) => {
    const field = countryElement('div', 'country-popup-field');
    field.append(label, input);
    controls.append(field);
  });
  controls.append(statusGroup);
  const reset = countryElement('button', 'country-popup-reset', 'Reset filters');
  reset.type = 'button';
  const resultsRow = countryElement('div', 'country-popup-results-row');
  const results = countryElement('p', 'outreach-summary country-popup-results');
  resultsRow.append(results, reset);
  results.setAttribute('role', 'status');
  const body = countryElement('div', 'country-popup-body');
  body.id = 'country-popup-body';
  body.setAttribute('role', 'tabpanel');
  body.tabIndex = 0;
  const footer = countryElement('p', 'outreach-note country-popup-footer', 'Done = a source link is recorded. Todo = no link in this tracker. Responses do not imply support.');
  panel.append(header, summary, tabs, filterDisclosure, resultsRow, body, footer);
  dialog.append(panel);
  host.append(dialog);
  const sections = countryPopupSections();
  let current, activeSection = 'media', trigger = null;

  const render = () => {
    const section = sections.find(item => item.key === activeSection);
    const entries = countryPopupEntries(current, activeSection);
    const query = search.value.trim().toLowerCase();
    const visible = entries.filter(row => {
      const recorded = outreachUrls(row[section.evidence]).length > 0;
      return (!statusFilter || (statusFilter === 'recorded' ? recorded : !recorded)) &&
        (!query || Object.values(row).some(value => String(value).toLowerCase().includes(query)));
    }).sort((a, b) => compareCountryEntries(a, b, section, sort.value));
    tabs.querySelectorAll('button').forEach(button => {
      const active = button.dataset.section === activeSection;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    const done = entries.filter(row => outreachUrls(row[section.evidence]).length > 0).length;
    statusOptions.forEach(({ input, count, value }) => {
      input.checked = value === statusFilter;
      count.textContent = value === 'recorded' ? done : value === 'missing' ? entries.length - done : entries.length;
    });
    reset.disabled = !query && !statusFilter && sort.value === 'name';
    filterState.textContent = [query ? 'Search active' : '', statusFilter === 'recorded' ? 'Done' : statusFilter === 'missing' ? 'Todo' : '', sort.value !== 'name' ? 'Sorted' : ''].filter(Boolean).join(' · ') || 'All entries';
    body.setAttribute('aria-labelledby', `country-popup-tab-${activeSection}`);
    results.textContent = `${section.title} · ${visible.length} of ${entries.length} entries`;
    body.replaceChildren();
    if (!entries.length) {
      body.append(countryElement('p', 'country-empty', `No ${section.title.toLowerCase()} are recorded for ${current.country} yet.`));
    } else if (!visible.length) body.append(countryElement('p', 'country-empty', 'No matches. Try another name, choose All, or reset the filters.'));
    else {
      const blocks = visible.map(row => countryEntryDisclosure(row, section));
      body.replaceChildren(...blocks);
      countryDisclosureAccordion(blocks);
    }
    body.scrollTop = 0;
  };

  const onClose = () => {
    document.body.classList.remove('country-popup-open');
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  };
  dialog.addEventListener('close', onClose);
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
    }
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  search.addEventListener('input', render);
  reset.addEventListener('click', () => {
    search.value = ''; statusFilter = ''; sort.value = 'name';
    render();
    search.focus({ preventScroll: true });
  });
  sort.addEventListener('change', render);
  tabs.addEventListener('keydown', event => {
    const buttons = [...tabs.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0 || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].click();
    buttons[next].focus();
  });

  return {
    open(item, section = 'media', opener = document.activeElement) {
      current = item;
      const requestedSection = ['mps', 'parties'].includes(section) ? 'parliament' : section;
      activeSection = sections.some(value => value.key === requestedSection) ? requestedSection : 'media';
      trigger = opener;
      title.textContent = item.country;
      summary.textContent = `${item.total} listed entries · ${item.recorded} with linked coverage or responses`;
      search.value = ''; statusFilter = '';
      filterDisclosure.open = false;
      tabs.replaceChildren();
      sections.forEach(config => {
        const entries = countryPopupEntries(item, config.key);
        const stat = { total: entries.length, recorded: entries.filter(row => outreachUrls(row[config.evidence]).length > 0).length };
        const button = countryElement('button', 'country-metric');
        button.type = 'button';
        button.id = `country-popup-tab-${config.key}`;
        button.dataset.section = config.key;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', body.id);
        button.append(countryElement('span', '', config.title), countryElement('strong', '', String(stat.total)));
        button.setAttribute('aria-label', `${config.title}: ${stat.total} entries, ${stat.recorded} with source links`);
        button.addEventListener('click', () => { activeSection = config.key; render(); });
        tabs.append(button);
      });
      render();
      if (!dialog.open) dialog.showModal();
      document.body.classList.add('country-popup-open');
      close.focus({ preventScroll: true });
    },
    destroy() {
      if (dialog.open) dialog.close();
      document.body.classList.remove('country-popup-open');
      dialog.remove();
    }
  };
}
