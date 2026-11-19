import { inject } from '@angular/core';
import { type CanActivateFn, Router, type Route } from '@angular/router';
import { LibraryStore } from './core/library.store';
import { Shell } from './shell/shell';

/** Statistic views need data; without it the user lands on the import wizard. */
const requireData: CanActivateFn = () =>
  inject(LibraryStore).hasData() ? true : inject(Router).parseUrl('/start');

const landing: CanActivateFn = () =>
  inject(Router).parseUrl(inject(LibraryStore).hasData() ? '/przeglad' : '/start');

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', canActivate: [landing], children: [] },
  {
    path: 'start',
    title: 'Kinoskop – import',
    loadComponent: () => import('./features/import/import-page').then((m) => m.ImportPage),
  },
  {
    path: '',
    component: Shell,
    children: [
      {
        path: 'przeglad',
        title: 'Przegląd – Kinoskop',
        canActivate: [requireData],
        loadComponent: () => import('./features/overview/overview-page').then((m) => m.OverviewPage),
      },
      {
        path: 'gatunki',
        title: 'Gatunki – Kinoskop',
        canActivate: [requireData],
        loadComponent: () => import('./features/genres/genres-page').then((m) => m.GenresPage),
      },
      {
        path: 'oceny',
        title: 'Oceny – Kinoskop',
        canActivate: [requireData],
        loadComponent: () => import('./features/ratings/ratings-page').then((m) => m.RatingsPage),
      },
      {
        path: 'swiat',
        title: 'Świat – Kinoskop',
        canActivate: [requireData],
        loadComponent: () => import('./features/world/world-page').then((m) => m.WorldPage),
      },
      {
        path: 'epoki',
        title: 'Czas i epoki – Kinoskop',
        canActivate: [requireData],
        loadComponent: () => import('./features/eras/eras-page').then((m) => m.ErasPage),
      },
      {
        path: 'tworcy',
        title: 'Twórcy – Kinoskop',
        canActivate: [requireData],
        loadComponent: () => import('./features/creators/creators-page').then((m) => m.CreatorsPage),
      },
      {
        path: 'nagrody',
        title: 'Nagrody – Kinoskop',
        canActivate: [requireData],
        loadComponent: () => import('./features/awards/awards-page').then((m) => m.AwardsPage),
      },
      {
        path: 'gust',
        title: 'Twój gust – Kinoskop',
        canActivate: [requireData],
        loadComponent: () => import('./features/taste/taste-page').then((m) => m.TastePage),
      },
      // Former graph view (docs/adr/0002); old links keep working.
      { path: 'mapa-gustu', redirectTo: 'gust' },
      {
        path: 'chce-zobaczyc',
        title: 'Chcę zobaczyć – Kinoskop',
        canActivate: [requireData],
        loadComponent: () => import('./features/want2see/want2see-page').then((m) => m.Want2seePage),
      },
      {
        path: 'weryfikacja',
        title: 'Weryfikacja – Kinoskop',
        canActivate: [requireData],
        loadComponent: () => import('./features/verification/verification-page').then((m) => m.VerificationPage),
      },
      {
        path: 'o-aplikacji',
        title: 'O aplikacji – Kinoskop',
        loadComponent: () => import('./features/about/about-page').then((m) => m.AboutPage),
      },
      {
        path: 'prywatnosc',
        title: 'Prywatność – Kinoskop',
        loadComponent: () => import('./features/about/privacy-page').then((m) => m.PrivacyPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
