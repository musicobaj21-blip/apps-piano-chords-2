import React, { useState, useEffect, useMemo, Fragment, useRef } from "react";
import * as Tone from "tone";
import { JAZZ_STANDARDS, getSongCategoryGroup } from "../data/songs";
import {
  getGuitarChordVoicing,
  getGuitarChordFrequencies,
  ROOT_DISPLAY_NAME_MAP,
  ROOT_MIDI_OFFSET_MAP,
} from "../data/chords";
import { analyzeSongHarmony, AnalyzedChord, AnalysisCategory, analyzeChord, getHarmonicFunctionClasses } from "../utils/analyzer";
import { parseChord, transposeRoot, transposeChordString, getSuggestedScale, SuggestedScale, isMinorQuality, getChordNotes, buildJazzVoicing } from "../utils/music";
import { playChordFrequencies } from "../utils/audio";
import { interactiveAnalysisAudio } from "../utils/interactiveAnalysisAudio";
import ChordFretboard from "./ChordFretboard";
import ScaleFretboard from "./ScaleFretboard";
import ChordPianoKeyboard from "./ChordPianoKeyboard";
import ScalePianoKeyboard from "./ScalePianoKeyboard";
import { useInstrument } from "../contexts/InstrumentContext";
import Metronome, { MetronomeControls } from "./Metronome";
import {
  getBeatsPerBar,
  DrumStyle,
  detectDrumStyleFromSongStyle,
  getDrumMatrixForBeat,
  getStyleBaseGainMultiplier,
} from "../utils/interactiveRhythmPatterns";
import { generateComping, generateWalkingBass } from "../utils/band";
import {
  LIVE_MIDI_BANKS,
  calculateMusicalVelocity,
  getBankAudioBuffersForOffline,
  scheduleOfflineStudioTrack,
} from "../utils/liveMidiBanks";
import MusicXMLImporter from "./MusicXMLImporter";
import InteractiveAudioTracker from "./InteractiveAudioTracker";
import { Song, SongMeasure, RootNote } from "../types";
import ChordNameInput from "./ChordNameInput";
import { downloadLeadSheetPDF } from "../utils/pdfGenerator";
import { RawMidiNoteInput } from "../utils/scoreTranscription";
import { ScorePreviewModal } from "./ScorePreviewModal";
import { encodeWAV } from "../utils/wavEncoder";
import GlobalMidiKeyboard from "./GlobalMidiKeyboard";
import { getMasterChordSuggestions } from "../utils/chordSuggestions";
import {
  Search,
  Music,
  ArrowLeftRight,
  RotateCcw,
  Plus,
  Minus,
  FileMusic,
  FilePlus,
  Upload,
  Sparkles,
  Volume,
  Edit3,
  Save,
  Trash2,
  X,
  ChevronDown,
  Bookmark,
  FolderOpen,
  FileText,
  Headphones,
  Download,
  Layers,
  Check,
  CheckCircle2,
  Palette,
  Activity,
  GraduationCap,
  Piano,
  Eye,
  Loader2,
} from "lucide-react";

import { ChordInputContext } from "../utils/analyzer";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * Convierte un AudioBuffer (o ToneAudioBuffer de Tone.Offline) en un Blob WAV válido (16-bit PCM o 32-bit Float)
 */
function audioBufferToWav(
  buffer: AudioBuffer | Tone.ToneAudioBuffer,
  opt?: { float32?: boolean }
): Blob {
  const rawBuffer: AudioBuffer =
    buffer && typeof (buffer as any).get === "function"
      ? (buffer as any).get()
      : (buffer as AudioBuffer);

  const options = opt || {};
  const numChannels = rawBuffer.numberOfChannels;
  const sampleRate = rawBuffer.sampleRate;
  const format = options.float32 ? 3 : 1;
  const bitDepth = format === 3 ? 32 : 16;

  let result: Float32Array;
  if (numChannels === 2) {
    result = interleaveWavChannels(rawBuffer.getChannelData(0), rawBuffer.getChannelData(1));
  } else {
    result = rawBuffer.getChannelData(0);
  }

  const wavArrayBuffer = encodeWavBuffer(result, format, sampleRate, numChannels, bitDepth);
  return new Blob([wavArrayBuffer], { type: "audio/wav" });
}

function encodeWavBuffer(
  samples: Float32Array,
  format: number,
  sampleRate: number,
  numChannels: number,
  bitDepth: number
): ArrayBuffer {
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeWavString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeWavString(view, 8, "WAVE");
  writeWavString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeWavString(view, 36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  if (format === 1) {
    floatTo16BitPCM(view, 44, samples);
  } else {
    writeFloat32Samples(view, 44, samples);
  }

  return buffer;
}

function interleaveWavChannels(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function writeFloat32Samples(output: DataView, offset: number, input: Float32Array): void {
  for (let i = 0; i < input.length; i++, offset += 4) {
    output.setFloat32(offset, input[i], true);
  }
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array): void {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function writeWavString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export interface FlattenedMeasure extends SongMeasure {
  measure: SongMeasure;
  originalIndex: number;
  isEndOfPlayback?: boolean;
}

/**
 * Algoritmo de Desenrollado (Flatten Sequence):
 * Función pura que se ejecuta al presionar "Play". Toma el arreglo original de compases
 * y devuelve un NUEVO arreglo lineal, con los compases clonados exactamente en el orden en que deben sonar.
 *
 * Lógica Matemática del Salto:
 * 1. Encuentra el índice donde empieza la repetición (marcador |:, si no hay, asume el índice 0).
 * 2. Encuentra el índice de la casilla 1..
 * 3. Encuentra el índice de la casilla 2..
 *
 * Regla de construcción del arreglo final:
 * A) Empuja los compases desde el inicio hasta el final de la casilla 1..
 * B) VUELVE a empujar los compases desde el inicio (o desde |:) PERO detente exactamente UN compás antes de la casilla 1..
 * C) SALTA la casilla 1 y empuja desde la casilla 2. en adelante hasta el final del tema (o hasta encontrar END).
 */
export function flattenCompasses(compasses: SongMeasure[]): FlattenedMeasure[] {
  if (!compasses || compasses.length === 0) return [];

  const cloneMeasure = (
    m: SongMeasure,
    originalIndex: number,
    isEndOfPlayback: boolean = false
  ): FlattenedMeasure => {
    const cloned: SongMeasure = JSON.parse(JSON.stringify(m));
    return {
      ...cloned,
      measure: cloned,
      originalIndex,
      isEndOfPlayback: isEndOfPlayback || !!m.isEnd,
    };
  };

  // 1. Encuentra el índice de la casilla 1. y casilla 2.
  const volta1StartIndex = compasses.findIndex((m) => m.volta === 1);
  const volta2StartIndex = compasses.findIndex((m) => m.volta === 2);

  // CASO 1: Existen casillas 1. y 2. (Regla Matemática del Salto)
  if (volta1StartIndex !== -1 && volta2StartIndex !== -1 && volta1StartIndex < volta2StartIndex) {
    // 1. Encuentra el índice donde empieza la repetición (marcador |:, si no hay, asume el índice 0)
    const repeatStartIdx = compasses.findIndex((m) => !!m.repeatStart);
    let repeatStartIndex = repeatStartIdx !== -1 ? repeatStartIdx : 0;
    if (repeatStartIndex >= volta1StartIndex) {
      repeatStartIndex = 0;
    }

    // Encuentra el final de la casilla 1 (último compás consecutivo con volta === 1)
    let volta1EndIndex = volta1StartIndex;
    while (
      volta1EndIndex + 1 < compasses.length &&
      compasses[volta1EndIndex + 1].volta === 1 &&
      volta1EndIndex + 1 < volta2StartIndex
    ) {
      volta1EndIndex++;
    }

    const result: FlattenedMeasure[] = [];

    // A) Empuja los compases desde el inicio hasta el final de la casilla 1..
    for (let i = 0; i <= volta1EndIndex; i++) {
      const isEnd = !!compasses[i].isEnd;
      result.push(cloneMeasure(compasses[i], i, isEnd));
      if (isEnd) return result;
    }

    // B) VUELVE a empujar los compases desde el inicio (o desde |:) PERO detente exactamente UN compás antes de la casilla 1..
    for (let i = repeatStartIndex; i < volta1StartIndex; i++) {
      const isEnd = !!compasses[i].isEnd;
      result.push(cloneMeasure(compasses[i], i, isEnd));
      if (isEnd) return result;
    }

    // C) SALTA la casilla 1 y empuja desde la casilla 2. en adelante hasta el final del tema (o hasta encontrar END).
    for (let i = volta2StartIndex; i < compasses.length; i++) {
      const isEnd = !!compasses[i].isEnd;
      result.push(cloneMeasure(compasses[i], i, isEnd));
      if (isEnd) break;
    }

    return result;
  }

  // CASO 2: Solo repeticiones estándar (|: y :|) sin casillas
  const repeatEndIdx = compasses.findIndex((m) => !!m.repeatEnd);
  if (repeatEndIdx !== -1) {
    const repeatStartIdx = compasses.findIndex((m) => !!m.repeatStart);
    let repeatStartIndex = repeatStartIdx !== -1 ? repeatStartIdx : 0;
    if (repeatStartIndex > repeatEndIdx) repeatStartIndex = 0;

    const result: FlattenedMeasure[] = [];
    // Pase 1: desde 0 hasta repeatEndIdx
    for (let i = 0; i <= repeatEndIdx; i++) {
      const isEnd = !!compasses[i].isEnd;
      result.push(cloneMeasure(compasses[i], i, isEnd));
      if (isEnd) return result;
    }
    // Pase 2: repite desde repeatStartIndex hasta repeatEndIdx
    for (let i = repeatStartIndex; i <= repeatEndIdx; i++) {
      const isEnd = !!compasses[i].isEnd;
      result.push(cloneMeasure(compasses[i], i, isEnd));
      if (isEnd) return result;
    }
    // Resto del tema desde repeatEndIdx + 1 hasta el final
    for (let i = repeatEndIdx + 1; i < compasses.length; i++) {
      const isEnd = !!compasses[i].isEnd;
      result.push(cloneMeasure(compasses[i], i, isEnd));
      if (isEnd) break;
    }
    return result;
  }

  // CASO 3: Progresión lineal sin repeticiones (hasta el final o hasta END)
  const result: FlattenedMeasure[] = [];
  for (let i = 0; i < compasses.length; i++) {
    const isEnd = !!compasses[i].isEnd;
    result.push(cloneMeasure(compasses[i], i, isEnd));
    if (isEnd) break;
  }
  return result;
}

// Alias para compatibilidad hacia atrás
export const linearizeSongMeasures = flattenCompasses;

/**
 * Procesa y alimenta el secuenciador exclusivamente a partir del arreglo que devuelve flattenCompasses()
 */
export function buildSongPlaybackSequence(
  song: Song | null,
  transposition: number,
  globalKey: string
) {
  if (!song) return [];
  let flatIdx = 0;
  const seq: any[] = [];
  const flattened = flattenCompasses(song.measures || []);
  // Estructura completa de slots de acordes del compás inmediatamente anterior
  let lastResolvedMeasureSlots: string[] = [];
  // Memoria de conducción de voces suave (Smooth Voice Leading Tipo A / Tipo B) entre compases
  let previousVoicingMidis: number[] | null = null;

  flattened.forEach((entry) => {
    const measure = entry.measure || entry;
    const beatsPerMeasure = getBeatsPerBar(song.timeSignature || "4/4");
    const rawChordsInput = (measure.chords && measure.chords.length > 0) ? measure.chords : [''];
    
    // Clonación Estructural del Compás Completo para el símbolo %:
    // Si el compás contiene el símbolo de repetición '%', o el primer slot es '%',
    // el secuenciador NO debe tomar únicamente el primer acorde o un acorde extendido,
    // sino clonar estructuralmente la matriz de acordes (los slots) completa del compás inmediatamente anterior.
    // Ej: Compás N-1: ["Am", "G"] (2 slots) -> Compás N con [%] se resuelve como ["Am", "G"] con 2 slots y sus respectivas subdivisiones.
    const isMeasureFullSimile = rawChordsInput.length === 1 && (
      rawChordsInput[0] === '%' ||
      (typeof rawChordsInput[0] === 'object' && ((rawChordsInput[0] as any)?.chordName === '%' || (rawChordsInput[0] as any)?.name === '%'))
    );

    let effectiveMeasureChords: any[] = rawChordsInput;
    let isClonedFromPrevMeasure = false;

    if (isMeasureFullSimile && lastResolvedMeasureSlots.length > 0) {
      effectiveMeasureChords = [...lastResolvedMeasureSlots];
      isClonedFromPrevMeasure = true;
    }

    const slotCount = effectiveMeasureChords.length <= 1 ? 1 : effectiveMeasureChords.length === 2 ? 2 : 4;
    const lengthPerChord = beatsPerMeasure / slotCount;

    const resolvedChordsThisMeasure: string[] = [];

    // Índice plano del compás en la partitura estática para el resaltado visual
    const staticMeasureBaseIdx = (song.measures || [])
      .slice(0, entry.originalIndex)
      .reduce((acc, m) => {
        const mChords = (m.chords && m.chords.length > 0) ? m.chords : [''];
        return acc + (mChords.length <= 1 ? 1 : mChords.length === 2 ? 2 : 4);
      }, 0);

    for (let sIdx = 0; sIdx < slotCount; sIdx++) {
      const rawChord = effectiveMeasureChords[sIdx] || '';
      const actualChordName = typeof rawChord === 'string' ? rawChord : ((rawChord as any)?.chordName || (rawChord as any)?.name || (rawChord as any)?.text || '');
      const isSimile = actualChordName === '%' || isClonedFromPrevMeasure;

      // Símbolo % (Simile): Si el slot actual es %, el motor clona el slot correspondiente
      // del compás inmediatamente anterior o busca hacia atrás el último acorde válido.
      let chordToPlay = actualChordName;
      if (actualChordName === '%') {
        if (lastResolvedMeasureSlots.length > 0) {
          chordToPlay = lastResolvedMeasureSlots[sIdx] || lastResolvedMeasureSlots[lastResolvedMeasureSlots.length - 1];
        } else if (resolvedChordsThisMeasure.length > 0 && sIdx > 0) {
          chordToPlay = resolvedChordsThisMeasure[sIdx - 1];
        } else {
          for (let k = seq.length - 1; k >= 0; k--) {
            const prev = seq[k]?.resolvedChord;
            if (prev && prev !== '%' && prev.trim() !== '') {
              chordToPlay = prev;
              break;
            }
          }
        }
        if (!chordToPlay || chordToPlay === '%') chordToPlay = 'C';
      }
      resolvedChordsThisMeasure.push(chordToPlay);

      const transposed = (chordToPlay && chordToPlay !== '%') ? transposeChordString(chordToPlay, transposition, globalKey) : (chordToPlay || '');
      const parsed = (chordToPlay && chordToPlay !== '%') ? parseChord(transposed) : { root: '', type: '', suffix: '' };
      
      // Resolver Voicing de Jazz Profesional de 4 notas (Tipo A / Tipo B) con Conducción de Voces Suave
      let frequencies: number[] = [];
      let voicingMidis: number[] = [];
      if (parsed.root) {
        voicingMidis = buildJazzVoicing(transposed, previousVoicingMidis);
        previousVoicingMidis = voicingMidis;
        frequencies = voicingMidis.map(m => 440 * Math.pow(2, (m - 69) / 12));
      }

      const isLastChordOfMeasure = sIdx === slotCount - 1;
      const isLastItem = !!(entry.isEndOfPlayback && isLastChordOfMeasure);

      seq.push({
        globalChordIndex: flatIdx,
        originalFlatIndex: staticMeasureBaseIdx + (isClonedFromPrevMeasure ? 0 : sIdx),
        frequencies,
        voicingMidis,
        beatsLength: lengthPerChord,
        chordString: transposed,
        originalString: isClonedFromPrevMeasure ? '%' : actualChordName,
        resolvedChord: chordToPlay,
        isSimile,
        isEndMarker: !!measure.isEnd,
        isEndOfPlayback: isLastItem,
        globalKey,
        parsedRoot: parsed.root,
        parsedType: parsed.type,
        measureIndex: entry.originalIndex,
      });
      flatIdx++;
    }

    lastResolvedMeasureSlots = resolvedChordsThisMeasure;
  });

  return seq;
}

export default function JazzStandards({ isVisible = true }: { isVisible?: boolean } = {}) {
  const { instrument, setInstrument } = useInstrument();
  const { t } = useLanguage();
  const [selectedSongId, setSelectedSongId] = useState(() => {
    const initial = sessionStorage.getItem("initialStandard");
    if (initial) {
      sessionStorage.removeItem("initialStandard");
      return initial;
    }
    return "autumn-leaves";
  });
  const [songSearchQuery, setSongSearchQuery] = useState("");
  const [transposition, setTransposition] = useState(0); // in semitones (-11 to +11)
  const [showAnalysis, setShowAnalysis] = useState(true); // default to true to show analysis

  const sanitizeChordString = (chord: string): string => {
    if (!chord || typeof chord !== 'string') return chord;
    return chord.replace(/alt$/i, "");
  };

  const sanitizeSongs = (songList: Song[]): Song[] => {
    return songList.map((song) => ({
      ...song,
      measures: (song.measures || []).map((m) => ({
        ...m,
        chords: (m.chords || []).map(sanitizeChordString),
      })),
    }));
  };

  const [allSongs, setAllSongs] = useState<Song[]>(() => {
    try {
      // Limpiar listas obsoletas de sesiones previas para garantizar que JAZZ_STANDARDS sea la única verdad
      localStorage.removeItem("allSongsList");

      const saved = localStorage.getItem("customSongs");
      const parsedCustom = saved ? JSON.parse(saved) : [];
      const standardIds = new Set(JAZZ_STANDARDS.map((s: Song) => s.id));
      const validCustom = Array.isArray(parsedCustom)
        ? parsedCustom.filter((s: Song) => s?.isCustom && !standardIds.has(s.id))
        : [];
      return sanitizeSongs([...JAZZ_STANDARDS, ...validCustom]);
    } catch (e) {
      console.error("Error parsing songs from localStorage", e);
      return sanitizeSongs([...JAZZ_STANDARDS]);
    }
  });

  useEffect(() => {
    const customOnly = allSongs.filter((s) => s.isCustom);
    localStorage.setItem("customSongs", JSON.stringify(customOnly));
  }, [allSongs]);

  useEffect(() => {
    const handleSelectStandard = (e: CustomEvent) => {
      setSelectedSongId(e.detail);
    };
    window.addEventListener("selectStandard", handleSelectStandard as EventListener);
    return () => {
      window.removeEventListener("selectStandard", handleSelectStandard as EventListener);
    };
  }, []);
  
  // Teacher mode specific state
  const [isEditMode, setIsEditMode] = useState(false);
  const [showResourcePalette, setShowResourcePalette] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showChordModal, setShowChordModal] = useState(false);
  const [showScaleModal, setShowScaleModal] = useState(false);

  /**
   * Herramienta de Exportación de Desarrollo:
   * Permite ejecutar exportarCatalogo() desde la consola del navegador y emite
   * un console.log automático al cargar con el JSON formateado del catálogo actual.
   */
  useEffect(() => {
    const exportarCatalogo = () => {
      const jsonStr = JSON.stringify(allSongs, null, 2);
      console.log("=== CATÁLOGO ACTUAL DE CANCIONES (JSON) ===");
      console.log(jsonStr);
      console.log("============================================");
      return jsonStr;
    };

    const restablecerCatalogoBase = () => {
      localStorage.removeItem("allSongsList");
      localStorage.removeItem("customSongs");
      setAllSongs(sanitizeSongs([...JAZZ_STANDARDS]));
      console.log("=== Catálogo restablecido al archivo base JAZZ_STANDARDS ===");
    };

    (window as any).exportarCatalogo = exportarCatalogo;
    (window as any).restablecerCatalogoBase = restablecerCatalogoBase;
    console.log("[Dev Tool] Para exportar el catálogo actual, escribe en la consola: exportarCatalogo()");
    console.log(JSON.stringify(allSongs, null, 2));

    return () => {
      delete (window as any).exportarCatalogo;
      delete (window as any).restablecerCatalogoBase;
    };
  }, [allSongs]);
  const [customAnalyses, setCustomAnalyses] = useState<Record<string, { numeral: string, category: AnalysisCategory, groupWithNext?: boolean }>>({});
  const [editingCell, setEditingCell] = useState<{
    key: string;
    flatIndex: number;
    numeral: string;
    category: AnalysisCategory;
    groupWithNext: boolean;
    rect?: DOMRect;
  } | null>(null);

  // Track the chord that is currently clicked and loaded in the guitar fretboard
  const [focusedChord, setFocusedChord] = useState<{
    originalString: string;
    transposedString: string;
    analysisContext: AnalyzedChord | null;
    flatIndex?: number;
  } | null>(null);

  // Get active song
  const currentSong = useMemo(() => {
    return (
      allSongs.find((s) => s.id === selectedSongId) || allSongs[0]
    );
  }, [selectedSongId, allSongs]);

  // Determina si el usuario ha seleccionado "+ Hoja en Blanco" o una progresión personalizada
  const isHojaEnBlanco = Boolean(currentSong.id.startsWith("custom-") || currentSong.isCustom);
  const isCustomSong = isHojaEnBlanco || isEditMode;

  // Estado para el Estilo Rítmico de Batería (Groove) sincronizado globalmente
  const [activeDrumStyle, setActiveDrumStyle] = useState<DrumStyle>(() => detectDrumStyleFromSongStyle(currentSong?.style));

  useEffect(() => {
    if (currentSong?.style) {
      setActiveDrumStyle(detectDrumStyleFromSongStyle(currentSong.style));
    }
  }, [currentSong?.id, currentSong?.style]);

  // Estado para la Paleta de Recursos Global (iReal Pro Toolbar)
  const [selectedMeasureIndex, setSelectedMeasureIndex] = useState<number | null>(0);
  const [selectedChordSlotIndex, setSelectedChordSlotIndex] = useState<number>(0);
  const [quickChordInput, setQuickChordInput] = useState<string>("");

  // Sincronizar quickChordInput con el compás y slot seleccionados
  useEffect(() => {
    if (selectedMeasureIndex !== null && currentSong?.measures?.[selectedMeasureIndex]) {
      const m = currentSong.measures[selectedMeasureIndex];
      const chords = m.chords || [];
      const currentSlotVal = chords[selectedChordSlotIndex] ?? chords[0] ?? '';
      const chordName = typeof currentSlotVal === 'string' ? currentSlotVal : ((currentSlotVal as any)?.chordName || '');
      setQuickChordInput(chordName);
    }
  }, [selectedMeasureIndex, selectedChordSlotIndex, currentSong]);

  // Handle updating chord names in a specific slot
  const handleUpdateChordName = (measureIndex: number, chordIndex: number, newChord: string) => {
    let trimmed = sanitizeChordString(newChord.trim());
    let newSongObject = JSON.parse(JSON.stringify(currentSong)) as Song;
    if (!newSongObject.measures || !newSongObject.measures[measureIndex]) return;

    if (!newSongObject.measures[measureIndex].chords) {
      newSongObject.measures[measureIndex].chords = [''];
    }

    let chordStr = trimmed;
    if (trimmed && transposition !== 0) {
      chordStr = transposeChordString(trimmed, -transposition, globalKey);
    }

    newSongObject.measures[measureIndex].chords[chordIndex] = sanitizeChordString(chordStr);
    newSongObject.isCustom = true;

    setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSongObject : s));

    // Actualizar estado visual del acorde enfocado y reproducir preescucha solo cuando se aplica/cambia un acorde
    const flatIdx = (measureFlatIndices[measureIndex] ?? 0) + chordIndex;
    const analysisCtx = analyzedMeasures[measureIndex]?.[chordIndex];
    handleChordClick(chordStr, analysisCtx, flatIdx, false);
    if (trimmed && trimmed !== '%') {
      playChord(trimmed);
    }
  };

  // Subdivisión de Acordes (Ritmo Armónico: 1, 2 o 4 casilleros)
  const handleSetMeasureSubdivision = (count: 1 | 2 | 4) => {
    const targetIdx = selectedMeasureIndex ?? 0;
    let newSongObject = JSON.parse(JSON.stringify(currentSong)) as Song;
    if (!newSongObject.measures || !newSongObject.measures[targetIdx]) return;

    const currentChords = (newSongObject.measures[targetIdx].chords || []).map((c: any) =>
      typeof c === 'string' ? c : (c?.chordName || '')
    );

    let newChords: string[] = [];
    if (count === 1) {
      newChords = [currentChords[0] || ''];
    } else if (count === 2) {
      newChords = [
        currentChords[0] || '',
        currentChords[1] || ''
      ];
    } else if (count === 4) {
      newChords = [
        currentChords[0] || '',
        currentChords[1] || '',
        currentChords[2] || '',
        currentChords[3] || ''
      ];
    }

    newSongObject.measures[targetIdx].chords = newChords;
    newSongObject.isCustom = true;
    setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSongObject : s));
    if (selectedChordSlotIndex >= count) {
      setSelectedChordSlotIndex(count - 1);
    }
  };

  // 1. Eliminar compás
  const handleDeleteMeasure = (measureIndex: number) => {
    let newSongObject = JSON.parse(JSON.stringify(currentSong)) as Song;
    if (!newSongObject.measures) newSongObject.measures = [];

    if (newSongObject.measures.length <= 1) {
      newSongObject.measures[0] = {
        id: `m-1-${Date.now()}`,
        chords: ['']
      };
    } else {
      newSongObject.measures.splice(measureIndex, 1);
    }

    // Reajustar índices de secciones desplazadas
    if (newSongObject.sections) {
      const updatedSections: { [key: string]: number } = {};
      for (const [secKey, secIdx] of Object.entries(newSongObject.sections)) {
        if (secIdx === measureIndex) {
          if (measureIndex < newSongObject.measures.length) {
            updatedSections[secKey] = measureIndex;
          }
        } else if (secIdx > measureIndex) {
          updatedSections[secKey] = secIdx - 1;
        } else {
          updatedSections[secKey] = secIdx;
        }
      }
      newSongObject.sections = Object.keys(updatedSections).length > 0 ? updatedSections : undefined;
    }

    newSongObject.isCustom = true;
    setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSongObject : s));
    const maxIdx = Math.max(0, (newSongObject.measures.length || 1) - 1);
    setSelectedMeasureIndex(Math.min(measureIndex, maxIdx));
  };

  // Atajo de Teclado nativo (Delete / Backspace) para eliminar el compás activo en la Hoja en Blanco
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (document.getElementById("piano-roll-modal-backdrop")) return;
      // Si hay una pista o clip seleccionado en el DAW, no borrar compases de la grilla
      if ((window as any).__linusHasSelectedDawItem) return;

      // Prevención de bugs: no activar si el usuario está editando un input, textarea o elemento con contentEditable
      const activeEl = document.activeElement as HTMLElement | null;
      const target = e.target as HTMLElement | null;
      const isInputOrTextarea =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        activeEl?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isInputOrTextarea) return;

      // Si no estamos en la Hoja en Blanco o no hay compás seleccionado, no hacer nada
      if (isCustomSong && selectedMeasureIndex !== null) {
        e.preventDefault();
        handleDeleteMeasure(selectedMeasureIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCustomSong, selectedMeasureIndex, currentSong]);

  // Atajo de Teclado global (Barra Espaciadora): Alternar exclusivamente Play/Stop de la reproducción (Tone.js)
  useEffect(() => {
    const isTextInputElement = (el: HTMLElement | null): boolean => {
      if (!el) return false;
      if (el.tagName === "TEXTAREA" || el.isContentEditable) return true;
      if (el.tagName === "INPUT") {
        const type = ((el as HTMLInputElement).type || "text").toLowerCase();
        return type !== "range" && type !== "checkbox" && type !== "radio" && type !== "button";
      }
      return false;
    };

    const handleSpaceKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        const activeEl = document.activeElement as HTMLElement | null;
        const target = e.target as HTMLElement | null;

        if (isTextInputElement(activeEl) || isTextInputElement(target)) return;

        // Bloquear INMEDIATAMENTE el comportamiento nativo del navegador que hace clic en el botón con foco
        e.preventDefault();
        e.stopPropagation();

        if (activeEl && typeof activeEl.blur === "function") {
          activeEl.blur();
        }

        if (e.repeat) return;

        // Alternar Play/Stop: si está reproduciendo, detiene/pausa; si está detenido, inicia reproducción
        if (metronomeControlRef.current) {
          metronomeControlRef.current.togglePlayback();
        } else {
          const btn = document.getElementById("metronome-toggle-btn");
          if (btn) {
            btn.click();
          }
        }
      }
    };

    const handleSpaceKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        const activeEl = document.activeElement as HTMLElement | null;
        const target = e.target as HTMLElement | null;
        if (!isTextInputElement(activeEl) && !isTextInputElement(target)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    window.addEventListener("keydown", handleSpaceKeyDown, { capture: true });
    window.addEventListener("keyup", handleSpaceKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleSpaceKeyDown, { capture: true });
      window.removeEventListener("keyup", handleSpaceKeyUp, { capture: true });
    };
  }, []);

  // 2. Conmutar barra de repetición inicio |:
  const handleToggleRepeatStart = (measureIndex: number) => {
    let newSongObject = JSON.parse(JSON.stringify(currentSong)) as Song;
    if (newSongObject.measures && newSongObject.measures[measureIndex]) {
      newSongObject.measures[measureIndex].repeatStart = !newSongObject.measures[measureIndex].repeatStart;
      newSongObject.isCustom = true;
      setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSongObject : s));
    }
  };

  // 3. Conmutar barra de repetición fin :|
  const handleToggleRepeatEnd = (measureIndex: number) => {
    let newSongObject = JSON.parse(JSON.stringify(currentSong)) as Song;
    if (newSongObject.measures && newSongObject.measures[measureIndex]) {
      newSongObject.measures[measureIndex].repeatEnd = !newSongObject.measures[measureIndex].repeatEnd;
      newSongObject.isCustom = true;
      setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSongObject : s));
    }
  };

  // 4. Asignar o conmutar etiqueta de sección ([A], [B], [Intro], etc.)
  const handleToggleSection = (label: string) => {
    const targetIdx = selectedMeasureIndex ?? 0;
    let newSongObject = JSON.parse(JSON.stringify(currentSong)) as Song;
    if (!newSongObject.measures || !newSongObject.measures[targetIdx]) return;

    const currentLabel = newSongObject.measures[targetIdx].sectionLabel;
    const formatted = `[${label.replace(/^\[|\]$/g, '')}]`;

    if (currentLabel === formatted) {
      newSongObject.measures[targetIdx].sectionLabel = undefined;
      if (newSongObject.sections) {
        for (const [k, v] of Object.entries(newSongObject.sections)) {
          if (v === targetIdx) delete newSongObject.sections[k];
        }
      }
    } else {
      newSongObject.measures[targetIdx].sectionLabel = formatted;
      if (!newSongObject.sections) newSongObject.sections = {};
      newSongObject.sections[label.replace(/^\[|\]$/g, '')] = targetIdx;
    }

    newSongObject.isCustom = true;
    setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSongObject : s));
    if (selectedMeasureIndex === null) setSelectedMeasureIndex(0);
  };

  // 5. Quitar etiqueta de sección
  const handleClearSection = () => {
    if (selectedMeasureIndex === null) return;
    let newSongObject = JSON.parse(JSON.stringify(currentSong)) as Song;
    if (!newSongObject.measures || !newSongObject.measures[selectedMeasureIndex]) return;

    newSongObject.measures[selectedMeasureIndex].sectionLabel = undefined;
    if (newSongObject.sections) {
      for (const [k, v] of Object.entries(newSongObject.sections)) {
        if (v === selectedMeasureIndex) delete newSongObject.sections[k];
      }
    }

    newSongObject.isCustom = true;
    setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSongObject : s));
  };

  // 6. Conmutar casilla de repetición (Volta 1. o 2.)
  const handleToggleVolta = (measureIndex: number, voltaNum: 1 | 2) => {
    let newSongObject = JSON.parse(JSON.stringify(currentSong)) as Song;
    if (newSongObject.measures && newSongObject.measures[measureIndex]) {
      const currentVolta = newSongObject.measures[measureIndex].volta;
      newSongObject.measures[measureIndex].volta = currentVolta === voltaNum ? undefined : voltaNum;
      newSongObject.isCustom = true;
      setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSongObject : s));
    }
  };

  // 7. Conmutar marcador de fin de tema (END)
  const handleToggleEnd = (measureIndex: number) => {
    let newSongObject = JSON.parse(JSON.stringify(currentSong)) as Song;
    if (newSongObject.measures && newSongObject.measures[measureIndex]) {
      newSongObject.measures[measureIndex].isEnd = !newSongObject.measures[measureIndex].isEnd;
      newSongObject.isCustom = true;
      setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSongObject : s));
    }
  };

  // 8. Añadir compás después del seleccionado
  const handleAddMeasureAfter = (measureIndex: number | null) => {
    let newSongObject = JSON.parse(JSON.stringify(currentSong)) as Song;
    if (!newSongObject.measures) newSongObject.measures = [];

    const newMeasure: SongMeasure = {
      id: `m-${Date.now()}`,
      chords: [''],
    };

    const insertIdx = measureIndex !== null ? measureIndex + 1 : newSongObject.measures.length;
    newSongObject.measures.splice(insertIdx, 0, newMeasure);

    if (newSongObject.sections) {
      const updatedSections: { [key: string]: number } = {};
      for (const [secKey, secIdx] of Object.entries(newSongObject.sections)) {
        if (secIdx >= insertIdx) {
          updatedSections[secKey] = secIdx + 1;
        } else {
          updatedSections[secKey] = secIdx;
        }
      }
      newSongObject.sections = updatedSections;
    }

    newSongObject.isCustom = true;
    setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSongObject : s));
    setSelectedMeasureIndex(insertIdx);
    setSelectedChordSlotIndex(0);
  };

  // Referencia para el selector de archivos oculto (.linus / .json)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Referencias y estados para Transporte, Grabación de Audio y Menús de Exportación
  const metronomeControlRef = useRef<MetronomeControls | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const pcmChunksLRef = useRef<Float32Array[]>([]);
  const pcmChunksRRef = useRef<Float32Array[]>([]);
  const audioCaptureNodesRef = useRef<{
    source: MediaStreamAudioSourceNode;
    processor: ScriptProcessorNode;
    silentGain: GainNode;
  } | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportToastMessage, setExportToastMessage] = useState<string | null>(null);
  const [isQuickChordDropdownOpen, setIsQuickChordDropdownOpen] = useState(false);
  const quickChordInputRef = useRef<HTMLDivElement>(null);

  const triggerExportToast = (msg: string) => {
    setExportToastMessage(msg);
    setTimeout(() => {
      setExportToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Cerrar autocompletado al hacer clic afuera
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (quickChordInputRef.current && !quickChordInputRef.current.contains(e.target as Node)) {
        setIsQuickChordDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Limpieza estricta de memoria (Cleanup) de Web Audio API y grabación al desmontar el módulo
  useEffect(() => {
    return () => {
      if (audioCaptureNodesRef.current) {
        try {
          audioCaptureNodesRef.current.source.disconnect();
          audioCaptureNodesRef.current.processor.disconnect();
          audioCaptureNodesRef.current.silentGain.disconnect();
        } catch (_) {}
        audioCaptureNodesRef.current = null;
      }
      isRecordingRef.current = false;
      pcmChunksLRef.current = [];
      pcmChunksRRef.current = [];

      if (metronomeControlRef.current && metronomeControlRef.current.isPlaying()) {
        try {
          metronomeControlRef.current.stop();
        } catch (_) {}
      }

      interactiveAnalysisAudio.stopAll();

      const ctx = interactiveAnalysisAudio.getAudioContext();
      if (ctx && ctx.state === "running") {
        ctx.suspend().catch(() => {});
      }
    };
  }, []);

  // Referencia y estado sincronizados con las pistas del DAW para exportación/importación (.linus) y Mezclador
  const [dawTracks, setDawTracks] = useState<any[]>([]);
  const dawTracksRef = useRef<any[]>([]);
  const handleDawTracksChange = React.useCallback((tracks: any[]) => {
    dawTracksRef.current = tracks;
    setDawTracks(tracks);
  }, []);

  // 1. Exportar Sesión (Guardar archivo .linus con Estado Completo: Grilla de Acordes + Pistas DAW)
  const handleExportSession = () => {
    try {
      const rawDawTracks =
        typeof (window as any).__linusGetDawTracks === "function"
          ? (window as any).__linusGetDawTracks()
          : dawTracksRef.current;

      const mappedTracks = Array.isArray(rawDawTracks)
        ? rawDawTracks.map((t: any) => {
            const trackClips =
              Array.isArray(t.clips) && t.clips.length > 0
                ? t.clips
                : Array.isArray(t.regions)
                ? t.regions
                : [];
            const recordedNotes =
              Array.isArray(t.recordedNotes) && t.recordedNotes.length > 0
                ? t.recordedNotes
                : trackClips.flatMap((c: any) => (Array.isArray(c?.notes) ? c.notes : []));

            return {
              id: t.id,
              number: t.number,
              name: t.name,
              type: t.type,
              bankId: t.bankId || "",
              instrument: t.instrument || "Sin instrumento",
              accentColor: t.accentColor,
              volume: typeof t.volume === "number" ? t.volume : 1.0,
              volumeDb: t.volumeDb || "0.0 dB",
              pan: t.pan || "C",
              isMuted: Boolean(t.isMuted),
              isSolo: Boolean(t.isSolo),
              isArmed: Boolean(t.isArmed),
              clips: trackClips,
              regions: trackClips,
              recordedNotes,
            };
          })
        : [];

      const sessionData = {
        app: "Linus Harmony Pro",
        version: "2.0",
        format: "linus-session",
        exportedAt: new Date().toISOString(),
        id: currentSong.id,
        title: currentSong.title || "Mi Nueva Progresión",
        style: currentSong.style || "Swing",
        activeDrumStyle: activeDrumStyle || currentSong.style || "Jazz Swing",
        tempo: currentSong.tempo || 120,
        timeSignature: currentSong.timeSignature || "4/4",
        defaultKey: currentSong.defaultKey || "C",
        transposition: transposition || 0,
        sections: currentSong.sections || { "A": 0 },
        measures: currentSong.measures || [],
        tracks: mappedTracks,
      };

      const jsonString = JSON.stringify(sessionData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "nueva-sesion.linus";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al exportar la sesión .linus:", error);
    }
  };

  const [pdfExportSuccess, setPdfExportSuccess] = useState(false);
  const [isExportingWav, setIsExportingWav] = useState(false);
  const [selectedScoreTrackId, setSelectedScoreTrackId] = useState<string>("");
  const [isScorePreviewModalOpen, setIsScorePreviewModalOpen] = useState(false);

  // Obtener las pistas MIDI de usuario disponibles para transcripción a pentagrama
  const getUserMidiTracksForScore = () => {
    const rawDawTracks =
      typeof (window as any).__linusGetDawTracks === "function"
        ? (window as any).__linusGetDawTracks()
        : dawTracksRef.current.length > 0
        ? dawTracksRef.current
        : dawTracks;
    if (!Array.isArray(rawDawTracks)) return [];
    return rawDawTracks.filter(
      (t: any) =>
        t &&
        t.id !== "band-harmony" &&
        t.id !== "band-bass" &&
        t.id !== "band-drums"
    );
  };

  const extractTrackNotesForScore = (track: any): RawMidiNoteInput[] => {
    if (!track) return [];
    const bpmVal = Math.max(20, currentSong?.tempo || 120);
    const secPerBeat = 60 / bpmVal;
    const tsParts = String(currentSong?.timeSignature || "4/4").trim().split("/");
    const tsNum = Math.max(1, parseInt(tsParts[0], 10) || 4);
    const tsDen = parseInt(tsParts[1], 10) === 8 ? 8 : 4;
    const barLengthInBeats = tsDen === 8 ? tsNum * 0.5 : tsNum;

    const directNotes =
      Array.isArray(track.recordedNotes) && track.recordedNotes.length > 0
        ? track.recordedNotes
        : Array.isArray(track.notes) && track.notes.length > 0
        ? track.notes
        : [];
    const clips =
      Array.isArray(track.regions) && track.regions.length > 0
        ? track.regions
        : Array.isArray(track.clips) && track.clips.length > 0
        ? track.clips
        : [];
    const clipNotes = clips.flatMap((c: any) =>
      Array.isArray(c?.notes) ? c.notes : []
    );
    const rawList = clipNotes.length > 0 ? clipNotes : directNotes;

    return rawList.map((n: any, idx: number) => {
      const midi =
        typeof n.midi === "number"
          ? n.midi
          : typeof n.note === "number"
          ? n.note
          : 60;
      const hasBar = typeof n.bar === "number" && Number.isFinite(n.bar);
      const hasLength = typeof n.length === "number" && Number.isFinite(n.length);
      const startBar = hasBar ? n.bar : 1;
      const lengthBars = hasLength ? n.length : 1 / tsNum;
      const startBeat = Math.max(0, (startBar - 1) * barLengthInBeats);
      const durationBeats = Math.max(0.125, lengthBars * barLengthInBeats);
      const time =
        !hasBar && typeof n.time === "number" && Number.isFinite(n.time)
          ? n.time
          : startBeat * secPerBeat;
      const duration =
        !hasLength && typeof n.duration === "number" && Number.isFinite(n.duration)
          ? n.duration
          : Math.max(0.05, durationBeats * secPerBeat);
      return {
        id: n.id || `score-note-${idx}`,
        midi,
        note: midi,
        bar: hasBar ? n.bar : undefined,
        length: hasLength ? n.length : undefined,
        startBeat,
        durationBeats,
        startTicks: typeof n.startTicks === "number" ? n.startTicks : undefined,
        durationTicks: typeof n.durationTicks === "number" ? n.durationTicks : undefined,
        time,
        duration,
        velocity: typeof n.velocity === "number" ? n.velocity : 100,
      };
    });
  };

  const getSelectedScoreTrack = () => {
    const userTracks = getUserMidiTracksForScore();
    if (userTracks.length === 0) return null;
    if (selectedScoreTrackId) {
      const found = userTracks.find(
        (t: any) => String(t.id) === String(selectedScoreTrackId)
      );
      if (found) return found;
    }
    const withNotes = userTracks.find(
      (t: any) => extractTrackNotesForScore(t).length > 0
    );
    return withNotes || userTracks[0];
  };

  // 2. Descargar Archivo PDF (.pdf) vía generador vectorial canónico (Solo Guía de Acordes)
  const handleDownloadDirectPDF = () => {
    setIsExportModalOpen(false);
    try {
      downloadLeadSheetPDF({
        song: transposedSongForScore,
        transposition,
        globalKey: displayedKeyCenter,
      });
      setPdfExportSuccess(true);
      setTimeout(() => setPdfExportSuccess(false), 4500);
    } catch (err) {
      console.error("Error al descargar el archivo PDF directo:", err);
    }
  };

  // 2.1 Descargar Partitura Completa con Pentagrama (Acordes + Melodía/Bajo MIDI)
  const handleDownloadFullScorePDF = () => {
    setIsExportModalOpen(false);
    try {
      const targetTrack = getSelectedScoreTrack();
      const midiNotes = extractTrackNotesForScore(targetTrack);
      downloadLeadSheetPDF({
        song: transposedSongForScore,
        transposition,
        globalKey: displayedKeyCenter,
        includeStaffNotation: true,
        midiNotes,
        trackName: targetTrack?.name || "Pista MIDI",
        instrumentName: targetTrack?.instrument || "Piano",
        bankId: targetTrack?.bankId || "acoustic_grand_piano",
      });
      setPdfExportSuccess(true);
      setTimeout(() => setPdfExportSuccess(false), 4500);
    } catch (err) {
      console.error("Error al descargar la partitura completa PDF:", err);
    }
  };

  // 2.5 Exportar Audio (Mix completo WAV) mediante renderizado Offline de Tone.js (Tone.Offline)
  const handleExportWav = async () => {
    if (isExportingWav) return;
    setIsExportingWav(true);
    triggerExportToast("Renderizando audio...");

    try {
      // Detener reproducción en vivo si estuviera activa
      if (metronomeControlRef.current && metronomeControlRef.current.isPlaying()) {
        try {
          metronomeControlRef.current.stop();
        } catch (_) {}
      }

      try {
        await Tone.start();
      } catch (_) {}

      const bpmVal = Math.max(30, Math.min(300, Number(currentSong?.tempo) || 120));
      const timeSig = currentSong?.timeSignature || "4/4";
      const beatsPerBar = parseInt(timeSig.split("/")[0], 10) || getBeatsPerBar(timeSig);
      const secondsPerBeat = timeSig.split("/")[1]?.trim() === "8" ? (60.0 / bpmVal) / 2.0 : 60.0 / bpmVal;
      const ticksPerBeat = 480;
      const activeStyle: DrumStyle =
        activeDrumStyle || detectDrumStyleFromSongStyle(currentSong?.style) || "Jazz Swing";
      const harmonicInst: "piano" | "guitar" | "epiano" =
        instrument === "guitar" ? "guitar" : (instrument as any) === "epiano" ? "epiano" : "piano";

      // 1. Obtener secuencia lineal de acordes desenrollada (con repeticiones/casillas)
      const seq = buildSongPlaybackSequence(currentSong, transposition, globalKey);
      const seqTotalBeats =
        seq.length > 0
          ? seq.reduce((acc, item) => acc + (item.beatsLength || beatsPerBar), 0)
          : Math.max(4, (currentSong?.measures?.length || 4) * beatsPerBar);
      const progressionDurationSec = seqTotalBeats * secondsPerBeat;

      // 2. Obtener pistas del DAW y estado del Mixer
      const rawDawTracks: any[] =
        typeof (window as any).__linusGetDawTracks === "function"
          ? (window as any).__linusGetDawTracks()
          : dawTracksRef.current || [];
      const mixerState = interactiveAnalysisAudio.getMixerState();

      // Resolver Mute / Solo global
      const anyTrackSolo =
        rawDawTracks.some((t: any) => Boolean(t?.isSolo)) ||
        mixerState.drums.isSolo ||
        mixerState.bass.isSolo ||
        mixerState.piano.isSolo ||
        mixerState.rhodes.isSolo ||
        mixerState.guitar.isSolo;

      const t1Track = rawDawTracks.find((t: any) => String(t?.id) === "t-1");
      const t2Track = rawDawTracks.find((t: any) => String(t?.id) === "t-2");
      const t3Track = rawDawTracks.find((t: any) => String(t?.id) === "t-3");

      const harmMixerCh =
        harmonicInst === "guitar"
          ? mixerState.guitar
          : harmonicInst === "epiano"
          ? mixerState.rhodes
          : mixerState.piano;

      const isHarmonyMuted = t1Track ? Boolean(t1Track.isMuted) : harmMixerCh.isMuted;
      const isHarmonySolo = t1Track ? Boolean(t1Track.isSolo) : harmMixerCh.isSolo;
      const isHarmonyAudible = !isHarmonyMuted && (!anyTrackSolo || isHarmonySolo);
      const harmonyVol =
        t1Track && typeof t1Track.volume === "number" ? t1Track.volume : harmMixerCh.volume;
      const harmonyPan = harmMixerCh.pan ?? -0.15;

      const isBassMuted = t2Track ? Boolean(t2Track.isMuted) : mixerState.bass.isMuted;
      const isBassSolo = t2Track ? Boolean(t2Track.isSolo) : mixerState.bass.isSolo;
      const isBassAudible = !isBassMuted && (!anyTrackSolo || isBassSolo);
      const bassVol =
        t2Track && typeof t2Track.volume === "number" ? t2Track.volume : mixerState.bass.volume;
      const bassPan = mixerState.bass.pan ?? 0.0;

      const isDrumsMuted = t3Track ? Boolean(t3Track.isMuted) : mixerState.drums.isMuted;
      const isDrumsSolo = t3Track ? Boolean(t3Track.isSolo) : mixerState.drums.isSolo;
      const isDrumsAudible =
        !isDrumsMuted && (!anyTrackSolo || isDrumsSolo) && activeStyle !== "Metronome Básico";
      const drumsVol =
        t3Track && typeof t3Track.volume === "number" ? t3Track.volume : mixerState.drums.volume;

      // 3. Pre-cargar los AudioBuffers de Banda Linus y Bancos MIDI de Usuario ANTES de Tone.Offline
      const bandBuffers = await interactiveAnalysisAudio.getBuffersForOfflineRender();

      const parsePanString = (panVal: any): number => {
        if (typeof panVal === "number" && !isNaN(panVal)) {
          return Math.max(-1, Math.min(1, panVal));
        }
        const str = String(panVal || "C").trim().toUpperCase();
        if (str === "C" || str === "0") return 0;
        if (str.startsWith("L")) {
          const num = parseFloat(str.replace("L", "").trim());
          return isNaN(num) ? -0.2 : Math.max(-1, -num / 100);
        }
        if (str.startsWith("R")) {
          const num = parseFloat(str.replace("R", "").trim());
          return isNaN(num) ? 0.2 : Math.min(1, num / 100);
        }
        return 0;
      };

      interface PreparedMidiNote {
        time: number;
        noteName: string;
        duration: number;
        velocity: number;
      }

      interface PreparedUserTrack {
        id: string;
        name: string;
        bankId: string;
        volume: number;
        pan: number;
        gainDb: number;
        attack: number;
        release: number;
        curve: "exponential" | "linear";
        category: string;
        preloadedBuffers: Record<string, AudioBuffer> | null;
        notes: PreparedMidiNote[];
      }

      const preparedUserTracks: PreparedUserTrack[] = [];
      let maxMidiEndSec = 0;

      for (const track of rawDawTracks) {
        const trackId = String(track?.id || "");
        if (["t-1", "t-2", "t-3"].includes(trackId)) continue;

        const isMuted = Boolean(track?.isMuted);
        const isSolo = Boolean(track?.isSolo);
        if (isMuted || (anyTrackSolo && !isSolo)) continue;

        const bankId = String(track?.bankId || "").trim();
        const bankMeta = LIVE_MIDI_BANKS.find((b) => b.id === bankId);

        const trackClips =
          Array.isArray(track?.clips) && track.clips.length > 0
            ? track.clips
            : Array.isArray(track?.regions) && track.regions.length > 0
            ? track.regions
            : [];

        const notesList: PreparedMidiNote[] = [];

        const processNoteItem = (note: any, clipStartBar: number) => {
          const clipStartTicks = Math.round((Math.max(1.0, clipStartBar) - 1.0) * beatsPerBar * ticksPerBeat);
          const nStartTicks =
            typeof note?.startTicks === "number" && !isNaN(note.startTicks)
              ? note.startTicks
              : typeof note?.bar === "number" && !isNaN(note.bar)
              ? Math.round((Math.max(1.0, note.bar) - 1.0) * beatsPerBar * ticksPerBeat)
              : 0;

          const nDurationTicks =
            typeof note?.durationTicks === "number" && !isNaN(note.durationTicks)
              ? Math.max(12, note.durationTicks)
              : typeof note?.length === "number" && !isNaN(note.length)
              ? Math.max(12, Math.round(note.length * beatsPerBar * ticksPerBeat))
              : Math.round(0.25 * beatsPerBar * ticksPerBeat);

          const absoluteAttackTicks =
            nStartTicks >= clipStartTicks ? nStartTicks : clipStartTicks + nStartTicks;

          const attackTimeSec =
            typeof note?.time === "number" && !isNaN(note.time)
              ? Math.max(0, note.time)
              : Math.max(0, (absoluteAttackTicks / ticksPerBeat) * secondsPerBeat);

          const durationSec =
            typeof note?.duration === "number" && !isNaN(note.duration)
              ? Math.max(0.05, note.duration)
              : Math.max(0.05, (nDurationTicks / ticksPerBeat) * secondsPerBeat);

          const midiNum =
            typeof note?.midi === "number"
              ? note.midi
              : typeof note?.note === "number"
              ? note.note
              : Math.round((note?.pitchPercent ?? 50) * 0.48 + 36);

          const noteName = note?.noteName || Tone.Frequency(midiNum, "midi").toNote();
          const rawVel = typeof note?.velocity === "number" ? note.velocity : 100;
          const velNorm = rawVel <= 1.0 ? Math.max(0.1, rawVel) : calculateMusicalVelocity(rawVel);

          notesList.push({
            time: attackTimeSec,
            noteName,
            duration: durationSec,
            velocity: velNorm,
          });

          const endSec = attackTimeSec + durationSec;
          if (endSec > maxMidiEndSec) {
            maxMidiEndSec = endSec;
          }
        };

        if (trackClips.length > 0) {
          for (const clip of trackClips) {
            const clipStartBar = typeof clip?.startBar === "number" ? clip.startBar : 1.0;
            const clipNotes = Array.isArray(clip?.notes) ? clip.notes : [];
            for (const note of clipNotes) {
              processNoteItem(note, clipStartBar);
            }
          }
        } else if (Array.isArray(track?.recordedNotes) && track.recordedNotes.length > 0) {
          for (const note of track.recordedNotes) {
            processNoteItem(note, 1.0);
          }
        }

        if (notesList.length === 0) continue;

        const effectiveBankId = bankId && bankId !== "none" ? bankId : "flute";
        const preloadedBuffers = await getBankAudioBuffersForOffline(effectiveBankId);

        preparedUserTracks.push({
          id: trackId,
          name: track.name || "Pista MIDI",
          bankId: effectiveBankId,
          volume: typeof track.volume === "number" ? track.volume : 1.0,
          pan: parsePanString(track.pan),
          gainDb: bankMeta ? bankMeta.gainDb : 5,
          attack: bankMeta ? bankMeta.attack : 0.02,
          release: bankMeta ? bankMeta.release : 0.35,
          curve: bankMeta ? bankMeta.curve : "linear",
          category: bankMeta ? bankMeta.category : "VIENTOS",
          preloadedBuffers,
          notes: notesList,
        });
      }

      // 4. Preparar eventos de Banda Linus (Comping de Piano/Armonía, Walking Bass y Batería)
      interface PreparedChordEvent {
        time: number;
        notes: string[];
        duration: number;
        velocity: number;
      }

      interface PreparedBassEvent {
        time: number;
        noteName: string;
        duration: number;
        velocity: number;
      }

      interface PreparedDrumEvent {
        time: number;
        instrument: "kick" | "snare" | "rim" | "hihat" | "hihat_closed" | "hihat_open" | "ride";
        velocity: number;
      }

      const harmonyEvents: PreparedChordEvent[] = [];
      const bassEvents: PreparedBassEvent[] = [];
      const drumEvents: PreparedDrumEvent[] = [];

      const isFunkStyle = activeStyle.toLowerCase().includes("funk");
      const isReggaeStyle =
        !activeStyle.toLowerCase().includes("reggaet") &&
        !activeStyle.toLowerCase().includes("reguet") &&
        activeStyle.toLowerCase().includes("reggae");

      let currentBeatCursor = 0;

      for (let i = 0; i < seq.length; i++) {
        const currentChord = seq[i];
        const chordBeats = currentChord.beatsLength || beatsPerBar;
        const chordStartTimeSec = currentBeatCursor * secondsPerBeat;

        // Heredar acorde anterior si el casillero actual está vacío
        let effectiveChord = currentChord;
        if (!effectiveChord.chordString) {
          for (let back = 1; back <= seq.length; back++) {
            const prevIdx = (i - back + seq.length) % seq.length;
            if (seq[prevIdx] && seq[prevIdx].chordString) {
              effectiveChord = {
                ...currentChord,
                chordString: seq[prevIdx].chordString,
                frequencies: seq[prevIdx].frequencies,
                parsedRoot: seq[prevIdx].parsedRoot,
                parsedType: seq[prevIdx].parsedType,
              };
              break;
            }
          }
        }

        let nextChordString: string | null = null;
        if (i + 1 < seq.length) {
          nextChordString = seq[i + 1].chordString || effectiveChord.chordString;
        } else if (seq.length > 0) {
          nextChordString = seq[0].chordString || effectiveChord.chordString;
        }

        if (effectiveChord.chordString) {
          // A) Armonía / Comping
          if (isHarmonyAudible) {
            const comping = generateComping(
              effectiveChord,
              activeStyle,
              currentBeatCursor,
              harmonicInst,
              timeSig
            );
            comping.forEach((c) => {
              if (!c.freqs || c.freqs.length === 0) return;
              const hitStartSec = chordStartTimeSec + c.timeOffset * secondsPerBeat;
              const hitDurationSec =
                isFunkStyle || isReggaeStyle || c.durationBeats <= 0.2
                  ? Math.min(0.14, Math.max(0.08, c.durationBeats * secondsPerBeat))
                  : c.durationBeats <= 0.4
                  ? Math.min(0.28, Math.max(0.16, c.durationBeats * secondsPerBeat))
                  : Math.max(0.25, c.durationBeats * secondsPerBeat);

              // Filtrar frecuencias al registro armónico medio (>= 140Hz) igual que en tiempo real
              const validNotes = Array.from(
                new Set(
                  c.freqs
                    .filter((f) => f > 0 && !isNaN(f))
                    .map((f) => {
                      let freq = f;
                      while (freq < 140) freq *= 2;
                      while (freq > 780) freq /= 2;
                      return Tone.Frequency(freq).toNote();
                    })
                )
              );

              if (validNotes.length > 0) {
                const polyHeadroom = Math.min(1.0, 1.0 / Math.sqrt(validNotes.length));
                harmonyEvents.push({
                  time: Math.max(0, hitStartSec),
                  notes: validNotes,
                  duration: hitDurationSec,
                  velocity: 0.9 * polyHeadroom,
                });
              }
            });
          }

          // B) Bajo (Walking Bass)
          if (isBassAudible) {
            const bassNotes = generateWalkingBass(
              effectiveChord.chordString,
              chordBeats,
              nextChordString,
              activeStyle,
              currentBeatCursor,
              timeSig
            );
            bassNotes.forEach((n) => {
              if (isNaN(n.freq) || isNaN(n.timeOffset) || isNaN(n.durationBeats)) return;
              const noteStartSec = chordStartTimeSec + n.timeOffset * secondsPerBeat;
              const safeDurBeats = Math.max(0.25, Math.min(4.0, n.durationBeats));
              const noteDurSec = Math.max(0.28, safeDurBeats * secondsPerBeat * 0.85);
              const noteName = Tone.Frequency(n.freq).toNote();
              bassEvents.push({
                time: Math.max(0, noteStartSec),
                noteName,
                duration: noteDurSec,
                velocity: 0.85,
              });
            });
          }
        }

        currentBeatCursor += chordBeats;
      }

      // C) Batería (Groove completo compás por compás)
      const totalBeatsToRender = Math.max(
        seqTotalBeats,
        Math.ceil(maxMidiEndSec / secondsPerBeat)
      );

      if (isDrumsAudible) {
        for (let globalBeat = 0; globalBeat < totalBeatsToRender; globalBeat++) {
          const beatInMeasure = globalBeat % beatsPerBar;
          const beatStartSec = globalBeat * secondsPerBeat;
          const matrix = getDrumMatrixForBeat(activeStyle, beatInMeasure, globalBeat, timeSig);

          if (!mixerState.drumPieces.kick.isMuted) {
            for (const hit of matrix.kick) {
              drumEvents.push({
                time: Math.max(0, beatStartSec + hit.timeOffset * secondsPerBeat),
                instrument: hit.instrument,
                velocity: hit.velocity * mixerState.drumPieces.kick.volume,
              });
            }
          }
          if (!mixerState.drumPieces.snare.isMuted) {
            for (const hit of matrix.snare) {
              drumEvents.push({
                time: Math.max(0, beatStartSec + hit.timeOffset * secondsPerBeat),
                instrument: hit.instrument,
                velocity: hit.velocity * mixerState.drumPieces.snare.volume,
              });
            }
          }
          if (!mixerState.drumPieces.hihat.isMuted) {
            for (const hit of matrix.hihat) {
              drumEvents.push({
                time: Math.max(0, beatStartSec + hit.timeOffset * secondsPerBeat),
                instrument: hit.instrument,
                velocity: hit.velocity * mixerState.drumPieces.hihat.volume,
              });
            }
          }
          if (!mixerState.drumPieces.ride.isMuted) {
            for (const hit of matrix.ride) {
              drumEvents.push({
                time: Math.max(0, beatStartSec + hit.timeOffset * secondsPerBeat),
                instrument: hit.instrument,
                velocity: hit.velocity * mixerState.drumPieces.ride.volume,
              });
            }
          }
        }
      }

      // 5. Calcular la duración total en segundos (+ 2 segundos extra de cola/decaimiento)
      const baseDurationSec = Math.max(4, progressionDurationSec, maxMidiEndSec);
      const totalDuration = baseDurationSec + 2.0;

      // 6. Ejecutar Renderizado Offline con Tone.Offline
      // REGLA DE ORO: Todos los sintetizadores, samplers y nodos de efectos se instancian
      // EXCLUSIVAMENTE dentro del callback de Tone.Offline para pertenecer al OfflineAudioContext.
      const renderedBuffer = await Tone.Offline(async ({ transport }) => {
        // Fijar BPM absoluto en el milisegundo cero antes de programar tiempos por compás
        transport.bpm.setValueAtTime(bpmVal, 0);

        // Master FX (Compressor / Limiter) desactivados temporalmente para evitar "pumping"
        // y saltos de ganancia cuando entran las frecuencias graves del bajo.
        // const masterComp = new Tone.Compressor({ threshold: -18, ratio: 4, attack: 0.005, release: 0.15 });
        // const masterLimiter = new Tone.Limiter(-1.0);
        const rawDestination = Tone.getDestination();

        // --- 0. METRÓNOMO DE CUENTA PREVIA (COUNT-IN: 4 GOLPES EN COMPÁS 1) ---
        const offlineMetronome = new Tone.MembraneSynth({
          pitchDecay: 0.008,
          octaves: 2,
          envelope: {
            attack: 0.001,
            decay: 0.045,
            sustain: 0,
            release: 0.01,
          },
        }).toDestination();
        offlineMetronome.volume.setValueAtTime(-4, 0);

        const countInPositions = ["0:0:0", "0:1:0", "0:2:0", "0:3:0"];
        countInPositions.forEach((pos, idx) => {
          transport.schedule((time) => {
            offlineMetronome.triggerAttackRelease(idx === 0 ? "G5" : "C5", "32n", time);
          }, pos);
        });

        // Offset físico para que todas las pistas musicales arranquen exactamente en el Compás 2 ("1:0:0")
        const countInOffsetSec = Tone.Time("1:0:0").toSeconds();

        // --- A. CLON OFFLINE DE PIANO / ARMONÍA (Banda Linus) ---
        if (isHarmonyAudible && harmonyEvents.length > 0) {
          const harmFilter = new Tone.Filter({ frequency: 140, type: "highpass" });
          const harmPanner = new Tone.Panner(harmonyPan);
          harmPanner.pan.setValueAtTime(harmonyPan, 0);
          harmFilter.chain(harmPanner, rawDestination);

          const sourceMap =
            harmonicInst === "guitar"
              ? bandBuffers.guitar
              : harmonicInst === "epiano"
              ? bandBuffers.epiano
              : bandBuffers.piano;

          const harmUrls: Record<string, AudioBuffer> = {};
          Object.entries(sourceMap).forEach(([midiStr, buf]) => {
            if (buf) {
              const noteStr = Tone.Frequency(Number(midiStr), "midi").toNote();
              harmUrls[noteStr] = buf;
            }
          });

          if (Object.keys(harmUrls).length > 0) {
            const offlineHarmSampler = new Tone.Sampler({
              urls: harmUrls,
              attack: 0.008,
              release: 0.9,
              curve: "exponential",
            }).connect(harmFilter);
            offlineHarmSampler.volume.setValueAtTime(-14, 0);

            harmonyEvents.forEach((ev) => {
              transport.schedule((time) => {
                offlineHarmSampler.releaseAll(time);
                offlineHarmSampler.triggerAttackRelease(ev.notes, ev.duration, time, ev.velocity);
              }, countInOffsetSec + ev.time);
            });
          } else {
            const offlineHarmSynth = new Tone.PolySynth(Tone.Synth, {
              oscillator: { type: "triangle" },
              envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 },
            }).connect(harmFilter);
            offlineHarmSynth.volume.setValueAtTime(-14, 0);

            harmonyEvents.forEach((ev) => {
              transport.schedule((time) => {
                offlineHarmSynth.releaseAll(time);
                offlineHarmSynth.triggerAttackRelease(ev.notes, ev.duration, time, ev.velocity);
              }, countInOffsetSec + ev.time);
            });
          }
        }

        // --- B. CLON OFFLINE DE BAJO / CONTRABAJO (Banda Linus) ---
        if (isBassAudible && bassEvents.length > 0) {
          const bassFilter = new Tone.Filter({ frequency: 2800, type: "lowpass" });
          const bassPanner = new Tone.Panner(bassPan);
          bassPanner.pan.setValueAtTime(bassPan, 0);
          bassFilter.chain(bassPanner, rawDestination);

          const bassUrls: Record<string, AudioBuffer> = {};
          Object.entries(bandBuffers.bass).forEach(([midiStr, buf]) => {
            if (buf) {
              const noteStr = Tone.Frequency(Number(midiStr), "midi").toNote();
              bassUrls[noteStr] = buf;
            }
          });

          if (Object.keys(bassUrls).length > 0) {
            const offlineBassSampler = new Tone.Sampler({
              urls: bassUrls,
              attack: 0.012,
              release: 0.25,
              curve: "exponential",
            }).connect(bassFilter);
            offlineBassSampler.volume.setValueAtTime(8, 0);

            bassEvents.forEach((ev) => {
              transport.schedule((time) => {
                offlineBassSampler.releaseAll(time);
                offlineBassSampler.triggerAttackRelease(
                  ev.noteName,
                  ev.duration,
                  time,
                  ev.velocity
                );
              }, countInOffsetSec + ev.time);
            });
          } else {
            const offlineBassSynth = new Tone.MonoSynth({
              oscillator: { type: "fmsine" },
              envelope: { attack: 0.015, decay: 0.3, sustain: 0.4, release: 0.25 },
            }).connect(bassFilter);
            offlineBassSynth.volume.setValueAtTime(8, 0);

            bassEvents.forEach((ev) => {
              transport.schedule((time) => {
                offlineBassSynth.triggerAttackRelease(
                  ev.noteName,
                  ev.duration,
                  time,
                  ev.velocity
                );
              }, countInOffsetSec + ev.time);
            });
          }
        }

        // --- C. CLON OFFLINE DE BATERÍA (Banda Linus) ---
        if (isDrumsAudible && drumEvents.length > 0) {
          const drumVolDb = drumsVol > 0.001 ? Tone.gainToDb(drumsVol) : -100;

          const kickPanner = new Tone.Panner(mixerState.drumPieces.kick.pan ?? 0.0).connect(rawDestination);
          kickPanner.pan.setValueAtTime(mixerState.drumPieces.kick.pan ?? 0.0, 0);

          const snarePanner = new Tone.Panner(mixerState.drumPieces.snare.pan ?? 0.0).connect(rawDestination);
          snarePanner.pan.setValueAtTime(mixerState.drumPieces.snare.pan ?? 0.0, 0);

          const hihatPanner = new Tone.Panner(mixerState.drumPieces.hihat.pan ?? -0.3).connect(rawDestination);
          hihatPanner.pan.setValueAtTime(mixerState.drumPieces.hihat.pan ?? -0.3, 0);

          const ridePanner = new Tone.Panner(mixerState.drumPieces.ride.pan ?? 0.35).connect(rawDestination);
          ridePanner.pan.setValueAtTime(mixerState.drumPieces.ride.pan ?? 0.35, 0);

          const kickSampler = bandBuffers.drums.kick
            ? new Tone.Sampler({ urls: { C4: bandBuffers.drums.kick }, attack: 0.001, release: 0.2 }).connect(kickPanner)
            : null;
          if (kickSampler) kickSampler.volume.setValueAtTime(drumVolDb, 0);

          const snareSampler = bandBuffers.drums.snare
            ? new Tone.Sampler({ urls: { C4: bandBuffers.drums.snare }, attack: 0.001, release: 0.2 }).connect(snarePanner)
            : null;
          if (snareSampler) snareSampler.volume.setValueAtTime(drumVolDb, 0);

          const rimSampler = bandBuffers.drums.rim
            ? new Tone.Sampler({ urls: { C4: bandBuffers.drums.rim }, attack: 0.001, release: 0.15 }).connect(snarePanner)
            : null;
          if (rimSampler) rimSampler.volume.setValueAtTime(drumVolDb, 0);

          const hihatClosedSampler = bandBuffers.drums.hihat_closed
            ? new Tone.Sampler({ urls: { C4: bandBuffers.drums.hihat_closed }, attack: 0.001, release: 0.1 }).connect(hihatPanner)
            : null;
          if (hihatClosedSampler) hihatClosedSampler.volume.setValueAtTime(drumVolDb, 0);

          const hihatOpenSampler = bandBuffers.drums.hihat_open
            ? new Tone.Sampler({ urls: { C4: bandBuffers.drums.hihat_open }, attack: 0.001, release: 0.3 }).connect(hihatPanner)
            : null;
          if (hihatOpenSampler) hihatOpenSampler.volume.setValueAtTime(drumVolDb, 0);

          const rideSampler = bandBuffers.drums.ride
            ? new Tone.Sampler({ urls: { C4: bandBuffers.drums.ride }, attack: 0.001, release: 0.6 }).connect(ridePanner)
            : null;
          if (rideSampler) rideSampler.volume.setValueAtTime(drumVolDb, 0);

          drumEvents.forEach((hit) => {
            transport.schedule((time) => {
              const calVel = Math.max(
                0.05,
                Math.min(
                  1.5,
                  (hit.instrument === "kick"
                    ? 1.15
                    : hit.instrument === "snare"
                    ? 1.05
                    : hit.instrument === "rim"
                    ? 0.9
                    : hit.instrument === "ride"
                    ? 0.7
                    : hit.instrument === "hihat_open"
                    ? 0.75
                    : 0.65) * hit.velocity
                )
              );

              if (hit.instrument === "kick" && kickSampler) {
                kickSampler.triggerAttackRelease("C4", 0.7, time, calVel);
              } else if (hit.instrument === "snare" && snareSampler) {
                snareSampler.triggerAttackRelease("C4", 0.5, time, calVel);
              } else if (hit.instrument === "rim" && (rimSampler || snareSampler)) {
                (rimSampler || snareSampler)!.triggerAttackRelease("C4", 0.3, time, calVel);
              } else if (hit.instrument === "hihat_open" && (hihatOpenSampler || hihatClosedSampler)) {
                (hihatOpenSampler || hihatClosedSampler)!.triggerAttackRelease("C4", 0.9, time, calVel);
              } else if (
                (hit.instrument === "hihat" || hit.instrument === "hihat_closed") &&
                hihatClosedSampler
              ) {
                hihatClosedSampler.triggerAttackRelease("C4", 0.25, time, calVel);
              } else if (hit.instrument === "ride" && rideSampler) {
                rideSampler.triggerAttackRelease("C4", 1.8, time, calVel);
              }
            }, countInOffsetSec + hit.time);
          });
        }

        // --- D. CLONES OFFLINE DE PISTAS MIDI ADICIONALES DEL DAW (Bajos Eléctricos, Fretless, Vientos, Rhodes, Guitarras, Cuerdas, Synth) ---
        for (const uTrack of preparedUserTracks) {
          scheduleOfflineStudioTrack(uTrack, transport, rawDestination, countInOffsetSec);
        }

        transport.start(0);
      }, totalDuration + 4 * secondsPerBeat);

      // 7. Convertir el AudioBuffer renderizado a Blob WAV y descargar automáticamente
      const wavBlob = audioBufferToWav(renderedBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      const safeTitle = (currentSong?.title || "mezcla_linus")
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/gi, "_")
        .replace(/^_+|_+$/g, "");
      a.download = `${safeTitle || "mezcla_linus"}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      setIsExportModalOpen(false);
      triggerExportToast("¡Audio WAV (Mix completo) exportado correctamente!");
    } catch (error) {
      console.error("Error exportando WAV offline:", error);
      triggerExportToast("Error al renderizar y exportar el archivo WAV.");
    } finally {
      setIsExportingWav(false);
    }
  };

  // 3. Exportar Audio (.wav nativo vía captura PCM y codificación RIFF WAVE)
  const stopRecording = () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setIsRecording(false);

    try {
      // 1. Desconectar nodos Web Audio de captura
      if (audioCaptureNodesRef.current) {
        const { source, processor, silentGain } = audioCaptureNodesRef.current;
        processor.onaudioprocess = null;
        source.disconnect();
        processor.disconnect();
        silentGain.disconnect();
        audioCaptureNodesRef.current = null;
      }

      // 2. Detener reproducción del metrónomo si está sonando
      if (metronomeControlRef.current && metronomeControlRef.current.isPlaying()) {
        metronomeControlRef.current.stop();
      }

      // 3. Concatenar todos los chunks PCM capturados
      const chunksL = pcmChunksLRef.current;
      const chunksR = pcmChunksRRef.current;
      const totalSamples = chunksL.reduce((sum, chunk) => sum + chunk.length, 0);

      if (totalSamples > 0) {
        const fullL = new Float32Array(totalSamples);
        const fullR = new Float32Array(totalSamples);
        let offset = 0;
        for (let i = 0; i < chunksL.length; i++) {
          fullL.set(chunksL[i], offset);
          fullR.set(chunksR[i], offset);
          offset += chunksL[i].length;
        }

        const ctx = interactiveAnalysisAudio.getAudioContext();
        const sampleRate = ctx ? ctx.sampleRate : 44100;

        // 4. Codificar a WAV canónico con cabecera estándar RIFF/WAVE (16-bit PCM estéreo)
        const wavBlob = encodeWAV([fullL, fullR], sampleRate);

        // 5. Forzar la descarga del archivo llamado progresion-linus.wav
        const url = URL.createObjectURL(wavBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "progresion-linus.wav";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    } catch (err) {
      console.error("Error al finalizar y descargar archivo WAV:", err);
    } finally {
      pcmChunksLRef.current = [];
      pcmChunksRRef.current = [];
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  const startRecording = async () => {
    try {
      // Obtener nodo MediaStreamDestination del bus de salida maestra
      const dest = interactiveAnalysisAudio.getOrCreateMediaStreamDestination();
      const ctx = interactiveAnalysisAudio.getAudioContext();
      if (!dest || !dest.stream || !ctx) {
        console.error("No se pudo obtener el nodo de destino MediaStream del AudioContext");
        return;
      }

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      // Limpiar buffers PCM previos
      pcmChunksLRef.current = [];
      pcmChunksRRef.current = [];

      // Conectar MediaStreamSource al processor para captura PCM en tiempo real
      const source = ctx.createMediaStreamSource(dest.stream);
      const processor = ctx.createScriptProcessor(4096, 2, 2);
      const silentGain = ctx.createGain();
      silentGain.gain.setValueAtTime(0, ctx.currentTime);

      processor.onaudioprocess = (e) => {
        if (!isRecordingRef.current) return;
        const inL = e.inputBuffer.getChannelData(0);
        const inR = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : inL;
        pcmChunksLRef.current.push(new Float32Array(inL));
        pcmChunksRRef.current.push(new Float32Array(inR));
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(ctx.destination);

      audioCaptureNodesRef.current = { source, processor, silentGain };
      setIsRecording(true);
      isRecordingRef.current = true;

      // Iniciar reproducción desde el principio
      if (metronomeControlRef.current) {
        await metronomeControlRef.current.start();
      }
    } catch (error) {
      console.error("Error al iniciar grabación WAV nativa:", error);
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  // Cuando la progresión termina su ciclo completo, detener grabación automáticamente y descargar
  const handleCycleComplete = () => {
    if (isRecordingRef.current) {
      stopRecording();
    }
  };

  // Si el usuario presiona Stop en la barra de transporte, finalizar la grabación y limpiar acorde activo
  const handleIsPlayingChange = (playing: boolean) => {
    if (!playing) {
      setCurrentPlayingIndex(null);
      if (isRecordingRef.current) {
        stopRecording();
      }
    }
  };

  // Importar Sesión (Cargar archivo .linus)
  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) return;
        const parsed = JSON.parse(content);

        // Estructurar compases de forma segura
        let loadedMeasures: SongMeasure[] = [];
        if (Array.isArray(parsed.measures)) {
          loadedMeasures = parsed.measures.map((m: any, idx: number) => ({
            id: m.id || `m-${idx + 1}-${Date.now()}`,
            chords: Array.isArray(m.chords)
              ? m.chords
              : (typeof m.chord === "string" ? [m.chord] : (m.chords ? [String(m.chords)] : [""])),
            sectionLabel: m.sectionLabel || undefined,
            repeatStart: Boolean(m.repeatStart),
            repeatEnd: Boolean(m.repeatEnd),
            volta: m.volta || undefined,
            isEnd: Boolean(m.isEnd),
            modulateTo: m.modulateTo || undefined
          }));
        } else if (Array.isArray(parsed)) {
          loadedMeasures = parsed;
        }

        if (loadedMeasures.length === 0) {
          loadedMeasures = [
            { id: `m-1-${Date.now()}`, chords: [""], sectionLabel: "[A]", repeatStart: true },
            { id: `m-2-${Date.now()}`, chords: [""] },
            { id: `m-3-${Date.now()}`, chords: [""] },
            { id: `m-4-${Date.now()}`, chords: [""], repeatEnd: true }
          ];
        }

        const loadedTempo = typeof parsed.tempo === "number" && !isNaN(parsed.tempo) ? parsed.tempo : (currentSong.tempo || 120);
        const loadedStyle = typeof parsed.style === "string" && parsed.style.trim() ? parsed.style.trim() : (currentSong.style || "Swing");
        const loadedTimeSignature = typeof parsed.timeSignature === "string" ? parsed.timeSignature : (parsed.metrica || currentSong.timeSignature || "4/4");
        const loadedTitle = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : (currentSong.title || "Sesión Cargada");
        const loadedKey = typeof parsed.defaultKey === "string" ? parsed.defaultKey : (parsed.key || currentSong.defaultKey || "C");

        if (typeof parsed.activeDrumStyle === "string" && parsed.activeDrumStyle.trim()) {
          setActiveDrumStyle(parsed.activeDrumStyle.trim() as any);
        }

        const targetId = isCustomSong ? currentSong.id : `custom-${Date.now()}`;
        const restoredSong: Song = {
          id: targetId,
          title: loadedTitle,
          style: loadedStyle,
          tempo: loadedTempo,
          timeSignature: loadedTimeSignature,
          defaultKey: loadedKey,
          isCustom: true,
          sections: parsed.sections || { "A": 0 },
          measures: loadedMeasures
        };

        setAllSongs((prev) => {
          const exists = prev.some((s) => s.id === restoredSong.id);
          const updated = exists
            ? prev.map((s) => (s.id === restoredSong.id ? restoredSong : s))
            : [...prev, restoredSong];
          try {
            localStorage.setItem("customSongs", JSON.stringify(updated.filter((s) => s.isCustom)));
          } catch (_) {}
          return updated;
        });

        setSelectedSongId(restoredSong.id);
        setSelectedMeasureIndex(0);
        setSelectedChordSlotIndex(0);
        if (typeof parsed.transposition === "number") {
          skipNextTranspositionResetRef.current = true;
          setTransposition(parsed.transposition);
        } else {
          setTransposition(0);
        }

        // Reinicio preventivo del Transporte y Playhead al cargar el archivo .linus
        if (metronomeControlRef.current && metronomeControlRef.current.isPlaying()) {
          try {
            metronomeControlRef.current.stop();
          } catch (_) {}
        }
        try {
          Tone.Transport.stop();
          Tone.Transport.position = "0:0:0";
          Tone.Transport.seconds = 0;
          Tone.Transport.ticks = 0;
        } catch (_) {}
        (window as any).__linusSeekMeasureIndex = 0;
        (window as any).__linusSeekTargetSeconds = 0;
        setCurrentPlayingIndex(null);

        // Restaurar pistas grabadas en el DAW normalizando el Tiempo Cero (Zero-Offset a "0:0:0" / Compás 1)
        const rawLoadedTracks = Array.isArray(parsed.tracks)
          ? parsed.tracks
          : Array.isArray(parsed.dawTracks)
          ? parsed.dawTracks
          : null;

        if (rawLoadedTracks) {
          const bPerBar = getBeatsPerBar(loadedTimeSignature);
          const ticksPerBeat = 480;
          const secondsPerBeat = 60 / (loadedTempo || 120);

          const normalizedLoadedTracks = rawLoadedTracks.map((track: any) => {
            const isBand = ["t-1", "t-2", "t-3"].includes(String(track?.id));
            if (isBand) return track;

            const rawClipsList =
              Array.isArray(track?.clips) && track.clips.length > 0
                ? track.clips
                : Array.isArray(track?.regions) && track.regions.length > 0
                ? track.regions
                : [];

            if (rawClipsList.length > 0) {
              const normalizedClips = rawClipsList.map((clip: any) => {
                const rawClipStartBar =
                  typeof clip?.startBar === "number" && !isNaN(clip.startBar)
                    ? Math.max(1.0, clip.startBar)
                    : 1.0;
                const rawClipDurationBars =
                  typeof clip?.durationBars === "number" && !isNaN(clip.durationBars)
                    ? Math.max(0.25, clip.durationBars)
                    : 1.0;
                const clipBarOffset = Math.max(0, rawClipStartBar - 1.0);

                const rawNotes = Array.isArray(clip?.notes) ? clip.notes : [];
                const parsedNotes = rawNotes.map((n: any) => {
                  const rawBarVal =
                    typeof n?.bar === "number" && !isNaN(n.bar)
                      ? n.bar
                      : typeof n?.startTicks === "number" && !isNaN(n.startTicks)
                      ? 1.0 + n.startTicks / (bPerBar * ticksPerBeat)
                      : 1.0;
                  const lenVal =
                    typeof n?.length === "number" && !isNaN(n.length)
                      ? Math.max(0.05, n.length)
                      : typeof n?.durationTicks === "number" && !isNaN(n.durationTicks)
                      ? Math.max(0.05, n.durationTicks / (bPerBar * ticksPerBeat))
                      : 0.25;
                  return { rawNote: n, rawBarVal, lenVal };
                });

                const minRawNoteBar =
                  parsedNotes.length > 0
                    ? Math.min(...parsedNotes.map((item: any) => item.rawBarVal))
                    : rawClipStartBar;
                const minBarAfterClipOffset = Math.max(1.0, minRawNoteBar - clipBarOffset);
                const extraWholeBarOffset =
                  minBarAfterClipOffset >= 2.0 ? Math.floor(minBarAfterClipOffset - 1.0) : 0;
                const totalBarOffset = clipBarOffset + extraWholeBarOffset;

                const normalizedNotes = parsedNotes.map(({ rawNote: n, rawBarVal, lenVal }: any) => {
                  const normalizedBar = Math.max(1.0, Number((rawBarVal - totalBarOffset).toFixed(6)));
                  const normalizedStartTicks = Math.max(
                    0,
                    Math.round((normalizedBar - 1.0) * bPerBar * ticksPerBeat)
                  );
                  return {
                    ...n,
                    bar: normalizedBar,
                    length: lenVal,
                    startTicks: normalizedStartTicks,
                  };
                });

                const maxNoteEndBar =
                  normalizedNotes.length > 0
                    ? Math.max(...normalizedNotes.map((n: any) => n.bar + n.length))
                    : 1.0 + rawClipDurationBars;
                const adjustedRawDuration = Math.max(0.25, rawClipDurationBars - extraWholeBarOffset);
                const durationBars = Number(
                  Math.max(0.25, adjustedRawDuration, maxNoteEndBar - 1.0).toFixed(3)
                );
                const durationTicks = Math.max(12, Math.round(durationBars * bPerBar * ticksPerBeat));
                const durationSeconds = (durationTicks / ticksPerBeat) * secondsPerBeat;

                return {
                  ...clip,
                  startBar: 1.0,
                  startTime: 0,
                  startTicks: 0,
                  durationBars,
                  durationTicks,
                  duration: durationSeconds,
                  notes: normalizedNotes,
                };
              });

              return {
                ...track,
                clips: normalizedClips,
                regions: normalizedClips,
                recordedNotes: normalizedClips.flatMap((c: any) => c.notes || []),
              };
            }

            return track;
          });

          dawTracksRef.current = normalizedLoadedTracks;
          setDawTracks(normalizedLoadedTracks);
          const restoreOptions = {
            bpm: loadedTempo,
            timeSignature: loadedTimeSignature,
          };
          if (typeof (window as any).__linusRestoreDawTracks === "function") {
            (window as any).__linusRestoreDawTracks(normalizedLoadedTracks, restoreOptions);
          } else {
            window.dispatchEvent(
              new CustomEvent("linus-restore-daw-tracks", {
                detail: { tracks: normalizedLoadedTracks, options: restoreOptions },
              })
            );
          }
        }

        triggerExportToast("Sesión (.linus) cargada correctamente.");
      } catch (err) {
        console.error("Error al procesar el archivo .linus:", err);
      }
    };
    reader.readAsText(file);
  };

  const { globalKey, globalIsMinor } = useMemo(() => {
    let rawKey = currentSong.defaultKey || "C";
    let isMinStr = /m|-|min/i.test(rawKey);
    let key = rawKey.replace(/m|-|min/ig, "").trim() as RootNote;
    let isMinor = !!currentSong.defaultIsMinor || isMinStr;

    // Detección Dinámica de Tonalidad Menor:
    // Si los metadatos de la canción indican una tonalidad menor (ej. "Cm"),
    // o si el primer/último acorde de la estructura es un grado menor (m, m7),
    // el sistema debe establecer una variable global isMinorKey = true.
    if (!isMinor && currentSong?.measures) {
      const allFlatChords = currentSong.measures
        .flatMap((m) => m.chords || [])
        .filter((c) => {
          const str = typeof c === "string" ? c : (c as any)?.chordName || (c as any)?.name || "";
          return str && str.trim() !== "" && str !== "%";
        });
      if (allFlatChords.length > 0) {
        const firstC = allFlatChords[0];
        const lastC = allFlatChords[allFlatChords.length - 1];
        const firstParsed = parseChord(typeof firstC === "string" ? firstC : (firstC as any)?.chordName || "");
        const lastParsed = parseChord(typeof lastC === "string" ? lastC : (lastC as any)?.chordName || "");
        const cleanTonic = (key in ROOT_MIDI_OFFSET_MAP ? key : "C") as RootNote;

        if (
          (isMinorQuality(firstParsed.type) && ROOT_MIDI_OFFSET_MAP[firstParsed.root] === ROOT_MIDI_OFFSET_MAP[cleanTonic]) ||
          (isMinorQuality(lastParsed.type) && ROOT_MIDI_OFFSET_MAP[lastParsed.root] === ROOT_MIDI_OFFSET_MAP[cleanTonic])
        ) {
          isMinor = true;
        }
      }
    }

    return { globalKey: key || "C", globalIsMinor: isMinor };
  }, [currentSong]);

  const quickChordSuggestions = useMemo(() => {
    if (!isQuickChordDropdownOpen) return [];
    return getMasterChordSuggestions(quickChordInput, globalKey);
  }, [isQuickChordDropdownOpen, quickChordInput, globalKey]);

  const analyzedChords = useMemo(() => {
    let currentKey = globalKey;
    let currentIsMinor = globalIsMinor;

    const contexts: ChordInputContext[] = [];

    (currentSong?.measures || []).forEach((m) => {
      if (m.modulateTo) {
        currentKey = m.modulateTo.key;
        currentIsMinor = m.modulateTo.isMinor;
      }
      const rawChords = (m.chords && m.chords.length > 0) ? m.chords : [''];
      const slotCount = rawChords.length <= 1 ? 1 : rawChords.length === 2 ? 2 : 4;
      for (let i = 0; i < slotCount; i++) {
        const c = rawChords[i] || '';
        const actualChordName = typeof c === 'string' ? c : ((c as any)?.chordName || (c as any)?.name || (c as any)?.text || '');
        contexts.push({
          chordString: actualChordName,
          keyContext: currentKey,
          isMinorKey: currentIsMinor,
        });
      }
    });

    return analyzeSongHarmony(contexts);
  }, [currentSong, globalKey, globalIsMinor]);

  const analyzedMeasures = useMemo(() => {
    let globalIdx = 0;
    return (currentSong?.measures || []).map((m) => {
      const rawChords = (m.chords && m.chords.length > 0) ? m.chords : [''];
      const slotCount = rawChords.length <= 1 ? 1 : rawChords.length === 2 ? 2 : 4;
      return Array.from({ length: slotCount }, () => analyzedChords[globalIdx++]);
    });
  }, [currentSong, analyzedChords]);

  const allRawChords = useMemo(() => {
    return (currentSong?.measures || []).flatMap((m) => {
      const rawChords = (m.chords && m.chords.length > 0) ? m.chords : [''];
      const slotCount = rawChords.length <= 1 ? 1 : rawChords.length === 2 ? 2 : 4;
      return Array.from({ length: slotCount }, (_, i) => {
        const c = rawChords[i] || '';
        const rawStr = typeof c === "string" ? c : (c as any)?.chordName || (c as any)?.name || "";
        return sanitizeChordString(rawStr);
      });
    });
  }, [currentSong]);

  // Pre-cálculo O(1) de índices planos por compás para evitar bucles O(N^2) en la grilla armónica
  const measureFlatIndices = useMemo(() => {
    let acc = 0;
    return (currentSong?.measures || []).map((m) => {
      const start = acc;
      const rawChords = (m.chords && m.chords.length > 0) ? m.chords : [''];
      const slotCount = rawChords.length <= 1 ? 1 : rawChords.length === 2 ? 2 : 4;
      acc += slotCount;
      return start;
    });
  }, [currentSong]);

  // Filter songs list
  const filteredSongs = useMemo(() => {
    return allSongs.filter(
      (song) =>
        song.title.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
        song.style.toLowerCase().includes(songSearchQuery.toLowerCase()),
    );
  }, [songSearchQuery, allSongs]);

  const skipNextTranspositionResetRef = useRef<boolean>(false);

  // Reset transposition only when changing to a different song ID
  useEffect(() => {
    if (skipNextTranspositionResetRef.current) {
      skipNextTranspositionResetRef.current = false;
    } else {
      setTransposition(0);
    }
    setShowDeleteConfirm(false);
    setSelectedMeasureIndex(0);
    setSelectedChordSlotIndex(0);
    (window as any).__linusSeekMeasureIndex = 0;
    (window as any).__linusSeekTargetSeconds = 0;
    try {
      Tone.Transport.seconds = 0;
    } catch (_) {}
    window.dispatchEvent(
      new CustomEvent("linus-seek-measure", {
        detail: {
          measureIndex: 0,
          bar: 1.0,
          targetSeconds: 0,
          source: "song-change",
        },
      })
    );
  }, [selectedSongId]);

  // Escuchar cambios de compás originados desde la regla superior del DAW
  useEffect(() => {
    const handleDawRulerSeek = (e: any) => {
      if (e?.detail?.source !== "daw-ruler") return;
      const mIdx = e?.detail?.measureIndex;
      if (typeof mIdx === "number" && !isNaN(mIdx) && mIdx >= 0) {
        setSelectedMeasureIndex(mIdx);
        setSelectedChordSlotIndex(0);
      }
    };
    window.addEventListener("linus-seek-measure", handleDawRulerSeek);
    return () => window.removeEventListener("linus-seek-measure", handleDawRulerSeek);
  }, []);

  // Sincronizar clic en compás o acorde de la grilla inferior con el Transporte y Playhead del DAW (Jump-to-Measure)
  const syncDawPlayheadToMeasure = React.useCallback(
    (measureIndex: number, slotIdx: number = 0, flatIdx?: number) => {
      window.dispatchEvent(new CustomEvent("linus-clear-daw-selection"));
      const clampedMeasure = Math.max(0, Math.floor(measureIndex));
      const bPerBar = getBeatsPerBar(currentSong?.timeSignature || "4/4");
      const bpmVal = Math.max(20, Tone.Transport.bpm.value || currentSong?.tempo || 120);
      const secondsPerBeat = 60 / bpmVal;
      const targetSeconds = clampedMeasure * bPerBar * secondsPerBeat;
      const targetBar = clampedMeasure + 1.0;

      (window as any).__linusSeekMeasureIndex = clampedMeasure;
      (window as any).__linusSeekTargetSeconds = targetSeconds;

      try {
        Tone.Transport.seconds = targetSeconds;
      } catch (_) {}

      window.dispatchEvent(
        new CustomEvent("linus-seek-measure", {
          detail: {
            measureIndex: clampedMeasure,
            bar: targetBar,
            targetSeconds,
            slotIdx,
            flatIndex: flatIdx,
            source: "chord-grid",
          },
        })
      );
    },
    [currentSong?.timeSignature, currentSong?.tempo]
  );

  // Auto-focus on the very first chord when changing songs
  useEffect(() => {
    if (
      currentSong &&
      currentSong.measures.length > 0 &&
      currentSong.measures[0].chords.length > 0 &&
      analyzedMeasures.length > 0
    ) {
      const rawChord = currentSong.measures[0].chords[0];
      const firstChord = typeof rawChord === 'string' ? rawChord : ((rawChord as any)?.chordName || (rawChord as any)?.name || (rawChord as any)?.text || '');
      const transposedFirst =
        transposition !== 0
          ? transposeChordString(firstChord, transposition, globalKey)
          : firstChord;
      setFocusedChord({
        originalString: firstChord,
        transposedString: transposedFirst,
        analysisContext: analyzedMeasures[0]?.[0] || null,
      });
    } else {
      setFocusedChord(null);
    }
  }, [selectedSongId]);

  // Handle Transposition change
  const handleTranspose = (amount: number) => {
    setTransposition((prev) => {
      const nextValue = prev + amount;
      if (nextValue > 11) return -11; // Modulo octaves
      if (nextValue < -11) return 11;
      return nextValue;
    });

    // Translate any currently selected chord to the new transposition offset
    if (focusedChord) {
      const { root, suffix } = parseChord(focusedChord.originalString);
      const newRoot = transposeRoot(
        root,
        transposition + amount,
        globalKey,
      );
      setFocusedChord((prev) =>
        prev
          ? {
              ...prev,
              transposedString: `${newRoot}${suffix}`,
            }
          : null,
      );
    }
  };

  const handleResetTranspose = () => {
    setTransposition(0);
    if (focusedChord) {
      setFocusedChord({
        originalString: focusedChord.originalString,
        transposedString: focusedChord.originalString,
        analysisContext: focusedChord.analysisContext,
      });
    }
  };

  // Play a chord via studio-grade engine (used ONLY when entering/applying a chord, not when selecting a slot)
  const playChord = (chordToPlay: string) => {
    const parsed = parseChord(chordToPlay);
    let frequencies: number[] = [];
    if (parsed.root) {
      const midiNotes = buildJazzVoicing(chordToPlay);
      frequencies = midiNotes.map(m => 440 * Math.pow(2, (m - 69) / 12));
    }
    if (frequencies.length > 0) {
      interactiveAnalysisAudio.playHarmonyChord(
        frequencies,
        0,
        1.8,
        instrument === 'piano' ? 'piano' : 'guitar'
      );
    }
  };

  // Click on a chord in the measure grid (silent selection by default)
  const handleChordClick = (
    chordString: string,
    analysisContext?: AnalyzedChord,
    flatIndex?: number,
    shouldPlayAudio: boolean = false,
  ) => {
    // 1. Calculate transposed version (resolviendo el símbolo % si aplica)
    let effectiveChordString = chordString;
    if (chordString === '%') {
      for (let prevIdx = (flatIndex ?? 1) - 1; prevIdx >= 0; prevIdx--) {
        const prev = allRawChords[prevIdx];
        if (prev && prev !== '%') {
          effectiveChordString = prev;
          break;
        }
      }
      if (effectiveChordString === '%') effectiveChordString = 'C';
    }

    const transposedString =
      transposition === 0
        ? effectiveChordString
        : transposeChordString(effectiveChordString, transposition, globalKey);

    // Update active focus state silently
    setFocusedChord({
      originalString: chordString,
      transposedString,
      analysisContext: analysisContext || null,
      flatIndex,
    });

    if (shouldPlayAudio && transposedString && transposedString !== '%') {
      playChord(transposedString);
    }
  };

  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number | null>(null);

  const playbackSequence = useMemo(() => {
    return buildSongPlaybackSequence(currentSong, transposition, globalKey);
  }, [currentSong, transposition, globalKey]);

  // Función ejecutada exactamente al pulsar "Play" para alimentar el secuenciador
  const getPlaybackSequence = React.useCallback(() => {
    return buildSongPlaybackSequence(currentSong, transposition, globalKey);
  }, [currentSong, transposition, globalKey]);

  useEffect(() => {
    if (currentPlayingIndex !== null) {
      const p = playbackSequence.find((item) => item.originalFlatIndex === currentPlayingIndex) || playbackSequence[currentPlayingIndex];
      if (p) {
        const analysisContext = analyzedChords[currentPlayingIndex] || null;
        setFocusedChord({
          originalString: p.originalString,
          transposedString: p.chordString,
          analysisContext,
          flatIndex: currentPlayingIndex,
        });
      }
    }
  }, [currentPlayingIndex, playbackSequence, analyzedChords]);


  // Calculate current dynamic key
  const displayedKeyCenter = useMemo(() => {
    return transposeRoot(
      globalKey,
      transposition,
      globalKey,
    );
  }, [globalKey, transposition]);

  // Canción con Tonalidad y Acordes YA transpuestos para el Modal de Partitura Lead Sheet y Exportación PDF
  const transposedSongForScore = useMemo(() => {
    const rawKeyStr = String(currentSong?.defaultKey || globalKey || "C").trim();
    const isMinStr = Boolean(currentSong?.defaultIsMinor) || /m|-|min/i.test(rawKeyStr);
    const activeKeyStr = isMinStr ? `${displayedKeyCenter}m` : displayedKeyCenter;

    const transposedMeasures = (currentSong?.measures || []).map((m) => {
      let currentKeyForMeasure = globalKey;
      if (m.modulateTo?.key) {
        currentKeyForMeasure = m.modulateTo.key;
      }
      const rawChords = m.chords && m.chords.length > 0 ? m.chords : [""];
      const newChords = rawChords.map((c) => {
        const rawStr =
          typeof c === "string"
            ? c
            : (c as any)?.chordName || (c as any)?.name || (c as any)?.text || "";
        const cleanStr = sanitizeChordString(rawStr);
        if (!cleanStr || cleanStr.trim() === "" || cleanStr === "%") {
          return cleanStr;
        }
        return transposition !== 0
          ? transposeChordString(cleanStr, transposition, currentKeyForMeasure)
          : cleanStr;
      });
      return {
        ...m,
        chords: newChords,
      };
    });

    return {
      ...currentSong,
      defaultKey: activeKeyStr,
      activeKey: activeKeyStr,
      transposition,
      isAlreadyTransposed: true,
      measures: transposedMeasures,
    } as Song & {
      activeKey: string;
      transposition: number;
      isAlreadyTransposed: boolean;
    };
  }, [currentSong, transposition, globalKey, displayedKeyCenter]);

  // Generate resolved chord details for Focused Fretboard
  const focusedChordVoicingDetails = useMemo(() => {
    if (!focusedChord) return null;
    const parsed = parseChord(focusedChord.transposedString);
    const voicing = getGuitarChordVoicing(parsed.root, parsed.type);

    let scaleKeyCenter = displayedKeyCenter;
    if (focusedChord.analysisContext) {
      scaleKeyCenter = transposeRoot(
        focusedChord.analysisContext.keyContext,
        transposition,
        globalKey,
      );
    }

    // Identificar el siguiente acorde en la progresión para detectar resolución armónica (V7 -> i)
    let targetChord: { root: RootNote; type: string } | null = null;
    if (focusedChord.flatIndex !== undefined && allRawChords.length > 0) {
      for (let nextIdx = focusedChord.flatIndex + 1; nextIdx < allRawChords.length; nextIdx++) {
        const nextRaw = allRawChords[nextIdx];
        if (nextRaw && nextRaw !== '%' && nextRaw.trim() !== '') {
          const nextParsed = parseChord(nextRaw);
          const nextTransposedRoot = transposeRoot(nextParsed.root, transposition, globalKey);
          targetChord = { root: nextTransposedRoot, type: nextParsed.type };
          break;
        }
      }
    }

    // Identificar el acorde previo en la progresión para detectar contexto ii-V (look-behind)
    let precedingChord: { root: RootNote; type: string; scale?: SuggestedScale } | null = null;
    if (focusedChord.flatIndex !== undefined && allRawChords.length > 0) {
      for (let prevIdx = focusedChord.flatIndex - 1; prevIdx >= 0; prevIdx--) {
        const prevRaw = allRawChords[prevIdx];
        if (prevRaw && prevRaw !== '%' && prevRaw.trim() !== '') {
          const prevParsed = parseChord(prevRaw);
          const prevTransposedRoot = transposeRoot(prevParsed.root, transposition, globalKey);
          const prevAnalyzed = analyzedChords && analyzedChords[prevIdx];
          precedingChord = {
            root: prevTransposedRoot,
            type: prevParsed.type,
            scale: prevAnalyzed?.suggestedScale
          };
          break;
        }
      }
    }

    const isMinor = focusedChord.analysisContext?.isMinorKey ?? globalIsMinor;
    const numeral = focusedChord.analysisContext?.romanNumeral;
    const category = focusedChord.analysisContext?.category;

    const suggestedScale = getSuggestedScale(
      parsed.root,
      parsed.type,
      scaleKeyCenter,
      numeral,
      isMinor,
      targetChord,
      category,
      precedingChord
    );

    return {
      root: parsed.root,
      type: parsed.type,
      suffix: parsed.suffix,
      voicing,
      suggestedScale,
    };
  }, [focusedChord, displayedKeyCenter, allRawChords, transposition, globalKey, globalIsMinor]);

  // Resuelve acorde para los modales flotantes (usa focusedChordVoicingDetails o compás seleccionado)
  const effectiveChordDetails = useMemo(() => {
    if (focusedChordVoicingDetails) return focusedChordVoicingDetails;
    let rawStr = '';
    const selMeasure = currentSong?.measures?.[selectedMeasureIndex ?? 0];
    if (selMeasure && selMeasure.chords && selMeasure.chords.length > 0) {
      const c = selMeasure.chords[selectedChordSlotIndex ?? 0] || selMeasure.chords[0];
      rawStr = typeof c === 'string' ? c : ((c as any)?.chordName || (c as any)?.name || '');
    }
    if (!rawStr && allRawChords.length > 0) {
      rawStr = allRawChords.find(c => c && c !== '%' && c.trim() !== '') || 'Cmaj7';
    }
    if (!rawStr) rawStr = 'Cmaj7';

    const parsed = parseChord(rawStr);
    const voicing = getGuitarChordVoicing(parsed.root, parsed.type);
    const suggestedScale = getSuggestedScale(
      parsed.root,
      parsed.type,
      displayedKeyCenter,
      undefined,
      globalIsMinor,
      undefined,
      undefined
    );

    return {
      root: parsed.root,
      type: parsed.type,
      suffix: parsed.suffix,
      voicing,
      suggestedScale
    };
  }, [focusedChordVoicingDetails, currentSong, selectedMeasureIndex, selectedChordSlotIndex, allRawChords, displayedKeyCenter, globalIsMinor]);

  const effectiveChordString = focusedChord?.transposedString || focusedChord?.originalString || (effectiveChordDetails ? `${effectiveChordDetails.root}${effectiveChordDetails.suffix}` : 'Cmaj7');

  const selectedMeasure = selectedMeasureIndex !== null && currentSong.measures ? currentSong.measures[selectedMeasureIndex] : null;

  const handleNewProgression = () => {
    const newSong: Song = {
      id: `custom-${Date.now()}`,
      title: 'Mi Nueva Progresión',
      defaultKey: 'C',
      style: 'Swing',
      tempo: 120,
      isCustom: true,
      sections: { "A": 0 },
      measures: [
        { id: `m-1-${Date.now()}`, chords: [''], sectionLabel: "[A]", repeatStart: true },
        { id: `m-2-${Date.now()}`, chords: [''] },
        { id: `m-3-${Date.now()}`, chords: [''] },
        { id: `m-4-${Date.now()}`, chords: [''], repeatEnd: true }
      ]
    };
    setAllSongs(prev => {
      const updated = [...prev, newSong];
      localStorage.setItem("customSongs", JSON.stringify(updated.filter(s => s.isCustom)));
      return updated;
    });
    setSelectedSongId(newSong.id);
    setSelectedMeasureIndex(0);
    setSelectedChordSlotIndex(0);
  };

  const handleMusicXMLImport = (song: Song) => {
    setAllSongs(prev => {
      const updated = [...prev, song];
      localStorage.setItem("customSongs", JSON.stringify(updated.filter(s => s.isCustom)));
      return updated;
    });
    setSelectedSongId(song.id);
    setSelectedMeasureIndex(0);
    setSelectedChordSlotIndex(0);
  };

  const handleDeleteCurrentSong = () => {
    setAllSongs((prev) => {
      const updated = prev.filter((s) => s.id !== currentSong.id);
      if (updated.length === 0) {
        const fallbackSong: Song = {
          id: `custom-fallback-${Date.now()}`,
          title: "Nueva Progresión",
          style: "Swing",
          tempo: 120,
          defaultKey: "C",
          isCustom: true,
          measures: [
            { id: `m-1-${Date.now()}`, chords: [''] }
          ]
        };
        updated.push(fallbackSong);
      }
      localStorage.setItem("customSongs", JSON.stringify(updated.filter(s => s.isCustom)));
      setSelectedSongId(updated[0].id);
      return updated;
    });
    setShowDeleteConfirm(false);
  };

  return (
    <div
      id="jazz-standards-split"
      className="w-full max-w-7xl mx-auto flex flex-col gap-6 items-start"
    >
      {/* 1. TOP METRO & SONG SELECTOR BAR (50/50 Layout) */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 bg-neutral-900 p-3.5 sm:p-4 rounded-xl border border-neutral-800 relative z-20 print:hidden items-stretch">
        {/* Song Selector / Colección de Progresiones (3-Row Layout) */}
        <div className="w-full flex flex-col justify-between space-y-3">
          {/* Fila 1: Título Solitario */}
          <div className="flex items-center gap-1.5">
            <FileMusic className="w-4 h-4 text-[#EA580B]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Colección de Progresiones ({allSongs.length})
            </span>
          </div>

          {/* Fila 2: Botones Grandes (+ Hoja en Blanco y Subir MusicXML) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleNewProgression}
              className="flex-1 flex justify-center items-center gap-2 py-2 px-3 bg-neutral-800 hover:bg-neutral-700 font-bold rounded-lg text-xs border border-neutral-700 text-neutral-200 hover:text-white transition-colors cursor-pointer"
              title="Crear una hoja de acordes en blanco"
            >
              <Plus className="w-4 h-4 text-[#EA580B]" />
              <span>+ Hoja en Blanco</span>
            </button>
            <div className="flex-1">
              <MusicXMLImporter onImport={handleMusicXMLImport} />
            </div>
          </div>

          {/* Fila 3: Selector de Canciones + Papelera */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={currentSong.id}
                onChange={(e) => {
                  const song = allSongs.find((s) => s.id === e.target.value);
                  if (song) {
                    setSelectedSongId(song.id);
                  }
                }}
                className="w-full bg-neutral-950 text-white rounded-lg p-2.5 pr-8 border border-neutral-700 focus:outline-none focus:border-[#EA580B] text-sm font-semibold truncate appearance-none cursor-pointer"
              >
                {allSongs.map((song) => (
                  <option
                    key={song.id}
                    value={song.id}
                    className="bg-neutral-900 text-white py-1"
                  >
                    {song.title} {song.style ? `(${song.style})` : ""}{" "}
                    {song.isCustom ? "★" : ""}
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            {/* Botón Borrar Canción Personalizada */}
            {isCustomSong ? (
              <div>
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg border border-red-500/30 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                    title="Eliminar esta canción personalizada"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/30 px-2 py-1 rounded-lg">
                    <span className="text-red-400 text-xs font-medium">¿Borrar?</span>
                    <button
                      type="button"
                      onClick={handleDeleteCurrentSong}
                      className="bg-red-500 hover:bg-red-600 text-white rounded p-1 transition cursor-pointer"
                      title="Confirmar eliminación"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded p-1 transition cursor-pointer"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled
                className="p-2.5 bg-red-500/5 text-red-500/30 rounded-lg border border-red-500/10 flex items-center justify-center shrink-0 cursor-not-allowed"
                title="Solo se pueden eliminar progresiones personalizadas"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Global Metronome (Estándares de Jazz / Creación Musical) */}
        <div className="w-full flex flex-col justify-center min-w-[280px]" key={`global-metro-${currentSong.id}-${currentSong.timeSignature || "4/4"}`}>
          <Metronome 
            key={`metro-${currentSong.id}-${currentSong.timeSignature || "4/4"}`}
            initialBPM={currentSong.tempo} 
            inline={true} 
            playbackSequence={playbackSequence}
            getPlaybackSequence={getPlaybackSequence}
            importedMelody={currentSong.importedMelody}
            songStyle={currentSong.style}
            drumStyle={activeDrumStyle}
            onDrumStyleChange={setActiveDrumStyle}
            timeSignature={currentSong.timeSignature || "4/4"}
            onTimeSignatureChange={(sig) => {
              const newSong = { ...currentSong, isCustom: currentSong.isCustom || isCustomSong, timeSignature: sig };
              setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSong : s));
            }}
            onPlayingIndexChange={setCurrentPlayingIndex}
            metronomeControlRef={metronomeControlRef}
            onCycleComplete={handleCycleComplete}
            onIsPlayingChange={handleIsPlayingChange}
            selectedMeasureIndex={selectedMeasureIndex}
            isVisible={isVisible}
            dawTracks={dawTracks}
            updateTrackVolume={(trackId, volume) => {
              const bridge = (window as any).__linusDawMixerBridge;
              if (bridge?.updateTrackVolume) {
                bridge.updateTrackVolume(trackId, volume);
              } else {
                setDawTracks(prev => prev.map(t => t.id === trackId ? { ...t, volume } : t));
              }
            }}
            toggleTrackMute={(trackId) => {
              const bridge = (window as any).__linusDawMixerBridge;
              if (bridge?.toggleTrackMute) {
                bridge.toggleTrackMute(trackId);
              } else {
                setDawTracks(prev => prev.map(t => t.id === trackId ? { ...t, isMuted: !t.isMuted } : t));
              }
            }}
            toggleTrackSolo={(trackId) => {
              const bridge = (window as any).__linusDawMixerBridge;
              if (bridge?.toggleTrackSolo) {
                bridge.toggleTrackSolo(trackId);
              } else {
                setDawTracks(prev => {
                  const next = prev.map(t => t.id === trackId ? { ...t, isSolo: !t.isSolo } : t);
                  const anyUserSolo = next.some(t => !['t-1', 't-2', 't-3'].includes(String(t?.id)) && Boolean(t?.isSolo));
                  interactiveAnalysisAudio.setExternalSoloActive(anyUserSolo);
                  return next;
                });
              }
            }}
            updateTrackPan={(trackId, pan) => {
              const bridge = (window as any).__linusDawMixerBridge;
              if (bridge?.updateTrackPan) {
                bridge.updateTrackPan(trackId, pan);
              } else {
                setDawTracks(prev => prev.map(t => t.id === trackId ? { ...t, pan } : t));
              }
            }}
            onUpdateTrackInstrument={(trackId, instrumentId) => {
              const bridge = (window as any).__linusDawMixerBridge;
              if (bridge?.updateTrackInstrument) {
                bridge.updateTrackInstrument(trackId, instrumentId);
              } else {
                setDawTracks(prev => prev.map(t => t.id === trackId ? { ...t, instrument: instrumentId, instrumentId } : t));
              }
            }}
          />
        </div>
      </div>

      <div className="w-full relative z-10 print:block print:w-full">
        {/* 2. REAL BOOK SHEET VIEW (100% Full-Width) */}
        <div className="w-full space-y-4 flex flex-col h-full print:w-full print:space-y-0">
          {/* Real Book Page Canvas */}
          <div
            id="real-book-sheet"
            className="bg-neutral-900 rounded-lg border border-neutral-800 p-5 sm:p-6 relative shadow-none print:bg-white print:border-none print:p-0 print:m-0 print:shadow-none print:w-full"
          >
            {/* Encabezado exclusivo para impresión PDF (Guía de Acordes) */}
            <div className="print-only print-header-card print:mb-6 print:text-black">
              <div className="border-b-2 border-black pb-3 mb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-black">
                  <span className="block">{currentSong.title || "Mi Nueva Progresión"}</span>
                </h1>
                <div className="text-xs font-mono text-black flex flex-wrap items-center gap-6 mt-2 font-bold uppercase">
                  <span><span className="inline-block">TEMPO: {currentSong.tempo} BPM</span></span>
                  <span><span className="inline-block">MÉTRICA: {currentSong.timeSignature || "4/4"}</span></span>
                  <span><span className="inline-block">TONALIDAD: {currentSong.defaultKey || globalKey || "C"}</span></span>
                  {currentSong.style && <span><span className="inline-block">ESTILO: {currentSong.style}</span></span>}
                  {transposition !== 0 && (
                    <span><span className="inline-block">TRANSPOSICIÓN: {transposition > 0 ? `+${transposition}` : transposition} st</span></span>
                  )}
                </div>
              </div>
            </div>

            {/* Sheet Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-zinc-800/80 print:hidden">
              <div>
                {isCustomSong ? (
                  <input
                    value={currentSong.style}
                    onChange={(e) => {
                      const newSong = { ...currentSong, isCustom: true, style: e.target.value };
                      setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSong : s));
                    }}
                    className="text-xs font-mono text-zinc-400 font-medium uppercase tracking-wider bg-transparent hover:bg-zinc-900 focus:bg-zinc-900 px-1.5 py-0.5 rounded border border-transparent focus:border-zinc-700 outline-none block mb-1.5 w-32"
                    placeholder="Estilo"
                  />
                ) : (
                  <span className="text-xs font-mono text-zinc-400 font-medium uppercase tracking-wider block mb-1.5">
                    <span className="inline-block">{currentSong.style}</span>
                  </span>
                )}
                {isCustomSong ? (
                  <input
                    value={currentSong.title}
                    onChange={(e) => {
                      const newSong = { ...currentSong, isCustom: true, title: e.target.value };
                      setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSong : s));
                    }}
                    className="text-2xl font-sans font-bold text-zinc-100 tracking-tight mt-0 uppercase bg-transparent border-b border-dashed border-zinc-700 focus:border-[#EA580B] outline-none w-full max-w-sm block"
                    placeholder="Título de la canción"
                  />
                ) : (
                  <h2
                    id="real-book-song-title"
                    className="text-2xl font-sans font-bold text-zinc-100 tracking-tight mt-1 uppercase"
                  >
                    <span className="block">{currentSong.title}</span>
                  </h2>
                )}
                <div className="text-xs font-mono text-zinc-400 mt-2 flex flex-wrap items-center gap-2">
                  <span>Tempo:</span>
                  {isCustomSong ? (
                    <>
                      <input
                        type="text"
                        value={currentSong.tempo}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newTempo = val === '' ? ('' as any) : parseInt(val);
                          if (val === '' || !isNaN(newTempo)) {
                            const newSong = { ...currentSong, tempo: newTempo };
                            setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSong : s));
                          }
                        }}
                        onBlur={(e) => {
                          const num = parseInt(e.target.value as any);
                          const validTempo = (isNaN(num) || num < 30) ? 30 : Math.min(num, 300);
                          const newSong = { ...currentSong, tempo: validTempo };
                          setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSong : s));
                        }}
                        className="text-zinc-200 font-bold bg-[#141418] border border-zinc-800 rounded px-1.5 py-0.5 focus:border-zinc-600 outline-none w-14 text-center"
                      />
                      <span className="text-zinc-600">BPM</span>
                      <span className="text-zinc-700">•</span>
                      <span>Métrica:</span>
                      <select
                        value={currentSong.timeSignature || "4/4"}
                        onChange={(e) => {
                          const newSong = { ...currentSong, isCustom: true, timeSignature: e.target.value };
                          setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSong : s));
                        }}
                        className="bg-[#141418] border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-200 font-medium outline-none cursor-pointer"
                      >
                        <option value="4/4" className="bg-zinc-900 text-zinc-200">4/4</option>
                        <option value="3/4" className="bg-zinc-900 text-zinc-200">3/4</option>
                        <option value="6/8" className="bg-zinc-900 text-zinc-200">6/8</option>
                        <option value="12/8" className="bg-zinc-900 text-zinc-200">12/8</option>
                        <option value="2/4" className="bg-zinc-900 text-zinc-200">2/4</option>
                        <option value="5/4" className="bg-zinc-900 text-zinc-200">5/4</option>
                        <option value="7/8" className="bg-zinc-900 text-zinc-200">7/8</option>
                      </select>
                      <button
                        onClick={(e) => {
                          const target = e.currentTarget;
                          if (target.dataset.confirm === "true") {
                            setAllSongs([...JAZZ_STANDARDS]);
                            localStorage.removeItem("allSongsList");
                            localStorage.removeItem("customSongs");
                            window.location.reload();
                          } else {
                            target.dataset.confirm = "true";
                            target.innerText = "¿Seguro? Clic otra vez";
                            setTimeout(() => {
                              target.dataset.confirm = "false";
                              target.innerText = "Limpiar Memoria";
                            }, 3000);
                          }
                        }}
                        title="Limpiar progresiones corruptas"
                        className="ml-2 text-[10px] bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-300 border border-zinc-800 hover:border-rose-800/50 px-2 py-0.5 rounded transition"
                      >
                        Limpiar Memoria
                      </button>
                    </>
                  ) : (
                    <span className="text-zinc-200 font-bold">
                      <span className="inline-block">{currentSong.tempo} BPM</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Current key display */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#121215] rounded border border-zinc-800 text-zinc-300 text-xs font-mono">
                <span className="text-zinc-500"><span className="inline-block">{t('academy.currentKey')}:</span></span>
                {isCustomSong && transposition === 0 ? (
                  <input
                    value={currentSong.defaultKey}
                    onChange={(e) => {
                      const newSong = { ...currentSong, isCustom: true, defaultKey: e.target.value };
                      setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSong : s));
                    }}
                    className="text-sm font-bold text-zinc-100 bg-transparent border-b border-dashed border-zinc-700 focus:border-zinc-500 outline-none w-10 text-center uppercase"
                  />
                ) : (
                  <strong className="text-sm font-bold text-zinc-100">
                    <span className="inline-block">
                      {ROOT_DISPLAY_NAME_MAP[displayedKeyCenter] || displayedKeyCenter}
                      {currentSong?.defaultIsMinor ? "m" : ""}
                    </span>
                  </strong>
                )}
              </div>
            </div>

            {currentSong.audioUrl && currentSong.analyzedChordsData ? (
              <div className="print:hidden">
                <InteractiveAudioTracker
                  audioUrl={currentSong.audioUrl}
                  chordsData={currentSong.analyzedChordsData}
                />
              </div>
            ) : (
              <>
                {/* 1. BLOQUE SUPERIOR: TECLADO MIDI GLOBAL EN VIVO (Para controladores como Oxygen 25/49/61) */}
                <div className="mb-4">
                  <GlobalMidiKeyboard 
                    startNote={36} 
                    numKeys={61} 
                    currentStyle={activeDrumStyle}
                    onStyleChange={(newStyle) => {
                      if (activeDrumStyle !== newStyle) {
                        setActiveDrumStyle(newStyle);
                      }
                      if (currentSong && currentSong.style !== newStyle) {
                        const newSong = { ...currentSong, style: newStyle };
                        setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSong : s));
                      }
                    }}
                    bpm={currentSong?.tempo}
                    onBpmChange={(newBpm) => {
                      if (currentSong && currentSong.tempo !== newBpm) {
                        const newSong = { ...currentSong, tempo: newBpm };
                        setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSong : s));
                      }
                    }}
                    timeSignature={currentSong?.timeSignature || "4/4"}
                    onTimeSignatureChange={(sig) => {
                      if (currentSong && currentSong.timeSignature !== sig) {
                        const newSong = { ...currentSong, timeSignature: sig };
                        setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSong : s));
                      }
                    }}
                    onOpenMixer={() => {
                      window.dispatchEvent(new CustomEvent('open-mixer-modal'));
                      const btn = document.getElementById('open-mixer-modal-btn');
                      if (btn) btn.click();
                    }}
                    onStopSequence={() => {
                      if (metronomeControlRef.current) {
                        metronomeControlRef.current.stop();
                      }
                      handleIsPlayingChange(false);
                    }}
                    playbackSequence={playbackSequence}
                    currentSong={transposedSongForScore}
                    transposition={transposition}
                    globalKey={displayedKeyCenter}
                    isVisible={isVisible}
                    onTracksChange={handleDawTracksChange}
                  />
                </div>

                {/* 2. BLOQUE CENTRAL: HERRAMIENTAS DE CREACIÓN MUSICAL */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-4 shadow-none space-y-4 relative print:hidden">
                  
                  {/* Header: Flexbox superior con círculo 2 naranja y botones a la derecha */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#EA580B] text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm shrink-0 shadow-none">
                        2
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-sm sm:text-base font-bold text-white tracking-wide uppercase font-sans leading-tight">
                          HERRAMIENTAS DE CREACIÓN MUSICAL
                        </h3>
                        <p className="text-xs text-neutral-400 font-sans mt-0.5">
                          Construye, analiza y rearmoniza tu progresión
                        </p>
                      </div>
                    </div>

                    {/* Grupo de acciones de cabecera: Pills de vista + Botones de gestión (Guardar, Cargar, Métrica, Eliminar, Compás) */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* --- GESTIÓN DE ARCHIVOS Y CANCIONES --- */}
                      {/* Selector de Canciones / Colección de Progresiones (50 Estándares Organizados por Categoría) */}
                      <div className="relative group/tip flex items-center">
                        <div className="relative flex items-center">
                          <FileMusic size={13} className="absolute left-2.5 text-neutral-400 pointer-events-none" />
                          <select
                            id="song-selector-dropdown"
                            value={selectedSongId}
                            onChange={(e) => setSelectedSongId(e.target.value)}
                            className="bg-neutral-800 hover:bg-neutral-700/80 text-neutral-200 border border-neutral-700 rounded-lg pl-8 pr-7 h-9 text-xs font-sans outline-none focus:border-[#EA580B] transition-colors appearance-none cursor-pointer max-w-[200px] sm:max-w-[280px] truncate"
                            title="Colección de Progresiones"
                          >
                            {[
                              "Mis Progresiones Personalizadas",
                              "Estándares de Jazz / Swing",
                              "Bebop & Up-Tempo Swing",
                              "Bossa Nova & Latin Jazz",
                              "Gypsy Jazz / Manouche",
                              "Modal & Post-Bop",
                              "Funk, Soul Jazz & Blues",
                              "Baladas de Jazz",
                            ].map((groupName) => {
                              const groupSongs = allSongs.filter(
                                (s) => getSongCategoryGroup(s) === groupName
                              );
                              if (groupSongs.length === 0) return null;
                              return (
                                <optgroup
                                  key={groupName}
                                  label={`${groupName} (${groupSongs.length})`}
                                  className="bg-neutral-950 text-[#EA580B] font-semibold"
                                >
                                  {groupSongs.map((song) => {
                                    const keyLabel = `${song.defaultKey}${
                                      song.defaultIsMinor && !String(song.defaultKey).endsWith("m")
                                        ? "m"
                                        : ""
                                    }`;
                                    const barCount = song.measures?.length || 0;
                                    return (
                                      <option
                                        key={song.id}
                                        value={song.id}
                                        className="bg-neutral-900 text-neutral-200 font-normal"
                                      >
                                        {song.title} ({song.style}) - {keyLabel} [{barCount} bars]
                                      </option>
                                    );
                                  })}
                                </optgroup>
                              );
                            })}
                          </select>
                          <ChevronDown size={13} className="absolute right-2 text-neutral-400 pointer-events-none" />
                        </div>
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-neutral-900 border border-neutral-700 rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
                          Colección de Progresiones ({allSongs.length})
                        </span>
                      </div>

                      {/* Botón Hoja en Blanco */}
                      <div className="relative group/tip flex items-center">
                        <button
                          type="button"
                          id="btn-blank-sheet"
                          onClick={() => {
                            const newSong: Song = {
                              id: `custom-${Date.now()}`,
                              title: 'Mi Nueva Progresión',
                              defaultKey: 'C',
                              style: 'Swing',
                              tempo: 120,
                              isCustom: true,
                              sections: { "A": 0 },
                              measures: [
                                { id: `m-1-${Date.now()}`, chords: [''], sectionLabel: "[A]", repeatStart: true },
                                { id: `m-2-${Date.now()}`, chords: [''] },
                                { id: `m-3-${Date.now()}`, chords: [''] },
                                { id: `m-4-${Date.now()}`, chords: [''], repeatEnd: true }
                              ]
                            };
                            setAllSongs([...allSongs, newSong]);
                            setSelectedSongId(newSong.id);
                            setSelectedMeasureIndex(0);
                            setSelectedChordSlotIndex(0);
                          }}
                          className="h-9 px-2.5 sm:px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 rounded-lg text-xs font-sans font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                          title="Crear Hoja en Blanco"
                          aria-label="Hoja en Blanco"
                        >
                          <FilePlus size={14} className="text-[#EA580B]" />
                          <span className="hidden sm:inline">Hoja en Blanco</span>
                        </button>
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-neutral-900 border border-neutral-700 rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
                          Crear Hoja en Blanco
                        </span>
                      </div>

                      {/* Botón Subir MusicXML */}
                      <div className="relative group/tip flex items-center">
                        <MusicXMLImporter
                          compact={true}
                          onImport={(song) => {
                            setAllSongs([...allSongs, song]);
                            setSelectedSongId(song.id);
                          }}
                        />
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-neutral-900 border border-neutral-700 rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
                          Subir MusicXML (.xml, .musicxml)
                        </span>
                      </div>

                      <div className="h-4 w-px bg-neutral-800 mx-1 hidden sm:block" />
                      {/* Botón 1: Paleta de recursos */}
                      <div className="relative group/tip flex items-center">
                        <button
                          type="button"
                          onClick={() => setShowResourcePalette(!showResourcePalette)}
                          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                            showResourcePalette
                              ? "bg-[#EA580B] text-white shadow-sm"
                              : "bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 border border-neutral-700"
                          }`}
                          aria-label="Paleta de recursos"
                        >
                          <Palette size={18} />
                        </button>
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-neutral-900 border border-neutral-700 rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
                          Paleta de recursos
                        </span>
                      </div>

                      {/* Botón 2: Análisis armónico */}
                      <div className="relative group/tip flex items-center">
                        <button
                          type="button"
                          onClick={() => setShowAnalysis(!showAnalysis)}
                          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                            showAnalysis
                              ? "bg-[#EA580B] text-white shadow-sm"
                              : "bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 border border-neutral-700"
                          }`}
                          aria-label="Análisis armónico"
                        >
                          <Activity size={18} />
                        </button>
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-neutral-900 border border-neutral-700 rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
                          Análisis armónico
                        </span>
                      </div>

                      {/* Botón 3: Modo profesor */}
                      <div className="relative group/tip flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditMode(!isEditMode);
                            setEditingCell(null);
                          }}
                          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                            isEditMode
                              ? "bg-[#EA580B] text-white shadow-sm"
                              : "bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 border border-neutral-700"
                          }`}
                          aria-label="Modo profesor"
                        >
                          <GraduationCap size={18} />
                        </button>
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-neutral-900 border border-neutral-700 rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
                          Modo profesor
                        </span>
                      </div>

                      {/* Botón 4: Ver Acorde / Teclado */}
                      <div className="relative group/tip flex items-center">
                        <button
                          type="button"
                          onClick={() => setShowChordModal(true)}
                          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                            showChordModal
                              ? "bg-[#EA580B] text-white shadow-sm"
                              : "bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 border border-neutral-700"
                          }`}
                          aria-label="Ver Acorde / Teclado"
                        >
                          <Piano size={18} />
                        </button>
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-neutral-900 border border-neutral-700 rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
                          Ver Acorde / Teclado
                        </span>
                      </div>

                      {/* Botón 5: Ver Escala / Diagrama */}
                      <div className="relative group/tip flex items-center">
                        <button
                          type="button"
                          onClick={() => setShowScaleModal(true)}
                          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                            showScaleModal
                              ? "bg-[#EA580B] text-white shadow-sm"
                              : "bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 border border-neutral-700"
                          }`}
                          aria-label="Ver Escala / Diagrama"
                        >
                          <Eye size={18} />
                        </button>
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-neutral-900 border border-neutral-700 rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
                          Ver Escala / Diagrama
                        </span>
                      </div>

                      <div className="h-4 w-px bg-neutral-800 mx-1 hidden sm:block" />

                      {/* Selector de Compás Activo */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <label htmlFor="active-measure-selector" className="text-neutral-400 text-xs font-mono">
                          Compás:
                        </label>
                        <select
                          id="active-measure-selector"
                          value={selectedMeasureIndex ?? 0}
                          onChange={(e) => {
                            const idx = Number(e.target.value);
                            setSelectedMeasureIndex(idx);
                            setSelectedChordSlotIndex(0);
                          }}
                          className="bg-neutral-800 hover:bg-neutral-700/80 text-neutral-200 border border-neutral-700 rounded-lg px-2 py-1 text-xs font-mono outline-none cursor-pointer focus:border-[#EA580B] transition-colors"
                        >
                          {(currentSong.measures || []).map((m, idx) => {
                            const slotCount = (m?.chords?.length || 1) <= 1 ? '1 slot' : (m?.chords?.length || 1) === 2 ? '2 slots' : '4 slots';
                            return (
                              <option key={m.id || idx} value={idx} className="bg-neutral-900 text-neutral-200">
                                #{idx + 1} ({slotCount})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Selector de Métrica */}
                      <select
                        value={currentSong.timeSignature || "4/4"}
                        onChange={(e) => {
                          const newSong = { ...currentSong, isCustom: true, timeSignature: e.target.value };
                          setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSong : s));
                        }}
                        className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg px-2 py-1 text-xs font-mono outline-none cursor-pointer"
                        title="Métrica activa"
                      >
                        <option value="4/4">4/4</option>
                        <option value="3/4">3/4</option>
                        <option value="6/8">6/8</option>
                        <option value="12/8">12/8</option>
                        <option value="2/4">2/4</option>
                        <option value="5/4">5/4</option>
                        <option value="7/8">7/8</option>
                      </select>

                      {/* Control de Transposición integrado en Bloque 2 */}
                      <div className="flex items-center gap-1.5 bg-neutral-950/80 border border-neutral-800 rounded-lg px-2 py-1 text-xs font-mono shrink-0">
                        <span className="text-neutral-400 flex items-center gap-1 text-[11px]" title="Transposición">
                          <ArrowLeftRight size={12} className="text-neutral-400" />
                          <span className="hidden sm:inline">Transp:</span>
                        </span>
                        <div className="flex items-center gap-1">
                          {/* Minus */}
                          <button
                            id="btn-transpose-down"
                            type="button"
                            onClick={() => handleTranspose(-1)}
                            className="p-0.5 px-1.5 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 hover:text-white active:scale-95 text-neutral-300 rounded font-medium transition cursor-pointer text-xs"
                            title="Bajar semitono"
                          >
                            <Minus size={10} className="inline mr-0.5" />
                            <span>♭</span>
                          </button>

                          {/* Current Value */}
                          <span
                            className={`px-1.5 font-bold min-w-[2.8rem] text-center rounded py-0.5 text-xs ${
                              transposition === 0
                                ? "text-neutral-500 bg-neutral-900 border border-neutral-800"
                                : "text-[#EA580B] bg-[#EA580B]/10 border border-[#EA580B]"
                            }`}
                          >
                            {transposition > 0 ? `+${transposition}` : transposition} st
                          </span>

                          {/* Plus */}
                          <button
                            id="btn-transpose-up"
                            type="button"
                            onClick={() => handleTranspose(1)}
                            className="p-0.5 px-1.5 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 hover:text-white active:scale-95 text-neutral-300 rounded font-medium transition cursor-pointer text-xs"
                            title="Subir semitono"
                          >
                            <Plus size={10} className="inline mr-0.5" />
                            <span>♯</span>
                          </button>

                          {/* Reset */}
                          {transposition !== 0 && (
                            <button
                              id="btn-transpose-reset"
                              type="button"
                              onClick={handleResetTranspose}
                              className="p-1 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-neutral-400 hover:text-white transition rounded cursor-pointer"
                              title="Restablecer tonalidad original"
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Botón Principal de Exportar */}
                      <div className="relative group/tip flex items-center">
                        <button
                          type="button"
                          onClick={() => setIsExportModalOpen(true)}
                          className="h-9 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 hover:border-neutral-600 text-xs font-sans font-semibold transition cursor-pointer shrink-0"
                          aria-label="Exportar / Guardar Proyecto"
                        >
                          <Download size={15} className="text-[#EA580B]" />
                          <span>Exportar</span>
                        </button>
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-neutral-900 border border-neutral-700 rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
                          Exportar / Guardar Proyecto
                        </span>
                      </div>

                      {/* Cargar Sesión (Carpeta) */}
                      <div className="relative group/tip flex items-center">
                        <button
                          type="button"
                          onClick={handleTriggerFileInput}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-amber-400 hover:text-amber-300 transition cursor-pointer"
                          aria-label="Cargar Sesión"
                        >
                          <FolderOpen size={16} />
                        </button>
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-neutral-900 border border-neutral-700 rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
                          Cargar Sesión
                        </span>
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".linus,.json"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Input Principal de Acorde Actual */}
                  <div
                    className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-neutral-950 border border-[#EA580B] rounded-lg p-3 mt-4 gap-3 relative"
                    ref={quickChordInputRef}
                  >
                    {/* A la izquierda: texto "Acorde actual" en negrita y texto de ayuda debajo */}
                    <div className="flex flex-col shrink-0">
                      <span className="font-bold text-sm text-neutral-100 flex items-center gap-2">
                        Acorde actual
                        {selectedMeasureIndex !== null && (
                          <span className="text-[10px] font-mono text-[#EA580B] bg-[#EA580B]/10 px-2 py-0.5 rounded border border-[#EA580B]/20">
                            Compás #{selectedMeasureIndex + 1} • Slot {(selectedChordSlotIndex ?? 0) + 1}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-neutral-400">
                        Ingresa un acorde para analizar...
                      </span>
                    </div>

                    {/* En el centro: input grande (texto blanco, fondo transparente) */}
                    <div className="flex-1 relative mx-0 sm:mx-4">
                      <input
                        type="text"
                        value={quickChordInput}
                        onChange={(e) => {
                          setQuickChordInput(e.target.value);
                          setIsQuickChordDropdownOpen(true);
                        }}
                        onFocus={() => setIsQuickChordDropdownOpen(true)}
                        onClick={() => setIsQuickChordDropdownOpen(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setIsQuickChordDropdownOpen(false);
                            if (selectedMeasureIndex !== null) {
                              handleUpdateChordName(selectedMeasureIndex, selectedChordSlotIndex, quickChordInput);
                            }
                          }
                        }}
                        placeholder="Ej: Am7"
                        className="w-full bg-transparent text-lg md:text-xl font-mono font-bold text-white placeholder-neutral-500 outline-none px-2 py-1 focus:outline-none"
                      />

                      {/* Dropdown de sugerencias si aplica */}
                      {isQuickChordDropdownOpen && quickChordSuggestions.length > 0 && (
                        <ul className="absolute top-[110%] left-0 right-0 min-w-[200px] z-[99999] bg-neutral-900 border border-neutral-800 rounded-md shadow-2xl max-h-60 overflow-y-auto divide-y divide-neutral-800 custom-scrollbar text-left">
                          {quickChordSuggestions.map((suggestion) => (
                            <li
                              key={suggestion.chord}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setQuickChordInput(suggestion.chord);
                                setIsQuickChordDropdownOpen(false);
                                if (selectedMeasureIndex !== null) {
                                  handleUpdateChordName(selectedMeasureIndex, selectedChordSlotIndex, suggestion.chord);
                                }
                              }}
                              className="hover:bg-[#EA580B] hover:text-white px-3 py-2 cursor-pointer text-left font-mono transition-colors text-neutral-200 flex items-center justify-between gap-2 group"
                            >
                              <span className="text-sm font-bold font-mono tracking-wide group-hover:text-white text-neutral-100">
                                {suggestion.chord}
                              </span>
                              {suggestion.label && (
                                <span className="text-xs text-neutral-400 group-hover:text-black/90 font-sans truncate">
                                  {suggestion.label}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* A la derecha: botón grande naranja (bg-[#EA580B]) "Aplicar ->" */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsQuickChordDropdownOpen(false);
                        if (selectedMeasureIndex !== null) {
                          handleUpdateChordName(selectedMeasureIndex, selectedChordSlotIndex, quickChordInput);
                        }
                      }}
                      className="bg-[#EA580B] hover:bg-[#d94e08] active:scale-[0.98] text-white font-semibold text-xs md:text-sm px-5 py-2.5 rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <span>Aplicar</span>
                      <span className="font-mono text-base leading-none">→</span>
                    </button>
                  </div>

                  {/* Grilla Inferior de Herramientas (3 Columnas Uniformes): grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 */}
                  {showResourcePalette && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        {/* Columna 1 (Estructura/Partes) */}
                        <div className="flex flex-col gap-2.5 bg-neutral-950/60 p-4 rounded-lg border border-neutral-800">
                          <div className="flex items-center justify-between text-xs font-sans text-neutral-400 font-semibold uppercase tracking-wider">
                            <span>Estructura / Partes</span>
                            {selectedMeasure?.sectionLabel && (
                              <span className="text-[#EA580B] font-mono text-[10px] font-bold">
                                {selectedMeasure.sectionLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {[
                              { label: 'A', value: '[A]' },
                              { label: 'B', value: '[B]' },
                              { label: 'C', value: '[C]' },
                              { label: 'Intro', value: '[Intro]' },
                              { label: 'Coda', value: '[Coda]' },
                            ].map((item) => {
                              const isSecActive = selectedMeasure?.sectionLabel === item.value || selectedMeasure?.sectionLabel === item.label;
                              return (
                                <button
                                  key={item.label}
                                  type="button"
                                  onClick={() => handleToggleSection(item.value)}
                                  className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition cursor-pointer min-w-[36px] text-center ${
                                    isSecActive
                                      ? "bg-[#EA580B] text-white font-bold shadow-none"
                                      : "bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 shadow-none"
                                  }`}
                                  title={`Alternar marcador ${item.value}`}
                                >
                                  {item.label}
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => handleAddMeasureAfter(selectedMeasureIndex ?? 0)}
                              className="px-3 py-1.5 rounded text-xs font-mono font-medium transition cursor-pointer bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 min-w-[36px] text-center flex items-center justify-center gap-1"
                              title="Añadir nuevo compás (+)"
                            >
                              <Plus size={13} />
                            </button>
                            {selectedMeasure?.sectionLabel && (
                              <button
                                type="button"
                                onClick={handleClearSection}
                                className="p-1.5 rounded text-xs font-mono text-neutral-400 hover:text-rose-400 bg-neutral-800 hover:bg-neutral-700 transition cursor-pointer"
                                title="Quitar marcador de sección"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Columna 2 (Barras y Casillas) */}
                        <div className="flex flex-col gap-2.5 bg-neutral-950/60 p-4 rounded-lg border border-neutral-800">
                          <div className="flex items-center justify-between text-xs font-sans text-neutral-400 font-semibold uppercase tracking-wider">
                            <span>Barras y Casillas</span>
                            <div className="flex items-center gap-1 font-mono text-[10px]">
                              {selectedMeasure?.volta && (
                                <span className="text-[#EA580B] font-bold">Volta {selectedMeasure.volta}.</span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {/* Inicio */}
                            <button
                              type="button"
                              onClick={() => handleToggleRepeatStart(selectedMeasureIndex ?? 0)}
                              className={`py-2 px-2.5 rounded text-xs font-mono font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                                selectedMeasure?.repeatStart
                                  ? "bg-[#EA580B] text-white font-bold shadow-none"
                                  : "bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 shadow-none"
                              }`}
                              title="Barra de repetición inicial |:"
                            >
                              <span className="font-serif font-bold">|:</span> <span>Inicio</span>
                            </button>

                            {/* Fin */}
                            <button
                              type="button"
                              onClick={() => handleToggleRepeatEnd(selectedMeasureIndex ?? 0)}
                              className={`py-2 px-2.5 rounded text-xs font-mono font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                                selectedMeasure?.repeatEnd
                                  ? "bg-[#EA580B] text-white font-bold shadow-none"
                                  : "bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 shadow-none"
                              }`}
                              title="Barra de repetición final :|"
                            >
                              <span>Fin</span> <span className="font-serif font-bold">:|</span>
                            </button>

                            {/* Casilla 1. */}
                            <button
                              type="button"
                              onClick={() => handleToggleVolta(selectedMeasureIndex ?? 0, 1)}
                              className={`py-2 px-2.5 rounded text-xs font-mono font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                                selectedMeasure?.volta === 1
                                  ? "bg-[#EA580B] text-white font-bold shadow-none"
                                  : "bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 shadow-none"
                              }`}
                              title="Casilla de repetición 1."
                            >
                              <span>1.</span>
                            </button>

                            {/* Casilla 2. */}
                            <button
                              type="button"
                              onClick={() => handleToggleVolta(selectedMeasureIndex ?? 0, 2)}
                              className={`py-2 px-2.5 rounded text-xs font-mono font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                                selectedMeasure?.volta === 2
                                  ? "bg-[#EA580B] text-white font-bold shadow-none"
                                  : "bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 shadow-none"
                              }`}
                              title="Casilla de repetición 2."
                            >
                              <span>2.</span>
                            </button>
                          </div>

                          {/* Checkbox de Repetir (%) */}
                          <label className="flex items-center gap-2 mt-1 cursor-pointer select-none text-xs text-neutral-300 hover:text-white transition-colors">
                            <input
                              type="checkbox"
                              checked={Boolean(
                                selectedMeasure?.chords?.[selectedChordSlotIndex ?? 0] === '%' ||
                                selectedMeasure?.chords?.[0] === '%'
                              )}
                              onChange={(e) => {
                                if (selectedMeasureIndex !== null) {
                                  const slot = selectedChordSlotIndex ?? 0;
                                  const newVal = e.target.checked ? '%' : '';
                                  setQuickChordInput(newVal);
                                  handleUpdateChordName(selectedMeasureIndex, slot, newVal);
                                }
                              }}
                              className="w-4 h-4 rounded bg-neutral-800 border-neutral-700 text-[#EA580B] accent-[#EA580B] cursor-pointer"
                            />
                            <span className="font-mono text-xs flex items-center gap-1">
                              <span className="font-bold text-[#EA580B] font-serif text-sm leading-none">%</span> Repetir (%)
                            </span>
                          </label>
                        </div>

                        {/* Columna 3 (Ritmo Armónico) */}
                        <div className="flex flex-col gap-2.5 bg-neutral-950/60 p-4 rounded-lg border border-neutral-800">
                          <div className="flex items-center justify-between text-xs font-sans text-neutral-400 font-semibold uppercase tracking-wider">
                            <span>Ritmo Armónico</span>
                            <span className="text-neutral-500 font-mono text-[10px]">
                              {(selectedMeasure?.chords?.length || 1) <= 1 ? '1 slot' : (selectedMeasure?.chords?.length || 1) === 2 ? '2 slots' : '4 slots'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => handleSetMeasureSubdivision(1)}
                              className={`py-2 px-1 rounded text-xs font-mono font-medium transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                                (selectedMeasure?.chords?.length || 1) <= 1
                                  ? "bg-[#EA580B] text-white font-bold shadow-none"
                                  : "bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 shadow-none"
                              }`}
                              title="1 acorde por compás (redonda)"
                            >
                              <span className="font-bold text-xs leading-none">1 Slot</span>
                              <span className={`text-[10px] ${(selectedMeasure?.chords?.length || 1) <= 1 ? 'text-white/90' : 'text-neutral-400'}`}>
                                Redonda
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetMeasureSubdivision(2)}
                              className={`py-2 px-1 rounded text-xs font-mono font-medium transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                                (selectedMeasure?.chords?.length || 1) === 2
                                  ? "bg-[#EA580B] text-white font-bold shadow-none"
                                  : "bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 shadow-none"
                              }`}
                              title="2 acordes por compás (blancas)"
                            >
                              <span className="font-bold text-xs leading-none">2 Slots</span>
                              <span className={`text-[10px] ${(selectedMeasure?.chords?.length || 1) === 2 ? 'text-white/90' : 'text-neutral-400'}`}>
                                Blancas
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetMeasureSubdivision(4)}
                              className={`py-2 px-1 rounded text-xs font-mono font-medium transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                                (selectedMeasure?.chords?.length || 1) >= 3
                                  ? "bg-[#EA580B] text-white font-bold shadow-none"
                                  : "bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 shadow-none"
                              }`}
                              title="4 acordes por compás (negras)"
                            >
                              <span className="font-bold text-xs leading-none">4 Slots</span>
                              <span className={`text-[10px] ${(selectedMeasure?.chords?.length || 1) >= 3 ? 'text-white/90' : 'text-neutral-400'}`}>
                                Negras
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                  )}
                </div>

                {/* 3. BLOQUE INFERIOR: PROGRESIÓN / ESTRUCTURA DE LA CANCIÓN (Continuous Dark Lead Sheet Canvas) */}
                <div className="mt-4 bg-neutral-950 border border-neutral-800 rounded-lg p-2 sm:p-4 overflow-hidden real-book-grid print:mt-0 print:border-none print:p-0 print:w-full print:bg-white">
                  <div className="grid grid-cols-4 gap-0 overflow-visible print:grid print:grid-cols-4 print:gap-0 print:w-full">
                  {(currentSong?.measures || []).map((measure, index) => {
                    // Etiqueta de sección de la partitura (ej: [A], [B], [Intro], [Coda])
                    let sectionLabel: string | null = measure.sectionLabel || null;
                    if (!sectionLabel && currentSong.sections) {
                      const foundSec = Object.entries(currentSong.sections).find(
                        ([_, startIdx]) => startIdx === index,
                      );
                      if (foundSec) {
                        sectionLabel = foundSec[0].startsWith('[') ? foundSec[0] : `[${foundSec[0]}]`;
                      }
                    }

                    // Detection for Modulation Banner
                    const flatIndexCurrentFirstMeasureChord = measureFlatIndices[index] ?? 0;
                    const firstAnalysis =
                      analyzedChords[flatIndexCurrentFirstMeasureChord];
                    const prevAnalysisLastMeasure =
                      flatIndexCurrentFirstMeasureChord > 0
                        ? analyzedChords[flatIndexCurrentFirstMeasureChord - 1]
                        : null;

                    const isModulation =
                      showAnalysis &&
                      firstAnalysis &&
                      prevAnalysisLastMeasure &&
                      (firstAnalysis.keyContext !==
                        prevAnalysisLastMeasure.keyContext ||
                        firstAnalysis.isMinorKey !==
                          prevAnalysisLastMeasure.isMinorKey);

                    let modulationBanner = null;
                    if (isModulation) {
                      let transposedKeyContext = transposeRoot(
                        firstAnalysis.keyContext,
                        transposition,
                        globalKey,
                      );
                      let isOriginalDefault =
                        firstAnalysis.keyContext === globalKey &&
                        firstAnalysis.isMinorKey === globalIsMinor;
                      let text = isOriginalDefault
                        ? `${t('academy.returnTo')} ${transposedKeyContext} ${firstAnalysis.isMinorKey ? t('academy.minor') : t('academy.major')}`
                        : `${t('academy.modulationTo')} ${transposedKeyContext} ${firstAnalysis.isMinorKey ? t('academy.minor') : t('academy.major')}`;

                      modulationBanner = (
                        <div className="col-span-4 mt-2 mb-1 border-b border-neutral-800 pb-1 flex items-center justify-center print:border-black">
                          <span className="text-neutral-500 text-xs uppercase tracking-widest font-semibold font-mono print:text-black">
                            <span className="block">{text}</span>
                          </span>
                        </div>
                      );
                    }

                    // Subdivisión de Acordes (Ritmo Armónico: 1, 2 o 4 casilleros)
                    const rawChordsList = (measure?.chords && measure.chords.length > 0) ? measure.chords : [''];
                    const slotCount: 1 | 2 | 4 = rawChordsList.length <= 1 ? 1 : rawChordsList.length === 2 ? 2 : 4;
                    const slots = Array.from({ length: slotCount }, (_, i) => rawChordsList[i] ?? '');

                    const isLastInRow = (index + 1) % 4 === 0;

                    return (
                      <Fragment key={measure.id}>
                        {modulationBanner}
                        <div className="col-span-1 relative overflow-visible">
                          {/* Marcador de Estructura / Partes de la Partitura ([A], [B], [Intro], [Coda]) */}
                          {sectionLabel ? (
                            <div className="absolute -top-3 left-1 z-30 flex items-center gap-1 pointer-events-none">
                              <span className="bg-neutral-900 text-[#EA580B] font-mono font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider uppercase border border-[#EA580B]/60 flex items-center gap-1 shadow-none measure-section-badge print:bg-white print:text-black print:border-black print:shadow-none">
                                <Bookmark size={9} className="text-[#EA580B] print:text-black" />
                                <span className="inline-block text-[#EA580B] font-bold tracking-wider">{sectionLabel.replace('Sección', t('academy.section')).replace('final', t('academy.final'))}</span>
                              </span>
                            </div>
                          ) : null}

                          {/* Celda de Compás Lead Sheet (Sin tarjeta, línea divisoria vertical y horizontal) */}
                          <div
                            onClick={() => {
                              setSelectedMeasureIndex(index);
                              const nextSlot = selectedChordSlotIndex >= slotCount ? 0 : selectedChordSlotIndex;
                              if (selectedChordSlotIndex >= slotCount) {
                                setSelectedChordSlotIndex(0);
                              }
                              const targetFlatIdx = (measureFlatIndices[index] ?? 0) + nextSlot;
                              syncDawPlayheadToMeasure(index, nextSlot, targetFlatIdx);
                            }}
                            className={`relative overflow-visible group bg-transparent min-h-[76px] flex items-center justify-center p-1.5 pt-2 transition-colors duration-150 cursor-pointer measure-cell-box border-b border-neutral-800 ${
                              isLastInRow ? "" : "border-r border-neutral-700"
                            } print:bg-white print:border-b print:border-r print:border-black print:text-black print:shadow-none print:min-h-[68px] ${
                              selectedMeasureIndex === index
                                ? "bg-neutral-900/60"
                                : "hover:bg-neutral-900/30"
                            }`}
                          >
                            {/* Signo / Barra de Repetición de Inicio |: (Borde Izquierdo) */}
                            {measure.repeatStart && (
                              <div className="absolute left-0 top-0 bottom-0 flex items-center z-10 pointer-events-none pl-0.5 select-none">
                                <div className="w-[3px] h-full bg-neutral-200 measure-barline print:bg-black"></div>
                                <div className="w-[1px] h-full bg-neutral-500 measure-barline print:bg-black ml-[2px]"></div>
                                <div className="flex flex-col gap-2 ml-[2.5px]">
                                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-200 measure-repeat-dot print:bg-black"></div>
                                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-200 measure-repeat-dot print:bg-black"></div>
                                </div>
                              </div>
                            )}

                            {/* Signo / Barra de Repetición de Fin :| (Borde Derecho) */}
                            {measure.repeatEnd && (
                              <div className="absolute right-0 top-0 bottom-0 flex items-center z-10 pointer-events-none pr-0.5 select-none">
                                <div className="flex flex-col gap-2 mr-[2.5px]">
                                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-200 measure-repeat-dot print:bg-black"></div>
                                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-200 measure-repeat-dot print:bg-black"></div>
                                </div>
                                <div className="w-[1px] h-full bg-neutral-500 measure-barline print:bg-black mr-[2px]"></div>
                                <div className="w-[3px] h-full bg-neutral-200 measure-barline print:bg-black"></div>
                              </div>
                            )}

                            {/* Casilla de repetición (Volta 1 o 2: 1. ───┐ / 2. ───┐) */}
                            {measure.volta && (
                              <div className="absolute top-0 left-0 right-0 h-3.5 pointer-events-none z-20 flex items-start select-none">
                                <div className="w-full border-t border-r border-neutral-500 h-3 flex items-start print:border-black">
                                  <span className={`bg-neutral-950 text-neutral-300 font-mono font-bold text-[9px] px-1 -mt-1.5 border border-neutral-700 rounded-none shadow-none print:bg-white print:text-black print:border-black ${sectionLabel ? 'ml-14' : 'ml-1'}`}>
                                    <span className="inline-block">{measure.volta}.</span>
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Marcador END (Fin de Tema / Fine) al final del compás */}
                            {measure.isEnd && (
                              <div className="absolute -top-2.5 right-1.5 z-30 pointer-events-none select-none">
                                <span className="bg-neutral-900 text-rose-400 font-mono font-bold text-[9px] px-1.5 py-0.5 rounded border border-rose-900 shadow-none tracking-wider uppercase flex items-center gap-1 print:bg-white print:text-black print:border-black">
                                  <span className="inline-block">END</span>
                                </span>
                              </div>
                            )}
                            {measure.isEnd && (
                              <div className="absolute right-0 top-0 bottom-0 w-[4px] bg-neutral-300 pointer-events-none print:bg-black mr-[1px] z-10"></div>
                            )}

                            {/* Índice del compás (sutil y discreto arriba a la izquierda) */}
                            <span className="absolute top-0.5 left-1 text-[8.5px] font-mono text-neutral-600 pointer-events-none select-none print:text-black print:opacity-70">
                              <span className="block">{index + 1}</span>
                            </span>

                            {/* Subdivisión de Acordes (Ritmo Armónico: 1, 2 o 4 casilleros) */}
                            <div
                              className="grid w-full h-full min-h-[56px] items-stretch gap-1 relative z-10"
                              style={{
                                gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))`
                              }}
                            >
                              {slots.map((rawChord, slotIdx) => {
                                const rawChordName = typeof rawChord === 'string' ? rawChord : ((rawChord as any)?.chordName || (rawChord as any)?.name || (rawChord as any)?.text || '');
                                const actualChordName = sanitizeChordString(rawChordName);
                                const transposedChordName = transposeChordString(
                                  actualChordName,
                                  transposition,
                                  globalKey,
                                );
                                const flatIndex = (measureFlatIndices[index] ?? 0) + slotIdx;

                                const isSlotSelected = selectedMeasureIndex === index && selectedChordSlotIndex === slotIdx;
                                const isFocused = focusedChord?.flatIndex === flatIndex;
                                const isPlaying = currentPlayingIndex === flatIndex;
                                const overrideKey = `${currentSong.id}-${flatIndex}`;
                                const measureAnalysis = analyzedMeasures[index]?.[slotIdx];
                                let analyzeRes = measureAnalysis || analyzeChord(actualChordName, flatIndex, allRawChords, globalKey + (globalIsMinor ? 'm' : ''));

                                const parsedOriginal = (actualChordName === '%' && analyzeRes)
                                  ? { root: (analyzeRes as any).root || 'C', type: (analyzeRes as any).type || 'Mayor', suffix: '' }
                                  : parseChord(actualChordName);
                                let baseAnalysis: AnalyzedChord = measureAnalysis || {
                                  chordString: actualChordName,
                                  root: (analyzeRes as any).root || parsedOriginal.root,
                                  type: (analyzeRes as any).type || parsedOriginal.type,
                                  keyContext: analyzeRes.keyContext || (globalKey as any),
                                  isMinorKey: analyzeRes.isMinorKey || globalIsMinor,
                                  romanNumeral: analyzeRes.romanNumeral,
                                  category: analyzeRes.category as any,
                                  color: analyzeRes.color,
                                  suggestedScale: analyzeRes.suggestedScale
                                };
                                let analysis = baseAnalysis;

                                if (customAnalyses[overrideKey]) {
                                  analysis = {
                                    ...baseAnalysis,
                                    romanNumeral: customAnalyses[overrideKey].numeral,
                                    category: customAnalyses[overrideKey].category as AnalysisCategory
                                  };
                                }

                                const colors = getHarmonicFunctionClasses(analysis?.category || 'none');
                                let romanColorClass = colors.text;
                                let sequenceGroupingClass = colors.bg;

                                const isCustomGrouped = customAnalyses[overrideKey]?.groupWithNext;
                                if (showAnalysis && analysis) {
                                  if (isCustomGrouped) {
                                    sequenceGroupingClass = "bg-zinc-500/10 ring-1 ring-zinc-500/30 hover:bg-zinc-500/20";
                                  }
                                  if (isEditMode) {
                                    sequenceGroupingClass += " ring-1 ring-dashed ring-zinc-500 cursor-pointer";
                                  }
                                }

                                return (
                                  <div
                                    key={`${measure.id}-slot-${slotIdx}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedMeasureIndex(index);
                                      setSelectedChordSlotIndex(slotIdx);
                                      syncDawPlayheadToMeasure(index, slotIdx, flatIndex);
                                      handleChordClick(
                                        actualChordName,
                                        showAnalysis ? analysis : undefined,
                                        flatIndex
                                      );
                                    }}
                                    className={`flex-1 flex flex-col items-center justify-center p-0.5 rounded-none transition-colors relative cursor-pointer ${
                                      isSlotSelected && isCustomSong
                                        ? "bg-neutral-800/80 outline-none"
                                        : "hover:bg-neutral-900/40"
                                    } ${slotIdx > 0 ? "border-l border-neutral-800/80 print:border-black" : ""}`}
                                  >
                                    {showAnalysis && analysis && analysis.romanNumeral && analysis.romanNumeral !== '-' && (
                                      <div
                                        className={`flex flex-col items-center mb-0.5 min-h-[20px] print:hidden ${isEditMode ? 'cursor-pointer hover:bg-neutral-800/80 px-1 rounded transition-colors z-10' : 'pointer-events-none'}`}
                                        onClick={(e) => {
                                          if (isEditMode) {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setEditingCell({
                                              key: overrideKey,
                                              flatIndex,
                                              numeral: analysis.romanNumeral,
                                              category: analysis.category,
                                              groupWithNext: !!customAnalyses[overrideKey]?.groupWithNext,
                                              rect,
                                            });
                                            e.stopPropagation();
                                          }
                                        }}
                                      >
                                        <span
                                          className={`text-base sm:text-lg font-bold font-serif italic text-[#EA580B] ${isEditMode ? 'underline decoration-dotted underline-offset-2' : ''}`}
                                        >
                                          <span className="block text-[#EA580B] font-bold">{analysis.romanNumeral}</span>
                                        </span>
                                      </div>
                                    )}

                                    <ChordNameInput
                                      chordName={actualChordName === '%' ? '%' : transposedChordName}
                                      isEditMode={isEditMode || isCustomSong}
                                      isPlaying={isPlaying}
                                      isFocused={isFocused}
                                      sequenceGroupingClass={sequenceGroupingClass}
                                      globalKey={globalKey}
                                      onSave={(newChordName) => {
                                        handleUpdateChordName(index, slotIdx, newChordName);
                                      }}
                                      onClick={() => {
                                        setSelectedMeasureIndex(index);
                                        setSelectedChordSlotIndex(slotIdx);
                                        syncDawPlayheadToMeasure(index, slotIdx, flatIndex);
                                        handleChordClick(
                                          actualChordName,
                                          showAnalysis ? analysis : undefined,
                                          flatIndex
                                        );
                                      }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </Fragment>
                    );
                  })}
                  {isCustomSong && (
                    <button
                      onClick={() => {
                        const newSong = { ...currentSong, isCustom: true, measures: [...(currentSong.measures || [])] };
                        newSong.measures.push({ id: `m-${Date.now()}`, chords: [''] });
                        setAllSongs(prev => prev.map(s => s.id === currentSong.id ? newSong : s));
                        setSelectedMeasureIndex(newSong.measures.length - 1);
                        setSelectedChordSlotIndex(0);
                      }}
                      className="col-span-1 min-h-[76px] border-b border-neutral-800 border-r border-neutral-700 hover:bg-neutral-900/30 text-neutral-400 hover:text-white font-sans font-medium text-xs flex flex-col items-center justify-center gap-1 transition cursor-pointer p-2 print:hidden"
                      title="Añadir nuevo compás"
                    >
                      <Plus size={16} className="text-neutral-400" />
                      <span className="inline-block">Añadir Compás</span>
                    </button>
                  )}
                  </div>
                </div>

            {/* Real Book double bar final visual */}
            <div className="flex justify-end gap-0.5 mt-2 opacity-30 pr-1 print:hidden">
              <div className="w-[1px] h-6 bg-zinc-650"></div>
              <div className="w-[3px] h-6 bg-zinc-650"></div>
            </div>
          </>
        )}
      </div>

      {/* Dynamic educational suggestion */}
          <div className="bg-neutral-900 p-3.5 rounded-lg border border-neutral-800 text-xs text-neutral-400 font-mono leading-relaxed flex items-start gap-2.5 shadow-none print:hidden">
            <Sparkles className="text-neutral-400 shrink-0 mt-0.5" size={14} />
            <div>
              <strong className="text-neutral-300 block mb-0.5">
                <span className="block">{t('academy.transpositionTheory')}</span>
              </strong>
              <span className="block">{t('academy.transpositionTheoryText')}</span>
            </div>
          </div>
        </div>

      </div>

      {/* 4. TEACHER MODE POPOVER */}
      {isEditMode && editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditingCell(null)}>
          <div 
            className="bg-neutral-900 border border-neutral-800 rounded-lg shadow-none p-4 w-72 flex flex-col gap-4 animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
              <h3 className="text-neutral-200 font-sans font-bold text-sm tracking-wide flex items-center gap-2">
                <Edit3 size={14} className="text-emerald-400" />
                <span className="inline-block">Editar Análisis</span>
              </h3>
              <button 
                onClick={() => setEditingCell(null)}
                className="text-neutral-500 hover:text-neutral-300 transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-1.5 block">
                  <span className="block">Etiqueta (Romano)</span>
                </label>
                <input
                  type="text"
                  value={editingCell.numeral}
                  onChange={(e) => setEditingCell({ ...editingCell, numeral: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-sm text-neutral-200 focus:border-emerald-500 outline-none"
                  placeholder="Ej: V/II"
                />
              </div>

              <div>
                <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-1.5 block">
                  <span className="block">{t('academy.visualCategory') || "Categoría Visual"}</span>
                </label>
                <select
                  value={editingCell.category}
                  onChange={(e) => setEditingCell({ ...editingCell, category: e.target.value as AnalysisCategory })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-sm text-neutral-200 focus:border-emerald-500 outline-none"
                >
                  <option value="diatonic">{t('academy.diatonicColor')}</option>
                  <option value="secondary_dominant">{t('academy.secondaryDominantColor')}</option>
                  <option value="related_ii">{t('academy.relatedIiColor') || "II Relativo (Amarillo)"}</option>
                  <option value="tritone_substitute">{t('academy.tritoneSubstituteColor')}</option>
                  <option value="modal_interchange">{t('academy.modalInterchangeColor')}</option>
                  <option value="tonal_shift">{t('academy.tonalShiftColor') || "Cambio Tonal (Morado)"}</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input 
                  type="checkbox"
                  checked={editingCell.groupWithNext}
                  onChange={(e) => setEditingCell({ ...editingCell, groupWithNext: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 bg-neutral-950 border-neutral-800 rounded cursor-pointer"
                />
                <span className="text-xs text-neutral-300">
                  <span className="inline-block">{t('academy.groupWithNext') || "Agrupar con el siguiente (Borde II-V)"}</span>
                </span>
              </label>
            </div>

            <button
              onClick={() => {
                setCustomAnalyses(prev => ({
                  ...prev,
                  [editingCell.key]: {
                    numeral: editingCell.numeral,
                    category: editingCell.category,
                    groupWithNext: editingCell.groupWithNext,
                  }
                }));
                setEditingCell(null);
              }}
              className="mt-2 w-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 font-bold py-2 rounded transition flex items-center justify-center gap-2 text-sm shadow-none"
            >
              <Save size={14} />
              <span className="inline-block">Guardar Override</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal PRO de Exportar / Guardar Proyecto */}
      {isExportModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 print:hidden"
          onClick={() => setIsExportModalOpen(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between pb-3.5 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[#EA580B] shrink-0">
                  <Download size={16} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-sans tracking-wide">
                    Exportar / Guardar Proyecto
                  </h3>
                  <p className="text-[11px] text-neutral-400 font-sans">
                    Selecciona el formato de salida para tu sesión
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white border border-neutral-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                aria-label="Cerrar modal de exportación"
              >
                <X size={16} />
              </button>
            </div>

            {/* Opciones del Modal (3 Botones en Columna) */}
            <div className="flex flex-col gap-3 mt-4">
              {/* Opción 1 (Sesión) */}
              <button
                type="button"
                onClick={() => {
                  setIsExportModalOpen(false);
                  handleExportSession();
                  triggerExportToast("Sesión (.linus) guardada correctamente.");
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-lg bg-neutral-950/90 hover:bg-neutral-800/90 border border-neutral-800 hover:border-[#EA580B]/60 text-left transition-all group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 group-hover:border-[#EA580B]/40 flex items-center justify-center text-emerald-400 group-hover:text-[#EA580B] transition-colors shrink-0">
                  <Save size={18} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-bold text-neutral-100 group-hover:text-white font-sans truncate">
                    Guardar Sesión (.linus)
                  </span>
                  <span className="text-xs text-neutral-400 font-sans truncate">
                    Archivo de proyecto editable con acordes y estructura
                  </span>
                </div>
              </button>

              {/* Opción 2 (Guía de Acordes PDF) */}
              <button
                type="button"
                onClick={() => {
                  setIsExportModalOpen(false);
                  handleDownloadDirectPDF();
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-lg bg-neutral-950/90 hover:bg-neutral-800/90 border border-neutral-800 hover:border-[#EA580B]/60 text-left transition-all group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 group-hover:border-[#EA580B]/40 flex items-center justify-center text-sky-400 group-hover:text-[#EA580B] transition-colors shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-bold text-neutral-100 group-hover:text-white font-sans truncate">
                    Exportar Guía de Acordes (.pdf)
                  </span>
                  <span className="text-xs text-neutral-400 font-sans truncate">
                    Lead sheet de acordes y estructura estilo Real Book
                  </span>
                </div>
              </button>

              {/* Opción 2.5: Partitura Completa con Pentagrama (Acordes + Pista MIDI) */}
              {(() => {
                const userTracks = getUserMidiTracksForScore();
                const activeScoreTrack = getSelectedScoreTrack();
                const activeNotesCount = extractTrackNotesForScore(activeScoreTrack).length;

                return (
                  <div className="w-full flex flex-col gap-2.5 p-3.5 rounded-lg bg-neutral-950/95 border border-orange-500/40 text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#EA580B]/15 border border-[#EA580B]/40 flex items-center justify-center text-[#EA580B] shrink-0">
                        <FileMusic size={18} />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-bold text-white font-sans truncate">
                          Partitura Completa (Acordes + Melodía MIDI)
                        </span>
                        <span className="text-xs text-neutral-400 font-sans truncate">
                          Pentagrama real con figuras rítmicas, silencios y cifrado
                        </span>
                      </div>
                    </div>

                    {userTracks.length > 0 && (
                      <div className="flex flex-col gap-1 pt-1">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                          Seleccionar Pista MIDI a Transcribir:
                        </label>
                        <select
                          value={activeScoreTrack ? String(activeScoreTrack.id) : ""}
                          onChange={(e) => setSelectedScoreTrackId(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-md bg-neutral-900 border border-neutral-700 text-xs font-mono text-neutral-200 focus:outline-none focus:border-[#EA580B]"
                        >
                          {userTracks.map((t: any) => {
                            const count = extractTrackNotesForScore(t).length;
                            return (
                              <option key={t.id} value={String(t.id)}>
                                {t.name} ({t.instrument || "MIDI"}) — {count} {count === 1 ? "nota" : "notas"}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsExportModalOpen(false);
                          setIsScorePreviewModalOpen(true);
                        }}
                        className="flex-1 h-8 px-2.5 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileText size={13} className="text-orange-400" />
                        <span>Vista Previa / Imprimir ({activeNotesCount} notas)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleDownloadFullScorePDF();
                        }}
                        className="h-8 px-3 rounded-md bg-[#EA580B] hover:bg-orange-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        <Download size={13} />
                        <span>PDF Directo</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Opción 3 (Audio Mix) */}
              <button
                type="button"
                disabled={isExportingWav}
                onClick={() => {
                  handleExportWav();
                }}
                className={`w-full flex items-center gap-3.5 p-3.5 rounded-lg border text-left transition-all group ${
                  isExportingWav
                    ? "bg-neutral-900/90 border-[#EA580B]/60 cursor-wait opacity-90"
                    : "bg-neutral-950/90 hover:bg-neutral-800/90 border-neutral-800 hover:border-[#EA580B]/60 cursor-pointer"
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 group-hover:border-[#EA580B]/40 flex items-center justify-center text-amber-400 group-hover:text-[#EA580B] transition-colors shrink-0">
                  {isExportingWav ? (
                    <Loader2 size={18} className="animate-spin text-[#EA580B]" />
                  ) : (
                    <Headphones size={18} />
                  )}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-bold text-neutral-100 group-hover:text-white font-sans truncate">
                    {isExportingWav ? "Renderizando audio..." : "Exportar Audio (Mix completo)"}
                  </span>
                  <span className="text-xs text-neutral-400 font-sans truncate">
                    {isExportingWav
                      ? "Generando archivo WAV offline..."
                      : "Mezcla maestra estéreo de toda la sesión (.wav)"}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Vista Previa e Impresión de Partitura Completa SVG/PDF */}
      {isScorePreviewModalOpen && (() => {
        const userTracks = getUserMidiTracksForScore();
        const targetTrack = getSelectedScoreTrack();
        const midiNotes = extractTrackNotesForScore(targetTrack);
        const mappedAvailableTracks = userTracks.map((t: any) => ({
          id: String(t.id),
          name: t.name || "Pista MIDI",
          instrument: t.instrument || "Piano",
          bankId: t.bankId || "acoustic_grand_piano",
          notes: extractTrackNotesForScore(t),
        }));
        return (
          <ScorePreviewModal
            isOpen={isScorePreviewModalOpen}
            onClose={() => setIsScorePreviewModalOpen(false)}
            song={transposedSongForScore}
            transposition={transposition}
            globalKey={displayedKeyCenter}
            activeKey={transposedSongForScore.activeKey}
            midiNotes={midiNotes}
            trackName={targetTrack?.name || "Pista MIDI"}
            instrumentName={targetTrack?.instrument || "Piano"}
            bankId={targetTrack?.bankId || "acoustic_grand_piano"}
            availableTracks={mappedAvailableTracks}
            selectedTrackId={targetTrack ? String(targetTrack.id) : ""}
            onSelectTrackId={(id) => setSelectedScoreTrackId(id)}
          />
        );
      })()}

      {/* Notificación Toast de Exportación */}
      {exportToastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-neutral-900 border border-[#EA580B]/50 text-neutral-100 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md print:hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="w-2 h-2 rounded-full bg-[#EA580B] animate-pulse shrink-0" />
          <span className="text-xs font-sans font-medium">{exportToastMessage}</span>
          <button
            type="button"
            onClick={() => setExportToastMessage(null)}
            className="text-neutral-500 hover:text-neutral-300 ml-1 p-0.5 cursor-pointer"
            aria-label="Cerrar notificación"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Notificación de Estado / Fallback de Exportación PDF */}
      {pdfExportSuccess && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-neutral-900 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-xl shadow-none backdrop-blur-md print:hidden">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <div className="flex flex-col text-xs">
            <span className="font-semibold text-zinc-100"><span className="block">Guía de Acordes PDF Lista</span></span>
            <span className="text-zinc-400 text-[11px]"><span className="block">Partitura lista para imprimir o guardar</span></span>
          </div>
          <button
            type="button"
            onClick={() => handleDownloadDirectPDF()}
            className="ml-2 px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-mono cursor-pointer transition"
          >
            <span className="inline-block">Descargar .pdf</span>
          </button>
          <button
            type="button"
            onClick={() => setPdfExportSuccess(false)}
            className="text-zinc-500 hover:text-zinc-300 ml-1 p-0.5 cursor-pointer"
            title="Cerrar notificación"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {/* Modales Flotantes de Visualización de Acorde y Escala */}
      {showChordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setShowChordModal(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#EA580B] text-white flex items-center justify-center font-bold shrink-0">
                  <Piano size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-sans flex items-center gap-2">
                    Visualizador de Acorde
                    {effectiveChordDetails && (
                      <span className="text-xs px-2 py-0.5 rounded bg-[#EA580B] text-white font-mono font-bold">
                        {effectiveChordString}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-neutral-400 font-sans mt-0.5">
                    Diagrama interactivo del acorde seleccionado en la progresión
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Conmutador Rápido de Instrumento */}
                <div className="inline-flex bg-neutral-800 p-0.5 rounded-lg border border-neutral-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setInstrument('piano')}
                    className={`px-2 py-1 rounded-md font-sans text-xs font-semibold transition-colors cursor-pointer ${
                      instrument === 'piano'
                        ? 'bg-[#EA580B] text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Teclado
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstrument('guitar')}
                    className={`px-2 py-1 rounded-md font-sans text-xs font-semibold transition-colors cursor-pointer ${
                      instrument === 'guitar'
                        ? 'bg-[#EA580B] text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Guitarra
                  </button>
                </div>

                {/* Botón Cerrar */}
                <button
                  type="button"
                  onClick={() => setShowChordModal(false)}
                  className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-neutral-700 ml-1"
                  aria-label="Cerrar modal"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Contenido del Visualizador de Acorde */}
            <div className="w-full flex flex-col items-center justify-center py-1">
              {effectiveChordDetails ? (
                <div className="w-full flex flex-col items-center">
                  {instrument === 'piano' ? (
                    <ChordPianoKeyboard
                      root={effectiveChordDetails.root}
                      type={effectiveChordDetails.type}
                      voicing={effectiveChordDetails.voicing}
                      title={effectiveChordDetails.suffix}
                      subtitle={`Acorde: ${effectiveChordString}`}
                    />
                  ) : (
                    <ChordFretboard
                      root={effectiveChordDetails.root}
                      type={effectiveChordDetails.type}
                      voicing={effectiveChordDetails.voicing}
                      title={effectiveChordDetails.suffix}
                      subtitle={`Acorde: ${effectiveChordString}`}
                    />
                  )}
                </div>
              ) : (
                <div className="py-10 text-center text-neutral-400 text-xs font-mono">
                  Haz clic en cualquier acorde del lead sheet para ver su digitación aquí.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showScaleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setShowScaleModal(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#EA580B] text-white flex items-center justify-center font-bold shrink-0">
                  <Eye size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-sans flex items-center gap-2">
                    Visualizador de Escala
                    {effectiveChordDetails?.suggestedScale && (
                      <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 border border-[#EA580B]/50 text-[#EA580B] font-mono font-bold">
                        {effectiveChordDetails.suggestedScale.name}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-neutral-400 font-sans mt-0.5">
                    Escala y notas de improvisación sugeridas para el acorde
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Conmutador Rápido de Instrumento */}
                <div className="inline-flex bg-neutral-800 p-0.5 rounded-lg border border-neutral-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setInstrument('piano')}
                    className={`px-2 py-1 rounded-md font-sans text-xs font-semibold transition-colors cursor-pointer ${
                      instrument === 'piano'
                        ? 'bg-[#EA580B] text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Teclado
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstrument('guitar')}
                    className={`px-2 py-1 rounded-md font-sans text-xs font-semibold transition-colors cursor-pointer ${
                      instrument === 'guitar'
                        ? 'bg-[#EA580B] text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Guitarra
                  </button>
                </div>

                {/* Botón Cerrar */}
                <button
                  type="button"
                  onClick={() => setShowScaleModal(false)}
                  className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-neutral-700 ml-1"
                  aria-label="Cerrar modal"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Contenido del Visualizador de Escala */}
            <div className="w-full flex flex-col items-center justify-center py-1">
              {effectiveChordDetails?.suggestedScale ? (
                <div className="w-full flex flex-col items-center">
                  {instrument === 'piano' ? (
                    <ScalePianoKeyboard
                      scaleName={effectiveChordDetails.suggestedScale.name}
                      notes={effectiveChordDetails.suggestedScale.notes}
                      root={effectiveChordDetails.root}
                      chordString={effectiveChordString}
                    />
                  ) : (
                    <ScaleFretboard
                      scaleName={effectiveChordDetails.suggestedScale.name}
                      notes={effectiveChordDetails.suggestedScale.notes}
                      root={effectiveChordDetails.root}
                      chordString={effectiveChordString}
                    />
                  )}
                </div>
              ) : (
                <div className="py-10 text-center text-neutral-400 text-xs font-mono">
                  Haz clic en cualquier acorde del lead sheet para explorar su escala sugerida.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
