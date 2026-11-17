/** Reproducible final-project scenes; all dimensions are metres. */
export const clone=value=>JSON.parse(JSON.stringify(value));
const hole=(id,u,v,area,depth,roughness,seed)=>({id,origin:{u,v},area,depth,roughness,seed});
export const PRESETS={
  single:{surface:'flat',mesh:'adaptive',edgeMode:'reject',resolution:'medium',potholes:[hole('H1',0,0,2,.22,.22,19)]},
  varied:{surface:'curve',mesh:'adaptive',edgeMode:'reject',resolution:'medium',potholes:[
    hole('H1',-1.8,-2.4,1.6,.28,.26,19),hole('H2',1.7,-1.2,1,.18,.18,93),
    hole('H3',-1.3,1.7,2.1,.36,.38,41),hole('H4',1.8,3.5,.65,.13,.33,7)]},
  edge:{surface:'slope',mesh:'adaptive',edgeMode:'clip',resolution:'medium',potholes:[
    hole('H1',3.8,-1.4,1.4,.35,.32,19),hole('H2',-3.8,2.2,.85,.22,.42,93)]},
  stress:{surface:'curve',mesh:'adaptive',edgeMode:'reject',resolution:'medium',potholes:[
    hole('H1',-1.9,-4.2,.45,.12,.12,1),hole('H2',1.9,-4.2,.7,.18,.22,2),
    hole('H3',-1.9,-1.4,.9,.23,.35,3),hole('H4',1.9,-1.4,1.1,.32,.43,4),
    hole('H5',-1.9,1.4,.6,.15,.18,5),hole('H6',1.9,1.4,.8,.22,.30,6),
    hole('H7',-1.9,4.2,.5,.17,.25,7),hole('H8',1.9,4.2,1,.29,.38,8)]}
};
export function scenePreset(name){if(!PRESETS[name])throw new RangeError('Unknown scene preset.');return clone(PRESETS[name]);}
