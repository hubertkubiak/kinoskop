import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Ticket } from './ticket';

describe('Ticket', () => {
  it('shows the rating with an accessible label', async () => {
    const f = TestBed.createComponent(Ticket);
    f.componentRef.setInput('rating', 8);
    await f.whenStable();
    const span = f.nativeElement.querySelector('span') as HTMLElement;
    expect(span.textContent).toBe('8');
    expect(span.getAttribute('aria-label')).toBe('ocena 8 na 10');
    expect(span.classList).not.toContain('muted');
  });

  it('shows a dash for an unrated title', async () => {
    const f = TestBed.createComponent(Ticket);
    await f.whenStable();
    const span = f.nativeElement.querySelector('span') as HTMLElement;
    expect(span.textContent).toBe('–');
    expect(span.getAttribute('aria-label')).toBe('bez oceny');
    expect(span.classList).toContain('muted');
  });
});
