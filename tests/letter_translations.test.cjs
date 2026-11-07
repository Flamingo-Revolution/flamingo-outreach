const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const docs = path.resolve(__dirname, '../docs');

function recipientTemplates(text) {
  return text.split(/^=== /m).slice(1).map(block => block.split(/^## /m)[0]);
}

const english = recipientTemplates(fs.readFileSync(path.join(docs, 'messages/index.md'), 'utf8'));
const urls = text => [...new Set([...text.matchAll(/https?:\/\/[^\s<>\)]+/g)].map(match => match[0]))];

test('translated letters retain English recipient count, source links and reported figures', () => {
  assert.equal(english.length, 3);
  for (const file of fs.readdirSync(path.join(docs, 'languages')).filter(name => name.endsWith('.md'))) {
    const translated = recipientTemplates(fs.readFileSync(path.join(docs, 'languages', file), 'utf8'));
    assert.equal(translated.length, english.length, file);
    translated.forEach((letter, index) => {
      const label = `${file}, recipient ${index + 1}`;
      for (const url of urls(english[index])) assert.ok(letter.includes(url), `${label}: missing source ${url}`);
      assert.match(letter, /1[.,\s\u00a0\u202f]?067/, `${label}: arrests figure`);
      for (const number of ['140', '388', '310', '191', '88', '31', '214', '26', '12', '32', '124']) {
        assert.match(letter, new RegExp(`\\b${number}\\b`), `${label}: missing figure ${number}`);
      }
    });
  }
});

test('every language gallery resolves previews and downloads from nested page URLs', () => {
  const sitePrefix = '/project/';
  for (const file of fs.readdirSync(path.join(docs, 'languages')).filter(name => name.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(docs, 'languages', file), 'utf8');
    const code = file.slice(0, -3);
    const base = `https://example.test${sitePrefix}languages/${code}/`;
    const previews = [...text.matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => match[1]);
    const downloads = [...text.matchAll(/<a[^>]+href="([^"]+)"[^>]*\bdownload\b/g)].map(match => match[1]);
    assert.equal(previews.length, 3, `${file}: three attachment previews`);
    for (const target of [...previews, ...downloads]) {
      const resolved = new URL(target, base);
      assert.ok(resolved.pathname.startsWith(sitePrefix + 'assets/'), `${file}: ${target}`);
      const asset = path.join(docs, decodeURIComponent(resolved.pathname.slice(sitePrefix.length)));
      assert.ok(fs.existsSync(asset), `${file}: missing asset ${target}`);
    }
    for (const preview of previews) assert.ok(downloads.includes(preview), `${file}: matching image download`);
  }
});

test('language resource buttons and callouts use valid markup', () => {
  const targets = ['protestat', 'dosjet', 'harta'].map(slug => `https://www.flamingorevolution.eu/${slug}/`);
  for (const file of fs.readdirSync(path.join(docs, 'languages')).filter(name => name.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(docs, 'languages', file), 'utf8');
    assert.doesNotMatch(text, /\][ \t]+\((?:https?:\/\/|\.\.?\/)/, `${file}: malformed link`);
    assert.doesNotMatch(text, /!!!\s+\w+\s+[„“«]/, `${file}: malformed callout title`);
    const resources = text.match(/<nav class="communication-resources"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(resources, `${file}: resource navigation`);
    assert.equal((resources.match(/class="md-button"/g) || []).length, 3, `${file}: three resource buttons`);
    for (const target of targets) assert.ok(resources.includes(`href="${target}"`), `${file}: resource ${target}`);
  }
});
