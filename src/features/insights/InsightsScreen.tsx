import React from 'react';
import {View, Text, StyleSheet, ScrollView, Dimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery} from '@tanstack/react-query';
import {BarChart} from 'react-native-gifted-charts';

import {useTheme} from '../../app/theme/ThemeContext';
import {StorageService, StorageInfo} from '../../shared/services/StorageService';
import HeaderBar from '../../shared/components/HeaderBar';
import Card from '../../shared/components/Card';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const MB = 1024 * 1024;

export default function InsightsScreen() {
  const {theme} = useTheme();
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

  const weekTotal = weekly.reduce((s, d) => s + d.saved, 0);
  const monthTotal = monthly.reduce((s, d) => s + d.saved, 0);

  const weeklyData = weekly.map(d => ({
    value: +(d.saved / MB).toFixed(2),
    label: d.day,
    frontColor: theme.colors.primary,
    gradientColor: theme.colors.secondary,
  }));
  const monthlyData = monthly.map(d => ({
    value: +(d.saved / MB).toFixed(2),
    label: d.week,
    frontColor: theme.colors.secondary,
    gradientColor: theme.colors.primary,
  }));

  const hasWeekly = weeklyData.some(d => d.value > 0);
  const hasMonthly = monthlyData.some(d => d.value > 0);

  const forecastText = (): {title: string; sub: string; icon: string; color: string} => {
    if (forecast.samples < 2) {
      return {
        title: 'Collecting data…',
        sub: `Check back tomorrow — ${forecast.samples}/2 daily readings so far.`,
        icon: 'chart-timeline-variant',
        color: theme.colors.textSecondary,
      };
    }
    if (forecast.daysUntilFull === null) {
      return {
        title: 'Storage is stable',
        sub: 'Your free space isn’t trending down right now. Nice.',
        icon: 'check-circle-outline',
        color: theme.colors.success,
      };
    }
    const perDay = StorageService.formatBytes(Math.abs(forecast.dailyChange));
    return {
      title: `~${forecast.daysUntilFull} days until full`,
      sub: `You're losing about ${perDay}/day at the current rate.`,
      icon: 'clock-alert-outline',
      color:
        forecast.daysUntilFull < 30 ? theme.colors.warning : theme.colors.primary,
    };
  };
  const fc = forecastText();

  return (
    <View
      style={[
        styles.root,
        {backgroundColor: theme.colors.background, paddingTop: insets.top},
      ]}>
      <HeaderBar title="Insights" showBack />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: 20, paddingBottom: insets.bottom + 32}}>
        {/* Totals */}
        <Animated.View entering={FadeInDown.springify()} style={styles.statRow}>
          <StatCard
            label="All-time saved"
            value={StorageService.formatBytes(storageInfo?.savedByApp ?? 0)}
            icon="leaf"
            tint={theme.colors.success}
          />
          <StatCard
            label="This week"
            value={StorageService.formatBytes(weekTotal)}
            icon="calendar-week"
            tint={theme.colors.primary}
          />
        </Animated.View>

        {/* Forecast */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Card style={styles.forecastCard}>
            <View style={[styles.forecastIcon, {backgroundColor: theme.colors.surfaceVariant}]}>
              <Icon name={fc.icon} size={24} color={fc.color} />
            </View>
            <View style={{flex: 1}}>
              <Text style={[theme.typography.titleSmall, {color: theme.colors.text}]}>
                {fc.title}
              </Text>
              <Text
                style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
                {fc.sub}
              </Text>
            </View>
          </Card>
        </Animated.View>

        {/* Weekly chart */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Text style={[theme.typography.titleMedium, styles.sectionTitle, {color: theme.colors.text}]}>
            This Week (MB saved)
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
                yAxisTextStyle={{color: theme.colors.textTertiary, fontSize: 10}}
                xAxisLabelTextStyle={{color: theme.colors.textSecondary, fontSize: 11}}
                noOfSections={4}
                isAnimated
                showGradient
              />
            ) : (
              <EmptyChart text="No savings recorded this week yet" />
            )}
          </Card>
        </Animated.View>

        {/* Monthly chart */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Text style={[theme.typography.titleMedium, styles.sectionTitle, {color: theme.colors.text}]}>
            This Month (MB saved · {StorageService.formatBytes(monthTotal)})
          </Text>
          <Card style={styles.chartCard}>
            {hasMonthly ? (
              <BarChart
                data={monthlyData}
                width={SCREEN_WIDTH - 90}
                height={170}
                barWidth={40}
                spacing={22}
                roundedTop
                hideRules
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={{color: theme.colors.textTertiary, fontSize: 10}}
                xAxisLabelTextStyle={{color: theme.colors.textSecondary, fontSize: 11}}
                noOfSections={4}
                isAnimated
                showGradient
              />
            ) : (
              <EmptyChart text="No savings recorded this month yet" />
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
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon: string;
  tint: string;
}) {
  const {theme} = useTheme();
  return (
    <Card style={styles.statCard}>
      <Icon name={icon} size={20} color={tint} />
      <Text
        style={[theme.typography.numericSmall, {color: theme.colors.text, marginTop: 8}]}>
        {value}
      </Text>
      <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
        {label}
      </Text>
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
          {color: theme.colors.textSecondary, marginTop: 8, textAlign: 'center'},
        ]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  statRow: {flexDirection: 'row', gap: 12, marginBottom: 4},
  statCard: {flex: 1, alignItems: 'flex-start', gap: 2, paddingVertical: 16},
  forecastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
    marginBottom: 4,
  },
  forecastIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {marginTop: 20, marginBottom: 12},
  chartCard: {padding: 16, overflow: 'hidden'},
  emptyChart: {height: 160, alignItems: 'center', justifyContent: 'center'},
});
