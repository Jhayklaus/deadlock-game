/**
 * In-app voice.
 *
 * Audio is routed by the game, not by the players: the server decides which
 * channel each person belongs to and whether they may speak, from the host's
 * own authoritative state. That is the whole point of doing this in-app rather
 * than linking out to a call — "stay muted outside discussion" is enforced,
 * not promised.
 *
 * Entirely optional. With no LiveKit credentials configured the server reports
 * voice as unavailable and nothing here ever runs.
 */
import type {
  Room,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
} from 'livekit-client';

/**
 * livekit-client is ~550KB, and most deployments never configure voice at all.
 * Loading it on demand keeps it out of the main bundle entirely — the chunk is
 * only fetched once a player actually joins a voice channel.
 */
type LiveKitModule = typeof import('livekit-client');
let liveKitModule: LiveKitModule | null = null;

async function loadLiveKit(): Promise<LiveKitModule> {
  if (!liveKitModule) {
    liveKitModule = await import('livekit-client');
  }
  return liveKitModule;
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export type VoiceChannel = 'town' | 'mafia' | 'dead';

export interface VoiceGrant {
  token: string | null;
  url: string | null;
  channel: VoiceChannel | null;
  canPublish: boolean;
  reason: string;
}

export interface VoiceStatus {
  /** Whether the server has LiveKit configured at all. */
  available: boolean;
  connected: boolean;
  channel: VoiceChannel | null;
  canPublish: boolean;
  muted: boolean;
  reason: string;
  speaking: string[];
  error: string | null;
}

type Listener = (status: VoiceStatus) => void;

class VoiceManager {
  private room: Room | null = null;
  private listeners = new Set<Listener>();
  private available: boolean | null = null;
  private currentKey: string | null = null;
  private connecting = false;

  private status: VoiceStatus = {
    available: false,
    connected: false,
    channel: null,
    canPublish: false,
    muted: true,
    reason: '',
    speaking: [],
    error: null,
  };

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private emit(patch: Partial<VoiceStatus>) {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach(fn => fn(this.status));
  }

  getStatus(): VoiceStatus {
    return this.status;
  }

  /** Asks the server once whether voice is configured at all. */
  async checkAvailability(): Promise<boolean> {
    if (this.available !== null) return this.available;
    try {
      const res = await fetch(`${SERVER_URL}/api/voice-config`);
      const data = await res.json();
      this.available = Boolean(data?.enabled);
    } catch {
      this.available = false;
    }
    this.emit({ available: this.available });
    return this.available;
  }

  /**
   * Brings the connection in line with the player's current grant.
   *
   * Called whenever the phase changes. A changed channel means tearing the old
   * connection down and building a new one, because channels are separate
   * LiveKit rooms — that separation is what stops night Mafia audio reaching
   * the Town.
   */
  async sync(roomId: string, userId: string): Promise<void> {
    if (!(await this.checkAvailability())) return;
    if (this.connecting) return;

    let grant: VoiceGrant;
    try {
      const res = await fetch(`${SERVER_URL}/api/voice-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId }),
      });
      if (!res.ok) {
        // 409 just means the host has not published state yet; try again later.
        if (res.status !== 409) this.emit({ error: 'Voice unavailable' });
        return;
      }
      grant = await res.json();
    } catch {
      this.emit({ error: 'Could not reach the voice service' });
      return;
    }

    // No channel: this player has no voice right now (asleep at night).
    if (!grant.channel || !grant.token || !grant.url) {
      await this.disconnect();
      this.emit({ channel: null, canPublish: false, reason: grant.reason, error: null });
      return;
    }

    const key = `${grant.channel}:${grant.canPublish}`;
    if (this.room && this.currentKey === key) {
      return; // Already in the right place with the right rights.
    }

    this.connecting = true;
    try {
      await this.disconnect();

      const { Room } = await loadLiveKit();
      const room = new Room({ adaptiveStream: true, dynacast: true });
      this.room = room;
      this.wire(room);

      await room.connect(grant.url, grant.token);

      // Join muted. Audio should never start flowing without a deliberate act.
      if (grant.canPublish) {
        await room.localParticipant.setMicrophoneEnabled(false);
      }

      this.currentKey = key;
      this.emit({
        connected: true,
        channel: grant.channel,
        canPublish: grant.canPublish,
        muted: true,
        reason: grant.reason,
        error: null,
      });
    } catch {
      this.emit({ connected: false, error: 'Could not join voice' });
      this.room = null;
      this.currentKey = null;
    } finally {
      this.connecting = false;
    }
  }

  private wire(room: Room) {
    // Safe: wire() is only reached after loadLiveKit() has resolved.
    const { RoomEvent } = liveKitModule!;
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (track.kind !== 'audio') return;
      // Attach off-DOM: the element only needs to exist for audio to play.
      const el = track.attach();
      el.id = `voice-${participant.identity}`;
      el.style.display = 'none';
      document.body.appendChild(el);
    });

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      track.detach().forEach(el => el.remove());
    });

    room.on(RoomEvent.ActiveSpeakersChanged, speakers => {
      this.emit({ speaking: speakers.map(s => s.identity) });
    });

    room.on(RoomEvent.Disconnected, () => {
      this.emit({ connected: false, speaking: [] });
      this.room = null;
      this.currentKey = null;
    });
  }

  /** Returns the new muted state. */
  async toggleMute(): Promise<boolean> {
    if (!this.room || !this.status.canPublish) return true;
    const next = !this.status.muted;
    try {
      await this.room.localParticipant.setMicrophoneEnabled(!next);
      this.emit({ muted: next });
      return next;
    } catch {
      this.emit({ error: 'Microphone unavailable' });
      return true;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.room) return;
    const room = this.room;
    this.room = null;
    this.currentKey = null;
    try {
      await room.disconnect();
    } catch {
      // Already gone.
    }
    this.emit({ connected: false, speaking: [], muted: true });
  }
}

export const voiceManager = new VoiceManager();
