import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useQuizStore } from '../store/quizStore';
import { useSessionStore } from '../store/sessionStore';

export default function StatsScreen() {
  const colors = useColors();
  const { totalQuestions, totalCorrect, bestStreak, loadStats } = useQuizStore();
  const { sessions, loadSessions } = useSessionStore();

  React.useEffect(() => {
    loadStats();
    loadSessions();
  }, []);

  // Aggregate sessions by day
  const dailyMap: Record<string, { total: number; correct: number }> = {};
  sessions.forEach(s => {
    const key = new Date(s.date).toLocaleDateString('en-CA');
    if (!dailyMap[key]) dailyMap[key] = { total: 0, correct: 0 };
    dailyMap[key].total += s.total;
    dailyMap[key].correct += s.correct;
  });
  const days = Object.entries(dailyMap)
    .sort(([a], [b]) => b.localeCompare(a));

  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Calculate streak
  let streak = 0;
  const todayStr = new Date().toLocaleDateString('en-CA');
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toLocaleDateString('en-CA');

  if (dailyMap[todayStr] || dailyMap[yesterdayStr]) {
    let checkDate = new Date();
    if (!dailyMap[todayStr]) checkDate.setDate(checkDate.getDate() - 1);
    while (true) {
      const key = checkDate.toLocaleDateString('en-CA');
      if (dailyMap[key]) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // This week stats
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  let weekTotal = 0;
  let weekCorrect = 0;
  sessions.forEach(s => {
    if (s.date >= weekStart.getTime()) {
      weekTotal += s.total;
      weekCorrect += s.correct;
    }
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Streak */}
      {streak > 0 && (
        <View style={[styles.streakCard, { backgroundColor: colors.card }]}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={[styles.streakText, { color: colors.primary }]}>
            {streak} day streak
          </Text>
        </View>
      )}

      {/* All-time stats */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>All Time</Text>
      <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{totalQuestions}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Questions</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0}%
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Accuracy</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.accent || colors.primary }]}>{bestStreak}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Best Streak</Text>
          </View>
        </View>
      </View>

      {/* This week */}
      {weekTotal > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>This Week</Text>
          <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{weekTotal}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Questions</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {Math.round((weekCorrect / weekTotal) * 100)}%
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Accuracy</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.textSecondary }]}>{days.length}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Days Active</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Daily breakdown */}
      {days.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Daily Activity</Text>
          {days.map(([date, data]) => (
            <View key={date} style={[styles.dayRow, { backgroundColor: colors.card }]}>
              <Text style={[styles.dayDate, { color: colors.textPrimary }]}>
                {formatDay(date)}
              </Text>
              <View style={styles.dayStats}>
                <Text style={[styles.dayScore, { color: colors.textSecondary }]}>
                  {data.correct}/{data.total}
                </Text>
                <View style={[styles.dayBadge, {
                  backgroundColor: Math.round((data.correct / data.total) * 100) >= 80
                    ? '#E8F5E9' : Math.round((data.correct / data.total) * 100) >= 50
                    ? '#FFF8E1' : '#FFEBEE'
                }]}>
                  <Text style={[styles.dayPercent, {
                    color: Math.round((data.correct / data.total) * 100) >= 80
                      ? '#2E7D32' : Math.round((data.correct / data.total) * 100) >= 50
                      ? '#F57F17' : '#C62828'
                  }]}>
                    {Math.round((data.correct / data.total) * 100)}%
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Empty state */}
      {totalQuestions === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="bar-chart-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No stats yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Start a quiz to see your progress
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  streakEmoji: {
    fontSize: 24,
  },
  streakText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
  },
  sectionTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  statsCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
  },
  statLabel: {
    fontSize: fonts.sizes.xs,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dayDate: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
    flex: 1,
  },
  dayStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayScore: {
    fontSize: fonts.sizes.sm,
  },
  dayBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    minWidth: 48,
    alignItems: 'center',
  },
  dayPercent: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.bold,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: fonts.sizes.md,
    marginTop: spacing.sm,
  },
});
