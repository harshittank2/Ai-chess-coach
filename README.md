# Royal Gambit ♛

<p align="center"><img src="assets/royal-gambit-icon.png" width="220" alt="Royal Gambit king logo"></p>

A mobile-first chess training app built with **Expo, React Native, and chess.js**. Play against configurable opponents, practise openings, review PGN games with Stockfish, or play a friend offline on the same device.

> **Status:** Active development · Android APK builds are produced with GitHub Actions.

## Features

### ♟ Play
- Play against computer difficulty profiles, from beginner-friendly **Martin** to a high-strength **Magnus-style** preset.
- Bot Elo values are target difficulty estimates, not official ratings or claims to reproduce real players.
- **Pass & Play:** two people can play locally on one phone without an internet connection.
- Timed games with 1, 3, 5, 10, 15 and 30 minute presets, plus a custom time control.
- Fullscreen board view with player clocks.
- Legal move validation, check/checkmate and draw-state handling, undo and restart controls.

### 📚 Learn
- Move-by-move opening lessons and explanations.
- Includes the Italian Game, Ruy Lopez, Scotch Game, Queen's Gambit, King's Gambit, Evans Gambit, Danish Gambit, Smith–Morra Gambit, Sicilian Defence, French Defence, Caro–Kann Defence and London System.

### 🔎 Review
- Import a Chess.com game using a PGN file or pasted PGN text.
- Analyse positions and moves with Stockfish.
- Review move-quality labels and compare White and Black move-quality totals.

### ♜ Stockfish
- Local Stockfish engine support for on-device analysis.
- Online Stockfish analysis as a fallback / selectable mode where available.
- Deeper analysis can use more CPU, battery and time.

## Android APK builds
- GitHub Actions builds a release APK on pushes to main and can be run manually from the Actions tab.
- Download the **Royal-Gambit-APK** artifact from a successful workflow run.

## Tech stack
- Expo SDK 53, React Native 0.79, React 19 and JavaScript
- chess.js for chess rules and move validation
- dawikk-stockfish for the bundled native Stockfish engine
- AsyncStorage for local app persistence
- Expo Document Picker / File System for PGN import
- GitHub Actions for Android APK builds

## Run locally
You need Node.js 20 or newer and the Android / Expo development tools appropriate for your environment.

Clone https://github.com/harshittank2/Ai-chess-coach, run npm install, then npx expo start.

For a native Android development build, generate the Android project and build it with the Android SDK / Gradle toolchain. The repository's GitHub Actions workflow is the easiest way to produce an installable release APK.

## Project notes
- This is an independent chess-training project and is **not affiliated with Chess.com**.
- The Magnus-style and Martin profiles are app difficulty presets, not official bots or endorsements by those players.
- Stockfish is free software licensed under **GPL-3.0**. Anyone redistributing builds should review the upstream Stockfish licence and source-distribution requirements.
- This project is under active development. Features, engine availability and UI may change between builds.

## Feedback
Found a bug or have a feature idea? Open an issue with your device model, Android version, app version / build number, reproduction steps, and relevant screenshots or logs (with personal information removed).
