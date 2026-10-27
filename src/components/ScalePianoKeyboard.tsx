import { useState, useMemo, useRef, useEffect } from "react";
import { RootNote } from "../types";
import { dictionaryAudio } from "../utils/dictionaryAudio";
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
  semitones: number; // semitonos desde la Fundamental en Estado Fundamental
  intervalLabel: string; // Nomenclatura clásica: F, 3M, 3m, 5J, 5d, 5a, 7M, 7m, 7d, 9M, 9m, 9a, 11J, 4a, 6M, 6m
}

interface KeyboardChordDefinition {
  id: string;
  nameEs: string;
  nameEn: string;
  symbol: string; // ej. "Maj7", "m7", "7(b9)"
  category: string;
  voices: ChordVoiceSpec[];
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
    shortEs: "TENSIONES (9/11/13)",
    shortEn: "TENSIONS (9/11/13)",
    titleEs: "Acordes Extendidos con Tensiones",
    titleEn: "Extended Chords with Tensions",
  },
  {
    id: "altered",
    shortEs: "ALTERADOS / JAZZ",
    shortEn: "ALTERED / JAZZ",
    titleEs: "Acordes Alterados y Jazz Voicings",
    titleEn: "Altered & Jazz Chords",
  },
];

/**
 * CATÁLOGO COMPLETO DE ACORDES PROFESIONALES PARA TECLADO
 * Con intervalos clásicos exactos (F, 2M, 3m, 3M, 4J, 4a, 5d, 5J, 5a, 6m, 6M, 7d, 7m, 7M, 9m, 9M, 9a, 11J, 13M)
 */
const KEYBOARD_CHORD_CATALOG: KeyboardChordDefinition[] = [
  // =========================================================================
  // 1. TRÍADAS Y SUSPENDIDOS
  // =========================================================================
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
    nameEs: "Suspendido 4 (sus4)",
    nameEn: "Suspended 4th (sus4)",
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
    nameEs: "Suspendido 2 (sus2)",
    nameEn: "Suspended 2nd (sus2)",
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

  // =========================================================================
  // 2. SÉPTIMAS Y SEXTAS (CUATRÍADAS)
  // =========================================================================
  {
    id: "maj7",
    nameEs: "Mayor Séptima (Maj7)",
    nameEn: "Major 7th (Maj7)",
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
    nameEs: "Dominante 7 (7)",
    nameEn: "Dominant 7th (7)",
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
    nameEs: "Menor Séptima (m7)",
    nameEn: "Minor 7th (m7)",
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
    nameEs: "Semidisminuido (m7b5 / Ø)",
    nameEn: "Half-Diminished (m7b5 / Ø)",
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
    nameEs: "Disminuido 7 (°7)",
    nameEn: "Diminished 7th (°7)",
    symbol: "°7",
    category: "sevenths",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 3, intervalLabel: "3m" },
      { semitones: 6, intervalLabel: "5d" },
      { semitones: 9, intervalLabel: "7d" },
    ],
    recommendedScalesEs: ["Disminuida (Tono - Semitono)", "Menor Armónica (desde 7º grado)"],
    recommendedScalesEn: ["Diminished (Whole - Half)", "Harmonic Minor (from 7th degree)"],
    functionEs: "VII°7 (Dominante por terceras menores simétricas)",
    functionEn: "VII°7 (Symmetric minor-third dominant)",
  },
  {
    id: "m(maj7)",
    nameEs: "Menor Mayor 7 (mMaj7)",
    nameEn: "Minor Major 7th (mMaj7)",
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
    nameEs: "Mayor 7(#5) Aumentado",
    nameEn: "Major 7(#5) Augmented",
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
    nameEs: "Mayor Sexta (6)",
    nameEn: "Major 6th (6)",
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
    nameEs: "Menor Sexta (m6)",
    nameEn: "Minor 6th (m6)",
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

  // =========================================================================
  // 3. TENSIONES (9, 11, 13)
  // =========================================================================
  {
    id: "maj9",
    nameEs: "Mayor Novena (Maj9)",
    nameEn: "Major 9th (Maj9)",
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
    nameEs: "Mayor Treceava (Maj13)",
    nameEn: "Major 13th (Maj13)",
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
    nameEs: "Seis Nueve (6/9)",
    nameEn: "Six Nine (6/9)",
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
    nameEs: "Dominante Novena (9)",
    nameEn: "Dominant 9th (9)",
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
    nameEs: "Dominante Treceava (13)",
    nameEn: "Dominant 13th (13)",
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
    nameEs: "Menor Novena (m9)",
    nameEn: "Minor 9th (m9)",
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
    nameEs: "Menor Onceava (m11)",
    nameEn: "Minor 11th (m11)",
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
    nameEs: "Menor Treceava (m13)",
    nameEn: "Minor 13th (m13)",
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
    nameEs: "Dominante 7sus4",
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
    nameEs: "Dominante 9sus4",
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
    nameEs: "Mayor Add9",
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
    nameEs: "Menor Add9",
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

  // =========================================================================
  // 4. ALTERADOS Y JAZZ
  // =========================================================================
  {
    id: "maj7#11",
    nameEs: "Mayor 7(#11) Lidio",
    nameEn: "Major 7(#11) Lydian",
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
    nameEs: "Dominante 7(b9)",
    nameEn: "Dominant 7(b9)",
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
      "Dominante Disminuida (Semitono - Tono)",
      "Frigia Dominante",
      "Alterada",
    ],
    recommendedScalesEn: [
      "Dominant Diminished (Half - Whole)",
      "Phrygian Dominant",
      "Altered",
    ],
    functionEs: "V7(b9) que resuelve con fuerza hacia un acorde menor o mayor",
    functionEn: "V7(b9) resolving strongly to a minor or major tonic",
  },
  {
    id: "7#9",
    nameEs: "Dominante 7(#9)",
    nameEn: "Dominant 7(#9)",
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
      "Dominante Disminuida (Semitono - Tono)",
      "Escala de Blues",
    ],
    recommendedScalesEn: [
      "Altered (Superlocrian)",
      "Dominant Diminished (Half - Whole)",
      "Blues Scale",
    ],
    functionEs: "Dominante con 9ª aumentada (acorde Hendrix / Jazz Blues)",
    functionEn: "Dominant with augmented 9th (Hendrix / Jazz Blues chord)",
  },
  {
    id: "7#11",
    nameEs: "Dominante 7(#11)",
    nameEn: "Dominant 7(#11)",
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
    nameEs: "Dominante 7(b13)",
    nameEn: "Dominant 7(b13)",
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
      "Mixolidia b6 (Mixolidia b13)",
      "Alterada (Superlocria)",
      "Frigia Dominante",
    ],
    recommendedScalesEn: [
      "Mixolydian b6 (Mixolydian b13)",
      "Altered (Superlocrian)",
      "Phrygian Dominant",
    ],
    functionEs: "Dominante con 13ª menor (6m) ideal para resolver a menor",
    functionEn: "Dominant with flat 13th (6m) ideal for minor resolution",
  },
  {
    id: "alt",
    nameEs: "Dominante Alterado (7alt)",
    nameEn: "Altered Dominant (7alt)",
    symbol: "7alt",
    category: "altered",
    voices: [
      { semitones: 0, intervalLabel: "F" },
      { semitones: 4, intervalLabel: "3M" },
      { semitones: 10, intervalLabel: "7m" },
      { semitones: 15, intervalLabel: "9a" },
      { semitones: 20, intervalLabel: "6m" },
    ],
    recommendedScalesEs: ["Alterada (7º Modo de la Menor Melódica)"],
    recommendedScalesEn: ["Altered Scale (7th Mode of Melodic Minor)"],
    functionEs: "Máxima tensión dominante (F - 3M - 7m - #9 - b13)",
    functionEn: "Maximum dominant tension (F - 3M - 7m - #9 - b13)",
  },
];

interface PianoKeyInfo {
  midi: number; // 48 (C3) a 83 (B5) = 36 teclas (3 octavas completas)
  pc: number;
  octave: number;
  isBlack: boolean;
  whiteIndex: number; // 0 a 20 para teclas blancas; para negras indica la tecla blanca anterior
}

const WHITE_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11];
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

/**
 * Construye las 36 teclas de un teclado profesional de 3 octavas (C3 = MIDI 48 hasta B5 = MIDI 83)
 */
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
  id: number; // 0 = Estado Fundamental, 1 = 1ª Inversión, 2 = 2ª Inversión, 3 = 3ª Inversión, 4 = Voicing 2 Manos (Bajo + Acorde)
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

function shouldUseSharpsForChord(
  root: RootNote,
  voices: ChordVoiceSpec[],
  chordId: string
): boolean {
  if (["Db", "Eb", "F", "Ab", "Bb", "Gb"].includes(root)) return false;
  if (["C#", "D", "D#", "E", "F#", "G", "G#", "A", "A#", "B"].includes(root)) {
    return true;
  }
  // En C: usar sostenidos si tiene #5 (5a), #11 (4a) o #9 (9a), y bemoles si tiene 3m, 5d, 7m, 7d, 9m, 6m
  if (
    chordId.includes("aug") ||
    chordId.includes("#5") ||
    chordId.includes("#11")
  ) {
    return true;
  }
  const hasFlatIntervals = voices.some((v) =>
    ["3m", "5d", "6m", "7m", "7d", "9m"].includes(v.intervalLabel)
  );
  return !hasFlatIntervals;
}

/**
 * Asigna la digitación ergonómica real de piano para Mano Derecha (RH) según la cantidad de notas del acorde
 */
function assignRightHandPianoFingers(midis: number[]): string[] {
  const n = midis.length;
  if (n === 0) return [];
  if (n === 1) return ["1"];
  if (n === 2) return ["1", "3"];
  if (n === 3) {
    // En tríadas: si la distancia entre la 2ª y 3ª nota es mayor que entre la 1ª y 2ª (ej. 1ª inversión: Mi - Sol - Do), usar 1 - 2 - 5; en estado fundamental o 2ª inversión usar 1 - 3 - 5
    const span1 = midis[1] - midis[0];
    const span2 = midis[2] - midis[1];
    return span2 > span1 ? ["1", "2", "5"] : ["1", "3", "5"];
  }
  if (n === 4) {
    const span2 = midis[2] - midis[1];
    const span3 = midis[3] - midis[2];
    return span3 <= 2 ? ["1", "2", "4", "5"] : span2 >= 4 ? ["1", "2", "4", "5"] : ["1", "2", "3", "5"];
  }
  if (n === 5) {
    return ["1", "2", "3", "4", "5"];
  }
  // Si tiene 6 voces, las primeras 5 llevan 1-2-3-4-5
  return midis.map((_, i) => String(Math.min(5, i + 1)));
}

/**
 * Reproduce una nota de Piano Eléctrico / Acústico cálido usando Web Audio API
 */
function playWarmPianoNote(
  freq: number,
  durationSec: number = 1.25,
  delaySec: number = 0,
  volume: number = 0.28
): void {
  const ctx = dictionaryAudio.getContext();
  const dest = dictionaryAudio.getInputNode("piano");
  const start = ctx.currentTime + delaySec;

  const mainOsc = ctx.createOscillator();
  const warmOsc = ctx.createOscillator();
  const chimeOsc = ctx.createOscillator();

  const warmGain = ctx.createGain();
  const chimeGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const masterGain = ctx.createGain();

  mainOsc.type = "triangle";
  mainOsc.frequency.setValueAtTime(freq, start);

  warmOsc.type = "sine";
  warmOsc.frequency.setValueAtTime(freq * 2, start);
  warmGain.gain.setValueAtTime(0.18, start);
  warmGain.gain.exponentialRampToValueAtTime(0.01, start + 0.35);

  chimeOsc.type = "sine";
  chimeOsc.frequency.setValueAtTime(freq * 3, start);
  chimeGain.gain.setValueAtTime(0.06, start);
  chimeGain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(Math.min(3400, freq * 4.5), start);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(380, freq * 1.4),
    start + durationSec * 0.75
  );

  masterGain.gain.setValueAtTime(0.0001, start);
  masterGain.gain.linearRampToValueAtTime(volume, start + 0.012);
  masterGain.gain.exponentialRampToValueAtTime(
    volume * 0.45,
    start + 0.22
  );
  masterGain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);

  mainOsc.connect(filter);
  warmOsc.connect(warmGain);
  warmGain.connect(filter);
  chimeOsc.connect(chimeGain);
  chimeGain.connect(filter);

  filter.connect(masterGain);
  masterGain.connect(dest);

  mainOsc.start(start);
  warmOsc.start(start);
  chimeOsc.start(start);

  mainOsc.stop(start + durationSec + 0.05);
  warmOsc.stop(start + durationSec + 0.05);
  chimeOsc.stop(start + durationSec + 0.05);
}

export default function ScaleDictionary() {
  const { language } = useLanguage();
  const isEs = language === "es";

  const [selectedRoot, setSelectedRoot] = useState<RootNote>("C");
  const [activeCategory, setActiveCategory] = useState<string>("sevenths");
  const [selectedChordId, setSelectedChordId] = useState<string>("maj7");
  const [keyLabelMode, setKeyLabelMode] = useState<KeyLabelMode>("note");
  const [selectedPositionId, setSelectedPositionId] = useState<number>(0);
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
      KEYBOARD_CHORD_CATALOG[6]
    );
  }, [selectedChordId]);

  /**
   * Construye las 5 Posiciones / Inversiones del Acorde en el teclado de 3 octavas (MIDI 48 a 83):
   * - Posición 0: ESTADO FUNDAMENTAL (Fundamental en el bajo)
   * - Posición 1: 1ª INVERSIÓN (3ª en el bajo)
   * - Posición 2: 2ª INVERSIÓN (5ª en el bajo)
   * - Posición 3: 3ª INVERSIÓN (7ª en el bajo, o Octava Superior en tríadas)
   * - Posición 4: VOICING 2 MANOS (Bajo con Mano Izquierda en 1ª octava + Acorde en Mano Derecha)
   */
  const chordPositions = useMemo<ChordVoicingPosition[]>(() => {
    const rootSemi = ROOT_SEMITONES[selectedRoot] ?? 0;
    const useSharps = shouldUseSharpsForChord(
      selectedRoot,
      selectedChordDef.voices,
      selectedChordDef.id
    );
    const namesEs = useSharps ? NOTE_NAMES_SHARP_ES : NOTE_NAMES_FLAT_ES;
    const namesEn = useSharps ? NOTE_NAMES_SHARP_EN : NOTE_NAMES_FLAT_EN;

    // Ubicar la Fundamental base en la primera mitad del teclado (entre C3=48 y B3=59, o C4=60 si queda más centrado)
    const baseRootMidi = 48 + rootSemi;

    // Función que construye una inversión rotando `inversionIndex` veces las voces del acorde
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

      // En acordes de 5 o 6 notas (9, 11, 13), al invertir mantenemos las voces ordenadas de forma ascendente limpia
      const rotatedSpecs: { midi: number; intervalLabel: string; isRoot: boolean }[] =
        [];

      if (inversionIndex === 0) {
        voices.forEach((v) => {
          rotatedSpecs.push({
            midi: baseRootMidi + v.semitones,
            intervalLabel: v.intervalLabel,
            isRoot: v.semitones % 12 === 0,
          });
        });
      } else {
        // Tomar las voces base dentro de una octava [0..11] y rotarlas
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

        // Si en una tríada (3 notas) pide la 3ª Inversión (id === 3), mostrar el Estado Fundamental en la octava central/aguda (+12 semitonos)
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

      // Si alguna nota se pasa de B5 (83), bajar toda la disposición 1 octava (-12) para que quepa 100% dentro del teclado visible
      const maxM = Math.max(...rotatedSpecs.map((s) => s.midi));
      const minM = Math.min(...rotatedSpecs.map((s) => s.midi));
      let octaveShift = 0;
      if (maxM > 83) octaveShift = -12;
      else if (minM < 52 && maxM + 12 <= 79 && inversionIndex === 0 && voices.length <= 4) {
        // Centrar tríadas y cuatríadas en estado fundamental alrededor de C4 (MIDI 60) si caben cómodas
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
          const detail: ActiveKeyDetail = {
            midi: s.midi,
            freq: midiToFreq(s.midi),
            isRoot: s.isRoot,
            noteLabelEs: namesEs[pc],
            noteLabelEn: namesEn[pc],
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

    // Construir Posición 4: VOICING 2 MANOS (Bajo con Fundamental en Mano Izquierda en C3..B3 + Voicing en Mano Derecha en C4..B5)
    const buildTwoHandVoicing = (): ChordVoicingPosition => {
      const bassMidi = 48 + rootSemi; // Siempre en la primera octava (C3 a B3)
      const activeKeysByMidi = new Map<number, ActiveKeyDetail>();
      const orderedNotes: ActiveKeyDetail[] = [];

      // 1. Nota del Bajo (Mano Izquierda - Dedo 5)
      const bassPc = bassMidi % 12;
      const bassDetail: ActiveKeyDetail = {
        midi: bassMidi,
        freq: midiToFreq(bassMidi),
        isRoot: true,
        noteLabelEs: namesEs[bassPc],
        noteLabelEn: namesEn[bassPc],
        intervalLabel: "F",
        fingerLabel: "5",
        hand: "LH",
      };
      activeKeysByMidi.set(bassMidi, bassDetail);
      orderedNotes.push(bassDetail);

      // 2. Voicing de Mano Derecha en la octava central (si tiene más de 4 notas, prioriza 3ª, 7ª y tensiones como un pianista de jazz profesional)
      const rhVoices =
        selectedChordDef.voices.length >= 5
          ? selectedChordDef.voices.filter((v) => v.semitones !== 0)
          : selectedChordDef.voices;

      let prevMidi = Math.max(bassMidi + 7, 58);
      const rhSpecs: { midi: number; intervalLabel: string; isRoot: boolean }[] =
        [];

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
        const detail: ActiveKeyDetail = {
          midi: s.midi,
          freq: midiToFreq(s.midi),
          isRoot: s.isRoot,
          noteLabelEs: namesEs[pc],
          noteLabelEn: namesEn[pc],
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

  // Tocar todas las notas del acorde simultáneamente (con un micro-strum de 35ms muy natural de pianista)
  const handlePlayChordBlock = (
    posToPlay: ChordVoicingPosition = activePosition
  ) => {
    clearPlaybackTimers();
    const notes = posToPlay.orderedNotes;
    if (!notes || notes.length === 0) return;

    const allMidis = new Set(notes.map((n) => n.midi));
    setActivePlayingMidis(allMidis);

    notes.forEach((n, idx) => {
      playWarmPianoNote(n.freq, 1.45, idx * 0.035, 0.24);
    });

    const endId = window.setTimeout(() => {
      setActivePlayingMidis(new Set());
    }, 1250);
    timersRef.current.push(endId);
  };

  // Arpegiar las notas del acorde una por una de grave a agudo
  const handlePlayChordArpeggio = (
    posToPlay: ChordVoicingPosition = activePosition
  ) => {
    clearPlaybackTimers();
    const notes = posToPlay.orderedNotes;
    if (!notes || notes.length === 0) return;

    setIsPlayingArpeggio(true);
    const stepMs = 340;

    notes.forEach((n, idx) => {
      const tId = window.setTimeout(() => {
        setActivePlayingMidis(new Set([n.midi]));
        playWarmPianoNote(n.freq, 0.85, 0, 0.3);
      }, idx * stepMs);
      timersRef.current.push(tId);
    });

    // Al terminar el arpegio, hacer sonar el acorde completo
    const blockStartMs = notes.length * stepMs + 120;
    const blockId = window.setTimeout(() => {
      setActivePlayingMidis(new Set(notes.map((n) => n.midi)));
      notes.forEach((n, i) => {
        playWarmPianoNote(n.freq, 1.2, i * 0.03, 0.22);
      });
    }, blockStartMs);
    timersRef.current.push(blockId);

    const endId = window.setTimeout(() => {
      setIsPlayingArpeggio(false);
      setActivePlayingMidis(new Set());
    }, blockStartMs + 1100);
    timersRef.current.push(endId);
  };

  // Tocar una tecla individual del piano al hacer clic sobre ella
  const handlePlaySingleKey = (midi: number) => {
    clearPlaybackTimers();
    setActivePlayingMidis(new Set([midi]));
    playWarmPianoNote(midiToFreq(midi), 0.9, 0, 0.32);
    const tId = window.setTimeout(() => {
      setActivePlayingMidis(new Set());
    }, 500);
    timersRef.current.push(tId);
  };

  const activeFormulaString = useMemo(
    () =>
      selectedChordDef.voices.map((v) => v.intervalLabel).join(" – "),
    [selectedChordDef]
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

  const useSharpsGlobal = useMemo(
    () =>
      shouldUseSharpsForChord(
        selectedRoot,
        selectedChordDef.voices,
        selectedChordDef.id
      ),
    [selectedRoot, selectedChordDef]
  );

  return (
    <div
      id="scale-dictionary-container"
      className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full select-none items-start"
    >
      {/* =====================================================================
          COLUMNA IZQUIERDA (4 COLS): TÓNICA Y CATÁLOGO DE ACORDES
          ===================================================================== */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        {/* 1. TÓNICA (FUNDAMENTAL) */}
        <div className="bg-[#111217] p-4 rounded-2xl border border-[#1e202b] shadow-xl">
          <div className="flex items-center justify-between mb-3">
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
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSelectedRoot(root)}
                  className={`h-10 rounded-xl border font-mono text-sm font-extrabold transition-colors cursor-pointer ${
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

        {/* 2. DICCIONARIO DE ACORDES A EXPLORAR */}
        <div className="bg-[#111217] p-4 rounded-2xl border border-[#1e202b] shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">
              {isEs ? "TIPO DE ACORDE A EXPLORAR" : "CHORD TYPE TO EXPLORE"}
            </span>
            <span className="text-[10px] font-mono text-[#f25100] font-bold">
              {isEs ? "Inversiones + Voicings" : "Inversions + Voicings"}
            </span>
          </div>

          {/* Buscador rápido */}
          <div className="relative w-full">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              placeholder={
                isEs
                  ? "Buscar acorde (ej. Maj7, m9, 7b9, sus4)..."
                  : "Search chord (e.g. Maj7, m9, 7b9, sus4)..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#161720] border border-[#252736] rounded-xl py-2 pl-8 pr-3 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-[#f25100] transition-colors"
            />
          </div>

          {/* Pestañas de Categoría de Acordes */}
          {!searchQuery && (
            <div className="flex flex-wrap gap-1.5 pb-2 border-b border-[#1c1e28]">
              {KEYBOARD_CHORD_CATEGORIES.map((cat) => {
                const isCatActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer ${
                      isCatActive
                        ? "bg-[#f25100] text-white"
                        : "bg-[#161720] text-zinc-400 hover:text-white border border-[#242634]"
                    }`}
                  >
                    {isEs ? cat.shortEs : cat.shortEn}
                  </button>
                );
              })}
            </div>
          )}

          {/* Lista Vertical de Acordes */}
          <div className="flex flex-col gap-2 max-h-[390px] overflow-y-auto pr-1">
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
                  ch.id.toLowerCase().includes(q)
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
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedChordId(ch.id);
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? "bg-[#f25100] text-white border-[#ff7433] shadow-[0_0_12px_rgba(242,81,0,0.3)]"
                            : "bg-[#161720] text-zinc-200 border-[#232533] hover:border-[#f25100]/50 hover:bg-[#1b1d28]"
                        }`}
                      >
                        <div className="flex items-baseline gap-2 truncate">
                          <span className="text-sm font-black font-mono shrink-0">
                            {selectedRoot}
                            {ch.symbol}
                          </span>
                          <span
                            className={`text-xs font-bold truncate ${
                              isSelected ? "text-orange-100" : "text-zinc-400"
                            }`}
                          >
                            {isEs ? ch.nameEs : ch.nameEn}
                          </span>
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

      {/* =====================================================================
          COLUMNA CENTRAL / DERECHA GRANDE (8 COLS): TECLADO PROFESIONAL
          ===================================================================== */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        <div className="bg-[#111217] p-5 sm:p-6 rounded-2xl border border-[#1e202b] shadow-2xl flex flex-col gap-5">
          {/* Cabecera Superior con geometría fija */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 min-h-[54px]">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-baseline gap-2 truncate">
                  <span className="text-[#f25100]">
                    {selectedRoot}
                    {selectedChordDef.symbol}
                  </span>
                  <span className="truncate text-zinc-200 font-extrabold">
                    · {isEs ? selectedChordDef.nameEs : selectedChordDef.nameEn}
                  </span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-lg bg-[#161720] border border-[#252736] text-[11px] font-mono font-extrabold text-[#f25100] shrink-0">
                  {activePosition.shortBadge}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 truncate">
                {isEs ? activePosition.subtitleEs : activePosition.subtitleEn}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Selector NOTAS | INTERVALOS | DEDOS */}
              <div className="flex items-center bg-[#161720] p-1 rounded-xl border border-[#252736] shrink-0">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setKeyLabelMode("note")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer ${
                    keyLabelMode === "note"
                      ? "bg-[#f25100] text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {isEs ? "NOTAS" : "NOTES"}
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setKeyLabelMode("interval")}
                  title={
                    isEs
                      ? "Mostrar intervalos del acorde (F, 3M, 5J, 7M, 9M...)"
                      : "Show chord intervals (F, 3M, 5J, 7M, 9M...)"
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer ${
                    keyLabelMode === "interval"
                      ? "bg-[#f25100] text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {isEs ? "INTERVALOS" : "INTERVALS"}
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setKeyLabelMode("finger")}
                  title={
                    isEs
                      ? "Mostrar digitación sugerida de piano (1, 2, 3, 4, 5)"
                      : "Show suggested piano fingering (1, 2, 3, 4, 5)"
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer ${
                    keyLabelMode === "finger"
                      ? "bg-[#f25100] text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Hand size={12} />
                  <span>{isEs ? "DEDOS" : "FINGERS"}</span>
                </button>
              </div>

              {/* Botón Principal: TOCAR ACORDE (Bloque Polifónico) */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handlePlayChordBlock(activePosition);
                }}
                className="min-w-[148px] h-10 px-4 rounded-xl bg-[#f25100] hover:bg-[#ff621a] text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_18px_rgba(242,81,0,0.4)] transition-colors cursor-pointer shrink-0"
              >
                <Play size={14} className="fill-current shrink-0" />
                <span>{isEs ? "TOCAR ACORDE" : "PLAY CHORD"}</span>
              </button>

              {/* Botón Secundario: ARPEGIAR */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.currentTarget.blur();
                  if (isPlayingArpeggio) {
                    clearPlaybackTimers();
                  } else {
                    handlePlayChordArpeggio(activePosition);
                  }
                }}
                className="min-w-[118px] h-10 px-3.5 rounded-xl bg-[#161720] hover:bg-[#1f212e] text-zinc-100 border border-[#2d3042] hover:border-[#f25100] font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {isPlayingArpeggio ? (
                  <>
                    <Square size={13} className="fill-current text-[#f25100]" />
                    <span>{isEs ? "DETENER" : "STOP"}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} className="text-[#f25100]" />
                    <span>{isEs ? "ARPEGIAR" : "ARPEGGIATE"}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* =================================================================
              SELECTOR DE ESTADO FUNDAMENTAL, INVERSIONES Y VOICING A 2 MANOS
              ================================================================= */}
          <div className="bg-[#15161e] border border-[#232634] rounded-xl p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Layers size={14} className="text-[#f25100]" />
                {isEs
                  ? " DISPOSICIÓN EN EL TECLADO (ESTADO FUNDAMENTAL, INVERSIONES Y VOICING):"
                  : " KEYBOARD VOICING (ROOT POSITION, INVERSIONS & 2-HAND VOICING):"}
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                {isEs ? "Notas activas: " : "Active notes: "}
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
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setSelectedPositionId(pos.id);
                      handlePlayChordBlock(pos);
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer truncate ${
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

          {/* =================================================================
              TECLADO INTERACTIVO REALISTA DE 3 OCTAVAS (C3 a B5 = 21 BLANCAS + 15 NEGRAS)
              ================================================================= */}
          <div className="w-full bg-[#15161e] border border-[#232634] rounded-2xl p-4 sm:p-6 overflow-x-auto">
            <div className="min-w-[780px] select-none">
              {/* Barra superior de madera/metal del piano con fieltro rojo clásico */}
              <div className="w-full h-3.5 bg-gradient-to-b from-[#232634] to-[#0d0e14] rounded-t-xl border-x border-t border-[#2e3244] relative overflow-hidden">
                <div className="absolute bottom-0 inset-x-0 h-[3px] bg-gradient-to-r from-[#8f1d00] via-[#f25100] to-[#8f1d00] opacity-90" />
              </div>

              {/* Contenedor de las 36 teclas */}
              <div className="relative w-full h-[250px] sm:h-[270px] bg-[#0a0b0f] rounded-b-xl border-x border-b border-[#252838] p-1.5 pt-0 shadow-2xl">
                <div className="relative w-full h-full flex">
                  {/* 21 TECLAS BLANCAS */}
                  {whiteKeys.map((wk) => {
                    const activeDetail = activePosition.activeKeysByMidi.get(
                      wk.midi
                    );
                    const isPlayingNow = activePlayingMidis.has(wk.midi);
                    const isActive = Boolean(activeDetail);
                    const isRoot = activeDetail?.isRoot ?? false;

                    const defaultNoteName = isEs
                      ? (useSharpsGlobal
                          ? NOTE_NAMES_SHARP_ES
                          : NOTE_NAMES_FLAT_ES)[wk.pc]
                      : (useSharpsGlobal
                          ? NOTE_NAMES_SHARP_EN
                          : NOTE_NAMES_FLAT_EN)[wk.pc];

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
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          handlePlaySingleKey(wk.midi);
                        }}
                        title={`${defaultNoteName}${wk.octave}`}
                        className={`relative flex-1 h-full rounded-b-xl border-x border-b transition-all flex flex-col justify-end items-center pb-3 cursor-pointer ${
                          isPlayingNow
                            ? "bg-gradient-to-b from-[#fff3eb] via-[#ffd4b8] to-[#ff9e66] border-[#f25100] translate-y-[2px] shadow-inner"
                            : isActive
                            ? isRoot
                              ? "bg-gradient-to-b from-white via-orange-50 to-orange-100/95 border-zinc-300 shadow-[inset_0_-6px_0_rgba(242,81,0,0.28)]"
                              : "bg-gradient-to-b from-white via-zinc-100 to-zinc-200 border-zinc-300 shadow-[inset_0_-6px_0_rgba(30,32,43,0.2)]"
                            : "bg-gradient-to-b from-[#fcfcfd] via-[#f2f3f7] to-[#e2e4ec] hover:from-white hover:to-[#eceef5] border-zinc-300/90 shadow-[inset_0_-6px_0_rgba(0,0,0,0.12)]"
                        }`}
                      >
                        {/* Marca discreta de octava en cada Do (C3, C4, C5) */}
                        {wk.pc === 0 && !isActive && (
                          <span className="text-[10px] font-mono font-bold text-zinc-400 mb-1">
                            {isEs ? `Do${wk.octave}` : `C${wk.octave}`}
                          </span>
                        )}

                        {/* Indicador circular encendido cuando la tecla pertenece al acorde */}
                        {activeDetail && (
                          <div className="flex flex-col items-center gap-1 z-10">
                            <span className="text-[10px] font-mono font-extrabold text-zinc-600">
                              {secondarySubText}
                            </span>
                            <div
                              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full font-mono text-xs font-black flex items-center justify-center transition-transform ${
                                isPlayingNow
                                  ? "bg-[#090a0d] text-white scale-115 ring-4 ring-[#f25100] shadow-[0_0_16px_#f25100]"
                                  : isRoot
                                  ? "bg-[#f25100] text-white border-2 border-[#ff8c52] shadow-[0_4px_12px_rgba(242,81,0,0.55)]"
                                  : "bg-[#1c1e29] text-white border-2 border-[#3e4259] shadow-md"
                              }`}
                            >
                              {badgeText}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {/* 15 TECLAS NEGRAS POSICIONADAS CON PRECISIÓN GEOMÉTRICA */}
                  {blackKeys.map((bk) => {
                    const activeDetail = activePosition.activeKeysByMidi.get(
                      bk.midi
                    );
                    const isPlayingNow = activePlayingMidis.has(bk.midi);
                    const isActive = Boolean(activeDetail);
                    const isRoot = activeDetail?.isRoot ?? false;

                    // Ancho de cada tecla negra (~3.1% del total) centrado en la unión entre dos teclas blancas
                    const totalWhite = whiteKeys.length; // 21
                    const leftPercent =
                      ((bk.whiteIndex + 1) / totalWhite) * 100;

                    const defaultNoteName = isEs
                      ? (useSharpsGlobal
                          ? NOTE_NAMES_SHARP_ES
                          : NOTE_NAMES_FLAT_ES)[bk.pc]
                      : (useSharpsGlobal
                          ? NOTE_NAMES_SHARP_EN
                          : NOTE_NAMES_FLAT_EN)[bk.pc];

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
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          handlePlaySingleKey(bk.midi);
                        }}
                        title={`${defaultNoteName}${bk.octave}`}
                        style={{
                          left: `${leftPercent}%`,
                          width: "3.25%",
                          transform: "translateX(-50%)",
                        }}
                        className={`absolute top-0 h-[62%] z-20 rounded-b-lg border-x border-b transition-all flex flex-col justify-end items-center pb-2.5 cursor-pointer ${
                          isPlayingNow
                            ? "bg-gradient-to-b from-[#ff7733] to-[#f25100] border-[#ffa375] h-[63%] shadow-[0_0_18px_rgba(242,81,0,0.8)]"
                            : isActive
                            ? isRoot
                              ? "bg-gradient-to-b from-[#3b1c0e] via-[#26130a] to-[#1a0d07] border-[#f25100] shadow-[0_6px_14px_rgba(0,0,0,0.75)]"
                              : "bg-gradient-to-b from-[#2c3040] via-[#1f222e] to-[#14161f] border-[#525870] shadow-[0_6px_14px_rgba(0,0,0,0.75)]"
                            : "bg-gradient-to-b from-[#262833] via-[#171820] to-[#0c0d12] hover:from-[#303342] border-[#07080b] shadow-[0_5px_10px_rgba(0,0,0,0.65),inset_0_-5px_0_rgba(255,255,255,0.06)]"
                        }`}
                      >
                        {activeDetail && (
                          <div className="flex flex-col items-center gap-0.5 z-30">
                            <span className="text-[9px] font-mono font-bold text-orange-200/90">
                              {secondarySubText}
                            </span>
                            <div
                              className={`w-7 h-7 rounded-full font-mono text-[10px] font-black flex items-center justify-center ${
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

            {/* Pie del Teclado: Leyenda + Información */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-[#1e202b] text-xs text-zinc-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2 font-bold">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#f25100] inline-block shadow-[0_0_8px_#f25100]" />
                  {isEs ? "Fundamental (F)" : "Fundamental (F)"}
                </span>
                <span className="flex items-center gap-2 font-bold">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#1c1e29] border border-[#525870] inline-block" />
                  {isEs
                    ? "Voces e Intervalos del Acorde"
                    : "Chord Voices & Intervals"}
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

        {/* TARJETA INFERIOR: ESCALAS COMPATIBLES + ESTRUCTURA DE INTERVALOS */}
        <div className="bg-[#111217] p-5 rounded-2xl border border-[#1e202b] shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <BookOpen size={14} className="text-[#f25100]" />
              {isEs
                ? "FUNCIÓN ARMÓNICA Y ESCALAS COMPATIBLES"
                : "HARMONIC FUNCTION & COMPATIBLE SCALES"}
            </span>
            <p className="text-xs sm:text-sm text-zinc-400">
              {isEs ? selectedChordDef.functionEs : selectedChordDef.functionEn}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {(isEs
                ? selectedChordDef.recommendedScalesEs
                : selectedChordDef.recommendedScalesEn
              ).map((scName) => (
                <span
                  key={scName}
                  className="px-3.5 py-1.5 rounded-xl bg-[#161720] border border-[#252736] text-xs sm:text-sm font-mono font-extrabold text-white"
                >
                  {selectedRoot}{" "}
                  <span className="text-[#f25100]">{scName}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Tarjeta de Fórmula de Intervalos del Acorde */}
          <div className="bg-[#161720] border border-[#252736] rounded-xl px-4 py-3 shrink-0 flex flex-col items-start sm:items-end">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <GitCommit size={13} className="text-[#f25100]" />
              {isEs ? "ESTRUCTURA DE INTERVALOS" : "INTERVAL STRUCTURE"}
            </span>
            <span className="text-sm sm:text-base font-mono font-black text-[#f25100] mt-1">
              {activeFormulaString}
            </span>
            <span className="text-[11px] font-mono text-zinc-400 mt-0.5">
              {isEs ? "Notas: " : "Notes: "}
              <strong className="text-white">{activeNotesSummary}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
