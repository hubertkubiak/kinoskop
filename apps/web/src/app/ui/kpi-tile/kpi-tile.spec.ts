import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { pageText } from '../../testing/dom';
import { KpiTile } from './kpi-tile';

describe('KpiTile', () => {
  it('renders label, value and the optional hint', async () => {
    const f = TestBed.createComponent(KpiTile);
    f.componentRef.setInput('label', 'Średnia ocena');
    f.componentRef.setInput('value', '7,4');
    await f.whenStable();
    expect(pageText(f)).toBe('Średnia ocena 7,4');
    expect(f.nativeElement.querySelectorAll('p')).toHaveLength(2);

    f.componentRef.setInput('hint', 'z 120 ocen');
    await f.whenStable();
    expect(pageText(f)).toBe('Średnia ocena 7,4 z 120 ocen');
  });
});
