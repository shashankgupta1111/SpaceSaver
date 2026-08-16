import {NavigatorScreenParams} from '@react-navigation/native';

export type BottomTabParamList = {
  Home: undefined;
  Images: undefined;
  Videos: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<BottomTabParamList>;
  ImageCompression: {selectedUris: string[]};
  VideoCompression: {selectedUris: string[]};
  CompressionProgress: {
    type: 'image' | 'video';
    uris: string[];
    options: CompressionOptions;
  };
  CompressionSuccess: {
    results: CompressionResult[];
    type: 'image' | 'video';
  };
  History: undefined;
  HistoryDetail: {id: string};
  FilePicker: {mode: 'image' | 'video'};
  Duplicates: undefined;
  LargeFiles: undefined;
  Insights: undefined;
  Cleanup: undefined;
  AlbumDetail: {albumTitle: string; assetType: 'Photos' | 'Videos' | 'All'};
  FormatConverter: {selectedUris?: string[]; mediaType?: 'image' | 'video'} | undefined;
  SmartCleanup: undefined;
  ScreenshotManager: undefined;
  OldMedia: undefined;
  CompressionQueue: undefined;
  SmartRecommendations: undefined;
  VideoDuplicates: undefined;
  CleanupReviewCenter: undefined;
};

export interface CompressionOptions {
  // Mode: compress (quality reduction) or convert (format conversion maintaining quality)
  mode?: 'compress' | 'convert';

  // Image options
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  outputFormat?: 'jpeg' | 'png' | 'webp' | 'heic';
  keepMetadata?: boolean;
  compressionLevel?: 'low' | 'medium' | 'high' | 'custom';

  // Video options
  resolution?: '1080p' | '720p' | '480p' | '360p' | 'original';
  videoBitrate?: 'auto' | 'low' | 'medium' | 'high';
  fps?: 30 | 24 | 15 | 'original';
  videoCodec?: 'h264' | 'h265';
  videoOutputFormat?: 'mp4' | 'mov' | 'mkv' | 'webm';
}

export interface CompressionResult {
  id: string;
  originalUri: string;
  compressedUri: string;
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  savedPercent: number;
  type: 'image' | 'video';
  timestamp: number;
  thumbnail?: string;
  fileName: string;
}

export interface HistoryItem extends CompressionResult {
  saveOption?: 'new' | 'replace';
  finalUri?: string;
}
