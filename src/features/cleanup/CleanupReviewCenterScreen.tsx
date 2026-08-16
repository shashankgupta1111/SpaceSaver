import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery} from '@tanstack/react-query';
import LinearGradient from 'react-native-linear-gradient';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList} from '../../app/navigation/types';
import {SmartCleanupService} from '../../shared/services/SmartCleanupService';
import {VideoDuplicateService} from '../../shared/services/VideoDuplicateService';
import {SmartRecommendationService} from '../../shared/services/SmartRecommendationService';
import {StorageService} from '../../shared/services/StorageService';
import HeaderBar from '../../shared/components/HeaderBar';
import Card from '../../shared/components/Card';
import AnimatedButton from '../../shared/components/AnimatedButton';
import Loader from '../../shared/components/Loader';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export interface CleanupPriorityItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  priorityRank: number;
  priorityLabel: string;
  confidence: 'high' | 'medium' | 'low';
  estimatedSavingsBytes: number;
  route: keyof RootStackParamList;
  routeParams?: any;
}

export default function CleanupReviewCenterScreen() {
  const {theme, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const [loading, setLoading] = useState(true);

  // Load Smart Cleanup Summary
  const {data: cleanupSummary, refetch: refetchCleanup} = useQuery({
    queryKey: ['smartCleanupSummary'],
    queryFn: () => SmartCleanupService.getQuickSummary(),
    staleTime: 30000,
  });

  // Load Video Duplicates
  const {data: videoDupeResult, refetch: refetchVideoDupes} = useQuery({
    queryKey: ['videoDuplicatesSummary'],
    queryFn: () => VideoDuplicateService.scan(),
    staleTime: 60000,
  });

  // Load Smart Recommendations
  const {data: recommendationsReport, refetch: refetchRecs} = useQuery({
    queryKey: ['smartRecommendationsReport'],
    queryFn: () => SmartRecommendationService.generateRecommendations(false),
    staleTime: 60000,
  });

  useEffect(() => {
    if (cleanupSummary !== undefined) {
      setLoading(false);
    }
  }, [cleanupSummary]);

  // Build prioritized cleanup items list
  const priorityItems: CleanupPriorityItem[] = useMemo(() => {
    const items: CleanupPriorityItem[] = [];

    // Priority 1: High-Confidence Duplicates (Photos & Videos)
    const photoDupes = cleanupSummary?.categories.find((c: any) => c.id === 'duplicates');
    if (photoDupes && photoDupes.potentialSavingsBytes > 0) {
      items.push({
        id: 'photo_duplicates',
        title: 'Duplicate Photos',
        subtitle: `${photoDupes.itemCount} identical or similar shots`,
        icon: 'image-multiple-outline',
        iconColor: '#EF4444',
        priorityRank: 1,
        priorityLabel: 'Highest Impact',
        confidence: 'high',
        estimatedSavingsBytes: photoDupes.potentialSavingsBytes,
        route: 'Duplicates',
      });
    }

    const videoDupesBytes = videoDupeResult?.totalReclaimableBytes ?? 0;
    if (videoDupesBytes > 0) {
      items.push({
        id: 'video_duplicates',
        title: 'Similar & Duplicate Videos',
        subtitle: `${videoDupeResult?.groups.length ?? 0} video groups with potential copies`,
        icon: 'video-vintage',
        iconColor: '#DC2626',
        priorityRank: 1,
        priorityLabel: 'Highest Impact',
        confidence: 'high',
        estimatedSavingsBytes: videoDupesBytes,
        route: 'VideoDuplicates',
      });
    }

    // Priority 2: Large Videos & Heavy Media
    const largeVideos = cleanupSummary?.categories.find((c: any) => c.id === 'large_videos');
    if (largeVideos && largeVideos.potentialSavingsBytes > 0) {
      items.push({
        id: 'large_videos',
        title: 'Heavy 4K / 1080p Videos',
        subtitle: `${largeVideos.itemCount} heavy video recordings`,
        icon: 'video-outline',
        iconColor: '#7C4DFF',
        priorityRank: 2,
        priorityLabel: 'High Potential',
        confidence: 'high',
        estimatedSavingsBytes: largeVideos.potentialSavingsBytes,
        route: 'LargeFiles',
      });
    }

    // Priority 3: Smart Compression Recommendations
    const recSavings = recommendationsReport?.totalEstimatedSavingsBytes ?? 0;
    if (recSavings > 0) {
      items.push({
        id: 'smart_recommendations',
        title: 'Smart Preset Recommendations',
        subtitle: `${recommendationsReport?.totalCount ?? 0} tailored compression opportunities`,
        icon: 'creation',
        iconColor: '#6366F1',
        priorityRank: 3,
        priorityLabel: 'Smart Optimization',
        confidence: 'medium',
        estimatedSavingsBytes: recSavings,
        route: 'SmartRecommendations',
      });
    }

    // Priority 4: Screenshots & Old Media
    const screenshots = cleanupSummary?.categories.find((c: any) => c.id === 'screenshots');
    if (screenshots && screenshots.potentialSavingsBytes > 0) {
      items.push({
        id: 'screenshots',
        title: 'Screenshots Album',
        subtitle: `${screenshots.itemCount} screenshots & screen captures`,
        icon: 'cellphone-screenshot',
        iconColor: '#F59E0B',
        priorityRank: 4,
        priorityLabel: 'Review & Clean',
        confidence: 'medium',
        estimatedSavingsBytes: screenshots.potentialSavingsBytes,
        route: 'ScreenshotManager',
      });
    }

    const oldMedia = cleanupSummary?.categories.find((c: any) => c.id === 'old_media');
    if (oldMedia && oldMedia.potentialSavingsBytes > 0) {
      items.push({
        id: 'old_media',
        title: 'Older Media Files',
        subtitle: `${oldMedia.itemCount} files not modified in 90+ days`,
        icon: 'clock-outline',
        iconColor: '#3B82F6',
        priorityRank: 4,
        priorityLabel: 'Review & Clean',
        confidence: 'medium',
        estimatedSavingsBytes: oldMedia.potentialSavingsBytes,
        route: 'OldMedia',
      });
    }

    // Sort by priority rank then by estimated savings descending
    return items.sort((a, b) => {
      if (a.priorityRank !== b.priorityRank) {
        return a.priorityRank - b.priorityRank;
      }
      return b.estimatedSavingsBytes - a.estimatedSavingsBytes;
    });
  }, [cleanupSummary, videoDupeResult, recommendationsReport]);

  const totalPotentialSavings = useMemo(
    () => priorityItems.reduce((sum, item) => sum + item.estimatedSavingsBytes, 0),
    [priorityItems],
  );

  const handleStartReviewAll = () => {
    if (priorityItems.length > 0) {
      const first = priorityItems[0];
      navigation.navigate(first.route as any, first.routeParams);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, {backgroundColor: theme.colors.background}]}>
        <HeaderBar title="Cleanup Review Center" showBack />
        <View style={styles.centerContainer}>
          <Loader fullscreen label="Organizing cleanup opportunities..." />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, {backgroundColor: theme.colors.background}]}>
      <HeaderBar
        title="Review Center"
        subtitle="Priority-sorted storage opportunities"
        showBack
        rightActions={
          <TouchableOpacity
            onPress={() => {
              refetchCleanup();
              refetchVideoDupes();
              refetchRecs();
            }}
            style={[styles.refreshBtn, {backgroundColor: theme.colors.surfaceVariant}]}>
            <Icon name="refresh" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {paddingBottom: insets.bottom + 100},
        ]}>
        {/* Total Potential Reclaimable Hero Card */}
        <Animated.View entering={FadeInDown.delay(50).springify()}>
          <LinearGradient
            colors={['#6366F1', '#4F46E5']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={styles.heroIconBox}>
                <Icon name="shield-star-outline" size={26} color="#FFFFFF" />
              </View>
              <View style={{flex: 1}}>
                <Text style={[theme.typography.labelSmall, {color: 'rgba(255,255,255,0.8)'}]}>
                  TOTAL RECLAIMABLE POTENTIAL
                </Text>
                <Text style={[theme.typography.headlineMedium, {color: '#FFFFFF', fontWeight: '900', marginTop: 2}]}>
                  ~{StorageService.formatBytes(totalPotentialSavings)}
                </Text>
              </View>
            </View>

            <Text style={[theme.typography.bodySmall, {color: 'rgba(255,255,255,0.85)', marginTop: 8}]}>
              Organized by impact priority. Review and confirm each action before any changes are made.
            </Text>

            {priorityItems.length > 0 && (
              <AnimatedButton
                onPress={handleStartReviewAll}
                variant="primary"
                size="lg"
                fullWidth
                style={styles.reviewAllBtn}>
                <Icon name="play-circle-outline" size={20} color="#6366F1" />
                <Text style={[theme.typography.titleSmall, {color: '#6366F1', fontWeight: '800'}]}>
                  Start Guided Review ({priorityItems.length})
                </Text>
              </AnimatedButton>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Priority-Sorted Opportunities */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[theme.typography.titleMedium, {color: theme.colors.text, fontWeight: '700'}]}>
              Prioritized Opportunities
            </Text>
            <Text style={[theme.typography.labelSmall, {color: theme.colors.textTertiary}]}>
              SORTED BY IMPACT
            </Text>
          </View>

          {priorityItems.length === 0 ? (
            <Card style={styles.emptyCard} padding={24}>
              <Icon name="check-decagram" size={48} color={theme.colors.success} />
              <Text style={[theme.typography.titleMedium, {color: theme.colors.text, fontWeight: '700', marginTop: 12}]}>
                All Clean & Optimized
              </Text>
              <Text style={[theme.typography.bodyMedium, {color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4}]}>
                No duplicate media, heavy uncompressed files, or clutter detected.
              </Text>
            </Card>
          ) : (
            <View style={styles.itemsList}>
              {priorityItems.map((item, idx) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate(item.route as any, item.routeParams)}>
                  <Card style={styles.itemCard} padding={16}>
                    <View style={styles.itemRow}>
                      <View style={[styles.itemIconBadge, {backgroundColor: `${item.iconColor}18`}]}>
                        <Icon name={item.icon} size={24} color={item.iconColor} />
                      </View>

                      <View style={styles.itemInfo}>
                        <View style={styles.itemBadgeRow}>
                          <View style={[styles.priorityPill, {backgroundColor: theme.colors.surfaceVariant}]}>
                            <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary, fontSize: 10}]}>
                              {item.priorityLabel}
                            </Text>
                          </View>
                        </View>

                        <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700', marginTop: 2}]}>
                          {item.title}
                        </Text>
                        <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary, marginTop: 1}]}>
                          {item.subtitle}
                        </Text>
                      </View>

                      <View style={styles.itemActionCol}>
                        <View style={[styles.savingsBadge, {backgroundColor: theme.colors.successContainer}]}>
                          <Text style={[theme.typography.labelSmall, {color: theme.colors.success, fontWeight: '800'}]}>
                            ~{StorageService.formatBytes(item.estimatedSavingsBytes)}
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAllBtn: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
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
  itemsList: {
    gap: 10,
  },
  itemCard: {
    borderRadius: 18,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  itemIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemActionCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  savingsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
});
