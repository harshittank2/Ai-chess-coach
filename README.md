# Chess Coach AI ♟️

A mobile-first chess trainer built with **Expo, React Native, and chess.js**. Play against configurable opponents, practise openings, review imported games with Stockfish, or play a friend offline on the same device.

> **Status:** Active development · Android APK builds are produced with GitHub Actions.

## Features

### ♟️ Play
- Play against computer difficulty profiles, from beginner-friendly **Martin** to a high-strength **Magnus-style** preset.
- Bot Elo values are target difficulty estimates, not official ratings or claims to reproduce real players.
- **Pass & Play:** two people can play locally on one phone without an internet connection.
- Timed games with **1, 3, 5, 10, 15 and 30 minute** presets, plus a custom time control.
- Separate White and Black clocks, turn-based countdown, and timeout result.
- Optional fullscreen board view with player clocks and a compact playing layout.
- Legal move validation, check/checkmate and draw-state handling, undo and restart controls.

### 📚 Learn
- Opening lessons with move-by-move guidance and explanations.
- Includes the Italian Game, Ruy Lopez, Scotch Game, Queen's Gambit, King's Gambit, Evans Gambit, Danish Gambit, Smith–Morra Gambit, Sicilian Defence, French Defence, Caro–Kann Defence and London System.
- Explore opening ideas and common plans rather than memorising moves only.

### 🔎 Review
- Import a Chess.com game using a **PGN file** or pasted PGN text.
- Analyse positions and moves with Stockfish.
- Review move quality labels such as Best, Excellent, Good, Inaccuracy, Mistake and Blunder.
- Compare move-quality totals for White and Black and inspect evaluation loss and engine suggestions.
- Engine-based labels are estimates that depend on engine depth and settings; they are not Chess.com's proprietary accuracy formula.

### 🧠 Stockfish engine
- Local Stockfish engine support for on-device analysis.
- Online Stockfish analysis as a fallback / selectable mode where available.
- Local analysis works without an internet connection once the app and engine are installed.
- Deeper analysis can use more CPU, battery and time.

### 📱 Android builds
- GitHub Actions workflow builds a release APK.
- Push to main or manually run the workflow from the Actions tab.
- Download the Chess-Coach-AI-APK artifact from a successful workflow run.

## Tech stack
- Expo SDK 53
- React Native 0.79
- React 19
- JavaScript
- chess.js for chess rules and move validation
- dawikk-stockfish for the bundled native Stockfish engine
- AsyncStorage for local app persistence
- Expo Document Picker / File System for PGN import
- GitHub Actions for Android APK builds

## Run locally
You need Node.js 20 or newer and the Android / Expo development tools appropriate for your environment.

```bash
git clone https://github.com/harshittank2/Ai-chess-coach.git
cd Ai-chess-coach
npm install
npx expo start
```

For a native Android development build, generate the Android project and build it with the Android SDK / Gradle toolchain. The repository's GitHub Actions workflow is the easiest way to produce the installable release APK.

## Build an APK with GitHub Actions
1. Open the repository's Actions tab.
2. Select Build Chess Coach AI APK.
3. Choose Run workflow, or push a commit to main.
4. Wait for the workflow to complete successfully.
5. Open the run and download the Chess-Coach-AI-APK artifact.

## Project notes
- This is an independent chess-training project and is **not affiliated with Chess.com**.
- The Magnus-style and Martin profiles are app difficulty presets; they are not official bots or endorsements by those players.
- Stockfish is free software licensed under **GPL-3.0**. The bundled engine dependency has its own corresponding source and licence obligations. Anyone redistributing builds should review the upstream Stockfish licence and source-distribution requirements.
- This project is under active development. Features, engine availability and UI may change between builds.

## Feedback
Found a bug or have a feature idea? Open an issue in this repository with:
- Your device model and Android version
- App version / APK build number
- Steps to reproduce the issue
- Screenshots or logs, with personal information removed

---

Made with ♟️ and a lot of iteration.