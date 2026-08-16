import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList} from '../../app/navigation/types';
import {
  SmartRecommendationService,
  SmartRecommendation,
} from '../../shared/services/SmartRecommendationService';
import {CompressionQueueService} from '../../shared/services/CompressionQueueService';
import {StorageService} from '../../shared/services/StorageService';
import HeaderBar from '../../shared/components/HeaderBar';
import Card from '../../shared/components/Card';
import AnimatedButton from '../../shared/components/AnimatedButton';
import Loader from '../../shared/components/Loader';
import EmptyState from '../../shared/components/EmptyState';
import {VideoThumbnail} from '../../shared/components/VideoThumbnail';
import {useAlert} from '../../shared/components/AlertProvider';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SmartRecommendationsScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const alert = useAlert();
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addingToQueue, setAddingToQueue] = useState(false);

  const {data: report, isLoading, isRefetching, refetch} = useQuery({
    queryKey: ['smartRecommendationsReport'],
    queryFn: () => SmartRecommendationService.generateRecommendations(true),
    staleTime: 60_000,
  });

  const recommendations = report?.recommendations ?? [];

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(prev =>
      prev.size === recommendations.length
        ? new Set()
        : new Set(recommendations.map((r: SmartRecommendation) => r.id)),
    );
  };

  const handleQueueAll = async (specificRecs?: SmartRecommendation[]) => {
    const targetRecs = specificRecs ?? (
      selectedIds.size > 0
        ? recommendations.filter((r: SmartRecommendation) => selectedIds.has(r.id))
        : recommendations
    );

    if (targetRecs.length === 0) return;

    setAddingToQueue(true);
    try {
      const batchData = targetRecs.map((rec: SmartRecommendation) => ({
        name: rec.file.filename,
        type: rec.file.type,
        uris: [rec.file.uri],
        options: rec.recommendedOptions,
        originalSizeBytes: rec.file.fileSize,
      }));

      CompressionQueueService.addBatchJobs(batchData, true);

      alert({
        title: 'Added to Queue',
        message: `${targetRecs.length} item${targetRecs.length > 1 ? 's' : ''} added to the background compression queue.`,
        type: 'success',
        icon: 'tray-arrow-down',
        buttons: [
          {
            text: 'View Queue',
            onPress: () => navigation.navigate('CompressionQueue'),
          },
          {text: 'OK', style: 'cancel'},
        ],
      });
    } finally {
      setAddingToQueue(false);
    }
  };

  const handleIndividualCompress = (rec: SmartRecommendation) => {
    if (rec.file.type === 'video') {
      navigation.navigate('VideoCompression', {selectedUris: [rec.file.uri]});
    } else {
      navigation.navigate('ImageCompression', {selectedUris: [rec.file.uri]});
    }
  };

  const selectedSavings = recommendations
    .filter((r: SmartRecommendation) => selectedIds.has(r.id))
    .reduce((sum: number, r: SmartRecommendation) => sum + r.estimatedSavingsBytes, 0);

  return (
    <View
      style={[
        styles.root,
        {backgroundColor: theme.colors.background, paddingTop: insets.top},
      ]}>
      <HeaderBar
        title="Smart Recommendations"
        subtitle="Deterministic storage optimizations"
        showBack
        rightActions={
          <TouchableOpacity
            onPress={() => refetch()}
            style={[styles.actionIconBtn, {backgroundColor: theme.colors.surfaceVariant}]}
            hitSlop={8}>
            <Icon name="refresh" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        }
      />

      {isLoading || isRefetching ? (
        <Loader fullscreen label="Evaluating compression benefits…" />
      ) : recommendations.length === 0 ? (
        <EmptyState
          type="images"
          title="All Media Optimized"
          description="No heavy photos or uncompressed videos with high potential compression savings were detected."
        />
      ) : (
        <View style={styles.container}>
          {/* Potential Savings Hero Card */}
          <Animated.View entering={FadeInDown.delay(50).springify()}>
            <Card style={styles.heroCard} padding={18}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroLeft}>
                  <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary}]}>
                    TOTAL POTENTIAL SAVINGS
                  </Text>
                  <Text style={[theme.typography.headlineMedium, {color: theme.colors.primary, fontWeight: '900', marginTop: 2}]}>
                    ~{StorageService.formatBytes(report?.totalEstimatedSavingsBytes ?? 0)}
                  </Text>
                  <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
                    {report?.videoCount ?? 0} videos and {report?.photoCount ?? 0} photos recommended
                  </Text>
                </View>

                <View style={[styles.heroIconBadge, {backgroundColor: theme.colors.primaryContainer}]}>
                  <Icon name="creation" size={26} color={theme.colors.primary} />
                </View>
              </View>

              <View style={[styles.heroActions, {borderTopColor: theme.colors.borderLight}]}>
                <AnimatedButton
                  onPress={() => handleQueueAll()}
                  variant="primary"
                  size="md"
                  gradient
                  loading={addingToQueue}
                  style={{flex: 1}}>
                  <Icon name="tray-arrow-down" size={18} color="#FFFFFF" />
                  <Text style={[theme.typography.titleSmall, {color: '#FFFFFF', fontWeight: '700'}]}>
                    Queue All ({recommendations.length})
                  </Text>
                </AnimatedButton>
              </View>
            </Card>
          </Animated.View>

          {/* List Header */}
          <View style={styles.listHeaderRow}>
            <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
              Recommended Items ({recommendations.length})
            </Text>
            <TouchableOpacity onPress={selectAll} style={styles.selectAllBtn}>
              <Text style={[theme.typography.labelSmall, {color: theme.colors.primary, fontWeight: '700'}]}>
                {selectedIds.size === recommendations.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Recommendations List */}
          <FlatList
            data={recommendations}
            keyExtractor={item => item.id}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: (selectedIds.size > 0 ? 110 : 30) + insets.bottom,
              gap: 12,
            }}
            showsVerticalScrollIndicator={false}
            renderItem={({item: rec, index}) => {
              const isSel = selectedIds.has(rec.id);
              return (
                <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 30).springify()}>
                  <Card
                    style={[
                      styles.recCard,
                      isSel && {borderColor: theme.colors.primary, borderWidth: 1.5},
                    ]}
                    padding={14}>
                    <View style={styles.recRow}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => toggleSelect(rec.id)}
                        style={styles.thumbWrapper}>
                        {rec.file.type === 'video' ? (
                          <VideoThumbnail
                            videoUri={rec.file.uri}
                            style={styles.recThumb}
                            resizeMode="cover"
                          />
                        ) : (
                          <Image
                            source={{uri: rec.file.uri}}
                            style={styles.recThumb}
                            resizeMode="cover"
                            resizeMethod="resize"
                          />
                        )}
                        <View
                          style={[
                            styles.thumbCheck,
                            isSel
                              ? {backgroundColor: theme.colors.primary, borderColor: 'white'}
                              : {backgroundColor: 'rgba(0,0,0,0.4)', borderColor: 'rgba(255,255,255,0.8)'},
                          ]}>
                          {isSel && <Icon name="check" size={12} color="white" />}
                        </View>
                      </TouchableOpacity>

                      <View style={styles.recInfo}>
                        <View style={styles.titleBadgeRow}>
                          <Text
                            style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700', flex: 1}]}
                            numberOfLines={1}>
                            {rec.reason}
                          </Text>
                          <View style={[styles.impactBadge, {backgroundColor: rec.category === 'high_impact' ? '#EF444418' : '#3B82F618'}]}>
                            <Text style={[theme.typography.labelSmall, {color: rec.category === 'high_impact' ? '#EF4444' : '#3B82F6', fontSize: 10, fontWeight: '700'}]}>
                              {rec.category === 'high_impact' ? 'HIGH SAVINGS' : 'OPTIMAL'}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={[theme.typography.bodySmall, {color: theme.colors.textSecondary, marginTop: 2}]}
                          numberOfLines={1}>
                          {rec.file.filename} · {StorageService.formatBytes(rec.file.fileSize)}
                        </Text>

                        {/* Recommended Preset Details */}
                        <View style={[styles.presetBox, {backgroundColor: theme.colors.surfaceVariant}]}>
                          <Icon name="tune-variant" size={14} color={theme.colors.textSecondary} />
                          <Text style={[theme.typography.labelSmall, {color: theme.colors.textSecondary, flex: 1, fontSize: 11}]} numberOfLines={1}>
                            {rec.presetLabel}
                          </Text>
                        </View>

                        {/* Estimated Savings */}
                        <View style={styles.savingsRow}>
                          <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary, fontSize: 11}]}>
                            Est. Savings:{' '}
                          </Text>
                          <Text style={[theme.typography.labelMedium, {color: theme.colors.success, fontWeight: '800'}]}>
                            ~{StorageService.formatBytes(rec.estimatedSavingsBytes)} (-{rec.savingsPercentage}%)
                          </Text>
                        </View>

                        {/* Actions Row */}
                        <View style={styles.cardActionsRow}>
                          <TouchableOpacity
                            style={[styles.customBtn, {backgroundColor: theme.colors.surfaceVariant}]}
                            onPress={() => handleIndividualCompress(rec)}>
                            <Icon name="cog-outline" size={14} color={theme.colors.text} />
                            <Text style={[theme.typography.labelSmall, {color: theme.colors.text, fontWeight: '600'}]}>
                              Customize
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.quickQueueBtn, {backgroundColor: theme.colors.primary}]}
                            onPress={() => handleQueueAll([rec])}>
                            <Icon name="tray-arrow-down" size={14} color="#FFFFFF" />
                            <Text style={[theme.typography.labelSmall, {color: '#FFFFFF', fontWeight: '700'}]}>
                              Queue
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </Card>
                </Animated.View>
              );
            }}
          />
        </View>
      )}

      {/* Floating Action Footer when items are selected */}
      {selectedIds.size > 0 && (
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
              {selectedIds.size} selected · ~{StorageService.formatBytes(selectedSavings)} est.
            </Text>
            <TouchableOpacity onPress={() => setSelectedIds(new Set())}>
              <Text style={[theme.typography.labelSmall, {color: theme.colors.primary, fontWeight: '700'}]}>
                Deselect
              </Text>
            </TouchableOpacity>
          </View>
          <AnimatedButton
            onPress={() => handleQueueAll()}
            variant="primary"
            size="md"
            gradient
            loading={addingToQueue}
            fullWidth>
            <Icon name="tray-arrow-down" size={18} color="#FFFFFF" />
            <Text style={[theme.typography.titleSmall, {color: '#FFFFFF', fontWeight: '700'}]}>
              Add {selectedIds.size} to Compression Queue
            </Text>
          </AnimatedButton>
        </Animated.View>
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
  heroCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLeft: {
    flex: 1,
  },
  heroIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActions: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 8,
  },
  selectAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  recCard: {
    borderRadius: 18,
  },
  recRow: {
    flexDirection: 'row',
    gap: 12,
  },
  thumbWrapper: {
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  recThumb: {
    width: '100%',
    height: '100%',
  },
  thumbCheck: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recInfo: {
    flex: 1,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  impactBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  presetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  customBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickQueueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
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
});
