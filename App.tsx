import React, { useEffect, useCallback } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as SplashScreen from 'expo-splash-screen';

import HomeScreen from './src/screens/HomeScreen';
import ConjugationScreen from './src/screens/ConjugationScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';
import FlashcardScreen from './src/screens/FlashcardScreen';
import QuizScreen from './src/screens/QuizScreen';
import PracticeSettingsScreen from './src/screens/PracticeSettingsScreen';
import StatsScreen from './src/screens/StatsScreen';
import FlashcardStatsScreen from './src/screens/FlashcardStatsScreen';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import { useThemeStore } from './src/store/themeStore';
import { useColors, fonts } from './src/utils/theme';
import type { SearchStackParamList } from './src/types/navigation';

SplashScreen.preventAutoHideAsync().catch((error) => {
  console.warn('Could not keep splash screen visible:', error);
});

const QuizStack = createNativeStackNavigator();
const FlashcardStack = createNativeStackNavigator();

function QuizStackScreen() {
  const colors = useColors();
  return (
    <QuizStack.Navigator id="QuizStack" screenOptions={{
      headerStyle: { backgroundColor: colors.bg },
      headerTintColor: colors.textPrimary,
      headerTitleStyle: { fontWeight: fonts.weights.semibold, color: colors.textPrimary },
      headerTitleAlign: 'center' as const,
      headerShadowVisible: false,
    }}>
      <QuizStack.Screen name="QuizHome" component={QuizScreen} options={{ title: 'Quiz' }} />
      <QuizStack.Screen name="PracticeSettings" component={PracticeSettingsScreen} options={{ title: 'Settings', presentation: 'modal' }} />
    </QuizStack.Navigator>
  );
}

function FlashcardStackScreen() {
  const colors = useColors();
  return (
    <FlashcardStack.Navigator id="FlashcardStack" screenOptions={{
      headerStyle: { backgroundColor: colors.bg },
      headerTintColor: colors.textPrimary,
      headerTitleStyle: { fontWeight: fonts.weights.semibold, color: colors.textPrimary },
      headerTitleAlign: 'center' as const,
      headerShadowVisible: false,
    }}>
      <FlashcardStack.Screen name="FlashcardHome" component={FlashcardScreen} options={{ title: 'Flashcards' }} />
      <FlashcardStack.Screen name="PracticeSettings" component={PracticeSettingsScreen} options={{ title: 'Settings', presentation: 'modal' }} />
    </FlashcardStack.Navigator>
  );
}

const MoreStack = createNativeStackNavigator();

function MoreStackScreen() {
  const colors = useColors();
  return (
    <MoreStack.Navigator id="MoreStack" screenOptions={{
      headerStyle: { backgroundColor: colors.bg },
      headerTintColor: colors.textPrimary,
      headerTitleStyle: { fontWeight: fonts.weights.semibold, color: colors.textPrimary },
      headerTitleAlign: 'center' as const,
      headerShadowVisible: false,
    }}>
      <MoreStack.Screen name="MoreHome" component={FeedbackScreen} options={{ title: 'More' }} />
      <MoreStack.Screen name="Stats" component={StatsScreen} options={{ title: 'Quiz Stats' }} />
      <MoreStack.Screen name="FlashcardStats" component={FlashcardStatsScreen} options={{ title: 'Flashcard Stats' }} />
    </MoreStack.Navigator>
  );
}

// Search tab has its own stack (Search → Conjugation)
const SearchStack = createNativeStackNavigator<SearchStackParamList>();
const Tab = createBottomTabNavigator();

function SearchStackScreen() {
  const colors = useColors();

  return (
    <SearchStack.Navigator
      id="SearchStack"
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.primaryText,
        headerTitleStyle: {
          fontWeight: fonts.weights.semibold,
          color: colors.textPrimary,
        },
        headerTitleAlign: 'center' as const,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <SearchStack.Screen
        name="SearchHome"
        component={HomeScreen}
        options={{
          title: 'Search',
        }}
      />
      <SearchStack.Screen
        name="Conjugation"
        component={ConjugationScreen}
        options={({ route }) => ({
          title: route.params.infinitive,
        })}
      />
    </SearchStack.Navigator>
  );
}

function AppContent() {
  const { isDark, loaded, loadTheme } = useThemeStore();
  const colors = useColors();

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  const onLayoutRootView = useCallback(async () => {
    if (loaded) {
      try {
        await SplashScreen.hideAsync();
      } catch (error) {
        console.warn('Could not hide splash screen:', error);
      }
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
      primary: colors.primaryText,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          id="MainTabs"
          screenOptions={{
            tabBarActiveTintColor: colors.primaryText,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarStyle: {
              backgroundColor: colors.bg,
              borderTopColor: colors.divider,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: fonts.weights.medium,
            },
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.primaryText,
            headerTitleStyle: {
              fontWeight: fonts.weights.semibold,
              color: colors.textPrimary,
            },
            headerTitleAlign: 'center' as const,
            headerShadowVisible: false,
          }}
        >
          <Tab.Screen
            name="Search"
            component={SearchStackScreen}
            options={{
              headerShown: false,
              tabBarLabel: 'Search',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="search" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Quiz"
            component={QuizStackScreen}
            options={{
              headerShown: false,
              tabBarLabel: 'Quiz',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="school" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Flashcards"
            component={FlashcardStackScreen}
            options={{
              headerShown: false,
              tabBarLabel: 'Flashcards',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="layers" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="More"
            component={MoreStackScreen}
            options={{
              headerShown: false,
              tabBarLabel: 'More',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="ellipsis-horizontal" size={size} color={color} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}
