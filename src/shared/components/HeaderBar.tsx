import React, {ReactNode} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useTheme} from '../../app/theme/ThemeContext';

interface HeaderBarProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightActions?: ReactNode;
  style?: ViewStyle;
  large?: boolean;
  transparent?: boolean;
}

export function HeaderBar({
  title,
  subtitle,
  showBack = false,
  rightActions,
  style,
  large = false,
  transparent = false,
}: HeaderBarProps) {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + (large ? 16 : 8),
          backgroundColor: transparent ? 'transparent' : theme.colors.background,
          borderBottomColor: transparent ? 'transparent' : theme.colors.borderLight,
        },
        !transparent && styles.border,
        style,
      ]}>
      <View style={styles.row}>
        {showBack && (
          <TouchableOpacity
            style={[styles.backBtn, {backgroundColor: theme.colors.surfaceVariant}]}
            onPress={() => navigation.goBack()}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <Icon name="chevron-left" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        <View style={[styles.titleContainer, showBack && styles.titleWithBack]}>
          <Text
            style={[
              large ? theme.typography.headlineSmall : theme.typography.titleLarge,
              {color: theme.colors.text},
            ]}
            numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[
                theme.typography.bodySmall,
                {color: theme.colors.textSecondary, marginTop: 2},
              ]}>
              {subtitle}
            </Text>
          )}
        </View>
        {rightActions && (
          <View style={styles.rightActions}>{rightActions}</View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  border: {
    borderBottomWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  titleWithBack: {
    flex: 1,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default HeaderBar;
