import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {FadeInUp} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useTheme} from '../../app/theme/ThemeContext';
import {
  SortOrder,
  MediaFilter,
  DEFAULT_FILTER,
  DEFAULT_SORT,
  SizeBucket,
  ImageFormat,
  VideoFormat,
  VideoResolution,
} from '../utils/mediaSortFilter';

interface Props {
  visible: boolean;
  type: 'image' | 'video';
  sortOrder: SortOrder;
  filter: MediaFilter;
  onChangeSort: (sort: SortOrder) => void;
  onChangeFilter: (filter: MediaFilter) => void;
  onClose: () => void;
}

const SORT_OPTIONS: {value: SortOrder; label: string; icon: string}[] = [
  {value: 'date_desc', label: 'Newest first', icon: 'sort-calendar-descending'},
  {value: 'date_asc', label: 'Oldest first', icon: 'sort-calendar-ascending'},
  {value: 'size_desc', label: 'Largest first', icon: 'sort-numeric-descending'},
  {value: 'size_asc', label: 'Smallest first', icon: 'sort-numeric-ascending'},
  {value: 'name_asc', label: 'Name (A–Z)', icon: 'sort-alphabetical-ascending'},
  {value: 'name_desc', label: 'Name (Z–A)', icon: 'sort-alphabetical-descending'},
];

const SIZE_OPTIONS: {value: SizeBucket; label: string}[] = [
  {value: 'all', label: 'All sizes'},
  {value: 'large', label: 'Large (>10MB)'},
  {value: 'medium', label: 'Medium (1–10MB)'},
  {value: 'small', label: 'Small (<1MB)'},
];

const FORMAT_OPTIONS: {value: ImageFormat; label: string}[] = [
  {value: 'all', label: 'All'},
  {value: 'jpeg', label: 'JPEG'},
  {value: 'png', label: 'PNG'},
  {value: 'webp', label: 'WebP'},
  {value: 'heic', label: 'HEIC'},
  {value: 'gif', label: 'GIF'},
  {value: 'bmp', label: 'BMP'},
  {value: 'tiff', label: 'TIFF'},
];

const VIDEO_FORMAT_OPTIONS: {value: VideoFormat; label: string}[] = [
  {value: 'all', label: 'All'},
  {value: 'mp4', label: 'MP4'},
  {value: 'mov', label: 'MOV'},
  {value: 'mkv', label: 'MKV'},
  {value: 'webm', label: 'WebM'},
  {value: '3gp', label: '3GP'},
  {value: 'avi', label: 'AVI'},
];

const RESOLUTION_OPTIONS: {value: VideoResolution; label: string}[] = [
  {value: 'all', label: 'All'},
  {value: '4k', label: '4K'},
  {value: '1080p', label: '1080p'},
  {value: '720p', label: '720p'},
  {value: 'sd', label: 'SD'},
];

export default function SortFilterSheet({
  visible,
  type,
  sortOrder,
  filter,
  onChangeSort,
  onChangeFilter,
  onClose,
}: Props) {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();

  const handleReset = () => {
    onChangeSort(DEFAULT_SORT);
    onChangeFilter(DEFAULT_FILTER);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          entering={FadeInUp.springify().damping(18)}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              paddingBottom: insets.bottom + 16,
              ...theme.elevation.xl,
            },
          ]}>
          {/* Grabber */}
          <View
            style={[styles.grabber, {backgroundColor: theme.colors.border}]}
          />

          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[theme.typography.titleLarge, {color: theme.colors.text}]}>
              Sort & Filter
            </Text>
            <TouchableOpacity onPress={handleReset} hitSlop={8}>
              <Text
                style={[
                  theme.typography.labelLarge,
                  {color: theme.colors.primary},
                ]}>
                Reset
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scroll}>
            {/* Sort */}
            <Text
              style={[
                theme.typography.labelLarge,
                styles.sectionTitle,
                {color: theme.colors.textSecondary},
              ]}>
              SORT BY
            </Text>
            {SORT_OPTIONS.map(opt => {
              const active = sortOrder === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.sortRow,
                    {
                      backgroundColor: active
                        ? theme.colors.primaryContainer
                        : 'transparent',
                    },
                  ]}
                  onPress={() => onChangeSort(opt.value)}
                  activeOpacity={0.7}>
                  <Icon
                    name={opt.icon}
                    size={20}
                    color={
                      active ? theme.colors.primary : theme.colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      theme.typography.bodyMedium,
                      {
                        flex: 1,
                        color: active ? theme.colors.primary : theme.colors.text,
                        fontWeight: active ? '700' : '500',
                      },
                    ]}>
                    {opt.label}
                  </Text>
                  {active && (
                    <Icon name="check" size={18} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Size filter */}
            <Text
              style={[
                theme.typography.labelLarge,
                styles.sectionTitle,
                {color: theme.colors.textSecondary, marginTop: 20},
              ]}>
              FILE SIZE
            </Text>
            <View style={styles.chipWrap}>
              {SIZE_OPTIONS.map(opt => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  active={filter.size === opt.value}
                  onPress={() =>
                    onChangeFilter({...filter, size: opt.value})
                  }
                />
              ))}
            </View>

            {/* Type-specific filter */}
            {type === 'image' ? (
              <>
                <Text
                  style={[
                    theme.typography.labelLarge,
                    styles.sectionTitle,
                    {color: theme.colors.textSecondary, marginTop: 20},
                  ]}>
                  FORMAT
                </Text>
                <View style={styles.chipWrap}>
                  {FORMAT_OPTIONS.map(opt => (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      active={filter.format === opt.value}
                      onPress={() =>
                        onChangeFilter({...filter, format: opt.value})
                      }
                    />
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text
                  style={[
                    theme.typography.labelLarge,
                    styles.sectionTitle,
                    {color: theme.colors.textSecondary, marginTop: 20},
                  ]}>
                  VIDEO FORMAT
                </Text>
                <View style={styles.chipWrap}>
                  {VIDEO_FORMAT_OPTIONS.map(opt => (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      active={filter.videoFormat === opt.value}
                      onPress={() =>
                        onChangeFilter({...filter, videoFormat: opt.value})
                      }
                    />
                  ))}
                </View>

                <Text
                  style={[
                    theme.typography.labelLarge,
                    styles.sectionTitle,
                    {color: theme.colors.textSecondary, marginTop: 20},
                  ]}>
                  RESOLUTION
                </Text>
                <View style={styles.chipWrap}>
                  {RESOLUTION_OPTIONS.map(opt => (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      active={filter.resolution === opt.value}
                      onPress={() =>
                        onChangeFilter({...filter, resolution: opt.value})
                      }
                    />
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          {/* Done */}
          <TouchableOpacity
            style={[styles.doneBtn, {backgroundColor: theme.colors.primary}]}
            onPress={onClose}
            activeOpacity={0.85}>
            <Text
              style={[theme.typography.titleSmall, {color: 'white'}]}>
              Show results
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const {theme} = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.chip,
        {
          backgroundColor: active
            ? theme.colors.primary
            : theme.colors.surfaceVariant,
          borderColor: active ? theme.colors.primary : theme.colors.border,
        },
      ]}>
      <Text
        style={[
          theme.typography.labelMedium,
          {
            color: active ? 'white' : theme.colors.text,
            fontWeight: active ? '700' : '500',
          },
        ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '85%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scroll: {
    flexGrow: 0,
  },
  sectionTitle: {
    letterSpacing: 0.8,
    marginBottom: 8,
    fontSize: 12,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  doneBtn: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
});
