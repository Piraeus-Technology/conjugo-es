import React, { useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { speak, stopSpeech } from '../utils/speech';
import verbs from '../data/verbs.json';
import {
  conjugate,
  tenseNames,
  Tense,
  VerbData,
} from '../utils/conjugate';
import { useFavoritesStore } from '../store/favoritesStore';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { getFamilyKey, getRuleNotes } from '../utils/conjugationInsights';
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
    // Searching a gerund/participle navigates here with this initialTense;
    // without a section for it the screen used to open with no table at all.
    label: 'Nonfinite',
    tenses: ['gerund_participle'] as Tense[],
  },
];

function getSnapshotRows(infinitive: string, verb: VerbData, tense: Tense | null) {
  const targetTense = tense ?? 'present';
  const rows = conjugate(infinitive, verb, targetTense)
    .map((row, index) => ({ ...row, index }))
    .filter(row => !row.disabled && row.form !== '—');

  const preferred = [0, 2, 3]
    .map(index => rows.find(row => row.index === index))
    .filter(Boolean) as (typeof rows[number])[];

  return preferred.length > 0 ? preferred : rows.slice(0, 3);
}

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
  const ruleNotes = useMemo(() => verb ? getRuleNotes(infinitive, verb) : [], [infinitive, verb]);
  const snapshotRows = useMemo(() => verb ? getSnapshotRows(infinitive, verb, openTense) : [], [infinitive, verb, openTense]);
  const relatedVerbs = useMemo(() => {
    if (!verb) return [];
    const familyKey = getFamilyKey(infinitive, verb);
    if (!familyKey) return [];

    return Object.entries(verbs as Record<string, VerbData>)
      .filter(([candidateInfinitive, candidateVerb]) =>
        candidateInfinitive !== infinitive && getFamilyKey(candidateInfinitive, candidateVerb) === familyKey
      )
      .slice(0, 6);
  }, [infinitive, verb]);

  const toggleTense = (tense: Tense) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpenTense(openTense === tense ? null : tense);
  };

  useFocusEffect(
    React.useCallback(() => {
      return () => stopSpeech();
    }, [])
  );

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stopSpeech();
    });
    return () => sub.remove();
  }, []);

  if (!verb) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }]}>
        <Text style={[styles.infinitive, { color: colors.primaryText, marginBottom: spacing.sm }]}>{infinitive}</Text>
        <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md, textAlign: 'center' }}>
          This verb is not available in the current dataset.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView ref={scrollRef} style={[styles.container, { backgroundColor: colors.bg }]}>
      <View ref={scrollContentRef}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={styles.headerTop}>
          <View style={styles.infinitiveRow}>
            <Text style={[styles.infinitive, { color: colors.primaryText }]}>{infinitive}</Text>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => speak(infinitive)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={`Play pronunciation of ${infinitive}`}
            >
              <Ionicons name="volume-medium-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => toggleFavorite(infinitive)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={favorited ? `Remove ${infinitive} from favorites` : `Add ${infinitive} to favorites`}
            accessibilityState={{ selected: favorited }}
          >
            <Ionicons
              name={favorited ? 'heart' : 'heart-outline'}
              size={28}
              color={favorited ? colors.primary : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
        <Text style={[styles.translation, { color: colors.textSecondary }]}>{verb.translation}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.tag, { backgroundColor: verb.regular ? colors.regularTag : colors.irregularTag }]}>
            <Text style={[styles.tagText, { color: verb.regular ? colors.regularTagText : colors.irregularTagText }]}>
              {verb.regular ? 'Regular' : 'Irregular'}
            </Text>
          </View>
          <View style={[styles.tag, { backgroundColor: colors.pillBg }]}>
            <Text style={[styles.tagText, { color: colors.textSecondary }]}>-{verb.type}</Text>
          </View>
          {verb.level && (
            <View style={[styles.tag, { backgroundColor: colors[`level${verb.level}Bg` as keyof typeof colors] ?? colors.pillBg }]}>
              <Text style={[styles.tagText, { color: colors[`level${verb.level}Text` as keyof typeof colors] ?? colors.textSecondary }]}>{verb.level}</Text>
            </View>
          )}
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
                    accessibilityRole="button"
                    accessibilityLabel={`${tenseNames[tense]} conjugations`}
                    accessibilityState={{ selected: isOpen, expanded: isOpen }}
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
                          // Delay to allow layout to settle before measuring.
                          // onLayout is a plain event handler (a returned
                          // "cleanup" would be ignored); the refs guard
                          // against firing after unmount.
                          setTimeout(() => {
                            if (highlightRef.current && scrollContentRef.current) {
                              highlightRef.current.measureLayout(
                                scrollContentRef.current as any,
                                (_x, y) => {
                                  scrollRef.current?.scrollTo({ y: Math.max(0, y - 150), animated: true });
                                },
                                () => { /* measureLayout can fail if views are unmounted */ },
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
                        accessibilityRole="button"
                        accessibilityLabel={
                          row.disabled
                            ? `${row.pronoun}, unavailable in ${tenseNames[tense]}`
                            : `Play pronunciation: ${row.pronoun}, ${row.form}`
                        }
                        accessibilityHint={row.disabled ? undefined : 'Speaks this conjugation aloud'}
                        accessibilityState={{ disabled: row.disabled }}
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
                                    { color: colors.primaryText },
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

      {snapshotRows.length > 0 && (
        <View style={[styles.detailBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
            {`${tenseNames[openTense ?? 'present']} Snapshot`.toUpperCase()}
          </Text>
          {snapshotRows.map((row) => (
            <View key={`${openTense ?? 'present'}-${row.index}`} style={styles.snapshotRow}>
              <Text style={[styles.snapshotPronoun, { color: colors.textSecondary }]}>{row.pronoun}</Text>
              <Text style={[styles.snapshotForm, { color: colors.primaryText }]}>{row.form}</Text>
            </View>
          ))}
        </View>
      )}

      {ruleNotes.length > 0 && (
        <View style={[styles.detailBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>RULE NOTES</Text>
          {ruleNotes.map((note) => (
            <View key={note} style={styles.noteRow}>
              <Ionicons name="sparkles-outline" size={14} color={colors.primaryText} style={styles.noteIcon} />
              <Text style={[styles.noteText, { color: colors.textSecondary }]}>{note}</Text>
            </View>
          ))}
        </View>
      )}

      {relatedVerbs.length > 0 && (
        <View style={[styles.detailBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>RELATED VERBS</Text>
          <View style={styles.relatedGrid}>
            {relatedVerbs.map(([relatedInfinitive, relatedVerb]) => (
              <TouchableOpacity
                key={relatedInfinitive}
                style={[styles.relatedChip, { backgroundColor: colors.pillBg }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.push('Conjugation', { infinitive: relatedInfinitive });
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Open ${relatedInfinitive}, ${relatedVerb.translation}`}
              >
                <Text style={[styles.relatedInfinitive, { color: colors.primaryText }]}>{relatedInfinitive}</Text>
                <Text style={[styles.relatedTranslation, { color: colors.textMuted }]} numberOfLines={1}>
                  {relatedVerb.translation}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

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
              Yo <Text style={{ color: colors.primaryText, fontWeight: fonts.weights.semibold }}>{yoForm}</Text> todos los días.
            </Text>
            <Text style={[styles.exampleText, { color: colors.textSecondary }]}>
              Él <Text style={{ color: colors.primaryText, fontWeight: fonts.weights.semibold }}>{elForm}</Text> mucho.
            </Text>
          </View>
        );
      })()}

      <View style={{ height: spacing.xl }} />
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
  headerIconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infinitiveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infinitive: { fontSize: fonts.sizes.hero, fontWeight: fonts.weights.bold },
  speakButton: { padding: 4 },
  translation: { fontSize: fonts.sizes.lg, marginTop: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.sm },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  tagText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.medium },
  detailBox: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  detailLabel: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  snapshotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  snapshotPronoun: {
    fontSize: fonts.sizes.sm,
    flex: 1,
  },
  snapshotForm: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    textAlign: 'right',
    flex: 1,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  noteIcon: {
    marginTop: 3,
    marginRight: spacing.sm,
  },
  noteText: {
    flex: 1,
    fontSize: fonts.sizes.sm,
    lineHeight: 20,
  },
  relatedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  relatedChip: {
    width: '48%',
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  relatedInfinitive: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    marginBottom: 2,
  },
  relatedTranslation: {
    fontSize: fonts.sizes.xs,
  },
  exampleBox: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
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
