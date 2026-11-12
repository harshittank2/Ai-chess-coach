import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  StatusBar, ActivityIndicator, useWindowDimensions, Animated
} from 'react-native';
import { Chess } from 'chess.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Stockfish from 'dawikk-stockfish';

const COLORS = {
  bg: '#081A14', panel: '#10271D', panel2: '#193629', line: '#2B4B3A',
  text: '#F4F0E5', muted: '#A7B5A8', green: '#C4D99A',
  greenDark: '#294A36', light: '#EFE6D2', dark: '#78927D',
  gold: '#D9B66F', red: '#E98278'
};
const BOT_PROFILES = [
  { id: 'martin', name: 'Martin', elo: 250, level: 'Easy', tag: 'Beginner', style: 'Casual moves · forgiving', mode: 'casual' },
  { id: 'rookie', name: 'Rookie', elo: 500, level: 'Easy', tag: 'Learning', style: 'Simple plans · low pressure', mode: 'easy' },
  { id: 'club', name: 'Club Player', elo: 1000, level: 'Medium', tag: 'Club', style: 'Balanced development', mode: 'medium' },
  { id: 'tactician', name: 'Tactician', elo: 1600, level: 'Hard', tag: 'Advanced', style: 'Sharper tactics · deeper search', mode: 'hard' },
  { id: 'magnus', name: 'Magnus-style', elo: 2800, level: 'Hard', tag: 'Elite', style: 'Strongest available engine mode', mode: 'elite' }
];
const FILES = 'abcdefgh';
const PIECES = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
};
const OPENINGS = [
  { name: "Italian Game", tag: "Open game \u00b7 beginner", idea: "Develop quickly and aim at f7. The Giuoco Piano gives both sides natural development and central play.", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d4", "exd4", "cxd4", "Bb4+", "Nc3", "Nxe4", "O-O"] },
  { name: "Ruy Lopez", tag: "Open game \u00b7 classical", idea: "Pressure the knight that defends e5. The Spanish Game builds long-term pressure and a strong centre.", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"] },
  { name: "Scotch Game", tag: "Open game \u00b7 tactical", idea: "Challenge the centre early and open lines for your pieces. The Scotch often leads to active piece play.", moves: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4"] },
  { name: "Queen's Gambit", tag: "Closed game \u00b7 positional", idea: "Offer the c-pawn to challenge Black\u2019s d5 centre. It is a positional opening, not a forced pawn sacrifice.", moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7"] },
  { name: "King's Gambit", tag: "Gambit \u00b7 attacking", idea: "White sacrifices a pawn for rapid development and attacking chances. King safety matters.", moves: ["e4", "e5", "f4", "exf4", "Nf3", "g5", "h4"] },
  { name: "Evans Gambit", tag: "Gambit \u00b7 attacking", idea: "White gives a wing pawn to gain time and build a powerful centre. Development is the compensation.", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4", "Bxb4", "c3", "Ba5", "d4"] },
  { name: "Danish Gambit", tag: "Gambit \u00b7 open lines", idea: "White sacrifices pawns for open diagonals and fast development. Keep the initiative.", moves: ["e4", "e5", "d4", "exd4", "c3", "dxc3", "Bc4", "cxb2", "Bxb2"] },
  { name: "Smith-Morra Gambit", tag: "Sicilian gambit", idea: "White offers a pawn to develop quickly against the Sicilian and seize open files.", moves: ["e4", "c5", "d4", "cxd4", "c3", "dxc3", "Nxc3"] },
  { name: "Sicilian Defence", tag: "Defence \u00b7 counterattack", idea: "Black fights for the d4 square asymmetrically and creates active counterplay.", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3"] },
  { name: "French Defence", tag: "Defence \u00b7 solid", idea: "Black challenges White\u2019s centre with ...d5. Learn the tension between the pawn chains.", moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6"] },
  { name: "Caro-Kann Defence", tag: "Defence \u00b7 solid", idea: "Black prepares ...d5 while keeping the light-squared bishop\u2019s diagonal open.", moves: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4"] },
  { name: "London System", tag: "System \u00b7 positional", idea: "Develop the light-squared bishop outside the pawn chain, then build a reliable setup.", moves: ["d4", "d5", "Nf3", "Nf6", "Bf4", "e6", "e3", "Bd6", "Bg3"] }
];
function buildOpeningLessons(opening) {
  const game = new Chess();
  const tips = ['Control the centre', 'Develop a piece', 'Improve your position', 'Prepare king safety', 'Create a useful threat'];
  return opening.moves.map((san, index) => {
    const move = game.move(san);
    return { san: move ? move.san : san, title: tips[index % tips.length], body: opening.idea };
  });
}

const VALUES = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20000 };
const freshGame = () => new Chess();

function evaluateWhite(game) {
  if (game.isCheckmate()) return game.turn() === 'w' ? -100000 : 100000;
  if (game.isDraw()) return 0;
  const board = game.board();

  let score = 0;
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = board[r][c];
      if (!p) continue;
      const sign = p.color === 'w' ? 1 : -1;
      const center = 3.5 - (Math.abs(3.5 - r) + Math.abs(3.5 - c)) / 2;
      const positional = p.type === 'p' ? (p.color === 'w' ? (6 - r) : (r - 1)) * 5 : center * (p.type === 'n' || p.type === 'b' ? 8 : 2);
      score += sign * (VALUES[p.type] + positional);
    }
  }
  return score;
}

function minimax(game, depth, alpha, beta, rootColor) {
  if (depth <= 0 || game.isGameOver()) {
    const whiteScore = evaluateWhite(game);
    return rootColor === 'w' ? whiteScore : -whiteScore;
  }
  const maximizing = game.turn() === rootColor;
  const moves = game.moves({ verbose: true });
  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const next = new Chess(game.fen());
      next.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
      best = Math.max(best, minimax(next, depth - 1, alpha, beta, rootColor));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const move of moves) {
    const next = new Chess(game.fen());
    next.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
    best = Math.min(best, minimax(next, depth - 1, alpha, beta, rootColor));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function chooseLocalMove(fen, level) {
  const game = new Chess(fen);
  const rootColor = game.turn();
  const depth = level === 'Hard' ? 3 : level === 'Medium' ? 2 : 1;
  let bestMove = null;
  let bestScore = -Infinity;
  const moves = game.moves({ verbose: true });
  for (const move of moves) {
    const next = new Chess(fen);
    next.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
    const score = minimax(next, depth - 1, -Infinity, Infinity, rootColor);
    const tieBreak = Math.random() * 0.15;
    if (score + tieBreak > bestScore) {
      bestScore = score + tieBreak;
      bestMove = { from: move.from, to: move.to, promotion: move.promotion || 'q' };
    }
  }
  return bestMove;
}

let localEngineInit = null;
let localEngineQueue = Promise.resolve();
let localEngineReady = false;

function waitForUciMessage(target, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsubscribe();
      if (err) reject(err); else resolve(true);
    };
    const timer = setTimeout(() => finish(new Error('Local Stockfish did not respond with ' + target)), timeoutMs);
    const unsubscribe = Stockfish.addMessageListener(message => {
      const line = String(message && (message.line || message.message || message));
      if (line.trim() === target || line.includes(target)) finish();
    });
  });
}

async function sendUciAndWait(command, target, timeoutMs = 8000) {
  const waiting = waitForUciMessage(target, timeoutMs);
  await Stockfish.sendCommand(command);
  await waiting;
}

async function ensureLocalEngineReady() {
  if (!localEngineInit) {
    localEngineInit = (async () => {
      Stockfish.setConfig({
        throttling: { analysisInterval: 150, messageInterval: 100 },
        events: { emitMessage: true, emitAnalysis: true, emitBestMove: true }
      });
      const ok = await Stockfish.init();
      if (ok === false) throw new Error('Local Stockfish initialization failed');
      await sendUciAndWait('uci', 'uciok');
      await sendUciAndWait('isready', 'readyok');
      localEngineReady = true;
      return true;
    })().catch(error => { localEngineInit = null; throw error; });
  }
  return localEngineInit;
}

async function analyzeLocalFen(fen, depth) {
  localEngineQueue = localEngineQueue.catch(() => {}).then(async () => {
    await ensureLocalEngineReady();
    return new Promise(async (resolve, reject) => {
      let latest = { evaluation: 0, mate: null, continuation: '', depth };
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        if (error) reject(error); else resolve(value);
      };
      const timer = setTimeout(() => finish(new Error('Local Stockfish analysis timed out')), 45000);
      const unsubscribe = Stockfish.addMessageListener(message => {
        const line = String(message && (message.line || message.message || message)).trim();
        const d = line.match(/\bdepth\s+(\d+)/i);
        const cp = line.match(/\bscore\s+cp\s+(-?\d+)/i);
        const mate = line.match(/\bscore\s+mate\s+(-?\d+)/i);
        const pv = line.match(/\bpv\s+(.+)$/i);
        if (d) latest.depth = Number(d[1]);
        if (cp) { latest.evaluation = Number(cp[1]) / 100; latest.mate = null; }
        if (mate) latest.mate = Number(mate[1]);
        if (pv) latest.continuation = pv[1].trim();
        const best = line.match(/\bbestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/i);
        if (best) {
          const sideToMove = fen.split(' ')[1] || 'w';
          const whiteEval = sideToMove === 'w' ? latest.evaluation : -latest.evaluation;
          finish(null, { ...latest, evaluation: whiteEval, bestmove: best[1], engine: 'Local Stockfish' });
        }
      });
      try {
        await sendUciAndWait('isready', 'readyok');
        await Stockfish.sendCommand('position fen ' + fen);
        await Stockfish.sendCommand('go depth ' + depth);
      } catch (error) { finish(error); }
    });
  });
  return localEngineQueue;
}

async function analyzeOnlineFen(fen, depth) {
  const url = 'https://stockfish.online/api/s/v2.php?fen=' + encodeURIComponent(fen) + '&depth=' + depth;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Online Stockfish service unavailable');
  const data = await response.json();
  if (data.success === false) throw new Error(data.error || 'Online Stockfish analysis failed');
  const raw = String(data.bestmove || data.bestMove || '');
  const match = raw.match(/bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/i) || raw.match(/^([a-h][1-8][a-h][1-8][qrbn]?)/i);
  return { evaluation: Number(data.evaluation || 0), mate: data.mate, bestmove: match ? match[1] : raw, continuation: data.continuation || '', depth: data.depth || depth, engine: 'Online Stockfish' };
}

async function analyzeFen(fen, depth, mode) {
  if (mode === 'Online only') return analyzeOnlineFen(fen, depth);
  try {
    return await analyzeLocalFen(fen, depth);
  } catch (error) {
    if (mode === 'Local only') throw error;
    return analyzeOnlineFen(fen, depth);
  }
}

async function getStockfishMove(fen, level, mode) {
  const depth = level === 'Hard' ? 14 : level === 'Medium' ? 10 : 6;
  const data = await analyzeFen(fen, depth, mode);
  const raw = String(data.bestmove || '');
  const match = raw.match(/([a-h][1-8][a-h][1-8][qrbn]?)/i);
  if (!match) throw new Error('No legal engine move returned');
  const uci = match[1];
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' };
}

export default function App() {
  const { width } = useWindowDimensions();
  const [game, setGame] = useState(freshGame);
  const boardSnapshots = useRef({ Learn: { game: freshGame(), history: [] }, Play: { game: freshGame(), history: [] }, Review: { game: freshGame(), history: [] } });
  const [selected, setSelected] = useState(null);
  const [targets, setTargets] = useState([])
  const [pendingPremove, setPendingPremove] = useState(null);
  const [history, setHistory] = useState([]);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [openingIndex, setOpeningIndex] = useState(0);
  const [playMode, setPlayMode] = useState('computer');
  const [timeMinutes, setTimeMinutes] = useState(10);
  const [customMinutes, setCustomMinutes] = useState('10');
  const [clock, setClock] = useState({ w: 600, b: 600 });
  const [clockStarted, setClockStarted] = useState(false);
  const [timeoutSide, setTimeoutSide] = useState(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [tab, setTab] = useState('Learn');
  const [level, setLevel] = useState('Medium');
  const [selectedBotId, setSelectedBotId] = useState('club');
  const selectedBot = BOT_PROFILES.find(bot => bot.id === selectedBotId) || BOT_PROFILES[2];
  const [engineMode, setEngineMode] = useState('Auto');
  const [message, setMessage] = useState('Choose a piece, then tap a highlighted square.');
  const [aiThinking, setAiThinking] = useState(false);
  const [engineLabel, setEngineLabel] = useState('Ready to play');
  const [animatedPiece, setAnimatedPiece] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [playerElo, setPlayerElo] = useState(800);
  const [ratedGames, setRatedGames] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [ratingReady, setRatingReady] = useState(false);
  const ratedGameKey = useRef('');
  const [analyzing, setAnalyzing] = useState(false);
  const [pgnText, setPgnText] = useState('');
  const [pgnError, setPgnError] = useState('');
  const [importedGame, setImportedGame] = useState(null);
  const [pgnAnalysis, setPgnAnalysis] = useState([]);
  const [pgnAnalyzing, setPgnAnalyzing] = useState(false);
  const [pgnProgress, setPgnProgress] = useState(0);
  const animationPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const aiBusy = useRef(false);
  const selectedOpening = OPENINGS[openingIndex] || OPENINGS[0];
  const LESSONS = useMemo(() => buildOpeningLessons(selectedOpening), [openingIndex]);
  const currentLesson = LESSONS[lessonIndex] || null;
  const boardSize = fullScreen && tab === 'Play' ? Math.max(240, Math.min(width - 20, 620)) : Math.min(width - 60, 430);
  const board = game.board();

  // Persist each tab's board snapshot independently; these hooks must remain
  // directly inside App (never inside evaluateWhite or another helper).
  useEffect(() => {
    boardSnapshots.current[tab] = { game, history: [...history] };
  }, [game, history, tab]);

  function switchBoardTab(nextTab) {
    if (nextTab === tab) return;
    boardSnapshots.current[tab] = { game, history: [...history] };
    const destination = boardSnapshots.current[nextTab] || { game: freshGame(), history: [] };
    setGame(destination.game);
    setHistory([...destination.history]);
    setSelected(null);
    setTargets([]);
    setPendingPremove(null);
    setAnimatedPiece(null);
    setTab(nextTab);
    setMessage(nextTab === 'Learn' ? 'Opening lesson board' : nextTab === 'Play' ? 'Your play board' : 'Game review board');
  }



  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem('chess-coach-rating-v1').then(raw => {
      if (!alive || !raw) return;
      const saved = JSON.parse(raw);
      if (Number.isFinite(saved.playerElo)) setPlayerElo(saved.playerElo);
      if (Number.isFinite(saved.ratedGames)) setRatedGames(saved.ratedGames);
      if (saved.lastResult) setLastResult(saved.lastResult);
    }).catch(() => {}).finally(() => { if (alive) setRatingReady(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!ratingReady) return;
    AsyncStorage.setItem('chess-coach-rating-v1', JSON.stringify({ playerElo, ratedGames, lastResult })).catch(() => {});
  }, [playerElo, ratedGames, lastResult, ratingReady]);

  useEffect(() => {
    if (tab !== 'Play' || playMode !== 'computer' || !game.isGameOver() || !ratingReady) return;
    const key = game.history().join(' ');
    if (!key || ratedGameKey.current === key) return;
    ratedGameKey.current = key;
    const opponentElo = selectedBot.elo;
    const score = game.isDraw() ? 0.5 : game.turn() === 'b' ? 1 : 0;
    const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    const delta = Math.round(32 * (score - expected));
    const nextRating = Math.max(100, playerElo + delta);
    const result = score === 0.5 ? 'Draw' : score === 1 ? 'Win' : 'Loss';
    setPlayerElo(nextRating);
    setRatedGames(n => n + 1);
    setLastResult({ result, delta, opponentElo, level, botName: selectedBot.name, moves: game.history().length, date: new Date().toISOString() });
  }, [game, tab, level, selectedBotId, selectedBot, playerElo, ratingReady]);

  useEffect(() => {
    if (tab !== 'Play' || !clockStarted || game.isGameOver() || timeoutSide) return undefined;
    const timer = setInterval(() => {
      const side = game.turn();
      setClock(previous => {
        const nextValue = Math.max(0, previous[side] - 1);
        return { ...previous, [side]: nextValue };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [tab, clockStarted, game, timeoutSide]);

  useEffect(() => {
    if (tab === 'Play' && clockStarted && !game.isGameOver() && clock[game.turn()] <= 0 && !timeoutSide) {
      setTimeoutSide(game.turn());
    }
  }, [tab, clock, clockStarted, game, timeoutSide]);

  const formatClock = seconds => {
    const safe = Math.max(0, seconds);
    return Math.floor(safe / 60).toString().padStart(2, '0') + ':' + (safe % 60).toString().padStart(2, '0');
  };
  const resetClock = (minutes = timeMinutes, start = false) => {
    const total = Math.max(1, Math.min(180, Number(minutes) || 10)) * 60;
    setClock({ w: total, b: total });
    setTimeoutSide(null);
    setClockStarted(start);
  };

  const status = timeoutSide ? (timeoutSide === 'w' ? 'White' : 'Black') + ' ran out of time · ' + (timeoutSide === 'w' ? 'Black' : 'White') + ' wins' : game.isCheckmate()
    ? 'Checkmate · ' + (game.turn() === 'w' ? 'Black' : 'White') + ' wins'
    : game.isDraw()
      ? 'Draw game'
      : (game.turn() === 'w' ? 'White' : 'Black') + ' to move' + (game.isCheck() ? ' · Check' : '');

  function legalTargets(square) {
    return game.moves({ square, verbose: true }).map(move => move.to);
  }

  function animatePosition(next, move, note, onFinish) {
    if (!move) {
      setGame(next);
      setHistory(next.history());
      if (note) setMessage(note);
      if (onFinish) onFinish();
      return;
    }
    const piece = game.get(move.from);
    if (!piece) {
      setGame(next);
      setHistory(next.history());
      if (note) setMessage(note);
      if (onFinish) onFinish();
      return;
    }
    const cell = boardSize / 8;
    const x = square => FILES.indexOf(square[0]) * cell;
    const y = square => (8 - Number(square[1])) * cell;
    animationPosition.setValue({ x: x(move.from), y: y(move.from) });
    setAnimatedPiece({ from: move.from, glyph: PIECES[piece.color + piece.type.toUpperCase()], color: piece.color });
    Animated.timing(animationPosition, {
      toValue: { x: x(move.to), y: y(move.to) },
      duration: 260,
      useNativeDriver: true
    }).start(({ finished }) => {
      if (!finished) return;
      setGame(next);
      setHistory(next.history());
      setAnimatedPiece(null);
      if (note) setMessage(note);
      if (onFinish) onFinish();
    });
  }

  async function choosePgnFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
        multiple: false
      });
      if (result.canceled || !result.assets || !result.assets[0]) return;
      const asset = result.assets[0];
      if (asset.name && !asset.name.toLowerCase().endsWith('.pgn') && !asset.name.toLowerCase().endsWith('.txt')) {
        setPgnError('Choose a .pgn file (or a .txt file containing PGN).');
        return;
      }
      const contents = await FileSystem.readAsStringAsync(asset.uri);
      setPgnText(contents);
      setPgnError('');
      setMessage('PGN file loaded. Tap Import game to prepare the review.');
    } catch (error) {
      setPgnError('Could not read that file. You can also paste the PGN text below.');
    }
  }

  function importPgnGame() {
    try {
      if (!pgnText.trim()) throw new Error('Choose a PGN file or paste PGN text first.');
      const parsed = new Chess();
      parsed.loadPgn(pgnText.trim());
      const headers = parsed.header();
      const verbose = parsed.history({ verbose: true });
      if (!verbose.length) throw new Error('This PGN contains no moves.');
      const initialFen = headers.FEN || new Chess().fen();
      const replay = new Chess(initialFen);
      const plies = verbose.map((move, index) => {
        const beforeFen = replay.fen();
        const color = replay.turn();
        const applied = replay.move(move.san);
        if (!applied) throw new Error('Could not replay move ' + (index + 1) + '.');
        return {
          index: index + 1,
          fullMove: Math.floor(index / 2) + 1,
          color,
          san: applied.san,
          uci: applied.from + applied.to + (applied.promotion || ''),
          fen: beforeFen,
          afterFen: replay.fen()
        };
      });
      setImportedGame({ headers, plies, finalFen: replay.fen(), result: headers.Result || '*', finalStatus: replay.isGameOver() ? (replay.isCheckmate() ? 'Checkmate' : 'Draw') : 'Game imported' });
      setPgnAnalysis([]);
      setPgnProgress(0);
      setPgnError('');
      setGame(replay);
      setHistory(replay.history());
      setSelected(null);
      setTargets([]);
      setMessage('Imported ' + plies.length + ' half-moves. Run Stockfish review to analyse every played move.');
    } catch (error) {
      setImportedGame(null);
      setPgnError(error.message || 'Invalid PGN. Check the file and try again.');
    }
  }

  async function analyzeImportedGame() {
    if (!importedGame || pgnAnalyzing) return;
    const maxPlies = Math.min(importedGame.plies.length, 60);
    setPgnAnalyzing(true);
    setPgnAnalysis([]);
    setPgnProgress(0);
    setPgnError('');
    const results = [];
    try {
      let currentEval = null;
      for (let i = 0; i < maxPlies; i += 1) {
        const ply = importedGame.plies[i];
        const before = currentEval || await analyzeFen(ply.fen, 10, engineMode);
        const after = await analyzeFen(ply.afterFen, 10, engineMode);
        currentEval = after;
        const best = String(before.bestmove || '').match(/[a-h][1-8][a-h][1-8][qrbn]?/i);
        const beforeWhite = Number(before.evaluation || 0);
        const afterWhite = Number(after.evaluation || 0);
        const loss = ply.color === 'w' ? beforeWhite - afterWhite : afterWhite - beforeWhite;
        const lossCp = Math.max(0, loss * 100);
        const classification = lossCp <= 15 ? 'Best' : lossCp <= 35 ? 'Excellent' : lossCp <= 70 ? 'Good' : lossCp <= 130 ? 'Inaccuracy' : lossCp <= 250 ? 'Mistake' : 'Blunder';
        results.push({ ...ply, evaluation: before.evaluation, mate: before.mate, bestmove: best ? best[0] : before.bestmove, continuation: before.continuation || '', depth: before.depth || 10, bestMovePlayed: !!(best && best[0].toLowerCase() === ply.uci.toLowerCase()), evalLoss: lossCp, classification, engine: before.engine });
        setPgnAnalysis([...results]);
        setPgnProgress(i + 1);
      }
      if (importedGame.plies.length > maxPlies) setPgnError('Analysed the first 60 half-moves to keep review time reasonable. The imported game contains ' + importedGame.plies.length + '.');
      setMessage('Stockfish review complete for ' + results.length + ' moves. Move classifications use the change in engine evaluation after each played move.');
    } catch (error) {
      setPgnError((error.message || 'Stockfish review failed.') + (engineMode === 'Local only' ? ' Try Auto mode or restart the app.' : ' Switch engine mode and retry.'));
    } finally {
      setPgnAnalyzing(false);
    }
  }

  async function analyzeCurrentPosition() {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const data = await analyzeFen(game.fen(), 15, engineMode);
      setAnalysis({ evaluation: data.evaluation, mate: data.mate, bestmove: data.bestmove, continuation: data.continuation, depth: data.depth || 15, engine: data.engine });
      setMessage('Stockfish analysed this position. Check the engine result below.');
      setEngineLabel('Stockfish analysis · depth 15');
    } catch (error) {
      setMessage(error.message || 'Stockfish analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  }

  function recordPosition(next, move, note) {
    if (tab === 'Play' && !clockStarted) setClockStarted(true);
    setSelected(null);
    setTargets([]);
    animatePosition(next, move, note, () => {
      if (move && tab === 'Learn') {
        const lesson = LESSONS[lessonIndex];
        if (lesson && move.san === lesson.san) {
          setLessonIndex(index => Math.min(index + 1, LESSONS.length));
          setMessage('Great move! ' + lesson.title + '. ' + lesson.body);
        }
      }
    });
  }

  function selectSquare(square) {
    if (game.isGameOver() || timeoutSide) return;
    const queueingPremove = tab === 'Play' && playMode === 'computer' && game.turn() === 'b';
    if (queueingPremove) {
      if (selected && targets.includes(square)) {
        setPendingPremove({ from: selected, to: square, promotion: 'q' });
        setSelected(null); setTargets([]);
        setMessage('Premove queued: ' + selected + ' → ' + square + '. It will play automatically if legal after the computer moves.');
        return;
      }
      const piece = game.get(square);
      if (piece && piece.color === 'w') {
        // Build a temporary White-to-move position only to preview destinations.
        // Clear the en-passant target: it belongs to the side that just moved and
        // becomes invalid when we flip the FEN turn field for a premove preview.
        const fields = game.fen().split(' ');
        fields[1] = 'w';
        fields[3] = '-';
        let options = [];
        try {
          const preview = new Chess(fields.join(' '));
          options = preview.moves({ square, verbose: true }).map(move => move.to);
        } catch (error) {
          // A premove is only a prediction; if the current position cannot be
          // safely previewed, still allow the user to choose a destination.
          options = [];
        }
        setSelected(square);
        setTargets(options);
        setMessage(options.length
          ? 'Choose where your piece should move after the computer replies.'
          : 'No safe premove destinations can be previewed here. Select another piece or wait for the computer move.');
      } else {
        setSelected(null);
        setTargets([]);
        setMessage('Select one of your White pieces to queue a premove.');
      }
      return;
    }
    if (tab === 'Play' && playMode === 'computer' && game.turn() === 'w' && pendingPremove) setPendingPremove(null);
    if (selected && targets.includes(square)) {
      const next = new Chess(game.fen());
      try {
        const move = next.move({ from: selected, to: square, promotion: 'q' });
        if (move) {
          setPendingPremove(null);
          recordPosition(next, move, 'Nice move: ' + move.san + '. ' + (next.isCheck() ? 'Check!' : 'Keep developing and watch your opponent threats.'));
          return;
        }
      } catch (error) {}
    }
    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setSelected(square); setTargets(legalTargets(square));
      setMessage((piece.color === 'w' ? 'White ' : 'Black ') + piece.type.toUpperCase() + ' selected. Pick a highlighted square.');
    } else {
      setSelected(null); setTargets([]);
      setMessage('That square is not a legal destination. Select one of your pieces.');
    }
  }

  function undo() {
    // Rebuild from the game's actual starting FEN (important for imported PGNs),
    // then replay all but the move(s) being undone. Never silently fall back to
    // the standard starting position: that makes Undo look like a full reset.
    const moves = game.history();
    if (!moves.length) return;
    const removeCount = tab === 'Play' && playMode === 'computer' ? Math.min(2, moves.length) : 1;
    const headers = typeof game.getHeaders === 'function' ? game.getHeaders() : {};
    const startFen = headers && headers.FEN ? headers.FEN : undefined;
    const replay = startFen ? new Chess(startFen) : freshGame();
    try {
      moves.slice(0, -removeCount).forEach(san => replay.move(san));
    } catch (error) {
      setMessage('Could not undo this imported position safely. The current board was kept unchanged.');
      return;
    }
    setGame(replay);
    setHistory(replay.history());
    setSelected(null);
    setTargets([]);
    setPendingPremove(null);
    setAnimatedPiece(null);
    setMessage('Last move' + (removeCount === 2 ? ' pair' : '') + ' undone.');
  }

  function selectBot(bot) {
    resetClock(timeMinutes, false);
    setSelectedBotId(bot.id);
    setLevel(bot.level);
    ratedGameKey.current = '';
    const next = freshGame();
    setGame(next);
    setHistory([]);
    setSelected(null);
    setTargets([]);
    setAnalysis(null);
    setEngineLabel(bot.mode === 'casual' ? 'Martin · casual mode' : bot.id === 'magnus' ? 'Elite engine mode · target 2800' : bot.level + ' engine mode');
    setMessage('New game vs ' + bot.name + ' · target ' + bot.elo + ' Elo. White moves first.');
  }

  function restart() {
    ratedGameKey.current = '';
    if (tab === 'Play') resetClock(timeMinutes, false);
    const next = freshGame();
    setGame(next);
    setHistory([]);
    setSelected(null);
    setTargets([]);
    setPendingPremove(null);
    setLessonIndex(0);
    setMessage(tab === 'Play' ? (playMode === 'pvp' ? 'Offline Pass & Play. White moves first.' : 'New game. You are White; make the first move.') : 'New lesson: ' + selectedOpening.name + '. Start with ' + (LESSONS[0]?.san || 'the first move') + '.');
    setEngineLabel('Ready to play');
    setAnalysis(null);
  }

  function playLessonMove() {
    if (!currentLesson) {
      setMessage('Opening lesson complete! Restart to practise it again.');
      return;
    }
    const next = new Chess(game.fen());
    try {
      const move = next.move(currentLesson.san);
      if (!move) {
        setMessage('This lesson move does not fit the current position. Restart the lesson to begin again.');
        return;
      }
      setSelected(null);
      setTargets([]);
      animatePosition(next, move, currentLesson.title + '. ' + currentLesson.body, () => setLessonIndex(index => Math.min(index + 1, LESSONS.length)));
    } catch (error) {
      setMessage('Restart the lesson to continue from the starting position.');
    }
  }

  useEffect(() => {
    if (tab !== 'Play' || playMode !== 'computer' || game.turn() !== 'b' || game.isGameOver() || aiBusy.current) return undefined;
    let cancelled = false;
    aiBusy.current = true;
    setAiThinking(true);
    setMessage('The coach is thinking…');
    (async () => {
      let move = null;
      try {
        if (selectedBotId === 'martin') {
          const casualGame = new Chess(game.fen());
          const legal = casualGame.moves({ verbose: true });
          if (legal.length) {
            const pick = legal[Math.floor(Math.random() * legal.length)];
            move = { from: pick.from, to: pick.to, promotion: pick.promotion || 'q' };
          }
          if (!cancelled) setEngineLabel('Martin · casual moves');
        } else {
          move = await getStockfishMove(game.fen(), level, engineMode);
          if (!cancelled) setEngineLabel(selectedBotId === 'magnus' ? 'Elite engine mode · target 2800' : engineMode === 'Online only' ? 'Online Stockfish' : engineMode === 'Local only' ? 'Local Stockfish' : 'Local-first Stockfish');
        }
      } catch (error) {
        if (engineMode === 'Local only') {
          move = null;
          if (!cancelled) { setEngineLabel('Local Stockfish unavailable'); setMessage('Local Stockfish could not start. Switch to Auto or Online only, or retry the engine.'); }
        } else {
          move = chooseLocalMove(game.fen(), level);
          if (!cancelled) setEngineLabel('Engine unavailable · basic AI fallback');
        }
      }
      if (!cancelled && move) {
        const next = new Chess(game.fen());
        try {
          const played = next.move(move);
          if (played) {
            setSelected(null);
            setTargets([]);
            animatePosition(next, played, 'Computer played ' + played.san + '. Find your next plan.', () => { setSelected(null); setTargets([]); });
          }
        } catch (error) {
          setMessage('The engine returned an invalid move. Please try again.');
        }
      }
      aiBusy.current = false;
      if (!cancelled) setAiThinking(false);
    })();
    return () => {
      cancelled = true;
      aiBusy.current = false;
    };
  }, [tab, game, level, engineMode, playMode, selectedBotId, timeoutSide]);

  useEffect(() => {
    if (!pendingPremove || tab !== 'Play' || playMode !== 'computer' || game.turn() !== 'w' || aiThinking || game.isGameOver() || timeoutSide) return;
    const queued = pendingPremove;
    const next = new Chess(game.fen());
    try {
      const played = next.move({ from: queued.from, to: queued.to, promotion: queued.promotion || 'q' });
      setPendingPremove(null); setSelected(null); setTargets([]);
      if (played) recordPosition(next, played, 'Premove played: ' + played.san + '.');
      else setMessage('Premove cancelled: that move is no longer legal.');
    } catch (error) {
      setPendingPremove(null); setSelected(null); setTargets([]);
      setMessage('Premove cancelled: the computer changed the position.');
    }
  }, [pendingPremove, tab, playMode, game, aiThinking, timeoutSide]);

  const movePairs = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < history.length; i += 2) {
      pairs.push({
        number: Math.floor(i / 2) + 1,
        white: history[i],
        black: history[i + 1] || ''
      });
    }
    return pairs;
  }, [history]);

  const progress = Math.min(lessonIndex, LESSONS.length);
  const isAiTurn = tab === 'Play' && game.turn() === 'b' && !game.isGameOver();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar hidden={fullScreen && tab === 'Play'} barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView contentContainerStyle={[styles.page, fullScreen && tab === 'Play' && styles.pageFullscreen]} showsVerticalScrollIndicator={false}>
        {!(fullScreen && tab === 'Play') && <View style={styles.header}>
          <View style={styles.brandBlock}>
            <Text style={styles.eyebrow}>THE CHESS TRAINING STUDIO</Text>
            <Text style={styles.brand}>Royal <Text style={styles.brandAccent}>Gambit</Text></Text>
            <Text style={styles.tagline}>Think clearly. Play beautifully.</Text>
          </View>
          <View style={styles.levelBadge}><Text style={styles.levelBadgeText}>♔  {playerElo} ELO</Text></View>
        </View>}



        {tab === 'Play' && !fullScreen && (
          <View style={styles.difficultyCard}>
            <View style={styles.difficultyHeading}>
              <Text style={styles.sectionTitle}>Choose game mode</Text>
              <Text style={styles.onlineTag}>{playMode === 'pvp' ? '● OFFLINE' : '● ENGINE'}</Text>
            </View>
            <View style={styles.levels}>
              <Pressable onPress={() => { setPlayMode('computer'); resetClock(timeMinutes, false); ratedGameKey.current = ''; const next = freshGame(); setGame(next); setHistory([]); setSelected(null); setTargets([]); setEngineLabel('Ready to play'); setMessage('New game against the computer. You are White.'); }} style={[styles.levelButton, playMode === 'computer' && styles.levelButtonActive]}><Text style={[styles.levelText, playMode === 'computer' && styles.levelTextActive]}>vs Computer</Text></Pressable>
              <Pressable onPress={() => { setPlayMode('pvp'); resetClock(timeMinutes, false); ratedGameKey.current = ''; const next = freshGame(); setGame(next); setHistory([]); setSelected(null); setTargets([]); setEngineLabel('Offline Pass & Play'); setMessage('Offline Pass & Play. White moves first.'); }} style={[styles.levelButton, playMode === 'pvp' && styles.levelButtonActive]}><Text style={[styles.levelText, playMode === 'pvp' && styles.levelTextActive]}>Pass & Play</Text></Pressable>
            </View>
            <Text style={styles.helper}>Time control</Text>
            <View style={styles.timeControls}>
              {[1, 3, 5, 10, 15, 30].map(minutes => <Pressable key={minutes} onPress={() => { setTimeMinutes(minutes); setCustomMinutes(String(minutes)); resetClock(minutes, false); }} style={[styles.timeChip, timeMinutes === minutes && styles.timeChipActive]}><Text style={[styles.timeChipText, timeMinutes === minutes && styles.timeChipTextActive]}>{minutes} min</Text></Pressable>)}
            </View>
            <View style={styles.clockSetupRow}>
              <TextInput value={customMinutes} onChangeText={value => setCustomMinutes(value.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType="number-pad" placeholder="Custom min" placeholderTextColor="#78877d" style={styles.customTimeInput} />
              <Pressable onPress={() => { const minutes = Math.max(1, Math.min(180, Number(customMinutes) || 10)); setTimeMinutes(minutes); setCustomMinutes(String(minutes)); resetClock(minutes, false); }} style={styles.timeApply}><Text style={styles.timeApplyText}>Set custom</Text></Pressable>
              <Pressable onPress={() => { restart(); resetClock(timeMinutes, true); }} style={styles.timeApply}><Text style={styles.timeApplyText}>Start game</Text></Pressable>
            </View>
            {playMode === 'pvp' ? <Text style={styles.helper}>Two players, one phone. White and Black take turns on this board. No internet or engine required.</Text> : <>
            <Text style={styles.helper}>Choose a personality. Elo is a target difficulty estimate; it is not a certified rating or an exact replica of a real player.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.botRail}>
              {BOT_PROFILES.map(bot => (
                <Pressable key={bot.id} onPress={() => selectBot(bot)} style={[styles.botCard, selectedBotId === bot.id && styles.botCardActive]}>
                  <View style={[styles.botAvatar, selectedBotId === bot.id && styles.botAvatarActive]}><Text style={styles.botAvatarText}>{bot.id === 'magnus' ? '♛' : bot.id === 'martin' ? '♟' : bot.id === 'tactician' ? '⚡' : '♞'}</Text></View>
                  <Text style={styles.botName}>{bot.name}</Text>
                  <Text style={[styles.botElo, selectedBotId === bot.id && styles.botEloActive]}>{bot.elo} Elo</Text>
                  <Text style={styles.botTag}>{bot.tag.toUpperCase()}</Text>
                  <Text style={styles.botStyle}>{bot.style}</Text>
                  {selectedBotId === bot.id && <Text style={styles.botSelected}>✓ SELECTED</Text>}
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.helper}>Martin uses intentionally casual legal moves. Other bots use the available Stockfish engine at increasing search settings. Magnus-style is the strongest available engine preset, not a simulation of Magnus Carlsen.</Text>
            </>}
          </View>
        )}

        {tab === 'Learn' && <View style={styles.homeHero}>
          <View style={styles.heroTopline}>
            <Text style={styles.heroEyebrow}>YOUR TRAINING ROOM</Text>
            <View style={styles.onlinePill}><View style={styles.onlineDot} /><Text style={styles.onlinePillText}>READY TO PLAY</Text></View>
          </View>
          <Text style={styles.heroTitle}>Make your next move{ '\n' }count.</Text>
          <Text style={styles.heroCopy}>Build better habits, sharpen your tactics and understand every position.</Text>
          <View style={styles.heroActions}>
            <Pressable onPress={() => switchBoardTab('Play')} style={styles.heroPrimary}><Text style={styles.heroPrimaryText}>♟  Start a game</Text></Pressable>
            <Pressable onPress={() => switchBoardTab('Review')} style={styles.heroSecondary}><Text style={styles.heroSecondaryText}>Review a game  ↗</Text></Pressable>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}><Text style={styles.heroStatValue}>{playerElo}</Text><Text style={styles.heroStatLabel}>YOUR RATING</Text></View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}><Text style={styles.heroStatValue}>{ratedGames}</Text><Text style={styles.heroStatLabel}>GAMES PLAYED</Text></View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}><Text style={styles.heroStatValue}>{OPENINGS.length}</Text><Text style={styles.heroStatLabel}>OPENINGS</Text></View>
          </View>
        </View>}

        {tab === 'Learn' && <View style={styles.difficultyCard}>
          <Text style={styles.sectionTitle}>Opening library · {OPENINGS.length} lessons</Text>
          <Text style={styles.helper}>Choose an opening to learn its main line, move by move.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {OPENINGS.map((item, index) => <Pressable key={item.name} onPress={() => { setOpeningIndex(index); setLessonIndex(0); setGame(freshGame()); setHistory([]); setSelected(null); setTargets([]); setMessage(item.name + ': ' + item.idea); }} style={[styles.openingChip, openingIndex === index && styles.openingChipActive]}>
              <Text style={[styles.openingChipTitle, openingIndex === index && styles.openingChipTitleActive]}>{item.name}</Text><Text style={styles.openingChipTag}>{item.tag}</Text>
            </Pressable>)}
          </ScrollView>
          <Text style={styles.helper}>{selectedOpening.idea}</Text>
        </View>}

        <View style={[styles.boardCard, fullScreen && tab === 'Play' && styles.boardCardFullscreen]}>
          {tab === 'Play' && <View style={styles.clockBar}>
            <View style={styles.clockPlayer}><Text style={styles.clockPlayerName}>{playMode === 'pvp' ? 'BLACK · PLAYER 2' : selectedBot.name.toUpperCase()}</Text><Text style={[styles.clockValue, game.turn() === 'b' && clockStarted && !timeoutSide && styles.clockActive]}>{formatClock(clock.b)}</Text></View>
            <View style={styles.clockPlayer}><Text style={styles.clockPlayerName}>{playMode === 'pvp' ? 'WHITE · PLAYER 1' : 'YOU · ' + playerElo + ' ELO'}</Text><Text style={[styles.clockValue, game.turn() === 'w' && clockStarted && !timeoutSide && styles.clockActive]}>{formatClock(clock.w)}</Text></View>
          </View>}
          <View style={styles.boardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.boardTitle}>{tab === 'Learn' ? selectedOpening.name : tab === 'Play' ? (playMode === 'pvp' ? 'Offline · Pass & Play' : 'You vs Computer') : 'Game review'}</Text>
              <Text style={styles.status}>{aiThinking ? 'Computer is thinking…' : status}</Text>
              {pendingPremove && <Text style={styles.helper}>PREMOVE QUEUED · {pendingPremove.from} → {pendingPremove.to}</Text>}
            </View>
            {tab === 'Play' && <Pressable onPress={() => setFullScreen(value => !value)} style={styles.fullscreenButton}><Text style={styles.fullscreenButtonText}>{fullScreen ? '↙ Exit full screen' : '⛶ Full screen'}</Text></Pressable>}
            <View style={[styles.statusDot, (game.isGameOver() || timeoutSide) && styles.statusDotEnd]} />
          </View>

          {tab === 'Play' && (
            <View style={styles.playerRow}>
              <View style={styles.avatar}><Text style={styles.avatarText}>♟</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.playerName}>{playMode === 'pvp' ? 'Black · Player 2' : selectedBot.name}</Text>
                <Text style={styles.playerMeta}>{playMode === 'pvp' ? 'Black pieces · Player 2' : selectedBot.tag + ' · Black pieces'}</Text>
              </View>
              <Text style={styles.playerRating}>{playMode === 'pvp' ? 'LOCAL' : selectedBot.elo + ' ELO'}</Text>
            </View>
          )}

          <View style={[styles.board, fullScreen && tab === 'Play' && styles.boardFullscreen, { width: boardSize, height: boardSize }]}>
            {board.map((row, r) => row.map((piece, c) => {
              const square = FILES[c] + String(8 - r);
              const light = (r + c) % 2 === 0;
              const isTarget = targets.includes(square);
              const isSelected = selected === square;
              const isPremoveSquare = !!pendingPremove && (pendingPremove.from === square || pendingPremove.to === square);
              return (
                <Pressable
                  key={square}
                  disabled={false}
                  onPress={() => selectSquare(square)}
                  style={[styles.square, {
                    width: boardSize / 8,
                    height: boardSize / 8,
                    backgroundColor: isSelected ? '#d6c45e' : isPremoveSquare ? '#b7a05b' : light ? '#EFE6D2' : '#78927D'
                  }]}
                >
                  {isTarget && <View style={[styles.target, piece && styles.targetCapture]} />}
                  {!!piece && !(animatedPiece && animatedPiece.from === square) && (
                    <Text style={[styles.piece, {
                      fontSize: Math.max(22, boardSize / 12),
                      color: piece.color === 'w' ? '#FFF9EC' : '#20382B',
                      textShadowColor: piece.color === 'w' ? '#78684F' : '#D8D0B9'
                    }]}>{PIECES[piece.color + piece.type.toUpperCase()]}</Text>
                  )}
                  {c === 0 && <Text style={styles.rank}>{8 - r}</Text>}
                  {r === 7 && <Text style={styles.file}>{FILES[c]}</Text>}
                </Pressable>
              );
            }))}
            {animatedPiece && (
              <Animated.View pointerEvents="none" style={[styles.movingPiece, { width: boardSize / 8, height: boardSize / 8 }, { transform: animationPosition.getTranslateTransform() }]}>
                <Text style={[styles.piece, { fontSize: Math.max(22, boardSize / 12), color: animatedPiece.color === 'w' ? '#FFF9EC' : '#20382B', textShadowColor: animatedPiece.color === 'w' ? '#78684F' : '#D8D0B9' }]}>{animatedPiece.glyph}</Text>
              </Animated.View>
            )}
          </View>

          {tab === 'Review' && (
            <View style={{ width: '100%', gap: 10, marginTop: 12 }}>
              <View style={styles.reviewTopBar}>
                <View style={styles.reviewCoachAvatar}><Text style={styles.reviewCoachAvatarText}>♟</Text></View>
                <View style={styles.reviewCoachBubble}><Text style={styles.reviewCoachText}>{pgnAnalysis.length ? 'Your game has been analysed. Check the move classifications and engine lines below.' : 'Import your Chess.com PGN and let Stockfish review the critical moments in your game.'}</Text></View>
              </View>
              <View style={styles.engineModeCard}>
                <Text style={styles.sectionTitle}>Analysis engine</Text>
                <View style={styles.engineModeRow}>
                  {['Auto', 'Local only', 'Online only'].map(mode => (
                    <Pressable key={mode} onPress={() => setEngineMode(mode)} style={[styles.engineModeButton, engineMode === mode && styles.engineModeButtonActive]}>
                      <Text style={[styles.engineModeText, engineMode === mode && styles.engineModeTextActive]}>{mode}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.helper}>{engineMode === 'Auto' ? 'Local Stockfish first; online Stockfish is the fallback.' : engineMode === 'Local only' ? 'Runs Stockfish on this phone. Internet is not required.' : 'Uses the online Stockfish service and requires internet.'}</Text>
              </View>
              {!!pgnAnalysis.length && <View style={styles.reviewSummaryCard}>
                <Text style={styles.reviewSummaryTitle}>GAME REVIEW SUMMARY</Text>
                <Text style={styles.helper}>Move quality is estimated from Stockfish evaluation loss after each move.</Text>
                <View style={styles.reviewTableHeader}>
                  <Text style={[styles.reviewTablePlayer, { flex: 1.25 }]}>MOVE TYPE</Text>
                  <Text style={styles.reviewTablePlayer} numberOfLines={1}>{importedGame?.headers?.White || 'White'}</Text>
                  <Text style={styles.reviewTablePlayer} numberOfLines={1}>{importedGame?.headers?.Black || 'Black'}</Text>
                </View>
                {[
                  { label: 'Best', color: '#8fca59' },
                  { label: 'Excellent', color: '#8fca59' },
                  { label: 'Good', color: '#d0bd60' },
                  { label: 'Inaccuracy', color: '#e5a154' },
                  { label: 'Mistake', color: '#f18a57' },
                  { label: 'Blunder', color: '#f06464' }
                ].map(row => <View key={row.label} style={styles.reviewTableRow}>
                  <Text style={[styles.reviewTableCategory, { color: row.color }]}>{row.label}</Text>
                  <Text style={styles.reviewTableCount}>{pgnAnalysis.filter(x => x.color === 'w' && x.classification === row.label).length}</Text>
                  <Text style={styles.reviewTableCount}>{pgnAnalysis.filter(x => x.color === 'b' && x.classification === row.label).length}</Text>
                </View>)}
                <View style={styles.reviewTableTotals}>
                  <Text style={[styles.reviewTableCategory, { flex: 1.25 }]}>Moves reviewed</Text>
                  <Text style={styles.reviewTableCount}>{pgnAnalysis.filter(x => x.color === 'w').length}</Text>
                  <Text style={styles.reviewTableCount}>{pgnAnalysis.filter(x => x.color === 'b').length}</Text>
                </View>
                <Text style={styles.helper}>“Good moves” = Best + Excellent + Good. This is an engine-based estimate, not Chess.com’s proprietary accuracy score.</Text>
                <View style={styles.reviewGoodRow}>
                  <View style={styles.reviewGoodCard}><Text style={styles.reviewGoodLabel}>{importedGame?.headers?.White || 'White'} · GOOD+</Text><Text style={styles.reviewGoodValue}>{pgnAnalysis.filter(x => x.color === 'w' && ['Best', 'Excellent', 'Good'].includes(x.classification)).length}</Text></View>
                  <View style={styles.reviewGoodCard}><Text style={styles.reviewGoodLabel}>{importedGame?.headers?.Black || 'Black'} · GOOD+</Text><Text style={styles.reviewGoodValue}>{pgnAnalysis.filter(x => x.color === 'b' && ['Best', 'Excellent', 'Good'].includes(x.classification)).length}</Text></View>
                </View>
              </View>}
              <View style={styles.pgnCard}>
                <Text style={styles.sectionTitle}>Import a Chess.com game</Text>
                <Text style={styles.helper}>Export your game from Chess.com as PGN, then select the .pgn file or paste its contents here.</Text>
                <Pressable onPress={choosePgnFile} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Choose PGN file</Text>
                </Pressable>
                <TextInput
                  value={pgnText}
                  onChangeText={setPgnText}
                  placeholder={'Paste PGN here…\n[Event "Live Chess"]\n1. e4 e5 2. Nf3 Nc6'}
                  placeholderTextColor="#73819a"
                  multiline
                  autoCapitalize="none"
                  style={styles.pgnInput}
                  textAlignVertical="top"
                />
                <Pressable onPress={importPgnGame} style={styles.primaryButton}>
                  <Text style={styles.primaryText}>Import game</Text>
                </Pressable>
                {!!pgnError && <Text style={styles.pgnError}>{pgnError}</Text>}
                {importedGame && (
                  <View style={styles.importedSummary}>
                    <Text style={styles.importedTitle}>{importedGame.headers.White || 'White'} vs {importedGame.headers.Black || 'Black'}</Text>
                    <Text style={styles.helper}>{importedGame.headers.Event || 'Imported PGN'} · {importedGame.plies.length} half-moves · Result {importedGame.result}</Text>
                    <Pressable onPress={analyzeImportedGame} disabled={pgnAnalyzing} style={styles.primaryButton}>
                      {pgnAnalyzing ? <ActivityIndicator color="#10180d" /> : <Text style={styles.primaryText}>Analyse full game with Stockfish</Text>}
                    </Pressable>
                    {pgnAnalyzing && <Text style={styles.helper}>Analysing {pgnProgress}/{Math.min(importedGame.plies.length, 60)} moves with Stockfish… Keep this screen open.</Text>}
                    {!!pgnAnalysis.length && <Text style={styles.importedTitle}>Engine review · {pgnAnalysis.length} moves analysed</Text>}
                    {pgnAnalysis.map(item => (
                      <View key={item.index} style={styles.pgnMoveRow}>
                        <View style={styles.pgnMoveLabelBlock}><Text style={styles.pgnMoveLabel}>{item.fullMove}{item.color === 'w' ? '.' : '…'} {item.san}</Text><Text style={[styles.moveClassTag, item.classification === 'Best' || item.classification === 'Excellent' ? styles.moveClassGood : item.classification === 'Blunder' || item.classification === 'Mistake' ? styles.moveClassBad : styles.moveClassOkay]}>{item.classification || (item.bestMovePlayed ? 'Top move' : 'Review')}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pgnMoveEval}>{item.mate !== null && item.mate !== undefined ? 'Mate ' + item.mate : 'Eval ' + (Number(item.evaluation) > 0 ? '+' : '') + Number(item.evaluation || 0).toFixed(2)}</Text>
                          <Text style={styles.helper}>Best: {item.bestmove || 'Unavailable'} · loss {Math.round(item.evalLoss || 0)} cp · {item.engine || 'Stockfish'}</Text>
                          {!!item.continuation && <Text style={styles.pgnLine}>Line: {item.continuation}</Text>}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.ratingHero}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ratingEyebrow}>YOUR RAPID RATING</Text>
                  <Text style={styles.ratingNumber}>{playerElo}</Text>
                  <Text style={styles.ratingCaption}>{ratedGames} rated {ratedGames === 1 ? 'game' : 'games'} · provisional</Text>
                </View>
                <View style={styles.ratingDivider} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.ratingEyebrow}>STOCKFISH</Text>
                  <Text style={styles.engineRating}>3000+*</Text>
                  <Text style={styles.ratingCaption}>Estimated engine equivalent</Text>
                </View>
              </View>
              {lastResult && (
                <View style={styles.lastGameCard}>
                  <View style={styles.difficultyHeading}>
                    <Text style={styles.sectionTitle}>Last rated game</Text>
                    <Text style={[styles.resultPill, lastResult.result === 'Win' ? styles.winPill : lastResult.result === 'Loss' ? styles.lossPill : styles.drawPill]}>{lastResult.result.toUpperCase()}</Text>
                  </View>
                  <View style={styles.ratingChangeRow}>
                    <Text style={styles.ratingChangeLabel}>Rating change</Text>
                    <Text style={[styles.ratingChange, lastResult.delta >= 0 ? { color: COLORS.green } : { color: COLORS.red }]}>{lastResult.delta > 0 ? '+' : ''}{lastResult.delta} Elo</Text>
                  </View>
                  <Text style={styles.helper}>Against {lastResult.botName || lastResult.level + ' AI'} · {lastResult.moves} half-moves · opponent target {lastResult.opponentElo} Elo</Text>
                </View>
              )}
              <Pressable onPress={analyzeCurrentPosition} disabled={analyzing} style={styles.primaryButton}>
                {analyzing ? <ActivityIndicator color="#10180d" /> : <Text style={styles.primaryText}>Analyse current position with Stockfish</Text>}
              </Pressable>
              {analysis && (
                <View style={styles.analysisCard}>
                  <Text style={styles.coachTitle}>{analysis.engine || 'STOCKFISH'} · DEPTH {analysis.depth}</Text>
                  <Text style={styles.coachBody}>Evaluation: {analysis.mate !== null && analysis.mate !== undefined ? 'Mate in ' + analysis.mate : (Number(analysis.evaluation) > 0 ? '+' : '') + Number(analysis.evaluation || 0).toFixed(2)} · Best move: {analysis.bestmove || 'Not available'}</Text>
                  {!!analysis.continuation && <Text style={styles.helper}>Best line: {analysis.continuation}</Text>}
                </View>
              )}
              <Text style={styles.ratingFootnote}>Player Elo updates only when a game against the computer is completed. AI opponent ratings are estimates for the selected difficulty; Stockfish 3000+ is a rough strength equivalent, not an official rating.</Text>
            </View>
          )}

          {tab === 'Play' && (
            <View style={styles.playerRowBottom}>
              <View style={styles.avatarYou}><Text style={styles.avatarText}>YOU</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.playerName}>{playMode === 'pvp' ? 'White · Player 1' : 'You'}</Text>
                <Text style={styles.playerMeta}>{playMode === 'pvp' ? 'White pieces · Player 1' : 'White pieces · ' + playerElo + ' Elo'}</Text>
              </View>
              {aiThinking ? <ActivityIndicator color={COLORS.green} /> : <Text style={styles.turnLabel}>{timeoutSide ? 'TIME OUT' : game.isGameOver() ? 'FINISHED' : playMode === 'pvp' ? (game.turn() === 'w' ? 'WHITE TO MOVE' : 'BLACK TO MOVE') : game.turn() === 'w' ? 'YOUR TURN' : 'WAITING'}</Text>}
            </View>
          )}

          {tab === 'Play' && fullScreen && <Text style={styles.fullscreenHint}>{clockStarted ? 'Clock running · ' + (game.turn() === 'w' ? 'White' : 'Black') + ' to move' : 'Choose a time control and tap Start game'}</Text>}
          <View style={styles.actions}>
            <Pressable onPress={undo} disabled={!history.length || aiThinking} style={[styles.secondaryButton, (!history.length || aiThinking) && styles.disabledButton]}>
              <Text style={styles.secondaryText}>↶ Undo</Text>
            </Pressable>
            <Pressable onPress={tab === 'Learn' ? playLessonMove : restart} style={styles.primaryButton}>
              <Text style={styles.primaryText}>{tab === 'Learn' ? (currentLesson ? 'Next lesson move  →' : 'Lesson complete ✓') : '↻ New game'}</Text>
            </Pressable>
            <Pressable onPress={() => { restart(); resetClock(timeMinutes, false); }} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>↻</Text>
            </Pressable>
          </View>
        </View>

        {!(fullScreen && tab === 'Play') && <>
        <View style={styles.coachCard}>
          <View style={styles.coachIcon}><Text style={styles.coachIconText}>✦</Text></View>
          <View style={{ flex: 1 }}>
            <View style={styles.coachTitleRow}>
              <Text style={styles.coachTitle}>Coach's corner</Text>
              {tab === 'Play' && <Text style={styles.engineState}>{playMode === 'pvp' ? 'OFFLINE · NO ENGINE' : engineLabel}</Text>}
            </View>
            <Text style={styles.coachBody}>{message}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{tab === 'Review' ? 'Move history' : tab === 'Play' ? 'Your match' : selectedOpening.name + ' · Main line'}</Text>
          <Text style={styles.counter}>{tab === 'Review' ? history.length + ' plies' : tab === 'Play' ? level + ' AI' : progress + '/' + LESSONS.length + ' steps'}</Text>
        </View>

        {tab === 'Review' ? (
          <View style={styles.reviewCard}>
            {movePairs.length ? movePairs.map(pair => (
              <View key={pair.number} style={styles.moveRow}>
                <Text style={styles.moveNumber}>{pair.number}.</Text>
                <Text style={styles.moveSan}>{pair.white}</Text>
                <Text style={styles.moveSan}>{pair.black || '…'}</Text>
              </View>
            )) : <Text style={styles.emptyText}>Your moves will appear here when you start playing.</Text>}
          </View>
        ) : tab === 'Play' ? (
          <View style={styles.reviewCard}>
            <View style={styles.matchStat}><Text style={styles.statLabel}>MOVES PLAYED</Text><Text style={styles.statValue}>{history.length}</Text></View>
            <View style={styles.matchStat}><Text style={styles.statLabel}>CURRENT LEVEL</Text><Text style={styles.statValue}>{level}</Text></View>
            <View style={styles.matchStat}><Text style={styles.statLabel}>ENGINE</Text><Text style={styles.statValueSmall}>{engineLabel}</Text></View>
            <Text style={styles.helper}>{playMode === 'pvp' ? 'Offline local multiplayer. Both players use the same device; engine and internet are not used.' : 'Stockfish is used when available. If the engine is unavailable, the built-in chess AI can take over.'}</Text>
          </View>
        ) : (
          <View style={styles.lessonList}>
            {LESSONS.map((lesson, index) => (
              <View key={lesson.san} style={styles.lessonRow}>
                <View style={[styles.lessonNumber, index < lessonIndex && styles.lessonDone]}>
                  <Text style={styles.lessonNumberText}>{index < lessonIndex ? '✓' : String(index + 1).padStart(2, '0')}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lessonTitle}>{lesson.title}</Text>
                  <Text style={styles.lessonDesc}>{lesson.body}</Text>
                </View>
                <Text style={styles.lessonSan}>{lesson.san}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>BUILT FOR YOUR NEXT MOVE</Text>
          <View style={styles.featureGrid}>
            <View style={styles.featureItem}><Text style={styles.featureIcon}>♟</Text><Text style={styles.featureName}>Legal moves</Text></View>
            <View style={styles.featureItem}><Text style={styles.featureIcon}>⚡</Text><Text style={styles.featureName}>AI opponent</Text></View>
            <View style={styles.featureItem}><Text style={styles.featureIcon}>♜</Text><Text style={styles.featureName}>Move review</Text></View>
          </View>
          <Text style={styles.licenseNote}>Stockfish is GPLv3 software. Local engine supplied by dawikk-stockfish; online analysis is an optional fallback. Source and licence details are documented in the repository README.</Text>
        </View>
        </>}
        <Text style={styles.footer}>ROYAL GAMBIT  ·  PLAY WITH INTENTION</Text>
      </ScrollView>
      {!(fullScreen && tab === 'Play') && <View style={styles.bottomNav}>
        {[
          { id: 'Learn', icon: '⌂', label: 'Home' },
          { id: 'Play', icon: '♟', label: 'Play' },
          { id: 'Review', icon: '▤', label: 'Review' }
        ].map(item => <Pressable key={item.id} onPress={() => switchBoardTab(item.id)} style={styles.bottomNavItem}>
          <View style={[styles.bottomNavIcon, tab === item.id && styles.bottomNavIconActive]}><Text style={[styles.bottomNavGlyph, tab === item.id && styles.bottomNavGlyphActive]}>{item.icon}</Text></View>
          <Text style={[styles.bottomNavLabel, tab === item.id && styles.bottomNavLabelActive]}>{item.label}</Text>
        </Pressable>)}
      </View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  page: { paddingHorizontal: 17, paddingTop: 14, paddingBottom: 30, gap: 15, alignItems: 'center' },
  header: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  brandBlock: { flex: 1 },
  eyebrow: { fontSize: 9, letterSpacing: 2.2, color: COLORS.gold, fontWeight: '900' },
  brand: { fontSize: 29, fontWeight: '900', color: COLORS.text, letterSpacing: -1.1, marginTop: 4 },
  brandAccent: { color: COLORS.gold },
  tagline: { fontSize: 11, color: COLORS.muted, marginTop: 4, letterSpacing: 0.25 },
  levelBadge: { borderWidth: 1, borderColor: '#526B4D', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, backgroundColor: '#183326' },
  levelBadgeText: { fontSize: 10, color: COLORS.gold, fontWeight: '900', letterSpacing: 0.4 },
  tabs: { width: '100%', flexDirection: 'row', backgroundColor: COLORS.panel, padding: 4, borderRadius: 14, borderWidth: 1, borderColor: '#1e2a3e' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10 },
  tabActive: { backgroundColor: '#2a3b52' },
  tabText: { color: '#8290a8', fontWeight: '800', fontSize: 13 },
  tabTextActive: { color: COLORS.text },
  openingChip: { backgroundColor: COLORS.panel2, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, minWidth: 132, gap: 4 },
  openingChipActive: { backgroundColor: '#29452f', borderColor: '#75b95a' },
  openingChipTitle: { color: COLORS.text, fontSize: 12, fontWeight: '900' },
  openingChipTitleActive: { color: COLORS.green },
  openingChipTag: { color: COLORS.muted, fontSize: 9, fontWeight: '700' },
  botRail: { gap: 10, paddingVertical: 8, paddingRight: 4 },
  botCard: { width: 146, backgroundColor: COLORS.panel2, borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, padding: 12, gap: 5 },
  botCardActive: { borderColor: COLORS.green, backgroundColor: '#263a2b' },
  botAvatar: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#34483a', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  botAvatarActive: { backgroundColor: '#547a43' },
  botAvatarText: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
  botName: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  botElo: { color: COLORS.muted, fontSize: 16, fontWeight: '900' },
  botEloActive: { color: COLORS.green },
  botTag: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  botStyle: { color: COLORS.muted, fontSize: 10, lineHeight: 14, minHeight: 30 },
  botSelected: { color: COLORS.green, fontSize: 9, fontWeight: '900', marginTop: 2 },
  pageFullscreen: { padding: 4, paddingTop: 4, paddingBottom: 6, gap: 6, justifyContent: 'center', flexGrow: 1 },
  boardCardFullscreen: { padding: 4, borderRadius: 8, gap: 5, justifyContent: 'center', flexGrow: 1 },
  boardFullscreen: { borderRadius: 3 },
  fullscreenButton: { backgroundColor: '#34483a', paddingHorizontal: 9, paddingVertical: 8, borderRadius: 9 },
  fullscreenButtonText: { color: COLORS.green, fontSize: 10, fontWeight: '900' },
  timeControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  timeChip: { backgroundColor: COLORS.panel2, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  timeChipActive: { borderColor: COLORS.green, backgroundColor: '#29452f' },
  timeChipText: { color: COLORS.muted, fontSize: 11, fontWeight: '800' },
  timeChipTextActive: { color: COLORS.green },
  clockSetupRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  customTimeInput: { flex: 1, minWidth: 70, color: COLORS.text, backgroundColor: COLORS.panel2, borderWidth: 1, borderColor: COLORS.line, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12 },
  timeApply: { backgroundColor: '#34483a', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 9 },
  timeApplyText: { color: COLORS.green, fontSize: 10, fontWeight: '900' },
  clockBar: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingHorizontal: 2, paddingVertical: 4 },
  clockPlayer: { flex: 1, backgroundColor: '#202b24', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clockPlayerName: { color: COLORS.muted, fontSize: 8, fontWeight: '900', flex: 1 },
  clockValue: { color: COLORS.text, fontSize: 19, fontWeight: '900', fontVariant: ['tabular-nums'] },
  clockActive: { color: COLORS.green },
  fullscreenHint: { color: COLORS.muted, fontSize: 9, textAlign: 'center', marginTop: 3 },
  difficultyCard: { width: '100%', backgroundColor: COLORS.panel, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, gap: 11 },
  difficultyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  onlineTag: { color: COLORS.green, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  helper: { color: COLORS.muted, fontSize: 11, lineHeight: 17 },
  levels: { flexDirection: 'row', gap: 8, marginTop: 4 },
  levelButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.panel2, borderWidth: 1, borderColor: COLORS.line },
  levelButtonActive: { backgroundColor: '#29452f', borderColor: '#5f9e50' },
  levelText: { color: '#a8b4c8', fontWeight: '800', fontSize: 12 },
  levelTextActive: { color: COLORS.green },
  boardCard: { width: '100%', backgroundColor: '#10271D', borderRadius: 22, padding: 13, borderWidth: 1, borderColor: '#31513D', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 5 },
  boardHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 13 },
  boardTitle: { fontSize: 17, color: COLORS.text, fontWeight: '900', letterSpacing: -0.3 },
  status: { color: COLORS.muted, fontSize: 11, marginTop: 4 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.green },
  statusDotEnd: { backgroundColor: COLORS.gold },
  playerRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 3, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#26344a', marginBottom: 10 },
  playerRowBottom: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 3, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#26344a', marginTop: 10 },
  avatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#28394d', alignItems: 'center', justifyContent: 'center' },
  avatarYou: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#315137', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.text, fontWeight: '900', fontSize: 12 },
  playerName: { color: COLORS.text, fontWeight: '800', fontSize: 12 },
  playerMeta: { color: COLORS.muted, fontSize: 10, marginTop: 2 },
  playerRating: { color: COLORS.green, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  turnLabel: { color: COLORS.green, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  board: { position: 'relative', flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden', borderRadius: 8, alignSelf: 'center', borderWidth: 2, borderColor: '#D8C9A9' },
  square: { alignItems: 'center', justifyContent: 'center' },
  piece: { fontWeight: '400', textAlign: 'center', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  rank: { position: 'absolute', top: 2, left: 3, fontSize: 8, color: '#17211c', fontWeight: '900' },
  file: { position: 'absolute', bottom: 1, right: 3, fontSize: 8, color: '#17211c', fontWeight: '900' },
  target: { position: 'absolute', width: 12, height: 12, borderRadius: 8, backgroundColor: '#213d2b', opacity: 0.65 },
  targetCapture: { width: '86%', height: '86%', backgroundColor: 'transparent', borderWidth: 3, borderColor: '#213d2b' },
  actions: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  primaryButton: { flex: 1, backgroundColor: COLORS.gold, paddingVertical: 14, borderRadius: 13, alignItems: 'center' },
  primaryText: { fontSize: 12, color: '#17251B', fontWeight: '900', letterSpacing: 0.2 },
  secondaryButton: { backgroundColor: '#254333', paddingHorizontal: 13, paddingVertical: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#3C6049' },
  secondaryText: { color: '#E5EBDD', fontWeight: '800', fontSize: 12 },
  disabledButton: { opacity: 0.4 },
  coachCard: { width: '100%', flexDirection: 'row', gap: 12, backgroundColor: '#142D21', borderWidth: 1, borderColor: '#35583E', borderRadius: 18, padding: 15 },
  coachIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#294a34', alignItems: 'center', justifyContent: 'center' },
  coachIconText: { fontSize: 22, color: COLORS.green },
  coachTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  coachTitle: { color: '#c1f5a7', fontWeight: '900', fontSize: 13, marginBottom: 5 },
  engineState: { color: '#9eb29f', fontSize: 9, fontWeight: '700' },
  coachBody: { color: '#d4dfd8', fontSize: 12, lineHeight: 18 },
  sectionHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  counter: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  lessonList: { width: '100%', gap: 10 },
  lessonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: COLORS.panel, borderRadius: 16, padding: 13, borderWidth: 1, borderColor: COLORS.line },
  lessonNumber: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#29394f', alignItems: 'center', justifyContent: 'center' },
  lessonDone: { backgroundColor: '#285037' },
  lessonNumberText: { fontSize: 10, fontWeight: '900', color: '#d4deec' },
  lessonTitle: { fontSize: 12, fontWeight: '900', color: '#edf1f8', marginTop: 1 },
  lessonDesc: { fontSize: 11, lineHeight: 16, color: '#8e9bb3', marginTop: 4 },
  lessonSan: { color: COLORS.green, fontSize: 12, fontWeight: '900', paddingTop: 4 },
  reviewCard: { width: '100%', backgroundColor: COLORS.panel, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, gap: 10 },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#202c40' },
  moveNumber: { width: 24, color: COLORS.muted, fontSize: 12 },
  moveSan: { flex: 1, color: '#d7deeb', fontSize: 13, fontWeight: '700' },
  emptyText: { color: COLORS.muted, fontSize: 11 },
  matchStat: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#26344a' },
  statLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statValue: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  statValueSmall: { color: COLORS.green, fontSize: 11, fontWeight: '800' },
  featureCard: { width: '100%', padding: 14, backgroundColor: '#101827', borderWidth: 1, borderColor: '#29364b', borderRadius: 15, gap: 12 },
  featureTitle: { color: '#aab7cb', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  featureGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  featureItem: { flex: 1, alignItems: 'center', gap: 5, backgroundColor: '#192438', paddingVertical: 12, borderRadius: 11 },
  featureIcon: { color: COLORS.green, fontSize: 20 },
  featureName: { color: '#c6d0df', fontSize: 9, fontWeight: '800' },
  licenseNote: { color: '#78869e', fontSize: 9, lineHeight: 14 },
  footer: { width: '100%', textAlign: 'center', fontSize: 9, letterSpacing: 2, color: '#718578', marginTop: 8, marginBottom: 4 },
  homeHero: { width: '100%', backgroundColor: '#142F22', borderRadius: 24, padding: 19, borderWidth: 1, borderColor: '#456447', gap: 10, overflow: 'hidden' },
  heroTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroEyebrow: { color: '#D9B66F', fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#203F2C', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C4D99A' },
  onlinePillText: { color: '#DCE8D1', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  heroTitle: { color: '#F4F0E5', fontSize: 29, lineHeight: 34, fontWeight: '900', letterSpacing: -0.8, marginTop: 6 },
  heroCopy: { color: '#B7C7B8', fontSize: 12, lineHeight: 18, maxWidth: 290 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 5 },
  heroPrimary: { backgroundColor: '#D9B66F', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 12 },
  heroPrimaryText: { color: '#18271C', fontSize: 11, fontWeight: '900' },
  heroSecondary: { paddingHorizontal: 11, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#59704F' },
  heroSecondaryText: { color: '#E8E6D9', fontSize: 10, fontWeight: '800' },
  heroStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 13, marginTop: 5, borderTopWidth: 1, borderTopColor: '#36563B' },
  heroStat: { flex: 1, gap: 3 },
  heroStatValue: { color: '#F4F0E5', fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  heroStatLabel: { color: '#A9BCA8', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  heroStatDivider: { width: 1, height: 29, backgroundColor: '#466247', marginHorizontal: 10 },
  bottomNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 9, paddingBottom: 7, paddingHorizontal: 22, backgroundColor: '#0C2118', borderTopWidth: 1, borderTopColor: '#294534' },
  bottomNavItem: { flex: 1, alignItems: 'center', gap: 3 },
  bottomNavIcon: { width: 54, height: 30, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bottomNavIconActive: { backgroundColor: '#294A36' },
  bottomNavGlyph: { color: '#91A494', fontSize: 19, fontWeight: '800' },
  bottomNavGlyphActive: { color: '#D9B66F' },
  bottomNavLabel: { color: '#91A494', fontSize: 9, fontWeight: '800' },
  bottomNavLabelActive: { color: '#E8E6D9' },
  movingPiece: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  reviewTopBar: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewCoachAvatar: { width: 62, height: 70, borderRadius: 14, backgroundColor: '#55433a', alignItems: 'center', justifyContent: 'center' },
  reviewCoachAvatarText: { fontSize: 42, color: '#f4d7b0' },
  reviewCoachBubble: { flex: 1, backgroundColor: '#f7f5f0', padding: 14, borderRadius: 16, borderBottomLeftRadius: 4 },
  reviewCoachText: { color: '#282625', fontSize: 13, fontWeight: '700', lineHeight: 19 },
  engineModeCard: { width: '100%', backgroundColor: '#292727', borderRadius: 14, padding: 12, gap: 8 },
  engineModeRow: { flexDirection: 'row', gap: 6 },
  engineModeButton: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center', backgroundColor: '#403d3d', borderWidth: 1, borderColor: '#504b4b' },
  engineModeButtonActive: { backgroundColor: '#6f9f43', borderColor: '#94c963' },
  engineModeText: { color: '#d0cecb', fontSize: 10, fontWeight: '800' },
  engineModeTextActive: { color: '#fff', fontSize: 10, fontWeight: '900' },
  reviewSummaryCard: { width: '100%', backgroundColor: '#393636', borderRadius: 12, padding: 12, gap: 10 },
  reviewSummaryTitle: { color: '#f7f5f0', fontSize: 14, fontWeight: '900' },
  reviewGraph: { height: 54, backgroundColor: '#4a4646', borderRadius: 7, justifyContent: 'center', overflow: 'hidden' },
  reviewGraphLine: { height: 3, backgroundColor: '#8fbe57', borderRadius: 2 },
  reviewPlayers: { flexDirection: 'row', justifyContent: 'space-between' },
  reviewPlayerName: { color: '#f7f5f0', fontWeight: '900', fontSize: 12 },
  reviewStatsRow: { flexDirection: 'row', gap: 8 },
  reviewStat: { flex: 1, alignItems: 'center', backgroundColor: '#4a4646', borderRadius: 8, paddingVertical: 10 },
  reviewStatValue: { color: '#f7f5f0', fontSize: 22, fontWeight: '900' },
  reviewStatLabel: { color: '#d3ceca', fontSize: 9, fontWeight: '700', marginTop: 3 },
  reviewTableHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#555050', gap: 6 },
  reviewTablePlayer: { flex: 1, color: '#f5f3ef', fontSize: 10, fontWeight: '900', textAlign: 'center' },
  reviewTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#454141', gap: 6 },
  reviewTableCategory: { flex: 1.25, fontSize: 11, fontWeight: '800' },
  reviewTableCount: { flex: 1, textAlign: 'center', color: '#f7f5f0', fontSize: 15, fontWeight: '900' },
  reviewTableTotals: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, gap: 6 },
  reviewGoodRow: { flexDirection: 'row', gap: 8, marginTop: 5 },
  reviewGoodCard: { flex: 1, backgroundColor: '#24402d', borderRadius: 10, padding: 11, gap: 4 },
  reviewGoodLabel: { color: '#bde4a0', fontSize: 9, fontWeight: '900' },
  reviewGoodValue: { color: '#f5fff0', fontSize: 26, fontWeight: '900' },
  pgnMoveLabelBlock: { width: 72, gap: 4 },
  moveClassTag: { alignSelf: 'flex-start', fontSize: 8, fontWeight: '900', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5, overflow: 'hidden' },
  moveClassGood: { color: '#d7f3b5', backgroundColor: '#31513a' },
  moveClassOkay: { color: '#f7d98c', backgroundColor: '#554628' },
  moveClassBad: { color: '#ffb1a8', backgroundColor: '#5a302e' },
  ratingHero: { width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#172a22', borderRadius: 16, borderWidth: 1, borderColor: '#355640', padding: 16, gap: 14 },
  ratingEyebrow: { color: '#a9c7ad', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  ratingNumber: { color: '#f4f7fb', fontSize: 38, fontWeight: '900', letterSpacing: -1.5, marginTop: 4 },
  engineRating: { color: COLORS.gold, fontSize: 25, fontWeight: '900', marginTop: 9 },
  ratingCaption: { color: '#9fb2a3', fontSize: 9, lineHeight: 14, marginTop: 3 },
  ratingDivider: { width: 1, height: 58, backgroundColor: '#45614c' },
  lastGameCard: { width: '100%', backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, padding: 14, gap: 10 },
  resultPill: { overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, fontSize: 9, fontWeight: '900' },
  winPill: { color: '#baf59a', backgroundColor: '#244b32' },
  lossPill: { color: '#ffaaaa', backgroundColor: '#4b292d' },
  drawPill: { color: '#f5d58d', backgroundColor: '#4a3d25' },
  ratingChangeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ratingChangeLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  ratingChange: { fontSize: 16, fontWeight: '900' },
  ratingFootnote: { color: '#7f8da3', fontSize: 9, lineHeight: 14 },
  analysisCard: { width: '100%', backgroundColor: COLORS.panel2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, padding: 12, gap: 6 },
  pgnCard: { width: '100%', backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, padding: 14, gap: 10 },
  pgnInput: { minHeight: 116, maxHeight: 190, color: COLORS.text, backgroundColor: COLORS.panel2, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, padding: 11, fontSize: 11 },
  pgnError: { color: '#ff9999', fontSize: 11, lineHeight: 16 },
  importedSummary: { gap: 9, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 10 },
  importedTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  pgnMoveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderTopWidth: 1, borderTopColor: '#26344a', paddingVertical: 8 },
  pgnMoveLabel: { width: 58, color: COLORS.green, fontSize: 11, fontWeight: '900' },
  pgnMoveEval: { color: COLORS.text, fontSize: 11, fontWeight: '800' },
  pgnLine: { color: '#9ba9bf', fontSize: 10, lineHeight: 15, marginTop: 3 },
});
