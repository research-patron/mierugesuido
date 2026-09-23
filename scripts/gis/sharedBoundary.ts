type Point = [number, number];
type Ring = Point[];

// Simplify each shared arc once, with identical vertices in both directions.
// Municipalities must not independently simplify their common boundary.
export function simplifySharedBoundaries(rings: Ring[], tolerance: number): Ring[] {
  const points = new Map<string, Point>();
  const neighbors = new Map<string, Set<string>>();
  const key = (p: Point) => `${p[0]},${p[1]}`;
  const ids = rings.map(ring => {
    const list = ring.map(p => { const id = key(p); points.set(id, p); return id; });
    if (list[0] === list.at(-1)) list.pop();
    for (let i = 0; i < list.length; i++) {
      const a = list[i], b = list[(i + 1) % list.length];
      if (a === b) continue;
      if (!neighbors.has(a)) neighbors.set(a, new Set());
      if (!neighbors.has(b)) neighbors.set(b, new Set());
      neighbors.get(a)!.add(b); neighbors.get(b)!.add(a);
    }
    return list;
  });
  const cache = new Map<string, Ring>();
  function arc(list: string[]): Ring {
    const reverse = list[0] > list.at(-1)!;
    const canonical = reverse ? [...list].reverse() : list;
    const id = canonical.join(";");
    let result = cache.get(id);
    if (!result) {
      result = simplifyLine(canonical.map(k => points.get(k)!), tolerance);
      cache.set(id, result);
    }
    return reverse ? [...result].reverse() : result;
  }
  return ids.map((list, ringIndex) => {
    if (list.length < 4) return rings[ringIndex];
    let cuts = list.flatMap((id, i) => neighbors.get(id)!.size !== 2 ? [i] : []);
    // A closed coast or enclave without junctions needs two stable anchors,
    // chosen independently of winding/start vertex so both sides still match.
    if (cuts.length < 2) {
      const first = cuts[0] ?? list.reduce((best, id, i) => id < list[best] ? i : best, 0);
      const origin = points.get(list[first])!;
      const farthest = list.reduce((best, id, i) => {
        const distance = (k: string) => { const p = points.get(k)!; return (p[0] - origin[0]) ** 2 + (p[1] - origin[1]) ** 2; };
        return distance(id) > distance(list[best]) ? i : best;
      }, first);
      cuts = [first, farthest].sort((a, b) => a - b);
    }
    const result: Ring = [];
    cuts.forEach((start, index) => {
      const end = cuts[(index + 1) % cuts.length];
      const segment = start < end ? list.slice(start, end + 1) : [...list.slice(start), ...list.slice(0, end + 1)];
      result.push(...arc(segment).slice(0, -1));
    });
    // Tiny closed rings are retained intact, not dropped or turned into lines.
    if (result.length < 3) return rings[ringIndex];
    return [...result, result[0]];
  });
}

function simplifyLine(points: Ring, tolerance: number): Ring {
  const keep = new Set([0, points.length - 1]);
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    const a = points[start], b = points[end];
    const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
    let max = tolerance * tolerance, split = -1;
    for (let i = start + 1; i < end; i++) {
      const p = points[i];
      const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
      const distance = (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
      if (distance > max) { max = distance; split = i; }
    }
    if (split !== -1) { keep.add(split); stack.push([start, split], [split, end]); }
  }
  return [...keep].sort((a, b) => a - b).map(i => points[i]);
}
