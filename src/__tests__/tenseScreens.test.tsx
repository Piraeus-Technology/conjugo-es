import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ConjugationScreen from '../screens/ConjugationScreen';
import HomeScreen from '../screens/HomeScreen';
import PracticeSettingsScreen from '../screens/PracticeSettingsScreen';
import {
  __resetPracticeSettingsStoreForTests,
  usePracticeSettingsStore,
} from '../store/practiceSettingsStore';
import type { ConjugationScreenProps } from '../types/navigation';
import { allTenses, practiceTenses, tenseNames, type Tense } from '../utils/conjugate';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => ({}),
  useRoute: () => ({ params: { mode: 'quiz' } }),
}));

const navigate = jest.fn<void, ['Conjugation', ConjugationScreenProps['route']['params']]>();
const navigation = { navigate } as unknown as ConjugationScreenProps['navigation'];

test('the conjugation picker and Practice settings list every supported tense in order', () => {
  const verb = render(<ConjugationScreen
    navigation={navigation}
    route={{ key: 'verb', name: 'Conjugation', params: { infinitive: 'hablar' } }}
  />);
  expect(verb.getAllByRole('button', { name: / conjugations$/ }).map(button => button.props.accessibilityLabel))
    .toEqual(allTenses.map(tense => `${tenseNames[tense]} conjugations`));
  verb.unmount();

  usePracticeSettingsStore.setState({ activeTenses: [...practiceTenses], loaded: true });
  const settings = render(<PracticeSettingsScreen />);
  const groupLabels: Partial<Record<Tense, string>> = {
    subjunctive_present: 'Subjunctive: Present',
    subjunctive_imperfect: 'Subjunctive: Imperfect',
    imperative_affirmative: 'Imperative: Affirmative',
    imperative_negative: 'Imperative: Negative',
  };
  const tenseRows = settings.getAllByRole('checkbox', { name: /^(Indicative|Subjunctive|Imperative|Compound|Progressive):/ });
  expect(tenseRows.map(row => row.props.accessibilityLabel.replace(/^(Indicative|Compound|Progressive): /, '')))
    .toEqual(practiceTenses.map(tense => groupLabels[tense] ?? tenseNames[tense]));
  expect(settings.getByRole('checkbox', { name: 'Compound: Subjunctive Present Perfect' })).toBeChecked();
  expect(settings.getByRole('checkbox', { name: 'Compound: Subjunctive Past Perfect' })).toBeChecked();
});

test('saved 1.2.3 all-tense settings offer Select All until the two new tenses are selected', async () => {
  const savedTenses: Tense[] = [
    'present', 'preterite', 'imperfect', 'future', 'conditional', 'subjunctive_present',
    'subjunctive_imperfect', 'imperative_affirmative', 'imperative_negative', 'present_perfect',
    'past_perfect', 'future_perfect', 'conditional_perfect', 'present_progressive', 'past_progressive',
  ];
  await AsyncStorage.setItem('practiceSettings', JSON.stringify({ activeTenses: savedTenses, activeLevels: ['B2'] }));
  __resetPracticeSettingsStoreForTests();
  const settings = render(<PracticeSettingsScreen />);

  const selectAll = await settings.findByRole('checkbox', { name: 'Select all tenses' });
  expect(usePracticeSettingsStore.getState().activeTenses).toEqual(savedTenses);
  expect(usePracticeSettingsStore.getState().activeLevels).toEqual(['B2']);
  expect(selectAll).not.toBeChecked();
  expect(within(selectAll).getByText('Select All')).toBeTruthy();
  expect(settings.getByRole('checkbox', { name: 'Compound: Subjunctive Present Perfect' })).not.toBeChecked();
  expect(settings.getByRole('checkbox', { name: 'Compound: Subjunctive Past Perfect' })).not.toBeChecked();

  await act(async () => { fireEvent.press(selectAll); });
  expect(usePracticeSettingsStore.getState().activeTenses).toEqual(practiceTenses);
  const deselectAll = settings.getByRole('checkbox', { name: 'Select all tenses' });
  expect(deselectAll).toBeChecked();
  expect(within(deselectAll).getByText('Deselect All')).toBeTruthy();

  await act(async () => { fireEvent.press(deselectAll); });
  expect(usePracticeSettingsStore.getState().activeTenses).toEqual([]);
});

test.each([
  ['hubiéramos vivido', 'vivir', 'subjunctive_past_perfect', 'nosotros'],
  ['haya muerto', 'morir', 'subjunctive_present_perfect', 'yo'],
] as const)('tapping the search result for %s opens its conjugation table', async (form, infinitive, tense, person) => {
  jest.useFakeTimers();
  try {
    const home = render(
      <GestureHandlerRootView>
        <HomeScreen navigation={navigation} />
      </GestureHandlerRootView>,
    );
    fireEvent.changeText(home.getByPlaceholderText('Search verbs or conjugations...'), form);
    await act(async () => { await jest.runOnlyPendingTimersAsync(); });
    await act(async () => { await jest.runAllTimersAsync(); });
    const result = home.getByRole('button', { name: new RegExp(`^${infinitive},`) });
    expect(result.props.accessibilityHint).toContain(form);
    await act(async () => { fireEvent.press(result); });

    expect(navigate).toHaveBeenLastCalledWith('Conjugation', { infinitive, initialTense: tense, highlightForm: form });
    const [, params] = navigate.mock.lastCall!;
    home.unmount();

    const verb = render(<ConjugationScreen navigation={navigation} route={{ key: 'verb', name: 'Conjugation', params }} />);
    expect(verb.getByRole('button', { name: `${tenseNames[tense]} conjugations` })).toBeExpanded();
    expect(verb.getByRole('button', { name: `Play pronunciation: ${person}, ${form}` })).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});
