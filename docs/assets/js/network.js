/*
 * "Network" page: a graph of the civil-society movement built from three
 * relationships already in the data — actors who took joint action together
 * (via the Actions sheet), actors who belong to a parent group (PartOf), and
 * the people assigned to or credited with keeping an actor's record current.
 * Institutions that an action was addressed to are included as a fourth,
 * smaller node type since the data already links them.
 */

const networkAssetsBase = new URL('../data/', document.currentScript.src);
let networkGraph = null;

const NETWORK_KINDS = ['actor', 'action', 'institution', 'person'];
const NETWORK_EDGE_TYPES = ['action', 'partof', 'assigned', 'credit'];
const NETWORK_NODE_COLOR = { action: '#af6010', institution: '#455a64', person: '#1976d2', overflow: '#9e9e9e' };
const NETWORK_NODE_SHAPE = { actor: 'ellipse', action: 'round-rectangle', institution: 'diamond', person: 'ellipse', overflow: 'ellipse' };
/* Actions with more than this many groups whose ONLY connection is that one
   action get those groups collapsed into a single "+N more groups" node. */
const NETWORK_OVERFLOW_THRESHOLD = 10;

/* Named force/layout presets, so the same graph can be checked under a few
   different distributions rather than being locked into one. */
const NETWORK_LAYOUTS = {
  balanced: { name: 'cose', animate: false, padding: 40, nodeRepulsion: () => 22000, idealEdgeLength: () => 90, gravity: 1 },
  spread: { name: 'cose', animate: false, padding: 40, nodeRepulsion: () => 65000, idealEdgeLength: () => 170, gravity: .4 },
  tight: { name: 'cose', animate: false, padding: 40, nodeRepulsion: () => 6000, idealEdgeLength: () => 40, gravity: 3.5 },
  concentric: { name: 'concentric', animate: false, padding: 40, concentric: node => node.data('degree') || 0, levelWidth: () => 2, minNodeSpacing: 26 },
  circle: { name: 'circle', animate: false, padding: 40 }
};
const NETWORK_DEFAULT_LAYOUT = 'balanced';

/* Actor categories are free text (dozens of distinct values); bucket them
   into a legend-sized set of types for coloring, checked in this order. */
const NETWORK_ACTOR_TYPES = [
  ['Media & press freedom', /media|journalis|press freedom/, '#c62828'],
  ['Environmental', /environmental/, '#2e7d32'],
  ['Diaspora', /diaspora/, '#5e35b1'],
  ['Grassroots & protest', /student|protest|civic movement|coalition|coordination/, '#00897b'],
  ['Human & civil rights', /rights|liberties/, '#ad1457'],
  ['Business association', /business/, '#f9a825'],
  ['Research & academic', /research|academic|education/, '#8d6e63'],
  ['Civil society / other', /./, '#78909c'],
  ['Unspecified', /^$/, '#9e9e9e']
];

function networkActorType(category) {
  const text = (category || '').trim().toLowerCase();
  return NETWORK_ACTOR_TYPES.find(([, pattern]) => pattern.test(text)) || NETWORK_ACTOR_TYPES[NETWORK_ACTOR_TYPES.length - 1];
}

function networkNames(value) {
  const seen = new Map();
  (value || '').split(';').forEach(raw => {
    const name = raw.trim();
    if (name) seen.set(name.toLowerCase(), name);
  });
  return [...seen.values()];
}

function buildNetworkModel(actors, actions, institutions) {
  const actorsById = new Map(actors.map(row => [row.actor_id, row]));
  const institutionsById = new Map(institutions.map(row => [row.institution_id, row]));
  const nodes = new Map();
  const edges = [];
  let edgeCount = 0;

  const addNode = (id, data) => {
    if (!nodes.has(id)) nodes.set(id, { data: { id, ...data } });
    return nodes.get(id);
  };
  const addEdge = (source, target, type, label = '') => {
    edgeCount += 1;
    edges.push({ data: { id: `edge-${edgeCount}`, source, target, label, type } });
  };

  actors.forEach(actor => {
    addNode(`actor-${actor.actor_id}`, {
      label: actor.organization, kind: 'actor', category: actor.category || '',
      country: actor.country || '', url: actor.website || actor.evidence_url || ''
    });
  });

  actors.forEach(actor => {
    if (actor.part_of && actorsById.has(actor.part_of)) {
      addEdge(`actor-${actor.actor_id}`, `actor-${actor.part_of}`, 'partof', 'part of');
    }
  });

  actions.forEach(action => {
    const actorIds = networkNames(action.actor_ids).filter(id => actorsById.has(id));
    const institutionIds = networkNames(action.institution_ids).filter(id => institutionsById.has(id));
    if (!actorIds.length && !institutionIds.length) return;
    const actionId = `action-${action.action_id}`;
    addNode(actionId, {
      label: action.action, kind: 'action', url: (action.evidence_urls || '').split(';')[0]?.trim() || ''
    });
    actorIds.forEach(id => addEdge(`actor-${id}`, actionId, 'action'));
    institutionIds.forEach(id => {
      const instId = `institution-${id}`;
      addNode(instId, { label: institutionsById.get(id).organization, kind: 'institution', url: '' });
      addEdge(instId, actionId, 'action');
    });
  });

  actors.forEach(actor => {
    networkNames(actor.assigned_to).forEach(name => {
      const personId = `person-${name.toLowerCase()}`;
      addNode(personId, { label: name, kind: 'person' });
      addEdge(`actor-${actor.actor_id}`, personId, 'assigned', 'assigned to');
    });
    networkNames(actor.contributors).forEach(name => {
      const personId = `person-${name.toLowerCase()}`;
      addNode(personId, { label: name, kind: 'person' });
      addEdge(`actor-${actor.actor_id}`, personId, 'credit', 'data contributor');
    });
  });

  return { nodes: [...nodes.values()], edges, actorsById, institutionsById, actions: actions.filter(action =>
    networkNames(action.actor_ids).some(id => actorsById.has(id)) ||
    networkNames(action.institution_ids).some(id => institutionsById.has(id))
  ) };
}

/* Group actors whose only graph connection is one heavily-joined action into
   a single overflow node, so a 45-signatory letter doesn't draw 45 leaves. */
function collapseActionOverflow(nodes, edges, degree, threshold = NETWORK_OVERFLOW_THRESHOLD) {
  const byAction = new Map();
  edges.forEach(edge => {
    if (edge.data.type !== 'action') return;
    const sourceIsActor = edge.data.source.startsWith('actor-');
    const targetIsActor = edge.data.target.startsWith('actor-');
    if (sourceIsActor === targetIsActor) return;
    const actorId = sourceIsActor ? edge.data.source : edge.data.target;
    const actionId = sourceIsActor ? edge.data.target : edge.data.source;
    if (!actionId.startsWith('action-')) return;
    if (!byAction.has(actionId)) byAction.set(actionId, []);
    byAction.get(actionId).push({ actorId, edge });
  });

  const removeNodeIds = new Set();
  const removeEdgeIds = new Set();
  const extraNodes = [];
  const extraEdges = [];
  byAction.forEach((entries, actionId) => {
    const sole = entries.filter(({ actorId }) => (degree.get(actorId) || 0) === 1);
    if (sole.length <= threshold) return;
    sole.forEach(({ actorId, edge }) => {
      removeNodeIds.add(actorId);
      removeEdgeIds.add(edge.data.id);
    });
    const overflowId = `overflow-${actionId}`;
    extraNodes.push({ data: { id: overflowId, label: `+${sole.length} more groups`, kind: 'overflow', count: sole.length, url: '' } });
    extraEdges.push({ data: { id: `${overflowId}-edge`, source: overflowId, target: actionId, label: '', type: 'action' } });
  });

  if (!removeNodeIds.size) return { nodes, edges };
  return {
    nodes: [...nodes.filter(node => !removeNodeIds.has(node.data.id)), ...extraNodes],
    edges: [...edges.filter(edge => !removeEdgeIds.has(edge.data.id)), ...extraEdges]
  };
}

function networkActorCount(action, model) {
  return networkNames(action.actor_ids).filter(id => model.actorsById.has(id)).length;
}

function networkActionCard(action, model) {
  const actorNames = networkNames(action.actor_ids).map(id => model.actorsById.get(id)?.organization).filter(Boolean);
  const institutionNames = networkNames(action.institution_ids).map(id => model.institutionsById.get(id)?.organization).filter(Boolean);
  const heading = [countryElement('strong', 'coverage-country-name', action.action)];
  if (actorNames.length) heading.push(countryElement('span', 'network-action-badge', `${actorNames.length} actor${actorNames.length === 1 ? '' : 's'}`));
  if (institutionNames.length) heading.push(countryElement('span', 'coverage-priority-percentage', `${institutionNames.length} institution${institutionNames.length === 1 ? '' : 's'}`));

  const content = countryElement('div', 'network-action-body');
  if (actorNames.length) content.append(countryElement('p', 'network-action-meta', `Civil society: ${actorNames.join(', ')}`));
  if (institutionNames.length) content.append(countryElement('p', 'network-action-meta', `Institutions: ${institutionNames.join(', ')}`));
  if (action.response_to) content.append(countryElement('p', 'network-action-meta', `In response to: ${action.response_to}`));
  if (action.notes) content.append(countryReportNote(action.notes));
  const links = countryElement('div', 'country-entry-links');
  outreachUrls(action.evidence_urls).forEach((url, index) => countryReportLink(links, url, `Evidence ${index + 1}`));
  if (links.childElementCount) content.append(links);

  const details = countryDisclosure(heading, content, 'network-action-card');
  details.id = `network-action-${action.action_id}`;
  details.querySelector('summary').classList.add('country-popup-entry-summary');
  return details;
}

function setupNetwork() {
  const graph = document.getElementById('network-graph');
  if (networkGraph && networkGraph.container() !== graph) {
    networkGraph.destroy();
    networkGraph = null;
  }
  if (!graph || graph.dataset.ready) return;
  graph.dataset.ready = '1';
  const summary = document.getElementById('network-summary');
  const selection = document.getElementById('network-selection');
  const search = document.getElementById('network-search');
  const category = document.getElementById('network-category-filter');
  const showIsolated = document.getElementById('network-show-isolated');
  const actionsRoot = document.getElementById('network-actions');
  const kindBoxes = Object.fromEntries(NETWORK_KINDS.map(kind => [kind, document.getElementById(`network-kind-${kind}`)]));
  const edgeBoxes = Object.fromEntries(NETWORK_EDGE_TYPES.map(type => [type, document.getElementById(`network-edge-${type}`)]));
  const allToggles = [...Object.values(kindBoxes), ...Object.values(edgeBoxes)];
  const layoutInputs = [...document.querySelectorAll('input[name="network-layout"]')];
  let currentLayout = layoutInputs.find(input => input.checked)?.value || NETWORK_DEFAULT_LAYOUT;

  Promise.all(['actors.csv', 'actions.csv', 'institutions.csv'].map(file =>
    fetch(new URL(file, networkAssetsBase)).then(response => {
      if (!response.ok) throw Error(response.status);
      return response.text();
    })
  )).then(([actorsText, actionsText, institutionsText]) => {
    if (!graph.isConnected) return;
    const model = buildNetworkModel(csvRows(actorsText), csvRows(actionsText), csvRows(institutionsText));

    [...new Set(model.nodes.filter(node => node.data.kind === 'actor').map(node => node.data.category).filter(Boolean))]
      .sort().forEach(value => {
        const option = document.createElement('option');
        option.value = option.textContent = value;
        category.append(option);
      });

    const sortedActions = [...model.actions].sort((a, b) =>
      networkActorCount(b, model) - networkActorCount(a, model) || a.action.localeCompare(b.action));
    actionsRoot.replaceChildren(...sortedActions.map(action => networkActionCard(action, model)));
    if (!model.actions.length) actionsRoot.append(countryElement('p', 'country-empty', 'No actions with a matching actor or institution are recorded yet.'));

    const update = () => {
      const query = search.value.trim().toLowerCase();
      const activeEdgeTypes = new Set(NETWORK_EDGE_TYPES.filter(type => edgeBoxes[type]?.checked));
      const kindAllowed = node => kindBoxes[node.data.kind]?.checked;
      const categoryAllowed = node => node.data.kind !== 'actor' || !category.value || node.data.category === category.value;

      const baseNodes = model.nodes.filter(node => kindAllowed(node) && categoryAllowed(node));
      const baseIds = new Set(baseNodes.map(node => node.data.id));
      const typedEdges = model.edges.filter(edge => activeEdgeTypes.has(edge.data.type) && baseIds.has(edge.data.source) && baseIds.has(edge.data.target));

      const rawDegree = new Map();
      typedEdges.forEach(edge => {
        rawDegree.set(edge.data.source, (rawDegree.get(edge.data.source) || 0) + 1);
        rawDegree.set(edge.data.target, (rawDegree.get(edge.data.target) || 0) + 1);
      });

      // Collapsing actors who only exist to pad out one big action keeps the
      // graph readable; skip it while actively searching, so a search for a
      // collapsed actor's name can still surface them.
      let workingNodes = baseNodes;
      let workingEdges = typedEdges;
      if (!query) {
        const collapsed = collapseActionOverflow(baseNodes, typedEdges, rawDegree);
        workingNodes = collapsed.nodes;
        workingEdges = collapsed.edges;
      }

      const degree = new Map();
      const actionDegree = new Map();
      workingEdges.forEach(edge => {
        degree.set(edge.data.source, (degree.get(edge.data.source) || 0) + 1);
        degree.set(edge.data.target, (degree.get(edge.data.target) || 0) + 1);
        if (edge.data.type === 'action') {
          actionDegree.set(edge.data.source, (actionDegree.get(edge.data.source) || 0) + 1);
          actionDegree.set(edge.data.target, (actionDegree.get(edge.data.target) || 0) + 1);
        }
      });

      let visibleNodes = workingNodes;
      let visibleEdges = workingEdges;
      if (query) {
        const matchedIds = new Set(workingNodes.filter(node => node.data.label.toLowerCase().includes(query)).map(node => node.data.id));
        const keepIds = new Set(matchedIds);
        workingEdges.forEach(edge => {
          if (matchedIds.has(edge.data.source)) keepIds.add(edge.data.target);
          if (matchedIds.has(edge.data.target)) keepIds.add(edge.data.source);
        });
        visibleNodes = workingNodes.filter(node => keepIds.has(node.data.id));
        visibleEdges = workingEdges.filter(edge => keepIds.has(edge.data.source) && keepIds.has(edge.data.target));
      } else if (!showIsolated.checked) {
        visibleNodes = workingNodes.filter(node => (degree.get(node.data.id) || 0) > 0);
        const visibleIds = new Set(visibleNodes.map(node => node.data.id));
        visibleEdges = workingEdges.filter(edge => visibleIds.has(edge.data.source) && visibleIds.has(edge.data.target));
      }

      summary.textContent = `${visibleNodes.length} nodes · ${visibleEdges.length} connections` +
        (query ? ` · matching "${query}"` : '') +
        (!showIsolated.checked && !query ? ' · nodes with no recorded connections are hidden' : '');

      if (networkGraph) { networkGraph.destroy(); networkGraph = null; }
      graph.replaceChildren();
      if (!visibleNodes.length) {
        graph.textContent = 'No nodes match. Try another search, category or filter combination.';
        return;
      }
      if (typeof cytoscape === 'undefined') {
        graph.textContent = 'The graph could not load. The action list below has the same information.';
        return;
      }
      const dark = document.body.getAttribute('data-md-color-scheme') === 'slate';
      networkGraph = cytoscape({
        container: graph,
        elements: [
          ...visibleNodes.map(node => {
            const liveDegree = degree.get(node.data.id) || 0;
            const actionCount = actionDegree.get(node.data.id) || 0;
            // Circle size always tracks how many connections a node has;
            // the overflow node instead scales with how many actors it folds in.
            const size = node.data.kind === 'action' ? 34 + Math.sqrt(liveDegree) * 6
              : node.data.kind === 'overflow' ? 24 + Math.sqrt(node.data.count) * 5
              : 22 + Math.sqrt(liveDegree + 1) * 7;
            const [actorType, , actorColor] = node.data.kind === 'actor' ? networkActorType(node.data.category) : [];
            return {
              data: { ...node.data, actorType, color: node.data.kind === 'actor' ? actorColor : NETWORK_NODE_COLOR[node.data.kind],
                shape: NETWORK_NODE_SHAPE[node.data.kind], degree: liveDegree, actionCount, size },
              classes: `kind-${node.data.kind}`
            };
          }),
          ...visibleEdges.map(edge => ({ ...edge, classes: `edge-${edge.data.type}` }))
        ],
        wheelSensitivity: .15,
        style: [
          { selector: 'node', style: {
            label: 'data(label)', shape: 'data(shape)', width: 'data(size)', height: 'data(size)',
            'background-color': 'data(color)', color: dark ? '#eee' : '#222', 'font-size': 11,
            'text-wrap': 'wrap', 'text-max-width': 120, 'text-valign': 'bottom', 'text-margin-y': 5
          } },
          { selector: 'node.kind-action', style: {
            'font-weight': 'bold', 'border-width': 2, 'border-color': '#8a4a0c', 'text-max-width': 150, padding: '6px'
          } },
          { selector: 'node.kind-overflow', style: {
            'border-width': 2, 'border-style': 'dashed', 'border-color': '#616161', 'font-style': 'italic'
          } },
          { selector: 'edge', style: { width: 1.4, 'curve-style': 'bezier', 'line-color': '#94a3b8', 'target-arrow-shape': 'none' } },
          { selector: 'edge.edge-partof', style: { 'line-color': '#2e7d32', 'line-style': 'dashed', width: 1.8 } },
          { selector: 'edge.edge-assigned', style: { 'line-color': '#1976d2', 'line-style': 'dotted', width: 1.8 } },
          { selector: 'edge.edge-credit', style: { 'line-color': '#1976d2', width: 1.4 } },
          { selector: ':selected', style: { 'border-width': 3, 'border-color': '#e64a19' } }
        ],
        layout: NETWORK_LAYOUTS[currentLayout] || NETWORK_LAYOUTS[NETWORK_DEFAULT_LAYOUT]
      });
      networkGraph.on('tap', 'node', event => {
        const data = event.target.data();
        if (data.kind === 'overflow') {
          selection.textContent = `${data.count} more groups whose only recorded connection is this one action`;
          return;
        }
        const kindLabel = data.kind === 'actor' ? data.actorType : data.kind;
        const actionNote = data.kind === 'actor' ? ` · ${data.actionCount} joint action${data.actionCount === 1 ? '' : 's'}` : '';
        selection.textContent = `${data.label} · ${kindLabel} · ${data.degree} connection${data.degree === 1 ? '' : 's'}${actionNote}`;
        if (data.kind === 'action') {
          const details = document.getElementById(`network-action-${data.id.replace('action-', '')}`);
          if (details) {
            details.open = true;
            details.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    };

    search.addEventListener('input', update);
    category.addEventListener('change', update);
    showIsolated.addEventListener('change', update);
    allToggles.forEach(box => box?.addEventListener('change', update));
    layoutInputs.forEach(input => input.addEventListener('change', () => {
      currentLayout = input.value;
      if (networkGraph) networkGraph.layout(NETWORK_LAYOUTS[currentLayout]).run();
    }));
    document.getElementById('network-fit')?.addEventListener('click', () => networkGraph?.fit(undefined, 40));
    document.getElementById('network-reset')?.addEventListener('click', () => {
      search.value = '';
      category.value = '';
      showIsolated.checked = false;
      allToggles.forEach(box => { if (box) box.checked = true; });
      currentLayout = NETWORK_DEFAULT_LAYOUT;
      layoutInputs.forEach(input => { input.checked = input.value === NETWORK_DEFAULT_LAYOUT; });
      update();
    });
    const observer = new MutationObserver(() => {
      if (!graph.isConnected) { observer.disconnect(); return; }
      update();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-md-color-scheme'] });
    update();
  }).catch(() => {
    summary.textContent = 'Unable to load network data. Reload to try again.';
    graph.textContent = 'Network data unavailable.';
    delete graph.dataset.ready;
  });
}

document.addEventListener('DOMContentLoaded', setupNetwork);
if (typeof document$ !== 'undefined') document$.subscribe(setupNetwork);
