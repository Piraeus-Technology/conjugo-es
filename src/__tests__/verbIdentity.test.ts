import AsyncStorage from '@react-native-async-storage/async-storage';
import verbs from '../data/verbs.json';
import { useFavoritesStore, __resetFavoritesStoreForTests } from '../store/favoritesStore';
import { useHistoryStore, __resetHistoryStoreForTests } from '../store/historyStore';
import { useSpacedRepStore, __resetSpacedRepStoreForTests } from '../store/spacedRepStore';
import { migrateVerbList, migrateVerbWeights } from '../utils/verbIdentity';
import { buildPracticeInsights } from '../utils/practiceInsights';
import { CORE_PRACTICE_VERBS } from '../utils/constants';
import { conjugate, type VerbData } from '../utils/conjugate';
import { auditExamples, exampleContainsVerbForm } from '../utils/exampleAudit';

const dataset = verbs as Record<string, VerbData>;

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }),
}));

beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();
  __resetFavoritesStoreForTests();
  __resetHistoryStoreForTests();
  __resetSpacedRepStoreForTests();
});

test('renamed favorites and history migrate on disk and preserve their order', async () => {
  mockStorage.set('favorites', JSON.stringify(['aconsolar', 'aconsejar', 'tañir', 'hablar']));
  mockStorage.set('verb_history', JSON.stringify(['tañir', 'aconsolar', 'hablar']));
  await useFavoritesStore.getState().loadFavorites();
  await useHistoryStore.getState().loadHistory();
  expect(useFavoritesStore.getState().favorites).toEqual(['aconsejar', 'tañer', 'hablar']);
  expect(useHistoryStore.getState().history).toEqual(['tañer', 'aconsejar', 'hablar']);
  expect(JSON.parse(mockStorage.get('favorites')!)).toEqual(['aconsejar', 'tañer', 'hablar']);
  expect(JSON.parse(mockStorage.get('verb_history')!)).toEqual(['tañer', 'aconsejar', 'hablar']);
});

test('legacy and prompt weights migrate, retaining the strongest colliding weight', async () => {
  const original = { tañir: 2, tañer: 1, 'aconsolar::present::0': 3, 'aconsejar::present::0': 1 };
  const expected = { tañer: 2, 'aconsejar::present::0': 3 };
  expect(migrateVerbWeights(original)).toEqual(expected);
  mockStorage.set('spaced_rep_weights', JSON.stringify(original));
  await useSpacedRepStore.getState().loadWeights();
  expect(useSpacedRepStore.getState().weights).toEqual(expected);
  expect(JSON.parse(mockStorage.get('spaced_rep_weights')!)).toEqual(expected);
});

test('unknown stored verbs stay recoverable but are excluded from practice insights', () => {
  expect(migrateVerbList(['removed-verb', 'aconsolar'])).toEqual(['removed-verb', 'aconsejar']);
  const insights = buildPracticeInsights({ 'removed-verb::present::0': 5, 'hablar::present::0': 2 });
  expect(insights.weakForms).toHaveLength(1);
  expect(insights.weakVerbs.map(verb => verb.label)).toEqual(['hablar']);
});

test('a failed rename migration refuses subsequent writes and preserves stored data', async () => {
  mockStorage.set('favorites', JSON.stringify(['aconsolar']));
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
  try {
    await useFavoritesStore.getState().loadFavorites();
    expect(useFavoritesStore.getState()).toMatchObject({ loaded: false, loadError: true });
    expect(JSON.parse(mockStorage.get('favorites')!)).toEqual(['aconsolar']);
  } finally {
    warning.mockRestore();
  }
});

test('every verb named in a practice constant exists in the shipped dataset', () => {
  expect(CORE_PRACTICE_VERBS.filter(word => !Object.prototype.hasOwnProperty.call(verbs, word))).toEqual([]);
});

test('corrected entries and examples agree with the shipped conjugation engine', () => {
  expect('aconsolar' in verbs).toBe(false);
  expect('tañir' in verbs).toBe(false);
  expect(verbs.aconsejar.translation).toBe('to advise');
  expect(verbs.aconsejar.level).toBe('B1');
  expect(verbs.amanecer.examples[0]).toBe('Amaneció nublado en la montaña.');
  expect(exampleContainsVerbForm('aconsejar', dataset.aconsejar, 'Aconséjale que descanse más.')).toBe(true);
  expect(conjugate('tañer', dataset.tañer, 'preterite').map(row => row.form))
    .toEqual(['tañí', 'tañiste', 'tañó', 'tañimos', 'tañisteis', 'tañeron']);
  expect(conjugate('tañer', dataset.tañer, 'subjunctive_imperfect')[0].form).toBe('tañera');
  expect(conjugate('tañer', dataset.tañer, 'gerund_participle')[0].form).toBe('tañendo');
  expect(verbs.gustar.level).toBe('A1');
  expect(verbs.gravar.translation).toBe('to tax');
  expect(verbs.conseguir.level).toBe('A2');
  expect(verbs.amanecer.impersonal).toBe(true);
  expect(auditExamples(dataset)).toEqual([]);
});
