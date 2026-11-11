import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../assets/engine.mjs';

const graph = {
  nodes: ['checkout', 'orders', 'db', 'recommendations', 'payments', 'other'].map(id => ({ id })),
  edges: [
    { from: 'checkout', to: 'orders', mode: 'required' },
    { from: 'orders', to: 'db', mode: 'required' },
    { from: 'orders', to: 'recommendations', mode: 'optional' },
    { from: 'orders', to: 'payments', mode: 'unknown' },
  ],
};

test('a required outage blocks upstream journeys, not unrelated components', () => {
  const { states, causes } = simulate(graph, ['db']);
  assert.equal(states.db, 'offline');
  assert.equal(states.orders, 'blocked');
  assert.equal(states.checkout, 'blocked');
  assert.equal(states.other, 'unaffected');
  assert.deepEqual(causes.orders, graph.edges[1]);
});

test('an optional outage degrades callers transitively', () => {
  const { states } = simulate(graph, ['recommendations']);
  assert.equal(states.orders, 'degraded');
  assert.equal(states.checkout, 'degraded');
});

test('an unresolved dependency remains unknown upstream', () => {
  const { states } = simulate(graph, ['payments']);
  assert.equal(states.orders, 'unknown');
  assert.equal(states.checkout, 'unknown');
});

test('a definite block wins over uncertainty and optional degradation', () => {
  const { states } = simulate(graph, ['recommendations', 'payments', 'db']);
  assert.equal(states.orders, 'blocked');
  assert.equal(states.checkout, 'blocked');
});

test('cycles terminate and a manually failed node stays offline', () => {
  const cycle = { nodes: graph.nodes, edges: [...graph.edges, { from: 'orders', to: 'checkout', mode: 'required' }] };
  const { states } = simulate(cycle, ['db', 'checkout']);
  assert.equal(states.orders, 'blocked');
  assert.equal(states.checkout, 'offline');
});

test('an empty failure set resets every modeled component', () => {
  assert.ok(Object.values(simulate(graph, []).states).every(state => state === 'unaffected'));
});

test('a component named constructor does not acquire a phantom cause', () => {
  const special = { nodes: [{ id: 'constructor' }], edges: [] };
  const result = simulate(special, ['constructor']);
  assert.equal(result.states.constructor, 'offline');
  assert.equal(result.causes.constructor, undefined);
});
