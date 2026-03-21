import React, { useState, useMemo, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View,
  Text,
  TextInput,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import Fuse from 'fuse.js';
import verbs from '../data/verbs.json';
import { VerbData, conjugate, allTenses, tenseNames, Tense } from '../utils/conjugate';
import { useHistoryStore } from '../store/historyStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { MAX_SEARCH_RESULTS } from '../utils/constants';
import type { SearchScreenProps } from '../types/navigation';

const verbEntries = Object.entries(verbs as Record<string, VerbData>).map(
  ([infinitive, data]) => ({
    infinitive,
    ...data,
  })

);

function getVerbOfTheDay() {
  const today = new Date();
  const daysSinceEpoch = Math.floor(today.getTime() / (1000 * 60 * 60 * 24));
  const index = daysSinceEpoch % verbEntries.length;
  return verbEntries[index];
}

interface ConjMatch {
  infinitive: string;
  translation: string;
  tense: Tense;
  pronoun: string;
  form: string;
}

const verbFuse = new Fuse(verbEntries, {
  keys: ['infinitive', 'translation'],
  threshold: 0.3,
});

// Lazy-built conjugation index — only created on first search
let conjugationIndex: ConjMatch[] | null = null;
let conjFuse: Fuse<ConjMatch> | null = null;

function getConjugationIndex(): ConjMatch[] {
  if (conjugationIndex) return conjugationIndex;
  conjugationIndex = [];
  verbEntries.forEach((entry) => {
    allTenses.forEach((tense) => {
      const results = conjugate(entry.infinitive, entry, tense);
      results.forEach((r) => {
        if (!r.disabled && r.form !== '—') {
          const cleanForm = r.form.replace(/^no\s+/, '');
          conjugationIndex!.push({
            infinitive: entry.infinitive,
            translation: entry.translation,
            tense,
            pronoun: r.pronoun,
            form: cleanForm,
          });
        }
      });
    });
  });
  return conjugationIndex;
}

function getConjFuse(): Fuse<ConjMatch> {
  if (conjFuse) return conjFuse;
  conjFuse = new Fuse(getConjugationIndex(), {
    keys: ['form'],
    threshold: 0.2,
  });
  return conjFuse;
}

interface SearchResult {
  infinitive: string;
  translation: string;
  matchType: 'infinitive' | 'conjugation' | 'favorite' | 'history';
  matchDetail?: string;
  matchTense?: string;
  matchForm?: string;
}

export default function HomeScreen({ navigation }: SearchScreenProps) {
  const [search, setSearch] = useState('');
  const { history, loaded, loadHistory, addToHistory, removeFromHistory, clearHistory } =
    useHistoryStore();
  const { favorites, loadFavorites, toggleFavorite } = useFavoritesStore();
  const colors = useColors();

  useEffect(() => {
    loadHistory();
    loadFavorites();
  }, []);

  const results = useMemo((): SearchResult[] => {
    if (!search.trim()) return [];

    const query = search.trim().toLowerCase();

    const exactConjMatches = getConjugationIndex().filter(
      (c) => c.form.toLowerCase() === query
    );

    if (exactConjMatches.length > 0) {
      const seen = new Set<string>();
      const exactResults: SearchResult[] = [];

      exactConjMatches.forEach((c) => {
        if (!seen.has(c.infinitive)) {
          seen.add(c.infinitive);
          exactResults.push({
            infinitive: c.infinitive,
            translation: c.translation,
            matchType: 'conjugation',
            matchDetail: `"${c.form}" — ${tenseNames[c.tense]}, ${c.pronoun}`,
            matchTense: c.tense,
            matchForm: c.form,
          });
        }
      });

      const verbResults = verbFuse.search(search);
      verbResults.forEach((r) => {
        if (!seen.has(r.item.infinitive)) {
          seen.add(r.item.infinitive);
          exactResults.push({
            infinitive: r.item.infinitive,
            translation: r.item.translation,
            matchType: 'infinitive',
          });
        }
      });

      return exactResults.slice(0, MAX_SEARCH_RESULTS);
    }

    const verbResults = verbFuse.search(search).map((r) => ({
      infinitive: r.item.infinitive,
      translation: r.item.translation,
      matchType: 'infinitive' as const,
    }));

    const conjResults = getConjFuse().search(search);
    const seenConj = new Set<string>(verbResults.map((r) => r.infinitive));
    const conjGrouped: SearchResult[] = [];

    conjResults.forEach((r) => {
      if (!seenConj.has(r.item.infinitive)) {
        seenConj.add(r.item.infinitive);
        conjGrouped.push({
          infinitive: r.item.infinitive,
          translation: r.item.translation,
          matchType: 'conjugation',
          matchDetail: `"${r.item.form}" — ${tenseNames[r.item.tense]}, ${r.item.pronoun}`,
          matchTense: r.item.tense,
          matchForm: r.item.form,
        });
      }
    });

    return [...verbResults, ...conjGrouped].slice(0, MAX_SEARCH_RESULTS);
  }, [search]);

  const handleVerbPress = (infinitive: string, tense?: string, form?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToHistory(infinitive);
    navigation.navigate('Conjugation', { infinitive, initialTense: tense, highlightForm: form });
  };

  const sections = useMemo(() => {
    if (search.trim()) {
      return results.length > 0 ? [{ title: '', data: results }] : [];
    }

    const s: { title: string; data: SearchResult[]; clearable?: boolean }[] = [];

    if (favorites.length > 0) {
      s.push({
        title: 'Favorites',
        data: favorites.map((infinitive) => ({
          infinitive,
          translation: (verbs as Record<string, VerbData>)[infinitive]?.translation || '',
          matchType: 'favorite' as const,
        })),
      });
    }

    if (history.length > 0) {
      s.push({
        title: 'Recent',
        data: history.map((infinitive) => ({
          infinitive,
          translation: (verbs as Record<string, VerbData>)[infinitive]?.translation || '',
          matchType: 'history' as const,
        })),
        clearable: true,
      });
    }

    return s;
  }, [search, results, favorites, history]);

  const renderDeleteAction = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });
    return (
      <View style={styles.deleteAction}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
        </Animated.View>
      </View>
    );
  };

  const handleSwipeDelete = (item: SearchResult) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (item.matchType === 'favorite') {
      toggleFavorite(item.infinitive);
    } else if (item.matchType === 'history') {
      removeFromHistory(item.infinitive);
    }
  };

  const renderItem = ({ item }: { item: SearchResult }) => {
    const isSwipeable = item.matchType === 'favorite' || item.matchType === 'history';

    const row = (
      <TouchableOpacity
        style={[styles.verbItem, { backgroundColor: colors.bg }]}
        onPress={() => handleVerbPress(item.infinitive, item.matchTense, item.matchForm)}
        activeOpacity={0.6}
      >
        <View style={styles.verbInfo}>
          <Text style={[styles.verbName, { color: colors.textPrimary }]}>{item.infinitive}</Text>
          <Text style={[styles.verbTranslation, { color: colors.textSecondary }]}>{item.translation}</Text>
          {item.matchType === 'conjugation' && item.matchDetail && (
            <Text style={[styles.matchDetail, { color: colors.primary }]}>{item.matchDetail}</Text>
          )}
        </View>
        {item.matchType === 'favorite' ? (
          <Ionicons name="heart" size={16} color={colors.primary} />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        )}
      </TouchableOpacity>
    );

    if (!isSwipeable) return row;

    return (
      <Swipeable
        renderRightActions={renderDeleteAction}
        onSwipeableOpen={() => handleSwipeDelete(item)}
        overshootRight={false}
      >
        {row}
      </Swipeable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.searchContainer, { backgroundColor: colors.searchBg }]}>
        <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchBar, { color: colors.textPrimary }]}
          placeholder="Search verbs or conjugations..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => item.infinitive + item.matchType + index}
        renderItem={renderItem}
        ListHeaderComponent={
          !search.trim() ? (
            <TouchableOpacity
              style={[styles.vodCard, { backgroundColor: colors.card }]}
              onPress={() => {
                const votd = getVerbOfTheDay();
                handleVerbPress(votd.infinitive);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.vodLabel, { color: colors.textMuted }]}>VERB OF THE DAY</Text>
              <Text style={[styles.vodVerb, { color: colors.primary }]}>{getVerbOfTheDay().infinitive}</Text>
              <Text style={[styles.vodTranslation, { color: colors.textSecondary }]}>{getVerbOfTheDay().translation}</Text>
              <View style={[styles.vodBadge, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.vodBadgeText, { color: colors.primary }]}>
                  {getVerbOfTheDay().regular ? 'Regular' : 'Irregular'} • -{getVerbOfTheDay().type}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null
        }
        renderSectionHeader={({ section }) =>
          section.title ? (
            <View style={[styles.sectionHeader, { backgroundColor: colors.bg }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
              {(section as { clearable?: boolean }).clearable && (
                <TouchableOpacity onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); clearHistory(); }}>
                  <Text style={[styles.clearButton, { color: colors.primary }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.divider }]} />
        )}
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        ListEmptyComponent={
          search.trim() ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No verbs found</Text>
            </View>
          ) : sections.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.heroEmoji}>🇪🇸</Text>
              <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>ConjuGo ES</Text>
              <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
                Search for any Spanish verb or conjugation
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  searchIcon: { marginRight: spacing.sm },
  searchBar: { flex: 1, paddingVertical: 14, fontSize: fonts.sizes.md },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clearButton: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.medium },
  verbItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  verbInfo: { flex: 1 },
  verbName: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.semibold },
  verbTranslation: { fontSize: fonts.sizes.sm, marginTop: 2 },
  matchDetail: { fontSize: fonts.sizes.xs, marginTop: 4, fontStyle: 'italic' },
  separator: { height: 1, marginHorizontal: spacing.lg },
  sectionSeparator: { height: spacing.sm },
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: fonts.sizes.md, marginTop: spacing.md },
  heroEmoji: { fontSize: 48 },
  heroTitle: { fontSize: fonts.sizes.hero, fontWeight: fonts.weights.bold, marginTop: spacing.md },
  heroSubtitle: { fontSize: fonts.sizes.md, marginTop: spacing.xs },
  vodCard: {
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  vodLabel: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  vodVerb: {
    fontSize: fonts.sizes.xxl || 28,
    fontWeight: fonts.weights.bold,
    marginBottom: 4,
  },
  vodTranslation: {
    fontSize: fonts.sizes.md,
    marginBottom: spacing.md,
  },
  vodBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  vodBadgeText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
  },
  deleteAction: {
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
});