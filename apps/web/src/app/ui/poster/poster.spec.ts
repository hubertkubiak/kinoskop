import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { pageText } from '../../testing/dom';
import { Poster } from './poster';

describe('Poster', () => {
  it('shows the image lazily, without a referrer, and falls back to the title on error', async () => {
    const f = TestBed.createComponent(Poster);
    f.componentRef.setInput('src', 'https://image.tmdb.org/t/p/w342/x.jpg');
    f.componentRef.setInput('title', 'Rejs');
    await f.whenStable();
    const img = f.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://image.tmdb.org/t/p/w342/x.jpg');
    expect(img.alt).toBe('Plakat: Rejs');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');

    img.dispatchEvent(new Event('error'));
    await f.whenStable();
    expect(f.nativeElement.querySelector('img')).toBeNull();
    expect(pageText(f)).toBe('Rejs');
  });

  it('shows the title when there is no poster', async () => {
    const f = TestBed.createComponent(Poster);
    f.componentRef.setInput('title', 'Rejs');
    await f.whenStable();
    expect(f.nativeElement.querySelector('img')).toBeNull();
    expect(pageText(f)).toBe('Rejs');
  });
});
