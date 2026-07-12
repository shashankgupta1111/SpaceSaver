import React, {useEffect} from 'react';
import {View, Text, StyleSheet, Modal, Pressable} from 'react-native';
import Animated, {
  FadeIn,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Share from 'react-native-share';

import {useTheme} from '../../app/theme/ThemeContext';
import {StorageService} from '../services/StorageService';
import AnimatedButton from './AnimatedButton';

const CONFETTI_COLORS = ['#5B5FEF', '#7C4DFF', '#22C55E', '#F59E0B', '#F472B6'];

function Confetti({index}: {index: number}) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    const delay = index * 60;
    const drift = ((index % 5) - 2) * 40;
    opacity.value = withDelay(delay, withSequence(withTiming(1, {duration: 100}), withTiming(0, {duration: 1400})));
    translateY.value = withDelay(delay, withTiming(260, {duration: 1500}));
    translateX.value = withDelay(delay, withTiming(drift, {duration: 1500}));
    rotate.value = withDelay(delay, withTiming(420, {duration: 1500}));
  }, [index, opacity, translateY, translateX, rotate]);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 0,
    left: `${15 + (index * 6) % 70}%`,
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    opacity: opacity.value,
    transform: [
      {translateX: translateX.value},
      {translateY: translateY.value},
      {rotate: `${rotate.value}deg`},
    ],
  }));

  return <Animated.View style={style} />;
}

export function MilestoneModal({
  visible,
  milestoneBytes,
  onClose,
}: {
  visible: boolean;
  milestoneBytes: number;
  onClose: () => void;
}) {
  const {theme} = useTheme();
  const label = StorageService.formatBytes(milestoneBytes);

  const handleShare = async () => {
    try {
      await Share.open({
        title: 'SpaceSaver',
        message: `🎉 I just freed up ${label} of storage with SpaceSaver — a free, fully-offline photo & video compressor. #SpaceSaver`,
        failOnCancel: false,
      });
    } catch {
      // user cancelled or no share targets — non-fatal
    }
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      {visible && (
        <Animated.View entering={FadeIn.duration(180)} style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

          <View style={styles.confettiLayer} pointerEvents="none">
            {Array.from({length: 16}, (_, i) => (
              <Confetti key={i} index={i} />
            ))}
          </View>

          <Animated.View
            entering={ZoomIn.springify().damping(15).mass(0.6)}
            style={[styles.card, {backgroundColor: theme.colors.surface, ...theme.elevation.xl}]}>
            <LinearGradient
              colors={theme.colors.gradientPrimary}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.badge}>
              <Icon name="trophy" size={44} color="white" />
            </LinearGradient>

            <Text style={[theme.typography.labelLarge, {color: theme.colors.primary, marginTop: 18}]}>
              MILESTONE UNLOCKED
            </Text>
            <Text style={[theme.typography.headlineSmall, styles.big, {color: theme.colors.text}]}>
              {label} freed!
            </Text>
            <Text
              style={[
                theme.typography.bodyMedium,
                {color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6},
              ]}>
              That's a lot of reclaimed space. Keep it up — your gallery thanks you.
            </Text>

            <View style={styles.actions}>
              <AnimatedButton onPress={handleShare} variant="primary" gradient size="lg" fullWidth>
                <Icon name="share-variant" size={18} color="white" />
                <Text style={[theme.typography.titleSmall, {color: 'white'}]}>Share achievement</Text>
              </AnimatedButton>
              <AnimatedButton onPress={onClose} variant="ghost" size="md" fullWidth style={{marginTop: 6}}>
                <Text style={[theme.typography.labelLarge, {color: theme.colors.textSecondary}]}>
                  Maybe later
                </Text>
              </AnimatedButton>
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  confettiLayer: {
    position: 'absolute',
    top: '18%',
    left: 0,
    right: 0,
    height: 300,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  big: {fontWeight: '800', marginTop: 4},
  actions: {width: '100%', marginTop: 24},
});
