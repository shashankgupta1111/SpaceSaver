import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Image,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery} from '@tanstack/react-query';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import {request, PERMISSIONS, RESULTS} from 'react-native-permissions';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList} from '../../app/navigation/types';
import {StorageService} from '../../shared/services/StorageService';
import EmptyState from '../../shared/components/EmptyState';
import AnimatedButton from '../../shared/components/AnimatedButton';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const COLUMNS = 2;
const ITEM_WIDTH = (SCREEN_WIDTH - 40 - 8) / COLUMNS;
const ITEM_HEIGHT = ITEM_WIDTH * 0.65;

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function VideoTile({
  video,
  isSelected,
  onToggle,
  index,
}: {
  video: any;
  isSelected: boolean;
  onToggle: (uri: string) => void;
  index: number;
}) {
  const {theme} = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 30).springify()}
      style={[styles.tile, {backgroundColor: theme.colors.surfaceVariant}]}>
      <TouchableOpacity
        onPress={() => onToggle(video.node.image.uri)}
        activeOpacity={0.9}
        style={styles.tileTouchable}>
        <Image
          source={{uri: video.node.image.uri}}
          style={styles.tileThumb}
          resizeMode="cover"
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
}

export default function VideosScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());

  const {data: videos, isLoading, refetch} = useQuery({
    queryKey: ['videos'],
    queryFn: async () => {
      const perm = await request(PERMISSIONS.ANDROID.READ_MEDIA_VIDEO);
      if (perm !== RESULTS.GRANTED) {throw new Error('Permission denied');}
      const result = await CameraRoll.getPhotos({
        first: 200,
        assetType: 'Videos',
        include: ['fileSize', 'filename', 'imageSize', 'playableDuration'],
      });
      return result.edges;
    },
    retry: false,
  });

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
        <View>
          <Text
            style={[theme.typography.titleLarge, {color: theme.colors.text}]}>
            Videos
          </Text>
          {videos && (
            <Text
              style={[
                theme.typography.bodySmall,
                {color: theme.colors.textSecondary},
              ]}>
              {videos.length} videos
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
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
      {!isLoading && (videos?.length ?? 0) === 0 ? (
        <EmptyState
          type="videos"
          title="No Videos Found"
          description="Grant permission to browse and compress your videos."
          actionLabel="Refresh"
          onAction={refetch}
        />
      ) : (
        <FlatList
          data={videos ?? []}
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
              index={index}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      {selectedUris.size > 0 && (
        <Animated.View
          entering={FadeInDown.springify()}
          style={[styles.fab, {bottom: insets.bottom + 76}]}>
          <AnimatedButton
            onPress={handleCompress}
            variant="primary"
            gradient
            size="lg"
            fullWidth>
            <Icon name="zip-box" size={20} color="white" />
            <Text style={[theme.typography.titleSmall, {color: 'white'}]}>
              Compress {selectedUris.size} Video{selectedUris.size > 1 ? 's' : ''}
            </Text>
          </AnimatedButton>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerActions: {flexDirection: 'row', gap: 8},
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  fab: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
});
