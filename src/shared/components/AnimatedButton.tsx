import React, {ReactNode} from 'react';
import {
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import LinearGradient from 'react-native-linear-gradient';
import {useTheme} from '../../app/theme/ThemeContext';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface AnimatedButtonProps {
  onPress: () => void;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  gradient?: boolean;
  fullWidth?: boolean;
}

export function AnimatedButton({
  onPress,
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  gradient = false,
  fullWidth = false,
}: AnimatedButtonProps) {
  const {theme} = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const tap = Gesture.Tap()
    .onBegin(() => {
      'worklet';
      scale.value = withSpring(0.96, {damping: 20, stiffness: 300});
      opacity.value = withTiming(0.85, {duration: 100});
    })
    .onFinalize(() => {
      'worklet';
      scale.value = withSpring(1, {damping: 15, stiffness: 300});
      opacity.value = withTiming(1, {duration: 150});
    })
    .onEnd(() => {
      'worklet';
    })
    .enabled(!disabled && !loading)
    .runOnJS(true)
    .onEnd(onPress);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
    opacity: opacity.value,
  }));

  const sizeStyles: Record<Size, ViewStyle> = {
    sm: {height: 36, paddingHorizontal: 16, borderRadius: 10},
    md: {height: 48, paddingHorizontal: 20, borderRadius: 14},
    lg: {height: 56, paddingHorizontal: 24, borderRadius: 16},
  };

  const textSizes: Record<Size, TextStyle> = {
    sm: {...theme.typography.labelMedium},
    md: {...theme.typography.labelLarge},
    lg: {...theme.typography.titleSmall},
  };

  const variantStyles = (): {container: ViewStyle; text: TextStyle} => {
    switch (variant) {
      case 'primary':
        return {
          container: {backgroundColor: theme.colors.primary},
          text: {color: theme.colors.onPrimary},
        };
      case 'secondary':
        return {
          container: {backgroundColor: theme.colors.secondary},
          text: {color: theme.colors.white},
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: theme.colors.primary,
          },
          text: {color: theme.colors.primary},
        };
      case 'ghost':
        return {
          container: {backgroundColor: 'transparent'},
          text: {color: theme.colors.primary},
        };
      case 'danger':
        return {
          container: {backgroundColor: theme.colors.error},
          text: {color: theme.colors.white},
        };
    }
  };

  const vs = variantStyles();
  const containerStyle: ViewStyle = {
    ...styles.base,
    ...sizeStyles[size],
    ...vs.container,
    ...(fullWidth && {width: '100%'}),
    ...(disabled && {opacity: 0.5}),
    ...style,
  };

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={vs.text.color} size="small" />
      ) : (
        <>
          {leftIcon}
          {typeof children === 'string' ? (
            <Text style={[textSizes[size], vs.text, textStyle]}>
              {children}
            </Text>
          ) : (
            children
          )}
          {rightIcon}
        </>
      )}
    </>
  );

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[animStyle, {borderRadius: sizeStyles[size].borderRadius as number}]}>
        {gradient && variant === 'primary' ? (
          <LinearGradient
            colors={theme.colors.gradientPrimary}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={[containerStyle, styles.gradientContainer]}>
            {content}
          </LinearGradient>
        ) : (
          <Animated.View style={containerStyle}>{content}</Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  gradientContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});

export default AnimatedButton;
