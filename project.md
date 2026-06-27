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
│               ├── MainApplication.kt              # Registers ForegroundServicePackage
│               ├── CompressionForegroundService.kt # Foreground service (Kotlin)
│               ├── ForegroundServiceModule.kt      # Native module bridge to JS
│               └── ForegroundServicePackage.kt     # Registers native module
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
    │       ├── types.ts              # BottomTabParamList, RootStackParamList, CompressionOptions, HistoryItem
    │       ├── BottomTabNavigator.tsx # Animated pill indicator (Reanimated)
    │       └── RootNavigator.tsx     # Stack navigator, slide/fade animations
    │
    ├── features/
    │   ├── home/
    │   │   └── HomeScreen.tsx        # Storage card, quick actions, weekly bar chart
    │   ├── images/
    │   │   ├── ImagesScreen.tsx      # 3-column grid, multi-select, sort/search/filter
    │   │   └── ImageCompressionScreen.tsx  # 4 presets, quality slider, format/resize picker
    │   ├── videos/
    │   │   ├── VideosScreen.tsx      # 2-column grid, thumbnail, duration, size
    │   │   └── VideoCompressionScreen.tsx  # Resolution, bitrate, FPS, codec H.264/H.265
    │   ├── compression/
    │   │   ├── CompressionProgressScreen.tsx  # Foreground service, cancel token, pause/resume
    │   │   └── CompressionSuccessScreen.tsx   # Confetti (Reanimated), stats, save modal
    │   ├── history/
    │   │   └── HistoryScreen.tsx     # MMKV list, filter by type, clear all
    │   └── settings/
    │       └── SettingsScreen.tsx    # Theme picker, default save option, notifications
    │
    └── shared/
        ├── components/
        │   ├── AnimatedButton.tsx    # Spring-animated pressable button
        │   ├── Card.tsx              # Elevated surface card
        │   ├── CircularProgress.tsx  # SVG-based circular progress ring
        │   ├── EmptyState.tsx        # Empty list placeholder with icon
        │   ├── HeaderBar.tsx         # Screen header with back/action buttons
        │   └── StoragePieChart.tsx   # SVG pie/donut chart for storage usage
        └── services/
            ├── CompressionService.ts       # Wraps react-native-compressor, estimateSize, moveToMediaStore
            ├── StorageService.ts           # getFSInfo, weekly/monthly savings tracking, formatBytes
            ├── ForegroundServiceBridge.ts  # TS → native ForegroundServiceModule bridge
            ├── HistoryService.ts           # MMKV-persisted compression history CRUD
            └── SettingsService.ts          # MMKV settings (save option, notifications, theme)
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
└── History             → HistoryScreen             (slide_from_right)
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

## MMKV Keys

| Key | Type | Used In |
|-----|------|---------|
| `theme_mode` | `'light' \| 'dark' \| 'system'` | ThemeContext |
| `compression_history` | `HistoryItem[]` JSON | HistoryService |
| `default_save_option` | `'new_copy' \| 'replace' \| 'ask'` | SettingsService |
| `notifications_enabled` | `boolean` | SettingsService |
| `savings_daily` | `Record<string, number>` JSON | StorageService |

---

## Image Compression Presets

| Level | Quality | Max Width | Format | Notes |
|-------|---------|-----------|--------|-------|
| Low | 90% | 1920px | JPEG | Minimal loss |
| Medium | 75% | 1280px | JPEG | Balanced |
| High | 55% | 1080px | WebP | Best compression |
| Custom | 30–100% | Any | JPEG/PNG/WebP | User-controlled |

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
android/app/build/outputs/apk/debug/app-debug.apk  (~194MB debug)
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
