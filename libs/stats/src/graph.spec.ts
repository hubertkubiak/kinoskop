import { describe, expect, it } from 'vitest';
import { creatorNetwork, MAX_GRAPH_NODES, tasteGraph } from './graph';
import { personKey } from './model';
import { LIBRARY, P } from './testing/fixture';

describe('taste graph', () => {
  it('links you → genres → recurring people', () => {
    const g = tasteGraph(LIBRARY);
    expect(g.nodes[0]).toMatchObject({ id: 'you', count: 8 });
    expect(g.nodes.filter((n) => n.kind === 'genre').map((n) => n.label)).toEqual(['Dramat', 'Thriller', 'Kryminał', 'Sci-Fi', 'Komedia', 'RPG']);
    const nolan = g.nodes.find((n) => n.label === 'Christopher Nolan');
    expect(nolan).toMatchObject({ kind: 'person', count: 2 });
    for (const e of g.edges) {
      expect(g.nodes.some((n) => n.id === e.source)).toBe(true);
      expect(g.nodes.some((n) => n.id === e.target)).toBe(true);
    }
  });

  it('expands a person into titles and respects the node cap', () => {
    const base = tasteGraph(LIBRARY);
    const person = base.nodes.find((n) => n.kind === 'person')!;
    const g = tasteGraph(LIBRARY, { expanded: new Set([person.id]) });
    expect(g.nodes.filter((n) => n.kind === 'title').length).toBeGreaterThan(0);

    const big = Array.from({ length: 50 }, (_, n) => LIBRARY.map((i) => ({ ...i, key: `${i.key}-${n}`, filmwebId: i.filmwebId * 1000 + n }))).flat();
    const all = new Set(tasteGraph(big).nodes.filter((n) => n.kind === 'person').map((n) => n.id));
    expect(tasteGraph(big, { expanded: all, genres: 30, peoplePerGenre: 30 }).nodes.length).toBeLessThanOrEqual(MAX_GRAPH_NODES);
  });

  it('builds a creator ego network with collaborators on ≥ 2 titles', () => {
    const g = creatorNetwork(LIBRARY, personKey(P.nolan));
    expect(g.nodes[0].label).toBe('Christopher Nolan');
    expect(g.nodes.filter((n) => n.kind === 'title')).toHaveLength(3);
    expect(g.nodes.filter((n) => n.kind === 'person').map((n) => n.label).sort()).toEqual(['Christian Bale', 'Michael Caine']);
    expect(creatorNetwork(LIBRARY, 'tmdb:0').nodes).toHaveLength(0);
  });
});
