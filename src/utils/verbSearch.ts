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

const CONJUGATION_BUILD_BATCH_SIZE = 12;
const FUZZY_MATCH_LIMIT = 1000;

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface ConjugationScanOptions {
  scheduleYield?: () => Promise<void>;
  batchSize?: number;
  shouldCancel?: () => boolean;
  exactOnly?: boolean;
}

interface RankedConjugationMatch {
  match: ConjMatch;
  score: number;
}

interface ConjugationScanResult {
  matches: RankedConjugationMatch[];
  evaluatedFormCount: number;
  yieldCount: number;
}

function editDistanceScore(
  query: string,
  candidate: string,
  previous: number[],
  current: number[],
): number {
  if (query === candidate) return 0;

  const longest = Math.max(query.length, candidate.length);
  if (
    candidate.startsWith(query) ||
    query.startsWith(candidate) ||
    candidate.includes(query)
  ) {
    return Math.abs(candidate.length - query.length) / (longest * 2);
  }

  const maximumDistance = Math.floor(longest * FUSE_CONJUGATION_THRESHOLD);
  if (Math.abs(query.length - candidate.length) > maximumDistance) return Infinity;

  for (let column = 0; column <= query.length; column += 1) {
    previous[column] = column;
  }

  for (let row = 1; row <= candidate.length; row += 1) {
    current[0] = row;
    let rowMinimum = current[0];
    for (let column = 1; column <= query.length; column += 1) {
      const substitutionCost = candidate[row - 1] === query[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + substitutionCost,
      );
      rowMinimum = Math.min(rowMinimum, current[column]);
    }
    if (rowMinimum > maximumDistance) return Infinity;
    [previous, current] = [current, previous];
  }

  const distance = previous[query.length];
  return distance <= maximumDistance ? distance / longest : Infinity;
}

async function scanConjugations(
  normalizedQuery: string,
  options: ConjugationScanOptions = {},
): Promise<ConjugationScanResult> {
  const {
    scheduleYield = yieldToEventLoop,
    batchSize = CONJUGATION_BUILD_BATCH_SIZE,
    shouldCancel = () => false,
    exactOnly = false,
  } = options;
  const ranked: RankedConjugationMatch[] = [];
  const previous = new Array<number>(normalizedQuery.length + 1);
  const current = new Array<number>(normalizedQuery.length + 1);
  let evaluatedFormCount = 0;
  let yieldCount = 0;

  for (let verbIndex = 0; verbIndex < verbEntries.length; verbIndex += 1) {
    if (shouldCancel()) break;
    const entry = verbEntries[verbIndex];

    for (const tense of allTenses) {
      const results = conjugate(entry.infinitive, entry, tense);
      for (const result of results) {
        if (result.disabled || result.form === '—') continue;

        const form = result.form.replace(/^no\s+/, '');
        const normalizedForm = normalizeSearchText(form);
        evaluatedFormCount += 1;
        const score = exactOnly
          ? (normalizedForm === normalizedQuery ? 0 : Infinity)
          : editDistanceScore(normalizedQuery, normalizedForm, previous, current);
        if (score > FUSE_CONJUGATION_THRESHOLD) continue;

        ranked.push({
          score,
          match: {
            infinitive: entry.infinitive,
            translation: entry.translation,
            tense,
            pronoun: result.pronoun,
            form,
            normalizedForm,
          },
        });
      }
    }

    if ((verbIndex + 1) % batchSize === 0) {
      yieldCount += 1;
      await scheduleYield();
    }
  }

  ranked.sort((first, second) =>
    first.score - second.score ||
    first.match.infinitive.localeCompare(second.match.infinitive),
  );
  return {
    matches: exactOnly ? ranked : ranked.slice(0, FUZZY_MATCH_LIMIT),
    evaluatedFormCount,
    yieldCount,
  };
}

export function searchVerbs(query: string): FuseResult<VerbEntry>[] {
  return verbFuse.search(query);
}

export async function searchConjugations(
  query: string,
  shouldCancel?: () => boolean,
): Promise<FuseResult<ConjMatch>[]> {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 3) return [];

  const scan = await scanConjugations(normalizedQuery, { shouldCancel });
  return scan.matches.map(({ match, score }, refIndex) => ({
    item: match,
    refIndex,
    score,
  }));
}

export async function getExactConjugationMatches(normalizedQuery: string): Promise<ConjMatch[]> {
  if (normalizedQuery.length < 3) return [];
  const scan = await scanConjugations(normalizedQuery, { exactOnly: true });
  return scan.matches.map(({ match }) => match);
}

export interface ConjugationSearchStats {
  evaluatedFormCount: number;
  retainedMatchCount: number;
  yieldCount: number;
}

export async function __searchConjugationsForTests(
  query: string,
  scheduleYield: () => Promise<void>,
  batchSize = CONJUGATION_BUILD_BATCH_SIZE,
): Promise<ConjugationSearchStats> {
  const scan = await scanConjugations(normalizeSearchText(query), {
    scheduleYield,
    batchSize,
  });
  return {
    evaluatedFormCount: scan.evaluatedFormCount,
    retainedMatchCount: scan.matches.length,
    yieldCount: scan.yieldCount,
  };
}
