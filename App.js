import React, { useMemo, useState } from 'react';
import { SafeAreaView, View, Text, Pressable, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { Chess } from 'chess.js';

const PIECES = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟'
};
const FILES = 'abcdefgh';
const LESSON = [
  { san:'e4', title:'Claim the centre', body:'Moving the king’s pawn two squares controls the central d5 and f5 squares and opens lines for your queen and bishop.' },
  { san:'e5', title:'Contest the centre', body:'Black mirrors White and fights for central space. A good opening is about development and central control.' },
  { san:'Nf3', title:'Develop with a threat', body:'The knight develops toward the centre and attacks Black’s e5 pawn. Develop your minor pieces before launching an early attack.' },
  { san:'Nc6', title:'Defend and develop', body:'Black develops a knight while protecting the e5 pawn. Both sides are bringing pieces into the game.' },
  { san:'Bc4', title:'Aim at f7', body:'The bishop targets f7, one of Black’s weakest opening squares. White can now consider castling soon.' }
];
const freshGame = () => new Chess();

export default function App() {
  const [game, setGame] = useState(freshGame);
  const [selected, setSelected] = useState(null);
  const [targets, setTargets] = useState([]);
  const [moves, setMoves] = useState([]);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [tab, setTab] = useState('Learn');
  const [message, setMessage] = useState('Tap a piece, then tap a highlighted square.');

  const board = game.board();
  const legalTargets = (square) => game.moves({ square, verbose: true }).map(m => m.to);
  const status = game.isCheckmate() ? `Checkmate — ${game.turn() === 'w' ? 'Black' : 'White'} wins` : game.isDraw() ? 'Draw game' : `${game.turn() === 'w' ? 'White' : 'Black'} to move${game.isCheck() ? ' · Check' : ''}`;
  const currentLesson = LESSON[lessonIndex] || null;

  function selectSquare(square) {
    if (selected && targets.includes(square)) {
      const next = new Chess(game.fen());
      try {
        const move = next.move({ from: selected, to: square, promotion: 'q' });
        if (move) {
          setGame(next);
          setMoves(old => [...old, { san: move.san, color: move.color, fen: next.fen() }]);
          setSelected(null); setTargets([]);
          const lesson = LESSON[lessonIndex];
          if (lesson && move.san === lesson.san) {
            setLessonIndex(i => Math.min(i + 1, LESSON.length));
            setMessage(`Nice! ${lesson.title}. ${lesson.body}`);
          } else {
            setMessage('Legal move played. Tip: develop your pieces and fight for the centre.');
          }
          return;
        }
      } catch (e) { /* Illegal moves are ignored by the UI. */ }
    }
    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setSelected(square); setTargets(legalTargets(square));
      setMessage(`${piece.color === 'w' ? 'White' : 'Black'} ${piece.type.toUpperCase()} selected. Choose a highlighted square.`);
    } else {
      setSelected(null); setTargets([]);
      setMessage('That move is not legal. Select one of your pieces and choose a highlighted square.');
    }
  }

  function undo() {
    if (!moves.length) return;
    const next = new Chess();
    moves.slice(0, -1).forEach(m => { try { next.load(m.fen); } catch {} });
    // Rebuild by replaying SAN for reliable undo.
    const replay = freshGame();
    moves.slice(0, -1).forEach(m => { try { replay.move(m.san); } catch {} });
    setGame(replay); setMoves(old => old.slice(0, -1)); setSelected(null); setTargets([]);
    setLessonIndex(Math.min(moves.length - 1, LESSON.length)); setMessage('Last move taken back. Try a different idea.');
  }
  function restart() { setGame(freshGame()); setSelected(null); setTargets([]); setMoves([]); setLessonIndex(0); setMessage('New game. Start with 1. e4 to control the centre.'); }
  function playLessonMove() {
    if (!currentLesson) { setMessage('Opening lesson complete! Restart to practise it again.'); return; }
    const next = new Chess(game.fen());
    try {
      const move = next.move(currentLesson.san);
      if (!move) { setMessage('This lesson move is not legal in the current position. Restart the lesson to continue.'); return; }
      setGame(next); setMoves(old => [...old, { san: move.san, color: move.color, fen: next.fen() }]);
      setLessonIndex(i => Math.min(i + 1, LESSON.length)); setSelected(null); setTargets([]);
      setMessage(`${currentLesson.title}. ${currentLesson.body}`);
    } catch { setMessage('This lesson move is not legal here. Restart the lesson to continue.'); }
  }
  const movePairs = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < moves.length; i += 2) pairs.push(`${Math.floor(i / 2) + 1}. ${moves[i].san}${moves[i + 1] ? '  ' + moves[i + 1].san : ''}`);
    return pairs;
  }, [moves]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0b1020" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View><Text style={styles.eyebrow}>YOUR PERSONAL CHESS TRAINER</Text><Text style={styles.brand}>Chess Coach <Text style={styles.brandAccent}>AI</Text></Text></View>
          <View style={styles.level}><Text style={styles.levelText}>♟ BEGINNER</Text></View>
        </View>
        <View style={styles.tabs}>
          {['Learn', 'Play', 'Review'].map(t => <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}><Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text></Pressable>)}
        </View>
        <View style={styles.card}>
          <View style={styles.boardTop}><View><Text style={styles.cardTitle}>{tab === 'Learn' ? 'The Italian Game' : tab === 'Play' ? 'Practice board' : 'Game review'}</Text><Text style={styles.subtle}>{status}</Text></View><View style={styles.dot} /></View>
          <View style={styles.board}>
            {board.map((row, r) => row.map((piece, c) => {
              const square = `${FILES[c]}${8-r}`;
              const light = (r + c) % 2 === 0;
              const isTarget = targets.includes(square);
              const isSelected = selected === square;
              return <Pressable key={square} onPress={() => selectSquare(square)} style={[styles.square, { backgroundColor: isSelected ? '#d9c65a' : light ? '#e8e2d5' : '#77927d' }]}>
                {isTarget && <View style={[styles.target, piece ? styles.targetCapture : null]} />}
                {!!piece && <Text style={[styles.piece, { color: piece.color === 'w' ? '#fffdf5' : '#17211c', textShadowColor: piece.color === 'w' ? '#1c2922' : '#e9e6da' }]}>{PIECES[`${piece.color}${piece.type.toUpperCase()}`]}</Text>}
                {c === 0 && <Text style={styles.rank}>{8-r}</Text>}{r === 7 && <Text style={styles.file}>{FILES[c]}</Text>}
              </Pressable>;
            }))}
          </View>
          <View style={styles.boardActions}>
            <Pressable onPress={undo} style={styles.secondaryButton}><Text style={styles.secondaryText}>↶ Undo</Text></Pressable>
            <Pressable onPress={playLessonMove} style={styles.primaryButton}><Text style={styles.primaryText}>{currentLesson ? `Next lesson move  →` : 'Lesson complete ✓'}</Text></Pressable>
            <Pressable onPress={restart} style={styles.secondaryButton}><Text style={styles.secondaryText}>↻</Text></Pressable>
          </View>
        </View>
        <View style={styles.coachCard}>
          <View style={styles.coachIcon}><Text style={{fontSize:22}}>✦</Text></View>
          <View style={{flex:1}}><Text style={styles.coachTitle}>Coach's tip</Text><Text style={styles.coachBody}>{message}</Text></View>
        </View>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{tab === 'Review' ? 'Move history' : 'Your learning path'}</Text><Text style={styles.subtle}>{tab === 'Review' ? `${moves.length} plies` : `${Math.min(lessonIndex, LESSON.length)}/${LESSON.length} steps`}</Text></View>
        {tab === 'Review' ? <View style={styles.cardSmall}>{movePairs.length ? movePairs.map((m,i) => <Text key={i} style={styles.moveText}>{m}</Text>) : <Text style={styles.subtle}>Play a few moves to build your review.</Text>}</View> : <View style={styles.lessonList}>{LESSON.map((lesson, i) => <View key={lesson.san} style={styles.lessonRow}><View style={[styles.lessonNumber, i < lessonIndex && styles.lessonDone]}><Text style={styles.lessonNumberText}>{i < lessonIndex ? '✓' : String(i+1).padStart(2,'0')}</Text></View><View style={{flex:1}}><Text style={styles.lessonTitle}>{lesson.title}</Text><Text style={styles.lessonDesc}>{lesson.body}</Text></View><Text style={styles.lessonSan}>{lesson.san}</Text></View>)}</View>}
        <View style={styles.engineNotice}><View style={styles.engineDot}/><View style={{flex:1}}><Text style={styles.engineTitle}>Stockfish engine · Next integration step</Text><Text style={styles.engineBody}>This starter has legal chess moves and a guided opening lesson. Real engine evaluations and move-strength labels will be connected in Step 2.</Text></View></View>
        <Text style={styles.footer}>CHESS COACH AI  •  BUILD 0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#0b1020'}, page:{padding:18,paddingBottom:36,gap:16}, header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingTop:8}, eyebrow:{fontSize:9,letterSpacing:2,color:'#8f9bb6',fontWeight:'800'}, brand:{fontSize:26,fontWeight:'900',color:'#f5f7fb',letterSpacing:-.7,marginTop:4}, brandAccent:{color:'#9fe870'}, level:{borderWidth:1,borderColor:'#2d3b4c',paddingHorizontal:10,paddingVertical:7,borderRadius:20}, levelText:{fontSize:10,color:'#b7c2d5',fontWeight:'800'}, tabs:{flexDirection:'row',backgroundColor:'#111a2b',padding:4,borderRadius:14}, tab:{flex:1,alignItems:'center',paddingVertical:10,borderRadius:10}, tabActive:{backgroundColor:'#263449'}, tabText:{color:'#7e8aa3',fontWeight:'700',fontSize:13}, tabTextActive:{color:'#f5f7fb'}, card:{backgroundColor:'#111a2b',borderRadius:20,padding:12,borderWidth:1,borderColor:'#202c40'}, boardTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:4,paddingBottom:12}, cardTitle:{fontSize:17,color:'#f4f6fb',fontWeight:'800'}, subtle:{color:'#8c99b2',fontSize:11,marginTop:3}, dot:{width:8,height:8,borderRadius:4,backgroundColor:'#9fe870'}, board:{width:'100%',aspectRatio:1,flexDirection:'row',flexWrap:'wrap',overflow:'hidden',borderRadius:4}, square:{width:'12.5%',height:'12.5%',alignItems:'center',justifyContent:'center'}, piece:{fontSize:29,fontWeight:'400',textShadowOffset:{width:1,height:1},textShadowRadius:1}, rank:{position:'absolute',top:2,left:3,fontSize:8,color:'#17211c',fontWeight:'800'}, file:{position:'absolute',bottom:1,right:3,fontSize:8,color:'#17211c',fontWeight:'800'}, target:{position:'absolute',width:12,height:12,borderRadius:9,backgroundColor:'#233d2c',opacity:.65}, targetCapture:{width:'85%',height:'85%',backgroundColor:'transparent',borderWidth:3,borderColor:'#233d2c'}, boardActions:{flexDirection:'row',alignItems:'center',gap:8,marginTop:12}, primaryButton:{flex:1,backgroundColor:'#9fe870',paddingVertical:12,borderRadius:11,alignItems:'center'}, primaryText:{fontSize:12,color:'#142019',fontWeight:'900'}, secondaryButton:{backgroundColor:'#1d293c',paddingHorizontal:12,paddingVertical:12,borderRadius:11,alignItems:'center'}, secondaryText:{color:'#d7deeb',fontWeight:'800',fontSize:12}, coachCard:{flexDirection:'row',gap:12,backgroundColor:'#15231f',borderWidth:1,borderColor:'#284236',borderRadius:16,padding:14}, coachIcon:{width:38,height:38,borderRadius:12,backgroundColor:'#254533',alignItems:'center',justifyContent:'center'}, coachTitle:{color:'#b8f59b',fontWeight:'800',fontSize:13,marginBottom:5}, coachBody:{color:'#d4dfd8',fontSize:12,lineHeight:18}, sectionHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:2}, sectionTitle:{color:'#f3f5fb',fontSize:16,fontWeight:'800'}, lessonList:{gap:10}, lessonRow:{flexDirection:'row',alignItems:'flex-start',gap:10,backgroundColor:'#111a2b',borderRadius:14,padding:12,borderWidth:1,borderColor:'#202c40'}, lessonNumber:{width:30,height:30,borderRadius:10,backgroundColor:'#263449',alignItems:'center',justifyContent:'center'}, lessonDone:{backgroundColor:'#24472d'}, lessonNumberText:{fontSize:10,fontWeight:'900',color:'#c8d3e4'}, lessonTitle:{fontSize:12,fontWeight:'800',color:'#edf1f8',marginTop:1}, lessonDesc:{fontSize:11,lineHeight:16,color:'#8e9bb3',marginTop:4}, lessonSan:{color:'#9fe870',fontSize:12,fontWeight:'900',paddingTop:4}, cardSmall:{backgroundColor:'#111a2b',padding:14,borderRadius:14,borderWidth:1,borderColor:'#202c40',gap:8}, moveText:{color:'#d7deeb',fontSize:13,fontVariant:['tabular-nums']}, engineNotice:{flexDirection:'row',gap:10,padding:13,borderRadius:14,backgroundColor:'#111827',borderWidth:1,borderColor:'#29344a'}, engineDot:{width:8,height:8,borderRadius:4,backgroundColor:'#f4c76a',marginTop:4}, engineTitle:{color:'#dce4f2',fontSize:11,fontWeight:'800'}, engineBody:{color:'#8794ad',fontSize:10,lineHeight:15,marginTop:4}, footer:{textAlign:'center',fontSize:9,letterSpacing:2,color:'#4f5b72',marginTop:2}
});
