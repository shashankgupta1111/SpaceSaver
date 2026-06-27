import React from 'react';
import {View, StyleSheet, Platform} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {BottomTabParamList} from './types';
import {useTheme} from '../theme/ThemeContext';
import HomeScreen from '../../features/home/HomeScreen';
import ImagesScreen from '../../features/images/ImagesScreen';
import VideosScreen from '../../features/videos/VideosScreen';
import SettingsScreen from '../../features/settings/SettingsScreen';

const Tab = createBottomTabNavigator<BottomTabParamList>();

interface TabIconProps {
  name: string;
  focused: boolean;
  color: string;
  size: number;
  label: string;
}

function TabIcon({name, focused, color, label}: TabIconProps) {
  const {theme} = useTheme();
  const scale = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0, {
      damping: 15,
      stiffness: 200,
    });
  }, [focused, scale]);

  const pillStyle = useAnimatedStyle(() => ({
    width: interpolate(scale.value, [0, 1], [0, 56]),
    opacity: withTiming(focused ? 1 : 0, {duration: 200}),
  }));

  const iconTranslate = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withSpring(focused ? -1 : 0, {
          damping: 15,
          stiffness: 200,
        }),
      },
      {
        scale: withSpring(focused ? 1.05 : 1, {
          damping: 15,
          stiffness: 200,
        }),
      },
    ],
  }));

  return (
    <View style={styles.tabItem}>
      <View style={styles.iconContainer}>
        <Animated.View
          style={[
            styles.activePill,
            {backgroundColor: theme.colors.primaryContainer},
            pillStyle,
          ]}
        />
        <Animated.View style={iconTranslate}>
          <Icon name={name} size={22} color={color} />
        </Animated.View>
      </View>
      <Animated.Text
        style={[
          styles.tabLabel,
          {
            color,
            ...theme.typography.labelSmall,
            fontWeight: focused ? '600' : '400',
          },
        ]}>
        {label}
      </Animated.Text>
    </View>
  );
}

export default function BottomTabNavigator() {
  const {theme} = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: theme.colors.tabBarBackground,
            borderTopColor: theme.colors.tabBarBorder,
          },
        ],
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: props => (
            <TabIcon
              {...props}
              name={props.focused ? 'home' : 'home-outline'}
              label="Home"
            />
          ),
        }}
      />
      <Tab.Screen
        name="Images"
        component={ImagesScreen}
        options={{
          tabBarIcon: props => (
            <TabIcon
              {...props}
              name={props.focused ? 'image-multiple' : 'image-multiple-outline'}
              label="Images"
            />
          ),
        }}
      />
      <Tab.Screen
        name="Videos"
        component={VideosScreen}
        options={{
          tabBarIcon: props => (
            <TabIcon
              {...props}
              name={props.focused ? 'video' : 'video-outline'}
              label="Videos"
            />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: props => (
            <TabIcon
              {...props}
              name={props.focused ? 'cog' : 'cog-outline'}
              label="Settings"
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'android' ? 60 : 80,
    paddingBottom: Platform.OS === 'android' ? 6 : 20,
    paddingTop: 6,
    borderTopWidth: 0.5,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 4,
  },
  iconContainer: {
    width: 56,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    overflow: 'hidden',
  },
  activePill: {
    position: 'absolute',
    height: 28,
    borderRadius: 14,
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: 12,
  },
});
