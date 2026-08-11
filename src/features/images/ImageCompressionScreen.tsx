import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Switch,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList, CompressionOptions} from '../../app/navigation/types';
import {StorageService} from '../../shared/services/StorageService';
import {CompressionService} from '../../shared/services/CompressionService';
import {SettingsService} from '../../shared/services/SettingsService';
import HeaderBar from '../../shared/components/HeaderBar';
import Card from '../../shared/components/Card';
import AnimatedButton from '../../shared/components/AnimatedButton';
import BeforeAfterSlider from '../../shared/components/BeforeAfterSlider';

type Route = RouteProp<RootStackParamList, 'ImageCompression'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type CompressionLevel = 'low' | 'medium' | 'high' | 'custom';

const LEVEL_PRESETS: Record<CompressionLevel, Partial<CompressionOptions>> = {
  low: {quality: 0.9, maxWidth: 1920, outputFormat: 'jpeg'},
  medium: {quality: 0.75, maxWidth: 1280, outputFormat: 'jpeg'},
  high: {quality: 0.55, maxWidth: 1080, outputFormat: 'webp'},
  custom: {quality: 0.8, maxWidth: 1920, outputFormat: 'jpeg'},
};

const RESIZE_OPTIONS = [
  {label: 'Original', value: 0},
  {label: '1920px', value: 1920},
  {label: '1280px', value: 1280},
  {label: '1080px', value: 1080},
  {label: '720px', value: 720},
  {label: '480px', value: 480},
];

const FORMAT_OPTIONS: Array<{label: string; value: 'jpeg' | 'png' | 'webp'}> = [
  {label: 'JPEG', value: 'jpeg'},
  {label: 'PNG', value: 'png'},
  {label: 'WebP', value: 'webp'},
];

function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
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
          {color: selected ? 'white' : theme.colors.textSecondary},
        ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function ImageCompressionScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {selectedUris} = route.params;

  // Hydrate from the last-used preset so power users don't re-pick every time.
  const saved = SettingsService.get('defaultImageOptions');
  const initialLevel = (saved.compressionLevel as CompressionLevel) ?? 'medium';
  const [mode, setMode] = useState<'compress' | 'convert'>('compress');
  const [level, setLevel] = useState<CompressionLevel>(initialLevel);
  const [options, setOptions] = useState<CompressionOptions>({
    mode: 'compress',
    ...LEVEL_PRESETS[initialLevel],
    keepMetadata: true,
    ...saved,
    compressionLevel: initialLevel,
  });

  const handleModeChange = (newMode: 'compress' | 'convert') => {
    setMode(newMode);
    setOptions(prev => ({
      ...prev,
      mode: newMode,
      quality: newMode === 'convert' ? 1.0 : (prev.quality ?? 0.8),
      maxWidth: newMode === 'convert' ? undefined : (prev.maxWidth ?? 1920),
    }));
  };

  const handleLevelChange = (newLevel: CompressionLevel) => {
    setLevel(newLevel);
    setOptions(prev => ({
      ...prev,
      ...LEVEL_PRESETS[newLevel],
      compressionLevel: newLevel,
    }));
  };

  const totalOriginalSize = selectedUris.length * 3 * 1024 * 1024;
  const estimatedSize = CompressionService.estimateCompressedSize(
    totalOriginalSize,
    options,
    'image',
  );
  const estimatedSavings = totalOriginalSize - estimatedSize;
  const estimatedPercent = Math.round((estimatedSavings / totalOriginalSize) * 100);

  const handleCompress = () => {
    // Remember these choices for next time.
    SettingsService.set('defaultImageOptions', options);
    navigation.navigate('CompressionProgress', {
      type: 'image',
      uris: selectedUris,
      options,
    });
  };

  const qualityPercent = Math.round((options.quality ?? 0.8) * 100);

  return (
    <View
      style={[
        styles.root,
        {backgroundColor: theme.colors.background, paddingTop: insets.top},
      ]}>
      <HeaderBar
        title={mode === 'convert' ? 'Convert Image Format' : 'Compress Images'}
        showBack
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {paddingBottom: insets.bottom + 100},
        ]}>

        {/* Preview strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.previewStrip}>
          {selectedUris.slice(0, 8).map((uri, i) => (
            <Image
              key={uri}
              source={{uri}}
              style={styles.previewThumb}
              resizeMode="cover"
              resizeMethod="resize"
            />
          ))}
          {selectedUris.length > 8 && (
            <View
              style={[
                styles.previewMore,
                {backgroundColor: theme.colors.surfaceVariant},
              ]}>
              <Text
                style={[theme.typography.titleSmall, {color: theme.colors.text}]}>
                +{selectedUris.length - 8}
              </Text>
            </View>
          )}
        </ScrollView>

        <Text
          style={[
            theme.typography.bodyMedium,
            {color: theme.colors.textSecondary, marginHorizontal: 20, marginBottom: 16},
          ]}>
          {selectedUris.length} image{selectedUris.length > 1 ? 's' : ''} selected
        </Text>

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
                    100% Original Quality Preserved
                  </Text>
                  <Text
                    style={[
                      theme.typography.bodySmall,
                      {
                        color: theme.colors.textSecondary,
                        marginTop: 2,
                      },
                    ]}>
                    Converts image format (e.g. HEIC ➔ JPEG or PNG ➔ WebP) at maximum 100% quality without reducing visual quality.
                  </Text>
                </View>
              </View>
            </Card>
          </Animated.View>
        ) : (
          /* Before / After preview (first image) */
          <Animated.View entering={FadeInDown.springify()}>
            <Card style={styles.card}>
              <Text
                style={[
                  theme.typography.titleSmall,
                  {color: theme.colors.text, marginBottom: 4},
                ]}>
                Preview
              </Text>
              <Text
                style={[
                  theme.typography.bodySmall,
                  {color: theme.colors.textSecondary, marginBottom: 12},
                ]}>
                Drag to compare the first image · original vs compressed
              </Text>
              <BeforeAfterSlider originalUri={selectedUris[0]} options={options} />
            </Card>
          </Animated.View>
        )}

        {/* Compression options only shown in 'compress' mode */}
        {mode === 'compress' && (
          <>
            {/* Compression Level */}
            <Animated.View entering={FadeInDown.delay(100).springify()}>
              <Card style={styles.card}>
                <Text
                  style={[
                    theme.typography.titleSmall,
                    {color: theme.colors.text, marginBottom: 14},
                  ]}>
                  Compression Level
                </Text>
                <View style={styles.chipRow}>
                  {(['low', 'medium', 'high', 'custom'] as CompressionLevel[]).map(
                    l => (
                      <OptionChip
                        key={l}
                        label={l.charAt(0).toUpperCase() + l.slice(1)}
                        selected={level === l}
                        onPress={() => handleLevelChange(l)}
                      />
                    ),
                  )}
                </View>
              </Card>
            </Animated.View>

            {/* Quality slider (custom mode) */}
            {level === 'custom' && (
              <Animated.View entering={FadeInDown.delay(150).springify()}>
                <Card style={styles.card}>
                  <View style={styles.sliderHeader}>
                    <Text
                      style={[theme.typography.titleSmall, {color: theme.colors.text}]}>
                      Image Quality
                    </Text>
                    <View
                      style={[
                        styles.qualityBadge,
                        {backgroundColor: theme.colors.primaryContainer},
                      ]}>
                      <Text
                        style={[
                          theme.typography.labelLarge,
                          {color: theme.colors.primary, fontWeight: '700'},
                        ]}>
                        {qualityPercent}%
                      </Text>
                    </View>
                  </View>
                  <Slider
                    minimumValue={0.3}
                    maximumValue={1.0}
                    value={options.quality ?? 0.8}
                    onValueChange={v =>
                      setOptions(prev => ({...prev, quality: v}))
                    }
                    minimumTrackTintColor={theme.colors.primary}
                    maximumTrackTintColor={theme.colors.border}
                    thumbTintColor={theme.colors.primary}
                    step={0.05}
                    style={styles.slider}
                  />
                  <View style={styles.sliderLabels}>
                    <Text style={[theme.typography.bodySmall, {color: theme.colors.textTertiary}]}>
                      Smaller size
                    </Text>
                    <Text style={[theme.typography.bodySmall, {color: theme.colors.textTertiary}]}>
                      Better quality
                    </Text>
                  </View>
                </Card>
              </Animated.View>
            )}

            {/* Resize */}
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <Card style={styles.card}>
                <Text
                  style={[
                    theme.typography.titleSmall,
                    {color: theme.colors.text, marginBottom: 14},
                  ]}>
                  Max Dimension
                </Text>
                <View style={styles.chipRow}>
                  {RESIZE_OPTIONS.map(opt => (
                    <OptionChip
                      key={opt.label}
                      label={opt.label}
                      selected={
                        opt.value === 0
                          ? !options.maxWidth
                          : options.maxWidth === opt.value
                      }
                      onPress={() =>
                        setOptions(prev => ({
                          ...prev,
                          maxWidth: opt.value === 0 ? undefined : opt.value,
                          maxHeight: opt.value === 0 ? undefined : opt.value,
                        }))
                      }
                    />
                  ))}
                </View>
              </Card>
            </Animated.View>
          </>
        )}

        {/* Format */}
        <Animated.View entering={FadeInDown.delay(250).springify()}>
          <Card style={styles.card}>
            <Text
              style={[
                theme.typography.titleSmall,
                {color: theme.colors.text, marginBottom: 14},
              ]}>
              Output Format
            </Text>
            <View style={styles.chipRow}>
              {FORMAT_OPTIONS.map(opt => (
                <OptionChip
                  key={opt.value}
                  label={opt.label}
                  selected={options.outputFormat === opt.value}
                  onPress={() =>
                    setOptions(prev => ({...prev, outputFormat: opt.value}))
                  }
                />
              ))}
            </View>
            {options.outputFormat === 'webp' && (
              <Text
                style={[
                  theme.typography.bodySmall,
                  {color: theme.colors.textSecondary, marginTop: 8},
                ]}>
                WebP offers 25–35% better compression than JPEG.
              </Text>
            )}
          </Card>
        </Animated.View>

        {/* Keep metadata */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Card style={styles.card}>
            <View style={styles.switchRow}>
              <View>
                <Text
                  style={[
                    theme.typography.titleSmall,
                    {color: theme.colors.text},
                  ]}>
                  Keep Metadata
                </Text>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: theme.colors.textSecondary},
                  ]}>
                  Preserve EXIF data (GPS, camera info)
                </Text>
              </View>
              <Switch
                value={options.keepMetadata ?? true}
                onValueChange={v =>
                  setOptions(prev => ({...prev, keepMetadata: v}))
                }
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primaryLight,
                }}
                thumbColor={
                  options.keepMetadata ? theme.colors.primary : theme.colors.textTertiary
                }
              />
            </View>
          </Card>
        </Animated.View>

        {/* Estimate */}
        <Animated.View entering={FadeInDown.delay(350).springify()}>
          <Card
            style={[
              styles.estimateCard,
              {backgroundColor: theme.colors.primaryContainer},
            ]}
            variant="filled">
            <View style={styles.estimateRow}>
              <View style={styles.estimateItem}>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: theme.colors.onPrimaryContainer, opacity: 0.7},
                  ]}>
                  Est. Output
                </Text>
                <Text
                  style={[
                    theme.typography.numericSmall,
                    {color: theme.colors.onPrimaryContainer},
                  ]}>
                  {StorageService.formatBytes(estimatedSize)}
                </Text>
              </View>
              <View
                style={[styles.estimateDivider, {backgroundColor: theme.colors.primary, opacity: 0.2}]}
              />
              <View style={styles.estimateItem}>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: theme.colors.onPrimaryContainer, opacity: 0.7},
                  ]}>
                  Estimated Savings
                </Text>
                <Text
                  style={[
                    theme.typography.numericSmall,
                    {color: theme.colors.primary, fontWeight: '700'},
                  ]}>
                  ~{estimatedPercent}% · {StorageService.formatBytes(estimatedSavings)}
                </Text>
              </View>
            </View>
            <Text
              style={[
                theme.typography.bodySmall,
                {color: theme.colors.onPrimaryContainer, opacity: 0.6, marginTop: 8, textAlign: 'center'},
              ]}>
              Actual results may vary
            </Text>
          </Card>
        </Animated.View>
      </ScrollView>

      {/* Action button */}
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
          variant="primary"
          size="lg"
          gradient
          fullWidth>
          <Icon
            name={mode === 'convert' ? 'swap-horizontal' : 'zip-box'}
            size={20}
            color="white"
          />
          <Text style={[theme.typography.titleSmall, {color: 'white'}]}>
            {mode === 'convert' ? 'Convert Format' : 'Start Compression'}
          </Text>
        </AnimatedButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  scroll: {paddingTop: 8, gap: 2},
  previewStrip: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  previewThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  previewMore: {
    width: 72,
    height: 72,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 10,
  },
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
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  qualityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  slider: {
    marginHorizontal: -8,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  estimateCard: {
    marginHorizontal: 20,
    marginBottom: 10,
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  estimateItem: {flex: 1, gap: 2},
  estimateDivider: {
    width: 1,
    height: 40,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 0.5,
  },
});
