const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ URL, document: {
  currentScript: { src: 'https://example.test/project/assets/js/country_data.js' },
  addEventListener() {}
} });
vm.runInContext(fs.readFileSync(path.join(root, 'docs/assets/js/directory.js'), 'utf8').split('const directoryAssetsBase')[0], context);
vm.runInContext(fs.readFileSync(path.join(root, 'docs/assets/js/country_data.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'docs/assets/js/country_report.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'docs/assets/js/outreach_map.js'), 'utf8'), context);
const evaluate = code => vm.runInContext(code, context);

test('country reports keep categories separate and merge duplicate actors', () => {
  context.rows = {
    media: [
      { country: 'Czech Republic', outlet: 'Example', article_urls: 'https://example.test/one' },
      { country: 'Czechia', outlet: 'example', article_urls: 'https://example.test/two' },
      { country: 'Czechia', outlet: 'Unlinked', article_urls: 'javascript:bad' },
      { country: 'Germany', outlet: 'Example', article_urls: '' }
    ],
    institutions: [{ country: 'Czechia', organization: 'Example', response_link: 'https://example.test/response' }],
    parties: [{ country: 'Czechia', party: 'Party', response_link: '' }],
    mps: [{ country: 'Czechia', name: 'MP', response_link: 'https://example.test/mp' }]
  };
  const countries = evaluate('buildOutreachCountries(rows)');
  const czech = countries.find(item => item.country === 'Czechia');
  assert.equal(czech.total, 5);
  assert.equal(czech.recorded, 3);
  assert.equal(czech.entries.media.length, 2);
  assert.equal(czech.stats.media.missing, 1);
  assert.equal(czech.stats.mps.recorded, 1);
  assert.equal(countries.find(item => item.country === 'Germany').total, 1);
});

test('unsafe and repeated source URLs do not count as additional records', () => {
  assert.equal(evaluate(`outreachUrls('javascript:alert(1); https://example.test/a; https://example.test/a; ftp://example.test').length`), 1);
  assert.equal(evaluate(`outreachUrls('').length`), 0);
});

test('report links preserve project prefix, country names, and category anchors', () => {
  const url = new URL(evaluate(`outreachCountryUrl('Bosnia and Herzegovina', 'institutions')`));
  assert.equal(url.pathname, '/project/country/');
  assert.equal(url.searchParams.get('country'), 'Bosnia and Herzegovina');
  assert.equal(url.hash, '#institutions');
});

test('map colors distinguish no entries from zero recorded activity', () => {
  assert.equal(evaluate(`outreachMapColor({stats:{mps:{total:0,recorded:0}}}, 'mps')`), '#a3abb4');
  assert.equal(evaluate(`outreachMapColor({stats:{media:{total:4,recorded:0}}}, 'media')`), '#c45b64');
});

test('sidebar country stats follow the category and distinguish empty countries from zero completion', () => {
  context.statsCountries = [
    { country: 'Germany', total: 8, recorded: 3, stats: { media: { total: 3, recorded: 2 } } },
    { country: 'Albania', total: 2, recorded: 0, stats: { media: { total: 0, recorded: 0 } } }
  ];
  const all = evaluate('outreachCountryStats(statsCountries)');
  assert.equal(all[0].country, 'Albania');
  assert.equal(all[0].percent, 0);
  assert.equal(all[1].missing, 5);
  const media = evaluate('outreachCountryStats(statsCountries, "media")');
  assert.equal(media[0].percent, null);
  assert.equal(media[1].total, 3);
  assert.equal(media[1].missing, 1);
  assert.equal(media[1].percent, 67);
});

test('live data produces consistent report totals without inventing MPs', () => {
  const files = { media: 'media_coverage', institutions: 'institutions', mps: 'mps', parties: 'political_parties' };
  context.live = Object.fromEntries(Object.entries(files).map(([key, file]) => {
    context.csvText = fs.readFileSync(path.join(root, `docs/assets/data/${file}.csv`), 'utf8');
    return [key, evaluate('csvRows(csvText)')];
  }));
  const countries = evaluate('buildOutreachCountries(live)');
  assert(countries.length > 40);
  assert(countries.some(item => item.country === 'European Parliament'));
  for (const item of countries) {
    assert.equal(item.total, Object.values(item.entries).reduce((sum, rows) => sum + rows.length, 0));
    assert.equal(item.recorded, Object.values(item.stats).reduce((sum, stat) => sum + stat.recorded, 0));
    for (const stat of Object.values(item.stats)) assert.equal(stat.recorded + stat.missing, stat.total);
  }
  console.log(`Live country reports: ${countries.length}; listed entries: ${countries.reduce((sum, item) => sum + item.total, 0)}`);
});

test('popup sorts linked status and latest dates with alphabetical ties and undated entries last', () => {
  vm.runInContext(fs.readFileSync(path.join(root, 'docs/assets/js/country_popup.js'), 'utf8'), context);
  context.sortRows = [
    { outlet: 'Alpha', article_urls: '', dates: '' },
    { outlet: 'Bravo', article_urls: 'https://example.test/b', dates: '2026-10-01; 2026-11-01' },
    { outlet: 'Charlie', article_urls: 'https://example.test/c', dates: '2026-10-15' }
  ];
  for (const [order, expected] of [
    ['name', 'Alpha,Bravo,Charlie'], ['name-desc', 'Charlie,Bravo,Alpha'],
    ['recorded', 'Bravo,Charlie,Alpha'], ['missing', 'Alpha,Bravo,Charlie'],
    ['newest', 'Bravo,Charlie,Alpha']
  ]) {
    context.sortOrder = order;
    assert.equal(evaluate(`sortRows.slice().sort((a,b) => compareCountryEntries(a,b,COUNTRY_SECTIONS[0],sortOrder)).map(row => row.outlet).join(',')`), expected);
  }
});

test('map initializes country information even when Leaflet is unavailable and cleans up on navigation', async () => {
  const shell = {};
  const rootNode = { dataset: {}, isConnected: true, querySelector: () => shell, querySelectorAll: () => [] };
  const summary = { textContent: '' };
  const mapNode = { textContent: '' };
  let activeRoot = rootNode;
  let destroyed = false;
  const smoke = vm.createContext({
    URL, location: { href: 'https://example.test/outreach/' },
    document: {
      addEventListener() {},
      getElementById(id) {
        return id === 'outreach-overview' ? activeRoot : id === 'outreach-summary' ? summary : id === 'outreach-map' ? mapNode : null;
      }
    },
    COUNTRY_SECTIONS: [],
    loadOutreachCountries: async () => [],
    createCountryPopup: () => ({ destroy() { destroyed = true; } })
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'docs/assets/js/outreach_map.js'), 'utf8'), smoke);
  await vm.runInContext('setupOutreachMap()', smoke);
  assert.match(summary.textContent, /0 countries/);
  assert.match(mapNode.textContent, /Use the country search/);
  activeRoot = null;
  await vm.runInContext('setupOutreachMap()', smoke);
  assert.equal(destroyed, true);
});

test('popup combines MPs and groups without changing original country entries', () => {
  vm.runInContext(fs.readFileSync(path.join(root, 'docs/assets/js/country_popup.js'), 'utf8'), context);
  context.parliamentCountry = { entries: {
    media: [], institutions: [],
    mps: [{ name: 'Zeta MP', party: 'Alpha group', response_link: 'https://example.test/mp' }],
    parties: [{ party: 'Alpha group', response_link: '' }]
  } };
  assert.equal(evaluate(`countryPopupSections().map(section => section.key).join(',')`), 'media,institutions,parliament,politicians,actors');
  assert.equal(evaluate(`countryPopupEntries(parliamentCountry, 'parliament').length`), 2);
  assert.equal(evaluate(`countryPopupEntries(parliamentCountry, 'parliament').sort((a,b) => compareCountryEntries(a,b,countryPopupSections()[2],'name')).map(row => row.popupName).join(',')`), 'Alpha group,Zeta MP');
  assert.equal(evaluate(`countryPopupEntries(parliamentCountry, 'parliament').filter(row => outreachUrls(row.response_link).length).length`), 1);
  assert.equal(evaluate(`countryPopupEntries(parliamentCountry, 'parliament').map(row => row.popupSection).join(',')`), 'mps,parties');
  assert.equal(evaluate(`'popupName' in parliamentCountry.entries.mps[0]`), false);
});

test('remaining outreach keeps Albania and classifies source links without treating plain text as evidence', () => {
  vm.runInContext(fs.readFileSync(path.join(root, 'docs/assets/js/remaining_treemaps.js'), 'utf8'), context);
  const groups = evaluate(`remainingGroupBy([
    {country:'Albania', name:'MP', response_link:'https://example.test/response'},
    {country:'Albania', name:'Group', response_link:'pending'}
  ], {nameField:'name', isDone:row=>outreachUrls(row.response_link).length>0})`);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].value, 2);
  assert.equal(groups[0].done, 1);
});

test('momentum handles an empty protest track and still shows political entries', () => {
  vm.runInContext(fs.readFileSync(path.join(root, 'docs/assets/js/momentum.js'), 'utf8'), context);
  assert.equal(evaluate('buildMomentumRows([], []).length'), 0);
  assert.equal(evaluate(`buildMomentumRows([], [{date_iso:'2026-11-01',stance:'pro'}])[0].pro`), 1);
});

test('shared disclosure accordion closes siblings and leaves collapsed rows alone', () => {
  const block = () => ({ open: false, listeners: {}, addEventListener(type, listener) { this.listeners[type] = listener; } });
  const first = block(), second = block();
  context.accordionBlocks = [first, second];
  evaluate('countryDisclosureAccordion(accordionBlocks)');
  first.open = true;
  first.listeners.toggle();
  assert.equal(first.open, true);
  second.open = true;
  second.listeners.toggle();
  assert.equal(first.open, false);
  assert.equal(second.open, true);
  first.listeners.toggle();
  assert.equal(second.open, true);
});

test('momentum filters search and inclusive date ranges without counting rights monitoring', () => {
  context.momentumData = [
    {track:'protest',date_iso:'2026-10-01',title:'Tirana march'},
    {track:'political',date_iso:'2026-10-02',title:'Statement',source_name:'Monitor'},
    {track:'rights',date_iso:'2026-10-02',title:'Rights monitoring'}
  ];
  assert.equal(evaluate(`filterMomentumEvents(momentumData).length`), 2);
  assert.equal(evaluate(`filterMomentumEvents(momentumData,{from:'2026-10-02',to:'2026-10-02'}).length`), 1);
  assert.equal(evaluate(`filterMomentumEvents(momentumData,{query:'monitor'})[0].track`), 'political');
  assert.equal(evaluate(`filterMomentumEvents(momentumData,{from:'2026-10-03',to:'2026-10-01'}).length`), 0);
});

test('momentum keeps the original protest start when filters exclude protest events', () => {
  const rows = evaluate(`buildMomentumRows([], [{date_iso:'2026-10-20',stance:'mixed'}], '2026-10-01')`);
  assert.notEqual(rows[0].label, 'Before the protests');
  assert.equal(rows[0].mixed, 1);
});
