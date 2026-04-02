import React, { useMemo, useRef, useState } from 'react';
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
];

const familyBases = ['decir', 'hacer', 'poner', 'tener', 'venir', 'traer', 'ver', 'oír', 'reír'] as const;

function getRuleNotes(infinitive: string, verb: VerbData): string[] {
  const notes = new Set<string>();
  const pattern = verb.pattern;

  switch (pattern?.stemChange?.present) {
    case 'e_ie':
      notes.add('Present tense stem change: e -> ie in boot forms.');
      break;
    case 'o_ue':
      notes.add('Present tense stem change: o -> ue in boot forms.');
      break;
    case 'e_i':
      notes.add('Present tense stem change: e -> i in boot forms.');
      break;
    case 'u_ue':
      notes.add('Present tense stem change: u -> ue in boot forms.');
      break;
  }

  switch (pattern?.stemChange?.preterite) {
    case 'e_i':
      notes.add('Preterite and related subjunctive forms use e -> i in the third person / nosotros-vosotros patterns.');
      break;
    case 'o_u':
      notes.add('Preterite and related subjunctive forms use o -> u in the third person / nosotros-vosotros patterns.');
      break;
  }

  if (pattern?.yoGo) notes.add('Irregular yo form: the present tense yo form ends in -go.');
  if (pattern?.yoZco) notes.add('Irregular yo form: the present tense yo form ends in -zco.');
  if (pattern?.irregularFutureStem) notes.add('Future and conditional use an irregular stem.');
  if (pattern?.irregularPreteriteStem) notes.add('Preterite and imperfect subjunctive use an irregular preterite stem.');

  switch (pattern?.spellingChange) {
    case 'car_qué':
      notes.add('Spelling change: c -> qu before e in affected forms.');
      break;
    case 'gar_gué':
      notes.add('Spelling change: g -> gu before e in affected forms.');
      break;
    case 'zar_cé':
      notes.add('Spelling change: z -> c before e in affected forms.');
      break;
    case 'cer_z':
      notes.add('Spelling change: c -> z before a / o in subjunctive and imperative-related forms.');
      break;
    case 'ger_j':
    case 'gir_j':
      notes.add('Spelling change: g -> j before a / o in subjunctive and imperative-related forms.');
      break;
    case 'guir_g':
      notes.add('Spelling change: gu -> g in affected present/subjunctive forms.');
      break;
    case 'uir_uy':
      notes.add('Y-insertion pattern: forms like present, preterite third person, and subjunctive keep y.');
      break;
  }

  const [gerund, participle] = conjugate(infinitive, verb, 'gerund_participle').map(r => r.form);
  const regularGerund = verb.type === 'ar' ? `${infinitive.slice(0, -2)}ando` : `${infinitive.slice(0, -2)}iendo`;
  const regularParticiple = verb.type === 'ar' ? `${infinitive.slice(0, -2)}ado` : `${infinitive.slice(0, -2)}ido`;

  if (gerund !== regularGerund) notes.add(`Irregular gerund: ${gerund}.`);
  if (participle !== regularParticiple) notes.add(`Irregular past participle: ${participle}.`);

  if (verb.overrides?.present || verb.overrides?.preterite || verb.overrides?.subjunctive_present) {
    notes.add('Some core forms are fully overridden rather than generated from a regular pattern.');
  }

  return [...notes];
}

function getFamilyKey(infinitive: string, verb: VerbData): string | null {
  for (const base of familyBases) {
    if (infinitive === base || infinitive.endsWith(base)) return `base:${base}`;
  }

  if (verb.pattern?.spellingChange) return `spelling:${verb.pattern.spellingChange}`;
  if (verb.pattern?.yoZco) return 'family:yoZco';
  if (verb.pattern?.yoGo) return 'family:yoGo';
  if (verb.pattern?.stemChange?.present || verb.pattern?.stemChange?.preterite) {
    return `stem:${verb.pattern.stemChange?.present ?? 'none'}:${verb.pattern.stemChange?.preterite ?? 'none'}`;
  }

  return null;
}

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
  const ruleNotes = useMemo(() => getRuleNotes(infinitive, verb), [infinitive, verb]);
  const snapshotRows = useMemo(() => getSnapshotRows(infinitive, verb, openTense), [infinitive, verb, openTense]);
  const relatedVerbs = useMemo(() => {
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

  if (!verb) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }]}>
        <Text style={[styles.infinitive, { color: colors.primary, marginBottom: spacing.sm }]}>{infinitive}</Text>
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
            <View style={[styles.tag, { backgroundColor: (colors as any)[`level${verb.level}Bg`] || colors.pillBg }]}>
              <Text style={[styles.tagText, { color: (colors as any)[`level${verb.level}Text`] || colors.textSecondary }]}>{verb.level}</Text>
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

      {snapshotRows.length > 0 && (
        <View style={[styles.detailBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
            {`${tenseNames[openTense ?? 'present']} Snapshot`.toUpperCase()}
          </Text>
          {snapshotRows.map((row) => (
            <View key={`${openTense ?? 'present'}-${row.index}`} style={styles.snapshotRow}>
              <Text style={[styles.snapshotPronoun, { color: colors.textSecondary }]}>{row.pronoun}</Text>
              <Text style={[styles.snapshotForm, { color: colors.primary }]}>{row.form}</Text>
            </View>
          ))}
        </View>
      )}

      {ruleNotes.length > 0 && (
        <View style={[styles.detailBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>RULE NOTES</Text>
          {ruleNotes.map((note) => (
            <View key={note} style={styles.noteRow}>
              <Ionicons name="sparkles-outline" size={14} color={colors.primary} style={styles.noteIcon} />
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
              >
                <Text style={[styles.relatedInfinitive, { color: colors.primary }]}>{relatedInfinitive}</Text>
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
              Yo <Text style={{ color: colors.primary, fontWeight: fonts.weights.semibold }}>{yoForm}</Text> todos los días.
            </Text>
            <Text style={[styles.exampleText, { color: colors.textSecondary }]}>
              Él <Text style={{ color: colors.primary, fontWeight: fonts.weights.semibold }}>{elForm}</Text> mucho.
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
