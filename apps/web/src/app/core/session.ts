/**
 * Session marker cookie (SPEC §6). It has no Expires/Max-Age, so the browser drops it when
 * it is closed. A missing cookie at start-up means "new browser session": local data is wiped.
 * The cookie carries no information and no backend logic reads it.
 */
export const SESSION_COOKIE = 'ks_session';

export function hasSessionCookie(doc: Document = document): boolean {
  return doc.cookie.split(';').some((c) => c.trim().startsWith(`${SESSION_COOKIE}=`));
}

export function setSessionCookie(doc: Document = document): void {
  doc.cookie = `${SESSION_COOKIE}=1; Path=/; SameSite=Strict`;
}
