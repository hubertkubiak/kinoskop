import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BRAND } from '@kinoskop/shared';

@Component({
  selector: 'ks-about-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block max-w-3xl' },
  templateUrl: './about-page.html',
  styleUrl: './about-page.scss',
})
export class AboutPage {
  readonly brand = BRAND;
}
