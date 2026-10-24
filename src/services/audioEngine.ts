import { Track } from '../types/music';

type PlaybackCallback = (state: {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}) => void;

class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private isPlaying = false;
  private currentTrack: Track | null = null;
  private currentTime = 0;
  private stepIndex = 0;
  private stepTimer: number | null = null;
  private clockTimer: number | null = null;
  private volume = 0.78;
  private isMuted = false;
  private onUpdateCallbacks: Set<PlaybackCallback> = new Set();
  private onTrackEndCallback: (() => void) | null = null;

  private ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.82;

      this.masterGain.gain.value = this.isMuted ? 0 : this.volume;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public subscribe(cb: PlaybackCallback): () => void {
    this.onUpdateCallbacks.add(cb);
    return () => {
      this.onUpdateCallbacks.delete(cb);
    };
  }

  public onTrackEnd(cb: () => void) {
    this.onTrackEndCallback = cb;
  }

  private emitUpdate() {
    const payload = {
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.currentTrack?.durationSec ?? 180,
    };
    this.onUpdateCallbacks.forEach((cb) => cb(payload));
  }

  public loadAndPlay(track: Track) {
    this.ensureContext();
    const isSameTrack = this.currentTrack?.id === track.id;
    this.currentTrack = track;
    if (!isSameTrack) {
      this.currentTime = 0;
      this.stepIndex = 0;
    }
    this.startPlayback();
  }

  public togglePlayPause(track?: Track) {
    if (track && (!this.currentTrack || this.currentTrack.id !== track.id)) {
      this.loadAndPlay(track);
      return;
    }
    if (this.isPlaying) {
      this.pause();
    } else if (this.currentTrack) {
      this.startPlayback();
    }
  }

  public pause() {
    this.isPlaying = false;
    this.clearTimers();
    this.emitUpdate();
  }

  public seek(seconds: number) {
    if (!this.currentTrack) return;
    this.currentTime = Math.max(0, Math.min(seconds, this.currentTrack.durationSec));
    this.emitUpdate();
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.volume,
        this.ctx.currentTime,
        0.03
      );
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.volume,
        this.ctx.currentTime,
        0.03
      );
    }
  }

  public getFrequencyData(): Uint8Array {
    if (!this.analyser || !this.isPlaying) {
      return new Uint8Array(24).fill(4);
    }
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data.slice(0, 24);
  }

  private clearTimers() {
    if (this.stepTimer !== null) {
      window.clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.clockTimer !== null) {
      window.clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  private startPlayback() {
    if (!this.currentTrack) return;
    this.ensureContext();
    this.clearTimers();
    this.isPlaying = true;
    this.emitUpdate();

    const bpm = this.currentTrack.bpm;
    const sixteenthMs = ((60 / bpm) / 4) * 1000;

    // Trigger first step immediately
    this.triggerStep();

    this.stepTimer = window.setInterval(() => {
      if (!this.isPlaying) return;
      this.triggerStep();
    }, sixteenthMs);

    this.clockTimer = window.setInterval(() => {
      if (!this.isPlaying || !this.currentTrack) return;
      this.currentTime += 0.25;
      if (this.currentTime >= this.currentTrack.durationSec) {
        this.currentTime = 0;
        this.pause();
        if (this.onTrackEndCallback) {
          this.onTrackEndCallback();
        }
        return;
      }
      this.emitUpdate();
    }, 250);
  }

  private semitoneToFreq(root: number, semitones: number): number {
    return root * Math.pow(2, semitones / 12);
  }

  private triggerStep() {
    if (!this.ctx || !this.masterGain || !this.currentTrack) return;

    const now = this.ctx.currentTime;
    const cfg = this.currentTrack.synthConfig;
    const step = this.stepIndex % 16;
    const bar = Math.floor(this.stepIndex / 16) % cfg.chordProgression.length;
    const chord = cfg.chordProgression[bar];

    // 1. Warm Polyphonic Pad on step 0 of each bar
    if (step === 0) {
      const barDuration = (60 / this.currentTrack.bpm) * 4;
      chord.forEach((semi) => {
        this.playPadVoice(
          this.semitoneToFreq(cfg.rootFreq, semi),
          now,
          barDuration * 0.95,
          cfg.waveform,
          cfg.filterCutoff
        );
      });
    }

    // 2. Bassline on 8th note steps
    if (step % 2 === 0) {
      const bassStep = (step / 2) % cfg.bassPattern.length;
      const bassSemi = cfg.bassPattern[bassStep];
      if (bassSemi >= 0) {
        const bassFreq = this.semitoneToFreq(cfg.rootFreq * 0.5, bassSemi);
        this.playBassNote(bassFreq, now, (60 / this.currentTrack.bpm) * 0.42);
      }
    }

    // 3. Melodic Arpeggio / Pluck
    const arpSemi = cfg.arpPattern[step % cfg.arpPattern.length];
    if (step % 2 === 0 || this.currentTrack.energy > 55) {
      const arpFreq = this.semitoneToFreq(cfg.rootFreq * 2, arpSemi);
      this.playPluckNote(
        arpFreq,
        now,
        (60 / this.currentTrack.bpm) * 0.22,
        cfg.filterCutoff
      );
    }

    // 4. Synthesized Percussion Groove
    if (step === 0 || step === 8 || (this.currentTrack.energy > 70 && (step === 4 || step === 12))) {
      this.playKick(now);
    }
    if (step === 4 || step === 12) {
      if (this.currentTrack.energy > 35) {
        this.playRimSnare(now);
      }
    }
    if (step % 2 === 1 && this.currentTrack.energy > 30) {
      this.playHiHat(now, step % 4 === 3 ? 0.08 : 0.04);
    }

    this.stepIndex++;
  }

  private playPadVoice(
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    cutoff: number
  ) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff * 0.7, startTime);
    filter.frequency.exponentialRampToValueAtTime(cutoff, startTime + duration * 0.5);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(0.055, startTime + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  private playBassNote(freq: number, startTime: number, duration: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, startTime);
    filter.frequency.exponentialRampToValueAtTime(140, startTime + duration);

    gain.gain.setValueAtTime(0.14, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private playPluckNote(
    freq: number,
    startTime: number,
    duration: number,
    cutoff: number
  ) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, startTime);
    filter.frequency.exponentialRampToValueAtTime(320, startTime + duration);

    gain.gain.setValueAtTime(0.05, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private playKick(startTime: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, startTime);
    osc.frequency.exponentialRampToValueAtTime(42, startTime + 0.12);

    gain.gain.setValueAtTime(0.24, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + 0.2);
  }

  private playRimSnare(startTime: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(290, startTime);
    osc.frequency.exponentialRampToValueAtTime(130, startTime + 0.06);

    gain.gain.setValueAtTime(0.07, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + 0.09);
  }

  private playHiHat(startTime: number, peakGain: number) {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 0.04;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.04);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(startTime);
  }
}

export const audioEngine = new StudioAudioEngine();
