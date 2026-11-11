const model = JSON.parse(document.getElementById('faultline-model').textContent);
const byId = new Map(model.nodes.map(node => [node.id, node]));
const $ = selector => document.querySelector(selector);
const failed = new Set();
let selected = null;
let result = simulate(model, []);
const labels = { unaffected: 'Unaffected', degraded: 'Degraded', unknown: 'Unknown', blocked: 'Blocked', offline: 'Offline' };
const colors = { unaffected: '#9da796', degraded: '#9b6c16', unknown: '#80709c', blocked: '#b33e36', offline: '#b33e36' };

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function badge(state) {
  const node = element('span', 'state', labels[state]);
  node.dataset.state = state;
  return node;
}

$('#title').textContent = model.title;
document.title = `${model.title} · Faultline`;
$('#description').textContent = model.description;
$('#boundaries-label').textContent = `Model boundaries · ${model.limitations.length} notes`;
for (const limit of model.limitations) $('#limitations').append(element('li', '', limit));
$('#snapshot').textContent = `${model.snapshot.files.length} cited files checked · SHA-256 snapshot ${model.snapshot.fingerprint.slice(0, 16)}\nFingerprint covers cited files at render time, not the whole repository or later edits.`;

const nodeButtons = new Map();
const journeyBadges = new Map();
for (const id of model.journeys) {
  const item = element('li');
  const state = badge('unaffected');
  item.append(element('span', '', byId.get(id).label), state);
  $('#journeys').append(item);
  journeyBadges.set(id, state);
}

const scenarioButtons = [];
for (const scenario of model.scenarios) {
  const button = element('button', 'preset', scenario.label);
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    failed.clear();
    scenario.down.forEach(id => failed.add(id));
    selected = scenario.down[0];
    update();
  });
  $('#presets').append(button);
  scenarioButtons.push([scenario, button]);
}
if (!model.scenarios.length) $('#presets').hidden = true;

const layers = [...new Set(model.nodes.map(node => node.layer))].sort((a, b) => a - b);
const groups = layers.map(layer => model.nodes.filter(node => node.layer === layer));
const mapHeight = Math.max(...groups.map(group => group.length)) * 126 + 62;
const mapWidth = layers.length * 244 + 12;
const positions = new Map();
const graph = $('#graph');
graph.style.width = `${mapWidth}px`;
graph.style.height = `${mapHeight}px`;
groups.forEach((group, x) => group.forEach((node, y) => {
  const position = { x: x * 244 + 20, y: (mapHeight - group.length * 126) / 2 + y * 126 + 13 };
  positions.set(node.id, position);
}));

const svgNamespace = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(svgNamespace, 'svg');
svg.setAttribute('width', mapWidth);
svg.setAttribute('height', mapHeight);
svg.setAttribute('aria-hidden', 'true');
const edgePaths = [];
for (const edge of model.edges) {
  const start = positions.get(edge.from);
  const end = positions.get(edge.to);
  const path = document.createElementNS(svgNamespace, 'path');
  const x1 = start.x + 186, y1 = start.y + 50, x2 = end.x, y2 = end.y + 50;
  const bend = Math.max(28, Math.abs(x2 - x1) * .45);
  path.setAttribute('d', `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`);
  if (edge.mode !== 'required') path.setAttribute('stroke-dasharray', edge.mode === 'optional' ? '6 5' : '2 5');
  svg.append(path);
  edgePaths.push([edge, path]);
}
graph.append(svg);

model.nodes.forEach((node, i) => {
  const button = element('button', 'node');
  button.type = 'button';
  button.dataset.id = node.id;
  button.style.left = `${positions.get(node.id).x}px`;
  button.style.top = `${positions.get(node.id).y}px`;
  button.title = node.label;
  button.append(element('span', 'node-number', `${String(i + 1).padStart(2, '0')} / ${model.journeys.includes(node.id) ? 'USER JOURNEY' : 'COMPONENT'}`), element('span', 'node-name', node.label), badge('unaffected'));
  button.addEventListener('click', () => {
    if (failed.has(node.id)) failed.delete(node.id);
    else failed.add(node.id);
    selected = node.id;
    update();
  });
  graph.append(button);
  nodeButtons.set(node.id, button);
});

function explanationItem(edge, heading) {
  const item = element('li');
  item.append(element('strong', '', heading ?? `${byId.get(edge.from).label} → ${byId.get(edge.to).label} · ${edge.mode}`), element('p', '', edge.reason));
  if (!edge.evidence.length) item.append(element('span', 'reference', 'Open question · no source reference supplied'));
  for (const ref of edge.evidence) item.append(element('span', 'reference', `${ref.path}:${ref.line}${ref.endLine === ref.line ? '' : `–${ref.endLine}`}`));
  return item;
}

function causeChain(id) {
  const chain = [];
  const seen = new Set();
  while (result.causes[id] && !seen.has(id)) {
    seen.add(id);
    const edge = result.causes[id];
    chain.push(edge);
    id = edge.to;
  }
  return chain;
}

function update() {
  result = simulate(model, failed);
  for (const [id, button] of nodeButtons) {
    const state = result.states[id];
    button.dataset.state = state;
    button.setAttribute('aria-pressed', String(failed.has(id)));
    button.setAttribute('aria-label', `${byId.get(id).label}. ${labels[state]} in this model. ${failed.has(id) ? 'Restore component' : 'Take component offline'}.`);
    const stateBadge = button.querySelector('.state');
    stateBadge.dataset.state = state;
    stateBadge.textContent = labels[state];
  }
  for (const [id, stateBadge] of journeyBadges) {
    stateBadge.dataset.state = result.states[id];
    stateBadge.textContent = labels[result.states[id]];
  }
  for (const [edge, path] of edgePaths) {
    const state = result.states[edge.to];
    path.setAttribute('stroke', colors[state]);
    path.setAttribute('opacity', state === 'unaffected' ? '.55' : '1');
    path.setAttribute('stroke-width', state === 'unaffected' ? '1.5' : '2.3');
  }
  for (const [scenario, button] of scenarioButtons) button.setAttribute('aria-pressed', String(scenario.down.length === failed.size && scenario.down.every(id => failed.has(id))));
  $('#reset').disabled = failed.size === 0;
  const affected = model.journeys.filter(id => result.states[id] !== 'unaffected');
  $('#status').textContent = failed.size ? `${[...failed].map(id => byId.get(id).label).join(', ')} offline in this rehearsal. ${affected.length} of ${model.journeys.length} user journeys affected in the model.` : 'No failures selected. “Unaffected” describes this model, not the health of a live system.';
  $('#explanation').replaceChildren();
  $('#inspector-state').replaceChildren();
  if (!selected) {
    $('#inspector-title').textContent = 'Start with a failure';
    $('#inspector-summary').textContent = 'Choose a scenario or take a component offline. Every outcome follows a dependency path in the model.';
    $('#explanation-heading').textContent = 'Three kinds of dependency';
    for (const mode of ['required', 'optional', 'unknown']) {
      const edge = model.edges.find(edge => edge.mode === mode);
      if (edge) $('#explanation').append(explanationItem(edge));
    }
    return;
  }
  $('#inspector-title').textContent = byId.get(selected).label;
  $('#inspector-state').append(badge(result.states[selected]));
  $('#inspector-summary').textContent = failed.has(selected) ? 'Manually taken offline in this rehearsal. Other outcomes are propagated through the dependencies below.' : 'This component is restored. Other selected failures may still affect it through its dependencies.';
  $('#explanation-heading').textContent = affected.length ? 'Affected journey paths' : 'Dependency evidence';
  if (affected.length) {
    for (const id of affected) {
      const chain = causeChain(id);
      if (!chain.length) {
        const item = element('li');
        item.append(element('strong', '', `${byId.get(id).label} · offline`), element('p', '', 'This user journey was manually taken offline.'));
        $('#explanation').append(item);
      }
      chain.forEach((edge, i) => $('#explanation').append(explanationItem(edge, i === 0 ? `${byId.get(id).label} · ${labels[result.states[id]]}` : undefined)));
    }
  } else {
    for (const edge of model.edges.filter(edge => edge.from === selected || edge.to === selected)) $('#explanation').append(explanationItem(edge));
  }
}

$('#reset').addEventListener('click', () => { failed.clear(); selected = null; update(); });

function download(name, body, type) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const anchor = element('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#export-notes').addEventListener('click', () => {
  const lines = [`# ${markdownText(model.title)}`, '', 'Modeled impact only. No live services were tested.', '', markdownText(model.description), '', '## Selected outages', '', ...[...failed].map(id => `- ${markdownText(byId.get(id).label)}`)];
  if (!failed.size) lines.push('- None');
  lines.push('', '## User journeys', '');
  for (const id of model.journeys) {
    lines.push(`- ${markdownText(byId.get(id).label)}: ${labels[result.states[id]]}`);
    for (const edge of causeChain(id)) {
      lines.push(`  - ${markdownText(byId.get(edge.from).label)} → ${markdownText(byId.get(edge.to).label)} (${edge.mode}): ${markdownText(edge.reason)}`);
      for (const ref of edge.evidence) lines.push(`    - ${markdownText(ref.path)}:${ref.line}–${ref.endLine}`);
    }
  }
  lines.push('', '## Model boundaries', '', ...model.limitations.map(limit => `- ${markdownText(limit)}`), '', `Cited-file snapshot: ${model.snapshot.fingerprint}`, 'Source locations checked; interpretations require review.', '', 'Made with Faultline: https://github.com/CuiYuYuan1/faultline-skill', '');
  download('faultline-rehearsal.md', lines.join('\n'), 'text/markdown;charset=utf-8');
});

$('#export-model').addEventListener('click', () => {
  const { snapshot, ...editableModel } = model;
  download('faultline.model.json', `${JSON.stringify(editableModel, null, 2)}\n`, 'application/json');
});

update();
