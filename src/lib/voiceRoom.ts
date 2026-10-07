/**
 * Voice room link handling.
 *
 * Kept free of React and network imports so it stays independently testable —
 * this value is broadcast to every player and rendered as a clickable anchor,
 * so its validation is worth exercising on its own.
 */

/**
 * Normalises whatever the host pasted into a safe, openable URL, or returns
 * null if it cannot be trusted.
 *
 * Only http(s) is accepted. A `javascript:` or `data:` URL in an anchor that
 * the entire lobby is invited to click would be an obvious hazard.
 */
export function normaliseVoiceUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Reject anything carrying an explicit non-http scheme before we prepend
  // one — "javascript:alert(1)" must not become "https://javascript:alert(1)".
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed);
  if (scheme && !/^https?$/i.test(scheme[1])) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    // A bare word like "localhost" is far more likely to be a typo than a
    // room every player can actually reach.
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** A friendly provider name for known voice services. */
export function providerOf(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('meet.google')) return 'Google Meet';
    if (host.includes('zoom')) return 'Zoom';
    if (host.includes('discord')) return 'Discord';
    if (host.includes('teams.microsoft')) return 'Microsoft Teams';
    if (host.includes('whereby')) return 'Whereby';
    if (host.includes('meet.jit')) return 'Jitsi';
    return host;
  } catch {
    return 'Voice room';
  }
}
