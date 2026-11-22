import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Icon } from './icon';

describe('Icon', () => {
  it('renders a decorative SVG of the requested size', async () => {
    const f = TestBed.createComponent(Icon);
    f.componentRef.setInput('name', 'ratings');
    f.componentRef.setInput('size', 24);
    await f.whenStable();
    const host = f.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    const svg = host.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('24');
  });

  it('switches the drawing when the name changes', async () => {
    const f = TestBed.createComponent(Icon);
    f.componentRef.setInput('name', 'ratings');
    await f.whenStable();
    const first = f.nativeElement.innerHTML;
    f.componentRef.setInput('name', 'world');
    await f.whenStable();
    expect(f.nativeElement.innerHTML).not.toBe(first);
    expect(f.nativeElement.querySelector('svg')?.getAttribute('width')).toBe('18');
  });
});
