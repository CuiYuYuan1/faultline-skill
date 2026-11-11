import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateModel, render } from '../scripts/faultline.mjs';

function model() {
  return {
    version: 1, title: 'Test map', description: 'Only the sample request is modeled.',
    nodes: [{ id: 'web', label: 'Web', layer: 0 }, { id: 'db', label: 'Database', layer: 1 }],
    edges: [{ from: 'web', to: 'db', mode: 'required', reason: 'The call awaits the database without a fallback.', evidence: [{ path: 'app.mjs', line: 1 }] }],
    journeys: ['web'], scenarios: [{ id: 'db-down', label: 'Database outage', down: ['db'] }],
    limitations: ['Database capacity and latency are not modeled.'],
  };
}

test('valid models retain arbitrary display text as data', () => {
  const m = model();
  m.title = '</script><script>globalThis.injected = true</script>';
  assert.equal(validateModel(m).title, m.title);
});

for (const [label, change] of [
  ['duplicate node IDs', m => m.nodes.push({ ...m.nodes[0] })],
  ['unknown endpoint', m => m.edges[0].to = 'missing'],
  ['invalid edge mode', m => m.edges[0].mode = 'probably'],
  ['evidence-free certainty', m => m.edges[0].evidence = []],
  ['non-integer source line', m => m.edges[0].evidence[0].line = 1.5],
  ['empty scope', m => m.description = ''],
  ['path traversal', m => m.edges[0].evidence[0].path = '../private.mjs'],
  ['absolute evidence path', m => m.edges[0].evidence[0].path = '/etc/passwd'],
  ['invalid journey', m => m.journeys = ['missing']],
  ['non-array scenarios', m => m.scenarios = {}],
  ['null scenarios', m => m.scenarios = null],
  ['null end line', m => m.edges[0].evidence[0].endLine = null],
  ['unknown outage target', m => m.scenarios[0].down = ['missing']],
  ['duplicate edge', m => m.edges.push({ ...m.edges[0] })],
  ['reserved node ID', m => m.nodes[0].id = '__proto__'],
  ['unbounded nodes', m => m.nodes = Array.from({ length: 51 }, (_, i) => ({ id: `node-${i}`, label: 'Node', layer: 0 }))],
]) {
  test(`rejects ${label}`, () => {
    const m = model();
    change(m);
    assert.throws(() => validateModel(m), /.+/);
  });
}

test('unknown edges can retain an explicit unresolved question without evidence', () => {
  const m = model();
  m.edges[0].mode = 'unknown';
  m.edges[0].evidence = [];
  assert.equal(validateModel(m).edges[0].mode, 'unknown');
});

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'faultline-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const root = join(dir, 'source');
  await mkdir(root);
  await writeFile(join(root, 'app.mjs'), 'export const sample = 1;\n');
  const input = join(dir, 'model.json');
  await writeFile(input, JSON.stringify(model()));
  return { dir, root, input, output: join(dir, 'map.html') };
}

test('renders a standalone page with a source fingerprint and inert embedded JSON', async t => {
  const f = await fixture(t);
  const m = model();
  m.title = '</script><script>globalThis.injected = true</script>';
  await writeFile(f.input, JSON.stringify(m));
  const result = await render(f.input, f.root, f.output);
  const html = await readFile(f.output, 'utf8');
  assert.match(html, /<!doctype html>/i);
  assert.ok(!html.includes(m.title));
  assert.match(html, /\\u003c\/script/);
  assert.match(result.snapshot.files[0].sha256, /^[a-f0-9]{64}$/);
  assert.match(html, /type="module"/);
  assert.ok(!html.includes('src="https://'));
});

test('does not overwrite an existing output', async t => {
  const f = await fixture(t);
  await writeFile(f.output, 'keep me');
  await assert.rejects(render(f.input, f.root, f.output), /exist/i);
  assert.equal(await readFile(f.output, 'utf8'), 'keep me');
});

test('template-shaped model text is preserved without a second substitution', async t => {
  const f = await fixture(t);
  const m = model();
  m.title = '__FAULTLINE_ENGINE__ and __FAULTLINE_VIEWER__';
  await writeFile(f.input, JSON.stringify(m));
  await render(f.input, f.root, f.output);
  const html = await readFile(f.output, 'utf8');
  const embedded = html.match(/id="faultline-model">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(embedded).title, m.title);
});

test('rejects source lines beyond the file', async t => {
  const f = await fixture(t);
  const m = model();
  m.edges[0].evidence[0].line = 500;
  await writeFile(f.input, JSON.stringify(m));
  await assert.rejects(render(f.input, f.root, f.output), /line/i);
});

test('rejects evidence symlinks that escape the source root', async t => {
  const f = await fixture(t);
  await writeFile(join(f.dir, 'outside.mjs'), 'private\n');
  await symlink(join(f.dir, 'outside.mjs'), join(f.root, 'escape.mjs'));
  const m = model();
  m.edges[0].evidence[0].path = 'escape.mjs';
  await writeFile(f.input, JSON.stringify(m));
  await assert.rejects(render(f.input, f.root, f.output), /outside|escape/i);
});
