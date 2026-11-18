import { describe, expect, it } from 'vitest';
import { detectBrowser } from '../features/import/import.strings';
import { hasSessionCookie, setSessionCookie } from './session';

describe('session cookie', () => {
  it('is set without expiry and detected afterwards', () => {
    const doc = { cookie: '' } as Document;
    expect(hasSessionCookie(doc)).toBe(false);
    setSessionCookie(doc);
    expect(doc.cookie).toBe('ks_session=1; Path=/; SameSite=Strict');
    expect(doc.cookie).not.toMatch(/expires|max-age/i);
    expect(hasSessionCookie({ cookie: 'a=1; ks_session=1' } as Document)).toBe(true);
  });
});

describe('detectBrowser', () => {
  it('detects common browsers', () => {
    expect(detectBrowser('Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/140.0')).toBe('firefox');
    expect(detectBrowser('Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15')).toBe('safari');
    expect(detectBrowser('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140 Safari/537.36 Edg/140')).toBe('chromium');
  });
});
