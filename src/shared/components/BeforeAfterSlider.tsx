import React, {useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet, Image, ActivityIndicator, LayoutChangeEvent} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useTheme} from '../../app/theme/ThemeContext';
import {CompressionOptions} from '../../app/navigation/types';
import {CompressionService} from '../services/CompressionService';
import {StorageService} from '../services/StorageService';

const HEIGHT = 240;

interface Preview {
  uri: string;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
}

/**
 * Draggable before/after comparison for image compression. Generates a REAL
 * preview of `originalUri` at the current options (debounced), so users see the
 * actual quality/size trade-off before committing — a trust builder for a
 * lossy operation.
 */
export default function BeforeAfterSlider({
  originalUri,
  options,
}: {
  originalUri: string;
  options: CompressionOptions;
}) {
  const {theme} = useTheme();
  const [width, setWidth] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const divider = useSharedValue(0);
  const widthRef = useRef(0);

  // Regenerate the preview whenever the meaningful options change (debounced).
  const optKey = JSON.stringify({
    q: options.quality,
    w: options.maxWidth,
    f: options.outputFormat,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const handle = setTimeout(async () => {
      try {
        const result = await CompressionService.compressImage(originalUri, options);
        if (cancelled) {return;}
        setPreview({
          uri: result.compressedUri,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          savedPercent: result.savedPercent,
        });
        setLoading(false);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalUri, optKey]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
    if (divider.value === 0) {
      divider.value = w / 2;
    }
  };

  const pan = Gesture.Pan().onChange(e => {
    'worklet';
    const max = widthRef.current;
    let next = divider.value + e.changeX;
    if (next < 0) {next = 0;}
    if (next > max) {next = max;}
    divider.value = next;
  });

  const beforeStyle = useAnimatedStyle(() => ({width: divider.value}));
  const handleStyle = useAnimatedStyle(() => ({left: divider.value - 16}));

  return (
    <View>
      <View style={[styles.container, {backgroundColor: theme.colors.surfaceVariant}]} onLayout={onLayout}>
        {/* After (compressed) — bottom layer, full width */}
        {preview && (
          <Image
            source={{uri: preview.uri}}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            resizeMethod="resize"
          />
        )}

        {/* Before (original) — clipped to divider */}
        {width > 0 && (
          <Animated.View style={[styles.beforeClip, beforeStyle]}>
            <Image
              source={{uri: originalUri}}
              style={{width, height: HEIGHT}}
              resizeMode="cover"
              resizeMethod="resize"
            />
            <View style={styles.tagLeft}>
              <Text style={styles.tagText}>ORIGINAL</Text>
            </View>
          </Animated.View>
        )}

        {/* After tag */}
        <View style={styles.tagRight}>
          <Text style={styles.tagText}>COMPRESSED</Text>
        </View>

        {/* Loading / error overlay */}
        {(loading || failed) && (
          <View style={[StyleSheet.absoluteFill, styles.overlay]}>
            {failed ? (
              <>
                <Icon name="image-off-outline" size={28} color="white" />
                <Text style={styles.overlayText}>Preview unavailable</Text>
              </>
            ) : (
              <>
                <ActivityIndicator color="white" />
                <Text style={styles.overlayText}>Generating preview…</Text>
              </>
            )}
          </View>
        )}

        {/* Drag handle */}
        {width > 0 && !loading && !failed && (
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.handle, handleStyle]}>
              <View style={[styles.handleLine, {backgroundColor: 'white'}]} />
              <View style={[styles.handleKnob, {backgroundColor: 'white'}]}>
                <Icon name="unfold-more-vertical" size={18} color={theme.colors.primary} style={styles.knobIcon} />
              </View>
            </Animated.View>
          </GestureDetector>
        )}
      </View>

      {/* Size comparison */}
      {preview && !failed && (
        <View style={styles.statsRow}>
          <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
            {StorageService.formatBytes(preview.originalSize)}
          </Text>
          <View style={[styles.savePill, {backgroundColor: theme.colors.successContainer}]}>
            <Icon name="arrow-down" size={12} color={theme.colors.success} />
            <Text style={[theme.typography.labelSmall, {color: theme.colors.success, fontWeight: '700'}]}>
              {preview.savedPercent}% smaller
            </Text>
          </View>
          <Text style={[theme.typography.bodySmall, {color: theme.colors.text, fontWeight: '700'}]}>
            {StorageService.formatBytes(preview.compressedSize)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
  },
  beforeClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: HEIGHT,
    overflow: 'hidden',
    borderRightWidth: 2,
    borderRightColor: 'white',
  },
  tagLeft: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagRight: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {color: 'white', fontSize: 10, fontWeight: '800', letterSpacing: 0.5},
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 8,
  },
  overlayText: {color: 'white', fontSize: 12, fontWeight: '600'},
  handle: {
    position: 'absolute',
    top: 0,
    width: 32,
    height: HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleLine: {
    position: 'absolute',
    width: 2,
    height: HEIGHT,
  },
  handleKnob: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 2},
  },
  knobIcon: {transform: [{rotate: '90deg'}]},
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  savePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
});
