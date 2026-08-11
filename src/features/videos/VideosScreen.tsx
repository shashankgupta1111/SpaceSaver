import React, {useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Image,
  TextInput,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {FadeIn, FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useInfiniteQuery, useQueryClient} from '@tanstack/react-query';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import {request, PERMISSIONS, RESULTS} from 'react-native-permissions';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList} from '../../app/navigation/types';
import {StorageService} from '../../shared/services/StorageService';
import EmptyState from '../../shared/components/EmptyState';
import AnimatedButton from '../../shared/components/AnimatedButton';
import Loader from '../../shared/components/Loader';
import SortFilterSheet from '../../shared/components/SortFilterSheet';
import MediaPreviewModal, {
  MediaPreviewItem,
} from '../../shared/components/MediaPreviewModal';
import {
  SortOrder,
  MediaFilter,
  DEFAULT_FILTER,
  DEFAULT_SORT,
  isFilterActive,
  sortAndFilter,
} from '../../shared/utils/mediaSortFilter';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const COLUMNS = 2;
const ITEM_WIDTH = (SCREEN_WIDTH - 40 - 8) / COLUMNS;
const ITEM_HEIGHT = ITEM_WIDTH * 0.65;
const PAGE_SIZE = 40;

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const VideoTile = React.memo(function VideoTile({
  video,
  isSelected,
  onToggle,
  onPreview,
}: {
  video: any;
  isSelected: boolean;
  onToggle: (uri: string) => void;
  onPreview: () => void;
}) {
  const {theme} = useTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={[styles.tile, {backgroundColor: theme.colors.surfaceVariant}]}>
      <TouchableOpacity
        onPress={onPreview}
        onLongPress={() => onToggle(video.node.image.uri)}
        delayLongPress={280}
        activeOpacity={0.9}
        style={styles.tileTouchable}>
        <Image
          source={{uri: video.node.image.uri}}
          style={styles.tileThumb}
          resizeMode="cover"
          resizeMethod="resize"
        />
        {isSelected && (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {backgroundColor: 'rgba(91,95,239,0.4)', borderRadius: 14},
            ]}
          />
        )}

        {/* Play overlay */}
        <View style={styles.playOverlay}>
          <View
            style={[
              styles.playBtn,
              {
                backgroundColor: isSelected
                  ? theme.colors.primary
                  : 'rgba(0,0,0,0.55)',
              },
            ]}>
            {isSelected ? (
              <Icon name="check" size={16} color="white" />
            ) : (
              <Icon name="play" size={16} color="white" />
            )}
          </View>
        </View>

        {/* Duration */}
        <View style={styles.durationBadge}>
          <Icon name="clock-outline" size={10} color="white" />
          <Text style={styles.durationText}>
            {formatDuration(video.node.image.playableDuration ?? 0)}
          </Text>
        </View>

        {/* Resolution badge */}
        {video.node.image.height > 1440 && (
          <View
            style={[styles.resBadge, {backgroundColor: theme.colors.primary}]}>
            <Text style={styles.resText}>4K</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Info bar */}
      <View style={[styles.tileInfo, {backgroundColor: theme.colors.surface}]}>
        <Text
          style={[theme.typography.labelSmall, {color: theme.colors.text}]}
          numberOfLines={1}>
          {video.node.image.filename ?? 'Video'}
        </Text>
        <Text
          style={[
            theme.typography.bodySmall,
            {color: theme.colors.textSecondary, fontSize: 10},
          ]}>
          {StorageService.formatBytesShort(video.node.image.fileSize ?? 0)} ·{' '}
          {video.node.image.width}×{video.node.image.height}
        </Text>
      </View>
    </Animated.View>
  );
});

export default function VideosScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();

  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT);
  const [filter, setFilter] = useState<MediaFilter>(DEFAULT_FILTER);
  const [showSearch, setShowSearch] = useState(false);
  const [showSortFilter, setShowSortFilter] = useState(false);

  const {
    data,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['videos'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({pageParam}) => {
      if (!pageParam) {
        const perm = await request(PERMISSIONS.ANDROID.READ_MEDIA_VIDEO);
        if (perm !== RESULTS.GRANTED) {throw new Error('Permission denied');}
      }
      return CameraRoll.getPhotos({
        first: PAGE_SIZE,
        after: pageParam,
        assetType: 'Videos',
        include: ['fileSize', 'filename', 'imageSize', 'playableDuration'],
      });
    },
    getNextPageParam: last =>
      last.page_info.has_next_page ? last.page_info.end_cursor : undefined,
    retry: false,
  });

  const videos = useMemo(
    () => data?.pages.flatMap(p => p.edges) ?? [],
    [data],
  );

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const toggleSelection = useCallback((uri: string) => {
    setSelectedUris(prev => {
      const next = new Set(prev);
      if (next.has(uri)) {next.delete(uri);}
      else {next.add(uri);}
      return next;
    });
  }, []);

  const handleCompress = () => {
    if (selectedUris.size === 0) {return;}
    navigation.navigate('VideoCompression', {
      selectedUris: Array.from(selectedUris),
    });
  };

  const sortedVideos = sortAndFilter(videos ?? [], {
    type: 'video',
    searchQuery,
    sortOrder,
    filter,
  });

  const previewItems: MediaPreviewItem[] = useMemo(
    () =>
      sortedVideos.map(v => ({
        uri: v.node.image.uri,
        type: 'video' as const,
        filename: v.node.image.filename ?? undefined,
        fileSize: v.node.image.fileSize ?? undefined,
        width: v.node.image.width ?? undefined,
        height: v.node.image.height ?? undefined,
        playableDuration: v.node.image.playableDuration ?? undefined,
      })),
    [sortedVideos],
  );

  const handleDeleted = useCallback(
    (uri: string) => {
      setSelectedUris(prev => {
        const next = new Set(prev);
        next.delete(uri);
        return next;
      });
      queryClient.invalidateQueries({queryKey: ['videos']});
    },
    [queryClient],
  );

  const filterActive = isFilterActive(filter);

  const totalSize = videos
    ? Array.from(selectedUris).reduce((acc, uri) => {
        const found = videos.find(v => v.node.image.uri === uri);
        return acc + (found?.node.image.fileSize ?? 0);
      }, 0)
    : 0;

  return (
    <View style={[styles.root, {backgroundColor: theme.colors.background}]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {paddingTop: insets.top + 8, backgroundColor: theme.colors.background},
        ]}>
        {showSearch ? (
          <View style={[styles.searchBar, {backgroundColor: theme.colors.inputBackground}]}>
            <Icon name="magnify" size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[
                styles.searchInput,
                {color: theme.colors.text, ...theme.typography.bodyMedium},
              ]}
              placeholder="Search videos..."
              placeholderTextColor={theme.colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            <TouchableOpacity
              onPress={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}>
              <Icon name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerTop}>
            <View>
              <Text
                style={[theme.typography.titleLarge, {color: theme.colors.text}]}>
                Videos
              </Text>
              {videos.length > 0 && (
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: theme.colors.textSecondary},
                  ]}>
                  {filterActive || searchQuery
                    ? `${sortedVideos.length} of ${videos.length} videos`
                    : `${videos.length}${hasNextPage ? '+' : ''} videos`}
                </Text>
              )}
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.iconBtn, {backgroundColor: theme.colors.surfaceVariant}]}
                onPress={() => setShowSearch(true)}>
                <Icon name="magnify" size={20} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, {backgroundColor: theme.colors.surfaceVariant}]}
                onPress={() => setShowSortFilter(true)}>
                <Icon name="tune-variant" size={20} color={theme.colors.text} />
                {filterActive && (
                  <View
                    style={[
                      styles.filterDot,
                      {
                        backgroundColor: theme.colors.primary,
                        borderColor: theme.colors.background,
                      },
                    ]}
                  />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, {backgroundColor: theme.colors.surfaceVariant}]}
                onPress={() => {
                  if (selectedUris.size === (videos?.length ?? 0)) {
                    setSelectedUris(new Set());
                  } else {
                    setSelectedUris(new Set(videos?.map(v => v.node.image.uri) ?? []));
                  }
                }}>
                <Icon
                  name="checkbox-multiple-blank-outline"
                  size={20}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Selection bar */}
      {selectedUris.size > 0 && (
        <Animated.View
          entering={FadeInDown.springify()}
          style={[
            styles.selectionBar,
            {backgroundColor: theme.colors.primaryContainer},
          ]}>
          <Text
            style={[theme.typography.labelLarge, {color: theme.colors.primary}]}>
            {selectedUris.size} selected · {StorageService.formatBytes(totalSize)}
          </Text>
          <TouchableOpacity onPress={() => setSelectedUris(new Set())}>
            <Text
              style={[theme.typography.labelLarge, {color: theme.colors.primary}]}>
              Clear
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Grid */}
      {isLoading ? (
        <Loader fullscreen label="Loading your videos…" />
      ) : sortedVideos.length === 0 ? (
        <EmptyState
          type="videos"
          title="No Videos Found"
          description="Grant permission to browse and compress your videos."
          actionLabel="Refresh"
          onAction={refetch}
        />
      ) : (
        <FlatList
          data={sortedVideos}
          numColumns={COLUMNS}
          keyExtractor={item => item.node.image.uri}
          contentContainerStyle={[
            styles.grid,
            {paddingBottom: insets.bottom + 100},
          ]}
          columnWrapperStyle={{gap: 8}}
          ItemSeparatorComponent={() => <View style={{height: 8}} />}
          renderItem={({item, index}) => (
            <VideoTile
              video={item}
              isSelected={selectedUris.has(item.node.image.uri)}
              onToggle={toggleSelection}
              onPreview={() => setPreviewIndex(index)}
            />
          )}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <Loader size={28} strokeWidth={3} />
              </View>
            ) : null
          }
        />
      )}

      {/* Floating dual-action selection bar */}
      {selectedUris.size > 0 && (
        <Animated.View
          entering={FadeInDown.springify()}
          style={[
            styles.fabBarContainer,
            {
              bottom: insets.bottom + 76,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}>
          <TouchableOpacity
            style={[styles.actionBtnHalf, {backgroundColor: theme.colors.primary}]}
            activeOpacity={0.85}
            onPress={handleCompress}>
            <Icon name="zip-box" size={18} color="white" />
            <Text style={[theme.typography.titleSmall, {color: 'white', fontWeight: '700'}]}>
              Compress ({selectedUris.size})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtnHalf, {backgroundColor: '#8B5CF6'}]}
            activeOpacity={0.85}
            onPress={() => {
              navigation.navigate('FormatConverter', {
                selectedUris: Array.from(selectedUris),
                mediaType: 'video',
              });
            }}>
            <Icon name="file-replace-outline" size={18} color="white" />
            <Text style={[theme.typography.titleSmall, {color: 'white', fontWeight: '700'}]}>
              Convert ({selectedUris.size})
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <SortFilterSheet
        visible={showSortFilter}
        type="video"
        sortOrder={sortOrder}
        filter={filter}
        onChangeSort={setSortOrder}
        onChangeFilter={setFilter}
        onClose={() => setShowSortFilter(false)}
      />

      <MediaPreviewModal
        visible={previewIndex !== null}
        items={previewItems}
        initialIndex={previewIndex ?? 0}
        onClose={() => setPreviewIndex(null)}
        onDeleted={handleDeleted}
        selectedUris={selectedUris}
        onToggleSelect={toggleSelection}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {flexDirection: 'row', gap: 8},
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    padding: 0,
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  grid: {paddingHorizontal: 20},
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  tile: {
    width: ITEM_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
  },
  tileTouchable: {flex: 1},
  tileThumb: {
    width: '100%',
    height: ITEM_HEIGHT,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 46,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  durationText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  resBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  tileInfo: {
    padding: 10,
    gap: 2,
  },
  fabBarContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  actionBtnHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
});
