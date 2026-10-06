/**
 * Audio Engine: Web Audio API Synthesizer & Tactile Haptic Sound Effects
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Synthesizer loops
  private isMusicPlaying = false;
  private musicTimer: number | null = null;
  private synthStep = 0;
  private currentPreset: 'synthwave' | 'ambient_lofi' | 'techno_pulse' | 'reference_tone' = 'synthwave';

  // Last degree tick played
  private lastTickDegree = 0;

  constructor() {
    // AudioContext is initialized on first user gesture or explicit start
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.7;

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.4;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;

      // Routing:
      // musicGain -> masterGain -> analyser -> destination
      // sfxGain -> destination (so ticks are always audible even if music is muted)
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Set digital master volume (0.0 to 1.0)
   */
  public setVolume(volumeNorm: number, isMuted: boolean = false) {
    this.initContext();
    if (!this.masterGain || !this.ctx) return;

    const targetGain = isMuted ? 0 : Math.max(0, Math.min(1, volumeNorm));
    // Smooth ramp to avoid audio popping
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.04);
  }

  /**
   * Play tactile mechanical tick when turning dial
   */
  public playKnobTick(currentDegree: number, stepThreshold: number = 4) {
    if (Math.abs(currentDegree - this.lastTickDegree) < stepThreshold) {
      return;
    }
    this.lastTickDegree = currentDegree;

    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // High tactile transient click
    const pitch = 1400 + ((currentDegree % 30) * 15);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.015);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.02);
  }

  /**
   * Play aerodynamic whoosh sound when palm wave/swipe is detected
   */
  public playWaveWhoosh(speedRatio: number = 0.5) {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    const baseFreq = 180 + Math.min(1, speedRatio) * 320;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.18);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.18);

    const vol = 0.06 + Math.min(1, speedRatio) * 0.08;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.18);
  }

  /**
   * Play distinct grab lock-in sound
   */
  public playGrabSound() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(680, t + 0.08);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  /**
   * Play gesture release sound
   */
  public playReleaseSound() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.07);

    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.09);
  }

  /**
   * Start / Stop synthesized music track to audition volume
   */
  public toggleMusic(preset?: 'synthwave' | 'ambient_lofi' | 'techno_pulse' | 'reference_tone'): boolean {
    this.initContext();
    if (preset) this.currentPreset = preset;

    if (this.isMusicPlaying) {
      this.stopMusic();
      return false;
    } else {
      this.startMusic();
      return true;
    }
  }

  public setPreset(preset: 'synthwave' | 'ambient_lofi' | 'techno_pulse' | 'reference_tone') {
    this.currentPreset = preset;
  }

  public getIsPlaying(): boolean {
    return this.isMusicPlaying;
  }

  private startMusic() {
    this.isMusicPlaying = true;
    this.synthStep = 0;
    this.scheduleNextBeat();
  }

  private stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleNextBeat() {
    if (!this.isMusicPlaying || !this.ctx || !this.musicGain) return;

    const t = this.ctx.currentTime;
    const step = this.synthStep % 16;

    if (this.currentPreset === 'synthwave') {
      // 80s synth chord notes (frequencies)
      const bassNotes = [110, 110, 130.81, 130.81, 98, 98, 87.31, 87.31];
      const melodyNotes = [440, 523.25, 659.25, 587.33, 440, 523.25, 783.99, 659.25];

      // Bass note on each 8th step
      if (step % 2 === 0) {
        const bassFreq = bassNotes[(step / 2) % bassNotes.length];
        this.playSynthNote(bassFreq, 0.2, 'sawtooth', 0.18);
      }

      // Arpeggio melody note
      if (step % 1 === 0) {
        const leadFreq = melodyNotes[step % melodyNotes.length];
        this.playSynthNote(leadFreq, 0.15, 'sine', 0.12);
      }

      // Snare / Hi-hat accent
      if (step === 4 || step === 12) {
        this.playNoiseHit(0.08, 0.08);
      } else if (step % 2 === 0) {
        this.playNoiseHit(0.03, 0.04);
      }
    } else if (this.currentPreset === 'ambient_lofi') {
      // Gentle warm chords
      const chords = [
        [220, 261.63, 329.63], // Am
        [174.61, 220, 261.63], // F
        [196, 246.94, 293.66], // G
        [164.81, 196, 246.94], // Em
      ];
      if (step % 4 === 0) {
        const chord = chords[Math.floor(step / 4) % chords.length];
        chord.forEach(f => this.playSynthNote(f, 0.6, 'triangle', 0.1));
      }
    } else if (this.currentPreset === 'techno_pulse') {
      // Punchy kick and bass line
      if (step % 4 === 0) {
        this.playKick(0.25);
      }
      const acidNotes = [130.81, 146.83, 164.81, 174.61, 196.0, 130.81];
      this.playSynthNote(acidNotes[step % acidNotes.length], 0.12, 'sawtooth', 0.15);
    } else if (this.currentPreset === 'reference_tone') {
      // Pure 440 Hz test sine
      if (step % 4 === 0) {
        this.playSynthNote(440, 0.4, 'sine', 0.15);
      }
    }

    this.synthStep++;
    // Tempo ~ 125 BPM -> ~120ms per 16th note
    const intervalMs = this.currentPreset === 'ambient_lofi' ? 220 : 120;
    this.musicTimer = window.setTimeout(() => this.scheduleNextBeat(), intervalMs);
  }

  private playSynthNote(freq: number, duration: number, type: OscillatorType, volume: number) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, t);
    filter.frequency.exponentialRampToValueAtTime(600, t + duration);

    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(t);
    osc.stop(t + duration);
  }

  private playKick(volume: number) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.15);

    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  private playNoiseHit(duration: number, volume: number) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 4000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start(t);
  }

  /**
   * Get frequency data array for visualizer
   */
  public getFrequencyData(outputArray: Uint8Array): void {
    if (this.analyser && this.isMusicPlaying) {
      // Cast to satisfy TS ArrayBuffer compatibility
      this.analyser.getByteFrequencyData(outputArray as unknown as Uint8Array<ArrayBuffer>);
    } else {
      outputArray.fill(0);
    }
  }
}

export const soundEngine = new AudioEngine();
