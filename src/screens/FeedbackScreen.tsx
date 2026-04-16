import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
  Linking,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useThemeStore } from '../store/themeStore';
import {
  APP_NAME,
  APP_REVIEW_URL,
  APP_STORE_URL,
  APP_VERSION,
  FEEDBACK_EMAIL,
  PRIVACY_POLICY_URL,
  SHARE_MESSAGE,
} from '../utils/appMeta';
import { useTipJar } from '../utils/tipJar';

export default function FeedbackScreen() {
  const colors = useColors();
  const nav = useNavigation<any>();
  const { isDark, autoTTS, includeVosotros, toggleTheme, toggleAutoTTS, toggleVosotros } = useThemeStore();
  const {
    products,
    loading: tipLoading,
    unavailable: tipUnavailable,
    unsupported: tipUnsupported,
    tip,
  } = useTipJar();

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`${APP_NAME} Feedback`);
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${subject}`;

    Linking.openURL(url).catch(() => {
      Alert.alert(
        'No Email App',
        `You can send feedback directly to ${FEEDBACK_EMAIL}`
      );
    });
  };

  const handleRateApp = () => {
    const url = Platform.select({
      ios: APP_REVIEW_URL,
      android: 'market://details?id=com.lkh9596.conjugo',
      default: APP_STORE_URL,
    });
    Linking.openURL(url).catch(() => {
      Alert.alert('Not Available Yet', 'Rating will be available once the app is on the App Store.');
    });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Quiz Stats button */}
        <TouchableOpacity
          style={[styles.rateCard, { backgroundColor: colors.card }]}
          onPress={() => nav.navigate('Stats')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open quiz stats"
        >
          <Ionicons name="bar-chart-outline" size={24} color={colors.primary} style={{ marginRight: spacing.md }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rateTitle, { color: colors.textPrimary }]}>Quiz Stats</Text>
            <Text style={[styles.rateSubtitle, { color: colors.textSecondary }]}>View your progress and daily activity</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Flashcard Stats button */}
        <TouchableOpacity
          style={[styles.rateCard, { backgroundColor: colors.card, marginTop: spacing.sm }]}
          onPress={() => nav.navigate('FlashcardStats')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open flashcard stats"
        >
          <Ionicons name="layers-outline" size={24} color={colors.primary} style={{ marginRight: spacing.md }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rateTitle, { color: colors.textPrimary }]}>Flashcard Stats</Text>
            <Text style={[styles.rateSubtitle, { color: colors.textSecondary }]}>View your flashcard progress</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Settings section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Settings</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
          <View style={[styles.settingRow, { borderBottomColor: colors.divider }]}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: isDark ? colors.border : '#C5C0BA', true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.settingRow, { borderBottomColor: colors.divider }]}>
            <Ionicons name="volume-medium" size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Auto-Play Audio</Text>
            <Switch
              value={autoTTS}
              onValueChange={toggleAutoTTS}
              trackColor={{ false: isDark ? colors.border : '#C5C0BA', true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.settingRow, { borderBottomColor: colors.divider }]}>
            <Ionicons name="people" size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Include Vosotros</Text>
            <Switch
              value={includeVosotros}
              onValueChange={toggleVosotros}
              trackColor={{ false: isDark ? colors.border : '#C5C0BA', true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Tip Jar */}
        {(products.length > 0 || tipUnavailable) && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Tip Jar</Text>
            {products.length > 0 ? (
              <>
                <Text style={[styles.tipDescription, { color: colors.textSecondary }]}>
                  {APP_NAME} is free with no ads. If you find it helpful, consider leaving a tip!
                </Text>
                <View style={styles.tipRow}>
                  {products.map((product) => (
                    <TouchableOpacity
                      key={product.id}
                      style={[styles.tipButton, { backgroundColor: colors.card, borderColor: colors.primary }]}
                      onPress={() => tip(product.id)}
                      disabled={tipLoading}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Leave a ${product.displayPrice} tip`}
                      accessibilityState={{ disabled: tipLoading }}
                    >
                      <Text style={[styles.tipPrice, { color: colors.primary }]}>{product.displayPrice}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <Text style={[styles.tipDescription, { color: colors.textMuted }]}>
                {tipUnsupported
                  ? 'Tip Jar is not available in this environment. Please use the installed app.'
                  : 'Tip Jar is temporarily unavailable on this device right now.'}
              </Text>
            )}
          </>
        )}

        {/* Feedback & Rate */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Support</Text>
        <TouchableOpacity
          style={[styles.rateCard, { backgroundColor: colors.card }]}
          onPress={handleSendEmail}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Send feedback email"
        >
          <Text style={styles.rateEmoji}>💬</Text>
          <View style={styles.rateInfo}>
            <Text style={[styles.rateTitle, { color: colors.textPrimary }]}>Send Feedback</Text>
            <Text style={[styles.rateSubtitle, { color: colors.textSecondary }]}>Bug reports, suggestions, missing verbs</Text>
          </View>
        </TouchableOpacity>

        {/* Rate */}
        <TouchableOpacity
          style={[styles.rateCard, { backgroundColor: colors.card }]}
          onPress={handleRateApp}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Rate ${APP_NAME} on the App Store`}
        >
          <Text style={styles.rateEmoji}>⭐</Text>
          <View style={styles.rateInfo}>
            <Text style={[styles.rateTitle, { color: colors.textPrimary }]}>Enjoying {APP_NAME}?</Text>
            <Text style={[styles.rateSubtitle, { color: colors.textSecondary }]}>Rate us on the App Store</Text>
          </View>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          style={[styles.rateCard, { backgroundColor: colors.card }]}
          onPress={() => {
            Share.share({
              message: SHARE_MESSAGE,
            }).catch((e) => console.warn('Share failed:', e));
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Share ${APP_NAME}`}
        >
          <Text style={styles.rateEmoji}>🔗</Text>
          <View style={styles.rateInfo}>
            <Text style={[styles.rateTitle, { color: colors.textPrimary }]}>Share {APP_NAME}</Text>
            <Text style={[styles.rateSubtitle, { color: colors.textSecondary }]}>Tell a friend about the app</Text>
          </View>
        </TouchableOpacity>

        {/* Privacy Policy */}
        <TouchableOpacity
          style={[styles.linkRow, { backgroundColor: colors.card }]}
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch((e) => console.warn('Failed to open privacy policy:', e))}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel="Open privacy policy"
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.linkText, { color: colors.textPrimary }]}>Privacy Policy</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={[styles.version, { color: colors.textMuted }]}>
          {APP_NAME} v{APP_VERSION}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg },
  sectionTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  settingsCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  settingLabel: {
    flex: 1,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
  },
  tipDescription: {
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  tipRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tipButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tipPrice: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
  },
  rateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rateEmoji: { fontSize: 32, marginRight: spacing.md },
  rateInfo: { flex: 1 },
  rateTitle: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.semibold },
  rateSubtitle: { fontSize: fonts.sizes.sm, marginTop: 2 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  linkText: {
    flex: 1,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
  },
  version: {
    fontSize: fonts.sizes.xs,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
});
