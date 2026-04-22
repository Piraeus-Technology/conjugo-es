import Fuse, { type FuseResult } from 'fuse.js';
import verbs from '../data/verbs.json';
import { VerbData, conjugate, allTenses, Tense } from './conjugate';
import { FUSE_CONJUGATION_THRESHOLD, FUSE_INFINITIVE_THRESHOLD } from './constants';

export interface VerbEntry extends VerbData {
  infinitive: string;
  normalizedInfinitive: string;
  normalizedTranslation: string;
}

export interface ConjMatch {
  infinitive: string;
  translation: string;
  tense: Tense;
  pronoun: string;
  form: string;
  normalizedForm: string;
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^no\s+/, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const verbEntries: VerbEntry[] = Object.entries(verbs as Record<string, VerbData>).map(
  ([infinitive, data]) => ({
    infinitive,
    normalizedInfinitive: normalizeSearchText(infinitive),
    normalizedTranslation: normalizeSearchText(data.translation),
    ...data,
  }),
);

const verbFuse = new Fuse(verbEntries, {
  keys: [
    { name: 'infinitive', weight: 2 },
    { name: 'normalizedInfinitive', weight: 2 },
    { name: 'translation', weight: 1 },
    { name: 'normalizedTranslation', weight: 1 },
  ],
  threshold: FUSE_INFINITIVE_THRESHOLD,
  ignoreLocation: true,
});

// Conjugation index is ~96k rows (1000 verbs × 16 tenses × ~6 forms). Build
// lazily so the first Search tab open stays instant; subsequent searches reuse.
let conjugationIndex: ConjMatch[] | null = null;
let conjFuse: Fuse<ConjMatch> | null = null;

function getConjugationIndex(): ConjMatch[] {
  if (conjugationIndex) return conjugationIndex;
  const index: ConjMatch[] = [];
  verbEntries.forEach((entry) => {
    allTenses.forEach((tense) => {
      const results = conjugate(entry.infinitive, entry, tense);
      results.forEach((r) => {
        if (!r.disabled && r.form !== '—') {
          const cleanForm = r.form.replace(/^no\s+/, '');
          index.push({
            infinitive: entry.infinitive,
            translation: entry.translation,
            tense,
            pronoun: r.pronoun,
            form: cleanForm,
            normalizedForm: normalizeSearchText(cleanForm),
          });
        }
      });
    });
  });
  conjugationIndex = index;
  return conjugationIndex;
}

function getConjFuse(): Fuse<ConjMatch> {
  if (conjFuse) return conjFuse;
  conjFuse = new Fuse(getConjugationIndex(), {
    keys: [
      { name: 'form', weight: 1 },
      { name: 'normalizedForm', weight: 2 },
    ],
    threshold: FUSE_CONJUGATION_THRESHOLD,
    ignoreLocation: true,
  });
  return conjFuse;
}

export function searchVerbs(query: string): FuseResult<VerbEntry>[] {
  return verbFuse.search(query);
}

export function searchConjugations(query: string): FuseResult<ConjMatch>[] {
  if (normalizeSearchText(query).length < 3) return [];
  return getConjFuse().search(query);
}

export function getExactConjugationMatches(normalizedQuery: string): ConjMatch[] {
  if (normalizedQuery.length < 3) return [];
  return getConjugationIndex().filter((c) => c.normalizedForm === normalizedQuery);
}
