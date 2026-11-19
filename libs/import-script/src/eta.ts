// Szacowanie czasu do końca. Liczymy tylko zapytania wykonane przy widocznej karcie: w tle
// przeglądarka spowalnia timery i zawyżałaby wynik (developer.chrome.com/blog/timer-throttling-in-chrome-88).

export class EtaMeter {
  private visible: number[] = [];
  private all: number[] = [];

  constructor(private readonly window = 50) {}

  record(ms: number, wasVisible: boolean): void {
    const push = (arr: number[]) => {
      arr.push(ms);
      if (arr.length > this.window) arr.shift();
    };
    push(this.all);
    if (wasVisible) push(this.visible);
  }

  /** Szacowany czas (ms) dla `remaining` kolejnych zapytań przy widocznej karcie; undefined bez pomiarów. */
  estimate(remaining: number): number | undefined {
    const src = this.visible.length ? this.visible : this.all;
    if (!src.length) return undefined;
    return (src.reduce((s, x) => s + x, 0) / src.length) * remaining;
  }
}

export const fmtMinutes = (ms: number) => (ms < 90_000 ? 'ok. 1 min' : `ok. ${Math.round(ms / 60_000)} min`);
