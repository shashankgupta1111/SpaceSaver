import {MMKV} from 'react-native-mmkv';
import {CompressionOptions} from '../../app/navigation/types';
import {MediaService, LargeFile} from './MediaService';
import {CompressionService} from './CompressionService';

const storage = new MMKV({id: 'smart-recommendations-storage'});
const CACHED_RECOMMENDATIONS_KEY = 'smart_compression_recommendations';

export interface SmartRecommendation {
  id: string;
  file: LargeFile;
  category: 'high_impact' | 'medium_impact';
  reason: string;
  recommendedOptions: CompressionOptions;
  presetLabel: string;
  estimatedSavingsBytes: number;
  estimatedOutputBytes: number;
  savingsPercentage: number;
}

export interface SmartRecommendationsReport {
  recommendations: SmartRecommendation[];
  totalEstimatedSavingsBytes: number;
  totalCount: number;
  videoCount: number;
  photoCount: number;
  highImpactCount: number;
  generatedAt: number;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

class SmartRecommendationServiceClass {
  /**
   * Deterministically analyzes media and produces tailored compression recommendations.
   * Offline, deterministic, and fast.
   */
  async generateRecommendations(forceRefresh = false): Promise<SmartRecommendationsReport> {
    if (!forceRefresh) {
      const cached = this.getCachedRecommendations();
      if (cached && Date.now() - cached.generatedAt < 120_000) {
        return cached;
      }
    }

    const hasPermission = await MediaService.hasMediaPermission();
    if (!hasPermission) {
      return {
        recommendations: [],
        totalEstimatedSavingsBytes: 0,
        totalCount: 0,
        videoCount: 0,
        photoCount: 0,
        highImpactCount: 0,
        generatedAt: Date.now(),
      };
    }

    // Pull largest media candidates
    const largestMedia = await MediaService.getLargestMedia(60);

    const recommendations: SmartRecommendation[] = [];

    for (const file of largestMedia) {
      if (file.type === 'video') {
        const rec = this.evaluateVideo(file);
        if (rec) recommendations.push(rec);
      } else {
        const rec = this.evaluatePhoto(file);
        if (rec) recommendations.push(rec);
      }
    }

    // Sort by estimated savings descending
    recommendations.sort((a, b) => b.estimatedSavingsBytes - a.estimatedSavingsBytes);

    const totalEstimatedSavingsBytes = recommendations.reduce(
      (acc, r) => acc + r.estimatedSavingsBytes,
      0,
    );
    const videoCount = recommendations.filter(r => r.file.type === 'video').length;
    const photoCount = recommendations.filter(r => r.file.type === 'image').length;
    const highImpactCount = recommendations.filter(r => r.category === 'high_impact').length;

    const report: SmartRecommendationsReport = {
      recommendations,
      totalEstimatedSavingsBytes,
      totalCount: recommendations.length,
      videoCount,
      photoCount,
      highImpactCount,
      generatedAt: Date.now(),
    };

    this.cacheReport(report);
    return report;
  }

  private evaluateVideo(file: LargeFile): SmartRecommendation | null {
    // Only recommend videos >= 35 MB to avoid diminishing returns
    if (file.fileSize < 35 * MB) {
      return null;
    }

    const maxDim = Math.max(file.width, file.height);
    const is4K = maxDim >= 3000;
    const is1080pOrHigher = maxDim >= 1800;

    let recommendedOptions: CompressionOptions;
    let presetLabel = '720p · H.264 · Balanced quality';
    let reason = 'Large Video';

    if (is4K || file.fileSize >= 500 * MB) {
      recommendedOptions = {
        resolution: '1080p',
        videoCodec: 'h264',
        videoBitrate: 'auto',
        mode: 'compress',
      };
      presetLabel = '1080p · H.264 · Balanced quality';
      reason = is4K ? '4K Ultra HD Video' : 'Heavy Video (>500MB)';
    } else if (is1080pOrHigher || file.fileSize >= 100 * MB) {
      recommendedOptions = {
        resolution: '720p',
        videoCodec: 'h264',
        videoBitrate: 'auto',
        mode: 'compress',
      };
      presetLabel = '720p · H.264 · Balanced quality';
      reason = '1080p Full HD Video';
    } else {
      recommendedOptions = {
        resolution: '720p',
        videoCodec: 'h264',
        videoBitrate: 'auto',
        mode: 'compress',
      };
      presetLabel = '720p · H.264 · Compact';
      reason = 'Uncompressed Video';
    }

    const estimatedOutputBytes = CompressionService.estimateCompressedSize(
      file.fileSize,
      recommendedOptions,
      'video',
    );
    const estimatedSavingsBytes = Math.max(0, file.fileSize - estimatedOutputBytes);

    // If estimated savings is less than 15 MB, ignore
    if (estimatedSavingsBytes < 15 * MB) {
      return null;
    }

    const savingsPercentage = Math.round((estimatedSavingsBytes / file.fileSize) * 100);
    const category = file.fileSize >= 150 * MB ? 'high_impact' : 'medium_impact';

    return {
      id: `rec_${file.uri}`,
      file,
      category,
      reason,
      recommendedOptions,
      presetLabel,
      estimatedSavingsBytes,
      estimatedOutputBytes,
      savingsPercentage,
    };
  }

  private evaluatePhoto(file: LargeFile): SmartRecommendation | null {
    // Only recommend photos >= 5 MB
    if (file.fileSize < 5 * MB) {
      return null;
    }

    const maxDim = Math.max(file.width, file.height);
    const isHugeDim = maxDim >= 3000;
    const isPng = file.filename.toLowerCase().endsWith('.png');

    let recommendedOptions: CompressionOptions;
    let presetLabel = '1280px · Medium (75%) · JPEG';
    let reason = 'High-Res Photo';

    if (isPng && file.fileSize >= 8 * MB) {
      recommendedOptions = {
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1920,
        outputFormat: 'webp',
        compressionLevel: 'high',
        mode: 'compress',
      };
      presetLabel = '1920px · WebP · High Compression';
      reason = 'Heavy PNG Image';
    } else if (isHugeDim || file.fileSize >= 15 * MB) {
      recommendedOptions = {
        quality: 0.75,
        maxWidth: 1920,
        maxHeight: 1920,
        outputFormat: 'jpeg',
        compressionLevel: 'medium',
        mode: 'compress',
      };
      presetLabel = '1920px · 75% Quality · JPEG';
      reason = isHugeDim ? 'High-Megapixel Photo' : 'Large RAW/Photo';
    } else {
      recommendedOptions = {
        quality: 0.75,
        maxWidth: 1280,
        maxHeight: 1280,
        outputFormat: 'jpeg',
        compressionLevel: 'medium',
        mode: 'compress',
      };
      presetLabel = '1280px · 75% Quality · JPEG';
      reason = 'Large Gallery Photo';
    }

    const estimatedOutputBytes = CompressionService.estimateCompressedSize(
      file.fileSize,
      recommendedOptions,
      'image',
    );
    const estimatedSavingsBytes = Math.max(0, file.fileSize - estimatedOutputBytes);

    if (estimatedSavingsBytes < 3 * MB) {
      return null;
    }

    const savingsPercentage = Math.round((estimatedSavingsBytes / file.fileSize) * 100);
    const category = file.fileSize >= 12 * MB ? 'high_impact' : 'medium_impact';

    return {
      id: `rec_${file.uri}`,
      file,
      category,
      reason,
      recommendedOptions,
      presetLabel,
      estimatedSavingsBytes,
      estimatedOutputBytes,
      savingsPercentage,
    };
  }

  private cacheReport(report: SmartRecommendationsReport): void {
    storage.set(CACHED_RECOMMENDATIONS_KEY, JSON.stringify(report));
  }

  getCachedRecommendations(): SmartRecommendationsReport | null {
    try {
      const raw = storage.getString(CACHED_RECOMMENDATIONS_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SmartRecommendationsReport;
    } catch {
      return null;
    }
  }
}

export const SmartRecommendationService = new SmartRecommendationServiceClass();
