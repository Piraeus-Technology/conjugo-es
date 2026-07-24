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
  Image,
} from 'react-native';
// Keep the legacy RNGH Swipeable during the SDK 54 maintenance pass. Its
// replacement requires Reanimated, which this app otherwise does not use.
import { Swipeable } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import verbs from '../data/verbs.json';
import { VerbData, tenseNames } from '../utils/conjugate';
import { useHistoryStore } from '../store/historyStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { MAX_SEARCH_RESULTS } from '../utils/constants';
import {
  normalizeSearchText,
  searchConjugations,
  searchVerbs,
  verbEntries,
  type VerbEntry,
} from '../utils/verbSearch';
import { isSearchDebouncePending } from '../utils/searchDebounce';

function getVerbOfTheDay() {
  // Count days in LOCAL time so the verb rolls over at local midnight,
  // not UTC midnight.
  const today = new Date();
  const localDays = Math.floor(
    (today.getTime() - today.getTimezoneOffset() * 60 * 1000) / (1000 * 60 * 60 * 24),
  );
  const index = localDays % verbEntries.length;
  return verbEntries[index];
}

interface SearchResult {
  infinitive: string;
  translation: string;
  matchType: 'infinitive' | 'conjugation' | 'favorite' | 'history';
  matchLabel?: string;
  matchDetail?: string;
  matchTense?: string;
  matchForm?: string;
}

function buildVerbMatchMeta(
  query: string,
  entry: VerbEntry,
): Pick<SearchResult, 'matchLabel' | 'matchDetail'> {
  const normalizedInfinitive = entry.normalizedInfinitive;
  const normalizedTranslation = entry.normalizedTranslation;

  if (query === normalizedInfinitive) {
    return {
      matchLabel: 'Infinitive match',
      matchDetail: `Exact match for "${entry.infinitive}"`,
    };
  }

  if (normalizedInfinitive.startsWith(query)) {
    return {
      matchLabel: 'Infinitive match',
      matchDetail: `Starts with "${entry.infinitive.slice(0, Math.min(entry.infinitive.length, query.length))}"`,
    };
  }

  if (query === normalizedTranslation) {
    return {
      matchLabel: 'English match',
      matchDetail: `Exact match for "${entry.translation}"`,
    };
  }

  if (normalizedTranslation.includes(query)) {
    return {
      matchLabel: 'English match',
      matchDetail: `Matched in "${entry.translation}"`,
    };
  }

  return {
    matchLabel: 'Search match',
    matchDetail: `Matched "${entry.infinitive}" or its translation`,
  };
}

function buildVerbSearchResults(searchValue: string, query: string): SearchResult[] {
  return searchVerbs(searchValue)
    .map((result) => ({
      infinitive: result.item.infinitive,
      translation: result.item.translation,
      matchType: 'infinitive' as const,
      score: result.score ?? 1,
      ...buildVerbMatchMeta(query, result.item),
    }))
    .sort((first, second) => {
      const firstExactInfinitive = normalizeSearchText(first.infinitive) === query ? 1 : 0;
      const secondExactInfinitive = normalizeSearchText(second.infinitive) === query ? 1 : 0;
      if (firstExactInfinitive !== secondExactInfinitive) {
        return secondExactInfinitive - firstExactInfinitive;
      }

      const firstExactTranslation = normalizeSearchText(first.translation) === query ? 1 : 0;
      const secondExactTranslation = normalizeSearchText(second.translation) === query ? 1 : 0;
      if (firstExactTranslation !== secondExactTranslation) {
        return secondExactTranslation - firstExactTranslation;
      }

      return first.score - second.score;
    })
    .map(({ score: _score, ...result }) => result);
}

async function buildSearchResults(
  searchValue: string,
  shouldCancel: () => boolean,
): Promise<SearchResult[]> {
  const query = normalizeSearchText(searchValue);
  const verbResults = buildVerbSearchResults(searchValue, query);
  if (query.length < 3) return verbResults.slice(0, MAX_SEARCH_RESULTS);

  const conjugationResults = await searchConjugations(searchValue, shouldCancel);
  if (shouldCancel()) return verbResults.slice(0, MAX_SEARCH_RESULTS);
  const exactConjugations = conjugationResults
    .map((result) => result.item)
    .filter((conjugation) => conjugation.normalizedForm === query);
  if (exactConjugations.length > 0) {
    const grouped = new Map<string, SearchResult>();

    exactConjugations.forEach((conjugation) => {
      const detail = `"${conjugation.form}" — ${tenseNames[conjugation.tense]}, ${conjugation.pronoun}`;
      const existing = grouped.get(conjugation.infinitive);
      if (existing) {
        if (existing.matchDetail && !existing.matchDetail.includes(detail)) {
          const details = existing.matchDetail.split(' · ');
          if (details.length < 2) {
            existing.matchDetail = [...details, detail].join(' · ');
          }
        }
        return;
      }

      grouped.set(conjugation.infinitive, {
        infinitive: conjugation.infinitive,
        translation: conjugation.translation,
        matchType: 'conjugation',
        matchLabel: 'Conjugation match',
        matchDetail: detail,
        matchTense: conjugation.tense,
        matchForm: conjugation.form,
      });
    });

    const exactResults = [...grouped.values()];
    const seen = new Set(exactResults.map((result) => result.infinitive));
    verbResults.forEach((result) => {
      if (!seen.has(result.infinitive)) {
        seen.add(result.infinitive);
        exactResults.push(result);
      }
    });
    return exactResults.slice(0, MAX_SEARCH_RESULTS);
  }

  const seen = new Set(verbResults.map((result) => result.infinitive));
  const groupedConjugations: SearchResult[] = [];

  conjugationResults.forEach((result) => {
    if (seen.has(result.item.infinitive)) return;
    seen.add(result.item.infinitive);
    groupedConjugations.push({
      infinitive: result.item.infinitive,
      translation: result.item.translation,
      matchType: 'conjugation',
      matchLabel: 'Conjugation match',
      matchDetail: `"${result.item.form}" — ${tenseNames[result.item.tense]}, ${result.item.pronoun}`,
      matchTense: result.item.tense,
      matchForm: result.item.form,
    });
  });

  return [...verbResults, ...groupedConjugations].slice(0, MAX_SEARCH_RESULTS);
}

export default function HomeScreen({ navigation }: { navigation: any }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [conjugationSearchPending, setConjugationSearchPending] = useState(false);
  const { history, loadHistory, addToHistory, removeFromHistory, clearHistory } =
    useHistoryStore();
  const { favorites, loadFavorites, toggleFavorite } = useFavoritesStore();
  const colors = useColors();
  const searchPending =
    isSearchDebouncePending(search, debouncedSearch) || conjugationSearchPending;
  const verbOfTheDay = getVerbOfTheDay();

  useEffect(() => {
    loadHistory();
    loadFavorites();
  }, [loadHistory, loadFavorites]);

  // Debounce search so async conjugation queries do not restart on every
  // keystroke. Empty queries skip the debounce so clearing the input snaps
  // back to history/favorites immediately.
  useEffect(() => {
    if (!search.trim()) {
      setDebouncedSearch('');
      return;
    }
    const t = setTimeout(() => setDebouncedSearch(search), 120);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const searchValue = debouncedSearch.trim();
    if (!searchValue) {
      setResults([]);
      setConjugationSearchPending(false);
      return;
    }

    const query = normalizeSearchText(searchValue);
    // Infinitive/translation matches are cheap, so show them immediately
    // while the conjugation matrix is scanned in event-loop-sized chunks.
    setResults(buildVerbSearchResults(searchValue, query).slice(0, MAX_SEARCH_RESULTS));
    if (query.length < 3) {
      setConjugationSearchPending(false);
      return;
    }

    setConjugationSearchPending(true);
    buildSearchResults(searchValue, () => cancelled)
      .then((nextResults) => {
        if (!cancelled) setResults(nextResults);
      })
      .catch((error) => {
        if (!cancelled) console.warn('Conjugation search failed:', error);
      })
      .finally(() => {
        if (!cancelled) setConjugationSearchPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const handleVerbPress = (infinitive: string, tense?: string, form?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToHistory(infinitive);
    navigation.navigate('Conjugation', { infinitive, initialTense: tense, highlightForm: form });
  };

  const sections = useMemo(() => {
    if (search.trim()) {
      // While the debounce is pending, keep showing the previous results —
      // returning [] here blanked the list on every keystroke.
      return results.length > 0 ? [{ title: '', data: results }] : [];
    }

    const s: { title: string; data: SearchResult[]; clearable?: boolean }[] = [];
    const verbMap = verbs as Record<string, VerbData>;

    const favoriteData = favorites
      .map((infinitive): SearchResult | null => {
        const entry = verbMap[infinitive];
        if (!entry) return null;
        return {
          infinitive,
          translation: entry.translation,
          matchType: 'favorite',
        };
      })
      .filter((item): item is SearchResult => item !== null);

    if (favoriteData.length > 0) {
      s.push({ title: 'Favorites', data: favoriteData });
    }

    const historyData = history
      .map((infinitive): SearchResult | null => {
        const entry = verbMap[infinitive];
        if (!entry) return null;
        return {
          infinitive,
          translation: entry.translation,
          matchType: 'history',
        };
      })
      .filter((item): item is SearchResult => item !== null);

    if (historyData.length > 0) {
      s.push({ title: 'Recent', data: historyData, clearable: true });
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
        accessibilityRole="button"
        accessibilityLabel={`${item.infinitive}, ${item.translation}`}
        accessibilityHint={item.matchDetail || 'Opens conjugation table'}
      >
        <View style={styles.verbInfo}>
          <Text style={[styles.verbName, { color: colors.textPrimary }]}>{item.infinitive}</Text>
          <Text style={[styles.verbTranslation, { color: colors.textSecondary }]}>{item.translation}</Text>
          {search.trim() && !searchPending && item.matchLabel && (
            <Text
              style={[
                styles.matchLabel,
                { color: item.matchType === 'conjugation' ? colors.primaryText : colors.textSecondary },
              ]}
            >
              {item.matchLabel}
            </Text>
          )}
          {search.trim() && !searchPending && item.matchDetail && (
            <Text
              style={[
                styles.matchDetail,
                { color: item.matchType === 'conjugation' ? colors.primaryText : colors.textMuted },
              ]}
            >
              {item.matchDetail}
            </Text>
          )}
        </View>
        {item.matchType === 'favorite' ? (
          <Ionicons name="heart" size={16} color={colors.primaryText} style={{ marginLeft: 8 }} />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 8 }} />
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
          <TouchableOpacity
            onPress={() => setSearch('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) =>
          `${item.matchType}:${item.infinitive}:${item.matchTense ?? ''}:${item.matchForm ?? ''}`
        }
        renderItem={renderItem}
        ListHeaderComponent={
          !search.trim() ? (
            <View style={styles.vodWrapper}>
              <TouchableOpacity
                style={[styles.vodCard, { backgroundColor: colors.card }]}
                onPress={() => handleVerbPress(verbOfTheDay.infinitive)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Verb of the day: ${verbOfTheDay.infinitive}, ${verbOfTheDay.translation}, ${verbOfTheDay.regular ? 'regular' : 'irregular'} verb`}
                accessibilityHint="Opens the full conjugation"
              >
                <Text style={[styles.vodLabel, { color: colors.textMuted }]}>VERB OF THE DAY</Text>
                <Text style={[styles.vodVerb, { color: colors.primaryText }]}>{verbOfTheDay.infinitive}</Text>
                <Text style={[styles.vodTranslation, { color: colors.textSecondary }]}>{verbOfTheDay.translation}</Text>
                <View style={styles.vodBadgeRow}>
                  <View style={[styles.vodBadge, { backgroundColor: verbOfTheDay.regular ? colors.regularTag : colors.irregularTag }]}>
                    <Text style={[styles.vodBadgeText, { color: verbOfTheDay.regular ? colors.regularTagText : colors.irregularTagText }]}>
                      {verbOfTheDay.regular ? 'Regular' : 'Irregular'}
                    </Text>
                  </View>
                  <View style={[styles.vodBadge, { backgroundColor: colors.pillBg }]}>
                    <Text style={[styles.vodBadgeText, { color: colors.textSecondary }]}>
                      -{verbOfTheDay.type}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) =>
          section.title ? (
            <View style={[styles.sectionHeader, { backgroundColor: colors.bg }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
              {(section as { clearable?: boolean }).clearable && (
                <TouchableOpacity
                  onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); clearHistory(); }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear recent verbs"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={[styles.clearButton, { color: colors.primaryText }]}>Clear</Text>
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
            searchPending ? null : (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No verbs found</Text>
            </View>
            )
          ) : sections.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Image source={require('../../assets/logo.png')} style={styles.heroLogo} />
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
  matchLabel: {
    fontSize: fonts.sizes.xs,
    marginTop: 6,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchDetail: { fontSize: fonts.sizes.xs, marginTop: 4, fontStyle: 'italic' },
  separator: { height: 1, marginHorizontal: spacing.lg },
  sectionSeparator: { height: spacing.sm },
  emptyContainer: { alignItems: 'center', paddingTop: spacing.lg },
  emptyText: { fontSize: fonts.sizes.md, marginTop: spacing.md },
  heroLogo: { width: 160, height: 160, borderRadius: 32 },
  heroSubtitle: { fontSize: fonts.sizes.md, marginTop: spacing.md },
  vodWrapper: {
    marginTop: spacing.sm,
  },
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
  vodBadgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
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
