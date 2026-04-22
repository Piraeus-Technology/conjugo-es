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
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import verbs from '../data/verbs.json';
import { VerbData, tenseNames } from '../utils/conjugate';
import { useHistoryStore } from '../store/historyStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { MAX_SEARCH_RESULTS } from '../utils/constants';
import {
  getExactConjugationMatches,
  normalizeSearchText,
  searchConjugations,
  searchVerbs,
  verbEntries,
  type VerbEntry,
} from '../utils/verbSearch';

function getVerbOfTheDay() {
  const today = new Date();
  const daysSinceEpoch = Math.floor(today.getTime() / (1000 * 60 * 60 * 24));
  const index = daysSinceEpoch % verbEntries.length;
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

export default function HomeScreen({ navigation }: { navigation: any }) {
  const [search, setSearch] = useState('');
  const { history, loaded, loadHistory, addToHistory, removeFromHistory, clearHistory } =
    useHistoryStore();
  const { favorites, loadFavorites, toggleFavorite } = useFavoritesStore();
  const colors = useColors();

  useEffect(() => {
    loadHistory();
    loadFavorites();
  }, [loadHistory, loadFavorites]);

  const results = useMemo((): SearchResult[] => {
    if (!search.trim()) return [];

    const query = normalizeSearchText(search);

    const exactConjMatches = getExactConjugationMatches(query);

    if (exactConjMatches.length > 0) {
      const grouped = new Map<string, SearchResult>();

      exactConjMatches.forEach((c) => {
        const detail = `"${c.form}" — ${tenseNames[c.tense]}, ${c.pronoun}`;
        const existing = grouped.get(c.infinitive);
        if (existing) {
          if (existing.matchDetail && !existing.matchDetail.includes(detail)) {
            const details = existing.matchDetail.split(' · ');
            if (details.length < 2) existing.matchDetail = [...details, detail].join(' · ');
          }
          return;
        }

        grouped.set(c.infinitive, {
          infinitive: c.infinitive,
          translation: c.translation,
          matchType: 'conjugation',
          matchLabel: 'Conjugation match',
          matchDetail: detail,
          matchTense: c.tense,
          matchForm: c.form,
        });
      });

      const exactResults = [...grouped.values()];
      const seen = new Set(exactResults.map(result => result.infinitive));

      const verbResults = searchVerbs(search);
      verbResults.forEach((r) => {
        if (!seen.has(r.item.infinitive)) {
          seen.add(r.item.infinitive);
          exactResults.push({
            infinitive: r.item.infinitive,
            translation: r.item.translation,
            matchType: 'infinitive',
            ...buildVerbMatchMeta(query, r.item),
          });
        }
      });

      return exactResults.slice(0, MAX_SEARCH_RESULTS);
    }

    const verbResults = searchVerbs(search)
      .map((r) => ({
        infinitive: r.item.infinitive,
        translation: r.item.translation,
        matchType: 'infinitive' as const,
        score: r.score ?? 1,
        ...buildVerbMatchMeta(query, r.item),
      }))
      .sort((a, b) => {
        const aExactInfinitive = normalizeSearchText(a.infinitive) === query ? 1 : 0;
        const bExactInfinitive = normalizeSearchText(b.infinitive) === query ? 1 : 0;
        if (aExactInfinitive !== bExactInfinitive) return bExactInfinitive - aExactInfinitive;

        const aExactTranslation = normalizeSearchText(a.translation) === query ? 1 : 0;
        const bExactTranslation = normalizeSearchText(b.translation) === query ? 1 : 0;
        if (aExactTranslation !== bExactTranslation) return bExactTranslation - aExactTranslation;

        return a.score - b.score;
      })
      .map(({ score: _score, ...result }) => result);

    const conjResults = searchConjugations(search);
    const seenConj = new Set<string>(verbResults.map((r) => r.infinitive));
    const conjGrouped: SearchResult[] = [];

    conjResults.forEach((r) => {
      if (!seenConj.has(r.item.infinitive)) {
        seenConj.add(r.item.infinitive);
        conjGrouped.push({
          infinitive: r.item.infinitive,
          translation: r.item.translation,
          matchType: 'conjugation',
          matchLabel: 'Conjugation match',
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
          {search.trim() && item.matchLabel && (
            <Text
              style={[
                styles.matchLabel,
                { color: item.matchType === 'conjugation' ? colors.primary : colors.textSecondary },
              ]}
            >
              {item.matchLabel}
            </Text>
          )}
          {search.trim() && item.matchDetail && (
            <Text
              style={[
                styles.matchDetail,
                { color: item.matchType === 'conjugation' ? colors.primary : colors.textMuted },
              ]}
            >
              {item.matchDetail}
            </Text>
          )}
        </View>
        {item.matchType === 'favorite' ? (
          <Ionicons name="heart" size={16} color={colors.primary} style={{ marginLeft: 8 }} />
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
                onPress={() => {
                  const votd = getVerbOfTheDay();
                  handleVerbPress(votd.infinitive);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.vodLabel, { color: colors.textMuted }]}>VERB OF THE DAY</Text>
                <Text style={[styles.vodVerb, { color: colors.primary }]}>{getVerbOfTheDay().infinitive}</Text>
                <Text style={[styles.vodTranslation, { color: colors.textSecondary }]}>{getVerbOfTheDay().translation}</Text>
                <View style={styles.vodBadgeRow}>
                  <View style={[styles.vodBadge, { backgroundColor: getVerbOfTheDay().regular ? colors.regularTag : colors.irregularTag }]}>
                    <Text style={[styles.vodBadgeText, { color: getVerbOfTheDay().regular ? colors.regularTagText : colors.irregularTagText }]}>
                      {getVerbOfTheDay().regular ? 'Regular' : 'Irregular'}
                    </Text>
                  </View>
                  <View style={[styles.vodBadge, { backgroundColor: colors.pillBg }]}>
                    <Text style={[styles.vodBadgeText, { color: colors.textSecondary }]}>
                      -{getVerbOfTheDay().type}
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
  heroTitle: { fontSize: fonts.sizes.hero, fontWeight: fonts.weights.bold, marginTop: spacing.md },
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
