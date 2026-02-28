import type { GameModeId, GameModeDefinition } from '../lib/types';

const registry = new Map<GameModeId, GameModeDefinition>();

export function registerMode(def: GameModeDefinition): void {
  registry.set(def.id, def);
}

export function getMode(id: GameModeId): GameModeDefinition {
  const mode = registry.get(id);
  if (!mode) throw new Error(`Unknown game mode: "${id}". Was it registered?`);
  return mode;
}

export function getAllModes(): ReadonlyArray<GameModeDefinition> {
  return Array.from(registry.values());
}
