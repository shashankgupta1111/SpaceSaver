import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  useAnimatedScrollHandler,
  FadeInDown,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery} from '@tanstack/react-query';
import {BarChart} from 'react-native-gifted-charts';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList} from '../../app/navigation/types';
import {StorageService, StorageInfo} from '../../shared/services/StorageService';
import {MediaService, LargeFile} from '../../shared/services/MediaService';
import {HistoryService} from '../../shared/services/HistoryService';
import {SmartCleanupService} from '../../shared/services/SmartCleanupService';
import {SmartRecommendationService} from '../../shared/services/SmartRecommendationService';
import {CompressionQueueService} from '../../shared/services/CompressionQueueService';
import Card from '../../shared/components/Card';
import StoragePieChart from '../../shared/components/StoragePieChart';
import AnimatedButton from '../../shared/components/AnimatedButton';
import {MilestoneModal} from '../../shared/components/MilestoneModal';
import {VideoThumbnail} from '../../shared/components/VideoThumbnail';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
type Nav = NativeStackNavigationProp<RootStackParamList>;

function StorageBar({
  usedPercent,
  colors,
}: {
  usedPercent: number;
  colors: Record<string, string>;
}) {
  const barWidth = useSharedValue(0);
  React.useEffect(() => {
    barWidth.value = withTiming(usedPercent / 100, {duration: 1200});
  }, [usedPercent, barWidth]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%` as `${number}%`,
  }));
  return (
    <View
      style={[
        styles.storageBar,
        {backgroundColor: colors.storageFree},
      ]}>
      <Animated.View
        style={[
          styles.storageBarFill,
          {backgroundColor: colors.storageUsed},
          barStyle,
        ]}
      />
    </View>
  );
}

export default function HomeScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });

  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [1, 0.8]),
  }));

  const {data: storageInfo, refetch, isLoading} = useQuery<StorageInfo>({
    queryKey: ['storageInfo'],
    queryFn: () => StorageService.getStorageInfo(),
    staleTime: 30000,
  });

  const weeklyStats = StorageService.getWeeklyStats();
  const recentItems = HistoryService.getRecentItems(5);

  // Largest-files preview — only query if media access is already granted so
  // opening Home never triggers a permission prompt on its own.
  const [mediaAllowed, setMediaAllowed] = useState(false);
  useEffect(() => {
    MediaService.hasMediaPermission().then(setMediaAllowed);
  }, []);

  const {data: largestFiles = []} = useQuery({
    queryKey: ['largestMedia', 20],
    queryFn: () => MediaService.getLargestMedia(20),
    enabled: mediaAllowed,
    staleTime: 60_000,
  });
  const largestPreview = largestFiles.slice(0, 4);

  // Active queue count
  const [queueCount, setQueueCount] = useState<number>(
    () => CompressionQueueService.getJobs().filter(j => j.status === 'pending' || j.status === 'processing').length,
  );

  useEffect(() => {
    return CompressionQueueService.subscribe(jobs => {
      setQueueCount(jobs.filter(j => j.status === 'pending' || j.status === 'processing').length);
    });
  }, []);

  // Smart Recommendations
  const {data: recommendationsReport} = useQuery({
    queryKey: ['smartRecommendationsReport'],
    queryFn: () => SmartRecommendationService.generateRecommendations(false),
    enabled: mediaAllowed,
    staleTime: 60_000,
  });

  // Celebrate savings milestones (1/5/10… GB) once each.
  const [milestone, setMilestone] = useState<number | null>(null);
  useEffect(() => {
    const crossed = StorageService.checkMilestone();
    if (crossed) {
      setMilestone(crossed);
    }
  }, [storageInfo?.savedByApp]);

  const usedPercent = storageInfo
    ? (storageInfo.usedStorage / storageInfo.totalStorage) * 100
    : 0;
  const savedPercent = storageInfo
    ? (storageInfo.savedByApp / storageInfo.totalStorage) * 100
    : 0;

  const {data: cleanupSummary} = useQuery({
    queryKey: ['smartCleanupSummary'],
    queryFn: () => SmartCleanupService.getQuickSummary(),
    enabled: mediaAllowed,
    staleTime: 60_000,
  });

  const health =
    cleanupSummary?.health ??
    (storageInfo
      ? SmartCleanupService.calculateHealthScore(
          storageInfo.usedStorage,
          storageInfo.totalStorage,
          storageInfo.freeStorage,
          0,
        )
      : null);
  const potentialSavings = cleanupSummary?.totalPotentialSavingsBytes ?? 0;

  const barData = weeklyStats.map(s => ({
    value: s.saved / (1024 * 1024),
    label: s.day,
    frontColor: theme.colors.primary,
    gradientColor: theme.colors.secondary,
  }));

  const hasSmartRecommendations =
    (recommendationsReport?.totalEstimatedSavingsBytes ?? 0) > 15 * 1024 * 1024 &&
    (recommendationsReport?.totalCount ?? 0) > 0;

  return (
    <View style={[styles.root, {backgroundColor: theme.colors.background}]}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingTop: insets.top, paddingBottom: insets.bottom + 100},
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={theme.colors.primary}
          />
        }>
        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <View>
            <Text
              style={[
                theme.typography.headlineMedium,
                {color: theme.colors.text, fontWeight: '700'},
              ]}>
              SpaceSaver
            </Text>
            <Text
              style={[
                theme.typography.bodyMedium,
                {color: theme.colors.textSecondary},
              ]}>
              Free up your storage
            </Text>
          </View>

          <View style={styles.headerRightRow}>
            {queueCount > 0 && (
              <TouchableOpacity
                onPress={() => navigation.navigate('CompressionQueue')}
                style={[
                  styles.queueBtn,
                  {backgroundColor: theme.colors.primaryContainer},
                ]}>
                <Icon name="tray-full" size={18} color={theme.colors.primary} />
                <Text
                  style={[
                    theme.typography.labelSmall,
                    {color: theme.colors.primary, fontWeight: '800'},
                  ]}>
                  {queueCount}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => navigation.navigate('History')}
              style={[
                styles.historyBtn,
                {backgroundColor: theme.colors.primaryContainer},
              ]}>
              <Icon name="history" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Main Storage Card */}
        <Card style={[styles.storageCard, theme.elevation.xl]} padding={0}>
          <LinearGradient
            colors={theme.colors.gradientPrimary}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.storageGradient}>
            <View style={styles.storageTop}>
              <View style={styles.storageLeft}>
                <Text
                  style={[
                    theme.typography.labelLarge,
                    {color: 'rgba(255,255,255,0.75)', marginBottom: 6},
                  ]}>
                  STORAGE USAGE
                </Text>
                <Text
                  style={[
                    theme.typography.numericLarge,
                    {color: 'white', marginBottom: 2},
                  ]}>
                  {storageInfo
                    ? StorageService.formatBytes(storageInfo.usedStorage)
                    : '—'}
                </Text>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: 'rgba(255,255,255,0.7)'},
                  ]}>
                  of{' '}
                  {storageInfo
                    ? StorageService.formatBytes(storageInfo.totalStorage)
                    : '—'}{' '}
                  used
                </Text>
              </View>
              <StoragePieChart
                usedPercent={usedPercent}
                savedPercent={savedPercent}
                size={110}
              />
            </View>

            <StorageBar
              usedPercent={usedPercent}
              colors={{
                storageUsed: 'rgba(255,255,255,0.9)',
                storageFree: 'rgba(255,255,255,0.2)',
              }}
            />

            <View style={styles.storageStats}>
              <View style={styles.statItem}>
                <View
                  style={[
                    styles.statDot,
                    {backgroundColor: 'rgba(255,255,255,0.9)'},
                  ]}
                />
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: 'rgba(255,255,255,0.8)'},
                  ]}>
                  {storageInfo
                    ? StorageService.formatBytes(storageInfo.freeStorage)
                    : '—'}{' '}
                  free
                </Text>
              </View>
              <View style={styles.statItem}>
                <View
                  style={[styles.statDot, {backgroundColor: '#4ADE80'}]}
                />
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: 'rgba(255,255,255,0.8)'},
                  ]}>
                  {storageInfo
                    ? StorageService.formatBytes(storageInfo.savedByApp)
                    : '0 B'}{' '}
                  saved by app
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Card>

        {/* Today's savings badge */}
        <View style={styles.todayRow}>
          <View
            style={[
              styles.todayBadge,
              {backgroundColor: theme.colors.successContainer},
            ]}>
            <Icon name="leaf" size={14} color={theme.colors.success} />
            <Text
              style={[
                theme.typography.labelMedium,
                {color: theme.colors.success},
              ]}>
              Today:{' '}
              {storageInfo
                ? StorageService.formatBytes(storageInfo.savedToday)
                : '0 B'}{' '}
              freed
            </Text>
          </View>
        </View>

        {/* Storage Health & Smart Cleanup Featured Card */}
        <Animated.View entering={FadeInDown.delay(50).springify()}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => navigation.navigate('SmartCleanup')}>
            <Card style={styles.smartCleanupCard} padding={16}>
              <View style={styles.smartCleanupRow}>
                <View
                  style={[
                    styles.healthCircleBadge,
                    {
                      backgroundColor: `${health?.color ?? theme.colors.primary}18`,
                      borderColor: health?.color ?? theme.colors.primary,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.healthScoreSmall,
                      {color: health?.color ?? theme.colors.primary},
                    ]}>
                    {health?.score ?? 85}
                  </Text>
                  <Text
                    style={[
                      styles.healthScoreLabel,
                      {color: health?.color ?? theme.colors.primary},
                    ]}>
                    HEALTH
                  </Text>
                </View>

                <View style={styles.smartCleanupTextContainer}>
                  <View style={styles.healthStatusRow}>
                    <Text
                      style={[
                        theme.typography.titleSmall,
                        {color: theme.colors.text, fontWeight: '700'},
                      ]}>
                      Storage Health · {health?.status ?? 'Healthy'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      theme.typography.bodySmall,
                      {color: theme.colors.textSecondary, marginTop: 2},
                    ]}>
                    {potentialSavings > 0
                      ? `You could free up ~${StorageService.formatBytes(potentialSavings)}`
                      : 'Storage optimized & clean'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.smartCleanupActionBtn,
                    {backgroundColor: theme.colors.primary},
                  ]}>
                  <Icon name="broom" size={16} color="#FFFFFF" />
                  <Text
                    style={[
                      theme.typography.labelSmall,
                      {color: '#FFFFFF', fontWeight: '700'},
                    ]}>
                    Clean
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        </Animated.View>

        {/* Phase 2: Compact Smart Recommendation Section on Home */}
        {hasSmartRecommendations && (
          <Animated.View entering={FadeInDown.delay(80).springify()}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => navigation.navigate('SmartRecommendations')}>
              <Card style={styles.compactRecCard} padding={16}>
                <View style={styles.compactRecRow}>
                  <View style={[styles.compactRecIconBox, {backgroundColor: theme.colors.primaryContainer}]}>
                    <Icon name="creation" size={24} color={theme.colors.primary} />
                  </View>

                  <View style={styles.compactRecContent}>
                    <View style={styles.compactRecTitleRow}>
                      <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary, fontWeight: '700'}]}>
                        SMART RECOMMENDATION
                      </Text>
                      <View style={[styles.compactRecSavingsPill, {backgroundColor: theme.colors.successContainer}]}>
                        <Text style={[theme.typography.labelSmall, {color: theme.colors.success, fontWeight: '800'}]}>
                          ~{StorageService.formatBytes(recommendationsReport?.totalEstimatedSavingsBytes ?? 0)}
                        </Text>
                      </View>
                    </View>

                    <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700', marginTop: 2}]}>
                      You could save ~{StorageService.formatBytes(recommendationsReport?.totalEstimatedSavingsBytes ?? 0)}
                    </Text>

                    <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary, marginTop: 2}]}>
                      {recommendationsReport?.videoCount ?? 0} large videos and {recommendationsReport?.photoCount ?? 0} photos could be compressed.
                    </Text>
                  </View>

                  <View style={[styles.compactRecReviewBtn, {backgroundColor: theme.colors.primary}]}>
                    <Text style={[theme.typography.labelSmall, {color: '#FFFFFF', fontWeight: '700'}]}>
                      Review
                    </Text>
                    <Icon name="chevron-right" size={14} color="#FFFFFF" />
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Tools & Functions Grid */}
        <Text
          style={[
            theme.typography.titleMedium,
            styles.sectionTitle,
            {color: theme.colors.text, fontWeight: '700'},
          ]}>
          Core Functions & Tools
        </Text>

        <View style={styles.actionsGrid}>
          {/* Format Converter Card */}
          <TouchableOpacity
            style={[styles.fullToolCard, {backgroundColor: theme.colors.surface, borderColor: theme.colors.border}]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('FormatConverter')}>
            <LinearGradient
              colors={['#8B5CF6', '#6366F1']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.fullToolGradient}>
              <View style={styles.fullToolHeader}>
                <View style={styles.fullToolIconBox}>
                  <Icon name="file-replace-outline" size={26} color="white" />
                </View>
                <View style={styles.badgeLossless}>
                  <Text style={styles.badgeLosslessText}>100% Quality</Text>
                </View>
              </View>
              <Text style={[theme.typography.titleMedium, {color: 'white', fontWeight: '700', marginTop: 10}]}>
                Format Converter
              </Text>
              <Text style={[theme.typography.bodySmall, {color: 'rgba(255,255,255,0.85)', marginTop: 2}]}>
                Convert PNG, HEIC, JPEG, MP4, MOV, MKV without losing quality
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Compress Photos & Compress Videos row */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Main', {screen: 'Images'})}>
              <LinearGradient
                colors={['#5B5FEF', '#7C4DFF']}
                style={styles.actionGradient}>
                <View
                  style={[
                    styles.actionIcon,
                    {backgroundColor: 'rgba(255,255,255,0.2)'},
                  ]}>
                  <Icon name="image-multiple" size={26} color="white" />
                </View>
                <Text
                  style={[
                    theme.typography.titleSmall,
                    {color: 'white', marginTop: 10, fontWeight: '700'},
                  ]}>
                  Compress Photos
                </Text>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: 'rgba(255,255,255,0.8)'},
                  ]}>
                  Save space
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Main', {screen: 'Videos'})}>
              <LinearGradient
                colors={['#06B6D4', '#3B82F6']}
                style={styles.actionGradient}>
                <View
                  style={[
                    styles.actionIcon,
                    {backgroundColor: 'rgba(255,255,255,0.2)'},
                  ]}>
                  <Icon name="video" size={26} color="white" />
                </View>
                <Text
                  style={[
                    theme.typography.titleSmall,
                    {color: 'white', marginTop: 10, fontWeight: '700'},
                  ]}>
                  Compress Videos
                </Text>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: 'rgba(255,255,255,0.8)'},
                  ]}>
                  Save space
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Phase 2 Cleanup Workflows */}
        <Text
          style={[
            theme.typography.titleMedium,
            styles.sectionTitle,
            {color: theme.colors.text, fontWeight: '700'},
          ]}>
          Smart Cleanup Workflows
        </Text>

        {/* Screenshot Manager */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('ScreenshotManager')}
          style={styles.dupCard}>
          <View
            style={[
              styles.dupIcon,
              {backgroundColor: `${theme.colors.warning}18`},
            ]}>
            <Icon name="cellphone-screenshot" size={24} color={theme.colors.warning} />
          </View>
          <View style={styles.dupInfo}>
            <Text style={[theme.typography.titleSmall, {color: theme.colors.text}]}>
              Screenshot Manager
            </Text>
            <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
              Group & clean up old screenshots by date periods
            </Text>
          </View>
          <Icon name="chevron-right" size={22} color={theme.colors.textTertiary} />
        </TouchableOpacity>

        {/* Older Media Finder */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('OldMedia')}
          style={styles.dupCard}>
          <View
            style={[
              styles.dupIcon,
              {backgroundColor: `${theme.colors.secondary}18`},
            ]}>
            <Icon name="clock-outline" size={24} color={theme.colors.secondary} />
          </View>
          <View style={styles.dupInfo}>
            <Text style={[theme.typography.titleSmall, {color: theme.colors.text}]}>
              Old Media Finder
            </Text>
            <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
              Filter files not modified recently (30d, 90d, 6m, 1y)
            </Text>
          </View>
          <Icon name="chevron-right" size={22} color={theme.colors.textTertiary} />
        </TouchableOpacity>

        {/* Duplicates */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Duplicates')}
          style={styles.dupCard}>
          <View
            style={[
              styles.dupIcon,
              {backgroundColor: theme.colors.primaryContainer},
            ]}>
            <Icon name="image-multiple-outline" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.dupInfo}>
            <Text
              style={[theme.typography.titleSmall, {color: theme.colors.text}]}>
              Find Duplicate Photos
            </Text>
            <Text
              style={[
                theme.typography.bodySmall,
                {color: theme.colors.textSecondary},
              ]}>
              Detect copies & similar shots, keep the best
            </Text>
          </View>
          <Icon name="chevron-right" size={22} color={theme.colors.textTertiary} />
        </TouchableOpacity>

        {/* Similar & Duplicate Videos */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('VideoDuplicates')}
          style={styles.dupCard}>
          <View
            style={[
              styles.dupIcon,
              {backgroundColor: 'rgba(239, 68, 68, 0.15)'},
            ]}>
            <Icon name="video-vintage" size={24} color="#EF4444" />
          </View>
          <View style={styles.dupInfo}>
            <Text style={[theme.typography.titleSmall, {color: theme.colors.text}]}>
              Similar & Duplicate Videos
            </Text>
            <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
              Detect identical recordings and redundant video clips
            </Text>
          </View>
          <Icon name="chevron-right" size={22} color={theme.colors.textTertiary} />
        </TouchableOpacity>

        {/* Cleanup Review Center */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('CleanupReviewCenter')}
          style={styles.dupCard}>
          <View
            style={[
              styles.dupIcon,
              {backgroundColor: 'rgba(99, 102, 241, 0.15)'},
            ]}>
            <Icon name="shield-star-outline" size={24} color="#6366F1" />
          </View>
          <View style={styles.dupInfo}>
            <Text style={[theme.typography.titleSmall, {color: theme.colors.text}]}>
              Cleanup Review Center
            </Text>
            <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
              Priority-sorted review hub for high-impact space saving
            </Text>
          </View>
          <Icon name="chevron-right" size={22} color={theme.colors.textTertiary} />
        </TouchableOpacity>

        {/* Clean by album */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Cleanup')}
          style={styles.dupCard}>
          <View
            style={[
              styles.dupIcon,
              {backgroundColor: theme.colors.primaryContainer},
            ]}>
            <Icon name="folder-multiple-image" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.dupInfo}>
            <Text style={[theme.typography.titleSmall, {color: theme.colors.text}]}>
              Clean by Album
            </Text>
            <Text
              style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
              Screenshots, downloads & app media
            </Text>
          </View>
          <Icon name="chevron-right" size={22} color={theme.colors.textTertiary} />
        </TouchableOpacity>

        {/* Largest Files */}
        {largestPreview.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text
                style={[theme.typography.titleMedium, {color: theme.colors.text}]}>
                Largest Files
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('LargeFiles')}>
                <Text
                  style={[theme.typography.labelLarge, {color: theme.colors.primary}]}>
                  See all
                </Text>
              </TouchableOpacity>
            </View>
            <Card style={styles.largeCard} padding={0}>
              {largestPreview.map((file: LargeFile, i: number) => (
                <TouchableOpacity
                  key={file.uri}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('LargeFiles')}
                  style={[
                    styles.largeRow,
                    i < largestPreview.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.colors.borderLight,
                    },
                  ]}>
                  {file.type === 'image' ? (
                    <Image
                      source={{uri: file.uri}}
                      style={styles.largeThumb}
                      resizeMode="cover"
                      resizeMethod="resize"
                    />
                  ) : (
                    <VideoThumbnail
                      videoUri={file.uri}
                      style={styles.largeThumb}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.largeInfo}>
                    <Text
                      style={[theme.typography.bodyMedium, {color: theme.colors.text}]}
                      numberOfLines={1}>
                      {file.filename}
                    </Text>
                    <Text
                      style={[
                        theme.typography.bodySmall,
                        {color: theme.colors.textSecondary},
                      ]}>
                      {file.type === 'video' ? 'Video' : 'Photo'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      theme.typography.titleSmall,
                      {color: theme.colors.primary, fontWeight: '700'},
                    ]}>
                    {StorageService.formatBytes(file.fileSize)}
                  </Text>
                </TouchableOpacity>
              ))}
            </Card>
          </>
        )}

        {/* Recent Files */}
        {recentItems.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text
                style={[
                  theme.typography.titleMedium,
                  {color: theme.colors.text},
                ]}>
                Recent Compressions
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('History')}>
                <Text
                  style={[
                    theme.typography.labelLarge,
                    {color: theme.colors.primary},
                  ]}>
                  See all
                </Text>
              </TouchableOpacity>
            </View>
            {recentItems.map(item => (
              <Card key={item.id} style={styles.recentCard}>
                <View style={styles.recentRow}>
                  <View
                    style={[
                      styles.recentIcon,
                      {backgroundColor: theme.colors.primaryContainer},
                    ]}>
                    <Icon
                      name={item.type === 'image' ? 'image' : 'video'}
                      size={18}
                      color={theme.colors.primary}
                    />
                  </View>
                  <View style={styles.recentInfo}>
                    <Text
                      style={[
                        theme.typography.bodyMedium,
                        {color: theme.colors.text},
                      ]}
                      numberOfLines={1}>
                      {item.fileName}
                    </Text>
                    <Text
                      style={[
                        theme.typography.bodySmall,
                        {color: theme.colors.textSecondary},
                      ]}>
                      {StorageService.formatBytes(item.originalSize)} →{' '}
                      {StorageService.formatBytes(item.compressedSize)}
                    </Text>
                  </View>
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
                      -{item.savedPercent}%
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}

        {/* Weekly Chart */}
        <View style={styles.sectionHeader}>
          <Text
            style={[theme.typography.titleMedium, {color: theme.colors.text}]}>
            Weekly Savings
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Insights')}>
            <Text style={[theme.typography.labelLarge, {color: theme.colors.primary}]}>
              Insights
            </Text>
          </TouchableOpacity>
        </View>
        <Card style={styles.chartCard}>
          {barData.some(d => d.value > 0) ? (
            <BarChart
              data={barData}
              width={SCREEN_WIDTH - 80}
              height={160}
              barWidth={28}
              spacing={12}
              roundedTop
              roundedBottom
              hideRules
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{
                color: theme.colors.textTertiary,
                fontSize: 10,
              }}
              xAxisLabelTextStyle={{
                color: theme.colors.textSecondary,
                fontSize: 11,
              }}
              noOfSections={4}
              maxValue={
                Math.max(...barData.map(d => d.value), 10)
              }
              isAnimated
              animationDuration={800}
              showGradient
            />
          ) : (
            <View style={styles.chartEmpty}>
              <Icon
                name="chart-bar"
                size={40}
                color={theme.colors.textTertiary}
              />
              <Text
                style={[
                  theme.typography.bodyMedium,
                  {color: theme.colors.textSecondary, marginTop: 8},
                ]}>
                Compress files to see your savings
              </Text>
            </View>
          )}
        </Card>
      </Animated.ScrollView>

      <MilestoneModal
        visible={milestone !== null}
        milestoneBytes={milestone ?? 0}
        onClose={() => setMilestone(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  scrollContent: {paddingHorizontal: 20, gap: 0},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  queueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
  },
  historyBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storageCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
  },
  storageGradient: {
    padding: 24,
  },
  storageTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  storageLeft: {flex: 1},
  storageBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  storageBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  storageStats: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  todayRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  todayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  sectionTitle: {
    marginBottom: 12,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  actionsGrid: {
    gap: 12,
    marginBottom: 24,
  },
  fullToolCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  fullToolGradient: {
    padding: 18,
    borderRadius: 20,
  },
  fullToolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fullToolIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLossless: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeLosslessText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  actionGradient: {
    padding: 20,
    borderRadius: 20,
    minHeight: 140,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(91,95,239,0.25)',
  },
  dupIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dupInfo: {flex: 1, gap: 2},
  largeCard: {
    marginBottom: 24,
    paddingHorizontal: 14,
  },
  largeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  largeThumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  largeInfo: {flex: 1, gap: 2},
  recentCard: {
    marginBottom: 8,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentInfo: {flex: 1},
  savedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chartCard: {
    marginBottom: 16,
    padding: 16,
    overflow: 'hidden',
  },
  chartEmpty: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  smartCleanupCard: {
    borderRadius: 20,
    marginBottom: 14,
  },
  smartCleanupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  healthCircleBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthScoreSmall: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },
  healthScoreLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  smartCleanupTextContainer: {
    flex: 1,
  },
  healthStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smartCleanupActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  compactRecCard: {
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  compactRecRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactRecIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactRecContent: {
    flex: 1,
  },
  compactRecTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  compactRecSavingsPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  compactRecReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
});
