import type { IconName } from '../ui/icon';

export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  /** Shown in the mobile bottom bar (max 4, the rest under "Więcej"). */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/przeglad', label: 'Przegląd', icon: 'dashboard', primary: true },
  { path: '/gatunki', label: 'Gatunki', icon: 'genres', primary: true },
  { path: '/oceny', label: 'Oceny', icon: 'ratings', primary: true },
  { path: '/swiat', label: 'Świat', icon: 'world' },
  { path: '/epoki', label: 'Czas i epoki', icon: 'eras' },
  { path: '/tworcy', label: 'Twórcy', icon: 'people' },
  { path: '/nagrody', label: 'Nagrody', icon: 'awards', primary: true },
  { path: '/gust', label: 'Twój gust', icon: 'graph' },
  { path: '/chce-zobaczyc', label: 'Chcę zobaczyć', icon: 'bookmark' },
  { path: '/weryfikacja', label: 'Weryfikacja', icon: 'verify' },
];
