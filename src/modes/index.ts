/**
 * Mode Registration
 * Import this file once at app startup to register all game modes.
 */
import { registerMode } from './registry';
import { classicMafiaMode } from './classicMafia';
import { wordImpostorMode } from './wordImpostor';
import { undercoverMode } from './undercover';
import { frequencySpyMode } from './frequencySpy';

registerMode(classicMafiaMode);
registerMode(wordImpostorMode);
registerMode(undercoverMode);
registerMode(frequencySpyMode);

export { classicMafiaMode, wordImpostorMode, undercoverMode, frequencySpyMode };
export { registerMode, getMode, getAllModes } from './registry';
