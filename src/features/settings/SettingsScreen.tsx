import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useTheme} from '../../app/theme/ThemeContext';
import {SettingsService, SaveOption} from '../../shared/services/SettingsService';
import {HistoryService} from '../../shared/services/HistoryService';
import Card from '../../shared/components/Card';

function SettingsRow({
  icon,
  iconColor,
  iconBg,
  label,
  subtitle,
  rightElement,
  onPress,
  danger,
}: {
  icon: string;
  iconColor: string;
  iconBg: string;
  label: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const {theme} = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && !rightElement}
      activeOpacity={0.7}
      style={styles.row}>
      <View style={[styles.rowIcon, {backgroundColor: iconBg}]}>
        <Icon name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.rowContent}>
        <Text
          style={[
            theme.typography.bodyMedium,
            {
              color: danger ? theme.colors.error : theme.colors.text,
              fontWeight: '500',
            },
          ]}>
          {label}
        </Text>
        {subtitle && (
          <Text
            style={[
              theme.typography.bodySmall,
              {color: theme.colors.textSecondary},
            ]}>
            {subtitle}
          </Text>
        )}
      </View>
      {rightElement ?? (
        onPress && (
          <Icon
            name="chevron-right"
            size={18}
            color={theme.colors.textTertiary}
          />
        )
      )}
    </TouchableOpacity>
  );
}

function SectionHeader({title}: {title: string}) {
  const {theme} = useTheme();
  return (
    <Text
      style={[
        theme.typography.labelLarge,
        styles.sectionHeader,
        {color: theme.colors.textSecondary},
      ]}>
      {title}
    </Text>
  );
}

export default function SettingsScreen() {
  const {theme, themeMode, setThemeMode} = useTheme();
  const insets = useSafeAreaInsets();

  const [showNotifications, setShowNotifications] = useState(
    SettingsService.get('showNotifications'),
  );
  const [saveOption, setSaveOption] = useState<SaveOption>(
    SettingsService.get('defaultSaveOption'),
  );

  const handleThemePress = () => {
    Alert.alert('Theme', 'Choose your preferred theme', [
      {
        text: 'Light',
        onPress: () => setThemeMode('light'),
      },
      {
        text: 'Dark',
        onPress: () => setThemeMode('dark'),
      },
      {
        text: 'Follow System',
        onPress: () => setThemeMode('system'),
      },
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  const handleSaveOptionPress = () => {
    Alert.alert('Default Save Option', 'Choose what happens after compression', [
      {
        text: 'Save as New Copy',
        onPress: () => {
          setSaveOption('new');
          SettingsService.set('defaultSaveOption', 'new');
        },
      },
      {
        text: 'Replace Original',
        onPress: () => {
          setSaveOption('replace');
          SettingsService.set('defaultSaveOption', 'replace');
        },
      },
      {
        text: 'Ask Every Time',
        onPress: () => {
          setSaveOption('ask');
          SettingsService.set('defaultSaveOption', 'ask');
        },
      },
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  const themeLabel =
    themeMode === 'light' ? 'Light' : themeMode === 'dark' ? 'Dark' : 'System';

  const saveOptionLabel =
    saveOption === 'new'
      ? 'New Copy'
      : saveOption === 'replace'
      ? 'Replace Original'
      : 'Ask Every Time';

  return (
    <View style={[styles.root, {backgroundColor: theme.colors.background}]}>
      <View
        style={[
          styles.header,
          {paddingTop: insets.top + 8, backgroundColor: theme.colors.background},
        ]}>
        <Text style={[theme.typography.titleLarge, {color: theme.colors.text}]}>
          Settings
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {paddingBottom: insets.bottom + 100},
        ]}>

        {/* Appearance */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <SectionHeader title="APPEARANCE" />
          <Card style={styles.card} padding={0}>
            <SettingsRow
              icon="brightness-6"
              iconColor={theme.colors.primary}
              iconBg={theme.colors.primaryContainer}
              label="Theme"
              subtitle={themeLabel}
              onPress={handleThemePress}
            />
          </Card>
        </Animated.View>

        {/* Compression */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <SectionHeader title="COMPRESSION" />
          <Card style={styles.card} padding={0}>
            <SettingsRow
              icon="content-save-outline"
              iconColor={theme.colors.secondary}
              iconBg={theme.colors.secondaryContainer}
              label="Default Save Option"
              subtitle={saveOptionLabel}
              onPress={handleSaveOptionPress}
            />
          </Card>
        </Animated.View>

        {/* Notifications */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <SectionHeader title="NOTIFICATIONS" />
          <Card style={styles.card} padding={0}>
            <SettingsRow
              icon="bell-outline"
              iconColor={theme.colors.warning}
              iconBg={theme.colors.warningContainer}
              label="Compression Notifications"
              subtitle="Show progress in notification bar"
              rightElement={
                <Switch
                  value={showNotifications}
                  onValueChange={v => {
                    setShowNotifications(v);
                    SettingsService.set('showNotifications', v);
                  }}
                  trackColor={{
                    false: theme.colors.border,
                    true: theme.colors.primaryLight,
                  }}
                  thumbColor={
                    showNotifications
                      ? theme.colors.primary
                      : theme.colors.textTertiary
                  }
                />
              }
            />
          </Card>
        </Animated.View>

        {/* Privacy */}
        <Animated.View entering={FadeInDown.delay(250).springify()}>
          <SectionHeader title="PRIVACY" />
          <Card style={styles.card} padding={0}>
            <SettingsRow
              icon="shield-check-outline"
              iconColor={theme.colors.success}
              iconBg={theme.colors.successContainer}
              label="Privacy Policy"
              onPress={() => {}}
            />
            <View
              style={[styles.separator, {backgroundColor: theme.colors.divider}]}
            />
            <SettingsRow
              icon="source-branch"
              iconColor={theme.colors.primary}
              iconBg={theme.colors.primaryContainer}
              label="Open Source Licenses"
              onPress={() => {}}
            />
          </Card>
        </Animated.View>

        {/* About */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <SectionHeader title="ABOUT" />
          <Card style={styles.card} padding={0}>
            <SettingsRow
              icon="information-outline"
              iconColor={theme.colors.primary}
              iconBg={theme.colors.primaryContainer}
              label="Version"
              subtitle="1.0.0"
            />
            <View
              style={[styles.separator, {backgroundColor: theme.colors.divider}]}
            />
            <SettingsRow
              icon="star-outline"
              iconColor={theme.colors.warning}
              iconBg={theme.colors.warningContainer}
              label="Rate SpaceSaver"
              onPress={() => {}}
            />
          </Card>
        </Animated.View>

        {/* Danger zone */}
        <Animated.View entering={FadeInDown.delay(350).springify()}>
          <SectionHeader title="DATA" />
          <Card style={styles.card} padding={0}>
            <SettingsRow
              icon="trash-can-outline"
              iconColor={theme.colors.error}
              iconBg={theme.colors.errorContainer}
              label="Clear Compression History"
              danger
              onPress={() => {
                Alert.alert(
                  'Clear History',
                  'This will remove all compression records.',
                  [
                    {text: 'Cancel', style: 'cancel'},
                    {
                      text: 'Clear',
                      style: 'destructive',
                      onPress: () => HistoryService.clearAll(),
                    },
                  ],
                );
              }}
            />
          </Card>
        </Animated.View>

        {/* Privacy blurb */}
        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <View
            style={[
              styles.privacyBlurb,
              {backgroundColor: theme.colors.surfaceVariant},
            ]}>
            <Icon
              name="shield-lock-outline"
              size={20}
              color={theme.colors.success}
            />
            <Text
              style={[
                theme.typography.bodySmall,
                {color: theme.colors.textSecondary, flex: 1, lineHeight: 18},
              ]}>
              SpaceSaver processes all files entirely on your device. No data is
              ever uploaded, shared, or stored outside your phone.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  scroll: {paddingHorizontal: 20},
  sectionHeader: {
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    overflow: 'hidden',
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {flex: 1, gap: 1},
  separator: {
    height: 0.5,
    marginLeft: 66,
  },
  privacyBlurb: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    marginTop: 20,
  },
});
