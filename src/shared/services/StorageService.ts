import {NativeModules, Platform} from 'react-native';
import RNFS from 'react-native-fs';
import {MMKV} from 'react-native-mmkv';

const storage = new MMKV({id: 'storage-service'});

export interface StorageInfo {
  totalStorage: number;
  usedStorage: number;
  freeStorage: number;
  savedByApp: number;
  savedToday: number;
}

export interface WeeklyStats {
  day: string;
  saved: number;
}

export interface MonthlyStats {
  week: string;
  saved: number;
}

class StorageServiceClass {
  async getStorageInfo(): Promise<StorageInfo> {
    try {
      const statResult = await RNFS.getFSInfo();
      const totalStorage = statResult.totalSpace;
      const freeStorage = statResult.freeSpace;
      const usedStorage = totalStorage - freeStorage;

      const savedByApp = storage.getNumber('totalSavedBytes') ?? 0;
      const savedToday = this.getTodaySaved();

      return {
        totalStorage,
        usedStorage,
        freeStorage,
        savedByApp,
        savedToday,
      };
    } catch {
      return {
        totalStorage: 64 * 1024 * 1024 * 1024,
        usedStorage: 32 * 1024 * 1024 * 1024,
        freeStorage: 32 * 1024 * 1024 * 1024,
        savedByApp: storage.getNumber('totalSavedBytes') ?? 0,
        savedToday: this.getTodaySaved(),
      };
    }
  }

  recordSaving(bytes: number): void {
    const current = storage.getNumber('totalSavedBytes') ?? 0;
    storage.set('totalSavedBytes', current + bytes);

    const today = new Date().toISOString().split('T')[0];
    const todayKey = `saved_${today}`;
    const todayCurrent = storage.getNumber(todayKey) ?? 0;
    storage.set(todayKey, todayCurrent + bytes);

    this.updateWeeklyStats(bytes);
    this.updateMonthlyStats(bytes);
  }

  private getTodaySaved(): number {
    const today = new Date().toISOString().split('T')[0];
    return storage.getNumber(`saved_${today}`) ?? 0;
  }

  private updateWeeklyStats(bytes: number): void {
    const today = new Date();
    const dayName = today.toLocaleDateString('en', {weekday: 'short'});
    const weekKey = `weekly_${today.getFullYear()}_${this.getWeekNumber(today)}`;
    const existing = JSON.parse(storage.getString(weekKey) ?? '{}');
    existing[dayName] = (existing[dayName] ?? 0) + bytes;
    storage.set(weekKey, JSON.stringify(existing));
  }

  private updateMonthlyStats(bytes: number): void {
    const today = new Date();
    const monthKey = `monthly_${today.getFullYear()}_${today.getMonth()}`;
    const weekNum = `W${this.getWeekNumber(today)}`;
    const existing = JSON.parse(storage.getString(monthKey) ?? '{}');
    existing[weekNum] = (existing[weekNum] ?? 0) + bytes;
    storage.set(monthKey, JSON.stringify(existing));
  }

  getWeeklyStats(): WeeklyStats[] {
    const today = new Date();
    const weekKey = `weekly_${today.getFullYear()}_${this.getWeekNumber(today)}`;
    const data = JSON.parse(storage.getString(weekKey) ?? '{}');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(day => ({day, saved: data[day] ?? 0}));
  }

  getMonthlyStats(): MonthlyStats[] {
    const today = new Date();
    const monthKey = `monthly_${today.getFullYear()}_${today.getMonth()}`;
    const data = JSON.parse(storage.getString(monthKey) ?? '{}');
    return ['W1', 'W2', 'W3', 'W4'].map(week => ({
      week,
      saved: data[week] ?? 0,
    }));
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(
      ((d.valueOf() - yearStart.valueOf()) / 86400000 + 1) / 7,
    );
  }

  formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) {return '0 B';}
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  formatBytesShort(bytes: number): string {
    if (bytes === 0) {return '0B';}
    if (bytes < 1024) {return `${bytes}B`;}
    if (bytes < 1024 * 1024) {return `${(bytes / 1024).toFixed(1)}KB`;}
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
  }

  async getFileSize(uri: string): Promise<number> {
    try {
      const stat = await RNFS.stat(uri);
      return stat.size;
    } catch {
      return 0;
    }
  }

  async deleteFile(uri: string): Promise<void> {
    const path = uri.startsWith('file://') ? uri.slice(7) : uri;
    await RNFS.unlink(path);
  }

  async fileExists(uri: string): Promise<boolean> {
    try {
      const path = uri.startsWith('file://') ? uri.slice(7) : uri;
      return await RNFS.exists(path);
    } catch {
      return false;
    }
  }
}

export const StorageService = new StorageServiceClass();
