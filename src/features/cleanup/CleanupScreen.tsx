import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery} from '@tanstack/react-query';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList} from '../../app/navigation/types';
import {MediaService, MediaAlbum} from '../../shared/services/MediaService';
import HeaderBar from '../../shared/components/HeaderBar';
import EmptyState from '../../shared/components/EmptyState';
import Loader from '../../shared/components/Loader';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Icon + accent for well-known buckets so common cleanup targets stand out. */
function albumVisual(title: string): {icon: string; hot: boolean} {
  const t = title.toLowerCase();
  if (t.includes('screenshot')) {return {icon: 'cellphone-screenshot', hot: true};}
  if (t.includes('download')) {return {icon: 'download', hot: true};}
  if (t.includes('whatsapp')) {return {icon: 'whatsapp', hot: true};}
  if (t.includes('telegram')) {return {icon: 'send', hot: true};}
  if (t.includes('meme')) {return {icon: 'emoticon-lol-outline', hot: true};}
  if (t.includes('camera') || t.includes('dcim')) {return {icon: 'camera', hot: false};}
  if (t.includes('instagram') || t.includes('facebook')) {return {icon: 'instagram', hot: true};}
  return {icon: 'folder-image', hot: false};
}

export default function CleanupScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [permission, setPermission] = useState<'checking' | 'granted' | 'denied'>(
    'checking',
  );

  useEffect(() => {
    let alive = true;
    MediaService.ensureMediaPermission().then(ok => {
      if (alive) {setPermission(ok ? 'granted' : 'denied');}
    });
    return () => {
      alive = false;
    };
  }, []);

  const {data: albums = [], isLoading} = useQuery({
    queryKey: ['albums'],
    queryFn: () => MediaService.getAlbums(),
    enabled: permission === 'granted',
    staleTime: 30_000,
  });

  return (
    <View
      style={[
        styles.root,
        {backgroundColor: theme.colors.background, paddingTop: insets.top},
      ]}>
      <HeaderBar title="Clean by Album" showBack />

      {permission === 'denied' ? (
        <EmptyState
          type="images"
          title="Permission needed"
          description="Grant photo & video access to clean up albums like Screenshots and Downloads."
          actionLabel="Grant access"
          onAction={() =>
            MediaService.ensureMediaPermission().then(ok =>
              setPermission(ok ? 'granted' : 'denied'),
            )
          }
        />
      ) : isLoading || permission === 'checking' ? (
        <Loader fullscreen label="Reading your albums…" />
      ) : (
        <FlatList
          data={albums}
          keyExtractor={item => item.title}
          ListHeaderComponent={
            <Text
              style={[
                theme.typography.bodyMedium,
                {color: theme.colors.textSecondary, paddingHorizontal: 20, paddingBottom: 12},
              ]}>
              Bulk-review screenshots, downloads and app media, then delete what
              you don't need.
            </Text>
          }
          contentContainerStyle={{paddingBottom: insets.bottom + 24}}
          renderItem={({item, index}) => (
            <AlbumRow
              album={item}
              index={index}
              onPress={() =>
                navigation.navigate('AlbumDetail', {
                  albumTitle: item.title,
                  assetType: 'All',
                })
              }
            />
          )}
        />
      )}
    </View>
  );
}

function AlbumRow({
  album,
  index,
  onPress,
}: {
  album: MediaAlbum;
  index: number;
  onPress: () => void;
}) {
  const {theme} = useTheme();
  const {icon, hot} = albumVisual(album.title);
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 12) * 30).springify()}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={[styles.row, {backgroundColor: theme.colors.surface, ...theme.elevation.sm}]}>
        <View
          style={[
            styles.iconBox,
            {backgroundColor: hot ? theme.colors.primaryContainer : theme.colors.surfaceVariant},
          ]}>
          <Icon
            name={icon}
            size={22}
            color={hot ? theme.colors.primary : theme.colors.textSecondary}
          />
        </View>
        <View style={{flex: 1}}>
          <Text style={[theme.typography.bodyMedium, {color: theme.colors.text}]} numberOfLines={1}>
            {album.title}
          </Text>
          <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
            {album.count} item{album.count > 1 ? 's' : ''}
          </Text>
        </View>
        <Icon name="chevron-right" size={22} color={theme.colors.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 16,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
