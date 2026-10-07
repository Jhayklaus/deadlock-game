/**
 * The Deadlock station map.
 *
 * Movement is room-to-room rather than free roaming. Players send an intent
 * ("I am going to Engineering") and every client animates the walk locally,
 * which is roughly one message per move instead of a position stream at 15Hz.
 * That matters here: the host's browser is the authority and relays every
 * message, so continuous position sync would put ~1,350 messages a second
 * through a single tab.
 *
 * Coordinates are percentages of the map viewport, so the layout scales to any
 * screen without a canvas or a game engine.
 */

export interface MapRoom {
  readonly id: string;
  readonly name: string;
  /** Centre position, as a percentage of the map area. */
  readonly x: number;
  readonly y: number;
  /** Rooms reachable in one move. Adjacency is enforced host-side. */
  readonly exits: ReadonlyArray<string>;
  /** Flavour shown while you are standing there. */
  readonly blurb: string;
}

export const DEADLOCK_ROOMS: ReadonlyArray<MapRoom> = [
  {
    id: 'bridge',
    name: 'Bridge',
    x: 50, y: 12,
    exits: ['comms', 'quarters', 'corridor'],
    blurb: 'Dead screens and a view of nothing.',
  },
  {
    id: 'comms',
    name: 'Comms',
    x: 18, y: 26,
    exits: ['bridge', 'quarters', 'storage'],
    blurb: 'The long-range array has been quiet for days.',
  },
  {
    id: 'quarters',
    name: 'Quarters',
    x: 82, y: 26,
    exits: ['bridge', 'comms', 'medbay'],
    blurb: 'Eight bunks. Someone has been sleeping in two of them.',
  },
  {
    id: 'corridor',
    name: 'Corridor',
    x: 50, y: 44,
    exits: ['bridge', 'storage', 'medbay', 'engineering', 'reactor', 'airlock'],
    blurb: 'Everything connects here. So does everyone.',
  },
  {
    id: 'storage',
    name: 'Storage',
    x: 15, y: 56,
    exits: ['comms', 'corridor', 'engineering'],
    blurb: 'Crates stacked to the ceiling. Plenty of blind corners.',
  },
  {
    id: 'medbay',
    name: 'Medbay',
    x: 85, y: 56,
    exits: ['quarters', 'corridor', 'reactor'],
    blurb: 'Clean, bright, and far too quiet.',
  },
  {
    id: 'engineering',
    name: 'Engineering',
    x: 25, y: 80,
    exits: ['storage', 'corridor', 'reactor'],
    blurb: 'Something down here is still running.',
  },
  {
    id: 'reactor',
    name: 'Reactor',
    x: 75, y: 80,
    exits: ['medbay', 'corridor', 'engineering'],
    blurb: 'The hum gets into your teeth.',
  },
  {
    id: 'airlock',
    name: 'Airlock',
    x: 50, y: 92,
    exits: ['corridor'],
    blurb: 'One way in. One way out, if you are feeling dramatic.',
  },
];

const BY_ID: Record<string, MapRoom> = Object.fromEntries(
  DEADLOCK_ROOMS.map(r => [r.id, r])
);

export function getRoom(id: string): MapRoom | undefined {
  return BY_ID[id];
}

/** Where everyone starts. */
export const SPAWN_ROOM = 'corridor';

/**
 * Maintenance shafts, usable only by impostors.
 *
 * Deliberately connect rooms that are far apart on foot, so an impostor can
 * be somewhere they could not plausibly have walked to — which is exactly the
 * alibi problem the crew has to notice.
 */
export const VENTS: ReadonlyArray<readonly [string, string]> = [
  ['engineering', 'reactor'],
  ['comms', 'storage'],
  ['quarters', 'medbay'],
  ['bridge', 'airlock'],
];

/** Rooms this one is vent-connected to. */
export function getVentExits(roomId: string): string[] {
  return VENTS.flatMap(([a, b]) =>
    a === roomId ? [b] : b === roomId ? [a] : []
  );
}

export function isVentConnected(from: string, to: string): boolean {
  return getVentExits(from).includes(to);
}

/** Can you get from `from` to `to` in a single move? */
export function isAdjacent(from: string, to: string): boolean {
  const room = BY_ID[from];
  return !!room && room.exits.includes(to);
}

/** Straight-line corridors, derived from adjacency and de-duplicated. */
export function getCorridors(): ReadonlyArray<{ from: MapRoom; to: MapRoom }> {
  const seen = new Set<string>();
  const out: Array<{ from: MapRoom; to: MapRoom }> = [];

  for (const room of DEADLOCK_ROOMS) {
    for (const exitId of room.exits) {
      const key = [room.id, exitId].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const to = BY_ID[exitId];
      if (to) out.push({ from: room, to });
    }
  }
  return out;
}

/**
 * Deals each crewmate a set of tasks across the station.
 *
 * Tasks are spread over distinct rooms so crewmates have to move around and
 * be seen doing it — standing still all game is itself suspicious.
 */
export function assignTasks(count: number): string[] {
  const rooms = DEADLOCK_ROOMS.filter(r => r.id !== 'corridor').map(r => r.id);
  const shuffled = [...rooms].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
