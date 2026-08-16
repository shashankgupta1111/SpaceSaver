import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList} from '../../app/navigation/types';
import {
  CompressionQueueService,
  QueueJob,
} from '../../shared/services/CompressionQueueService';
import {StorageService} from '../../shared/services/StorageService';
import HeaderBar from '../../shared/components/HeaderBar';
import Card from '../../shared/components/Card';
import AnimatedButton from '../../shared/components/AnimatedButton';
import EmptyState from '../../shared/components/EmptyState';
import {useAlert} from '../../shared/components/AlertProvider';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CompressionQueueScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const alert = useAlert();

  const [jobs, setJobs] = useState<QueueJob[]>(() => CompressionQueueService.getJobs());
  const [isPaused, setIsPaused] = useState<boolean>(() => CompressionQueueService.getIsPaused());

  useEffect(() => {
    const unsubscribe = CompressionQueueService.subscribe(updatedJobs => {
      setJobs(updatedJobs);
      setIsPaused(CompressionQueueService.getIsPaused());
    });
    return unsubscribe;
  }, []);

  const pendingCount = jobs.filter(j => j.status === 'pending').length;
  const processingCount = jobs.filter(j => j.status === 'processing').length;
  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const failedCount = jobs.filter(j => j.status === 'failed' || j.status === 'interrupted').length;

  const totalSavedBytes = jobs
    .filter(j => j.status === 'completed')
    .reduce((sum, j) => sum + j.actualSavedBytes, 0);

  const togglePauseResume = () => {
    if (isPaused) {
      CompressionQueueService.resumeQueue();
      setIsPaused(false);
    } else {
      CompressionQueueService.pauseQueue();
      setIsPaused(true);
    }
  };

  const handleCancelQueue = () => {
    alert({
      title: 'Cancel Entire Queue?',
      message: 'All remaining pending and active compression jobs will be cancelled.',
      type: 'warning',
      icon: 'progress-close',
      buttons: [
        {
          text: 'Cancel Queue',
          style: 'destructive',
          onPress: () => {
            CompressionQueueService.cancelQueue();
          },
        },
        {text: 'Keep Running', style: 'cancel'},
      ],
    });
  };

  const handleClearCompleted = () => {
    CompressionQueueService.clearCompleted();
  };

  const handleRetryJob = (jobId: string) => {
    CompressionQueueService.retryJob(jobId);
  };

  const handleCancelJob = (jobId: string) => {
    CompressionQueueService.cancelJob(jobId);
  };

  const handleDeleteJob = (jobId: string) => {
    CompressionQueueService.deleteJob(jobId);
  };

  return (
    <View
      style={[
        styles.root,
        {backgroundColor: theme.colors.background, paddingTop: insets.top},
      ]}>
      <HeaderBar
        title="Compression Queue"
        subtitle={`${jobs.length} jobs · ${StorageService.formatBytes(totalSavedBytes)} saved`}
        showBack
        rightActions={
          completedCount > 0 ? (
            <TouchableOpacity
              onPress={handleClearCompleted}
              style={[styles.actionIconBtn, {backgroundColor: theme.colors.surfaceVariant}]}
              hitSlop={8}>
              <Icon name="broom" size={18} color={theme.colors.primary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {jobs.length === 0 ? (
        <EmptyState
          type="history"
          title="Compression Queue Empty"
          description="You don't have any active or queued compression jobs. Add photos or videos to start background compression."
          actionLabel="Go to Photos"
          onAction={() => navigation.navigate('Main', {screen: 'Images'})}
        />
      ) : (
        <View style={styles.container}>
          {/* Summary Status Header */}
          <Animated.View entering={FadeInDown.delay(50).springify()}>
            <Card style={styles.summaryCard} padding={16}>
              <View style={styles.summaryRow}>
                <View style={styles.statBox}>
                  <Text style={[theme.typography.headlineSmall, {color: theme.colors.primary, fontWeight: '800'}]}>
                    {pendingCount + processingCount}
                  </Text>
                  <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary}]}>
                    Active / Waiting
                  </Text>
                </View>

                <View style={[styles.statDivider, {backgroundColor: theme.colors.borderLight}]} />

                <View style={styles.statBox}>
                  <Text style={[theme.typography.headlineSmall, {color: theme.colors.success, fontWeight: '800'}]}>
                    {completedCount}
                  </Text>
                  <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary}]}>
                    Completed
                  </Text>
                </View>

                <View style={[styles.statDivider, {backgroundColor: theme.colors.borderLight}]} />

                <View style={styles.statBox}>
                  <Text style={[theme.typography.headlineSmall, {color: failedCount > 0 ? theme.colors.error : theme.colors.textSecondary, fontWeight: '800'}]}>
                    {failedCount}
                  </Text>
                  <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary}]}>
                    Failed/Interrupted
                  </Text>
                </View>
              </View>

              {/* Action Controls */}
              <View style={[styles.controlsRow, {borderTopColor: theme.colors.borderLight}]}>
                <AnimatedButton
                  onPress={togglePauseResume}
                  variant={isPaused ? 'primary' : 'outline'}
                  size="sm"
                  style={{flex: 1}}>
                  <Icon name={isPaused ? 'play' : 'pause'} size={16} color={isPaused ? '#FFFFFF' : theme.colors.text} />
                  <Text
                    style={[
                      theme.typography.labelMedium,
                      {color: isPaused ? '#FFFFFF' : theme.colors.text, fontWeight: '700'},
                    ]}>
                    {isPaused ? 'Resume All' : 'Pause All'}
                  </Text>
                </AnimatedButton>

                {(pendingCount > 0 || processingCount > 0) && (
                  <AnimatedButton
                    onPress={handleCancelQueue}
                    variant="danger"
                    size="sm"
                    style={{flex: 1}}>
                    <Icon name="progress-close" size={16} color="#FFFFFF" />
                    <Text style={[theme.typography.labelMedium, {color: '#FFFFFF', fontWeight: '700'}]}>
                      Cancel Queue
                    </Text>
                  </AnimatedButton>
                )}

                {failedCount > 0 && (
                  <AnimatedButton
                    onPress={() => CompressionQueueService.retryAllFailed()}
                    variant="secondary"
                    size="sm"
                    style={{flex: 1}}>
                    <Icon name="refresh" size={16} color="#FFFFFF" />
                    <Text style={[theme.typography.labelMedium, {color: '#FFFFFF', fontWeight: '700'}]}>
                      Retry All
                    </Text>
                  </AnimatedButton>
                )}
              </View>
            </Card>
          </Animated.View>

          {/* Jobs List */}
          <FlatList
            data={jobs}
            keyExtractor={item => item.id}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 30,
              gap: 10,
            }}
            showsVerticalScrollIndicator={false}
            renderItem={({item: job, index}) => {
              const isProcessing = job.status === 'processing';
              const isCompleted = job.status === 'completed';
              const isFailed = job.status === 'failed';
              const isInterrupted = job.status === 'interrupted';
              const isCancelled = job.status === 'cancelled';
              const isPending = job.status === 'pending';

              return (
                <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 25).springify()}>
                  <Card style={styles.jobCard} padding={14}>
                    <View style={styles.jobTopRow}>
                      {/* Status Icon */}
                      <View
                        style={[
                          styles.statusIconBox,
                          {
                            backgroundColor: isCompleted
                              ? `${theme.colors.success}18`
                              : isProcessing
                              ? `${theme.colors.primary}18`
                              : isFailed || isInterrupted
                              ? `${theme.colors.error}18`
                              : isCancelled
                              ? 'rgba(150,150,150,0.1)'
                              : `${theme.colors.secondary}18`,
                          },
                        ]}>
                        <Icon
                          name={
                            isCompleted
                              ? 'check-bold'
                              : isProcessing
                              ? 'progress-upload'
                              : isFailed
                              ? 'alert-circle'
                              : isInterrupted
                              ? 'alert'
                              : isCancelled
                              ? 'cancel'
                              : 'clock-outline'
                          }
                          size={18}
                          color={
                            isCompleted
                              ? theme.colors.success
                              : isProcessing
                              ? theme.colors.primary
                              : isFailed || isInterrupted
                              ? theme.colors.error
                              : isCancelled
                              ? theme.colors.textTertiary
                              : theme.colors.secondary
                          }
                        />
                      </View>

                      {/* Job Title & Info */}
                      <View style={styles.jobInfo}>
                        <Text
                          style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}
                          numberOfLines={1}>
                          {job.name}
                        </Text>
                        <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary, marginTop: 2}]}>
                          {job.totalFiles} {job.type === 'video' ? 'video' : 'photo'}{job.totalFiles > 1 ? 's' : ''} ·{' '}
                          {StorageService.formatBytes(job.originalSizeBytes)}
                        </Text>
                      </View>

                      {/* Status Badge */}
                      <View
                        style={[
                          styles.jobStatusBadge,
                          {
                            backgroundColor: isCompleted
                              ? theme.colors.successContainer
                              : isProcessing
                              ? theme.colors.primaryContainer
                              : isFailed || isInterrupted
                              ? theme.colors.errorContainer
                              : theme.colors.surfaceVariant,
                          },
                        ]}>
                        <Text
                          style={[
                            theme.typography.labelSmall,
                            {
                              color: isCompleted
                                ? theme.colors.success
                                : isProcessing
                                ? theme.colors.primary
                                : isFailed || isInterrupted
                                ? theme.colors.error
                                : theme.colors.textSecondary,
                              fontWeight: '700',
                            },
                          ]}>
                          {isCompleted
                            ? `Saved ${StorageService.formatBytes(job.actualSavedBytes)}`
                            : isProcessing
                            ? `${job.progress}%`
                            : isInterrupted
                            ? 'Interrupted'
                            : isFailed
                            ? 'Failed'
                            : isCancelled
                            ? 'Cancelled'
                            : 'Waiting'}
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar if processing */}
                    {isProcessing && (
                      <View style={styles.progressSection}>
                        <View style={[styles.progressBarTrack, {backgroundColor: theme.colors.borderLight}]}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {width: `${job.progress}%`, backgroundColor: theme.colors.primary},
                            ]}
                          />
                        </View>
                        {job.currentFileName && (
                          <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary, marginTop: 4, fontSize: 11}]} numberOfLines={1}>
                            Compressing: {job.currentFileName} ({job.completedFiles}/{job.totalFiles})
                          </Text>
                        )}
                      </View>
                    )}

                    {/* Error message */}
                    {(isFailed || isInterrupted) && job.error && (
                      <Text style={[theme.typography.bodySmall, {color: theme.colors.error, marginTop: 6, fontSize: 11}]}>
                        {job.error}
                      </Text>
                    )}

                    {/* Job Actions Row */}
                    <View style={[styles.jobActionsRow, {borderTopColor: theme.colors.borderLight}]}>
                      {(isFailed || isInterrupted || isCancelled) && (
                        <TouchableOpacity
                          style={[styles.smallActionBtn, {backgroundColor: theme.colors.surfaceVariant}]}
                          onPress={() => handleRetryJob(job.id)}>
                          <Icon name="refresh" size={14} color={theme.colors.primary} />
                          <Text style={[theme.typography.labelSmall, {color: theme.colors.primary, fontWeight: '700'}]}>
                            Retry
                          </Text>
                        </TouchableOpacity>
                      )}

                      {isProcessing && (
                        <TouchableOpacity
                          style={[styles.smallActionBtn, {backgroundColor: theme.colors.errorContainer}]}
                          onPress={() => handleCancelJob(job.id)}>
                          <Icon name="close" size={14} color={theme.colors.error} />
                          <Text style={[theme.typography.labelSmall, {color: theme.colors.error, fontWeight: '700'}]}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                      )}

                      {isPending && (
                        <TouchableOpacity
                          style={[styles.smallActionBtn, {backgroundColor: theme.colors.surfaceVariant}]}
                          onPress={() => handleCancelJob(job.id)}>
                          <Icon name="close" size={14} color={theme.colors.textSecondary} />
                          <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary}]}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                      )}

                      {(isCompleted || isCancelled || isFailed || isInterrupted) && (
                        <TouchableOpacity
                          style={[styles.smallActionBtn, {backgroundColor: theme.colors.surfaceVariant}]}
                          onPress={() => handleDeleteJob(job.id)}>
                          <Icon name="trash-can-outline" size={14} color={theme.colors.textTertiary} />
                          <Text style={[theme.typography.labelSmall, {color: theme.colors.textTertiary}]}>
                            Remove
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </Card>
                </Animated.View>
              );
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  container: {flex: 1},
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  jobCard: {
    borderRadius: 16,
  },
  jobTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobInfo: {
    flex: 1,
  },
  jobStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  progressSection: {
    marginTop: 10,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  jobActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
});
