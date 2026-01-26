import { useEffect, useState } from 'react';
import { useGameStore } from '../lib/store';
import { soundManager } from '../lib/sound';
import { clsx } from 'clsx';
import { Clock } from 'lucide-react';

interface TimerProps {
  className?: string;
}

export function Timer({ className }: TimerProps) {
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
      "px-4 py-2 rounded-lg font-mono text-xl font-bold border transition-all duration-300 flex items-center gap-3",
      timeLeft <= 10 ? "bg-red-500/20 text-red-200 border-red-500/50 animate-pulse scale-105" : "bg-slate-800/50 text-white border-slate-700/50",
      className
    )}>
      <Clock size={20} className={clsx(timeLeft <= 10 ? "text-red-400" : "text-slate-400")} />
      <span>
        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
      </span>
    </div>
  );
}

export default Timer;