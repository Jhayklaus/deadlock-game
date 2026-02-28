import { useState } from 'react';
import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';

export function useVoting() {
  const { players, voteCounts, phase } = useGameStore(state => ({
    players: state.players,
    voteCounts: state.voteCounts,
    phase: state.phase,
  }));

  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  const targets = Object.values(players).filter(p => p.isAlive);

  const handleVote = () => {
    if (selectedVote) {
      networkManager.sendVote(selectedVote);
      setHasVoted(true);
    }
  };

  const handleSkip = () => {
    networkManager.sendVote(null);
    setHasVoted(true);
  };

  return {
    targets,
    voteCounts,
    phase,
    selectedVote,
    setSelectedVote,
    hasVoted,
    handleVote,
    handleSkip,
  };
}
