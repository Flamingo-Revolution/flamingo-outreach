/*
 * Shared template for "Status" pages: a country choropleth map paired with a
 * sortable, filterable, searchable directory list grouped by country.
 * Institutions and Parties configure this engine instead of duplicating it.
 */

function statusCountryId(prefix, country) {
  return `${prefix}-country-${country.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function statusTileUrl() {
  const dark = document.body.getAttribute('data-md-color-scheme') === 'slate';
  const layer = dark ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base';
  return `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${layer}/MapServer/tile/{z}/{y}/{x}`;
}

function classifyStatusCountries(data, { nameField, groupKey, isResponded }) {
  const countries = new Map();
  data.forEach(entry => {
    if (!entry[nameField]) return;
    const country = entry.country || 'Unspecified';
    if (!countries.has(country)) countries.set(country, { country, [groupKey]: [], responded: 0 });
    const item = countries.get(country);
    item[groupKey].push(entry);
    if (isResponded(entry)) item.responded += 1;
  });
  return [...countries.values()].map(item => {
    const total = item[groupKey].length;
    const percent = total ? Math.round((item.responded / total) * 100) : 0;
    const level = percent > 75 ? 'green' : percent > 50 ? 'lightgreen' : percent > 25 ? 'orange' : 'red';
    return { ...item, percent, level, missing: total - item.responded };
  });
}

function sortStatusCountries(items, mode, groupKey) {
  return [...items].sort((a, b) => {
    if (mode === 'entries-high') return b[groupKey].length - a[groupKey].length || a.country.localeCompare(b.country);
    if (mode === 'alphabetical') return a.country.localeCompare(b.country);
    return a.percent - b.percent || b.missing - a.missing || a.country.localeCompare(b.country);
  });
}

function renderStatusMap(options) {
  const {
    state, mapId, legendId, countries, groupKey, levels, aliases = {},
    excludeCountry, countryIdPrefix, unitLabel, assetsBase
  } = options;
  const root = document.getElementById(mapId);
  const legend = document.getElementById(legendId);
  if (!root || typeof L === 'undefined') return;
  if (state.map) state.map.remove();

  state.map = L.map(root, { center: [46, 5], zoom: 3, minZoom: 2, maxZoom: 16, worldCopyJump: true });
  state.tiles = L.tileLayer(statusTileUrl(), {
    attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap contributors and the GIS user community',
    maxZoom: 16
  }).addTo(state.map);

  const mapped = excludeCountry ? countries.filter(item => !excludeCountry(item.country)) : countries;
  const byCountry = new Map(mapped.map(item => [item.country, item]));
  const labels = L.layerGroup();
  const updateLabels = () => {
    if (state.map.getZoom() >= 4) {
      if (!state.map.hasLayer(labels)) labels.addTo(state.map);
    } else if (state.map.hasLayer(labels)) {
      labels.removeFrom(state.map);
    }
  };
  state.map.on('zoomend', updateLabels);

  fetch(new URL('countries.geo.json', assetsBase))
    .then(response => response.json())
    .then(geojson => {
      L.geoJSON(geojson, {
        style: feature => {
          const item = byCountry.get(aliases[feature.properties.name] || feature.properties.name);
          return { fillColor: item ? levels[item.level].color : '#9aa3af', fillOpacity: item ? .75 : .12, color: '#fff', weight: .6 };
        },
        onEachFeature: (feature, layer) => {
          const name = aliases[feature.properties.name] || feature.properties.name;
          const item = byCountry.get(name);
          const total = item ? item[groupKey].length : 0;
          layer.bindTooltip(
            item ? `${name}: ${item.responded} of ${total} with response links (${item.percent}%)` : `${name}: no listed ${unitLabel}`,
            { sticky: true }
          );
          if (!item) return;

          const bounds = layer.getBounds();
          const latSpan = Math.max(0, bounds.getNorth() - bounds.getSouth());
          const lngSpan = Math.max(0, bounds.getEast() - bounds.getWest());
          const size = Math.min(.9, Math.max(.48, .48 + Math.sqrt(latSpan * lngSpan) * .03));
          const icon = L.divIcon({
            className: 'coverage-map-ratio-label',
            html: `<span style="--ratio-label-size:${size.toFixed(2)}rem">${item.responded}/${total}</span>`,
            iconSize: null
          });
          L.marker(bounds.getCenter(), { icon, interactive: false }).addTo(labels);

          const popup = document.createElement('div');
          popup.className = 'coverage-map-popup';
          const title = document.createElement('strong');
          title.className = 'coverage-map-popup__title';
          title.textContent = name;
          const ratio = document.createElement('span');
          ratio.className = 'coverage-map-popup__ratio';
          ratio.textContent = `${item.responded}/${total} ${unitLabel} with response links (${item.percent}%)`;
          popup.append(title, ratio);

          const open = document.createElement('a');
          open.className = 'coverage-map-popup__open-country';
          open.href = `#${statusCountryId(countryIdPrefix, name)}`;
          open.textContent = 'Open country list ↓';
          open.addEventListener('click', event => {
            event.preventDefault();
            const details = document.getElementById(statusCountryId(countryIdPrefix, name));
            if (!details) return;
            details.open = true;
            state.map.closePopup();
            details.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
          popup.append(open);

          layer.bindPopup(popup);
        }
      }).addTo(state.map);
      updateLabels();
    })
    .catch(() => root.setAttribute('aria-label', `${unitLabel} map unavailable`));

  if (legend) {
    legend.replaceChildren();
    Object.values(levels).forEach(meta => {
      const item = document.createElement('span');
      item.className = 'coverage-map-legend-item';
      item.style.setProperty('--status-color', meta.color);
      item.textContent = meta.label;
      legend.append(item);
    });
  }
}

function renderStatusDirectory(options) {
  const {
    data, sortMode, filterSummary, listId, summaryId, mapStatsIds, groupKey,
    nameField, isResponded, levels, countryIdPrefix, entrySort,
    summaryNoun, mapOptions, reportSectionKey
  } = options;

  const root = document.getElementById(listId);
  const summary = document.getElementById(summaryId);
  if (!root) return;

  const countries = sortStatusCountries(
    classifyStatusCountries(data, { nameField, groupKey, isResponded }),
    sortMode,
    groupKey
  );
  const responded = data.filter(isResponded).length;
  Object.entries(mapStatsIds(countries, data, responded)).forEach(([id, value]) => {
    const target = document.getElementById(id);
    if (target) target.textContent = value.toLocaleString();
  });

  root.replaceChildren();
  countries.forEach(item => {
    const entries = item[groupKey];

    const details = document.createElement('details');
    details.className = 'status-disclosure';
    details.id = statusCountryId(countryIdPrefix, item.country);

    const heading = document.createElement('summary');
    heading.className = 'status-disclosure-summary';
    const content = document.createElement('div');
    content.className = 'coverage-priority-content';
    const titleRow = document.createElement('div');
    titleRow.className = 'coverage-priority-heading';
    const title = document.createElement('strong');
    title.className = 'coverage-country-name';
    title.textContent = item.country;
    const count = document.createElement('span');
    count.className = 'coverage-priority-percentage';
    count.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} · ${item.responded} with response links`;
    titleRow.append(title, count);
    content.append(titleRow);
    heading.append(content);

    const list = document.createElement('div');
    list.className = 'status-entry-list';
    const section = COUNTRY_SECTIONS.find(item => item.key === reportSectionKey);
    const blocks = [...entries].sort(entrySort).map(entry => countryEntryDisclosure(entry, section));
    list.replaceChildren(...blocks);
    countryDisclosureAccordion(blocks);

    details.append(heading, list);
    root.append(details);
  });

  countryDisclosureAccordion([...root.children]);
  if (!countries.length) {
    const empty = document.createElement('p');
    empty.className = 'coverage-priority-loading';
    empty.textContent = 'No entries match. Change your search or reset the filters.';
    root.append(empty);
  }
  if (summary) {
    summary.textContent = `${countries.length} countries · ${data.length} ${summaryNoun}${filterSummary ? ` · ${filterSummary}` : ''}`;
  }
  renderStatusMap({ ...mapOptions, countries, groupKey, levels, countryIdPrefix });
}

function setupStatusPage(options) {
  const {
    csvFile, assetsBase, listId, sortId, searchId, filters = [],
    searchMatch, buildFilterSummary, render
  } = options;

  const root = document.getElementById(listId);
  const sort = sortId ? document.getElementById(sortId) : null;
  const search = searchId ? document.getElementById(searchId) : null;
  const filterSelects = filters.map(filter => ({ ...filter, select: document.getElementById(filter.selectId) }));
  if (!root || root.dataset.statusReady) return;
  root.dataset.statusReady = '1';

  fetch(new URL(csvFile, assetsBase))
    .then(response => {
      if (!response.ok) throw Error(response.status);
      return response.text();
    })
    .then(text => {
      const data = csvRows(text);

      filterSelects.forEach(filter => {
        filter.options(data).forEach(value => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          filter.select?.append(option);
        });
      });

      const update = () => {
        const activeValues = filterSelects.map(filter => filter.select?.value || '');
        const query = (search?.value || '').trim().toLowerCase();
        const filtered = data.filter(entry => {
          const matchesFilters = filterSelects.every((filter, index) => !activeValues[index] || filter.match(entry, activeValues[index]));
          const matchesSearch = !query || searchMatch(entry, query);
          return matchesFilters && matchesSearch;
        });
        render(filtered, sort?.value, buildFilterSummary(activeValues, query));
      };

      update();
      sort?.addEventListener('change', update);
      search?.addEventListener('input', update);
      filterSelects.forEach(filter => filter.select?.addEventListener('change', update));
    })
    .catch(() => {
      root.innerHTML = `<p class="coverage-priority-loading">Unable to load this directory. Reload to try again, or open the country map.</p>`;
    });
}
