import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  AccessibilityInfo,
  AppState,
  useWindowDimensions,
} from 'react-native';
import type { AppStateStatus, LayoutChangeEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import verbs from '../data/verbs.json';
import { getTodayKey } from '../utils/dayKey';
import { createPracticeSession, practiceSelectionKey } from '../utils/practicePrompts';
import { useSessionAutosave } from '../hooks/useSessionAutosave';
import { usePracticeResetStore } from '../store/practiceResetStore';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { getPersonLabel, tenseNames, Tense, VerbData, VerbLevel } from '../utils/conjugate';
import { usePracticeSettingsStore } from '../store/practiceSettingsStore';
import { useFlashcardSessionStore } from '../store/flashcardSessionStore';
import { useSpacedRepStore } from '../store/spacedRepStore';
import { speak, stopSpeech } from '../utils/speech';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useThemeStore } from '../store/themeStore';
import { canRunFocusedScreenEffect } from '../utils/screenActivity';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);
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

type CardPhase = 'front' | 'revealing' | 'back' | 'advancing';

export default function FlashcardScreen() {
  const { version, resetting } = usePracticeResetStore();
  return resetting ? null : <FlashcardScreenSession key={version} />;
}

function FlashcardScreenSession() {
  const colors = useColors();
  // Track live window size so the card adapts to rotation/split-screen
  const { width, height } = useWindowDimensions();
  const includeVosotros = useThemeStore((s) => s.includeVosotros);
  const nav = useNavigation<any>();
  const focused = useIsFocused();
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
  const [incomingCard, setIncomingCard] = useState<Card | null>(null);
  const [practiceSession] = useState(createPracticeSession);
  const selectionKey = practiceSelectionKey(activeTenses, activeLevels, includeVosotros);
  const appliedSelection = useRef<string | null>(null);
  const [phase, setPhase] = useState<CardPhase>('front');
  const phaseRef = useRef<CardPhase>('front');
  const updatePhase = React.useCallback((nextPhase: CardPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);
  const frontInteractive = phase === 'front';
  const backInteractive = phase === 'back';
  const [layoutHeight, setLayoutHeight] = useState(height);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const advanceAnim = useRef(new Animated.Value(0)).current;
  const transitionRef = useRef<Animated.CompositeAnimation | null>(null);
  const accessibleCardRef = useRef<React.ComponentRef<typeof TouchableOpacity>>(null);
  const speechGateRef = useRef({
    mounted: true,
    focused: true,
    appState: AppState.currentState as AppStateStatus,
  });
  React.useEffect(() => {
    const gate = speechGateRef.current;
    gate.mounted = true;
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

  const drawCard = React.useCallback((allowRetry: boolean): Card => {
    const prompt = practiceSession.next(filteredEntries, activeTenses, getWeight, includeVosotros, allowRetry);
    return { ...prompt, translation: prompt.data.translation };
  }, [practiceSession, filteredEntries, activeTenses, getWeight, includeVosotros]);

  const stopTransition = React.useCallback(() => {
    const transition = transitionRef.current;
    transitionRef.current = null;
    transition?.stop();
  }, []);
  React.useLayoutEffect(() => stopTransition, [stopTransition]);

  React.useLayoutEffect(() => {
    if (!focused || !loaded || !weightsLoaded || appliedSelection.current === selectionKey) return;
    appliedSelection.current = selectionKey;
    practiceSession.prune(filteredEntries, activeTenses, includeVosotros);
    stopTransition();
    stopSpeech();
    flipAnim.setValue(0);
    setIncomingCard(null);
    setCard(activeTenses.length && filteredEntries.length ? drawCard(false) : null);
    updatePhase('front');
  }, [focused, loaded, weightsLoaded, selectionKey, activeTenses, filteredEntries, flipAnim, drawCard,
    includeVosotros, practiceSession, stopTransition, updatePhase]);

  const flipToBack = () => {
    if (!card || phaseRef.current !== 'front') return;
    updatePhase('revealing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const transition = Animated.timing(flipAnim, { toValue: 1, duration: 300, useNativeDriver: true });
    transitionRef.current = transition;
    transition.start(({ finished }) => {
      if (transitionRef.current !== transition) return;
      transitionRef.current = null;
      if (!finished) flipAnim.setValue(1);
      updatePhase('back');
      if (canRunFocusedScreenEffect(speechGateRef.current) && useThemeStore.getState().autoTTS) speak(card.answer);
    });
  };

  const grade = (correct: boolean) => {
    if (!card || phaseRef.current !== 'back') return;
    updatePhase('advancing');
    stopSpeech();
    Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    practiceSession.recordAnswer(card, correct);
    recordProgress(correct);
    recordResult(card.verb, card.tense, card.personIndex, correct).catch((e) =>
      console.warn('Failed to record flashcard result:', e),
    );
    const nextCard = drawCard(true);
    advanceAnim.setValue(0);
    setIncomingCard(nextCard);
    if (accessibleCardRef.current) AccessibilityInfo.sendAccessibilityEvent(accessibleCardRef.current, 'focus');
    const transition = Animated.timing(advanceAnim, { toValue: 1, duration: 200, useNativeDriver: true });
    transitionRef.current = transition;
    transition.start(() => {
      if (transitionRef.current !== transition) return;
      transitionRef.current = null;
      flipAnim.setValue(0);
      setCard(nextCard);
      setIncomingCard(null);
      updatePhase('front');
    });
  };

  const { unsavedCount, unsavedCorrect, recordProgress } = useSessionAutosave({
    save: ({ day, count, correct }, markSaved) => saveSession({ day, reviewed: count, correct }, markSaved),
  });

  // Today's cumulative totals plus any unsaved in-memory progress.
  const todayKey = getTodayKey();
  const todaySession = sessions.find(s => s.day === todayKey);
  const reviewed = (todaySession?.reviewed || 0) + unsavedCount;
  const correct = (todaySession?.correct || 0) + unsavedCorrect;

  // Gate speech on visibility. Each grade queues a daily save immediately,
  // and the autosave hook retries pending writes on lifecycle events.
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

  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const outgoingOpacity = advanceAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
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
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', gap: spacing.md }]}>
        <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md }}>No matching flashcards</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={() => nav.navigate('PracticeSettings', { mode: 'flashcards' })}
          accessibilityRole="button"
          accessibilityLabel="Change flashcard practice settings"
        >
          <Text style={styles.retryButtonText}>Change Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const visibleFront = phase === 'advancing' ? incomingCard : card;
  const backInFlow = phase === 'back' || !visibleFront;
  const renderFront = (prompt: Card, opacity: number | Animated.Value | Animated.AnimatedInterpolation<number>) => (
    <Animated.View
      style={[
        styles.card,
        backInFlow && styles.cardOverlay,
        isCompactCard && styles.cardCompact,
        isTinyCard && styles.cardTiny,
        { backgroundColor: colors.card, minHeight: cardHeight, opacity },
      ]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.tenseLabel, isCompactCard && styles.tenseLabelCompact, isTinyCard && styles.tenseLabelTiny, { color: colors.textMuted }]}>
        {tenseNames[prompt.tense]}
      </Text>
      <Text style={[styles.verbText, isCompactCard && styles.verbTextCompact, isTinyCard && styles.verbTextTiny, { color: colors.primaryText }]}>
        {prompt.verb}
      </Text>
      <Text style={[styles.translationText, isCompactCard && styles.translationTextCompact, isTinyCard && styles.translationTextTiny, { color: colors.textSecondary }]}>
        {prompt.translation}
      </Text>
      <Text style={[styles.pronounText, isCompactCard && styles.pronounTextCompact, isTinyCard && styles.pronounTextTiny, { color: colors.textPrimary }]}>
        {getPersonLabel(prompt)}
      </Text>
      <Text style={[styles.tapHint, isCompactCard && styles.tapHintCompact, isTinyCard && styles.tapHintTiny, { color: colors.textMuted }]}>
        Tap to reveal
      </Text>
    </Animated.View>
  );

  const promptLabel = `Tap to reveal conjugation of ${card.verb} for ${getPersonLabel(card)}, ${tenseNames[card.tense]}`;
  const visibleFrontOpacity = phase === 'advancing' ? advanceAnim : phase === 'front' ? 1 : frontOpacity;
  const cardLabel = phase === 'advancing' ? 'Next flashcard'
    : phase === 'back' ? `${card.answer}, ${getPersonLabel(card)}, ${tenseNames[card.tense]}`
    : promptLabel;

  return (
    <View
      style={[
        styles.sessionContainer,
        {
          backgroundColor: colors.bg,
          paddingTop: isTinyHeight ? spacing.xs : spacing.sm,
          paddingBottom: verticalPadding,
        },
      ]}
      onLayout={handleSessionLayout}
    >
      {/* Score bar */}
      <View
        style={[
          styles.scoreBar,
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
        style={[styles.practiceArea, { marginTop: scoreCardGap }]}
        contentContainerStyle={[
          styles.practiceAreaContent,
          shouldScrollPracticeArea && styles.practiceAreaContentScrolling,
        ]}
        bounces={shouldScrollPracticeArea}
      >
        {/* Card */}
        <TouchableOpacity
          ref={accessibleCardRef}
          style={{ width: cardWidth }}
          onPress={frontInteractive ? flipToBack : undefined}
          activeOpacity={frontInteractive ? 0.95 : 1}
          accessible
          accessibilityRole="button"
          accessibilityLabel={cardLabel}
          importantForAccessibility="yes"
          accessibilityState={{ disabled: phase === 'revealing' || phase === 'advancing' }}
          accessibilityActions={backInteractive ? [{ name: 'speak', label: `Play pronunciation of ${card.answer}` }] : []}
          onAccessibilityAction={event => {
            if (phaseRef.current === 'back' && event.nativeEvent.actionName === 'speak') speak(card.answer);
          }}
        >
          {visibleFront && renderFront(visibleFront, visibleFrontOpacity)}

          {/* Back */}
          <Animated.View
            style={[
              styles.card,
              styles.cardBack,
              !backInFlow && styles.cardOverlay,
              isCompactCard && styles.cardCompact,
              isTinyCard && styles.cardTiny,
              {
                backgroundColor: colors.primary + '10',
                borderColor: colors.controlBorder,
                minHeight: cardHeight,
                opacity: phase === 'advancing' ? outgoingOpacity : phase === 'front' ? 0 : flipAnim,
              },
            ]}
            pointerEvents={backInteractive ? 'auto' : 'none'}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
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
              {getPersonLabel(card)} · {card.verb}
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
          style={[styles.buttonRow, { marginTop: buttonGap, opacity: backInteractive ? 1 : 0 }]}
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
            disabled={!backInteractive}
            onPress={() => grade(false)}
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
            disabled={!backInteractive}
            onPress={() => grade(true)}
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
  card: {
    borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  cardOverlay: StyleSheet.absoluteFill,
  cardCompact: { padding: spacing.md },
  cardTiny: { padding: 10, borderRadius: radius.md },
  cardBack: { borderWidth: 2 },
  tenseLabel: {
    fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold,
    letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center', marginBottom: spacing.md,
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
  tapHint: { fontSize: fonts.sizes.xs, marginTop: spacing.lg },
  tapHintCompact: { marginTop: spacing.md },
  tapHintTiny: { fontSize: 10, marginTop: spacing.xs },
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
