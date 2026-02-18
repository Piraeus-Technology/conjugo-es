import React, { useEffect, useCallback } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

import HomeScreen from './src/screens/HomeScreen';
import ConjugationScreen from './src/screens/ConjugationScreen';
import TipJarScreen from './src/screens/TipJarScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';
import { useThemeStore } from './src/store/themeStore';
import { useColors, fonts } from './src/utils/theme';

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator<any>();

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
              title: 'ConjuGo!',
              headerRight: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                  <Pressable
                    onPress={() => navigation.navigate('TipJar')}
                    hitSlop={8}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                  >
                    <Ionicons
                      name="cafe-outline"
                      size={22}
                      color={colors.textPrimary}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => navigation.navigate('Feedback')}
                    hitSlop={8}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={22}
                      color={colors.textPrimary}
                    />
                  </Pressable>
                  <Pressable
                    onPress={toggleTheme}
                    hitSlop={8}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                  >
                    <Ionicons
                      name={isDark ? 'sunny' : 'moon'}
                      size={22}
                      color={colors.textPrimary}
                    />
                  </Pressable>
                </View>
              ),
            })}
          />
          <Stack.Screen
            name="Conjugation"
            component={ConjugationScreen}
            options={({ route }: any) => ({
              title: route.params.infinitive,
            })}
          />
          <Stack.Screen
            name="TipJar"
            component={TipJarScreen}
            options={{
              title: 'Support ConjuGo!',
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
