import React from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  createSessionSaveCoordinator,
  type SessionDelta,
  type SessionSaveCoordinator,
} from '../utils/sessionSaveCoordinator';

// Auto-saves new answers when the screen blurs, the app backgrounds, or the
// component unmounts. The delta is claimed synchronously before the async
// save so re-entrant triggers (AppState background + nav blur firing
// back-to-back) see zero unsaved and bail instead of double-counting; a
// failed save rolls the claim back so the delta is retried next time.
export function useSessionAutosave({
  count,
  correct,
  bestStreak = 0,
  save,
}: {
  count: number;
  correct: number;
  bestStreak?: number;
  save: (delta: SessionDelta) => Promise<void>;
}): { unsavedCount: number; unsavedCorrect: number } {
  const nav = useNavigation();
  const countRef = React.useRef(count);
  const correctRef = React.useRef(correct);
  const bestStreakRef = React.useRef(bestStreak);
  const saveRef = React.useRef(save);
  countRef.current = count;
  correctRef.current = correct;
  bestStreakRef.current = bestStreak;
  saveRef.current = save;

  const coordinatorRef = React.useRef<SessionSaveCoordinator | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = createSessionSaveCoordinator(
      () => ({
        count: countRef.current,
        correct: correctRef.current,
        bestStreak: bestStreakRef.current,
      }),
      (delta) => saveRef.current(delta),
    );
  }
  const saveNow = React.useCallback(
    () => coordinatorRef.current!.saveNow(),
    [],
  );

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        saveNow().catch((e) => console.warn('AppState save failed:', e));
      }
    });
    return () => {
      sub.remove();
      saveNow().catch((e) => console.warn('Unmount save failed:', e));
    };
  }, [saveNow]);

  React.useEffect(() => {
    const unsubscribe = nav.addListener('blur', () => {
      saveNow().catch((e) => console.warn('Blur save failed:', e));
    });
    return unsubscribe;
  }, [nav, saveNow]);

  const unsaved = coordinatorRef.current.getUnsaved();
  return { unsavedCount: unsaved.count, unsavedCorrect: unsaved.correct };
}
