// Display order and shader settings live together so more presets can be added here.
// These presets affect appearance only; geometry and dataset inspection passes are unchanged.
export const MATERIAL_PRESETS = Object.freeze([
  Object.freeze({id:'baseline',label:'Baseline',uniforms:Object.freeze({uMaterialDetail:0,uAggregateScale:1})}),
  Object.freeze({id:'aggregate',label:'Aggregate',uniforms:Object.freeze({uMaterialDetail:1,uAggregateScale:1})})
]);

export const DEFAULT_MATERIAL_PRESET = 'aggregate';

export function getMaterialPreset(id) {
  const preset = MATERIAL_PRESETS.find(preset => preset.id === id);
  if (!preset) throw new RangeError('Unknown material preset.');
  return preset;
}
