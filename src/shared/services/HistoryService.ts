import {MMKV} from 'react-native-mmkv';
import {HistoryItem} from '../../app/navigation/types';

const storage = new MMKV({id: 'history-storage'});
const HISTORY_KEY = 'compression_history';
const MAX_HISTORY = 1000;

export interface MonthlyInsights {
  filesCompressedCount: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  savedBytes: number;
  averageReductionPercent: number;
  topSaver: {
    category: 'Videos' | 'Photos' | 'None';
    savedBytes: number;
  };
  activity: {
    photosCount: number;
    videosCount: number;
    photosSavedBytes: number;
    videosSavedBytes: number;
  };
}

export interface LifetimeInsights {
  lifetimeSavedBytes: number;
  lifetimeFilesCompressed: number;
  categorySavings: {
    videosSavedBytes: number;
    photosSavedBytes: number;
  };
  monthlyTrends: {
    month: string;
    savedBytes: number;
  }[];
  mostEffectiveAction: {
    title: string;
    savedBytes: number;
  };
}

class HistoryServiceClass {
  getAll(): HistoryItem[] {
    try {
      const raw = storage.getString(HISTORY_KEY);
      if (!raw) {return [];}
      const items = JSON.parse(raw) as HistoryItem[];
      return items.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }

  add(item: HistoryItem): void {
    const items = this.getAll();
    const updated = [item, ...items].slice(0, MAX_HISTORY);
    storage.set(HISTORY_KEY, JSON.stringify(updated));
  }

  addBatch(items: HistoryItem[]): void {
    const existing = this.getAll();
    const updated = [...items, ...existing].slice(0, MAX_HISTORY);
    storage.set(HISTORY_KEY, JSON.stringify(updated));
  }

  getById(id: string): HistoryItem | null {
    return this.getAll().find(item => item.id === id) ?? null;
  }

  delete(id: string): void {
    const items = this.getAll().filter(item => item.id !== id);
    storage.set(HISTORY_KEY, JSON.stringify(items));
  }

  clearAll(): void {
    storage.delete(HISTORY_KEY);
  }

  getTotalSaved(): number {
    return this.getAll().reduce((sum, item) => sum + item.savedBytes, 0);
  }

  getRecentItems(limit = 10): HistoryItem[] {
    return this.getAll().slice(0, limit);
  }

  getByType(type: 'image' | 'video'): HistoryItem[] {
    return this.getAll().filter(item => item.type === type);
  }

  /**
   * Computes rich compression analytics for the current calendar month
   * from actual history data.
   */
  getMonthlyInsights(): MonthlyInsights {
    const all = this.getAll();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const monthItems = all.filter(item => item.timestamp >= startOfMonth);

    const filesCompressedCount = monthItems.length;
    const originalSizeBytes = monthItems.reduce((s, i) => s + (i.originalSize || 0), 0);
    const compressedSizeBytes = monthItems.reduce((s, i) => s + (i.compressedSize || 0), 0);
    const savedBytes = monthItems.reduce((s, i) => s + (i.savedBytes || 0), 0);

    const averageReductionPercent =
      originalSizeBytes > 0
        ? Math.round((savedBytes / originalSizeBytes) * 100)
        : 0;

    const photos = monthItems.filter(i => i.type === 'image');
    const videos = monthItems.filter(i => i.type === 'video');

    const photosSavedBytes = photos.reduce((s, i) => s + (i.savedBytes || 0), 0);
    const videosSavedBytes = videos.reduce((s, i) => s + (i.savedBytes || 0), 0);

    let topCategory: 'Videos' | 'Photos' | 'None' = 'None';
    let topSavedBytes = 0;

    if (videosSavedBytes > 0 || photosSavedBytes > 0) {
      if (videosSavedBytes >= photosSavedBytes) {
        topCategory = 'Videos';
        topSavedBytes = videosSavedBytes;
      } else {
        topCategory = 'Photos';
        topSavedBytes = photosSavedBytes;
      }
    }

    return {
      filesCompressedCount,
      originalSizeBytes,
      compressedSizeBytes,
      savedBytes,
      averageReductionPercent,
      topSaver: {
        category: topCategory,
        savedBytes: topSavedBytes,
      },
      activity: {
        photosCount: photos.length,
        videosCount: videos.length,
        photosSavedBytes,
        videosSavedBytes,
      },
    };
  }

  /**
   * Computes lifetime compression analytics and historical monthly trends
   * directly from real local history records.
   */
  getLifetimeInsights(): LifetimeInsights {
    const all = this.getAll();
    const lifetimeSavedBytes = all.reduce((sum, i) => sum + (i.savedBytes || 0), 0);
    const lifetimeFilesCompressed = all.length;

    const photos = all.filter(i => i.type === 'image');
    const videos = all.filter(i => i.type === 'video');

    const photosSavedBytes = photos.reduce((s, i) => s + (i.savedBytes || 0), 0);
    const videosSavedBytes = videos.reduce((s, i) => s + (i.savedBytes || 0), 0);

    // Compute monthly trends for the last 4 calendar months
    const monthlyTrends: {month: string; savedBytes: number}[] = [];
    const now = new Date();

    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startMs = d.getTime();
      const endMs = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
      const monthLabel = d.toLocaleString('en', {month: 'short'});

      const monthSaved = all
        .filter(item => item.timestamp >= startMs && item.timestamp < endMs)
        .reduce((sum, item) => sum + (item.savedBytes || 0), 0);

      monthlyTrends.push({
        month: monthLabel,
        savedBytes: monthSaved,
      });
    }

    // Determine most effective space-saving action
    let mostEffectiveAction = {
      title: 'No activity yet',
      savedBytes: 0,
    };

    if (videosSavedBytes >= photosSavedBytes && videosSavedBytes > 0) {
      mostEffectiveAction = {
        title: 'Video Compression',
        savedBytes: videosSavedBytes,
      };
    } else if (photosSavedBytes > 0) {
      mostEffectiveAction = {
        title: 'Photo Compression',
        savedBytes: photosSavedBytes,
      };
    }

    return {
      lifetimeSavedBytes,
      lifetimeFilesCompressed,
      categorySavings: {
        videosSavedBytes,
        photosSavedBytes,
      },
      monthlyTrends,
      mostEffectiveAction,
    };
  }
}

export const HistoryService = new HistoryServiceClass();
