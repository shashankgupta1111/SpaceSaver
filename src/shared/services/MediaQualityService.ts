import {LargeFile} from './MediaService';
import {CompressionService} from './CompressionService';
import {CompressionOptions} from '../../app/navigation/types';

export interface MediaQualityAnalysis {
  uri: string;
  type: 'image' | 'video';
  fileSize: number;
  resolutionLabel: string;
  tags: string[];
  recommendedAction: string;
  recommendedOptions: CompressionOptions;
  estimatedSavingsBytes: number;
  estimatedSavingsPercent: number;
  reason: string;
}

class MediaQualityServiceClass {
  /**
   * Deterministic local quality & compression opportunity evaluation.
   * Strictly uses conservative and objective metrics.
   */
  analyzeMedia(file: LargeFile): MediaQualityAnalysis {
    const isVideo = file.type === 'video';

    if (isVideo) {
      return this.analyzeVideo(file);
    }
    return this.analyzePhoto(file);
  }

  private analyzeVideo(file: LargeFile): MediaQualityAnalysis {
    const height = file.height || 0;
    const width = file.width || 0;
    const maxDim = Math.max(height, width);
    const minDim = Math.min(height, width);
    const sizeMB = file.fileSize / (1024 * 1024);
    const duration = file.playableDuration || 1;
    const mbPerMinute = (sizeMB / duration) * 60;

    const tags: string[] = [];
    let resolutionLabel = 'Video';
    let recommendedAction = 'Compress Video';
    let reason = 'Compression opportunity to reduce storage.';
    let options: CompressionOptions = {
      resolution: '720p',
      videoCodec: 'h264',
      videoBitrate: 'auto',
    };

    if (maxDim >= 3840 || minDim >= 2160) {
      resolutionLabel = '4K UHD';
      tags.push('4K Ultra HD', 'High Storage Usage');
      recommendedAction = 'Compress to 1080p';
      reason = '4K resolution occupies substantial storage. 1080p maintains sharp quality on mobile.';
      options = {
        resolution: '1080p',
        videoCodec: 'h264',
        videoBitrate: 'medium',
      };
    } else if (maxDim >= 1920 || minDim >= 1080) {
      resolutionLabel = '1080p FHD';
      tags.push('1080p FHD');
      if (mbPerMinute > 80) {
        tags.push('High Bitrate');
        reason = 'High bitrate video with strong compression potential.';
      } else {
        reason = '1080p video ready for space-saving 720p encoding.';
      }
      recommendedAction = 'Compress to 720p Balanced';
      options = {
        resolution: '720p',
        videoCodec: 'h264',
        videoBitrate: 'auto',
      };
    } else if (maxDim >= 1280 || minDim >= 720) {
      resolutionLabel = '720p HD';
      tags.push('720p HD');
      recommendedAction = 'Compress 720p';
      reason = 'Optimize 720p file size with efficient H.264 compression.';
      options = {
        resolution: '720p',
        videoCodec: 'h264',
        videoBitrate: 'low',
      };
    } else {
      resolutionLabel = minDim > 0 ? `${width}×${height}` : 'Standard';
      tags.push('Standard Resolution');
      recommendedAction = 'Compress';
      reason = 'Encode video to save space.';
      options = {
        resolution: '480p',
        videoCodec: 'h264',
        videoBitrate: 'auto',
      };
    }

    if (sizeMB > 100) {
      tags.push('Large File (>100MB)');
    }

    const estimatedOutput = CompressionService.estimateCompressedSize(
      file.fileSize,
      options,
      'video',
    );
    const estimatedSavingsBytes = Math.max(0, file.fileSize - estimatedOutput);
    const estimatedSavingsPercent =
      file.fileSize > 0
        ? Math.round((estimatedSavingsBytes / file.fileSize) * 100)
        : 0;

    return {
      uri: file.uri,
      type: 'video',
      fileSize: file.fileSize,
      resolutionLabel,
      tags,
      recommendedAction,
      recommendedOptions: options,
      estimatedSavingsBytes,
      estimatedSavingsPercent,
      reason,
    };
  }

  private analyzePhoto(file: LargeFile): MediaQualityAnalysis {
    const width = file.width || 0;
    const height = file.height || 0;
    const mp = (width * height) / 1_000_000;
    const sizeMB = file.fileSize / (1024 * 1024);

    const tags: string[] = [];
    let resolutionLabel = mp > 0 ? `${mp.toFixed(1)} MP` : 'Photo';
    let recommendedAction = 'Compress Photo';
    let reason = 'Optimize image quality to save space.';
    let options: CompressionOptions = {
      maxWidth: 1920,
      quality: 0.75,
      outputFormat: 'jpeg',
    };

    if (mp >= 24 || Math.max(width, height) >= 6000) {
      resolutionLabel = `${mp.toFixed(0)} MP Ultra-Res`;
      tags.push('Ultra Resolution', 'Large File');
      recommendedAction = 'Resize + Compress';
      reason = 'Ultra high-resolution photo exceeds screen requirements; resizing saves maximum storage.';
      options = {
        maxWidth: 2560,
        quality: 0.8,
        outputFormat: 'jpeg',
      };
    } else if (sizeMB >= 8 && mp < 12) {
      resolutionLabel = `${mp.toFixed(1)} MP`;
      tags.push('Oversized File', 'Compression Opportunity');
      recommendedAction = 'Compress JPEG';
      reason = 'File size is unusually heavy for this resolution (likely uncompressed or raw).';
      options = {
        maxWidth: 1920,
        quality: 0.75,
        outputFormat: 'jpeg',
      };
    } else if (mp < 1.0 && sizeMB > 1.5) {
      resolutionLabel = `${width}×${height}`;
      tags.push('Low Resolution', 'High Storage Usage');
      recommendedAction = 'Compress to JPEG';
      reason = 'Low resolution image occupying significant storage.';
      options = {
        quality: 0.7,
        outputFormat: 'jpeg',
      };
    } else {
      tags.push('Photo');
      recommendedAction = 'Compress Photo';
      reason = 'Standard photo compression.';
      options = {
        maxWidth: 1920,
        quality: 0.75,
        outputFormat: 'jpeg',
      };
    }

    if (sizeMB > 10) {
      tags.push('Heavy Photo (>10MB)');
    }

    const estimatedOutput = CompressionService.estimateCompressedSize(
      file.fileSize,
      options,
      'image',
    );
    const estimatedSavingsBytes = Math.max(0, file.fileSize - estimatedOutput);
    const estimatedSavingsPercent =
      file.fileSize > 0
        ? Math.round((estimatedSavingsBytes / file.fileSize) * 100)
        : 0;

    return {
      uri: file.uri,
      type: 'image',
      fileSize: file.fileSize,
      resolutionLabel,
      tags,
      recommendedAction,
      recommendedOptions: options,
      estimatedSavingsBytes,
      estimatedSavingsPercent,
      reason,
    };
  }
}

export const MediaQualityService = new MediaQualityServiceClass();
