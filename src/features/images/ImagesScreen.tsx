import React, {useState, useCallback, useRef} from 'react';
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
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery} from '@tanstack/react-query';
import {CameraRoll, PhotoIdentifier} from '@react-native-camera-roll/camera-roll';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList} from '../../app/navigation/types';
import EmptyState from '../../shared/components/EmptyState';
import AnimatedButton from '../../shared/components/AnimatedButton';
import SortFilterSheet from '../../shared/components/SortFilterSheet';
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
const ITEM_SIZE = (SCREEN_WIDTH - 40 - (COLUMNS - 1) * 3) / COLUMNS;

type Nav = NativeStackNavigationProp<RootStackParamList>;

function ImageTile({
  photo,
  isSelected,
  onToggle,
  index,
}: {
  photo: PhotoIdentifier;
  isSelected: boolean;
  onToggle: (uri: string) => void;
  index: number;
}) {
  const {theme} = useTheme();
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSpring(0.95, {damping: 20, stiffness: 300}, () => {
      scale.value = withSpring(1);
    });
    onToggle(photo.node.image.uri);
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 20).springify()}
      style={[styles.tile, animStyle]}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.9}
        style={styles.tileTouchable}>
        <Image
          source={{uri: photo.node.image.uri}}
          style={[styles.tileImage]}
          resizeMode="cover"
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
}

export default function ImagesScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT);
  const [filter, setFilter] = useState<MediaFilter>(DEFAULT_FILTER);
  const [showSearch, setShowSearch] = useState(false);
  const [showSortFilter, setShowSortFilter] = useState(false);

  const {data: photos, isLoading, refetch} = useQuery({
    queryKey: ['images'],
    queryFn: async () => {
      const perm = await request(
        PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
      );
      if (perm !== RESULTS.GRANTED) {
        throw new Error('Permission denied');
      }
      const result = await CameraRoll.getPhotos({
        first: 500,
        assetType: 'Photos',
        include: ['fileSize', 'filename', 'imageSize'],
      });
      return result.edges;
    },
    retry: false,
  });

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
              {photos && (
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: theme.colors.textSecondary},
                  ]}>
                  {filterActive || searchQuery
                    ? `${sortedPhotos.length} of ${photos.length} photos`
                    : `${photos.length} photos`}
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
      {!isLoading && sortedPhotos.length === 0 ? (
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
          columnWrapperStyle={{gap: 3}}
          ItemSeparatorComponent={() => <View style={{height: 3}} />}
          renderItem={({item, index}) => (
            <ImageTile
              photo={item}
              isSelected={selectedUris.has(item.node.image.uri)}
              onToggle={toggleSelection}
              index={index}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating compress button */}
      {selectedCount > 0 && (
        <Animated.View
          entering={FadeInDown.springify()}
          style={[
            styles.fab,
            {bottom: insets.bottom + 76},
          ]}>
          <AnimatedButton
            onPress={handleCompress}
            variant="primary"
            gradient
            size="lg"
            style={styles.fabButton}>
            <Icon name="zip-box" size={20} color="white" />
            <Text
              style={[theme.typography.titleSmall, {color: 'white'}]}>
              Compress {selectedCount} Image{selectedCount > 1 ? 's' : ''}
            </Text>
          </AnimatedButton>
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
