import { useEffect, useState } from 'react';
import { useGameStore } from '../lib/store';
import { soundManager } from '../lib/sound';
import { clsx } from 'clsx';

export default function Timer() {
  const timerEnd = useGameStore(state => state.timerEnd);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!timerEnd) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.ceil((timerEnd - now) / 1000);
      
      if (remaining <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
      } else {
        setTimeLeft(remaining);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [timerEnd]);

  useEffect(() => {
    if (timeLeft !== null && timeLeft <= 10 && timeLeft > 0) {
      if (timeLeft <= 5) {
        soundManager.playCountdownUrgent();
      } else {
        soundManager.playCountdownTick();
      }
    }
  }, [timeLeft]);

  if (timeLeft === null) return null;

  return (
    <div className={clsx(
      "fixed top-4 left-4 px-4 py-2 rounded-lg font-mono text-xl font-bold shadow-lg z-50 border transition-all duration-300",
      timeLeft <= 10 ? "bg-red-900/90 text-red-200 border-red-500 animate-pulse scale-110" : "bg-slate-800/90 text-white border-slate-600"
    )}>
      <span className="font-creepster mr-2">Time:</span>
      {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
    </div>
  );
}