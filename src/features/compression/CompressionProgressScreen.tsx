import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

import {useTheme} from '../../app/theme/ThemeContext';
import {
  RootStackParamList,
  CompressionResult,
} from '../../app/navigation/types';
import {CompressionService} from '../../shared/services/CompressionService';
import {HistoryService} from '../../shared/services/HistoryService';
import {StorageService} from '../../shared/services/StorageService';
import {ForegroundServiceBridge} from '../../shared/services/ForegroundServiceBridge';
import {useAlert} from '../../shared/components/AlertProvider';
import CircularProgress from '../../shared/components/CircularProgress';
import Card from '../../shared/components/Card';

type Route = RouteProp<RootStackParamList, 'CompressionProgress'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

interface FileStatus {
  uri: string;
  fileName: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  progress: number;
  result?: CompressionResult;
  error?: string;
}

function formatTime(seconds: number): string {
  if (seconds < 60) {return `${Math.round(seconds)}s`;}
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CompressionProgressScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const alert = useAlert();
  const {type, uris, options} = route.params;

  const cancelToken = useRef({cancelled: false});
  const startTime = useRef(Date.now());
  const pauseRef = useRef(false);

  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>(
    uris.map(uri => ({
      uri,
      fileName: uri.split('/').pop() ?? 'file',
      status: 'pending' as const,
      progress: 0,
    })),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedResults, setCompletedResults] = useState<CompressionResult[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const overallProgress =
    ((currentIndex + (fileStatuses[currentIndex]?.progress ?? 0) / 100) /
      uris.length) *
    100;

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (!pauseRef.current) {
        setElapsedSeconds(s => s + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const estimatedTotal =
    elapsedSeconds > 0 && overallProgress > 1
      ? (elapsedSeconds / overallProgress) * 100
      : 0;
  const remaining = Math.max(0, estimatedTotal - elapsedSeconds);

  const updateFileStatus = useCallback(
    (index: number, update: Partial<FileStatus>) => {
      setFileStatuses(prev => {
        const next = [...prev];
        next[index] = {...next[index], ...update};
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    let stopped = false;

    const run = async () => {
      await ForegroundServiceBridge.startService(uris.length);
      const results: CompressionResult[] = [];

      for (let i = 0; i < uris.length; i++) {
        if (cancelToken.current.cancelled) {break;}

        // Wait if paused
        while (pauseRef.current && !cancelToken.current.cancelled) {
          await new Promise<void>(r => setTimeout(() => r(), 200));
        }

        if (cancelToken.current.cancelled) {break;}

        setCurrentIndex(i);
        updateFileStatus(i, {status: 'processing'});

        try {
          const fileName = uris[i].split('/').pop() ?? 'file';
          await ForegroundServiceBridge.updateProgress(0, fileName, i, uris.length);

          const result =
            type === 'image'
              ? await CompressionService.compressImage(
                  uris[i],
                  options,
                  p => {
                    if (!stopped) {
                      const pct = Math.round(p * 100);
                      updateFileStatus(i, {progress: pct});
                      ForegroundServiceBridge.updateProgress(pct, fileName, i, uris.length);
                    }
                  },
                  cancelToken.current,
                )
              : await CompressionService.compressVideo(
                  uris[i],
                  options,
                  p => {
                    if (!stopped) {
                      const pct = Math.round(p * 100);
                      updateFileStatus(i, {progress: pct});
                      ForegroundServiceBridge.updateProgress(pct, fileName, i, uris.length);
                    }
                  },
                  cancelToken.current,
                );

          updateFileStatus(i, {
            status: 'done',
            progress: 100,
            result,
          });
          results.push(result);
          setCompletedResults([...results]);
        } catch (err) {
          if ((err as Error).message === 'CANCELLED') {break;}
          updateFileStatus(i, {
            status: 'failed',
            error: (err as Error).message,
          });
        }
      }

      await ForegroundServiceBridge.stopService();
      if (!stopped && !cancelToken.current.cancelled && results.length > 0) {
        HistoryService.addBatch(
          results.map(r => ({...r, saveOption: 'new' as const})),
        );
        setIsFinished(true);
        navigation.replace('CompressionSuccess', {results, type});
      }
    };

    run();
    return () => {
      stopped = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prevent back during compression
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCancel();
      return true;
    });
    return () => handler.remove();
  });

  const togglePause = () => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(prev => !prev);
  };

  const handleCancel = () => {
    alert({
      title: 'Cancel Compression?',
      message: `${completedResults.length} of ${uris.length} files have been compressed.`,
      type: 'warning',
      icon: 'progress-close',
      buttons: [
        {text: 'Continue', style: 'cancel'},
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => {
            cancelToken.current.cancelled = true;
            if (completedResults.length > 0) {
              HistoryService.addBatch(
                completedResults.map(r => ({...r, saveOption: 'new' as const})),
              );
              navigation.replace('CompressionSuccess', {
                results: completedResults,
                type,
              });
            } else {
              navigation.goBack();
            }
          },
        },
      ],
    });
  };

  const pulseAnim = useSharedValue(1);
  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.02, {duration: 1000, easing: Easing.inOut(Easing.sin)}),
        withTiming(1, {duration: 1000, easing: Easing.inOut(Easing.sin)}),
      ),
      -1,
    );
  }, [pulseAnim]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{scale: pulseAnim.value}],
  }));

  const doneCount = fileStatuses.filter(f => f.status === 'done').length;
  const failedCount = fileStatuses.filter(f => f.status === 'failed').length;

  return (
    <View
      style={[
        styles.root,
        {backgroundColor: theme.colors.background, paddingTop: insets.top},
      ]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[theme.typography.titleLarge, {color: theme.colors.text}]}>
            {isPaused ? 'Paused' : 'Compressing...'}
          </Text>
          <Text
            style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
            {type === 'image' ? 'Images' : 'Videos'}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {paddingBottom: insets.bottom + 24},
        ]}>

        {/* Big circular progress */}
        <Animated.View style={[styles.circleContainer, pulseStyle]}>
          <LinearGradient
            colors={[theme.colors.primaryContainer, theme.colors.background]}
            style={styles.circleGlow}>
            <CircularProgress
              progress={overallProgress}
              size={200}
              strokeWidth={14}
              sublabel={`${doneCount}/${uris.length} files`}
            />
          </LinearGradient>
        </Animated.View>

        {/* Stats row */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Card style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Icon name="clock-outline" size={16} color={theme.colors.primary} />
                <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary}]}>
                  Elapsed
                </Text>
                <Text style={[theme.typography.numericSmall, {color: theme.colors.text}]}>
                  {formatTime(elapsedSeconds)}
                </Text>
              </View>
              <View style={[styles.statDivider, {backgroundColor: theme.colors.border}]} />
              <View style={styles.statItem}>
                <Icon name="timer-outline" size={16} color={theme.colors.secondary} />
                <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary}]}>
                  Remaining
                </Text>
                <Text style={[theme.typography.numericSmall, {color: theme.colors.text}]}>
                  {remaining > 0 ? formatTime(remaining) : '—'}
                </Text>
              </View>
              <View style={[styles.statDivider, {backgroundColor: theme.colors.border}]} />
              <View style={styles.statItem}>
                <Icon name="check-circle-outline" size={16} color={theme.colors.success} />
                <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary}]}>
                  Done
                </Text>
                <Text style={[theme.typography.numericSmall, {color: theme.colors.text}]}>
                  {doneCount}/{uris.length}
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Current file */}
        {fileStatuses[currentIndex] && (
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <Card style={styles.currentFileCard}>
              <Text
                style={[theme.typography.labelMedium, {color: theme.colors.textSecondary, marginBottom: 4}]}>
                PROCESSING
              </Text>
              <Text
                style={[theme.typography.titleSmall, {color: theme.colors.text, marginBottom: 12}]}
                numberOfLines={1}>
                {fileStatuses[currentIndex].fileName}
              </Text>
              <View
                style={[styles.progressTrack, {backgroundColor: theme.colors.border}]}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: theme.colors.primary,
                      width: `${fileStatuses[currentIndex].progress}%` as `${number}%`,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  theme.typography.bodySmall,
                  {color: theme.colors.textSecondary, marginTop: 6, textAlign: 'right'},
                ]}>
                {fileStatuses[currentIndex].progress}%
              </Text>
            </Card>
          </Animated.View>
        )}

        {/* File list */}
        <Text
          style={[
            theme.typography.titleSmall,
            {color: theme.colors.text, marginTop: 8, marginBottom: 8},
          ]}>
          Queue
        </Text>
        {fileStatuses.map((file, i) => (
          <Animated.View
            key={file.uri}
            entering={FadeInDown.delay(200 + i * 20).springify()}>
            <View
              style={[
                styles.queueItem,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}>
              <View
                style={[
                  styles.queueIcon,
                  {
                    backgroundColor:
                      file.status === 'done'
                        ? theme.colors.successContainer
                        : file.status === 'failed'
                        ? theme.colors.errorContainer
                        : file.status === 'processing'
                        ? theme.colors.primaryContainer
                        : theme.colors.surfaceVariant,
                  },
                ]}>
                <Icon
                  name={
                    file.status === 'done'
                      ? 'check'
                      : file.status === 'failed'
                      ? 'close'
                      : file.status === 'processing'
                      ? (type === 'image' ? 'image' : 'video')
                      : 'clock-outline'
                  }
                  size={16}
                  color={
                    file.status === 'done'
                      ? theme.colors.success
                      : file.status === 'failed'
                      ? theme.colors.error
                      : file.status === 'processing'
                      ? theme.colors.primary
                      : theme.colors.textTertiary
                  }
                />
              </View>
              <View style={styles.queueInfo}>
                <Text
                  style={[theme.typography.labelMedium, {color: theme.colors.text}]}
                  numberOfLines={1}>
                  {file.fileName}
                </Text>
                {file.status === 'done' && file.result && (
                  <Text
                    style={[
                      theme.typography.bodySmall,
                      {color: theme.colors.success},
                    ]}>
                    {options.mode === 'convert'
                      ? 'Format Converted · Lossless'
                      : `Saved ${file.result.savedPercent}% · ${StorageService.formatBytes(file.result.savedBytes)}`}
                  </Text>
                )}
                {file.status === 'failed' && (
                  <Text
                    style={[
                      theme.typography.bodySmall,
                      {color: theme.colors.error},
                    ]}>
                    {file.error ?? 'Compression failed'}
                  </Text>
                )}
                {file.status === 'processing' && (
                  <View
                    style={[
                      styles.miniProgress,
                      {backgroundColor: theme.colors.border},
                    ]}>
                    <View
                      style={[
                        styles.miniProgressFill,
                        {
                          width: `${file.progress}%` as `${number}%`,
                          backgroundColor: theme.colors.primary,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
              {file.status === 'done' && (
                <View
                  style={[
                    styles.savedBadge,
                    {backgroundColor: theme.colors.successContainer},
                  ]}>
                  <Text
                    style={[
                      theme.typography.labelSmall,
                      {color: theme.colors.success, fontWeight: '700'},
                    ]}>
                    -{file.result?.savedPercent}%
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        ))}
      </ScrollView>

      {/* Controls */}
      <View
        style={[
          styles.controls,
          {
            paddingBottom: insets.bottom + 12,
            backgroundColor: theme.colors.background,
            borderTopColor: theme.colors.borderLight,
          },
        ]}>
        <TouchableOpacity
          style={[
            styles.controlBtn,
            {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={togglePause}>
          <Icon
            name={isPaused ? 'play' : 'pause'}
            size={22}
            color={theme.colors.text}
          />
          <Text style={[theme.typography.labelLarge, {color: theme.colors.text}]}>
            {isPaused ? 'Resume' : 'Pause'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.controlBtn,
            styles.cancelBtn,
            {borderColor: theme.colors.error},
          ]}
          onPress={handleCancel}>
          <Icon name="close" size={22} color={theme.colors.error} />
          <Text style={[theme.typography.labelLarge, {color: theme.colors.error}]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  content: {
    paddingHorizontal: 20,
    gap: 10,
  },
  circleContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  circleGlow: {
    borderRadius: 120,
    padding: 20,
  },
  statsCard: {},
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  currentFileCard: {},
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  queueIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueInfo: {flex: 1, gap: 4},
  miniProgress: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  savedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 0.5,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  cancelBtn: {
    backgroundColor: 'transparent',
  },
});
