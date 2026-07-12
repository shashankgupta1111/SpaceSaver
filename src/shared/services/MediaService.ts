import {CameraRoll, PhotoIdentifier} from '@react-native-camera-roll/camera-roll';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';

export interface LargeFile {
  uri: string;
  type: 'image' | 'video';
  filename: string;
  fileSize: number;
  width: number;
  height: number;
  playableDuration?: number;
  timestamp: number;
}

export interface MediaAlbum {
  title: string;
  count: number;
}

/**
 * MediaStore can't sort by file size, so we pull a generous window of the most
 * recent photos + videos and rank them client-side. Enough to reliably surface
 * the true storage hogs without loading the entire library.
 */
const PHOTO_WINDOW = 1000;
const VIDEO_WINDOW = 500;

class MediaServiceClass {
  private inferType(edge: PhotoIdentifier): 'image' | 'video' {
    const t = (edge.node.type ?? '').toLowerCase();
    return t.includes('video') ? 'video' : 'image';
  }

  private toFile(edge: PhotoIdentifier, type: 'image' | 'video'): LargeFile {
    const img = edge.node.image;
    return {
      uri: img.uri,
      type,
      filename: img.filename ?? (type === 'image' ? 'Photo' : 'Video'),
      fileSize: img.fileSize ?? 0,
      width: img.width ?? 0,
      height: img.height ?? 0,
      playableDuration: img.playableDuration ?? undefined,
      timestamp: edge.node.timestamp ?? 0,
    };
  }

  /** True if we already hold image OR video read permission (no prompt). */
  async hasMediaPermission(): Promise<boolean> {
    const img = await check(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
    const vid = await check(PERMISSIONS.ANDROID.READ_MEDIA_VIDEO);
    return img === RESULTS.GRANTED || vid === RESULTS.GRANTED;
  }

  /** Prompts for image + video read permission; resolves true if either granted. */
  async ensureMediaPermission(): Promise<boolean> {
    const img = await request(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
    const vid = await request(PERMISSIONS.ANDROID.READ_MEDIA_VIDEO);
    return img === RESULTS.GRANTED || vid === RESULTS.GRANTED;
  }

  /**
   * Returns the `limit` largest media items (photos + videos combined),
   * sorted by file size descending. Assumes read permission is held.
   */
  async getLargestMedia(limit = 20): Promise<LargeFile[]> {
    const [photos, videos] = await Promise.all([
      CameraRoll.getPhotos({
        first: PHOTO_WINDOW,
        assetType: 'Photos',
        include: ['fileSize', 'filename', 'imageSize'],
      })
        .then(r => r.edges)
        .catch(() => [] as PhotoIdentifier[]),
      CameraRoll.getPhotos({
        first: VIDEO_WINDOW,
        assetType: 'Videos',
        include: ['fileSize', 'filename', 'imageSize', 'playableDuration'],
      })
        .then(r => r.edges)
        .catch(() => [] as PhotoIdentifier[]),
    ]);

    const all: LargeFile[] = [
      ...photos.map(e => this.toFile(e, 'image')),
      ...videos.map(e => this.toFile(e, 'video')),
    ];

    return all.sort((a, b) => b.fileSize - a.fileSize).slice(0, limit);
  }

  /** Non-empty albums (buckets), largest first. Assumes read permission. */
  async getAlbums(): Promise<MediaAlbum[]> {
    const albums = await CameraRoll.getAlbums({
      assetType: 'All',
      albumType: 'Album',
    });
    return albums
      .filter(a => a.count > 0)
      .map(a => ({title: a.title, count: a.count}))
      .sort((a, b) => b.count - a.count);
  }

  /** Media inside a specific album/bucket, sorted by size descending. */
  async getAlbumMedia(title: string, limit = 300): Promise<LargeFile[]> {
    const res = await CameraRoll.getPhotos({
      first: limit,
      assetType: 'All',
      groupName: title,
      include: ['fileSize', 'filename', 'imageSize', 'playableDuration'],
    })
      .then(r => r.edges)
      .catch(() => [] as PhotoIdentifier[]);
    return res
      .map(e => this.toFile(e, this.inferType(e)))
      .sort((a, b) => b.fileSize - a.fileSize);
  }
}

export const MediaService = new MediaServiceClass();
