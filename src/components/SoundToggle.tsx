import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Volume2, VolumeX } from 'lucide-react';
import { soundManager } from '../lib/sound';

/**
 * Mutes the music and effects.
 *
 * The background loop previously had no off switch at all, which matters more
 * now that it is an actual beat rather than a quiet pad. The choice persists
 * across sessions.
 */
export default function SoundToggle() {
  const [muted, setMuted] = useState(() => soundManager.getMuted());

  useEffect(() => soundManager.onMuteChange(setMuted), []);

  return (
    <button
      onClick={() => {
        const nowMuted = soundManager.toggleMuted();
        // Unmuting mid-game should bring the loop straight back.
        if (!nowMuted) soundManager.playBackgroundMusic();
      }}
      title={muted ? 'Unmute sound' : 'Mute sound'}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      aria-pressed={muted}
      className={clsx(
        'inline-flex items-center justify-center w-9 h-9 rounded-xl border transition-colors',
        muted
          ? 'bg-surface/60 border-edge/60 text-ink-muted/70 hover:text-ink'
          : 'bg-surface/60 border-edge/60 text-ink-muted hover:text-ink hover:border-accent/50'
      )}
    >
      {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
    </button>
  );
}
