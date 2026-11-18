export const IMPORT_STRINGS = {
  title: 'Zaimportuj swoje dane',
  lead: 'Kinoskop pokaże statystyki, mapę gustu i nagrody na podstawie Twoich ocen z Filmwebu. Dane zostają w tej przeglądarce.',
  demo: 'Zobacz demo',
  demoHint: 'Fikcyjny profil z przykładowymi ocenami – bez importu.',
  legal:
    'Skrypt automatyzuje pobranie Twoich własnych ocen z Filmwebu. Regulamin Filmwebu ogranicza korzystanie z programów automatycznych; korzystasz z importu na własną odpowiedzialność. Alternatywa: poproś Filmweb o kopię swoich danych (art. 15 i 20 RODO).',
  copy: 'Skopiuj skrypt',
  copied: 'Skopiowano! Wklej go w konsoli na filmweb.pl.',
  showCode: 'Pokaż pełny kod skryptu',
  safetyTitle: 'Czy to bezpieczne?',
  safety:
    'Skrypt tylko czyta Twoje dane z Filmwebu (zapytania GET), niczego nie zmienia i nigdzie niczego nie wysyła; jedynie zapisuje plik na Twoim dysku. Kod jest jawny powyżej. Ogólna zasada: nigdy nie wklejaj w konsolę kodu, którego nie rozumiesz albo którego źródłu nie ufasz.',
  drop: 'Przeciągnij tutaj plik kinoskop-eksport-….json',
  pick: 'albo wybierz plik',
  importSoon: 'Import wkrótce. Na razie możesz obejrzeć aplikację w trybie demo.',
  bookmarklet: 'Alternatywa: przeciągnij ten przycisk na pasek zakładek, a potem kliknij go na filmweb.pl. To ten sam skrypt w wersji zminifikowanej.',
  mobile: 'Import działa tylko na komputerze. Statystyki możesz przeglądać także na telefonie.',
  problems: [
    ['„Kinoskop: nie jesteś zalogowany”', 'Zaloguj się na filmweb.pl w tej samej przeglądarce i uruchom skrypt ponownie.'],
    ['Skrypt przerwany (zamknięta karta, błąd sieci)', 'Uruchom go ponownie na tej samej karcie – postęp jest wznawiany.'],
    ['„Za dużo zapytań”', 'Skrypt sam zwalnia; przy uporczywych błędach spróbuj za kilka minut.'],
    ['Telefon lub tablet', 'Import działa tylko na komputerze, przeglądanie statystyk również na telefonie.'],
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
