import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList} from '../../app/navigation/types';
import {MediaService, LargeFile} from '../../shared/services/MediaService';
import {StorageService} from '../../shared/services/StorageService';
import {MediaQualityService} from '../../shared/services/MediaQualityService';
import {useAlert} from '../../shared/components/AlertProvider';
import HeaderBar from '../../shared/components/HeaderBar';
import AnimatedButton from '../../shared/components/AnimatedButton';
import EmptyState from '../../shared/components/EmptyState';
import Loader from '../../shared/components/Loader';
import {VideoThumbnail} from '../../shared/components/VideoThumbnail';
import MediaPreviewModal, {
  MediaPreviewItem,
} from '../../shared/components/MediaPreviewModal';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TOP_N = 20;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function LargeFilesScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const alert = useAlert();
  const queryClient = useQueryClient();

  const [permission, setPermission] = useState<'checking' | 'granted' | 'denied'>(
    'checking',
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState<'image' | 'video' | null>(
    null,
  );
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    MediaService.ensureMediaPermission().then(ok => {
      if (alive) {
        setPermission(ok ? 'granted' : 'denied');
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const {data: files = [], isLoading} = useQuery({
    queryKey: ['largestMedia', TOP_N],
    queryFn: () => MediaService.getLargestMedia(TOP_N),
    enabled: permission === 'granted',
    staleTime: 60_000,
  });

  const totalSize = files.reduce((s: number, f: LargeFile) => s + f.fileSize, 0);

  // Selection is single-type — switching type starts a fresh selection so the
  // compress shortcut can route to the correct (image/video) screen.
  const toggle = useCallback(
    (file: LargeFile) => {
      if (selected.has(file.uri)) {
        const next = new Set(selected);
        next.delete(file.uri);
        setSelected(next);
        if (next.size === 0) {
          setSelectedType(null);
        }
        return;
      }
      if (selectedType && selectedType !== file.type) {
        setSelected(new Set([file.uri]));
        setSelectedType(file.type);
        return;
      }
      const next = new Set(selected);
      next.add(file.uri);
      setSelected(next);
      setSelectedType(file.type);
    },
    [selected, selectedType],
  );

  const handleCompress = () => {
    const uris = Array.from(selected);
    if (uris.length === 0 || !selectedType) {
      return;
    }
    if (selectedType === 'image') {
      navigation.navigate('ImageCompression', {selectedUris: uris});
    } else {
      navigation.navigate('VideoCompression', {selectedUris: uris});
    }
  };

  const selectedBytes = useMemo(() => {
    return files
      .filter((f: LargeFile) => selected.has(f.uri))
      .reduce((s: number, f: LargeFile) => s + f.fileSize, 0);
  }, [files, selected]);

  const previewItems: MediaPreviewItem[] = useMemo(
    () =>
      files.map((f: LargeFile) => ({
        uri: f.uri,
        type: f.type,
        filename: f.filename,
        fileSize: f.fileSize,
        width: f.width,
        height: f.height,
        playableDuration: f.playableDuration,
      })),
    [files],
  );

  const handleDelete = () => {
    const uris = Array.from(selected);
    if (uris.length === 0) {
      return;
    }
    setDeleting(true);
    MediaService.requestDeleteWithConsent(uris, {
      title: `Delete ${uris.length} large file${uris.length > 1 ? 's' : ''}?`,
      message: `Frees ${StorageService.formatBytes(
        selectedBytes,
      )}. Android will ask you to confirm deletion.`,
      alert,
      onSuccess: () => {
        setSelected(new Set());
        setSelectedType(null);
        setDeleting(false);
        queryClient.invalidateQueries({queryKey: ['largestMedia', TOP_N]});
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

  const handlePreviewDeleted = useCallback(
    (uri: string) => {
      setSelected(prev => {
        const next = new Set(prev);
        next.delete(uri);
        if (next.size === 0) {
          setSelectedType(null);
        }
        return next;
      });
      queryClient.invalidateQueries({queryKey: ['largestMedia', TOP_N]});
    },
    [queryClient],
  );

  const selectedCount = selected.size;

  return (
    <View
      style={[
        styles.root,
        {backgroundColor: theme.colors.background, paddingTop: insets.top},
      ]}>
      <HeaderBar title="Largest Files" showBack />

      {permission === 'denied' ? (
        <EmptyState
          type="images"
          title="Permission needed"
          description="Grant photo & video access to see which files are eating your storage."
          actionLabel="Grant access"
          onAction={() =>
            MediaService.ensureMediaPermission().then(ok =>
              setPermission(ok ? 'granted' : 'denied'),
            )
          }
        />
      ) : isLoading || permission === 'checking' ? (
        <Loader fullscreen label="Finding your biggest files…" />
      ) : (
        <>
          {/* Summary */}
          <View style={styles.summary}>
            <Text
              style={[theme.typography.bodyMedium, {color: theme.colors.textSecondary}]}>
              Top {files.length} files use{' '}
              <Text style={{color: theme.colors.primary, fontWeight: '700'}}>
                {StorageService.formatBytes(totalSize)}
              </Text>
            </Text>
            <Text
              style={[theme.typography.bodySmall, {color: theme.colors.textTertiary}]}>
              Tap to preview · long-press to select
            </Text>
          </View>

          <FlatList
            data={files}
            keyExtractor={item => item.uri}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom:
                (selectedCount > 0 ? 96 : 24) + insets.bottom,
            }}
            showsVerticalScrollIndicator={false}
            renderItem={({item, index}) => (
              <LargeRow
                file={item}
                rank={index + 1}
                selected={selected.has(item.uri)}
                dimmed={selectedType !== null && selectedType !== item.type}
                onPress={() => setPreviewIndex(index)}
                onLongPress={() => toggle(item)}
              />
            )}
          />

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
              <Text
                style={[
                  theme.typography.labelLarge,
                  {color: theme.colors.text, marginBottom: 8},
                ]}>
                {selectedCount} selected · {StorageService.formatBytes(selectedBytes)}
              </Text>
              <View style={styles.footerActions}>
                <AnimatedButton
                  onPress={handleCompress}
                  variant="primary"
                  gradient
                  size="md"
                  style={{flex: 1}}>
                  <Icon name="zip-box" size={18} color="white" />
                  <Text style={[theme.typography.titleSmall, {color: 'white'}]}>
                    Compress
                  </Text>
                </AnimatedButton>
                <AnimatedButton
                  onPress={handleDelete}
                  variant="danger"
                  size="md"
                  loading={deleting}
                  style={{flex: 1}}>
                  <Icon name="trash-can-outline" size={18} color="white" />
                  <Text style={[theme.typography.titleSmall, {color: 'white'}]}>
                    Delete
                  </Text>
                </AnimatedButton>
              </View>
            </Animated.View>
          )}
        </>
      )}

      <MediaPreviewModal
        visible={previewIndex !== null}
        items={previewItems}
        initialIndex={previewIndex ?? 0}
        onClose={() => setPreviewIndex(null)}
        onDeleted={handlePreviewDeleted}
        selectedUris={selected}
        onToggleSelect={uri => {
          const file = files.find((f: LargeFile) => f.uri === uri);
          if (file) {
            toggle(file);
          }
        }}
      />
    </View>
  );
}

function LargeRow({
  file,
  rank,
  selected,
  dimmed,
  onPress,
  onLongPress,
}: {
  file: LargeFile;
  rank: number;
  selected: boolean;
  dimmed: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const {theme} = useTheme();
  const meta =
    file.type === 'video'
      ? `Video · ${formatDuration(file.playableDuration ?? 0)}`
      : `Photo · ${file.width}×${file.height}`;

  const analysis = useMemo(() => MediaQualityService.analyzeMedia(file), [file]);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(rank, 12) * 30).springify()}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={280}
        style={[
          styles.row,
          {
            backgroundColor: selected
              ? theme.colors.primaryContainer
              : theme.colors.surface,
            opacity: dimmed ? 0.45 : 1,
            ...theme.elevation.sm,
          },
        ]}>
        <View>
          {file.type === 'video' ? (
            <VideoThumbnail
              videoUri={file.uri}
              style={styles.thumb}
              resizeMode="cover"
            />
          ) : (
            <Image
              source={{uri: file.uri}}
              style={styles.thumb}
              resizeMode="cover"
              resizeMethod="resize"
            />
          )}
          {file.type === 'video' && (
            <View style={styles.playPill}>
              <Icon name="play" size={11} color="white" />
            </View>
          )}
          <View style={[styles.rankBadge, {backgroundColor: theme.colors.text}]}>
            <Text style={[styles.rankText, {color: theme.colors.background}]}>
              {rank}
            </Text>
          </View>
        </View>

        <View style={styles.info}>
          <Text
            style={[theme.typography.bodyMedium, {color: theme.colors.text}]}
            numberOfLines={1}>
            {file.filename}
          </Text>
          <Text
            style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
            {meta}
          </Text>

          {/* Contextual Recommendation Badge */}
          {analysis.estimatedSavingsBytes > 10 * 1024 * 1024 ? (
            <View style={[styles.recBadge, {backgroundColor: theme.colors.successContainer}]}>
              <Icon name="lightning-bolt" size={11} color={theme.colors.success} />
              <Text
                style={[theme.typography.labelSmall, {color: theme.colors.success, fontWeight: '700', fontSize: 10}]}
                numberOfLines={1}>
                {analysis.recommendedAction} · Save ~{StorageService.formatBytes(analysis.estimatedSavingsBytes)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.right}>
          <Text
            style={[
              theme.typography.titleSmall,
              {color: theme.colors.text, fontWeight: '700'},
            ]}>
            {StorageService.formatBytes(file.fileSize)}
          </Text>
          <View
            style={[
              styles.check,
              selected
                ? {backgroundColor: theme.colors.primary, borderColor: theme.colors.primary}
                : {borderColor: theme.colors.border},
            ]}>
            {selected && <Icon name="check" size={13} color="white" />}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  summary: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 16,
    marginBottom: 10,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  playPill: {
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
  rankBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 11,
    fontWeight: '800',
  },
  info: {flex: 1, gap: 2},
  right: {
    alignItems: 'flex-end',
    gap: 8,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    left: 20,
    right: 20,
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
  footerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
});
