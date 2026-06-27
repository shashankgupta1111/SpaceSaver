import React, {useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Svg, {Circle, Defs, LinearGradient, Stop} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  useAnimatedStyle,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import {useTheme} from '../../app/theme/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  showLabel?: boolean;
  label?: string;
  sublabel?: string;
  animated?: boolean;
  duration?: number;
}

export function CircularProgress({
  progress,
  size = 160,
  strokeWidth = 10,
  color,
  backgroundColor,
  showLabel = true,
  label,
  sublabel,
  animated = true,
  duration = 600,
}: CircularProgressProps) {
  const {theme} = useTheme();
  const animatedProgress = useSharedValue(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  useEffect(() => {
    if (animated) {
      animatedProgress.value = withTiming(Math.min(Math.max(progress, 0), 100), {
        duration,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
      });
    } else {
      animatedProgress.value = Math.min(Math.max(progress, 0), 100);
    }
  }, [progress, animated, duration, animatedProgress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset:
      circumference - (animatedProgress.value / 100) * circumference,
  }));

  const progressColor = color ?? theme.colors.primary;
  const bgColor = backgroundColor ?? theme.colors.surfaceVariant;

  const displayPercent = Math.round(progress);

  return (
    <View style={[styles.container, {width: size, height: size}]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={theme.colors.primary} />
            <Stop offset="100%" stopColor={theme.colors.secondary} />
          </LinearGradient>
        </Defs>
        {/* Background circle */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        {/* Progress circle */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke="url(#progressGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
      </Svg>

      {showLabel && (
        <View style={[styles.labelContainer, {width: size, height: size}]}>
          <Text
            style={[theme.typography.numericLarge, {color: theme.colors.text}]}>
            {label ?? `${displayPercent}%`}
          </Text>
          {sublabel && (
            <Text
              style={[
                theme.typography.bodySmall,
                {color: theme.colors.textSecondary, marginTop: 2},
              ]}>
              {sublabel}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CircularProgress;
