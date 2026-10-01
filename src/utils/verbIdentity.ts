// Dataset corrections from the 1.2.1 review. Keep these aliases so existing
// local favorites, history and prompt weights survive infinitive renames.
const renamedVerbs: Record<string, string> = { aconsolar: 'aconsejar', tañir: 'tañer' };

export function resolveVerbIdentity(infinitive: string): string {
  return Object.prototype.hasOwnProperty.call(renamedVerbs, infinitive)
    ? renamedVerbs[infinitive] : infinitive;
}

export function migrateVerbList(verbs: string[]): string[] {
  return [...new Set(verbs.map(resolveVerbIdentity))];
}

export function migrateVerbWeights(weights: Record<string, number>): Record<string, number> {
  const migrated: Record<string, number> = Object.create(null);
  for (const [key, weight] of Object.entries(weights)) {
    const [verb, ...prompt] = key.split('::');
    const renamedKey = [resolveVerbIdentity(verb), ...prompt].join('::');
    // Collisions preserve the stronger difficulty signal rather than
    // depending on JSON ordering or treating weights as additive counts.
    migrated[renamedKey] = Math.max(migrated[renamedKey] ?? 0, weight);
  }
  return migrated;
}
