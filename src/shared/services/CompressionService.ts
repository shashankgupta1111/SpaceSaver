import {
  Image as ImageCompressor,
  Video as VideoCompressor,
  getVideoMetaData,
} from 'react-native-compressor';
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
    let rawName = uri.split('/').pop()?.split('?')[0] ?? 'image';
    const targetExt = options.outputFormat ?? 'jpg';
    const fileName = rawName.includes('.')
      ? (options.mode === 'convert' ? `${rawName.substring(0, rawName.lastIndexOf('.'))}.${targetExt}` : rawName)
      : `${rawName}.${targetExt}`;
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const isConvertMode = options.mode === 'convert';
    const quality = isConvertMode ? 1.0 : (options.quality ?? 0.8);
    const maxWidth = isConvertMode ? undefined : options.maxWidth ?? 1920;
    const maxHeight = isConvertMode ? undefined : options.maxHeight ?? 1920;

    const outputFormat = options.outputFormat === 'png' ? 'png' : 'jpg';

    if (cancelToken?.cancelled) {
      throw new Error('CANCELLED');
    }

    const compressedUri = await ImageCompressor.compress(uri, {
      quality,
      maxWidth,
      maxHeight,
      output: outputFormat,
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
    let rawName = uri.split('/').pop()?.split('?')[0] ?? 'video';
    const targetExt = options.videoOutputFormat ?? 'mp4';
    const fileName = rawName.includes('.')
      ? (options.mode === 'convert' ? `${rawName.substring(0, rawName.lastIndexOf('.'))}.${targetExt}` : rawName)
      : `${rawName}.${targetExt}`;
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    if (cancelToken?.cancelled) {
      throw new Error('CANCELLED');
    }

    const isConvertMode = options.mode === 'convert';

    let compressedUri: string;
    if (isConvertMode) {
      // In format conversion mode, preserve 100% original bitrate and unscaled resolution
      let originalBitrate = 50000000; // high default fallback (50 Mbps)
      try {
        const meta = await getVideoMetaData(uri);
        if (meta?.size && meta?.duration && meta.duration > 0) {
          // Bitrate in bps = (fileSize in bytes * 8) / duration in seconds
          originalBitrate = Math.max(1000000, Math.round((meta.size * 8) / meta.duration));
        }
      } catch {
        // Fallback to 50Mbps if metadata extraction fails
      }

      compressedUri = await VideoCompressor.compress(
        uri,
        {
          compressionMethod: 'manual',
          maxSize: 99999,
          bitrate: originalBitrate,
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
    } else {
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

      compressedUri = await VideoCompressor.compress(
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
    }

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
    if (options.mode === 'convert') {
      if (type === 'image') {
        if (options.outputFormat === 'webp') {
          return Math.round(originalSize * 0.75);
        }
        if (options.outputFormat === 'png') {
          return Math.round(originalSize * 1.05);
        }
        return Math.round(originalSize * 0.95);
      } else {
        return originalSize;
      }
    }

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
