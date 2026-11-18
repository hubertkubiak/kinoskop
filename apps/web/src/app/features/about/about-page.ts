import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BRAND } from '@kinoskop/shared';

@Component({
  selector: 'ks-about-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block max-w-3xl' },
  template: `
    <h1 class="font-display text-4xl uppercase mb-4">O aplikacji</h1>
    <p class="mb-4">{{ brand.name }} pokazuje statystyki Twoich ocen z Filmwebu, uzupełnione o publiczne metadane z otwartych źródeł.</p>
    <p class="ks-card p-4 mb-6"><strong>{{ brand.disclaimer }}</strong> Import korzysta z nieudokumentowanego interfejsu, którego Filmweb używa na własnej stronie; może on przestać działać bez ostrzeżenia.</p>

    <h2 class="font-display text-2xl uppercase mb-2">Źródła danych i atrybucje</h2>
    <ul class="space-y-3 mb-6 text-sm">
      <li><strong>TMDB</strong> – obsada, reżyserzy, kraje, słowa kluczowe, plakaty. This product uses the TMDB API but is not endorsed or certified by TMDB.</li>
      <li><strong>JustWatch</strong> – dane o dostępności w serwisach streamingowych w Polsce (przez TMDB).</li>
      <li><strong>IGDB.com</strong> – dane o grach.</li>
      <li><strong>Wikidata</strong> (CC0) – mapowanie identyfikatorów, nagrody, epoki akcji, narodowości twórców.</li>
      <li><strong>OMDb API</strong> – opcjonalnie oceny krytyków.</li>
      <li>Mapa świata: Natural Earth (domena publiczna). Wykresy: Apache ECharts (Apache 2.0). Fonty: Inter, Big Shoulders Display (SIL OFL).</li>
    </ul>

    <h2 class="font-display text-2xl uppercase mb-2">Sesja i przechowywanie</h2>
    <p class="text-sm mb-2">Dane trzymamy w IndexedDB tej przeglądarki i usuwamy je, gdy przeglądarka zostanie zamknięta (znacznik w ciasteczku sesyjnym).</p>
    <p class="text-sm">Uwaga: przy włączonym „przywracaniu poprzedniej sesji” niektóre przeglądarki przywracają ciasteczka sesyjne, więc dane mogą przetrwać restart. Dlatego przycisk „Usuń moje dane” jest zawsze widoczny w nagłówku.</p>
  `,
})
export class AboutPage {
  readonly brand = BRAND;
}
