import React, {useEffect} from 'react';
import {View, Text, StyleSheet, ViewStyle} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, {Circle, Defs, LinearGradient, Stop} from 'react-native-svg';

import {useTheme} from '../../app/theme/ThemeContext';

interface LoaderProps {
  size?: number;
  strokeWidth?: number;
  label?: string;
  /** Fill and center within the available space. */
  fullscreen?: boolean;
  style?: ViewStyle;
}

/**
 * Smooth animated spinner — a rotating gradient arc (SVG + Reanimated).
 * Reusable replacement for RN's ActivityIndicator across the app.
 */
export default function Loader({
  size = 44,
  strokeWidth = 4,
  label,
  fullscreen = false,
  style,
}: LoaderProps) {
  const {theme} = useTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {duration: 900, easing: Easing.linear}),
      -1,
      false,
    );
    return () => cancelAnimation(rotation);
  }, [rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${rotation.value}deg`}],
  }));

  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  // ~72% arc visible, rest transparent.
  const dash = c * 0.72;

  const spinner = (
    <View style={[styles.wrap, style]}>
      <Animated.View style={spinStyle}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="loaderGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={theme.colors.primary} />
              <Stop offset="1" stopColor={theme.colors.secondary} />
            </LinearGradient>
          </Defs>
          {/* track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={theme.colors.surfaceVariant}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* arc */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#loaderGrad)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            fill="none"
          />
        </Svg>
      </Animated.View>
      {!!label && (
        <Text
          style={[
            theme.typography.bodyMedium,
            {color: theme.colors.textSecondary, marginTop: 14, textAlign: 'center'},
          ]}>
          {label}
        </Text>
      )}
    </View>
  );

  if (fullscreen) {
    return <View style={styles.fullscreen}>{spinner}</View>;
  }
  return spinner;
}

const styles = StyleSheet.create({
  wrap: {alignItems: 'center', justifyContent: 'center'},
  fullscreen: {flex: 1, alignItems: 'center', justifyContent: 'center'},
});
