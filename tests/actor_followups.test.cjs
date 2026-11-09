const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const js = path.join(__dirname, '../docs/assets/js');
function element(tag, cls, text = '') {
  return { tag, text, childNodes: [], append(...nodes) { this.childNodes.push(...nodes); } };
}
test('actor interests link to country popups in simple view with stable country keys', () => {
  const context = vm.createContext({ URL, document: {
    currentScript: { src: 'https://example.test/project/assets/js/actors.js' },
    body: {}, addEventListener() {}, createElement: tag => ({ ...element(tag), dataset: {} })
  }, MutationObserver: class { observe() {} }, countryElement: (tag, cls, text) => ({ ...element(tag, cls, text), dataset: {} }) });
  for (const file of ['country_data.js', 'actors.js']) vm.runInContext(fs.readFileSync(path.join(js, file), 'utf8'), context);
  const result = vm.runInContext('actorAssignedInstitutionsNote({country_of_interest:"Czech Republic; Czechia; Germany"})', context);
  const links = result.childNodes.filter(node => node.tag === 'a');
  assert.equal(links.length, 2);
  const url = new URL(links[0].href);
  assert.equal(url.pathname, '/project/');
  assert.equal(url.searchParams.get('country'), 'Czechia');
  assert.equal(url.searchParams.get('view'), 'simple');
  assert.equal(links[0].dataset.countryKey, 'czechia');
  assert.equal(vm.runInContext('actorAssignedInstitutionsNote({})', context), null);
});

test('directory and popup targets use visible entries, including parliament subtypes', () => {
  const context = vm.createContext({ URL, document: {
    currentScript: { src: 'https://example.test/assets/js/country_report.js' }, addEventListener() {}
  } });
  for (const file of ['country_data.js', 'country_report.js']) vm.runInContext(fs.readFileSync(path.join(js, file), 'utf8'), context);
  context.element = element;
  vm.runInContext('countryReportEntry = (row, section) => element("article", "", section.key)', context);
  for (const key of ['institutions', 'media', 'parties', 'mps']) {
    context.key = key;
    const result = vm.runInContext('countryEntryDisclosure({}, COUNTRY_SECTIONS.find(section => section.key === key))', context);
    assert.equal(result.tag, 'article');
    assert.equal(result.text, key);
  }
  const result = vm.runInContext('countryEntryDisclosure({popupSection: "parties"}, {key: "parliament"})', context);
  assert.equal(result.text, 'parties');
});

test('popup simple view shows semantic lists grouped by type and toggles to full records', () => {
  const nodes = [];
  function node(tag) {
    const entry = { ...element(tag), dataset: {}, attrs: {}, handlers: {}, value: '',
      setAttribute(key, value) { this.attrs[key] = value; },
      removeAttribute(key) { delete this.attrs[key]; },
      replaceChildren(...children) { this.childNodes = children; },
      addEventListener(key, callback) { this.handlers[key] = callback; },
      querySelectorAll(tag) { return this.childNodes.flatMap(child => [ ...(child.tag === tag ? [child] : []), ...(child.querySelectorAll?.(tag) || []) ]); },
      querySelector(tag) { return this.querySelectorAll(tag)[0]; },
      focus() {}, showModal() { this.open = true; }, close() { this.open = false; },
      classList: { add() {}, remove() {} }
    };
    nodes.push(entry);
    return entry;
  }
  const context = vm.createContext({ URL, document: {
    currentScript: { src: 'https://example.test/assets/js/country_popup.js' },
    createElement: node, createTextNode: text => ({ tag: '#text', text }), addEventListener() {}, body: node('body')
  } });
  for (const file of ['country_data.js', 'country_report.js', 'country_popup.js']) vm.runInContext(fs.readFileSync(path.join(js, file), 'utf8'), context);
  context.host = node('div');
  const popup = vm.runInContext('createCountryPopup(host)', context);
  const item = { country: 'Germany', total: 2, recorded: 0, entries: {
    media: [{outlet: 'Example media', outlet_url: 'https://example.test', notes: 'Hidden description'}],
    institutions: [{organization: 'Example institution', website: 'https://institution.test', response_link: 'https://institution.test'}],
    mps: [], parties: [], actors: []
  } };
  popup.open(item, 'media', null, true);
  const body = nodes.find(node => node.id === 'country-popup-body');
  const lists = body.querySelectorAll('ul');
  assert.equal(lists.length, 2);
  assert.equal(body.querySelectorAll('li').length, 2);
  const [pending, done] = body.querySelectorAll('li').map(entry => entry.childNodes[0]);
  assert.equal(pending.className, 'country-link-status');
  assert.equal(pending.attrs['aria-label'], 'Not done: no source link recorded');
  assert.equal(done.className, 'country-link-status country-link-status--done');
  assert.equal(done.attrs['aria-label'], 'Done: source link recorded');
  assert.equal(body.querySelectorAll('a').length, 2);
  assert.equal(body.querySelectorAll('details').length, 5);
  assert.equal(nodes.filter(node => node.attrs.role === 'tab').length, 0);
  const groups = body.childNodes;
  assert.equal(groups[0].dataset.groupKey, 'media');
  assert.equal(groups[0].open, true);
  groups[0].open = false;
  groups[1].open = true;
  const toggle = nodes.find(node => node.tag === 'button' && node.textContent === 'Show details');
  assert(toggle);
  toggle.handlers.click();
  assert.equal(toggle.textContent, 'Show simple');
  assert.equal(body.querySelectorAll('details').length, 7);
  assert.equal(body.querySelectorAll('summary').length, 7);
  assert.equal(body.childNodes[0].open, false);
  assert.equal(body.childNodes[1].open, true);
  assert.equal(body.childNodes[0].querySelectorAll('details')[0].open, undefined);
  assert.equal(body.querySelectorAll('article').length, 2);
  toggle.handlers.click();
  assert.equal(body.querySelectorAll('ul').length, 2);
});
