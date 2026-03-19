import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, fonts, spacing, radius } from '../utils/theme';

export default function FeedbackScreen() {
  const colors = useColors();
  const [message, setMessage] = useState('');

  const handleSendEmail = () => {
    if (!message.trim()) {
      Alert.alert('Empty Message', 'Please write your feedback before sending.');
      return;
    }

    const subject = encodeURIComponent('ConjuGo ES Feedback');
    const body = encodeURIComponent(message);
    const url = `mailto:lkh9596@gmail.com?subject=${subject}&body=${body}`;

    Linking.openURL(url).catch(() => {
      Alert.alert(
        'No Email App',
        'Could not open your email app. You can send feedback directly to lkh9596@gmail.com'
      );
    });
  };

  const handleRateApp = () => {
    // App Store IDs ready for when deployed:
    // iOS: 6759270074, Android: com.lkh9596.conjugo
    const url = Platform.select({
      ios: 'https://apps.apple.com/app/id6759270074?action=write-review',
      android: 'market://details?id=com.lkh9596.conjugo',
      default: 'https://apps.apple.com/app/id6759270074',
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
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>💬</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>We'd Love Your Feedback</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Found a bug? Have a suggestion? Missing a verb? Let us know!
          </Text>
        </View>

        <View style={[styles.inputCard, { backgroundColor: colors.card }]}>
          <TextInput
            style={[styles.textInput, { color: colors.textPrimary, borderColor: colors.divider }]}
            placeholder="Write your feedback here..."
            placeholderTextColor={colors.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: message.trim() ? '#43A047' : colors.pillBg },
            ]}
            onPress={handleSendEmail}
            disabled={!message.trim()}
          >
            <Ionicons
              name="send"
              size={18}
              color={message.trim() ? '#FFFFFF' : colors.textMuted}
            />
            <Text
              style={[
                styles.sendText,
                { color: message.trim() ? '#FFFFFF' : colors.textMuted },
              ]}
            >
              Send Feedback
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.rateCard, { backgroundColor: colors.card }]}
          onPress={handleRateApp}
          activeOpacity={0.7}
        >
          <Text style={styles.rateEmoji}>⭐</Text>
          <View style={styles.rateInfo}>
            <Text style={[styles.rateTitle, { color: colors.textPrimary }]}>Enjoying ConjuGo ES?</Text>
            <Text style={[styles.rateSubtitle, { color: colors.textSecondary }]}>Rate us on the App Store</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg },
  header: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.lg },
  headerEmoji: { fontSize: 48 },
  title: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, marginTop: spacing.md },
  subtitle: {
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  inputCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  textInput: {
    fontSize: fonts.sizes.md,
    minHeight: 140,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    lineHeight: 22,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    marginTop: spacing.md,
    gap: 8,
  },
  sendText: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.semibold },
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
});