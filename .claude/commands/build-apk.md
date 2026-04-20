---
description: Build and distribute the Ranger Android APK via EAS
---

Guide the user through building a standalone APK for the Ranger app.

## Pre-flight checks
1. Confirm `.env` has the desired `EXPO_PUBLIC_GOOGLE_API_KEY` and `EXPO_PUBLIC_GEMINI_MODEL` set
   - These are baked into the APK at build time
   - If you want to override them on-device, leave them blank in `.env` and use the Settings tab (SecureStore override)
2. Run `npx tsc --noEmit` — must be clean before building
3. Confirm `eas.json` has a `preview` profile with `buildType: "apk"`

## Build steps
```bash
conda activate ranger
cd "e:/Personal Projects/ranger"

# First time only — install EAS CLI and authenticate
npm install -g eas-cli
eas login           # creates/uses Expo account (free)
eas build:configure # links project to EAS (generates projectId in app.json)

# Build the APK (cloud build, ~5–10 min, free tier)
eas build --platform android --profile preview
```

## After build
- EAS will print a download URL when done
- Download the `.apk` file
- On your Android phone: Settings → Security → allow "Install unknown apps" for your browser
- Open the downloaded APK → Install
- On first launch, Ranger setup screen appears

## Notes
- The free EAS tier allows 30 builds/month
- APK bundles the `.env` values at build time — rebuild if keys change
- For a production AAB (Play Store): use `--profile production`
- If you don't have `.env` keys set, the setup screen will prompt for them when the app launches

## Rebuilding After Changes
- **API key changes**: either update `.env` and rebuild, OR use Settings tab to override in SecureStore
- **Code changes** (`lib/agent.ts`, `app/(tabs)/log.tsx`, etc.): rebuild
- **Tool changes** (`constants/tools.ts`): rebuild
- **Notion changes** (schema updates): NO rebuild needed — changes live in Notion
