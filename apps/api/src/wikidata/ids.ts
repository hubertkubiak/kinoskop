/**
 * Wikidata identifiers used by Kinoskop. Every value was verified – never written from memory
 * (CLAUDE.md, SPEC §3.1). Verification: label queries against https://query.wikidata.org/sparql
 * and `wbsearchentities` (type=property) on 2026-11-18. Re-verify when adding new IDs.
 */
export const P = {
  /** "Filmweb.pl film ID" – numeric, films and series (~60k items). */
  filmwebFilm: 'P5032',
  /** "Filmweb.pl ID" – legacy slug, e.g. "videogame/The+Last+of+Us-2013-642590"; only ~32 games. */
  filmwebSlug: 'P3995',
  /** "Filmweb.pl person ID". */
  filmwebPerson: 'P5033',
  tmdbMovie: 'P4947',
  tmdbTv: 'P4983',
  tmdbPerson: 'P4985',
  imdb: 'P345',
  /** "Internet Game Database game ID" (slug). */
  igdbSlug: 'P5794',
  /** "Internet Game Database numeric game ID" – used as a qualifier of P5794. */
  igdbNumeric: 'P9043',
  director: 'P57',
  castMember: 'P161',
  countryOfOrigin: 'P495',
  citizenship: 'P27',
  /** "ISO 3166-1 alpha-2 code". */
  iso2: 'P297',
  setInPeriod: 'P2408',
  narrativeLocation: 'P840',
  awardReceived: 'P166',
  nominatedFor: 'P1411',
  pointInTime: 'P585',
  forWork: 'P1686',
  startTime: 'P580',
  genre: 'P136',
  publicationDate: 'P577',
  duration: 'P2047',
  instanceOf: 'P31',
  subclassOf: 'P279',
} as const;

export const Q = {
  film: 'Q11424',
  televisionSeries: 'Q5398426',
  videoGame: 'Q7889',
  /** unit "minute", for P2047 duration. */
  minute: 'Q7727',
} as const;
