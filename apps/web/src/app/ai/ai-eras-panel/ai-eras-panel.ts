import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FilmLeader } from '../../ui/film-leader/film-leader';
import { Icon } from '../../ui/icon/icon';
import { AI_PROVIDERS, type ProviderId } from '../ai-models.config';
import { AiKeyStore } from '../ai-key.store';
import { EraClassifier } from '../era-classifier.service';

/** Banner + "Ustawienia AI" panel on the eras view (SPEC §7.11). */
@Component({
  selector: 'ks-ai-eras-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilmLeader, Icon],
  host: { class: 'block' },
  templateUrl: './ai-eras-panel.html',
  styleUrl: './ai-eras-panel.scss',
})
export class AiErasPanel {
  readonly key = inject(AiKeyStore);
  readonly ai = inject(EraClassifier);
  readonly providers = AI_PROVIDERS;
  readonly open = signal(false);
  readonly showHowTo = signal(false);

  onProvider(id: string): void {
    this.key.setProvider(id as ProviderId);
  }

  usd(v: number | undefined): string {
    if (v === undefined) return '';
    return v < 0.01 ? '< 0,01 USD' : `ok. ${v.toFixed(2).replace('.', ',')} USD`;
  }
}
