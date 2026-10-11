This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

---
# Kisan Sethu frontend rules (project-specific, take precedence)

Read ../docs/ARCHITECTURE.md first. One Expo project (expo-router, SDK 57) for Android, iOS and web.
Source lives in `src/` (`@/*` maps to `./src/*`). Do not upgrade the Expo SDK unless asked.

## Boundaries (strict)
- All network calls go through `src/lib/api.ts`. Screens and components never call fetch directly.
- The client has no LLM, no prompts, no API keys. `EXPO_PUBLIC_*` is public; never put secrets there.
- Never compute or invent prices, gaps or trends. Render only the API response `numbers`, `card`,
  `provenance` and `freshness`. Always show provenance and "last updated".
- Every user-facing string comes from `src/i18n/*.json`. No hard-coded text. Language names in own script.
- Every card has a speaker button. Never rely on colour alone (icon plus colour for up/down).
- Minimum 48dp tap targets, high contrast.
- Offline: persist the last response per crop in `src/lib/storage.ts`; show a stale banner on failure.
- Platform differences go in `.web.tsx` / `.native.tsx` files, not scattered `Platform.OS` checks.
- Input limits before upload: image <= 5 MB, audio <= 30 s.

## Workflow
- Install with `npx expo install <pkg>` for Expo packages, `npm install` otherwise.
- Before finishing: `npx tsc --noEmit && npx expo lint && npx expo-doctor`.
- Test on web and on a low-end Android device before calling a feature done.
