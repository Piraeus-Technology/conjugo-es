import * as Speech from 'expo-speech';

// Speech is best-effort UX: a missing es-ES voice or TTS engine failure
// should never crash or block the caller, just warn.
export function speak(text: string) {
  // stop() is async on Android; chain it so the old utterance can't clip
  // the new one when taps come quickly.
  Promise.resolve(Speech.stop())
    .catch(() => undefined)
    .then(() => {
      Speech.speak(text, {
        language: 'es-ES',
        rate: 0.85,
        onError: (error) => console.warn('Speech playback failed:', error),
      });
    })
    .catch((error) => console.warn('Speech playback failed:', error));
}

export function stopSpeech() {
  Promise.resolve(Speech.stop()).catch(() => undefined);
}
