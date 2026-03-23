import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
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

function generateQuestion(
  activeTenses: Tense[],
  getWeight: (verb: string) => number,
  filteredEntries: [string, VerbData][],
): Question {
  const verbEntries = filteredEntries.length > 0 ? filteredEntries : allVerbEntries;
  // Weighted random verb selection (spaced repetition)
  // Bias toward common verbs (first 200): 70% chance from top 200, 30% from rest
  const candidates: number[] = [];
  const commonCount = Math.min(200, verbEntries.length);
  for (let i = 0; i < 10; i++) {
    if (Math.random() < 0.7) {
      candidates.push(Math.floor(Math.random() * commonCount));
    } else {
      candidates.push(Math.floor(Math.random() * verbEntries.length));
    }
  }
  const verbIndex = candidates.reduce((best, idx) => {
    const bestWeight = getWeight(verbEntries[best][0]);
    const thisWeight = getWeight(verbEntries[idx][0]);
    return thisWeight > bestWeight ? idx : best;
  }, candidates[0]);

  const [verb, data] = verbEntries[verbIndex];
  const tense = activeTenses[Math.floor(Math.random() * activeTenses.length)];
  const personIndex = Math.floor(Math.random() * 6);

  const results = conjugate(verb, data, tense);
  const correctAnswer = results[personIndex].form;

  // Generate wrong answers
  const wrongAnswers = new Set<string>();

  results.forEach((r, i) => {
    if (i !== personIndex && r.form !== '—' && !r.disabled && r.form !== correctAnswer) {
      wrongAnswers.add(r.form);
    }
  });

  for (const t of activeTenses) {
    if (t === tense) continue;
    const otherResults = conjugate(verb, data, t);
    const form = otherResults[personIndex].form;
    if (form !== '—' && !otherResults[personIndex].disabled && form !== correctAnswer) {
      wrongAnswers.add(form);
    }
  }

  const wrongArray = Array.from(wrongAnswers);
  const selected: string[] = [];
  while (selected.length < 3 && wrongArray.length > 0) {
    const idx = Math.floor(Math.random() * wrongArray.length);
    selected.push(wrongArray.splice(idx, 1)[0]);
  }

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
  const { activeTenses, activeLevels, loadPracticeSettings } = usePracticeSettingsStore();
  const nav = useNavigation<any>();

  React.useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => nav.navigate('PracticeSettings', { mode: 'quiz' })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}
        >
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Tenses</Text>
          <Ionicons name="options-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [nav, colors]);

  const filteredEntries = React.useMemo(() =>
    allVerbEntries.filter(([, d]) => activeLevels.includes(d.level as VerbLevel)),
    [activeLevels]
  );
  const { sessions, loadSessions, saveSession } = useSessionStore();
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [sessionScore, setSessionScore] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestSessionStreak, setBestSessionStreak] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const sessionStart = useRef(Date.now());

  useEffect(() => {
    loadStats();
    loadWeights();
    loadSessions();
    loadPracticeSettings();
  }, []);

  useEffect(() => {
    if (weightsLoaded && activeTenses.length > 0 && filteredEntries.length > 0) {
      setQuestion(generateQuestion(activeTenses, getWeight, filteredEntries));
      setSelectedAnswer(null);
    }
  }, [weightsLoaded, activeTenses, filteredEntries]);

  const isCorrect = selectedAnswer === question?.correctAnswer;
  const answered = selectedAnswer !== null;

  const handleAnswer = (answer: string) => {
    if (answered || !question) return;
    setSelectedAnswer(answer);
    setSessionTotal(t => t + 1);

    const correct = answer === question.correctAnswer;
    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSessionScore(s => s + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestSessionStreak) setBestSessionStreak(newStreak);
      recordAnswer(true, newStreak);
      // Prompt for rating after a streak of 10
      if (newStreak === 10) {
        StoreReview.isAvailableAsync().then((available) => {
          if (available) StoreReview.requestReview();
        });
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStreak(0);
      recordAnswer(false, 0);
    }
    recordResult(question.verb, correct);
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuestion(generateQuestion(activeTenses, getWeight, filteredEntries));
    setSelectedAnswer(null);
  };

  const handleEndSession = () => {
    if (sessionTotal > 0) {
      saveSession({
        total: sessionTotal,
        correct: sessionScore,
        streak: bestSessionStreak,
        durationMs: Date.now() - sessionStart.current,
      });
    }
    setShowResults(true);
  };

  const handleNewSession = () => {
    setShowResults(false);
    setSessionScore(0);
    setSessionTotal(0);
    setStreak(0);
    setBestSessionStreak(0);
    sessionStart.current = Date.now();
    setQuestion(generateQuestion(activeTenses, getWeight, filteredEntries));
    setSelectedAnswer(null);
  };

  const formatDuration = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getOptionStyle = (option: string) => {
    if (!answered || !question) {
      return { backgroundColor: colors.card, borderColor: colors.border };
    }
    if (option === question.correctAnswer) {
      return { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' };
    }
    if (option === selectedAnswer && !isCorrect) {
      return { backgroundColor: '#FFEBEE', borderColor: '#E53935' };
    }
    return { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.4 };
  };

  const getOptionTextColor = (option: string) => {
    if (!answered || !question) return colors.textPrimary;
    if (option === question.correctAnswer) return '#2E7D32';
    if (option === selectedAnswer && !isCorrect) return '#C62828';
    return colors.textMuted;
  };

  if (!question) return (
    <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md }}>No matching verbs</Text>
    </View>
  );

  return (
    <Pressable
      style={{ flex: 1 }}
      onPress={() => { if (answered) handleNext(); }}
    >
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Session score bar */}
      <View style={[styles.scoreBar, { backgroundColor: colors.card }]}>
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreValue, { color: colors.primary }]}>{sessionScore}/{sessionTotal}</Text>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Session</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreValue, { color: colors.accent || colors.primary }]}>{streak}</Text>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Streak</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreValue, { color: colors.textSecondary }]}>
            {sessionTotal > 0 ? Math.round((sessionScore / sessionTotal) * 100) : 0}%
          </Text>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Accuracy</Text>
        </View>
      </View>

      {/* All-time stats */}
      {totalQuestions > 0 && (
        <Text style={[styles.allTimeText, { color: colors.textMuted }]}>
          All-time: {totalCorrect}/{totalQuestions} ({Math.round((totalCorrect / totalQuestions) * 100)}%) · Best streak: {bestStreak}
        </Text>
      )}

      {/* Question */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionLabel, { color: colors.textMuted }]}>
          {tenseNames[question.tense]}
        </Text>
        <Text style={[styles.questionVerb, { color: colors.primary }]}>
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
            key={index}
            style={[styles.optionButton, getOptionStyle(option)]}
            onPress={() => handleAnswer(option)}
            activeOpacity={answered ? 1 : 0.7}
            disabled={answered}
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
              <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
            )}
            {answered && option === selectedAnswer && !isCorrect && option !== question.correctAnswer && (
              <Ionicons name="close-circle" size={22} color="#E53935" />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Tap to continue hint */}
      {answered && (
        <Text style={[styles.tapHint, { color: colors.textMuted }]}>Tap anywhere to continue</Text>
      )}

      {/* End session button */}
      {sessionTotal > 0 && (
        <TouchableOpacity
          style={[styles.endSessionButton, { borderColor: colors.border }]}
          onPress={handleEndSession}
          activeOpacity={0.7}
        >
          <Text style={[styles.endSessionText, { color: colors.textMuted }]}>End Session</Text>
        </TouchableOpacity>
      )}

      {/* Session history */}
      {sessions.length > 0 && sessionTotal === 0 && (
        <View style={styles.historySection}>
          <Text style={[styles.historyTitle, { color: colors.textSecondary }]}>Past Sessions</Text>
          {sessions.slice(0, 5).map((s, i) => (
            <View key={i} style={[styles.historyRow, { backgroundColor: colors.card }]}>
              <Text style={[styles.historyDate, { color: colors.textMuted }]}>
                {new Date(s.date).toLocaleDateString()}
              </Text>
              <Text style={[styles.historyStat, { color: colors.textPrimary }]}>
                {s.correct}/{s.total} ({Math.round((s.correct / s.total) * 100)}%)
              </Text>
              <Text style={[styles.historyStat, { color: colors.textMuted }]}>
                {formatDuration(s.durationMs)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Results modal */}
      <Modal visible={showResults} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowResults(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.primary }]}>Session Complete!</Text>
            <View style={styles.modalStats}>
              <View style={styles.modalStatItem}>
                <Text style={[styles.modalStatValue, { color: colors.primary }]}>
                  {sessionScore}/{sessionTotal}
                </Text>
                <Text style={[styles.modalStatLabel, { color: colors.textMuted }]}>Score</Text>
              </View>
              <View style={styles.modalStatItem}>
                <Text style={[styles.modalStatValue, { color: colors.accent || colors.primary }]}>
                  {sessionTotal > 0 ? Math.round((sessionScore / sessionTotal) * 100) : 0}%
                </Text>
                <Text style={[styles.modalStatLabel, { color: colors.textMuted }]}>Accuracy</Text>
              </View>
              <View style={styles.modalStatItem}>
                <Text style={[styles.modalStatValue, { color: colors.textSecondary }]}>
                  {bestSessionStreak}
                </Text>
                <Text style={[styles.modalStatLabel, { color: colors.textMuted }]}>Best Streak</Text>
              </View>
            </View>
            <Text style={[styles.modalDuration, { color: colors.textMuted }]}>
              {formatDuration(Date.now() - sessionStart.current)}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={handleNewSession}
            >
              <Text style={styles.modalButtonText}>New Session</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  scoreBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  scoreItem: {
    alignItems: 'center',
  },
  allTimeText: {
    fontSize: fonts.sizes.xs,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  scoreValue: {
    fontSize: fonts.sizes.xl,
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
    marginBottom: spacing.xl,
  },
  questionLabel: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  questionVerb: {
    fontSize: 36,
    fontWeight: fonts.weights.bold,
    marginBottom: spacing.xs,
  },
  questionTranslation: {
    fontSize: fonts.sizes.md,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
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
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  optionText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.semibold,
    flex: 1,
  },
  tapHint: {
    textAlign: 'center',
    fontSize: fonts.sizes.sm,
    marginTop: spacing.lg,
  },
  endSessionButton: {
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  endSessionText: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.medium,
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
  modalDuration: {
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.lg,
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
