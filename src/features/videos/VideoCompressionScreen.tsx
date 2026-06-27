import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList, CompressionOptions} from '../../app/navigation/types';
import {StorageService} from '../../shared/services/StorageService';
import {CompressionService} from '../../shared/services/CompressionService';
import HeaderBar from '../../shared/components/HeaderBar';
import Card from '../../shared/components/Card';
import AnimatedButton from '../../shared/components/AnimatedButton';

type Route = RouteProp<RootStackParamList, 'VideoCompression'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function OptionChip({
  label,
  subtitle,
  selected,
  onPress,
}: {
  label: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const {theme} = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? {backgroundColor: theme.colors.primary}
          : {
              backgroundColor: theme.colors.surfaceVariant,
              borderWidth: 1.5,
              borderColor: theme.colors.border,
            },
      ]}>
      <Text
        style={[
          theme.typography.labelMedium,
          {color: selected ? 'white' : theme.colors.text, fontWeight: '600'},
        ]}>
        {label}
      </Text>
      {subtitle && (
        <Text
          style={[
            theme.typography.bodySmall,
            {
              color: selected ? 'rgba(255,255,255,0.75)' : theme.colors.textSecondary,
              fontSize: 10,
            },
          ]}>
          {subtitle}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const RESOLUTION_OPTIONS = [
  {label: 'Original', value: 'original' as const, subtitle: 'No resize'},
  {label: '1080p', value: '1080p' as const, subtitle: 'Full HD'},
  {label: '720p', value: '720p' as const, subtitle: 'HD'},
  {label: '480p', value: '480p' as const, subtitle: 'SD'},
  {label: '360p', value: '360p' as const, subtitle: 'Low'},
];

const BITRATE_OPTIONS = [
  {label: 'Automatic', value: 'auto' as const, subtitle: 'Recommended'},
  {label: 'Low', value: 'low' as const, subtitle: '0.5 Mbps'},
  {label: 'Medium', value: 'medium' as const, subtitle: '1.5 Mbps'},
  {label: 'High', value: 'high' as const, subtitle: '4 Mbps'},
];

const FPS_OPTIONS = [
  {label: 'Keep Original', value: 'original' as const},
  {label: '30 FPS', value: 30 as const},
  {label: '24 FPS', value: 24 as const},
  {label: '15 FPS', value: 15 as const},
];

const CODEC_OPTIONS = [
  {label: 'H.264', value: 'h264' as const, subtitle: 'Compatible'},
  {label: 'H.265', value: 'h265' as const, subtitle: 'Efficient'},
];

export default function VideoCompressionScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {selectedUris} = route.params;

  const [options, setOptions] = useState<CompressionOptions>({
    resolution: '720p',
    videoBitrate: 'auto',
    fps: 'original',
    videoCodec: 'h264',
  });

  const estimatedOriginal = selectedUris.length * 100 * 1024 * 1024;
  const estimatedOutput = CompressionService.estimateCompressedSize(
    estimatedOriginal,
    options,
    'video',
  );
  const estimatedSavings = estimatedOriginal - estimatedOutput;
  const estimatedPercent = Math.round(
    (estimatedSavings / estimatedOriginal) * 100,
  );

  const handleCompress = () => {
    navigation.navigate('CompressionProgress', {
      type: 'video',
      uris: selectedUris,
      options,
    });
  };

  return (
    <View
      style={[
        styles.root,
        {backgroundColor: theme.colors.background, paddingTop: insets.top},
      ]}>
      <HeaderBar title="Compress Videos" showBack />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {paddingBottom: insets.bottom + 100},
        ]}>

        <Text
          style={[
            theme.typography.bodyMedium,
            {
              color: theme.colors.textSecondary,
              marginHorizontal: 20,
              marginBottom: 16,
            },
          ]}>
          {selectedUris.length} video{selectedUris.length > 1 ? 's' : ''} selected
        </Text>

        {/* Warning for foreground service */}
        <Animated.View entering={FadeInDown.delay(50).springify()}>
          <View
            style={[
              styles.infoCard,
              {backgroundColor: theme.colors.warningContainer},
            ]}>
            <Icon name="information-outline" size={18} color={theme.colors.warning} />
            <Text
              style={[
                theme.typography.bodySmall,
                {color: theme.colors.warning, flex: 1},
              ]}>
              Video compression runs in the background. You can lock your screen or switch apps.
            </Text>
          </View>
        </Animated.View>

        {/* Resolution */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Card style={styles.card}>
            <Text
              style={[
                theme.typography.titleSmall,
                {color: theme.colors.text, marginBottom: 14},
              ]}>
              Resolution
            </Text>
            <View style={styles.chipRow}>
              {RESOLUTION_OPTIONS.map(opt => (
                <OptionChip
                  key={opt.value}
                  label={opt.label}
                  subtitle={opt.subtitle}
                  selected={options.resolution === opt.value}
                  onPress={() =>
                    setOptions(p => ({...p, resolution: opt.value}))
                  }
                />
              ))}
            </View>
          </Card>
        </Animated.View>

        {/* Bitrate */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <Card style={styles.card}>
            <Text
              style={[
                theme.typography.titleSmall,
                {color: theme.colors.text, marginBottom: 14},
              ]}>
              Bitrate
            </Text>
            <View style={styles.chipRow}>
              {BITRATE_OPTIONS.map(opt => (
                <OptionChip
                  key={opt.value}
                  label={opt.label}
                  subtitle={opt.subtitle}
                  selected={options.videoBitrate === opt.value}
                  onPress={() =>
                    setOptions(p => ({...p, videoBitrate: opt.value}))
                  }
                />
              ))}
            </View>
          </Card>
        </Animated.View>

        {/* FPS */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Card style={styles.card}>
            <Text
              style={[
                theme.typography.titleSmall,
                {color: theme.colors.text, marginBottom: 14},
              ]}>
              Frame Rate
            </Text>
            <View style={styles.chipRow}>
              {FPS_OPTIONS.map(opt => (
                <OptionChip
                  key={String(opt.value)}
                  label={opt.label}
                  selected={options.fps === opt.value}
                  onPress={() => setOptions(p => ({...p, fps: opt.value}))}
                />
              ))}
            </View>
          </Card>
        </Animated.View>

        {/* Codec */}
        <Animated.View entering={FadeInDown.delay(250).springify()}>
          <Card style={styles.card}>
            <Text
              style={[
                theme.typography.titleSmall,
                {color: theme.colors.text, marginBottom: 14},
              ]}>
              Video Codec
            </Text>
            <View style={styles.chipRow}>
              {CODEC_OPTIONS.map(opt => (
                <OptionChip
                  key={opt.value}
                  label={opt.label}
                  subtitle={opt.subtitle}
                  selected={options.videoCodec === opt.value}
                  onPress={() =>
                    setOptions(p => ({...p, videoCodec: opt.value}))
                  }
                />
              ))}
            </View>
            {options.videoCodec === 'h265' && (
              <Text
                style={[
                  theme.typography.bodySmall,
                  {color: theme.colors.textSecondary, marginTop: 8},
                ]}>
                H.265 requires Android 5.0+ and device hardware support.
              </Text>
            )}
          </Card>
        </Animated.View>

        {/* Estimate */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Card
            style={[
              styles.estimateCard,
              {backgroundColor: theme.colors.secondaryContainer},
            ]}
            variant="filled">
            <View style={styles.estimateRow}>
              <View style={styles.estimateItem}>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: theme.colors.onSecondaryContainer, opacity: 0.7},
                  ]}>
                  Est. Output Size
                </Text>
                <Text
                  style={[
                    theme.typography.numericSmall,
                    {color: theme.colors.onSecondaryContainer},
                  ]}>
                  {StorageService.formatBytes(estimatedOutput)}
                </Text>
              </View>
              <View
                style={[
                  styles.estimateDivider,
                  {backgroundColor: theme.colors.secondary, opacity: 0.2},
                ]}
              />
              <View style={styles.estimateItem}>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: theme.colors.onSecondaryContainer, opacity: 0.7},
                  ]}>
                  Estimated Savings
                </Text>
                <Text
                  style={[
                    theme.typography.numericSmall,
                    {color: theme.colors.secondary, fontWeight: '700'},
                  ]}>
                  ~{estimatedPercent}%
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 12,
            backgroundColor: theme.colors.background,
            borderTopColor: theme.colors.borderLight,
          },
        ]}>
        <AnimatedButton
          onPress={handleCompress}
          variant="secondary"
          size="lg"
          gradient
          fullWidth>
          <Icon name="zip-box" size={20} color="white" />
          <Text style={[theme.typography.titleSmall, {color: 'white'}]}>
            Start Compression
          </Text>
        </AnimatedButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  scroll: {paddingTop: 8, gap: 2},
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
  },
  card: {marginHorizontal: 20, marginBottom: 10},
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 70,
  },
  estimateCard: {marginHorizontal: 20, marginBottom: 10},
  estimateRow: {flexDirection: 'row', alignItems: 'center', gap: 16},
  estimateItem: {flex: 1, gap: 2},
  estimateDivider: {width: 1, height: 40},
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 0.5,
  },
});
