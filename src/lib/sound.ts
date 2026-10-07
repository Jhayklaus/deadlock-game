const MUTE_KEY = 'mafieux-muted';

class SoundManager {
  private context: AudioContext | null = null;
  private isMuted: boolean = false;
  private muteListeners = new Set<(muted: boolean) => void>();

  constructor() {
    // Remember the choice across sessions. Wrapped because storage can throw
    // in private browsing, where silently defaulting to unmuted is fine.
    try {
      this.isMuted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.isMuted = false;
    }
    // Initialize AudioContext on first user interaction if possible, 
    // or lazily when playing sound.
    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      if (AudioContextClass) {
        this.context = new AudioContextClass();
      }
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  /** Whether sound is currently off. */
  getMuted(): boolean {
    return this.isMuted;
  }

  /** Subscribe to mute changes; returns an unsubscribe function. */
  onMuteChange(fn: (muted: boolean) => void): () => void {
    this.muteListeners.add(fn);
    return () => this.muteListeners.delete(fn);
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // Storage unavailable — the choice just will not persist.
    }

    // Muting mid-game should stop the loop immediately, not at the next phase.
    if (muted) this.stopBackgroundMusic();
    this.muteListeners.forEach(fn => fn(muted));
  }

  toggleMuted(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  private initContext() {
    if (this.context?.state === 'suspended') {
      this.context.resume();
    }
    if (!this.context) {
       try {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        if (AudioContextClass) {
          this.context = new AudioContextClass();
        }
      } catch (e) {
        console.warn('Web Audio API not supported');
      }
    }
  }

  playBeep(frequency: number = 440, duration: number = 0.1, type: OscillatorType = 'sine') {
    if (this.isMuted) return;
    this.initContext();
    if (!this.context) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this.context.currentTime);
    
    gain.gain.setValueAtTime(0.1, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.context.destination);

    osc.start();
    osc.stop(this.context.currentTime + duration);
  }

  playCountdownTick() {
    // High pitched short tick for countdown
    this.playBeep(880, 0.05, 'square');
  }

  playCountdownUrgent() {
    // Urgent tick
    this.playBeep(1200, 0.1, 'sawtooth');
  }

  playVoteSound() {
    this.playBeep(400, 0.1, 'sine');
  }

  playPhaseChange() {
    // Low drone/gong effect simulation
    if (this.isMuted) return;
    this.initContext();
    if (!this.context) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.frequency.setValueAtTime(100, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.context.currentTime + 1.5);
    
    gain.gain.setValueAtTime(0.3, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 1.5);

    osc.connect(gain);
    gain.connect(this.context.destination);

    osc.start();
    osc.stop(this.context.currentTime + 1.5);
  }

  private bgIsPlaying: boolean = false;
  private bgNextNoteTime: number = 0.0;
  private bgTimerID: number | null = null;
  
  /**
   * Phonk loop.
   *
   * Built from oscillators rather than an audio file, like the rest of the
   * sound in here — which means the genre has to be synthesised from its
   * actual parts: a distorted 808 cowbell riff, a sliding 808 sub, and trap
   * hats. Runs at 140 BPM on a 16th-note grid with a half-time feel.
   */

  /** Master gain for the loop, so the whole bed can be balanced in one place. */
  private bgMaster: GainNode | null = null;

  /** Reused distortion curve — building it per note would be wasteful. */
  private driveCurve: Float32Array<ArrayBuffer> | null = null;

  /** Sixteenth-note step within the 4-bar loop. */
  private bgStep: number = 0;

  // ── Patterns, one bar of sixteenths each ─────────────────────────────────
  private readonly KICK_STEPS = [0, 6, 10, 11];
  private readonly SNARE_STEPS = [4, 12];

  /**
   * The cowbell riff — the hook of the genre. Semitones from A, null = rest.
   * Four bars of A minor, ending on a lift so the loop does not feel static.
   */
  private readonly COWBELL_RIFF: (number | null)[] = [
    // bar 1
    0, null, 0, null, 3, null, 0, null, 5, null, 3, null, 0, null, null, null,
    // bar 2
    0, null, 0, null, 3, null, 0, null, 7, null, 5, null, 3, null, null, null,
    // bar 3
    0, null, 0, null, 3, null, 0, null, 5, null, 3, null, 0, null, null, null,
    // bar 4
    8, null, 7, null, 5, null, 3, null, 0, null, null, null, 0, null, 0, null,
  ];

  /** Root note per bar, semitones from A. */
  private readonly BASS_BARS = [0, 0, 5, 3];

  private makeDriveCurve(amount: number): Float32Array<ArrayBuffer> {
    const n = 1024;
    const curve = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
    }
    return curve;
  }

  /** A2 is the root; everything is a semitone offset from it. */
  private noteHz(semitonesFromA: number, octave: number = 0): number {
    return 110 * Math.pow(2, semitonesFromA / 12 + octave);
  }

  playBackgroundMusic() {
    if (this.isMuted || this.bgIsPlaying) return;
    this.initContext();
    if (!this.context) return;

    this.bgMaster = this.context.createGain();
    // Deliberately low: this sits under conversation, it is not the focus.
    this.bgMaster.gain.setValueAtTime(0, this.context.currentTime);
    this.bgMaster.gain.linearRampToValueAtTime(0.5, this.context.currentTime + 1.5);
    this.bgMaster.connect(this.context.destination);

    if (!this.driveCurve) this.driveCurve = this.makeDriveCurve(12);

    this.bgIsPlaying = true;
    this.bgStep = 0;
    this.bgNextNoteTime = this.context.currentTime + 0.05;
    this.scheduleNextNote();
  }

  private scheduleNextNote() {
    if (!this.bgIsPlaying || !this.context) return;

    const secondsPerStep = 60 / 140 / 4; // 140 BPM, sixteenths
    const scheduleAheadTime = 0.15;

    while (this.bgNextNoteTime < this.context.currentTime + scheduleAheadTime) {
      this.playBgNote(this.bgNextNoteTime);
      this.bgNextNoteTime += secondsPerStep;
      this.bgStep = (this.bgStep + 1) % this.COWBELL_RIFF.length;
    }

    this.bgTimerID = window.setTimeout(() => this.scheduleNextNote(), 25);
  }

  private playBgNote(time: number) {
    if (!this.context || !this.bgMaster) return;

    const step = this.bgStep;
    const inBar = step % 16;
    const bar = Math.floor(step / 16);
    const stepDur = 60 / 140 / 4;

    // ── Hats: every sixteenth, with the occasional roll ────────────────────
    const rolling = inBar === 14 && bar % 2 === 1;
    const hits = rolling ? 2 : 1;
    for (let i = 0; i < hits; i++) {
      this.hat(time + i * (stepDur / 2), inBar % 4 === 0 ? 0.16 : 0.09);
    }

    // ── Kick ───────────────────────────────────────────────────────────────
    if (this.KICK_STEPS.includes(inBar)) this.kick(time);

    // ── Snare / clap on the backbeat ───────────────────────────────────────
    if (this.SNARE_STEPS.includes(inBar)) this.snare(time);

    // ── 808 sub: one long sliding note per bar ─────────────────────────────
    if (inBar === 0) {
      const root = this.BASS_BARS[bar % this.BASS_BARS.length];
      this.sub808(time, this.noteHz(root, -1), stepDur * 14);
    }

    // ── Cowbell riff ───────────────────────────────────────────────────────
    const note = this.COWBELL_RIFF[step];
    if (note !== null && note !== undefined) {
      this.cowbell(time, this.noteHz(note, 2));
    }
  }

  /** Filtered noise burst. */
  private hat(time: number, level: number) {
    if (!this.context || !this.bgMaster) return;
    const len = 0.03;
    const buf = this.context.createBuffer(1, Math.floor(this.context.sampleRate * len), this.context.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src = this.context.createBufferSource();
    src.buffer = buf;

    const hp = this.context.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + len);

    src.connect(hp).connect(gain).connect(this.bgMaster);
    src.start(time);
    src.stop(time + len);
  }

  /** Sine with a fast pitch drop. */
  private kick(time: number) {
    if (!this.context || !this.bgMaster) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.09);

    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    osc.connect(gain).connect(this.bgMaster);
    osc.start(time);
    osc.stop(time + 0.32);
  }

  /** Noise burst with a band around the snare's body. */
  private snare(time: number) {
    if (!this.context || !this.bgMaster) return;
    const len = 0.16;
    const buf = this.context.createBuffer(1, Math.floor(this.context.sampleRate * len), this.context.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src = this.context.createBufferSource();
    src.buffer = buf;

    const bp = this.context.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.7;

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + len);

    src.connect(bp).connect(gain).connect(this.bgMaster);
    src.start(time);
    src.stop(time + len);
  }

  /** Distorted sub with a short glide in — the 808. */
  private sub808(time: number, freq: number, dur: number) {
    if (!this.context || !this.bgMaster || !this.driveCurve) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const shaper = this.context.createWaveShaper();
    const lp = this.context.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.08);

    shaper.curve = this.driveCurve;
    lp.type = 'lowpass';
    lp.frequency.value = 220;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.55, time + 0.02);
    gain.gain.setValueAtTime(0.55, time + dur * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(shaper).connect(lp).connect(gain).connect(this.bgMaster);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  /**
   * The 808 cowbell.
   *
   * Two square waves a fifth-ish apart (the 808's own ~1.48 ratio) through a
   * bandpass and some drive. This is the sound the whole genre is built on.
   */
  private cowbell(time: number, freq: number) {
    if (!this.context || !this.bgMaster || !this.driveCurve) return;
    const dur = 0.17;

    const oscA = this.context.createOscillator();
    const oscB = this.context.createOscillator();
    oscA.type = 'square';
    oscB.type = 'square';
    oscA.frequency.setValueAtTime(freq, time);
    oscB.frequency.setValueAtTime(freq * 1.48, time);

    const bp = this.context.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq * 2.2;
    bp.Q.value = 2.2;

    const shaper = this.context.createWaveShaper();
    shaper.curve = this.driveCurve;

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    oscA.connect(bp);
    oscB.connect(bp);
    bp.connect(shaper).connect(gain).connect(this.bgMaster);

    oscA.start(time); oscB.start(time);
    oscA.stop(time + dur); oscB.stop(time + dur);
  }

  stopBackgroundMusic() {
    this.bgIsPlaying = false;
    if (this.bgTimerID !== null) {
      clearTimeout(this.bgTimerID);
      this.bgTimerID = null;
    }
    // Fade out rather than cutting, then drop the node.
    if (this.context && this.bgMaster) {
      const master = this.bgMaster;
      const now = this.context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 0.4);
      setTimeout(() => master.disconnect(), 600);
      this.bgMaster = null;
    }
  }

  playVictorySound() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.context) return;

    const now = this.context.currentTime;
    
    // Epic Final Chord Progression (IV - V - I)
    // F Major -> G Major -> C Major
    
    const chords = [
        { freq: [174.61, 218.00, 261.63], time: 0, dur: 0.4 }, // F3, A3, C4
        { freq: [196.00, 246.94, 293.66], time: 0.4, dur: 0.4 }, // G3, B3, D4
        { freq: [130.81, 196.00, 261.63, 329.63, 523.25], time: 0.8, dur: 2.0 } // C3, G3, C4, E4, C5 (Big Finish)
    ];

    chords.forEach(chord => {
        chord.freq.forEach(f => {
            const osc = this.context!.createOscillator();
            const gain = this.context!.createGain();
            
            osc.type = 'sawtooth'; // Brassy
            osc.frequency.setValueAtTime(f, now + chord.time);
            
            // Brass envelope
            gain.gain.setValueAtTime(0, now + chord.time);
            gain.gain.linearRampToValueAtTime(0.1, now + chord.time + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, now + chord.time + chord.dur);
            
            // Low pass filter for brass warmth
            const filter = this.context!.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2000, now + chord.time);
            filter.frequency.exponentialRampToValueAtTime(500, now + chord.time + chord.dur);
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.context!.destination);
            
            osc.start(now + chord.time);
            osc.stop(now + chord.time + chord.dur);
        });
    });
  }

  playKillSound() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.context) return;

    // Sharp noise/impact
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.context.currentTime + 0.1); // Quick drop

    gain.gain.setValueAtTime(0.2, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.context.destination);

    osc.start();
    osc.stop(this.context.currentTime + 0.1);
  }
}


export const soundManager = new SoundManager();
