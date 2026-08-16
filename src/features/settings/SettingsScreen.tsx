import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Pressable,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useTheme} from '../../app/theme/ThemeContext';
import {
  SettingsService,
  SaveOption,
  CleanupReminderFreq,
} from '../../shared/services/SettingsService';
import {HistoryService} from '../../shared/services/HistoryService';
import {StorageService} from '../../shared/services/StorageService';
import {useAlert} from '../../shared/components/AlertProvider';
import Card from '../../shared/components/Card';
import HeaderBar from '../../shared/components/HeaderBar';
import AnimatedButton from '../../shared/components/AnimatedButton';

interface SettingRowProps {
  icon: string;
  iconColor: string;
  iconBg: string;
  label: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}

function SettingRow({
  icon,
  iconColor,
  iconBg,
  label,
  subtitle,
  rightElement,
  onPress,
  danger,
}: SettingRowProps) {
  const {theme} = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={styles.row}>
      <View style={[styles.rowIcon, {backgroundColor: iconBg}]}>
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.rowContent}>
        <Text
          style={[
            theme.typography.titleSmall,
            {
              color: danger ? theme.colors.error : theme.colors.text,
              fontWeight: '600',
            },
          ]}>
          {label}
        </Text>
        {subtitle ? (
          <Text
            style={[
              theme.typography.bodySmall,
              {color: theme.colors.textSecondary, marginTop: 2},
            ]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightElement ??
        (onPress && (
          <Icon
            name="chevron-right"
            size={20}
            color={theme.colors.textTertiary}
          />
        ))}
    </TouchableOpacity>
  );
}

function SectionHeader({title}: {title: string}) {
  const {theme} = useTheme();
  return (
    <Text
      style={[
        theme.typography.labelMedium,
        styles.sectionHeader,
        {color: theme.colors.primary, letterSpacing: 0.8},
      ]}>
      {title}
    </Text>
  );
}

export default function SettingsScreen() {
  const {theme, isDark, themeMode, setThemeMode} = useTheme();
  const insets = useSafeAreaInsets();
  const alert = useAlert();

  const [saveOption, setSaveOption] = useState<SaveOption>(() =>
    SettingsService.get('defaultSaveOption'),
  );
  const [historyCount, setHistoryCount] = useState<number>(0);
  const [imageOptions, setImageOptions] = useState(() =>
    SettingsService.get('defaultImageOptions'),
  );
  const [videoOptions, setVideoOptions] = useState(() =>
    SettingsService.get('defaultVideoOptions'),
  );

  // Phase 3 Settings State
  const [cleanupReminders, setCleanupReminders] = useState<CleanupReminderFreq>(
    () => SettingsService.get('cleanupReminders'),
  );
  const [reminderThreshold, setReminderThreshold] = useState<number>(
    () => SettingsService.get('reminderThresholdBytes'),
  );
  const [includeOldMedia, setIncludeOldMedia] = useState<boolean>(() =>
    SettingsService.get('includeOldMedia'),
  );
  const [includeScreenshots, setIncludeScreenshots] = useState<boolean>(() =>
    SettingsService.get('includeScreenshots'),
  );

  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const refreshState = () => {
    setSaveOption(SettingsService.get('defaultSaveOption'));
    setHistoryCount(HistoryService.getAll().length);
    setImageOptions(SettingsService.get('defaultImageOptions'));
    setVideoOptions(SettingsService.get('defaultVideoOptions'));
    setCleanupReminders(SettingsService.get('cleanupReminders'));
    setReminderThreshold(SettingsService.get('reminderThresholdBytes'));
    setIncludeOldMedia(SettingsService.get('includeOldMedia'));
    setIncludeScreenshots(SettingsService.get('includeScreenshots'));
  };

  useEffect(() => {
    refreshState();
  }, []);

  const handleSaveOptionPress = () => {
    alert({
      title: 'Default Save Behavior',
      message:
        'Choose how SpaceSaver handles compressed media output by default:',
      type: 'info',
      icon: 'content-save-cog-outline',
      buttons: [
        {
          text: 'Ask Every Time',
          onPress: () => {
            setSaveOption('ask');
            SettingsService.set('defaultSaveOption', 'ask');
          },
        },
        {
          text: 'Save as New Copy',
          onPress: () => {
            setSaveOption('new');
            SettingsService.set('defaultSaveOption', 'new');
          },
        },
        {
          text: 'Replace Original',
          style: 'destructive',
          onPress: () => {
            setSaveOption('replace');
            SettingsService.set('defaultSaveOption', 'replace');
          },
        },
        {text: 'Cancel', style: 'cancel'},
      ],
    });
  };

  const handleReminderFreqPress = () => {
    alert({
      title: 'Cleanup Reminder Schedule',
      message: 'Choose how often SpaceSaver checks for storage saving opportunities:',
      type: 'info',
      icon: 'calendar-clock',
      buttons: [
        {
          text: 'Weekly',
          onPress: () => {
            setCleanupReminders('weekly');
            SettingsService.set('cleanupReminders', 'weekly');
          },
        },
        {
          text: 'Monthly',
          onPress: () => {
            setCleanupReminders('monthly');
            SettingsService.set('cleanupReminders', 'monthly');
          },
        },
        {
          text: 'Off (Disabled)',
          onPress: () => {
            setCleanupReminders('off');
            SettingsService.set('cleanupReminders', 'off');
          },
        },
        {text: 'Cancel', style: 'cancel'},
      ],
    });
  };

  const handleThresholdPress = () => {
    alert({
      title: 'Reminder Threshold',
      message: 'Only remind me when potential reclaimable space exceeds:',
      type: 'info',
      icon: 'database-outline',
      buttons: [
        {
          text: '1 GB',
          onPress: () => {
            const bytes = 1 * 1024 * 1024 * 1024;
            setReminderThreshold(bytes);
            SettingsService.set('reminderThresholdBytes', bytes);
          },
        },
        {
          text: '2 GB (Recommended)',
          onPress: () => {
            const bytes = 2 * 1024 * 1024 * 1024;
            setReminderThreshold(bytes);
            SettingsService.set('reminderThresholdBytes', bytes);
          },
        },
        {
          text: '5 GB',
          onPress: () => {
            const bytes = 5 * 1024 * 1024 * 1024;
            setReminderThreshold(bytes);
            SettingsService.set('reminderThresholdBytes', bytes);
          },
        },
        {text: 'Cancel', style: 'cancel'},
      ],
    });
  };

  const handleResetDefaults = () => {
    alert({
      title: 'Reset Preferences',
      message: 'Restore all compression options and save behaviors to default?',
      type: 'warning',
      icon: 'restore',
      buttons: [
        {
          text: 'Reset All',
          style: 'destructive',
          onPress: () => {
            SettingsService.reset();
            refreshState();
          },
        },
        {text: 'Cancel', style: 'cancel'},
      ],
    });
  };

  const handleClearHistory = () => {
    if (historyCount === 0) {
      alert({
        title: 'History Empty',
        message: 'There are no compression records to clear.',
        type: 'info',
        icon: 'information-outline',
      });
      return;
    }

    alert({
      title: 'Clear Compression History',
      message: `Delete ${historyCount} compression record${
        historyCount > 1 ? 's' : ''
      }? This cannot be undone.`,
      type: 'warning',
      icon: 'trash-can-outline',
      buttons: [
        {
          text: 'Clear History',
          style: 'destructive',
          onPress: () => {
            HistoryService.clearAll();
            setHistoryCount(0);
          },
        },
        {text: 'Cancel', style: 'cancel'},
      ],
    });
  };

  const saveOptionLabel =
    saveOption === 'new'
      ? 'Save as New Copy'
      : saveOption === 'replace'
      ? 'Replace Original (Saves Max Space)'
      : 'Ask Every Time';

  const imageQualityPct = Math.round((imageOptions?.quality ?? 0.75) * 100);
  const imagePresetLabel = `${
    imageOptions?.compressionLevel
      ? imageOptions.compressionLevel.charAt(0).toUpperCase() +
        imageOptions.compressionLevel.slice(1)
      : 'Medium'
  } · ${imageQualityPct}% Quality · ${(
    imageOptions?.outputFormat ?? 'jpeg'
  ).toUpperCase()}`;

  const videoPresetLabel = `${videoOptions?.resolution ?? '720p'} · ${(
    videoOptions?.videoCodec ?? 'h264'
  ).toUpperCase()} · ${
    videoOptions?.videoBitrate
      ? videoOptions.videoBitrate.charAt(0).toUpperCase() +
        videoOptions.videoBitrate.slice(1)
      : 'Auto'
  } Bitrate`;

  return (
    <View style={[styles.root, {backgroundColor: theme.colors.background}]}>
      <HeaderBar
        title="Settings"
        subtitle="Preferences & storage options"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {paddingBottom: insets.bottom + 100},
        ]}>
        {/* Appearance Section */}
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <SectionHeader title="APPEARANCE" />
          <Card style={styles.card} padding={0}>
            <View style={styles.themeSelectorContainer}>
              <View style={styles.themeSelectorHeader}>
                <View
                  style={[
                    styles.rowIcon,
                    {backgroundColor: theme.colors.primaryContainer},
                  ]}>
                  <Icon
                    name="palette-outline"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.rowContent}>
                  <Text
                    style={[
                      theme.typography.titleSmall,
                      {color: theme.colors.text, fontWeight: '600'},
                    ]}>
                    Theme
                  </Text>
                  <Text
                    style={[
                      theme.typography.bodySmall,
                      {color: theme.colors.textSecondary, marginTop: 2},
                    ]}>
                    {themeMode === 'system'
                      ? 'Following system default'
                      : `${
                          themeMode.charAt(0).toUpperCase() + themeMode.slice(1)
                        } theme active`}
                  </Text>
                </View>
              </View>

              {/* Segmented Control */}
              <View
                style={[
                  styles.segmentedControl,
                  {backgroundColor: theme.colors.surfaceVariant},
                ]}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.segmentButton,
                    themeMode === 'system' && {
                      backgroundColor: theme.colors.surface,
                      ...theme.elevation.sm,
                    },
                  ]}
                  onPress={() => setThemeMode('system')}>
                  <Icon
                    name="cellphone-cog"
                    size={16}
                    color={
                      themeMode === 'system'
                        ? theme.colors.primary
                        : theme.colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      theme.typography.labelMedium,
                      {
                        color:
                          themeMode === 'system'
                            ? theme.colors.primary
                            : theme.colors.textSecondary,
                        fontWeight: themeMode === 'system' ? '700' : '500',
                      },
                    ]}>
                    System
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.segmentButton,
                    themeMode === 'light' && {
                      backgroundColor: theme.colors.surface,
                      ...theme.elevation.sm,
                    },
                  ]}
                  onPress={() => setThemeMode('light')}>
                  <Icon
                    name="white-balance-sunny"
                    size={16}
                    color={
                      themeMode === 'light'
                        ? theme.colors.primary
                        : theme.colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      theme.typography.labelMedium,
                      {
                        color:
                          themeMode === 'light'
                            ? theme.colors.primary
                            : theme.colors.textSecondary,
                        fontWeight: themeMode === 'light' ? '700' : '500',
                      },
                    ]}>
                    Light
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.segmentButton,
                    themeMode === 'dark' && {
                      backgroundColor: theme.colors.surface,
                      ...theme.elevation.sm,
                    },
                  ]}
                  onPress={() => setThemeMode('dark')}>
                  <Icon
                    name="weather-night"
                    size={16}
                    color={
                      themeMode === 'dark'
                        ? theme.colors.primary
                        : theme.colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      theme.typography.labelMedium,
                      {
                        color:
                          themeMode === 'dark'
                            ? theme.colors.primary
                            : theme.colors.textSecondary,
                        fontWeight: themeMode === 'dark' ? '700' : '500',
                      },
                    ]}>
                    Dark
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Phase 3: Cleanup Reminders & Automation */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <SectionHeader title="CLEANUP REMINDERS & AUTOMATION" />
          <Card style={styles.card} padding={0}>
            <SettingRow
              icon="calendar-clock"
              iconColor="#6366F1"
              iconBg="rgba(99, 102, 241, 0.15)"
              label="Cleanup Reminders"
              subtitle={
                cleanupReminders === 'off'
                  ? 'Off (No reminders)'
                  : cleanupReminders === 'weekly'
                  ? 'Weekly review reminder'
                  : 'Monthly review reminder'
              }
              onPress={handleReminderFreqPress}
            />
            <View style={[styles.separator, {backgroundColor: theme.colors.divider}]} />

            <SettingRow
              icon="database-arrow-up-outline"
              iconColor="#3B82F6"
              iconBg="rgba(59, 130, 246, 0.15)"
              label="Reminder Threshold"
              subtitle={`Remind when savings reach ${StorageService.formatBytes(reminderThreshold)}`}
              onPress={handleThresholdPress}
            />
            <View style={[styles.separator, {backgroundColor: theme.colors.divider}]} />

            <SettingRow
              icon="clock-outline"
              iconColor="#8B5CF6"
              iconBg="rgba(139, 92, 246, 0.15)"
              label="Include Older Media"
              subtitle="Scan media files not modified recently"
              rightElement={
                <Switch
                  value={includeOldMedia}
                  onValueChange={val => {
                    setIncludeOldMedia(val);
                    SettingsService.set('includeOldMedia', val);
                  }}
                  thumbColor="#FFFFFF"
                  trackColor={{false: theme.colors.surfaceVariant, true: theme.colors.primary}}
                />
              }
            />
            <View style={[styles.separator, {backgroundColor: theme.colors.divider}]} />

            <SettingRow
              icon="cellphone-screenshot"
              iconColor="#F59E0B"
              iconBg="rgba(245, 158, 11, 0.15)"
              label="Include Screenshots"
              subtitle="Scan screenshots album for cleanup"
              rightElement={
                <Switch
                  value={includeScreenshots}
                  onValueChange={val => {
                    setIncludeScreenshots(val);
                    SettingsService.set('includeScreenshots', val);
                  }}
                  thumbColor="#FFFFFF"
                  trackColor={{false: theme.colors.surfaceVariant, true: theme.colors.primary}}
                />
              }
            />
          </Card>
        </Animated.View>

        {/* Storage & Saving Section */}
        <Animated.View entering={FadeInDown.delay(140).springify()}>
          <SectionHeader title="STORAGE & SAVING" />
          <Card style={styles.card} padding={0}>
            <SettingRow
              icon="content-save-cog-outline"
              iconColor={theme.colors.secondary}
              iconBg={theme.colors.secondaryContainer}
              label="Default Save Behavior"
              subtitle={saveOptionLabel}
              onPress={handleSaveOptionPress}
            />
            <View
              style={[
                styles.separator,
                {backgroundColor: theme.colors.divider},
              ]}
            />
            <SettingRow
              icon="image-size-select-small"
              iconColor={theme.colors.primary}
              iconBg={theme.colors.primaryContainer}
              label="Default Photo Quality"
              subtitle={imagePresetLabel}
            />
            <View
              style={[
                styles.separator,
                {backgroundColor: theme.colors.divider},
              ]}
            />
            <SettingRow
              icon="video-vintage"
              iconColor={theme.colors.warning}
              iconBg={theme.colors.warningContainer}
              label="Default Video Quality"
              subtitle={videoPresetLabel}
            />
          </Card>
        </Animated.View>

        {/* Background & Notifications Section */}
        <Animated.View entering={FadeInDown.delay(180).springify()}>
          <SectionHeader title="BACKGROUND PROCESSING" />
          <Card style={styles.card} padding={0}>
            <SettingRow
              icon="bell-ring-outline"
              iconColor={theme.colors.success}
              iconBg={theme.colors.successContainer}
              label="Foreground Compression Service"
              subtitle="Shows persistent progress in notification bar while processing in background"
              rightElement={
                <View
                  style={[
                    styles.activeBadge,
                    {backgroundColor: theme.colors.successContainer},
                  ]}>
                  <Text
                    style={[
                      theme.typography.labelSmall,
                      {color: theme.colors.success, fontWeight: '700'},
                    ]}>
                    ACTIVE
                  </Text>
                </View>
              }
            />
          </Card>
        </Animated.View>

        {/* Data Management Section */}
        <Animated.View entering={FadeInDown.delay(220).springify()}>
          <SectionHeader title="DATA MANAGEMENT" />
          <Card style={styles.card} padding={0}>
            <SettingRow
              icon="history"
              iconColor={theme.colors.error}
              iconBg={theme.colors.errorContainer}
              label="Clear Compression History"
              subtitle={
                historyCount > 0
                  ? `${historyCount} record${
                      historyCount > 1 ? 's' : ''
                    } saved in history`
                  : 'No compression records'
              }
              danger
              onPress={handleClearHistory}
            />
            <View
              style={[
                styles.separator,
                {backgroundColor: theme.colors.divider},
              ]}
            />
            <SettingRow
              icon="restore"
              iconColor={theme.colors.textSecondary}
              iconBg={theme.colors.surfaceVariant}
              label="Reset Preferences"
              subtitle="Restore default save and compression settings"
              onPress={handleResetDefaults}
            />
          </Card>
        </Animated.View>

        {/* About & Privacy Section */}
        <Animated.View entering={FadeInDown.delay(260).springify()}>
          <SectionHeader title="ABOUT & PRIVACY" />
          <Card style={styles.aboutCard} padding={16}>
            <View style={styles.aboutHeader}>
              <View
                style={[
                  styles.logoBadge,
                  {backgroundColor: theme.colors.primary},
                ]}>
                <Icon name="archive-arrow-down" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.aboutTitleContainer}>
                <Text
                  style={[
                    theme.typography.titleMedium,
                    {color: theme.colors.text, fontWeight: '700'},
                  ]}>
                  SpaceSaver
                </Text>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: theme.colors.textSecondary},
                  ]}>
                  Version 3.0.0 · Local Media Manager
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.privacyGuarantee,
                {backgroundColor: theme.colors.surfaceVariant},
              ]}
              onPress={() => setShowPrivacyModal(true)}>
              <Icon
                name="shield-check"
                size={22}
                color={theme.colors.success}
              />
              <View style={{flex: 1}}>
                <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
                  Privacy Dashboard
                </Text>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {color: theme.colors.textSecondary, marginTop: 2},
                  ]}>
                  100% On-Device & Offline. No clouds, no logins, no telemetry. Tap to learn more.
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          </Card>
        </Animated.View>
      </ScrollView>

      {/* Privacy Dashboard Modal */}
      <Modal
        visible={showPrivacyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPrivacyModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalPressable} onPress={() => setShowPrivacyModal(false)} />
          <View
            style={[
              styles.privacyModalSheet,
              {backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 20},
            ]}>
            <View style={styles.sheetHandle} />

            <View style={styles.privacyModalHeader}>
              <View style={[styles.privacyIconBadge, {backgroundColor: 'rgba(34, 197, 94, 0.15)'}]}>
                <Icon name="shield-lock" size={32} color={theme.colors.success} />
              </View>
              <Text style={[theme.typography.titleLarge, {color: theme.colors.text, fontWeight: '800', marginTop: 12}]}>
                Your Privacy
              </Text>
              <Text style={[theme.typography.bodyMedium, {color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4}]}>
                SpaceSaver operates with a strict offline-first, local-first architecture.
              </Text>
            </View>

            <View style={styles.privacyPointsList}>
              <View style={styles.privacyPointRow}>
                <Icon name="check-circle" size={20} color={theme.colors.success} />
                <View style={{flex: 1, marginLeft: 12}}>
                  <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
                    No Account Required
                  </Text>
                  <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
                    You never need to sign up, log in, or provide personal credentials.
                  </Text>
                </View>
              </View>

              <View style={styles.privacyPointRow}>
                <Icon name="check-circle" size={20} color={theme.colors.success} />
                <View style={{flex: 1, marginLeft: 12}}>
                  <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
                    No Cloud Uploads
                  </Text>
                  <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
                    All photo and video compression, format conversions, and hashing run strictly on-device.
                  </Text>
                </View>
              </View>

              <View style={styles.privacyPointRow}>
                <Icon name="check-circle" size={20} color={theme.colors.success} />
                <View style={{flex: 1, marginLeft: 12}}>
                  <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
                    No Remote Backend
                  </Text>
                  <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
                    No media, hashes, or metadata are ever transmitted outside your phone.
                  </Text>
                </View>
              </View>
            </View>

            <AnimatedButton
              onPress={() => setShowPrivacyModal(false)}
              variant="primary"
              size="lg"
              fullWidth
              style={{marginTop: 20}}>
              <Text style={[theme.typography.titleSmall, {color: '#FFFFFF', fontWeight: '700'}]}>
                Understood
              </Text>
            </AnimatedButton>
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
    paddingTop: 4,
  },
  sectionHeader: {
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
    fontWeight: '700',
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
  },
  themeSelectorContainer: {
    padding: 16,
  },
  themeSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  activeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aboutCard: {
    borderRadius: 20,
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutTitleContainer: {
    flex: 1,
  },
  privacyGuarantee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalPressable: {
    flex: 1,
  },
  privacyModalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
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
  privacyModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  privacyIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyPointsList: {
    gap: 14,
  },
  privacyPointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
