import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useColors, fonts, spacing, radius } from '../utils/theme';

const tips = [
  { id: 'tip_small', emoji: '☕', label: 'Small Tip', price: '$0.99', description: 'Buy me a coffee' },
  { id: 'tip_medium', emoji: '🌮', label: 'Medium Tip', price: '$2.99', description: 'Buy me a taco' },
  { id: 'tip_large', emoji: '🎉', label: 'Big Tip', price: '$4.99', description: "You're amazing!" },
];

export default function TipJarScreen() {
  const colors = useColors();
  const [customAmount, setCustomAmount] = useState('');

  const handleTip = (label: string) => {
    Alert.alert(
      'Thank you! 🎉',
      'In-app purchases will be available once the app is on the App Store. Thanks for your support!'
    );
  };

  const handleCustomTip = () => {
    const amount = parseFloat(customAmount);
    if (!amount || amount < 0.99) {
      Alert.alert('Invalid Amount', 'Please enter an amount of $0.99 or more.');
      return;
    }
    handleTip(`Custom ($${amount.toFixed(2)})`);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>❤️</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Support ConjuGo!</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            ConjuGo! is completely free with no ads. If you find it useful, a small tip helps keep it going!
          </Text>
        </View>

        <View style={styles.tipList}>
          {tips.map((tip) => (
            <TouchableOpacity
              key={tip.id}
              style={[styles.tipCard, { backgroundColor: colors.card }]}
              onPress={() => handleTip(tip.label)}
              activeOpacity={0.7}
            >
              <Text style={styles.tipEmoji}>{tip.emoji}</Text>
              <View style={styles.tipInfo}>
                <Text style={[styles.tipLabel, { color: colors.textPrimary }]}>{tip.label}</Text>
                <Text style={[styles.tipDescription, { color: colors.textSecondary }]}>{tip.description}</Text>
              </View>
              <View style={[styles.priceButton, { backgroundColor: '#43A047' }]}>
                <Text style={styles.priceText}>{tip.price}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <View style={[styles.tipCard, { backgroundColor: colors.card }]}>
            <Text style={styles.tipEmoji}>💝</Text>
            <View style={styles.tipInfo}>
              <Text style={[styles.tipLabel, { color: colors.textPrimary }]}>Custom Tip</Text>
              <View style={styles.customInputRow}>
                <Text style={[styles.dollarSign, { color: colors.textPrimary }]}>$</Text>
                <TextInput
                  style={[styles.customInput, { color: colors.textPrimary, borderBottomColor: colors.divider }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  value={customAmount}
                  onChangeText={setCustomAmount}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.priceButton,
                { backgroundColor: customAmount ? '#43A047' : colors.pillBg },
              ]}
              onPress={handleCustomTip}
              disabled={!customAmount}
            >
              <Text
                style={[
                  styles.priceText,
                  { color: customAmount ? '#FFFFFF' : colors.textMuted },
                ]}
              >
                Tip
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          All features remain free regardless. Tips are one-time purchases and non-refundable.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  header: { alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl },
  headerEmoji: { fontSize: 48 },
  title: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, marginTop: spacing.md },
  subtitle: {
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },
  tipList: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tipEmoji: { fontSize: 32, marginRight: spacing.md },
  tipInfo: { flex: 1 },
  tipLabel: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.semibold },
  tipDescription: { fontSize: fonts.sizes.sm, marginTop: 2 },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dollarSign: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.semibold,
    marginRight: 2,
  },
  customInput: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.semibold,
    borderBottomWidth: 1,
    paddingVertical: 2,
    minWidth: 60,
  },
  priceButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  priceText: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.bold, color: '#FFFFFF' },
  footer: {
    fontSize: fonts.sizes.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    lineHeight: 18,
  },
});