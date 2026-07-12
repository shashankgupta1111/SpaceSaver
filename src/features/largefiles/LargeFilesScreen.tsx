import React, {useCallback, useEffect, useState} from 'react';
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
import {useQuery} from '@tanstack/react-query';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList} from '../../app/navigation/types';
import {MediaService, LargeFile} from '../../shared/services/MediaService';
import {StorageService} from '../../shared/services/StorageService';
import HeaderBar from '../../shared/components/HeaderBar';
import AnimatedButton from '../../shared/components/AnimatedButton';
import EmptyState from '../../shared/components/EmptyState';
import Loader from '../../shared/components/Loader';

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

  const [permission, setPermission] = useState<'checking' | 'granted' | 'denied'>(
    'checking',
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState<'image' | 'video' | null>(
    null,
  );

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
              Tap to select · compress to shrink them
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
                onPress={() => toggle(item)}
              />
            )}
          />

          {selectedCount > 0 && (
            <Animated.View
              entering={FadeInDown.springify()}
              style={[styles.fab, {bottom: insets.bottom + 16}]}>
              <AnimatedButton
                onPress={handleCompress}
                variant="primary"
                gradient
                size="lg"
                fullWidth>
                <Icon name="zip-box" size={20} color="white" />
                <Text style={[theme.typography.titleSmall, {color: 'white'}]}>
                  Compress {selectedCount}{' '}
                  {selectedType === 'video' ? 'Video' : 'Photo'}
                  {selectedCount > 1 ? 's' : ''}
                </Text>
              </AnimatedButton>
            </Animated.View>
          )}
        </>
      )}
    </View>
  );
}

function LargeRow({
  file,
  rank,
  selected,
  dimmed,
  onPress,
}: {
  file: LargeFile;
  rank: number;
  selected: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  const {theme} = useTheme();
  const meta =
    file.type === 'video'
      ? `Video · ${formatDuration(file.playableDuration ?? 0)}`
      : `Photo · ${file.width}×${file.height}`;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(rank, 12) * 30).springify()}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
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
          <Image
            source={{uri: file.uri}}
            style={styles.thumb}
            resizeMode="cover"
            resizeMethod="resize"
          />
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
});
