import {NativeModules, Platform} from 'react-native';
import RNFS from 'react-native-fs';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';

/* ------------------------------------------------------------------ *
 * Native bridge
 * ------------------------------------------------------------------ */

interface NativeHashResult {
  uri: string;
  aHash?: string;
  dHash?: string;
  avgR?: number;
  avgG?: number;
  avgB?: number;
  width?: number;
  height?: number;
  error?: string;
}

interface PerceptualHashNative {
  hashImages(uris: string[]): Promise<NativeHashResult[]>;
}

const {PerceptualHash} = NativeModules as {
  PerceptualHash?: PerceptualHashNative;
};

export const isPerceptualHashAvailable =
  Platform.OS === 'android' && !!PerceptualHash;

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export interface DupPhoto {
  uri: string;
  filename: string;
  fileSize: number;
  width: number;
  height: number;
  timestamp: number;
}

export type DuplicateKind = 'exact' | 'similar';

export interface DuplicateGroup {
  id: string;
  kind: DuplicateKind;
  /** Photos in the group, sorted best-first (recommended keeper at index 0). */
  photos: DupPhoto[];
  keeperUri: string;
  /** Bytes reclaimable if every photo except the keeper is deleted. */
  reclaimable: number;
}

export interface ScanResult {
  groups: DuplicateGroup[];
  scanned: number;
  /** True when hashes came from the fast native module (near-dupe capable). */
  perceptual: boolean;
  totalReclaimable: number;
}

/* ------------------------------------------------------------------ *
 * Hamming-distance helpers (64-bit hash stored as 16 hex chars)
 * ------------------------------------------------------------------ */

type HashPair = {hi: number; lo: number};

function hexToPair(hex?: string): HashPair | null {
  if (!hex || hex.length !== 16) {
    return null;
  }
  const hi = parseInt(hex.slice(0, 8), 16) >>> 0;
  const lo = parseInt(hex.slice(8, 16), 16) >>> 0;
  if (Number.isNaN(hi) || Number.isNaN(lo)) {
    return null;
  }
  return {hi, lo};
}

function popcount32(n: number): number {
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  n = (n + (n >>> 4)) & 0x0f0f0f0f;
  return (n * 0x01010101) >>> 24;
}

function hamming(a: HashPair, b: HashPair): number {
  return popcount32(a.hi ^ b.hi) + popcount32(a.lo ^ b.lo);
}

/** Combined bits of aHash + dHash where distance <= this counts as "similar". */
const SIMILAR_THRESHOLD = 12;

/**
 * Perceptual hashes ignore absolute colour, so two low-detail images (e.g. a
 * solid red and a solid blue wallpaper) can hash identically. We additionally
 * require their mean colours to be close before grouping. Manhattan distance
 * over average RGB (0–765).
 */
const COLOR_THRESHOLD = 40;

interface RGB {
  r: number;
  g: number;
  b: number;
}

function colorDistance(a: RGB, b: RGB): number {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

/* ------------------------------------------------------------------ *
 * Union-Find (disjoint set) for clustering
 * ------------------------------------------------------------------ */

class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({length: n}, (_, i) => i);
  }
  find(x: number): number {
    let root = x;
    while (this.parent[root] !== root) {
      root = this.parent[root];
    }
    while (this.parent[x] !== root) {
      const next = this.parent[x];
      this.parent[x] = root;
      x = next;
    }
    return root;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) {
      this.parent[ra] = rb;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Service
 * ------------------------------------------------------------------ */

class DuplicateServiceClass {
  /** Loads up to `limit` photos from the camera roll with the metadata we need. */
  async getPhotos(limit = 1000): Promise<DupPhoto[]> {
    const res = await CameraRoll.getPhotos({
      first: limit,
      assetType: 'Photos',
      include: ['fileSize', 'filename', 'imageSize'],
    });
    return res.edges.map(e => ({
      uri: e.node.image.uri,
      filename: e.node.image.filename ?? '',
      fileSize: e.node.image.fileSize ?? 0,
      width: e.node.image.width ?? 0,
      height: e.node.image.height ?? 0,
      timestamp: e.node.timestamp ?? 0,
    }));
  }

  /**
   * Full scan: load photos → hash them → cluster into duplicate groups.
   * `onProgress(done, total)` fires as hashing advances.
   */
  async scan(
    onProgress?: (done: number, total: number) => void,
  ): Promise<ScanResult> {
    const photos = await this.getPhotos();
    if (photos.length === 0) {
      return {groups: [], scanned: 0, perceptual: false, totalReclaimable: 0};
    }

    if (isPerceptualHashAvailable) {
      return this.scanPerceptual(photos, onProgress);
    }
    return this.scanExactFallback(photos, onProgress);
  }

  /* ---- Native perceptual path (exact + near-duplicate) ---- */

  private async scanPerceptual(
    photos: DupPhoto[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<ScanResult> {
    const byUri = new Map<string, DupPhoto>();
    photos.forEach(p => byUri.set(p.uri, p));

    const hashes = new Map<string, {a: HashPair; d: HashPair; color: RGB}>();
    const CHUNK = 40;
    let done = 0;

    for (let i = 0; i < photos.length; i += CHUNK) {
      const batch = photos.slice(i, i + CHUNK);
      let results: NativeHashResult[] = [];
      try {
        results = await PerceptualHash!.hashImages(batch.map(p => p.uri));
      } catch {
        results = [];
      }
      for (const r of results) {
        const a = hexToPair(r.aHash);
        const d = hexToPair(r.dHash);
        if (a && d) {
          hashes.set(r.uri, {
            a,
            d,
            color: {r: r.avgR ?? 0, g: r.avgG ?? 0, b: r.avgB ?? 0},
          });
        }
      }
      done += batch.length;
      onProgress?.(Math.min(done, photos.length), photos.length);
    }

    const hashed = photos.filter(p => hashes.has(p.uri));
    const n = hashed.length;
    const uf = new UnionFind(n);

    for (let i = 0; i < n; i++) {
      const hi = hashes.get(hashed[i].uri)!;
      for (let j = i + 1; j < n; j++) {
        const hj = hashes.get(hashed[j].uri)!;
        const dist = hamming(hi.a, hj.a) + hamming(hi.d, hj.d);
        if (
          dist <= SIMILAR_THRESHOLD &&
          colorDistance(hi.color, hj.color) <= COLOR_THRESHOLD
        ) {
          uf.union(i, j);
        }
      }
    }

    // Bucket indices by cluster root.
    const clusters = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const root = uf.find(i);
      const arr = clusters.get(root) ?? [];
      arr.push(i);
      clusters.set(root, arr);
    }

    const groups: DuplicateGroup[] = [];
    clusters.forEach(idxs => {
      if (idxs.length < 2) {
        return;
      }
      const members = idxs.map(i => hashed[i]);
      // "Exact" only when every member shares an identical hash with the first;
      // any non-zero distance within the cluster makes it "similar".
      const first = hashes.get(members[0].uri)!;
      const exact = members.every(m => {
        const h = hashes.get(m.uri)!;
        return hamming(first.a, h.a) + hamming(first.d, h.d) === 0;
      });
      groups.push(this.buildGroup(members, exact ? 'exact' : 'similar'));
    });

    return this.finalize(groups, photos.length, true);
  }

  /* ---- Fallback path (exact duplicates via MD5, best-effort) ---- */

  private async scanExactFallback(
    photos: DupPhoto[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<ScanResult> {
    const byHash = new Map<string, DupPhoto[]>();
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      try {
        const path = p.uri.startsWith('file://') ? p.uri.slice(7) : p.uri;
        const md5 = await RNFS.hash(path, 'md5');
        const arr = byHash.get(md5) ?? [];
        arr.push(p);
        byHash.set(md5, arr);
      } catch {
        // content:// URIs and unreadable files are skipped in the fallback.
      }
      onProgress?.(i + 1, photos.length);
    }

    const groups: DuplicateGroup[] = [];
    byHash.forEach(members => {
      if (members.length >= 2) {
        groups.push(this.buildGroup(members, 'exact'));
      }
    });

    return this.finalize(groups, photos.length, false);
  }

  /* ---- Group building + keeper selection ---- */

  private buildGroup(members: DupPhoto[], kind: DuplicateKind): DuplicateGroup {
    // Best keeper = highest resolution, then largest file, then newest.
    const sorted = [...members].sort((a, b) => {
      const resA = a.width * a.height;
      const resB = b.width * b.height;
      if (resB !== resA) {
        return resB - resA;
      }
      if (b.fileSize !== a.fileSize) {
        return b.fileSize - a.fileSize;
      }
      return b.timestamp - a.timestamp;
    });
    const keeper = sorted[0];
    const reclaimable = sorted
      .slice(1)
      .reduce((sum, p) => sum + p.fileSize, 0);
    return {
      id: keeper.uri,
      kind,
      photos: sorted,
      keeperUri: keeper.uri,
      reclaimable,
    };
  }

  private finalize(
    groups: DuplicateGroup[],
    scanned: number,
    perceptual: boolean,
  ): ScanResult {
    // Biggest wins first.
    groups.sort((a, b) => b.reclaimable - a.reclaimable);
    const totalReclaimable = groups.reduce((s, g) => s + g.reclaimable, 0);
    return {groups, scanned, perceptual, totalReclaimable};
  }

  /**
   * Deletes the given photos from the device gallery via MediaStore.
   * On Android 11+ the OS shows a system confirmation dialog.
   */
  async deletePhotos(uris: string[]): Promise<void> {
    if (uris.length === 0) {
      return;
    }
    await CameraRoll.deletePhotos(uris);
  }
}

export const DuplicateService = new DuplicateServiceClass();
