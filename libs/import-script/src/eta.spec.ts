import { describe, expect, it } from 'vitest';
import { EtaMeter, fmtMinutes } from './eta';

describe('EtaMeter', () => {
  it('ignores slow requests made while the tab was hidden', () => {
    const m = new EtaMeter();
    m.record(700, true);
    m.record(2100, false);
    m.record(900, true);
    expect(m.estimate(10)).toBe(8000);
  });

  it('falls back to all requests and keeps a moving window', () => {
    const m = new EtaMeter(2);
    expect(m.estimate(5)).toBeUndefined();
    m.record(2000, false);
    expect(m.estimate(1)).toBe(2000);
    m.record(1000, true);
    m.record(3000, true);
    m.record(5000, true);
    expect(m.estimate(1)).toBe(4000);
  });

  it('formats minutes', () => {
    expect(fmtMinutes(30_000)).toBe('ok. 1 min');
    expect(fmtMinutes(29 * 60_000)).toBe('ok. 29 min');
  });
});
