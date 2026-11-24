/**
 * Zero-dependency procedural Web Audio API casino foley synthesizer.
 * Generates authentic felt card slides, Paulson clay chip clinks, card-peek flicks,
 * and subtle warm showdown chimes with zero external audio files.
 */
export class CasinoSoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private userActivated = false;
  private gestureListenersBound = false;
  public enabled = true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.bindGestureUnlock();
    }
  }

  private bindGestureUnlock() {
    if (this.gestureListenersBound || typeof window === 'undefined') return;
    this.gestureListenersBound = true;
    window.addEventListener('pointerdown', this.handleUserGesture, { capture: true, passive: true });
    window.addEventListener('keydown', this.handleUserGesture, { capture: true, passive: true });
  }

  private unbindGestureUnlock() {
    if (!this.gestureListenersBound || typeof window === 'undefined') return;
    this.gestureListenersBound = false;
    window.removeEventListener('pointerdown', this.handleUserGesture, { capture: true });
    window.removeEventListener('keydown', this.handleUserGesture, { capture: true });
  }

  private handleUserGesture = () => {
    this.userActivated = true;
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      if (this.ctx && this.ctx.state === 'running') {
        this.unbindGestureUnlock();
      }
    } catch {
      // Ignore Web Audio construction or resume failures
    }
  };

  private hasUserActivation(): boolean {
    if (this.userActivated) return true;
    if (typeof navigator !== 'undefined') {
      const nav = navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } };
      if (nav.userActivation?.hasBeenActive) return true;
    }
    return false;
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        if (!this.hasUserActivation()) return null;
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      // Never schedule Web Audio nodes while suspended/closed (prevents autoplay queue pile-up)
      if (this.ctx.state !== 'running') {
        return null;
      }
      if (!this.noiseBuffer) {
        const sampleRate = this.ctx.sampleRate;
        const length = Math.floor(sampleRate * 0.4);
        const buf = this.ctx.createBuffer(1, length, sampleRate);
        const data = buf.getChannelData(0);
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.997 * b0 + white * 0.029;
          b1 = 0.985 * b1 + white * 0.032;
          b2 = 0.95 * b2 + white * 0.048;
          data[i] = (b0 + b1 + b2 + white * 0.18) * 1.4;
        }
        this.noiseBuffer = buf;
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Soft Kem/Copag cardstock glide across casino speed-cloth */
  public playCardSlide(delaySec = 0) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime + delaySec;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1650 + Math.random() * 350, now);
    filter.frequency.exponentialRampToValueAtTime(720, now + 0.11);
    filter.Q.value = 1.6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.095, now + 0.022);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.13);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.14);
  }

  /** Crisp subtle cardstock corner bend when peeking at Hero's hole cards */
  public playCardPeek() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2200, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.065);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.075);
  }

  /** Authentic Paulson compression-clay poker chip clink & stack settle */
  public playChipClink(count = 2, delaySec = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const taps = Math.max(1, Math.min(4, count));
    for (let i = 0; i < taps; i++) {
      const start = ctx.currentTime + delaySec + i * (0.045 + Math.random() * 0.02);
      const baseFreq = 2550 + Math.random() * 420;
      const partials = [
        { freq: baseFreq, amp: 0.045, decay: 0.055 },
        { freq: baseFreq * 1.54, amp: 0.032, decay: 0.042 },
        { freq: baseFreq * 2.31, amp: 0.018, decay: 0.028 },
      ];

      for (const p of partials) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(p.freq, start);
        osc.frequency.exponentialRampToValueAtTime(p.freq * 0.96, start + p.decay);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(p.amp, start + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0005, start + p.decay);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + p.decay + 0.01);
      }
    }
  }

  /** Warm, understated salon harmonic chord when a showdown pot is awarded */
  public playWinnerChime() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.055;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.03, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0005, start + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.58);
    });
  }

  public dispose() {
    this.unbindGestureUnlock();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.noiseBuffer = null;
  }
}
