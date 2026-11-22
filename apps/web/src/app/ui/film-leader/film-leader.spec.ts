import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { pageText } from '../../testing/dom';
import { FilmLeader } from './film-leader';

describe('FilmLeader', () => {
  it('is a polite live region with the default label and no counter', async () => {
    const f = TestBed.createComponent(FilmLeader);
    await f.whenStable();
    const host = f.nativeElement as HTMLElement;
    expect(host.getAttribute('role')).toBe('status');
    expect(host.getAttribute('aria-live')).toBe('polite');
    expect(pageText(f)).toBe('3 Ładuję…');
  });

  it('counts down from 3 to 1 and sweeps with the real progress', async () => {
    const f = TestBed.createComponent(FilmLeader);
    f.componentRef.setInput('label', 'Dopasowuję tytuły…');
    f.componentRef.setInput('total', 300);
    const leader = () => f.nativeElement.querySelector('.leader') as HTMLElement;

    for (const [done, digit, sweep] of [
      [0, '3', '0deg'],
      [150, '2', '180deg'],
      [299, '1', '359deg'],
      [300, '1', '360deg'],
    ] as const) {
      f.componentRef.setInput('done', done);
      await f.whenStable();
      expect(leader().textContent).toBe(digit);
      expect(leader().style.getPropertyValue('--p')).toBe(sweep);
    }
    expect(pageText(f)).toContain('Dopasowuję tytuły… 300/300');
  });
});
