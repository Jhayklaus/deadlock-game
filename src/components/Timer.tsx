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

  const urgent = timeLeft <= 10;

  return (
    <div
      role="timer"
      aria-live="off"
      className={clsx(
        'px-4 py-2 rounded-full border backdrop-blur-xl flex items-center gap-2.5',
        'transition-all duration-300 ease-out-expo',
        urgent
          ? 'bg-danger/15 text-ink border-danger/50 animate-pulse-glow'
          : 'bg-elevated/70 text-ink border-edge/60',
        className
      )}
    >
      <Clock size={16} className={urgent ? 'text-danger' : 'text-ink-muted'} />
      {/* `tabular` keeps the digits from jittering as the count ticks down. */}
      <span className="text-lg font-semibold tabular leading-none">
        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
      </span>
    </div>
  );
}

export default Timer;