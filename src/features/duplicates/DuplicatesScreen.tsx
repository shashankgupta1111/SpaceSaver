import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {FadeInDown, FadeIn} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {PermissionService} from '../../shared/services/PermissionService';

import {useTheme} from '../../app/theme/ThemeContext';
import {StorageService} from '../../shared/services/StorageService';
import {
  DuplicateService,
  DuplicateGroup,
  DupPhoto,
  ScanResult,
} from '../../shared/services/DuplicateService';
import {useAlert} from '../../shared/components/AlertProvider';
import HeaderBar from '../../shared/components/HeaderBar';
import AnimatedButton from '../../shared/components/AnimatedButton';
import Loader from '../../shared/components/Loader';
import MediaPreviewModal, {
  MediaPreviewItem,
} from '../../shared/components/MediaPreviewModal';
import {VideoThumbnail} from '../../shared/components/VideoThumbnail';

type Phase = 'idle' | 'scanning' | 'results';

const THUMB = 92;

export default function DuplicatesScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const alert = useAlert();

  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState({done: 0, total: 0});
  const [result, setResult] = useState<ScanResult | null>(null);
  const [toDelete, setToDelete] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<{
    items: MediaPreviewItem[];
    index: number;
  } | null>(null);

  // uri -> photo, for size lookups on the selection.
  const photoIndex = useMemo(() => {
    const map = new Map<string, DupPhoto>();
    result?.groups.forEach(g => g.photos.forEach(p => map.set(p.uri, p)));
    return map;
  }, [result]);

  const selectedBytes = useMemo(() => {
    let sum = 0;
    toDelete.forEach(uri => {
      sum += photoIndex.get(uri)?.fileSize ?? 0;
    });
    return sum;
  }, [toDelete, photoIndex]);

  const runScan = useCallback(async () => {
    const permGranted = await PermissionService.ensureImagePermission();
    if (!permGranted) {
      alert({
        title: 'Permission needed',
        message: 'SpaceSaver needs access to your photos to find duplicates.',
        type: 'warning',
      });
      return;
    }

    setPhase('scanning');
    setProgress({done: 0, total: 0});
    try {
      const res = await DuplicateService.scan((done, total) =>
        setProgress({done, total}),
      );
      // Pre-select every non-keeper photo ("keep best, delete rest").
      const preselect = new Set<string>();
      res.groups.forEach(g =>
        g.photos.forEach(p => {
          if (p.uri !== g.keeperUri) {
            preselect.add(p.uri);
          }
        }),
      );
      setResult(res);
      setToDelete(preselect);
      setPhase('results');
    } catch {
      setPhase('idle');
      alert({
        title: 'Scan failed',
        message: 'Could not scan your photos. Please try again.',
        type: 'error',
      });
    }
  }, [alert]);

  const toggle = useCallback((uri: string) => {
    setToDelete(prev => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  }, []);

  const confirmDelete = useCallback(() => {
    const uris = Array.from(toDelete);
    if (uris.length === 0) {
      return;
    }
    alert({
      title: `Delete ${uris.length} photo${uris.length > 1 ? 's' : ''}?`,
      message: `This frees ${StorageService.formatBytes(
        selectedBytes,
      )}. Android will ask you to confirm removal from your gallery.`,
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
              // Drop deleted photos and collapse groups that no longer have dupes.
              setResult(prev => {
                if (!prev) {
                  return prev;
                }
                const groups = prev.groups
                  .map(g => ({
                    ...g,
                    photos: g.photos.filter(p => !toDelete.has(p.uri)),
                  }))
                  .filter(g => g.photos.length >= 2)
                  .map(g => rebuildGroup(g));
                return {
                  ...prev,
                  groups,
                  totalReclaimable: groups.reduce(
                    (s, g) => s + g.reclaimable,
                    0,
                  ),
                };
              });
              setToDelete(new Set());
              alert({
                title: 'Cleaned up!',
                message: `Freed ${StorageService.formatBytes(selectedBytes)}.`,
                type: 'success',
              });
            } catch {
              alert({
                title: 'Delete failed',
                message:
                  'Some photos could not be removed. They may be protected or already gone.',
                type: 'error',
              });
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    });
  }, [toDelete, selectedBytes, alert]);

  const handlePreviewDeleted = useCallback((uri: string) => {
    setToDelete(prev => {
      const next = new Set(prev);
      next.delete(uri);
      return next;
    });
    setPreview(prev => {
      if (!prev) {
        return null;
      }
      const items = prev.items.filter(i => i.uri !== uri);
      if (items.length === 0) {
        return null;
      }
      return {
        items,
        index: Math.min(prev.index, items.length - 1),
      };
    });
    setResult(prev => {
      if (!prev) {
        return prev;
      }
      const groups = prev.groups
        .map(g => ({
          ...g,
          photos: g.photos.filter(p => p.uri !== uri),
        }))
        .filter(g => g.photos.length >= 2)
        .map(g => rebuildGroup(g));
      return {
        ...prev,
        groups,
        totalReclaimable: groups.reduce((s, g) => s + g.reclaimable, 0),
      };
    });
  }, []);

  /* ----------------------------- render ----------------------------- */

  return (
    <View
      style={[
        styles.root,
        {backgroundColor: theme.colors.background, paddingTop: insets.top},
      ]}>
      <HeaderBar title="Duplicate Photos" showBack />

      {phase === 'idle' && (
        <IdleState onScan={runScan} />
      )}

      {phase === 'scanning' && (
        <ScanningState done={progress.done} total={progress.total} />
      )}

      {phase === 'results' && result && (
        <ResultsState
          result={result}
          toDelete={toDelete}
          onToggle={toggle}
          selectedCount={toDelete.size}
          selectedBytes={selectedBytes}
          deleting={deleting}
          onDelete={confirmDelete}
          onPreview={(items, index) => setPreview({items, index})}
          bottomInset={insets.bottom}
        />
      )}

      <MediaPreviewModal
        visible={preview !== null}
        items={preview?.items ?? []}
        initialIndex={preview?.index ?? 0}
        onClose={() => setPreview(null)}
        onDeleted={handlePreviewDeleted}
        selectedUris={toDelete}
        onToggleSelect={toggle}
        selectLabel="Mark to delete"
      />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Idle
 * ------------------------------------------------------------------ */

function IdleState({onScan}: {onScan: () => void}) {
  const {theme} = useTheme();
  return (
    <Animated.View entering={FadeIn} style={styles.centered}>
      <View
        style={[
          styles.heroIcon,
          {backgroundColor: theme.colors.primaryContainer},
        ]}>
        <Icon name="image-multiple-outline" size={56} color={theme.colors.primary} />
      </View>
      <Text
        style={[
          theme.typography.titleLarge,
          {color: theme.colors.text, textAlign: 'center', marginTop: 24},
        ]}>
        Find duplicate & similar photos
      </Text>
      <Text
        style={[
          theme.typography.bodyMedium,
          {
            color: theme.colors.textSecondary,
            textAlign: 'center',
            marginTop: 8,
            paddingHorizontal: 32,
          },
        ]}>
        We scan your gallery on-device to group exact copies and near-identical
        shots — then help you keep the best and free up space.
      </Text>
      <View style={styles.heroBtn}>
        <AnimatedButton onPress={onScan} variant="primary" gradient size="lg" fullWidth>
          <Icon name="magnify-scan" size={20} color="white" />
          <Text style={[theme.typography.titleSmall, {color: 'white'}]}>
            Scan for duplicates
          </Text>
        </AnimatedButton>
      </View>
      <View style={styles.privacyRow}>
        <Icon name="shield-lock-outline" size={14} color={theme.colors.textTertiary} />
        <Text
          style={[theme.typography.bodySmall, {color: theme.colors.textTertiary}]}>
          Fully offline — nothing leaves your device
        </Text>
      </View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ *
 * Scanning
 * ------------------------------------------------------------------ */

function ScanningState({done, total}: {done: number; total: number}) {
  const {theme} = useTheme();
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <View style={styles.centered}>
      <Loader size={52} />
      <Text
        style={[
          theme.typography.titleMedium,
          {color: theme.colors.text, marginTop: 20},
        ]}>
        Analyzing your photos…
      </Text>
      <Text
        style={[
          theme.typography.bodyMedium,
          {color: theme.colors.textSecondary, marginTop: 6},
        ]}>
        {total > 0 ? `${done} of ${total} · ${pct}%` : 'Loading gallery…'}
      </Text>
      <View style={[styles.progressTrack, {backgroundColor: theme.colors.surfaceVariant}]}>
        <View
          style={[
            styles.progressFill,
            {backgroundColor: theme.colors.primary, width: `${pct}%`},
          ]}
        />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Results
 * ------------------------------------------------------------------ */

function ResultsState({
  result,
  toDelete,
  onToggle,
  selectedCount,
  selectedBytes,
  deleting,
  onDelete,
  onPreview,
  bottomInset,
}: {
  result: ScanResult;
  toDelete: Set<string>;
  onToggle: (uri: string) => void;
  selectedCount: number;
  selectedBytes: number;
  deleting: boolean;
  onDelete: () => void;
  onPreview: (items: MediaPreviewItem[], index: number) => void;
  bottomInset: number;
}) {
  const {theme} = useTheme();

  if (result.groups.length === 0) {
    return (
      <View style={styles.centered}>
        <View
          style={[
            styles.heroIcon,
            {backgroundColor: theme.colors.successContainer},
          ]}>
          <Icon name="check-decagram" size={56} color={theme.colors.success} />
        </View>
        <Text
          style={[
            theme.typography.titleLarge,
            {color: theme.colors.text, marginTop: 24, textAlign: 'center'},
          ]}>
          No duplicates found
        </Text>
        <Text
          style={[
            theme.typography.bodyMedium,
            {
              color: theme.colors.textSecondary,
              marginTop: 8,
              textAlign: 'center',
              paddingHorizontal: 32,
            },
          ]}>
          Your gallery is already tidy. Nice work!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {/* Summary */}
      <View style={styles.summaryRow}>
        <Text style={[theme.typography.bodyMedium, {color: theme.colors.textSecondary}]}>
          {result.groups.length} group{result.groups.length > 1 ? 's' : ''} ·
          reclaim up to{' '}
          <Text style={{color: theme.colors.primary, fontWeight: '700'}}>
            {StorageService.formatBytes(result.totalReclaimable)}
          </Text>
        </Text>
        {!result.perceptual && (
          <Text
            style={[theme.typography.bodySmall, {color: theme.colors.warning}]}>
            Exact-match only
          </Text>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: selectedCount > 0 ? bottomInset + 100 : bottomInset + 24,
        }}>
        {result.groups.map((group, i) => (
          <GroupCard
            key={group.id}
            group={group}
            index={i}
            toDelete={toDelete}
            onToggle={onToggle}
            onPreview={onPreview}
          />
        ))}
      </ScrollView>

      {/* Sticky delete bar */}
      {selectedCount > 0 && (
        <Animated.View
          entering={FadeInDown.springify()}
          style={[
            styles.deleteBar,
            {
              paddingBottom: bottomInset + 12,
              backgroundColor: theme.colors.background,
              borderTopColor: theme.colors.borderLight,
            },
          ]}>
          <AnimatedButton
            onPress={onDelete}
            variant="danger"
            size="lg"
            fullWidth
            loading={deleting}>
            <Icon name="trash-can-outline" size={20} color="white" />
            <Text style={[theme.typography.titleSmall, {color: 'white'}]}>
              Delete {selectedCount} · {StorageService.formatBytes(selectedBytes)}
            </Text>
          </AnimatedButton>
        </Animated.View>
      )}
    </View>
  );
}

function GroupCard({
  group,
  index,
  toDelete,
  onToggle,
  onPreview,
}: {
  group: DuplicateGroup;
  index: number;
  toDelete: Set<string>;
  onToggle: (uri: string) => void;
  onPreview: (items: MediaPreviewItem[], index: number) => void;
}) {
  const {theme} = useTheme();
  const isExact = group.kind === 'exact';

  const previewItems: MediaPreviewItem[] = group.photos.map(p => ({
    uri: p.uri,
    type: 'image' as const,
    filename: p.filename,
    fileSize: p.fileSize,
    width: p.width,
    height: p.height,
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 40).springify()}
      style={[
        styles.groupCard,
        {backgroundColor: theme.colors.surface, ...theme.elevation.sm},
      ]}>
      <View style={styles.groupHeader}>
        <View
          style={[
            styles.kindBadge,
            {
              backgroundColor: isExact
                ? theme.colors.errorContainer
                : theme.colors.primaryContainer,
            },
          ]}>
          <Icon
            name={isExact ? 'content-copy' : 'image-multiple'}
            size={13}
            color={isExact ? theme.colors.error : theme.colors.primary}
          />
          <Text
            style={[
              theme.typography.labelSmall,
              {
                color: isExact ? theme.colors.error : theme.colors.primary,
                fontWeight: '700',
              },
            ]}>
            {isExact ? 'Exact copy' : 'Similar'} · {group.photos.length}
          </Text>
        </View>
        <Text style={[theme.typography.labelMedium, {color: theme.colors.textSecondary}]}>
          Reclaim {StorageService.formatBytes(group.reclaimable)}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbRow}>
        {group.photos.map((photo, photoIndex) => {
          const isKeeper = photo.uri === group.keeperUri;
          const marked = toDelete.has(photo.uri);
          return (
            <TouchableOpacity
              key={photo.uri}
              activeOpacity={0.85}
              onPress={() => onPreview(previewItems, photoIndex)}
              onLongPress={() => onToggle(photo.uri)}
              delayLongPress={280}
              style={styles.thumbWrap}>
              {(photo as any).type === 'video' || photo.uri.toLowerCase().includes('.mov') || photo.uri.toLowerCase().includes('.mp4') ? (
                <VideoThumbnail
                  videoUri={photo.uri}
                  style={styles.thumb}
                  resizeMode="cover"
                />
              ) : (
                <Image
                  source={{uri: photo.uri}}
                  style={styles.thumb}
                  resizeMode="cover"
                  resizeMethod="resize"
                />
              )}
              {marked && (
                <View style={[styles.thumbOverlay, {backgroundColor: 'rgba(239,68,68,0.35)'}]} />
              )}
              {/* Keeper ribbon */}
              {isKeeper && (
                <View style={[styles.keepBadge, {backgroundColor: theme.colors.success}]}>
                  <Icon name="star" size={9} color="white" />
                  <Text style={styles.keepText}>BEST</Text>
                </View>
              )}
              {/* Selection indicator */}
              <View
                style={[
                  styles.selCircle,
                  marked
                    ? {backgroundColor: theme.colors.error, borderColor: 'white'}
                    : {
                        backgroundColor: 'rgba(0,0,0,0.35)',
                        borderColor: 'rgba(255,255,255,0.85)',
                      },
                ]}>
                {marked && <Icon name="trash-can" size={11} color="white" />}
              </View>
              <View style={styles.sizeTag}>
                <Text style={styles.sizeTagText}>
                  {StorageService.formatBytesShort(photo.fileSize)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ *
 * helper: recompute keeper/reclaimable after some photos are removed
 * ------------------------------------------------------------------ */

function rebuildGroup(group: DuplicateGroup): DuplicateGroup {
  const reclaimable = group.photos
    .filter(p => p.uri !== group.keeperUri)
    .reduce((s, p) => s + p.fileSize, 0);
  // Keeper may have been deleted; fall back to the first remaining photo.
  const keeperStillHere = group.photos.some(p => p.uri === group.keeperUri);
  const keeperUri = keeperStillHere ? group.keeperUri : group.photos[0].uri;
  return {
    ...group,
    keeperUri,
    reclaimable: keeperStillHere
      ? reclaimable
      : group.photos.slice(1).reduce((s, p) => s + p.fileSize, 0),
  };
}

const styles = StyleSheet.create({
  root: {flex: 1},
  flex: {flex: 1},
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  heroIcon: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBtn: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 32,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  progressTrack: {
    width: '70%',
    height: 6,
    borderRadius: 3,
    marginTop: 20,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  groupCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  kindBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  thumbRow: {
    gap: 10,
    paddingRight: 4,
  },
  thumbWrap: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  keepBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  keepText: {
    color: 'white',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  selCircle: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
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
  sizeTagText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '600',
  },
  deleteBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 0.5,
  },
});
