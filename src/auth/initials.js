/**
 * Pure helper for the avatar monogram fallback.
 *
 * Lives in its own module so the account-bar (loaded on every page via
 * session.js) can import it without dragging in account.js — which has
 * a DOMContentLoaded init() that only makes sense on /auth/account and
 * also instantiates a second Supabase client, triggering a
 * "Multiple GoTrueClient instances" warning everywhere else.
 */

/**
 * Build a 1–2 letter monogram from a name or email.
 * - Strips numbers/punctuation so "joao.paulo928" becomes "JP".
 * - Uses the email local part (before @) when name is empty.
 * - Falls back to a single letter rather than showing "·" or weird symbols.
 * @param {string} nameOrEmail
 * @returns {string}
 */
export function initials(nameOrEmail) {
  let source = (nameOrEmail || '').trim();
  if (!source) return '?';

  // If it's an email, use only the local part
  const atIdx = source.indexOf('@');
  if (atIdx > 0) source = source.slice(0, atIdx);

  // Split on whitespace, dots, dashes, underscores — common name/email separators
  const parts = source
    .split(/[\s._-]+/)
    .map((p) => p.replace(/[^A-Za-zÀ-ÿ]/g, ''))
    .filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }
  // No letters at all (e.g., "12345@x.com") — first char of original
  return source[0]?.toUpperCase() || '?';
}
