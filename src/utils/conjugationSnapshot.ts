import { conjugate, imperativeTenses, type Tense, type VerbData } from './conjugate';

export function getSnapshotRows(infinitive: string, verb: VerbData, tense: Tense | null) {
  const targetTense = tense ?? 'present';
  const rows = conjugate(infinitive, verb, targetTense)
    .map((row, index) => ({ ...row, index }))
    .filter(row => !row.disabled && row.form !== '—');
  if (targetTense === 'gerund_participle') return rows;
  const indices = imperativeTenses.includes(targetTense) ? [1, 2, 3] : [0, 2, 3];
  const preferred = indices.flatMap(index => {
    const row = rows.find(row => row.index === index);
    return row ? [row] : [];
  });
  return preferred.length > 0 ? preferred : rows.slice(0, 3);
}
