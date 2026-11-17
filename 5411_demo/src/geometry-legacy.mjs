/**
 * A dependency-free, deliberately bounded geometry prototype.
 *
 * Supported roads are smooth height fields p(u,v) = (u, h(u,v), v), not
 * arbitrary triangle meshes. Units are metres. The source footprint is the
 * area on the UNDAMAGED road under a star-shaped radial contour. It does not
 * include the newly exposed pit walls.
 *
 * CPU geometry changes are real vertex displacements. Rendering/shading can
 * run on the GPU, but this module does not claim GPU tessellation or GPU mesh
 * deformation. A graded tensor grid shares every edge and has no T junctions;
 * it is not a general-purpose adaptive triangle-mesh remesher.
 */

export const DEFAULTS = Object.freeze({
  surface: 'flat',
  area: 2.0,
  depth: 0.22,
  roughness: 0.22,
  seed: 19,
  resolution: 'medium',
  origin: Object.freeze({ u: 0, v: 0 }),
  width: 8,
  length: 12,
});

const WIDTH = 8;
const LENGTH = 12;
const TWO_PI = 2 * Math.PI;
const FREQUENCIES = [3, 5, 7];
const WEIGHTS = [0.55, 0.30, 0.15];
const RESOLUTION_DIVISORS = { low: 18, medium: 28, high: 40 };

function timestamp() {
  return globalThis.performance?.now ? globalThis.performance.now() : Date.now();
}

function finiteInRange(name, value, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be a finite number in [${min}, ${max}].`);
  }
  return value;
}

function validatedOptions(options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('buildRoad options must be an object.');
  }
  const surface = options.surface ?? DEFAULTS.surface;
  if (!['flat', 'slope', 'curve'].includes(surface)) {
    throw new RangeError('surface must be flat, slope, or curve.');
  }
  const area = finiteInRange('area', options.area ?? DEFAULTS.area, 0.02, 40);
  const depth = finiteInRange('depth', options.depth ?? DEFAULTS.depth, 0, 1);
  const roughness = finiteInRange('roughness', options.roughness ?? DEFAULTS.roughness, 0, 0.6);
  const seed = options.seed ?? DEFAULTS.seed;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('seed must be an unsigned 32-bit integer.');
  }
  const resolution = options.resolution ?? DEFAULTS.resolution;
  if (typeof resolution !== 'string' || !Object.hasOwn(RESOLUTION_DIVISORS, resolution)) {
    throw new RangeError('resolution must be low, medium, or high.');
  }
  const inputOrigin = options.origin ?? DEFAULTS.origin;
  if (inputOrigin === null || typeof inputOrigin !== 'object') {
    throw new TypeError('origin must be an object containing finite u and v.');
  }
  const origin = {
    u: finiteInRange('origin.u', inputOrigin.u ?? 0, -WIDTH / 2, WIDTH / 2),
    v: finiteInRange('origin.v', inputOrigin.v ?? 0, -LENGTH / 2, LENGTH / 2),
  };
  return { surface, area, depth, roughness, seed, resolution, origin };
}

/** Source road and its upward unit normal. curve is a gentle paraboloid. */
export function surfaceSample(surface, u, v) {
  let height = 0;
  let du = 0;
  let dv = 0;
  if (surface === 'slope') {
    height = 0.25 * u + 0.10 * v;
    du = 0.25;
    dv = 0.10;
  } else if (surface === 'curve') {
    height = 0.045 * u * u + 0.025 * v * v;
    du = 0.09 * u;
    dv = 0.05 * v;
  } else if (surface !== 'flat') {
    throw new RangeError('Unknown surface. Expected flat, slope, or curve.');
  }
  const jacobian = Math.sqrt(1 + du * du + dv * dv);
  return {
    position: [u, height, v],
    normal: [-du / jacobian, 1 / jacobian, -dv / jacobian],
    height, du, dv, jacobian,
  };
}

function areaJacobian(surface, u, v) {
  if (surface === 'flat') return 1;
  if (surface === 'slope') return Math.sqrt(1.0725);
  return Math.sqrt(1 + (0.09 * u) ** 2 + (0.05 * v) ** 2);
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function makeShape(seed, roughness) {
  const random = seededRandom(seed);
  return {
    frequencies: [...FREQUENCIES],
    weights: [...WEIGHTS],
    phases: FREQUENCIES.map(() => random() * TWO_PI),
    roughness,
  };
}

/** A positive smooth radial function; this is not a Euclidean signed distance. */
export function radialBoundary(theta, shape) {
  let perturbation = 0;
  for (let i = 0; i < shape.frequencies.length; i++) {
    perturbation += shape.weights[i] * Math.sin(shape.frequencies[i] * theta + shape.phases[i]);
  }
  return 1 + shape.roughness * perturbation;
}

/** Flat floor, smooth walls, and zero displacement AND zero slope at the rim. */
export function depthProfile(q) {
  if (q <= 0.35) return 1;
  if (q >= 1) return 0;
  const t = (q - 0.35) / 0.65;
  return 1 - t * t * (3 - 2 * t);
}

function normalizedRadius(u, v, origin, scale, shape) {
  const x = u - origin.u;
  const y = v - origin.v;
  return Math.hypot(x, y) / (scale * radialBoundary(Math.atan2(y, x), shape));
}

/**
 * Independent source-surface integral in polar parameter coordinates:
 * integral J(u,v) r dr dtheta. Periodic trapezoidal quadrature in theta and
 * composite Simpson quadrature in radius are independent of the render mesh.
 */
function integrateFootprint(surface, origin, scale, shape, angularSteps, radialSteps) {
  let sum = 0;
  for (let a = 0; a < angularSteps; a++) {
    const theta = TWO_PI * a / angularSteps;
    const outer = scale * radialBoundary(theta, shape);
    const cs = Math.cos(theta);
    const sn = Math.sin(theta);
    let radial = 0;
    for (let k = 0; k <= radialSteps; k++) {
      const r = outer * k / radialSteps;
      const weight = k === 0 || k === radialSteps ? 1 : k % 2 === 0 ? 2 : 4;
      radial += weight * r * areaJacobian(surface, origin.u + r * cs, origin.v + r * sn);
    }
    sum += radial * outer / (3 * radialSteps);
  }
  return sum * TWO_PI / angularSteps;
}

function solveScale(options, shape) {
  let lower = 0;
  // J >= 1 and radialBoundary >= 1 - roughness, so this brackets the root.
  let upper = Math.sqrt(options.area / Math.PI) / (1 - options.roughness);
  for (let iteration = 0; iteration < 38; iteration++) {
    const middle = (lower + upper) / 2;
    const area = integrateFootprint(options.surface, options.origin, middle, shape, 256, 8);
    if (area < options.area) lower = middle;
    else upper = middle;
  }
  return (lower + upper) / 2;
}

function makeAxis(minimum, maximum, center, denseRadius, fineStep) {
  const side = (direction, limit) => {
    const values = [];
    let position = center;
    let step = fineStep;
    while (direction > 0 ? position < limit - 1e-12 : position > limit + 1e-12) {
      position = direction > 0 ? Math.min(limit, position + step) : Math.max(limit, position - step);
      values.push(position);
      if (Math.abs(position - center) >= denseRadius + 2 * fineStep) {
        step = Math.min(0.65, step * 1.30);
      }
    }
    return values;
  };
  return [...side(-1, minimum).reverse(), center, ...side(1, maximum)];
}

function triangleArea(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const ux = bx - ax, uy = by - ay, uz = bz - az;
  const vx = cx - ax, vy = cy - ay, vz = cz - az;
  return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}

/** Clip one original planar triangle by the linearly interpolated radial field. */
function clippedTriangleArea(positions, field, a, b, c) {
  const fa = field[a], fb = field[b], fc = field[c];
  if (fa > 0 && fb > 0 && fc > 0) return 0;
  if (fa <= 0 && fb <= 0 && fc <= 0) {
    return triangleArea(...positions.subarray(a * 3, a * 3 + 3),
      ...positions.subarray(b * 3, b * 3 + 3), ...positions.subarray(c * 3, c * 3 + 3));
  }
  const input = [a, b, c].map((i) => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2], field[i]]);
  const output = [];
  let previous = input[input.length - 1];
  for (const current of input) {
    const previousInside = previous[3] <= 0;
    const currentInside = current[3] <= 0;
    if (previousInside !== currentInside) {
      const t = previous[3] / (previous[3] - current[3]);
      output.push([
        previous[0] + t * (current[0] - previous[0]),
        previous[1] + t * (current[1] - previous[1]),
        previous[2] + t * (current[2] - previous[2]),
      ]);
    }
    if (currentInside) output.push(current);
    previous = current;
  }
  let area = 0;
  for (let i = 1; i < output.length - 1; i++) {
    area += triangleArea(output[0][0], output[0][1], output[0][2],
      output[i][0], output[i][1], output[i][2],
      output[i + 1][0], output[i + 1][1], output[i + 1][2]);
  }
  return area;
}

function meshNormalsAndQuality(positions, originals, indices) {
  const accumulated = new Float64Array(positions.length);
  let invertedTriangles = 0;
  let degenerateTriangles = 0;
  let deformedArea = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const norm = Math.hypot(nx, ny, nz);
    deformedArea += norm / 2;
    if (norm < 1e-12) degenerateTriangles++;
    const oux = originals[b] - originals[a], ouy = originals[b + 1] - originals[a + 1], ouz = originals[b + 2] - originals[a + 2];
    const ovx = originals[c] - originals[a], ovy = originals[c + 1] - originals[a + 1], ovz = originals[c + 2] - originals[a + 2];
    const onx = ouy * ovz - ouz * ovy, ony = ouz * ovx - oux * ovz, onz = oux * ovy - ouy * ovx;
    if (nx * onx + ny * ony + nz * onz <= 0) invertedTriangles++;
    for (const offset of [a, b, c]) {
      accumulated[offset] += nx;
      accumulated[offset + 1] += ny;
      accumulated[offset + 2] += nz;
    }
  }
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < accumulated.length; i += 3) {
    const length = Math.hypot(accumulated[i], accumulated[i + 1], accumulated[i + 2]) || 1;
    normals[i] = accumulated[i] / length;
    normals[i + 1] = accumulated[i + 1] / length;
    normals[i + 2] = accumulated[i + 2] / length;
  }
  return { normals, invertedTriangles, degenerateTriangles, deformedArea };
}

/**
 * Build one nonoverlapping pothole on an 8 x 12 m supported road.
 *
 * Valid inputs: area 0.02..40 m² (and fully contained), depth 0..1 m,
 * roughness 0..0.6, seed uint32, resolution low/medium/high.
 * Returned uv uses whole-road [0,1] coordinates. boundaryField is q - 1,
 * not a signed distance; its <= 0 contour defines measuredArea on the mesh.
 * depression is displacement magnitude in metres at each vertex. A mask made
 * from interpolated depression > epsilon has slightly different semantics.
 */
export function buildRoad(options = {}) {
  const started = timestamp();
  const config = validatedOptions(options);
  const shape = makeShape(config.seed, config.roughness);
  const scale = solveScale(config, shape);
  const radiusBound = scale * (1 + config.roughness);
  // This conservative support bound keeps the entire footprint off road edges.
  if (Math.abs(config.origin.u) + radiusBound >= WIDTH / 2 - 1e-5 ||
      Math.abs(config.origin.v) + radiusBound >= LENGTH / 2 - 1e-5) {
    throw new RangeError('The complete pothole footprint must fit inside the 8 x 12 m road. Reduce area or move origin inward.');
  }
  const fineStep = Math.max(0.0025, Math.min(0.07, radiusBound / RESOLUTION_DIVISORS[config.resolution]));
  const axisU = makeAxis(-WIDTH / 2, WIDTH / 2, config.origin.u, radiusBound, fineStep);
  const axisV = makeAxis(-LENGTH / 2, LENGTH / 2, config.origin.v, radiusBound, fineStep);
  const uCount = axisU.length, vCount = axisV.length;
  const count = uCount * vCount;
  const positions = new Float32Array(count * 3);
  const originalPositions = new Float32Array(count * 3);
  const depression = new Float32Array(count);
  const boundaryField = new Float32Array(count);
  const uv = new Float32Array(count * 2);
  let maxDepth = 0;
  for (let j = 0; j < vCount; j++) {
    for (let i = 0; i < uCount; i++) {
      const index = j * uCount + i;
      const u = axisU[i], v = axisV[j];
      const sample = surfaceSample(config.surface, u, v);
      const q = normalizedRadius(u, v, config.origin, scale, shape);
      const depth = config.depth * depthProfile(q);
      for (let k = 0; k < 3; k++) {
        originalPositions[index * 3 + k] = sample.position[k];
        positions[index * 3 + k] = sample.position[k] - depth * sample.normal[k];
      }
      depression[index] = depth;
      boundaryField[index] = q - 1;
      uv[index * 2] = (u + WIDTH / 2) / WIDTH;
      uv[index * 2 + 1] = (v + LENGTH / 2) / LENGTH;
      maxDepth = Math.max(maxDepth, depth);
    }
  }
  const indices = new Uint32Array((uCount - 1) * (vCount - 1) * 6);
  let cursor = 0;
  for (let j = 0; j < vCount - 1; j++) {
    for (let i = 0; i < uCount - 1; i++) {
      const a = j * uCount + i, b = a + 1, c = a + uCount, d = c + 1;
      // Upward winding with y as the vertical axis.
      indices.set([a, c, b, b, c, d], cursor);
      cursor += 6;
    }
  }
  let measuredArea = 0;
  for (let i = 0; i < indices.length; i += 3) {
    measuredArea += clippedTriangleArea(originalPositions, boundaryField, indices[i], indices[i + 1], indices[i + 2]);
  }
  const quality = meshNormalsAndQuality(positions, originalPositions, indices);
  const integratedArea = integrateFootprint(config.surface, config.origin, scale, shape, 1024, 16);
  const integratedAreaCoarser = integrateFootprint(config.surface, config.origin, scale, shape, 512, 8);
  const boundarySamples = 512;
  const boundary = new Float32Array((boundarySamples + 1) * 3);
  for (let i = 0; i <= boundarySamples; i++) {
    const theta = TWO_PI * (i % boundarySamples) / boundarySamples;
    const radius = scale * radialBoundary(theta, shape);
    const p = surfaceSample(config.surface,
      config.origin.u + radius * Math.cos(theta), config.origin.v + radius * Math.sin(theta)).position;
    boundary.set(p, i * 3);
  }
  const triangles = indices.length / 3;
  const uniformTriangles = Math.ceil(WIDTH / fineStep) * Math.ceil(LENGTH / fineStep) * 2;
  const metrics = {
    targetArea: config.area,
    measuredArea,
    relativeAreaError: Math.abs(measuredArea - config.area) / config.area,
    signedRelativeAreaError: (measuredArea - config.area) / config.area,
    integratedArea,
    integrationRelativeDifference: Math.abs(integratedArea - integratedAreaCoarser) / integratedArea,
    integrationResolution: { angular: 1024, radial: 16 },
    measuredAreaMethod: 'Original mesh triangle area clipped by linearly interpolated boundaryField <= 0',
    areaDefinition: 'Footprint area on the original undamaged road, in square metres',
    maxDepth,
    requestedDepth: config.depth,
    vertices: count,
    triangles,
    uniformTriangles,
    triangleReduction: 1 - triangles / uniformTriangles,
    fineStep,
    coarseStep: 0.65,
    scale,
    radiusBound,
    invertedTriangles: quality.invertedTriangles,
    degenerateTriangles: quality.degenerateTriangles,
    deformedRoadArea: quality.deformedArea,
    buildMs: timestamp() - started,
  };
  return {
    positions, originalPositions, normals: quality.normals, indices, depression,
    boundaryField, uv, metrics, boundary, options: config, shape,
    width: WIDTH, length: LENGTH,
    grid: { u: Float64Array.from(axisU), v: Float64Array.from(axisV), uCount, vCount },
  };
}
