import {MMKV} from 'react-native-mmkv';
import {CompressionOptions} from '../../app/navigation/types';

const storage = new MMKV({id: 'settings-storage'});

export type SaveOption = 'new' | 'replace' | 'ask';

export interface AppSettings {
  themeMode: 'light' | 'dark' | 'system';
  defaultSaveOption: SaveOption;
  showNotifications: boolean;
  defaultImageOptions: Partial<CompressionOptions>;
  defaultVideoOptions: Partial<CompressionOptions>;
  language: string;
  hasSeenOnboarding: boolean;
}

const DEFAULTS: AppSettings = {
  themeMode: 'system',
  defaultSaveOption: 'ask',
  showNotifications: true,
  defaultImageOptions: {
    compressionLevel: 'medium',
    quality: 0.8,
    outputFormat: 'jpeg',
    keepMetadata: true,
  },
  defaultVideoOptions: {
    resolution: '720p',
    videoBitrate: 'auto',
    fps: 'original',
    videoCodec: 'h264',
  },
  language: 'en',
  hasSeenOnboarding: false,
};

class SettingsServiceClass {
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    try {
      const raw = storage.getString(key);
      if (raw === undefined) {return DEFAULTS[key];}
      return JSON.parse(raw) as AppSettings[K];
    } catch {
      return DEFAULTS[key];
    }
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    storage.set(key, JSON.stringify(value));
  }

  getAll(): AppSettings {
    return Object.keys(DEFAULTS).reduce((acc, key) => {
      const k = key as keyof AppSettings;
      (acc as Record<string, unknown>)[k] = this.get(k);
      return acc;
    }, {} as AppSettings);
  }

  reset(): void {
    storage.clearAll();
  }
}

export const SettingsService = new SettingsServiceClass();
