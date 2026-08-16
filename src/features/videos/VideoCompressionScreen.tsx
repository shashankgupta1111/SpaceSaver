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
import {SettingsService} from '../../shared/services/SettingsService';
import {CompressionQueueService} from '../../shared/services/CompressionQueueService';
import {useAlert} from '../../shared/components/AlertProvider';
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

const VIDEO_FORMAT_OPTIONS = [
  {label: 'MP4', value: 'mp4' as const, subtitle: 'Universal'},
  {label: 'MOV', value: 'mov' as const, subtitle: 'QuickTime'},
  {label: 'MKV', value: 'mkv' as const, subtitle: 'Matroska'},
  {label: 'WebM', value: 'webm' as const, subtitle: 'Web Standard'},
];

export default function VideoCompressionScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {selectedUris} = route.params;

  const [mode, setMode] = useState<'compress' | 'convert'>('compress');

  // Hydrate from the last-used preset.
  const [options, setOptions] = useState<CompressionOptions>({
    mode: 'compress',
    resolution: '720p',
    videoBitrate: 'auto',
    fps: 'original',
    videoCodec: 'h264',
    videoOutputFormat: 'mp4',
    ...SettingsService.get('defaultVideoOptions'),
  });

  const handleModeChange = (newMode: 'compress' | 'convert') => {
    setMode(newMode);
    setOptions(p => ({
      ...p,
      mode: newMode,
      resolution: newMode === 'convert' ? 'original' : (p.resolution ?? '720p'),
      videoBitrate: newMode === 'convert' ? 'high' : (p.videoBitrate ?? 'auto'),
    }));
  };

  const [actualTotalBytes, setActualTotalBytes] = useState<number>(
    selectedUris.length * 85 * 1024 * 1024,
  );

  React.useEffect(() => {
    let isMounted = true;
    Promise.all(selectedUris.map(uri => StorageService.getFileSize(uri)))
      .then(sizes => {
        if (!isMounted) return;
        const total = sizes.reduce((sum, s) => sum + s, 0);
        if (total > 0) {
          setActualTotalBytes(total);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [selectedUris]);

  const estimatedOutput = CompressionService.estimateCompressedSize(
    actualTotalBytes,
    options,
    'video',
  );
  const estimatedSavings = Math.max(0, actualTotalBytes - estimatedOutput);
  const estimatedPercent =
    actualTotalBytes > 0
      ? Math.round((estimatedSavings / actualTotalBytes) * 100)
      : 0;

  const alert = useAlert();

  const handleCompress = () => {
    SettingsService.set('defaultVideoOptions', options);
    navigation.navigate('CompressionProgress', {
      type: 'video',
      uris: selectedUris,
      options,
    });
  };

  const handleAddToQueue = () => {
    SettingsService.set('defaultVideoOptions', options);
    const jobName = `${selectedUris.length} Video${selectedUris.length > 1 ? 's' : ''}`;
    CompressionQueueService.addJob(jobName, 'video', selectedUris, options, actualTotalBytes, true);
    alert({
      title: 'Added to Queue',
      message: `${selectedUris.length} video${selectedUris.length > 1 ? 's' : ''} added to the background compression queue.`,
      type: 'success',
      icon: 'tray-arrow-down',
      buttons: [
        {
          text: 'View Queue',
          onPress: () => navigation.navigate('CompressionQueue'),
        },
        {text: 'OK', style: 'cancel'},
      ],
    });
  };

  return (
    <View
      style={[
        styles.root,
        {backgroundColor: theme.colors.background, paddingTop: insets.top},
      ]}>
      <HeaderBar
        title={mode === 'convert' ? 'Convert Video Format' : 'Compress Videos'}
        showBack
      />

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
              Video processing runs in the background. You can lock your screen or switch apps.
            </Text>
          </View>
        </Animated.View>

        {/* Mode Selector Card */}
        <Animated.View entering={FadeInDown.springify()}>
          <Card style={styles.card}>
            <Text
              style={[
                theme.typography.titleSmall,
                {color: theme.colors.text, marginBottom: 10},
              ]}>
              Operation Mode
            </Text>
            <View style={styles.modeToggleRow}>
              <TouchableOpacity
                onPress={() => handleModeChange('compress')}
                style={[
                  styles.modeTab,
                  mode === 'compress'
                    ? {backgroundColor: theme.colors.primary}
                    : {backgroundColor: theme.colors.surfaceVariant},
                ]}>
                <Icon
                  name="zip-box"
                  size={18}
                  color={mode === 'compress' ? 'white' : theme.colors.text}
                />
                <Text
                  style={[
                    theme.typography.labelMedium,
                    {
                      color: mode === 'compress' ? 'white' : theme.colors.text,
                      fontWeight: '700',
                    },
                  ]}>
                  Compress & Save
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleModeChange('convert')}
                style={[
                  styles.modeTab,
                  mode === 'convert'
                    ? {backgroundColor: theme.colors.primary}
                    : {backgroundColor: theme.colors.surfaceVariant},
                ]}>
                <Icon
                  name="swap-horizontal"
                  size={18}
                  color={mode === 'convert' ? 'white' : theme.colors.text}
                />
                <Text
                  style={[
                    theme.typography.labelMedium,
                    {
                      color: mode === 'convert' ? 'white' : theme.colors.text,
                      fontWeight: '700',
                    },
                  ]}>
                  Format Converter
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </Animated.View>

        {mode === 'convert' ? (
          <>
            <Animated.View entering={FadeInDown.delay(100).springify()}>
              <Card
                style={[
                  styles.card,
                  {backgroundColor: theme.colors.successContainer},
                ]}
                variant="filled">
                <View style={styles.infoRow}>
                  <Icon
                    name="shield-check-outline"
                    size={24}
                    color={theme.colors.success}
                  />
                  <View style={{flex: 1}}>
                    <Text
                      style={[
                        theme.typography.titleSmall,
                        {color: theme.colors.text},
                      ]}>
                      Original Quality & Resolution Preserved
                    </Text>
                    <Text
                      style={[
                        theme.typography.bodySmall,
                        {
                          color: theme.colors.textSecondary,
                          marginTop: 2,
                        },
                      ]}>
                      Converts video format (e.g. MOV ➔ MP4, MKV ➔ MP4) preserving original resolution and high bitrate without quality loss.
                    </Text>
                  </View>
                </View>
              </Card>
            </Animated.View>

            {/* Target Video Container Format */}
            <Animated.View entering={FadeInDown.delay(150).springify()}>
              <Card style={styles.card}>
                <Text
                  style={[
                    theme.typography.titleSmall,
                    {color: theme.colors.text, marginBottom: 14},
                  ]}>
                  Target Video Format
                </Text>
                <View style={styles.chipRow}>
                  {VIDEO_FORMAT_OPTIONS.map(opt => (
                    <OptionChip
                      key={opt.value}
                      label={opt.label}
                      subtitle={opt.subtitle}
                      selected={options.videoOutputFormat === opt.value}
                      onPress={() =>
                        setOptions(p => ({...p, videoOutputFormat: opt.value}))
                      }
                    />
                  ))}
                </View>
              </Card>
            </Animated.View>
          </>
        ) : (
          <>
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
          </>
        )}

        {/* Compression Savings Calculator Card */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Card
            style={[
              styles.estimateCard,
              {backgroundColor: theme.colors.surfaceVariant, borderWidth: 1, borderColor: theme.colors.borderLight},
            ]}>
            <View style={styles.calculatorHeader}>
              <View style={styles.calculatorTitleRow}>
                <Icon name="calculator-variant-outline" size={20} color={theme.colors.secondary} />
                <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
                  Compression Savings Calculator
                </Text>
              </View>
              <View style={[styles.estimateBadge, {backgroundColor: theme.colors.secondaryContainer}]}>
                <Text style={[theme.typography.labelSmall, {color: theme.colors.secondary, fontWeight: '700'}]}>
                  ESTIMATED
                </Text>
              </View>
            </View>

            <View style={styles.calculatorGrid}>
              <View style={styles.calculatorCol}>
                <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary}]}>Current Size</Text>
                <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700', marginTop: 2}]}>
                  {StorageService.formatBytes(actualTotalBytes)}
                </Text>
              </View>
              <Icon name="arrow-right" size={16} color={theme.colors.textTertiary} />
              <View style={styles.calculatorCol}>
                <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary}]}>Est. Output</Text>
                <Text style={[theme.typography.titleSmall, {color: theme.colors.secondary, fontWeight: '700', marginTop: 2}]}>
                  {StorageService.formatBytes(estimatedOutput)}
                </Text>
              </View>
              <View style={[styles.calculatorCol, styles.calculatorSavingsCol]}>
                <Text style={[theme.typography.labelSmall, {color: theme.colors.success}]}>Est. Savings</Text>
                <Text style={[theme.typography.titleSmall, {color: theme.colors.success, fontWeight: '800', marginTop: 2}]}>
                  ~{StorageService.formatBytes(estimatedSavings)} ({estimatedPercent}%)
                </Text>
              </View>
            </View>

            <Text
              style={[
                theme.typography.bodySmall,
                {color: theme.colors.textTertiary, opacity: 0.8, marginTop: 10, textAlign: 'center', fontSize: 11},
              ]}>
              * Estimated savings based on {options.resolution ?? '720p'} · {options.videoCodec?.toUpperCase() ?? 'H264'}. Actual savings calculated upon completion.
            </Text>
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
        <View style={styles.footerButtonsRow}>
          <TouchableOpacity
            style={[styles.queueButton, {backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border}]}
            onPress={handleAddToQueue}>
            <Icon name="tray-arrow-down" size={18} color={theme.colors.text} />
            <Text style={[theme.typography.labelMedium, {color: theme.colors.text, fontWeight: '700'}]}>
              Queue
            </Text>
          </TouchableOpacity>

          <View style={{flex: 1}}>
            <AnimatedButton
              onPress={handleCompress}
              variant="secondary"
              size="lg"
              gradient
              fullWidth>
              <Icon
                name={mode === 'convert' ? 'swap-horizontal' : 'zip-box'}
                size={20}
                color="white"
              />
              <Text style={[theme.typography.titleSmall, {color: 'white'}]}>
                {mode === 'convert' ? 'Convert' : 'Start'}
              </Text>
            </AnimatedButton>
          </View>
        </View>
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
  modeToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
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
  estimateCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 20,
    padding: 16,
  },
  calculatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  calculatorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  estimateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  calculatorGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calculatorCol: {
    flex: 1,
  },
  calculatorSavingsCol: {
    flex: 1.2,
    alignItems: 'flex-end',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 0.5,
  },
  footerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  queueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
});
