import React, { useState, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { speak } from '../utils/speech';
import verbs from '../data/verbs.json';
import {
  conjugate,
  tenseNames,
  Tense,
  VerbData,
} from '../utils/conjugate';
import { useFavoritesStore } from '../store/favoritesStore';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import type { ConjugationScreenProps } from '../types/navigation';

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
    label: 'Progressive',
    tenses: ['present_progressive', 'past_progressive'] as Tense[],
  },
  {
    label: 'Other',
    tenses: ['gerund_participle'] as Tense[],
  },
];

export default function ConjugationScreen({ route, navigation }: ConjugationScreenProps) {
  const { infinitive } = route.params;
  const verb = (verbs as Record<string, VerbData>)[infinitive];
  const initialTense = route.params?.initialTense || 'present';
  const highlightForm = route.params?.highlightForm?.toLowerCase() || null;
  const [openTense, setOpenTense] = useState<Tense | null>(initialTense);

  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const favorited = isFavorite(infinitive);
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const highlightRef = useRef<View>(null);
  const scrollContentRef = useRef<View>(null);

  const toggleTense = (tense: Tense) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpenTense(openTense === tense ? null : tense);
  };

  return (
    <ScrollView ref={scrollRef} style={[styles.container, { backgroundColor: colors.bg }]}>
      <View ref={scrollContentRef}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={styles.headerTop}>
          <View style={styles.infinitiveRow}>
            <Text style={[styles.infinitive, { color: colors.primary }]}>{infinitive}</Text>
            <TouchableOpacity
              onPress={() => speak(infinitive)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="volume-medium-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => toggleFavorite(infinitive)}>
            <Ionicons
              name={favorited ? 'heart' : 'heart-outline'}
              size={28}
              color={favorited ? colors.primary : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
        <Text style={[styles.translation, { color: colors.textSecondary }]}>{verb.translation}</Text>
        <View
          style={[
            styles.tag,
            {
              backgroundColor: verb.regular ? colors.regularTag : colors.irregularTag,
              borderColor: verb.regular ? colors.regularTagText + '40' : colors.irregularTagText + '40',
            },
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

        {/* Example sentences */}
        {(() => {
          if (verb.examples && verb.examples.length > 0) {
            return (
              <View style={[styles.exampleBox, { backgroundColor: colors.card }]}>
                <Text style={[styles.exampleLabel, { color: colors.textMuted }]}>EXAMPLES</Text>
                {verb.examples.map((ex, i) => (
                  <Text key={i} style={[styles.exampleText, { color: colors.textSecondary }]}>
                    {ex}
                  </Text>
                ))}
              </View>
            );
          }
          const present = conjugate(infinitive, verb, 'present');
          const yoForm = present[0].form;
          const elForm = present[2].form;
          return (
            <View style={[styles.exampleBox, { backgroundColor: colors.card }]}>
              <Text style={[styles.exampleLabel, { color: colors.textMuted }]}>EXAMPLES</Text>
              <Text style={[styles.exampleText, { color: colors.textSecondary }]}>
                Yo <Text style={{ color: colors.primary, fontWeight: fonts.weights.semibold }}>{yoForm}</Text> todos los días.
              </Text>
              <Text style={[styles.exampleText, { color: colors.textSecondary }]}>
                Él <Text style={{ color: colors.primary, fontWeight: fonts.weights.semibold }}>{elForm}</Text> mucho.
              </Text>
            </View>
          );
        })()}
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
                      <TouchableOpacity
                        key={i}
                        ref={isHighlighted ? highlightRef as any : undefined}
                        onLayout={isHighlighted ? () => {
                          setTimeout(() => {
                            if (highlightRef.current && scrollContentRef.current) {
                              highlightRef.current.measureLayout(
                                scrollContentRef.current as any,
                                (_x, y) => {
                                  scrollRef.current?.scrollTo({ y: Math.max(0, y - 150), animated: true });
                                },
                                () => {},
                              );
                            }
                          }, 400);
                        } : undefined}
                        style={[
                          styles.row,
                          { borderBottomColor: colors.divider },
                          i === results.length - 1 && styles.lastRow,
                          row.disabled && styles.disabledRow,
                          isHighlighted && [styles.highlightedRow, { backgroundColor: colors.accentLight }],
                        ]}
                        onPress={() => {
                          if (!row.disabled) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            speak(row.form);
                          }
                        }}
                        activeOpacity={row.disabled ? 1 : 0.6}
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
                        <View style={styles.formContainer}>
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
                          {!row.disabled && (
                            <Ionicons name="volume-medium-outline" size={14} color={colors.textMuted} style={{ marginLeft: 6 }} />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: spacing.lg,
    margin: spacing.md,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  infinitiveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infinitive: { fontSize: fonts.sizes.hero, fontWeight: fonts.weights.bold },
  speakButton: { padding: 4 },
  translation: { fontSize: fonts.sizes.lg, marginTop: spacing.xs },
  tag: {
    marginTop: spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  tagText: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold },
  exampleBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  exampleLabel: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  exampleText: {
    fontSize: fonts.sizes.md,
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: 4,
  },
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
  tenseText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.medium },
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
  formContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  form: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.semibold, textAlign: 'right' },
  disabledText: { textDecorationLine: 'line-through' },
  disabledForm: { flex: 1, fontSize: fonts.sizes.lg, fontWeight: fonts.weights.regular, textAlign: 'right' },
});