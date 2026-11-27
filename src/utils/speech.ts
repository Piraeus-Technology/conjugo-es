import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

let speechRequest = 0;

async function getAndroidSpanishVoice() {
  const voices = await Speech.getAvailableVoicesAsync().catch(() => []);
  return (voices.find(voice => voice.language === 'es-ES')
    ?? voices.find(voice => voice.language === 'es' || voice.language.startsWith('es-')))?.identifier;
}

export function speak(text: string) {
  const request = ++speechRequest;
  // stop() is async on Android; chain it so the old utterance can't clip
  // the new one when taps come quickly.
  Promise.resolve(Speech.stop())
    .catch(() => undefined)
    .then(async () => {
      if (request !== speechRequest) return;
      const isAndroid = Platform.OS === 'android';
      const voice = isAndroid ? await getAndroidSpanishVoice() : undefined;
      if (request !== speechRequest) return;
      Speech.speak(text, {
        // Android parses language as a bare subtag. Use the voice ID for the region.
        language: isAndroid ? 'es' : 'es-ES',
        voice,
        rate: 0.85,
        onError: (error) => console.warn('Speech playback failed:', error),
      });
    })
    .catch((error) => console.warn('Speech playback failed:', error));
}

export function stopSpeech() {
  speechRequest += 1;
  Promise.resolve(Speech.stop()).catch(() => undefined);
}
