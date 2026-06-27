import React from 'react';
import {View, Text, StyleSheet, ViewStyle} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Rect,
  Path,
  Ellipse,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';
import {useTheme} from '../../app/theme/ThemeContext';
import AnimatedButton from './AnimatedButton';

type EmptyType = 'images' | 'videos' | 'history' | 'search' | 'error';

interface EmptyStateProps {
  type: EmptyType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

function ImagesIllustration() {
  const {theme} = useTheme();
  const float = useSharedValue(0);
  React.useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, {duration: 2000, easing: Easing.inOut(Easing.sin)}),
        withTiming(0, {duration: 2000, easing: Easing.inOut(Easing.sin)}),
      ),
      -1,
    );
  }, [float]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{translateY: float.value * -8}],
  }));

  return (
    <Animated.View style={floatStyle}>
      <Svg width={160} height={140} viewBox="0 0 160 140">
        <Defs>
          <LinearGradient id="imgGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.colors.primary} stopOpacity="0.2" />
            <Stop offset="1" stopColor={theme.colors.secondary} stopOpacity="0.1" />
          </LinearGradient>
        </Defs>
        <Rect x="20" y="30" width="120" height="90" rx="16" fill="url(#imgGrad)" stroke={theme.colors.border} strokeWidth="1.5" />
        <Rect x="35" y="45" width="90" height="60" rx="10" fill={theme.colors.surfaceVariant} />
        <Circle cx="55" cy="70" r="10" fill={theme.colors.primaryContainer} />
        <Path d="M35 95 L55 75 L70 87 L85 72 L125 105 L35 105 Z" fill={theme.colors.primary} opacity="0.3" />
        <Circle cx="130" cy="25" r="12" fill={theme.colors.primaryContainer} />
        <Path d="M125 25 L130 20 L135 25 L130 30 Z" fill={theme.colors.primary} />
        <Circle cx="15" cy="95" r="8" fill={theme.colors.secondaryContainer} />
      </Svg>
    </Animated.View>
  );
}

function VideosIllustration() {
  const {theme} = useTheme();
  const pulse = useSharedValue(1);
  React.useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.1, {duration: 1500, easing: Easing.inOut(Easing.sin)}),
        withTiming(1, {duration: 1500, easing: Easing.inOut(Easing.sin)}),
      ),
      -1,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{scale: pulse.value}],
  }));

  return (
    <Animated.View style={pulseStyle}>
      <Svg width={160} height={140} viewBox="0 0 160 140">
        <Defs>
          <LinearGradient id="vidGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.colors.secondary} stopOpacity="0.2" />
            <Stop offset="1" stopColor={theme.colors.primary} stopOpacity="0.1" />
          </LinearGradient>
        </Defs>
        <Rect x="15" y="35" width="130" height="80" rx="16" fill="url(#vidGrad)" stroke={theme.colors.border} strokeWidth="1.5" />
        <Rect x="15" y="35" width="130" height="22" rx="0" fill={theme.colors.surfaceVariant} />
        <Rect x="15" y="35" width="130" height="22" rx="16" fill={theme.colors.surfaceVariant} />
        <Circle cx="80" cy="83" r="22" fill={theme.colors.primary} opacity="0.15" />
        <Circle cx="80" cy="83" r="16" fill={theme.colors.primary} opacity="0.9" />
        <Path d="M75 76 L75 90 L90 83 Z" fill="white" />
      </Svg>
    </Animated.View>
  );
}

function HistoryIllustration() {
  const {theme} = useTheme();
  return (
    <Svg width={160} height={140} viewBox="0 0 160 140">
      <Defs>
        <LinearGradient id="histGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={theme.colors.primary} stopOpacity="0.1" />
          <Stop offset="1" stopColor={theme.colors.success} stopOpacity="0.1" />
        </LinearGradient>
      </Defs>
      <Circle cx="80" cy="70" r="50" fill="url(#histGrad)" stroke={theme.colors.border} strokeWidth="1.5" />
      <Path d="M80 40 L80 70 L100 70" stroke={theme.colors.primary} strokeWidth="3" strokeLinecap="round" fill="none" />
      <Circle cx="80" cy="70" r="4" fill={theme.colors.primary} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const x = 80 + 40 * Math.cos(angle);
        const y = 70 + 40 * Math.sin(angle);
        return <Circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 3 : 1.5} fill={theme.colors.textTertiary} />;
      })}
    </Svg>
  );
}

export function EmptyState({
  type,
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const {theme} = useTheme();

  const illustrations: Record<EmptyType, React.ReactNode> = {
    images: <ImagesIllustration />,
    videos: <VideosIllustration />,
    history: <HistoryIllustration />,
    search: <HistoryIllustration />,
    error: <HistoryIllustration />,
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.illustration}>{illustrations[type]}</View>
      <Text
        style={[
          theme.typography.titleLarge,
          {color: theme.colors.text, textAlign: 'center', marginBottom: 8},
        ]}>
        {title}
      </Text>
      <Text
        style={[
          theme.typography.bodyMedium,
          {
            color: theme.colors.textSecondary,
            textAlign: 'center',
            maxWidth: 260,
            lineHeight: 22,
          },
        ]}>
        {description}
      </Text>
      {actionLabel && onAction && (
        <View style={{marginTop: 24}}>
          <AnimatedButton onPress={onAction} variant="primary" gradient>
            {actionLabel}
          </AnimatedButton>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 48,
  },
  illustration: {
    marginBottom: 32,
  },
});

export default EmptyState;
