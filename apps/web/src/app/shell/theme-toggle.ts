import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ChartTheme } from '../charts/theme';

const KEY = 'kinoskop-theme';

/** Dark ("sala po seansie", default) / light ("sala przy zapalonym świetle") theme switch. */
@Component({
  selector: 'ks-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="ks-btn text-sm min-h-6" [attr.aria-pressed]="light()" (click)="toggle()"
      [attr.aria-label]="light() ? 'Włącz motyw ciemny' : 'Włącz motyw jasny'">
      <span aria-hidden="true">{{ light() ? '☾' : '☀' }}</span>
    </button>
  `,
})
export class ThemeToggle {
  private readonly charts = inject(ChartTheme);
  readonly light = signal(false);

  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      /* storage unavailable */
    }
    if (saved === 'light') this.apply(true);
  }

  toggle(): void {
    this.apply(!this.light());
  }

  private apply(light: boolean): void {
    this.light.set(light);
    if (light) document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    try {
      localStorage.setItem(KEY, light ? 'light' : 'dark');
    } catch {
      /* storage unavailable */
    }
    this.charts.refresh();
  }
}
