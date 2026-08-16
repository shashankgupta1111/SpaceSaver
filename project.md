# SpaceSaver — Project Reference & Architecture Specification

> Android-only storage optimizer. Fully offline — no login, no cloud, no backend, no ads, no watermarks.  
> Compresses images and videos with background Foreground Service support (`mediaProcessing`), high-fidelity format conversion, perceptual hash duplicate detection, and high-performance native video thumbnail rendering.

---

## Tech Stack

| Layer | Library | Version | Notes |
|-------|---------|---------|-------|
| Framework | react-native | 0.79.7 | New Architecture enabled |
| Language | TypeScript | 5.0.4 | Strict type checking clean (`tsc --noEmit`) |
| React | react | 19.0.0 | Concurrent React |
| Navigation | @react-navigation/native + bottom-tabs + native-stack | ^6.x | Animated pill tabs + slide/fade transitions |
| Animations | react-native-reanimated | ^3.19.0 | Reanimated 3 UI animations |
| Gestures | react-native-gesture-handler | ^2.20.2 | Native gesture handling |
| Storage | react-native-mmkv | ^3.1.0 | High-performance key-value persistence |
| Data cache | @tanstack/react-query | ^5.59.15 | Infinite query caching for media grids |
| Compression | react-native-compressor | ^2.0.2 | Native image/video compression |
| Peer dependency | react-native-nitro-modules | ^0.35.10 | Nitro modules peer dep for compressor |
| Patch Manager | patch-package | ^8.0.0 | Applies `patches/react-native-compressor+2.0.2.patch` |
| File system | react-native-fs | ^2.20.0 | Temp cache file management |
| Media library | @react-native-camera-roll/camera-roll | ^7.8.0 | MediaStore asset queries & deletion |
| Permissions | react-native-permissions | ^4.1.5 | Android 13+ granular permission checks |
| List perf | @shopify/flash-list | ^1.7.1 | Optimized virtualization |
| Charts | react-native-gifted-charts | ^1.4.31 | Savings trends visualizations |
| Gradients | react-native-linear-gradient | ^2.8.3 | Smooth UI gradient surfaces |
| SVG | react-native-svg | ^15.8.0 | Vector charts, spinners & circular progress |
| Icons | react-native-vector-icons | ^10.2.0 | MaterialCommunityIcons font set |
| Slider | @react-native-community/slider | ^4.5.5 | Compression quality & before/after preview |
| Haptics | react-native-haptic-feedback | ^2.2.0 | Tactile user feedback |
| Share | react-native-share | ^11.0.0 | Milestone achievement sharing |
| State | zustand | ^5.0.1 | Global client state |
| Date utils | date-fns | ^4.1.0 | Date formatting for history & forecasts |

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
| Foreground Service Type | `mediaProcessing` (Android 14+ / API 34+) with `dataSync` fallback (API 29-33) |
| Package / applicationId | com.spacesaver |
| SDK path | `/Users/shashankgupta/Library/Android/sdk` |

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
├── patches/                          # Patches for node_modules
│   └── react-native-compressor+2.0.2.patch
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
│               ├── MainApplication.kt              # Registers ForegroundServicePackage + PerceptualHashPackage + VideoThumbnailPackage
│               ├── CompressionForegroundService.kt # Foreground service (Kotlin) using mediaProcessing
│               ├── ForegroundServiceModule.kt      # Native module bridge to JS
│               ├── ForegroundServicePackage.kt     # Registers foreground-service module
│               ├── PerceptualHashModule.kt         # aHash + dHash + avg-RGB via BitmapFactory (duplicate finder)
│               ├── PerceptualHashPackage.kt        # Registers perceptual-hash module
│               ├── VideoThumbnailModule.kt         # Native video thumbnail extraction (MediaMetadataRetriever + multi-strategy caching)
│               └── VideoThumbnailPackage.kt        # Registers video-thumbnail module
│
└── src/
    ├── app/
    │   ├── App.tsx                   # Root: QueryClient, GestureHandler, ThemeProvider, ErrorBoundary, AlertProvider
    │   ├── theme/
    │   │   ├── colors.ts             # lightColors, darkColors, ColorScheme type
    │   │   ├── ThemeContext.tsx       # useTheme() hook, MMKV-persisted mode
    │   │   ├── typography.ts         # Font sizes, weights, line heights
    │   │   ├── spacing.ts            # Spacing scale (xs/sm/md/lg/xl/xxl)
    │   │   └── index.ts              # Re-exports all theme tokens
    │   └── navigation/
    │       ├── types.ts              # BottomTabParamList, RootStackParamList (+ FormatConverter), CompressionOptions, HistoryItem
    │       ├── BottomTabNavigator.tsx # Animated pill indicator (Reanimated)
    │       └── RootNavigator.tsx     # Stack navigator, slide/fade animations
    │
    ├── features/
    │   ├── home/
    │   │   └── HomeScreen.tsx        # Storage card, quick actions, Duplicates/Cleanup/Largest cards, weekly chart→Insights, milestone modal
    │   ├── images/
    │   │   ├── ImagesScreen.tsx      # 3-column grid, multi-select, sort/search/filter (SortFilterSheet), full preview
    │   │   └── ImageCompressionScreen.tsx  # 4 presets, quality slider, format/resize picker
    │   ├── videos/
    │   │   ├── VideosScreen.tsx      # 2-column grid, native thumbnail, duration, size, preview player
    │   │   └── VideoCompressionScreen.tsx  # Resolution, bitrate, FPS, codec H.264/H.265
    │   ├── converter/
    │   │   └── FormatConverterScreen.tsx   # High-fidelity format converter (JPEG/PNG/WebP/HEIC & MP4/MOV/MKV/WebM)
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
        │   ├── MediaPreviewModal.tsx # Interactive full-screen image zoom & video playback modal
        │   ├── MilestoneModal.tsx    # Confetti celebration + share on savings milestones
        │   ├── SortFilterSheet.tsx   # Bottom sheet: sort + size/format/resolution filters (images & videos)
        │   ├── StoragePieChart.tsx   # SVG pie/donut chart for storage usage
        │   └── VideoThumbnail.tsx    # High-performance native video frame thumbnail component
        ├── services/
        │   ├── CompressionService.ts       # Wraps react-native-compressor, estimateSize, moveToMediaStore
        │   ├── DuplicateService.ts         # Perceptual-hash scan, Hamming clustering, keep-best, deletePhotos
        │   ├── MediaService.ts             # getLargestMedia, getAlbums/getAlbumMedia, media permission helpers
        │   ├── PermissionService.ts        # Unified runtime permission handling (Android 13+ granular permissions)
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
├── ImageCompression    → ImageCompressionScreen   (slide_from_bottom)
├── VideoCompression    → VideoCompressionScreen   (slide_from_bottom)
├── CompressionProgress → CompressionProgressScreen (fade_from_bottom)
├── CompressionSuccess  → CompressionSuccessScreen  (fade)
├── History             → HistoryScreen             (slide_from_right)
├── Duplicates          → DuplicatesScreen          (slide_from_right)  # entry: Home "Find Duplicate Photos" card
├── LargeFiles          → LargeFilesScreen          (slide_from_right)  # entry: Home "Largest Files" → See all
├── Insights            → InsightsScreen            (slide_from_right)  # entry: Home "Weekly Savings" → Insights
├── Cleanup             → CleanupScreen             (slide_from_right)  # entry: Home "Clean by Album" card
├── AlbumDetail         → AlbumDetailScreen         (slide_from_right)  # entry: Cleanup → tap an album
└── FormatConverter     → FormatConverterScreen     (slide_from_right)  # entry: Home/Images/Videos → Format Converter
```

---

## Foreground Service Architecture (Android 14+ / 15+)

```
JS side                          Native (Kotlin)
──────────────────────────────────────────────────────────
ForegroundServiceBridge.ts  →   ForegroundServiceModule.kt
  startService(n)                 → sends Intent ACTION_START
  updateProgress(...)             → sends Intent ACTION_UPDATE
  stopService()                   → sends Intent ACTION_STOP
                                        ↓
                              CompressionForegroundService.kt
                                - FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING (API 34+)
                                - FOREGROUND_SERVICE_TYPE_DATA_SYNC (API 29-33 fallback)
                                - onTimeout(startId, fgsType) override (Android 15 / API 35+)
                                - PARTIAL_WAKE_LOCK (1 hour max)
                                - Notification channel: spacesaver_compression
                                - Pause/Resume/Cancel PendingIntent actions
```

- **Manifest Permissions:** Requires `<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>` and `<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROCESSING"/>`.
- **Android 15 Lifecycle:** `onTimeout()` automatically calls `stopSelf()` to cleanly teardown service execution if system limits are exceeded.
- **Cancellation & Teardown:** Guaranteed cleanup via `cancelToken = { cancelled: boolean }` ref passed through `compressBatch()`, error blocks, and component unmount lifecycle.

---

## Supported Formats Matrix

| Format Category | Photo Formats | Video Formats | Notes |
|-----------------|---------------|---------------|-------|
| **Input Formats** | JPEG (`.jpg`, `.jpeg`), PNG (`.png`), WebP (`.webp`), HEIC (`.heic`), GIF (`.gif`), BMP (`.bmp`), TIFF (`.tiff`) | MP4 (`.mp4`), MOV (`.mov`), MKV (`.mkv`), WebM (`.webm`), 3GP (`.3gp`), AVI (`.avi`) | Processable via MediaStore and CameraRoll |
| **Compression Formats** | JPEG, PNG, WebP | MP4 (H.264 / H.265 codecs) | Supported output formats in `CompressionService` |
| **Converter Output Formats** | JPEG, PNG, WebP, HEIC | MP4, MOV, MKV, WebM | High-fidelity container remuxing or encoding |
| **Preview-Supported Formats** | JPEG, PNG, WebP, HEIC | MP4, MOV, WebM, MKV | Rendered via Fresco + `androidx.exifinterface` / React Native Video |

---

## Known Limitations

1. **Android Only:** SpaceSaver targets Android OS exclusively (Android 7.0+ / API 24+). Any iOS abstractions in `PermissionService` are inactive stubs.
2. **Offline-First:** No user registration, backend servers, cloud synchronization, advertisements, or tracking telemetry exist.
3. **Scoped Storage Deletion Prompts:** On Android 11+ (API 30+), deleting original files during `replace` mode or duplicate cleanup requires system confirmation via MediaStore OS dialogs.
4. **Native Code Rebuilding:** Kotlin native modules (`PerceptualHashModule`, `ForegroundServiceModule`, `VideoThumbnailModule`) require a full native rebuild (`npx react-native run-android` or `./android/gradlew :app:assembleDebug`) after modification.
5. **Transcoding vs Lossless Conversion:** Format conversions requiring container or codec changes (e.g., HEIC -> JPEG or MKV -> MP4) perform high-fidelity transcoding at maximum bitrate rather than bit-for-bit lossless copying.
6. **Perceptual Hash Boundaries:** Duplicate detection compares visual similarity via color-gated perceptual hashes (`aHash` + `dHash` + `avgRGB`), not semantic object understanding.
7. **Storage Forecast Threshold:** Historical free-space sampling requires at least 2 distinct days of data (`freespace_samples` key in MMKV) before producing trend predictions.

---

## Do Not Break (Rules for Future Developers & Agents)

1. **Do Not Add Backend/Cloud:** SpaceSaver must remain 100% offline. Do not introduce remote authentication, cloud sync, or server APIs.
2. **Do Not Add Ads or Telemetry:** Keep the app free of advertisements, tracking scripts, and analytics SDKs.
3. **Preserve Local Persistence:** MMKV must remain the sole key-value storage engine; React Query handles media list caching.
4. **Preserve Native Modules:**
   - Do NOT replace `VideoThumbnailModule.kt` with JavaScript frame extraction.
   - Do NOT replace `PerceptualHashModule.kt` with JS image processing.
   - Do NOT replace `CompressionForegroundService.kt` with headless JS timers.
5. **Enforce Grid Image Downsampling:** Every media grid `<Image>` MUST retain `resizeMethod="resize"` to prevent Fresco bitmap memory exhaustion and app crashes when rendering full-resolution photos.
6. **Maintain Foreground Service Type:** Maintain `foregroundServiceType="mediaProcessing"` on Android 14+ with `onTimeout()` handling.
7. **Maintain Type Cleanliness:** Ensure `npx tsc --noEmit` returns 0 type errors before finalizing changes.
8. **Avoid Unnecessary Gradle Cleans:** Avoid `./android/gradlew clean` unless native bindings are corrupted; clean builds force full 10+ minute native recompilations.
9. **Preserve Theme Support:** All new components must consume `useTheme()` tokens for Light, Dark, and System theme modes.
10. **Preserve Navigation Contracts:** Do not remove existing stack or tab navigation routes defined in `RootNavigator.tsx` and `types.ts`.

---

## Android Compatibility Matrix

| API Level | Android Version | Permission Requirements | Service & Storage Behavior |
|-----------|-----------------|-------------------------|----------------------------|
| **API 24–28** | Android 7.0 – 9.0 | `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | Legacy direct file system access & basic service startup |
| **API 29** | Android 10.0 | `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` (maxSdkVersion 29) | Initial Scoped Storage introduce; `dataSync` service type |
| **API 30–32** | Android 11.0 – 12L | `READ_EXTERNAL_STORAGE` (maxSdkVersion 32) | Scoped Storage strict enforcement (`deletePhotos` requires OS prompt) |
| **API 33** | Android 13.0 | `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `POST_NOTIFICATIONS` | Granular media permission prompts & notification permission gate |
| **API 34** | Android 14.0 | `FOREGROUND_SERVICE_MEDIA_PROCESSING` | Mandatory `mediaProcessing` foreground service type declaration |
| **API 35+** | Android 15.0+ | `FOREGROUND_SERVICE_MEDIA_PROCESSING` | Strict FGS runtime limits enforced via `onTimeout()` callback |

---

## Practical Testing Matrix

```
┌───────────────────────────────┬────────────────────────────────────────────────────────────┐
│ Test Area                     │ Verification Steps                                         │
├───────────────────────────────┼────────────────────────────────────────────────────────────┤
│ Media Grids & Decoding        │ 1. Scroll 500+ items in Images & Videos tabs.              │
│                               │ 2. Verify HEIC photos load without Fresco crash.           │
│                               │ 3. Confirm resizeMethod="resize" downsamples tiles.        │
├───────────────────────────────┼────────────────────────────────────────────────────────────┤
│ Compression Operations        │ 1. Compress 10+ large photos & 3+ long MP4/MOV videos.     │
│                               │ 2. Verify progress notification updates percentage.        │
│                               │ 3. Test Pause, Resume, and Cancel buttons in service.      │
│                               │ 4. Background the app during active compression.           │
├───────────────────────────────┼────────────────────────────────────────────────────────────┤
│ Format Converter              │ 1. Convert JPEG -> WebP/PNG/HEIC.                          │
│                               │ 2. Convert MP4 -> MOV/MKV/WebM.                            │
│                               │ 3. Confirm target resolution & high bitrate preserved.     │
├───────────────────────────────┼────────────────────────────────────────────────────────────┤
│ Duplicate & Similar Finder    │ 1. Run full media scan.                                    │
│                               │ 2. Verify exact duplicates group with 100% hash match.     │
│                               │ 3. Verify similar photos pass RGB color-distance filter.   │
│                               │ 4. Test "Keep Best, Delete Rest" selection.                │
├───────────────────────────────┼────────────────────────────────────────────────────────────┤
│ Permissions & Storage         │ 1. Grant/deny permissions on Android 12, 13, 14, 15.      │
│                               │ 2. Verify save as "New File" saves to 'SpaceSaver' album.  │
│                               │ 3. Verify "Replace Original" prompts OS delete dialog.     │
├───────────────────────────────┼────────────────────────────────────────────────────────────┤
│ UI & Theme Integrity          │ 1. Toggle Light, Dark, and System theme modes.             │
│                               │ 2. Verify AlertProvider modal dialogs render properly.     │
│                               │ 3. Run `npx tsc --noEmit` (Must return 0 errors).          │
└───────────────────────────────┴────────────────────────────────────────────────────────────┘
```

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
5. **Native modules need a full rebuild** — `PerceptualHashModule`, `ForegroundServiceModule`, and `VideoThumbnailModule` are Kotlin. Run `npx react-native run-android` or `./android/gradlew :app:assembleDebug`.
6. **`androidx.exifinterface:exifinterface` is REQUIRED** in `android/app/build.gradle` dependencies to prevent HEIC/HEIF orientation crashes.
7. **Type-Safety Cleanliness:** Run `npx tsc --noEmit` before committing changes.