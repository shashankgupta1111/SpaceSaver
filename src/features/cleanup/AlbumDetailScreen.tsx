import React, {useCallback, useMemo, useState} from 'react';
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
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList} from '../../app/navigation/types';
import {MediaService, LargeFile} from '../../shared/services/MediaService';
import {DuplicateService} from '../../shared/services/DuplicateService';
import {StorageService} from '../../shared/services/StorageService';
import {useAlert} from '../../shared/components/AlertProvider';
import HeaderBar from '../../shared/components/HeaderBar';
import AnimatedButton from '../../shared/components/AnimatedButton';
import Loader from '../../shared/components/Loader';
import MediaPreviewModal, {
  MediaPreviewItem,
} from '../../shared/components/MediaPreviewModal';

type Route = RouteProp<RootStackParamList, 'AlbumDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const COLUMNS = 3;
const GAP = 3;
const ITEM = (SCREEN_WIDTH - 40 - (COLUMNS - 1) * GAP) / COLUMNS;

export default function AlbumDetailScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const alert = useAlert();
  const queryClient = useQueryClient();
  const {albumTitle} = route.params;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const {data: media = [], isLoading} = useQuery({
    queryKey: ['albumMedia', albumTitle],
    queryFn: () => MediaService.getAlbumMedia(albumTitle),
    staleTime: 30_000,
  });

  const byUri = useMemo(() => {
    const m = new Map<string, LargeFile>();
    media.forEach((f: LargeFile) => m.set(f.uri, f));
    return m;
  }, [media]);

  const selectedFiles = useMemo(
    () => Array.from(selected).map(u => byUri.get(u)).filter(Boolean) as LargeFile[],
    [selected, byUri],
  );
  const selectedBytes = selectedFiles.reduce((s, f) => s + f.fileSize, 0);
  const allImages = selectedFiles.length > 0 && selectedFiles.every(f => f.type === 'image');
  const allVideos = selectedFiles.length > 0 && selectedFiles.every(f => f.type === 'video');

  const toggle = useCallback((uri: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(uri)) {next.delete(uri);} else {next.add(uri);}
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(prev =>
      prev.size === media.length
        ? new Set()
        : new Set(media.map((f: LargeFile) => f.uri)),
    );
  }, [media]);

  const handleDelete = () => {
    const uris = Array.from(selected);
    if (uris.length === 0) {return;}
    alert({
      title: `Delete ${uris.length} item${uris.length > 1 ? 's' : ''}?`,
      message: `Frees ${StorageService.formatBytes(
        selectedBytes,
      )}. Android will ask you to confirm removal.`,
      type: 'warning',
      icon: 'trash-can-outline',
      buttons: [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await DuplicateService.deletePhotos(uris);
              setSelected(new Set());
              queryClient.invalidateQueries({queryKey: ['albumMedia', albumTitle]});
              queryClient.invalidateQueries({queryKey: ['albums']});
              queryClient.invalidateQueries({queryKey: ['largestMedia', 20]});
            } catch {
              alert({
                title: 'Delete failed',
                message: 'Some items could not be removed.',
                type: 'error',
              });
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
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

  const canCompress = allImages || allVideos;
  const selectedCount = selected.size;

  const previewItems: MediaPreviewItem[] = useMemo(
    () =>
      media.map((f: LargeFile) => ({
        uri: f.uri,
        type: f.type,
        filename: f.filename,
        fileSize: f.fileSize,
        width: f.width,
        height: f.height,
        playableDuration: f.playableDuration,
      })),
    [media],
  );

  const handlePreviewDeleted = useCallback(
    (uri: string) => {
      setSelected(prev => {
        const next = new Set(prev);
        next.delete(uri);
        return next;
      });
      queryClient.invalidateQueries({queryKey: ['albumMedia', albumTitle]});
      queryClient.invalidateQueries({queryKey: ['albums']});
      queryClient.invalidateQueries({queryKey: ['largestMedia', 20]});
    },
    [queryClient, albumTitle],
  );

  return (
    <View
      style={[
        styles.root,
        {backgroundColor: theme.colors.background, paddingTop: insets.top},
      ]}>
      <HeaderBar
        title={albumTitle}
        showBack
        rightActions={
          media.length > 0 ? (
            <TouchableOpacity
              onPress={selectAll}
              style={[styles.selectAllBtn, {backgroundColor: theme.colors.surfaceVariant}]}
              hitSlop={8}>
              <Icon
                name={
                  selected.size === media.length && media.length > 0
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
        <Loader fullscreen label="Loading album…" />
      ) : (
        <>
          <Text
            style={[
              theme.typography.bodySmall,
              {color: theme.colors.textSecondary, paddingHorizontal: 20, paddingBottom: 8},
            ]}>
            {media.length} items ·{' '}
            {StorageService.formatBytes(
              media.reduce((s: number, f: LargeFile) => s + f.fileSize, 0),
            )}
          </Text>
          <FlatList
            data={media}
            numColumns={COLUMNS}
            keyExtractor={item => item.uri}
            columnWrapperStyle={{gap: GAP}}
            ItemSeparatorComponent={() => <View style={{height: GAP}} />}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: (selectedCount > 0 ? 96 : 24) + insets.bottom,
            }}
            showsVerticalScrollIndicator={false}
            renderItem={({item, index}) => (
              <Tile
                file={item}
                index={index}
                selected={selected.has(item.uri)}
                onPress={() => setPreviewIndex(index)}
                onLongPress={() => toggle(item.uri)}
              />
            )}
          />
        </>
      )}

      {selectedCount > 0 && (
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
          <Text style={[theme.typography.labelLarge, {color: theme.colors.text, marginBottom: 8}]}>
            {selectedCount} selected · {StorageService.formatBytes(selectedBytes)}
          </Text>
          <View style={styles.actions}>
            {canCompress && (
              <AnimatedButton onPress={handleCompress} variant="outline" size="md" style={{flex: 1}}>
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
        onToggleSelect={toggle}
      />
    </View>
  );
}

function Tile({
  file,
  index,
  selected,
  onPress,
  onLongPress,
}: {
  file: LargeFile;
  index: number;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const {theme} = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 12) * 15).springify()}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={280}
        style={styles.tile}>
        <Image
          source={{uri: file.uri}}
          style={styles.tileImg}
          resizeMode="cover"
          resizeMethod="resize"
        />
        {selected && (
          <View style={[styles.tileOverlay, {backgroundColor: 'rgba(91,95,239,0.5)'}]} />
        )}
        {file.type === 'video' && (
          <View style={styles.videoPill}>
            <Icon name="play" size={10} color="white" />
          </View>
        )}
        <View
          style={[
            styles.check,
            selected
              ? {backgroundColor: theme.colors.primary, borderColor: 'white'}
              : {backgroundColor: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.8)'},
          ]}>
          {selected && <Icon name="check" size={12} color="white" />}
        </View>
        <View style={styles.sizeTag}>
          <Text style={styles.sizeText}>{StorageService.formatBytesShort(file.fileSize)}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  tile: {
    width: ITEM,
    height: ITEM,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tileImg: {width: '100%', height: '100%'},
  tileOverlay: {...StyleSheet.absoluteFillObject},
  videoPill: {
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
  check: {
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  sizeText: {color: 'white', fontSize: 9, fontWeight: '600'},
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 0.5,
  },
  actions: {flexDirection: 'row', gap: 10},
  selectAllBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
