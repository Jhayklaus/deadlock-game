import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { useGameStore } from '../lib/store';
import { voiceManager, type VoiceStatus } from '../lib/voice';
import { Mic, MicOff, Volume2, MoonStar, Users, Skull } from 'lucide-react';

const CHANNEL_LABEL: Record<string, { label: string; icon: typeof Users; tone: string }> = {
  town: { label: 'Town', icon: Users, tone: 'text-accent' },
  mafia: { label: 'Mafia', icon: MoonStar, tone: 'text-danger' },
  dead: { label: 'Dead', icon: Skull, tone: 'text-ink-muted' },
};

/**
 * Microphone control for in-app voice.
 *
 * Renders nothing at all unless the server has LiveKit configured, so a
 * deployment without credentials simply never sees it.
 */
export default function VoiceControl() {
  const { myId, hostId, phase, accusedId } = useGameStore(state => ({
    myId: state.myId,
    hostId: state.hostId,
    phase: state.phase,
    accusedId: state.accusedId,
  }));

  const [status, setStatus] = useState<VoiceStatus>(voiceManager.getStatus());

  useEffect(() => voiceManager.subscribe(setStatus), []);

  // Re-ask for a grant whenever the phase changes — permissions are derived
  // from it, and tokens are deliberately short-lived.
  useEffect(() => {
    if (!hostId || !myId) return;
    voiceManager.sync(hostId, myId);
  }, [hostId, myId, phase, accusedId]);

  // Leave voice entirely when the player leaves the room.
  useEffect(() => {
    if (!hostId) voiceManager.disconnect();
  }, [hostId]);

  if (!status.available || !hostId) return null;

  // No channel means this player has no voice right now (asleep at night).
  if (!status.channel) {
    return (
      <div
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold
          bg-surface/50 border border-edge/50 text-ink-muted/70"
        title={status.reason || 'No voice right now'}
      >
        <MicOff size={14} />
        <span className="hidden sm:inline">Silent</span>
      </div>
    );
  }

  const meta = CHANNEL_LABEL[status.channel] ?? CHANNEL_LABEL.town;
  const Icon = meta.icon;
  const iAmSpeaking = status.speaking.includes(myId);
  const othersSpeaking = status.speaking.filter(id => id !== myId).length;

  // Listen-only, e.g. everyone but the accused during a defense.
  if (!status.canPublish) {
    return (
      <div
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold
          bg-surface/60 border border-edge/60 text-ink-muted"
        title={status.reason}
      >
        <Volume2 size={14} className={othersSpeaking > 0 ? 'text-accent animate-pulse' : undefined} />
        <span className="hidden sm:inline">Listening</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => voiceManager.toggleMute()}
      title={`${meta.label} voice — ${status.muted ? 'click to unmute' : 'click to mute'}`}
      className={clsx(
        'inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold',
        'border transition-all duration-200 active:scale-[0.97]',
        status.muted
          ? 'bg-surface/60 border-edge/60 text-ink-muted hover:text-ink'
          : 'bg-success/15 border-success/40 text-success',
        iAmSpeaking && !status.muted && 'animate-pulse-glow'
      )}
    >
      {status.muted ? <MicOff size={14} /> : <Mic size={14} />}
      <span className="hidden sm:inline">{meta.label}</span>
      <Icon size={12} className={clsx('hidden md:inline', meta.tone)} />
      {othersSpeaking > 0 && (
        <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
      )}
    </button>
  );
}
