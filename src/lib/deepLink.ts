/**
 * Shareable invite links.
 *
 * A host can send one link that carries both the mode and the room code, so
 * players cannot land in the wrong game by picking the wrong card off the
 * picker. The canonical shape is a path:
 *
 *   /deadlock            → open Deadlock, ready to host or join
 *   /deadlock/4F2K9Q     → open Deadlock and join that room
 *
 * Parsing is deliberately lenient and also accepts `#/deadlock/4F2K9Q` and
 * `?mode=deadlock&room=4F2K9Q`, because a static host without an SPA rewrite
 * will 404 on the path form and the hash form is the safe fallback there.
 */
import type { GameModeId, GamePhase } from './types';

/** Short, friendly slugs — nicer in a message than the internal ids. */
export const MODE_SLUGS: Record<GameModeId, string> = {
  classic_mafia: 'classic',
  word_impostor: 'impostor',
  undercover: 'undercover',
  frequency_spy: 'frequency',
  deadlock: 'deadlock',
};

const SLUG_TO_MODE: Record<string, GameModeId> = Object.fromEntries(
  Object.entries(MODE_SLUGS).map(([mode, slug]) => [slug, mode as GameModeId])
);

/** Also accept the internal ids, so older links keep working. */
Object.keys(MODE_SLUGS).forEach(mode => {
  SLUG_TO_MODE[mode] = mode as GameModeId;
});

export interface DeepLink {
  readonly mode: GameModeId;
  /** Uppercased room code, or null for a mode-only link. */
  readonly room: string | null;
}

/** Room codes are six base-36 characters (see generateShortId). */
const ROOM_RE = /^[A-Z0-9]{4,12}$/;

function fromSegments(segments: string[]): DeepLink | null {
  if (segments.length === 0) return null;

  const mode = SLUG_TO_MODE[segments[0].toLowerCase()];
  if (!mode) return null;

  const raw = segments[1]?.toUpperCase() ?? '';
  return { mode, room: ROOM_RE.test(raw) ? raw : null };
}

/**
 * Reads an invite out of the current URL, or null if there isn't one.
 * Checks the path, then the hash, then the query.
 */
export function parseDeepLink(loc: Location = window.location): DeepLink | null {
  const split = (s: string) => s.split('/').map(p => p.trim()).filter(Boolean);

  const fromPath = fromSegments(split(loc.pathname));
  if (fromPath) return fromPath;

  const fromHash = fromSegments(split(loc.hash.replace(/^#/, '')));
  if (fromHash) return fromHash;

  const params = new URLSearchParams(loc.search);
  const modeParam = params.get('mode') ?? params.get('m');
  if (modeParam) {
    const mode = SLUG_TO_MODE[modeParam.toLowerCase()];
    if (mode) {
      const raw = (params.get('room') ?? params.get('r') ?? '').toUpperCase();
      return { mode, room: ROOM_RE.test(raw) ? raw : null };
    }
  }

  return null;
}

/**
 * Which URL shape invites use.
 *
 * `path` gives the cleaner `/deadlock/4F2K9Q`, but needs the host to serve
 * index.html for unknown paths — see vercel.json and public/_redirects. On a
 * host without rewrites (GitHub Pages, a plain bucket) set
 * `VITE_INVITE_LINK_STYLE=hash` at build time and links become
 * `/#/deadlock/4F2K9Q`, which needs no server config at all.
 *
 * Either shape is always accepted on the way in; this only decides what we
 * hand out.
 */
const LINK_STYLE: 'path' | 'hash' =
  import.meta.env?.VITE_INVITE_LINK_STYLE === 'hash' ? 'hash' : 'path';

/** The mode/room part of a link, without the leading separator. */
function slugPath(mode: GameModeId, room?: string | null): string {
  const slug = MODE_SLUGS[mode] ?? mode;
  return room ? `${slug}/${room.toUpperCase()}` : slug;
}

/** The part of a link after the origin, ready to hand to history.replaceState. */
export function deepLinkPath(mode: GameModeId, room?: string | null): string {
  return LINK_STYLE === 'hash'
    ? `/#/${slugPath(mode, room)}`
    : `/${slugPath(mode, room)}`;
}

/** A full, shareable URL. */
export function buildInviteUrl(mode: GameModeId, room?: string | null): string {
  return `${window.location.origin}${deepLinkPath(mode, room)}`;
}

/**
 * Keeps the address bar in step with where the player actually is, so the URL
 * is always worth copying and a refresh lands in the same place.
 */
export function syncAddressBar(mode: GameModeId | null, room?: string | null) {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;

  const next = mode ? deepLinkPath(mode, room) : '/';
  const current = window.location.pathname + window.location.hash;
  if (current === next) return;

  try {
    window.history.replaceState(null, '', next);
  } catch {
    // Some sandboxed contexts forbid history writes; the app works regardless.
  }
}

/** What following a link should actually do, given where the player already is. */
export type DeepLinkIntent =
  /** No link, or the link points at the session already open — change nothing. */
  | { kind: 'resume' }
  /** Switch to this mode's pre-join screen. */
  | { kind: 'open_mode'; mode: GameModeId }
  /** Drop the current session and join this room instead. */
  | { kind: 'join_room'; mode: GameModeId; room: string };

export interface SessionSnapshot {
  readonly roomCode: string | null;
  readonly hostId: string | null;
  readonly phase: GamePhase;
}

/**
 * Decides what a link means for a player who may already have a session
 * stored. Kept pure so the rules can be tested without a browser.
 *
 * The cases that matter:
 *  - A link to the room you are already in is a page refresh. Resume, so
 *    reconnecting mid-game keeps your role and progress.
 *  - A link to a different room wins over whatever is stored. Someone who
 *    played earlier today should not have to clear their session to accept an
 *    invite.
 *  - A mode-only link is an entry point, not an invite, so it never yanks a
 *    player out of a game in progress.
 */
export function resolveDeepLink(
  link: DeepLink | null,
  session: SessionSnapshot
): DeepLinkIntent {
  if (!link) return { kind: 'resume' };

  // Sessions stored before roomCode existed only have hostId.
  const current = session.roomCode ?? session.hostId;
  const inProgress = session.phase !== 'lobby' && session.phase !== 'game_over';

  if (link.room) {
    if (current && link.room === current.toUpperCase()) return { kind: 'resume' };
    return { kind: 'join_room', mode: link.mode, room: link.room };
  }

  if (current && inProgress) return { kind: 'resume' };
  return { kind: 'open_mode', mode: link.mode };
}
