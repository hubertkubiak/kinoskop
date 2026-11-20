import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Plain-language data flow description (SPEC §10, §14.4). Legal review required before launch. */
@Component({
  selector: 'ks-privacy-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block max-w-3xl' },
  templateUrl: './privacy-page.html',
  styleUrl: './privacy-page.scss',
})
export class PrivacyPage {}
