import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BRAND } from '@kinoskop/shared';
import { describe, expect, it } from 'vitest';
import { pageText } from '../../testing/dom';
import { SiteFooter } from './site-footer';

describe('SiteFooter', () => {
  it('shows the disclaimer, the TMDB notice and links to attributions and privacy', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(SiteFooter);
    await f.whenStable();
    expect(pageText(f)).toContain(BRAND.disclaimer);
    expect(pageText(f)).toContain('This product uses the TMDB API but is not endorsed or certified by TMDB.');
    const links = Array.from(f.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/o-aplikacji', '/prywatnosc']);
  });
});
