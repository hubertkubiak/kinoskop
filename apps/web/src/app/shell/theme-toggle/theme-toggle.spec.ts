import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartTheme } from '../../charts/theme';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  const refresh = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    refresh.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: ChartTheme, useValue: { refresh } }] });
  });

  afterEach(() => document.documentElement.removeAttribute('data-theme'));

  async function render() {
    const f = TestBed.createComponent(ThemeToggle);
    await f.whenStable();
    return { f, button: f.nativeElement.querySelector('button') as HTMLButtonElement };
  }

  it('starts dark and switches to light and back', async () => {
    const { f, button } = await render();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Włącz motyw jasny');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);

    button.click();
    await f.whenStable();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Włącz motyw ciemny');
    expect(localStorage.getItem('kinoskop-theme')).toBe('light');
    expect(refresh).toHaveBeenCalledOnce();

    button.click();
    await f.whenStable();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem('kinoskop-theme')).toBe('dark');
  });

  it('restores the saved light theme', async () => {
    localStorage.setItem('kinoskop-theme', 'light');
    const { button } = await render();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});
