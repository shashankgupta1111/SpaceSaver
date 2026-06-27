import React, {ReactNode} from 'react';
import {View, StyleSheet, ViewStyle} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {GestureDetector, Gesture} from 'react-native-gesture-handler';
import {useTheme} from '../../app/theme/ThemeContext';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'filled' | 'outlined';
  padding?: number;
  animated?: boolean;
}

export function Card({
  children,
  style,
  onPress,
  variant = 'default',
  padding,
  animated = true,
}: CardProps) {
  const {theme} = useTheme();
  const scale = useSharedValue(1);
  const elevation = useSharedValue(1);

  const tap = Gesture.Tap()
    .onBegin(() => {
      'worklet';
      if (onPress) {
        scale.value = withSpring(0.98, {damping: 20, stiffness: 400});
      }
    })
    .onFinalize(() => {
      'worklet';
      scale.value = withSpring(1, {damping: 15, stiffness: 300});
    })
    .onEnd(() => {
      'worklet';
    })
    .runOnJS(true)
    .onEnd(() => onPress?.())
    .enabled(!!onPress);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const variantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: theme.colors.cardBackground,
          ...theme.elevation.lg,
          shadowColor: theme.colors.cardShadow,
        };
      case 'filled':
        return {
          backgroundColor: theme.colors.primaryContainer,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: theme.colors.border,
        };
      default:
        return {
          backgroundColor: theme.colors.cardBackground,
          ...theme.elevation.md,
          shadowColor: theme.colors.shadow,
        };
    }
  };

  const cardStyle: ViewStyle = {
    borderRadius: theme.borderRadius.xl,
    padding: padding ?? theme.spacing.base,
    ...variantStyle(),
  };

  if (!onPress) {
    return (
      <View style={[cardStyle, style]}>{children}</View>
    );
  }

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[cardStyle, style, animated && animStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

export default Card;
