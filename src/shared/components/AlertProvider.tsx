import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

import {useTheme} from '../../app/theme/ThemeContext';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';
export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AlertButton {
  text: string;
  style?: AlertButtonStyle;
  onPress?: () => void;
}

export interface AlertConfig {
  title: string;
  message?: string;
  type?: AlertType;
  /** Override the auto-selected icon (MaterialCommunityIcons name). */
  icon?: string;
  buttons?: AlertButton[];
}

type AlertFn = (config: AlertConfig) => void;

const AlertContext = createContext<AlertFn>(() => {});

/**
 * Returns a function that shows a custom, themed alert popup.
 * Drop-in mental model for `Alert.alert`, with animated spring physics and modern design tokens.
 *
 *   const alert = useAlert();
 *   alert({ title, message, type, buttons });
 */
export function useAlert(): AlertFn {
  return useContext(AlertContext);
}

interface TypeConfig {
  icon: string;
  accent: string;
  gradient: [string, string];
  container: string;
  glow: string;
}

function useTypeConfig(type: AlertType): TypeConfig {
  const {theme, isDark} = useTheme();

  const configs: Record<AlertType, TypeConfig> = {
    success: {
      icon: 'check-circle',
      accent: theme.colors.success,
      gradient: isDark ? ['#22C55E', '#16A34A'] : ['#4ADE80', '#22C55E'],
      container: theme.colors.successContainer,
      glow: isDark ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.18)',
    },
    error: {
      icon: 'alert-circle',
      accent: theme.colors.error,
      gradient: isDark ? ['#EF4444', '#DC2626'] : ['#F87171', '#EF4444'],
      container: theme.colors.errorContainer,
      glow: isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.18)',
    },
    warning: {
      icon: 'alert',
      accent: theme.colors.warning,
      gradient: isDark ? ['#F59E0B', '#D97706'] : ['#FCD34D', '#F59E0B'],
      container: theme.colors.warningContainer,
      glow: isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.18)',
    },
    info: {
      icon: 'information-variant',
      accent: theme.colors.primary,
      gradient: isDark ? ['#8B8FF5', '#5B5FEF'] : ['#5B5FEF', '#7C4DFF'],
      container: theme.colors.primaryContainer,
      glow: isDark ? 'rgba(91, 95, 239, 0.25)' : 'rgba(91, 95, 239, 0.18)',
    },
    confirm: {
      icon: 'help-circle-outline',
      accent: theme.colors.secondary,
      gradient: isDark ? ['#C9A4FF', '#7C4DFF'] : ['#7C4DFF', '#5C2FCC'],
      container: theme.colors.secondaryContainer,
      glow: isDark ? 'rgba(124, 77, 255, 0.25)' : 'rgba(124, 77, 255, 0.18)',
    },
  };

  return configs[type] ?? configs.info;
}

export function AlertProvider({children}: {children: React.ReactNode}) {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const alert = useCallback((cfg: AlertConfig) => {
    setConfig(cfg);
    setVisible(true);
  }, []);

  const close = useCallback(() => setVisible(false), []);

  return (
    <AlertContext.Provider value={alert}>
      {children}
      <AlertModal visible={visible} config={config} onClose={close} />
    </AlertContext.Provider>
  );
}

function AlertModal({
  visible,
  config,
  onClose,
}: {
  visible: boolean;
  config: AlertConfig | null;
  onClose: () => void;
}) {
  const {theme, isDark} = useTheme();
  const type = config?.type ?? 'info';
  const typeStyle = useTypeConfig(type);
  const iconScale = useSharedValue(0.2);

  const buttons: AlertButton[] =
    config?.buttons && config.buttons.length > 0
      ? config.buttons
      : [{text: 'OK', style: 'default'}];

  // Side-by-side only when exactly two buttons with short labels
  const isHorizontal =
    buttons.length === 2 && buttons.every(b => b.text.length <= 15);

  const isMultiChoice = buttons.length > 2;

  const iconAnim = useAnimatedStyle(() => ({
    transform: [{scale: iconScale.value}],
  }));

  const handlePress = (button: AlertButton) => {
    onClose();
    button.onPress?.();
  };

  const onIconLayout = () => {
    iconScale.value = withSequence(
      withSpring(1.18, {damping: 8, stiffness: 240}),
      withSpring(1, {damping: 14, stiffness: 240}),
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}>
      {visible && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          style={[
            styles.backdrop,
            {
              backgroundColor: isDark
                ? 'rgba(0, 0, 0, 0.72)'
                : 'rgba(15, 23, 42, 0.55)',
            },
          ]}>
          <Pressable style={styles.backdropPress} onPress={onClose} />

          <Animated.View
            key={config?.title}
            entering={ZoomIn.springify().damping(18).mass(0.65).stiffness(200)}
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: isDark
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(0, 0, 0, 0.06)',
                ...theme.elevation.xl,
              },
            ]}>
            {/* Ambient Icon Aura */}
            <View style={styles.iconWrapper}>
              <View
                style={[
                  styles.iconGlow,
                  {backgroundColor: typeStyle.glow},
                ]}
              />
              <Animated.View
                onLayout={onIconLayout}
                style={[styles.iconBadge, iconAnim]}>
                <LinearGradient
                  colors={typeStyle.gradient}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}
                  style={styles.iconGradient}>
                  <Icon
                    name={config?.icon ?? typeStyle.icon}
                    size={32}
                    color="#FFFFFF"
                  />
                </LinearGradient>
              </Animated.View>
            </View>

            {/* Title */}
            <Text
              style={[
                theme.typography.titleLarge,
                styles.title,
                {color: theme.colors.text},
              ]}>
              {config?.title}
            </Text>

            {/* Message */}
            {!!config?.message && (
              <Text
                style={[
                  theme.typography.bodyMedium,
                  styles.message,
                  {color: theme.colors.textSecondary},
                ]}>
                {config.message}
              </Text>
            )}

            {/* Button Actions */}
            <View
              style={[
                styles.buttonContainer,
                isHorizontal ? styles.buttonRow : styles.buttonStack,
              ]}>
              {buttons.map((button, index) => {
                const isDestructive = button.style === 'destructive';
                const isCancel = button.style === 'cancel';
                const isPrimary = !isCancel && !isDestructive;

                return (
                  <Pressable
                    key={`${button.text}-${index}`}
                    onPress={() => handlePress(button)}
                    android_ripple={{
                      color: isCancel
                        ? theme.colors.border
                        : 'rgba(255,255,255,0.2)',
                    }}
                    style={({pressed}) => [
                      styles.buttonBase,
                      isHorizontal && styles.buttonFlex,
                      isMultiChoice && styles.multiChoiceButton,
                      {
                        backgroundColor: isDestructive
                          ? isDark
                            ? 'rgba(239, 68, 68, 0.16)'
                            : '#FEE2E2'
                          : isCancel
                          ? theme.colors.surfaceVariant
                          : theme.colors.primary,
                        borderColor: isDestructive
                          ? theme.colors.error
                          : isCancel
                          ? theme.colors.border
                          : 'transparent',
                        borderWidth: isDestructive || (isCancel && isMultiChoice) ? 1 : 0,
                        opacity: pressed ? 0.85 : 1,
                        transform: [{scale: pressed ? 0.98 : 1}],
                      },
                    ]}>
                    <Text
                      style={[
                        theme.typography.labelLarge,
                        styles.buttonText,
                        {
                          color: isDestructive
                            ? theme.colors.error
                            : isCancel
                            ? theme.colors.text
                            : '#FFFFFF',
                          fontWeight: isCancel ? '600' : '700',
                        },
                      ]}>
                      {button.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 26,
    marginBottom: 8,
  },
  message: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonStack: {
    flexDirection: 'column',
    gap: 10,
  },
  buttonBase: {
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonFlex: {
    flex: 1,
  },
  multiChoiceButton: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 14,
  },
  buttonText: {
    fontSize: 15,
    textAlign: 'center',
  },
});
