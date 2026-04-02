import { Tense, tenseNames } from './conjugate';

export const practicePronouns = ['yo', 'tú', 'él/ella', 'nosotros', 'vosotros', 'ellos/ellas'];

export interface PracticePromptMeta {
  label: string;
  reason: string;
  tint: string;
  background: string;
}

export interface MissedPrompt {
  tense: Tense;
  personIndex: number;
}

export function getPromptMeta(weight: number): PracticePromptMeta {
  if (weight >= 1.8) {
    return {
      label: 'High Priority',
      reason: 'Missed recently',
      tint: '#C62828',
      background: '#FFEBEE',
    };
  }

  if (weight >= 1.2) {
    return {
      label: 'Review',
      reason: 'Still unstable',
      tint: '#B26A00',
      background: '#FFF8E1',
    };
  }

  if (weight <= 0.6) {
    return {
      label: 'Mastered',
      reason: 'Usually correct',
      tint: '#2E7D32',
      background: '#E8F5E9',
    };
  }

  return {
    label: 'In Rotation',
    reason: 'Regular review',
    tint: '#1565C0',
    background: '#E3F2FD',
  };
}

export function summarizeWeakSpot(missedPrompts: MissedPrompt[]): string | null {
  if (missedPrompts.length === 0) return null;

  const tenseCounts = new Map<Tense, number>();
  const personCounts = new Map<number, number>();

  missedPrompts.forEach(prompt => {
    tenseCounts.set(prompt.tense, (tenseCounts.get(prompt.tense) ?? 0) + 1);
    personCounts.set(prompt.personIndex, (personCounts.get(prompt.personIndex) ?? 0) + 1);
  });

  const topTense = Array.from(tenseCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topPerson = Array.from(personCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

  if (topTense && topPerson !== undefined) {
    return `${tenseNames[topTense]} · ${practicePronouns[topPerson]}`;
  }

  if (topTense) return tenseNames[topTense];
  if (topPerson !== undefined) return practicePronouns[topPerson];
  return null;
}
