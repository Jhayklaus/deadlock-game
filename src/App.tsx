import { useGameStore } from './lib/store';
import { useEffect } from 'react';
import { networkManager } from './lib/network';
import { soundManager } from './lib/sound';
import Layout from './components/Layout';
import Lobby from './components/Lobby';
import RoleCard from './components/RoleCard';
import NightPhase from './components/NightPhase';
import DayPhase from './components/DayPhase';
import GameOver from './components/GameOver';

function App() {
  const { phase, myId, hostId, players } = useGameStore(state => ({
    phase: state.phase,
    myId: state.myId,
    hostId: state.hostId,
    players: state.players
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
      if (hostId && hostId !== id) {
        const myName = players[id]?.name || 'Player';
        networkManager.joinGame(hostId, myName);
      }
    });
  }, []);

  return (
    <Layout>
        {phase === 'lobby' && <Lobby />}
        {phase === 'role_assignment' && <RoleCard />}
        {phase === 'night' && <NightPhase />}
        {(phase === 'day_discussion' || phase === 'voting') && <DayPhase />}
        {phase === 'game_over' && <GameOver />}
    </Layout>
  )
}

export default App
