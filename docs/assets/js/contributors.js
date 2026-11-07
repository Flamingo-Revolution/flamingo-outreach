const contributorsAssetsBase = new URL('../data/', document.currentScript.src);
let contributorsGraph = null;


function setupContributors() {
  const graph = document.getElementById('contributors-graph');
  if (contributorsGraph && contributorsGraph.container() !== graph) {
    contributorsGraph.destroy();
    contributorsGraph = null;
  }
  if (!graph || graph.dataset.ready) return;
  graph.dataset.ready = '1';
  const summary = document.getElementById('contributors-summary');
  const selection = document.getElementById('contributors-selection');
  const body = document.getElementById('contributors-rows');
  const sheet = document.getElementById('contributors-sheet');
  const search = document.getElementById('contributors-search');

  fetch(new URL('contributors.json', contributorsAssetsBase)).then(response => {
    if (!response.ok) throw Error(response.status);
    return response.json();
  }).then(data => {
    if (!graph.isConnected) return;
    data.sheets.forEach(value => {
      const option = document.createElement('option');
      option.value = option.textContent = value;
      sheet.append(option);
    });
    const update = () => {
      const query = search.value.trim().toLowerCase();
      const visible = data.contributors.map((person, index) => ({
        ...person, id: `contributor-${index}`,
        count: sheet.value ? person.sheets[sheet.value] || 0 : person.total
      })).filter(person => person.count > 0 && person.name.toLowerCase().includes(query))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      const credits = visible.reduce((total, person) => total + person.count, 0);
      summary.textContent = `${visible.length} contributors · ${credits} row credits${sheet.value ? ` · ${sheet.value}` : ' across all sheets'} · ${data.unattributed_rows || 0} workbook rows without contributor credits`;
      selection.textContent = data.contributors.length
        ? (visible.length ? 'Select a person to see their contributions in the table below.' : 'No contributors match these filters.')
        : 'No contributor names have been recorded yet. Add agreed public names to the Contributors column in the workbook; totals appear after the next import.';
      body.replaceChildren();
      visible.forEach((person, index) => {
        const row = document.createElement('tr');
        row.id = person.id;
        [index + 1, person.name, person.count].forEach(value => {
          const cell = document.createElement('td');
          cell.textContent = value;
          row.append(cell);
        });
        const breakdown = document.createElement('td');
        breakdown.textContent = Object.entries(person.sheets)
          .filter(([name]) => !sheet.value || sheet.value === name)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([name, count]) => `${name}: ${count}`).join(' · ');
        row.append(breakdown);
        body.append(row);
      });
      if (contributorsGraph) { contributorsGraph.destroy(); contributorsGraph = null; }
      graph.replaceChildren();
      if (!visible.length) { graph.textContent = selection.textContent; return; }
      if (typeof cytoscape === 'undefined') {
        graph.textContent = 'The graph could not load. All contributor totals are available in the table below.';
        return;
      }
      const includedSheets = data.sheets.filter(name => (!sheet.value || name === sheet.value) && visible.some(person => person.sheets[name]));
      const elements = includedSheets.map(name => ({
        data: { id: `sheet-${name}`, label: name, color: '#af6010', size: 40 }, classes: 'sheet'
      }));
      visible.forEach(person => {
        elements.push({ data: { id: person.id, label: `${person.name}\n${person.count} rows`, color: '#1976d2', size: 24 + 10 * Math.sqrt(person.count) } });
        includedSheets.forEach(name => {
          if (person.sheets[name]) elements.push({ data: {
            id: `${person.id}-${name}`, source: person.id, target: `sheet-${name}`,
            label: String(person.sheets[name]), width: 1 + Math.log2(person.sheets[name])
          } });
        });
      });
      const dark = document.body.getAttribute('data-md-color-scheme') === 'slate';
      contributorsGraph = cytoscape({
        container: graph, elements, wheelSensitivity: .15,
        style: [
          { selector: 'node', style: { label: 'data(label)', width: 'data(size)', height: 'data(size)', 'background-color': 'data(color)', color: dark ? '#eee' : '#222', 'font-size': 12, 'text-wrap': 'wrap', 'text-max-width': 140, 'text-valign': 'bottom', 'text-margin-y': 6 } },
          { selector: 'node.sheet', style: { shape: 'round-rectangle', 'font-weight': 'bold' } },
          { selector: 'edge', style: { label: 'data(label)', width: 'data(width)', color: dark ? '#eee' : '#222', 'font-size': 11, 'line-color': '#94a3b8', 'curve-style': 'bezier', 'text-background-color': dark ? '#222' : '#fff', 'text-background-opacity': 1, 'text-background-padding': 2 } },
          { selector: ':selected', style: { 'border-width': 3, 'border-color': '#e64a19' } }
        ],
        layout: { name: 'cose', animate: false, padding: 40, nodeRepulsion: () => 18000, idealEdgeLength: () => 140 }
      });
      contributorsGraph.on('tap', 'node', event => {
        const person = visible.find(item => item.id === event.target.id());
        if (!person) return;
        selection.textContent = `${person.name}: ${person.count} credited rows`;
        const row = document.getElementById(person.id);
        row.setAttribute('tabindex', '-1');
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.focus({ preventScroll: true });
      });
    };
    sheet.addEventListener('change', update);
    search.addEventListener('input', update);
    document.getElementById('contributors-fit').addEventListener('click', () => contributorsGraph?.fit(undefined, 40));
    const observer = new MutationObserver(() => {
      if (!graph.isConnected) { observer.disconnect(); return; }
      const color = document.body.getAttribute('data-md-color-scheme') === 'slate' ? '#eee' : '#222';
      contributorsGraph?.style().selector('node, edge').style('color', color).update();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-md-color-scheme'] });
    update();
  }).catch(() => {
    summary.textContent = 'Unable to load contributor totals. Reload to try again.';
    graph.textContent = 'Contributor data unavailable.';
    delete graph.dataset.ready;
  });
}

document.addEventListener('DOMContentLoaded', setupContributors);
if (typeof document$ !== 'undefined') document$.subscribe(setupContributors);
