import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { tenseNames, Tense, VerbLevel } from '../utils/conjugate';
import { usePracticeSettingsStore, allTenses, allLevels } from '../store/practiceSettingsStore';

const tenseLabels: { key: Tense; label: string }[] = [
  { key: 'present', label: 'Present' },
  { key: 'preterite', label: 'Preterite' },
  { key: 'imperfect', label: 'Imperfect' },
  { key: 'future', label: 'Future' },
  { key: 'conditional', label: 'Conditional' },
  { key: 'subjunctive_present', label: 'Subjunctive Present' },
  { key: 'subjunctive_imperfect', label: 'Subjunctive Imperfect' },
];

export default function PracticeSettingsScreen() {
  const colors = useColors();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mode = route.params?.mode || 'quiz'; // 'quiz' or 'flashcards'

  const {
    activeTenses, activeLevels,
    loadPracticeSettings, toggleTense, toggleLevel,
    setActiveTenses, setActiveLevels,
  } = usePracticeSettingsStore();

  useEffect(() => {
    loadPracticeSettings();
  }, []);

  const allTensesSelected = activeTenses.length === allTenses.length;
  const allLevelsSelected = activeLevels.length === allLevels.length;

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.goBack();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Tenses */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Tenses</Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTenses(allTensesSelected ? ['present'] : [...allTenses]);
          }}
        >
          <Text style={[styles.selectAllText, { color: colors.primary }]}>
            {allTensesSelected ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {tenseLabels.map((item, i) => {
          const active = activeTenses.includes(item.key);
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.row,
                i < tenseLabels.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleTense(item.key);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>{item.label}</Text>
              <Ionicons
                name={active ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={active ? colors.primary : colors.border}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Levels */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Levels</Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveLevels(allLevelsSelected ? ['A1'] : [...allLevels]);
          }}
        >
          <Text style={[styles.selectAllText, { color: colors.primary }]}>
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
            >
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>{level}</Text>
              <Ionicons
                name={active ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={active ? colors.accent || colors.primary : colors.border}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Start button */}
      <TouchableOpacity
        style={[styles.startButton, { backgroundColor: colors.primary }]}
        onPress={handleStart}
        activeOpacity={0.8}
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
    padding: spacing.md,
  },
  rowText: {
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
    borderRadius: radius.md,
  },
  startButtonText: {
    color: '#fff',
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
  },
});
