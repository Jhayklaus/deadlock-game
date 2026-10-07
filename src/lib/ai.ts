const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

/** Set once the server reports no AI credentials, so we stop retrying. */
let aiUnavailable = false;

/**
 * Asks the server for a bot response.
 *
 * Returns null when AI is unavailable or errored, rather than an empty string.
 * The distinction matters: callers used to read '' as "no match found" and
 * silently abstain, which left bots refusing to vote on any server without a
 * DeepSeek key. Null says "decide this yourself".
 */
export async function generateAIResponse(prompt: string): Promise<string | null> {
  if (aiUnavailable) return null;

  try {
    const response = await fetch(`${SERVER_URL}/api/bot-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    // 503 is the server saying it has no AI credentials configured. That will
    // not change mid-game, so stop asking.
    if (response.status === 503) {
      if (!aiUnavailable) {
        console.info('[ai] No AI configured on the server — bots will use built-in behaviour.');
      }
      aiUnavailable = true;
      return null;
    }

    if (!response.ok) return null;

    const data = await response.json();
    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    return text.length > 0 ? text : null;
  } catch {
    // Server down or unreachable — fall back rather than freezing the bots.
    return null;
  }
}

export function isAiUnavailable(): boolean {
  return aiUnavailable;
}
