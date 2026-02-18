import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import verbs from '../data/verbs.json';
import {
  conjugate,
  tenseNames,
  Tense,
  VerbData,
} from '../utils/conjugate';
import { useFavoritesStore } from '../store/favoritesStore';
import { useColors, fonts, spacing, radius } from '../utils/theme';

const tenseGroups = [
  {
    label: 'Indicative',
    tenses: ['present', 'preterite', 'imperfect', 'future', 'conditional'] as Tense[],
  },
  {
    label: 'Subjunctive',
    tenses: ['subjunctive_present', 'subjunctive_imperfect'] as Tense[],
  },
  {
    label: 'Imperative',
    tenses: ['imperative_affirmative', 'imperative_negative'] as Tense[],
  },
  {
    label: 'Compound',
    tenses: ['present_perfect', 'past_perfect', 'future_perfect', 'conditional_perfect'] as Tense[],
  },
  {
    label: 'Other',
    tenses: ['gerund_participle'] as Tense[],
  },
];

export default function ConjugationScreen({ route, navigation }: any) {
  const { infinitive } = route.params;
  const verb = (verbs as Record<string, VerbData>)[infinitive];
  const initialTense = route.params?.initialTense || 'present';
  const highlightForm = route.params?.highlightForm?.toLowerCase() || null;
  const [openTense, setOpenTense] = useState<Tense | null>(initialTense);

  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const favorited = isFavorite(infinitive);
  const colors = useColors();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => toggleFavorite(infinitive)}
          hitSlop={8}
          style={({ pressed }) => ({
            opacity: pressed ? 0.5 : 1,
            width: 30,
            height: 30,
            justifyContent: 'center',
            alignItems: 'center',
          })}
        >
          <Ionicons
            name={favorited ? 'heart' : 'heart-outline'}
            size={22}
            color={favorited ? colors.primary : colors.textMuted}
          />
        </Pressable>
      ),
    });
  }, [navigation, favorited, colors]);

  const toggleTense = (tense: Tense) => {
    setOpenTense(openTense === tense ? null : tense);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.infinitive, { color: colors.textPrimary }]}>{infinitive}</Text>
        <Text style={[styles.translation, { color: colors.textSecondary }]}>{verb.translation}</Text>
        <View
          style={[
            styles.tag,
            { backgroundColor: verb.regular ? colors.regularTag : colors.irregularTag },
          ]}
        >
          <Text
            style={[
              styles.tagText,
              { color: verb.regular ? colors.regularTagText : colors.irregularTagText },
            ]}
          >
            {verb.regular ? 'Regular' : 'Irregular'} -{verb.type}
          </Text>
        </View>
      </View>

      <View style={styles.tenseSection}>
        {tenseGroups.map((group) => (
          <View key={group.label} style={styles.tenseGroup}>
            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{group.label}</Text>
            <View style={styles.tenseRow}>
              {group.tenses.map((tense) => {
                const isOpen = openTense === tense;
                return (
                  <TouchableOpacity
                    key={tense}
                    style={[
                      styles.tenseButton,
                      { backgroundColor: isOpen ? colors.pillActiveBg : colors.pillBg },
                    ]}
                    onPress={() => toggleTense(tense)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.tenseText,
                        { color: isOpen ? colors.pillActiveText : colors.pillText },
                        isOpen && { fontWeight: fonts.weights.semibold },
                      ]}
                    >
                      {tenseNames[tense]}
                    </Text>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={isOpen ? colors.pillActiveText : colors.pillText}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            {group.tenses.map((tense) => {
              if (openTense !== tense) return null;
              const results = conjugate(infinitive, verb, tense);
              return (
                <View key={tense + '_table'} style={[styles.table, { backgroundColor: colors.card }]}>
                  {results.map((row, i) => {
                    const isHighlighted =
                      highlightForm &&
                      tense === initialTense &&
                      row.form.toLowerCase() === highlightForm;

                    return (
                      <View
                        key={i}
                        style={[
                          styles.row,
                          { borderBottomColor: colors.divider },
                          i === results.length - 1 && styles.lastRow,
                          row.disabled && styles.disabledRow,
                          isHighlighted && [styles.highlightedRow, { backgroundColor: colors.accentLight }],
                        ]}
                      >
                        <Text
                          style={[
                            styles.pronoun,
                            { color: colors.textSecondary },
                            row.disabled && styles.disabledText,
                            isHighlighted && { color: colors.textPrimary, fontWeight: fonts.weights.semibold },
                          ]}
                        >
                          {row.pronoun}
                        </Text>
                        <Text
                          style={
                            row.disabled
                              ? [styles.disabledForm, { color: colors.textMuted }]
                              : [
                                  styles.form,
                                  { color: colors.primary },
                                  isHighlighted && { color: colors.primaryDark, fontWeight: fonts.weights.bold },
                                ]
                          }
                        >
                          {row.disabled ? '—' : row.form}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: spacing.lg, alignItems: 'center' },
  infinitive: { fontSize: fonts.sizes.hero, fontWeight: fonts.weights.bold },
  translation: { fontSize: fonts.sizes.lg, marginTop: spacing.xs },
  tag: { marginTop: spacing.sm, paddingHorizontal: 14, paddingVertical: 5, borderRadius: radius.full },
  tagText: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.medium },
  tenseSection: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  tenseGroup: { marginBottom: spacing.md },
  groupLabel: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  tenseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tenseButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    width: '48.5%',
  },
  tenseText: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.medium },
  table: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRadius: radius.sm,
  },
  lastRow: { borderBottomWidth: 0 },
  disabledRow: { opacity: 0.35 },
  highlightedRow: { marginHorizontal: -8, paddingHorizontal: 16, borderRadius: radius.sm },
  pronoun: { flex: 1, fontSize: fonts.sizes.md },
  form: { flex: 1, fontSize: fonts.sizes.lg, fontWeight: fonts.weights.semibold, textAlign: 'right' },
  disabledText: { textDecorationLine: 'line-through' },
  disabledForm: { flex: 1, fontSize: fonts.sizes.lg, fontWeight: fonts.weights.regular, textAlign: 'right' },
});