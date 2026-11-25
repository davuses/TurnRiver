/**
 * Zero-dependency procedural Web Audio API casino foley synthesizer.
 * Features a shared salon master bus (dry + procedural 0.3s velvet-room ConvolverNode
 * at ~12% wet -> DynamicsCompressorNode -> masterGain), per-event stereo panning,
 * 2.0s randomized-offset pink noise buffer, and a 120ms resume() grace queue so
 * first-click SFX are never dropped.
 */

interface PendingAudioEvent {
  fn: (ctx: AudioContext) => void;
  queuedAt: number;
}

const RESUME_GRACE_MS = 120;
const MAX_PENDING_EVENTS = 16;
const NOISE_DURATION_SEC = 2.0;

function clampPan(pan: number): number {
  if (!Number.isFinite(pan)) return 0;
  return Math.max(-0.85, Math.min(0.85, pan));
}

export class CasinoSoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private dryBus: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private wetGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;

  private userActivated = false;
  private gestureListenersBound = false;
  private pendingQueue: PendingAudioEvent[] = [];
  private resumeInFlight = false;

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
      const ctx = this.getOrCreateContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        this.kickResume(ctx);
      } else if (ctx.state === 'running') {
        this.ensureAudioGraph(ctx);
        this.flushPendingQueue();
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

  private getOrCreateContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;
    if (!this.hasUserActivation()) return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    this.ctx = new AudioCtx();
    return this.ctx;
  }

  private kickResume(ctx: AudioContext) {
    if (this.resumeInFlight) return;
    this.resumeInFlight = true;
    void ctx
      .resume()
      .then(() => {
        this.resumeInFlight = false;
        if (this.ctx === ctx && ctx.state === 'running') {
          this.ensureAudioGraph(ctx);
          this.flushPendingQueue();
          this.unbindGestureUnlock();
        }
      })
      .catch(() => {
        this.resumeInFlight = false;
        this.pendingQueue = [];
      });
  }

  private flushPendingQueue() {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') {
      this.pendingQueue = [];
      return;
    }
    const ctx = this.ctx;
    this.ensureAudioGraph(ctx);
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const queue = this.pendingQueue;
    this.pendingQueue = [];
    for (const item of queue) {
      if (nowMs - item.queuedAt <= RESUME_GRACE_MS) {
        try {
          item.fn(ctx);
        } catch {
          // Ignore individual synthesis failures
        }
      }
    }
  }

  private ensureAudioGraph(ctx: AudioContext) {
    if (!this.noiseBuffer) {
      const sampleRate = ctx.sampleRate;
      const length = Math.floor(sampleRate * NOISE_DURATION_SEC);
      const buf = ctx.createBuffer(1, length, sampleRate);
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

    if (this.dryBus && this.masterGain) return;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, ctx.currentTime);
    compressor.knee.setValueAtTime(18, ctx.currentTime);
    compressor.ratio.setValueAtTime(4, ctx.currentTime);
    compressor.attack.setValueAtTime(0.004, ctx.currentTime);
    compressor.release.setValueAtTime(0.15, ctx.currentTime);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.95, ctx.currentTime);

    const dryBus = ctx.createGain();
    dryBus.gain.setValueAtTime(1.0, ctx.currentTime);

    const reverbSend = ctx.createGain();
    reverbSend.gain.setValueAtTime(1.0, ctx.currentTime);

    const wetGain = ctx.createGain();
    wetGain.gain.setValueAtTime(0.12, ctx.currentTime);

    dryBus.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Subtle 0.3s procedural velvet-salon impulse response
    if (typeof ctx.createConvolver === 'function') {
      try {
        const convolver = ctx.createConvolver();
        const irDuration = 0.3;
        const irLen = Math.max(1, Math.floor(ctx.sampleRate * irDuration));
        const irBuf = ctx.createBuffer(2, irLen, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const chData = irBuf.getChannelData(ch);
          let lp = 0;
          for (let i = 0; i < irLen; i++) {
            const t = i / irLen;
            const env = Math.pow(1 - t, 2.8);
            const white = Math.random() * 2 - 1;
            // Gentle one-pole damping so the room tail sounds warm like mahogany & baize
            lp = lp * 0.58 + white * 0.42;
            chData[i] = lp * env * 0.55;
          }
        }
        convolver.buffer = irBuf;
        reverbSend.connect(convolver);
        convolver.connect(wetGain);
        wetGain.connect(compressor);
        this.convolver = convolver;
      } catch {
        // Fallback: dry-only bus if ConvolverNode fails
      }
    }

    this.dryBus = dryBus;
    this.reverbSend = reverbSend;
    this.wetGain = wetGain;
    this.compressor = compressor;
    this.masterGain = masterGain;
  }

  private withAudio(fn: (ctx: AudioContext) => void) {
    if (!this.enabled || typeof window === 'undefined') return;
    try {
      const ctx = this.getOrCreateContext();
      if (!ctx) return;

      if (ctx.state === 'running') {
        this.ensureAudioGraph(ctx);
        fn(ctx);
        return;
      }

      if (ctx.state === 'suspended') {
        const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (this.pendingQueue.length >= MAX_PENDING_EVENTS) {
          this.pendingQueue.shift();
        }
        this.pendingQueue.push({ fn, queuedAt: nowMs });
        this.kickResume(ctx);
      }
    } catch {
      // Ignore Web Audio errors in restricted environments
    }
  }

  private createPannedOutput(ctx: AudioContext, pan = 0): AudioNode {
    const dryTarget = this.dryBus ?? ctx.destination;
    const clamped = clampPan(pan);
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(clamped, ctx.currentTime);
      panner.connect(dryTarget);
      if (this.reverbSend && this.convolver) {
        panner.connect(this.reverbSend);
      }
      return panner;
    }
    return dryTarget;
  }

  private randomNoiseOffset(durationSec: number): number {
    const maxOffset = Math.max(0, NOISE_DURATION_SEC - durationSec - 0.04);
    return Math.random() * maxOffset;
  }

  /** Soft Kem/Copag cardstock glide across casino speed-cloth */
  public playCardSlide(delaySec = 0, pan = 0, gainScale = 1): void {
    this.withAudio((ctx) => {
      if (!this.noiseBuffer) return;
      const scale = Math.max(0.1, Math.min(1.5, gainScale));
      const now = ctx.currentTime + Math.max(0, delaySec);
      const out = this.createPannedOutput(ctx, pan);

      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1650 + Math.random() * 360, now);
      filter.frequency.exponentialRampToValueAtTime(720, now + 0.11);
      filter.Q.value = 1.6;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.095 * scale, now + 0.022);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.13);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      src.start(now, this.randomNoiseOffset(0.15), 0.15);
    });
  }

  /** Crisp cardstock flexural snap when flipping a card face-up */
  public playCardFlipSnap(pan = 0): void {
    this.withAudio((ctx) => {
      if (!this.noiseBuffer) return;
      const now = ctx.currentTime;
      const out = this.createPannedOutput(ctx, pan);

      // Sharp paper snap transient
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2600 + Math.random() * 350, now);
      bp.frequency.exponentialRampToValueAtTime(1150, now + 0.042);
      bp.Q.value = 2.1;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.0001, now);
      nGain.gain.linearRampToValueAtTime(0.085, now + 0.004);
      nGain.gain.exponentialRampToValueAtTime(0.0006, now + 0.046);

      src.connect(bp);
      bp.connect(nGain);
      nGain.connect(out);
      src.start(now, this.randomNoiseOffset(0.06), 0.06);

      // Subtle plastic cardstock flex pop
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340 + Math.random() * 50, now);
      osc.frequency.exponentialRampToValueAtTime(135, now + 0.03);

      const oGain = ctx.createGain();
      oGain.gain.setValueAtTime(0.0001, now);
      oGain.gain.linearRampToValueAtTime(0.032, now + 0.003);
      oGain.gain.exponentialRampToValueAtTime(0.0006, now + 0.034);

      osc.connect(oGain);
      oGain.connect(out);
      osc.start(now);
      osc.stop(now + 0.04);
    });
  }

  /** Soft weighted card settling flat onto casino speed-cloth */
  public playCardFeltSlap(pan = 0): void {
    this.withAudio((ctx) => {
      if (!this.noiseBuffer) return;
      const now = ctx.currentTime;
      const out = this.createPannedOutput(ctx, pan);

      // Muted baize cushion thump
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(185 + Math.random() * 25, now);
      osc.frequency.exponentialRampToValueAtTime(76, now + 0.052);

      const oGain = ctx.createGain();
      oGain.gain.setValueAtTime(0.0001, now);
      oGain.gain.linearRampToValueAtTime(0.045, now + 0.005);
      oGain.gain.exponentialRampToValueAtTime(0.0006, now + 0.056);

      osc.connect(oGain);
      oGain.connect(out);
      osc.start(now);
      osc.stop(now + 0.062);

      // Low-passed air-cushion puff
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(980, now);
      lp.frequency.exponentialRampToValueAtTime(420, now + 0.045);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.0001, now);
      nGain.gain.linearRampToValueAtTime(0.055, now + 0.007);
      nGain.gain.exponentialRampToValueAtTime(0.0006, now + 0.048);

      src.connect(lp);
      lp.connect(nGain);
      nGain.connect(out);
      src.start(now, this.randomNoiseOffset(0.06), 0.06);
    });
  }

  /** Soft double-card sweep when mucking a folded hand toward the dealer */
  public playCardMuck(pan = 0): void {
    this.withAudio((ctx) => {
      if (!this.noiseBuffer) return;
      const out = this.createPannedOutput(ctx, pan);
      const offsets = [0, 0.055];

      for (let i = 0; i < offsets.length; i++) {
        const start = ctx.currentTime + offsets[i];
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;

        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1320 - i * 140 + Math.random() * 180, start);
        bp.frequency.exponentialRampToValueAtTime(520, start + 0.13);
        bp.Q.value = 1.4;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(i === 0 ? 0.072 : 0.055, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0006, start + 0.14);

        src.connect(bp);
        bp.connect(gain);
        gain.connect(out);
        src.start(start, this.randomNoiseOffset(0.16), 0.16);
      }
    });
  }

  /** Crisp subtle cardstock corner bend when peeking at Hero's hole cards */
  public playCardPeek(isUp = true): void {
    this.withAudio((ctx) => {
      if (!this.noiseBuffer) return;
      const now = ctx.currentTime;
      const out = this.createPannedOutput(ctx, 0);

      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = isUp ? 'highpass' : 'bandpass';
      if (isUp) {
        filter.frequency.setValueAtTime(2150, now);
        filter.frequency.exponentialRampToValueAtTime(2650, now + 0.055);
      } else {
        filter.frequency.setValueAtTime(1750, now);
        filter.frequency.exponentialRampToValueAtTime(920, now + 0.055);
        filter.Q.value = 1.5;
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(isUp ? 0.048 : 0.036, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.065);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      src.start(now, this.randomNoiseOffset(0.08), 0.08);
    });
  }

  /**
   * Authentic Paulson compression-clay poker chip clink & stack settle:
   * 2ms HP click transient + 3 ceramic modes + low felt thud, scaling 1..8.
   */
  public playChipClink(count = 2, delaySec = 0, pan = 0): void {
    this.withAudio((ctx) => {
      const taps = Math.max(1, Math.min(8, Math.round(count)));
      const stepBase = taps > 4 ? 0.032 : 0.042;
      const baseTime = ctx.currentTime + Math.max(0, delaySec);

      for (let i = 0; i < taps; i++) {
        const start = baseTime + i * (stepBase + Math.random() * 0.018);
        const chipPan = clampPan(pan + (Math.random() - 0.5) * 0.14);
        const out = this.createPannedOutput(ctx, chipPan);
        const densityScale = taps > 4 ? 0.85 : 1.0;

        // 1) 2ms high-pass clay-edge click transient
        if (this.noiseBuffer) {
          const clickSrc = ctx.createBufferSource();
          clickSrc.buffer = this.noiseBuffer;

          const hp = ctx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.setValueAtTime(4200, start);

          const clickGain = ctx.createGain();
          clickGain.gain.setValueAtTime(0.0001, start);
          clickGain.gain.linearRampToValueAtTime(0.062 * densityScale, start + 0.002);
          clickGain.gain.exponentialRampToValueAtTime(0.0005, start + 0.012);

          clickSrc.connect(hp);
          hp.connect(clickGain);
          clickGain.connect(out);
          clickSrc.start(start, this.randomNoiseOffset(0.02), 0.02);
        }

        // 2) 3 ceramic/compression-clay resonant modes
        const baseFreq = 2480 + Math.random() * 440;
        const partials = [
          { freq: baseFreq, amp: 0.044 * densityScale, decay: 0.054 },
          { freq: baseFreq * 1.54, amp: 0.031 * densityScale, decay: 0.04 },
          { freq: baseFreq * 2.31, amp: 0.017 * densityScale, decay: 0.026 },
        ];

        for (const p of partials) {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(p.freq, start);
          osc.frequency.exponentialRampToValueAtTime(p.freq * 0.96, start + p.decay);

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(p.amp, start + 0.0025);
          gain.gain.exponentialRampToValueAtTime(0.0005, start + p.decay);

          osc.connect(gain);
          gain.connect(out);
          osc.start(start);
          osc.stop(start + p.decay + 0.01);
        }

        // 3) Low felt thud body (prominent on first/final settle, subtle in cascades)
        const thudAmp = (i === 0 || i === taps - 1 ? 0.032 : 0.016) * densityScale;
        const thud = ctx.createOscillator();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(205 + Math.random() * 30, start);
        thud.frequency.exponentialRampToValueAtTime(82, start + 0.042);

        const thudGain = ctx.createGain();
        thudGain.gain.setValueAtTime(0.0001, start);
        thudGain.gain.linearRampToValueAtTime(thudAmp, start + 0.003);
        thudGain.gain.exponentialRampToValueAtTime(0.0005, start + 0.045);

        thud.connect(thudGain);
        thudGain.connect(out);
        thud.start(start);
        thud.stop(start + 0.05);
      }
    });
  }

  /** Two warm damped felt/rail knocks 95ms apart for a table Check */
  public playCheckDoubleTap(pan = 0): void {
    this.withAudio((ctx) => {
      const out = this.createPannedOutput(ctx, pan);
      const tapOffsets = [0, 0.095];

      tapOffsets.forEach((offset, idx) => {
        const start = ctx.currentTime + offset;
        const ampScale = idx === 0 ? 1.0 : 0.84;

        // Warm mahogany/padded-rail body knock
        const body = ctx.createOscillator();
        body.type = 'sine';
        body.frequency.setValueAtTime(168 - idx * 8, start);
        body.frequency.exponentialRampToValueAtTime(68, start + 0.062);

        const bodyGain = ctx.createGain();
        bodyGain.gain.setValueAtTime(0.0001, start);
        bodyGain.gain.linearRampToValueAtTime(0.082 * ampScale, start + 0.004);
        bodyGain.gain.exponentialRampToValueAtTime(0.0006, start + 0.068);

        body.connect(bodyGain);
        bodyGain.connect(out);
        body.start(start);
        body.stop(start + 0.075);

        // Soft knuckle-on-felt upper resonance
        const wood = ctx.createOscillator();
        wood.type = 'triangle';
        wood.frequency.setValueAtTime(340 - idx * 18, start);
        wood.frequency.exponentialRampToValueAtTime(145, start + 0.032);

        const woodGain = ctx.createGain();
        woodGain.gain.setValueAtTime(0.0001, start);
        woodGain.gain.linearRampToValueAtTime(0.022 * ampScale, start + 0.003);
        woodGain.gain.exponentialRampToValueAtTime(0.0005, start + 0.036);

        wood.connect(woodGain);
        woodGain.connect(out);
        wood.start(start);
        wood.stop(start + 0.042);

        if (this.noiseBuffer) {
          const src = ctx.createBufferSource();
          src.buffer = this.noiseBuffer;

          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(560, start);

          const nGain = ctx.createGain();
          nGain.gain.setValueAtTime(0.0001, start);
          nGain.gain.linearRampToValueAtTime(0.04 * ampScale, start + 0.004);
          nGain.gain.exponentialRampToValueAtTime(0.0006, start + 0.034);

          src.connect(lp);
          lp.connect(nGain);
          nGain.connect(out);
          src.start(start, this.randomNoiseOffset(0.045), 0.045);
        }
      });
    });
  }

  /** Heavy Paulson clay cascade + subtle warm sub-bass fifth swell for All-In */
  public playAllInSting(pan = 0): void {
    this.playChipClink(7, 0.015, pan);

    this.withAudio((ctx) => {
      const now = ctx.currentTime;
      const out = this.createPannedOutput(ctx, pan * 0.5);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(340, now);
      lp.connect(out);

      const tones = [
        { freq: 82.41, amp: 0.068 }, // E2 root
        { freq: 123.47, amp: 0.044 }, // B2 warm fifth
      ];

      for (const tone of tones) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(tone.freq, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(tone.amp, now + 0.085);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.58);

        osc.connect(gain);
        gain.connect(lp);
        osc.start(now);
        osc.stop(now + 0.62);
      }
    });
  }

  /** Soft warm woodblock/felt chime signaling Hero's turn to act */
  public playHeroTurnPing(): void {
    this.withAudio((ctx) => {
      const now = ctx.currentTime;
      const out = this.createPannedOutput(ctx, 0);

      const fundamental = ctx.createOscillator();
      fundamental.type = 'sine';
      fundamental.frequency.setValueAtTime(660, now);
      fundamental.frequency.exponentialRampToValueAtTime(646, now + 0.11);

      const fGain = ctx.createGain();
      fGain.gain.setValueAtTime(0.0001, now);
      fGain.gain.linearRampToValueAtTime(0.036, now + 0.006);
      fGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.125);

      fundamental.connect(fGain);
      fGain.connect(out);
      fundamental.start(now);
      fundamental.stop(now + 0.14);

      const overtone = ctx.createOscillator();
      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(1320, now);

      const oGain = ctx.createGain();
      oGain.gain.setValueAtTime(0.0001, now);
      oGain.gain.linearRampToValueAtTime(0.012, now + 0.004);
      oGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.055);

      overtone.connect(oGain);
      oGain.connect(out);
      overtone.start(now);
      overtone.stop(now + 0.065);
    });
  }

  /** Understated salon harmonic cue for showdown outcomes */
  public playShowdownCue(outcome: 'win' | 'loss' | 'split', pan = 0): void {
    this.withAudio((ctx) => {
      const now = ctx.currentTime;
      const out = this.createPannedOutput(ctx, pan);

      if (outcome === 'win') {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const start = now + idx * 0.055;
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(0.032, start + 0.018);
          gain.gain.exponentialRampToValueAtTime(0.0005, start + 0.55);

          osc.connect(gain);
          gain.connect(out);
          osc.start(start);
          osc.stop(start + 0.58);
        });
      } else if (outcome === 'split') {
        const notes = [440, 659.25];
        notes.forEach((freq, idx) => {
          const start = now + idx * 0.065;
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(0.028, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0005, start + 0.36);

          osc.connect(gain);
          gain.connect(out);
          osc.start(start);
          osc.stop(start + 0.4);
        });
      } else {
        // Warm low damped descending minor third for loss
        const notes = [329.63, 277.18];
        notes.forEach((freq, idx) => {
          const start = now + idx * 0.08;
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(0.026, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0005, start + 0.32);

          osc.connect(gain);
          gain.connect(out);
          osc.start(start);
          osc.stop(start + 0.36);
        });
      }
    });
  }

  /** Warm, understated salon harmonic chord when a showdown pot is awarded */
  public playWinnerChime(): void {
    this.playShowdownCue('win');
  }

  /** Crisp 12ms clay detent click for UI sizing presets & toggles */
  public playUiTick(): void {
    this.withAudio((ctx) => {
      const now = ctx.currentTime;
      const out = this.createPannedOutput(ctx, 0);

      if (this.noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;

        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(3800, now);

        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.0001, now);
        nGain.gain.linearRampToValueAtTime(0.036, now + 0.0015);
        nGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.012);

        src.connect(hp);
        hp.connect(nGain);
        nGain.connect(out);
        src.start(now, this.randomNoiseOffset(0.018), 0.018);
      }

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2900, now);
      osc.frequency.exponentialRampToValueAtTime(2350, now + 0.012);

      const oGain = ctx.createGain();
      oGain.gain.setValueAtTime(0.0001, now);
      oGain.gain.linearRampToValueAtTime(0.024, now + 0.0015);
      oGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.012);

      osc.connect(oGain);
      oGain.connect(out);
      osc.start(now);
      osc.stop(now + 0.016);
    });
  }

  public dispose(): void {
    this.unbindGestureUnlock();
    this.pendingQueue = [];
    this.resumeInFlight = false;
    this.dryBus = null;
    this.reverbSend = null;
    this.convolver = null;
    this.wetGain = null;
    this.compressor = null;
    this.masterGain = null;
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.noiseBuffer = null;
  }
}

export const sharedCasinoSoundEngine = new CasinoSoundEngine();
