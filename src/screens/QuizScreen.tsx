import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as StoreReview from 'expo-store-review';
import { useNavigation } from '@react-navigation/native';
import verbs from '../data/verbs.json';
import { getTodayKey } from '../utils/dayKey';
import { generateQuestion, type Question } from '../utils/quizQuestion';
import { useSessionAutosave } from '../hooks/useSessionAutosave';
import { getPersonLabel, tenseNames, VerbData, VerbLevel } from '../utils/conjugate';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useQuizStore } from '../store/quizStore';
import { useSpacedRepStore } from '../store/spacedRepStore';
import { useSessionStore } from '../store/sessionStore';
import { usePracticeSettingsStore } from '../store/practiceSettingsStore';
import { useThemeStore } from '../store/themeStore';
import { REVIEW_PROMPT_STREAK } from '../utils/constants';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);

export default function QuizScreen() {
  const colors = useColors();
  const { fontScale } = useWindowDimensions();
  // Only subscribe to what this screen uses — the totals re-render on every answer
  const loadStats = useQuizStore((s) => s.loadStats);
  const recordAnswer = useQuizStore((s) => s.recordAnswer);
  const claimReviewPrompt = useQuizStore((s) => s.claimReviewPrompt);
  const {
    loaded: weightsLoaded,
    loadError: weightsLoadError,
    loadWeights,
    recordResult,
    getWeight,
  } = useSpacedRepStore();
  const { activeTenses, activeLevels, loaded: settingsLoaded, loadPracticeSettings } = usePracticeSettingsStore();
  const includeVosotros = useThemeStore((s) => s.includeVosotros);
  const nav = useNavigation<any>();

  const filteredEntries = React.useMemo(() =>
    allVerbEntries.filter(([, d]) => activeLevels.includes(d.level as VerbLevel)),
    [activeLevels]
  );
  const { sessions, loadSessions, saveSession } = useSessionStore();
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [newCorrect, setNewCorrect] = useState(0);
  const [newTotal, setNewTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestSessionStreak, setBestSessionStreak] = useState(0);

  React.useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => nav.navigate('PracticeSettings', { mode: 'quiz' })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Open tense and level settings"
        >
          <Text style={{ color: colors.primaryText, fontSize: 14, fontWeight: '600' }}>Tenses</Text>
          <Ionicons name="options-outline" size={18} color={colors.primaryText} />
        </TouchableOpacity>
      ),
    });
  }, [nav, colors]);

  useEffect(() => {
    loadStats();
    loadWeights();
    loadSessions();
    loadPracticeSettings();
  }, [loadStats, loadWeights, loadSessions, loadPracticeSettings]);

  useEffect(() => {
    if (!weightsLoaded || !settingsLoaded) return;
    if (activeTenses.length > 0 && filteredEntries.length > 0) {
      setQuestion(generateQuestion(activeTenses, getWeight, filteredEntries, includeVosotros));
      setSelectedAnswer(null);
    } else {
      setQuestion(null);
    }
  }, [weightsLoaded, settingsLoaded, activeTenses, filteredEntries, includeVosotros, getWeight]);

  const isCorrect = selectedAnswer === question?.correctAnswer;
  const answered = selectedAnswer !== null;

  const handleAnswer = (answer: string) => {
    if (answered || !question) return;
    setSelectedAnswer(answer);
    setNewTotal(t => t + 1);

    const correct = answer === question.correctAnswer;
    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewCorrect(s => s + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestSessionStreak) setBestSessionStreak(newStreak);
      recordAnswer(true, newStreak);
      // Claim a persisted milestone first so another 10-answer streak (or a
      // remount) cannot prompt this installation again.
      if (newStreak === REVIEW_PROMPT_STREAK) {
        claimReviewPrompt()
          .then((claimed) => {
            if (!claimed) return;
            return StoreReview.isAvailableAsync();
          })
          .then((available) => {
            if (available === true) return StoreReview.requestReview();
          })
          .catch((e) => console.warn('StoreReview failed:', e));
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStreak(0);
      recordAnswer(false, 0);
    }
    recordResult(question.verb, question.tense, question.personIndex, correct).catch((e) =>
      console.warn('Failed to record quiz result:', e),
    );
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuestion(generateQuestion(activeTenses, getWeight, filteredEntries, includeVosotros));
    setSelectedAnswer(null);
  };

  // Auto-save NEW answers when leaving the screen or app goes to background
  const { unsavedCount, unsavedCorrect } = useSessionAutosave({
    count: newTotal,
    correct: newCorrect,
    bestStreak: bestSessionStreak,
    save: ({ count, correct, bestStreak }) =>
      saveSession({ total: count, correct, streak: bestStreak }),
  });

  // Today's cumulative totals plus any unsaved in-memory progress.
  const todayKey = getTodayKey();
  const todaySession = sessions.find(s => s.day === todayKey);
  const sessionTotal = (todaySession?.total || 0) + unsavedCount;
  const sessionScore = (todaySession?.correct || 0) + unsavedCorrect;


  const getOptionStyle = (option: string) => {
    if (!answered || !question) {
      return { backgroundColor: colors.card, borderColor: colors.controlBorder };
    }
    if (option === question.correctAnswer) {
      return { backgroundColor: colors.successBg, borderColor: colors.successBorder };
    }
    if (option === selectedAnswer && !isCorrect) {
      return { backgroundColor: colors.errorBg, borderColor: colors.errorBorder };
    }
    return { backgroundColor: colors.card, borderColor: colors.controlBorder, opacity: 0.55 };
  };

  const getOptionTextColor = (option: string) => {
    if (!answered || !question) return colors.textPrimary;
    if (option === question.correctAnswer) return colors.successText;
    if (option === selectedAnswer && !isCorrect) return colors.errorText;
    return colors.textMuted;
  };

  if (weightsLoadError && !weightsLoaded) {
    return (
      <View style={[styles.container, styles.statusContainer, { backgroundColor: colors.bg }]}>
        <Text style={[styles.statusText, { color: colors.textMuted }]}>Could not load quiz progress.</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={() => { loadWeights(); }}
          accessibilityRole="button"
          accessibilityLabel="Retry loading quiz progress"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!weightsLoaded || !settingsLoaded) {
    return (
      <View style={[styles.container, styles.statusContainer, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md }}>Loading quiz...</Text>
      </View>
    );
  }

  if (!question) return (
    <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md }}>No matching verbs</Text>
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
    >
        {/* Session score bar — pinned to the top */}
        <View style={[styles.scoreCard, { backgroundColor: colors.card }]}>
          <View style={styles.scoreRow}>
            <View style={[styles.scoreItem, fontScale >= 1.5 && styles.scoreItemLargeText]}>
              <Text style={[styles.scoreValue, { color: colors.primaryText }]}>{sessionTotal}</Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Reviewed</Text>
            </View>
            <View style={[styles.scoreItem, fontScale >= 1.5 && styles.scoreItemLargeText]}>
              <Text style={[styles.scoreValue, { color: colors.successText }]}>{sessionScore}</Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Got It</Text>
            </View>
            <View style={[styles.scoreItem, fontScale >= 1.5 && styles.scoreItemLargeText]}>
              <Text style={[styles.scoreValue, { color: colors.errorText }]}>{sessionTotal - sessionScore}</Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Missed</Text>
            </View>
            <View style={[styles.scoreItem, fontScale >= 1.5 && styles.scoreItemLargeText]}>
              <Text style={[styles.scoreValue, { color: colors.textSecondary }]}>
                {sessionTotal > 0 ? Math.round((sessionScore / sessionTotal) * 100) : 0}%
              </Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Accuracy</Text>
            </View>
          </View>
        </View>

        <View style={styles.quizBody}>
        {/* Question — fills remaining space */}
        <View style={styles.questionContainer}>
          <Text style={[styles.questionLabel, { color: colors.textMuted }]}>
            {tenseNames[question.tense]}
          </Text>
          <Text style={[styles.questionVerb, { color: colors.primaryText }]}>
            {question.verb}
          </Text>
          <Text style={[styles.questionTranslation, { color: colors.textSecondary }]}>
            {question.translation}
          </Text>
          <Text style={[styles.questionPronoun, { color: colors.textPrimary }]}>
            {getPersonLabel(question)}
          </Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {question.options.map((option, index) => (
            <TouchableOpacity
              key={`${option}-${index}`}
              style={[styles.optionButton, getOptionStyle(option)]}
              onPress={() => handleAnswer(option)}
              activeOpacity={answered ? 1 : 0.7}
              disabled={answered}
              accessibilityRole="button"
              accessibilityLabel={`Answer: ${option}`}
              accessibilityState={{ disabled: answered, selected: selectedAnswer === option }}
            >
              <Text
                style={[styles.optionText, { color: getOptionTextColor(option) }]}
              >
                {option}
              </Text>
              {answered && option === question.correctAnswer && (
                <Ionicons name="checkmark-circle" size={22} color={colors.successText} style={{ marginLeft: 8 }} />
              )}
              {answered && option === selectedAnswer && !isCorrect && option !== question.correctAnswer && (
                <Ionicons name="close-circle" size={22} color={colors.errorText} style={{ marginLeft: 8 }} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Next */}
        <View style={[styles.bottomRow, { opacity: answered ? 1 : 0 }]} pointerEvents={answered ? 'auto' : 'none'}>
          <TouchableOpacity
            style={[styles.bottomButton, { backgroundColor: colors.primary }]}
            onPress={handleNext}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Next question"
          >
            <Text style={styles.bottomButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statusContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  statusText: {
    fontSize: fonts.sizes.md,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  quizBody: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  scoreCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  scoreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  scoreItem: {
    alignItems: 'center',
    width: '25%',
  },
  scoreItemLargeText: {
    width: '50%',
    paddingVertical: spacing.xs,
  },
  scoreValue: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
  },
  scoreLabel: {
    fontSize: fonts.sizes.xs,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  questionLabel: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  questionVerb: {
    fontSize: 32,
    fontWeight: fonts.weights.bold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  questionTranslation: {
    fontSize: fonts.sizes.sm,
    fontStyle: 'italic',
    marginBottom: spacing.lg,
  },
  questionPronoun: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.medium,
  },
  optionsContainer: {
    gap: spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  optionText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.semibold,
    flexShrink: 1,
    textAlign: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bottomButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 56,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  bottomButtonText: {
    color: '#fff',
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
  },
});
