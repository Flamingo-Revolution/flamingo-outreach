let outreachMapState = null;

const outreachCapitalCenters = {
  Argentina: [-34.6037, -58.3816],
  Chile: [-33.4489, -70.6693],
  Albania: [41.3275, 19.8187],
  Andorra: [42.5063, 1.5218],
  Armenia: [40.1872, 44.5152],
  Australia: [-35.2809, 149.13],
  Austria: [48.2082, 16.3738],
  Azerbaijan: [40.4093, 49.8671],
  Belarus: [53.9006, 27.559],
  Belgium: [50.8503, 4.3517],
  'Bosnia and Herzegovina': [43.8563, 18.4131],
  Brazil: [-15.7939, -47.8828],
  Bulgaria: [42.6977, 23.3219],
  Canada: [45.4215, -75.6972],
  China: [39.9042, 116.4074],
  Croatia: [45.815, 15.9819],
  Cyprus: [35.1856, 33.3823],
  Czechia: [50.0755, 14.4378],
  Denmark: [55.6761, 12.5683],
  Estonia: [59.437, 24.7536],
  'European / International': [50.8503, 4.3517],
  'European Parliament': [48.5734, 7.7521],
  'European Union': [50.8503, 4.3517],
  Finland: [60.1699, 24.9384],
  France: [48.8566, 2.3522],
  Georgia: [41.7151, 44.8271],
  Germany: [52.52, 13.405],
  Greece: [37.9838, 23.7275],
  Hungary: [47.4979, 19.0402],
  Iceland: [64.1466, -21.9426],
  India: [28.6139, 77.209],
  International: [46.2044, 6.1432],
  Ireland: [53.3498, -6.2603],
  Italy: [41.9028, 12.4964],
  Japan: [35.6762, 139.6503],
  Kosovo: [42.6629, 21.1655],
  Latvia: [56.9496, 24.1052],
  Liechtenstein: [47.141, 9.5209],
  Lithuania: [54.6872, 25.2797],
  Luxembourg: [49.6116, 6.1319],
  Malta: [35.8997, 14.5146],
  Moldova: [47.0105, 28.8638],
  Monaco: [43.7384, 7.4246],
  Montenegro: [42.4304, 19.2594],
  Netherlands: [52.3676, 4.9041],
  'New Zealand': [-41.2865, 174.7762],
  'North Macedonia': [41.9981, 21.4254],
  Norway: [59.9139, 10.7522],
  Poland: [52.2297, 21.0122],
  Portugal: [38.7223, -9.1393],
  Romania: [44.4268, 26.1025],
  Russia: [55.7558, 37.6173],
  'San Marino': [43.9424, 12.4578],
  'Saudi Arabia': [24.7136, 46.6753],
  Serbia: [44.7866, 20.4489],
  Slovakia: [48.1486, 17.1077],
  Slovenia: [46.0569, 14.5058],
  'South Africa': [-25.7479, 28.2293],
  Spain: [40.4168, -3.7038],
  Sweden: [59.3293, 18.0686],
  Switzerland: [46.948, 7.4474],
  Turkey: [39.9334, 32.8597],
  UAE: [24.4539, 54.3773],
  Ukraine: [50.4501, 30.5234],
  'United Kingdom': [51.5072, -0.1276],
  'United States': [38.9072, -77.0369],
  'Vatican City': [41.9029, 12.4534]
};

function outreachMapColor(item, category) {
  const stat = category === 'all' ? item : item?.stats[category];
  if (!stat?.total) return '#a3abb4';
  const share = stat.recorded / stat.total;
  return share > .75 ? '#277f73' : share > .5 ? '#73a787' : share > .25 ? '#ca8c36' : '#c45b64';
}

function outreachMarkerSize(total, mode) {
  if (mode === 'numbers') return 48;
  if (mode === 'percentage') return 38;
  return total ? Math.min(58, 26 + Math.sqrt(total) * 6) : 22;
}

function outreachMarkerLabel({ total, recorded }, mode) {
  if (!total) return '—';
  if (mode === 'percentage') return Math.round(recorded / total * 100) + '%';
  if (mode === 'numbers') return recorded + '/' + total;
  return String(recorded);
}

function outreachCountryStats(countries, category = 'all') {
  const pinned = ['European Union', 'United States', 'International'];
  const rank = country => pinned.includes(country) ? pinned.indexOf(country) : pinned.length;
  return countries.map(item => {
    const stat = category === 'all' ? item : item.stats[category];
    const total = stat?.total || 0;
    const recorded = stat?.recorded || 0;
    return { country: item.country, total, recorded, missing: total - recorded, percent: total ? Math.round(recorded / total * 100) : null };
  }).sort((a, b) => rank(a.country) - rank(b.country) || a.country.localeCompare(b.country));
}

async function setupOutreachMap() {
  const root = document.getElementById('outreach-overview');
  if (outreachMapState && outreachMapState.root !== root) {
    outreachMapState.cleanup();
    outreachMapState = null;
  }
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';
  const summary = document.getElementById('outreach-summary');
  const category = document.getElementById('outreach-layer');
  const display = document.getElementById('outreach-display');
  const quickSearch = document.getElementById('outreach-country-search');
  const quickResults = document.getElementById('outreach-country-search-results');
  const shell = root.querySelector('.outreach-map-shell');
  const popup = createCountryPopup(shell);
  let map, capitalLayer, resizeObserver, themeObserver;
  let disposed = false;
  let countries = [];
  let selectedName = '';
  const centers = new Map();
  const sidebarCleanups = [];
  const state = { root, cleanup() {
    disposed = true;
    sidebarCleanups.forEach(cleanup => cleanup());
    resizeObserver?.disconnect();
    themeObserver?.disconnect();
    popup.destroy();
    map?.remove();
  } };
  outreachMapState = state;

  const markerData = item => {
    const categoryKey = category?.value || 'all';
    const stat = categoryKey === 'all' ? item : item.stats[categoryKey];
    const total = stat.total || 0;
    const recorded = stat.recorded || 0;
    const missing = Math.max(0, total - recorded);
    const size = outreachMarkerSize(total, display?.value || 'done-todo');
    return { total, recorded, missing, size, color: outreachMapColor(item, categoryKey) };
  };

  const capitalMarkerIcon = item => {
    const data = markerData(item);
    const mode = display?.value || 'done-todo';
    const label = outreachMarkerLabel(data, mode);
    const missing = mode === 'done-todo' && data.missing ? `<sup>+${data.missing}</sup>` : '';
    const selected = item.country === selectedName ? ' is-selected' : '';
    return L.divIcon({
      className: `outreach-capital-marker-icon${selected}`,
      html: `<span class="outreach-capital-marker" style="--marker-size:${data.size}px;--marker-color:${data.color}"><span>${label}${missing}</span></span>`,
      iconSize: [data.size + 12, data.size + 12],
      iconAnchor: [(data.size + 12) / 2, (data.size + 12) / 2]
    });
  };

  const renderCapitalMarkers = () => {
    if (!map || !capitalLayer) return;
    capitalLayer.clearLayers();
    countries.forEach(item => {
      const center = centers.get(item.country);
      if (!center) return;
      const data = markerData(item);
      const description = `${item.country}: ${data.recorded} of ${data.total} entries with linked coverage or responses`;
      L.marker(center, { icon: capitalMarkerIcon(item), keyboard: true, title: description, alt: description, zIndexOffset: item.country === selectedName ? 1000 : 0 })
        .bindTooltip(description, { sticky: true })
        .on('click', () => choose(item.country, false))
        .addTo(capitalLayer);
    });
  };

  const choose = (name, pan = true, section = '', trigger = document.activeElement) => {
    const item = countries.find(country => country.country === name);
    if (!item) return;
    selectedName = name;
    if (pan && map && centers.has(name)) map.setView(centers.get(name), Math.max(map.getZoom(), 5));
    renderCapitalMarkers();
    popup.open(item, section, trigger?.isConnected && trigger !== document.body ? trigger : quickSearch || shell, new URL(location.href).searchParams.get('view') !== 'detailed');
  };

  const renderQuickResults = () => {
    if (!quickSearch || !quickResults) return;
    const query = quickSearch.value.trim().toLowerCase();
    const matches = countries
      .filter(item => !query || item.country.toLowerCase().includes(query))
      .sort((a, b) => Number(b.country === selectedName) - Number(a.country === selectedName) || a.country.localeCompare(b.country))
      .slice(0, 8);
    quickResults.replaceChildren(...matches.map((item, index) => {
      const option = countryElement('li', 'outreach-country-search-result');
      option.id = `outreach-country-search-result-${index}`;
      option.setAttribute('role', 'option');
      option.dataset.country = item.country;
      option.append(
        countryElement('span', 'outreach-country-search-result-name', item.country),
        countryElement('span', 'outreach-country-search-result-meta', `${item.recorded}/${item.total} linked entries`)
      );
      return option;
    }));
    quickResults.hidden = !matches.length;
    quickSearch.setAttribute('aria-expanded', String(matches.length > 0));
  };

  const closeQuickResults = () => {
    if (!quickSearch || !quickResults) return;
    quickResults.hidden = true;
    quickSearch.setAttribute('aria-expanded', 'false');
    quickSearch.removeAttribute('aria-activedescendant');
  };

  const selectQuickResult = item => {
    if (!quickSearch || !item) return;
    quickSearch.value = item.country;
    closeQuickResults();
    choose(item.country, true, '', quickSearch);
  };

  let activeResult = -1;
  quickSearch?.addEventListener('input', () => { activeResult = -1; renderQuickResults(); });
  quickSearch?.addEventListener('focus', renderQuickResults);
  quickSearch?.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeQuickResults(); return; }
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
    if (quickResults.hidden && event.key !== 'Enter') renderQuickResults();
    const options = [...quickResults.children];
    if (!options.length || quickResults.hidden) return;
    event.preventDefault();
    if (event.key === 'Enter') {
      const option = options[Math.max(0, activeResult)];
      selectQuickResult(countries.find(item => item.country === option.dataset.country));
      return;
    }
    activeResult = (activeResult + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options.forEach((option, index) => option.setAttribute('aria-selected', String(index === activeResult)));
    quickSearch.setAttribute('aria-activedescendant', options[activeResult].id);
    options[activeResult].scrollIntoView({ block: 'nearest' });
  });
  quickResults?.addEventListener('mousedown', event => event.preventDefault());
  quickResults?.addEventListener('click', event => {
    const option = event.target.closest('[data-country]');
    if (option) selectQuickResult(countries.find(item => item.country === option.dataset.country));
  });
  quickSearch?.addEventListener('blur', closeQuickResults);

  const renderStats = () => {
    const activeCategory = category?.value || 'all';
    const categoryLabel = document.getElementById('outreach-stats-category');
    if (categoryLabel) categoryLabel.textContent = category?.selectedOptions?.[0]?.textContent || 'All categories';
    const total = countries.reduce((sum, item) => sum + markerData(item).total, 0);
    const recorded = countries.reduce((sum, item) => sum + markerData(item).recorded, 0);
    const setText = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value.toLocaleString();
    };
    setText('outreach-stat-countries', countries.length);
    setText('outreach-stat-total', total);
    setText('outreach-stat-recorded', recorded);
    setText('outreach-stat-missing', total - recorded);
    const percent = total ? Math.round(recorded / total * 100) : 0;
    const progress = document.getElementById('outreach-completion');
    if (progress) progress.value = percent;
    const completionLabel = document.getElementById('outreach-completion-label');
    if (completionLabel) completionLabel.textContent = `${recorded} / ${total}`;
    const countryStats = document.getElementById('outreach-country-stats-body');
    if (countryStats) {
      const query = (document.getElementById('outreach-stats-search')?.value || '').trim().toLowerCase();
      const rows = outreachCountryStats(countries, activeCategory).filter(stat => stat.country.toLowerCase().includes(query));
      countryStats.replaceChildren();
      const allies = ['European Union', 'United States', 'International'];
      const makeRow = stat => {
        const row = countryElement('li', 'outreach-country-stat');
        const link = countryElement('a', '', stat.country);
        link.title = stat.country;
        link.href = outreachCountryPopupUrl(stat.country);
        link.addEventListener('click', event => {
          event.preventDefault();
          choose(stat.country, true, activeCategory === 'all' ? '' : activeCategory, link);
        });
        const level = stat.percent === null ? 'empty' : stat.percent > 75 ? 'high' : stat.percent > 50 ? 'medium' : stat.percent > 25 ? 'low' : 'start';
        const count = countryElement('strong', `outreach-country-stat-ratio outreach-country-stat-ratio--${level}`, `${stat.recorded} / ${stat.total}`);
        count.setAttribute('aria-label', `${stat.recorded} of ${stat.total} done`);
        if (!stat.total) count.title = 'No entries yet';
        row.append(link, count);
        return row;
      };
      [['Allies', true], ['Countries & groups', false]].forEach(([title, isAllies]) => {
        const entries = rows.filter(stat => allies.includes(stat.country) === isAllies);
        if (!entries.length) return;
        const group = countryElement('section', 'outreach-stats-group');
        group.append(countryElement('h2', '', title));
        const list = countryElement('ul', 'outreach-country-stats-list');
        list.append(...entries.map(makeRow));
        group.append(list);
        countryStats.append(group);
      });
      if (!rows.length) countryStats.append(countryElement('p', 'outreach-country-stats-empty', 'No countries found.'));
    }
  };
  document.getElementById('outreach-stats-search')?.addEventListener('input', renderStats);

  const sidebarTabs = [...root.querySelectorAll('.outreach-panel-tabs [role="tab"]')];
  const selectSidebarTab = selected => {
    sidebarTabs.forEach(tab => {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    });
  };
  sidebarTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectSidebarTab(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? sidebarTabs.length - 1 :
        (index + (event.key === 'ArrowRight' ? 1 : -1) + sidebarTabs.length) % sidebarTabs.length;
      selectSidebarTab(sidebarTabs[next]);
      sidebarTabs[next].focus();
    });
  });

  const setupSidebarToggle = () => {
    const button = document.getElementById('outreach-left-toggle');
    const panel = document.getElementById('outreach-left-panel');
    const close = document.getElementById('outreach-panel-close');
    const backdrop = document.getElementById('outreach-panel-backdrop');
    if (!button || !panel) return;
    const mq = matchMedia('(max-width: 58rem)');
    let open = !mq.matches;
    const sync = () => {
      root.classList.toggle('is-left-open', open);
      root.classList.toggle('is-left-closed', !open);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Collapse map controls' : 'Open map controls');
      button.title = open ? 'Collapse map controls' : 'Open map controls';
      panel.inert = !open;
      panel.setAttribute('aria-hidden', String(!open));
      if (backdrop) backdrop.hidden = !(open && mq.matches);
    };
    const dismiss = () => { open = false; sync(); button.focus(); };
    button.addEventListener('click', () => {
      open = !open;
      sync();
      if (open) close?.focus({ preventScroll: true });
    });
    close?.addEventListener('click', dismiss);
    backdrop?.addEventListener('click', dismiss);
    const escape = event => {
      if (event.key === 'Escape' && open && !document.querySelector('.country-popup[open]')) {
        dismiss();
      }
    };
    root.addEventListener('keydown', escape);
    const breakpointChanged = () => { open = !mq.matches; sync(); };
    mq.addEventListener?.('change', breakpointChanged);
    sidebarCleanups.push(() => mq.removeEventListener?.('change', breakpointChanged));
    sync();
  };
  setupSidebarToggle();

  display?.addEventListener('change', () => {
    const descriptions = {
      percentage: '60% means 6 of 10 entries are done.',
      numbers: '6/10 means 6 done out of 10 entries.',
      'done-todo': '6⁺⁴ means 6 done and 4 to do. Bigger markers mean more entries.'
    };
    const description = document.getElementById('outreach-marker-description');
    if (description) description.textContent = descriptions[display.value];
    renderCapitalMarkers();
  });
  category?.addEventListener('change', () => {
    renderCapitalMarkers();
    renderStats();
    closeQuickResults();
  });
  document.getElementById('outreach-reset')?.addEventListener('click', () => map?.setView([49, 12], 4));
  try {
    countries = await loadOutreachCountries();
    if (disposed || !root.isConnected) return;
    const nouns = { media: 'media outlets', institutions: 'institutions', mps: 'MPs', parties: 'parties / groups', actors: 'actors / civil society' };
    const totals = COUNTRY_SECTIONS.map(section => ({
      key: section.key,
      total: countries.reduce((sum, item) => sum + item.stats[section.key].total, 0),
      label: nouns[section.key]
    }));
    if (summary) summary.textContent = `${countries.length} countries & groups · ${totals.filter(item => item.total > 0).map(item => `${item.total} ${item.label}`).join(' · ')}`;
    totals.forEach(item => {
      const option = category?.querySelector(`option[value="${item.key}"]`);
      if (option) option.hidden = item.total === 0;
    });
    renderStats();
    const requested = new URL(location.href).searchParams.get('country');
    if (typeof setupOutreachActivity === 'function') {
      setupOutreachActivity(root, countries).catch(() => {
        const status = root.querySelector('#outreach-activity-status');
        if (status) status.textContent = 'Activity could not load. Reload to try again.';
      });
    }
    if (typeof L === 'undefined') {
      document.getElementById('outreach-map').textContent = 'The map could not load. Use the country search to open details.';
      if (requested) choose(outreachCountryName(requested), false);
      return;
    }
    map = L.map('outreach-map', { center: [49, 12], zoom: 4, minZoom: 2, maxZoom: 10, zoomControl: false, scrollWheelZoom: true, worldCopyJump: true });
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    map.attributionControl.setPosition('bottomleft');
    // On mobile this collapses to a small "i" button (see CSS); tapping it
    // reveals the attribution text instead of it taking up space by default.
    const attribution = map.attributionControl.getContainer();
    attribution?.classList.add('outreach-attribution');
    attribution?.addEventListener('click', () => attribution.classList.toggle('is-open'));
    const tiles = L.tileLayer(statusTileUrl(), { attribution: 'Esri, HERE, Garmin, © OpenStreetMap contributors', maxZoom: 16 }).addTo(map);
    capitalLayer = L.layerGroup().addTo(map);
    resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(shell);
    themeObserver = new MutationObserver(() => tiles.setUrl(statusTileUrl()));
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-md-color-scheme'] });
    countries.forEach(item => {
      if (outreachCapitalCenters[item.country]) centers.set(item.country, outreachCapitalCenters[item.country]);
    });
    renderCapitalMarkers();
    if (requested) choose(outreachCountryName(requested));
  } catch (_) {
    if (disposed) return;
    if (summary) summary.textContent = 'Unable to load country data. Reload to try again.';
  }
}

document.addEventListener('DOMContentLoaded', setupOutreachMap);
if (typeof document$ !== 'undefined') document$.subscribe(setupOutreachMap);
