import React from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {StyleSheet} from 'react-native';

import {ThemeProvider} from './theme/ThemeContext';
import {AlertProvider} from '../shared/components/AlertProvider';
import RootNavigator from './navigation/RootNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AlertProvider>
            <RootNavigator />
          </AlertProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
});
