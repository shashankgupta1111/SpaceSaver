import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {useTheme} from '../../app/theme/ThemeContext';
import {HistoryService} from '../../shared/services/HistoryService';
import {StorageService} from '../../shared/services/StorageService';
import {HistoryItem} from '../../app/navigation/types';
import EmptyState from '../../shared/components/EmptyState';
import HeaderBar from '../../shared/components/HeaderBar';
import {useAlert} from '../../shared/components/AlertProvider';
import Card from '../../shared/components/Card';
import {format} from 'date-fns';

type FilterType = 'all' | 'images' | 'videos';

function HistoryCard({
  item,
  index,
  onDelete,
}: {
  item: HistoryItem;
  index: number;
  onDelete: (id: string) => void;
}) {
  const {theme} = useTheme();

  return (
    <Animated.View entering={FadeInDown.delay(index * 30).springify()}>
      <Card style={styles.card}>
        <View style={styles.cardRow}>
          {/* Thumbnail */}
          <View style={styles.thumbContainer}>
            {item.type === 'image' ? (
              <Image
                source={{uri: item.compressedUri}}
                style={[
                  styles.thumb,
                  {backgroundColor: theme.colors.surfaceVariant},
                ]}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.thumb,
                  styles.videoThumb,
                  {backgroundColor: theme.colors.surfaceVariant},
                ]}>
                <Icon
                  name="video-play"
                  size={24}
                  color={theme.colors.textTertiary}
                />
              </View>
            )}
            <View
              style={[
                styles.typeTag,
                {
                  backgroundColor:
                    item.type === 'image'
                      ? theme.colors.primaryContainer
                      : theme.colors.secondaryContainer,
                },
              ]}>
              <Icon
                name={item.type === 'image' ? 'image' : 'video'}
                size={10}
                color={
                  item.type === 'image'
                    ? theme.colors.primary
                    : theme.colors.secondary
                }
              />
            </View>
          </View>

          {/* Info */}
          <View style={styles.info}>
            <Text
              style={[theme.typography.titleSmall, {color: theme.colors.text}]}
              numberOfLines={1}>
              {item.fileName}
            </Text>
            <View style={styles.sizeRow}>
              <Text
                style={[
                  theme.typography.bodySmall,
                  {color: theme.colors.textTertiary},
                ]}>
                {StorageService.formatBytes(item.originalSize)}
              </Text>
              <Icon
                name="arrow-right"
                size={12}
                color={theme.colors.textTertiary}
              />
              <Text
                style={[
                  theme.typography.bodySmall,
                  {color: theme.colors.textSecondary},
                ]}>
                {StorageService.formatBytes(item.compressedSize)}
              </Text>
            </View>
            <Text
              style={[
                theme.typography.bodySmall,
                {color: theme.colors.textTertiary},
              ]}>
              {format(new Date(item.timestamp), 'MMM d, yyyy · h:mm a')}
            </Text>
          </View>

          {/* Saved badge */}
          <View style={styles.rightSection}>
            <View
              style={[
                styles.savedBadge,
                {backgroundColor: theme.colors.successContainer},
              ]}>
              <Text
                style={[
                  theme.typography.labelLarge,
                  {color: theme.colors.success, fontWeight: '800'},
                ]}>
                -{item.savedPercent}%
              </Text>
            </View>
            <Text
              style={[
                theme.typography.bodySmall,
                {color: theme.colors.success},
              ]}>
              {StorageService.formatBytesShort(item.savedBytes)} saved
            </Text>
            <TouchableOpacity
              onPress={() => onDelete(item.id)}
              style={styles.deleteBtn}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Icon
                name="trash-can-outline"
                size={16}
                color={theme.colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

export default function HistoryScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const alert = useAlert();

  const [filter, setFilter] = useState<FilterType>('all');

  const {data: historyItems = [], refetch} = useQuery({
    queryKey: ['history'],
    queryFn: () => HistoryService.getAll(),
  });

  const totalSaved = historyItems.reduce((s, i) => s + i.savedBytes, 0);

  const filteredItems =
    filter === 'all'
      ? historyItems
      : historyItems.filter(i => i.type === (filter === 'images' ? 'image' : 'video'));

  const handleDelete = useCallback(
    (id: string) => {
      alert({
        title: 'Delete Record',
        message: 'Remove this item from history?',
        type: 'warning',
        icon: 'trash-can-outline',
        buttons: [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              HistoryService.delete(id);
              queryClient.invalidateQueries({queryKey: ['history']});
            },
          },
        ],
      });
    },
    [queryClient, alert],
  );

  const handleClearAll = () => {
    alert({
      title: 'Clear History',
      message:
        'This will remove all compression history records. This cannot be undone.',
      type: 'warning',
      icon: 'trash-can-outline',
      buttons: [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            HistoryService.clearAll();
            queryClient.invalidateQueries({queryKey: ['history']});
          },
        },
      ],
    });
  };

  return (
    <View
      style={[
        styles.root,
        {backgroundColor: theme.colors.background, paddingTop: insets.top},
      ]}>
      <HeaderBar
        title="History"
        showBack
        rightActions={
          historyItems.length > 0 ? (
            <TouchableOpacity
              onPress={handleClearAll}
              style={[
                styles.clearBtn,
                {backgroundColor: theme.colors.errorContainer},
              ]}>
              <Icon name="trash-can" size={16} color={theme.colors.error} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Total saved summary */}
      {historyItems.length > 0 && (
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={[
            styles.summaryCard,
            {backgroundColor: theme.colors.successContainer},
          ]}>
          <Icon name="leaf" size={20} color={theme.colors.success} />
          <Text
            style={[theme.typography.bodyMedium, {color: theme.colors.success}]}>
            Total saved:{' '}
            <Text style={{fontWeight: '700'}}>
              {StorageService.formatBytes(totalSaved)}
            </Text>{' '}
            across {historyItems.length} files
          </Text>
        </Animated.View>
      )}

      {/* Filter chips */}
      {historyItems.length > 0 && (
        <View style={styles.filterRow}>
          {(['all', 'images', 'videos'] as FilterType[]).map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[
                styles.filterChip,
                filter === f
                  ? {backgroundColor: theme.colors.primary}
                  : {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                    },
              ]}>
              <Text
                style={[
                  theme.typography.labelMedium,
                  {
                    color:
                      filter === f ? 'white' : theme.colors.textSecondary,
                  },
                ]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {filteredItems.length === 0 ? (
        <EmptyState
          type="history"
          title="No History Yet"
          description="Your compression history will appear here after you compress images or videos."
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.list,
            {paddingBottom: insets.bottom + 20},
          ]}
          renderItem={({item, index}) => (
            <HistoryCard item={item} index={index} onDelete={handleDelete} />
          )}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{height: 0}} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  list: {paddingHorizontal: 20},
  card: {marginBottom: 10},
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbContainer: {
    position: 'relative',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  videoThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeTag: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {flex: 1, gap: 3},
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 4,
  },
  savedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  deleteBtn: {
    marginTop: 4,
  },
});
