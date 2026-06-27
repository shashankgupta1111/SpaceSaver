import {NativeModules, Platform} from 'react-native';

interface ForegroundServiceNative {
  startService(totalFiles: number): Promise<boolean>;
  updateProgress(
    progress: number,
    fileName: string,
    completed: number,
    total: number,
  ): Promise<boolean>;
  stopService(): Promise<boolean>;
}

const {ForegroundService} = NativeModules as {
  ForegroundService: ForegroundServiceNative | undefined;
};

class ForegroundServiceBridgeClass {
  private isAvailable = Platform.OS === 'android' && !!ForegroundService;

  async startService(totalFiles: number): Promise<void> {
    if (!this.isAvailable) {return;}
    try {
      await ForegroundService!.startService(totalFiles);
    } catch {
      // Graceful degradation — compression continues without notification
    }
  }

  async updateProgress(
    progress: number,
    fileName: string,
    completed: number,
    total: number,
  ): Promise<void> {
    if (!this.isAvailable) {return;}
    try {
      await ForegroundService!.updateProgress(progress, fileName, completed, total);
    } catch {}
  }

  async stopService(): Promise<void> {
    if (!this.isAvailable) {return;}
    try {
      await ForegroundService!.stopService();
    } catch {}
  }
}

export const ForegroundServiceBridge = new ForegroundServiceBridgeClass();
