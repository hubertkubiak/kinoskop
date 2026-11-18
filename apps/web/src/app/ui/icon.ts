import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  LucideBookmark,
  LucideChevronDown,
  LucideClapperboard,
  LucideCopy,
  LucideDownload,
  LucideEllipsis,
  LucideFunnel,
  LucideGlobe,
  LucideHourglass,
  LucideInfo,
  LucideKeyRound,
  LucideLayoutDashboard,
  LucideNetwork,
  LucideSearchCheck,
  LucideShapes,
  LucideShield,
  LucideSparkles,
  LucideTable,
  LucideTicket,
  LucideTrash2,
  LucideTrophy,
  LucideUpload,
  LucideUsers,
  LucideX,
} from '@lucide/angular';

export type IconName =
  | 'dashboard'
  | 'genres'
  | 'ratings'
  | 'world'
  | 'eras'
  | 'people'
  | 'awards'
  | 'graph'
  | 'bookmark'
  | 'verify'
  | 'more'
  | 'trash'
  | 'upload'
  | 'copy'
  | 'download'
  | 'close'
  | 'info'
  | 'shield'
  | 'sparkles'
  | 'key'
  | 'filter'
  | 'table'
  | 'chevron'
  | 'film';

/** Maps semantic icon names to Lucide icons (lets templates pick icons dynamically). */
@Component({
  selector: 'ks-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideBookmark,
    LucideChevronDown,
    LucideClapperboard,
    LucideCopy,
    LucideDownload,
    LucideEllipsis,
    LucideFunnel,
    LucideGlobe,
    LucideHourglass,
    LucideInfo,
    LucideKeyRound,
    LucideLayoutDashboard,
    LucideNetwork,
    LucideSearchCheck,
    LucideShapes,
    LucideShield,
    LucideSparkles,
    LucideTable,
    LucideTicket,
    LucideTrash2,
    LucideTrophy,
    LucideUpload,
    LucideUsers,
    LucideX,
  ],
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
  template: `
    @switch (name()) {
      @case ('dashboard') { <svg lucideLayoutDashboard [size]="size()"></svg> }
      @case ('genres') { <svg lucideShapes [size]="size()"></svg> }
      @case ('ratings') { <svg lucideTicket [size]="size()"></svg> }
      @case ('world') { <svg lucideGlobe [size]="size()"></svg> }
      @case ('eras') { <svg lucideHourglass [size]="size()"></svg> }
      @case ('people') { <svg lucideUsers [size]="size()"></svg> }
      @case ('awards') { <svg lucideTrophy [size]="size()"></svg> }
      @case ('graph') { <svg lucideNetwork [size]="size()"></svg> }
      @case ('bookmark') { <svg lucideBookmark [size]="size()"></svg> }
      @case ('verify') { <svg lucideSearchCheck [size]="size()"></svg> }
      @case ('more') { <svg lucideEllipsis [size]="size()"></svg> }
      @case ('trash') { <svg lucideTrash2 [size]="size()"></svg> }
      @case ('upload') { <svg lucideUpload [size]="size()"></svg> }
      @case ('copy') { <svg lucideCopy [size]="size()"></svg> }
      @case ('download') { <svg lucideDownload [size]="size()"></svg> }
      @case ('close') { <svg lucideX [size]="size()"></svg> }
      @case ('info') { <svg lucideInfo [size]="size()"></svg> }
      @case ('shield') { <svg lucideShield [size]="size()"></svg> }
      @case ('sparkles') { <svg lucideSparkles [size]="size()"></svg> }
      @case ('key') { <svg lucideKeyRound [size]="size()"></svg> }
      @case ('filter') { <svg lucideFunnel [size]="size()"></svg> }
      @case ('table') { <svg lucideTable [size]="size()"></svg> }
      @case ('chevron') { <svg lucideChevronDown [size]="size()"></svg> }
      @case ('film') { <svg lucideClapperboard [size]="size()"></svg> }
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(18);
}
