import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { hideAsync } from 'expo-splash-screen';
import AppErrorBoundary from '../components/AppErrorBoundary';

jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(async () => {}) }));

function BrokenChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('render failed');
  return <Text>Recovered content</Text>;
}

describe('AppErrorBoundary', () => {
  test('shows a recoverable fallback instead of a blank root', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let shouldThrow = true;
      const { getByText, getByLabelText, rerender } = render(
        <AppErrorBoundary>
          <BrokenChild shouldThrow={shouldThrow} />
        </AppErrorBoundary>,
      );

      expect(getByText('Something went wrong')).toBeTruthy();
      fireEvent(getByLabelText('ConjuGo ES encountered an unexpected error'), 'layout');
      expect(hideAsync).toHaveBeenCalledTimes(1);
      shouldThrow = false;
      rerender(
        <AppErrorBoundary>
          <BrokenChild shouldThrow={shouldThrow} />
        </AppErrorBoundary>,
      );
      fireEvent.press(getByText('Try Again'));
      expect(getByText('Recovered content')).toBeTruthy();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
