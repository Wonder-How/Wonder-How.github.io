import { buildRoad, DEFAULTS } from './geometry.mjs';

export const RESOLUTIONS = Object.freeze(['low', 'medium', 'high']);

function snapshotParameters(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Comparison options must be an object.');
  }
  const origin = options.origin ?? DEFAULTS.origin;
  if (typeof origin !== 'object' || Array.isArray(origin)) {
    throw new TypeError('origin must be an object containing finite u and v.');
  }
  return {
    surface: options.surface ?? DEFAULTS.surface,
    area: options.area ?? DEFAULTS.area,
    depth: options.depth ?? DEFAULTS.depth,
    roughness: options.roughness ?? DEFAULTS.roughness,
    seed: options.seed ?? DEFAULTS.seed,
    origin: { u: origin.u ?? 0, v: origin.v ?? 0 },
  };
}

/** Same source parameters produce the same key, regardless of sampling level. */
export function comparisonKey(options = {}) {
  return JSON.stringify(snapshotParameters(options));
}

/**
 * Measure CPU geometry construction while holding all source parameters fixed.
 * One warmup per resolution is excluded from the observed samples. Rendering,
 * GPU upload, GPU execution, and FPS are outside this measurement.
 */
export async function measureResolutions(options = {}, {
  samples = 5,
  yieldBetween = () => Promise.resolve(),
} = {}) {
  if (!Number.isInteger(samples) || samples < 1) {
    throw new RangeError('samples must be a positive integer.');
  }
  if (typeof yieldBetween !== 'function') {
    throw new TypeError('yieldBetween must be a function.');
  }
  // Copy the nested origin before the first yield, so UI changes cannot alter
  // parameters halfway through a comparison.
  const parameters = snapshotParameters(options);
  const rows = [];
  for (const resolution of RESOLUTIONS) {
    // Geometry validation, including full footprint containment, is delegated
    // to buildRoad. Invalid inputs reject the promise before collecting rows.
    buildRoad({ ...parameters, resolution });
    await yieldBetween();
    const observed = [];
    let metrics;
    for (let i = 0; i < samples; i++) {
      ({ metrics } = buildRoad({ ...parameters, resolution }));
      observed.push(metrics.buildMs);
      await yieldBetween();
    }
    const sorted = [...observed].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    rows.push({
      resolution,
      triangles: metrics.triangles,
      vertices: metrics.vertices,
      measuredArea: metrics.measuredArea,
      relativeAreaError: metrics.relativeAreaError,
      medianBuildMs: median,
      p95BuildMs: sorted[Math.ceil(sorted.length * 0.95) - 1],
      samples: observed,
      fineStep: metrics.fineStep,
    });
  }
  return {
    parameters,
    rows,
    timing: {
      label: 'CPU geometry build',
      unit: 'ms',
      warmupBuildsPerResolution: 1,
      samplesPerResolution: samples,
      percentileMethod: 'nearest-rank',
      scope: 'buildRoad() CPU wall-clock time; excludes rendering and GPU upload/execution; not GPU time or FPS',
    },
  };
}

/** Machine-readable values: relativeAreaError is a ratio, with no percent sign. */
export function comparisonCSV(result) {
  const columns = [
    'surface', 'origin_u', 'origin_v', 'area', 'depth', 'roughness', 'seed',
    'resolution', 'triangles', 'vertices', 'measuredArea', 'relativeAreaError',
    'medianBuildMs', 'p95BuildMs', 'samples_count',
  ];
  const escape = (value) => {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const { parameters } = result;
  const lines = result.rows.map((row) => {
    const values = {
      ...parameters,
      origin_u: parameters.origin.u,
      origin_v: parameters.origin.v,
      ...row,
      samples_count: row.samples.length,
    };
    return columns.map((column) => escape(values[column])).join(',');
  });
  return [columns.join(','), ...lines].join('\n') + '\n';
}
