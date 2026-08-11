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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useInfiniteQuery, useQueryClient} from '@tanstack/react-query';
import {CameraRoll, PhotoIdentifier} from '@react-native-camera-roll/camera-roll';
import {request, PERMISSIONS, RESULTS} from 'react-native-permissions';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList} from '../../app/navigation/types';
import EmptyState from '../../shared/components/EmptyState';
import AnimatedButton from '../../shared/components/AnimatedButton';
import Loader from '../../shared/components/Loader';
import SortFilterSheet from '../../shared/components/SortFilterSheet';
import MediaPreviewModal, {
  MediaPreviewItem,
} from '../../shared/components/MediaPreviewModal';
import {StorageService} from '../../shared/services/StorageService';
import {
  SortOrder,
  MediaFilter,
  DEFAULT_FILTER,
  DEFAULT_SORT,
  isFilterActive,
  sortAndFilter,
} from '../../shared/utils/mediaSortFilter';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const COLUMNS = 3;
const GRID_GAP = 3;
const ITEM_SIZE = (SCREEN_WIDTH - 40 - (COLUMNS - 1) * GRID_GAP) / COLUMNS;
const ROW_HEIGHT = ITEM_SIZE + GRID_GAP;
const PAGE_SIZE = 60;

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ImageTile = React.memo(function ImageTile({
  photo,
  isSelected,
  onToggle,
  onPreview,
}: {
  photo: PhotoIdentifier;
  isSelected: boolean;
  onToggle: (uri: string) => void;
  onPreview: () => void;
}) {
  const {theme} = useTheme();
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSpring(0.95, {damping: 20, stiffness: 300}, () => {
      scale.value = withSpring(1);
    });
    onPreview();
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={[styles.tile, animStyle]}>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={() => onToggle(photo.node.image.uri)}
        delayLongPress={280}
        activeOpacity={0.9}
        style={styles.tileTouchable}>
        <Image
          source={{uri: photo.node.image.uri}}
          style={[styles.tileImage]}
          resizeMode="cover"
          // Downsample to the tile size during decode. Without this, Fresco can
          // decode full-res photos (a 12MP HEIC ≈ 48MB each) and scrolling the
          // grid OOM-crashes the app on devices with large/HEIC photos.
          resizeMethod="resize"
        />
        {isSelected && (
          <View
            style={[
              styles.selectedOverlay,
              {backgroundColor: 'rgba(91,95,239,0.5)'},
            ]}
          />
        )}
        <View
          style={[
            styles.checkCircle,
            isSelected
              ? {backgroundColor: theme.colors.primary, borderColor: 'white'}
              : {
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  borderColor: 'rgba(255,255,255,0.8)',
                },
          ]}>
          {isSelected && (
            <Icon name="check" size={12} color="white" />
          )}
        </View>
        <View style={styles.fileSizeLabel}>
          <Text style={styles.fileSizeText}>
            {StorageService.formatBytesShort(photo.node.image.fileSize ?? 0)}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function ImagesScreen() {
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
    queryKey: ['images'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({pageParam}) => {
      // Only prompt on the first page; later pages assume permission is held.
      if (!pageParam) {
        const perm = await request(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
        if (perm !== RESULTS.GRANTED) {
          throw new Error('Permission denied');
        }
      }
      return CameraRoll.getPhotos({
        first: PAGE_SIZE,
        after: pageParam,
        assetType: 'Photos',
        include: ['fileSize', 'filename', 'imageSize'],
      });
    },
    getNextPageParam: last =>
      last.page_info.has_next_page ? last.page_info.end_cursor : undefined,
    retry: false,
  });

  const photos = useMemo(
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
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!photos) {return;}
    if (selectedUris.size === photos.length) {
      setSelectedUris(new Set());
    } else {
      setSelectedUris(new Set(photos.map(p => p.node.image.uri)));
    }
  }, [photos, selectedUris.size]);

  const handleCompress = () => {
    if (selectedUris.size === 0) {return;}
    navigation.navigate('ImageCompression', {
      selectedUris: Array.from(selectedUris),
    });
  };

  const sortedPhotos = sortAndFilter(photos ?? [], {
    type: 'image',
    searchQuery,
    sortOrder,
    filter,
  });

  const previewItems: MediaPreviewItem[] = useMemo(
    () =>
      sortedPhotos.map(p => ({
        uri: p.node.image.uri,
        type: 'image' as const,
        filename: p.node.image.filename ?? undefined,
        fileSize: p.node.image.fileSize ?? undefined,
        width: p.node.image.width ?? undefined,
        height: p.node.image.height ?? undefined,
      })),
    [sortedPhotos],
  );

  const handleDeleted = useCallback(
    (uri: string) => {
      setSelectedUris(prev => {
        const next = new Set(prev);
        next.delete(uri);
        return next;
      });
      queryClient.invalidateQueries({queryKey: ['images']});
    },
    [queryClient],
  );

  const filterActive = isFilterActive(filter);
  const selectedCount = selectedUris.size;

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
              placeholder="Search images..."
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
                Images
              </Text>
              {photos.length > 0 && (
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: theme.colors.textSecondary},
                  ]}>
                  {filterActive || searchQuery
                    ? `${sortedPhotos.length} of ${photos.length} photos`
                    : `${photos.length}${hasNextPage ? '+' : ''} photos`}
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
                onPress={selectAll}>
                <Icon
                  name={selectedUris.size === (photos?.length ?? 0) && (photos?.length ?? 0) > 0 ? 'select-all' : 'checkbox-multiple-blank-outline'}
                  size={20}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Selection bar */}
      {selectedCount > 0 && (
        <Animated.View
          entering={FadeInDown.springify()}
          style={[
            styles.selectionBar,
            {backgroundColor: theme.colors.primaryContainer},
          ]}>
          <Text
            style={[
              theme.typography.labelLarge,
              {color: theme.colors.primary},
            ]}>
            {selectedCount} selected
          </Text>
          <TouchableOpacity onPress={() => setSelectedUris(new Set())}>
            <Text
              style={[
                theme.typography.labelLarge,
                {color: theme.colors.primary},
              ]}>
              Deselect all
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Grid */}
      {isLoading ? (
        <Loader fullscreen label="Loading your photos…" />
      ) : sortedPhotos.length === 0 ? (
        <EmptyState
          type="images"
          title="No Images Found"
          description="Grant storage permission to browse and compress your photos."
          actionLabel="Refresh"
          onAction={refetch}
        />
      ) : (
        <FlatList
          data={sortedPhotos}
          numColumns={COLUMNS}
          keyExtractor={item => item.node.image.uri}
          contentContainerStyle={[
            styles.grid,
            {paddingBottom: insets.bottom + 100},
          ]}
          columnWrapperStyle={{gap: GRID_GAP}}
          ItemSeparatorComponent={() => <View style={{height: GRID_GAP}} />}
          renderItem={({item, index}) => (
            <ImageTile
              photo={item}
              isSelected={selectedUris.has(item.node.image.uri)}
              onToggle={toggleSelection}
              onPreview={() => setPreviewIndex(index)}
            />
          )}
          showsVerticalScrollIndicator={false}
          // ---- performance ----
          getItemLayout={(_, index) => ({
            length: ROW_HEIGHT,
            offset: ROW_HEIGHT * Math.floor(index / COLUMNS),
            index,
          })}
          initialNumToRender={18}
          maxToRenderPerBatch={18}
          windowSize={7}
          removeClippedSubviews
          // ---- pagination ----
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
      {selectedCount > 0 && (
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
              Compress ({selectedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtnHalf, {backgroundColor: '#8B5CF6'}]}
            activeOpacity={0.85}
            onPress={() => {
              navigation.navigate('FormatConverter', {
                selectedUris: Array.from(selectedUris),
                mediaType: 'image',
              });
            }}>
            <Icon name="file-replace-outline" size={18} color="white" />
            <Text style={[theme.typography.titleSmall, {color: 'white', fontWeight: '700'}]}>
              Convert ({selectedCount})
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <SortFilterSheet
        visible={showSortFilter}
        type="image"
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
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
  grid: {
    paddingHorizontal: 20,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  tile: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tileTouchable: {
    flex: 1,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  checkCircle: {
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
  fileSizeLabel: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  fileSizeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  fabButton: {
    width: '100%',
    borderRadius: 20,
    ...({
      shadowColor: '#5B5FEF',
      shadowOffset: {width: 0, height: 8},
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 12,
    }),
  },
});
