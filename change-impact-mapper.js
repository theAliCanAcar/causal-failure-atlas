/**
 * Traverse reverse dependencies to map a change to affected artifacts and checks.
 * dependencies maps artifact IDs to the artifact IDs they depend on.
 * criteria/tests are [{id, artifactIds: [...]}]. Cycles are supported.
 */
export function mapChangeImpact({ changedArtifacts, dependencies = {}, criteria = [], tests = [] }) {
  if (!Array.isArray(changedArtifacts)) throw new TypeError('changedArtifacts must be an array');
  const affected = new Set(changedArtifacts);
  const queue = [...affected];
  while (queue.length) {
    const changed = queue.shift();
    for (const [artifactId, inputs] of Object.entries(dependencies)) {
      if (!Array.isArray(inputs)) throw new TypeError('Dependency values must be arrays');
      if (inputs.includes(changed) && !affected.has(artifactId)) { affected.add(artifactId); queue.push(artifactId); }
    }
  }
  const touches = item => (item.artifactIds ?? (item.artifactId ? [item.artifactId] : [])).some(id => affected.has(id));
  return { affectedArtifacts: [...affected].sort(), affectedCriteria: criteria.filter(touches).map(item => item.id).sort(), affectedTests: tests.filter(touches).map(item => item.id).sort() };
}
export function createChangeImpactMapper(config = {}) {
  return { map: changedArtifacts => mapChangeImpact({ ...config, changedArtifacts }) };
}
