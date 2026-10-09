import { useGameStore } from '../../../lib/store';
import { networkManager } from '../../../lib/network';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Trophy, Skull, RotateCcw, Crosshair, Wrench } from 'lucide-react';
import { didIWin } from '../../../lib/winner';

export default function GameOver() {
  const { modeWinnerId, modeWinnerLabel, modeWinnerDescription, players, allModeRoles, myId, isHost } =
    useGameStore(state => ({
      modeWinnerId: state.modeWinnerId,
      modeWinnerLabel: state.modeWinnerLabel,
      modeWinnerDescription: state.modeWinnerDescription,
      players: state.players,
      allModeRoles: state.allModeRoles,
      myId: state.myId,
      isHost: state.myId === state.hostId,
    }));

  const impostorsWon = modeWinnerId === 'impostor';
  const iWon = didIWin(modeWinnerId, allModeRoles, myId);

  return (
    <div className="w-full max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-500">
      <Card variant="glass" className="text-center py-10">
        <div className={`w-16 h-16 mx-auto mb-5 rounded-2xl grid place-items-center border ${
          iWon ? 'bg-success/10 border-success/40 text-success' : 'bg-danger/10 border-danger/40 text-danger'
        }`}>
          {iWon ? <Trophy size={28} /> : <Skull size={28} />}
        </div>

        <p className={`text-[10px] uppercase tracking-[0.3em] mb-1 font-bold ${
          iWon ? 'text-success' : 'text-ink-muted'
        }`}>
          {iWon ? 'You win' : 'You lose'}
        </p>
        <h1 className={`font-display text-4xl mb-3 ${impostorsWon ? 'text-danger' : 'text-success'}`}>
          {modeWinnerLabel ?? 'Nobody'} win
        </h1>
        <p className="text-sm text-ink-muted max-w-sm mx-auto leading-relaxed mb-7">
          {modeWinnerDescription}
        </p>

        <div className="text-left max-w-xs mx-auto mb-7">
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2.5">The crew</p>
          <ul className="space-y-1.5">
            {Object.values(players).map(p => {
              const wasImpostor = allModeRoles[p.id] === 'station_impostor';
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className={p.isAlive ? 'text-ink' : 'text-ink-muted line-through'}>
                    {p.name}
                  </span>
                  <span className={`flex items-center gap-1.5 text-xs ${
                    wasImpostor ? 'text-danger' : 'text-ink-muted'
                  }`}>
                    {wasImpostor ? <Crosshair size={12} /> : <Wrench size={12} />}
                    {wasImpostor ? 'Impostor' : 'Crew'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {isHost && (
          <Button onClick={() => networkManager.playAgain()} variant="accent" size="lg">
            <RotateCcw size={16} /> Back to lobby
          </Button>
        )}
      </Card>
    </div>
  );
}
