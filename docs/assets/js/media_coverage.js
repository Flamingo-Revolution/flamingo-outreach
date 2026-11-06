const coverageAssetsBase = new URL('../data/', document.currentScript.src);

const LEVEL_META = {
  green: { label: '76–100% of outlets', color: '#2e7d32' },
  lightgreen: { label: '51–75% of outlets', color: '#7cb342' },
  orange: { label: '26–50% of outlets', color: '#f57c00' },
  red: { label: '0–25% of outlets', color: '#c62828' }
};

function classifyCountries(data) {
  const countries = new Map();

  data.forEach(item => {
    if (!item.country) return;
    if (!countries.has(item.country)) {
      countries.set(item.country, {
        code: item.country_code,
        country: item.country,
        covered: new Set(),
        uncovered: new Set(),
        postCount: 0,
        allOutlets: new Set(),
        outlets: []
      });
    }

    const entry = countries.get(item.country);
    entry.allOutlets.add(item.outlet);
    entry.outlets.push(item);
    const articleUrls = (item.article_urls || '').split(';').map(value => value.trim()).filter(Boolean);
    if (articleUrls.length) {
      entry.covered.add(item.outlet);
      entry.postCount += articleUrls.length;
    } else {
      entry.uncovered.add(item.outlet);
    }
  });

  return [...countries.values()].map(entry => {
    const coverageShare = entry.allOutlets.size
      ? entry.covered.size / entry.allOutlets.size
      : 0;
    let level = 'red';
    if (coverageShare > .75) level = 'green';
    else if (coverageShare > .5) level = 'lightgreen';
    else if (coverageShare > .25) level = 'orange';

    return {
      ...entry,
      level,
      coveragePercent: Math.round(coverageShare * 100)
    };
  });
}

const A2_TO_A3 = {
  AT: 'AUT', BE: 'BEL', CZ: 'CZE', DK: 'DNK', FI: 'FIN', FR: 'FRA', DE: 'DEU',
  NL: 'NLD', IE: 'IRL', IT: 'ITA', XK: 'CS-KM', LU: 'LUX', MT: 'MLT', GB: 'GBR',
  NO: 'NOR', PL: 'POL', ES: 'ESP', SE: 'SWE', AL: 'ALB', US: 'USA', CH: 'CHE',
  VA: 'VAT', GR: 'GRC', TR: 'TUR', UA: 'UKR', AU: 'AUS', BA: 'BIH', BR: 'BRA',
  BG: 'BGR', CA: 'CAN', HR: 'HRV', IN: 'IND', JP: 'JPN', ME: 'MNE', NZ: 'NZL',
  MK: 'MKD', RO: 'ROU', RS: 'SRB', SI: 'SVN', AD: 'AND', AM: 'ARM', AZ: 'AZE',
  BY: 'BLR', CY: 'CYP', EE: 'EST', GE: 'GEO', HU: 'HUN', IS: 'ISL', LV: 'LVA',
  LI: 'LIE', LT: 'LTU', MD: 'MDA', MC: 'MCO', PT: 'PRT', RU: 'RUS', SM: 'SMR',
  SK: 'SVK'
};

let coverageMapInstance = null;
let coverageTileLayer = null;
const COVERAGE_LABEL_MIN_ZOOM = 4;

function coverageMapTileUrl() {
  const dark = document.body.getAttribute('data-md-color-scheme') === 'slate';
  const layer = dark ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base';
  return `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${layer}/MapServer/tile/{z}/{y}/{x}`;
}

function coverageMapPopup(item) {
  const popup = document.createElement('div');
  popup.className = 'coverage-map-popup';

  const heading = document.createElement('strong');
  heading.className = 'coverage-map-popup__title';
  heading.textContent = item.country;
  popup.append(heading);

  const ratio = document.createElement('span');
  ratio.className = 'coverage-map-popup__ratio';
  ratio.textContent = `${item.covered.size}/${item.allOutlets.size} outlets published (${item.coveragePercent}%) · ${item.postCount} ${item.postCount === 1 ? 'post' : 'posts'}`;
  popup.append(ratio);

  const appendShortlist = (label, outlets, covered) => {
    const line = document.createElement('p');
    line.className = `coverage-map-popup__line coverage-map-popup__line--${covered ? 'yes' : 'no'}`;
    const lineLabel = document.createElement('strong');
    lineLabel.textContent = `${label}: `;
    line.append(lineLabel);

    if (!outlets.length) {
      line.append(document.createTextNode('None'));
    }

    outlets.slice(0, 3).forEach((outlet, index) => {
      if (index) line.append(document.createTextNode(', '));
      const articleUrls = (outlet.article_urls || '').split(';').map(value => value.trim()).filter(Boolean);
      if (covered && articleUrls.length) {
        const link = document.createElement('a');
        link.href = articleUrls[0];
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = outlet.outlet;
        line.append(link);
      } else {
        line.append(document.createTextNode(outlet.outlet));
      }
    });

    if (outlets.length > 3) {
      line.append(document.createTextNode(`, +${outlets.length - 3}`));
    }
    popup.append(line);
  };

  const sortedOutlets = [...item.outlets].sort((a, b) => a.outlet.localeCompare(b.outlet));
  appendShortlist('Yes', sortedOutlets.filter(outlet => (outlet.article_urls || '').trim()), true);
  appendShortlist('No', sortedOutlets.filter(outlet => !(outlet.article_urls || '').trim()), false);

  return popup;
}

function renderMap(priorities) {
  const container = document.getElementById('coverage-map');
  const legend = document.getElementById('coverage-map-legend');
  if (!container || typeof L === 'undefined') return;
  if (coverageMapInstance) coverageMapInstance.remove();

  coverageMapInstance = L.map(container, {
    center: [40, 12],
    zoom: 3,
    minZoom: 2,
    maxZoom: 16,
    worldCopyJump: true,
    scrollWheelZoom: true
  });
  coverageTileLayer = L.tileLayer(coverageMapTileUrl(), {
    attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap contributors and the GIS user community',
    maxZoom: 16
  }).addTo(coverageMapInstance);

  const countryLabels = L.layerGroup();
  const updateCountryLabelVisibility = () => {
    if (coverageMapInstance.getZoom() >= COVERAGE_LABEL_MIN_ZOOM) {
      if (!coverageMapInstance.hasLayer(countryLabels)) countryLabels.addTo(coverageMapInstance);
    } else if (coverageMapInstance.hasLayer(countryLabels)) {
      countryLabels.removeFrom(coverageMapInstance);
    }
  };
  coverageMapInstance.on('zoomend', updateCountryLabelVisibility);

  const byA3 = new Map(priorities.map(item => [A2_TO_A3[item.code], item]));
  const style = (item, hover = false) => {
    return {
      fillColor: item ? LEVEL_META[item.level].color : '#9aa3af',
      fillOpacity: item ? (hover ? .95 : .75) : .2,
      color: '#fff',
      weight: .6
    };
  };

  fetch(new URL('countries.geo.json', coverageAssetsBase))
    .then(response => response.ok ? response.json() : Promise.reject(Error(response.status)))
    .then(geojson => {
      L.geoJSON(geojson, {
        style: feature => style(byA3.get(feature.id)),
        onEachFeature: (feature, layer) => {
          const item = byA3.get(feature.id);
          const name = item?.country || feature.properties.name;
          const text = item
            ? `${name}: ${item.postCount} posts · ${item.covered.size} outlets with posts, ${item.uncovered.size} without posts`
            : `${name}: not rated`;
          layer.bindTooltip(text, { sticky: true });
          if (item) {
            layer.bindPopup(coverageMapPopup(item), { maxWidth: 360, minWidth: 240 });
            const bounds = layer.getBounds();
            const latSpan = Math.max(0, bounds.getNorth() - bounds.getSouth());
            const lngSpan = Math.max(0, bounds.getEast() - bounds.getWest());
            const labelSize = Math.min(.9, Math.max(.48, .48 + Math.sqrt(latSpan * lngSpan) * .03));
            const ratioLabel = L.divIcon({
              className: 'coverage-map-ratio-label',
              html: `<span style="--ratio-label-size:${labelSize.toFixed(2)}rem">${item.covered.size}/${item.allOutlets.size}</span>`,
              iconSize: null
            });
            L.marker(bounds.getCenter(), { icon: ratioLabel, interactive: false })
              .addTo(countryLabels);
          }
          layer.on('mouseover', () => layer.setStyle(style(item, true)));
          layer.on('mouseout', () => layer.setStyle(style(item)));
        }
      }).addTo(coverageMapInstance);
      updateCountryLabelVisibility();
    })
    .catch(() => {});

  if (legend) {
    legend.replaceChildren();
    ['green', 'lightgreen', 'orange', 'red'].forEach(level => {
      const item = document.createElement('span');
      item.className = 'coverage-map-legend-item';
      item.style.setProperty('--status-color', LEVEL_META[level].color);
      item.textContent = LEVEL_META[level].label;
      legend.append(item);
    });
  }
}

function renderCoverage(data) {
  const priorities = classifyCountries(data);
  const published = data.filter(item => (item.article_urls || '').trim()).length;
  const mapStats = {
    'coverage-stat-countries': priorities.length,
    'coverage-stat-outlets': data.length,
    'coverage-stat-published': published,
    'coverage-stat-uncovered': data.length - published
  };
  Object.entries(mapStats).forEach(([id, value]) => {
    const target = document.getElementById(id);
    if (target) target.textContent = value.toLocaleString();
  });
  renderMap(priorities);
}

function setupMediaCoverage() {
  const map = document.getElementById('coverage-map');
  if (!map || map.dataset.coverageReady) return;
  map.dataset.coverageReady = '1';

  fetch(new URL('media_coverage.csv', coverageAssetsBase))
    .then(response => {
      if (!response.ok) throw Error(response.status);
      return response.text();
    })
    .then(text => renderCoverage(csvRows(text)))
    .catch(() => {
      const legend = document.getElementById('coverage-map-legend');
      if (legend) legend.textContent = 'Unable to load the media coverage CSV. Use mkdocs serve.';
    });
}

new MutationObserver(() => {
  if (coverageTileLayer) coverageTileLayer.setUrl(coverageMapTileUrl());
}).observe(document.body, { attributes: true, attributeFilter: ['data-md-color-scheme'] });

document.addEventListener('DOMContentLoaded', setupMediaCoverage);
if (typeof document$ !== 'undefined') document$.subscribe(setupMediaCoverage);
