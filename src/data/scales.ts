export type ScaleDefinition = {
  name: string;
  intervals: number[];
  relatedChords: string[];
  characteristicNote?: string;
};

export type ScaleCategory = {
  category: string;
  scales: ScaleDefinition[];
};

export const EXPLORER_CATEGORIES: ScaleCategory[] = [
  {
    category: "Modos de la Escala Mayor",
    scales: [
      {
        name: "Jónica (Mayor Diatónica)",
        intervals: [0, 2, 4, 5, 7, 9, 11],
        relatedChords: ["Maj7", "Mayor", "6", "Maj9"],
        characteristicNote: "4J (11)",
      },
      {
        name: "Dórica",
        intervals: [0, 2, 3, 5, 7, 9, 10],
        relatedChords: ["m7", "m6", "m9", "m11"],
        characteristicNote: "6M (13)",
      },
      {
        name: "Frigia",
        intervals: [0, 1, 3, 5, 7, 8, 10],
        relatedChords: ["m7", "sus4(b9)"],
        characteristicNote: "b2 (b9)",
      },
      {
        name: "Lidia",
        intervals: [0, 2, 4, 6, 7, 9, 11],
        relatedChords: ["Maj7", "Maj7(#11)", "Maj9(#11)"],
        characteristicNote: "#4 (#11)",
      },
      {
        name: "Mixolidia",
        intervals: [0, 2, 4, 5, 7, 9, 10],
        relatedChords: ["7", "9", "13", "7sus4"],
        characteristicNote: "b7",
      },
      {
        name: "Eólica (Menor Antigua)",
        intervals: [0, 2, 3, 5, 7, 8, 10],
        relatedChords: ["m7", "m9", "m(b6)"],
        characteristicNote: "b6",
      },
      {
        name: "Locria",
        intervals: [0, 1, 3, 5, 6, 8, 10],
        relatedChords: ["m7(b5)", "ø"],
        characteristicNote: "b5",
      },
    ],
  },
  {
    category: "Modos de la Menor Melódica",
    scales: [
      {
        name: "Menor Melódica",
        intervals: [0, 2, 3, 5, 7, 9, 11],
        relatedChords: ["m(Maj7)", "m6", "m9(Maj7)"],
        characteristicNote: "6M y 7M",
      },
      {
        name: "Dórica b2 (Frigia ♮6)",
        intervals: [0, 1, 3, 5, 7, 9, 10],
        relatedChords: ["7sus4(b9)", "m7(b9)"],
        characteristicNote: "b9 y 6M",
      },
      {
        name: "Lidia Aumentada",
        intervals: [0, 2, 4, 6, 8, 9, 11],
        relatedChords: ["Maj7(#5)", "Maj9(#5)"],
        characteristicNote: "#4 y #5",
      },
      {
        name: "Lidia b7 (Lidia Dominante)",
        intervals: [0, 2, 4, 6, 7, 9, 10],
        relatedChords: ["7(#11)", "9(#11)", "13(#11)"],
        characteristicNote: "#11 y b7",
      },
      {
        name: "Mixolidia b6 (Mixolidia b13)",
        intervals: [0, 2, 4, 5, 7, 8, 10],
        relatedChords: ["7(b13)", "9(b13)"],
        characteristicNote: "b13 (b6)",
      },
      {
        name: "Locria #2 (Locria ♮9)",
        intervals: [0, 2, 3, 5, 6, 8, 10],
        relatedChords: ["m7(b5)", "m9(b5)", "ø"],
        characteristicNote: "9M y b5",
      },
      {
        name: "Alterada (Superlocria)",
        intervals: [0, 1, 3, 4, 6, 8, 10],
        relatedChords: ["7alt", "7(#9)", "7(b9)", "7(b13)"],
        characteristicNote: "b9, #9, #11, b13",
      },
    ],
  },
  {
    category: "Modos de la Menor Armónica",
    scales: [
      {
        name: "Menor Armónica",
        intervals: [0, 2, 3, 5, 7, 8, 11],
        relatedChords: ["m(Maj7)", "7(b9,b13)"],
        characteristicNote: "b6 y 7M",
      },
      {
        name: "Locria ♮6",
        intervals: [0, 1, 3, 5, 6, 9, 10],
        relatedChords: ["m7(b5)", "dim"],
        characteristicNote: "b5 y 6M",
      },
      {
        name: "Jónica Aumentada",
        intervals: [0, 2, 4, 5, 8, 9, 11],
        relatedChords: ["Maj7(#5)"],
        characteristicNote: "#5 y 7M",
      },
      {
        name: "Dórica #4 (Ucraniana)",
        intervals: [0, 2, 3, 6, 7, 9, 10],
        relatedChords: ["m7", "m6"],
        characteristicNote: "#4 y 6M",
      },
      {
        name: "Frigia Dominante",
        intervals: [0, 1, 4, 5, 7, 8, 10],
        relatedChords: ["7(b9)", "7(b13)"],
        characteristicNote: "b2 y 3M",
      },
      {
        name: "Lidia #2",
        intervals: [0, 3, 4, 6, 7, 9, 11],
        relatedChords: ["Maj7(#11)"],
        characteristicNote: "#2 y #4",
      },
      {
        name: "Superlocria bb7",
        intervals: [0, 1, 3, 4, 6, 8, 9],
        relatedChords: ["dim7"],
        characteristicNote: "bb7",
      },
    ],
  },
  {
    category: "Pentatónicas y Blues",
    scales: [
      {
        name: "Pentatónica Mayor",
        intervals: [0, 2, 4, 7, 9],
        relatedChords: ["Mayor", "Maj7", "6", "9"],
        characteristicNote: "1 - 2 - 3 - 5 - 6",
      },
      {
        name: "Pentatónica Menor",
        intervals: [0, 3, 5, 7, 10],
        relatedChords: ["m7", "Menor", "7"],
        characteristicNote: "1 - b3 - 4 - 5 - b7",
      },
      {
        name: "Pentatónica de Blues (con b5)",
        intervals: [0, 3, 5, 6, 7, 10],
        relatedChords: ["7", "m7", "9", "7(#9)"],
        characteristicNote: "Blue Note (b5)",
      },
      {
        name: "Escala de Blues (b3 / 3M / b5)",
        intervals: [0, 3, 4, 5, 6, 7, 10],
        relatedChords: ["7", "9", "13"],
        characteristicNote: "Blue Notes (b3, 3, b5)",
      },
    ],
  },
  {
    category: "Otras Escalas",
    scales: [
      {
        name: "Tonal (Tono - Tono)",
        intervals: [0, 2, 4, 6, 8, 10],
        relatedChords: ["7(#5)", "7(b5)", "9(#5)"],
        characteristicNote: "6 Tonos Enteros",
      },
      {
        name: "Tonal Aumentada",
        intervals: [0, 3, 4, 7, 8, 11],
        relatedChords: ["Maj7(#5)", "aug"],
        characteristicNote: "Simétrica 1.5T - 1/2T",
      },
      {
        name: "Disminuida (Tono - Semitono)",
        intervals: [0, 2, 3, 5, 6, 8, 9, 11],
        relatedChords: ["dim7", "°7"],
        characteristicNote: "Simétrica Tono - 1/2",
      },
      {
        name: "Dominante Disminuida (Semitono - Tono)",
        intervals: [0, 1, 3, 4, 6, 7, 9, 10],
        relatedChords: ["7(b9)", "7(#9)", "13(b9)"],
        characteristicNote: "Simétrica 1/2 - Tono",
      },
      {
        name: "Bebop Dominante",
        intervals: [0, 2, 4, 5, 7, 9, 10, 11],
        relatedChords: ["7", "9", "13", "7sus4"],
        characteristicNote: "Paso cromático b7 - 7",
      },
      {
        name: "Bebop Mayor",
        intervals: [0, 2, 4, 5, 7, 8, 9, 11],
        relatedChords: ["Maj7", "6", "Maj9"],
        characteristicNote: "Paso cromático 5 - #5 - 6",
      },
    ],
  },
  {
    category: "Arpegios",
    scales: [
      {
        name: "Arpegio Mayor7 (Maj7)",
        intervals: [0, 4, 7, 11],
        relatedChords: ["Maj7", "Maj9"],
        characteristicNote: "1 - 3 - 5 - 7",
      },
      {
        name: "Arpegio Dominante (7)",
        intervals: [0, 4, 7, 10],
        relatedChords: ["7", "9", "13"],
        characteristicNote: "1 - 3 - 5 - b7",
      },
      {
        name: "Arpegio Menor7 (m7)",
        intervals: [0, 3, 7, 10],
        relatedChords: ["m7", "m9", "m11"],
        characteristicNote: "1 - b3 - 5 - b7",
      },
      {
        name: "Arpegio Semidisminuido (m7b5 / Ø)",
        intervals: [0, 3, 6, 10],
        relatedChords: ["m7(b5)", "ø"],
        characteristicNote: "1 - b3 - b5 - b7",
      },
      {
        name: "Arpegio Disminuido (°7)",
        intervals: [0, 3, 6, 9],
        relatedChords: ["dim7", "°7"],
        characteristicNote: "1 - b3 - b5 - bb7",
      },
      {
        name: "Arpegio Maj7(#5)",
        intervals: [0, 4, 8, 11],
        relatedChords: ["Maj7(#5)"],
        characteristicNote: "1 - 3 - #5 - 7",
      },
      {
        name: "Arpegio Menor/Maj7 (mΔ)",
        intervals: [0, 3, 7, 11],
        relatedChords: ["m(Maj7)"],
        characteristicNote: "1 - b3 - 5 - 7",
      },
      {
        name: "Tríada Mayor",
        intervals: [0, 4, 7],
        relatedChords: ["Mayor", "Maj7"],
        characteristicNote: "1 - 3 - 5",
      },
      {
        name: "Tríada Menor",
        intervals: [0, 3, 7],
        relatedChords: ["Menor", "m7"],
        characteristicNote: "1 - b3 - 5",
      },
      {
        name: "Tríada Aumentada (+)",
        intervals: [0, 4, 8],
        relatedChords: ["aug", "7(#5)"],
        characteristicNote: "1 - 3 - #5",
      },
      {
        name: "Tríada Disminuida (°)",
        intervals: [0, 3, 6],
        relatedChords: ["dim", "m7(b5)"],
        characteristicNote: "1 - b3 - b5",
      },
    ],
  },
];
