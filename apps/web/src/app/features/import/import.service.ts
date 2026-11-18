import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EnrichmentSchema, parseExportFile } from '@kinoskop/shared';
import { z } from 'zod';
import { LibraryStore } from '../../core/library.store';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly store = inject(LibraryStore);
  private readonly router = inject(Router);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async importFile(file: File): Promise<boolean> {
    this.error.set(null);
    if (file.size > MAX_FILE_BYTES) {
      this.error.set('Plik jest za duży (limit 20 MB).');
      return false;
    }
    this.busy.set(true);
    try {
      const result = parseExportFile(await file.text());
      if (!result.ok) {
        this.error.set(result.message);
        return false;
      }
      await this.store.loadExport(result.file, 'import');
      await this.router.navigateByUrl('/przeglad');
      return true;
    } finally {
      this.busy.set(false);
    }
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
