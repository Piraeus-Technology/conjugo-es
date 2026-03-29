import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import verbs from '../data/verbs.json';
import { useNavigation } from '@react-navigation/native';
import { conjugate, tenseNames, Tense, VerbData, VerbLevel } from '../utils/conjugate';
import { usePracticeSettingsStore } from '../store/practiceSettingsStore';
import { useFlashcardSessionStore } from '../store/flashcardSessionStore';
import { speak } from '../utils/speech';
import { useColors, fonts, spacing, radius } from '../utils/theme';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);
const pronounLabels = ['yo', 'tú', 'él/ella', 'nosotros', 'vosotros', 'ellos/ellas'];
const quizzableTenses: Tense[] = [
  'present', 'preterite', 'imperfect', 'future', 'conditional',
  'subjunctive_present', 'subjunctive_imperfect',
];

interface Card {
  verb: string;
  translation: string;
  tense: Tense;
  personIndex: number;
  answer: string;
}

function generateCard(entries: [string, VerbData][], tenses: Tense[]): Card {
  const verbEntries = entries.length > 0 ? entries : allVerbEntries;
  const activeTenseList = tenses.length > 0 ? tenses : quizzableTenses;
  const commonCount = Math.min(200, verbEntries.length);
  const idx = Math.random() < 0.7
    ? Math.floor(Math.random() * commonCount)
    : Math.floor(Math.random() * verbEntries.length);
  const [verb, data] = verbEntries[idx];
  const tense = activeTenseList[Math.floor(Math.random() * activeTenseList.length)];
  const results = conjugate(verb, data, tense);
  // Filter to valid (non-disabled) persons only
  const validPersons = results
    .map((r, i) => ({ index: i, ...r }))
    .filter(r => !r.disabled && r.form !== '—');
  if (validPersons.length === 0) {
    return generateCard(entries, tenses);
  }
  const picked = validPersons[Math.floor(Math.random() * validPersons.length)];
  return {
    verb,
    translation: data.translation,
    tense,
    personIndex: picked.index,
    answer: picked.form,
  };
}

export default function FlashcardScreen() {
  const colors = useColors();
  const nav = useNavigation<any>();
  const { activeTenses, activeLevels, loadPracticeSettings } = usePracticeSettingsStore();
  const { saveSession } = useFlashcardSessionStore();
  const filteredEntries = React.useMemo(() =>
    allVerbEntries.filter(([, d]) => activeLevels.includes(d.level as VerbLevel)),
    [activeLevels]
  );

  React.useEffect(() => {
    loadPracticeSettings();
  }, []);

  React.useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => nav.navigate('PracticeSettings', { mode: 'flashcards' })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}
        >
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Tenses</Text>
          <Ionicons name="options-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [nav, colors]);

  const [card, setCard] = useState<Card>(() => generateCard(allVerbEntries, quizzableTenses));
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

  const flipToFront = () => {
    Animated.timing(flipAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setCard(generateCard(filteredEntries, activeTenses));
      setFlipped(false);
    });
  };

  const flipToBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlipped(true);
    Animated.timing(flipAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const handleGotIt = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReviewed(r => r + 1);
    setCorrect(c => c + 1);
    flipToFront();
  };

  const handleMissed = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setReviewed(r => r + 1);
    flipToFront();
  };

  const handleEndSession = () => {
    if (reviewed > 0) {
      saveSession({ reviewed, correct });
    }
    setShowResults(true);
  };

  const handleNewSession = () => {
    setShowResults(false);
    setReviewed(0);
    setCorrect(0);
    setCard(generateCard(filteredEntries, activeTenses));
    setFlipped(false);
    flipAnim.setValue(0);
  };

  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Score bar */}
      <View style={[styles.scoreBar, { backgroundColor: colors.card }]}>
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreValue, { color: colors.primary }]}>{reviewed}</Text>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Reviewed</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreValue, { color: '#2E7D32' }]}>{correct}</Text>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Got It</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreValue, { color: '#C62828' }]}>{reviewed - correct}</Text>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Missed</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreValue, { color: colors.textSecondary }]}>
            {reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0}%
          </Text>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Accuracy</Text>
        </View>
      </View>

      {/* Card */}
      <TouchableOpacity
        style={styles.cardContainer}
        onPress={!flipped ? flipToBack : undefined}
        activeOpacity={flipped ? 1 : 0.95}
      >
        {/* Front */}
        <Animated.View style={[styles.card, { backgroundColor: colors.card, opacity: frontOpacity }]}>
          <Text style={[styles.tenseLabel, { color: colors.textMuted }]}>
            {tenseNames[card.tense]}
          </Text>
          <Text style={[styles.verbText, { color: colors.primary }]}>
            {card.verb}
          </Text>
          <Text style={[styles.translationText, { color: colors.textSecondary }]}>
            {card.translation}
          </Text>
          <Text style={[styles.pronounText, { color: colors.textPrimary }]}>
            {pronounLabels[card.personIndex]}
          </Text>
          <Text style={[styles.tapHint, { color: colors.textMuted }]}>
            Tap to reveal
          </Text>
        </Animated.View>

        {/* Back */}
        <Animated.View style={[styles.card, styles.cardBack, { backgroundColor: colors.primary + '10', opacity: backOpacity }]}>
          <Text style={[styles.tenseLabel, { color: colors.textMuted }]}>
            {tenseNames[card.tense]}
          </Text>
          <Text
            style={[styles.answerText, { color: colors.primary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {card.answer}
          </Text>
          <Text style={[styles.contextText, { color: colors.textSecondary }]}>
            {pronounLabels[card.personIndex]} · {card.verb}
          </Text>
          <Text style={[styles.answerTranslation, { color: colors.textMuted }]}>
            {card.translation}
          </Text>
          <TouchableOpacity
            style={[styles.speakButton, { backgroundColor: colors.primary }]}
            onPress={() => speak(card.answer)}
          >
            <Ionicons name="volume-medium" size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>

      {/* Got it / Missed buttons */}
      <View style={[styles.buttonRow, { opacity: flipped ? 1 : 0 }]} pointerEvents={flipped ? 'auto' : 'none'}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#FFEBEE', borderColor: '#C62828' }]}
          onPress={handleMissed}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={20} color="#C62828" />
          <Text style={[styles.actionButtonText, { color: '#C62828' }]}>Missed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#E8F5E9', borderColor: '#2E7D32' }]}
          onPress={handleGotIt}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark" size={20} color="#2E7D32" />
          <Text style={[styles.actionButtonText, { color: '#2E7D32' }]}>Got it</Text>
        </TouchableOpacity>
      </View>

      {/* End session */}
      {reviewed > 0 && !flipped && (
        <TouchableOpacity
          style={[styles.endButton, { borderColor: colors.border }]}
          onPress={handleEndSession}
          activeOpacity={0.7}
        >
          <Text style={[styles.endButtonText, { color: colors.textMuted }]}>End Session</Text>
        </TouchableOpacity>
      )}

      {/* Results modal */}
      <Modal visible={showResults} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowResults(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.primary }]}>Session Complete!</Text>
            <View style={styles.modalStats}>
              <View style={styles.modalStatItem}>
                <Text style={[styles.modalStatValue, { color: colors.primary }]}>{reviewed}</Text>
                <Text style={[styles.modalStatLabel, { color: colors.textMuted }]}>Reviewed</Text>
              </View>
              <View style={styles.modalStatItem}>
                <Text style={[styles.modalStatValue, { color: '#2E7D32' }]}>{correct}</Text>
                <Text style={[styles.modalStatLabel, { color: colors.textMuted }]}>Got It</Text>
              </View>
              <View style={styles.modalStatItem}>
                <Text style={[styles.modalStatValue, { color: colors.textSecondary }]}>
                  {reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0}%
                </Text>
                <Text style={[styles.modalStatLabel, { color: colors.textMuted }]}>Accuracy</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={handleNewSession}
            >
              <Text style={styles.modalButtonText}>New Session</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  scoreBar: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  scoreItem: { alignItems: 'center' },
  scoreValue: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.bold },
  scoreLabel: { fontSize: 10, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardContainer: { width: width - spacing.lg * 2, height: 320 },
  card: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  cardBack: { borderWidth: 2, borderColor: 'rgba(0,0,0,0.05)' },
  tenseLabel: {
    fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.md,
  },
  verbText: { fontSize: 36, fontWeight: fonts.weights.bold, marginBottom: spacing.xs },
  translationText: { fontSize: fonts.sizes.md, fontStyle: 'italic', marginBottom: spacing.lg },
  pronounText: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.medium },
  answerText: { fontSize: 42, fontWeight: fonts.weights.bold, marginBottom: spacing.xs },
  answerTranslation: { fontSize: fonts.sizes.md, fontStyle: 'italic', marginBottom: spacing.md },
  contextText: { fontSize: fonts.sizes.sm, marginBottom: spacing.md },
  speakButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tapHint: { fontSize: fonts.sizes.xs, position: 'absolute', bottom: spacing.lg },
  buttonRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.xl,
    borderRadius: radius.md, borderWidth: 1.5,
  },
  actionButtonText: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.bold },
  endButton: {
    position: 'absolute', bottom: spacing.lg,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.md, borderWidth: 1,
  },
  endButtonText: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.medium },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  modalTitle: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, marginBottom: spacing.lg },
  modalStats: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: spacing.lg },
  modalStatItem: { alignItems: 'center' },
  modalStatValue: { fontSize: 28, fontWeight: fonts.weights.bold },
  modalStatLabel: { fontSize: fonts.sizes.xs, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalButton: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, width: '100%', alignItems: 'center' },
  modalButtonText: { color: '#fff', fontSize: fonts.sizes.md, fontWeight: fonts.weights.bold },
});
