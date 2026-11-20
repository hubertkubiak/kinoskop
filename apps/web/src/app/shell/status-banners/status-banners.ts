import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EnrichmentService } from '../../core/enrichment.service';
import { LibraryStore } from '../../core/library.store';
import { FilmLeader } from '../../ui/film-leader/film-leader';

@Component({
  selector: 'ks-status-banners',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FilmLeader],
  templateUrl: './status-banners.html',
  styleUrl: './status-banners.scss',
})
export class StatusBanners {
  readonly store = inject(LibraryStore);
  readonly enrich = inject(EnrichmentService);
}
