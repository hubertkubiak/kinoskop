/**
 * Polish genre names (SPEC §7.2). Source genres come from TMDB (films, series), IGDB (games)
 * and – for the demo profile – Wikidata. We map by English *names*, which are visible in the
 * respective APIs (TMDB `GET /3/genre/movie/list?language=en-US`, IGDB `genres.name`), so the
 * dictionary can be checked by eye.
 */

const FILM_TV: Record<string, string[]> = {
  action: ['Akcja'],
  adventure: ['Przygodowy'],
  'action & adventure': ['Akcja', 'Przygodowy'],
  animation: ['Animacja'],
  animated: ['Animacja'],
  comedy: ['Komedia'],
  'romantic comedy': ['Komedia', 'Romans'],
  crime: ['Kryminał'],
  documentary: ['Dokumentalny'],
  drama: ['Dramat'],
  'historical drama': ['Dramat', 'Historyczny'],
  'comedy-drama': ['Komedia', 'Dramat'],
  'comedy drama': ['Komedia', 'Dramat'],
  family: ['Familijny'],
  fantasy: ['Fantasy'],
  history: ['Historyczny'],
  historical: ['Historyczny'],
  'period drama': ['Dramat', 'Historyczny'],
  horror: ['Horror'],
  music: ['Muzyczny'],
  musical: ['Musical'],
  mystery: ['Tajemnica'],
  romance: ['Romans'],
  romantic: ['Romans'],
  'science fiction': ['Sci-Fi'],
  'sci-fi & fantasy': ['Sci-Fi', 'Fantasy'],
  'tv movie': ['Film TV'],
  thriller: ['Thriller'],
  'psychological thriller': ['Thriller', 'Psychologiczny'],
  'crime thriller': ['Kryminał', 'Thriller'],
  war: ['Wojenny'],
  'war & politics': ['Wojenny', 'Polityczny'],
  political: ['Polityczny'],
  western: ['Western'],
  kids: ['Dla dzieci'],
  "children's": ['Dla dzieci'],
  news: ['Informacyjny'],
  reality: ['Reality show'],
  soap: ['Telenowela'],
  talk: ['Talk-show'],
  biographical: ['Biograficzny'],
  biography: ['Biograficzny'],
  sports: ['Sportowy'],
  sport: ['Sportowy'],
  'superhero': ['Akcja', 'Fantasy'],
  'black comedy': ['Komedia'],
  satire: ['Komedia'],
  'coming-of-age': ['Obyczajowy'],
  'teen': ['Obyczajowy'],
  'disaster': ['Katastroficzny'],
  'martial arts': ['Akcja'],
  'neo-noir': ['Kryminał'],
  'film noir': ['Kryminał'],
  'spy': ['Sensacyjny'],
  'heist': ['Sensacyjny'],
  'psychological horror': ['Horror', 'Psychologiczny'],
  'psychological drama': ['Dramat', 'Psychologiczny'],
  'legal drama': ['Dramat'],
  'medical drama': ['Dramat'],
  'sitcom': ['Komedia'],
  'anthology': ['Antologia'],
  'mockumentary': ['Komedia'],
  gangster: ['Kryminał'],
  suspense: ['Thriller'],
  'crime drama': ['Kryminał', 'Dramat'],
  'police procedural': ['Kryminał'],
  'contemporary western': ['Western'],
  'epic': [],
  'buddy': ['Komedia'],
  'slasher': ['Horror'],
  'zombie': ['Horror'],
  'space opera': ['Sci-Fi'],
  'cyberpunk': ['Sci-Fi'],
  'dystopian': ['Sci-Fi'],
  'post-apocalyptic': ['Sci-Fi'],
  'drama television series': ['Dramat'],
};

const GAMES: Record<string, string[]> = {
  adventure: ['Przygodowa'],
  'role-playing (rpg)': ['RPG'],
  'role-playing': ['RPG'],
  shooter: ['Strzelanka'],
  strategy: ['Strategia'],
  'real time strategy (rts)': ['Strategia'],
  'turn-based strategy (tbs)': ['Strategia'],
  tactical: ['Taktyczna'],
  puzzle: ['Logiczna'],
  platform: ['Platformówka'],
  racing: ['Wyścigi'],
  sport: ['Sportowa'],
  fighting: ['Bijatyka'],
  "hack and slash/beat 'em up": ['Bijatyka'],
  simulator: ['Symulator'],
  indie: ['Niezależna'],
  arcade: ['Zręcznościowa'],
  'point-and-click': ['Przygodowa'],
  music: ['Muzyczna'],
  pinball: ['Zręcznościowa'],
  'visual novel': ['Visual novel'],
  'card & board game': ['Karciana / planszowa'],
  moba: ['MOBA'],
  'quiz/trivia': ['Quiz'],
  action: ['Akcji'],
  'action-adventure': ['Akcji', 'Przygodowa'],
  'action role-playing': ['Akcji', 'RPG'],
  'first-person shooter': ['Strzelanka'],
  'third-person shooter': ['Strzelanka'],
  'survival horror': ['Horror'],
  'open world': ['Otwarty świat'],
  'stealth': ['Skradanka'],
  'roguelike': ['Roguelike'],
  'metroidvania': ['Platformówka'],
};

const SUFFIXES = [
  ' film',
  ' films',
  ' television series',
  ' tv series',
  ' television program',
  ' video game',
  ' game',
  ' genre',
  ' fiction',
];

function normalise(name: string): string {
  let n = name.trim().toLowerCase();
  for (const s of SUFFIXES) {
    if (n.endsWith(s) && n !== 'science fiction') n = n.slice(0, -s.length);
  }
  return n.trim();
}

/**
 * Maps an English genre name to Polish genre names. Unknown names are dropped (Wikidata has
 * hundreds of fine-grained genres); extend the dictionaries above to keep more of them.
 */
export function mapGenre(name: string, kind: 'film' | 'serial' | 'game'): string[] {
  const n = normalise(name);
  const dict = kind === 'game' ? GAMES : FILM_TV;
  return dict[n] ?? (n === 'science' ? FILM_TV['science fiction'] : []);
}

/** Maps and deduplicates a list of English genre names. */
export function mapGenres(names: string[], kind: 'film' | 'serial' | 'game'): string[] {
  return [...new Set(names.flatMap((n) => mapGenre(n, kind)))];
}
