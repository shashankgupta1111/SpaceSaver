import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Linking,
  StatusBar,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useTheme} from '../../app/theme/ThemeContext';
import {MediaService} from '../services/MediaService';
import {StorageService} from '../services/StorageService';
import {useAlert} from './AlertProvider';
import Loader from './Loader';

const {width: SCREEN_W, height: SCREEN_H} = Dimensions.get('window');

export interface MediaPreviewItem {
  uri: string;
  type: 'image' | 'video';
  filename?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  playableDuration?: number;
}

interface Props {
  visible: boolean;
  items: MediaPreviewItem[];
  initialIndex?: number;
  onClose: () => void;
  /** Called after a successful delete so the parent can refresh its list. */
  onDeleted?: (uri: string) => void;
  selectedUris?: Set<string>;
  onToggleSelect?: (uri: string) => void;
  selectLabel?: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MediaPreviewModal({
  visible,
  items,
  initialIndex = 0,
  onClose,
  onDeleted,
  selectedUris,
  onToggleSelect,
  selectLabel = 'Select',
}: Props) {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const alert = useAlert();
  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(initialIndex);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({index: initialIndex, animated: false});
      });
    }
  }, [visible, initialIndex]);

  const item = items[index];
  const isSelected = item ? selectedUris?.has(item.uri) : false;
  const canSelect = Boolean(onToggleSelect && selectedUris);
  const canDelete = Boolean(onDeleted);

  const handleDelete = useCallback(() => {
    if (!item || !onDeleted) {
      return;
    }
    alert({
      title: 'Delete this file?',
      message: `${item.filename ?? 'This item'} (${StorageService.formatBytes(
        item.fileSize ?? 0,
      )}) will be removed from your gallery. Android will ask you to confirm.`,
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
              await MediaService.deleteAssets([item.uri]);
              onDeleted(item.uri);
              if (items.length <= 1) {
                onClose();
              } else if (index >= items.length - 1) {
                setIndex(Math.max(0, index - 1));
              }
            } catch {
              alert({
                title: 'Delete failed',
                message: 'This file could not be removed.',
                type: 'error',
              });
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    });
  }, [item, onDeleted, items.length, index, onClose, alert]);

  const playVideo = useCallback(async () => {
    if (!item?.uri) {
      return;
    }
    try {
      await Linking.openURL(item.uri);
    } catch {
      alert({
        title: 'Cannot play video',
        message: 'No app on this device can open this video.',
        type: 'error',
      });
    }
  }, [item?.uri, alert]);

  if (!visible || items.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <View style={styles.root}>
        {/* Pager */}
        <FlatList
          ref={listRef}
          data={items}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={it => it.uri}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({length: SCREEN_W, offset: SCREEN_W * i, index: i})}
          onScrollToIndexFailed={info => {
            listRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: false,
            });
          }}
          onMomentumScrollEnd={e => {
            const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            setIndex(i);
          }}
          renderItem={({item: it}) => (
            <View style={styles.page}>
              {it.type === 'image' ? (
                <Image
                  source={{uri: it.uri}}
                  style={styles.media}
                  resizeMode="contain"
                  resizeMethod="resize"
                />
              ) : (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={playVideo}
                  style={styles.videoWrap}>
                  <Image
                    source={{uri: it.uri}}
                    style={styles.media}
                    resizeMode="contain"
                    resizeMethod="resize"
                  />
                  <View style={styles.playOverlay}>
                    <View style={styles.playBtn}>
                      <Icon name="play" size={36} color="white" />
                    </View>
                    <Text style={styles.playHint}>Tap to play in gallery</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}
        />

        {/* Top bar */}
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.topBar, {paddingTop: insets.top + 8}]}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={12}>
            <Icon name="close" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.counter}>
            {index + 1} / {items.length}
          </Text>
          <View style={styles.iconBtn} />
        </Animated.View>

        {/* Bottom bar */}
        {item && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={[styles.bottomBar, {paddingBottom: insets.bottom + 12}]}>
            <View style={styles.meta}>
              <Text style={styles.filename} numberOfLines={1}>
                {item.filename ?? (item.type === 'video' ? 'Video' : 'Photo')}
              </Text>
              <Text style={styles.metaLine}>
                {StorageService.formatBytes(item.fileSize ?? 0)}
                {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                {item.type === 'video' && item.playableDuration
                  ? ` · ${formatDuration(item.playableDuration)}`
                  : ''}
              </Text>
            </View>

            <View style={styles.actions}>
              {canSelect && (
                <TouchableOpacity
                  onPress={() => onToggleSelect!(item.uri)}
                  style={[
                    styles.actionBtn,
                    isSelected && {backgroundColor: theme.colors.primary},
                  ]}>
                  <Icon
                    name={isSelected ? 'check-circle' : 'checkbox-blank-circle-outline'}
                    size={20}
                    color="white"
                  />
                  <Text style={styles.actionText}>
                    {isSelected ? 'Selected' : selectLabel}
                  </Text>
                </TouchableOpacity>
              )}
              {canDelete && (
                <TouchableOpacity
                  onPress={handleDelete}
                  disabled={deleting}
                  style={[styles.actionBtn, styles.deleteBtn]}>
                  {deleting ? (
                    <Loader size={20} strokeWidth={2.5} />
                  ) : (
                    <>
                      <Icon name="trash-can-outline" size={20} color="white" />
                      <Text style={styles.actionText}>Delete</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'black',
  },
  page: {
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: {
    width: SCREEN_W,
    height: SCREEN_H * 0.72,
  },
  videoWrap: {
    width: SCREEN_W,
    height: SCREEN_H * 0.72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  playHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 12,
    fontWeight: '500',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    gap: 14,
  },
  meta: {gap: 4},
  filename: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  metaLine: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  deleteBtn: {
    backgroundColor: 'rgba(239,68,68,0.85)',
  },
  actionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
