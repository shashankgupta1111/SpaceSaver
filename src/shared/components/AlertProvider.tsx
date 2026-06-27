import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {View, Text, StyleSheet, Modal, Pressable} from 'react-native';
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
 * Returns a function that shows a custom, themed alert.
 * Drop-in mental model for `Alert.alert`, but prettier and reusable:
 *
 *   const alert = useAlert();
 *   alert({ title, message, type, buttons });
 */
export function useAlert(): AlertFn {
  return useContext(AlertContext);
}

interface TypeStyle {
  icon: string;
  accent: string;
  container: string;
}

function useTypeStyle(type: AlertType): TypeStyle {
  const {theme} = useTheme();
  const map: Record<AlertType, TypeStyle> = {
    success: {
      icon: 'check-circle',
      accent: theme.colors.success,
      container: theme.colors.successContainer,
    },
    error: {
      icon: 'alert-circle',
      accent: theme.colors.error,
      container: theme.colors.errorContainer,
    },
    warning: {
      icon: 'alert',
      accent: theme.colors.warning,
      container: theme.colors.warningContainer,
    },
    info: {
      icon: 'information',
      accent: theme.colors.primary,
      container: theme.colors.primaryContainer,
    },
    confirm: {
      icon: 'help-circle',
      accent: theme.colors.primary,
      container: theme.colors.primaryContainer,
    },
  };
  return map[type];
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
  const {theme} = useTheme();
  const type = config?.type ?? 'info';
  const typeStyle = useTypeStyle(type);
  const iconScale = useSharedValue(0);

  const buttons: AlertButton[] =
    config?.buttons && config.buttons.length > 0
      ? config.buttons
      : [{text: 'OK', style: 'default'}];

  // Side-by-side only when exactly two buttons with short labels.
  const horizontal =
    buttons.length === 2 && buttons.every(b => b.text.length <= 14);

  const iconAnim = useAnimatedStyle(() => ({
    transform: [{scale: iconScale.value}],
  }));

  const handlePress = (button: AlertButton) => {
    onClose();
    // Let the dismiss animation start before running the action.
    button.onPress?.();
  };

  const onIconLayout = () => {
    iconScale.value = withSequence(
      withSpring(1.15, {damping: 9, stiffness: 220}),
      withSpring(1, {damping: 12, stiffness: 220}),
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
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={styles.backdrop}>
          <Pressable style={styles.backdropPress} onPress={onClose} />

          <Animated.View
            key={config?.title}
            entering={ZoomIn.springify().damping(16).mass(0.6)}
            style={[
              styles.card,
              {backgroundColor: theme.colors.surface, ...theme.elevation.xl},
            ]}>
            {/* Icon badge */}
            <Animated.View
              onLayout={onIconLayout}
              style={[
                styles.iconBadge,
                {backgroundColor: typeStyle.container},
                iconAnim,
              ]}>
              <Icon
                name={config?.icon ?? typeStyle.icon}
                size={34}
                color={typeStyle.accent}
              />
            </Animated.View>

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

            {/* Buttons */}
            <View
              style={[
                styles.buttonGroup,
                horizontal ? styles.buttonRow : styles.buttonColumn,
              ]}>
              {buttons.map((button, index) => {
                const isDestructive = button.style === 'destructive';
                const isCancel = button.style === 'cancel';
                const isPrimary = !isCancel; // default + destructive get a filled look

                const bg = isDestructive
                  ? theme.colors.error
                  : isCancel
                  ? theme.colors.surfaceVariant
                  : theme.colors.primary;
                const fg = isCancel ? theme.colors.text : '#FFFFFF';

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
                      styles.button,
                      horizontal && styles.buttonFlex,
                      {
                        backgroundColor: bg,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}>
                    <Text
                      style={[
                        theme.typography.titleSmall,
                        {color: fg, fontWeight: isCancel ? '600' : '700'},
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 4,
  },
  buttonGroup: {
    width: '100%',
    marginTop: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonColumn: {
    flexDirection: 'column',
    gap: 10,
  },
  button: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFlex: {
    flex: 1,
  },
});
