import React from 'react';
import { cleanup, render, within } from '@testing-library/react-native';
import HomeScreen from '../screens/HomeScreen';
import { verbEntries } from '../utils/verbSearch';
import { getVerbOfTheDayIndex } from '../utils/verbOfTheDay';
import { useHistoryStore } from '../store/historyStore';
import { useFavoritesStore } from '../store/favoritesStore';

jest.mock('react-native-gesture-handler', () => ({ Swipeable: ({ children }: { children: React.ReactNode }) => children }));

test('daily verb exposes its dataset level visually and in its accessibility label', () => {
  const history = useHistoryStore.getState();
  const favorites = useFavoritesStore.getState();
  useHistoryStore.setState({ loaded: true, history: [] });
  useFavoritesStore.setState({ loaded: true, favorites: [] });
  jest.useFakeTimers();
  try {
    jest.setSystemTime(new Date(2026, 9, 1, 12));
    const sorted = [...verbEntries].sort((a, b) => a.infinitive.localeCompare(b.infinitive, 'es'));
    const verb = sorted[getVerbOfTheDayIndex(sorted.length)];
    const screen = render(<HomeScreen navigation={{ navigate: jest.fn() }} />);
    const card = screen.getByLabelText(`Verb of the day: ${verb.infinitive}, ${verb.translation}, ${verb.regular ? 'regular' : 'irregular'} verb, level ${verb.level}`);
    expect(within(card).getByText(verb.level!)).toBeTruthy();
  } finally {
    cleanup();
    jest.useRealTimers();
    useHistoryStore.setState(history);
    useFavoritesStore.setState(favorites);
  }
});
