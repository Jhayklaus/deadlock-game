import { useGameStore } from './lib/store';
import { useEffect, Suspense } from 'react';
import { networkManager } from './lib/network';
import { soundManager } from './lib/sound';
import Layout from './components/Layout';
import NightPhase from './components/NightPhase';
import EliminationReveal from './components/EliminationReveal';
import TrialPhase from './components/TrialPhase';
import ModePicker from './components/screens/ModePicker';
import PreJoinCard from './components/screens/PreJoinCard';
import { getScreens } from './components/screens/screenRegistry';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="animate-spin h-8 w-8 border-4 border-edge border-t-white rounded-full" />
    </div>
  );
}

function App() {
  const { phase, myId, hostId, roomCode, players, uiScreen, gameMode } = useGameStore(state => ({
    phase: state.phase,
    myId: state.myId,
    hostId: state.hostId,
    roomCode: state.roomCode,
    players: state.players,
    uiScreen: state.uiScreen,
    gameMode: state.gameMode,
  }));

  useEffect(() => {
    if (phase !== 'lobby' && phase !== 'game_over') {
        soundManager.playBackgroundMusic();
    } else {
        soundManager.stopBackgroundMusic();
    }
  }, [phase]);

  useEffect(() => {
    const savedId = myId || undefined;
    networkManager.initialize(savedId, (id) => {
      console.log('Network initialized with ID:', id);

      // Rejoin by ROOM CODE, not by host id. They are the same until the host
      // changes, and different afterwards: the room keeps the code it was
      // opened with, while `hostId` follows whoever is running it. Passing the
      // host id meant that after a migration a refresh asked the server for a
      // room named after the new host — which does not exist — and overwrote
      // the stored code with it on the way, so the next refresh ejected the
      // player from the room for real.
      const room = roomCode ?? hostId;
      if (room && hostId && hostId !== id) {
        const myName = players[id]?.name || 'Player';
        networkManager.joinGame(room, myName);
      }
    });
  }, []);

  // Screens that are shown before entering a room
  if (uiScreen === 'mode_picker') {
    return (
      <Layout>
        <ModePicker />
      </Layout>
    );
  }

  if (uiScreen === 'pre_join') {
    return (
      <Layout>
        <PreJoinCard />
      </Layout>
    );
  }

  // In-room routing: use screen registry for mode-specific screens
  const screens = getScreens(gameMode);
  const Lobby = screens.lobby;
  const RoleReveal = screens.roleReveal;
  const DayPhase = screens.dayPhase;
  const GameOver = screens.gameOver;
  const ImpostorGuess = screens.impostorGuess;
  const Station = screens.station;

  return (
    <Layout>
      <Suspense fallback={<LoadingFallback />}>
        {phase === 'lobby' && <Lobby />}
        {phase === 'role_assignment' && <RoleReveal />}
        {phase === 'night' && <NightPhase />}
        {(phase === 'day_discussion' || phase === 'voting') && <DayPhase />}
        {(phase === 'trial_defense' || phase === 'trial_verdict') && <TrialPhase />}
        {phase === 'elimination_reveal' && <EliminationReveal />}
        {phase === 'roaming' && Station && <Station />}
        {phase === 'impostor_guess' && ImpostorGuess && <ImpostorGuess />}
        {phase === 'game_over' && <GameOver />}
      </Suspense>
    </Layout>
  );
}

export default App;
