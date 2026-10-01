import React from 'react';
import { Animated } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import QuizScreen from '../screens/QuizScreen';
import FlashcardScreen from '../screens/FlashcardScreen';
import PracticeSettingsScreen from '../screens/PracticeSettingsScreen';
import { useQuizStore } from '../store/quizStore';
import { useSessionStore } from '../store/sessionStore';
import { useFlashcardSessionStore } from '../store/flashcardSessionStore';
import { usePracticeResetStore } from '../store/practiceResetStore';
import { resetAllLearningData } from '../utils/resetLearningData';
import { usePracticeSettingsStore } from '../store/practiceSettingsStore';

const mockStorage = new Map<string, string>();
const mockListeners: Record<string, Set<() => void>> = {};
const mockNavigation = {
  setOptions: jest.fn(), navigate: jest.fn(),
  addListener: jest.fn((event: string, listener: () => void) => {
    (mockListeners[event] ??= new Set()).add(listener);
    return () => { mockListeners[event].delete(listener); };
  }),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { mode: 'quiz' } }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => () => null);
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => undefined), impactAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('expo-store-review', () => ({ isAvailableAsync: jest.fn(async () => false) }));
jest.mock('../utils/speech', () => ({ speak: jest.fn(), stopSpeech: jest.fn() }));
jest.mock('../utils/quizQuestion', () => ({
  generateQuestion: () => ({
    verb: 'hablar', translation: 'to speak', tense: 'present', personIndex: 0,
    correctAnswer: 'hablo', options: ['hablo', 'hablas', 'habla', 'hablan'],
  }),
}));
jest.mock('../utils/practicePrompts', () => ({
  pickWeightedPrompt: () => ({
    verb: 'hablar', data: { translation: 'to speak' }, tense: 'present', personIndex: 0, answer: 'hablo',
  }),
}));

beforeEach(async () => {
  await resetAllLearningData();
  jest.clearAllMocks();
});

test('three correct answers → reset → one correct answer records a streak of one', async () => {
  const screen = render(<QuizScreen />);
  await screen.findByLabelText('Answer: hablo');
  for (let index = 0; index < 3; index += 1) {
    await act(async () => { fireEvent.press(screen.getByLabelText('Answer: hablo')); });
    await act(async () => { fireEvent.press(screen.getByLabelText('Next question')); });
  }
  expect(useQuizStore.getState().bestStreak).toBe(3);
  await act(async () => { mockListeners.blur?.forEach(listener => listener()); });
  await act(async () => { await resetAllLearningData(); });
  await act(async () => { fireEvent.press(screen.getByLabelText('Answer: hablo')); });
  await act(async () => { mockListeners.blur?.forEach(listener => listener()); });
  expect(useQuizStore.getState()).toMatchObject({ totalQuestions: 1, totalCorrect: 1, bestStreak: 1 });
  expect(useSessionStore.getState().sessions[0]).toMatchObject({ total: 1, correct: 1, streak: 1 });
});

test('flashcard reset drops pre-reset deltas and starts the next card fresh', async () => {
  const timing = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
    start: callback => {
      (value as Animated.Value).setValue(config.toValue as number);
      callback?.({ finished: true });
    },
    stop: jest.fn(), reset: jest.fn(),
  }));
  try {
    const screen = render(<FlashcardScreen />);
    await screen.findByLabelText('Tap to reveal conjugation of hablar for yo');
    await act(async () => { fireEvent.press(screen.getByLabelText('Tap to reveal conjugation of hablar for yo')); });
    await act(async () => { fireEvent.press(screen.getByLabelText('Mark card as got it')); });
    // Reset before a blur save; stale cleanup must never recreate this card.
    await act(async () => { await resetAllLearningData(); });
    expect(useFlashcardSessionStore.getState().sessions).toEqual([]);
    await act(async () => { fireEvent.press(screen.getByLabelText('Tap to reveal conjugation of hablar for yo')); });
    await act(async () => { fireEvent.press(screen.getByLabelText('Mark card as missed')); });
    await act(async () => { mockListeners.blur?.forEach(listener => listener()); });
    expect(useFlashcardSessionStore.getState().sessions[0]).toMatchObject({ reviewed: 1, correct: 0 });
    expect(usePracticeResetStore.getState().resetting).toBe(false);
  } finally {
    timing.mockRestore();
  }
});

test('Next becomes accessible only after the quiz answer', async () => {
  const screen = render(<QuizScreen />);
  await screen.findByLabelText('Answer: hablo');
  expect(screen.queryByLabelText('Next question')).toBeNull();
  await act(async () => { fireEvent.press(screen.getByLabelText('Answer: hablo')); });
  expect(screen.getByLabelText('Next question')).toBeTruthy();
});

test.each([
  ['quiz', QuizScreen, 'Change quiz practice settings'],
  ['flashcards', FlashcardScreen, 'Change flashcard practice settings'],
] as const)('%s empty state opens its practice settings', async (mode, Component, label) => {
  usePracticeSettingsStore.setState({ activeTenses: [], loaded: true });
  const screen = render(<Component />);
  const button = await screen.findByLabelText(label);
  fireEvent.press(button);
  expect(mockNavigation.navigate).toHaveBeenCalledWith('PracticeSettings', { mode });
});

test.each([
  [[], ['A1'], 'Select at least one tense to start.'],
  [['present'], [], 'Select at least one level to start.'],
  [[], [], 'Select at least one tense and one level to start.'],
] as const)('explains the disabled Start button (%s, %s)', (tenses, levels, hint) => {
  usePracticeSettingsStore.setState({ activeTenses: [...tenses], activeLevels: [...levels], loaded: true });
  const screen = render(<PracticeSettingsScreen />);
  expect(screen.getByText(hint)).toBeTruthy();
  expect(screen.getByLabelText('Start quiz')).toBeDisabled();
});
