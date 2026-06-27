import React, {useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Svg, {Circle, G, Defs, LinearGradient, Stop} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {useTheme} from '../../app/theme/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface StoragePieChartProps {
  usedPercent: number;
  savedPercent: number;
  size?: number;
}

export function StoragePieChart({
  usedPercent,
  savedPercent,
  size = 120,
}: StoragePieChartProps) {
  const {theme} = useTheme();
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const usedAnim = useSharedValue(0);
  const savedAnim = useSharedValue(0);

  useEffect(() => {
    usedAnim.value = withTiming(Math.min(usedPercent, 100), {
      duration: 1000,
      easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
    });
    savedAnim.value = withTiming(Math.min(savedPercent, usedPercent), {
      duration: 1200,
      easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
    });
  }, [usedPercent, savedPercent, usedAnim, savedAnim]);

  const usedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference - (usedAnim.value / 100) * circumference,
  }));

  const savedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference - (savedAnim.value / 100) * circumference,
  }));

  return (
    <View style={[styles.container, {width: size, height: size}]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="usedGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={theme.colors.primary} />
            <Stop offset="1" stopColor={theme.colors.secondary} />
          </LinearGradient>
          <LinearGradient id="savedGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={theme.colors.success} />
            <Stop offset="1" stopColor="#4ADE80" />
          </LinearGradient>
        </Defs>
        {/* Background */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={theme.colors.storageFree}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Used ring */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke="url(#usedGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={usedProps}
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
        {/* Saved ring (inner) */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius - strokeWidth - 4}
          stroke="url(#savedGrad)"
          strokeWidth={strokeWidth - 4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference - 2 * Math.PI * (strokeWidth + 4)}
          animatedProps={savedProps}
          transform={`rotate(-90, ${cx}, ${cy})`}
          opacity={0.8}
        />
      </Svg>
      <View style={[styles.center, {width: size, height: size}]}>
        <Text
          style={[theme.typography.numericSmall, {color: theme.colors.text}]}>
          {Math.round(usedPercent)}%
        </Text>
        <Text
          style={[
            theme.typography.labelSmall,
            {color: theme.colors.textSecondary},
          ]}>
          used
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default StoragePieChart;
