import React, {useEffect} from 'react';
import {View, Text, StyleSheet, ScrollView, Dimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery} from '@tanstack/react-query';
import {BarChart} from 'react-native-gifted-charts';

import {useTheme} from '../../app/theme/ThemeContext';
import {
  StorageService,
  StorageInfo,
  WhatChangedSummary,
} from '../../shared/services/StorageService';
import {
  HistoryService,
  MonthlyInsights,
  LifetimeInsights,
} from '../../shared/services/HistoryService';
import HeaderBar from '../../shared/components/HeaderBar';
import Card from '../../shared/components/Card';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const MB = 1024 * 1024;

export default function InsightsScreen() {
  const {theme, isDark} = useTheme();
  const insets = useSafeAreaInsets();

  const {data: storageInfo} = useQuery<StorageInfo>({
    queryKey: ['storageInfo'],
    queryFn: () => StorageService.getStorageInfo(),
    staleTime: 30000,
  });

  const weekly = StorageService.getWeeklyStats();
  const monthly = StorageService.getMonthlyStats();
  const forecast = StorageService.getStorageForecast(
    storageInfo?.freeStorage ?? 0,
  );

  const monthlyInsights: MonthlyInsights = HistoryService.getMonthlyInsights();
  const lifetimeInsights: LifetimeInsights = HistoryService.getLifetimeInsights();
  const whatChanged: WhatChangedSummary = StorageService.getWhatChangedSummary(
    storageInfo?.usedStorage ?? 0,
  );

  useEffect(() => {
    if (storageInfo?.usedStorage) {
      StorageService.saveStorageCheckpoint(storageInfo.usedStorage);
    }
  }, [storageInfo?.usedStorage]);

  const weekTotal = weekly.reduce((s, d) => s + d.saved, 0);
  const monthTotal = monthly.reduce((s, d) => s + d.saved, 0);

  const weeklyData = weekly.map(d => ({
    value: +(d.saved / MB).toFixed(2),
    label: d.day,
    frontColor: theme.colors.primary,
    gradientColor: theme.colors.secondary,
  }));

  const monthlyTrendData = lifetimeInsights.monthlyTrends.map(d => ({
    value: +(d.savedBytes / MB).toFixed(2),
    label: d.month,
    frontColor: theme.colors.secondary,
    gradientColor: theme.colors.primary,
  }));

  const hasWeekly = weeklyData.some(d => d.value > 0);
  const hasMonthlyTrend = monthlyTrendData.some(d => d.value > 0);

  const forecastText = (): {
    title: string;
    sub: string;
    icon: string;
    color: string;
    trendLabel: string;
  } => {
    if (forecast.samples < 2) {
      return {
        title: 'Collecting data…',
        sub: `Check back tomorrow — ${forecast.samples}/2 daily readings so far.`,
        icon: 'chart-timeline-variant',
        color: theme.colors.textSecondary,
        trendLabel: 'Awaiting data samples',
      };
    }
    if (forecast.daysUntilFull === null) {
      return {
        title: 'Storage is stable',
        sub: 'Your free space isn’t trending down right now.',
        icon: 'check-circle-outline',
        color: theme.colors.success,
        trendLabel: 'Optimal · Usage stable',
      };
    }

    const weeks = Math.round(forecast.daysUntilFull / 7);
    const timeEstimate =
      weeks > 2 ? `~${weeks} weeks` : `~${forecast.daysUntilFull} days`;
    const perDay = StorageService.formatBytes(Math.abs(forecast.dailyChange));

    return {
      title: `${timeEstimate} until full`,
      sub: `Losing about ${perDay}/day at the current rate.`,
      icon: 'clock-alert-outline',
      color:
        forecast.daysUntilFull < 30 ? theme.colors.warning : theme.colors.primary,
      trendLabel: 'Storage usage increasing',
    };
  };

  const fc = forecastText();

  return (
    <View
      style={[
        styles.root,
        {backgroundColor: theme.colors.background, paddingTop: insets.top},
      ]}>
      <HeaderBar
        title="Insights"
        subtitle="Storage, forecasting & historical intelligence"
        showBack
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 32,
        }}>
        {/* Lifetime Totals Row */}
        <Animated.View entering={FadeInDown.springify()} style={styles.statRow}>
          <StatCard
            label="Lifetime Saved"
            value={StorageService.formatBytes(
              lifetimeInsights.lifetimeSavedBytes ||
                storageInfo?.savedByApp ||
                0,
            )}
            subtext={`${lifetimeInsights.lifetimeFilesCompressed} files total`}
            icon="leaf"
            tint={theme.colors.success}
          />
          <StatCard
            label="This Month"
            value={StorageService.formatBytes(monthlyInsights.savedBytes)}
            subtext={`${monthlyInsights.filesCompressedCount} files compressed`}
            icon="calendar-month"
            tint={theme.colors.primary}
          />
        </Animated.View>

        {/* "What Changed?" Storage Delta Summary Card */}
        {whatChanged.hasPreviousData && (
          <Animated.View entering={FadeInDown.delay(40).springify()}>
            <Card style={styles.whatChangedCard} padding={16}>
              <View style={styles.whatChangedHeader}>
                <View
                  style={[
                    styles.whatChangedIcon,
                    {backgroundColor: theme.colors.primaryContainer},
                  ]}>
                  <Icon
                    name="compare-horizontal"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={{flex: 1}}>
                  <Text
                    style={[
                      theme.typography.labelSmall,
                      {color: theme.colors.textSecondary, fontWeight: '700'},
                    ]}>
                    WHAT CHANGED?
                  </Text>
                  <Text
                    style={[
                      theme.typography.titleSmall,
                      {color: theme.colors.text, fontWeight: '700'},
                    ]}>
                    {whatChanged.timeSpanText}
                  </Text>
                </View>
              </View>

              <View style={styles.whatChangedGrid}>
                <View style={styles.whatChangedCol}>
                  <Text
                    style={[
                      theme.typography.labelSmall,
                      {color: theme.colors.textSecondary},
                    ]}>
                    Device Storage
                  </Text>
                  <Text
                    style={[
                      theme.typography.titleSmall,
                      {
                        color:
                          whatChanged.deviceUsedDelta > 0
                            ? theme.colors.error
                            : theme.colors.success,
                        fontWeight: '800',
                        marginTop: 2,
                      },
                    ]}>
                    {whatChanged.deviceUsedDelta > 0 ? '+' : ''}
                    {StorageService.formatBytes(whatChanged.deviceUsedDelta)}
                  </Text>
                </View>

                <View style={[styles.whatChangedCol, {alignItems: 'flex-end'}]}>
                  <Text
                    style={[
                      theme.typography.labelSmall,
                      {color: theme.colors.textSecondary},
                    ]}>
                    SpaceSaver Freed
                  </Text>
                  <Text
                    style={[
                      theme.typography.titleSmall,
                      {
                        color: theme.colors.success,
                        fontWeight: '800',
                        marginTop: 2,
                      },
                    ]}>
                    {whatChanged.appSavedDelta > 0 ? '-' : ''}
                    {StorageService.formatBytes(whatChanged.appSavedDelta)}
                  </Text>
                </View>
              </View>
            </Card>
          </Animated.View>
        )}

        {/* Most Effective Space Saver Banner */}
        {lifetimeInsights.mostEffectiveAction.savedBytes > 0 && (
          <Animated.View entering={FadeInDown.delay(70).springify()}>
            <Card style={styles.topSaverBanner} padding={14}>
              <View style={styles.topSaverBannerRow}>
                <View
                  style={[
                    styles.crownIconBox,
                    {backgroundColor: theme.colors.secondaryContainer},
                  ]}>
                  <Icon
                    name="crown-outline"
                    size={20}
                    color={theme.colors.secondary}
                  />
                </View>
                <View style={{flex: 1}}>
                  <Text
                    style={[
                      theme.typography.labelSmall,
                      {color: theme.colors.textSecondary},
                    ]}>
                    YOUR BIGGEST SPACE SAVER
                  </Text>
                  <Text
                    style={[
                      theme.typography.titleSmall,
                      {color: theme.colors.text, fontWeight: '700'},
                    ]}>
                    {lifetimeInsights.mostEffectiveAction.title} ·{' '}
                    <Text
                      style={{
                        color: theme.colors.success,
                        fontWeight: '800',
                      }}>
                      {StorageService.formatBytes(
                        lifetimeInsights.mostEffectiveAction.savedBytes,
                      )}{' '}
                      saved
                    </Text>
                  </Text>
                </View>
              </View>
            </Card>
          </Animated.View>
        )}

        {/* Category Savings Breakdown */}
        <Animated.View entering={FadeInDown.delay(90).springify()}>
          <Text
            style={[
              theme.typography.titleMedium,
              styles.sectionTitle,
              {color: theme.colors.text, fontWeight: '700'},
            ]}>
            Category Savings
          </Text>
          <Card style={styles.categoryCard} padding={16}>
            <View style={styles.categoryRow}>
              <View
                style={[
                  styles.categoryIcon,
                  {backgroundColor: 'rgba(124, 77, 255, 0.15)'},
                ]}>
                <Icon name="video-outline" size={20} color="#7C4DFF" />
              </View>
              <View style={{flex: 1}}>
                <Text
                  style={[
                    theme.typography.titleSmall,
                    {color: theme.colors.text, fontWeight: '600'},
                  ]}>
                  Videos
                </Text>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: theme.colors.textSecondary},
                  ]}>
                  Compression & video cleanup
                </Text>
              </View>
              <Text
                style={[
                  theme.typography.titleSmall,
                  {color: theme.colors.text, fontWeight: '800'},
                ]}>
                {StorageService.formatBytes(
                  lifetimeInsights.categorySavings.videosSavedBytes,
                )}
              </Text>
            </View>

            <View
              style={[
                styles.separator,
                {backgroundColor: theme.colors.borderLight},
              ]}
            />

            <View style={styles.categoryRow}>
              <View
                style={[
                  styles.categoryIcon,
                  {backgroundColor: 'rgba(16, 185, 129, 0.15)'},
                ]}>
                <Icon name="image-outline" size={20} color="#10B981" />
              </View>
              <View style={{flex: 1}}>
                <Text
                  style={[
                    theme.typography.titleSmall,
                    {color: theme.colors.text, fontWeight: '600'},
                  ]}>
                  Photos
                </Text>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: theme.colors.textSecondary},
                  ]}>
                  Photo compression & resize
                </Text>
              </View>
              <Text
                style={[
                  theme.typography.titleSmall,
                  {color: theme.colors.text, fontWeight: '800'},
                ]}>
                {StorageService.formatBytes(
                  lifetimeInsights.categorySavings.photosSavedBytes,
                )}
              </Text>
            </View>
          </Card>
        </Animated.View>

        {/* Advanced Storage Forecast */}
        <Animated.View entering={FadeInDown.delay(120).springify()}>
          <Text
            style={[
              theme.typography.titleMedium,
              styles.sectionTitle,
              {color: theme.colors.text, fontWeight: '700'},
            ]}>
            Storage Forecast
          </Text>
          <Card style={styles.forecastCard} padding={16}>
            <View style={styles.forecastHeader}>
              <View
                style={[
                  styles.forecastIcon,
                  {backgroundColor: theme.colors.surfaceVariant},
                ]}>
                <Icon name={fc.icon} size={24} color={fc.color} />
              </View>
              <View style={{flex: 1}}>
                <Text
                  style={[
                    theme.typography.titleMedium,
                    {color: theme.colors.text, fontWeight: '800'},
                  ]}>
                  {fc.title}
                </Text>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: theme.colors.textSecondary, marginTop: 2},
                  ]}>
                  {fc.sub}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.forecastTrendPill,
                {backgroundColor: theme.colors.surfaceVariant},
              ]}>
              <Icon
                name="chart-timeline-variant"
                size={14}
                color={theme.colors.textSecondary}
              />
              <Text
                style={[
                  theme.typography.labelSmall,
                  {color: theme.colors.textSecondary, fontWeight: '600'},
                ]}>
                Trend: {fc.trendLabel}
              </Text>
            </View>
          </Card>
        </Animated.View>

        {/* Historical Monthly Trend Chart */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <Text
            style={[
              theme.typography.titleMedium,
              styles.sectionTitle,
              {color: theme.colors.text, fontWeight: '700'},
            ]}>
            Monthly Trend (MB Saved)
          </Text>
          <Card style={styles.chartCard}>
            {hasMonthlyTrend ? (
              <BarChart
                data={monthlyTrendData}
                width={SCREEN_WIDTH - 90}
                height={170}
                barWidth={36}
                spacing={24}
                roundedTop
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
                isAnimated
                showGradient
              />
            ) : (
              <EmptyChart text="No savings recorded in recent months yet" />
            )}
          </Card>
        </Animated.View>

        {/* Weekly Chart */}
        <Animated.View entering={FadeInDown.delay(180).springify()}>
          <Text
            style={[
              theme.typography.titleMedium,
              styles.sectionTitle,
              {color: theme.colors.text, fontWeight: '700'},
            ]}>
            This Week (MB Saved · {StorageService.formatBytes(weekTotal)})
          </Text>
          <Card style={styles.chartCard}>
            {hasWeekly ? (
              <BarChart
                data={weeklyData}
                width={SCREEN_WIDTH - 90}
                height={170}
                barWidth={24}
                spacing={14}
                roundedTop
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
                isAnimated
                showGradient
              />
            ) : (
              <EmptyChart text="No savings recorded this week yet" />
            )}
          </Card>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function StatCard({
  label,
  value,
  subtext,
  icon,
  tint,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: string;
  tint: string;
}) {
  const {theme} = useTheme();
  return (
    <Card style={styles.statCard}>
      <Icon name={icon} size={22} color={tint} />
      <Text
        style={[
          theme.typography.numericSmall,
          {color: theme.colors.text, marginTop: 8, fontWeight: '800'},
        ]}>
        {value}
      </Text>
      <Text
        style={[
          theme.typography.bodySmall,
          {color: theme.colors.textSecondary, fontWeight: '600'},
        ]}>
        {label}
      </Text>
      {subtext && (
        <Text
          style={[
            theme.typography.labelSmall,
            {color: theme.colors.textTertiary, marginTop: 2},
          ]}>
          {subtext}
        </Text>
      )}
    </Card>
  );
}

function EmptyChart({text}: {text: string}) {
  const {theme} = useTheme();
  return (
    <View style={styles.emptyChart}>
      <Icon name="chart-bar" size={36} color={theme.colors.textTertiary} />
      <Text
        style={[
          theme.typography.bodyMedium,
          {
            color: theme.colors.textSecondary,
            marginTop: 8,
            textAlign: 'center',
          },
        ]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  statRow: {flexDirection: 'row', gap: 12, marginBottom: 12},
  statCard: {flex: 1, alignItems: 'flex-start', paddingVertical: 16},
  whatChangedCard: {
    borderRadius: 18,
    marginBottom: 12,
  },
  whatChangedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  whatChangedIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatChangedGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  whatChangedCol: {
    flex: 1,
  },
  topSaverBanner: {
    borderRadius: 16,
    marginBottom: 12,
  },
  topSaverBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  crownIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCard: {
    borderRadius: 18,
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  categoryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  forecastCard: {
    borderRadius: 18,
    marginBottom: 12,
  },
  forecastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  forecastIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forecastTrendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  sectionTitle: {marginTop: 14, marginBottom: 10},
  chartCard: {padding: 16, overflow: 'hidden', borderRadius: 18},
  emptyChart: {height: 160, alignItems: 'center', justifyContent: 'center'},
});
