import type { Person } from '@kinoskop/shared';
import { genreCounts } from './genres';
import { displayTitle, isRated, type LibraryItem, mean, personKey, round1 } from './model';

export type GraphNodeKind = 'you' | 'genre' | 'person' | 'title';

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  count: number;
  avg?: number;
  x: number;
  y: number;
  /** 0–1, relative to the biggest node of the same kind. */
  weight: number;
  imageUrl?: string;
  rating?: number;
  /** Whether the node can be expanded (people → titles). */
  expandable?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const MAX_GRAPH_NODES = 150;

const polar = (cx: number, cy: number, r: number, a: number) => ({ x: Math.round(cx + r * Math.cos(a)), y: Math.round(cy + r * Math.sin(a)) });

interface PersonAgg {
  person: Person;
  items: LibraryItem[];
}

function peopleIn(items: LibraryItem[]): Map<string, PersonAgg> {
  const m = new Map<string, PersonAgg>();
  for (const it of items) {
    for (const p of [...(it.enrichment?.directors ?? []), ...(it.enrichment?.cast ?? [])]) {
      const k = personKey(p);
      const a = m.get(k) ?? { person: p, items: [] };
      if (!a.items.includes(it)) a.items.push(it);
      if (!a.person.profileUrl && p.profileUrl) a.person = p;
      m.set(k, a);
    }
  }
  return m;
}

const avgOf = (items: LibraryItem[]) => round1(mean(items.filter(isRated).map((i) => i.rating)));

/**
 * "Mapa gustu" (SPEC §7.8): You → genres → most frequent people per genre → (expanded) titles.
 * Deterministic radial layout; capped at MAX_GRAPH_NODES nodes.
 */
export function tasteGraph(
  items: LibraryItem[],
  opts: { genres?: number; peoplePerGenre?: number; expanded?: ReadonlySet<string> } = {},
): Graph {
  const rated = items.filter((i) => i.list === 'rated' && i.enrichment);
  const maxGenres = opts.genres ?? 10;
  const perGenre = opts.peoplePerGenre ?? 6;
  const expanded = opts.expanded ?? new Set<string>();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const add = (n: GraphNode) => nodes.length < MAX_GRAPH_NODES && nodes.push(n);

  add({ id: 'you', kind: 'you', label: 'Ty', count: rated.length, avg: avgOf(rated), x: 0, y: 0, weight: 1 });
  const genres = genreCounts(rated).slice(0, maxGenres);
  const maxG = genres[0]?.count ?? 1;
  const usedPeople = new Set<string>();

  genres.forEach((g, gi) => {
    const angle = (2 * Math.PI * gi) / genres.length - Math.PI / 2;
    const gid = `g:${g.key}`;
    add({ id: gid, kind: 'genre', label: g.key, count: g.count, avg: g.avg, ...polar(0, 0, 420, angle), weight: g.count / maxG });
    edges.push({ id: `you-${gid}`, source: 'you', target: gid });

    const inGenre = rated.filter((i) => i.enrichment!.genres.includes(g.key));
    const people = [...peopleIn(inGenre).entries()]
      .filter(([k, a]) => a.items.length >= 2 && !usedPeople.has(k))
      .sort((a, b) => b[1].items.length - a[1].items.length)
      .slice(0, perGenre);
    const spread = Math.min(Math.PI / Math.max(3, genres.length / 2), 0.9);
    people.forEach(([k, a], pi) => {
      usedPeople.add(k);
      const pa = angle + (people.length > 1 ? (pi / (people.length - 1) - 0.5) * spread : 0);
      const pid = `p:${k}`;
      add({
        id: pid,
        kind: 'person',
        label: a.person.name,
        count: a.items.length,
        avg: avgOf(a.items),
        imageUrl: a.person.profileUrl,
        ...polar(0, 0, 820, pa),
        weight: Math.min(1, a.items.length / 8),
        expandable: true,
      });
      edges.push({ id: `${gid}-${pid}`, source: gid, target: pid });
      if (expanded.has(pid)) {
        a.items.slice(0, 8).forEach((it, ti) => {
          const tid = `t:${it.key}`;
          if (nodes.some((n) => n.id === tid)) {
            edges.push({ id: `${pid}-${tid}`, source: pid, target: tid });
            return;
          }
          add({
            id: tid,
            kind: 'title',
            label: displayTitle(it),
            count: 1,
            rating: it.rating,
            avg: it.rating,
            imageUrl: it.enrichment?.posterUrl,
            ...polar(0, 0, 1150 + (ti % 2) * 140, pa + (ti - 3.5) * 0.035),
            weight: 0.5,
          });
          edges.push({ id: `${pid}-${tid}`, source: pid, target: tid });
        });
      }
    });
  });
  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
}

/**
 * "Sieć twórcy": ego graph of a person – their watched titles and collaborators who worked
 * with them on at least `minShared` watched titles.
 */
export function creatorNetwork(items: LibraryItem[], key: string, minShared = 2): Graph {
  const own = items.filter((it) => [...(it.enrichment?.directors ?? []), ...(it.enrichment?.cast ?? [])].some((p) => personKey(p) === key));
  if (!own.length) return { nodes: [], edges: [] };
  const me = peopleIn(own).get(key)!;
  const nodes: GraphNode[] = [
    { id: `p:${key}`, kind: 'you', label: me.person.name, count: own.length, avg: avgOf(own), imageUrl: me.person.profileUrl, x: 0, y: 0, weight: 1 },
  ];
  const edges: GraphEdge[] = [];
  own.slice(0, 40).forEach((it, i) => {
    const a = (2 * Math.PI * i) / Math.min(own.length, 40);
    nodes.push({ id: `t:${it.key}`, kind: 'title', label: displayTitle(it), count: 1, rating: it.rating, avg: it.rating, imageUrl: it.enrichment?.posterUrl, ...polar(0, 0, 380, a), weight: 0.5 });
    edges.push({ id: `c-${it.key}`, source: `p:${key}`, target: `t:${it.key}` });
  });
  const collaborators = [...peopleIn(own).entries()]
    .filter(([k, a]) => k !== key && a.items.length >= minShared)
    .sort((a, b) => b[1].items.length - a[1].items.length)
    .slice(0, MAX_GRAPH_NODES - nodes.length);
  collaborators.forEach(([k, a], i) => {
    const angle = (2 * Math.PI * i) / collaborators.length + 0.1;
    nodes.push({ id: `p:${k}`, kind: 'person', label: a.person.name, count: a.items.length, avg: avgOf(a.items), imageUrl: a.person.profileUrl, ...polar(0, 0, 760, angle), weight: Math.min(1, a.items.length / 6) });
    for (const it of a.items) if (nodes.some((n) => n.id === `t:${it.key}`)) edges.push({ id: `${k}-${it.key}`, source: `p:${k}`, target: `t:${it.key}` });
  });
  return { nodes, edges };
}
