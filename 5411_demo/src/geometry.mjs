/** Public geometry API. Legacy calls retain their original graded-grid output. */
import { buildRoad as buildLegacyRoad } from './geometry-legacy.mjs';
import { buildFinalRoad, sampleCrossSection } from './geometry-final.mjs';
export { DEFAULTS, surfaceSample, radialBoundary, depthProfile } from './geometry-legacy.mjs';
export { sampleCrossSection };
export function buildRoad(options = {}) {
  if (options && typeof options === 'object' && ['potholes', 'mesh', 'edgeMode'].some((key) => Object.hasOwn(options, key))) return buildFinalRoad(options);
  return buildLegacyRoad(options);
}
