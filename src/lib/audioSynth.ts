/**
 * Web Audio API synthesizer for premium sci-fi card game sound effects.
 * No external file dependencies, completely client-side and CORS-safe.
 */
class AudioSynthService {
  private ctx: AudioContext | null = null;

  private initCtx(): AudioContext {
    if (!this.ctx) {
      // Fallback for WebkitAudioContext in older Safari browsers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Sound played repeatedly while the lootbox is shaking.
   */
  public playShake() {
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;

      // Low frequency rumble oscillator
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

      // Low-pass filter to keep it deep and mechanical
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(120, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (err) {
      console.warn("Failed to play shake sound:", err);
    }
  }

  /**
   * Paper/digital whoosh sound played when a card is flipped.
   */
  public playFlip() {
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (err) {
      console.warn("Failed to play flip sound:", err);
    }
  }

  /**
   * Rarity-based grand reveal chime/effect.
   */
  public playReveal(rarity: "common" | "rare" | "epic" | "legendary" | "holographic") {
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;

      if (rarity === "common") {
        // Double sweet chimes: A5 (880Hz) and C6 (1046Hz)
        this.playChime(ctx, 880, now, 0.25, "sine");
        this.playChime(ctx, 1046, now + 0.08, 0.25, "sine");
      } else if (rarity === "rare") {
        // Cyber ascending sound: E5 -> A5 -> B5 (triangular)
        this.playChime(ctx, 659, now, 0.25, "triangle");
        this.playChime(ctx, 880, now + 0.08, 0.25, "triangle");
        this.playChime(ctx, 987, now + 0.16, 0.3, "triangle");

        // Subtle high whoosh
        const whoosh = ctx.createOscillator();
        const whooshGain = ctx.createGain();
        whoosh.type = "triangle";
        whoosh.frequency.setValueAtTime(300, now);
        whoosh.frequency.exponentialRampToValueAtTime(1100, now + 0.3);
        whooshGain.gain.setValueAtTime(0.06, now);
        whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        whoosh.connect(whooshGain);
        whooshGain.connect(ctx.destination);
        whoosh.start(now);
        whoosh.stop(now + 0.3);
      } else if (rarity === "epic") {
        // Ascending Cyber Chord Arpeggio (Am7): A4, C5, E5, G5, A5
        const notes = [440, 523, 659, 784, 880];
        notes.forEach((freq, idx) => {
          this.playChime(ctx, freq, now + idx * 0.06, 0.35, "triangle");
        });

        // Sci-fi neon sweep filter
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(1500, now + 0.4);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(1800, now + 0.4);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.4);
      } else if (rarity === "legendary") {
        // Grand Legendary Impact (Deep bass boom + golden shimmering bells)

        // 1. Bass Impact
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        const bassFilter = ctx.createBiquadFilter();

        bassOsc.type = "sawtooth";
        bassOsc.frequency.setValueAtTime(100, now);
        bassOsc.frequency.linearRampToValueAtTime(45, now + 0.6);

        bassFilter.type = "lowpass";
        bassFilter.frequency.setValueAtTime(140, now);

        bassGain.gain.setValueAtTime(0.35, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(ctx.destination);

        bassOsc.start(now);
        bassOsc.stop(now + 0.6);

        // 2. Ascending Golden Arpeggio (C Major 9)
        const arpeggio = [261.6, 329.6, 392, 493.9, 587.3, 784];
        arpeggio.forEach((freq, idx) => {
          this.playChime(ctx, freq, now + idx * 0.05, 0.45, "sine");
        });

        // 3. Shimmering bells
        const shimmerFreqs = [1200, 1500, 1800, 2100, 2400];
        shimmerFreqs.forEach((freq, idx) => {
          this.playChime(ctx, freq, now + 0.3 + idx * 0.04, 0.2, "sine");
        });
      } else if (rarity === "holographic") {
        // Celestial Space Warp (Massive deep sub + FM modulated cyber sweep + Lydian chime cluster)

        // 1. Sub Bass Impact
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();

        subOsc.type = "triangle";
        subOsc.frequency.setValueAtTime(70, now);
        subOsc.frequency.linearRampToValueAtTime(28, now + 0.8);

        subGain.gain.setValueAtTime(0.3, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        subOsc.connect(subGain);
        subGain.connect(ctx.destination);

        subOsc.start(now);
        subOsc.stop(now + 0.8);

        // 2. Modulated FM whoosh (LFO vibrato sweep)
        const spaceOsc = ctx.createOscillator();
        const spaceGain = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        spaceOsc.type = "sine";
        spaceOsc.frequency.setValueAtTime(180, now);
        spaceOsc.frequency.exponentialRampToValueAtTime(2400, now + 0.75);

        lfo.frequency.value = 18; // 18Hz speed
        lfoGain.gain.value = 60; // Pitch variation range

        lfo.connect(lfoGain);
        lfoGain.connect(spaceOsc.frequency);

        spaceGain.gain.setValueAtTime(0.08, now);
        spaceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

        spaceOsc.connect(spaceGain);
        spaceGain.connect(ctx.destination);

        lfo.start(now);
        spaceOsc.start(now);

        lfo.stop(now + 0.75);
        spaceOsc.stop(now + 0.75);

        // 3. Shimmering Lydian scale (fits cosmic rainbow theme)
        // C5, E5, G5, B5, F#6, G6, B6
        const holoNotes = [523, 659, 784, 987, 1480, 1568, 1975];
        holoNotes.forEach((freq, idx) => {
          this.playChime(ctx, freq, now + 0.12 + idx * 0.04, 0.6, "sine");
        });
      }
    } catch (err) {
      console.warn("Failed to play reveal sound:", err);
    }
  }

  private playChime(ctx: AudioContext, frequency: number, startTime: number, duration: number, type: OscillatorType) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.98, startTime + duration);

    gain.gain.setValueAtTime(0.0, startTime);
    gain.gain.linearRampToValueAtTime(0.18, startTime + 0.01); // Instant attack
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration); // Long tail decay

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}

export const audioSynth = new AudioSynthService();
