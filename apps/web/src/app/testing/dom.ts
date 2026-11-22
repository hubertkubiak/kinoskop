import type { ComponentFixture } from '@angular/core/testing';

/** DOM helpers for component specs: query by visible text instead of CSS classes. */

/** Visible text with text nodes joined by spaces, as a reader would see separate blocks. */
export function textOf(el: Element | null | undefined): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export const pageText = (f: ComponentFixture<unknown>): string => textOf(f.nativeElement as HTMLElement);

export function byText<T extends Element = HTMLElement>(f: ComponentFixture<unknown>, selector: string, text: string | RegExp): T | undefined {
  const all = Array.from((f.nativeElement as HTMLElement).querySelectorAll<T>(selector));
  return all.find((el) => (typeof text === 'string' ? textOf(el).includes(text) : text.test(textOf(el))));
}

/** Clicks the first `button` whose text contains `text` and waits for the view to settle. */
export async function click(f: ComponentFixture<unknown>, text: string | RegExp, selector = 'button'): Promise<void> {
  const el = byText<HTMLElement>(f, selector, text);
  if (!el) throw new Error(`No ${selector} with text ${String(text)} in: ${pageText(f)}`);
  el.click();
  await f.whenStable();
}
