import {PhotoIdentifier} from '@react-native-camera-roll/camera-roll';

export type SortOrder =
  | 'date_desc'
  | 'date_asc'
  | 'size_desc'
  | 'size_asc'
  | 'name_asc'
  | 'name_desc';

export type SizeBucket = 'all' | 'large' | 'medium' | 'small';
export type ImageFormat =
  | 'all'
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'heic'
  | 'gif'
  | 'bmp'
  | 'tiff';
export type VideoFormat =
  | 'all'
  | 'mp4'
  | 'mov'
  | 'mkv'
  | 'webm'
  | '3gp'
  | 'avi';
export type VideoResolution = 'all' | '4k' | '1080p' | '720p' | 'sd';

export interface MediaFilter {
  /** Common: filter by file size bucket. */
  size: SizeBucket;
  /** Images only: filter by file format/extension. */
  format: ImageFormat;
  /** Videos only: filter by file format/extension. */
  videoFormat: VideoFormat;
  /** Videos only: filter by resolution band (based on the longer edge). */
  resolution: VideoResolution;
}

export const DEFAULT_FILTER: MediaFilter = {
  size: 'all',
  format: 'all',
  videoFormat: 'all',
  resolution: 'all',
};

export const DEFAULT_SORT: SortOrder = 'date_desc';

const MB = 1024 * 1024;

/** True when the active filter differs from the "show everything" defaults. */
export function isFilterActive(filter: MediaFilter): boolean {
  return (
    filter.size !== 'all' ||
    filter.format !== 'all' ||
    filter.videoFormat !== 'all' ||
    filter.resolution !== 'all'
  );
}

function matchesSize(sizeBytes: number, bucket: SizeBucket): boolean {
  switch (bucket) {
    case 'large':
      return sizeBytes >= 10 * MB;
    case 'medium':
      return sizeBytes >= 1 * MB && sizeBytes < 10 * MB;
    case 'small':
      return sizeBytes < 1 * MB;
    default:
      return true;
  }
}

function matchesFormat(filename: string, format: ImageFormat): boolean {
  if (format === 'all') {
    return true;
  }
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (format) {
    case 'jpeg':
      return ext === 'jpg' || ext === 'jpeg';
    case 'png':
      return ext === 'png';
    case 'webp':
      return ext === 'webp';
    case 'heic':
      return ext === 'heic' || ext === 'heif';
    case 'gif':
      return ext === 'gif';
    case 'bmp':
      return ext === 'bmp';
    case 'tiff':
      return ext === 'tif' || ext === 'tiff';
    default:
      return true;
  }
}

function matchesVideoFormat(filename: string, format: VideoFormat): boolean {
  if (format === 'all') {
    return true;
  }
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (format) {
    case 'mp4':
      return ext === 'mp4' || ext === 'm4v';
    case 'mov':
      return ext === 'mov' || ext === 'qt';
    case 'mkv':
      return ext === 'mkv';
    case 'webm':
      return ext === 'webm';
    case '3gp':
      return ext === '3gp' || ext === '3g2';
    case 'avi':
      return ext === 'avi';
    default:
      return true;
  }
}

function matchesResolution(
  width: number,
  height: number,
  resolution: VideoResolution,
): boolean {
  if (resolution === 'all') {
    return true;
  }
  const longEdge = Math.max(width, height);
  switch (resolution) {
    case '4k':
      return longEdge >= 3000;
    case '1080p':
      return longEdge >= 1800 && longEdge < 3000;
    case '720p':
      return longEdge >= 1200 && longEdge < 1800;
    case 'sd':
      return longEdge > 0 && longEdge < 1200;
    default:
      return true;
  }
}

export interface SortFilterParams {
  type: 'image' | 'video';
  searchQuery?: string;
  sortOrder: SortOrder;
  filter: MediaFilter;
}

/**
 * Applies search → filter → sort to a list of camera-roll edges.
 * Pure and non-mutating (returns a new array).
 */
export function sortAndFilter(
  edges: PhotoIdentifier[],
  {type, searchQuery, sortOrder, filter}: SortFilterParams,
): PhotoIdentifier[] {
  const query = (searchQuery ?? '').trim().toLowerCase();

  const filtered = edges.filter(edge => {
    const img = edge.node.image;
    const filename = img.filename ?? '';
    const size = img.fileSize ?? 0;

    if (query && !filename.toLowerCase().includes(query)) {
      return false;
    }
    if (!matchesSize(size, filter.size)) {
      return false;
    }
    if (type === 'image' && !matchesFormat(filename, filter.format)) {
      return false;
    }
    if (
      type === 'video' &&
      !matchesVideoFormat(filename, filter.videoFormat ?? 'all')
    ) {
      return false;
    }
    if (
      type === 'video' &&
      !matchesResolution(img.width ?? 0, img.height ?? 0, filter.resolution)
    ) {
      return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    const ai = a.node.image;
    const bi = b.node.image;
    switch (sortOrder) {
      case 'date_desc':
        return b.node.timestamp - a.node.timestamp;
      case 'date_asc':
        return a.node.timestamp - b.node.timestamp;
      case 'size_desc':
        return (bi.fileSize ?? 0) - (ai.fileSize ?? 0);
      case 'size_asc':
        return (ai.fileSize ?? 0) - (bi.fileSize ?? 0);
      case 'name_asc':
        return (ai.filename ?? '').localeCompare(bi.filename ?? '');
      case 'name_desc':
        return (bi.filename ?? '').localeCompare(ai.filename ?? '');
      default:
        return 0;
    }
  });
}
