import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList, CompressionResult} from '../../app/navigation/types';
import {StorageService} from '../../shared/services/StorageService';
import {SettingsService} from '../../shared/services/SettingsService';
import {CompressionService} from '../../shared/services/CompressionService';
import {useAlert} from '../../shared/components/AlertProvider';
import Card from '../../shared/components/Card';
import AnimatedButton from '../../shared/components/AnimatedButton';

type Route = RouteProp<RootStackParamList, 'CompressionSuccess'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function SuccessCheckmark() {
  const {theme} = useTheme();
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, {duration: 300});
    scale.value = withDelay(
      200,
      withSequence(
        withSpring(1.2, {damping: 8, stiffness: 200}),
        withSpring(1, {damping: 12, stiffness: 200}),
      ),
    );
  }, [scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.checkmarkContainer, animStyle]}>
      <LinearGradient
        colors={[theme.colors.success, '#4ADE80']}
        style={styles.checkmarkGradient}>
        <Icon name="check" size={48} color="white" />
      </LinearGradient>
    </Animated.View>
  );
}

function ConfettiParticle({delay, x, color}: {delay: number; x: number; color: string}) {
  const translateY = useSharedValue(-10);
  const translateX = useSharedValue(x);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withTiming(300, {duration: 1500}),
    );
    translateX.value = withDelay(
      delay,
      withSequence(
        withTiming(x + 30, {duration: 750}),
        withTiming(x - 20, {duration: 750}),
      ),
    );
    opacity.value = withDelay(
      delay + 800,
      withTiming(0, {duration: 700}),
    );
    rotate.value = withDelay(
      delay,
      withTiming(360, {duration: 1500}),
    );
  }, [delay, x, translateY, translateX, opacity, rotate]);

  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    transform: [
      {translateX: translateX.value},
      {translateY: translateY.value},
      {rotate: `${rotate.value}deg`},
    ],
    opacity: opacity.value,
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: color,
  }));

  return <Animated.View style={style} />;
}

export default function CompressionSuccessScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const alert = useAlert();
  const {results, type} = route.params;

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalOriginal = results.reduce((s, r) => s + r.originalSize, 0);
  const totalCompressed = results.reduce((s, r) => s + r.compressedSize, 0);
  const totalSaved = totalOriginal - totalCompressed;
  const avgPercent = Math.round(
    results.reduce((s, r) => s + r.savedPercent, 0) / results.length,
  );

  const confettiColors = [
    theme.colors.primary,
    theme.colors.secondary,
    theme.colors.success,
    theme.colors.warning,
    '#F472B6',
  ];

  const confettiParticles = Array.from({length: 20}, (_, i) => ({
    id: i,
    delay: i * 80,
    x: (Math.random() - 0.5) * 300 + 150,
    color: confettiColors[i % confettiColors.length],
  }));

  const handleSave = async (option: 'new' | 'replace') => {
    setSaving(true);
    setShowSaveModal(false);
    try {
      // 1. Write every compressed file into the shared gallery (MediaStore).
      for (const result of results) {
        await CompressionService.moveToMediaStore(result.compressedUri, type);
      }

      // 2. For "replace", remove the originals from the gallery. On Android 11+
      //    this needs a MediaStore delete request (content:// URIs) which shows
      //    a single system confirmation dialog for the whole batch — RNFS.unlink
      //    cannot touch shared-storage media under scoped storage.
      let deletedCount = 0;
      if (option === 'replace') {
        const originalUris = results
          .map(r => r.originalUri)
          .filter(uri => uri && uri.startsWith('content://'));
        if (originalUris.length > 0) {
          try {
            await CameraRoll.deletePhotos(originalUris);
            deletedCount = originalUris.length;
          } catch {
            // User dismissed the system delete dialog, or deletion failed.
            // The compressed copies are already saved, so fall through and
            // report that the originals were kept.
          }
        }
      }

      const count = results.length;
      const noun = `file${count > 1 ? 's' : ''}`;
      let message: string;
      if (option === 'new') {
        message = `${count} compressed ${noun} saved to your gallery (SpaceSaver album).`;
      } else if (deletedCount > 0) {
        message = `${count} ${noun} saved and ${deletedCount} original ${deletedCount > 1 ? 'files' : 'file'} removed.`;
      } else {
        message = `${count} compressed ${noun} saved to your gallery. Originals were kept.`;
      }

      alert({
        title: 'Saved!',
        message,
        type: 'success',
        buttons: [
          {
            text: 'Done',
            onPress: () => navigation.navigate('Main', {screen: 'Home'}),
          },
        ],
      });
    } catch (err) {
      alert({
        title: 'Error',
        message: 'Failed to save files. Please try again.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOption = () => {
    const defaultOption = SettingsService.get('defaultSaveOption');
    if (defaultOption === 'ask') {
      setShowSaveModal(true);
    } else {
      handleSave(defaultOption === 'replace' ? 'replace' : 'new');
    }
  };

  return (
    <View
      style={[
        styles.root,
        {backgroundColor: theme.colors.background, paddingTop: insets.top},
      ]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {paddingBottom: insets.bottom + 100},
        ]}>

        {/* Confetti */}
        <View style={styles.confettiLayer} pointerEvents="none">
          {confettiParticles.map(p => (
            <ConfettiParticle key={p.id} delay={p.delay} x={p.x} color={p.color} />
          ))}
        </View>

        {/* Success animation */}
        <Animated.View entering={ZoomIn.springify()}>
          <SuccessCheckmark />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <Text
            style={[
              theme.typography.headlineSmall,
              {
                color: theme.colors.text,
                textAlign: 'center',
                fontWeight: '700',
                marginBottom: 8,
              },
            ]}>
            Compression Complete!
          </Text>
          <Text
            style={[
              theme.typography.bodyMedium,
              {
                color: theme.colors.textSecondary,
                textAlign: 'center',
                marginBottom: 32,
              },
            ]}>
            {results.length} file{results.length > 1 ? 's' : ''} compressed successfully
          </Text>
        </Animated.View>

        {/* Stats card */}
        <Animated.View
          entering={FadeInDown.delay(600).springify()}
          style={styles.statsCard}>
          <LinearGradient
            colors={theme.colors.gradientPrimary}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.statsGradient}>
            <View style={styles.statsRow}>
              <View style={styles.statsItem}>
                <Text
                  style={[theme.typography.labelMedium, {color: 'rgba(255,255,255,0.7)'}]}>
                  Original
                </Text>
                <Text
                  style={[theme.typography.numericMedium, {color: 'white'}]}>
                  {StorageService.formatBytes(totalOriginal)}
                </Text>
              </View>
              <View style={styles.arrowContainer}>
                <Icon name="arrow-right" size={24} color="rgba(255,255,255,0.5)" />
              </View>
              <View style={styles.statsItem}>
                <Text
                  style={[theme.typography.labelMedium, {color: 'rgba(255,255,255,0.7)'}]}>
                  Compressed
                </Text>
                <Text
                  style={[theme.typography.numericMedium, {color: 'white'}]}>
                  {StorageService.formatBytes(totalCompressed)}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, {backgroundColor: 'rgba(255,255,255,0.15)'}]} />

            <View style={styles.savedRow}>
              <View style={styles.savedItem}>
                <Icon name="leaf" size={20} color="#4ADE80" />
                <Text style={[theme.typography.labelMedium, {color: 'rgba(255,255,255,0.8)'}]}>
                  Space Saved
                </Text>
                <Text
                  style={[
                    theme.typography.numericLarge,
                    {color: '#4ADE80', fontWeight: '800'},
                  ]}>
                  {StorageService.formatBytes(totalSaved)}
                </Text>
              </View>
              <View
                style={[
                  styles.percentBadge,
                  {backgroundColor: 'rgba(255,255,255,0.15)'},
                ]}>
                <Text
                  style={[
                    theme.typography.displaySmall,
                    {color: 'white', fontWeight: '900'},
                  ]}>
                  {avgPercent}%
                </Text>
                <Text
                  style={[
                    theme.typography.bodyMedium,
                    {color: 'rgba(255,255,255,0.7)'},
                  ]}>
                  smaller
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Per-file results */}
        {results.length > 1 && (
          <Animated.View entering={FadeInDown.delay(700).springify()}>
            <Text
              style={[
                theme.typography.titleSmall,
                {color: theme.colors.text, marginTop: 16, marginBottom: 8},
              ]}>
              File Details
            </Text>
            {results.map((result, i) => (
              <Card key={result.id} style={styles.fileCard}>
                <View style={styles.fileRow}>
                  <View
                    style={[
                      styles.fileIcon,
                      {backgroundColor: theme.colors.primaryContainer},
                    ]}>
                    <Icon
                      name={type === 'image' ? 'image' : 'video'}
                      size={16}
                      color={theme.colors.primary}
                    />
                  </View>
                  <View style={styles.fileInfo}>
                    <Text
                      style={[theme.typography.bodyMedium, {color: theme.colors.text}]}
                      numberOfLines={1}>
                      {result.fileName}
                    </Text>
                    <Text
                      style={[
                        theme.typography.bodySmall,
                        {color: theme.colors.textSecondary},
                      ]}>
                      {StorageService.formatBytes(result.originalSize)} →{' '}
                      {StorageService.formatBytes(result.compressedSize)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.pctBadge,
                      {backgroundColor: theme.colors.successContainer},
                    ]}>
                    <Text
                      style={[
                        theme.typography.labelSmall,
                        {color: theme.colors.success, fontWeight: '700'},
                      ]}>
                      -{result.savedPercent}%
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </Animated.View>
        )}
      </ScrollView>

      {/* Action buttons */}
      <Animated.View
        entering={FadeInUp.delay(800).springify()}
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 12,
            backgroundColor: theme.colors.background,
            borderTopColor: theme.colors.borderLight,
          },
        ]}>
        <AnimatedButton
          onPress={handleSaveOption}
          variant="primary"
          size="lg"
          gradient
          fullWidth
          loading={saving}>
          <Icon name="content-save" size={20} color="white" />
          <Text style={[theme.typography.titleSmall, {color: 'white'}]}>
            Save Files
          </Text>
        </AnimatedButton>
        <AnimatedButton
          onPress={() => navigation.navigate('Main', {screen: 'Home'})}
          variant="ghost"
          size="md"
          fullWidth
          style={{marginTop: 8}}>
          <Text style={[theme.typography.labelLarge, {color: theme.colors.primary}]}>
            Done
          </Text>
        </AnimatedButton>
      </Animated.View>

      {/* Save option modal */}
      <Modal
        visible={showSaveModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSaveModal(false)}>
        <View style={styles.modalBackdrop}>
          <Animated.View
            entering={FadeInUp.springify()}
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surface,
                ...theme.elevation.xl,
              },
            ]}>
            <Text
              style={[
                theme.typography.titleLarge,
                {color: theme.colors.text, marginBottom: 8},
              ]}>
              Save Options
            </Text>
            <Text
              style={[
                theme.typography.bodyMedium,
                {color: theme.colors.textSecondary, marginBottom: 24},
              ]}>
              What would you like to do with the compressed files?
            </Text>

            <TouchableOpacity
              style={[
                styles.saveOption,
                {backgroundColor: theme.colors.primaryContainer},
              ]}
              onPress={() => handleSave('new')}>
              <View
                style={[
                  styles.saveOptionIcon,
                  {backgroundColor: theme.colors.primary},
                ]}>
                <Icon name="content-copy" size={20} color="white" />
              </View>
              <View style={styles.saveOptionInfo}>
                <Text
                  style={[
                    theme.typography.titleSmall,
                    {color: theme.colors.text},
                  ]}>
                  Save as New Copy
                </Text>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: theme.colors.textSecondary},
                  ]}>
                  Keep original and save compressed version
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveOption,
                {
                  backgroundColor: theme.colors.errorContainer,
                  marginTop: 10,
                },
              ]}
              onPress={() => {
                setShowSaveModal(false);
                alert({
                  title: 'Replace Original?',
                  message:
                    'The original file will be permanently removed from your gallery.',
                  type: 'warning',
                  icon: 'swap-horizontal',
                  buttons: [
                    {
                      text: 'Cancel',
                      style: 'cancel',
                      onPress: () => setShowSaveModal(true),
                    },
                    {
                      text: 'Replace',
                      style: 'destructive',
                      onPress: () => handleSave('replace'),
                    },
                  ],
                });
              }}>
              <View
                style={[
                  styles.saveOptionIcon,
                  {backgroundColor: theme.colors.error},
                ]}>
                <Icon name="swap-horizontal" size={20} color="white" />
              </View>
              <View style={styles.saveOptionInfo}>
                <Text
                  style={[
                    theme.typography.titleSmall,
                    {color: theme.colors.text},
                  ]}>
                  Replace Original
                </Text>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: theme.colors.error},
                  ]}>
                  Permanently delete original file
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelModalBtn}
              onPress={() => setShowSaveModal(false)}>
              <Text
                style={[theme.typography.labelLarge, {color: theme.colors.textSecondary}]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  content: {
    paddingHorizontal: 20,
    alignItems: 'center',
    paddingTop: 32,
  },
  confettiLayer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    height: 300,
    overflow: 'hidden',
  },
  checkmarkContainer: {
    marginBottom: 28,
  },
  checkmarkGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCard: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 8,
  },
  statsGradient: {
    padding: 24,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statsItem: {
    alignItems: 'center',
    gap: 4,
  },
  arrowContainer: {
    paddingHorizontal: 8,
  },
  divider: {
    height: 1,
    marginBottom: 20,
  },
  savedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savedItem: {
    gap: 4,
  },
  percentBadge: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 2,
  },
  fileCard: {
    width: '100%',
    marginBottom: 8,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {flex: 1},
  pctBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
  },
  saveOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
  },
  saveOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveOptionInfo: {flex: 1, gap: 2},
  cancelModalBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
});
