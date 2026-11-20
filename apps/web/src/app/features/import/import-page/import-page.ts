import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DomSanitizer, type SafeUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { BRAND, KIND_LABELS, KINDS } from '@kinoskop/shared';
import { ENV } from '../../../core/env';
import { LibraryStore } from '../../../core/library.store';
import { FilmLeader } from '../../../ui/film-leader/film-leader';
import { Icon } from '../../../ui/icon/icon';
import { SiteFooter } from '../../../shell/site-footer/site-footer';
import { CONSOLE_STEPS, type BrowserId, detectBrowser, IMPORT_STRINGS } from '../import.strings';
import { ImportService } from '../import.service';

@Component({
  selector: 'ks-import-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, FilmLeader, RouterLink, SiteFooter],
  templateUrl: './import-page.html',
})
export class ImportPage {
  private readonly clipboard = inject(Clipboard);
  private readonly sanitizer = inject(DomSanitizer);
  readonly importer = inject(ImportService);
  readonly store = inject(LibraryStore);

  readonly s = IMPORT_STRINGS;
  readonly brand = BRAND;
  readonly importEnabled = ENV.publicImportEnabled;
  readonly browsers = Object.entries(CONSOLE_STEPS) as [BrowserId, (typeof CONSOLE_STEPS)[BrowserId]][];
  readonly browser = signal<BrowserId>(detectBrowser(navigator.userAgent));
  readonly isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

  readonly accepted = signal(false);
  readonly copied = signal(false);
  readonly showCode = signal(false);
  readonly dragOver = signal(false);
  readonly script = signal<string | null>(null);
  readonly bookmarklet = signal<SafeUrl | null>(null);

  constructor() {
    void this.loadScripts();
  }

  private async loadScripts(): Promise<void> {
    try {
      const [code, bm] = await Promise.all([
        fetch('import/kinoskop-import.js').then((r) => (r.ok ? r.text() : Promise.reject())),
        fetch('import/kinoskop-bookmarklet.txt').then((r) => (r.ok ? r.text() : Promise.reject())),
      ]);
      this.script.set(code);
      // javascript: URLs are blocked by Angular unless explicitly trusted (SPEC §5.1).
      // The value is our own build artefact, never user or third-party input.
      if (bm.startsWith('javascript:')) this.bookmarklet.set(this.sanitizer.bypassSecurityTrustUrl(bm));
    } catch {
      this.script.set(null);
    }
  }

  copy(): void {
    const code = this.script();
    if (!code || !this.accepted()) return;
    this.copied.set(this.clipboard.copy(code));
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) void this.importer.importFiles(files);
  }

  readonly kindLabels = KIND_LABELS;
  readonly kinds = KINDS;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onPick(input: HTMLInputElement): void {
    const files = Array.from(input.files ?? []);
    if (files.length) void this.importer.importFiles(files);
    input.value = '';
  }
}
