import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {RootStackParamList} from './types';
import {useTheme} from '../theme/ThemeContext';
import BottomTabNavigator from './BottomTabNavigator';
import ImageCompressionScreen from '../../features/images/ImageCompressionScreen';
import VideoCompressionScreen from '../../features/videos/VideoCompressionScreen';
import CompressionProgressScreen from '../../features/compression/CompressionProgressScreen';
import CompressionSuccessScreen from '../../features/compression/CompressionSuccessScreen';
import HistoryScreen from '../../features/history/HistoryScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const {theme, isDark} = useTheme();

  const navigationTheme = {
    dark: isDark,
    colors: {
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.error,
    },
    fonts: {
      regular: {fontFamily: 'sans-serif', fontWeight: '400' as const},
      medium: {fontFamily: 'sans-serif-medium', fontWeight: '500' as const},
      bold: {fontFamily: 'sans-serif', fontWeight: '700' as const},
      heavy: {fontFamily: 'sans-serif-black', fontWeight: '900' as const},
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: {backgroundColor: theme.colors.background},
        }}>
        <Stack.Screen name="Main" component={BottomTabNavigator} />
        <Stack.Screen
          name="ImageCompression"
          component={ImageCompressionScreen}
          options={{animation: 'slide_from_bottom'}}
        />
        <Stack.Screen
          name="VideoCompression"
          component={VideoCompressionScreen}
          options={{animation: 'slide_from_bottom'}}
        />
        <Stack.Screen
          name="CompressionProgress"
          component={CompressionProgressScreen}
          options={{
            animation: 'fade_from_bottom',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="CompressionSuccess"
          component={CompressionSuccessScreen}
          options={{
            animation: 'fade',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{animation: 'slide_from_right'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
