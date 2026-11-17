/** Final bounded generator: three analytic height fields, disjoint seeded radial
 * potholes, visible source-area control, and a conforming local quadtree.
 * No arbitrary mesh support or general surface parameterization is claimed. */
import { surfaceSample, radialBoundary, depthProfile, DEFAULTS } from './geometry-legacy.mjs';
const WIDTH = 8, LENGTH = 12, TAU = Math.PI * 2;
const DIVISORS = { low: 14, medium: 28, high: 56 };
const now = () => globalThis.performance?.now?.() ?? Date.now();
const overlapPolicy = 'Reject intersecting conservative radial support disks; no blending, merging, or silent omission';
function number(name, x, min, max) {
  if (!Number.isFinite(x) || x < min || x > max) throw new RangeError(`${name} must be finite in [${min}, ${max}].`);
  return x;
}
function normalize(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('buildRoad options must be an object.');
  const surface = options.surface ?? 'flat', resolution = options.resolution ?? 'medium';
  const mesh = options.mesh ?? 'adaptive', edgeMode = options.edgeMode ?? 'reject';
  if (!['flat', 'slope', 'curve'].includes(surface)) throw new RangeError('surface must be flat, slope, or curve.');
  if (!Object.hasOwn(DIVISORS, resolution)) throw new RangeError('resolution must be low, medium, or high.');
  if (!['adaptive', 'graded'].includes(mesh)) throw new RangeError('mesh must be adaptive or graded.');
  if (!['reject', 'clip'].includes(edgeMode)) throw new RangeError('edgeMode must be reject or clip.');
  const inputs = Object.hasOwn(options, 'potholes') ? options.potholes : [options];
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 8) throw new RangeError('potholes must contain 1 to 8 potholes.');
  const usedIds = new Set();
  const potholes = inputs.map((p, index) => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new TypeError(`potholes[${index}] must be an object.`);
    const id = p.id ?? `pothole-${index + 1}`;
    if ((typeof id !== 'string' && typeof id !== 'number') || usedIds.has(String(id))) throw new RangeError('Pothole ids must be unique strings or numbers.');
    usedIds.add(String(id));
    const o = p.origin ?? DEFAULTS.origin;
    if (!o || typeof o !== 'object') throw new TypeError('origin must contain finite u and v.');
    const seed = p.seed ?? DEFAULTS.seed;
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('seed must be uint32.');
    return { id, area: number('area', p.area ?? DEFAULTS.area, .02, 40),
      depth: number('depth', p.depth ?? DEFAULTS.depth, 0, 1),
      roughness: number('roughness', p.roughness ?? DEFAULTS.roughness, 0, .6), seed,
      origin: { u: number('origin.u', o.u ?? 0, -WIDTH / 2, WIDTH / 2), v: number('origin.v', o.v ?? 0, -LENGTH / 2, LENGTH / 2) } };
  });
  return { surface, resolution, mesh, edgeMode, potholes };
}
function shapeOf(seed, roughness) {
  let state = seed >>> 0;
  const random = () => { state = (state + 0x6d2b79f5) | 0; let x = Math.imul(state ^ state >>> 15, 1 | state); x ^= x + Math.imul(x ^ x >>> 7, 61 | x); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  return { frequencies: [3, 5, 7], weights: [.55, .30, .15], phases: [random(), random(), random()].map(x => x * TAU), roughness };
}
function jacobian(surface, u, v) {
  return surface === 'flat' ? 1 : surface === 'slope' ? Math.sqrt(1.0725) : Math.sqrt(1 + (.09 * u) ** 2 + (.05 * v) ** 2);
}
function rayLimit(origin, cs, sn) {
  let t = Infinity;
  if (cs > 1e-14) t = Math.min(t, (WIDTH / 2 - origin.u) / cs);
  else if (cs < -1e-14) t = Math.min(t, (-WIDTH / 2 - origin.u) / cs);
  if (sn > 1e-14) t = Math.min(t, (LENGTH / 2 - origin.v) / sn);
  else if (sn < -1e-14) t = Math.min(t, (-LENGTH / 2 - origin.v) / sn);
  return Math.max(0, t);
}
function quadrature(hole, angularSteps) {
  return Array.from({ length: angularSteps }, (_, i) => {
    const theta = TAU * (i + .5) / angularSteps, cs = Math.cos(theta), sn = Math.sin(theta);
    return [cs, sn, radialBoundary(theta, hole.shape), rayLimit(hole.origin, cs, sn)];
  });
}
// Independent of render vertices: angular midpoint and radial Simpson quadrature.
// The rectangular road clips each integration ray before it is integrated.
function integrate(surface, hole, scale, rays, radialSteps = 8) {
  let sum = 0;
  for (const [cs, sn, radial, limit] of rays) {
    const outer = Math.min(scale * radial, limit);
    if (surface !== 'curve') { sum += outer * outer * .5 * jacobian(surface, 0, 0); continue; }
    let radialSum = 0;
    for (let k = 0; k <= radialSteps; k++) {
      const r = outer * k / radialSteps, weight = k === 0 || k === radialSteps ? 1 : k % 2 ? 4 : 2;
      radialSum += weight * r * jacobian(surface, hole.origin.u + cs * r, hole.origin.v + sn * r);
    }
    sum += radialSum * outer / (3 * radialSteps);
  }
  return sum * TAU / rays.length;
}
function prepare(options) {
  const config = normalize(options);
  const holes = config.potholes.map(p => {
    const hole = { ...p, shape: shapeOf(p.seed, p.roughness) };
    const rays = quadrature(hole, config.edgeMode === 'clip' ? 2048 : 256);
    let lo = 0, hi = Math.sqrt(p.area / Math.PI) / (1 - p.roughness);
    while (integrate(config.surface, hole, hi, rays) < p.area) {
      hi *= 2;
      if (hi > 128) throw new RangeError('Requested visible footprint area cannot fit on this road.');
    }
    for (let k = 0; k < 39; k++) {
      const mid = (lo + hi) / 2;
      if (integrate(config.surface, hole, mid, rays) < p.area) lo = mid; else hi = mid;
    }
    hole.scale = (lo + hi) / 2;
    hole.radiusBound = hole.scale * (1 + p.roughness);
    if (config.edgeMode === 'reject' && (Math.abs(p.origin.u) + hole.radiusBound >= WIDTH / 2 - 1e-5 || Math.abs(p.origin.v) + hole.radiusBound >= LENGTH / 2 - 1e-5)) {
      throw new RangeError('The complete pothole footprint must fit inside the 8 x 12 m road. Use edgeMode clip or move the pothole inward.');
    }
    hole.fineStep = Math.max(.001, hole.radiusBound / DIVISORS[config.resolution]);
    hole.clipped = rays.some(([, , radial, limit]) => hole.scale * radial > limit + 1e-10);
    return hole;
  });
  for (let i = 0; i < holes.length; i++) for (let j = i + 1; j < holes.length; j++) {
    const a = holes[i], b = holes[j];
    if (Math.hypot(a.origin.u - b.origin.u, a.origin.v - b.origin.v) <= a.radiusBound + b.radiusBound + 1e-5) {
      throw new RangeError(`Potholes ${a.id} and ${b.id} overlap conservative support disks. Move them apart or reduce their areas. Overlap merging is not implemented.`);
    }
  }
  return { config, holes };
}
function qAt(hole, u, v) {
  const x = u - hole.origin.u, y = v - hole.origin.v;
  return Math.hypot(x, y) / (hole.scale * radialBoundary(Math.atan2(y, x), hole.shape));
}
function evaluate(surface, holes, u, v) {
  let q = Infinity, owner = 0;
  for (let i = 0; i < holes.length; i++) {
    const candidate = qAt(holes[i], u, v);
    if (candidate < q) { q = candidate; owner = i; }
  }
  const sample = surfaceSample(surface, u, v), depth = holes[owner].depth * depthProfile(q);
  return { source: sample.position, deformed: sample.position.map((x, k) => x - depth * sample.normal[k]), depth, q, holeId: owner + 1 };
}
function axis(min, max, holes, dimension) {
  const positions = [min]; let x = min;
  while (x < max - 1e-10) {
    let step = .65;
    for (const hole of holes) {
      const distance = Math.max(0, Math.abs(x - hole.origin[dimension]) - hole.radiusBound * 1.08);
      step = Math.min(step, hole.fineStep + .3 * distance);
    }
    x = Math.min(max, x + step); positions.push(x);
  }
  for (const hole of holes) positions.push(hole.origin[dimension]);
  const sorted = positions.sort((a, b) => a - b);
  return sorted.filter((x, i) => i === 0 || x - sorted[i - 1] > 1e-9);
}
function makeGraded(holes) {
  const us = axis(-WIDTH / 2, WIDTH / 2, holes, 'u'), vs = axis(-LENGTH / 2, LENGTH / 2, holes, 'v');
  const points = [], indices = [];
  for (const v of vs) for (const u of us) points.push([u, v]);
  for (let j = 0; j < vs.length - 1; j++) for (let i = 0; i < us.length - 1; i++) {
    const a = j * us.length + i, b = a + 1, c = a + us.length, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  return { points, indices, grid: { u: Float64Array.from(us), v: Float64Array.from(vs), uCount: us.length, vCount: vs.length }, leaves: null };
}
function makeAdaptive(holes) {
  // Integer coordinates make edge-node agreement exact across unequal leaves.
  // Fine edge vertices also partition neighbouring coarse polygons; all edges
  // have matching subdivisions and therefore no T junctions or cracks.
  const maxLevel = 13, N = 2 ** maxLevel, leaves = [];
  function visit(x, y, size, level) {
    const u0 = -WIDTH / 2 + WIDTH * x / N, v0 = -LENGTH / 2 + LENGTH * y / N;
    const du = WIDTH * size / N, dv = LENGTH * size / N;
    let target = .75;
    for (const h of holes) {
      const distance = Math.hypot(Math.max(u0 - h.origin.u, 0, h.origin.u - u0 - du), Math.max(v0 - h.origin.v, 0, h.origin.v - v0 - dv));
      const outside = Math.max(0, distance - h.radiusBound * 1.08);
      target = Math.min(target, h.fineStep + outside * .6);
    }
    if (level < maxLevel && Math.max(du, dv) > target * 1.6) {
      const half = size / 2;
      visit(x, y, half, level + 1); visit(x + half, y, half, level + 1);
      visit(x, y + half, half, level + 1); visit(x + half, y + half, half, level + 1);
    } else leaves.push({ x, y, size, level });
  }
  visit(0, 0, N, 0);
  const horizontal = new Map(), vertical = new Map();
  function add(map, k, v) { if (!map.has(k)) map.set(k, new Set()); map.get(k).add(v); }
  for (const c of leaves) for (const [x, y] of [[c.x, c.y], [c.x + c.size, c.y], [c.x, c.y + c.size], [c.x + c.size, c.y + c.size]]) {
    add(horizontal, y, x); add(vertical, x, y);
  }
  for (const map of [horizontal, vertical]) for (const [k, values] of map) map.set(k, [...values].sort((a, b) => a - b));
  const pointMap = new Map(), points = [], indices = [];
  function vertex(x, y) {
    const key = `${x},${y}`;
    if (!pointMap.has(key)) { pointMap.set(key, points.length); points.push([-WIDTH / 2 + WIDTH * x / N, -LENGTH / 2 + LENGTH * y / N]); }
    return pointMap.get(key);
  }
  for (const c of leaves) {
    const x0 = c.x, x1 = c.x + c.size, y0 = c.y, y1 = c.y + c.size;
    const ring = [];
    // Clockwise in (u,v) gives upward winding after mapping to (u,h,v).
    for (const y of vertical.get(x0)) if (y >= y0 && y < y1) ring.push(vertex(x0, y));
    for (const x of horizontal.get(y1)) if (x >= x0 && x < x1) ring.push(vertex(x, y1));
    for (const y of [...vertical.get(x1)].reverse()) if (y > y0 && y <= y1) ring.push(vertex(x1, y));
    for (const x of [...horizontal.get(y0)].reverse()) if (x > x0 && x <= x1) ring.push(vertex(x, y0));
    if (ring.length === 4) indices.push(ring[0], ring[1], ring[3], ring[3], ring[1], ring[2]);
    else {
      const center = vertex((x0 + x1) / 2, (y0 + y1) / 2);
      for (let i = 0; i < ring.length; i++) indices.push(center, ring[i], ring[(i + 1) % ring.length]);
    }
  }
  return { points, indices, grid: null, leaves: leaves.map(c => ({ u: -WIDTH / 2 + WIDTH * c.x / N, v: -LENGTH / 2 + LENGTH * c.y / N, width: WIDTH * c.size / N, length: LENGTH * c.size / N, level: c.level })) };
}
function triArea(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  return .5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}
function clippedArea(positions, field, a, b, c) {
  if (field[a] > 0 && field[b] > 0 && field[c] > 0) return 0;
  const input = [a, b, c].map(i => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2], field[i]]);
  const output = []; let previous = input[2];
  for (const current of input) {
    const inside = current[3] <= 0, prior = previous[3] <= 0;
    if (inside !== prior) { const t = previous[3] / (previous[3] - current[3]); output.push(previous.slice(0, 3).map((x, k) => x + t * (current[k] - x))); }
    if (inside) output.push(current);
    previous = current;
  }
  let area = 0;
  for (let i = 1; i < output.length - 1; i++) area += triArea(output[0], output[i], output[i + 1]);
  return area;
}
function normalsAndQuality(positions, originals, indices) {
  const accumulated = new Float64Array(positions.length); let invertedTriangles = 0, degenerateTriangles = 0, deformedArea = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const offsets = [indices[i] * 3, indices[i + 1] * 3, indices[i + 2] * 3], [a, b, c] = offsets;
    const cross = (p) => { const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2]; return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; };
    const n = cross(positions), original = cross(originals), magnitude = Math.hypot(...n);
    deformedArea += magnitude / 2;
    if (magnitude < 1e-12) degenerateTriangles++;
    if (n.reduce((sum, x, k) => sum + x * original[k], 0) <= 0) invertedTriangles++;
    for (const offset of offsets) for (let k = 0; k < 3; k++) accumulated[offset + k] += n[k];
  }
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < normals.length; i += 3) { const m = Math.hypot(accumulated[i], accumulated[i + 1], accumulated[i + 2]) || 1; for (let k = 0; k < 3; k++) normals[i + k] = accumulated[i + k] / m; }
  return { normals, invertedTriangles, degenerateTriangles, deformedArea };
}
function clippedPolygon(hole) {
  let polygon = Array.from({ length: 1024 }, (_, i) => {
    const a = TAU * i / 1024, r = hole.scale * radialBoundary(a, hole.shape);
    return [hole.origin.u + r * Math.cos(a), hole.origin.v + r * Math.sin(a)];
  });
  for (const [dimension, bound, direction] of [[0, -WIDTH / 2, 1], [0, WIDTH / 2, -1], [1, -LENGTH / 2, 1], [1, LENGTH / 2, -1]]) {
    const output = []; let prior = polygon.at(-1);
    for (const current of polygon) {
      const priorInside = direction * (prior[dimension] - bound) >= -1e-12, currentInside = direction * (current[dimension] - bound) >= -1e-12;
      if (priorInside !== currentInside) { const t = (bound - prior[dimension]) / (current[dimension] - prior[dimension]); output.push(prior.map((x, k) => x + t * (current[k] - x))); }
      if (currentInside) output.push(current);
      prior = current;
    }
    polygon = output;
  }
  return polygon;
}
function boundaryFor(surface, holes, hole) {
  const polygon = clippedPolygon(hole), values = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .035));
    for (let j = 0; j < count; j++) {
      const t = j / count, u = a[0] + t * (b[0] - a[0]), v = a[1] + t * (b[1] - a[1]);
      values.push(...evaluate(surface, holes, u, v).deformed);
    }
  }
  values.push(...values.slice(0, 3));
  return Float32Array.from(values);
}
function borderOf(top, thickness) {
  const edges = new Map();
  for (let i = 0; i < top.indices.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = top.indices[i + j], b = top.indices[i + (j + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`;
    if (edges.has(key)) edges.delete(key); else edges.set(key, [a, b]);
  }
  const positions = [], originals = [], indices = [], uv = [];
  for (const [a, b] of edges.values()) {
    const n = positions.length / 3;
    for (const [i, bottom] of [[a, false], [b, false], [a, true], [b, true]]) {
      const original = Array.from(top.originalPositions.subarray(i * 3, i * 3 + 3));
      const deformed = Array.from(top.positions.subarray(i * 3, i * 3 + 3));
      if (bottom) { original[1] -= thickness; deformed.splice(0, 3, ...original); }
      positions.push(...deformed); originals.push(...original); uv.push(top.uv[2 * i], bottom ? 0 : 1);
    }
    indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
  }
  const p = Float32Array.from(positions), o = Float32Array.from(originals), ix = Uint32Array.from(indices), count = p.length / 3;
  return { positions: p, originalPositions: o, indices: ix, normals: normalsAndQuality(p, o, ix).normals,
    uv: Float32Array.from(uv), depression: new Float32Array(count), boundaryField: new Float32Array(count).fill(1),
    holeIds: new Float32Array(count), surfacePart: new Float32Array(count).fill(1), thickness };
}

export function buildFinalRoad(options = {}) {
  const started = now(), { config, holes } = prepare(options);
  const mesh = config.mesh === 'adaptive' ? makeAdaptive(holes) : makeGraded(holes), count = mesh.points.length;
  const positions = new Float32Array(count * 3), originalPositions = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  const depression = new Float32Array(count), boundaryField = new Float32Array(count), holeIds = new Float32Array(count), surfacePart = new Float32Array(count);
  const fields = holes.map(() => new Float64Array(count)); let maxDepth = 0;
  for (let i = 0; i < count; i++) {
    const [u, v] = mesh.points[i], value = evaluate(config.surface, holes, u, v);
    positions.set(value.deformed, i * 3); originalPositions.set(value.source, i * 3); depression[i] = value.depth;
    boundaryField[i] = value.q - 1; holeIds[i] = value.holeId; uv.set([(u + WIDTH / 2) / WIDTH, (v + LENGTH / 2) / LENGTH], i * 2);
    maxDepth = Math.max(maxDepth, value.depth);
    for (let j = 0; j < holes.length; j++) fields[j][i] = qAt(holes[j], u, v) - 1;
  }
  const indices = Uint32Array.from(mesh.indices), quality = normalsAndQuality(positions, originalPositions, indices);
  if (quality.invertedTriangles || quality.degenerateTriangles) throw new RangeError(`Generated mesh failed quality validation (${quality.invertedTriangles} inverted, ${quality.degenerateTriangles} degenerate triangles). Reduce depth or roughness, or increase sampling.`);
  // A floating vertex ID cannot be interpolated across different owners inside
  // an active triangle without potentially changing a hole's identity. Also,
  // interpolating min(q_i-1) across two owners can bridge their source fields.
  // Reject that discrete ambiguity rather than emitting incorrect labels. For
  // accepted active triangles all three owners are identical, so the union
  // field equals that owner's per-hole field at every vertex and after linear
  // interpolation. This is an additional sampling-separation policy, beyond
  // the conservative support-disk overlap check; it never edits accepted data.
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2];
    if ((boundaryField[a] <= 0 || boundaryField[b] <= 0 || boundaryField[c] <= 0) &&
        (holeIds[a] !== holeIds[b] || holeIds[a] !== holeIds[c])) {
      throw new RangeError('Potholes are too close at the current sampling: an active triangle has mixed owners. Move potholes farther apart or increase resolution.');
    }
  }

  const perHole = holes.map((hole, j) => {
    let measuredArea = 0;
    for (let i = 0; i < indices.length; i += 3) measuredArea += clippedArea(originalPositions, fields[j], indices[i], indices[i + 1], indices[i + 2]);
    const integrationAngular = config.edgeMode === 'clip' ? 8192 : 1024;
    const integratedArea = integrate(config.surface, hole, hole.scale, quadrature(hole, integrationAngular), 16);
    const coarse = integrate(config.surface, hole, hole.scale, quadrature(hole, integrationAngular / 2), 8);
    return { id: hole.id, holeId: j + 1, targetArea: hole.area, measuredArea, integratedArea,
      relativeAreaError: Math.abs(measuredArea - hole.area) / hole.area,
      signedRelativeAreaError: (measuredArea - hole.area) / hole.area,
      integrationRelativeDifference: Math.abs(integratedArea - coarse) / integratedArea,
      integrationTargetRelativeError: Math.abs(integratedArea - hole.area) / hole.area,
      integrationResolution: { angular: integrationAngular, radial: 16 },
      scale: hole.scale, radiusBound: hole.radiusBound, fineStep: hole.fineStep, requestedDepth: hole.depth,
      origin: { ...hole.origin }, clipped: hole.clipped,
      supportCrossesBoundary: Math.abs(hole.origin.u) + hole.radiusBound >= WIDTH / 2 || Math.abs(hole.origin.v) + hole.radiusBound >= LENGTH / 2 };
  });
  const targetArea = perHole.reduce((a, h) => a + h.targetArea, 0), measuredArea = perHole.reduce((a, h) => a + h.measuredArea, 0);
  const integratedArea = perHole.reduce((a, h) => a + h.integratedArea, 0), fineStep = Math.min(...holes.map(h => h.fineStep));
  const uniformTriangles = Math.ceil(WIDTH / fineStep) * Math.ceil(LENGTH / fineStep) * 2;
  const boundaries = holes.map(h => boundaryFor(config.surface, holes, h));
  const first = config.potholes[0], normalizedOptions = { ...config, ...first, potholes: config.potholes.map(p => ({ ...p, origin: { ...p.origin } })) };
  const top = { positions, originalPositions, normals: quality.normals, indices, uv, depression, boundaryField, holeIds, nearestHoleIds: holeIds, surfacePart };
  const border = borderOf(top, Math.max(.55, ...holes.map(h => h.depth + .15)));
  const metrics = { targetArea, measuredArea, integratedArea, relativeAreaError: Math.abs(measuredArea - targetArea) / targetArea,
    signedRelativeAreaError: (measuredArea - targetArea) / targetArea,
    maxPerHoleRelativeAreaError: Math.max(...perHole.map(h => h.relativeAreaError)),
    integrationRelativeDifference: Math.max(...perHole.map(h => h.integrationRelativeDifference)),
    integrationTargetRelativeError: Math.max(...perHole.map(h => h.integrationTargetRelativeError)),
    integrationResolution: perHole[0].integrationResolution,
    measuredAreaMethod: 'Sum of disjoint per-hole original-mesh triangle areas clipped by each linearly interpolated radial field <= 0',
    areaDefinition: 'Visible footprint area on the original undamaged road inside the rectangular road domain; per-hole areas sum because conservative support disks do not overlap',
    maxDepth, requestedDepth: Math.max(...holes.map(h => h.depth)), vertices: count, triangles: indices.length / 3,
    borderVertices: border.positions.length / 3, borderTriangles: border.indices.length / 3,
    uniformTriangles, triangleReduction: 1 - indices.length / 3 / uniformTriangles, fineStep, coarseStep: .75,
    scale: holes[0].scale, radiusBound: holes[0].radiusBound,
    invertedTriangles: quality.invertedTriangles, degenerateTriangles: quality.degenerateTriangles,
    deformedRoadArea: quality.deformedArea, meshType: config.mesh, holeCount: holes.length,
    edgeMode: config.edgeMode, overlapPolicy,
    ownershipPolicy: 'Reject any triangle with a nonpositive boundary vertex and mixed nearest-owner IDs; move holes apart or increase sampling',
    refinementCriterion: config.mesh === 'adaptive' ? 'Refine while maximum leaf side exceeds 1.6 times the local nominal target; target grows with distance from conservative support disks' : 'Tensor-product axes with the same nominal target near projected support intervals',
    resolutionDivisor: DIVISORS[config.resolution], quadtreeLeaves: mesh.leaves?.length ?? 0, buildMs: now() - started };
  return { ...top, border, boundaries, boundary: boundaries[0], sourceBoundaries: holes.map(h => { const polygon = clippedPolygon(h); return Float32Array.from([...polygon, polygon[0]].flatMap(([u, v]) => surfaceSample(config.surface, u, v).position)); }),
    perHole, metrics, options: normalizedOptions, shape: holes[0].shape, shapes: holes.map(h => h.shape), width: WIDTH, length: LENGTH,
    grid: mesh.grid, quadtree: mesh.leaves };
}

/** Evaluate analytic displacement along a road-parameter cross section. */
export function sampleCrossSection(options = {}, { axis = 'u', value = 0, samples = 161 } = {}) {
  if (!['u', 'v'].includes(axis)) throw new RangeError('Cross-section axis must be u or v.');
  if (!Number.isInteger(samples) || samples < 2 || samples > 4097) throw new RangeError('Cross-section samples must be an integer from 2 to 4097.');
  number('Cross-section value', value, axis === 'u' ? -LENGTH / 2 : -WIDTH / 2, axis === 'u' ? LENGTH / 2 : WIDTH / 2);
  const { config, holes } = prepare(options), extent = axis === 'u' ? WIDTH : LENGTH;
  return Array.from({ length: samples }, (_, i) => {
    const t = -extent / 2 + extent * i / (samples - 1), u = axis === 'u' ? t : value, v = axis === 'u' ? value : t;
    const e = evaluate(config.surface, holes, u, v);
    return { u, v, source: e.source, deformed: e.deformed, depth: e.depth, holeId: e.q <= 1 ? e.holeId : 0 };
  });
}
