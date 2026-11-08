# Chess Coach AI — starter build 0.1.0

A premium-dark Expo / React Native starter for an Android chess-learning app.

## Included in this first build
- Interactive 8×8 chessboard
- Legal move validation powered by `chess.js`
- Select piece → see legal destinations → play move
- Beginner Italian Game guided lesson
- Undo and restart controls
- Move history and coach-tip panel
- Dark mobile-first UI

## Important status
This is **Step 1**, the playable learning UI. It does **not yet run Stockfish** and does not claim to evaluate moves. The app marks the engine integration as the next step. Step 2 should integrate a compatible local Stockfish engine and translate UCI analysis into beginner-friendly explanations.

## Run it
1. Install Node.js LTS on your computer.
2. Extract this folder.
3. In the project directory run `npm install`.
4. Run `npx expo start`.
5. Install Expo Go on your Android phone and scan the QR code shown by Expo, with both devices on the same network.

To build a standalone Android APK later, we can configure EAS Build after the engine integration is working.

## Stockfish licensing note
Stockfish is GPLv3-licensed. If you distribute a build containing Stockfish, include the required license and corresponding source-code availability. See https://github.com/official-stockfish/Stockfish
