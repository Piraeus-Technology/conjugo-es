import { canRunFocusedScreenEffect } from '../utils/screenActivity';
import { isSearchDebouncePending } from '../utils/searchDebounce';
import { getAccuracyPercent, hasPositiveCount } from '../utils/statsMath';

describe('UI state helpers', () => {
  test('blocks delayed screen side effects after blur, background, or unmount', () => {
    expect(canRunFocusedScreenEffect({ mounted: true, focused: true, appState: 'active' })).toBe(true);
    expect(canRunFocusedScreenEffect({ mounted: true, focused: false, appState: 'active' })).toBe(false);
    expect(canRunFocusedScreenEffect({ mounted: true, focused: true, appState: 'background' })).toBe(false);
    expect(canRunFocusedScreenEffect({ mounted: false, focused: true, appState: 'active' })).toBe(false);
  });

  test('detects pending debounced search without treating clears as pending', () => {
    expect(isSearchDebouncePending('', 'hablar')).toBe(false);
    expect(isSearchDebouncePending('hablé', 'hable')).toBe(false);
    expect(isSearchDebouncePending('hablo', 'hab')).toBe(true);
  });

  test('guards accuracy calculations against zero totals', () => {
    expect(hasPositiveCount(0)).toBe(false);
    expect(getAccuracyPercent(0, 0)).toBeNull();
    expect(getAccuracyPercent(4, 5)).toBe(80);
  });
});
