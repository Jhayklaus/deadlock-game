import { useEffect, useState } from 'react';
import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import { Mic, Link2, ExternalLink, Check, X, Info } from 'lucide-react';
import { normaliseVoiceUrl, providerOf } from '../lib/voiceRoom';

/**
 * Banner shown to everyone once the host has set a voice room.
 * Compact variant is for in-game screens, where space is tight.
 */
export function VoiceRoomBar({ compact = false }: { compact?: boolean }) {
  const voiceRoomUrl = useGameStore(state => state.settings.voiceRoomUrl);
  if (!voiceRoomUrl) return null;

  const provider = providerOf(voiceRoomUrl);

  if (compact) {
    return (
      <a
        href={voiceRoomUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold
          bg-success/10 border border-success/30 text-success
          hover:bg-success/20 transition-colors"
        title={`Join voice on ${provider}`}
      >
        <Mic size={14} />
        <span className="hidden sm:inline">Voice</span>
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-success/[0.07] border border-success/25">
      <div className="p-2 rounded-lg bg-success/10 text-success shrink-0">
        <Mic size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">Voice room is open</p>
        <p className="text-xs text-ink-muted truncate">
          {provider} • everyone joins here to talk
        </p>
      </div>
      <a
        href={voiceRoomUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold
          bg-success text-base hover:brightness-110 transition-all active:scale-[0.97]"
      >
        Join <ExternalLink size={13} />
      </a>
    </div>
  );
}

/**
 * Host control for setting the voice room link. Edits are local until saved,
 * so a half-typed URL is never broadcast to the lobby.
 */
export function VoiceRoomSetting() {
  const { settings, isHost } = useGameStore(state => ({
    settings: state.settings,
    isHost: state.myId === state.hostId,
  }));

  const [draft, setDraft] = useState(settings.voiceRoomUrl ?? '');
  const [saved, setSaved] = useState(false);

  // Follow external changes (e.g. a host reconnecting into a running lobby).
  useEffect(() => {
    setDraft(settings.voiceRoomUrl ?? '');
  }, [settings.voiceRoomUrl]);

  if (!isHost) return null;

  const normalised = normaliseVoiceUrl(draft);
  const isInvalid = draft.trim().length > 0 && normalised === null;
  const isDirty = (normalised ?? '') !== (settings.voiceRoomUrl ?? '');

  const save = () => {
    if (isInvalid) return;
    networkManager.updateSettings({ ...settings, voiceRoomUrl: normalised });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const clear = () => {
    setDraft('');
    networkManager.updateSettings({ ...settings, voiceRoomUrl: null });
  };

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-ink-muted border-b border-edge/50 pb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
        <Mic size={14} /> Voice Room
      </h4>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
          />
          <input
            type="url"
            inputMode="url"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') save();
            }}
            placeholder="Paste a Meet, Zoom or Discord link"
            aria-invalid={isInvalid || undefined}
            aria-label="Voice room link"
            className={`w-full h-10 pl-9 pr-3 rounded-xl border bg-base/60 text-sm text-ink
              placeholder:text-ink-muted/60 transition-all
              focus-visible:outline-none focus-visible:ring-2
              ${isInvalid
                ? 'border-danger/70 focus-visible:ring-danger/40'
                : 'border-edge/70 focus-visible:ring-accent/40 focus-visible:border-accent'}`}
          />
        </div>

        <button
          onClick={save}
          disabled={isInvalid || !isDirty}
          className="shrink-0 h-10 px-4 rounded-xl text-sm font-semibold bg-accent text-base
            hover:brightness-110 transition-all active:scale-[0.97]
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saved ? <Check size={16} /> : 'Set'}
        </button>

        {settings.voiceRoomUrl && (
          <button
            onClick={clear}
            className="shrink-0 h-10 w-10 grid place-items-center rounded-xl border border-edge/70
              text-ink-muted hover:text-danger hover:border-danger/50 transition-colors"
            title="Remove voice room"
            aria-label="Remove voice room"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {isInvalid && (
        <p className="text-xs text-danger">
          That does not look like a valid link. It should start with https://
        </p>
      )}

      <p className="text-xs text-ink-muted/80 flex items-start gap-1.5 leading-relaxed">
        <Info size={13} className="shrink-0 mt-0.5" />
        <span>
          Everyone gets a Join button. The game cannot mute an external call, so
          agree to stay muted outside discussion.
        </span>
      </p>
    </div>
  );
}
