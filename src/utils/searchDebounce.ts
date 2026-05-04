import { normalizeSearchText } from './verbSearch';

export function hasSearchText(value: string): boolean {
  return value.trim().length > 0;
}

export function isSearchDebouncePending(rawSearch: string, debouncedSearch: string): boolean {
  if (!hasSearchText(rawSearch)) return false;
  return normalizeSearchText(rawSearch) !== normalizeSearchText(debouncedSearch);
}
