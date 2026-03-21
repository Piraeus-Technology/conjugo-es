import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import verbs from '../data/verbs.json';
import { conjugate, tenseNames, Tense, VerbData, allTenses } from '../utils/conjugate';
import { useColors, fonts, spacing, radius } from '../utils/theme';

const verbEntries = Object.entries(verbs as Record<string, VerbData>);
const simpleTenses: Tense[] = [
  'present', 'preterite', 'imperfect', 'future', 'conditional',
  'subjunctive_present', 'subjunctive_imperfect',
];
const pronounLabels = ['yo', 'tú', 'él/ella', 'nosotros', 'vosotros', 'ellos/ellas'];

interface Question {
  verb: string;
  translation: string;
  tense: Tense;
  personIndex: number;
  correctAnswer: string;
  options: string[];
}

function generateQuestion(): Question {
  // Pick a random verb
  const [verb, data] = verbEntries[Math.floor(Math.random() * verbEntries.length)];
  // Pick a random simple tense
  const tense = simpleTenses[Math.floor(Math.random() * simpleTenses.length)];
  // Pick a random person (0-5)
  const personIndex = Math.floor(Math.random() * 6);

  const results = conjugate(verb, data, tense);
  const correctAnswer = results[personIndex].form;

  // Generate wrong answers from the same verb (different persons/tenses)
  const wrongAnswers = new Set<string>();

  // Wrong from different persons same tense
  results.forEach((r, i) => {
    if (i !== personIndex && r.form !== '—' && !r.disabled && r.form !== correctAnswer) {
      wrongAnswers.add(r.form);
    }
  });

  // Wrong from same person different tenses
  for (const t of simpleTenses) {
    if (t === tense) continue;
    const otherResults = conjugate(verb, data, t);
    const form = otherResults[personIndex].form;
    if (form !== '—' && !otherResults[personIndex].disabled && form !== correctAnswer) {
      wrongAnswers.add(form);
    }
  }

  // Pick 3 wrong answers
  const wrongArray = Array.from(wrongAnswers);
  const selected: string[] = [];
  while (selected.length < 3 && wrongArray.length > 0) {
    const idx = Math.floor(Math.random() * wrongArray.length);
    selected.push(wrongArray.splice(idx, 1)[0]);
  }

  // If we don't have enough wrong answers, generate from other verbs
  while (selected.length < 3) {
    const [otherVerb, otherData] = verbEntries[Math.floor(Math.random() * verbEntries.length)];
    const otherResults = conjugate(otherVerb, otherData, tense);
    const form = otherResults[personIndex].form;
    if (form !== correctAnswer && form !== '—' && !selected.includes(form)) {
      selected.push(form);
    }
  }

  // Shuffle options
  const options = [correctAnswer, ...selected];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return { verb, translation: data.translation, tense, personIndex, correctAnswer, options };
}

export default function QuizScreen() {
  const colors = useColors();
  const [question, setQuestion] = useState<Question>(generateQuestion);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);

  const isCorrect = selectedAnswer === question.correctAnswer;
  const answered = selectedAnswer !== null;

  const handleAnswer = (answer: string) => {
    if (answered) return;
    setSelectedAnswer(answer);
    setTotal(t => t + 1);

    if (answer === question.correctAnswer) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScore(s => s + 1);
      setStreak(s => s + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStreak(0);
    }
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuestion(generateQuestion());
    setSelectedAnswer(null);
  };

  const getOptionStyle = (option: string) => {
    if (!answered) {
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
    if (!answered) return colors.textPrimary;
    if (option === question.correctAnswer) return '#2E7D32';
    if (option === selectedAnswer && !isCorrect) return '#C62828';
    return colors.textMuted;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Score bar */}
      <View style={[styles.scoreBar, { backgroundColor: colors.card }]}>
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreValue, { color: colors.primary }]}>{score}/{total}</Text>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Score</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreValue, { color: colors.accent || colors.primary }]}>{streak}</Text>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Streak</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreValue, { color: colors.textSecondary }]}>
            {total > 0 ? Math.round((score / total) * 100) : 0}%
          </Text>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Accuracy</Text>
        </View>
      </View>

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
            <Text style={[styles.optionText, { color: getOptionTextColor(option) }]}>
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

      {/* Next button */}
      {answered && (
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.primary }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>Next</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  scoreBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
  },
  scoreItem: {
    alignItems: 'center',
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
    fontStyle: 'italic' as const,
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
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
  },
});
