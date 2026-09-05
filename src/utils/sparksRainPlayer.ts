// Procedural 11:47 PM Lo-Fi Ambient Engine for "Sparks in the rain"
// Generates warm analog Rhodes chords, soft midnight rain texture, and delicate bell sparks

class SparksRainPlayer {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private masterGain: GainNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private timerId: any = null;
  private sparkTimerId: any = null;
  private currentStep = 0;
  private volume = 0.65;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Create a seamless looping noise buffer for rain & tape hiss
  private createRainBuffer(ctx: AudioContext): AudioBuffer {
    const bufferSize = ctx.sampleRate * 4; // 4 seconds loop
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    // Pink-ish noise generation with random micro-sparks
    let b0L = 0, b1L = 0, b2L = 0, b3L = 0;
    let b0R = 0, b1R = 0, b2R = 0, b3R = 0;

    for (let i = 0; i < bufferSize; i++) {
      const whiteL = Math.random() * 2 - 1;
      const whiteR = Math.random() * 2 - 1;

      // Filter to pink noise (rain body)
      b0L = 0.99886 * b0L + whiteL * 0.0555179;
      b1L = 0.99332 * b1L + whiteL * 0.0750759;
      b2L = 0.96900 * b2L + whiteL * 0.1538520;
      b3L = 0.86650 * b3L + whiteL * 0.3104856;
      left[i] = (b0L + b1L + b2L + b3L) * 0.08;

      b0R = 0.99886 * b0R + whiteR * 0.0555179;
      b1R = 0.99332 * b1R + whiteR * 0.0750759;
      b2R = 0.96900 * b2R + whiteR * 0.1538520;
      b3R = 0.86650 * b3R + whiteR * 0.3104856;
      right[i] = (b0R + b1R + b2R + b3R) * 0.08;

      // Occasional vinyl tape crackle / rain drop spark
      if (Math.random() < 0.0006) {
        const spark = (Math.random() - 0.5) * 0.18;
        left[i] += spark;
        right[i] += spark * 0.7;
      }
    }
    return buffer;
  }

  // Soft melancholic late-night chord progression:
  // Dmaj9 -> Bm9 -> Gmaj9 -> A6/9 (in Hz)
  private readonly chords = [
    [146.83, 220.00, 277.18, 329.63, 369.99], // D3, A3, C#4, E4, F#4 (Dmaj9)
    [123.47, 220.00, 246.94, 293.66, 369.99], // B2, A3, B3, D4, F#4 (Bm9)
    [98.00,  196.00, 246.94, 293.66, 369.99], // G2, G3, B3, D4, F#4 (Gmaj9)
    [110.00, 220.00, 277.18, 329.63, 440.00], // A2, A3, C#4, E4, A4 (A6/9)
  ];

  // Bell sparks frequencies (pentatonic high chimes: F#5, A5, B5, C#6, E6, F#6)
  private readonly sparkFrequencies = [
    739.99, 880.00, 987.77, 1108.73, 1318.51, 1479.98
  ];

  private playChord(ctx: AudioContext, frequencies: number[], duration: number) {
    if (!this.masterGain) return;
    const now = ctx.currentTime;

    // LFO for subtle analog tape flutter (wow & flutter)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(0.35, now);
    lfoGain.gain.setValueAtTime(1.8, now); // gentle pitch drift in Hz
    lfo.connect(lfoGain);

    // Warm tape filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + 1.2);
    filter.frequency.exponentialRampToValueAtTime(800, now + duration);

    const chordGain = ctx.createGain();
    chordGain.gain.setValueAtTime(0.001, now);
    chordGain.gain.linearRampToValueAtTime(0.12, now + 0.6); // smooth gentle attack
    chordGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    chordGain.connect(this.masterGain);
    filter.connect(chordGain);

    frequencies.forEach((freq, idx) => {
      // Warm twin oscillators: triangle + sine with gentle detune
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();

      osc1.type = 'triangle';
      osc2.type = 'sine';

      // slight strum offset
      const noteTime = now + idx * 0.04;
      osc1.frequency.setValueAtTime(freq, noteTime);
      osc2.frequency.setValueAtTime(freq * 1.002, noteTime); // subtle chorus detune

      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);

      const noteGain = ctx.createGain();
      const volumeScale = idx === 0 ? 0.9 : 0.6; // slightly louder bass note
      noteGain.gain.setValueAtTime(0.001, noteTime);
      noteGain.gain.linearRampToValueAtTime(volumeScale, noteTime + 0.3);
      noteGain.gain.exponentialRampToValueAtTime(0.001, noteTime + duration - 0.2);

      osc1.connect(noteGain);
      osc2.connect(noteGain);
      noteGain.connect(filter);

      osc1.start(noteTime);
      osc2.start(noteTime);
      osc1.stop(noteTime + duration);
      osc2.stop(noteTime + duration);
    });

    lfo.start(now);
    lfo.stop(now + duration);
  }

  // Play a delicate spark chime (raindrop / night star spark)
  private playSpark(ctx: AudioContext) {
    if (!this.masterGain || !this.isPlaying) return;
    const now = ctx.currentTime;
    const freq = this.sparkFrequencies[Math.floor(Math.random() * this.sparkFrequencies.length)];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, now);
    filter.Q.setValueAtTime(3.0, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.035, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8); // dreamy long decay

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 1.9);
  }

  start(): boolean {
    const ctx = this.getContext();
    if (!ctx) return false;

    if (this.isPlaying) return true;
    this.isPlaying = true;

    // Master volume node with soft fade-in
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 1.0);
    this.masterGain.connect(ctx.destination);

    // 1. Rain & Tape Hiss loop
    try {
      const rainBuffer = this.createRainBuffer(ctx);
      const rainSource = ctx.createBufferSource();
      rainSource.buffer = rainBuffer;
      rainSource.loop = true;

      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'lowpass';
      rainFilter.frequency.setValueAtTime(1100, ctx.currentTime);

      const rainGain = ctx.createGain();
      rainGain.gain.setValueAtTime(0.22, ctx.currentTime);

      rainSource.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(this.masterGain);

      rainSource.start();
      this.rainSource = rainSource;
    } catch (e) {
      console.warn('Rain buffer initialization skipped:', e);
    }

    // 2. Chords scheduler (each chord lasts 4.5 seconds for a slow meditative tempo)
    const chordDuration = 4.5;
    this.currentStep = 0;

    const tickChords = () => {
      if (!this.isPlaying || !this.ctx) return;
      const currentChord = this.chords[this.currentStep % this.chords.length];
      this.playChord(this.ctx, currentChord, chordDuration + 0.8); // small overlap for smooth voice leading
      this.currentStep++;
      this.timerId = setTimeout(tickChords, chordDuration * 1000);
    };

    tickChords();

    // 3. Delicate "Sparks" chime scheduler
    const scheduleNextSpark = () => {
      if (!this.isPlaying || !this.ctx) return;
      this.playSpark(this.ctx);
      const nextDelay = 1200 + Math.random() * 2400; // random delay between 1.2s and 3.6s
      this.sparkTimerId = setTimeout(scheduleNextSpark, nextDelay);
    };

    this.sparkTimerId = setTimeout(scheduleNextSpark, 1500);

    return true;
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.sparkTimerId) {
      clearTimeout(this.sparkTimerId);
      this.sparkTimerId = null;
    }

    if (this.masterGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(0.001, now + 0.8); // gentle fade-out
        setTimeout(() => {
          if (this.rainSource) {
            try { this.rainSource.stop(); } catch {}
            this.rainSource = null;
          }
          this.masterGain?.disconnect();
          this.masterGain = null;
        }, 850);
      } catch {
        this.masterGain = null;
      }
    }
  }

  toggle(): boolean {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      return this.start();
    }
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.1);
    }
  }

  getPlaying(): boolean {
    return this.isPlaying;
  }
}

export const sparksRainPlayer = new SparksRainPlayer();
