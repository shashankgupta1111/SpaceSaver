import React from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity} from 'react-native';

interface Props {
  children: React.ReactNode;
  /** Optional label so we know which subtree failed (e.g. a screen name). */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors in its subtree and shows the message instead of
 * letting the whole app close. Without this, a single throwing screen (e.g. a
 * bad media item on the Images tab) takes the entire app down with no clue why.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error, info: {componentStack: string}) {
    // Surfaced in `adb logcat -s ReactNativeJS` for diagnosis.
    console.error(
      `[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`,
      error?.message,
      info?.componentStack,
    );
  }

  reset = () => this.setState({error: null});

  render() {
    const {error} = this.state;
    if (!error) {
      return this.props.children;
    }
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          {!!this.props.label && (
            <Text style={styles.where}>in {this.props.label}</Text>
          )}
          <Text style={styles.msg} selectable>
            {error.message || String(error)}
          </Text>
          {!!error.stack && (
            <Text style={styles.stack} selectable>
              {error.stack.split('\n').slice(0, 12).join('\n')}
            </Text>
          )}
          <TouchableOpacity style={styles.btn} onPress={this.reset}>
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#09090B'},
  content: {padding: 24, paddingTop: 80, alignItems: 'center'},
  emoji: {fontSize: 44, marginBottom: 12},
  title: {color: '#fff', fontSize: 20, fontWeight: '700'},
  where: {color: '#A1A1AA', fontSize: 14, marginTop: 4},
  msg: {
    color: '#FCA5A5',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  stack: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 16,
    fontFamily: 'monospace',
  },
  btn: {
    marginTop: 28,
    backgroundColor: '#5B5FEF',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnText: {color: '#fff', fontSize: 15, fontWeight: '700'},
});
