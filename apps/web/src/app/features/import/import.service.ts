import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  type CsvImportSummary,
  EnrichmentSchema,
  type ExportFile,
  importCsvFiles,
  looksLikeImportCsv,
  looksLikeVotesJson,
  parseExportFile,
} from '@kinoskop/shared';
import { z } from 'zod';
import { ApiClient } from '../../core/api.client';
import { EnrichmentService } from '../../core/enrichment.service';
import { LibraryStore } from '../../core/library.store';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly store = inject(LibraryStore);
  private readonly router = inject(Router);
  private readonly enrichment = inject(EnrichmentService);
  readonly api = inject(ApiClient);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  /** CSV import waiting for the user's confirmation (summary shown before anything is stored). */
  readonly pending = signal<{ file: ExportFile; summary: CsvImportSummary } | null>(null);

  /**
   * Accepts either one Kinoskop JSON export (console script) or one or more table files: CSV from
   * other tools (Letterboxd format) or the votes JSON files from a personal data request. The
   * format is detected by content.
   */
  async importFiles(files: readonly File[]): Promise<boolean> {
    this.error.set(null);
    this.pending.set(null);
    if (!files.length) return false;
    if (files.reduce((n, f) => n + f.size, 0) > MAX_FILE_BYTES) {
      this.error.set('Pliki są za duże (limit 20 MB łącznie).');
      return false;
    }
    this.busy.set(true);
    try {
      const all = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
      const isJson = (s: { name: string; text: string }) =>
        /\.json$/i.test(s.name) || s.text.trimStart().startsWith('{');
      // Filmweb2Letterboxd's raw JSON archive is not a Kinoskop export; its CSV tables carry the
      // same data. Dropped together with them, it is skipped; alone, the user is pointed to them.
      const isFw2lArchive = (s: { name: string; text: string }) =>
        isJson(s) && /"script"\s*:\s*"Filmweb2Letterboxd"/.test(s.text.slice(0, 500));
      const fw2lArchives = all.filter(isFw2lArchive);
      const sources = all.filter((s) => !isFw2lArchive(s));
      if (!sources.length) {
        this.error.set(
          `„${fw2lArchives[0].name}” to surowe archiwum Filmweb2Letterboxd. Wczytaj zamiast niego plik ` +
            'Filmweb2Letterboxd_pelny_….csv (z tytułami) albo Filmweb2Letterboxd_wstepny_….csv.',
        );
        return false;
      }
      // Votes files from a data request are JSON, but go through the table import (preview first).
      const json = sources.filter((s) => isJson(s) && !looksLikeVotesJson(s.text));
      if (json.length) {
        if (sources.length > 1) {
          this.error.set('Wybierz jeden plik kinoskop-eksport-….json albo same pliki CSV lub pliki ocen z kopii danych.');
          return false;
        }
        const result = parseExportFile(json[0].text);
        if (!result.ok) {
          this.error.set(result.message);
          return false;
        }
        await this.apply(result.file);
        return true;
      }
      const unknown = sources.find((s) => !looksLikeImportCsv(s.name, s.text));
      if (unknown) {
        this.error.set(
          `Nie rozpoznaję formatu pliku „${unknown.name}”. Obsługiwane: kinoskop-eksport-….json, pliki ocen z kopii danych (JSON z listą „votes”), CSV z kolumną Title (format Letterboxd) oraz tabele Filmweb2Letterboxd z kolumną FilmwebID.`,
        );
        return false;
      }
      const result = importCsvFiles(sources);
      if (!result.ok) {
        this.error.set(result.message);
        return false;
      }
      for (const a of fw2lArchives) {
        result.summary.ignoredFiles.push({ name: a.name, reason: 'surowe archiwum – te same dane są w tabelach CSV' });
      }
      this.pending.set({ file: result.file, summary: result.summary });
      // Title matching needs TMDB; refresh feature flags so the preview can warn when it is missing.
      void this.api.warmUp();
      return true;
    } finally {
      this.busy.set(false);
    }
  }

  async confirmPending(): Promise<void> {
    const p = this.pending();
    if (!p) return;
    this.busy.set(true);
    try {
      await this.apply(p.file);
      this.pending.set(null);
    } finally {
      this.busy.set(false);
    }
  }

  cancelPending(): void {
    this.pending.set(null);
  }

  private async apply(file: ExportFile): Promise<void> {
    // Part 2 (or a re-import) of the same user keeps what is already matched.
    if (this.store.isSameUser(file)) await this.store.mergeExport(file);
    else await this.store.loadExport(file, 'import');
    // Statistics that need no enrichment are shown immediately; enrichment runs in the background.
    void this.enrichment.start();
    await this.router.navigateByUrl('/przeglad');
  }

  /** Loads the fictional demo profile with pre-computed public metadata (SPEC §14.3). */
  async loadDemo(): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      const [exp, enr] = await Promise.all([
        fetch('assets/demo/demo-export.json').then((r) => r.text()),
        fetch('assets/demo/demo-enrichment.json').then((r) => r.json()),
      ]);
      const result = parseExportFile(exp);
      if (!result.ok) throw new Error(result.message);
      const enrichments = z.array(EnrichmentSchema).parse(enr);
      await this.store.loadExport(result.file, 'demo', enrichments);
      await this.router.navigateByUrl('/przeglad');
    } catch (e) {
      this.error.set(`Nie udało się wczytać demo: ${(e as Error).message}`);
    } finally {
      this.busy.set(false);
    }
  }
}
