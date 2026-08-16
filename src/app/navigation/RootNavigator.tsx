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
import DuplicatesScreen from '../../features/duplicates/DuplicatesScreen';
import LargeFilesScreen from '../../features/largefiles/LargeFilesScreen';
import InsightsScreen from '../../features/insights/InsightsScreen';
import CleanupScreen from '../../features/cleanup/CleanupScreen';
import AlbumDetailScreen from '../../features/cleanup/AlbumDetailScreen';
import FormatConverterScreen from '../../features/converter/FormatConverterScreen';
import SmartCleanupScreen from '../../features/cleanup/SmartCleanupScreen';
import ScreenshotManagerScreen from '../../features/cleanup/ScreenshotManagerScreen';
import OldMediaScreen from '../../features/cleanup/OldMediaScreen';
import CompressionQueueScreen from '../../features/compression/CompressionQueueScreen';
import SmartRecommendationsScreen from '../../features/cleanup/SmartRecommendationsScreen';
import VideoDuplicatesScreen from '../../features/duplicates/VideoDuplicatesScreen';
import CleanupReviewCenterScreen from '../../features/cleanup/CleanupReviewCenterScreen';

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
        <Stack.Screen
          name="Duplicates"
          component={DuplicatesScreen}
          options={{animation: 'slide_from_right'}}
        />
        <Stack.Screen
          name="LargeFiles"
          component={LargeFilesScreen}
          options={{animation: 'slide_from_right'}}
        />
        <Stack.Screen
          name="Insights"
          component={InsightsScreen}
          options={{animation: 'slide_from_right'}}
        />
        <Stack.Screen
          name="Cleanup"
          component={CleanupScreen}
          options={{animation: 'slide_from_right'}}
        />
        <Stack.Screen
          name="AlbumDetail"
          component={AlbumDetailScreen}
          options={{animation: 'slide_from_right'}}
        />
        <Stack.Screen
          name="FormatConverter"
          component={FormatConverterScreen}
          options={{animation: 'slide_from_right'}}
        />
        <Stack.Screen
          name="SmartCleanup"
          component={SmartCleanupScreen}
          options={{animation: 'slide_from_right'}}
        />
        <Stack.Screen
          name="ScreenshotManager"
          component={ScreenshotManagerScreen}
          options={{animation: 'slide_from_right'}}
        />
        <Stack.Screen
          name="OldMedia"
          component={OldMediaScreen}
          options={{animation: 'slide_from_right'}}
        />
        <Stack.Screen
          name="CompressionQueue"
          component={CompressionQueueScreen}
          options={{animation: 'slide_from_right'}}
        />
        <Stack.Screen
          name="SmartRecommendations"
          component={SmartRecommendationsScreen}
          options={{animation: 'slide_from_right'}}
        />
        <Stack.Screen
          name="VideoDuplicates"
          component={VideoDuplicatesScreen}
          options={{animation: 'slide_from_right'}}
        />
        <Stack.Screen
          name="CleanupReviewCenter"
          component={CleanupReviewCenterScreen}
          options={{animation: 'slide_from_right'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
