import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {FadeInDown, FadeIn} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList} from '../../app/navigation/types';
import {
  SmartCleanupService,
  SmartCleanupReport,
  CleanupCategory,
} from '../../shared/services/SmartCleanupService';
import {SmartRecommendationService} from '../../shared/services/SmartRecommendationService';
import {CompressionQueueService} from '../../shared/services/CompressionQueueService';
import {StorageService} from '../../shared/services/StorageService';
import Card from '../../shared/components/Card';
import HeaderBar from '../../shared/components/HeaderBar';
import AnimatedButton from '../../shared/components/AnimatedButton';
import Loader from '../../shared/components/Loader';
import CircularProgress from '../../shared/components/CircularProgress';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SmartCleanupScreen() {
  const {theme, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusText, setScanStatusText] = useState('Initializing scan...');
  const [report, setReport] = useState<SmartCleanupReport | null>(null);

  // "Free Up Space" Category Checklist Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());

  // Active queue count
  const [queueCount, setQueueCount] = useState<number>(
    () => CompressionQueueService.getJobs().filter(j => j.status === 'pending' || j.status === 'processing').length,
  );

  useEffect(() => {
    return CompressionQueueService.subscribe(jobs => {
      setQueueCount(jobs.filter(j => j.status === 'pending' || j.status === 'processing').length);
    });
  }, []);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await SmartCleanupService.getQuickSummary();
      setReport(summary);
      setSelectedCategoryIds(new Set(summary.categories.map(c => c.id)));
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleFullScan = async () => {
    setScanning(true);
    setScanProgress(0);
    try {
      const fullReport = await SmartCleanupService.performFullScan((progress, text) => {
        setScanProgress(progress);
        setScanStatusText(text);
      });
      setReport(fullReport);
      setSelectedCategoryIds(new Set(fullReport.categories.map(c => c.id)));
    } catch {
      // Handle scan error
    } finally {
      setScanning(false);
    }
  };

  const toggleCategorySelection = (id: string) => {
    setSelectedCategoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedSavings = report?.categories
    .filter(c => selectedCategoryIds.has(c.id))
    .reduce((sum, c) => sum + c.potentialSavingsBytes, 0) ?? 0;

  const handleCategoryPress = (category: CleanupCategory) => {
    if (category.route === 'ScreenshotManager') {
      navigation.navigate('ScreenshotManager');
    } else if (category.route === 'OldMedia') {
      navigation.navigate('OldMedia');
    } else if (category.route === 'AlbumDetail' && category.routeParams) {
      navigation.navigate('AlbumDetail', category.routeParams);
    } else if (category.route === 'Duplicates') {
      navigation.navigate('Duplicates');
    } else if (category.route === 'LargeFiles') {
      navigation.navigate('LargeFiles');
    } else if (category.route === 'Cleanup') {
      navigation.navigate('Cleanup');
    } else {
      navigation.navigate('Main', {screen: 'Images'});
    }
  };

  const handleStartReview = () => {
    setShowReviewModal(false);
    const selected = report?.categories.filter(c => selectedCategoryIds.has(c.id)) ?? [];
    if (selected.length > 0) {
      handleCategoryPress(selected[0]);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, {backgroundColor: theme.colors.background}]}>
        <HeaderBar title="Smart Cleanup" showBack />
        <View style={styles.centerContainer}>
          <Loader fullscreen label="Analyzing storage opportunities..." />
        </View>
      </View>
    );
  }

  if (scanning) {
    return (
      <View style={[styles.root, {backgroundColor: theme.colors.background}]}>
        <HeaderBar title="Smart Cleanup" showBack />
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
            Scanning Your Media
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

  const health = report?.health;
  const categories = report?.categories ?? [];
  const breakdown = report?.breakdown;

  return (
    <View style={[styles.root, {backgroundColor: theme.colors.background}]}>
      <HeaderBar
        title="Smart Cleanup"
        subtitle="Intelligent storage optimization"
        showBack
        rightActions={
          <View style={styles.headerRightRow}>
            {queueCount > 0 && (
              <TouchableOpacity
                onPress={() => navigation.navigate('CompressionQueue')}
                style={[styles.queueBadgeBtn, {backgroundColor: theme.colors.primaryContainer}]}>
                <Icon name="tray-full" size={16} color={theme.colors.primary} />
                <Text style={[theme.typography.labelSmall, {color: theme.colors.primary, fontWeight: '800'}]}>
                  {queueCount}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleFullScan}
              style={[styles.scanIconBtn, {backgroundColor: theme.colors.surfaceVariant}]}>
              <Icon name="refresh" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {paddingBottom: insets.bottom + 100},
        ]}>
        {/* Storage Health & Free Up Hero Card */}
        <Animated.View entering={FadeInDown.delay(50).springify()}>
          <Card style={styles.heroCard} padding={20}>
            <View style={styles.heroTopRow}>
              {/* Circular Health Meter */}
              <View style={styles.healthScoreContainer}>
                <View
                  style={[
                    styles.healthBadgeOuter,
                    {
                      backgroundColor: isDark
                        ? `${health?.color}22`
                        : `${health?.color}18`,
                      borderColor: health?.color,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.healthScoreText,
                      {color: health?.color ?? theme.colors.primary},
                    ]}>
                    {health?.score ?? 85}
                  </Text>
                  <Text
                    style={[
                      theme.typography.labelSmall,
                      {color: health?.color ?? theme.colors.primary, fontWeight: '700'},
                    ]}>
                    HEALTH
                  </Text>
                </View>
              </View>

              {/* Status & Savings info */}
              <View style={styles.heroDetails}>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      {backgroundColor: health?.color ?? theme.colors.success},
                    ]}
                  />
                  <Text
                    style={[
                      theme.typography.titleMedium,
                      {color: theme.colors.text, fontWeight: '700'},
                    ]}>
                    {health?.status ?? 'Healthy'}
                  </Text>
                </View>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: theme.colors.textSecondary, marginTop: 2},
                  ]}>
                  {health?.description}
                </Text>

                <View style={styles.savingsTag}>
                  <Icon name="lightning-bolt" size={16} color={theme.colors.warning} />
                  <Text
                    style={[
                      theme.typography.labelMedium,
                      {color: theme.colors.text, fontWeight: '600'},
                    ]}>
                    Potential Savings:{' '}
                    <Text style={{color: theme.colors.primary, fontWeight: '800'}}>
                      {StorageService.formatBytes(report?.totalPotentialSavingsBytes ?? 0)}
                    </Text>
                  </Text>
                </View>
              </View>
            </View>

            {/* Storage Bar */}
            <View style={styles.meterContainer}>
              <View style={styles.meterLabels}>
                <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
                  Used: {StorageService.formatBytes(health?.usedBytes ?? 0)} ({health?.usedPercent}%)
                </Text>
                <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
                  Free: {StorageService.formatBytes(health?.freeBytes ?? 0)}
                </Text>
              </View>
              <View
                style={[
                  styles.progressBarTrack,
                  {backgroundColor: theme.colors.surfaceVariant},
                ]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${health?.usedPercent ?? 50}%`,
                      backgroundColor: health?.color ?? theme.colors.primary,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Prominent Free Up Action Button */}
            {categories.length > 0 && (
              <AnimatedButton
                onPress={() => setShowReviewModal(true)}
                variant="primary"
                gradient
                size="lg"
                fullWidth
                style={{marginTop: 16}}>
                <Icon name="broom" size={20} color="#FFFFFF" />
                <Text style={[theme.typography.titleSmall, {color: '#FFFFFF', fontWeight: '700'}]}>
                  Free Up ~{StorageService.formatBytes(report?.totalPotentialSavingsBytes ?? 0)}
                </Text>
              </AnimatedButton>
            )}
          </Card>
        </Animated.View>

        {/* Smart Compression Recommendations Featured Card */}
        <Animated.View entering={FadeInDown.delay(80).springify()}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => navigation.navigate('SmartRecommendations')}>
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.recommendationsGradientCard}>
              <View style={styles.recCardHeader}>
                <View style={styles.recIconBox}>
                  <Icon name="creation" size={22} color="#FFFFFF" />
                </View>
                <View style={{flex: 1}}>
                  <Text style={[theme.typography.titleMedium, {color: '#FFFFFF', fontWeight: '700'}]}>
                    Smart Recommendations
                  </Text>
                  <Text style={[theme.typography.bodySmall, {color: 'rgba(255,255,255,0.85)', marginTop: 2}]}>
                    Tailored compression presets based on resolution & size
                  </Text>
                </View>
                <Icon name="chevron-right" size={22} color="rgba(255,255,255,0.7)" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Phase 3: Cleanup Review Center Action Card */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => navigation.navigate('CleanupReviewCenter')}>
            <LinearGradient
              colors={['#4F46E5', '#3B82F6']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={[styles.recommendationsGradientCard, {marginTop: 10}]}>
              <View style={styles.recCardHeader}>
                <View style={styles.recIconBox}>
                  <Icon name="shield-star-outline" size={22} color="#FFFFFF" />
                </View>
                <View style={{flex: 1}}>
                  <Text style={[theme.typography.titleMedium, {color: '#FFFFFF', fontWeight: '700'}]}>
                    Cleanup Review Center
                  </Text>
                  <Text style={[theme.typography.bodySmall, {color: 'rgba(255,255,255,0.85)', marginTop: 2}]}>
                    Priority-sorted review hub for high-impact space saving
                  </Text>
                </View>
                <Icon name="chevron-right" size={22} color="rgba(255,255,255,0.7)" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Smart Cleanup Opportunities */}
        <Animated.View entering={FadeInDown.delay(120).springify()}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[theme.typography.titleMedium, {color: theme.colors.text, fontWeight: '700'}]}>
              Cleanup Opportunities
            </Text>
            <Text style={[theme.typography.labelSmall, {color: theme.colors.textTertiary}]}>
              {categories.length} FOUND
            </Text>
          </View>

          {categories.length === 0 ? (
            <Card style={styles.emptyCard} padding={24}>
              <Icon name="check-decagram" size={48} color={theme.colors.success} />
              <Text
                style={[
                  theme.typography.titleMedium,
                  {color: theme.colors.text, fontWeight: '700', marginTop: 12},
                ]}>
                Storage is Clean
              </Text>
              <Text
                style={[
                  theme.typography.bodyMedium,
                  {color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4},
                ]}>
                No duplicate photos, unnecessary screenshots, or clutter detected.
              </Text>
            </Card>
          ) : (
            <View style={styles.categoriesList}>
              {categories.map(category => (
                <TouchableOpacity
                  key={category.id}
                  activeOpacity={0.75}
                  onPress={() => handleCategoryPress(category)}>
                  <Card style={styles.categoryCard} padding={16}>
                    <View style={styles.categoryRow}>
                      <View
                        style={[
                          styles.categoryIconBadge,
                          {backgroundColor: `${category.iconColor}18`},
                        ]}>
                        <Icon name={category.icon} size={24} color={category.iconColor} />
                      </View>

                      <View style={styles.categoryInfo}>
                        <Text
                          style={[
                            theme.typography.titleSmall,
                            {color: theme.colors.text, fontWeight: '700'},
                          ]}>
                          {category.title}
                        </Text>
                        <Text
                          style={[
                            theme.typography.bodySmall,
                            {color: theme.colors.textSecondary, marginTop: 2},
                          ]}>
                          {category.subtitle}
                        </Text>
                      </View>

                      <View style={styles.categoryAction}>
                        <View
                          style={[
                            styles.savingsBadge,
                            {backgroundColor: theme.colors.successContainer},
                          ]}>
                          <Text
                            style={[
                              theme.typography.labelSmall,
                              {color: theme.colors.success, fontWeight: '800'},
                            ]}>
                            ~{StorageService.formatBytes(category.potentialSavingsBytes)}
                          </Text>
                        </View>
                        <Icon name="chevron-right" size={20} color={theme.colors.textTertiary} />
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>

        {/* What's Taking Space Breakdown */}
        {breakdown && (
          <Animated.View entering={FadeInDown.delay(160).springify()}>
            <View style={[styles.sectionHeaderRow, {marginTop: 24}]}>
              <Text style={[theme.typography.titleMedium, {color: theme.colors.text, fontWeight: '700'}]}>
                What&apos;s Taking Space?
              </Text>
            </View>

            <Card style={styles.breakdownCard} padding={18}>
              {/* Media Distribution Bars */}
              <View style={styles.breakdownRow}>
                <TouchableOpacity
                  style={styles.breakdownItem}
                  onPress={() => navigation.navigate('Main', {screen: 'Videos'})}>
                  <View style={styles.breakdownLabelRow}>
                    <Icon name="video-outline" size={18} color="#7C4DFF" />
                    <Text style={[theme.typography.bodySmall, {color: theme.colors.text}]}>Videos</Text>
                  </View>
                  <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
                    {StorageService.formatBytes(breakdown.videosBytes)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.breakdownItem}
                  onPress={() => navigation.navigate('Main', {screen: 'Images'})}>
                  <View style={styles.breakdownLabelRow}>
                    <Icon name="image-outline" size={18} color="#10B981" />
                    <Text style={[theme.typography.bodySmall, {color: theme.colors.text}]}>Photos</Text>
                  </View>
                  <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
                    {StorageService.formatBytes(breakdown.photosBytes)}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.breakdownRow, {marginTop: 12}]}>
                <TouchableOpacity
                  style={styles.breakdownItem}
                  onPress={() => navigation.navigate('ScreenshotManager')}>
                  <View style={styles.breakdownLabelRow}>
                    <Icon name="cellphone-screenshot" size={18} color="#F59E0B" />
                    <Text style={[theme.typography.bodySmall, {color: theme.colors.text}]}>Screenshots</Text>
                  </View>
                  <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
                    {StorageService.formatBytes(breakdown.screenshotsBytes)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.breakdownItem}
                  onPress={() => navigation.navigate('OldMedia')}>
                  <View style={styles.breakdownLabelRow}>
                    <Icon name="clock-outline" size={18} color="#0EA5E9" />
                    <Text style={[theme.typography.bodySmall, {color: theme.colors.text}]}>Older Media</Text>
                  </View>
                  <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
                    {StorageService.formatBytes(breakdown.downloadsBytes)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Large File Brackets */}
              <View
                style={[
                  styles.bracketsContainer,
                  {borderTopColor: theme.colors.borderLight, backgroundColor: theme.colors.surfaceVariant},
                ]}>
                <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary, marginBottom: 8}]}>
                  LARGEST FILE TIERS
                </Text>
                <View style={styles.bracketsRow}>
                  <TouchableOpacity
                    style={styles.bracketChip}
                    onPress={() => navigation.navigate('LargeFiles')}>
                    <Text style={[theme.typography.labelSmall, {color: theme.colors.primary, fontWeight: '700'}]}>
                      &gt; 1 GB
                    </Text>
                    <Text style={[theme.typography.bodySmall, {color: theme.colors.text}]}>
                      {breakdown.largeFilesBrackets.over1GB} files
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.bracketChip}
                    onPress={() => navigation.navigate('LargeFiles')}>
                    <Text style={[theme.typography.labelSmall, {color: theme.colors.primary, fontWeight: '700'}]}>
                      500MB – 1GB
                    </Text>
                    <Text style={[theme.typography.bodySmall, {color: theme.colors.text}]}>
                      {breakdown.largeFilesBrackets.from500MBto1GB} files
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.bracketChip}
                    onPress={() => navigation.navigate('LargeFiles')}>
                    <Text style={[theme.typography.labelSmall, {color: theme.colors.primary, fontWeight: '700'}]}>
                      100 – 500MB
                    </Text>
                    <Text style={[theme.typography.bodySmall, {color: theme.colors.text}]}>
                      {breakdown.largeFilesBrackets.from100MBto500MB} files
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          </Animated.View>
        )}
      </ScrollView>

      {/* "Free Up Space" Interactive Checklist Modal */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReviewModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalPressable} onPress={() => setShowReviewModal(false)} />
          <View
            style={[
              styles.modalSheet,
              {backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 20},
            ]}>
            <View style={styles.sheetHandle} />

            <Text
              style={[
                theme.typography.titleLarge,
                {color: theme.colors.text, fontWeight: '700', textAlign: 'center'},
              ]}>
              Free Up Storage
            </Text>
            <Text
              style={[
                theme.typography.bodySmall,
                {color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 18},
              ]}>
              Select the categories you want to review and optimize
            </Text>

            <ScrollView style={{maxHeight: 280}} showsVerticalScrollIndicator={false}>
              {categories.map(cat => {
                const isSelected = selectedCategoryIds.has(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    activeOpacity={0.8}
                    onPress={() => toggleCategorySelection(cat.id)}
                    style={[
                      styles.checklistRow,
                      {
                        backgroundColor: isSelected
                          ? `${theme.colors.primary}12`
                          : theme.colors.surfaceVariant,
                        borderColor: isSelected ? theme.colors.primary : 'transparent',
                      },
                    ]}>
                    <Icon
                      name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={24}
                      color={isSelected ? theme.colors.primary : theme.colors.textTertiary}
                    />
                    <View style={{flex: 1, marginLeft: 12}}>
                      <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
                        {cat.title}
                      </Text>
                      <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
                        {cat.itemCount} items
                      </Text>
                    </View>
                    <Text style={[theme.typography.labelMedium, {color: theme.colors.success, fontWeight: '800'}]}>
                      ~{StorageService.formatBytes(cat.potentialSavingsBytes)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Total Reclaimable Summary & Launch Action */}
            <View style={styles.modalFooter}>
              <View style={styles.totalSavingsRow}>
                <Text style={[theme.typography.bodyMedium, {color: theme.colors.textSecondary}]}>
                  Estimated Potential Savings:
                </Text>
                <Text style={[theme.typography.titleMedium, {color: theme.colors.success, fontWeight: '800'}]}>
                  {StorageService.formatBytes(selectedSavings)}
                </Text>
              </View>

              <AnimatedButton
                onPress={handleStartReview}
                variant="primary"
                gradient
                size="lg"
                fullWidth
                disabled={selectedCategoryIds.size === 0}>
                <Icon name="arrow-right-circle-outline" size={20} color="#FFFFFF" />
                <Text style={[theme.typography.titleSmall, {color: '#FFFFFF', fontWeight: '700'}]}>
                  Start Guided Review ({selectedCategoryIds.size})
                </Text>
              </AnimatedButton>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  queueBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  scanIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderRadius: 24,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  healthScoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthBadgeOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthScoreText: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
  heroDetails: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  savingsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  meterContainer: {
    marginTop: 18,
  },
  meterLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  recommendationsGradientCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  recCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginLeft: 4,
  },
  emptyCard: {
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriesList: {
    gap: 10,
  },
  categoryCard: {
    borderRadius: 18,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  categoryIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savingsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  breakdownCard: {
    borderRadius: 22,
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 12,
  },
  breakdownItem: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
  },
  breakdownLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  bracketsContainer: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bracketsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bracketChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalPressable: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(150,150,150,0.4)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  modalFooter: {
    marginTop: 16,
    gap: 12,
  },
  totalSavingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
