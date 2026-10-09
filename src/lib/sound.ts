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

  /**
   * Background music.
   *
   * Everything else in here is synthesised from oscillators, and the music
   * used to be too — a phonk loop built from an 808 cowbell riff, a sliding
   * sub and trap hats. It did the job, but a real track does it better, so the
   * synth engine is gone and this plays an actual file.
   *
   * Deliberately an <audio> element rather than a decoded buffer: the track is
   * 1.7 MB, and an element streams it and lets the browser manage the memory,
   * where decodeAudioData would hold the whole thing uncompressed in RAM (over
   * 80 MB for three and a half minutes of stereo).
   */
  private bgAudio: HTMLAudioElement | null = null;
  private bgFadeTimer: number | null = null;
  private gestureArmed = false;

  /** Sits under conversation; the game is people talking, not the music. */
  private static readonly BG_VOLUME = 0.35;

  /**
   * Two encodings of the same track, in the order a browser should prefer
   * them. AAC is not a free codec, so it is missing from Chromium's
   * open-source builds and from Firefox on systems without a platform
   * decoder — those get Opus, which no browser has to license. Safari and
   * iOS take the m4a, which they decode in hardware.
   */
  private static readonly BG_SOURCES: ReadonlyArray<{ src: string; type: string }> = [
    { src: 'audio/theme.m4a', type: 'audio/mp4; codecs="mp4a.40.2"' },
    { src: 'audio/theme.webm', type: 'audio/webm; codecs="opus"' },
  ];

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof document === 'undefined') return null;
    if (!this.bgAudio) {
      const base = import.meta.env.BASE_URL ?? '/';
      const el = document.createElement('audio');
      // <source> children rather than a single src: the browser picks the
      // first one it can actually decode, which is a judgement we would
      // otherwise have to make from canPlayType's three-way maybe.
      for (const { src, type } of SoundManager.BG_SOURCES) {
        const source = document.createElement('source');
        source.src = `${base}${src}`;
        source.type = type;
        el.appendChild(source);
      }
      el.loop = true;
      // Nothing is fetched until someone actually starts it, so a muted
      // player never pays for the download.
      el.preload = 'none';
      el.volume = 0;
      this.bgAudio = el;
    }
    return this.bgAudio;
  }

  /** Ramps the element's volume, since an <audio> element has no gain node. */
  private fadeTo(target: number, ms: number) {
    const el = this.bgAudio;
    if (!el) return;
    if (this.bgFadeTimer !== null) clearInterval(this.bgFadeTimer);

    const from = el.volume;
    const started = Date.now();
    this.bgFadeTimer = window.setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / ms);
      el.volume = Math.max(0, Math.min(1, from + (target - from) * t));
      if (t >= 1) {
        if (this.bgFadeTimer !== null) clearInterval(this.bgFadeTimer);
        this.bgFadeTimer = null;
        if (target === 0) el.pause();
      }
    }, 40);
  }

  /**
   * Browsers refuse to start audio before the player has interacted with the
   * page, and the first thing that wants music is a phase change the player
   * did not necessarily click. Wait for the next real interaction instead of
   * giving up.
   */
  private armGesture() {
    if (this.gestureArmed || typeof window === 'undefined') return;
    this.gestureArmed = true;

    const go = () => {
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
      this.gestureArmed = false;
      if (!this.isMuted) this.playBackgroundMusic();
    };
    window.addEventListener('pointerdown', go, { once: true });
    window.addEventListener('keydown', go, { once: true });
  }

  playBackgroundMusic() {
    if (this.isMuted) return;
    const el = this.ensureAudio();
    if (!el) return;

    if (!el.paused) {
      // Already running — just make sure it is audible.
      this.fadeTo(SoundManager.BG_VOLUME, 800);
      return;
    }

    const started = el.play();
    if (started && typeof started.catch === 'function') {
      started
        .then(() => {
          // play() is asynchronous, and muting is one click away. Without
          // this the track would be faded back up on an element the mute had
          // already paused, and would be audible the moment anything resumed
          // it.
          if (!this.isMuted) this.fadeTo(SoundManager.BG_VOLUME, 1500);
        })
        .catch((err: unknown) => {
          // Only autoplay policy is worth waiting out. A browser that cannot
          // decode either encoding will reject every attempt, so retrying on
          // each click would just stall the same error forever.
          if ((err as Error)?.name === 'NotAllowedError') this.armGesture();
        });
    } else {
      this.fadeTo(SoundManager.BG_VOLUME, 1500);
    }
  }

  stopBackgroundMusic() {
    if (!this.bgAudio || this.bgAudio.paused) return;
    // Fade rather than cut; the pause lands at the end of the ramp.
    this.fadeTo(0, 400);
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
