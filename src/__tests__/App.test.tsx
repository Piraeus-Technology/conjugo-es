import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { hideAsync } from 'expo-splash-screen';
import App from '../../App';

jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'View' }));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/tipJar', () => ({
  TipJarProvider: () => { throw new Error('Tip jar render failed'); },
}));

test('shows the app recovery screen when the tip jar provider throws before layout', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const { getByText, getByLabelText } = render(<App />);

    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Try Again')).toBeTruthy();
    fireEvent(getByLabelText('ConjuGo ES encountered an unexpected error'), 'layout');
    expect(hideAsync).toHaveBeenCalledTimes(1);
  } finally {
    errorSpy.mockRestore();
  }
});
