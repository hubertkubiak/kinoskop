export const IMPORT_STRINGS = {
  title: 'Zaimportuj swoje dane',
  lead: 'Kinoskop pokaże statystyki, Twój gust i nagrody na podstawie Twoich ocen filmów, seriali i gier. Dane zostają w tej przeglądarce.',
  demo: 'Zobacz demo',
  demoHint: 'Fikcyjny profil z przykładowymi ocenami – bez importu.',
  legal:
    'Skrypt automatyzuje pobranie Twoich własnych ocen z Filmwebu. Regulamin serwisu ogranicza korzystanie z programów automatycznych; korzystasz z importu na własną odpowiedzialność. Alternatywa: poproś serwis o kopię swoich danych (art. 15 i 20 RODO).',
  copy: 'Skopiuj skrypt',
  copied: 'Skopiowano! Wklej go w konsoli na karcie z krokiem 1.',
  showCode: 'Pokaż pełny kod skryptu',
  safetyTitle: 'Czy to bezpieczne?',
  safety:
    'Skrypt tylko czyta Twoje dane (zapytania GET), niczego nie zmienia i nigdzie niczego nie wysyła; jedynie zapisuje plik na Twoim dysku. Żeby kolejny import był szybszy, zapamiętuje w pamięci przeglądarki tytuły pobrane do dopasowania. Kod jest jawny powyżej. Ogólna zasada: nigdy nie wklejaj w konsolę kodu, którego nie rozumiesz albo którego źródłu nie ufasz.',
  drop: 'Przeciągnij tutaj plik kinoskop-eksport-….json albo pliki CSV',
  pick: 'albo wybierz pliki',
  csvTitle: 'Masz już eksport z innego narzędzia?',
  csvLead:
    'Kinoskop wczyta też pliki CSV w formacie Letterboxd – np. z konwerterów ocen do tego formatu (Title, Year, WatchedDate, Rating10) albo eksport z Letterboxd (Name, Year, Rating). Możesz wybrać kilka plików naraz; rodzaj (film, serial, gra) i listę (oceny, „chcę zobaczyć”) rozpoznamy po nazwie pliku.',
  csvLimits:
    'Takie pliki nie zawierają identyfikatorów tytułów ani ulubionych, więc tytuły dopasowujemy po nazwie i roku (wymaga klucza TMDB w API). Część pozycji może trzeba będzie potwierdzić w widoku Weryfikacja. Najdokładniejsze dane da skrypt powyżej.',
  csvArchive:
    'Wyjątek: tabele archiwum z Filmweb2Letterboxd (Filmweb2Letterboxd_wstepny_….csv i Filmweb2Letterboxd_pelny_….csv) mają identyfikatory tytułów, ulubione i gry, więc dopasujemy je tak samo jak plik ze skryptu. Plik wstępny (bez tytułów) możesz wczytać od razu, a plik pełny (z tytułami) później – uzupełni wczytane dane bez utraty dopasowań. Pozostałe pliki z tej samej paczki pominiemy.',
  csvWithoutTitles: (n: number) =>
    `${n} pozycji nie ma tytułu: dopasujemy tylko te, które zna Wikidata. Gdy Filmweb2Letterboxd zapisze plik Filmweb2Letterboxd_pelny_….csv (z tytułami), wczytaj go tutaj – uzupełni resztę bez utraty dopasowań.`,
  previewTitle: 'Sprawdź, co wczytamy',
  previewConfirm: 'Importuj',
  previewCancel: 'Anuluj',
  importSoon: 'Import wkrótce. Na razie możesz obejrzeć aplikację w trybie demo.',
  bookmarklet: 'Alternatywa: przeciągnij ten przycisk na pasek zakładek, a potem kliknij go na karcie z krokiem 1. To ten sam skrypt w wersji zminifikowanej.',
  mobile: 'Import działa tylko na komputerze. Statystyki możesz przeglądać także na telefonie.',
  problems: [
    ['„Kinoskop: nie jesteś zalogowany”', 'Zaloguj się w tej samej przeglądarce (krok 1) i uruchom skrypt ponownie.'],
    ['Wkleiłem skrypt i nic się nie dzieje', 'Po wklejeniu w prawym dolnym rogu strony pojawia się panel „Kinoskop: …” z postępem. Jeśli go nie ma: sprawdź, czy wkleiłeś cały skrypt i nacisnąłeś Enter, oraz czy przeglądarka nie czeka na wpisanie „allow pasting”. Uruchamiaj skrypt na stronie robots.txt z kroku 1 – strona główna potrafi się przeładować i wyczyścić konsolę.'],
    ['Ile to trwa?', 'Po kilku minutach skrypt zapisuje część 1 (kinoskop-eksport-…-czesc-1.json) – wczytaj ją od razu, statystyki będą gotowe. Potem w tej samej karcie pobiera tytuły pozycji, których nie znaleźliśmy w Wikidata (przy kilku tysiącach ocen ok. pół godziny), i zapisuje część 2 – przeciągnij ją tutaj, uzupełni część 1 bez utraty danych. Kolejne importy są szybkie, bo skrypt pamięta pobrane tytuły. Trzymaj kartę na wierzchu (może być w osobnym oknie): karty w tle przeglądarka mocno spowalnia.'],
    ['Jak wyczyścić pamięć skryptu?', 'Na karcie z krokiem 1 wpisz w konsoli: localStorage.removeItem(\'kinoskop-titles-v1\')'],
    ['Skrypt przerwany (zamknięta karta, błąd sieci)', 'Uruchom go ponownie na tej samej karcie – postęp jest wznawiany.'],
    ['„Za dużo zapytań”', 'Skrypt sam zwalnia; przy uporczywych błędach spróbuj za kilka minut.'],
    ['Telefon lub tablet', 'Import działa tylko na komputerze, przeglądanie statystyk również na telefonie.'],
    ['Mój plik CSV nie jest rozpoznawany', 'Plik musi mieć wiersz nagłówka z kolumną Title (albo Name). Opcjonalnie: Year, WatchedDate (RRRR-MM-DD), Rating10 (1–10) lub Rating (0,5–5 gwiazdek). Tabele archiwum Filmweb2Letterboxd rozpoznajemy po kolumnach List, Kind i FilmwebID.'],
    ['Plik nie przechodzi walidacji', 'Komunikat wskaże wersję schematu. Upewnij się, że używasz najnowszego skryptu i zgłoś problem, jeśli błąd się powtarza.'],
  ] as const,
} as const;

export type BrowserId = 'chromium' | 'firefox' | 'safari';

export const CONSOLE_STEPS: Record<BrowserId, { label: string; open: string; paste: string }> = {
  chromium: {
    label: 'Chrome / Edge / Brave',
    open: 'Ctrl+Shift+J (Windows/Linux) lub Cmd+Option+J (macOS)',
    paste: 'Przy pierwszym wklejeniu przeglądarka pokaże ostrzeżenie: wpisz allow pasting i naciśnij Enter.',
  },
  firefox: {
    label: 'Firefox',
    open: 'Ctrl+Shift+K (Windows/Linux) lub Cmd+Option+K (macOS)',
    paste: 'Przy pierwszym wklejeniu wpisz allow pasting i naciśnij Enter.',
  },
  safari: {
    label: 'Safari',
    open: 'Najpierw Ustawienia → Zaawansowane → Pokaż funkcje dla twórców stron, potem Cmd+Option+C',
    paste: 'Wklej skrypt i naciśnij Enter.',
  },
};

export function detectBrowser(ua: string): BrowserId {
  if (/firefox|fxios/i.test(ua)) return 'firefox';
  if (/safari/i.test(ua) && !/chrome|chromium|edg|crios/i.test(ua)) return 'safari';
  return 'chromium';
}
