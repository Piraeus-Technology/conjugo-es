import React, { useEffect, useCallback } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

import HomeScreen from './src/screens/HomeScreen';
import ConjugationScreen from './src/screens/ConjugationScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';
import QuizScreen from './src/screens/QuizScreen';
import { useThemeStore } from './src/store/themeStore';
import { useColors, fonts } from './src/utils/theme';
import type { RootStackParamList } from './src/types/navigation';

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { isDark, loaded, loadTheme, toggleTheme } = useThemeStore();
  const colors = useColors();

  useEffect(() => {
    loadTheme();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (loaded) {
      await SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.bg,
      card: colors.bg,
      text: colors.textPrimary,
      primary: colors.primary,
    },
  };

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.primary,
            headerTitleStyle: {
              fontWeight: fonts.weights.semibold,
              color: colors.textPrimary,
            },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen
            name="Search"
            component={HomeScreen}
            options={({ navigation }) => ({
              title: 'ConjuGo ES',
              headerRight: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => navigation.navigate('Quiz')}>
                    <Ionicons
                      name="school-outline"
                      size={22}
                      color={colors.textPrimary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => navigation.navigate('Feedback')} style={{ marginLeft: 16 }}>
                    <Ionicons
                      name="mail-outline"
                      size={22}
                      color={colors.textPrimary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={toggleTheme} style={{ marginLeft: 16 }}>
                    <Ionicons
                      name={isDark ? 'sunny' : 'moon'}
                      size={22}
                      color={colors.textPrimary}
                    />
                  </TouchableOpacity>
                </View>
              ),
            })}
          />
          <Stack.Screen
            name="Conjugation"
            component={ConjugationScreen}
            options={({ route }) => ({
              title: route.params.infinitive,
            })}
          />
          <Stack.Screen
            name="Quiz"
            component={QuizScreen}
            options={{
              title: 'Quiz',
            }}
          />
          <Stack.Screen
            name="Feedback"
            component={FeedbackScreen}
            options={{
              title: 'Feedback',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}
