import { readFile, realpath, stat, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function object(value, label) {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function text(value, label, max = 800) {
  requireThat(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${label} must be non-empty text (max ${max} characters)`);
  return value;
}

function list(value, label, min, max) {
  requireThat(Array.isArray(value) && value.length >= min && value.length <= max, `${label} must be an array with ${min}–${max} entries`);
  return value;
}

function id(value, label) {
  requireThat(typeof value === 'string' && /^[a-z][a-z0-9-]{0,47}$/.test(value), `${label} must use lowercase letters, digits and hyphens, starting with a letter`);
  return value;
}

function unique(values, label) {
  requireThat(new Set(values).size === values.length, `${label} must be unique`);
}

export function validateModel(input) {
  object(input, 'model');
  requireThat(input.version === 1, 'version must be 1');
  const title = text(input.title, 'title', 160);
  const description = text(input.description, 'description', 1600);
  const nodes = list(input.nodes, 'nodes', 1, 50).map((node, i) => {
    object(node, `nodes[${i}]`);
    requireThat(Number.isInteger(node.layer) && node.layer >= 0 && node.layer <= 6, `nodes[${i}].layer must be an integer from 0 to 6`);
    return { id: id(node.id, `nodes[${i}].id`), label: text(node.label, `nodes[${i}].label`, 100), layer: node.layer };
  });
  unique(nodes.map(node => node.id), 'node IDs');
  const ids = new Set(nodes.map(node => node.id));
  const edges = list(input.edges, 'edges', 0, 200).map((edge, i) => {
    const label = `edges[${i}]`;
    object(edge, label);
    requireThat(ids.has(edge.from) && ids.has(edge.to), `${label} references an unknown node`);
    requireThat(edge.from !== edge.to, `${label} cannot depend on itself`);
    requireThat(['required', 'optional', 'unknown'].includes(edge.mode), `${label}.mode must be required, optional or unknown`);
    const evidence = list(edge.evidence, `${label}.evidence`, edge.mode === 'unknown' ? 0 : 1, 12).map((ref, j) => {
      const where = `${label}.evidence[${j}]`;
      object(ref, where);
      const path = text(ref.path, `${where}.path`, 300);
      const parts = path.split('/');
      requireThat(!isAbsolute(path) && !/^[a-z]:/i.test(path) && !/[\\\x00-\x1f]/.test(path) && !parts.some(part => ['', '.', '..', '.git'].includes(part)), `${where}.path must be a repository-relative path without traversal`);
      requireThat(Number.isInteger(ref.line) && ref.line >= 1 && ref.line <= 200000, `${where}.line must be a positive integer (max 200000)`);
      const endLine = ref.endLine === undefined ? ref.line : ref.endLine;
      requireThat(Number.isInteger(endLine) && endLine >= ref.line && endLine <= 200000, `${where}.endLine must be an integer at or after line (max 200000)`);
      return { path, line: ref.line, endLine };
    });
    return { from: edge.from, to: edge.to, mode: edge.mode, reason: text(edge.reason, `${label}.reason`), evidence };
  });
  unique(edges.map(edge => `${edge.from}:${edge.to}`), 'edges');
  const journeys = list(input.journeys, 'journeys', 1, 12);
  requireThat(journeys.every(value => typeof value === 'string' && ids.has(value)), 'journeys reference an unknown node');
  unique(journeys, 'journeys');
  const scenarios = list(input.scenarios === undefined ? [] : input.scenarios, 'scenarios', 0, 12).map((scenario, i) => {
    object(scenario, `scenarios[${i}]`);
    const down = list(scenario.down, `scenarios[${i}].down`, 1, 50);
    requireThat(down.every(value => typeof value === 'string' && ids.has(value)), `scenarios[${i}].down references an unknown node`);
    unique(down, `scenarios[${i}].down`);
    return { id: id(scenario.id, `scenarios[${i}].id`), label: text(scenario.label, `scenarios[${i}].label`, 120), down: [...down] };
  });
  unique(scenarios.map(scenario => scenario.id), 'scenario IDs');
  const limitations = list(input.limitations, 'limitations', 1, 20).map((value, i) => text(value, `limitations[${i}]`, 1000));
  return { version: 1, title, description, nodes, edges, journeys: [...journeys], scenarios, limitations };
}

async function checkedModel(modelPath, sourceRoot) {
  requireThat((await stat(modelPath)).size <= 1024 * 1024, 'Model is too large (max 1 MiB)');
  const model = validateModel(JSON.parse(await readFile(modelPath, 'utf8')));
  const root = await realpath(sourceRoot);
  const files = new Map();
  for (const edge of model.edges) {
    for (const ref of edge.evidence) {
      if (!files.has(ref.path)) {
        const target = await realpath(resolve(root, ref.path));
        const rel = relative(root, target);
        requireThat(rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), `Evidence escapes outside source root: ${ref.path}`);
        const info = await stat(target);
        requireThat(info.isFile() && info.size <= 2 * 1024 * 1024, `Evidence must be a file of at most 2 MiB: ${ref.path}`);
        const bytes = await readFile(target);
        const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        const lines = source.length === 0 ? 0 : source.split('\n').length - Number(source.endsWith('\n'));
        files.set(ref.path, { path: ref.path, sha256: createHash('sha256').update(bytes).digest('hex'), lines });
      }
      requireThat(ref.endLine <= files.get(ref.path).lines, `Evidence line does not exist: ${ref.path}:${ref.line}–${ref.endLine}`);
    }
  }
  const records = [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
  const fingerprint = createHash('sha256').update(JSON.stringify(records)).digest('hex');
  return { ...model, snapshot: { fingerprint, files: records } };
}

export async function render(modelPath, sourceRoot, outputPath) {
  const model = await checkedModel(modelPath, sourceRoot);
  const assetRoot = new URL('../assets/', import.meta.url);
  const [template, engine, format, viewer] = await Promise.all(['viewer.html', 'engine.mjs', 'format.mjs', 'viewer.mjs'].map(name => readFile(new URL(name, assetRoot), 'utf8')));
  const safeJson = JSON.stringify(model).replace(/[<>&\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const substitutions = { MODEL: safeJson, ENGINE: engine, FORMAT: format, VIEWER: viewer };
  const html = template.replace(/__FAULTLINE_(MODEL|ENGINE|FORMAT|VIEWER)__/g, (_, key) => substitutions[key]);
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  await writeFile(outputPath, html, { flag: 'wx' });
  return model;
}

const help = `Faultline — source-linked, offline failure maps

Usage:
  node scripts/faultline.mjs check MODEL.json --source REPO
  node scripts/faultline.mjs render MODEL.json --source REPO --out MAP.html

Node.js 22+. No dependencies. Source code is read, never executed.
Paths and line ranges are checked; source semantics are not verified.
Existing output files are preserved; use a new filename to regenerate.
`;

async function main(args) {
  if (args.length === 0 || (args.length === 1 && ['--help', '-h'].includes(args[0]))) {
    process.stdout.write(help);
    return;
  }
  const [command, input, ...rest] = args;
  requireThat(['check', 'render'].includes(command) && input && !input.startsWith('--'), help);
  const options = new Map();
  for (let i = 0; i < rest.length; i += 2) {
    requireThat(['--source', '--out'].includes(rest[i]) && rest[i + 1] && !rest[i + 1].startsWith('--') && !options.has(rest[i]), 'Unknown, duplicate or incomplete option. Use --help.');
    options.set(rest[i], rest[i + 1]);
  }
  requireThat(options.has('--source'), '--source REPO is required');
  requireThat(command === 'render' ? options.has('--out') : !options.has('--out'), command === 'render' ? '--out MAP.html is required' : 'check does not accept --out');
  const model = command === 'render' ? await render(input, options.get('--source'), options.get('--out')) : await checkedModel(input, options.get('--source'));
  process.stdout.write(`${command === 'render' ? `Created ${options.get('--out')}` : 'Model checked'}: ${model.nodes.length} nodes, ${model.edges.length} dependencies, ${model.snapshot.files.length} cited files\nCited-file fingerprint: ${model.snapshot.fingerprint}\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`Faultline: ${error.message}\n`);
    process.exitCode = 1;
  });
}
