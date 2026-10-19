import { mapChangeImpact } from './change-impact-mapper.js';
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
/** Structured local diagnostic events with parent/dependency links. Rankings are
 * heuristics supported by recorded evidence, never proof of causal certainty.
 * Hashes are supplied by the trusted artifact adapter; no hash is invented here.
 */
export function createFailureAtlas({ runId, dependencies = {}, maxEvents = 1000 } = {}) {
  if (!nonempty(runId)) throw new TypeError('runId is required');
  if (!Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 10000) throw new TypeError('maxEvents must be 1..10000');
  if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) throw new TypeError('dependencies must be a map');
  for (const [id, inputs] of Object.entries(dependencies)) if (!nonempty(id) || !Array.isArray(inputs) || !inputs.every(nonempty)) throw new TypeError('Invalid dependency map');
  const dependencyMap = structuredClone(dependencies), events = [];
  return {
    record(event) {
      if (events.length >= maxEvents) throw new Error('Event capacity exceeded');
      if (!event || !nonempty(event.id) || !nonempty(event.type) || !['pass', 'fail', 'changed', 'info'].includes(event.outcome) || !Number.isFinite(event.time)) throw new TypeError('Event requires id, type, outcome and finite time');
      if (event.runId !== undefined && event.runId !== runId) throw new Error('Event belongs to a different run');
      if (events.some(item => item.id === event.id)) throw new Error('Duplicate event ID');
      if (events.length && event.time < events.at(-1).time) throw new Error('Events must be chronological');
      if (event.parentId && !events.some(item => item.id === event.parentId)) throw new Error('Parent must refer to an earlier event');
      if (event.artifacts !== undefined && (!Array.isArray(event.artifacts) || !event.artifacts.every(nonempty))) throw new TypeError('artifacts must be nonempty IDs');
      const entry = structuredClone({ ...event, runId, artifacts: event.artifacts ?? [] });
      events.push(entry); return structuredClone(entry);
    },
    diagnose(failedEventId) {
      const failedIndex = events.findIndex(event => event.id === failedEventId), failed = events[failedIndex];
      if (!failed || failed.outcome !== 'fail') throw new Error('Select a recorded failing event');
      const parents = new Set(); let parent = failed.parentId;
      while (parent) { parents.add(parent); parent = events.find(event => event.id === parent)?.parentId; }
      const candidates = events.slice(0, failedIndex).flatMap((event, index) => {
        if (event.outcome !== 'changed' && event.outcome !== 'fail') return [];
        const affected = mapChangeImpact({ changedArtifacts: event.artifacts, dependencies: dependencyMap }).affectedArtifacts;
        const shared = failed.artifacts.filter(id => affected.includes(id));
        const evidence = [];
        if (shared.length) evidence.push({ kind: 'dependency', artifacts: shared });
        if (parents.has(event.id)) evidence.push({ kind: 'parent-chain', eventId: event.id });
        if (event.beforeHash && event.afterHash && event.beforeHash !== event.afterHash) evidence.push({ kind: 'hash-change', before: event.beforeHash, after: event.afterHash });
        if (failed.errorType && event.errorType === failed.errorType) evidence.push({ kind: 'matching-error', errorType: failed.errorType });
        // Hash changes without a dependency or parent link do not explain this check.
        if (!shared.length && !parents.has(event.id)) return [];
        const score = shared.length * 4 + (parents.has(event.id) ? 3 : 0) + (evidence.some(item => item.kind === 'hash-change') ? 2 : 0) + (event.outcome === 'fail' ? 1 : 0);
        return [{ eventId: event.id, time: event.time, score, evidence, order: index, recommendation: shared.length ? `Inspect ${event.artifacts.join(', ')} and rerun checks for ${shared.join(', ')}` : 'Inspect this prerequisite before retrying its dependent step' }];
      }).sort((a, b) => b.score - a.score || a.order - b.order);
      const linked = candidates.map(({ order, ...item }) => item);
      const earliest = [...candidates].sort((a, b) => a.order - b.order)[0];
      return { runId, failedEventId, likelyCauses: linked, firstSuspiciousEvent: earliest?.eventId ?? null, rerunArtifacts: [...new Set(candidates.flatMap(item => item.evidence.filter(e => e.kind === 'dependency').flatMap(e => e.artifacts)))], limitation: 'Correlation and declared dependencies rank plausible causes; this report does not establish causal certainty.' };
    },
    events: () => structuredClone(events),
    toJSONL: () => events.map(event => JSON.stringify(event)).join('\n'),
  };
}
/** Parse and validate chronological JSONL, rejecting malformed or cross-run data. */
export function parseTrace(jsonl, options = {}) {
  if (typeof jsonl !== 'string' || jsonl.length > 2000000) throw new TypeError('JSONL must be a string under 2 MB');
  const lines = jsonl.split('\n').filter(line => line.trim());
  if (!lines.length) throw new Error('Trace is empty');
  const entries = lines.map(line => JSON.parse(line));
  const atlas = createFailureAtlas({ ...options, runId: options.runId ?? entries[0].runId });
  entries.forEach(event => atlas.record(event)); return atlas;
}
