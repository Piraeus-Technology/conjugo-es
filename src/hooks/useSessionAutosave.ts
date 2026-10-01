import React from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createDatedSessionSaveCoordinator, type DatedSessionDelta } from '../utils/sessionSaveCoordinator';
import { isCurrentPracticeSession, usePracticeResetStore } from '../store/practiceResetStore';

// Capture the local day synchronously with each answer. Each day's delta uses
// the same serialized claim/rollback coordinator for blur/background/unmount.
export function useSessionAutosave({ save }: {
  save: (delta: DatedSessionDelta) => Promise<void>;
}) {
  const nav = useNavigation();
  const version = React.useRef(usePracticeResetStore.getState().version).current;
  const saveRef = React.useRef(save);
  saveRef.current = save;
  const [, refresh] = React.useReducer((value: number) => value + 1, 0);
  const coordinatorRef = React.useRef<ReturnType<typeof createDatedSessionSaveCoordinator> | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = createDatedSessionSaveCoordinator(
      delta => saveRef.current(delta),
      () => isCurrentPracticeSession(version),
    );
  }
  const saveNow = React.useCallback(() => coordinatorRef.current!.saveNow(), []);
  const recordProgress = React.useCallback((correct: boolean, bestStreak = 0) => {
    coordinatorRef.current!.recordAnswer(correct, bestStreak);
    refresh();
  }, [refresh]);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        saveNow().catch((error) => console.warn('AppState save failed:', error));
      }
    });
    return () => {
      sub.remove();
      saveNow().catch((error) => console.warn('Unmount save failed:', error));
    };
  }, [saveNow]);

  React.useEffect(() => nav.addListener('blur', () => {
    saveNow().catch((error) => console.warn('Blur save failed:', error));
  }), [nav, saveNow]);

  const unsaved = coordinatorRef.current.getUnsaved();
  return { unsavedCount: unsaved.count, unsavedCorrect: unsaved.correct, recordProgress };
}
