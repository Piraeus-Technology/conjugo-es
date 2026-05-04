export interface ScreenActivityState {
  mounted: boolean;
  focused: boolean;
  appState: string;
}

export function canRunFocusedScreenEffect(state: ScreenActivityState): boolean {
  return state.mounted && state.focused && state.appState === 'active';
}
