import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideEchartsCore } from 'ngx-echarts';
import { appRoutes } from './app.routes';
import { ApiClient } from './core/api.client';
import { EnrichmentService } from './core/enrichment.service';
import { LibraryStore } from './core/library.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(appRoutes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // ECharts is loaded lazily on the first chart, keeping it out of the initial bundle.
    provideEchartsCore({ echarts: () => import('./charts/echarts-setup').then((m) => m.echarts) }),
    provideAppInitializer(() => {
      // Wake the API in the background (it may be asleep on a free host, SPEC §8.4).
      void inject(ApiClient).warmUp();
      const enrichment = inject(EnrichmentService);
      // Resume enrichment after a reload if some titles are still missing metadata.
      return inject(LibraryStore).init().then(() => void enrichment.start());
    }),
  ],
};
