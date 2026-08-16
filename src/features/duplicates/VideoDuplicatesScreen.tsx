import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQueryClient} from '@tanstack/react-query';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList} from '../../app/navigation/types';
import {
  VideoDuplicateService,
  VideoDuplicateGroup,
  VideoScanResult,
} from '../../shared/services/VideoDuplicateService';
import {MediaService, LargeFile} from '../../shared/services/MediaService';
import {StorageService} from '../../shared/services/StorageService';
import {useAlert} from '../../shared/components/AlertProvider';
import HeaderBar from '../../shared/components/HeaderBar';
import Card from '../../shared/components/Card';
import AnimatedButton from '../../shared/components/AnimatedButton';
import EmptyState from '../../shared/components/EmptyState';
import CircularProgress from '../../shared/components/CircularProgress';
import {VideoThumbnail} from '../../shared/components/VideoThumbnail';
import MediaPreviewModal, {
  MediaPreviewItem,
} from '../../shared/components/MediaPreviewModal';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoDuplicatesScreen() {
  const {theme, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const alert = useAlert();
  const queryClient = useQueryClient();

  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusText, setScanStatusText] = useState('Initializing scan...');
  const [scanResult, setScanResult] = useState<VideoScanResult | null>(null);

  // Selected URIs to delete
  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());
  const [filterTab, setFilterTab] = useState<'all' | 'exact' | 'similar'>('all');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewItems, setPreviewItems] = useState<MediaPreviewItem[]>([]);
  const [deleting, setDeleting] = useState(false);

  const runScan = useCallback(async () => {
    setScanning(true);
    setScanProgress(0);
    try {
      const res = await VideoDuplicateService.scan((done, total, msg) => {
        setScanProgress(Math.round((done / total) * 100));
        setScanStatusText(msg);
      });
      setScanResult(res);

      // Preselect non-keepers ONLY for high-confidence exact duplicates
      const initialSelected = new Set<string>();
      res.groups.forEach(g => {
        if (g.confidence === 'high') {
          g.videos.slice(1).forEach(v => initialSelected.add(v.uri));
        }
      });
      setSelectedUris(initialSelected);
    } catch {
      // Handle error gracefully
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    const cached = VideoDuplicateService.getCachedResults();
    if (cached && cached.groups.length > 0) {
      setScanResult(cached);
      const initialSelected = new Set<string>();
      cached.groups.forEach(g => {
        if (g.confidence === 'high') {
          g.videos.slice(1).forEach(v => initialSelected.add(v.uri));
        }
      });
      setSelectedUris(initialSelected);
    } else {
      runScan();
    }
  }, [runScan]);

  const filteredGroups = useMemo(() => {
    if (!scanResult) return [];
    if (filterTab === 'exact') {
      return scanResult.groups.filter(g => g.confidence === 'high');
    }
    if (filterTab === 'similar') {
      return scanResult.groups.filter(g => g.confidence !== 'high');
    }
    return scanResult.groups;
  }, [scanResult, filterTab]);

  const toggleSelect = (uri: string) => {
    setSelectedUris(prev => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  };

  const selectGroupNonKeepers = (group: VideoDuplicateGroup) => {
    setSelectedUris(prev => {
      const next = new Set(prev);
      const nonKeepers = group.videos.slice(1);
      const allSelected = nonKeepers.every(v => prev.has(v.uri));
      if (allSelected) {
        nonKeepers.forEach(v => next.delete(v.uri));
      } else {
        nonKeepers.forEach(v => next.add(v.uri));
      }
      return next;
    });
  };

  const allSelectedVideos = useMemo(() => {
    if (!scanResult) return [];
    const all = scanResult.groups.flatMap(g => g.videos);
    return all.filter(v => selectedUris.has(v.uri));
  }, [scanResult, selectedUris]);

  const selectedBytes = allSelectedVideos.reduce((sum, v) => sum + v.fileSize, 0);

  const handleDelete = () => {
    const uris = Array.from(selectedUris);
    if (uris.length === 0) return;

    setDeleting(true);
    MediaService.requestDeleteWithConsent(uris, {
      title: `Delete ${uris.length} Duplicate Video${uris.length > 1 ? 's' : ''}?`,
      message: `Frees ${StorageService.formatBytes(
        selectedBytes,
      )}. Your highest quality videos are kept. Android will confirm deletion.`,
      alert,
      onSuccess: () => {
        setSelectedUris(new Set());
        setDeleting(false);
        queryClient.invalidateQueries({queryKey: ['smartCleanupSummary']});
        runScan();
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
    const uris = Array.from(selectedUris);
    if (uris.length > 0) {
      navigation.navigate('VideoCompression', {selectedUris: uris});
    }
  };

  const openPreview = (videos: LargeFile[], initialIndex: number) => {
    const items: MediaPreviewItem[] = videos.map(v => ({
      uri: v.uri,
      type: 'video',
      filename: v.filename,
      fileSize: v.fileSize,
      width: v.width,
      height: v.height,
      playableDuration: v.playableDuration,
    }));
    setPreviewItems(items);
    setPreviewIndex(initialIndex);
  };

  if (scanning) {
    return (
      <View style={[styles.root, {backgroundColor: theme.colors.background}]}>
        <HeaderBar title="Similar Videos" showBack />
        <View style={styles.scanningContainer}>
          <CircularProgress
            progress={scanProgress}
            size={180}
            strokeWidth={14}
            sublabel={`${scanProgress}%`}
          />
          <Text
            style={[
              theme.typography.titleMedium,
              {color: theme.colors.text, marginTop: 24, fontWeight: '700'},
            ]}>
            Scanning Video Library
          </Text>
          <Text
            style={[
              theme.typography.bodyMedium,
              {color: theme.colors.textSecondary, marginTop: 6, textAlign: 'center'},
            ]}>
            {scanStatusText}
          </Text>
        </View>
      </View>
    );
  }

  const groups = filteredGroups;
  const totalReclaimable = scanResult?.totalReclaimableBytes ?? 0;

  return (
    <View style={[styles.root, {backgroundColor: theme.colors.background}]}>
      <HeaderBar
        title="Similar Videos"
        subtitle="Detect duplicate & similar video clips"
        showBack
        rightActions={
          <TouchableOpacity
            onPress={runScan}
            style={[styles.refreshBtn, {backgroundColor: theme.colors.surfaceVariant}]}>
            <Icon name="refresh" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={groups}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.listContent,
          {paddingBottom: insets.bottom + (selectedUris.size > 0 ? 110 : 32)},
        ]}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* Hero Summary Card */}
            <Card style={styles.summaryCard} padding={18}>
              <View style={styles.summaryRow}>
                <View style={[styles.summaryIconBox, {backgroundColor: `${theme.colors.primary}18`}]}>
                  <Icon name="video-vintage" size={28} color={theme.colors.primary} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary}]}>
                    POTENTIAL VIDEO RECLAIMABLE
                  </Text>
                  <Text style={[theme.typography.headlineMedium, {color: theme.colors.text, fontWeight: '800'}]}>
                    {StorageService.formatBytes(totalReclaimable)}
                  </Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary}]}>
                    Duplicate Groups
                  </Text>
                  <Text style={[theme.typography.titleMedium, {color: theme.colors.text, fontWeight: '700'}]}>
                    {scanResult?.groups.length ?? 0}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary}]}>
                    Videos Scanned
                  </Text>
                  <Text style={[theme.typography.titleMedium, {color: theme.colors.text, fontWeight: '700'}]}>
                    {scanResult?.scannedCount ?? 0}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Filter Tabs */}
            <View style={[styles.tabBar, {backgroundColor: theme.colors.surfaceVariant}]}>
              <TouchableOpacity
                style={[styles.tabBtn, filterTab === 'all' && {backgroundColor: theme.colors.surface}]}
                onPress={() => setFilterTab('all')}>
                <Text
                  style={[
                    theme.typography.labelMedium,
                    {
                      color: filterTab === 'all' ? theme.colors.primary : theme.colors.textSecondary,
                      fontWeight: filterTab === 'all' ? '700' : '500',
                    },
                  ]}>
                  All ({scanResult?.groups.length ?? 0})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, filterTab === 'exact' && {backgroundColor: theme.colors.surface}]}
                onPress={() => setFilterTab('exact')}>
                <Text
                  style={[
                    theme.typography.labelMedium,
                    {
                      color: filterTab === 'exact' ? theme.colors.primary : theme.colors.textSecondary,
                      fontWeight: filterTab === 'exact' ? '700' : '500',
                    },
                  ]}>
                  Exact ({scanResult?.groups.filter(g => g.confidence === 'high').length ?? 0})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, filterTab === 'similar' && {backgroundColor: theme.colors.surface}]}
                onPress={() => setFilterTab('similar')}>
                <Text
                  style={[
                    theme.typography.labelMedium,
                    {
                      color: filterTab === 'similar' ? theme.colors.primary : theme.colors.textSecondary,
                      fontWeight: filterTab === 'similar' ? '700' : '500',
                    },
                  ]}>
                  Similar ({scanResult?.groups.filter(g => g.confidence !== 'high').length ?? 0})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            type="videos"
            title="No Video Duplicates Found"
            description="Your video library is clean! No exact duplicate or redundant video recordings detected."
            actionLabel="Scan Again"
            onAction={runScan}
          />
        }
        renderItem={({item, index}) => {
          const confidenceColor =
            item.confidence === 'high'
              ? theme.colors.success
              : item.confidence === 'medium'
              ? theme.colors.warning
              : theme.colors.primary;

          return (
            <Animated.View entering={FadeInDown.delay(Math.min(index * 40, 300)).springify()}>
              <Card style={styles.groupCard} padding={16}>
                {/* Group Header */}
                <View style={styles.groupHeaderRow}>
                  <View>
                    <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
                      Group {index + 1} · {item.videos.length} videos
                    </Text>
                    <View style={styles.confidenceRow}>
                      <View style={[styles.confidenceDot, {backgroundColor: confidenceColor}]} />
                      <Text style={[theme.typography.labelSmall, {color: confidenceColor, fontWeight: '700'}]}>
                        {item.confidenceLabel}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.savingsBadge, {backgroundColor: theme.colors.successContainer}]}>
                    <Text style={[theme.typography.labelSmall, {color: theme.colors.success, fontWeight: '800'}]}>
                      Save ~{StorageService.formatBytes(item.reclaimableBytes)}
                    </Text>
                  </View>
                </View>

                {/* Keep Best Explanation Card */}
                <View
                  style={[
                    styles.keeperExplainCard,
                    {
                      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.08)',
                      borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.25)',
                    },
                  ]}>
                  <View style={styles.keeperExplainHeader}>
                    <Icon name="star-circle" size={16} color={theme.colors.success} />
                    <Text style={[theme.typography.labelSmall, {color: theme.colors.success, fontWeight: '800'}]}>
                      KEEPER RECOMMENDATION
                    </Text>
                  </View>
                  <Text style={[theme.typography.bodySmall, {color: theme.colors.text, fontWeight: '600', marginTop: 2}]}>
                    {item.keeperReason}
                  </Text>
                  {item.otherCopiesSummary ? (
                    <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary, marginTop: 2}]}>
                      Other versions: {item.otherCopiesSummary}
                    </Text>
                  ) : null}
                </View>

                {/* Videos in Group */}
                <View style={styles.videosList}>
                  {item.videos.map((video, vIdx) => {
                    const isKeeper = video.uri === item.keeperUri;
                    const isSelected = selectedUris.has(video.uri);
                    const resLabel =
                      video.height >= 2160
                        ? '4K'
                        : video.height >= 1080
                        ? '1080p'
                        : video.height >= 720
                        ? '720p'
                        : `${video.width}×${video.height}`;

                    return (
                      <TouchableOpacity
                        key={video.uri}
                        activeOpacity={0.85}
                        onPress={() => toggleSelect(video.uri)}
                        style={[
                          styles.videoItemRow,
                          {
                            backgroundColor: isSelected
                              ? `${theme.colors.error}14`
                              : theme.colors.surfaceVariant,
                            borderColor: isSelected ? theme.colors.error : 'transparent',
                          },
                        ]}>
                        {/* Thumbnail */}
                        <TouchableOpacity
                          onPress={() => openPreview(item.videos, vIdx)}
                          style={styles.thumbWrapper}>
                          <VideoThumbnail
                            videoUri={video.uri}
                            style={styles.videoThumb}
                            resizeMode="cover"
                          />
                          <View style={styles.playOverlay}>
                            <Icon name="play" size={16} color="#FFFFFF" />
                          </View>
                        </TouchableOpacity>

                        {/* Video Info */}
                        <View style={styles.videoInfoCol}>
                          <View style={styles.videoMetaBadges}>
                            <View style={[styles.resPill, {backgroundColor: theme.colors.primaryContainer}]}>
                              <Text style={[theme.typography.labelSmall, {color: theme.colors.primary, fontWeight: '700'}]}>
                                {resLabel}
                              </Text>
                            </View>
                            <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary}]}>
                              {formatDuration(video.playableDuration || 0)}
                            </Text>
                            {isKeeper && (
                              <View style={[styles.keeperPill, {backgroundColor: theme.colors.successContainer}]}>
                                <Text style={[theme.typography.labelSmall, {color: theme.colors.success, fontWeight: '800'}]}>
                                  BEST
                                </Text>
                              </View>
                            )}
                          </View>

                          <Text
                            style={[theme.typography.bodyMedium, {color: theme.colors.text, fontWeight: '600', marginTop: 4}]}
                            numberOfLines={1}>
                            {video.filename}
                          </Text>

                          <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary, marginTop: 1}]}>
                            {StorageService.formatBytes(video.fileSize)}
                          </Text>
                        </View>

                        {/* Checkbox */}
                        <TouchableOpacity
                          style={styles.checkBtn}
                          onPress={() => toggleSelect(video.uri)}>
                          <Icon
                            name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                            size={24}
                            color={isSelected ? theme.colors.error : theme.colors.textTertiary}
                          />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Group Action Buttons */}
                <View style={styles.groupActionsRow}>
                  <TouchableOpacity
                    style={[styles.groupActionBtn, {backgroundColor: theme.colors.surfaceVariant}]}
                    onPress={() => selectGroupNonKeepers(item)}>
                    <Icon name="select-all" size={16} color={theme.colors.primary} />
                    <Text style={[theme.typography.labelSmall, {color: theme.colors.primary, fontWeight: '700'}]}>
                      Select Copies
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.groupActionBtn, {backgroundColor: theme.colors.surfaceVariant}]}
                    onPress={() => navigation.navigate('VideoCompression', {selectedUris: item.videos.map(v => v.uri)})}>
                    <Icon name="zip-box" size={16} color={theme.colors.secondary} />
                    <Text style={[theme.typography.labelSmall, {color: theme.colors.secondary, fontWeight: '700'}]}>
                      Compress Group
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            </Animated.View>
          );
        }}
      />

      {/* Floating Action Bar */}
      {selectedUris.size > 0 && (
        <Animated.View
          entering={FadeInDown.springify()}
          style={[
            styles.floatingBar,
            {
              backgroundColor: theme.colors.surface,
              paddingBottom: insets.bottom + 12,
              ...theme.elevation.lg,
            },
          ]}>
          <View style={styles.floatingInfo}>
            <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
              {selectedUris.size} selected
            </Text>
            <Text style={[theme.typography.bodySmall, {color: theme.colors.success, fontWeight: '700'}]}>
              Reclaim {StorageService.formatBytes(selectedBytes)}
            </Text>
          </View>

          <View style={styles.floatingActions}>
            <AnimatedButton
              onPress={handleCompress}
              variant="secondary"
              size="md"
              style={{paddingHorizontal: 14}}>
              <Icon name="zip-box" size={18} color="#FFFFFF" />
              <Text style={[theme.typography.labelMedium, {color: '#FFFFFF', fontWeight: '700'}]}>
                Compress
              </Text>
            </AnimatedButton>

            <AnimatedButton
              onPress={handleDelete}
              variant="danger"
              size="md"
              loading={deleting}
              style={{paddingHorizontal: 16}}>
              <Icon name="trash-can-outline" size={18} color="#FFFFFF" />
              <Text style={[theme.typography.labelMedium, {color: '#FFFFFF', fontWeight: '700'}]}>
                Delete ({selectedUris.size})
              </Text>
            </AnimatedButton>
          </View>
        </Animated.View>
      )}

      {/* Fullscreen Video Preview Modal */}
      <MediaPreviewModal
        visible={previewIndex !== null}
        items={previewItems}
        initialIndex={previewIndex ?? 0}
        onClose={() => setPreviewIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scanningContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerSection: {
    marginBottom: 16,
  },
  summaryCard: {
    borderRadius: 22,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  summaryIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  metricItem: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCard: {
    borderRadius: 20,
    marginBottom: 14,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  savingsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  keeperExplainCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  keeperExplainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  videosList: {
    marginTop: 12,
    gap: 8,
  },
  videoItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  thumbWrapper: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  videoThumb: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoInfoCol: {
    flex: 1,
    marginLeft: 12,
  },
  videoMetaBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  keeperPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  checkBtn: {
    padding: 8,
  },
  groupActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  groupActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  floatingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  floatingInfo: {
    flex: 1,
  },
  floatingActions: {
    flexDirection: 'row',
    gap: 8,
  },
});
