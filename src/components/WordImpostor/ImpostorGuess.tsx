/**
 * Impostor Guess Phase UI
 *
 * The voted-out impostor gets one chance to guess the secret word.
 * Everyone else watches. Timer is shown.
 */
import { useState } from 'react';
import { useGameStore } from '../../lib/store';
import { networkManager } from '../../lib/network';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import Timer from '../Timer';
import { Crosshair, CheckCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';

export default function ImpostorGuess() {
  const {
    myId,
    players,
    impostorGuessPlayerId,
    myAssignedCategory,
    wordGuessResult,
    timerEnd,
  } = useGameStore(state => ({
    myId: state.myId,
    players: state.players,
    impostorGuessPlayerId: state.impostorGuessPlayerId,
    myAssignedCategory: state.myAssignedCategory,
    wordGuessResult: state.wordGuessResult,
    timerEnd: state.timerEnd,
  }));

  const [guess, setGuess] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const isGuesser = myId === impostorGuessPlayerId;
  const guesserName = impostorGuessPlayerId
    ? (players[impostorGuessPlayerId]?.name ?? 'The Impostor')
    : 'The Impostor';

  const handleSubmit = () => {
    if (!guess.trim() || submitted) return;
    setSubmitted(true);
    networkManager.submitImpostorGuess(guess.trim());
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-6 animate-in fade-in duration-500">
      <Card variant="glass" className="text-center space-y-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 via-violet-400 to-violet-600 opacity-60" />

        <div className="flex flex-col items-center gap-2 pt-2">
          <div className="p-3 bg-violet-900/30 rounded-xl border border-violet-500/30">
            <Crosshair size={28} className="text-violet-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 font-creepster tracking-wider">
            Impostor's Last Chance
          </h2>
          <p className="text-slate-400 text-sm">
            <span className="text-violet-300 font-bold">{guesserName}</span> was voted out.
            Can they name the secret word?
          </p>
        </div>

        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Category</p>
          <p className="text-lg font-bold text-slate-200">{myAssignedCategory ?? '—'}</p>
        </div>

        {timerEnd && !wordGuessResult && (
          <div className="flex justify-center">
            <Timer />
          </div>
        )}
      </Card>

      {/* Result display */}
      {wordGuessResult && (
        <Card variant="glass" className={clsx(
          'p-6 text-center border-2',
          wordGuessResult.correct ? 'border-red-500/50' : 'border-emerald-500/50'
        )}>
          <div className="flex flex-col items-center gap-3">
            {wordGuessResult.correct ? (
              <XCircle size={40} className="text-red-400" />
            ) : (
              <CheckCircle size={40} className="text-emerald-400" />
            )}
            <div>
              <p className="text-lg font-bold text-slate-100">
                {wordGuessResult.correct ? 'Impostor Wins!' : 'Crewmates Win!'}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                Guess: <span className="text-slate-300 font-mono">"{wordGuessResult.guess || 'no guess'}"</span>
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Guess input — only for the designated impostor */}
      {isGuesser && !wordGuessResult && (
        <Card variant="glass" className="p-4 border-violet-500/30 space-y-3">
          <p className="text-sm text-violet-300 font-bold text-center">
            You are the Impostor. Enter your guess:
          </p>
          <div className="flex gap-2">
            <Input
              value={guess}
              onChange={e => setGuess(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Type the secret word..."
              disabled={submitted}
              className="flex-1"
            />
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!guess.trim() || submitted}
            >
              Guess
            </Button>
          </div>
          {submitted && (
            <p className="text-xs text-slate-500 text-center italic">Guess submitted — waiting for result…</p>
          )}
        </Card>
      )}

      {/* Spectator message */}
      {!isGuesser && !wordGuessResult && (
        <Card variant="glass" className="p-4 text-center border-slate-800">
          <p className="text-slate-500 text-sm italic">
            Watching <span className="text-slate-300">{guesserName}</span> attempt to guess the word…
          </p>
        </Card>
      )}
    </div>
  );
}
