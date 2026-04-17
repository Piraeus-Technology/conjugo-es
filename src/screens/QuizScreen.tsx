import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  AppState,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import * as StoreReview from 'expo-store-review';
import { useNavigation } from '@react-navigation/native';
import { speak } from '../utils/speech';
import verbs from '../data/verbs.json';
import { conjugate, tenseNames, Tense, VerbData, VerbLevel } from '../utils/conjugate';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useQuizStore } from '../store/quizStore';
import { useSpacedRepStore } from '../store/spacedRepStore';
import { useSessionStore } from '../store/sessionStore';
import { usePracticeSettingsStore } from '../store/practiceSettingsStore';
import { useThemeStore } from '../store/themeStore';
import {
  COMMON_VERB_POOL_SIZE,
  REVIEW_PROMPT_STREAK,
  WEIGHTED_CANDIDATE_COUNT,
  WEIGHTED_PICK_COMMON_BIAS,
} from '../utils/constants';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);
const pronounLabels = ['yo', 'tú', 'él/ella', 'nosotros', 'vosotros', 'ellos/ellas'];

interface Question {
  verb: string;
  translation: string;
  tense: Tense;
  personIndex: number;
  correctAnswer: string;
  options: string[];
}

interface PromptCandidate {
  verb: string;
  data: VerbData;
  tense: Tense;
  personIndex: number;
  answer: string;
}

function pickWeightedPrompt(
  activeTenses: Tense[],
  getWeight: (verb: string, tense: Tense, personIndex: number) => number,
  filteredEntries: [string, VerbData][],
  includeVosotros: boolean = true,
): PromptCandidate {
  const verbEntries = filteredEntries.length > 0 ? filteredEntries : allVerbEntries;
  const commonCount = Math.min(COMMON_VERB_POOL_SIZE, verbEntries.length);
  const candidates: PromptCandidate[] = [];

  let attempts = 0;
  while (candidates.length < WEIGHTED_CANDIDATE_COUNT && attempts < 200) {
    attempts++;
    const idx = Math.random() < WEIGHTED_PICK_COMMON_BIAS
      ? Math.floor(Math.random() * commonCount)
      : Math.floor(Math.random() * verbEntries.length);
    const [verb, data] = verbEntries[idx];
    const tense = activeTenses[Math.floor(Math.random() * activeTenses.length)];
    const results = conjugate(verb, data, tense);
    const validPersons = results
      .map((r, i) => ({ index: i, ...r }))
      .filter(r => !r.disabled && r.form !== '—' && (includeVosotros || r.index !== 4));

    if (validPersons.length === 0) continue;

    const picked = validPersons[Math.floor(Math.random() * validPersons.length)];
    candidates.push({
      verb,
      data,
      tense,
      personIndex: picked.index,
      answer: picked.form,
    });
  }

  return candidates.reduce((best, candidate) =>
    getWeight(candidate.verb, candidate.tense, candidate.personIndex) >
      getWeight(best.verb, best.tense, best.personIndex)
      ? candidate
      : best
  );
}

function generateQuestion(
  activeTenses: Tense[],
  getWeight: (verb: string, tense: Tense, personIndex: number) => number,
  filteredEntries: [string, VerbData][],
  includeVosotros: boolean = true,
): Question {
  const verbEntries = filteredEntries.length > 0 ? filteredEntries : allVerbEntries;
  const prompt = pickWeightedPrompt(activeTenses, getWeight, filteredEntries, includeVosotros);
  const { verb, data, tense, personIndex } = prompt;
  const correctAnswer = prompt.answer;
  const results = conjugate(verb, data, tense);

  // Generate wrong answers — prioritize hard distractors
  // Priority 1: Same verb, same tense, different person (hardest)
  const sameVerbSameTense: string[] = [];
  results.forEach((r, i) => {
    if (i !== personIndex && r.form !== '—' && !r.disabled && r.form !== correctAnswer) {
      sameVerbSameTense.push(r.form);
    }
  });

  // Priority 2: Same verb, different tense, same person
  const sameVerbDiffTense: string[] = [];
  for (const t of activeTenses) {
    if (t === tense) continue;
    const otherResults = conjugate(verb, data, t);
    const form = otherResults[personIndex].form;
    if (form !== '—' && !otherResults[personIndex].disabled && form !== correctAnswer && !sameVerbSameTense.includes(form)) {
      sameVerbDiffTense.push(form);
    }
  }

  // Pick distractors: 1-2 from same tense different person, 1-2 from different tense same person
  const selected: string[] = [];

  // Shuffle both pools
  for (let i = sameVerbSameTense.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [sameVerbSameTense[i], sameVerbSameTense[j]] = [sameVerbSameTense[j], sameVerbSameTense[i]]; }
  for (let i = sameVerbDiffTense.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [sameVerbDiffTense[i], sameVerbDiffTense[j]] = [sameVerbDiffTense[j], sameVerbDiffTense[i]]; }

  // Mix: try to get at least 1 from each pool, fill the rest
  if (sameVerbSameTense.length > 0 && sameVerbDiffTense.length > 0) {
    // At least 1 same-tense-diff-person, at least 1 diff-tense-same-person
    selected.push(sameVerbSameTense.shift()!);
    selected.push(sameVerbDiffTense.shift()!);
    // Fill third from whichever has more
    const remaining = [...sameVerbSameTense, ...sameVerbDiffTense];
    if (remaining.length > 0) {
      selected.push(remaining[Math.floor(Math.random() * remaining.length)]);
    }
  } else {
    // Only one pool available, use it
    const pool = sameVerbSameTense.length > 0 ? sameVerbSameTense : sameVerbDiffTense;
    while (selected.length < 3 && pool.length > 0) {
      selected.push(pool.shift()!);
    }
  }

  // Fallback: same tense, different verb (only if needed)
  while (selected.length < 3) {
    const [otherVerb, otherData] = verbEntries[Math.floor(Math.random() * verbEntries.length)];
    const otherResults = conjugate(otherVerb, otherData, tense);
    const form = otherResults[personIndex].form;
    if (form !== correctAnswer && form !== '—' && !selected.includes(form)) {
      selected.push(form);
    }
  }

  const options = [correctAnswer, ...selected];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return { verb, translation: data.translation, tense, personIndex, correctAnswer, options };
}

export default function QuizScreen() {
  const colors = useColors();
  const { totalQuestions, totalCorrect, bestStreak, loadStats, recordAnswer } = useQuizStore();
  const { loaded: weightsLoaded, loadWeights, recordResult, getWeight } = useSpacedRepStore();
  const { activeTenses, activeLevels, loaded: settingsLoaded, loadPracticeSettings } = usePracticeSettingsStore();
  const includeVosotros = useThemeStore((s) => s.includeVosotros);
  const isDark = useThemeStore((s) => s.isDark);
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
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Tenses</Text>
          <Ionicons name="options-outline" size={18} color={colors.primary} />
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
    if (weightsLoaded && settingsLoaded && activeTenses.length > 0 && filteredEntries.length > 0) {
      setQuestion(generateQuestion(activeTenses, getWeight, filteredEntries, includeVosotros));
      setSelectedAnswer(null);
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
      // Prompt for rating after a streak of 10
      if (newStreak === REVIEW_PROMPT_STREAK) {
        StoreReview.isAvailableAsync()
          .then((available) => {
            if (available) return StoreReview.requestReview();
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
  const newTotalRef = React.useRef(newTotal);
  const newCorrectRef = React.useRef(newCorrect);
  const bestSessionStreakRef = React.useRef(bestSessionStreak);
  const lastSavedTotalRef = React.useRef(0);
  const lastSavedCorrectRef = React.useRef(0);
  const lastSavedBestStreakRef = React.useRef(0);
  newTotalRef.current = newTotal;
  newCorrectRef.current = newCorrect;
  bestSessionStreakRef.current = bestSessionStreak;

  // Load today's cumulative totals plus any unsaved in-memory progress.
  const todayKey = new Date().toLocaleDateString('en-CA');
  const todaySession = sessions.find(s => s.day === todayKey);
  const sessionTotal = (todaySession?.total || 0) + (newTotal - lastSavedTotalRef.current);
  const sessionScore = (todaySession?.correct || 0) + (newCorrect - lastSavedCorrectRef.current);

  const saveCurrentSession = React.useCallback(async () => {
    const snapshotTotal = newTotalRef.current;
    const snapshotCorrect = newCorrectRef.current;
    const unsavedTotal = snapshotTotal - lastSavedTotalRef.current;
    const unsavedCorrect = snapshotCorrect - lastSavedCorrectRef.current;
    const unsavedBestStreak = Math.max(bestSessionStreakRef.current, lastSavedBestStreakRef.current);

    if (unsavedTotal <= 0) return;

    try {
      await saveSession({
        total: unsavedTotal,
        correct: unsavedCorrect,
        streak: unsavedBestStreak,
      });
      lastSavedTotalRef.current = snapshotTotal;
      lastSavedCorrectRef.current = snapshotCorrect;
      lastSavedBestStreakRef.current = unsavedBestStreak;
    } catch (e) {
      console.warn('Failed to save quiz session:', e);
    }
  }, [saveSession]);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        saveCurrentSession().catch((e) => console.warn('AppState save failed:', e));
      }
    });
    return () => {
      sub.remove();
      saveCurrentSession().catch((e) => console.warn('Unmount save failed:', e));
    };
  }, [saveCurrentSession]);

  React.useEffect(() => {
    const unsubscribe = nav.addListener('blur', () => {
      saveCurrentSession().catch((e) => console.warn('Blur save failed:', e));
    });
    return unsubscribe;
  }, [nav, saveCurrentSession]);


  const getOptionStyle = (option: string) => {
    if (!answered || !question) {
      return { backgroundColor: colors.card, borderColor: colors.border };
    }
    if (option === question.correctAnswer) {
      return { backgroundColor: isDark ? '#1A3E1A' : '#E8F5E9', borderColor: isDark ? '#66BB6A' : '#4CAF50' };
    }
    if (option === selectedAnswer && !isCorrect) {
      return { backgroundColor: isDark ? '#3E1A1A' : '#FFEBEE', borderColor: isDark ? '#EF5350' : '#E53935' };
    }
    return { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.4 };
  };

  const getOptionTextColor = (option: string) => {
    if (!answered || !question) return colors.textPrimary;
    if (option === question.correctAnswer) return isDark ? '#66BB6A' : '#2E7D32';
    if (option === selectedAnswer && !isCorrect) return isDark ? '#EF5350' : '#C62828';
    return colors.textMuted;
  };

  if (!weightsLoaded || !settingsLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
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
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        {/* Session score bar */}
        <View style={[styles.scoreCard, { backgroundColor: colors.card }]}>
          <View style={styles.scoreRow}>
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreValue, { color: colors.primary }]}>{sessionTotal}</Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Reviewed</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreValue, { color: '#2E7D32' }]}>{sessionScore}</Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Got It</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreValue, { color: '#C62828' }]}>{sessionTotal - sessionScore}</Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Missed</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreValue, { color: colors.textSecondary }]}>
                {sessionTotal > 0 ? Math.round((sessionScore / sessionTotal) * 100) : 0}%
              </Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Accuracy</Text>
            </View>
          </View>
        </View>

        {/* Question — fills remaining space */}
        <View style={styles.questionContainer}>
          <Text style={[styles.questionLabel, { color: colors.textMuted }]}>
            {tenseNames[question.tense]}
          </Text>
          <Text
            style={[styles.questionVerb, { color: colors.primary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {question.verb}
          </Text>
          <Text style={[styles.questionTranslation, { color: colors.textSecondary }]}>
            {question.translation}
          </Text>
          <Text style={[styles.questionPronoun, { color: colors.textPrimary }]}>
            {pronounLabels[question.personIndex]}
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
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {option}
              </Text>
              {answered && option === question.correctAnswer && (
                <Ionicons name="checkmark-circle" size={22} color="#4CAF50" style={{ marginLeft: 8 }} />
              )}
              {answered && option === selectedAnswer && !isCorrect && option !== question.correctAnswer && (
                <Ionicons name="close-circle" size={22} color="#E53935" style={{ marginLeft: 8 }} />
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

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    justifyContent: 'space-between',
  },
  scoreCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  scoreItem: {
    alignItems: 'center',
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
  },
  bottomRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  bottomButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  bottomButtonText: {
    color: '#fff',
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
  },
  historySection: {
    marginTop: spacing.lg,
  },
  historyTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  historyDate: {
    fontSize: fonts.sizes.sm,
    flex: 1,
  },
  historyStat: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    marginLeft: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
    marginBottom: spacing.lg,
  },
  modalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: spacing.md,
  },
  modalStatItem: {
    alignItems: 'center',
  },
  modalStatValue: {
    fontSize: fonts.sizes.xxl || 28,
    fontWeight: fonts.weights.bold,
  },
  modalStatLabel: {
    fontSize: fonts.sizes.xs,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
  },
});
