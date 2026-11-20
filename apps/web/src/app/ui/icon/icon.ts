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
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(18);
}
