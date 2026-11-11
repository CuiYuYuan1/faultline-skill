const rank = { unaffected: 0, degraded: 1, unknown: 2, blocked: 3, offline: 4 };

// Edges point from caller to dependency; failures travel in the opposite direction.
export function simulate(model, failedIds) {
  const states = Object.fromEntries(model.nodes.map(node => [node.id, 'unaffected']));
  const causes = Object.create(null);
  const callers = new Map(model.nodes.map(node => [node.id, []]));
  for (const edge of model.edges) callers.get(edge.to).push(edge);
  const queue = [...new Set(failedIds)];
  for (const id of queue) {
    if (!callers.has(id)) throw new Error(`Unknown outage target: ${id}`);
    states[id] = 'offline';
  }
  for (let i = 0; i < queue.length; i++) {
    const dependency = queue[i];
    for (const edge of callers.get(dependency)) {
      let next;
      if (states[dependency] === 'unknown' || edge.mode === 'unknown') next = 'unknown';
      else if (states[dependency] === 'degraded' || edge.mode === 'optional') next = 'degraded';
      else next = 'blocked';
      // Each node can rise only four times, including in cyclic graphs.
      if (rank[next] > rank[states[edge.from]]) {
        states[edge.from] = next;
        causes[edge.from] = edge;
        queue.push(edge.from);
      }
    }
  }
  return { states, causes };
}
