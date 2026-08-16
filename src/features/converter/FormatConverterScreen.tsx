import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useTheme} from '../../app/theme/ThemeContext';
import {RootStackParamList, CompressionOptions} from '../../app/navigation/types';
import Card from '../../shared/components/Card';
import AnimatedButton from '../../shared/components/AnimatedButton';
import {VideoThumbnail} from '../../shared/components/VideoThumbnail';
import {CameraRoll, PhotoIdentifier} from '@react-native-camera-roll/camera-roll';
import {MediaService, LargeFile} from '../../shared/services/MediaService';
import {StorageService} from '../../shared/services/StorageService';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'FormatConverter'>;

const PHOTO_FORMATS = [
  {id: 'jpeg', name: 'JPEG (.jpg)', desc: 'Universal, widely compatible photo format'},
  {id: 'png', name: 'PNG (.png)', desc: 'Lossless graphic format with transparency'},
  {id: 'webp', name: 'WebP (.webp)', desc: 'Modern web format, highly efficient'},
  {id: 'heic', name: 'HEIC (.heic)', desc: 'High Efficiency Apple image container'},
] as const;

const VIDEO_FORMATS = [
  {id: 'mp4', name: 'MP4 (.mp4)', desc: 'Most widely supported video container'},
  {id: 'mov', name: 'MOV (.mov)', desc: 'Apple QuickTime native video format'},
  {id: 'mkv', name: 'MKV (.mkv)', desc: 'Matroska flexible open video container'},
  {id: 'webm', name: 'WebM (.webm)', desc: 'Open web video format for HTML5'},
] as const;

export default function FormatConverterScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();

  const initialUris = route.params?.selectedUris || [];
  const initialType = route.params?.mediaType || 'image';

  const [mediaType, setMediaType] = useState<'image' | 'video'>(initialType);
  const [selectedUris, setSelectedUris] = useState<string[]>(initialUris);
  const [mediaDetails, setMediaDetails] = useState<LargeFile[]>([]);
  const [photoFormat, setPhotoFormat] = useState<'jpeg' | 'png' | 'webp' | 'heic'>('jpeg');
  const [videoFormat, setVideoFormat] = useState<'mp4' | 'mov' | 'mkv' | 'webm'>('mp4');

  // Load media details if URIs were passed
  useEffect(() => {
    if (selectedUris.length > 0) {
      CameraRoll.getPhotos({
        first: 200,
        assetType: mediaType === 'image' ? 'Photos' : 'Videos',
        include: ['fileSize', 'filename', 'imageSize'],
      }).then(res => {
        const matched: LargeFile[] = res.edges
          .filter((e: PhotoIdentifier) => selectedUris.includes(e.node.image.uri))
          .map((e: PhotoIdentifier) => ({
            uri: e.node.image.uri,
            type: mediaType,
            filename: e.node.image.filename || (mediaType === 'image' ? 'Photo' : 'Video'),
            fileSize: e.node.image.fileSize || 0,
            width: e.node.image.width || 0,
            height: e.node.image.height || 0,
            timestamp: e.node.timestamp || 0,
          }));
        setMediaDetails(matched);
      });
    }
  }, [selectedUris, mediaType]);

  const totalOriginalSize = mediaDetails.reduce((acc, curr) => acc + curr.fileSize, 0);

  const handleStartConversion = () => {
    if (selectedUris.length === 0) {
      Alert.alert(
        'No Files Selected',
        'Please select at least one photo or video to convert format.',
        [
          {
            text: 'Pick Photos/Videos',
            onPress: () => {
              if (mediaType === 'image') {
                navigation.navigate('Main', {screen: 'Images'});
              } else {
                navigation.navigate('Main', {screen: 'Videos'});
              }
            },
          },
          {text: 'Cancel', style: 'cancel'},
        ],
      );
      return;
    }

    const options: CompressionOptions = {
      mode: 'convert',
      outputFormat: photoFormat,
      videoOutputFormat: videoFormat,
      quality: 1.0,
      videoBitrate: 'high',
      keepMetadata: true,
    };

    navigation.navigate('CompressionProgress', {
      type: mediaType,
      uris: selectedUris,
      options,
    });
  };

  return (
    <View style={[styles.root, {backgroundColor: theme.colors.background}]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.border,
          },
        ]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text
            style={[
              theme.typography.titleLarge,
              {color: theme.colors.text, fontWeight: '700'},
            ]}>
            Format Converter
          </Text>
          <Text
            style={[
              theme.typography.bodySmall,
              {color: theme.colors.primary, fontWeight: '600'},
            ]}>
            ✨ Maximum Quality Preserved
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: insets.bottom + 100},
        ]}
        showsVerticalScrollIndicator={false}>
        
        {/* Media Type Toggle */}
        <Text style={[styles.sectionHeader, {color: theme.colors.text}]}>
          Target Media Type
        </Text>
        <View style={[styles.typeToggleRow, {backgroundColor: theme.colors.surfaceVariant}]}>
          <TouchableOpacity
            style={[
              styles.typeTab,
              mediaType === 'image' && {backgroundColor: theme.colors.primary},
            ]}
            onPress={() => {
              setMediaType('image');
              if (initialType !== 'image') setSelectedUris([]);
            }}>
            <Icon
              name="image-multiple"
              size={18}
              color={mediaType === 'image' ? 'white' : theme.colors.text}
            />
            <Text
              style={[
                styles.typeTabText,
                {color: mediaType === 'image' ? 'white' : theme.colors.text},
              ]}>
              Photos Converter
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeTab,
              mediaType === 'video' && {backgroundColor: theme.colors.primary},
            ]}
            onPress={() => {
              setMediaType('video');
              if (initialType !== 'video') setSelectedUris([]);
            }}>
            <Icon
              name="video-box"
              size={18}
              color={mediaType === 'video' ? 'white' : theme.colors.text}
            />
            <Text
              style={[
                styles.typeTabText,
                {color: mediaType === 'video' ? 'white' : theme.colors.text},
              ]}>
              Videos Converter
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selected Files Card */}
        <Card style={styles.filesCard}>
          <View style={styles.filesCardHeader}>
            <View style={styles.filesHeaderLeft}>
              <Icon
                name={mediaType === 'image' ? 'image-check' : 'video-check'}
                size={22}
                color={theme.colors.primary}
              />
              <Text style={[theme.typography.titleMedium, {color: theme.colors.text, fontWeight: '700'}]}>
                {selectedUris.length > 0
                  ? `${selectedUris.length} ${mediaType === 'image' ? 'Photo' : 'Video'}${selectedUris.length > 1 ? 's' : ''} Selected`
                  : `No ${mediaType === 'image' ? 'Photos' : 'Videos'} Selected`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (mediaType === 'image') {
                  navigation.navigate('Main', {screen: 'Images'});
                } else {
                  navigation.navigate('Main', {screen: 'Videos'});
                }
              }}
              style={[styles.pickBtn, {backgroundColor: theme.colors.primaryContainer}]}>
              <Text style={[theme.typography.labelMedium, {color: theme.colors.primary, fontWeight: '700'}]}>
                {selectedUris.length > 0 ? 'Change' : 'Select'}
              </Text>
            </TouchableOpacity>
          </View>

          {selectedUris.length > 0 && totalOriginalSize > 0 && (
            <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary, marginTop: 4}]}>
              Total input size: {StorageService.formatBytes(totalOriginalSize)}
            </Text>
          )}

          {mediaDetails.length > 0 && (
            <FlatList
              data={mediaDetails.slice(0, 6)}
              horizontal
              keyExtractor={item => item.uri}
              showsHorizontalScrollIndicator={false}
              style={{marginTop: 12}}
              renderItem={({item}) => (
                <View style={styles.thumbWrapper}>
                  {item.type === 'image' ? (
                    <Image source={{uri: item.uri}} style={styles.thumbImage} resizeMode="cover" />
                  ) : (
                    <VideoThumbnail videoUri={item.uri} style={styles.thumbImage} resizeMode="cover" />
                  )}
                </View>
              )}
            />
          )}
        </Card>

        {/* Format Selection Card */}
        <Text style={[styles.sectionHeader, {color: theme.colors.text}]}>
          Select Output Format
        </Text>

        {mediaType === 'image' ? (
          <View style={styles.formatsList}>
            {PHOTO_FORMATS.map(fmt => (
              <TouchableOpacity
                key={fmt.id}
                activeOpacity={0.8}
                onPress={() => setPhotoFormat(fmt.id)}
                style={[
                  styles.formatCard,
                  {backgroundColor: theme.colors.surface, borderColor: theme.colors.border},
                  photoFormat === fmt.id && {
                    borderColor: theme.colors.primary,
                    backgroundColor: theme.colors.primaryContainer + '25',
                    borderWidth: 2,
                  },
                ]}>
                <View style={styles.formatCardRow}>
                  <View style={styles.formatInfo}>
                    <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
                      {fmt.name}
                    </Text>
                    <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
                      {fmt.desc}
                    </Text>
                  </View>
                  <Icon
                    name={photoFormat === fmt.id ? 'radiobox-marked' : 'radiobox-blank'}
                    size={22}
                    color={photoFormat === fmt.id ? theme.colors.primary : theme.colors.textTertiary}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.formatsList}>
            {VIDEO_FORMATS.map(fmt => (
              <TouchableOpacity
                key={fmt.id}
                activeOpacity={0.8}
                onPress={() => setVideoFormat(fmt.id)}
                style={[
                  styles.formatCard,
                  {backgroundColor: theme.colors.surface, borderColor: theme.colors.border},
                  videoFormat === fmt.id && {
                    borderColor: theme.colors.primary,
                    backgroundColor: theme.colors.primaryContainer + '25',
                    borderWidth: 2,
                  },
                ]}>
                <View style={styles.formatCardRow}>
                  <View style={styles.formatInfo}>
                    <Text style={[theme.typography.titleSmall, {color: theme.colors.text, fontWeight: '700'}]}>
                      {fmt.name}
                    </Text>
                    <Text style={[theme.typography.bodySmall, {color: theme.colors.textSecondary}]}>
                      {fmt.desc}
                    </Text>
                  </View>
                  <Icon
                    name={videoFormat === fmt.id ? 'radiobox-marked' : 'radiobox-blank'}
                    size={22}
                    color={videoFormat === fmt.id ? theme.colors.primary : theme.colors.textTertiary}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Quality Guarantee Card */}
        <View style={[styles.guaranteeCard, {backgroundColor: theme.colors.successContainer}]}>
          <Icon name="shield-check" size={24} color={theme.colors.success} />
          <View style={styles.guaranteeTextContainer}>
            <Text style={[theme.typography.titleSmall, {color: theme.colors.success, fontWeight: '700'}]}>
              High-Fidelity Quality Preservation
            </Text>
            <Text style={[theme.typography.bodySmall, {color: theme.colors.text, opacity: 0.85}]}>
              Preserves original media quality whenever technically possible. Container remuxing maintains original streams; when transcoding is required, maximum bitrate and resolution are preserved.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Footer */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 16,
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
          },
        ]}>
        <AnimatedButton
          onPress={handleStartConversion}
          variant="primary"
          gradient
          size="lg"
          fullWidth>
          <Icon name="file-replace-outline" size={20} color="white" />
          <Text style={[theme.typography.titleSmall, {color: 'white', fontWeight: '700'}]}>
            {selectedUris.length > 0
              ? `Convert ${selectedUris.length} ${mediaType === 'image' ? 'Photo' : 'Video'}${selectedUris.length > 1 ? 's' : ''} to ${
                  mediaType === 'image' ? photoFormat.toUpperCase() : videoFormat.toUpperCase()
                }`
              : 'Select Files to Convert'}
          </Text>
        </AnimatedButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: {
    padding: 6,
  },
  headerTitleContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 10,
  },
  typeToggleRow: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  typeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  typeTabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  filesCard: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 8,
  },
  filesCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  thumbWrapper: {
    marginRight: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  thumbImage: {
    width: 54,
    height: 54,
  },
  formatsList: {
    gap: 10,
    marginBottom: 16,
  },
  formatCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  formatCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formatInfo: {
    flex: 1,
    paddingRight: 12,
  },
  guaranteeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  guaranteeTextContainer: {
    flex: 1,
    gap: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
