import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useSpacedRepStore } from '../store/spacedRepStore';
import { useQuizStore } from '../store/quizStore';
import PracticeStatsView, { DayCounts } from '../components/PracticeStatsView';

export default function StatsScreen() {
  const {
    sessions,
    loaded: sessionsLoaded,
    loadError: sessionsLoadError,
    loadSessions,
  } = useSessionStore();
  const {
    weights,
    loaded: weightsLoaded,
    loadError: weightsLoadError,
    loadWeights,
  } = useSpacedRepStore();
  const {
    totalQuestions,
    totalCorrect,
    bestStreak,
    loaded: lifetimeLoaded,
    loadError: lifetimeLoadError,
    loadStats,
  } = useQuizStore();

  React.useEffect(() => {
    loadSessions();
    loadWeights();
    loadStats();
  }, [loadSessions, loadWeights, loadStats]);

  const dayCounts: DayCounts[] = React.useMemo(
    () => sessions.map(s => ({ day: s.day, count: s.total, correct: s.correct })),
    [sessions],
  );

  return (
    <PracticeStatsView
      sessions={dayCounts}
      sessionsLoaded={sessionsLoaded && lifetimeLoaded}
      sessionsLoadError={sessionsLoadError || lifetimeLoadError}
      weights={weights}
      weightsLoaded={weightsLoaded}
      weightsLoadError={weightsLoadError}
      onRetry={() => {
        loadSessions();
        loadWeights();
        loadStats();
      }}
      labels={{
        countLabel: 'Questions',
        daysLabel: 'Days',
        loadingText: 'Loading stats...',
        errorText: 'Could not load stats.',
        retryAccessibilityLabel: 'Retry loading stats',
        emptyIcon: 'bar-chart-outline',
        emptySubtitle: 'Start a quiz to see your progress',
      }}
      lifetimeStats={{
        count: totalQuestions,
        correct: totalCorrect,
        bestStreak,
      }}
    />
  );
}
