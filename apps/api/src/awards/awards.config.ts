import type { AwardDefinition } from '@kinoskop/shared';

/**
 * Award categories (SPEC §7.7). Every Q-ID below was found with Wikidata `wbsearchentities`
 * or a SPARQL label query on 2026-11-18 and checked by its English label/description.
 * Re-verify with: SELECT ?x ?l WHERE { VALUES ?x { wd:Q… } ?x rdfs:label ?l FILTER(lang(?l)="en") }
 */
export const AWARDS: AwardDefinition[] = [
  // Film
  { key: 'oscar-picture', namePl: 'Oscar – najlepszy film', shortPl: 'Oscar (film)', kind: 'film', qid: 'Q102427', personal: false },
  { key: 'oscar-director', namePl: 'Oscar – najlepsza reżyseria', shortPl: 'Oscar (reżyseria)', kind: 'film', qid: 'Q103360', personal: true },
  { key: 'oscar-international', namePl: 'Oscar – film międzynarodowy', shortPl: 'Oscar (międzynar.)', kind: 'film', qid: 'Q105304', personal: false },
  { key: 'palme-dor', namePl: 'Złota Palma (Cannes)', shortPl: 'Złota Palma', kind: 'film', qid: 'Q179808', personal: false },
  { key: 'golden-lion', namePl: 'Złoty Lew (Wenecja)', shortPl: 'Złoty Lew', kind: 'film', qid: 'Q209459', personal: false },
  { key: 'golden-bear', namePl: 'Złoty Niedźwiedź (Berlinale)', shortPl: 'Złoty Niedźwiedź', kind: 'film', qid: 'Q154590', personal: false },
  { key: 'bafta-film', namePl: 'BAFTA – najlepszy film', shortPl: 'BAFTA (film)', kind: 'film', qid: 'Q139184', personal: false },
  { key: 'globe-drama', namePl: 'Złoty Glob – film dramatyczny', shortPl: 'Złoty Glob (dramat)', kind: 'film', qid: 'Q1011509', personal: false },
  { key: 'globe-comedy', namePl: 'Złoty Glob – komedia lub musical', shortPl: 'Złoty Glob (komedia)', kind: 'film', qid: 'Q670282', personal: false },
  { key: 'cesar-film', namePl: 'César – najlepszy film', shortPl: 'César', kind: 'film', qid: 'Q645595', personal: false },
  { key: 'goya-film', namePl: 'Goya – najlepszy film', shortPl: 'Goya', kind: 'film', qid: 'Q1467554', personal: false },
  { key: 'efa-film', namePl: 'Europejska Nagroda Filmowa – najlepszy film', shortPl: 'EFA', kind: 'film', qid: 'Q777921', personal: false },
  // "Polish Academy Award for Best Film" (Orły), found as part of Q497324 "Polish Film Awards".
  { key: 'orly-film', namePl: 'Orły – najlepszy film', shortPl: 'Orły', kind: 'film', qid: 'Q930627', personal: false },
  // TODO(author): Złote Lwy (Gdynia) – no award item found in Wikidata on 2026-11-18 (searched
  // "Złote Lwy", "Golden Lions", items conferred by/part of Q1463060 "Gdynia Film Festival").
  // Add it here once the Q-ID is confirmed.
  // Series
  { key: 'emmy-drama', namePl: 'Emmy – serial dramatyczny', shortPl: 'Emmy (dramat)', kind: 'serial', qid: 'Q989438', personal: false },
  { key: 'emmy-comedy', namePl: 'Emmy – serial komediowy', shortPl: 'Emmy (komedia)', kind: 'serial', qid: 'Q2110156', personal: false },
  // Wikidata label: "Primetime Emmy Award for Outstanding Limited Miniseries".
  { key: 'emmy-limited', namePl: 'Emmy – miniserial', shortPl: 'Emmy (miniserial)', kind: 'serial', qid: 'Q20714679', personal: false },
  { key: 'globe-tv-drama', namePl: 'Złoty Glob – serial dramatyczny', shortPl: 'Złoty Glob (serial dram.)', kind: 'serial', qid: 'Q1255198', personal: false },
  { key: 'globe-tv-comedy', namePl: 'Złoty Glob – serial komediowy', shortPl: 'Złoty Glob (serial kom.)', kind: 'serial', qid: 'Q596294', personal: false },
  // Games
  { key: 'tga-goty', namePl: 'The Game Awards – Gra Roku', shortPl: 'TGA (Gra Roku)', kind: 'game', qid: 'Q78762377', personal: false },
  { key: 'bafta-game', namePl: 'BAFTA Games – najlepsza gra', shortPl: 'BAFTA (gra)', kind: 'game', qid: 'Q16969671', personal: false },
];
