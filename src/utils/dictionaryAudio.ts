export type KeyboardInstrumentId =
  | "grand_piano"
  | "korg_bright"
  | "roland_stage"
  | "rhodes"
  | "electric_piano";

export interface KeyboardInstrumentOption {
  id: KeyboardInstrumentId;
  labelEs: string;
  labelEn: string;
  badge: string;
}

/**
 * Nombres 100% libres de marcas registradas (Trademark-Safe)
 * Estándar profesional de la industria de audio y DAWs
 */
export const KEYBOARD_INSTRUMENTS: KeyboardInstrumentOption[] = [
  {
    id: "grand_piano",
    labelEs: "Grand Piano HD",
    labelEn: "Grand Piano HD",
    badge: "Acoustic Concert",
  },
  {
    id: "korg_bright",
    labelEs: "Bright Studio Piano",
    labelEn: "Bright Studio Piano",
    badge: "Bright Attack",
  },
  {
    id: "roland_stage",
    labelEs: "Stage Layer (Piano + EP)",
    labelEn: "Stage Layer (Piano + EP)",
    badge: "Grand + FM Layer",
  },
  {
    id: "rhodes",
    labelEs: "Vintage Tine EP",
    labelEn: "Vintage Tine EP",
    badge: "Warm Mark I",
  },
  {
    id: "electric_piano",
    labelEs: "FM Crystal EP",
    labelEn: "FM Crystal EP",
    badge: "80s Digital EP",
  },
];

const SALAMANDER_FULL_MAP: Record<number, string> = {
  36: "https://tonejs.github.io/audio/salamander/C2.mp3",
  39: "https://tonejs.github.io/audio/salamander/Ds2.mp3",
  42: "https://tonejs.github.io/audio/salamander/Fs2.mp3",
  45: "https://tonejs.github.io/audio/salamander/A2.mp3",
  48: "https://tonejs.github.io/audio/salamander/C3.mp3",
  51: "https://tonejs.github.io/audio/salamander/Ds3.mp3",
  54: "https://tonejs.github.io/audio/salamander/Fs3.mp3",
  57: "https://tonejs.github.io/audio/salamander/A3.mp3",
  60: "https://tonejs.github.io/audio/salamander/C4.mp3",
  63: "https://tonejs.github.io/audio/salamander/Ds4.mp3",
  66: "https://tonejs.github.io/audio/salamander/Fs4.mp3",
  69: "https://tonejs.github.io/audio/salamander/A4.mp3",
  72: "https://tonejs.github.io/audio/salamander/C5.mp3",
  75: "https://tonejs.github.io/audio/salamander/Ds5.mp3",
  78: "https://tonejs.github.io/audio/salamander/Fs5.mp3",
  81: "https://tonejs.github.io/audio/salamander/A5.mp3",
  84: "https://tonejs.github.io/audio/salamander/C6.mp3",
};

const MUSYNG_CDN = "https://gleitz.github.io/midi-js-soundfonts/MusyngKite";

type SampleBankKey = "grand_piano" | "bright_piano" | "rhodes" | "electric_piano";

const EXTERNAL_SAMPLE_BANKS: Record<
  Exclude<SampleBankKey, "grand_piano">,
  Record<number, string>
> = {
  bright_piano: {
    48: `${MUSYNG_CDN}/bright_acoustic_piano-mp3/C3.mp3`,
    51: `${MUSYNG_CDN}/bright_acoustic_piano-mp3/Eb3.mp3`,
    54: `${MUSYNG_CDN}/bright_acoustic_piano-mp3/Gb3.mp3`,
    57: `${MUSYNG_CDN}/bright_acoustic_piano-mp3/A3.mp3`,
    60: `${MUSYNG_CDN}/bright_acoustic_piano-mp3/C4.mp3`,
    63: `${MUSYNG_CDN}/bright_acoustic_piano-mp3/Eb4.mp3`,
    66: `${MUSYNG_CDN}/bright_acoustic_piano-mp3/Gb4.mp3`,
    69: `${MUSYNG_CDN}/bright_acoustic_piano-mp3/A4.mp3`,
    72: `${MUSYNG_CDN}/bright_acoustic_piano-mp3/C5.mp3`,
    75: `${MUSYNG_CDN}/bright_acoustic_piano-mp3/Eb5.mp3`,
    78: `${MUSYNG_CDN}/bright_acoustic_piano-mp3/Gb5.mp3`,
    81: `${MUSYNG_CDN}/bright_acoustic_piano-mp3/A5.mp3`,
  },
  rhodes: {
    48: `${MUSYNG_CDN}/electric_piano_1-mp3/C3.mp3`,
    51: `${MUSYNG_CDN}/electric_piano_1-mp3/Eb3.mp3`,
    54: `${MUSYNG_CDN}/electric_piano_1-mp3/Gb3.mp3`,
    57: `${MUSYNG_CDN}/electric_piano_1-mp3/A3.mp3`,
    60: `${MUSYNG_CDN}/electric_piano_1-mp3/C4.mp3`,
    63: `${MUSYNG_CDN}/electric_piano_1-mp3/Eb4.mp3`,
    66: `${MUSYNG_CDN}/electric_piano_1-mp3/Gb4.mp3`,
    69: `${MUSYNG_CDN}/electric_piano_1-mp3/A4.mp3`,
    72: `${MUSYNG_CDN}/electric_piano_1-mp3/C5.mp3`,
    75: `${MUSYNG_CDN}/electric_piano_1-mp3/Eb5.mp3`,
    78: `${MUSYNG_CDN}/electric_piano_1-mp3/Gb5.mp3`,
    81: `${MUSYNG_CDN}/electric_piano_1-mp3/A5.mp3`,
  },
  electric_piano: {
    48: `${MUSYNG_CDN}/electric_piano_2-mp3/C3.mp3`,
    51: `${MUSYNG_CDN}/electric_piano_2-mp3/Eb3.mp3`,
    54: `${MUSYNG_CDN}/electric_piano_2-mp3/Gb3.mp3`,
    57: `${MUSYNG_CDN}/electric_piano_2-mp3/A3.mp3`,
    60: `${MUSYNG_CDN}/electric_piano_2-mp3/C4.mp3`,
    63: `${MUSYNG_CDN}/electric_piano_2-mp3/Eb4.mp3`,
    66: `${MUSYNG_CDN}/electric_piano_2-mp3/Gb4.mp3`,
    69: `${MUSYNG_CDN}/electric_piano_2-mp3/A4.mp3`,
    72: `${MUSYNG_CDN}/electric_piano_2-mp3/C5.mp3`,
    75: `${MUSYNG_CDN}/electric_piano_2-mp3/Eb5.mp3`,
    78: `${MUSYNG_CDN}/electric_piano_2-mp3/Gb5.mp3`,
    81: `${MUSYNG_CDN}/electric_piano_2-mp3/A5.mp3`,
  },
};

class DictionaryAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private dryBus: GainNode | null = null;
  private reverbConvolver: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;

  private sampleBanks: Record<SampleBankKey, Map<number, AudioBuffer>> = {
    grand_piano: new Map(),
    bright_piano: new Map(),
    rhodes: new Map(),
    electric_piano: new Map(),
  };

  private loadingPromises: Partial<Record<SampleBankKey, Promise<void>>> = {};

  public getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: "interactive" });
      this.setupStudioMasterBus();
      this.preloadPianoSamples();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private setupStudioMasterBus(): void {
    if (!this.ctx) return;

    this.dryBus = this.ctx.createGain();
    this.dryBus.gain.setValueAtTime(1.0, this.ctx.currentTime);

    this.reverbConvolver = this.createStereoHallImpulse(1.9, 3.2);
    this.reverbWetGain = this.ctx.createGain();
    this.reverbWetGain.gain.setValueAtTime(0.17, this.ctx.currentTime);

    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-6, this.ctx.currentTime);
    this.limiter.knee.setValueAtTime(6, this.ctx.currentTime);
    this.limiter.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.limiter.attack.setValueAtTime(0.002, this.ctx.currentTime);
    this.limiter.release.setValueAtTime(0.15, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.92, this.ctx.currentTime);

    this.dryBus.connect(this.limiter);
    this.dryBus.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.limiter);

    this.limiter.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
  }

  private createStereoHallImpulse(
    durationSec: number,
    decay: number
  ): ConvolverNode {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const impulse = ctx.createBuffer(2, length, rate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / rate;
        if (t < 0.016) {
          data[i] = 0;
        } else {
          const env = Math.pow(1 - i / length, decay);
          data[i] = (Math.random() * 2 - 1) * env * 0.28;
        }
      }
    }

    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  /**
   * Normalización Psicoacústica por Energía RMS + Protección de Transitorios (Headroom):
   * - Para Grand Piano se usa un targetRms más conservador (0.15) y techo de pico estricto (0.72)
   *   para que al sumar 4 o 5 notas jamás sature y suene exactamente al mismo volumen que los otros 4 timbres.
   */
  private normalizeBufferByLoudness(
    buffer: AudioBuffer,
    targetRms: number = 0.22,
    maxAllowedPeak: number = 0.88
  ): AudioBuffer {
    const rate = buffer.sampleRate;
    const ch0 = buffer.getChannelData(0);

    let startIdx = 0;
    for (let i = 0; i < ch0.length; i++) {
      if (Math.abs(ch0[i]) > 0.008) {
        startIdx = i;
        break;
      }
    }

    const windowLength = Math.min(
      ch0.length - startIdx,
      Math.floor(rate * 0.65)
    );

    if (windowLength <= 100) return buffer;

    let sumSquares = 0;
    let totalSamples = 0;
    let currentPeak = 0;

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > currentPeak) currentPeak = abs;
        if (i >= startIdx && i < startIdx + windowLength) {
          sumSquares += data[i] * data[i];
          totalSamples++;
        }
      }
    }

    const rms = Math.sqrt(sumSquares / Math.max(1, totalSamples));
    if (rms < 0.0005 || currentPeak < 0.0005) return buffer;

    let gainFactor = Math.min(6.0, Math.max(0.25, targetRms / rms));

    // Evitar que el pico del martillo supere maxAllowedPeak para que nunca distorsione en acordes
    if (currentPeak * gainFactor > maxAllowedPeak) {
      gainFactor = maxAllowedPeak / currentPeak;
    }

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        data[i] = data[i] * gainFactor;
      }
    }

    return buffer;
  }

  public async preloadPianoSamples(): Promise<void> {
    await this.loadSampleBank("grand_piano");
    this.loadSampleBank("bright_piano");
    this.loadSampleBank("electric_piano");
    this.loadSampleBank("rhodes");
  }

  private async loadSampleBank(bankKey: SampleBankKey): Promise<void> {
    if (this.sampleBanks[bankKey].size > 0) return;
    if (this.loadingPromises[bankKey]) {
      return this.loadingPromises[bankKey];
    }

    const urlMap =
      bankKey === "grand_piano"
        ? SALAMANDER_FULL_MAP
        : EXTERNAL_SAMPLE_BANKS[bankKey];

    // El Salamander se normaliza con más headroom (RMS 0.15 y pico máx 0.72) para igualar a los otros 4 sin saturar
    const targetRms = bankKey === "grand_piano" ? 0.15 : 0.22;
    const maxPeak = bankKey === "grand_piano" ? 0.72 : 0.88;

    const promise = (async () => {
      const ctx = this.getContext();
      const entries = Object.entries(urlMap);

      await Promise.all(
        entries.map(async ([midiStr, url]) => {
          try {
            const resp = await fetch(url);
            if (!resp.ok) return;
            const arrayBuf = await resp.arrayBuffer();
            const decoded = await ctx.decodeAudioData(arrayBuf);
            const normalized = this.normalizeBufferByLoudness(
              decoded,
              targetRms,
              maxPeak
            );
            this.sampleBanks[bankKey].set(Number(midiStr), normalized);
          } catch {
            // Continúa si un archivo puntual tarda
          }
        })
      );
    })();

    this.loadingPromises[bankKey] = promise;
    return promise;
  }

  public getInputNode(_channel: string = "piano"): AudioNode {
    const ctx = this.getContext();
    return this.dryBus || ctx.destination;
  }

  private findClosestBuffer(
    bank: Map<number, AudioBuffer>,
    targetMidi: number
  ): { buffer: AudioBuffer; playbackRate: number } | null {
    if (bank.size === 0) return null;

    let closestMidi = 60;
    let minDiff = Infinity;

    bank.forEach((_, sampleMidi) => {
      const diff = Math.abs(targetMidi - sampleMidi);
      if (diff < minDiff) {
        minDiff = diff;
        closestMidi = sampleMidi;
      }
    });

    const buffer = bank.get(closestMidi);
    if (!buffer) return null;

    const playbackRate = Math.pow(2, (targetMidi - closestMidi) / 12);
    return { buffer, playbackRate };
  }

  private triggerSampleBuffer(
    buffer: AudioBuffer,
    playbackRate: number,
    start: number,
    holdSec: number,
    releaseSec: number,
    gainLevel: number,
    pan: number = 0,
    warmthDb: number = 0,
    brillianceDb: number = 0,
    detuneCents: number = 0
  ): void {
    const ctx = this.getContext();
    const dest = this.getInputNode("piano");

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.setValueAtTime(playbackRate, start);
    if (detuneCents !== 0 && src.detune) {
      src.detune.setValueAtTime(detuneCents, start);
    }

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(gainLevel, start + 0.003);
    env.gain.setValueAtTime(gainLevel, start + holdSec);
    env.gain.exponentialRampToValueAtTime(
      0.0001,
      start + holdSec + releaseSec
    );

    let lastNode: AudioNode = src;

    if (warmthDb !== 0) {
      const lowShelf = ctx.createBiquadFilter();
      lowShelf.type = "lowshelf";
      lowShelf.frequency.setValueAtTime(360, start);
      lowShelf.gain.setValueAtTime(warmthDb, start);
      lastNode.connect(lowShelf);
      lastNode = lowShelf;
    }

    if (brillianceDb !== 0) {
      const highShelf = ctx.createBiquadFilter();
      highShelf.type = "highshelf";
      highShelf.frequency.setValueAtTime(3200, start);
      highShelf.gain.setValueAtTime(brillianceDb, start);
      lastNode.connect(highShelf);
      lastNode = highShelf;
    }

    lastNode.connect(env);

    if (ctx.createStereoPanner && pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-0.7, Math.min(0.7, pan)), start);
      env.connect(panner);
      panner.connect(dest);
    } else {
      env.connect(dest);
    }

    src.start(start);
    src.stop(start + holdSec + releaseSec + 0.05);
  }

  public playKeyboardNote(
    midi: number,
    instrument: KeyboardInstrumentId = "grand_piano",
    durationSec: number = 2.4,
    delaySec: number = 0,
    velocity: number = 0.55
  ): void {
    const ctx = this.getContext();
    const start = ctx.currentTime + delaySec;
    const stereoPan = ((midi - 64) / 36) * 0.42;

    // 1. GRAND PIANO HD (Atenuado a 0.68x sin boost de agudos para igualar volumen con los otros 4 y evitar toda saturación)
    if (instrument === "grand_piano") {
      const match = this.findClosestBuffer(this.sampleBanks.grand_piano, midi);
      if (match) {
        this.triggerSampleBuffer(
          match.buffer,
          match.playbackRate,
          start,
          durationSec,
          0.9,
          velocity * 0.68,
          stereoPan,
          0,
          0,
          0
        );
      }
      return;
    }

    // 2. BRIGHT STUDIO PIANO (Intacto)
    if (instrument === "korg_bright") {
      this.loadSampleBank("bright_piano");
      const brightMatch = this.findClosestBuffer(
        this.sampleBanks.bright_piano,
        midi
      );
      const grandMatch = this.findClosestBuffer(
        this.sampleBanks.grand_piano,
        midi
      );

      if (brightMatch && grandMatch) {
        this.triggerSampleBuffer(
          brightMatch.buffer,
          brightMatch.playbackRate,
          start,
          durationSec,
          0.8,
          velocity * 0.58,
          stereoPan * 0.8,
          -1.5,
          4.0,
          3
        );
        this.triggerSampleBuffer(
          grandMatch.buffer,
          grandMatch.playbackRate,
          start,
          durationSec * 0.9,
          0.75,
          velocity * 0.25,
          -stereoPan * 0.5,
          0,
          2.5,
          -3
        );
      } else if (grandMatch) {
        this.triggerSampleBuffer(
          grandMatch.buffer,
          grandMatch.playbackRate,
          start,
          durationSec,
          0.85,
          velocity * 0.68,
          stereoPan,
          -1.0,
          3.5,
          0
        );
      }
      return;
    }

    // 3. STAGE LAYER (PIANO + EP) (Intacto)
    if (instrument === "roland_stage") {
      this.loadSampleBank("electric_piano");
      const grandMatch = this.findClosestBuffer(
        this.sampleBanks.grand_piano,
        midi
      );
      const epMatch = this.findClosestBuffer(
        this.sampleBanks.electric_piano,
        midi
      );

      if (grandMatch && epMatch) {
        this.triggerSampleBuffer(
          grandMatch.buffer,
          grandMatch.playbackRate,
          start,
          durationSec,
          0.95,
          velocity * 0.42,
          stereoPan * 0.7,
          0,
          1.0,
          0
        );
        this.triggerSampleBuffer(
          epMatch.buffer,
          epMatch.playbackRate,
          start,
          durationSec * 1.1,
          1.05,
          velocity * 0.25,
          -0.45,
          0,
          2.0,
          6
        );
        this.triggerSampleBuffer(
          epMatch.buffer,
          epMatch.playbackRate,
          start,
          durationSec * 1.1,
          1.05,
          velocity * 0.25,
          0.45,
          0,
          2.0,
          -6
        );
      } else if (grandMatch) {
        this.triggerSampleBuffer(
          grandMatch.buffer,
          grandMatch.playbackRate,
          start,
          durationSec,
          0.95,
          velocity * 0.68,
          stereoPan,
          0,
          1.5,
          0
        );
      }
      return;
    }

    // 4. VINTAGE TINE EP (Intacto)
    if (instrument === "rhodes") {
      this.loadSampleBank("rhodes");
      const match =
        this.findClosestBuffer(this.sampleBanks.rhodes, midi) ||
        this.findClosestBuffer(this.sampleBanks.grand_piano, midi);

      if (match) {
        this.triggerSampleBuffer(
          match.buffer,
          match.playbackRate,
          start,
          durationSec,
          0.9,
          velocity * 1.0,
          stereoPan,
          1.5,
          1.5,
          0
        );
      }
      return;
    }

    // 5. FM CRYSTAL EP (Intacto)
    this.loadSampleBank("electric_piano");
    const epMatch =
      this.findClosestBuffer(this.sampleBanks.electric_piano, midi) ||
      this.findClosestBuffer(this.sampleBanks.grand_piano, midi);

    if (epMatch) {
      this.triggerSampleBuffer(
        epMatch.buffer,
        epMatch.playbackRate,
        start,
        durationSec,
        0.95,
        velocity * 1.0,
        stereoPan,
        1.0,
        2.0,
        0
      );
    }
  }
}

export const dictionaryAudio = new DictionaryAudioEngine();