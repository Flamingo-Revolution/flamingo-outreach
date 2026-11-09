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
    ...COUNTRY_SECTIONS.filter(section => !['mps', 'parties', 'actors', 'politicians'].includes(section.key)),
    { key: 'parliament', title: 'MPs & parliamentary groups', name: 'popupName', evidence: 'response_link' },
    ...COUNTRY_SECTIONS.filter(section => ['politicians', 'actors'].includes(section.key))
  ];
}

function countryPopupEntries(country, key) {
  if (key !== 'parliament') return country.entries[key] || [];
  return COUNTRY_SECTIONS.filter(section => ['mps', 'parties'].includes(section.key)).flatMap(section =>
    (country.entries[section.key] || []).map(row => ({ ...row, popupName: row[section.name], popupSection: section.key }))
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
  const viewToggle = countryElement('button', 'country-popup-view-toggle', 'Show simple');
  viewToggle.type = 'button';
  viewToggle.setAttribute('aria-controls', 'country-popup-body');
  const headerActions = countryElement('div', 'country-popup-header-actions');
  headerActions.append(viewToggle, close);
  header.append(headerActions);
  resultsRow.append(results, reset);
  results.setAttribute('role', 'status');
  const body = countryElement('div', 'country-popup-body');
  body.id = 'country-popup-body';
  body.setAttribute('role', 'region');
  body.setAttribute('aria-label', 'Outreach groups');
  body.tabIndex = 0;
  const footer = countryElement('p', 'outreach-note country-popup-footer', 'Done = a source link is recorded. Todo = no link in this tracker. Responses do not imply support.');
  const actions = countryElement('div', 'country-popup-actions');
  const editLink = countryElement('a', 'md-button country-popup-edit-link', 'Edit the shared Excel workbook ↗');
  editLink.href = 'https://docs.google.com/spreadsheets/d/19qp5A7qB5DwoKEF6WlYKy_GSWNOxTgMX/edit?usp=sharing';
  editLink.target = '_blank';
  editLink.rel = 'noopener noreferrer';
  actions.append(editLink);
  panel.append(header, summary, filterDisclosure, resultsRow, body, footer, actions);
  dialog.append(panel);
  host.append(dialog);
  const sections = countryPopupSections();
  let current, trigger = null, simple = false;
  const openGroups = new Map();

  const render = () => {
    [...body.childNodes].forEach(group => {
      if (group.dataset?.groupKey) openGroups.set(group.dataset.groupKey, group.open);
    });
    viewToggle.textContent = simple ? 'Show details' : 'Show simple';
    viewToggle.setAttribute('aria-pressed', String(simple));
    footer.hidden = simple;
    const query = search.value.trim().toLowerCase();
    const allEntries = sections.flatMap(section => countryPopupEntries(current, section.key).map(row => ({ row, section })));
    const done = allEntries.filter(({ row, section }) => outreachUrls(row[section.evidence]).length > 0).length;
    statusOptions.forEach(({ input, count, value }) => {
      input.checked = value === statusFilter;
      count.textContent = value === 'recorded' ? done : value === 'missing' ? allEntries.length - done : allEntries.length;
    });
    reset.disabled = !query && !statusFilter && sort.value === 'name';
    filterState.textContent = [query ? 'Search active' : '', statusFilter === 'recorded' ? 'Done' : statusFilter === 'missing' ? 'Todo' : '', sort.value !== 'name' ? 'Sorted' : ''].filter(Boolean).join(' · ') || 'All entries';
    body.replaceChildren();
    let matched = 0;
    sections.forEach(section => {
      const entries = countryPopupEntries(current, section.key);
      const visible = entries.filter(row => {
        const recorded = outreachUrls(row[section.evidence]).length > 0;
        return (!statusFilter || (statusFilter === 'recorded' ? recorded : !recorded)) &&
          (!query || Object.values(row).some(value => String(value).toLowerCase().includes(query)));
      }).sort((a, b) => compareCountryEntries(a, b, section, sort.value));
      matched += visible.length;
      const content = countryElement('div', 'country-popup-group-content');
      if (!visible.length) {
        content.append(countryElement('p', 'country-empty', entries.length ? 'No entries match your filters.' : 'No entries recorded yet.'));
      } else if (simple) {
        const list = countryElement('ul', 'country-link-list');
        visible.forEach(row => {
          const type = row.popupSection ? COUNTRY_SECTIONS.find(item => item.key === row.popupSection) : section;
          list.append(countryEntryLinkList(row, type, 'li'));
        });
        content.append(list);
      } else {
        const blocks = visible.map(row => countryEntryDisclosure(row, section, null, true));
        content.append(...blocks);
        countryDisclosureAccordion(blocks);
      }
      const group = countryDisclosure([
        countryElement('strong', '', section.title),
        countryElement('span', 'country-popup-group-count', String(visible.length))
      ], content, 'country-popup-group');
      group.dataset.groupKey = section.key;
      group.open = query || statusFilter ? visible.length > 0 : Boolean(openGroups.get(section.key));
      body.append(group);
    });
    results.textContent = matched + ' of ' + allEntries.length + ' entries';
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
  viewToggle.addEventListener('click', () => {
    simple = !simple;
    render();
  });


  return {
    open(item, section = 'media', opener = document.activeElement, simpleView = true) {
      current = item;
      simple = simpleView;
      const requestedSection = ['mps', 'parties'].includes(section) ? 'parliament' : section;
      openGroups.clear();
      openGroups.set(requestedSection, true);
      body.replaceChildren();
      trigger = opener;
      title.textContent = item.country;
      summary.textContent = `${item.total} listed entries · ${item.recorded} with linked coverage or responses`;
      search.value = ''; statusFilter = '';
      filterDisclosure.open = false;
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
