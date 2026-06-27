import {Image as ImageCompressor, Video as VideoCompressor} from 'react-native-compressor';
import RNFS from 'react-native-fs';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import {CompressionOptions, CompressionResult} from '../../app/navigation/types';
import {StorageService} from './StorageService';
import {HistoryService} from './HistoryService';

type ProgressCallback = (progress: number, fileIndex: number) => void;
type CancelToken = {cancelled: boolean};

class CompressionServiceClass {
  async compressImage(
    uri: string,
    options: CompressionOptions,
    onProgress?: (progress: number) => void,
    cancelToken?: CancelToken,
  ): Promise<CompressionResult> {
    const originalSize = await StorageService.getFileSize(uri);
    const fileName = uri.split('/').pop() ?? 'image';
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const quality = options.quality ?? 0.8;
    const maxWidth = options.maxWidth ?? 1920;
    const maxHeight = options.maxHeight ?? 1920;

    let outputExt = 'jpg';
    if (options.outputFormat === 'png') {outputExt = 'png';}
    if (options.outputFormat === 'webp') {outputExt = 'webp';}

    const outputDir = `${RNFS.CachesDirectoryPath}/SpaceSaver`;
    await RNFS.mkdir(outputDir);
    const outputPath = `${outputDir}/${id}.${outputExt}`;

    if (cancelToken?.cancelled) {
      throw new Error('CANCELLED');
    }

    const compressedUri = await ImageCompressor.compress(uri, {
      quality,
      maxWidth,
      maxHeight,
      output: options.outputFormat === 'png' ? 'png' : 'jpg',
      progressDivider: 10,
      downloadProgress: progress => {
        onProgress?.(progress);
        if (cancelToken?.cancelled) {
          throw new Error('CANCELLED');
        }
      },
    });

    const compressedSize = await StorageService.getFileSize(compressedUri);
    const savedBytes = Math.max(0, originalSize - compressedSize);
    const savedPercent =
      originalSize > 0 ? Math.round((savedBytes / originalSize) * 100) : 0;

    const result: CompressionResult = {
      id,
      originalUri: uri,
      compressedUri,
      originalSize,
      compressedSize,
      savedBytes,
      savedPercent,
      type: 'image',
      timestamp: Date.now(),
      fileName,
    };

    return result;
  }

  async compressVideo(
    uri: string,
    options: CompressionOptions,
    onProgress?: (progress: number) => void,
    cancelToken?: CancelToken,
  ): Promise<CompressionResult> {
    const originalSize = await StorageService.getFileSize(uri);
    const fileName = uri.split('/').pop() ?? 'video';
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    if (cancelToken?.cancelled) {
      throw new Error('CANCELLED');
    }

    const resolutionMap: Record<string, number> = {
      '1080p': 1080,
      '720p': 720,
      '480p': 480,
      '360p': 360,
      original: 0,
    };

    const bitrateMap: Record<string, number | undefined> = {
      low: 500000,
      medium: 1500000,
      high: 4000000,
      auto: undefined,
    };

    const resolution = options.resolution ?? '720p';
    const maxSize = resolutionMap[resolution] ?? 720;
    const bitrate = bitrateMap[options.videoBitrate ?? 'auto'];

    const compressedUri = await VideoCompressor.compress(
      uri,
      {
        compressionMethod: 'auto',
        maxSize: maxSize > 0 ? maxSize : undefined,
        bitrate,
        minimumFileSizeForCompress: 0,
        progressDivider: 5,
      },
      progress => {
        onProgress?.(progress);
        if (cancelToken?.cancelled) {
          throw new Error('CANCELLED');
        }
      },
    );

    const compressedSize = await StorageService.getFileSize(compressedUri);
    const savedBytes = Math.max(0, originalSize - compressedSize);
    const savedPercent =
      originalSize > 0 ? Math.round((savedBytes / originalSize) * 100) : 0;

    return {
      id,
      originalUri: uri,
      compressedUri,
      originalSize,
      compressedSize,
      savedBytes,
      savedPercent,
      type: 'video',
      timestamp: Date.now(),
      fileName,
    };
  }

  async compressBatch(
    type: 'image' | 'video',
    uris: string[],
    options: CompressionOptions,
    onFileProgress: (fileIndex: number, progress: number) => void,
    onFileComplete: (fileIndex: number, result: CompressionResult) => void,
    onFileError: (fileIndex: number, error: Error) => void,
    cancelToken: CancelToken,
  ): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];

    for (let i = 0; i < uris.length; i++) {
      if (cancelToken.cancelled) {break;}

      try {
        const result =
          type === 'image'
            ? await this.compressImage(
                uris[i],
                options,
                p => onFileProgress(i, p),
                cancelToken,
              )
            : await this.compressVideo(
                uris[i],
                options,
                p => onFileProgress(i, p),
                cancelToken,
              );

        results.push(result);
        onFileComplete(i, result);
        StorageService.recordSaving(result.savedBytes);
      } catch (error) {
        if ((error as Error).message === 'CANCELLED') {
          break;
        }
        onFileError(i, error as Error);
      }
    }

    return results;
  }

  estimateCompressedSize(
    originalSize: number,
    options: CompressionOptions,
    type: 'image' | 'video',
  ): number {
    if (type === 'image') {
      const quality = options.quality ?? 0.8;
      const scaleFactor =
        options.maxWidth && options.maxWidth < 1920 ? 0.7 : 1.0;
      return Math.round(originalSize * quality * scaleFactor * 0.85);
    } else {
      const resolutionFactor: Record<string, number> = {
        '1080p': 0.6,
        '720p': 0.4,
        '480p': 0.25,
        '360p': 0.15,
        original: 0.8,
      };
      return Math.round(
        originalSize *
          (resolutionFactor[options.resolution ?? '720p'] ?? 0.4),
      );
    }
  }

  /**
   * Persists a freshly-compressed file (currently sitting in the app cache)
   * into the device's shared media library so it shows up in the Gallery
   * globally — not just inside the app's private folder.
   *
   * Uses CameraRoll.saveAsset which writes through MediaStore (scoped-storage
   * safe on Android 10+, targetSdk 35). The temporary cache copy is removed
   * afterwards so we don't leave duplicates behind.
   */
  async moveToMediaStore(
    uri: string,
    type: 'image' | 'video',
  ): Promise<string> {
    const sourceUri = uri.startsWith('file://') ? uri : `file://${uri}`;

    const asset = await CameraRoll.saveAsset(sourceUri, {
      type: type === 'image' ? 'photo' : 'video',
      album: 'SpaceSaver',
    });

    // Clean up the temporary cached file now that it lives in the gallery.
    try {
      const cachePath = uri.startsWith('file://') ? uri.slice(7) : uri;
      if (await RNFS.exists(cachePath)) {
        await RNFS.unlink(cachePath);
      }
    } catch {
      /* non-fatal: the temp file will be cleared with the cache anyway */
    }

    return asset.node.image.uri;
  }
}

export const CompressionService = new CompressionServiceClass();
