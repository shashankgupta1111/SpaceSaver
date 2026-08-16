import React, {useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {CameraRoll, PhotoIdentifier} from '@react-native-camera-roll/camera-roll';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList} from '../../app/navigation/types';
import {MediaService, LargeFile} from '../../shared/services/MediaService';
import {StorageService} from '../../shared/services/StorageService';
import {useAlert} from '../../shared/components/AlertProvider';
import HeaderBar from '../../shared/components/HeaderBar';
import Card from '../../shared/components/Card';
import AnimatedButton from '../../shared/components/AnimatedButton';
import Loader from '../../shared/components/Loader';
import EmptyState from '../../shared/components/EmptyState';
import {VideoThumbnail} from '../../shared/components/VideoThumbnail';
import MediaPreviewModal, {
  MediaPreviewItem,
} from '../../shared/components/MediaPreviewModal';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const COLUMNS = 3;
const GAP = 3;
const TILE_SIZE = (SCREEN_WIDTH - 40 - (COLUMNS - 1) * GAP) / COLUMNS;

type AgeThresholdDays = 30 | 90 | 180 | 365;
type MediaTypeFilter = 'all' | 'photos' | 'videos';
type SortOrder = 'date_asc' | 'date_desc' | 'size_desc';

const THRESHOLD_OPTIONS: Array<{label: string; days: AgeThresholdDays}> = [
  {label: '30+ Days', days: 30},
  {label: '90+ Days', days: 90},
  {label: '6+ Months', days: 180},
  {label: '1+ Year', days: 365},
];

export default function OldMediaScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const alert = useAlert();
  const queryClient = useQueryClient();

  const [thresholdDays, setThresholdDays] = useState<AgeThresholdDays>(90);
  const [typeFilter, setTypeFilter] = useState<MediaTypeFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('date_asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Fetch media from CameraRoll
  const {data: allMedia = [], isLoading} = useQuery({
    queryKey: ['oldMediaAll'],
    queryFn: async () => {
      const [photosRes, videosRes] = await Promise.all([
        CameraRoll.getPhotos({
          first: 1000,
          assetType: 'Photos',
          include: ['fileSize', 'filename', 'imageSize'],
        }).catch(() => ({edges: [] as PhotoIdentifier[]})),
        CameraRoll.getPhotos({
          first: 500,
          assetType: 'Videos',
          include: ['fileSize', 'filename', 'imageSize', 'playableDuration'],
        }).catch(() => ({edges: [] as PhotoIdentifier[]})),
      ]);

      const toFile = (e: PhotoIdentifier, type: 'image' | 'video'): LargeFile => {
        const img = e.node.image;
        const uriFilename = img.uri ? img.uri.split('/').pop()?.split('?')[0] : null;
        const filename = img.filename || uriFilename || (type === 'image' ? 'Photo' : 'Video');
        return {
          uri: img.uri,
          type,
          filename,
          fileSize: img.fileSize ?? 0,
          width: img.width ?? 0,
          height: img.height ?? 0,
          playableDuration: img.playableDuration ?? undefined,
          timestamp: e.node.timestamp ?? 0,
        };
      };

      const combined: LargeFile[] = [
        ...photosRes.edges.map(e => toFile(e, 'image')),
        ...videosRes.edges.map(e => toFile(e, 'video')),
      ];

      return combined;
    },
    staleTime: 60_000,
  });

  // Filter and sort media based on age threshold and selected filters
  const filteredMedia = useMemo(() => {
    const now = Date.now();
    const thresholdMs = thresholdDays * 86400 * 1000;

    const filtered = allMedia.filter((file: LargeFile) => {
      const fileMs = file.timestamp > 1e11 ? file.timestamp : file.timestamp * 1000;
      const ageMs = now - fileMs;

      if (ageMs < thresholdMs) {
        return false;
      }

      if (typeFilter === 'photos' && file.type !== 'image') {
        return false;
      }
      if (typeFilter === 'videos' && file.type !== 'video') {
        return false;
      }

      return true;
    });

    switch (sortOrder) {
      case 'date_asc':
        // Oldest first
        return filtered.sort((a: LargeFile, b: LargeFile) => a.timestamp - b.timestamp);
      case 'date_desc':
        // Newest of the old files first
        return filtered.sort((a: LargeFile, b: LargeFile) => b.timestamp - a.timestamp);
      case 'size_desc':
        return filtered.sort((a: LargeFile, b: LargeFile) => b.fileSize - a.fileSize);
      default:
        return filtered;
    }
  }, [allMedia, thresholdDays, typeFilter, sortOrder]);

  // Statistics for breakdown
  const stats = useMemo(() => {
    const now = Date.now();
    const thresholdMs = thresholdDays * 86400 * 1000;

    const olderThanThreshold = allMedia.filter((file: LargeFile) => {
      const fileMs = file.timestamp > 1e11 ? file.timestamp : file.timestamp * 1000;
      return now - fileMs >= thresholdMs;
    });

    const photos = olderThanThreshold.filter((f: LargeFile) => f.type === 'image');
    const videos = olderThanThreshold.filter((f: LargeFile) => f.type === 'video');

    const totalBytes = olderThanThreshold.reduce((acc: number, f: LargeFile) => acc + f.fileSize, 0);
    const photosBytes = photos.reduce((acc: number, f: LargeFile) => acc + f.fileSize, 0);
    const videosBytes = videos.reduce((acc: number, f: LargeFile) => acc + f.fileSize, 0);

    return {
      totalCount: olderThanThreshold.length,
      totalBytes,
      photosCount: photos.length,
      photosBytes,
      videosCount: videos.length,
      videosBytes,
    };
  }, [allMedia, thresholdDays]);

  const byUri = useMemo(() => {
    const m = new Map<string, LargeFile>();
    filteredMedia.forEach((f: LargeFile) => m.set(f.uri, f));
    return m;
  }, [filteredMedia]);

  const selectedFiles = useMemo(
    () => Array.from(selected).map(u => byUri.get(u)).filter(Boolean) as LargeFile[],
    [selected, byUri],
  );
  const selectedBytes = selectedFiles.reduce((s, f) => s + f.fileSize, 0);
  const allImages = selectedFiles.length > 0 && selectedFiles.every(f => f.type === 'image');
  const allVideos = selectedFiles.length > 0 && selectedFiles.every(f => f.type === 'video');

  const toggleSelect = useCallback((uri: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(prev =>
      prev.size === filteredMedia.length
        ? new Set()
        : new Set(filteredMedia.map((f: LargeFile) => f.uri)),
    );
  }, [filteredMedia]);

  const handleDelete = () => {
    const uris = Array.from(selected);
    if (uris.length === 0) return;

    setDeleting(true);
    MediaService.requestDeleteWithConsent(uris, {
      title: `Delete ${uris.length} older file${uris.length > 1 ? 's' : ''}?`,
      message: `Frees ${StorageService.formatBytes(
        selectedBytes,
      )}. Android will ask you to confirm deletion.`,
      alert,
      onSuccess: () => {
        setSelected(new Set());
        setDeleting(false);
        queryClient.invalidateQueries({queryKey: ['oldMediaAll']});
        queryClient.invalidateQueries({queryKey: ['smartCleanupSummary']});
      },
      onError: () => {
        setDeleting(false);
        alert({
          title: 'Delete Cancelled',
          message: 'Deletion was cancelled or some files could not be removed.',
          type: 'info',
        });
      },
    });
  };

  const handleCompress = () => {
    const uris = Array.from(selected);
    if (allImages) {
      navigation.navigate('ImageCompression', {selectedUris: uris});
    } else if (allVideos) {
      navigation.navigate('VideoCompression', {selectedUris: uris});
    }
  };

  const previewItems: MediaPreviewItem[] = useMemo(
    () =>
      filteredMedia.map((f: LargeFile) => ({
        uri: f.uri,
        type: f.type,
        filename: f.filename,
        fileSize: f.fileSize,
        width: f.width,
        height: f.height,
        playableDuration: f.playableDuration,
      })),
    [filteredMedia],
  );

  const handlePreviewDeleted = useCallback(
    (uri: string) => {
      setSelected(prev => {
        const next = new Set(prev);
        next.delete(uri);
        return next;
      });
      queryClient.invalidateQueries({queryKey: ['oldMediaAll']});
      queryClient.invalidateQueries({queryKey: ['smartCleanupSummary']});
    },
    [queryClient],
  );

  return (
    <View
      style={[
        styles.root,
        {backgroundColor: theme.colors.background, paddingTop: insets.top},
      ]}>
      <HeaderBar
        title="Older Media"
        subtitle="Review files not modified recently"
        showBack
        rightActions={
          filteredMedia.length > 0 ? (
            <TouchableOpacity
              onPress={selectAll}
              style={[styles.actionIconBtn, {backgroundColor: theme.colors.surfaceVariant}]}
              hitSlop={8}>
              <Icon
                name={
                  selected.size === filteredMedia.length && filteredMedia.length > 0
                    ? 'select-all'
                    : 'checkbox-multiple-blank-outline'
                }
                size={20}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {isLoading ? (
        <Loader fullscreen label="Finding older media files…" />
      ) : (
        <View style={styles.container}>
          {/* Summary Breakdown Card */}
          <Animated.View entering={FadeInDown.delay(50).springify()}>
            <Card style={styles.summaryCard} padding={16}>
              <View style={styles.summaryTopRow}>
                <View style={styles.summaryLeft}>
                  <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary}]}>
                    MEDIA OLDER THAN {thresholdDays >= 365 ? '1 YEAR' : thresholdDays >= 180 ? '6 MONTHS' : `${thresholdDays} DAYS`}
                  </Text>
                  <Text style={[theme.typography.headlineSmall, {color: theme.colors.text, fontWeight: '800', marginTop: 2}]}>
                    {StorageService.formatBytes(stats.totalBytes)}
                  </Text>
                  <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
                    {stats.totalCount} older files available for review
                  </Text>
                </View>
                <View style={[styles.summaryIconBox, {backgroundColor: theme.colors.primaryContainer}]}>
                  <Icon name="clock-outline" size={26} color={theme.colors.primary} />
                </View>
              </View>

              <View style={[styles.breakdownRow, {borderTopColor: theme.colors.borderLight}]}>
                <View style={styles.breakdownCol}>
                  <View style={styles.badgeRow}>
                    <Icon name="image-outline" size={14} color="#10B981" />
                    <Text style={[theme.typography.labelSmall, {color: theme.colors.text}]}>Photos</Text>
                  </View>
                  <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700', marginTop: 2}]}>
                    {StorageService.formatBytes(stats.photosBytes)}
                  </Text>
                  <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary, fontSize: 11}]}>
                    {stats.photosCount} photos
                  </Text>
                </View>

                <View style={[styles.colDivider, {backgroundColor: theme.colors.borderLight}]} />

                <View style={styles.breakdownCol}>
                  <View style={styles.badgeRow}>
                    <Icon name="video-outline" size={14} color="#7C4DFF" />
                    <Text style={[theme.typography.labelSmall, {color: theme.colors.text}]}>Videos</Text>
                  </View>
                  <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700', marginTop: 2}]}>
                    {StorageService.formatBytes(stats.videosBytes)}
                  </Text>
                  <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary, fontSize: 11}]}>
                    {stats.videosCount} videos
                  </Text>
                </View>
              </View>
            </Card>
          </Animated.View>

          {/* Age Filters */}
          <View style={styles.filtersSection}>
            <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary, marginBottom: 8}]}>
              OLDER THAN
            </Text>
            <View style={styles.chipsRow}>
              {THRESHOLD_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.days}
                  activeOpacity={0.8}
                  style={[
                    styles.filterChip,
                    thresholdDays === opt.days
                      ? {backgroundColor: theme.colors.primary}
                      : {backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border, borderWidth: 1},
                  ]}
                  onPress={() => setThresholdDays(opt.days)}>
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: thresholdDays === opt.days ? 'white' : theme.colors.text,
                        fontWeight: thresholdDays === opt.days ? '700' : '500',
                      },
                    ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Type & Sort toggles */}
            <View style={styles.subFiltersRow}>
              <View style={styles.segmentedType}>
                {(['all', 'photos', 'videos'] as MediaTypeFilter[]).map(t => (
                  <TouchableOpacity
                    key={t}
                    activeOpacity={0.8}
                    style={[
                      styles.segmentItem,
                      typeFilter === t && {backgroundColor: theme.colors.surface, ...theme.elevation.sm},
                    ]}
                    onPress={() => setTypeFilter(t)}>
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color: typeFilter === t ? theme.colors.primary : theme.colors.textSecondary,
                          fontWeight: typeFilter === t ? '700' : '500',
                        },
                      ]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.sortBtn, {backgroundColor: theme.colors.surfaceVariant}]}
                onPress={() => {
                  setSortOrder(current => {
                    if (current === 'date_asc') return 'date_desc';
                    if (current === 'date_desc') return 'size_desc';
                    return 'date_asc';
                  });
                }}>
                <Icon
                  name={
                    sortOrder === 'size_desc'
                      ? 'sort-numeric-descending'
                      : sortOrder === 'date_asc'
                      ? 'sort-clock-ascending-outline'
                      : 'sort-clock-descending-outline'
                  }
                  size={16}
                  color={theme.colors.text}
                />
                <Text style={[styles.sortBtnText, {color: theme.colors.text}]}>
                  {sortOrder === 'size_desc' ? 'Size' : sortOrder === 'date_asc' ? 'Oldest' : 'Recent'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Media Grid */}
          {filteredMedia.length === 0 ? (
            <EmptyState
              type="images"
              title="No Files Found"
              description={`No media older than ${thresholdDays} days was found for the selected filter.`}
            />
          ) : (
            <FlatList
              data={filteredMedia}
              numColumns={COLUMNS}
              keyExtractor={item => item.uri}
              columnWrapperStyle={{gap: GAP}}
              ItemSeparatorComponent={() => <View style={{height: GAP}} />}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: (selected.size > 0 ? 110 : 30) + insets.bottom,
              }}
              showsVerticalScrollIndicator={false}
              renderItem={({item, index}) => {
                const isSel = selected.has(item.uri);
                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setPreviewIndex(index)}
                    onLongPress={() => toggleSelect(item.uri)}
                    delayLongPress={260}
                    style={styles.gridTile}>
                    {item.type === 'video' ? (
                      <VideoThumbnail
                        videoUri={item.uri}
                        style={styles.tileImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Image
                        source={{uri: item.uri}}
                        style={styles.tileImage}
                        resizeMode="cover"
                        resizeMethod="resize"
                      />
                    )}
                    {isSel && (
                      <View style={[styles.tileOverlay, {backgroundColor: 'rgba(91,95,239,0.45)'}]} />
                    )}
                    {item.type === 'video' && (
                      <View style={styles.videoBadge}>
                        <Icon name="play" size={10} color="white" />
                      </View>
                    )}
                    <TouchableOpacity
                      style={[
                        styles.checkBadge,
                        isSel
                          ? {backgroundColor: theme.colors.primary, borderColor: 'white'}
                          : {backgroundColor: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.8)'},
                      ]}
                      onPress={() => toggleSelect(item.uri)}>
                      {isSel && <Icon name="check" size={12} color="white" />}
                    </TouchableOpacity>
                    <View style={styles.sizeTag}>
                      <Text style={styles.sizeText}>
                        {StorageService.formatBytesShort(item.fileSize)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* Floating Action Footer when items are selected */}
      {selected.size > 0 && (
        <Animated.View
          entering={FadeInDown.springify()}
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + 12,
              backgroundColor: theme.colors.background,
              borderTopColor: theme.colors.borderLight,
            },
          ]}>
          <View style={styles.footerHeaderRow}>
            <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
              {selected.size} selected · {StorageService.formatBytes(selectedBytes)}
            </Text>
            <TouchableOpacity onPress={() => setSelected(new Set())}>
              <Text style={[theme.typography.labelSmall, {color: theme.colors.primary, fontWeight: '700'}]}>
                Deselect All
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.footerActions}>
            {(allImages || allVideos) && (
              <AnimatedButton
                onPress={handleCompress}
                variant="outline"
                size="md"
                style={{flex: 1}}>
                <Icon name="zip-box" size={18} color={theme.colors.primary} />
                <Text style={[theme.typography.titleSmall, {color: theme.colors.primary}]}>
                  Compress
                </Text>
              </AnimatedButton>
            )}
            <AnimatedButton
              onPress={handleDelete}
              variant="danger"
              size="md"
              loading={deleting}
              style={{flex: 1}}>
              <Icon name="trash-can-outline" size={18} color="white" />
              <Text style={[theme.typography.titleSmall, {color: 'white'}]}>Delete</Text>
            </AnimatedButton>
          </View>
        </Animated.View>
      )}

      <MediaPreviewModal
        visible={previewIndex !== null}
        items={previewItems}
        initialIndex={previewIndex ?? 0}
        onClose={() => setPreviewIndex(null)}
        onDeleted={handlePreviewDeleted}
        selectedUris={selected}
        onToggleSelect={toggleSelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  container: {flex: 1},
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 20,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLeft: {
    flex: 1,
  },
  summaryIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  breakdownCol: {
    flex: 1,
    alignItems: 'center',
  },
  colDivider: {
    width: 1,
    height: 36,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filtersSection: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  chipText: {
    fontSize: 12,
  },
  subFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  segmentedType: {
    flexDirection: 'row',
    backgroundColor: 'rgba(150,150,150,0.1)',
    borderRadius: 10,
    padding: 3,
    flex: 1,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
  },
  segmentText: {
    fontSize: 11,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  sortBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  gridTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  videoBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  sizeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 0.5,
  },
  footerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
