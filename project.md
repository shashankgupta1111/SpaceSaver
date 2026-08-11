# SpaceSaver — Project Reference

> Android-only storage optimizer. Fully offline — no login, no cloud, no backend, no ads, no watermarks.  
> Compresses images and videos with background Foreground Service support.

---

## Tech Stack

| Layer | Library | Version |
|-------|---------|---------|
| Framework | react-native | 0.79.7 |
| Language | TypeScript | 5.0.4 |
| React | react | 19.0.0 |
| Navigation | @react-navigation/native + bottom-tabs + native-stack | ^6.x |
| Animations | react-native-reanimated | ^3.19.0 |
| Gestures | react-native-gesture-handler | ^2.20.2 |
| Storage | react-native-mmkv | ^3.1.0 |
| Data cache | @tanstack/react-query | ^5.59.15 |
| Compression | react-native-compressor | ^2.0.2 |
| Compression peer dep | react-native-nitro-modules | ^0.35.10 |
| File system | react-native-fs | ^2.20.0 |
| Media library | @react-native-camera-roll/camera-roll | ^7.8.0 |
| Permissions | react-native-permissions | ^4.1.5 |
| List perf | @shopify/flash-list | ^1.7.1 |
| Charts | react-native-gifted-charts | ^1.4.31 |
| Gradients | react-native-linear-gradient | ^2.8.3 |
| SVG | react-native-svg | ^15.8.0 |
| Icons | react-native-vector-icons | ^10.2.0 |
| Slider | @react-native-community/slider | ^4.5.5 |
| Haptics | react-native-haptic-feedback | ^2.2.0 |
| Share | react-native-share | ^11.0.0 |
| State | zustand | ^5.0.1 |
| Date utils | date-fns | ^4.1.0 |

---

## Android Configuration

| Key | Value |
|-----|-------|
| compileSdk | 35 |
| targetSdk | 35 |
| minSdk | 24 (Android 7.0+) |
| NDK | 27.1.12297006 |
| Kotlin | 2.0.21 |
| New Architecture | ENABLED (newArchEnabled=true) |
| Hermes | ENABLED |
| Package | com.spacesaver |
| applicationId | com.spacesaver |
| SDK path | /Users/shashankgupta/Library/Android/sdk |

---

## Design System

```
Primary:    #5B5FEF  (indigo)
Secondary:  #7C4DFF  (purple)
Success:    #22C55E  (green)
Warning:    #F59E0B  (amber)
Error:      #EF4444  (red)
BG Light:   #F8FAFC
BG Dark:    #09090B
```

Theme modes: `light` / `dark` / `system`  
MMKV key: `theme_mode`  
Theme context: `src/app/theme/ThemeContext.tsx`

---

## Project Structure

```
SpaceSaver/
├── index.js                          # Entry point — registers AppRegistry
├── app.json                          # App name: SpaceSaver
├── babel.config.js                   # @react-native/babel-preset
├── metro.config.js                   # Metro bundler config
├── tsconfig.json                     # TypeScript config
├── package.json                      # All dependencies
├── project.md                        # ← YOU ARE HERE
│
├── android/
│   ├── gradlew                       # chmod +x required (already done)
│   ├── local.properties              # sdk.dir=... (not in git, machine-specific)
│   ├── gradle.properties             # newArchEnabled=true, IS_HERMES_ENABLED=true
│   ├── build.gradle                  # Root: kotlinVersion, sdkVersions, ndkVersion
│   ├── settings.gradle               # Project name, plugin management
│   └── app/
│       ├── build.gradle              # App: applicationId, autolinkLibrariesWithApp()
│       └── src/main/
│           ├── AndroidManifest.xml   # ⚠️ MUST have tools:replace="android:allowBackup"
│           ├── assets/fonts/         # 19 TTF files for react-native-vector-icons
│           └── java/com/spacesaver/
│               ├── MainActivity.kt                 # Entry activity
│               ├── MainApplication.kt              # Registers ForegroundServicePackage + PerceptualHashPackage
│               ├── CompressionForegroundService.kt # Foreground service (Kotlin)
│               ├── ForegroundServiceModule.kt      # Native module bridge to JS
│               ├── ForegroundServicePackage.kt     # Registers foreground-service module
│               ├── PerceptualHashModule.kt         # aHash + dHash + avg-RGB via BitmapFactory (duplicate finder)
│               └── PerceptualHashPackage.kt        # Registers perceptual-hash module
│
└── src/
    ├── app/
    │   ├── App.tsx                   # Root: QueryClient, GestureHandler, ThemeProvider
    │   ├── theme/
    │   │   ├── colors.ts             # lightColors, darkColors, ColorScheme type
    │   │   ├── ThemeContext.tsx       # useTheme() hook, MMKV-persisted mode
    │   │   ├── typography.ts         # Font sizes, weights, line heights
    │   │   ├── spacing.ts            # Spacing scale (xs/sm/md/lg/xl/xxl)
    │   │   └── index.ts              # Re-exports all theme tokens
    │   └── navigation/
    │       ├── types.ts              # BottomTabParamList, RootStackParamList (+ Duplicates), CompressionOptions, HistoryItem
    │       ├── BottomTabNavigator.tsx # Animated pill indicator (Reanimated)
    │       └── RootNavigator.tsx     # Stack navigator, slide/fade animations
    │
    ├── features/
    │   ├── home/
    │   │   └── HomeScreen.tsx        # Storage card, quick actions, Duplicates/Cleanup/Largest cards, weekly chart→Insights, milestone modal
    │   ├── images/
    │   │   ├── ImagesScreen.tsx      # 3-column grid, multi-select, sort/search/filter (SortFilterSheet)
    │   │   └── ImageCompressionScreen.tsx  # 4 presets, quality slider, format/resize picker
    │   ├── videos/
    │   │   ├── VideosScreen.tsx      # 2-column grid, thumbnail, duration, size
    │   │   └── VideoCompressionScreen.tsx  # Resolution, bitrate, FPS, codec H.264/H.265
    │   ├── compression/
    │   │   ├── CompressionProgressScreen.tsx  # Foreground service, cancel token, pause/resume
    │   │   └── CompressionSuccessScreen.tsx   # Confetti (Reanimated), stats, save modal
    │   ├── duplicates/
    │   │   └── DuplicatesScreen.tsx  # Scan → grouped exact/similar photos, keep-best, batch delete
    │   ├── largefiles/
    │   │   └── LargeFilesScreen.tsx  # Top-20 biggest photos+videos, single-type multi-select, compress shortcut
    │   ├── cleanup/
    │   │   ├── CleanupScreen.tsx     # Album list (getAlbums) — Screenshots/Downloads/WhatsApp etc.
    │   │   └── AlbumDetailScreen.tsx # Album grid, multi-select, bulk delete + compress
    │   ├── insights/
    │   │   └── InsightsScreen.tsx    # Weekly/monthly savings charts + storage forecast
    │   ├── history/
    │   │   └── HistoryScreen.tsx     # MMKV list, filter by type, clear all
    │   └── settings/
    │       └── SettingsScreen.tsx    # Theme picker, default save option, notifications
    │
    └── shared/
        ├── components/
        │   ├── AlertProvider.tsx     # Custom themed alert system — useAlert() hook, replaces RN Alert.alert
        │   ├── AnimatedButton.tsx    # Spring-animated pressable button
        │   ├── Card.tsx              # Elevated surface card
        │   ├── CircularProgress.tsx  # SVG-based circular progress ring
        │   ├── EmptyState.tsx        # Empty list placeholder with icon
        │   ├── BeforeAfterSlider.tsx # Draggable original-vs-compressed preview (generates a real preview)
        │   ├── ErrorBoundary.tsx    # Catches JS render errors, shows message instead of closing the app
        │   ├── HeaderBar.tsx         # Screen header with back/action buttons
        │   ├── Loader.tsx           # Animated SVG gradient spinner (replaces ActivityIndicator app-wide)
        │   ├── MilestoneModal.tsx    # Confetti celebration + share on savings milestones
        │   ├── SortFilterSheet.tsx   # Bottom sheet: sort + size/format/resolution filters (images & videos)
        │   └── StoragePieChart.tsx   # SVG pie/donut chart for storage usage
        ├── services/
        │   ├── CompressionService.ts       # Wraps react-native-compressor, estimateSize, moveToMediaStore
        │   ├── DuplicateService.ts         # Perceptual-hash scan, Hamming clustering, keep-best, deletePhotos
        │   ├── MediaService.ts             # getLargestMedia, getAlbums/getAlbumMedia, media permission helpers
        │   ├── StorageService.ts           # getFSInfo, savings tracking, free-space forecast, milestones, formatBytes
        │   ├── ForegroundServiceBridge.ts  # TS → native ForegroundServiceModule bridge
        │   ├── HistoryService.ts           # MMKV-persisted compression history CRUD
        │   └── SettingsService.ts          # MMKV settings (save option, notifications, theme)
        └── utils/
            └── mediaSortFilter.ts          # Pure sort/filter helpers shared by Images & Videos screens
```

---

## Navigation Structure

```
RootNavigator (Stack)
├── MainTabs (BottomTabNavigator)
│   ├── Home      → HomeScreen
│   ├── Images    → ImagesScreen
│   ├── Videos    → VideosScreen
│   └── Settings  → SettingsScreen
├── ImageCompression    → ImageCompressionScreen   (slide_from_right)
├── VideoCompression    → VideoCompressionScreen   (slide_from_right)
├── CompressionProgress → CompressionProgressScreen (slide_from_bottom)
├── CompressionSuccess  → CompressionSuccessScreen  (fade_from_bottom)
├── History             → HistoryScreen             (slide_from_right)
├── Duplicates          → DuplicatesScreen          (slide_from_right)  # entry: Home "Find Duplicate Photos" card
├── LargeFiles          → LargeFilesScreen          (slide_from_right)  # entry: Home "Largest Files" → See all
├── Insights            → InsightsScreen            (slide_from_right)  # entry: Home "Weekly Savings" → Insights
├── Cleanup             → CleanupScreen             (slide_from_right)  # entry: Home "Clean by Album" card
└── AlbumDetail         → AlbumDetailScreen         (slide_from_right)  # entry: Cleanup → tap an album
```

---

## Foreground Service Architecture

```
JS side                          Native (Kotlin)
──────────────────────────────────────────────────────────
ForegroundServiceBridge.ts  →   ForegroundServiceModule.kt
  startService(n)                 → sends Intent ACTION_START
  updateProgress(...)             → sends Intent ACTION_UPDATE
  stopService()                   → sends Intent ACTION_STOP
                                        ↓
                              CompressionForegroundService.kt
                                - PARTIAL_WAKE_LOCK
                                - Notification channel: spacesaver_compression
                                - foregroundServiceType: dataSync
                                - Pause/Resume/Cancel PendingIntent actions
```

Cancellation: `cancelToken = { cancelled: boolean }` ref passed through `compressBatch()`  
Pause: `pauseRef.current` busy-wait inside the compression loop

---

## Duplicate & Similar-Photo Finder

```
JS side                          Native (Kotlin)
──────────────────────────────────────────────────────────
DuplicateService.ts         →   PerceptualHashModule.kt  (name: "PerceptualHash")
  scan(onProgress)               hashImages(uris) →
    getPhotos() (camera-roll)      BitmapFactory decode (downsampled, inSampleSize→~256px)
    hashImages() in chunks of 40   8x8  grayscale → aHash (16 hex / 64 bits)
    cluster (union-find)           9x8  grayscale → dHash (16 hex / 64 bits)
    pick keeper, compute reclaim   8x8  → avgR/avgG/avgB (mean colour)
    deletePhotos(uris)             returns { uri, aHash, dHash, avgR, avgG, avgB, width, height }
```

- **Grouping:** two images match when `hamming(aHash) + hamming(dHash) <= SIMILAR_THRESHOLD` (12/128)
  **AND** `|Δ avg RGB| <= COLOR_THRESHOLD` (40). The colour gate is essential — perceptual
  hashes are blind to absolute colour, so flat/low-detail images (solid wallpapers, dark shots,
  blank screenshots) would otherwise be wrongly grouped and pre-selected for deletion.
- **Kind:** a group is `exact` only when every member's hash is identical (distance 0); otherwise `similar`.
- **Keep best:** keeper = highest resolution → largest file size → newest; the rest are pre-selected
  for deletion ("keep best, delete rest"), each toggleable in the UI.
- **Deletion:** `CameraRoll.deletePhotos(uris)` → MediaStore; Android 11+ shows the OS
  "Allow app to delete N photos?" confirmation. Scoped-storage safe.
- **Fallback:** if the native module is absent (`isPerceptualHashAvailable === false`), the service
  falls back to exact-duplicate detection via `RNFS.hash(path, 'md5')` (best-effort; skips content:// URIs).
- Tunables live at the top of `DuplicateService.ts`. Native change ⇒ requires a native rebuild.

---

## Largest Files Dashboard

`MediaService.getLargestMedia(limit)` + `features/largefiles/LargeFilesScreen.tsx`.

- MediaStore can't sort by size, so the service pulls a window (1000 photos + 500 videos, `include:
  ['fileSize', ...]`), merges, sorts by `fileSize` desc, and returns the top `limit` (default 20).
- Shared React Query key `['largestMedia', 20]` — Home shows a 4-item preview, the screen shows all 20.
- **Home never prompts:** the preview query is gated by `MediaService.hasMediaPermission()` (`check`,
  no prompt). The full screen calls `ensureMediaPermission()` (`request`) on mount.
- **Compress shortcut:** selection is single-type (tapping a different type resets it) so the FAB can
  route to `ImageCompression` or `VideoCompression` with the selected URIs. Pure JS — no rebuild needed.

---

## Media Lists — Pagination, Loading & Performance

`ImagesScreen` and `VideosScreen` use **`useInfiniteQuery`** for cursor-based pagination:

- `queryFn({pageParam})` calls `CameraRoll.getPhotos({first: PAGE_SIZE, after: pageParam, ...})`
  (images `PAGE_SIZE=60`, videos `40`); permission is requested only on the first page.
- `getNextPageParam` reads `page_info.{has_next_page, end_cursor}`; pages are flattened with
  `data.pages.flatMap(p => p.edges)`.
- `FlatList onEndReached` (threshold 0.6) calls `fetchNextPage`; `ListFooterComponent` shows a small
  `Loader` while `isFetchingNextPage`. Header count shows `N+` when more pages exist.
- Sort/filter (`sortAndFilter`) apply to the already-loaded items; date order is natural for the cursor.

**Performance:** memoized tiles (`React.memo`), lightweight `FadeIn` entering (no per-index stagger),
`removeClippedSubviews`, tuned `initialNumToRender`/`maxToRenderPerBatch`/`windowSize`, and
`getItemLayout` for the fixed-size Images grid.

**⚠️ Every grid `<Image>` MUST set `resizeMethod="resize"`.** Fresco otherwise decodes photos at full
resolution — a 12MP HEIC is ~48MB as a bitmap — so scrolling a grid of real photos exhausts memory
and the OS **kills the app** (looks like a random "photos tab quit after scrolling"). `resizeMethod="resize"`
downsamples to the tile size during decode. Applies to Images/Videos/Album/LargeFiles/Duplicates tiles,
Home's largest-file rows, and the compression preview/slider. Does NOT reproduce on emulators seeded
with small PNGs — only with large/HEIC media, so always test the grid with big photos.

**Loading:** `Loader` (animated SVG gradient arc, `fullscreen` + `label` props) replaces
`ActivityIndicator` across Images, Videos, LargeFiles, Cleanup, AlbumDetail, and Duplicates.

**Error safety:** `ErrorBoundary` wraps `RootNavigator` in `App.tsx` — a JS render error shows a
readable error screen (with message + stack) instead of silently closing the app. (Native crashes,
e.g. the HEIC/Fresco one in build note #8, are not catchable here — those need the gradle fix.)

---

## Custom Alert System

`shared/components/AlertProvider.tsx` replaces all React Native `Alert.alert` usage.

- Mounted once in `App.tsx` **inside `ThemeProvider`** (it is theme-aware); renders a single shared modal.
- API: `const alert = useAlert(); alert({ title, message?, type?, icon?, buttons? })`.
- `type`: `success | error | warning | info | confirm` — drives the icon badge + accent colour.
- `buttons[]`: `{ text, style?: 'default' | 'cancel' | 'destructive', onPress? }`; two short buttons
  render side-by-side, otherwise stacked. Defaults to a single "OK" button.
- Animated (Reanimated ZoomIn card + icon pop). Used across Settings, History, Compression
  progress/success, and the Duplicate finder.

---

## MMKV Keys

| Key | Type | Used In |
|-----|------|---------|
| `theme_mode` | `'light' \| 'dark' \| 'system'` | ThemeContext |
| `compression_history` | `HistoryItem[]` JSON | HistoryService |
| `default_save_option` | `'new' \| 'replace' \| 'ask'` | SettingsService |
| `notifications_enabled` | `boolean` | SettingsService |
| `savings_daily` | `Record<string, number>` JSON | StorageService |
| `defaultImageOptions` | `Partial<CompressionOptions>` JSON | SettingsService (presets memory) |
| `defaultVideoOptions` | `Partial<CompressionOptions>` JSON | SettingsService (presets memory) |
| `freespace_samples` | `Record<date, freeBytes>` JSON (≤30 days) | StorageService (forecast) |
| `celebrated_milestone` | `number` (bytes) | StorageService (milestones) |

---

## Insights, Forecast & Milestones

- **Presets memory:** `ImageCompressionScreen`/`VideoCompressionScreen` hydrate their options from
  `SettingsService.get('defaultImageOptions' | 'defaultVideoOptions')` on mount and persist the chosen
  options on compress — so power users don't re-pick every time.
- **Storage forecast:** `StorageService.getStorageInfo()` records one free-space sample per day
  (`recordFreeSpaceSample`, pruned to 30 days). `getStorageForecast(currentFree)` fits a least-squares
  trend; returns `daysUntilFull` (null until ≥2 days of data or when space is stable/growing).
- **Milestones:** `checkMilestone()` returns a newly-crossed savings threshold (1/5/10/25/50/100 GB)
  once each (guarded by `celebrated_milestone`). Home shows `MilestoneModal` (confetti + share via
  `react-native-share`).
- **Insights screen:** weekly + monthly savings `BarChart`s (gifted-charts) + totals + the forecast card.
- **Before/After slider:** `BeforeAfterSlider` generates a *real* compressed preview of the first
  selected image at the chosen options (debounced via `CompressionService.compressImage`) and shows a
  draggable original-vs-compressed comparison with the actual size delta — a trust builder for lossy edits.
- **Album cleanup:** `MediaService.getAlbums()` + `getAlbumMedia(title)` (camera-roll `groupName`) power
  `CleanupScreen` → `AlbumDetailScreen` for fast bulk delete/compress of Screenshots/Downloads/etc.

---

## Image & Video Operation Modes

| Mode | Quality | Dimensions / Resolution | Target Formats | Purpose |
|------|---------|-------------------------|----------------|---------|
| **Compress & Save Space** | 30% – 90% | 480px – 1920px / 360p – 1080p | JPEG / PNG / WebP / MP4 | Maximum storage savings (quality reduction & resize) |
| **Format Converter** | **100% (Lossless)** | **Original (Unscaled)** | JPEG / PNG / WebP / MP4 / MOV / MKV / WebM | Change file format **without quality reduction** |

## Supported Formats

- **Video Formats:** MP4 (`.mp4`), MOV (`.mov`), MKV (`.mkv`), WebM (`.webm`), 3GP (`.3gp`), AVI (`.avi`)
- **Photo Formats:** JPEG (`.jpg`, `.jpeg`), PNG (`.png`), WebP (`.webp`), HEIC (`.heic`), GIF (`.gif`), BMP (`.bmp`), TIFF (`.tiff`)

---

## Image Compression Presets

| Level | Quality | Max Width | Format | Notes |
|-------|---------|-----------|--------|-------|
| Low | 90% | 1920px | JPEG | Minimal loss |
| Medium | 75% | 1280px | JPEG | Balanced |
| High | 55% | 1080px | WebP | Best compression |
| Custom | 30–100% | Any | JPEG/PNG/WebP | User-controlled |
| Converter | 100% | Original | JPEG/PNG/WebP | Zero quality loss format conversion |

---

## Critical Build Notes

1. **`android/gradlew`** — requires `chmod +x` once after clone
2. **`android/local.properties`** — not in git; must create manually:
   ```
   sdk.dir=/Users/shashankgupta/Library/Android/sdk
   ```
3. **Vector icon fonts** — must be in `android/app/src/main/assets/fonts/`:
   ```bash
   cp node_modules/react-native-vector-icons/Fonts/*.ttf android/app/src/main/assets/fonts/
   ```
4. **AndroidManifest.xml** — MUST have both attributes or build fails:
   ```xml
   xmlns:tools="http://schemas.android.com/tools"
   tools:replace="android:allowBackup"
   ```
   Reason: `react-native-compressor` → `TAndroidLame` sets `allowBackup=true`, conflicts with our `false`.
5. **No stale package folders** — `android/app/src/main/java/com/` must contain ONLY `spacesaver/`
6. **react-native-compressor 2.x** requires `react-native-nitro-modules` peer dep
7. **Native modules need a full rebuild** — `PerceptualHashModule`/`Package` are Kotlin. After
   changing native code, JS-only Metro reload is NOT enough; run `npx react-native run-android`
   (or `./android/gradlew :app:assembleDebug`) so the new module is bundled into the APK.
8. **`androidx.exifinterface:exifinterface` is REQUIRED** in `android/app/build.gradle` dependencies.
   Fresco's `HeifExifUtil.getOrientation` needs it to read HEIF/HEIC EXIF orientation. Without it,
   rendering ANY HEIC thumbnail (default capture format on OPPO/OnePlus/Samsung/etc.) throws
   `NoClassDefFoundError: androidx/exifinterface/media/ExifInterface` on a Fresco thread and
   **hard-crashes the app** — most visibly the moment the Images tab loads real photos. This does
   NOT reproduce on emulators seeded with PNG/JPEG; only with actual HEIC media.
9. **`@types/jest` must be installed** (devDependency). The extended base config
   (`@react-native/typescript-config`) sets `types: ["react-native", "jest"]`. If `@types/jest` is
   missing, `tsc` aborts with a single `TS2688: Cannot find type definition file for 'jest'` and
   **reports no other errors** — silently masking the entire codebase's type errors. Metro/gradle are
   unaffected (Babel strips types), so the app still runs, but editors/CI `tsc` are misleading.
   The project is currently **type-clean** (`npx tsc --noEmit` → 0 errors); keep it that way.

---

## Type Conventions

- **Theme colors:** `ColorScheme` (in `theme/colors.ts`) is a mapped type over `typeof lightColors`
  that widens each value to `string`, except gradient keys (`gradient*`) which stay `[string, string]`.
  `createTheme` casts `colors` to `ColorScheme` so `theme.colors` is one stable type (no light/dark
  union). When adding a colour, add it to BOTH `lightColors` and `darkColors`; use existing keys
  (e.g. `onPrimary` for white-on-accent text) rather than a non-existent `white`.
- **`Card` / style props:** `Card.style` is `StyleProp<ViewStyle>`, so `style={[a, b]}` arrays and
  `theme.elevation.*` are accepted. Prefer `StyleProp<ViewStyle>` over bare `ViewStyle` for any
  component style prop that might receive an array.

---

## Save / Replace Behavior (compression output)

- Compressed files are written to the app cache during compression, then persisted to the shared
  gallery via `CameraRoll.saveAsset(..., { album: 'SpaceSaver' })` (MediaStore) so they appear in the
  gallery **globally**, not just in an app-private folder. The temp cache copy is removed after.
- **Replace** additionally deletes the original through MediaStore (`CameraRoll.deletePhotos`), which
  triggers the Android system delete confirmation on Android 11+. `default_save_option` (`new` /
  `replace` / `ask`) controls whether the save-options modal is shown.

---

## Running the App

```bash
# Terminal 1 — Metro bundler
npx react-native start

# Terminal 2 — Build + install
npx react-native run-android

# Re-launch if app goes to background
adb shell am start -n com.spacesaver/.MainActivity

# View logs
adb logcat -s ReactNativeJS

# List connected devices/emulators
adb devices
```

## APK

```
android/app/build/outputs/apk/debug/app-debug.apk    (~113MB debug — 2 ABIs)
android/app/build/outputs/apk/release/app-release.apk (~44MB — R8 + resource shrink + Hermes bytecode)
```

---

## Build Performance & Size

Configured for fast, small builds (see `android/gradle.properties` + `app/build.gradle`):

| Setting | Value | Effect |
|---------|-------|--------|
| `reactNativeArchitectures` | `arm64-v8a,x86_64` | 2 ABIs, not 4 → ~½ build time & APK size (206→113 MB) |
| `org.gradle.jvmargs` | `-Xmx4096m` | no GC thrash on the RN native compile |
| `org.gradle.parallel` / `daemon` | `true` | parallel modules + warm daemon |
| `org.gradle.caching` | **off** | build cache poisons RN's composite gradle-plugin → `compileKotlin` "Unresolved reference" failures |
| release `minifyEnabled` + `shrinkResources` | `true` | small production APK (R8 + unused-resource strip) |

**Key insight:** the slow (~10–20 min) builds are **clean** builds recompiling all native code
(Hermes, reanimated, svg, …). **Incremental** builds are ~20s. So for day-to-day work:

```bash
# First time / after native (Kotlin/gradle/dependency) changes only:
npx react-native run-android          # full build + install

# JS/TS-only changes (the common case): DON'T rebuild — just reload Metro.
#   press R twice in the Metro terminal, or shake → Reload.

# If gradle's installDebug flakes on a busy/edgy device (ddmlib timeout),
# install the already-built APK directly — more reliable:
adb install -r -g android/app/build/outputs/apk/debug/app-debug.apk

# Fastest possible dev build — target ONE ABI (arm64 phone OR x86_64 emulator):
./android/gradlew -p android :app:assembleDebug -PreactNativeArchitectures=arm64-v8a

# Never `gradlew clean` unless a native change isn't picking up — it forces the
# slow full recompile that caused the 20-min builds.

# Small shippable APK:
./android/gradlew -p android :app:assembleRelease   # test it — R8 can need extra proguard rules
```

---

## Permissions (Runtime)

| Permission | API Level | Purpose |
|-----------|-----------|---------|
| READ_MEDIA_IMAGES | 33+ | Access images |
| READ_MEDIA_VIDEO | 33+ | Access videos |
| READ_EXTERNAL_STORAGE | ≤32 | Legacy storage access |
| WRITE_EXTERNAL_STORAGE | ≤29 | Legacy storage write |
| POST_NOTIFICATIONS | 33+ | Compression progress notification |
| FOREGROUND_SERVICE | All | Background compression |
| WAKE_LOCK | All | Keep CPU awake during compression |


Screenshots & WhatsApp/Downloads cleanup — filter media by folder/album (CameraRoll.getAlbums) so users can nuke screenshots or memes fast.
Batch compression presets memory — remember last-used quality/format per media type (MMKV) so power users don't re-pick every time.
Before/After preview slider — on the compression screen, show a draggable comparison of original vs. estimated result. Big trust builder for a "lossy" app.
📊 Insights & engagement
"Space saved" milestones + share card — celebrate 1 GB / 5 GB saved with a shareable image (you already have react-native-share + confetti).
Monthly/weekly report — you already track savings_daily/weekly/monthly; surface a proper trends screen with the gifted-charts you have.
Storage forecast — "At this rate your storage fills in ~23 days" using free-space trend.
⚙️ Automation (retention drivers)
Auto-compress rules — background job (you already have a Foreground Service) to auto-compress new photos over X MB, or on charging + Wi-Fi.
Scheduled cleanups — weekly reminder/notification to review large files (you have POST_NOTIFICATIONS).
🛡️ Safety & trust (critical for a delete/replace app)
Recycle bin / undo — move "replaced" originals to an app trash for 30 days instead of hard-delete. Protects against the exact data-loss risk in your replace flow.
Original backup before replace — optional safety copy.
Compression audit log — you have History; add restore-from-history where possible.
🎬 Media capabilities
Video trimming + audio strip — often saves more than re-encoding.
HEIC/HEIF conversion, PDF/image → smaller PDF, GIF optimization.
Bulk format conversion (PNG→WebP) as a standalone tool.
🧭 UX polish
Full-screen image/video preview (tap to zoom — you currently only toggle selection).
Long-press to multi-select + drag-select.
Grid density toggle (2/3/4 columns).