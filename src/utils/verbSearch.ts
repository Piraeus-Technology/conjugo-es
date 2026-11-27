import Fuse, { type FuseResult } from 'fuse.js';
import verbs from '../data/verbs.json';
import { VerbData, conjugate, allTenses, getBareInfinitive, Tense } from './conjugate';
import { FUSE_CONJUGATION_THRESHOLD, FUSE_INFINITIVE_THRESHOLD } from './constants';

export interface VerbEntry extends VerbData {
  infinitive: string;
  normalizedInfinitive: string;
  normalizedTranslation: string;
  normalizedSenses: string[];
}

export interface ConjMatch {
  infinitive: string;
  translation: string;
  tense: Tense;
  pronoun: string;
  form: string;
  normalizedForm: string;
  tableForm?: string;
}

export function normalizeSearchText(value: string): string {
  return normalizeWrittenForm(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^no\s+/, '');
}

export function normalizeWrittenForm(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const splitGloss = (translation: string) => translation.split(/\s*\/\s*|\s+or\s+(?=to )/);
const withoutGlossAnnotation = (sense: string) => sense.replace(/\s*\([^)]*\)/g, '');

export function getEnglishSenses(translation: string): string[] {
  return splitGloss(translation).map(part => part.startsWith('to ') ? part : `to ${part}`);
}

export const verbEntries: VerbEntry[] = Object.entries(verbs as Record<string, VerbData>).map(
  ([infinitive, data]) => ({
    infinitive,
    normalizedInfinitive: normalizeSearchText(infinitive),
    normalizedTranslation: normalizeSearchText(data.translation),
    normalizedSenses: [...new Set([...getEnglishSenses(data.translation), ...(data.englishSearchAliases ?? [])].flatMap(sense => [
      normalizeSearchText(sense),
      normalizeSearchText(withoutGlossAnnotation(sense)),
    ]))],
    ...data,
  }),
);

const verbFuse = new Fuse(verbEntries, {
  keys: [
    { name: 'infinitive', weight: 2 },
    { name: 'normalizedInfinitive', weight: 2 },
    { name: 'translation', weight: 1 },
    { name: 'normalizedTranslation', weight: 1 },
    { name: 'normalizedSenses', weight: 1 },
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
  writtenScore: number;
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
  query: string,
  options: ConjugationScanOptions = {},
): Promise<ConjugationScanResult> {
  const {
    scheduleYield = yieldToEventLoop,
    batchSize = CONJUGATION_BUILD_BATCH_SIZE,
    shouldCancel = () => false,
    exactOnly = false,
  } = options;
  const normalizedQuery = normalizeSearchText(query);
  const queryLastWord = normalizedQuery.split(' ').at(-1);
  const writtenQuery = normalizeWrittenForm(query);
  const writtenQueryBase = writtenQuery.replace(/^no\s+/, '');
  const negativeQuery = writtenQuery.startsWith('no ');
  const ranked: RankedConjugationMatch[] = [];
  const previous = new Array<number>(normalizedQuery.length + 1);
  const current = new Array<number>(normalizedQuery.length + 1);
  let evaluatedFormCount = 0;
  let yieldCount = 0;

  for (let verbIndex = 0; verbIndex < verbEntries.length; verbIndex += 1) {
    if (shouldCancel()) break;
    const entry = verbEntries[verbIndex];
    const alternate = entry.alternativePastParticiple;
    const participle = alternate && normalizeSearchText(alternate) === queryLastWord
      ? conjugate(entry.infinitive, entry, 'gerund_participle')[1].form
      : undefined;

    for (const tense of allTenses) {
      const results = conjugate(entry.infinitive, entry, tense);
      for (const result of results) {
        if (result.disabled || result.form === '—') continue;

        const lastWordStart = participle ? result.form.lastIndexOf(' ') + 1 : 0;
        const alternateForm = participle && result.form.slice(lastWordStart) === participle
          ? result.form.slice(0, lastWordStart) + alternate
          : undefined;
        const matchingAlternate = result.alternateForms?.find(alternate => normalizeSearchText(alternate) === normalizedQuery);
        const form = matchingAlternate ?? (alternateForm && normalizeSearchText(alternateForm) === normalizedQuery
          ? alternateForm : result.form);
        const normalizedForm = normalizeSearchText(form);
        evaluatedFormCount += 1;
        const score = exactOnly
          ? (normalizedForm === normalizedQuery ? 0 : Infinity)
          : editDistanceScore(normalizedQuery, normalizedForm, previous, current);
        if (score > FUSE_CONJUGATION_THRESHOLD) continue;

        const writtenForm = score === 0 ? normalizeWrittenForm(form) : '';
        const sameSpelling = writtenForm.replace(/^no\s+/, '') === writtenQueryBase;
        const samePolarity = writtenForm.startsWith('no ') === negativeQuery;
        ranked.push({
          score,
          writtenScore: score === 0 ? Number(sameSpelling) * 2 + Number(samePolarity) : 0,
          match: {
            infinitive: entry.infinitive,
            translation: entry.translation,
            tense,
            pronoun: result.pronoun,
            form,
            normalizedForm,
            ...(form !== result.form && { tableForm: result.form }),
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
    second.writtenScore - first.writtenScore ||
    first.match.infinitive.localeCompare(second.match.infinitive),
  );
  return {
    matches: exactOnly ? ranked : ranked.slice(0, FUZZY_MATCH_LIMIT),
    evaluatedFormCount,
    yieldCount,
  };
}

export function searchVerbs(query: string): FuseResult<VerbEntry>[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const exactInfinitives: FuseResult<VerbEntry>[] = [];
  const exactEnglish: { result: FuseResult<VerbEntry>; senseRank: number; reflexive: boolean }[] = [];
  verbEntries.forEach((item, refIndex) => {
    if (item.normalizedInfinitive === normalized) exactInfinitives.push({ item, refIndex, score: 0 });
    else if (isExactEnglishMatch(item, normalized)) {
      const senses = getEnglishSenses(item.translation);
      const writtenSense = item.normalizedTranslation === normalized
        || senses.some(sense => normalizeSearchText(sense) === normalized);
      const annotatedSense = senses.some(sense => normalizeSearchText(withoutGlossAnnotation(sense)) === normalized);
      exactEnglish.push({
        result: { item, refIndex, score: 0 },
        senseRank: writtenSense ? 0 : annotatedSense ? 1 : 2,
        reflexive: getBareInfinitive(item.infinitive) !== item.infinitive,
      });
    }
  });
  exactEnglish.sort((first, second) => first.senseRank - second.senseRank
    || Number(second.reflexive) - Number(first.reflexive));
  const exact = [...exactInfinitives, ...exactEnglish.map(({ result }) => result)];
  const seen = new Set(exact.map(result => result.refIndex));
  return [...exact, ...verbFuse.search(query).filter(result => !seen.has(result.refIndex))];
}

export function isExactEnglishMatch(entry: VerbEntry, normalizedQuery: string): boolean {
  return entry.normalizedTranslation === normalizedQuery || entry.normalizedSenses.includes(normalizedQuery);
}

export async function searchConjugations(
  query: string,
  shouldCancel?: () => boolean,
): Promise<FuseResult<ConjMatch>[]> {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const scan = await scanConjugations(query, {
    shouldCancel,
    exactOnly: normalizedQuery.length < 3,
  });
  return scan.matches.map(({ match, score }, refIndex) => ({
    item: match,
    refIndex,
    score,
  }));
}

export async function getExactConjugationMatches(normalizedQuery: string): Promise<ConjMatch[]> {
  if (!normalizedQuery) return [];
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
  const scan = await scanConjugations(query, {
    scheduleYield,
    batchSize,
    exactOnly: normalizeSearchText(query).length < 3,
  });
  return {
    evaluatedFormCount: scan.evaluatedFormCount,
    retainedMatchCount: scan.matches.length,
    yieldCount: scan.yieldCount,
  };
}
