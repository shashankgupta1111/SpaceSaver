import {MMKV} from 'react-native-mmkv';
import RNFS from 'react-native-fs';
import {MediaService, LargeFile} from './MediaService';

const storage = new MMKV({id: 'video-duplicates-storage'});
const CACHED_VIDEO_DUPES_KEY = 'cached_video_duplicates';

export type VideoMatchConfidence = 'high' | 'medium' | 'low';
export type VideoDuplicateKind = 'exact' | 'similar';

export interface VideoDuplicateGroup {
  id: string;
  kind: VideoDuplicateKind;
  confidence: VideoMatchConfidence;
  confidenceLabel: string;
  videos: LargeFile[];
  keeperUri: string;
  keeperReason: string;
  otherCopiesSummary: string;
  reclaimableBytes: number;
}

export interface VideoScanResult {
  groups: VideoDuplicateGroup[];
  scannedCount: number;
  totalReclaimableBytes: number;
  scannedAt: number;
}

class VideoDuplicateServiceClass {
  /**
   * Staged deterministic video duplicate detection:
   * 1. Cheap metadata filtering (duration, resolution, filesize)
   * 2. Candidate group isolation
   * 3. Exact matching vs Similar matching with conservative confidence ratings
   */
  async scan(
    onProgress?: (done: number, total: number, message: string) => void,
  ): Promise<VideoScanResult> {
    onProgress?.(5, 100, 'Loading video library...');
    const allVideos = await MediaService.getAllMedia(2000, 'Videos');

    if (allVideos.length < 2) {
      return {
        groups: [],
        scannedCount: allVideos.length,
        totalReclaimableBytes: 0,
        scannedAt: Date.now(),
      };
    }

    onProgress?.(20, 100, `Analyzing metadata for ${allVideos.length} videos...`);

    // Stage 1: Index by exact file size
    const bySize = new Map<number, LargeFile[]>();
    for (const v of allVideos) {
      if (v.fileSize > 0) {
        const arr = bySize.get(v.fileSize) ?? [];
        arr.push(v);
        bySize.set(v.fileSize, arr);
      }
    }

    // Stage 2: Index by rounded duration (within 1 second) and aspect ratio
    const byDurationAndAspect = new Map<string, LargeFile[]>();
    for (const v of allVideos) {
      const durSec = Math.round(v.playableDuration || 0);
      if (durSec > 1) {
        const aspect =
          v.width > 0 && v.height > 0
            ? (v.width / v.height).toFixed(1)
            : 'unknown';
        const key = `${durSec}_${aspect}`;
        const arr = byDurationAndAspect.get(key) ?? [];
        arr.push(v);
        byDurationAndAspect.set(key, arr);
      }
    }

    onProgress?.(50, 100, 'Evaluating candidate duplicates...');

    const processedUris = new Set<string>();
    const groups: VideoDuplicateGroup[] = [];

    // Check exact size matches first
    for (const [, candidates] of bySize.entries()) {
      if (candidates.length >= 2) {
        const unvisited = candidates.filter(c => !processedUris.has(c.uri));
        if (unvisited.length >= 2) {
          // Check if duration also matches within ±1 second
          const firstDur = unvisited[0].playableDuration || 0;
          const matchingExact = unvisited.filter(
            c => Math.abs((c.playableDuration || 0) - firstDur) <= 1.0,
          );

          if (matchingExact.length >= 2) {
            matchingExact.forEach(v => processedUris.add(v.uri));
            const group = this.buildGroup(matchingExact, 'exact', 'high');
            groups.push(group);
          }
        }
      }
    }

    // Check similar duration and aspect matches
    for (const [, candidates] of byDurationAndAspect.entries()) {
      if (candidates.length >= 2) {
        const unvisited = candidates.filter(c => !processedUris.has(c.uri));
        if (unvisited.length >= 2) {
          // Subgroup by close duration (±1s)
          const baseDur = unvisited[0].playableDuration || 0;
          const matchingDur = unvisited.filter(
            c => Math.abs((c.playableDuration || 0) - baseDur) <= 1.0,
          );

          if (matchingDur.length >= 2) {
            // Determine confidence:
            // - Medium if matching exact resolution
            // - Low if differing resolution but matching duration & aspect
            const firstRes = `${matchingDur[0].width}x${matchingDur[0].height}`;
            const sameRes = matchingDur.every(
              c => `${c.width}x${c.height}` === firstRes,
            );

            const confidence: VideoMatchConfidence = sameRes ? 'medium' : 'low';
            matchingDur.forEach(v => processedUris.add(v.uri));
            const group = this.buildGroup(matchingDur, 'similar', confidence);
            groups.push(group);
          }
        }
      }
    }

    onProgress?.(90, 100, 'Ranking best keeper videos...');

    // Sort groups by highest potential savings first
    groups.sort((a, b) => b.reclaimableBytes - a.reclaimableBytes);

    const totalReclaimableBytes = groups.reduce(
      (sum, g) => sum + g.reclaimableBytes,
      0,
    );

    const result: VideoScanResult = {
      groups,
      scannedCount: allVideos.length,
      totalReclaimableBytes,
      scannedAt: Date.now(),
    };

    this.cacheResults(result);
    onProgress?.(100, 100, 'Complete');

    return result;
  }

  private buildGroup(
    members: LargeFile[],
    kind: VideoDuplicateKind,
    confidence: VideoMatchConfidence,
  ): VideoDuplicateGroup {
    // Quality ranking for keeper:
    // 1. Highest resolution (pixels)
    // 2. Largest file size (highest bitrate/quality)
    // 3. Newest timestamp
    const sorted = [...members].sort((a, b) => {
      const resA = (a.width || 0) * (a.height || 0);
      const resB = (b.width || 0) * (b.height || 0);
      if (resB !== resA) {
        return resB - resA;
      }
      if (b.fileSize !== a.fileSize) {
        return b.fileSize - a.fileSize;
      }
      return b.timestamp - a.timestamp;
    });

    const keeper = sorted[0];
    const duplicates = sorted.slice(1);
    const reclaimableBytes = duplicates.reduce((sum, v) => sum + v.fileSize, 0);

    const keeperResLabel =
      keeper.height >= 2160
        ? '4K UHD'
        : keeper.height >= 1080
        ? '1080p'
        : keeper.height >= 720
        ? '720p'
        : `${keeper.width}×${keeper.height}`;

    const keeperReason = `Recommended to keep: ${keeperResLabel} · ${this.formatBytes(
      keeper.fileSize,
    )} · Highest quality version`;

    const otherCopiesSummary = duplicates
      .map(d => {
        const res =
          d.height >= 2160
            ? '4K'
            : d.height >= 1080
            ? '1080p'
            : d.height >= 720
            ? '720p'
            : `${d.width}×${d.height}`;
        return `${res} · ${this.formatBytes(d.fileSize)}`;
      })
      .join(', ');

    let confidenceLabel = 'Exact Duplicate';
    if (confidence === 'medium') {
      confidenceLabel = 'Very Similar Video';
    } else if (confidence === 'low') {
      confidenceLabel = 'Potentially Redundant Video';
    }

    return {
      id: `vdup_${keeper.uri}`,
      kind,
      confidence,
      confidenceLabel,
      videos: sorted,
      keeperUri: keeper.uri,
      keeperReason,
      otherCopiesSummary,
      reclaimableBytes,
    };
  }

  private cacheResults(result: VideoScanResult): void {
    storage.set(CACHED_VIDEO_DUPES_KEY, JSON.stringify(result));
  }

  getCachedResults(): VideoScanResult | null {
    try {
      const raw = storage.getString(CACHED_VIDEO_DUPES_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as VideoScanResult;
    } catch {
      return null;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

export const VideoDuplicateService = new VideoDuplicateServiceClass();
