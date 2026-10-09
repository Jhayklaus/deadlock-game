import type { Player, PlayerId } from './types';

/**
 * @mentions in chat.
 *
 * Players refer to each other constantly, and in a fast discussion a bare name
 * is easy to miss in a wall of text. Tagging makes who is being talked about
 * scannable, and gives the bots a precise way to point at someone rather than
 * describing them.
 *
 * Names are matched against the live roster rather than a pattern, because
 * they contain underscores (Bot_Alice) and can be chosen by players, so there
 * is no safe general shape for one.
 */

/** A piece of a message: either plain text or a resolved mention. */
export type MessagePart =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'mention'; readonly text: string; readonly playerId: PlayerId | null };

/**
 * Splits a message into text and mentions.
 *
 * Longest names first, so "@Bot_Al" cannot shadow "@Bot_Alice". An @ followed
 * by something that is not a player is left as ordinary text — an email
 * address or a stray symbol should not light up.
 */
export function parseMentions(
  content: string,
  players: Record<PlayerId, Player>
): MessagePart[] {
  const roster = Object.values(players)
    .map(p => ({ id: p.id, name: p.name }))
    .sort((a, b) => b.name.length - a.name.length);

  if (roster.length === 0) return [{ kind: 'text', text: content }];

  const parts: MessagePart[] = [];
  let buffer = '';

  for (let i = 0; i < content.length; ) {
    if (content[i] !== '@') {
      buffer += content[i];
      i += 1;
      continue;
    }

    const rest = content.slice(i + 1);
    const hit = roster.find(p => rest.toLowerCase().startsWith(p.name.toLowerCase()));

    if (!hit) {
      buffer += content[i];
      i += 1;
      continue;
    }

    if (buffer) {
      parts.push({ kind: 'text', text: buffer });
      buffer = '';
    }
    parts.push({ kind: 'mention', text: `@${rest.slice(0, hit.name.length)}`, playerId: hit.id });
    i += 1 + hit.name.length;
  }

  if (buffer) parts.push({ kind: 'text', text: buffer });
  return parts.length ? parts : [{ kind: 'text', text: content }];
}

/** Whether a message tags this player. Used to highlight it for them. */
export function mentions(content: string, players: Record<PlayerId, Player>, playerId: PlayerId): boolean {
  return parseMentions(content, players).some(p => p.kind === 'mention' && p.playerId === playerId);
}

/**
 * The half-typed mention at the caret, if there is one.
 *
 * Returns the query after the @ and where it starts, so the caller can replace
 * it when a suggestion is picked. A space ends a mention, so "@Bot Alice" is
 * not treated as one in progress.
 */
export function mentionQueryAt(
  value: string,
  caret: number
): { query: string; start: number } | null {
  const upToCaret = value.slice(0, caret);
  const at = upToCaret.lastIndexOf('@');
  if (at === -1) return null;

  const query = upToCaret.slice(at + 1);
  // An @ only starts a mention at the beginning of a word.
  const before = at > 0 ? upToCaret[at - 1] : ' ';
  if (!/\s/.test(before)) return null;
  if (/\s/.test(query)) return null;

  return { query, start: at };
}

/** Roster entries matching a partially typed mention, best first. */
export function matchRoster(
  query: string,
  players: Record<PlayerId, Player>,
  options: { readonly aliveOnly?: boolean; readonly exclude?: PlayerId } = {}
): Player[] {
  const q = query.toLowerCase();
  return Object.values(players)
    .filter(p => !options.aliveOnly || p.isAlive)
    .filter(p => p.id !== options.exclude)
    .filter(p => p.name.toLowerCase().includes(q))
    // A name that starts with what was typed is the likelier intent.
    .sort((a, b) => {
      const as = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bs = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return as - bs || a.name.localeCompare(b.name);
    })
    .slice(0, 6);
}

/** Inserts a chosen name over the half-typed mention. */
export function applyMention(
  value: string,
  at: { query: string; start: number },
  name: string
): { value: string; caret: number } {
  const head = value.slice(0, at.start);
  const tail = value.slice(at.start + 1 + at.query.length);
  // Completing mid-sentence would otherwise leave "@Alice  said so": the name
  // brings its own trailing space and the rest of the line already starts with
  // one.
  const inserted = /^\s/.test(tail) ? `@${name}` : `@${name} `;
  return { value: `${head}${inserted}${tail}`, caret: head.length + inserted.length };
}
