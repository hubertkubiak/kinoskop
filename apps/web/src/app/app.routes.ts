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
