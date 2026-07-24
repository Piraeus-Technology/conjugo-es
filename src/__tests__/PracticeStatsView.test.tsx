import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PracticeStatsView, { PracticeStatsLabels } from '../components/PracticeStatsView';
import { getTodayKey } from '../utils/dayKey';

const labels: PracticeStatsLabels = {
  countLabel: 'Questions',
  daysLabel: 'Days',
  loadingText: 'Loading stats...',
  errorText: 'Could not load stats.',
  retryAccessibilityLabel: 'Retry loading stats',
  emptyIcon: 'bar-chart-outline',
  emptySubtitle: 'Start a quiz to see your progress',
};

const baseProps = {
  sessions: [],
  sessionsLoaded: true,
  sessionsLoadError: false,
  weights: {},
  weightsLoaded: true,
  weightsLoadError: false,
  onRetry: jest.fn(),
  labels,
};

describe('PracticeStatsView', () => {
  test('shows the loading state until both stores load', () => {
    const { getByText } = render(
      <PracticeStatsView {...baseProps} sessionsLoaded={false} />,
    );
    expect(getByText('Loading stats...')).toBeTruthy();
  });

  test('shows the error state with a working retry button', () => {
    const onRetry = jest.fn();
    const { getByText, getByLabelText } = render(
      <PracticeStatsView
        {...baseProps}
        sessionsLoaded={false}
        sessionsLoadError
        onRetry={onRetry}
      />,
    );
    expect(getByText('Could not load stats.')).toBeTruthy();
    fireEvent.press(getByLabelText('Retry loading stats'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('renders totals, today card, and streak for current activity', () => {
    const { getByText, getAllByText } = render(
      <PracticeStatsView
        {...baseProps}
        sessions={[{ day: getTodayKey(), count: 10, correct: 8 }]}
      />,
    );
    expect(getByText('1 day streak')).toBeTruthy();
    expect(getByText('Recent 365 Active Days')).toBeTruthy();
    expect(getAllByText('80%')).toHaveLength(2); // Recent + Today cards
    expect(getByText('8/10')).toBeTruthy();
  });

  test('surfaces lifetime quiz totals independently of retained active days', () => {
    const { getByText, getByLabelText } = render(
      <PracticeStatsView
        {...baseProps}
        lifetimeStats={{ count: 125, correct: 100, bestStreak: 14 }}
      />,
    );
    expect(getByText('Lifetime')).toBeTruthy();
    expect(getByText('125')).toBeTruthy();
    expect(getByText('80%')).toBeTruthy();
    expect(getByLabelText('Lifetime best streak: 14')).toBeTruthy();
  });

  test('renders the empty state when there are no sessions', () => {
    const { getByText } = render(<PracticeStatsView {...baseProps} />);
    expect(getByText('No stats yet')).toBeTruthy();
    expect(getByText('Start a quiz to see your progress')).toBeTruthy();
  });

  test('recomputes the streak when the current day changes across rerenders', () => {
    const sessions = [{ day: '2026-06-09', count: 5, correct: 4 }];
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date(2026, 5, 10, 12));
      const { getByText, queryByText, rerender } = render(
        <PracticeStatsView {...baseProps} sessions={sessions} />,
      );
      expect(getByText('1 day streak')).toBeTruthy();

      jest.setSystemTime(new Date(2026, 5, 11, 12));
      rerender(<PracticeStatsView {...baseProps} sessions={sessions} />);
      expect(queryByText('1 day streak')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
