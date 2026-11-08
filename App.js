import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView, View, Text, Pressable, ScrollView, StyleSheet,
  StatusBar, ActivityIndicator, useWindowDimensions, Animated
} from 'react-native';
import { Chess } from 'chess.js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
  bg: '#080d18', panel: '#111a2b', panel2: '#172338', line: '#26364d',
  text: '#f4f7fb', muted: '#91a0b8', green: '#a8ed78',
  greenDark: '#1d3b2b', light: '#eee9dc', dark: '#77927d',
  gold: '#f2c66d', red: '#ff7777'
};
const FILES = 'abcdefgh';
const PIECES = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
};
const LESSONS = [
  { san: 'e4', title: 'Claim the centre', body: 'Your king pawn controls d5 and f5 while opening lines for your queen and bishop.' },
  { san: 'e5', title: 'Contest the centre', body: 'Black fights for central space. Good openings are built on central control and development.' },
  { san: 'Nf3', title: 'Develop with a threat', body: 'The knight moves toward the centre and attacks e5. Develop minor pieces before launching an attack.' },
  { san: 'Nc6', title: 'Defend and develop', body: 'Black develops a knight and protects the e5 pawn. Both sides are bringing pieces into the game.' },
  { san: 'Bc4', title: 'Target the f7 square', body: 'The bishop aims at f7, a sensitive opening square. White can now prepare to castle.' }
];
const VALUES = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20000 };
const freshGame = () => new Chess();

function evaluateWhite(game) {
  if (game.isCheckmate()) return game.turn() === 'w' ? -100000 : 100000;
  if (game.isDraw()) return 0;
  const board = game.board();

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
    if (tab !== 'Play' || !game.isGameOver() || !ratingReady) return;
    const key = game.history().join(' ');
    if (!key || ratedGameKey.current === key) return;
    ratedGameKey.current = key;
    const opponentElo = level === 'Easy' ? 650 : level === 'Medium' ? 1000 : 1450;
    const score = game.isDraw() ? 0.5 : game.turn() === 'b' ? 1 : 0;
    const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    const delta = Math.round(32 * (score - expected));
    const nextRating = Math.max(100, playerElo + delta);
    const result = score === 0.5 ? 'Draw' : score === 1 ? 'Win' : 'Loss';
    setPlayerElo(nextRating);
    setRatedGames(n => n + 1);
    setLastResult({ result, delta, opponentElo, level, moves: game.history().length, date: new Date().toISOString() });
  }, [game, tab, level, playerElo, ratingReady]);
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

async function getStockfishMove(fen, level) {
  const depth = level === 'Hard' ? 14 : level === 'Medium' ? 9 : 5;
  const url = 'https://stockfish.online/api/s/v2.php?fen=' + encodeURIComponent(fen) + '&depth=' + depth;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error('Stockfish service unavailable');
  const data = await response.json();
  const raw = String(data.bestmove || data.bestMove || '');
  const match = raw.match(/bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/i) || raw.match(/^([a-h][1-8][a-h][1-8][qrbn]?)/i);
  if (!match) throw new Error('No legal engine move returned');
  const uci = match[1];
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4] || 'q'
  };
}

export default function App() {
  const { width } = useWindowDimensions();
  const [game, setGame] = useState(freshGame);
  const [selected, setSelected] = useState(null);
  const [targets, setTargets] = useState([]);
  const [history, setHistory] = useState([]);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [tab, setTab] = useState('Learn');
  const [level, setLevel] = useState('Medium');
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
  const animationPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const aiBusy = useRef(false);
  const currentLesson = LESSONS[lessonIndex] || null;
  const boardSize = Math.min(width - 60, 430);
  const board = game.board();

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
    if (tab !== 'Play' || !game.isGameOver() || !ratingReady) return;
    const key = game.history().join(' ');
    if (!key || ratedGameKey.current === key) return;
    ratedGameKey.current = key;
    const opponentElo = level === 'Easy' ? 650 : level === 'Medium' ? 1000 : 1450;
    const score = game.isDraw() ? 0.5 : game.turn() === 'b' ? 1 : 0;
    const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    const delta = Math.round(32 * (score - expected));
    const nextRating = Math.max(100, playerElo + delta);
    const result = score === 0.5 ? 'Draw' : score === 1 ? 'Win' : 'Loss';
    setPlayerElo(nextRating);
    setRatedGames(n => n + 1);
    setLastResult({ result, delta, opponentElo, level, moves: game.history().length, date: new Date().toISOString() });
  }, [game, tab, level, playerElo, ratingReady]);

  const status = game.isCheckmate()
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

  async function analyzeCurrentPosition() {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const url = 'https://stockfish.online/api/s/v2.php?fen=' + encodeURIComponent(game.fen()) + '&depth=15';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Stockfish service unavailable');
      const data = await response.json();
      if (data.success === false) throw new Error(data.error || 'Analysis failed');
      setAnalysis({ evaluation: data.evaluation, mate: data.mate, bestmove: data.bestmove, continuation: data.continuation, depth: data.depth || 15 });
      setMessage('Stockfish analysed this position. Check the engine result below.');
      setEngineLabel('Stockfish analysis · depth 15');
    } catch (error) {
      setMessage('Stockfish analysis needs an internet connection. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  function recordPosition(next, move, note) {
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
    if (game.isGameOver()) return;
    if (tab === 'Play' && game.turn() === 'b') return;
    if (selected && targets.includes(square)) {
      const next = new Chess(game.fen());
      try {
        const move = next.move({ from: selected, to: square, promotion: 'q' });
        if (move) {
          recordPosition(next, move, 'Nice move: ' + move.san + '. ' + (next.isCheck() ? 'Check!' : 'Keep developing and watch your opponent threats.'));
          return;
        }
      } catch (error) {
        // The board stays unchanged if a move is rejected.
      }
    }
    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setSelected(square);
      setTargets(legalTargets(square));
      setMessage((piece.color === 'w' ? 'White ' : 'Black ') + piece.type.toUpperCase() + ' selected. Pick a highlighted square.');
    } else {
      setSelected(null);
      setTargets([]);
      setMessage('That square is not a legal destination. Select one of your pieces.');
    }
  }

  function undo() {
    if (!history.length) return;
    const removeCount = tab === 'Play' ? Math.min(2, history.length) : 1;
    const remaining = history.slice(0, -removeCount);
    const replay = freshGame();
    remaining.forEach(san => {
      try { replay.move(san); } catch (error) {}
    });
    setGame(replay);
    setHistory(remaining);
    setSelected(null);
    setTargets([]);
    setMessage('Last move' + (removeCount === 2 ? ' pair' : '') + ' undone. Try another plan.');
  }

  function restart() {
    ratedGameKey.current = '';
    const next = freshGame();
    setGame(next);
    setHistory([]);
    setSelected(null);
    setTargets([]);
    setLessonIndex(0);
    setMessage(tab === 'Play' ? 'New game. You are White; make the first move.' : 'New game. Start with 1. e4 to control the centre.');
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
    if (tab !== 'Play' || game.turn() !== 'b' || game.isGameOver() || aiBusy.current) return undefined;
    let cancelled = false;
    aiBusy.current = true;
    setAiThinking(true);
    setMessage('The coach is thinking…');
    (async () => {
      let move = null;
      try {
        move = await getStockfishMove(game.fen(), level);
        if (!cancelled) setEngineLabel('Stockfish online');
      } catch (error) {
        move = chooseLocalMove(game.fen(), level);
        if (!cancelled) setEngineLabel('Built-in AI · offline fallback');
      }
      if (!cancelled && move) {
        const next = new Chess(game.fen());
        try {
          const played = next.move(move);
          if (played) {
            setSelected(null);
            setTargets([]);
            animatePosition(next, played, 'Computer played ' + played.san + '. Find your next plan.');
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
  }, [tab, game, level]);

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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <Text style={styles.eyebrow}>THINK. PLAY. IMPROVE.</Text>
            <Text style={styles.brand}>Chess Coach <Text style={styles.brandAccent}>AI</Text></Text>
            <Text style={styles.tagline}>Your personal chess training room</Text>
          </View>
          <View style={styles.levelBadge}><Text style={styles.levelBadgeText}>♟ BEGINNER</Text></View>
        </View>

        <View style={styles.tabs}>
          {['Learn', 'Play', 'Review'].map(item => (
            <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}>
              <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'Play' && (
          <View style={styles.difficultyCard}>
            <View style={styles.difficultyHeading}>
              <Text style={styles.sectionTitle}>Play the computer</Text>
              <Text style={styles.onlineTag}>● ENGINE</Text>
            </View>
            <Text style={styles.helper}>Choose how challenging your opponent should be.</Text>
            <View style={styles.levels}>
              {['Easy', 'Medium', 'Hard'].map(item => (
                <Pressable key={item} onPress={() => setLevel(item)} style={[styles.levelButton, level === item && styles.levelButtonActive]}>
                  <Text style={[styles.levelText, level === item && styles.levelTextActive]}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.boardCard}>
          <View style={styles.boardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.boardTitle}>{tab === 'Learn' ? 'The Italian Game' : tab === 'Play' ? 'You vs Computer' : 'Game review'}</Text>
              <Text style={styles.status}>{aiThinking ? 'Computer is thinking…' : status}</Text>
            </View>
            <View style={[styles.statusDot, game.isGameOver() && styles.statusDotEnd]} />
          </View>

          {tab === 'Play' && (
            <View style={styles.playerRow}>
              <View style={styles.avatar}><Text style={styles.avatarText}>♟</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.playerName}>Chess Coach AI</Text>
                <Text style={styles.playerMeta}>{level} level · Black pieces</Text>
              </View>
              <Text style={styles.playerRating}>{level === 'Easy' ? '650 EST.' : level === 'Medium' ? '1000 EST.' : '1450 EST.'}</Text>
            </View>
          )}

          <View style={[styles.board, { width: boardSize, height: boardSize }]}>
            {board.map((row, r) => row.map((piece, c) => {
              const square = FILES[c] + String(8 - r);
              const light = (r + c) % 2 === 0;
              const isTarget = targets.includes(square);
              const isSelected = selected === square;
              return (
                <Pressable
                  key={square}
                  disabled={aiThinking || (tab === 'Play' && game.turn() === 'b')}
                  onPress={() => selectSquare(square)}
                  style={[styles.square, {
                    width: boardSize / 8,
                    height: boardSize / 8,
                    backgroundColor: isSelected ? '#d6c45e' : light ? '#e7c99b' : '#93633e'
                  }]}
                >
                  {isTarget && <View style={[styles.target, piece && styles.targetCapture]} />}
                  {!!piece && !(animatedPiece && animatedPiece.from === square) && (
                    <Text style={[styles.piece, {
                      fontSize: Math.max(22, boardSize / 12),
                      color: piece.color === 'w' ? '#f5dfb5' : '#54351f',
                      textShadowColor: piece.color === 'w' ? '#6f4a28' : '#e0b77c'
                    }]}>{PIECES[piece.color + piece.type.toUpperCase()]}</Text>
                  )}
                  {c === 0 && <Text style={styles.rank}>{8 - r}</Text>}
                  {r === 7 && <Text style={styles.file}>{FILES[c]}</Text>}
                </Pressable>
              );
            }))}
            {animatedPiece && (
              <Animated.View pointerEvents="none" style={[styles.movingPiece, { width: boardSize / 8, height: boardSize / 8 }, { transform: animationPosition.getTranslateTransform() }]}>
                <Text style={[styles.piece, { fontSize: Math.max(22, boardSize / 12), color: animatedPiece.color === 'w' ? '#f5dfb5' : '#54351f', textShadowColor: animatedPiece.color === 'w' ? '#6f4a28' : '#e0b77c' }]}>{animatedPiece.glyph}</Text>
              </Animated.View>
            )}
          </View>

          {tab === 'Review' && (
            <View style={{ width: '100%', gap: 10, marginTop: 12 }}>
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
                  <Text style={styles.helper}>Against {lastResult.level} AI · {lastResult.moves} half-moves · opponent estimate {lastResult.opponentElo}</Text>
                </View>
              )}
              <Pressable onPress={analyzeCurrentPosition} disabled={analyzing} style={styles.primaryButton}>
                {analyzing ? <ActivityIndicator color="#10180d" /> : <Text style={styles.primaryText}>Analyse current position with Stockfish</Text>}
              </Pressable>
              {analysis && (
                <View style={styles.analysisCard}>
                  <Text style={styles.coachTitle}>STOCKFISH · DEPTH {analysis.depth}</Text>
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
                <Text style={styles.playerName}>You</Text>
                <Text style={styles.playerMeta}>White pieces · {playerElo} Elo</Text>
              </View>
              {aiThinking ? <ActivityIndicator color={COLORS.green} /> : <Text style={styles.turnLabel}>{game.turn() === 'w' && !game.isGameOver() ? 'YOUR TURN' : game.isGameOver() ? 'FINISHED' : 'WAITING'}</Text>}
            </View>
          )}

          <View style={styles.actions}>
            <Pressable onPress={undo} disabled={!history.length || aiThinking} style={[styles.secondaryButton, (!history.length || aiThinking) && styles.disabledButton]}>
              <Text style={styles.secondaryText}>↶ Undo</Text>
            </Pressable>
            <Pressable onPress={tab === 'Learn' ? playLessonMove : restart} style={styles.primaryButton}>
              <Text style={styles.primaryText}>{tab === 'Learn' ? (currentLesson ? 'Next lesson move  →' : 'Lesson complete ✓') : '↻ New game'}</Text>
            </Pressable>
            <Pressable onPress={restart} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>↻</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.coachCard}>
          <View style={styles.coachIcon}><Text style={styles.coachIconText}>✦</Text></View>
          <View style={{ flex: 1 }}>
            <View style={styles.coachTitleRow}>
              <Text style={styles.coachTitle}>Coach's corner</Text>
              {tab === 'Play' && <Text style={styles.engineState}>{engineLabel}</Text>}
            </View>
            <Text style={styles.coachBody}>{message}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{tab === 'Review' ? 'Move history' : tab === 'Play' ? 'Your match' : 'Your learning path'}</Text>
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
            <Text style={styles.helper}>Stockfish is used when its free online service is reachable. If it is unavailable, the built-in chess AI takes over automatically.</Text>
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
          <Text style={styles.licenseNote}>Stockfish is GPLv3 software. This app connects to a public Stockfish analysis service; the built-in AI is used as a fallback.</Text>
        </View>
        <Text style={styles.footer}>CHESS COACH AI  ·  BUILD 0.3.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  page: { padding: 18, paddingBottom: 38, gap: 16, alignItems: 'center' },
  header: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  brandBlock: { flex: 1 },
  eyebrow: { fontSize: 9, letterSpacing: 2, color: COLORS.muted, fontWeight: '900' },
  brand: { fontSize: 27, fontWeight: '900', color: COLORS.text, letterSpacing: -0.8, marginTop: 4 },
  brandAccent: { color: COLORS.green },
  tagline: { fontSize: 11, color: COLORS.muted, marginTop: 3 },
  levelBadge: { borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.panel },
  levelBadgeText: { fontSize: 9, color: '#c3cde0', fontWeight: '900' },
  tabs: { width: '100%', flexDirection: 'row', backgroundColor: COLORS.panel, padding: 4, borderRadius: 14, borderWidth: 1, borderColor: '#1e2a3e' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10 },
  tabActive: { backgroundColor: '#2a3b52' },
  tabText: { color: '#8290a8', fontWeight: '800', fontSize: 13 },
  tabTextActive: { color: COLORS.text },
  difficultyCard: { width: '100%', backgroundColor: COLORS.panel, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, gap: 8 },
  difficultyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  onlineTag: { color: COLORS.green, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  helper: { color: COLORS.muted, fontSize: 11, lineHeight: 17 },
  levels: { flexDirection: 'row', gap: 8, marginTop: 4 },
  levelButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.panel2, borderWidth: 1, borderColor: COLORS.line },
  levelButtonActive: { backgroundColor: '#29452f', borderColor: '#5f9e50' },
  levelText: { color: '#a8b4c8', fontWeight: '800', fontSize: 12 },
  levelTextActive: { color: COLORS.green },
  boardCard: { width: '100%', backgroundColor: COLORS.panel, borderRadius: 20, padding: 12, borderWidth: 1, borderColor: '#26344a', alignItems: 'center' },
  boardHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 12 },
  boardTitle: { fontSize: 17, color: COLORS.text, fontWeight: '900' },
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
  board: { position: 'relative', flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden', borderRadius: 5, alignSelf: 'center' },
  square: { alignItems: 'center', justifyContent: 'center' },
  piece: { fontWeight: '400', textAlign: 'center', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  rank: { position: 'absolute', top: 2, left: 3, fontSize: 8, color: '#17211c', fontWeight: '900' },
  file: { position: 'absolute', bottom: 1, right: 3, fontSize: 8, color: '#17211c', fontWeight: '900' },
  target: { position: 'absolute', width: 12, height: 12, borderRadius: 8, backgroundColor: '#213d2b', opacity: 0.65 },
  targetCapture: { width: '86%', height: '86%', backgroundColor: 'transparent', borderWidth: 3, borderColor: '#213d2b' },
  actions: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  primaryButton: { flex: 1, backgroundColor: COLORS.green, paddingVertical: 13, borderRadius: 11, alignItems: 'center' },
  primaryText: { fontSize: 12, color: '#142019', fontWeight: '900' },
  secondaryButton: { backgroundColor: '#202e43', paddingHorizontal: 13, paddingVertical: 13, borderRadius: 11, alignItems: 'center' },
  secondaryText: { color: '#d7deeb', fontWeight: '800', fontSize: 12 },
  disabledButton: { opacity: 0.4 },
  coachCard: { width: '100%', flexDirection: 'row', gap: 12, backgroundColor: '#14241e', borderWidth: 1, borderColor: '#2b4a37', borderRadius: 16, padding: 14 },
  coachIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#294a34', alignItems: 'center', justifyContent: 'center' },
  coachIconText: { fontSize: 22, color: COLORS.green },
  coachTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  coachTitle: { color: '#c1f5a7', fontWeight: '900', fontSize: 13, marginBottom: 5 },
  engineState: { color: '#9eb29f', fontSize: 9, fontWeight: '700' },
  coachBody: { color: '#d4dfd8', fontSize: 12, lineHeight: 18 },
  sectionHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  counter: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  lessonList: { width: '100%', gap: 10 },
  lessonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: COLORS.panel, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#202c40' },
  lessonNumber: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#29394f', alignItems: 'center', justifyContent: 'center' },
  lessonDone: { backgroundColor: '#285037' },
  lessonNumberText: { fontSize: 10, fontWeight: '900', color: '#d4deec' },
  lessonTitle: { fontSize: 12, fontWeight: '900', color: '#edf1f8', marginTop: 1 },
  lessonDesc: { fontSize: 11, lineHeight: 16, color: '#8e9bb3', marginTop: 4 },
  lessonSan: { color: COLORS.green, fontSize: 12, fontWeight: '900', paddingTop: 4 },
  reviewCard: { width: '100%', backgroundColor: COLORS.panel, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#202c40', gap: 10 },
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
  footer: { width: '100%', textAlign: 'center', fontSize: 9, letterSpacing: 2, color: '#59667c', marginTop: 2 },
  movingPiece: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
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
});
