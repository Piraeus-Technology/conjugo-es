import React from 'react';
import { act, cleanup, fireEvent, isHiddenFromAccessibility, render, within } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import HomeScreen from '../screens/HomeScreen';
import { verbEntries } from '../utils/verbSearch';
import { getVerbOfTheDayIndex } from '../utils/verbOfTheDay';
import { useHistoryStore } from '../store/historyStore';
import { useFavoritesStore } from '../store/favoritesStore';

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

test('closed saved rows hide the swipe icon from accessibility and can still be removed', async () => {
  const history = useHistoryStore.getState();
  const favorites = useFavoritesStore.getState();
  useHistoryStore.setState({ loaded: true, history: ['comer'] });
  useFavoritesStore.setState({ loaded: true, favorites: ['hablar'] });

  try {
    const screen = render(
      <GestureHandlerRootView>
        <HomeScreen navigation={{ navigate: jest.fn() }} />
      </GestureHandlerRootView>,
    );
    const icons = screen.getAllByText('trash-outline', { includeHiddenElements: true });
    expect(icons).toHaveLength(2);
    expect(icons.every(icon => isHiddenFromAccessibility(icon))).toBe(true);

    const favorite = screen.getByLabelText(/^hablar,/);
    const recent = screen.getByLabelText(/^comer,/);
    expect(favorite.props.accessibilityActions).toEqual([{ name: 'remove', label: 'Remove from Favorites' }]);
    expect(recent.props.accessibilityActions).toEqual([{ name: 'remove', label: 'Remove from Recent' }]);
    await act(async () => {
      fireEvent(favorite, 'accessibilityAction', { nativeEvent: { actionName: 'remove' } });
      fireEvent(recent, 'accessibilityAction', { nativeEvent: { actionName: 'remove' } });
    });
    expect(screen.queryByLabelText(/^hablar,/)).toBeNull();
    expect(screen.queryByLabelText(/^comer,/)).toBeNull();
  } finally {
    cleanup();
    useHistoryStore.setState(history);
    useFavoritesStore.setState(favorites);
  }
});
