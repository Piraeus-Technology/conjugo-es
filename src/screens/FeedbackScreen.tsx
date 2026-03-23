import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
  Linking,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useThemeStore } from '../store/themeStore';
import { useQuizStore } from '../store/quizStore';
import { useSessionStore } from '../store/sessionStore';

const APP_VERSION = '1.0.4';

export default function FeedbackScreen() {
  const colors = useColors();
  const { isDark, toggleTheme } = useThemeStore();
  const { totalQuestions, totalCorrect, bestStreak, loadStats } = useQuizStore();
  const { sessions, loadSessions } = useSessionStore();
  const [showAllSessions, setShowAllSessions] = React.useState(false);

  React.useEffect(() => {
    loadStats();
    loadSessions();
  }, []);

  const handleSendEmail = () => {
    const subject = encodeURIComponent('ConjuGo ES Feedback');
    const url = `mailto:contact@piraeus.app?subject=${subject}`;

    Linking.openURL(url).catch(() => {
      Alert.alert(
        'No Email App',
        'You can send feedback directly to contact@piraeus.app'
      );
    });
  };

  const handleRateApp = () => {
    const url = Platform.select({
      ios: 'https://apps.apple.com/app/id6759270074?action=write-review',
      android: 'market://details?id=com.lkh9596.conjugo',
      default: 'https://apps.apple.com/app/id6759270074',
    });
    Linking.openURL(url).catch(() => {
      Alert.alert('Not Available Yet', 'Rating will be available once the app is on the App Store.');
    });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Stats section */}
        {totalQuestions > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Quiz Stats</Text>
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

            {sessions.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Quiz Sessions</Text>
                {sessions.slice(0, showAllSessions ? sessions.length : 5).map((s, i) => (
                  <View key={i} style={[styles.sessionRow, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sessionDate, { color: colors.textMuted }]}>
                      {new Date(s.date).toLocaleDateString()}
                    </Text>
                    <Text style={[styles.sessionStat, { color: colors.textPrimary }]}>
                      {s.correct}/{s.total}
                    </Text>
                    <Text style={[styles.sessionStat, { color: colors.primary }]}>
                      {Math.round((s.correct / s.total) * 100)}%
                    </Text>
                  </View>
                ))}
                {sessions.length > 5 && (
                  <TouchableOpacity
                    style={styles.seeAllButton}
                    onPress={() => setShowAllSessions(!showAllSessions)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.seeAllText, { color: colors.primary }]}>
                      {showAllSessions ? 'Show Less' : `See All (${sessions.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </>
        )}

        {/* Settings section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: totalQuestions > 0 ? spacing.lg : 0 }]}>Settings</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
          <View style={[styles.settingRow, { borderBottomColor: colors.divider }]}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Feedback & Rate */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Support</Text>
        <TouchableOpacity
          style={[styles.rateCard, { backgroundColor: colors.card }]}
          onPress={handleSendEmail}
          activeOpacity={0.7}
        >
          <Text style={styles.rateEmoji}>💬</Text>
          <View style={styles.rateInfo}>
            <Text style={[styles.rateTitle, { color: colors.textPrimary }]}>Send Feedback</Text>
            <Text style={[styles.rateSubtitle, { color: colors.textSecondary }]}>Bug reports, suggestions, missing verbs</Text>
          </View>
          <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Rate */}
        <TouchableOpacity
          style={[styles.rateCard, { backgroundColor: colors.card }]}
          onPress={handleRateApp}
          activeOpacity={0.7}
        >
          <Text style={styles.rateEmoji}>⭐</Text>
          <View style={styles.rateInfo}>
            <Text style={[styles.rateTitle, { color: colors.textPrimary }]}>Enjoying ConjuGo ES?</Text>
            <Text style={[styles.rateSubtitle, { color: colors.textSecondary }]}>Rate us on the App Store</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          style={[styles.rateCard, { backgroundColor: colors.card }]}
          onPress={() => {
            Share.share({
              message: 'Check out ConjuGo ES — a Spanish verb conjugation app! https://apps.apple.com/app/id6759270074',
            });
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.rateEmoji}>🔗</Text>
          <View style={styles.rateInfo}>
            <Text style={[styles.rateTitle, { color: colors.textPrimary }]}>Share ConjuGo ES</Text>
            <Text style={[styles.rateSubtitle, { color: colors.textSecondary }]}>Tell a friend about the app</Text>
          </View>
          <Ionicons name="share-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Privacy Policy */}
        <TouchableOpacity
          style={[styles.linkRow, { backgroundColor: colors.card }]}
          onPress={() => Linking.openURL('https://piraeus-technology.github.io/conjugo-es/')}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.linkText, { color: colors.textPrimary }]}>Privacy Policy</Text>
          <Ionicons name="open-outline" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Version */}
        <Text style={[styles.version, { color: colors.textMuted }]}>
          ConjuGo ES v{APP_VERSION}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg },
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
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sessionDate: {
    fontSize: fonts.sizes.sm,
    flex: 1,
  },
  sessionStat: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    marginLeft: spacing.md,
  },
  seeAllButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  seeAllText: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
  },
  sectionTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  settingsCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  settingLabel: {
    flex: 1,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
  },
  rateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rateEmoji: { fontSize: 32, marginRight: spacing.md },
  rateInfo: { flex: 1 },
  rateTitle: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.semibold },
  rateSubtitle: { fontSize: fonts.sizes.sm, marginTop: 2 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  linkText: {
    flex: 1,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
  },
  version: {
    fontSize: fonts.sizes.xs,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
});
