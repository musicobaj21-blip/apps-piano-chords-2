import { useState, useMemo, useRef, useEffect } from "react";
import { RootNote } from "../types";
import {
  dictionaryAudio,
  KEYBOARD_INSTRUMENTS,
  KeyboardInstrumentId,
} from "../utils/dictionaryAudio";
import { useLanguage } from "../contexts/LanguageContext";
import {
  Search,
  Music,
  BookOpen,
  Play,
  Square,
  Volume2,
  GitCommit,
  Layers,
  Hand,
  Sparkles,
  Award,
  Radio,
  ChevronDown,
} from "lucide-react";

type KeyLabelMode = "note" | "interval" | "finger";

const ROOT_SEMITONES: Record<RootNote, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

const ROOT_SOLFEGE_ES: Record<RootNote, string> = {
  C: "Do",
  "C#": "Do#",
  Db: "Reb",
  D: "Re",
  "D#": "Re#",
  Eb: "Mib",
  E: "Mi",
  F: "Fa",
  "F#": "Fa#",
  Gb: "Solb",
  G: "Sol",
  "G#": "Sol#",
  Ab: "Lab",
  A: "La",
  "A#": "La#",
  Bb: "Sib",
  B: "Si",
};

const NOTE_NAMES_SHARP_ES = [
  "Do",
  "Do#",
  "Re",
  "Re#",
  "Mi",
  "Fa",
  "Fa#",
  "Sol",
  "Sol#",
  "La",
  "La#",
  "Si",
];

const NOTE_NAMES_FLAT_ES = [
  "Do",
  "Reb",
  "Re",
  "Mib",
  "Mi",
  "Fa",
  "Solb",
  "Sol",
  "Lab",
  "La",
  "Sib",
  "Si",
];

const NOTE_NAMES_SHARP_EN = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const NOTE_NAMES_FLAT_EN = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

interface ChordVoiceSpec {
  semitones: number;
  intervalLabel: string;
  hand?: "LH" | "RH";
  customFinger?: string;
}

interface CustomJazzVariation {
  titleEs: string;
  titleEn: string;
  shortBadge: string;
  subtitleEs: string;
  subtitleEn: string;
  voices: ChordVoiceSpec[];
}

interface KeyboardChordDefinition {
  id: string;
  nameEs: string;
  nameEn: string;
  symbol: string;
  category: string;
  artistTag?: string;
  voices: ChordVoiceSpec[];
  jazzVariations?: CustomJazzVariation[];
  recommendedScalesEs: string[];
  recommendedScalesEn: string[];
  functionEs: string;
  functionEn: string;
}

const KEYBOARD_CHORD_CATEGORIES: {
  id: string;
  shortEs: string;
  shortEn: string;
  titleEs: string;
  titleEn: string;
  isPro?: boolean;
}[] = [
  {
    id: "triads",
    shortEs: "TRÍADAS",
    shortEn: "TRIADS",
    titleEs: "Tríadas y Acordes Suspendidos",
    titleEn: "Triads & Suspended Chords",
  },
  {
    id: "sevenths",
    shortEs: "SÉPTIMAS / 6ª",
    shortEn: "SEVENTHS / 6TH",
    titleEs: "Cuatríadas (Séptimas y Sextas)",
    titleEn: "Four-Note Chords (Sevenths & Sixths)",
  },
  {
    id: "tensions",
    shortEs: "TENSIONES",
    shortEn: "TENSIONS",
    titleEs: "Acordes Extendidos (9, 11, 13)",
    titleEn: "Extended Chords (9, 11, 13)",
  },
  {
    id: "altered",
    shortEs: "ALTERADOS",
    shortEn: "ALTERED",
    titleEs: "Dominantes y Mayores Alterados",
    titleEn: "Altered Dominant & Major Chords",
  },
  {
    id: "jazz_voicings",
    shortEs: "★ JAZZ VOICINGS",
    shortEn: "★ JAZZ VOICINGS",
    titleEs: "Jazz Voicings de Concierto (Bill Evans, McCoy Tyner, Herbie)",
    titleEn: "Concert Jazz Voicings (Bill Evans, McCoy Tyner, Herbie)",
    isPro: true,
  },
];

const KEYBOARD_CHORD_CATALOG: KeyboardChordDefinition[] = [
  // 1. TRÍADAS Y SUSPENDIDOS
  {
    id: "Mayor",
    nameEs: "Tríada Mayor",
    nameEn: "Major Triad",
    symbol: "",
    category: "triads",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 7, intervalLabel: "5J" },
    ],
    recommendedScalesEs: ["Jónica (Mayor)", "Lidia", "Pentatónica Mayor"],
    recommendedScalesEn: ["Ionian (Major)", "Lydian", "Major Pentatonic"],
    functionEs: "Tónica (I) o Subdominante (IV) / Dominante (V)",
    functionEn: "Tonic (I) or Subdominant (IV) / Dominant (V)",
  },
  {
    id: "Menor",
    nameEs: "Tríada Menor",
    nameEn: "Minor Triad",
    symbol: "m",
    category: "triads",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 3, intervalLabel: "3m" },
      { semitones: 7, intervalLabel: "5J" },
    ],
    recommendedScalesEs: ["Dórica", "Eólica (Menor)", "Pentatónica Menor"],
    recommendedScalesEn: ["Dorian", "Aeolian (Minor)", "Minor Pentatonic"],
    functionEs: "Tónica menor (Im), Subdominante (IIm) o Relativo (VIm)",
    functionEn: "Minor Tonic (Im), Subdominant (IIm) or Relative (VIm)",
  },
  {
    id: "dim",
    nameEs: "Tríada Disminuida",
    nameEn: "Diminished Triad",
    symbol: "°",
    category: "triads",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 3, intervalLabel: "3m" },
      { semitones: 6, intervalLabel: "5d" },
    ],
    recommendedScalesEs: ["Locria", "Disminuida (Tono - Semitono)"],
    recommendedScalesEn: ["Locrian", "Diminished (Whole - Half)"],
    functionEs: "Sensible / VII° grado o II° en tonalidad menor",
    functionEn: "Leading-tone VII° or II° in minor key",
  },
  {
    id: "aug",
    nameEs: "Tríada Aumentada",
    nameEn: "Augmented Triad",
    symbol: "+",
    category: "triads",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 8, intervalLabel: "5a" },
    ],
    recommendedScalesEs: ["Tonal (Tono - Tono)", "Tonal Aumentada", "Lidia Aumentada"],
    recommendedScalesEn: ["Whole Tone", "Augmented Scale", "Lydian Augmented"],
    functionEs: "Acorde simétrico de tensión / Dominante alterado",
    functionEn: "Symmetric tension chord / Altered dominant",
  },
  {
    id: "sus4",
    nameEs: "Suspendido 4ª",
    nameEn: "Suspended 4th",
    symbol: "sus4",
    category: "triads",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 5, intervalLabel: "4J" },
      { semitones: 7, intervalLabel: "5J" },
    ],
    recommendedScalesEs: ["Mixolidia", "Jónica (Mayor)", "Pentatónica Mayor"],
    recommendedScalesEn: ["Mixolydian", "Ionian (Major)", "Major Pentatonic"],
    functionEs: "Suspensión armónica que reemplaza la 3ª por la 4J",
    functionEn: "Harmonic suspension replacing the 3rd with P4",
  },
  {
    id: "sus2",
    nameEs: "Suspendido 2ª",
    nameEn: "Suspended 2nd",
    symbol: "sus2",
    category: "triads",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 2, intervalLabel: "2M" },
      { semitones: 7, intervalLabel: "5J" },
    ],
    recommendedScalesEs: ["Jónica (Mayor)", "Lidia", "Dórica"],
    recommendedScalesEn: ["Ionian (Major)", "Lydian", "Dorian"],
    functionEs: "Sonoridad abierta moderna (reemplaza la 3ª por la 2M)",
    functionEn: "Modern open voicing (replaces 3rd with M2)",
  },

  // 2. SÉPTIMAS Y SEXTAS
  {
    id: "maj7",
    nameEs: "Mayor Séptima",
    nameEn: "Major 7th",
    symbol: "Maj7",
    category: "sevenths",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 11, intervalLabel: "7M" },
    ],
    recommendedScalesEs: ["Jónica (Mayor Diatónica)", "Lidia", "Bebop Mayor"],
    recommendedScalesEn: ["Ionian (Major)", "Lydian", "Major Bebop"],
    functionEs: "I Maj7 (Tónica Mayor) o IV Maj7 (Subdominante Mayor)",
    functionEn: "I Maj7 (Major Tonic) or IV Maj7 (Major Subdominant)",
  },
  {
    id: "7",
    nameEs: "Dominante Séptima",
    nameEn: "Dominant 7th",
    symbol: "7",
    category: "sevenths",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 10, intervalLabel: "7m" },
    ],
    recommendedScalesEs: ["Mixolidia", "Escala de Blues", "Bebop Dominante"],
    recommendedScalesEn: ["Mixolydian", "Blues Scale", "Dominant Bebop"],
    functionEs: "V7 (Dominante principal con tritono entre 3M y 7m)",
    functionEn: "V7 (Primary Dominant with tritone between 3M and 7m)",
  },
  {
    id: "m7",
    nameEs: "Menor Séptima",
    nameEn: "Minor 7th",
    symbol: "m7",
    category: "sevenths",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 3, intervalLabel: "3m" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 10, intervalLabel: "7m" },
    ],
    recommendedScalesEs: ["Dórica", "Eólica (Menor)", "Pentatónica Menor"],
    recommendedScalesEn: ["Dorian", "Aeolian (Minor)", "Minor Pentatonic"],
    functionEs: "IIm7 (Subdominante en II-V-I), VIm7 o Im7",
    functionEn: "IIm7 (Subdominant in II-V-I), VIm7 or Im7",
  },
  {
    id: "m7b5",
    nameEs: "Semidisminuido (Ø)",
    nameEn: "Half-Diminished (Ø)",
    symbol: "m7(b5)",
    category: "sevenths",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 3, intervalLabel: "3m" },
      { semitones: 6, intervalLabel: "5d" },
      { semitones: 10, intervalLabel: "7m" },
    ],
    recommendedScalesEs: ["Locria", "Locria #2 (Locria ♮9)"],
    recommendedScalesEn: ["Locrian", "Locrian #2 (♮9)"],
    functionEs: "IIm7(b5) en tonalidad menor o VIIm7(b5) en tonalidad mayor",
    functionEn: "IIm7(b5) in minor key or VIIm7(b5) in major key",
  },
  {
    id: "dim7",
    nameEs: "Disminuido Séptima",
    nameEn: "Diminished 7th",
    symbol: "°7",
    category: "sevenths",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 3, intervalLabel: "3m" },
      { semitones: 6, intervalLabel: "5d" },
      { semitones: 9, intervalLabel: "7d" },
    ],
    recommendedScalesEs: ["Disminuida (Tono - Semitono)", "Menor Armónica"],
    recommendedScalesEn: ["Diminished (Whole - Half)", "Harmonic Minor"],
    functionEs: "VII°7 (Dominante por terceras menores simétricas)",
    functionEn: "VII°7 (Symmetric minor-third dominant)",
  },
  {
    id: "m(maj7)",
    nameEs: "Menor Mayor 7ª",
    nameEn: "Minor Major 7th",
    symbol: "m(Maj7)",
    category: "sevenths",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 3, intervalLabel: "3m" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 11, intervalLabel: "7M" },
    ],
    recommendedScalesEs: ["Menor Melódica", "Menor Armónica"],
    recommendedScalesEn: ["Melodic Minor", "Harmonic Minor"],
    functionEs: "Im(Maj7) (Tónica menor de jazz / cine)",
    functionEn: "Im(Maj7) (Jazz / cinematic minor tonic)",
  },
  {
    id: "maj7#5",
    nameEs: "Mayor 7ª Aumentado",
    nameEn: "Augmented Major 7th",
    symbol: "Maj7(#5)",
    category: "sevenths",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 8, intervalLabel: "5a" },
      { semitones: 11, intervalLabel: "7M" },
    ],
    recommendedScalesEs: ["Lidia Aumentada", "Jónica Aumentada", "Tonal Aumentada"],
    recommendedScalesEn: ["Lydian Augmented", "Ionian Augmented", "Augmented Scale"],
    functionEs: "III Maj7(#5) de Menor Melódica/Armónica o I Maj7 alterado",
    functionEn: "III Maj7(#5) of Melodic/Harmonic Minor or altered I Maj7",
  },
  {
    id: "6",
    nameEs: "Mayor Sexta",
    nameEn: "Major 6th",
    symbol: "6",
    category: "sevenths",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 9, intervalLabel: "6M" },
    ],
    recommendedScalesEs: ["Jónica (Mayor)", "Pentatónica Mayor", "Lidia"],
    recommendedScalesEn: ["Ionian (Major)", "Major Pentatonic", "Lydian"],
    functionEs: "Tónica Mayor estable (reemplaza 7M por 6M)",
    functionEn: "Stable Major Tonic (replaces 7M with 6M)",
  },
  {
    id: "m6",
    nameEs: "Menor Sexta",
    nameEn: "Minor 6th",
    symbol: "m6",
    category: "sevenths",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 3, intervalLabel: "3m" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 9, intervalLabel: "6M" },
    ],
    recommendedScalesEs: ["Menor Melódica", "Dórica"],
    recommendedScalesEn: ["Melodic Minor", "Dorian"],
    functionEs: "Tónica menor (Im6) o Subdominante menor (IVm6)",
    functionEn: "Minor Tonic (Im6) or Minor Subdominant (IVm6)",
  },

  // 3. TENSIONES (9, 11, 13)
  {
    id: "maj9",
    nameEs: "Mayor Novena",
    nameEn: "Major 9th",
    symbol: "Maj9",
    category: "tensions",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 11, intervalLabel: "7M" },
      { semitones: 14, intervalLabel: "9M" },
    ],
    recommendedScalesEs: ["Jónica (Mayor)", "Lidia"],
    recommendedScalesEn: ["Ionian (Major)", "Lydian"],
    functionEs: "Tónica Mayor o Subdominante con 9ª Mayor (2M)",
    functionEn: "Major Tonic or Subdominant with Major 9th (2M)",
  },
  {
    id: "maj13",
    nameEs: "Mayor Treceava",
    nameEn: "Major 13th",
    symbol: "Maj13",
    category: "tensions",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 11, intervalLabel: "7M" },
      { semitones: 14, intervalLabel: "9M" },
      { semitones: 21, intervalLabel: "13M" },
    ],
    recommendedScalesEs: ["Jónica (Mayor)", "Lidia"],
    recommendedScalesEn: ["Ionian (Major)", "Lydian"],
    functionEs: "Acorde Mayor extendido con 7M, 9M y 13M (6M)",
    functionEn: "Extended Major chord with 7M, 9M and 13M (6M)",
  },
  {
    id: "6(9)",
    nameEs: "Mayor Seis Nueve",
    nameEn: "Major Six Nine",
    symbol: "6(9)",
    category: "tensions",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 9, intervalLabel: "6M" },
      { semitones: 14, intervalLabel: "9M" },
    ],
    recommendedScalesEs: ["Pentatónica Mayor", "Jónica (Mayor)", "Lidia"],
    recommendedScalesEn: ["Major Pentatonic", "Ionian (Major)", "Lydian"],
    functionEs: "Acorde de resolución final en Jazz y Bossa Nova",
    functionEn: "Final resolution tonic chord in Jazz & Bossa Nova",
  },
  {
    id: "9",
    nameEs: "Dominante Novena",
    nameEn: "Dominant 9th",
    symbol: "9",
    category: "tensions",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 10, intervalLabel: "7m" },
      { semitones: 14, intervalLabel: "9M" },
    ],
    recommendedScalesEs: ["Mixolidia", "Bebop Dominante", "Escala de Blues"],
    recommendedScalesEn: ["Mixolydian", "Dominant Bebop", "Blues Scale"],
    functionEs: "V9 (Dominante con color de 9ª Mayor)",
    functionEn: "V9 (Dominant with Major 9th color)",
  },
  {
    id: "13",
    nameEs: "Dominante Treceava",
    nameEn: "Dominant 13th",
    symbol: "13",
    category: "tensions",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 10, intervalLabel: "7m" },
      { semitones: 14, intervalLabel: "9M" },
      { semitones: 21, intervalLabel: "13M" },
    ],
    recommendedScalesEs: ["Mixolidia", "Lidia b7 (Lidia Dominante)"],
    recommendedScalesEn: ["Mixolydian", "Lydian Dominant (Lydian b7)"],
    functionEs: "V13 (Dominante rico de Jazz, Funk y Soul)",
    functionEn: "V13 (Rich Jazz, Funk & Soul Dominant)",
  },
  {
    id: "m9",
    nameEs: "Menor Novena",
    nameEn: "Minor 9th",
    symbol: "m9",
    category: "tensions",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 3, intervalLabel: "3m" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 10, intervalLabel: "7m" },
      { semitones: 14, intervalLabel: "9M" },
    ],
    recommendedScalesEs: ["Dórica", "Eólica (Menor)"],
    recommendedScalesEn: ["Dorian", "Aeolian (Minor)"],
    functionEs: "IIm9 o Im9 (Voicing clásico de Neo-Soul y Jazz)",
    functionEn: "IIm9 or Im9 (Classic Neo-Soul & Jazz voicing)",
  },
  {
    id: "m11",
    nameEs: "Menor Onceava",
    nameEn: "Minor 11th",
    symbol: "m11",
    category: "tensions",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 3, intervalLabel: "3m" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 10, intervalLabel: "7m" },
      { semitones: 14, intervalLabel: "9M" },
      { semitones: 17, intervalLabel: "11J" },
    ],
    recommendedScalesEs: ["Dórica", "Eólica (Menor)", "Pentatónica Menor"],
    recommendedScalesEn: ["Dorian", "Aeolian (Minor)", "Minor Pentatonic"],
    functionEs: "Acorde menor modal cuartal (estilo McCoy Tyner / Bill Evans)",
    functionEn: "Modal quartal minor chord (McCoy Tyner / Bill Evans style)",
  },
  {
    id: "m13",
    nameEs: "Menor Treceava",
    nameEn: "Minor 13th",
    symbol: "m13",
    category: "tensions",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 3, intervalLabel: "3m" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 10, intervalLabel: "7m" },
      { semitones: 14, intervalLabel: "9M" },
      { semitones: 21, intervalLabel: "13M" },
    ],
    recommendedScalesEs: ["Dórica"],
    recommendedScalesEn: ["Dorian"],
    functionEs: "Acorde menor dórico (destaca la 6M / 13M característica)",
    functionEn: "Dorian minor chord (highlights characteristic 6M / 13M)",
  },
  {
    id: "7sus4",
    nameEs: "Dominante Suspendido 4",
    nameEn: "Dominant 7sus4",
    symbol: "7sus4",
    category: "tensions",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 5, intervalLabel: "4J" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 10, intervalLabel: "7m" },
    ],
    recommendedScalesEs: ["Mixolidia", "Dórica"],
    recommendedScalesEn: ["Mixolydian", "Dorian"],
    functionEs: "Dominante suspendido antes de resolver a V7 o I",
    functionEn: "Suspended dominant resolving to V7 or I",
  },
  {
    id: "9sus4",
    nameEs: "Dominante 9ª Suspendido",
    nameEn: "Dominant 9sus4",
    symbol: "9sus4",
    category: "tensions",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 5, intervalLabel: "4J" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 10, intervalLabel: "7m" },
      { semitones: 14, intervalLabel: "9M" },
    ],
    recommendedScalesEs: ["Mixolidia"],
    recommendedScalesEn: ["Mixolydian"],
    functionEs: "Dominante suspendido moderno (equivale a un Gm7/C o Bb/C)",
    functionEn: "Modern suspended dominant (equivalent to Gm7/C or Bb/C)",
  },
  {
    id: "add9",
    nameEs: "Mayor con 9ª Añadida",
    nameEn: "Major Add9",
    symbol: "add9",
    category: "tensions",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 2, intervalLabel: "2M" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 7, intervalLabel: "5J" },
    ],
    recommendedScalesEs: ["Jónica (Mayor)", "Lidia", "Pentatónica Mayor"],
    recommendedScalesEn: ["Ionian (Major)", "Lydian", "Major Pentatonic"],
    functionEs: "Tríada Mayor con 9ª añadida (sin 7ª)",
    functionEn: "Major triad with added 9th (no 7th)",
  },
  {
    id: "m-add9",
    nameEs: "Menor con 9ª Añadida",
    nameEn: "Minor Add9",
    symbol: "m(add9)",
    category: "tensions",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 2, intervalLabel: "2M" },
      { semitones: 3, intervalLabel: "3m" },
      { semitones: 7, intervalLabel: "5J" },
    ],
    recommendedScalesEs: ["Eólica (Menor)", "Dórica", "Menor Melódica"],
    recommendedScalesEn: ["Aeolian (Minor)", "Dorian", "Melodic Minor"],
    functionEs: "Tríada Menor con 9ª Mayor añadida (color cinemático)",
    functionEn: "Minor triad with added Major 9th (cinematic color)",
  },

  // 4. ALTERADOS
  {
    id: "maj7#11",
    nameEs: "Mayor Lidio (#11)",
    nameEn: "Lydian Major (#11)",
    symbol: "Maj7(#11)",
    category: "altered",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 11, intervalLabel: "7M" },
      { semitones: 18, intervalLabel: "4a" },
    ],
    recommendedScalesEs: ["Lidia"],
    recommendedScalesEn: ["Lydian"],
    functionEs: "Acorde Mayor con 4ª aumentada (#11) propia del modo Lidio",
    functionEn: "Major 7th chord with augmented 4th (#11) from Lydian mode",
  },
  {
    id: "7b9",
    nameEs: "Dominante Bemol 9",
    nameEn: "Dominant Flat 9",
    symbol: "7(b9)",
    category: "altered",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 10, intervalLabel: "7m" },
      { semitones: 13, intervalLabel: "9m" },
    ],
    recommendedScalesEs: [
      "Dominante Disminuida",
      "Frigia Dominante",
      "Alterada",
    ],
    recommendedScalesEn: [
      "Dominant Diminished",
      "Phrygian Dominant",
      "Altered",
    ],
    functionEs: "V7(b9) que resuelve con fuerza hacia un acorde menor o mayor",
    functionEn: "V7(b9) resolving strongly to a minor or major tonic",
  },
  {
    id: "7#9",
    nameEs: "Dominante Sostenido 9",
    nameEn: "Dominant Sharp 9",
    symbol: "7(#9)",
    category: "altered",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 10, intervalLabel: "7m" },
      { semitones: 15, intervalLabel: "9a" },
    ],
    recommendedScalesEs: [
      "Alterada (Superlocria)",
      "Dominante Disminuida",
      "Escala de Blues",
    ],
    recommendedScalesEn: [
      "Altered (Superlocrian)",
      "Dominant Diminished",
      "Blues Scale",
    ],
    functionEs: "Dominante con 9ª aumentada (acorde Hendrix / Jazz Blues)",
    functionEn: "Dominant with augmented 9th (Hendrix / Jazz Blues chord)",
  },
  {
    id: "7#11",
    nameEs: "Dominante Lidio (#11)",
    nameEn: "Lydian Dominant (#11)",
    symbol: "7(#11)",
    category: "altered",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 10, intervalLabel: "7m" },
      { semitones: 18, intervalLabel: "4a" },
    ],
    recommendedScalesEs: ["Lidia b7 (Lidia Dominante)", "Tonal (Tono - Tono)"],
    recommendedScalesEn: ["Lydian Dominant (Lydian b7)", "Whole Tone"],
    functionEs: "Dominante sustituto tritonal (subV7) sin tendencia a resolver",
    functionEn: "Tritone substitute dominant (subV7)",
  },
  {
    id: "7b13",
    nameEs: "Dominante Bemol 13",
    nameEn: "Dominant Flat 13",
    symbol: "7(b13)",
    category: "altered",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 10, intervalLabel: "7m" },
      { semitones: 14, intervalLabel: "9M" },
      { semitones: 20, intervalLabel: "6m" },
    ],
    recommendedScalesEs: [
      "Mixolidia b6 (b13)",
      "Alterada (Superlocria)",
      "Frigia Dominante",
    ],
    recommendedScalesEn: [
      "Mixolydian b6 (b13)",
      "Altered (Superlocrian)",
      "Phrygian Dominant",
    ],
    functionEs: "Dominante con 13ª menor (6m) ideal para resolver a menor",
    functionEn: "Dominant with flat 13th (6m) ideal for minor resolution",
  },
  {
    id: "alt",
    nameEs: "Dominante Alterado",
    nameEn: "Altered Dominant",
    symbol: "7alt",
    category: "altered",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 10, intervalLabel: "7m" },
      { semitones: 15, intervalLabel: "9a" },
      { semitones: 20, intervalLabel: "6m" },
    ],
    recommendedScalesEs: ["Alterada (7º Modo Menor Melódica)"],
    recommendedScalesEn: ["Altered Scale (7th Mode Melodic Minor)"],
    functionEs: "Máxima tensión dominante (F - 3M - 7m - #9 - b13)",
    functionEn: "Maximum dominant tension (F - 3M - 7m - #9 - b13)",
  },

  // 5. ★ JAZZ VOICINGS DE CONCIERTO
  {
    id: "jazz_maj9",
    nameEs: "Jazz Voicing (3–5–7–9)",
    nameEn: "Jazz Voicing (3–5–7–9)",
    symbol: "Maj9",
    category: "jazz_voicings",
    artistTag: "Bill Evans / Chick Corea",
    voices: [
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 11, intervalLabel: "7M" },
      { semitones: 14, intervalLabel: "9M" },
    ],
    jazzVariations: [
      {
        titleEs: "ROOTLESS TIPO A",
        titleEn: "ROOTLESS TYPE A",
        shortBadge: "Tipo A",
        subtitleEs: "Bill Evans Tipo A (3M – 5J – 7M – 9M) · Ej. en Cmaj9: Mi – Sol – Si – Re",
        subtitleEn: "Bill Evans Type A (3M – 5J – 7M – 9M) · E.g. in Cmaj9: E – G – B – D",
        voices: [
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 7, intervalLabel: "5J" },
          { semitones: 11, intervalLabel: "7M" },
          { semitones: 14, intervalLabel: "9M" },
        ],
      },
      {
        titleEs: "ROOTLESS TIPO B",
        titleEn: "ROOTLESS TYPE B",
        shortBadge: "Tipo B",
        subtitleEs: "Bill Evans Tipo B (7M – 9M – 3M – 5J) · Ej. en Cmaj9: Si – Re – Mi – Sol",
        subtitleEn: "Bill Evans Type B (7M – 9M – 3M – 5J) · E.g. in Cmaj9: B – D – E – G",
        voices: [
          { semitones: -1, intervalLabel: "7M" },
          { semitones: 2, intervalLabel: "9M" },
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 7, intervalLabel: "5J" },
        ],
      },
      {
        titleEs: "CLUSTER MODERNO",
        titleEn: "MODERN CLUSTER",
        shortBadge: "Cluster",
        subtitleEs: "Voicing Abierto Moderno (3M – 7M – 9M – 3M) · Ej. en Cmaj7: Mi – Si – Re – Mi",
        subtitleEn: "Modern Open Voicing (3M – 7M – 9M – 3M) · E.g. in Cmaj7: E – B – D – E",
        voices: [
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 11, intervalLabel: "7M" },
          { semitones: 14, intervalLabel: "9M" },
          { semitones: 16, intervalLabel: "3M" },
        ],
      },
      {
        titleEs: "6/9 CUARTAL",
        titleEn: "6/9 QUARTAL",
        shortBadge: "Cuartal",
        subtitleEs: "Voicing por Cuartas Justas (3M – 6M – 9M – 5J) · Ej. en C: Mi – La – Re – Sol",
        subtitleEn: "Quartal Voicing in 4ths (3M – 6M – 9M – 5J) · E.g. in C: E – A – D – G",
        voices: [
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 9, intervalLabel: "6M" },
          { semitones: 14, intervalLabel: "9M" },
          { semitones: 19, intervalLabel: "5J" },
        ],
      },
      {
        titleEs: "BAJO + VOICING",
        titleEn: "BASS + VOICING",
        shortBadge: "2 Manos",
        subtitleEs: "Fundamental en Mano Izquierda + Rootless Tipo A (3M – 5J – 7M – 9M) en Mano Derecha",
        subtitleEn: "Root in Left Hand + Rootless Type A (3M – 5J – 7M – 9M) in Right Hand",
        voices: [
          { semitones: 0, intervalLabel: "F", hand: "LH", customFinger: "5" },
          { semitones: 16, intervalLabel: "3M", hand: "RH" },
          { semitones: 19, intervalLabel: "5J", hand: "RH" },
          { semitones: 23, intervalLabel: "7M", hand: "RH" },
          { semitones: 26, intervalLabel: "9M", hand: "RH" },
        ],
      },
    ],
    recommendedScalesEs: ["Jónica (Mayor)", "Lidia", "Bebop Mayor"],
    recommendedScalesEn: ["Ionian (Major)", "Lydian", "Major Bebop"],
    functionEs: "I Maj9 / IV Maj9 · Reemplaza la Fundamental por la 9ª Mayor (color Em7 sobre bajo C)",
    functionEn: "I Maj9 / IV Maj9 · Replaces Root with Major 9th (Em7 over C bass color)",
  },

  {
    id: "jazz_m9",
    nameEs: "Jazz Voicing (3m–5–7m–9)",
    nameEn: "Jazz Voicing (b3–5–b7–9)",
    symbol: "m9",
    category: "jazz_voicings",
    artistTag: "Bill Evans / Robert Glasper",
    voices: [
      { semitones: 3, intervalLabel: "3m" },
      { semitones: 7, intervalLabel: "5J" },
      { semitones: 10, intervalLabel: "7m" },
      { semitones: 14, intervalLabel: "9M" },
    ],
    jazzVariations: [
      {
        titleEs: "ROOTLESS TIPO A",
        titleEn: "ROOTLESS TYPE A",
        shortBadge: "Tipo A",
        subtitleEs: "Bill Evans Tipo A (3m – 5J – 7m – 9M) · Ej. en Dm9: Fa – La – Do – Mi",
        subtitleEn: "Bill Evans Type A (3m – 5J – 7m – 9M) · E.g. in Dm9: F – A – C – E",
        voices: [
          { semitones: 3, intervalLabel: "3m" },
          { semitones: 7, intervalLabel: "5J" },
          { semitones: 10, intervalLabel: "7m" },
          { semitones: 14, intervalLabel: "9M" },
        ],
      },
      {
        titleEs: "ROOTLESS TIPO B",
        titleEn: "ROOTLESS TYPE B",
        shortBadge: "Tipo B",
        subtitleEs: "Bill Evans Tipo B (7m – 9M – 3m – 5J) · Ej. en Dm9: Do – Mi – Fa – La",
        subtitleEn: "Bill Evans Type B (7m – 9M – 3m – 5J) · E.g. in Dm9: C – E – F – A",
        voices: [
          { semitones: -2, intervalLabel: "7m" },
          { semitones: 2, intervalLabel: "9M" },
          { semitones: 3, intervalLabel: "3m" },
          { semitones: 7, intervalLabel: "5J" },
        ],
      },
      {
        titleEs: "DÓRICO MODERNO",
        titleEn: "MODERN DORIAN",
        shortBadge: "Dórico",
        subtitleEs: "Voicing Abierto Dórico con 11ª y 13ª · Ej. en Dm7: Sol – Fa – Mi – Si",
        subtitleEn: "Open Dorian Voicing with 11th & 13th · E.g. in Dm7: G – F – E – B",
        voices: [
          { semitones: 5, intervalLabel: "11J" },
          { semitones: 15, intervalLabel: "3m" },
          { semitones: 14, intervalLabel: "9M" },
          { semitones: 21, intervalLabel: "13M" },
        ],
      },
      {
        titleEs: "NEO-SOUL CLUSTER",
        titleEn: "NEO-SOUL CLUSTER",
        shortBadge: "Neo-Soul",
        subtitleEs: "Cluster con segunda menor interna (F – 9M – 3m – 7m) · Ej. en Dm9: Re – Mi – Fa – Do",
        subtitleEn: "Cluster with internal minor 2nd (F – 9M – 3m – 7m) · E.g. in Dm9: D – E – F – C",
        voices: [
          { semitones: 0, intervalLabel: "F" },
          { semitones: 2, intervalLabel: "9M" },
          { semitones: 3, intervalLabel: "3m" },
          { semitones: 10, intervalLabel: "7m" },
        ],
      },
      {
        titleEs: "BAJO + VOICING",
        titleEn: "BASS + VOICING",
        shortBadge: "2 Manos",
        subtitleEs: "Fundamental en Mano Izquierda + Rootless Tipo A (Fa – La – Do – Mi) en Mano Derecha",
        subtitleEn: "Root in Left Hand + Rootless Type A (F – A – C – E) in Right Hand",
        voices: [
          { semitones: 0, intervalLabel: "F", hand: "LH", customFinger: "5" },
          { semitones: 15, intervalLabel: "3m", hand: "RH" },
          { semitones: 19, intervalLabel: "5J", hand: "RH" },
          { semitones: 22, intervalLabel: "7m", hand: "RH" },
          { semitones: 26, intervalLabel: "9M", hand: "RH" },
        ],
      },
    ],
    recommendedScalesEs: ["Dórica", "Eólica (Menor)", "Pentatónica Menor"],
    recommendedScalesEn: ["Dorian", "Aeolian (Minor)", "Minor Pentatonic"],
    functionEs: "IIm9 en cadencia II–V–I · Equivale a tocar un acorde Maj7 desde su 3ª menor (ej. Fmaj7 sobre D)",
    functionEn: "IIm9 in II–V–I · Equivalent to playing a Maj7 chord from its minor 3rd (Fmaj7 over D)",
  },

  {
    id: "jazz_m11",
    nameEs: "Voicing Cuartal 'So What'",
    nameEn: "'So What' Quartal Voicing",
    symbol: "m11",
    category: "jazz_voicings",
    artistTag: "McCoy Tyner / Miles Davis",
    voices: [
      { semitones: 3, intervalLabel: "3m" },
      { semitones: 10, intervalLabel: "7m" },
      { semitones: 14, intervalLabel: "9M" },
      { semitones: 17, intervalLabel: "11J" },
    ],
    jazzVariations: [
      {
        titleEs: "CUARTAL COMPACTO",
        titleEn: "COMPACT QUARTAL",
        shortBadge: "3m-7m-9-11",
        subtitleEs: "Voicing Menor 11 (3m – 7m – 9M – 11J) · Ej. en Dm11: Fa – Do – Mi – Sol",
        subtitleEn: "Minor 11 Voicing (3m – 7m – 9M – 11J) · E.g. in Dm11: F – C – E – G",
        voices: [
          { semitones: 3, intervalLabel: "3m" },
          { semitones: 10, intervalLabel: "7m" },
          { semitones: 14, intervalLabel: "9M" },
          { semitones: 17, intervalLabel: "11J" },
        ],
      },
      {
        titleEs: "'SO WHAT' (5 VOCES)",
        titleEn: "'SO WHAT' (5 VOICES)",
        shortBadge: "So What",
        subtitleEs: "Famoso acorde de Bill Evans en 'Kind of Blue' (3 cuartas justas + 1 tercera mayor): Re–Sol–Do–Fa–La",
        subtitleEn: "Famous Bill Evans 'Kind of Blue' chord (three 4ths + one Major 3rd): D–G–C–F–A",
        voices: [
          { semitones: 0, intervalLabel: "F" },
          { semitones: 5, intervalLabel: "11J" },
          { semitones: 10, intervalLabel: "7m" },
          { semitones: 15, intervalLabel: "3m" },
          { semitones: 19, intervalLabel: "5J" },
        ],
      },
      {
        titleEs: "KENNY BARRON m11",
        titleEn: "KENNY BARRON m11",
        shortBadge: "K. Barron",
        subtitleEs: "Voicing Abierto por Quintas (F–5J–9M en MI + 3m–7m–11J en MD)",
        subtitleEn: "Open Fifths Voicing (F–5J–9M in LH + 3m–7m–11J in RH)",
        voices: [
          { semitones: 0, intervalLabel: "F", hand: "LH", customFinger: "5" },
          { semitones: 7, intervalLabel: "5J", hand: "LH", customFinger: "2" },
          { semitones: 14, intervalLabel: "9M", hand: "LH", customFinger: "1" },
          { semitones: 15, intervalLabel: "3m", hand: "RH" },
          { semitones: 22, intervalLabel: "7m", hand: "RH" },
          { semitones: 29, intervalLabel: "11J", hand: "RH" },
        ],
      },
      {
        titleEs: "MCCOY CUARTAL",
        titleEn: "MCCOY QUARTAL",
        shortBadge: "McCoy",
        subtitleEs: "Cuartas desde la 7m (7m – 3m – 6M – 9M) · Ej. en Dm11: Do – Fa – Si – Mi",
        subtitleEn: "Pure 4ths from b7 (7m – 3m – 6M – 9M)",
        voices: [
          { semitones: -2, intervalLabel: "7m" },
          { semitones: 3, intervalLabel: "3m" },
          { semitones: 9, intervalLabel: "6M" },
          { semitones: 14, intervalLabel: "9M" },
        ],
      },
      {
        titleEs: "BAJO + VOICING",
        titleEn: "BASS + VOICING",
        shortBadge: "2 Manos",
        subtitleEs: "Fundamental en Mano Izquierda + Voicing Dm11 (Fa – Do – Mi – Sol) en Mano Derecha",
        subtitleEn: "Root in Left Hand + Dm11 Voicing (F – C – E – G) in Right Hand",
        voices: [
          { semitones: 0, intervalLabel: "F", hand: "LH", customFinger: "5" },
          { semitones: 15, intervalLabel: "3m", hand: "RH" },
          { semitones: 22, intervalLabel: "7m", hand: "RH" },
          { semitones: 26, intervalLabel: "9M", hand: "RH" },
          { semitones: 29, intervalLabel: "11J", hand: "RH" },
        ],
      },
    ],
    recommendedScalesEs: ["Dórica", "Pentatónica Menor", "Pentatónica Dórica"],
    recommendedScalesEn: ["Dorian", "Minor Pentatonic", "Dorian Pentatonic"],
    functionEs: "Sonoridad modal abierta por cuartas · Ideal para acordes menores estáticos o IIm11",
    functionEn: "Open quartal modal sound · Ideal for static minor vamps or IIm11",
  },

  {
    id: "jazz_dom9",
    nameEs: "Jazz Voicing (7m–9–3–13)",
    nameEn: "Jazz Voicing (b7–9–3–13)",
    symbol: "9",
    category: "jazz_voicings",
    artistTag: "Wynton Kelly / Red Garland",
    voices: [
      { semitones: 10, intervalLabel: "7m" },
      { semitones: 14, intervalLabel: "9M" },
      { semitones: 16, intervalLabel: "3M" },
      { semitones: 21, intervalLabel: "13M" },
    ],
    jazzVariations: [
      {
        titleEs: "ROOTLESS TIPO B",
        titleEn: "ROOTLESS TYPE B",
        shortBadge: "Tipo B",
        subtitleEs: "Voicing Dominante Clásico (7m – 9M – 3M – 13M) · Ej. en G9: Fa – La – Si – Mi",
        subtitleEn: "Classic Dominant Voicing (7m – 9M – 3M – 13M) · E.g. in G9: F – A – B – E",
        voices: [
          { semitones: -2, intervalLabel: "7m" },
          { semitones: 2, intervalLabel: "9M" },
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 9, intervalLabel: "13M" },
        ],
      },
      {
        titleEs: "ROOTLESS TIPO A",
        titleEn: "ROOTLESS TYPE A",
        shortBadge: "Tipo A",
        subtitleEs: "Bill Evans Tipo A (3M – 13M – 7m – 9M) · Ej. en G9: Si – Mi – Fa – La",
        subtitleEn: "Bill Evans Type A (3M – 13M – 7m – 9M) · E.g. in G9: B – E – F – A",
        voices: [
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 9, intervalLabel: "13M" },
          { semitones: 10, intervalLabel: "7m" },
          { semitones: 14, intervalLabel: "9M" },
        ],
      },
      {
        titleEs: "ROOTLESS 9 PURO",
        titleEn: "PURE 9TH ROOTLESS",
        shortBadge: "3-5-7m-9",
        subtitleEs: "Semidisminuido desde la 3ª (3M – 5J – 7m – 9M) · Ej. en G9: Si – Re – Fa – La (Bm7b5)",
        subtitleEn: "Half-diminished from 3rd (3M – 5J – 7m – 9M) · E.g. in G9: B – D – F – A",
        voices: [
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 7, intervalLabel: "5J" },
          { semitones: 10, intervalLabel: "7m" },
          { semitones: 14, intervalLabel: "9M" },
        ],
      },
      {
        titleEs: "BLUES BLOCK VOICING",
        titleEn: "BLUES BLOCK VOICING",
        shortBadge: "Blues",
        subtitleEs: "Wynton Kelly Blues Comping (7m – 3M – 5J – 9M) · Ej. en G9: Fa – Si – Re – La",
        subtitleEn: "Wynton Kelly Blues Comping (7m – 3M – 5J – 9M) · E.g. in G9: F – B – D – A",
        voices: [
          { semitones: -2, intervalLabel: "7m" },
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 7, intervalLabel: "5J" },
          { semitones: 14, intervalLabel: "9M" },
        ],
      },
      {
        titleEs: "BAJO + VOICING",
        titleEn: "BASS + VOICING",
        shortBadge: "2 Manos",
        subtitleEs: "Fundamental en Mano Izquierda + Voicing (Fa – La – Si – Mi) en Mano Derecha",
        subtitleEn: "Root in Left Hand + Voicing (F – A – B – E) in Right Hand",
        voices: [
          { semitones: 0, intervalLabel: "F", hand: "LH", customFinger: "5" },
          { semitones: 10, intervalLabel: "7m", hand: "RH" },
          { semitones: 14, intervalLabel: "9M", hand: "RH" },
          { semitones: 16, intervalLabel: "3M", hand: "RH" },
          { semitones: 21, intervalLabel: "13M", hand: "RH" },
        ],
      },
    ],
    recommendedScalesEs: ["Mixolidia", "Bebop Dominante", "Escala de Blues"],
    recommendedScalesEn: ["Mixolydian", "Dominant Bebop", "Blues Scale"],
    functionEs: "V9 en progresión II–V–I · Enlaza con movimiento mínimo de dedos desde Dm9 (Fa–La–Do–Mi -> Fa–La–Si–Mi)",
    functionEn: "V9 in II–V–I · Connects with minimal finger movement from Dm9 (F–A–C–E -> F–A–B–E)",
  },

  {
    id: "jazz_dom13",
    nameEs: "Voicing Cuartal (7m–3–13–9)",
    nameEn: "Quartal Voicing (b7–3–13–9)",
    symbol: "13",
    category: "jazz_voicings",
    artistTag: "Herbie Hancock / Chick Corea",
    voices: [
      { semitones: -2, intervalLabel: "7m" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 9, intervalLabel: "13M" },
      { semitones: 14, intervalLabel: "9M" },
    ],
    jazzVariations: [
      {
        titleEs: "CUARTAL (Fa–Si–Mi–La)",
        titleEn: "QUARTAL (F–B–E–A)",
        shortBadge: "Cuartal",
        subtitleEs: "Voicing Dominante 13 por Cuartas (7m – 3M – 13M – 9M) · Ej. en G13: Fa – Si – Mi – La",
        subtitleEn: "Dominant 13 Quartal Voicing (7m – 3M – 13M – 9M) · E.g. in G13: F – B – E – A",
        voices: [
          { semitones: -2, intervalLabel: "7m" },
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 9, intervalLabel: "13M" },
          { semitones: 14, intervalLabel: "9M" },
        ],
      },
      {
        titleEs: "ROOTLESS TIPO A",
        titleEn: "ROOTLESS TYPE A",
        shortBadge: "Tipo A",
        subtitleEs: "Bill Evans Tipo A (3M – 13M – 7m – 9M) · Ej. en G13: Si – Mi – Fa – La",
        subtitleEn: "Bill Evans Type A (3M – 13M – 7m – 9M) · E.g. in G13: B – E – F – A",
        voices: [
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 9, intervalLabel: "13M" },
          { semitones: 10, intervalLabel: "7m" },
          { semitones: 14, intervalLabel: "9M" },
        ],
      },
      {
        titleEs: "ROOTLESS TIPO B",
        titleEn: "ROOTLESS TYPE B",
        shortBadge: "Tipo B",
        subtitleEs: "Bill Evans Tipo B (7m – 9M – 3M – 13M) · Ej. en G13: Fa – La – Si – Mi",
        subtitleEn: "Bill Evans Type B (7m – 9M – 3M – 13M) · E.g. in G13: F – A – B – E",
        voices: [
          { semitones: -2, intervalLabel: "7m" },
          { semitones: 2, intervalLabel: "9M" },
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 9, intervalLabel: "13M" },
        ],
      },
      {
        titleEs: "SPREAD VOICING",
        titleEn: "SPREAD VOICING",
        shortBadge: "Spread",
        subtitleEs: "Shell en Mano Izquierda (F – 7m) + Tensiones en Mano Derecha (3M – 13M – 9M)",
        subtitleEn: "Shell in Left Hand (F – 7m) + Tensions in Right Hand (3M – 13M – 9M)",
        voices: [
          { semitones: 0, intervalLabel: "F", hand: "LH", customFinger: "5" },
          { semitones: 10, intervalLabel: "7m", hand: "LH", customFinger: "1" },
          { semitones: 16, intervalLabel: "3M", hand: "RH" },
          { semitones: 21, intervalLabel: "13M", hand: "RH" },
          { semitones: 26, intervalLabel: "9M", hand: "RH" },
        ],
      },
      {
        titleEs: "BAJO + CUARTAL",
        titleEn: "BASS + QUARTAL",
        shortBadge: "2 Manos",
        subtitleEs: "Fundamental en Mano Izquierda + Cuartal (Fa – Si – Mi – La) en Mano Derecha",
        subtitleEn: "Root in Left Hand + Quartal (F – B – E – A) in Right Hand",
        voices: [
          { semitones: 0, intervalLabel: "F", hand: "LH", customFinger: "5" },
          { semitones: 10, intervalLabel: "7m", hand: "RH" },
          { semitones: 16, intervalLabel: "3M", hand: "RH" },
          { semitones: 21, intervalLabel: "13M", hand: "RH" },
          { semitones: 26, intervalLabel: "9M", hand: "RH" },
        ],
      },
    ],
    recommendedScalesEs: ["Mixolidia", "Lidia b7 (Lidia Dominante)", "Bebop Dominante"],
    recommendedScalesEn: ["Mixolydian", "Lydian Dominant", "Dominant Bebop"],
    functionEs: "El voicing de 4 cuartas más famoso del Jazz Moderno (Tritono abajo + dos cuartas justas arriba)",
    functionEn: "The most famous 4-note quartal dominant voicing in Modern Jazz",
  },

  {
    id: "jazz_7b9",
    nameEs: "Disminuido sin Raíz (7b9)",
    nameEn: "Rootless Diminished (7b9)",
    symbol: "7(b9)",
    category: "jazz_voicings",
    artistTag: "Barry Harris / Bud Powell",
    voices: [
      { semitones: -2, intervalLabel: "7m" },
      { semitones: 1, intervalLabel: "9m" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 7, intervalLabel: "5J" },
    ],
    jazzVariations: [
      {
        titleEs: "TIPO B (Fa–Lab–Si–Re)",
        titleEn: "TYPE B (F–Ab–B–D)",
        shortBadge: "Tipo B",
        subtitleEs: "Disminuido desde la 7m (7m – 9m – 3M – 5J) · Ej. en G7(b9): Fa – Lab – Si – Re",
        subtitleEn: "Diminished from b7 (7m – 9m – 3M – 5J) · E.g. in G7(b9): F – Ab – B – D",
        voices: [
          { semitones: -2, intervalLabel: "7m" },
          { semitones: 1, intervalLabel: "9m" },
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 7, intervalLabel: "5J" },
        ],
      },
      {
        titleEs: "TIPO A (Si–Re–Fa–Lab)",
        titleEn: "TYPE A (B–D–F–Ab)",
        shortBadge: "Tipo A",
        subtitleEs: "Disminuido desde la 3M (3M – 5J – 7m – 9m) · Ej. en G7(b9): Si – Re – Fa – Lab",
        subtitleEn: "Diminished from 3M (3M – 5J – 7m – 9m) · E.g. in G7(b9): B – D – F – Ab",
        voices: [
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 7, intervalLabel: "5J" },
          { semitones: 10, intervalLabel: "7m" },
          { semitones: 13, intervalLabel: "9m" },
        ],
      },
      {
        titleEs: "CON 13ª NATURAL",
        titleEn: "WITH NATURAL 13TH",
        shortBadge: "13(b9)",
        subtitleEs: "Dominante 13(b9) (7m – 9m – 3M – 13M) · Ej. en G13(b9): Fa – Lab – Si – Mi",
        subtitleEn: "Dominant 13(b9) (7m – 9m – 3M – 13M) · E.g. in G13(b9): F – Ab – B – E",
        voices: [
          { semitones: -2, intervalLabel: "7m" },
          { semitones: 1, intervalLabel: "9m" },
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 9, intervalLabel: "13M" },
        ],
      },
      {
        titleEs: "UPPER STRUCTURE VI",
        titleEn: "UPPER STRUCTURE VI",
        shortBadge: "US VI",
        subtitleEs: "Tritono (3M–7m) en Mano Izquierda + Tríada Mayor del VI grado en Mano Derecha",
        subtitleEn: "Tritone (3M–7m) in Left Hand + Major Triad on VI degree in Right Hand",
        voices: [
          { semitones: 4, intervalLabel: "3M", hand: "LH", customFinger: "4" },
          { semitones: 10, intervalLabel: "7m", hand: "LH", customFinger: "1" },
          { semitones: 13, intervalLabel: "9m", hand: "RH" },
          { semitones: 16, intervalLabel: "3M", hand: "RH" },
          { semitones: 21, intervalLabel: "13M", hand: "RH" },
        ],
      },
      {
        titleEs: "BAJO + VOICING",
        titleEn: "BASS + VOICING",
        shortBadge: "2 Manos",
        subtitleEs: "Fundamental en Mano Izquierda + Disminuido (Fa – Lab – Si – Re) en Mano Derecha",
        subtitleEn: "Root in Left Hand + Diminished (F – Ab – B – D) in Right Hand",
        voices: [
          { semitones: 0, intervalLabel: "F", hand: "LH", customFinger: "5" },
          { semitones: 10, intervalLabel: "7m", hand: "RH" },
          { semitones: 13, intervalLabel: "9m", hand: "RH" },
          { semitones: 16, intervalLabel: "3M", hand: "RH" },
          { semitones: 19, intervalLabel: "5J", hand: "RH" },
        ],
      },
    ],
    recommendedScalesEs: [
      "Dominante Disminuida (Semitono - Tono)",
      "Frigia Dominante",
    ],
    recommendedScalesEn: [
      "Dominant Diminished (Half - Whole)",
      "Phrygian Dominant",
    ],
    functionEs: "Tocar un acorde °7 desde la 3M, 5J, 7m o b9 produce automáticamente un dominante 7(b9) sin raíz",
    functionEn: "Playing a °7 chord from 3M, 5J, 7m or b9 yields a rootless 7(b9) dominant",
  },

  {
    id: "jazz_7sharp11",
    nameEs: "Upper Structure II · Lidio Dom",
    nameEn: "Upper Structure II · Lydian Dom",
    symbol: "7(#11)",
    category: "jazz_voicings",
    artistTag: "Herbie Hancock / Thelonious Monk",
    voices: [
      { semitones: -2, intervalLabel: "7m" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 6, intervalLabel: "4a" },
      { semitones: 9, intervalLabel: "13M" },
    ],
    jazzVariations: [
      {
        titleEs: "LÍDIO DOM (7m–3–#11–13)",
        titleEn: "LYDIAN DOM (7m–3–#11–13)",
        shortBadge: "Lidio Dom",
        subtitleEs: "Voicing Lidio Dominante (7m – 3M – 4a – 13M) · En C7(#11): Sib – Mi – Fa# – La | En G7(#11): Fa – Si – Do# – Mi",
        subtitleEn: "Lydian Dominant Voicing (7m – 3M – 4a – 13M) · E.g. in C7(#11): Bb – E – F# – A",
        voices: [
          { semitones: -2, intervalLabel: "7m" },
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 6, intervalLabel: "4a" },
          { semitones: 9, intervalLabel: "13M" },
        ],
      },
      {
        titleEs: "UPPER STRUCTURE II",
        titleEn: "UPPER STRUCTURE II",
        shortBadge: "US II",
        subtitleEs: "Tritono (7m–3M) en MI + Tríada Mayor del II Grado (9M–4a–13M) en MD · En C7(#11): Re–Fa#–La sobre Sib–Mi",
        subtitleEn: "Tritone (7m–3M) in LH + II Major Triad (9M–4a–13M) in RH",
        voices: [
          { semitones: -2, intervalLabel: "7m", hand: "LH", customFinger: "4" },
          { semitones: 4, intervalLabel: "3M", hand: "LH", customFinger: "1" },
          { semitones: 14, intervalLabel: "9M", hand: "RH" },
          { semitones: 18, intervalLabel: "4a", hand: "RH" },
          { semitones: 21, intervalLabel: "13M", hand: "RH" },
        ],
      },
      {
        titleEs: "COMPACTO CON 9ª",
        titleEn: "COMPACT WITH 9TH",
        shortBadge: "3-#11-7m-9",
        subtitleEs: "Tipo A con #11 (3M – 4a – 7m – 9M) · En C7(#11): Mi – Fa# – Sib – Re",
        subtitleEn: "Type A with #11 (3M – 4a – 7m – 9M) · E.g. in C7(#11): E – F# – Bb – D",
        voices: [
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 6, intervalLabel: "4a" },
          { semitones: 10, intervalLabel: "7m" },
          { semitones: 14, intervalLabel: "9M" },
        ],
      },
      {
        titleEs: "WHOLE TONE VOICING",
        titleEn: "WHOLE TONE VOICING",
        shortBadge: "Tonal",
        subtitleEs: "Color de Escala Tonal (7m – 9M – 3M – 4a) · En C7(#11): Sib – Re – Mi – Fa#",
        subtitleEn: "Whole Tone Scale Color (7m – 9M – 3M – 4a) · E.g. in C7(#11): Bb – D – E – F#",
        voices: [
          { semitones: -2, intervalLabel: "7m" },
          { semitones: 2, intervalLabel: "9M" },
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 6, intervalLabel: "4a" },
        ],
      },
      {
        titleEs: "BAJO + VOICING",
        titleEn: "BASS + VOICING",
        shortBadge: "2 Manos",
        subtitleEs: "Fundamental en Mano Izquierda + Lidio Dominante (7m – 3M – 4a – 13M) en Mano Derecha",
        subtitleEn: "Root in Left Hand + Lydian Dominant (7m – 3M – 4a – 13M) in Right Hand",
        voices: [
          { semitones: 0, intervalLabel: "F", hand: "LH", customFinger: "5" },
          { semitones: 10, intervalLabel: "7m", hand: "RH" },
          { semitones: 16, intervalLabel: "3M", hand: "RH" },
          { semitones: 18, intervalLabel: "4a", hand: "RH" },
          { semitones: 21, intervalLabel: "13M", hand: "RH" },
        ],
      },
    ],
    recommendedScalesEs: ["Lidia b7 (Lidia Dominante)", "Tonal (Tono - Tono)"],
    recommendedScalesEn: ["Lydian Dominant (Lydian b7)", "Whole Tone"],
    functionEs: "Superpone la tríada mayor del II grado (ej. Re Mayor sobre Do7 o La Mayor sobre Sol7) para lograr 9M, #11 y 13M",
    functionEn: "Superimposes the Major triad of the II degree to obtain 9M, #11 and 13M",
  },

  {
    id: "jazz_7alt",
    nameEs: "Jazz Voicing Alterado (7alt)",
    nameEn: "Altered Jazz Voicing (7alt)",
    symbol: "7alt",
    category: "jazz_voicings",
    artistTag: "Chick Corea / Brad Mehldau",
    voices: [
      { semitones: -2, intervalLabel: "7m" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 6, intervalLabel: "5d" },
      { semitones: 13, intervalLabel: "9m" },
    ],
    jazzVariations: [
      {
        titleEs: "TRITONO + b5 + b9",
        titleEn: "TRITONE + b5 + b9",
        shortBadge: "7m-3-5d-9m",
        subtitleEs: "Dominante Alterado (7m – 3M – 5d – 9m) · Ej. en G7alt: Fa – Si – Reb – Lab",
        subtitleEn: "Altered Dominant (7m – 3M – 5d – 9m) · E.g. in G7alt: F – B – Db – Ab",
        voices: [
          { semitones: -2, intervalLabel: "7m" },
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 6, intervalLabel: "5d" },
          { semitones: 13, intervalLabel: "9m" },
        ],
      },
      {
        titleEs: "BILL EVANS (#9 / b13)",
        titleEn: "BILL EVANS (#9 / b13)",
        shortBadge: "#9 / b13",
        subtitleEs: "Rootless Alterado Clásico (7m – 9a – 3M – 6m) · Ej. en G7alt: Fa – La# – Si – Mib",
        subtitleEn: "Classic Altered Rootless (7m – 9a – 3M – 6m) · E.g. in G7alt: F – A# – B – Eb",
        voices: [
          { semitones: -2, intervalLabel: "7m" },
          { semitones: 3, intervalLabel: "9a" },
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 8, intervalLabel: "6m" },
        ],
      },
      {
        titleEs: "TIPO A (3–b13–7m–#9)",
        titleEn: "TYPE A (3–b13–7m–#9)",
        shortBadge: "Tipo A",
        subtitleEs: "Bill Evans Tipo A Alterado (3M – 6m – 7m – 9a) · Ej. en G7alt: Si – Mib – Fa – La#",
        subtitleEn: "Bill Evans Altered Type A (3M – 6m – 7m – 9a) · E.g. in G7alt: B – Eb – F – A#",
        voices: [
          { semitones: 4, intervalLabel: "3M" },
          { semitones: 8, intervalLabel: "6m" },
          { semitones: 10, intervalLabel: "7m" },
          { semitones: 15, intervalLabel: "9a" },
        ],
      },
      {
        titleEs: "UPPER STRUCTURE bVI",
        titleEn: "UPPER STRUCTURE bVI",
        shortBadge: "US bVI",
        subtitleEs: "Tritono (7m–3M) en Mano Izquierda + Tríada Mayor del bVI en Mano Derecha",
        subtitleEn: "Tritone (7m–3M) in Left Hand + bVI Major Triad in Right Hand (#9 & b13)",
        voices: [
          { semitones: -2, intervalLabel: "7m", hand: "LH", customFinger: "4" },
          { semitones: 4, intervalLabel: "3M", hand: "LH", customFinger: "1" },
          { semitones: 8, intervalLabel: "6m", hand: "RH" },
          { semitones: 12, intervalLabel: "F", hand: "RH" },
          { semitones: 15, intervalLabel: "9a", hand: "RH" },
        ],
      },
      {
        titleEs: "BAJO + VOICING",
        titleEn: "BASS + VOICING",
        shortBadge: "2 Manos",
        subtitleEs: "Fundamental en Mano Izquierda + Voicing Alterado (7m – 3M – 5d – 9m) en Mano Derecha",
        subtitleEn: "Root in Left Hand + Altered Voicing (7m – 3M – 5d – 9m) in Right Hand",
        voices: [
          { semitones: 0, intervalLabel: "F", hand: "LH", customFinger: "5" },
          { semitones: 10, intervalLabel: "7m", hand: "RH" },
          { semitones: 16, intervalLabel: "3M", hand: "RH" },
          { semitones: 18, intervalLabel: "5d", hand: "RH" },
          { semitones: 25, intervalLabel: "9m", hand: "RH" },
        ],
      },
    ],
    recommendedScalesEs: ["Alterada (7º Modo de la Menor Melódica)"],
    recommendedScalesEn: ["Altered Scale (7th Mode of Melodic Minor)"],
    functionEs: "V7alt de máxima tensión cromática · Resuelve hacia acorde Mayor o Menor por semitono",
    functionEn: "Maximum chromatic tension V7alt resolving by half-step to Major or Minor tonic",
  },
];

interface PianoKeyInfo {
  midi: number;
  pc: number;
  octave: number;
  isBlack: boolean;
  whiteIndex: number;
}

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

const PIANO_KEYS_3_OCTAVES: PianoKeyInfo[] = (() => {
  const keys: PianoKeyInfo[] = [];
  let whiteCounter = 0;

  for (let midi = 48; midi <= 83; midi++) {
    const pc = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    const isBlack = BLACK_PITCH_CLASSES.has(pc);

    if (!isBlack) {
      keys.push({
        midi,
        pc,
        octave,
        isBlack: false,
        whiteIndex: whiteCounter,
      });
      whiteCounter++;
    } else {
      keys.push({
        midi,
        pc,
        octave,
        isBlack: true,
        whiteIndex: whiteCounter - 1,
      });
    }
  }
  return keys;
})();

interface ActiveKeyDetail {
  midi: number;
  freq: number;
  isRoot: boolean;
  noteLabelEs: string;
  noteLabelEn: string;
  intervalLabel: string;
  fingerLabel: string;
  hand: "LH" | "RH";
}

interface ChordVoicingPosition {
  id: number;
  titleEs: string;
  titleEn: string;
  shortBadge: string;
  subtitleEs: string;
  subtitleEn: string;
  activeKeysByMidi: Map<number, ActiveKeyDetail>;
  orderedNotes: ActiveKeyDetail[];
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function resolveVoiceNoteNames(
  pc: number,
  intervalLabel: string,
  root: RootNote
): { es: string; en: string } {
  const rootUsesFlats = ["Db", "Eb", "F", "Ab", "Bb", "Gb"].includes(root);

  if (["2m", "9m", "3m", "5d", "6m", "7m", "7d"].includes(intervalLabel)) {
    if (
      !["D", "E", "F#", "A", "B", "C#"].includes(root) ||
      intervalLabel === "7d" ||
      intervalLabel === "5d" ||
      intervalLabel === "9m"
    ) {
      return {
        es: NOTE_NAMES_FLAT_ES[pc],
        en: NOTE_NAMES_FLAT_EN[pc],
      };
    }
  }

  if (["4a", "5a", "9a", "2a"].includes(intervalLabel)) {
    if (!["Db", "Eb", "Ab", "Bb", "Gb"].includes(root)) {
      return {
        es: NOTE_NAMES_SHARP_ES[pc],
        en: NOTE_NAMES_SHARP_EN[pc],
      };
    }
  }

  return {
    es: rootUsesFlats ? NOTE_NAMES_FLAT_ES[pc] : NOTE_NAMES_SHARP_ES[pc],
    en: rootUsesFlats ? NOTE_NAMES_FLAT_EN[pc] : NOTE_NAMES_SHARP_EN[pc],
  };
}

function assignRightHandPianoFingers(midis: number[]): string[] {
  const n = midis.length;
  if (n === 0) return [];
  if (n === 1) return ["1"];
  if (n === 2) return ["1", "3"];
  if (n === 3) {
    const span1 = midis[1] - midis[0];
    const span2 = midis[2] - midis[1];
    return span2 > span1 ? ["1", "2", "5"] : ["1", "3", "5"];
  }
  if (n === 4) {
    const span2 = midis[2] - midis[1];
    const span3 = midis[3] - midis[2];
    return span3 <= 2
      ? ["1", "2", "4", "5"]
      : span2 >= 4
      ? ["1", "2", "4", "5"]
      : ["1", "2", "3", "5"];
  }
  if (n === 5) {
    return ["1", "2", "3", "4", "5"];
  }
  return midis.map((_, i) => String(Math.min(5, i + 1)));
}

export default function ScaleDictionary() {
  const { language } = useLanguage();
  const isEs = language === "es";

  const [selectedRoot, setSelectedRoot] = useState<RootNote>("C");
  const [activeCategory, setActiveCategory] = useState<string>("tensions");
  const [selectedChordId, setSelectedChordId] = useState<string>("maj9");
  const [keyLabelMode, setKeyLabelMode] = useState<KeyLabelMode>("note");
  const [selectedPositionId, setSelectedPositionId] = useState<number>(0);
  const [selectedInstrument, setSelectedInstrument] =
    useState<KeyboardInstrumentId>("grand_piano");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [activePlayingMidis, setActivePlayingMidis] = useState<Set<number>>(
    new Set()
  );
  const [isPlayingArpeggio, setIsPlayingArpeggio] = useState<boolean>(false);

  const timersRef = useRef<number[]>([]);

  const roots: RootNote[] = [
    "C",
    "Db",
    "D",
    "Eb",
    "E",
    "F",
    "F#",
    "G",
    "Ab",
    "A",
    "Bb",
    "B",
  ];

  useEffect(() => {
    dictionaryAudio.preloadPianoSamples();
  }, []);

  const clearPlaybackTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    setIsPlayingArpeggio(false);
    setActivePlayingMidis(new Set());
  };

  useEffect(() => {
    return () => clearPlaybackTimers();
  }, []);

  useEffect(() => {
    clearPlaybackTimers();
  }, [selectedRoot, selectedChordId, selectedPositionId]);

  const selectedChordDef = useMemo<KeyboardChordDefinition>(() => {
    return (
      KEYBOARD_CHORD_CATALOG.find((c) => c.id === selectedChordId) ||
      KEYBOARD_CHORD_CATALOG[0]
    );
  }, [selectedChordId]);

  const chordPositions = useMemo<ChordVoicingPosition[]>(() => {
    const rootSemi = ROOT_SEMITONES[selectedRoot] ?? 0;

    if (
      selectedChordDef.jazzVariations &&
      selectedChordDef.jazzVariations.length > 0
    ) {
      return selectedChordDef.jazzVariations.map((variation, idx) => {
        const hasLeftHandBass = variation.voices.some((v) => v.hand === "LH");
        const baseAnchorMidi = hasLeftHandBass ? 48 + rootSemi : 60 + rootSemi;

        let rawNotes = variation.voices.map((v) => ({
          midi: baseAnchorMidi + v.semitones,
          intervalLabel: v.intervalLabel,
          isRoot: ((v.semitones % 12) + 12) % 12 === 0,
          hand: v.hand || ("RH" as "LH" | "RH"),
          customFinger: v.customFinger,
        }));

        const maxM = Math.max(...rawNotes.map((n) => n.midi));
        const minM = Math.min(...rawNotes.map((n) => n.midi));
        let shift = 0;
        if (maxM > 83) shift = -12;
        else if (minM < 48) shift = 12;

        rawNotes = rawNotes
          .map((n) => ({ ...n, midi: n.midi + shift }))
          .sort((a, b) => a.midi - b.midi);

        const rhMidis = rawNotes
          .filter((n) => n.hand === "RH")
          .map((n) => n.midi);
        const rhFingers = assignRightHandPianoFingers(rhMidis);
        let rhCounter = 0;

        const activeKeysByMidi = new Map<number, ActiveKeyDetail>();
        const orderedNotes: ActiveKeyDetail[] = [];

        rawNotes.forEach((n) => {
          if (n.midi >= 48 && n.midi <= 83) {
            const pc = ((n.midi % 12) + 12) % 12;
            const finger =
              n.hand === "LH"
                ? n.customFinger || "5"
                : rhFingers[rhCounter++] || "1";

            const spelled = resolveVoiceNoteNames(
              pc,
              n.intervalLabel,
              selectedRoot
            );

            const detail: ActiveKeyDetail = {
              midi: n.midi,
              freq: midiToFreq(n.midi),
              isRoot: n.isRoot,
              noteLabelEs: spelled.es,
              noteLabelEn: spelled.en,
              intervalLabel: n.intervalLabel,
              fingerLabel: finger,
              hand: n.hand,
            };
            activeKeysByMidi.set(n.midi, detail);
            orderedNotes.push(detail);
          }
        });

        return {
          id: idx,
          titleEs: variation.titleEs,
          titleEn: variation.titleEn,
          shortBadge: variation.shortBadge,
          subtitleEs: variation.subtitleEs,
          subtitleEn: variation.subtitleEn,
          activeKeysByMidi,
          orderedNotes,
        };
      });
    }

    const baseRootMidi = 48 + rootSemi;

    const buildInversionPosition = (
      id: number,
      inversionIndex: number,
      titleEs: string,
      titleEn: string,
      shortBadge: string,
      subtitleEs: string,
      subtitleEn: string
    ): ChordVoicingPosition => {
      const voices = selectedChordDef.voices;
      const numVoices = voices.length;

      const rotatedSpecs: {
        midi: number;
        intervalLabel: string;
        isRoot: boolean;
      }[] = [];

      if (inversionIndex === 0) {
        voices.forEach((v) => {
          rotatedSpecs.push({
            midi: baseRootMidi + v.semitones,
            intervalLabel: v.intervalLabel,
            isRoot: v.semitones % 12 === 0,
          });
        });
      } else {
        const compactVoices = voices.map((v) => ({
          pcOffset: ((v.semitones % 12) + 12) % 12,
          intervalLabel: v.intervalLabel,
          isRoot: v.semitones % 12 === 0,
        }));

        const effInv = inversionIndex % numVoices;
        const rotatedOrder = [
          ...compactVoices.slice(effInv),
          ...compactVoices.slice(0, effInv),
        ];

        let prevMidi = baseRootMidi - 1;
        rotatedOrder.forEach((v) => {
          let candidate = 48 + ((rootSemi + v.pcOffset) % 12);
          while (candidate <= prevMidi) {
            candidate += 12;
          }
          rotatedSpecs.push({
            midi: candidate,
            intervalLabel: v.intervalLabel,
            isRoot: v.isRoot,
          });
          prevMidi = candidate;
        });

        if (numVoices === 3 && inversionIndex === 3) {
          rotatedSpecs.length = 0;
          voices.forEach((v) => {
            rotatedSpecs.push({
              midi: baseRootMidi + 12 + v.semitones,
              intervalLabel: v.intervalLabel,
              isRoot: v.semitones % 12 === 0,
            });
          });
        }
      }

      const maxM = Math.max(...rotatedSpecs.map((s) => s.midi));
      const minM = Math.min(...rotatedSpecs.map((s) => s.midi));
      let octaveShift = 0;
      if (maxM > 83) octaveShift = -12;
      else if (
        minM < 52 &&
        maxM + 12 <= 79 &&
        inversionIndex === 0 &&
        voices.length <= 4
      ) {
        octaveShift = 12;
      }

      const finalSpecs = rotatedSpecs.map((s) => ({
        ...s,
        midi: s.midi + octaveShift,
      }));

      const rhFingers = assignRightHandPianoFingers(
        finalSpecs.map((s) => s.midi)
      );

      const activeKeysByMidi = new Map<number, ActiveKeyDetail>();
      const orderedNotes: ActiveKeyDetail[] = [];

      finalSpecs.forEach((s, idx) => {
        if (s.midi >= 48 && s.midi <= 83) {
          const pc = s.midi % 12;
          const spelled = resolveVoiceNoteNames(
            pc,
            s.intervalLabel,
            selectedRoot
          );
          const detail: ActiveKeyDetail = {
            midi: s.midi,
            freq: midiToFreq(s.midi),
            isRoot: s.isRoot,
            noteLabelEs: spelled.es,
            noteLabelEn: spelled.en,
            intervalLabel: s.intervalLabel,
            fingerLabel: rhFingers[idx] || String(Math.min(5, idx + 1)),
            hand: "RH",
          };
          activeKeysByMidi.set(s.midi, detail);
          orderedNotes.push(detail);
        }
      });

      return {
        id,
        titleEs,
        titleEn,
        shortBadge,
        subtitleEs,
        subtitleEn,
        activeKeysByMidi,
        orderedNotes,
      };
    };

    const buildTwoHandVoicing = (): ChordVoicingPosition => {
      const bassMidi = 48 + rootSemi;
      const activeKeysByMidi = new Map<number, ActiveKeyDetail>();
      const orderedNotes: ActiveKeyDetail[] = [];

      const bassPc = bassMidi % 12;
      const bassSpelled = resolveVoiceNoteNames(bassPc, "F", selectedRoot);
      const bassDetail: ActiveKeyDetail = {
        midi: bassMidi,
        freq: midiToFreq(bassMidi),
        isRoot: true,
        noteLabelEs: bassSpelled.es,
        noteLabelEn: bassSpelled.en,
        intervalLabel: "F",
        fingerLabel: "5",
        hand: "LH",
      };
      activeKeysByMidi.set(bassMidi, bassDetail);
      orderedNotes.push(bassDetail);

      const rhVoices =
        selectedChordDef.voices.length >= 5
          ? selectedChordDef.voices.filter((v) => v.semitones !== 0)
          : selectedChordDef.voices;

      let prevMidi = Math.max(bassMidi + 7, 58);
      const rhSpecs: {
        midi: number;
        intervalLabel: string;
        isRoot: boolean;
      }[] = [];

      rhVoices.forEach((v) => {
        const pcOffset = ((v.semitones % 12) + 12) % 12;
        let candidate = 48 + ((rootSemi + pcOffset) % 12);
        while (candidate <= prevMidi) {
          candidate += 12;
        }
        if (candidate <= 83) {
          rhSpecs.push({
            midi: candidate,
            intervalLabel: v.intervalLabel,
            isRoot: v.semitones % 12 === 0,
          });
          prevMidi = candidate;
        }
      });

      const rhFingers = assignRightHandPianoFingers(
        rhSpecs.map((s) => s.midi)
      );

      rhSpecs.forEach((s, idx) => {
        const pc = s.midi % 12;
        const spelled = resolveVoiceNoteNames(
          pc,
          s.intervalLabel,
          selectedRoot
        );
        const detail: ActiveKeyDetail = {
          midi: s.midi,
          freq: midiToFreq(s.midi),
          isRoot: s.isRoot,
          noteLabelEs: spelled.es,
          noteLabelEn: spelled.en,
          intervalLabel: s.intervalLabel,
          fingerLabel: rhFingers[idx] || String(Math.min(5, idx + 1)),
          hand: "RH",
        };
        activeKeysByMidi.set(s.midi, detail);
        orderedNotes.push(detail);
      });

      return {
        id: 4,
        titleEs: "VOICING 2 MANOS",
        titleEn: "2-HAND VOICING",
        shortBadge: "2 Manos",
        subtitleEs:
          "Voicing Profesional a 2 Manos · Bajo Fundamental en Mano Izquierda + Acorde en Mano Derecha",
        subtitleEn:
          "Professional 2-Hand Voicing · Root Bass in Left Hand + Chord Voicing in Right Hand",
        activeKeysByMidi,
        orderedNotes,
      };
    };

    const isTriad = selectedChordDef.voices.length === 3;

    const pos0 = buildInversionPosition(
      0,
      0,
      "FUNDAMENTAL",
      "ROOT POSITION",
      "Fund.",
      "Estado Fundamental · La Fundamental (F) es la nota más grave del acorde",
      "Root Position · The Fundamental (F) is the lowest note of the chord"
    );

    const pos1 = buildInversionPosition(
      1,
      1,
      "1ª INVERSIÓN",
      "1ST INVERSION",
      "1ª Inv.",
      `1ª Inversión · El intervalo ${
        selectedChordDef.voices[1]?.intervalLabel || "3ª"
      } queda como la nota más grave`,
      `1st Inversion · The ${
        selectedChordDef.voices[1]?.intervalLabel || "3rd"
      } interval is in the bass`
    );

    const pos2 = buildInversionPosition(
      2,
      2,
      "2ª INVERSIÓN",
      "2ND INVERSION",
      "2ª Inv.",
      `2ª Inversión · El intervalo ${
        selectedChordDef.voices[2]?.intervalLabel || "5ª"
      } queda como la nota más grave`,
      `2nd Inversion · The ${
        selectedChordDef.voices[2]?.intervalLabel || "5th"
      } interval is in the bass`
    );

    const pos3 = buildInversionPosition(
      3,
      3,
      isTriad ? "OCTAVA AGUDA" : "3ª INVERSIÓN",
      isTriad ? "UPPER OCTAVE" : "3RD INVERSION",
      isTriad ? "8va Alta" : "3ª Inv.",
      isTriad
        ? "Estado Fundamental en Octava Aguda · Registro brillante del teclado"
        : `3ª Inversión · El intervalo ${
            selectedChordDef.voices[3]?.intervalLabel || "7ª"
          } queda como la nota más grave`,
      isTriad
        ? "Root Position in Upper Octave · Bright keyboard register"
        : `3rd Inversion · The ${
            selectedChordDef.voices[3]?.intervalLabel || "7th"
          } interval is in the bass`
    );

    const pos4 = buildTwoHandVoicing();

    return [pos0, pos1, pos2, pos3, pos4];
  }, [selectedRoot, selectedChordDef]);

  const activePosition = useMemo(
    () =>
      chordPositions.find((p) => p.id === selectedPositionId) ||
      chordPositions[0],
    [chordPositions, selectedPositionId]
  );

  const handlePlayChordBlock = (
    posToPlay: ChordVoicingPosition = activePosition,
    instrumentToUse: KeyboardInstrumentId = selectedInstrument
  ) => {
    clearPlaybackTimers();
    const notes = posToPlay.orderedNotes;
    if (!notes || notes.length === 0) return;

    const allMidis = new Set(notes.map((n) => n.midi));
    setActivePlayingMidis(allMidis);

    notes.forEach((n, idx) => {
      dictionaryAudio.playKeyboardNote(
        n.midi,
        instrumentToUse,
        1.55,
        idx * 0.032,
        0.24
      );
    });

    const endId = window.setTimeout(() => {
      setActivePlayingMidis(new Set());
    }, 1350);
    timersRef.current.push(endId);
  };

  const handlePlayChordArpeggio = (
    posToPlay: ChordVoicingPosition = activePosition,
    instrumentToUse: KeyboardInstrumentId = selectedInstrument
  ) => {
    clearPlaybackTimers();
    const notes = posToPlay.orderedNotes;
    if (!notes || notes.length === 0) return;

    setIsPlayingArpeggio(true);
    const stepMs = 340;

    notes.forEach((n, idx) => {
      const tId = window.setTimeout(() => {
        setActivePlayingMidis(new Set([n.midi]));
        dictionaryAudio.playKeyboardNote(
          n.midi,
          instrumentToUse,
          0.95,
          0,
          0.3
        );
      }, idx * stepMs);
      timersRef.current.push(tId);
    });

    const blockStartMs = notes.length * stepMs + 120;
    const blockId = window.setTimeout(() => {
      setActivePlayingMidis(new Set(notes.map((n) => n.midi)));
      notes.forEach((n, i) => {
        dictionaryAudio.playKeyboardNote(
          n.midi,
          instrumentToUse,
          1.35,
          i * 0.03,
          0.22
        );
      });
    }, blockStartMs);
    timersRef.current.push(blockId);

    const endId = window.setTimeout(() => {
      setIsPlayingArpeggio(false);
      setActivePlayingMidis(new Set());
    }, blockStartMs + 1150);
    timersRef.current.push(endId);
  };

  const handlePlaySingleKey = (midi: number) => {
    clearPlaybackTimers();
    setActivePlayingMidis(new Set([midi]));
    dictionaryAudio.playKeyboardNote(
      midi,
      selectedInstrument,
      1.05,
      0,
      0.32
    );
    const tId = window.setTimeout(() => {
      setActivePlayingMidis(new Set());
    }, 520);
    timersRef.current.push(tId);
  };

  const activeFormulaString = useMemo(
    () =>
      activePosition.orderedNotes
        .map((n) => n.intervalLabel)
        .join(" – "),
    [activePosition]
  );

  const activeNotesSummary = useMemo(
    () =>
      activePosition.orderedNotes
        .map((n) => (isEs ? n.noteLabelEs : n.noteLabelEn))
        .join(" – "),
    [activePosition, isEs]
  );

  const whiteKeys = useMemo(
    () => PIANO_KEYS_3_OCTAVES.filter((k) => !k.isBlack),
    []
  );
  const blackKeys = useMemo(
    () => PIANO_KEYS_3_OCTAVES.filter((k) => k.isBlack),
    []
  );

  const rootUsesFlats = ["Db", "Eb", "F", "Ab", "Bb", "Gb"].includes(
    selectedRoot
  );

  return (
    <div
      id="scale-dictionary-container"
      className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full select-none items-start"
    >
      {/* COLUMNA IZQUIERDA */}
      <div className="lg:col-span-4 flex flex-col gap-4 min-w-0">
        <div className="bg-[#111217] p-4 rounded-2xl border border-[#1e202b] shadow-xl">
          <div className="flex items-center justify-between mb-3 h-5">
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Music size={14} className="text-[#f25100]" />
              {isEs ? "TÓNICA (FUNDAMENTAL)" : "TONIC (ROOT NOTE)"}
            </span>
            <span className="text-xs font-mono font-bold text-[#f25100]">
              {ROOT_SOLFEGE_ES[selectedRoot]} ({selectedRoot})
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {roots.map((root) => {
              const isSelected = selectedRoot === root;
              return (
                <button
                  key={`root-${root}`}
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setSelectedRoot(root);
                  }}
                  className={`h-10 rounded-xl border font-mono text-sm font-extrabold transition-colors cursor-pointer focus:outline-none ${
                    isSelected
                      ? "bg-[#f25100] text-white border-[#ff7433] shadow-[0_0_14px_rgba(242,81,0,0.4)]"
                      : "bg-[#161720] text-zinc-200 border-[#232533] hover:border-[#f25100]/50 hover:text-white"
                  }`}
                >
                  {root}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-[#111217] p-4 rounded-2xl border border-[#1e202b] shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between h-4">
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">
              {isEs ? "ACORDE / JAZZ VOICING" : "CHORD / JAZZ VOICING"}
            </span>
            <span className="text-[10px] font-mono text-[#f25100] font-bold flex items-center gap-1">
              <Award size={12} />
              {isEs ? "Inversiones + Jazz Pro" : "Inversions + Jazz Pro"}
            </span>
          </div>

          <div className="relative w-full">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              placeholder={
                isEs
                  ? "Buscar acorde o voicing (ej. Maj9, m11, 13, 7alt)..."
                  : "Search chord or voicing (e.g. Maj9, m11, 13, 7alt)..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 bg-[#161720] border border-[#252736] rounded-xl py-2 pl-8 pr-3 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-[#f25100] transition-colors"
            />
          </div>

          {!searchQuery && (
            <div className="flex flex-wrap gap-1.5 pb-2 border-b border-[#1c1e28]">
              {KEYBOARD_CHORD_CATEGORIES.map((cat) => {
                const isCatActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setActiveCategory(cat.id);
                      const firstInCat = KEYBOARD_CHORD_CATALOG.find(
                        (c) => c.category === cat.id
                      );
                      if (firstInCat) {
                        setSelectedChordId(firstInCat.id);
                        setSelectedPositionId(0);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer focus:outline-none ${
                      isCatActive
                        ? "bg-[#f25100] text-white shadow-[0_0_10px_rgba(242,81,0,0.3)]"
                        : cat.isPro
                        ? "bg-[#1a1412] text-[#ff8547] border border-[#f25100]/40 hover:bg-[#f25100] hover:text-white"
                        : "bg-[#161720] text-zinc-400 hover:text-white border border-[#242634]"
                    }`}
                  >
                    {isEs ? cat.shortEs : cat.shortEn}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-2 h-[380px] overflow-y-auto pr-1">
            {KEYBOARD_CHORD_CATEGORIES.map((cat) => {
              if (!searchQuery && cat.id !== activeCategory) return null;

              const filteredChords = KEYBOARD_CHORD_CATALOG.filter((ch) => {
                if (ch.category !== cat.id) return false;
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  ch.nameEs.toLowerCase().includes(q) ||
                  ch.nameEn.toLowerCase().includes(q) ||
                  ch.symbol.toLowerCase().includes(q) ||
                  ch.id.toLowerCase().includes(q) ||
                  (ch.artistTag && ch.artistTag.toLowerCase().includes(q))
                );
              });

              if (filteredChords.length === 0) return null;

              return (
                <div key={cat.id} className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 px-1">
                    {isEs ? cat.titleEs : cat.titleEn}
                  </span>
                  {filteredChords.map((ch) => {
                    const isSelected = selectedChordId === ch.id;
                    const formulaStr = ch.voices
                      .map((v) => v.intervalLabel)
                      .join(" – ");
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          setSelectedChordId(ch.id);
                          setSelectedPositionId(0);
                        }}
                        className={`w-full h-[46px] px-3.5 rounded-xl border text-left transition-colors cursor-pointer focus:outline-none flex items-center justify-between gap-2 shrink-0 ${
                          isSelected
                            ? "bg-[#f25100] text-white border-[#ff7433] shadow-[0_0_12px_rgba(242,81,0,0.3)]"
                            : "bg-[#161720] text-zinc-200 border-[#232533] hover:border-[#f25100]/50 hover:bg-[#1b1d28]"
                        }`}
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 truncate">
                            <span className="text-sm font-black font-mono shrink-0">
                              {selectedRoot}
                              {ch.symbol}
                            </span>
                            <span
                              className={`text-xs font-bold truncate ${
                                isSelected ? "text-white" : "text-zinc-300"
                              }`}
                            >
                              {isEs ? ch.nameEs : ch.nameEn}
                            </span>
                          </div>
                          {ch.artistTag && (
                            <span
                              className={`text-[9px] font-mono truncate ${
                                isSelected ? "text-orange-100" : "text-[#f25100]"
                              }`}
                            >
                              ★ {ch.artistTag}
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-mono shrink-0 ${
                            isSelected
                              ? "text-orange-100 font-bold"
                              : "text-zinc-500"
                          }`}
                        >
                          {formulaStr}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* COLUMNA DERECHA CON CONTROLES DE ICONOS COMPACTOS */}
      <div className="lg:col-span-8 flex flex-col gap-4 min-w-0">
        <div className="bg-[#111217] p-4 sm:p-5 rounded-2xl border border-[#1e202b] shadow-2xl flex flex-col gap-4 overflow-hidden">
          {/* Cabecera Superior: Amplio espacio para el título del acorde + Botonera con Iconos */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-nowrap">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-baseline gap-2 min-w-0">
                  <span className="text-[#f25100] font-mono shrink-0">
                    {selectedRoot}
                    {selectedChordDef.symbol}
                  </span>
                  <span className="truncate text-zinc-100 font-extrabold text-base sm:text-lg">
                    {isEs ? selectedChordDef.nameEs : selectedChordDef.nameEn}
                  </span>
                </h2>
                <span className="px-2 py-0.5 rounded-lg bg-[#161720] border border-[#252736] text-[10px] font-mono font-extrabold text-[#f25100] shrink-0">
                  {activePosition.shortBadge}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 truncate">
                {isEs ? activePosition.subtitleEs : activePosition.subtitleEn}
              </p>
            </div>

            {/* BARRA DE HERRAMIENTAS COMPACTA CON ICONOS */}
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
              {/* 1. Selector de Sonido Compacto */}
              <div className="relative h-9 shrink-0">
                <Radio
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#f25100] pointer-events-none"
                />
                <select
                  value={selectedInstrument}
                  onChange={(e) => {
                    const newInst = e.target.value as KeyboardInstrumentId;
                    e.currentTarget.blur();
                    setSelectedInstrument(newInst);
                    handlePlayChordBlock(activePosition, newInst);
                  }}
                  title={
                    isEs
                      ? "Cambiar sonido de teclado"
                      : "Change keyboard sound"
                  }
                  className="h-9 pl-7 pr-6 rounded-xl bg-[#161720] hover:bg-[#1c1e29] border border-[#282b3d] hover:border-[#f25100]/60 text-[11px] font-extrabold uppercase tracking-wider text-zinc-100 appearance-none cursor-pointer focus:outline-none focus:border-[#f25100] transition-colors"
                >
                  {KEYBOARD_INSTRUMENTS.map((inst) => (
                    <option
                      key={inst.id}
                      value={inst.id}
                      className="bg-[#111217] text-zinc-100 font-sans font-bold"
                    >
                      {isEs ? inst.labelEs : inst.labelEn}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                />
              </div>

              {/* 2. Selector con Iconos: Notas | Intervalos | Dedos */}
              <div className="flex items-center bg-[#161720] p-1 rounded-xl border border-[#252736] shrink-0 h-9">
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setKeyLabelMode("note");
                  }}
                  title={isEs ? "Ver Notas" : "Show Notes"}
                  className={`px-2 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer focus:outline-none ${
                    keyLabelMode === "note"
                      ? "bg-[#f25100] text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Music size={12} />
                  <span>{isEs ? "NOTAS" : "NOTES"}</span>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setKeyLabelMode("interval");
                  }}
                  title={isEs ? "Ver Intervalos (F, 3M, 5J, 7M)" : "Show Intervals"}
                  className={`px-2 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer focus:outline-none ${
                    keyLabelMode === "interval"
                      ? "bg-[#f25100] text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <GitCommit size={12} />
                  <span>{isEs ? "INT." : "INT."}</span>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setKeyLabelMode("finger");
                  }}
                  title={isEs ? "Ver Dedos (1, 2, 3, 4, 5)" : "Show Fingers"}
                  className={`px-2 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer focus:outline-none ${
                    keyLabelMode === "finger"
                      ? "bg-[#f25100] text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Hand size={12} />
                  <span>{isEs ? "DEDOS" : "FING."}</span>
                </button>
              </div>

              {/* 3. Botón Compacto: Tocar Acorde */}
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handlePlayChordBlock(activePosition);
                }}
                title={isEs ? "Escuchar acorde completo" : "Play full chord"}
                className="h-9 px-3 rounded-xl bg-[#f25100] hover:bg-[#ff621a] text-white font-extrabold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_16px_rgba(242,81,0,0.4)] transition-colors cursor-pointer focus:outline-none shrink-0 whitespace-nowrap"
              >
                <Play size={12} className="fill-current shrink-0" />
                <span>{isEs ? "SONAR" : "PLAY"}</span>
              </button>

              {/* 4. Botón Compacto con Icono: Arpegiar */}
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.currentTarget.blur();
                  if (isPlayingArpeggio) {
                    clearPlaybackTimers();
                  } else {
                    handlePlayChordArpeggio(activePosition);
                  }
                }}
                title={
                  isEs
                    ? "Arpegiar acorde nota por nota"
                    : "Arpeggiate chord note by note"
                }
                className="h-9 px-2.5 rounded-xl bg-[#161720] hover:bg-[#1f212e] text-zinc-100 border border-[#2d3042] hover:border-[#f25100] font-extrabold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 transition-colors cursor-pointer focus:outline-none shrink-0 whitespace-nowrap"
              >
                {isPlayingArpeggio ? (
                  <>
                    <Square size={11} className="fill-current text-[#f25100] shrink-0" />
                    <span>{isEs ? "PARAR" : "STOP"}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={12} className="text-[#f25100] shrink-0" />
                    <span>{isEs ? "ARP." : "ARP."}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Barra de Inversiones / Variaciones de Jazz Voicing */}
          <div className="bg-[#15161e] border border-[#232634] rounded-xl p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3 flex-nowrap h-5 overflow-hidden">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5 truncate">
                <Layers size={14} className="text-[#f25100] shrink-0" />
                <span className="truncate">
                  {selectedChordDef.category === "jazz_voicings"
                    ? isEs
                      ? "VARIACIONES DE JAZZ VOICING (TIPO A, TIPO B, CLUSTER / CUARTAL Y 2 MANOS):"
                      : "JAZZ VOICING VARIATIONS (TYPE A, TYPE B, CLUSTER / QUARTAL & 2 HANDS):"
                    : isEs
                    ? "DISPOSICIÓN EN EL TECLADO (ESTADO FUNDAMENTAL, INVERSIONES Y VOICING):"
                    : "KEYBOARD VOICING (ROOT POSITION, INVERSIONS & 2-HAND VOICING):"}
                </span>
              </span>
              <span className="text-[11px] font-mono text-zinc-400 shrink-0 truncate">
                {isEs ? "Notas: " : "Notes: "}
                <strong className="text-[#f25100]">{activeNotesSummary}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {chordPositions.map((pos) => {
                const isSelected = selectedPositionId === pos.id;
                return (
                  <button
                    key={pos.id}
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setSelectedPositionId(pos.id);
                      handlePlayChordBlock(pos);
                    }}
                    className={`h-9 px-2.5 rounded-xl border text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer focus:outline-none truncate ${
                      isSelected
                        ? "bg-[#f25100] text-white border-[#ff7433] shadow-[0_0_12px_rgba(242,81,0,0.35)]"
                        : "bg-[#101117] text-zinc-300 border-[#252736] hover:border-[#f25100]/50 hover:text-white"
                    }`}
                  >
                    {isEs ? pos.titleEs : pos.titleEn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TECLADO 100% ENCAJADO DENTRO DE LOS BORDES SIN SALIRSE */}
          <div className="w-full bg-[#15161e] border border-[#232634] rounded-2xl p-3 sm:p-4 overflow-hidden">
            <div className="w-full select-none">
              <div className="w-full h-3 bg-gradient-to-b from-[#232634] to-[#0d0e14] rounded-t-xl border-x border-t border-[#2e3244] relative overflow-hidden">
                <div className="absolute bottom-0 inset-x-0 h-[3px] bg-gradient-to-r from-[#8f1d00] via-[#f25100] to-[#8f1d00] opacity-90" />
              </div>

              <div className="relative w-full h-[240px] sm:h-[255px] bg-[#0a0b0f] rounded-b-xl border-x border-b border-[#252838] p-1.5 pt-0 shadow-2xl">
                <div className="relative w-full h-full flex">
                  {whiteKeys.map((wk) => {
                    const activeDetail = activePosition.activeKeysByMidi.get(
                      wk.midi
                    );
                    const isPlayingNow = activePlayingMidis.has(wk.midi);
                    const isActive = Boolean(activeDetail);
                    const isRoot = activeDetail?.isRoot ?? false;

                    const defaultNoteName = isEs
                      ? (rootUsesFlats
                          ? NOTE_NAMES_FLAT_ES
                          : NOTE_NAMES_SHARP_ES)[wk.pc]
                      : (rootUsesFlats
                          ? NOTE_NAMES_FLAT_EN
                          : NOTE_NAMES_SHARP_EN)[wk.pc];

                    const badgeText = activeDetail
                      ? keyLabelMode === "note"
                        ? isEs
                          ? activeDetail.noteLabelEs
                          : activeDetail.noteLabelEn
                        : keyLabelMode === "interval"
                        ? activeDetail.intervalLabel
                        : activeDetail.hand === "LH"
                        ? `MI ${activeDetail.fingerLabel}`
                        : activeDetail.fingerLabel
                      : "";

                    const secondarySubText = activeDetail
                      ? keyLabelMode === "note"
                        ? activeDetail.intervalLabel
                        : isEs
                        ? activeDetail.noteLabelEs
                        : activeDetail.noteLabelEn
                      : "";

                    return (
                      <button
                        key={`wk-${wk.midi}`}
                        type="button"
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          handlePlaySingleKey(wk.midi);
                        }}
                        title={`${defaultNoteName}${wk.octave}`}
                        className={`relative flex-1 min-w-0 h-full rounded-b-lg border-x border-b transition-colors flex flex-col justify-end items-center pb-2.5 cursor-pointer focus:outline-none ${
                          isPlayingNow
                            ? "bg-gradient-to-b from-[#fff3eb] via-[#ffd4b8] to-[#ff9e66] border-[#f25100] shadow-inner"
                            : isActive
                            ? isRoot
                              ? "bg-gradient-to-b from-white via-orange-50 to-orange-100/95 border-zinc-300 shadow-[inset_0_-5px_0_rgba(242,81,0,0.28)]"
                              : "bg-gradient-to-b from-white via-zinc-100 to-zinc-200 border-zinc-300 shadow-[inset_0_-5px_0_rgba(30,32,43,0.2)]"
                            : "bg-gradient-to-b from-[#fcfcfd] via-[#f2f3f7] to-[#e2e4ec] hover:from-white hover:to-[#eceef5] border-zinc-300/90 shadow-[inset_0_-5px_0_rgba(0,0,0,0.12)]"
                        }`}
                      >
                        {wk.pc === 0 && !isActive && (
                          <span className="text-[9px] font-mono font-bold text-zinc-400 mb-1">
                            {isEs ? `Do${wk.octave}` : `C${wk.octave}`}
                          </span>
                        )}

                        {activeDetail && (
                          <div className="flex flex-col items-center gap-0.5 z-10 w-full px-0.5">
                            <span className="text-[9px] font-mono font-extrabold text-zinc-600 leading-none">
                              {secondarySubText}
                            </span>
                            <div
                              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full font-mono text-[10px] font-black flex items-center justify-center transition-transform shrink-0 ${
                                isPlayingNow
                                  ? "bg-[#090a0d] text-white scale-110 ring-2 ring-[#f25100] shadow-[0_0_12px_#f25100]"
                                  : isRoot
                                  ? "bg-[#f25100] text-white border border-[#ff8c52] shadow-[0_3px_10px_rgba(242,81,0,0.55)]"
                                  : "bg-[#1c1e29] text-white border border-[#3e4259] shadow-md"
                              }`}
                            >
                              {badgeText}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {blackKeys.map((bk) => {
                    const activeDetail = activePosition.activeKeysByMidi.get(
                      bk.midi
                    );
                    const isPlayingNow = activePlayingMidis.has(bk.midi);
                    const isActive = Boolean(activeDetail);
                    const isRoot = activeDetail?.isRoot ?? false;

                    const totalWhite = whiteKeys.length;
                    const leftPercent =
                      ((bk.whiteIndex + 1) / totalWhite) * 100;

                    const defaultNoteName = isEs
                      ? (rootUsesFlats
                          ? NOTE_NAMES_FLAT_ES
                          : NOTE_NAMES_SHARP_ES)[bk.pc]
                      : (rootUsesFlats
                          ? NOTE_NAMES_FLAT_EN
                          : NOTE_NAMES_SHARP_EN)[bk.pc];

                    const badgeText = activeDetail
                      ? keyLabelMode === "note"
                        ? isEs
                          ? activeDetail.noteLabelEs
                          : activeDetail.noteLabelEn
                        : keyLabelMode === "interval"
                        ? activeDetail.intervalLabel
                        : activeDetail.hand === "LH"
                        ? `MI ${activeDetail.fingerLabel}`
                        : activeDetail.fingerLabel
                      : "";

                    const secondarySubText = activeDetail
                      ? keyLabelMode === "note"
                        ? activeDetail.intervalLabel
                        : isEs
                        ? activeDetail.noteLabelEs
                        : activeDetail.noteLabelEn
                      : "";

                    return (
                      <button
                        key={`bk-${bk.midi}`}
                        type="button"
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          handlePlaySingleKey(bk.midi);
                        }}
                        title={`${defaultNoteName}${bk.octave}`}
                        style={{
                          left: `${leftPercent}%`,
                          width: "3.15%",
                          transform: "translateX(-50%)",
                        }}
                        className={`absolute top-0 h-[61%] z-20 rounded-b-lg border-x border-b transition-colors flex flex-col justify-end items-center pb-2 cursor-pointer focus:outline-none ${
                          isPlayingNow
                            ? "bg-gradient-to-b from-[#ff7733] to-[#f25100] border-[#ffa375] shadow-[0_0_18px_rgba(242,81,0,0.8)]"
                            : isActive
                            ? isRoot
                              ? "bg-gradient-to-b from-[#3b1c0e] via-[#26130a] to-[#1a0d07] border-[#f25100] shadow-[0_6px_14px_rgba(0,0,0,0.75)]"
                              : "bg-gradient-to-b from-[#2c3040] via-[#1f222e] to-[#14161f] border-[#525870] shadow-[0_6px_14px_rgba(0,0,0,0.75)]"
                            : "bg-gradient-to-b from-[#262833] via-[#171820] to-[#0c0d12] hover:from-[#303342] border-[#07080b] shadow-[0_5px_10px_rgba(0,0,0,0.65),inset_0_-5px_0_rgba(255,255,255,0.06)]"
                        }`}
                      >
                        {activeDetail && (
                          <div className="flex flex-col items-center gap-0.5 z-30">
                            <span className="text-[8px] font-mono font-bold text-orange-200/90 leading-none">
                              {secondarySubText}
                            </span>
                            <div
                              className={`w-6 h-6 rounded-full font-mono text-[9px] font-black flex items-center justify-center shrink-0 ${
                                isPlayingNow
                                  ? "bg-white text-[#090a0d] scale-110 ring-2 ring-white"
                                  : isRoot
                                  ? "bg-[#f25100] text-white border border-[#ff945e] shadow-[0_0_10px_#f25100]"
                                  : "bg-[#2e3244] text-white border border-[#6c7393] shadow-md"
                              }`}
                            >
                              {badgeText}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-[#1e202b] text-xs text-zinc-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2 font-bold">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#f25100] inline-block shadow-[0_0_8px_#f25100]" />
                  {isEs ? "Fundamental (F)" : "Fundamental (F)"}
                </span>
                <span className="flex items-center gap-2 font-bold">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#1c1e29] border border-[#525870] inline-block" />
                  {isEs
                    ? "Voces e Intervalos del Acorde / Voicing"
                    : "Chord / Voicing Voices & Intervals"}
                </span>
              </div>

              <span className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                <Volume2 size={13} className="text-[#f25100]" />
                {isEs
                  ? "Haz clic en cualquier tecla o inversión para escuchar el acorde"
                  : "Click any key or inversion to hear the chord"}
              </span>
            </div>
          </div>
        </div>

        {/* Tarjeta inferior de altura fija */}
        <div className="bg-[#111217] p-5 rounded-2xl border border-[#1e202b] shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:h-[126px]">
          <div className="flex flex-col gap-1.5 min-w-0 flex-1 overflow-hidden">
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-300 flex items-center gap-2 h-4">
              <BookOpen size={14} className="text-[#f25100] shrink-0" />
              <span className="truncate">
                {isEs
                  ? "FUNCIÓN ARMÓNICA Y ESCALAS COMPATIBLES"
                  : "HARMONIC FUNCTION & COMPATIBLE SCALES"}
              </span>
            </span>
            <p className="text-xs sm:text-sm text-zinc-400 truncate h-5 leading-5">
              {isEs ? selectedChordDef.functionEs : selectedChordDef.functionEn}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-nowrap overflow-x-auto h-9">
              {(isEs
                ? selectedChordDef.recommendedScalesEs
                : selectedChordDef.recommendedScalesEn
              ).map((scName) => (
                <span
                  key={scName}
                  className="px-3 py-1 rounded-xl bg-[#161720] border border-[#252736] text-xs font-mono font-extrabold text-white shrink-0"
                >
                  {selectedRoot}{" "}
                  <span className="text-[#f25100]">{scName}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="bg-[#161720] border border-[#252736] rounded-xl px-4 py-3 shrink-0 flex flex-col items-start sm:items-end justify-center h-[86px] min-w-[265px]">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <GitCommit size={13} className="text-[#f25100]" />
              {isEs
                ? "INTERVALOS DEL VOICING ACTIVO"
                : "ACTIVE VOICING INTERVALS"}
            </span>
            <span className="text-sm sm:text-base font-mono font-black text-[#f25100] mt-1 truncate">
              {activeFormulaString}
            </span>
            <span className="text-[11px] font-mono text-zinc-400 mt-0.5 truncate max-w-[250px]">
              {isEs ? "Notas: " : "Notes: "}
              <strong className="text-white">{activeNotesSummary}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}