import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  SectionList,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList} from '../../app/navigation/types';
import {MediaService, LargeFile, MediaAlbum} from '../../shared/services/MediaService';
import {StorageService} from '../../shared/services/StorageService';
import {useAlert} from '../../shared/components/AlertProvider';
import HeaderBar from '../../shared/components/HeaderBar';
import AnimatedButton from '../../shared/components/AnimatedButton';
import Loader from '../../shared/components/Loader';
import EmptyState from '../../shared/components/EmptyState';
import MediaPreviewModal, {
  MediaPreviewItem,
} from '../../shared/components/MediaPreviewModal';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const COLUMNS = 3;
const GAP = 3;
const TILE_SIZE = (SCREEN_WIDTH - 40 - (COLUMNS - 1) * GAP) / COLUMNS;

type SortOption = 'date_desc' | 'date_asc' | 'size_desc' | 'size_asc';

interface ScreenshotGroup {
  title: string;
  subtitle: string;
  data: LargeFile[];
}

export default function ScreenshotManagerScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const alert = useAlert();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Discover screenshot album
  const {data: albums = []} = useQuery({
    queryKey: ['albums'],
    queryFn: () => MediaService.getAlbums(),
    staleTime: 60_000,
  });

  const screenshotAlbumTitle = useMemo(() => {
    const found = albums.find((a: MediaAlbum) => {
      const t = a.title.toLowerCase();
      return (
        t.includes('screenshot') ||
        t.includes('screen capture') ||
        t.includes('captures') ||
        t.includes('screen shots')
      );
    });
    return found ? found.title : 'Screenshots';
  }, [albums]);

  const {data: screenshots = [], isLoading} = useQuery({
    queryKey: ['screenshotMedia', screenshotAlbumTitle],
    queryFn: async () => {
      // Find all albums matching screenshot naming
      const matchingAlbums = albums.filter((a: MediaAlbum) => {
        const t = a.title.toLowerCase();
        return (
          t.includes('screenshot') ||
          t.includes('screen capture') ||
          t.includes('captures') ||
          t.includes('screen shots')
        );
      });

      if (matchingAlbums.length === 0) {
        return MediaService.getAlbumMedia('Screenshots', 500);
      }

      const allResults = await Promise.all(
        matchingAlbums.map((a: MediaAlbum) => MediaService.getAlbumMedia(a.title, 500)),
      );

      // Flatten and deduplicate by uri
      const seen = new Set<string>();
      const combined: LargeFile[] = [];
      for (const batch of allResults) {
        for (const file of batch) {
          if (!seen.has(file.uri)) {
            seen.add(file.uri);
            combined.push(file);
          }
        }
      }
      return combined;
    },
    staleTime: 30_000,
  });

  // Sorted screenshots
  const sortedScreenshots = useMemo(() => {
    const copy = [...screenshots];
    switch (sortOption) {
      case 'date_desc':
        return copy.sort((a, b) => b.timestamp - a.timestamp);
      case 'date_asc':
        return copy.sort((a, b) => a.timestamp - b.timestamp);
      case 'size_desc':
        return copy.sort((a, b) => b.fileSize - a.fileSize);
      case 'size_asc':
        return copy.sort((a, b) => a.fileSize - b.fileSize);
      default:
        return copy;
    }
  }, [screenshots, sortOption]);

  // Group screenshots by age periods
  const groups: ScreenshotGroup[] = useMemo(() => {
    const now = Date.now();
    const DAY_MS = 86400 * 1000;

    const today: LargeFile[] = [];
    const thisWeek: LargeFile[] = [];
    const thisMonth: LargeFile[] = [];
    const older30Days: LargeFile[] = [];
    const older6Months: LargeFile[] = [];
    const older1Year: LargeFile[] = [];

    sortedScreenshots.forEach(file => {
      // CameraRoll timestamp is in seconds on Android or ms
      const fileMs = file.timestamp > 1e11 ? file.timestamp : file.timestamp * 1000;
      const ageDays = (now - fileMs) / DAY_MS;

      if (ageDays < 1) {
        today.push(file);
      } else if (ageDays < 7) {
        thisWeek.push(file);
      } else if (ageDays < 30) {
        thisMonth.push(file);
      } else if (ageDays < 180) {
        older30Days.push(file);
      } else if (ageDays < 365) {
        older6Months.push(file);
      } else {
        older1Year.push(file);
      }
    });

    const result: ScreenshotGroup[] = [];
    if (today.length > 0) {
      result.push({title: 'Today', subtitle: `${today.length} items`, data: today});
    }
    if (thisWeek.length > 0) {
      result.push({title: 'This Week', subtitle: `${thisWeek.length} items`, data: thisWeek});
    }
    if (thisMonth.length > 0) {
      result.push({title: 'This Month', subtitle: `${thisMonth.length} items`, data: thisMonth});
    }
    if (older30Days.length > 0) {
      result.push({title: '30+ Days Old', subtitle: `${older30Days.length} items`, data: older30Days});
    }
    if (older6Months.length > 0) {
      result.push({title: '6+ Months Old', subtitle: `${older6Months.length} items`, data: older6Months});
    }
    if (older1Year.length > 0) {
      result.push({title: '1+ Year Old', subtitle: `${older1Year.length} items`, data: older1Year});
    }
    return result;
  }, [sortedScreenshots]);

  const totalBytes = useMemo(
    () => screenshots.reduce((acc: number, f: LargeFile) => acc + f.fileSize, 0),
    [screenshots],
  );

  const byUri = useMemo(() => {
    const m = new Map<string, LargeFile>();
    screenshots.forEach((f: LargeFile) => m.set(f.uri, f));
    return m;
  }, [screenshots]);

  const selectedFiles = useMemo(
    () => Array.from(selected).map(u => byUri.get(u)).filter(Boolean) as LargeFile[],
    [selected, byUri],
  );
  const selectedBytes = selectedFiles.reduce((s, f) => s + f.fileSize, 0);

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
      prev.size === screenshots.length
        ? new Set()
        : new Set(screenshots.map((f: LargeFile) => f.uri)),
    );
  }, [screenshots]);

  const selectGroup = useCallback((groupFiles: LargeFile[]) => {
    setSelected(prev => {
      const next = new Set(prev);
      const allInGroupSelected = groupFiles.every((f: LargeFile) => prev.has(f.uri));
      if (allInGroupSelected) {
        groupFiles.forEach((f: LargeFile) => next.delete(f.uri));
      } else {
        groupFiles.forEach((f: LargeFile) => next.add(f.uri));
      }
      return next;
    });
  }, []);

  const handleDelete = () => {
    const uris = Array.from(selected);
    if (uris.length === 0) return;

    setDeleting(true);
    MediaService.requestDeleteWithConsent(uris, {
      title: `Delete ${uris.length} screenshot${uris.length > 1 ? 's' : ''}?`,
      message: `Frees ${StorageService.formatBytes(
        selectedBytes,
      )}. Android will ask you to confirm deletion.`,
      alert,
      onSuccess: () => {
        setSelected(new Set());
        setDeleting(false);
        queryClient.invalidateQueries({queryKey: ['screenshotMedia']});
        queryClient.invalidateQueries({queryKey: ['albums']});
        queryClient.invalidateQueries({queryKey: ['smartCleanupSummary']});
      },
      onError: () => {
        setDeleting(false);
        alert({
          title: 'Delete Cancelled',
          message: 'Deletion was cancelled or some screenshots could not be removed.',
          type: 'info',
        });
      },
    });
  };

  const handleCompress = () => {
    const uris = Array.from(selected);
    if (uris.length > 0) {
      navigation.navigate('ImageCompression', {selectedUris: uris});
    }
  };

  const previewItems: MediaPreviewItem[] = useMemo(
    () =>
      sortedScreenshots.map(f => ({
        uri: f.uri,
        type: 'image',
        filename: f.filename,
        fileSize: f.fileSize,
        width: f.width,
        height: f.height,
      })),
    [sortedScreenshots],
  );

  const handlePreviewDeleted = useCallback(
    (uri: string) => {
      setSelected(prev => {
        const next = new Set(prev);
        next.delete(uri);
        return next;
      });
      queryClient.invalidateQueries({queryKey: ['screenshotMedia']});
      queryClient.invalidateQueries({queryKey: ['albums']});
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
        title="Screenshots"
        subtitle={`${screenshots.length} items · ${StorageService.formatBytes(totalBytes)}`}
        showBack
        rightActions={
          screenshots.length > 0 ? (
            <View style={styles.headerRightActions}>
              <TouchableOpacity
                onPress={() => setViewMode(v => (v === 'grid' ? 'list' : 'grid'))}
                style={[styles.actionIconBtn, {backgroundColor: theme.colors.surfaceVariant}]}
                hitSlop={8}>
                <Icon
                  name={viewMode === 'grid' ? 'view-list' : 'view-grid'}
                  size={20}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={selectAll}
                style={[styles.actionIconBtn, {backgroundColor: theme.colors.surfaceVariant}]}
                hitSlop={8}>
                <Icon
                  name={
                    selected.size === screenshots.length && screenshots.length > 0
                      ? 'select-all'
                      : 'checkbox-multiple-blank-outline'
                  }
                  size={20}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
            </View>
          ) : undefined
        }
      />

      {isLoading ? (
        <Loader fullscreen label="Analyzing screenshot albums…" />
      ) : screenshots.length === 0 ? (
        <EmptyState
          type="images"
          title="No Screenshots Found"
          description="Your device doesn't have any detected screenshot albums or captures."
        />
      ) : (
        <View style={styles.container}>
          {/* Summary & Controls Bar */}
          <View style={styles.controlsBar}>
            <View style={styles.sortToggleRow}>
              <TouchableOpacity
                style={[
                  styles.sortChip,
                  sortOption === 'date_desc' && {backgroundColor: theme.colors.primary},
                ]}
                onPress={() => setSortOption('date_desc')}>
                <Text
                  style={[
                    styles.sortChipText,
                    {color: sortOption === 'date_desc' ? 'white' : theme.colors.textSecondary},
                  ]}>
                  Newest
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sortChip,
                  sortOption === 'date_asc' && {backgroundColor: theme.colors.primary},
                ]}
                onPress={() => setSortOption('date_asc')}>
                <Text
                  style={[
                    styles.sortChipText,
                    {color: sortOption === 'date_asc' ? 'white' : theme.colors.textSecondary},
                  ]}>
                  Oldest
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sortChip,
                  sortOption === 'size_desc' && {backgroundColor: theme.colors.primary},
                ]}
                onPress={() => setSortOption('size_desc')}>
                <Text
                  style={[
                    styles.sortChipText,
                    {color: sortOption === 'size_desc' ? 'white' : theme.colors.textSecondary},
                  ]}>
                  Largest
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Groups List */}
          <FlatList
            data={groups}
            keyExtractor={item => item.title}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: (selected.size > 0 ? 110 : 30) + insets.bottom,
            }}
            renderItem={({item: group}) => {
              const allInGroupSelected = group.data.every(f => selected.has(f.uri));
              return (
                <View style={styles.groupSection}>
                  <View style={styles.groupHeaderRow}>
                    <View style={styles.groupTitleContainer}>
                      <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
                        {group.title}
                      </Text>
                      <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
                        {group.subtitle} ·{' '}
                        {StorageService.formatBytes(
                          group.data.reduce((sum, f) => sum + f.fileSize, 0),
                        )}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => selectGroup(group.data)}
                      style={[styles.groupSelectBtn, {backgroundColor: theme.colors.surfaceVariant}]}>
                      <Text
                        style={[
                          theme.typography.labelSmall,
                          {color: allInGroupSelected ? theme.colors.primary : theme.colors.textSecondary, fontWeight: '700'},
                        ]}>
                        {allInGroupSelected ? 'Deselect Group' : 'Select Group'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {viewMode === 'grid' ? (
                    <View style={styles.tilesGrid}>
                      {group.data.map(file => {
                        const isSel = selected.has(file.uri);
                        const globalIndex = sortedScreenshots.findIndex(f => f.uri === file.uri);
                        return (
                          <TouchableOpacity
                            key={file.uri}
                            activeOpacity={0.85}
                            onPress={() => setPreviewIndex(globalIndex)}
                            onLongPress={() => toggleSelect(file.uri)}
                            delayLongPress={260}
                            style={styles.gridTile}>
                            <Image
                              source={{uri: file.uri}}
                              style={styles.tileImage}
                              resizeMode="cover"
                              resizeMethod="resize"
                            />
                            {isSel && (
                              <View style={[styles.tileOverlay, {backgroundColor: 'rgba(91,95,239,0.45)'}]} />
                            )}
                            <TouchableOpacity
                              style={[
                                styles.checkBadge,
                                isSel
                                  ? {backgroundColor: theme.colors.primary, borderColor: 'white'}
                                  : {backgroundColor: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.8)'},
                              ]}
                              onPress={() => toggleSelect(file.uri)}>
                              {isSel && <Icon name="check" size={12} color="white" />}
                            </TouchableOpacity>
                            <View style={styles.sizeTag}>
                              <Text style={styles.sizeText}>
                                {StorageService.formatBytesShort(file.fileSize)}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.listContainer}>
                      {group.data.map(file => {
                        const isSel = selected.has(file.uri);
                        const globalIndex = sortedScreenshots.findIndex(f => f.uri === file.uri);
                        return (
                          <TouchableOpacity
                            key={file.uri}
                            activeOpacity={0.85}
                            onPress={() => setPreviewIndex(globalIndex)}
                            style={[
                              styles.listRow,
                              {
                                backgroundColor: isSel
                                  ? `${theme.colors.primary}12`
                                  : theme.colors.surface,
                                borderColor: isSel ? theme.colors.primary : theme.colors.borderLight,
                              },
                            ]}>
                            <Image
                              source={{uri: file.uri}}
                              style={styles.listThumb}
                              resizeMode="cover"
                              resizeMethod="resize"
                            />
                            <View style={styles.listInfo}>
                              <Text
                                style={[theme.typography.titleSmall, {color: theme.colors.text}]}
                                numberOfLines={1}>
                                {file.filename}
                              </Text>
                              <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
                                {StorageService.formatBytes(file.fileSize)} · {file.width}×{file.height}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[
                                styles.listCheck,
                                isSel
                                  ? {backgroundColor: theme.colors.primary, borderColor: theme.colors.primary}
                                  : {borderColor: theme.colors.border},
                              ]}
                              onPress={() => toggleSelect(file.uri)}>
                              {isSel && <Icon name="check" size={14} color="white" />}
                            </TouchableOpacity>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            }}
          />
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsBar: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sortToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(150,150,150,0.1)',
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  groupSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  groupTitleContainer: {
    flex: 1,
  },
  groupSelectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
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
  listContainer: {
    gap: 8,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  listThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  listInfo: {
    flex: 1,
  },
  listCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
