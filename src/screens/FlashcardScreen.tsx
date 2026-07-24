import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  AppState,
  useWindowDimensions,
} from 'react-native';
import type { AppStateStatus, LayoutChangeEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import verbs from '../data/verbs.json';
import { getTodayKey } from '../utils/dayKey';
import { pickWeightedPrompt } from '../utils/practicePrompts';
import { useSessionAutosave } from '../hooks/useSessionAutosave';
import { useNavigation } from '@react-navigation/native';
import { tenseNames, Tense, VerbData, VerbLevel } from '../utils/conjugate';
import { usePracticeSettingsStore } from '../store/practiceSettingsStore';
import { useFlashcardSessionStore } from '../store/flashcardSessionStore';
import { useSpacedRepStore } from '../store/spacedRepStore';
import { speak, stopSpeech } from '../utils/speech';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useThemeStore } from '../store/themeStore';
import { canRunFocusedScreenEffect } from '../utils/screenActivity';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);
const pronounLabels = ['yo', 'tú', 'él/ella', 'nosotros', 'vosotros', 'ellos/ellas'];
const quizzableTenses: Tense[] = [
  'present', 'preterite', 'imperfect', 'future', 'conditional',
  'subjunctive_present', 'subjunctive_imperfect',
];
const maxCardHeight = 320;
const minCardHeight = 210;
const minTinyCardHeight = 144;
const compactCardHeightThreshold = 300;
const tinyCardHeightThreshold = 240;
const scoreBarHeightEstimate = 54;
const buttonRowHeightEstimate = 44;

interface Card {
  verb: string;
  translation: string;
  tense: Tense;
  personIndex: number;
  answer: string;
}

function generateCard(
  entries: [string, VerbData][],
  tenses: Tense[],
  getWeight: (verb: string, tense: Tense, personIndex: number) => number,
  includeVosotros: boolean = true,
): Card {
  const verbEntries = entries.length > 0 ? entries : allVerbEntries;
  const activeTenseList = tenses.length > 0 ? tenses : quizzableTenses;
  const prompt = pickWeightedPrompt(verbEntries, activeTenseList, getWeight, includeVosotros);
  return {
    verb: prompt.verb,
    translation: prompt.data.translation,
    tense: prompt.tense,
    personIndex: prompt.personIndex,
    answer: prompt.answer,
  };
}

export default function FlashcardScreen() {
  const colors = useColors();
  // Track live window size so the card adapts to rotation/split-screen
  const { width, height } = useWindowDimensions();
  const includeVosotros = useThemeStore((s) => s.includeVosotros);
  const autoTTS = useThemeStore((s) => s.autoTTS);
  const nav = useNavigation<any>();
  const { activeTenses, activeLevels, loaded, loadPracticeSettings } = usePracticeSettingsStore();
  const { sessions, loadSessions, saveSession } = useFlashcardSessionStore();
  const {
    loaded: weightsLoaded,
    loadError: weightsLoadError,
    loadWeights,
    recordResult,
    getWeight,
  } = useSpacedRepStore();
  const filteredEntries = React.useMemo(() =>
    allVerbEntries.filter(([, d]) => activeLevels.includes(d.level as VerbLevel)),
    [activeLevels]
  );

  React.useEffect(() => {
    loadPracticeSettings();
    loadWeights();
    loadSessions();
  }, [loadPracticeSettings, loadWeights, loadSessions]);

  const [card, setCard] = useState<Card | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [backInteractive, setBackInteractive] = useState(false);
  const [newReviewed, setNewReviewed] = useState(0);
  const [newCorrect, setNewCorrect] = useState(0);
  const [layoutHeight, setLayoutHeight] = useState(height);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const speechGateRef = useRef({
    mounted: true,
    focused: true,
    appState: AppState.currentState as AppStateStatus,
  });
  React.useEffect(() => {
    const gate = speechGateRef.current;
    return () => {
      gate.mounted = false;
      stopSpeech();
    };
  }, []);

  React.useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => nav.navigate('PracticeSettings', { mode: 'flashcards' })}
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

  React.useEffect(() => {
    if (!loaded || !weightsLoaded || activeTenses.length === 0 || filteredEntries.length === 0) return;
    setCard(generateCard(filteredEntries, activeTenses, getWeight, includeVosotros));
    setFlipped(false);
    setBackInteractive(false);
    flipAnim.setValue(0);
  }, [loaded, weightsLoaded, activeTenses, filteredEntries, flipAnim, getWeight, includeVosotros]);

  const flipToFront = () => {
    setBackInteractive(false);
    Animated.timing(flipAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setCard(generateCard(filteredEntries, activeTenses, getWeight, includeVosotros));
      setFlipped(false);
    });
  };

  const flipToBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBackInteractive(false);
    setFlipped(true);
    Animated.timing(flipAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start(({ finished }) => {
      if (!finished || !speechGateRef.current.mounted) return;
      setBackInteractive(true);
      if (canRunFocusedScreenEffect(speechGateRef.current) && autoTTS && card) speak(card.answer);
    });
  };

  const handleGotIt = () => {
    // The flipped gate also guards re-entry: the buttons stay tappable during
    // the 200ms flip-back animation, and a double-tap would record the card twice
    if (!card || !flipped) return;
    setFlipped(false);
    setBackInteractive(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewReviewed(r => r + 1);
    setNewCorrect(c => c + 1);
    recordResult(card.verb, card.tense, card.personIndex, true).catch((e) =>
      console.warn('Failed to record flashcard result:', e),
    );
    flipToFront();
  };

  const handleMissed = () => {
    if (!card || !flipped) return;
    setFlipped(false);
    setBackInteractive(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setNewReviewed(r => r + 1);
    recordResult(card.verb, card.tense, card.personIndex, false).catch((e) =>
      console.warn('Failed to record flashcard result:', e),
    );
    flipToFront();
  };

  // Auto-save NEW answers when leaving the screen or app goes to background
  const { unsavedCount, unsavedCorrect } = useSessionAutosave({
    count: newReviewed,
    correct: newCorrect,
    save: ({ count, correct }) => saveSession({ reviewed: count, correct }),
  });

  // Today's cumulative totals plus any unsaved in-memory progress.
  const todayKey = getTodayKey();
  const todaySession = sessions.find(s => s.day === todayKey);
  const reviewed = (todaySession?.reviewed || 0) + unsavedCount;
  const correct = (todaySession?.correct || 0) + unsavedCorrect;

  // Speech gating only — session saves are handled by useSessionAutosave's
  // own AppState/blur/unmount listeners.
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      speechGateRef.current.appState = state;
      if (state === 'background' || state === 'inactive') {
        stopSpeech();
      }
    });
    return () => sub.remove();
  }, []);

  React.useEffect(() => {
    const unsubscribeFocus = nav.addListener('focus', () => {
      speechGateRef.current.focused = true;
    });
    const unsubscribeBlur = nav.addListener('blur', () => {
      speechGateRef.current.focused = false;
      stopSpeech();
    });
    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [nav]);

  const handleSessionLayout = React.useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setLayoutHeight((currentHeight) => (
      currentHeight === nextHeight ? currentHeight : nextHeight
    ));
  }, []);

  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const availableHeight = Math.min(layoutHeight || height, height);
  const isShortHeight = availableHeight < 600;
  const isTinyHeight = availableHeight < 420;
  const verticalPadding = isTinyHeight ? spacing.xs : isShortHeight ? spacing.sm : spacing.lg;
  const scoreCardGap = isTinyHeight ? spacing.xs : isShortHeight ? spacing.sm : spacing.md;
  const buttonGap = isTinyHeight ? spacing.xs : isShortHeight ? spacing.sm : spacing.lg;
  const availableCardHeight = availableHeight - (verticalPadding * 2) - scoreBarHeightEstimate - scoreCardGap - buttonGap - buttonRowHeightEstimate;
  const minimumCardHeight = isTinyHeight ? minTinyCardHeight : minCardHeight;
  const cardHeight = Math.max(
    minimumCardHeight,
    Math.min(
      maxCardHeight,
      availableCardHeight,
    ),
  );
  const shouldScrollPracticeArea = availableCardHeight < minimumCardHeight;
  const isCompactCard = cardHeight < compactCardHeightThreshold;
  const isTinyCard = cardHeight < tinyCardHeightThreshold;
  const cardWidth = Math.max(0, width - spacing.lg * 2);

  if (weightsLoadError && !weightsLoaded) {
    return (
      <View style={[styles.container, styles.statusContainer, { backgroundColor: colors.bg }]}>
        <Text style={[styles.statusText, { color: colors.textMuted }]}>Could not load flashcard progress.</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={() => { loadWeights(); }}
          accessibilityRole="button"
          accessibilityLabel="Retry loading flashcard progress"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!loaded || !weightsLoaded) {
    return (
      <View style={[styles.container, styles.statusContainer, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md }}>Loading flashcards...</Text>
      </View>
    );
  }

  if (filteredEntries.length === 0 || activeTenses.length === 0 || !card) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center' }]}>
        <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md }}>No matching flashcards</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.sessionContainer,
        {
          backgroundColor: colors.bg,
          paddingTop: verticalPadding,
          paddingBottom: verticalPadding,
        },
      ]}
      onLayout={handleSessionLayout}
    >
      {/* Score bar */}
      <View
        style={[
          styles.scoreBar,
          !isShortHeight && styles.scoreBarFloating,
          isShortHeight && styles.scoreBarCompact,
          isTinyHeight && styles.scoreBarTiny,
          { backgroundColor: colors.card },
        ]}
      >
        <View style={styles.scoreRow}>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, isShortHeight && styles.scoreValueCompact, isTinyHeight && styles.scoreValueTiny, { color: colors.primaryText }]}>{reviewed}</Text>
            <Text style={[styles.scoreLabel, isShortHeight && styles.scoreLabelCompact, isTinyHeight && styles.scoreLabelTiny, { color: colors.textMuted }]}>Reviewed</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, isShortHeight && styles.scoreValueCompact, isTinyHeight && styles.scoreValueTiny, { color: colors.successText }]}>{correct}</Text>
            <Text style={[styles.scoreLabel, isShortHeight && styles.scoreLabelCompact, isTinyHeight && styles.scoreLabelTiny, { color: colors.textMuted }]}>Got It</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, isShortHeight && styles.scoreValueCompact, isTinyHeight && styles.scoreValueTiny, { color: colors.errorText }]}>{reviewed - correct}</Text>
            <Text style={[styles.scoreLabel, isShortHeight && styles.scoreLabelCompact, isTinyHeight && styles.scoreLabelTiny, { color: colors.textMuted }]}>Missed</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, isShortHeight && styles.scoreValueCompact, isTinyHeight && styles.scoreValueTiny, { color: colors.textSecondary }]}>
              {reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0}%
            </Text>
            <Text style={[styles.scoreLabel, isShortHeight && styles.scoreLabelCompact, isTinyHeight && styles.scoreLabelTiny, { color: colors.textMuted }]}>Accuracy</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={[styles.practiceArea, { marginTop: isShortHeight ? scoreCardGap : 0 }]}
        contentContainerStyle={[
          styles.practiceAreaContent,
          shouldScrollPracticeArea && styles.practiceAreaContentScrolling,
        ]}
        scrollEnabled={shouldScrollPracticeArea}
        showsVerticalScrollIndicator={shouldScrollPracticeArea}
        bounces={shouldScrollPracticeArea}
      >
        {/* Card */}
        <TouchableOpacity
          style={[styles.cardContainer, { width: cardWidth, height: cardHeight }]}
          onPress={!flipped ? flipToBack : undefined}
          activeOpacity={flipped ? 1 : 0.95}
          accessible={!flipped}
          accessibilityRole={!flipped ? 'button' : undefined}
          accessibilityLabel={!flipped ? `Tap to reveal conjugation of ${card.verb} for ${pronounLabels[card.personIndex]}` : undefined}
          importantForAccessibility={flipped ? 'no' : 'yes'}
        >
          {/* Front */}
          <Animated.View
            style={[
              styles.card,
              isCompactCard && styles.cardCompact,
              isTinyCard && styles.cardTiny,
              { backgroundColor: colors.card, opacity: frontOpacity },
            ]}
            pointerEvents="none"
            accessibilityElementsHidden={flipped}
            importantForAccessibility={flipped ? 'no-hide-descendants' : 'auto'}
          >
            <Text style={[styles.tenseLabel, isCompactCard && styles.tenseLabelCompact, isTinyCard && styles.tenseLabelTiny, { color: colors.textMuted }]}>
              {tenseNames[card.tense]}
            </Text>
            <Text style={[styles.verbText, isCompactCard && styles.verbTextCompact, isTinyCard && styles.verbTextTiny, { color: colors.primaryText }]}>
              {card.verb}
            </Text>
            <Text style={[styles.translationText, isCompactCard && styles.translationTextCompact, isTinyCard && styles.translationTextTiny, { color: colors.textSecondary }]}>
              {card.translation}
            </Text>
            <Text style={[styles.pronounText, isCompactCard && styles.pronounTextCompact, isTinyCard && styles.pronounTextTiny, { color: colors.textPrimary }]}>
              {pronounLabels[card.personIndex]}
            </Text>
            <Text style={[styles.tapHint, isCompactCard && styles.tapHintCompact, isTinyCard && styles.tapHintTiny, { color: colors.textMuted }]}>
              Tap to reveal
            </Text>
          </Animated.View>

          {/* Back */}
          <Animated.View
            style={[
              styles.card,
              styles.cardBack,
              isCompactCard && styles.cardCompact,
              isTinyCard && styles.cardTiny,
              { backgroundColor: colors.primary + '10', opacity: backOpacity },
            ]}
            pointerEvents={backInteractive ? 'auto' : 'none'}
            accessibilityElementsHidden={!flipped}
            importantForAccessibility={!flipped ? 'no-hide-descendants' : 'auto'}
          >
            <Text style={[styles.tenseLabel, isCompactCard && styles.tenseLabelCompact, isTinyCard && styles.tenseLabelTiny, { color: colors.textMuted }]}>
              {tenseNames[card.tense]}
            </Text>
            <Text
              style={[styles.answerText, isCompactCard && styles.answerTextCompact, isTinyCard && styles.answerTextTiny, { color: colors.primaryText }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {card.answer}
            </Text>
            <Text style={[styles.contextText, isCompactCard && styles.contextTextCompact, isTinyCard && styles.contextTextTiny, { color: colors.textSecondary }]}>
              {pronounLabels[card.personIndex]} · {card.verb}
            </Text>
            <Text style={[styles.answerTranslation, isCompactCard && styles.answerTranslationCompact, isTinyCard && styles.answerTranslationTiny, { color: colors.textMuted }]}>
              {card.translation}
            </Text>
            <TouchableOpacity
              style={[styles.speakButton, { backgroundColor: colors.primary }]}
              onPress={() => speak(card.answer)}
              disabled={!backInteractive}
              accessibilityRole="button"
              accessibilityLabel={`Play pronunciation of ${card.answer}`}
            >
              <Ionicons name="volume-medium" size={isTinyCard ? 16 : isCompactCard ? 18 : 20} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>

        {/* Got it / Missed buttons */}
        <View
          style={[styles.buttonRow, { marginTop: buttonGap, opacity: flipped ? 1 : 0 }]}
          pointerEvents={backInteractive ? 'auto' : 'none'}
          accessibilityElementsHidden={!backInteractive}
          importantForAccessibility={!backInteractive ? 'no-hide-descendants' : 'auto'}
        >
          <TouchableOpacity
            style={[
              styles.actionButton,
              isShortHeight && styles.actionButtonCompact,
              isTinyHeight && styles.actionButtonTiny,
              { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
            ]}
            onPress={handleMissed}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Mark card as missed"
          >
            <Ionicons name="close" size={isTinyHeight ? 16 : 20} color={colors.errorText} />
            <Text style={[styles.actionButtonText, isShortHeight && styles.actionButtonTextCompact, isTinyHeight && styles.actionButtonTextTiny, { color: colors.errorText }]}>Missed</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              isShortHeight && styles.actionButtonCompact,
              isTinyHeight && styles.actionButtonTiny,
              { backgroundColor: colors.successBg, borderColor: colors.successBorder },
            ]}
            onPress={handleGotIt}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Mark card as got it"
          >
            <Ionicons name="checkmark" size={isTinyHeight ? 16 : 20} color={colors.successText} />
            <Text style={[styles.actionButtonText, isShortHeight && styles.actionButtonTextCompact, isTinyHeight && styles.actionButtonTextTiny, { color: colors.successText }]}>Got it</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  sessionContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  statusContainer: {
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
  scoreBar: {
    alignSelf: 'stretch',
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  scoreBarFloating: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.lg,
    right: spacing.lg,
  },
  scoreBarCompact: { paddingVertical: spacing.xs },
  scoreBarTiny: { paddingVertical: 2, paddingHorizontal: spacing.xs },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-around' },
  scoreItem: { alignItems: 'center' },
  scoreValue: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.bold },
  scoreValueCompact: { fontSize: fonts.sizes.md },
  scoreValueTiny: { fontSize: fonts.sizes.sm },
  scoreLabel: { fontSize: fonts.sizes.xs, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  scoreLabelCompact: { fontSize: 10, marginTop: 1 },
  scoreLabelTiny: { fontSize: 9, marginTop: 0, letterSpacing: 0.3 },
  practiceArea: {
    flex: 1,
    alignSelf: 'stretch',
  },
  practiceAreaContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceAreaContentScrolling: {
    justifyContent: 'flex-start',
  },
  cardContainer: {},
  card: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  cardCompact: { padding: spacing.md },
  cardTiny: { padding: 10, borderRadius: radius.md },
  cardBack: { borderWidth: 2, borderColor: 'rgba(0,0,0,0.05)' },
  tenseLabel: {
    fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.md,
  },
  tenseLabelCompact: { marginBottom: spacing.sm },
  tenseLabelTiny: { fontSize: 10, letterSpacing: 0.8, marginBottom: 2 },
  verbText: { fontSize: 36, fontWeight: fonts.weights.bold, marginBottom: spacing.xs },
  verbTextCompact: { fontSize: 30, marginBottom: 2 },
  verbTextTiny: { fontSize: 24, marginBottom: 0 },
  translationText: { fontSize: fonts.sizes.md, fontStyle: 'italic', marginBottom: spacing.lg },
  translationTextCompact: { marginBottom: spacing.sm },
  translationTextTiny: { fontSize: fonts.sizes.sm, marginBottom: spacing.xs },
  pronounText: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.medium },
  pronounTextCompact: { fontSize: fonts.sizes.lg },
  pronounTextTiny: { fontSize: fonts.sizes.md },
  answerText: { fontSize: 42, fontWeight: fonts.weights.bold, marginBottom: spacing.xs },
  answerTextCompact: { fontSize: 34, marginBottom: 2 },
  answerTextTiny: { fontSize: 28, marginBottom: 0 },
  answerTranslation: { fontSize: fonts.sizes.md, fontStyle: 'italic', marginBottom: spacing.md },
  answerTranslationCompact: { marginBottom: spacing.sm },
  answerTranslationTiny: { fontSize: 12, marginBottom: spacing.xs },
  contextText: { fontSize: fonts.sizes.sm, marginBottom: spacing.md },
  contextTextCompact: { marginBottom: spacing.sm },
  contextTextTiny: { fontSize: 11, marginBottom: 2 },
  speakButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  speakButtonCompact: { width: 40, height: 40, borderRadius: 20 },
  speakButtonTiny: { width: 32, height: 32, borderRadius: 16 },
  tapHint: { fontSize: fonts.sizes.xs, position: 'absolute', bottom: spacing.lg },
  tapHintCompact: { bottom: spacing.md },
  tapHintTiny: { fontSize: 10, bottom: spacing.sm },
  buttonRow: { flexDirection: 'row', gap: spacing.md },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.xl,
    borderRadius: radius.md, borderWidth: 1.5,
  },
  actionButtonCompact: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  actionButtonTiny: { gap: 2, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  actionButtonText: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.bold },
  actionButtonTextCompact: { fontSize: fonts.sizes.sm },
  actionButtonTextTiny: { fontSize: 12 },
});
