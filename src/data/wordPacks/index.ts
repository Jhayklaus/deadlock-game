import animalsRaw from './animals.json';
import foodRaw from './food.json';
import landmarksRaw from './landmarks.json';
import undercoverRaw from './undercover.json';
import frequencyRaw from './frequency.json';

export interface WordPairEntry {
  word: string;
  category: string;
}

export interface UndercoverEntry {
  commonWord: string;
  undercoverWord: string;
  blankHint: string;
}

export interface FrequencyEntry {
  topic: string;
  lowLabel: string;
  highLabel: string;
}

export type WordPackId = 'animals' | 'food' | 'landmarks';

export const WORD_PACKS: Record<WordPackId, WordPairEntry[]> = {
  animals: animalsRaw as WordPairEntry[],
  food: foodRaw as WordPairEntry[],
  landmarks: landmarksRaw as WordPairEntry[],
};

export const UNDERCOVER_PACK: UndercoverEntry[] = undercoverRaw as UndercoverEntry[];
export const FREQUENCY_PACK: FrequencyEntry[] = frequencyRaw as FrequencyEntry[];

export function drawRandomWordPair(packId: WordPackId): WordPairEntry {
  const pack = WORD_PACKS[packId];
  return pack[Math.floor(Math.random() * pack.length)];
}

export function drawRandomUndercoverEntry(): UndercoverEntry {
  return UNDERCOVER_PACK[Math.floor(Math.random() * UNDERCOVER_PACK.length)];
}

export function drawRandomFrequencyTopic(): FrequencyEntry {
  return FREQUENCY_PACK[Math.floor(Math.random() * FREQUENCY_PACK.length)];
}
