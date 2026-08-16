import {MMKV} from 'react-native-mmkv';
import {StorageService, StorageInfo} from './StorageService';
import {MediaService, LargeFile} from './MediaService';
import {DuplicateService, ScanResult} from './DuplicateService';
import {PermissionService} from './PermissionService';
import {RootStackParamList} from '../../app/navigation/types';

const storage = new MMKV({id: 'smart-cleanup-storage'});
const CACHED_REPORT_KEY = 'smart_cleanup_cached_report';

export type CleanupCategoryId =
  | 'duplicates'
  | 'large_videos'
  | 'large_photos'
  | 'screenshots'
  | 'old_media'
  | 'downloads'
  | 'whatsapp';

export interface CleanupCategory {
  id: CleanupCategoryId;
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  itemCount: number;
  totalBytes: number;
  potentialSavingsBytes: number;
  actionType: 'delete' | 'compress' | 'review';
  route: keyof RootStackParamList;
  routeParams?: any;
  items?: LargeFile[];
}

export type StorageHealthStatus =
  | 'Healthy'
  | 'Good'
  | 'Getting full'
  | 'Low storage'
  | 'Critical';

export interface StorageHealth {
  score: number; // 0 to 100
  status: StorageHealthStatus;
  color: string;
  usedPercent: number;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  potentialSavingsBytes: number;
  description: string;
}

export interface StorageBreakdown {
  videosBytes: number;
  photosBytes: number;
  screenshotsBytes: number;
  downloadsBytes: number;
  otherBytes: number;
  largeFilesBrackets: {
    over1GB: number;
    from500MBto1GB: number;
    from100MBto500MB: number;
  };
}

export interface SmartCleanupReport {
  health: StorageHealth;
  categories: CleanupCategory[];
  totalPotentialSavingsBytes: number;
  breakdown: StorageBreakdown;
  scannedAt: number;
  isFullScan: boolean;
}

class SmartCleanupServiceClass {
  /**
   * Deterministic Storage Health Score calculation:
   * 1. Evaluates Used Storage Percentage (0 - 100).
   * 2. Evaluates Free Storage headroom (capping score below 50 if free space < 5GB).
   * 3. Factors in potential reclaimable savings.
   */
  calculateHealthScore(
    usedBytes: number,
    totalBytes: number,
    freeBytes: number,
    potentialSavingsBytes: number,
  ): StorageHealth {
    if (totalBytes <= 0) {
      return {
        score: 100,
        status: 'Healthy',
        color: '#22C55E',
        usedPercent: 0,
        totalBytes: 0,
        usedBytes: 0,
        freeBytes: 0,
        potentialSavingsBytes: 0,
        description: 'Storage status optimal.',
      };
    }

    const usedPercent = Math.min(100, Math.max(0, Math.round((usedBytes / totalBytes) * 100)));
    const GB = 1024 * 1024 * 1024;
    const freeGB = freeBytes / GB;

    // Base score calculation from used percentage
    let baseScore = 100;
    if (usedPercent <= 50) {
      baseScore = 100;
    } else if (usedPercent <= 70) {
      baseScore = Math.round(100 - (usedPercent - 50) * 1.0); // 100 -> 80
    } else if (usedPercent <= 85) {
      baseScore = Math.round(80 - (usedPercent - 70) * 2.0); // 80 -> 50
    } else if (usedPercent <= 95) {
      baseScore = Math.round(50 - (usedPercent - 85) * 3.0); // 50 -> 20
    } else {
      baseScore = Math.max(5, Math.round(20 - (usedPercent - 95) * 3.0)); // 20 -> 5
    }

    // Free space penalty if storage is critically low
    if (freeGB < 2) {
      baseScore = Math.min(baseScore, 25);
    } else if (freeGB < 5) {
      baseScore = Math.min(baseScore, 45);
    } else if (freeGB < 10) {
      baseScore = Math.min(baseScore, 65);
    }

    // Minor penalty for uncleaned clutter (> 10% of total storage reclaimable)
    if (potentialSavingsBytes > totalBytes * 0.1) {
      baseScore = Math.max(5, baseScore - 5);
    }

    let status: StorageHealthStatus = 'Healthy';
    let color = '#22C55E';
    let description = 'Plenty of free storage space available.';

    if (baseScore >= 80) {
      status = 'Healthy';
      color = '#22C55E';
      description = 'Your device storage is in healthy condition.';
    } else if (baseScore >= 65) {
      status = 'Good';
      color = '#3B82F6';
      description = 'Storage is in good shape with comfortable headroom.';
    } else if (baseScore >= 50) {
      status = 'Getting full';
      color = '#F59E0B';
      description = 'Storage is starting to fill up. Consider a quick cleanup.';
    } else if (baseScore >= 30) {
      status = 'Low storage';
      color = '#F97316';
      description = 'Free storage is running low. Free up space now.';
    } else {
      status = 'Critical';
      color = '#EF4444';
      description = 'Storage critically full. Apps and camera may stop working.';
    }

    return {
      score: baseScore,
      status,
      color,
      usedPercent,
      totalBytes,
      usedBytes,
      freeBytes,
      potentialSavingsBytes,
      description,
    };
  }

  /**
   * Fast summary for HomeScreen and instant initial view.
   * NEVER runs an expensive duplicate perceptual hash scan.
   * Reads storage info, album sizes, top large files, and cached duplicate estimates.
   */
  async getQuickSummary(): Promise<SmartCleanupReport> {
    const storageInfo: StorageInfo = await StorageService.getStorageInfo();
    const hasPermission = await PermissionService.hasImagePermission();

    const cached = this.getCachedReport();
    let duplicateSavings = cached?.categories.find(c => c.id === 'duplicates')?.potentialSavingsBytes ?? 0;
    let duplicateItems = cached?.categories.find(c => c.id === 'duplicates')?.itemCount ?? 0;

    let categories: CleanupCategory[] = [];
    let largeVideos: LargeFile[] = [];
    let largePhotos: LargeFile[] = [];
    let screenshotFiles: LargeFile[] = [];
    let downloadFiles: LargeFile[] = [];
    let whatsappFiles: LargeFile[] = [];
    let oldMediaFiles: LargeFile[] = [];

    if (hasPermission) {
      try {
        const topMedia = await MediaService.getLargestMedia(50);
        largeVideos = topMedia.filter(m => m.type === 'video' && m.fileSize >= 50 * 1024 * 1024);
        largePhotos = topMedia.filter(m => m.type === 'image' && m.fileSize >= 8 * 1024 * 1024);

        // Identify older media candidates (e.g. timestamp > 90 days ago)
        const now = Date.now();
        const ninetyDaysMs = 90 * 86400 * 1000;
        oldMediaFiles = topMedia.filter(m => {
          const fileMs = m.timestamp > 1e11 ? m.timestamp : m.timestamp * 1000;
          return now - fileMs >= ninetyDaysMs;
        });

        const albums = await MediaService.getAlbums();

        for (const album of albums) {
          const lower = album.title.toLowerCase();
          if (
            (lower.includes('screenshot') || lower.includes('screen capture') || lower.includes('captures')) &&
            album.count > 0 &&
            screenshotFiles.length === 0
          ) {
            screenshotFiles = await MediaService.getAlbumMedia(album.title, 100);
          } else if (lower.includes('download') && album.count > 0 && downloadFiles.length === 0) {
            downloadFiles = await MediaService.getAlbumMedia(album.title, 100);
          } else if ((lower.includes('whatsapp') || lower.includes('telegram')) && album.count > 0 && whatsappFiles.length === 0) {
            whatsappFiles = await MediaService.getAlbumMedia(album.title, 100);
          }
        }
      } catch {
        // Fallback gracefully on permission error or empty library
      }
    }

    // Build categories (only include categories with real data)
    if (duplicateSavings > 0 && duplicateItems > 0) {
      categories.push({
        id: 'duplicates',
        title: 'Duplicate Photos',
        subtitle: `${duplicateItems} identical or near-duplicate shots`,
        icon: 'image-multiple-outline',
        iconColor: '#EF4444',
        itemCount: duplicateItems,
        totalBytes: duplicateSavings * 1.5,
        potentialSavingsBytes: duplicateSavings,
        actionType: 'delete',
        route: 'Duplicates',
      });
    }

    if (screenshotFiles.length > 0) {
      const totalScreenshotBytes = screenshotFiles.reduce((sum, s) => sum + s.fileSize, 0);
      categories.push({
        id: 'screenshots',
        title: 'Screenshots Album',
        subtitle: `${screenshotFiles.length} screenshots taking storage`,
        icon: 'cellphone-screenshot',
        iconColor: '#F59E0B',
        itemCount: screenshotFiles.length,
        totalBytes: totalScreenshotBytes,
        potentialSavingsBytes: totalScreenshotBytes,
        actionType: 'review',
        route: 'ScreenshotManager',
        items: screenshotFiles,
      });
    }

    if (oldMediaFiles.length > 0) {
      const totalOldBytes = oldMediaFiles.reduce((sum, o) => sum + o.fileSize, 0);
      categories.push({
        id: 'old_media',
        title: 'Older Media Files',
        subtitle: `${oldMediaFiles.length} files not modified in 90+ days`,
        icon: 'clock-outline',
        iconColor: '#3B82F6',
        itemCount: oldMediaFiles.length,
        totalBytes: totalOldBytes,
        potentialSavingsBytes: Math.round(totalOldBytes * 0.7),
        actionType: 'review',
        route: 'OldMedia',
        items: oldMediaFiles,
      });
    }

    if (largeVideos.length > 0) {
      const totalVideoBytes = largeVideos.reduce((sum, v) => sum + v.fileSize, 0);
      const estimatedSavings = Math.round(totalVideoBytes * 0.6); // ~60% video compression saving
      categories.push({
        id: 'large_videos',
        title: 'Large Videos',
        subtitle: `${largeVideos.length} videos taking substantial space`,
        icon: 'video-outline',
        iconColor: '#7C4DFF',
        itemCount: largeVideos.length,
        totalBytes: totalVideoBytes,
        potentialSavingsBytes: estimatedSavings,
        actionType: 'compress',
        route: 'LargeFiles',
        items: largeVideos,
      });
    }

    if (downloadFiles.length > 0) {
      const totalDownloadBytes = downloadFiles.reduce((sum, d) => sum + d.fileSize, 0);
      categories.push({
        id: 'downloads',
        title: 'Downloads Folder',
        subtitle: `${downloadFiles.length} downloaded media files`,
        icon: 'download-outline',
        iconColor: '#0EA5E9',
        itemCount: downloadFiles.length,
        totalBytes: totalDownloadBytes,
        potentialSavingsBytes: totalDownloadBytes,
        actionType: 'review',
        route: 'AlbumDetail',
        routeParams: {albumTitle: 'Download', assetType: 'All'},
        items: downloadFiles,
      });
    }

    if (largePhotos.length > 0) {
      const totalPhotoBytes = largePhotos.reduce((sum, p) => sum + p.fileSize, 0);
      const estimatedSavings = Math.round(totalPhotoBytes * 0.7); // ~70% image compression saving
      categories.push({
        id: 'large_photos',
        title: 'Compressible Large Photos',
        subtitle: `${largePhotos.length} high-res photos over 8 MB`,
        icon: 'image-filter-hdr',
        iconColor: '#10B981',
        itemCount: largePhotos.length,
        totalBytes: totalPhotoBytes,
        potentialSavingsBytes: estimatedSavings,
        actionType: 'compress',
        route: 'LargeFiles',
        items: largePhotos,
      });
    }

    const totalPotentialSavingsBytes = categories.reduce(
      (sum, c) => sum + c.potentialSavingsBytes,
      0,
    );

    const health = this.calculateHealthScore(
      storageInfo.usedStorage,
      storageInfo.totalStorage,
      storageInfo.freeStorage,
      totalPotentialSavingsBytes,
    );

    const breakdown: StorageBreakdown = this.computeBreakdown(
      largeVideos,
      largePhotos,
      screenshotFiles,
      downloadFiles,
      storageInfo.usedStorage,
    );

    const report: SmartCleanupReport = {
      health,
      categories,
      totalPotentialSavingsBytes,
      breakdown,
      scannedAt: Date.now(),
      isFullScan: false,
    };

    return report;
  }

  /**
   * Full comprehensive scan with user-triggered duplicate hash analysis and progress updates.
   */
  async performFullScan(
    onProgress?: (progressPercent: number, statusText: string) => void,
  ): Promise<SmartCleanupReport> {
    onProgress?.(10, 'Reading storage metrics...');
    const storageInfo: StorageInfo = await StorageService.getStorageInfo();

    onProgress?.(25, 'Checking large videos & photos...');
    const topMedia = await MediaService.getLargestMedia(60);
    const largeVideos = topMedia.filter(m => m.type === 'video' && m.fileSize >= 30 * 1024 * 1024);
    const largePhotos = topMedia.filter(m => m.type === 'image' && m.fileSize >= 5 * 1024 * 1024);

    const now = Date.now();
    const ninetyDaysMs = 90 * 86400 * 1000;
    const oldMediaFiles = topMedia.filter(m => {
      const fileMs = m.timestamp > 1e11 ? m.timestamp : m.timestamp * 1000;
      return now - fileMs >= ninetyDaysMs;
    });

    onProgress?.(45, 'Scanning media albums...');
    const albums = await MediaService.getAlbums();
    let screenshotFiles: LargeFile[] = [];
    let downloadFiles: LargeFile[] = [];
    let whatsappFiles: LargeFile[] = [];

    for (const album of albums) {
      const lower = album.title.toLowerCase();
      if (
        (lower.includes('screenshot') || lower.includes('screen capture') || lower.includes('captures')) &&
        album.count > 0 &&
        screenshotFiles.length === 0
      ) {
        screenshotFiles = await MediaService.getAlbumMedia(album.title, 200);
      } else if (lower.includes('download') && album.count > 0 && downloadFiles.length === 0) {
        downloadFiles = await MediaService.getAlbumMedia(album.title, 200);
      } else if ((lower.includes('whatsapp') || lower.includes('telegram')) && album.count > 0 && whatsappFiles.length === 0) {
        whatsappFiles = await MediaService.getAlbumMedia(album.title, 200);
      }
    }

    onProgress?.(70, 'Analyzing duplicate photos...');
    let duplicateSavings = 0;
    let duplicateItems = 0;
    try {
      const dupResult: ScanResult = await DuplicateService.scan(p => {
        onProgress?.(70 + Math.round(p * 20), 'Matching duplicate photos...');
      });
      duplicateSavings = dupResult.groups.reduce((sum, g) => sum + g.reclaimable, 0);
      duplicateItems = dupResult.groups.reduce((sum, g) => sum + (g.photos.length - 1), 0);
    } catch {
      // Duplicate scan failed or skipped
    }

    onProgress?.(95, 'Synthesizing storage report...');

    const categories: CleanupCategory[] = [];

    if (duplicateSavings > 0 && duplicateItems > 0) {
      categories.push({
        id: 'duplicates',
        title: 'Duplicate Photos',
        subtitle: `${duplicateItems} duplicate photos safely reclaimable`,
        icon: 'image-multiple-outline',
        iconColor: '#EF4444',
        itemCount: duplicateItems,
        totalBytes: duplicateSavings * 1.5,
        potentialSavingsBytes: duplicateSavings,
        actionType: 'delete',
        route: 'Duplicates',
      });
    }

    if (screenshotFiles.length > 0) {
      const totalScreenshotBytes = screenshotFiles.reduce((sum, s) => sum + s.fileSize, 0);
      categories.push({
        id: 'screenshots',
        title: 'Screenshots Album',
        subtitle: `${screenshotFiles.length} screenshots taking storage`,
        icon: 'cellphone-screenshot',
        iconColor: '#F59E0B',
        itemCount: screenshotFiles.length,
        totalBytes: totalScreenshotBytes,
        potentialSavingsBytes: totalScreenshotBytes,
        actionType: 'review',
        route: 'ScreenshotManager',
        items: screenshotFiles,
      });
    }

    if (oldMediaFiles.length > 0) {
      const totalOldBytes = oldMediaFiles.reduce((sum, o) => sum + o.fileSize, 0);
      categories.push({
        id: 'old_media',
        title: 'Older Media Files',
        subtitle: `${oldMediaFiles.length} files not modified in 90+ days`,
        icon: 'clock-outline',
        iconColor: '#3B82F6',
        itemCount: oldMediaFiles.length,
        totalBytes: totalOldBytes,
        potentialSavingsBytes: Math.round(totalOldBytes * 0.7),
        actionType: 'review',
        route: 'OldMedia',
        items: oldMediaFiles,
      });
    }

    if (largeVideos.length > 0) {
      const totalVideoBytes = largeVideos.reduce((sum, v) => sum + v.fileSize, 0);
      const estimatedSavings = Math.round(totalVideoBytes * 0.6);
      categories.push({
        id: 'large_videos',
        title: 'Large Videos',
        subtitle: `${largeVideos.length} large videos ready for compression`,
        icon: 'video-outline',
        iconColor: '#7C4DFF',
        itemCount: largeVideos.length,
        totalBytes: totalVideoBytes,
        potentialSavingsBytes: estimatedSavings,
        actionType: 'compress',
        route: 'LargeFiles',
        items: largeVideos,
      });
    }

    if (downloadFiles.length > 0) {
      const totalDownloadBytes = downloadFiles.reduce((sum, d) => sum + d.fileSize, 0);
      categories.push({
        id: 'downloads',
        title: 'Downloads Folder',
        subtitle: `${downloadFiles.length} downloaded media items`,
        icon: 'download-outline',
        iconColor: '#0EA5E9',
        itemCount: downloadFiles.length,
        totalBytes: totalDownloadBytes,
        potentialSavingsBytes: totalDownloadBytes,
        actionType: 'review',
        route: 'AlbumDetail',
        routeParams: {albumTitle: 'Download', assetType: 'All'},
        items: downloadFiles,
      });
    }

    if (largePhotos.length > 0) {
      const totalPhotoBytes = largePhotos.reduce((sum, p) => sum + p.fileSize, 0);
      const estimatedSavings = Math.round(totalPhotoBytes * 0.7);
      categories.push({
        id: 'large_photos',
        title: 'Compressible High-Res Photos',
        subtitle: `${largePhotos.length} heavy photos over 5 MB`,
        icon: 'image-filter-hdr',
        iconColor: '#10B981',
        itemCount: largePhotos.length,
        totalBytes: totalPhotoBytes,
        potentialSavingsBytes: estimatedSavings,
        actionType: 'compress',
        route: 'LargeFiles',
        items: largePhotos,
      });
    }

    const totalPotentialSavingsBytes = categories.reduce(
      (sum, c) => sum + c.potentialSavingsBytes,
      0,
    );

    const health = this.calculateHealthScore(
      storageInfo.usedStorage,
      storageInfo.totalStorage,
      storageInfo.freeStorage,
      totalPotentialSavingsBytes,
    );

    const breakdown = this.computeBreakdown(
      largeVideos,
      largePhotos,
      screenshotFiles,
      downloadFiles,
      storageInfo.usedStorage,
    );

    const report: SmartCleanupReport = {
      health,
      categories,
      totalPotentialSavingsBytes,
      breakdown,
      scannedAt: Date.now(),
      isFullScan: true,
    };

    // Cache the report in MMKV
    this.cacheReport(report);

    onProgress?.(100, 'Done');
    return report;
  }

  private computeBreakdown(
    largeVideos: LargeFile[],
    largePhotos: LargeFile[],
    screenshots: LargeFile[],
    downloads: LargeFile[],
    totalUsedBytes: number,
  ): StorageBreakdown {
    const videosBytes = largeVideos.reduce((acc, v) => acc + v.fileSize, 0);
    const photosBytes = largePhotos.reduce((acc, p) => acc + p.fileSize, 0);
    const screenshotsBytes = screenshots.reduce((acc, s) => acc + s.fileSize, 0);
    const downloadsBytes = downloads.reduce((acc, d) => acc + d.fileSize, 0);
    const otherBytes = Math.max(
      0,
      totalUsedBytes - (videosBytes + photosBytes + screenshotsBytes + downloadsBytes),
    );

    const allItems = [...largeVideos, ...largePhotos, ...screenshots, ...downloads];
    const GB = 1024 * 1024 * 1024;
    const MB500 = 500 * 1024 * 1024;
    const MB100 = 100 * 1024 * 1024;

    const largeFilesBrackets = {
      over1GB: allItems.filter(f => f.fileSize >= GB).length,
      from500MBto1GB: allItems.filter(f => f.fileSize >= MB500 && f.fileSize < GB).length,
      from100MBto500MB: allItems.filter(f => f.fileSize >= MB100 && f.fileSize < MB500).length,
    };

    return {
      videosBytes,
      photosBytes,
      screenshotsBytes,
      downloadsBytes,
      otherBytes,
      largeFilesBrackets,
    };
  }

  private cacheReport(report: SmartCleanupReport): void {
    storage.set(CACHED_REPORT_KEY, JSON.stringify(report));
  }

  getCachedReport(): SmartCleanupReport | null {
    try {
      const raw = storage.getString(CACHED_REPORT_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SmartCleanupReport;
    } catch {
      return null;
    }
  }
}

export const SmartCleanupService = new SmartCleanupServiceClass();
