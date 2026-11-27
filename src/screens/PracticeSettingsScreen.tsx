import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { tenseNames, type Tense } from '../utils/conjugate';
import { usePracticeSettingsStore, allTenses, allLevels } from '../store/practiceSettingsStore';

const shortTenseLabels: Partial<Record<Tense, string>> = {
  subjunctive_present: 'Present',
  subjunctive_imperfect: 'Imperfect',
  imperative_affirmative: 'Affirmative',
  imperative_negative: 'Negative',
};

const tenseGroups: { title: string; tenses: Tense[] }[] = [
  {
    title: 'Indicative',
    tenses: ['present', 'preterite', 'imperfect', 'future', 'conditional'],
  },
  {
    title: 'Subjunctive',
    tenses: ['subjunctive_present', 'subjunctive_imperfect'],
  },
  {
    title: 'Imperative',
    tenses: ['imperative_affirmative', 'imperative_negative'],
  },
  {
    title: 'Compound',
    tenses: [
      'present_perfect', 'past_perfect', 'future_perfect', 'conditional_perfect',
      'subjunctive_present_perfect', 'subjunctive_past_perfect',
    ],
  },
  {
    title: 'Progressive',
    tenses: ['present_progressive', 'past_progressive'],
  },
];

export default function PracticeSettingsScreen() {
  const colors = useColors();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mode = route.params?.mode || 'quiz'; // 'quiz' or 'flashcards'

  const {
    activeTenses, activeLevels, loaded,
    loadPracticeSettings, toggleTense, toggleLevel,
    setActiveTenses, setActiveLevels,
  } = usePracticeSettingsStore();

  useEffect(() => {
    loadPracticeSettings();
  }, [loadPracticeSettings]);

  const allTensesSelected = activeTenses.length === allTenses.length;
  const allLevelsSelected = activeLevels.length === allLevels.length;
  const canStart = activeTenses.length > 0 && activeLevels.length > 0;

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.goBack();
  };

  if (!loaded) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md }}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Tenses */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Tenses</Text>
        <TouchableOpacity
          style={styles.selectAllButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTenses(allTensesSelected ? [] : [...allTenses]);
          }}
          accessibilityRole="checkbox"
          accessibilityLabel="Select all tenses"
          accessibilityState={{ checked: allTensesSelected }}
        >
          <Text style={[styles.selectAllText, { color: colors.primaryText }]}>
            {allTensesSelected ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>
      </View>
      {tenseGroups.map((group) => (
        <View key={group.title}>
          <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{group.title}</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {group.tenses.map((tense, i) => {
              const active = activeTenses.includes(tense);
              const label = shortTenseLabels[tense] ?? tenseNames[tense];
              return (
                <TouchableOpacity
                  key={tense}
                  style={[
                    styles.row,
                    i < group.tenses.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    toggleTense(tense);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${group.title}: ${label}`}
                  accessibilityState={{ checked: active }}
                >
                  <Text style={[styles.rowText, { color: colors.textPrimary }]}>{label}</Text>
                  <Ionicons
                    name={active ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={active ? colors.primaryText : colors.controlBorder}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {/* Levels */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Levels</Text>
        <TouchableOpacity
          style={styles.selectAllButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveLevels(allLevelsSelected ? [] : [...allLevels]);
          }}
          accessibilityRole="checkbox"
          accessibilityLabel="Select all proficiency levels"
          accessibilityState={{ checked: allLevelsSelected }}
        >
          <Text style={[styles.selectAllText, { color: colors.primaryText }]}>
            {allLevelsSelected ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {allLevels.map((level, i) => {
          const active = activeLevels.includes(level);
          return (
            <TouchableOpacity
              key={level}
              style={[
                styles.row,
                i < allLevels.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleLevel(level);
              }}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityLabel={`Level ${level}`}
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>{level}</Text>
              <Ionicons
                name={active ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={active ? colors.accent : colors.controlBorder}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {!canStart && (
        <Text style={{ color: colors.textSecondary, marginTop: spacing.md }} accessibilityLiveRegion="polite">
          {activeTenses.length === 0 && activeLevels.length === 0
            ? 'Select at least one tense and one level to start.'
            : activeTenses.length === 0
              ? 'Select at least one tense to start.'
              : 'Select at least one level to start.'}
        </Text>
      )}

      {/* Start button */}
      <TouchableOpacity
        style={[
          styles.startButton,
          { backgroundColor: colors.primary, opacity: canStart ? 1 : 0.45 },
        ]}
        onPress={handleStart}
        activeOpacity={0.8}
        disabled={!canStart}
        accessibilityRole="button"
        accessibilityLabel={mode === 'quiz' ? 'Start quiz' : 'Start flashcards'}
        accessibilityState={{ disabled: !canStart }}
      >
        <Ionicons name="play" size={20} color="#fff" />
        <Text style={styles.startButtonText}>
          {mode === 'quiz' ? 'Start Quiz' : 'Start Flashcards'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: spacing.lg, paddingBottom: 40 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  selectAllText: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.medium,
  },
  selectAllButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  groupLabel: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    padding: spacing.md,
  },
  rowText: {
    flexShrink: 1,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
    minHeight: 52,
    borderRadius: radius.md,
  },
  startButtonText: {
    color: '#fff',
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
  },
});
