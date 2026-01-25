class SoundManager {
  private context: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
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
  private bgNoteIndex: number = 0;
  private bgTimerID: number | null = null;
  
  // Spooky Waltz (A Minor with chromaticism)
  private melodySequence: number[] = [
    659.25, 587.33, 659.25, 698.46, 659.25, 587.33, 523.25, 493.88, // E5, D5, E5, F5, E5, D5, C5, B4
    440.00, 329.63, 440.00, 493.88, 523.25, 493.88, 523.25, 587.33  // A4, E4, A4, B4, C5, B4, C5, D5
  ];
  
  private bassSequence: number[] = [
    220.00, 174.61, 164.81, 174.61 // A3, F3, E3, F3
  ];

  playBackgroundMusic() {
    if (this.isMuted || this.bgIsPlaying) return;
    this.initContext();
    if (!this.context) return;

    this.bgIsPlaying = true;
    this.bgNoteIndex = 0;
    this.bgNextNoteTime = this.context.currentTime;
    this.scheduleNextNote();
  }

  private scheduleNextNote() {
      if (!this.bgIsPlaying || !this.context) return;

      const secondsPerBeat = 0.6; // ~100 BPM
      const scheduleAheadTime = 0.1;

      while (this.bgNextNoteTime < this.context.currentTime + scheduleAheadTime) {
          this.playBgNote(this.bgNextNoteTime);
          this.bgNextNoteTime += secondsPerBeat;
          this.bgNoteIndex++;
      }

      this.bgTimerID = window.setTimeout(() => this.scheduleNextNote(), 25);
  }

  private playBgNote(time: number) {
      if (!this.context) return;

      // Melody (Celesta/Music Box feel)
      const melodyFreq = this.melodySequence[this.bgNoteIndex % this.melodySequence.length];
      
      // Add some variation/rest
      if (this.bgNoteIndex % 8 !== 7) { // Skip every 8th note for phrasing
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        
        osc.type = 'sine'; // Pure tone
        osc.frequency.setValueAtTime(melodyFreq, time);
        
        // Bell-like envelope
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.05, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
        
        osc.connect(gain);
        gain.connect(this.context.destination);
        
        osc.start(time);
        osc.stop(time + 0.6);
      }

      // Bass (Deep String/Pad feel)
      if (this.bgNoteIndex % 4 === 0) {
          const bassFreq = this.bassSequence[Math.floor(this.bgNoteIndex / 4) % this.bassSequence.length];
          const osc = this.context.createOscillator();
          const gain = this.context.createGain();
          
          osc.type = 'triangle'; // Richer tone
          osc.frequency.setValueAtTime(bassFreq / 2, time); // Octave down
          
          // Slow attack/release pad
          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(0.08, time + 0.5);
          gain.gain.setValueAtTime(0.08, time + 2.0);
          gain.gain.linearRampToValueAtTime(0, time + 2.4);
          
          osc.connect(gain);
          gain.connect(this.context.destination);
          
          osc.start(time);
          osc.stop(time + 2.4);
      }
  }

  stopBackgroundMusic() {
    this.bgIsPlaying = false;
    if (this.bgTimerID !== null) {
        clearTimeout(this.bgTimerID);
        this.bgTimerID = null;
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
