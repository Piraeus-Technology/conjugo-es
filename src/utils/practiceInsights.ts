import { Tense, tenseNames } from './conjugate';
import { practicePronouns } from './practiceFeedback';
import { INSIGHT_RANK_LIMIT, INSIGHT_WEAK_FORM_LIMIT } from './constants';

type WeightMap = Record<string, number>;

interface PromptWeightEntry {
  verb: string;
  tense: Tense;
  personIndex: number;
  weight: number;
}

interface RankedInsight {
  label: string;
  weight: number;
  count?: number;
}

export interface PracticeInsights {
  weakForms: RankedInsight[];
  weakTenses: RankedInsight[];
  weakPersons: RankedInsight[];
  weakVerbs: RankedInsight[];
}

function isTense(value: string): value is Tense {
  return Object.prototype.hasOwnProperty.call(tenseNames, value);
}

export function parsePromptWeights(weights: WeightMap): PromptWeightEntry[] {
  return Object.entries(weights)
    .map(([key, weight]) => {
      const [verb, tense, person] = key.split('::');
      const personIndex = Number(person);
      if (
        !verb ||
        !tense ||
        !Number.isInteger(personIndex) ||
        personIndex < 0 ||
        personIndex >= practicePronouns.length ||
        !isTense(tense)
      ) {
        return null;
      }
      return { verb, tense, personIndex, weight };
    })
    .filter((entry): entry is PromptWeightEntry => entry !== null);
}

function rankGroupedWeights(entries: PromptWeightEntry[], keyFn: (entry: PromptWeightEntry) => string): RankedInsight[] {
  const grouped = new Map<string, { total: number; count: number }>();

  entries.forEach(entry => {
    const key = keyFn(entry);
    const current = grouped.get(key) ?? { total: 0, count: 0 };
    current.total += entry.weight;
    current.count += 1;
    grouped.set(key, current);
  });

  return Array.from(grouped.entries())
    .map(([label, value]) => ({
      label,
      weight: value.total / value.count,
      count: value.count,
    }))
    .sort((a, b) => b.weight - a.weight || (b.count ?? 0) - (a.count ?? 0))
    .slice(0, INSIGHT_RANK_LIMIT);
}

export function buildPracticeInsights(weights: WeightMap): PracticeInsights {
  const promptWeights = parsePromptWeights(weights);
  const challengingPrompts = promptWeights.filter(entry => entry.weight > 1);

  return {
    weakForms: [...challengingPrompts]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, INSIGHT_WEAK_FORM_LIMIT)
      .map(entry => ({
        label: `${entry.verb} · ${tenseNames[entry.tense]} · ${practicePronouns[entry.personIndex]}`,
        weight: entry.weight,
      })),
    weakTenses: rankGroupedWeights(challengingPrompts, entry => tenseNames[entry.tense]),
    weakPersons: rankGroupedWeights(challengingPrompts, entry => practicePronouns[entry.personIndex]),
    weakVerbs: rankGroupedWeights(challengingPrompts, entry => entry.verb),
  };
}
