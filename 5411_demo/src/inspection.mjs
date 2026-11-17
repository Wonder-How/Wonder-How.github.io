import {sampleCrossSection} from './geometry.mjs';

export function crossSection(options,selected=0,axis='u'){
  const hole=options.potholes[selected],value=hole.origin[axis==='u'?'v':'u'];
  return sampleCrossSection(options,{axis,value,samples:481});
}
export function sectionSVG(rows,axis){
  const W=1040,H=210,pad={l:62,r:24,t:18,b:37};
  const x=rows.map(p=>p[axis]),ys=rows.flatMap(p=>[p.source[1],p.deformed[1]]);
  const xmin=Math.min(...x),xmax=Math.max(...x),ylo=Math.min(...ys),yhi=Math.max(...ys);
  const margin=Math.max(.07,(yhi-ylo)*.15),ymin=ylo-margin,ymax=yhi+margin;
  const px=v=>pad.l+(v-xmin)/(xmax-xmin)*(W-pad.l-pad.r),py=v=>H-pad.b-(v-ymin)/(ymax-ymin)*(H-pad.t-pad.b);
  const path=(key,reverse=false)=>[...(reverse?[...rows].reverse():rows)].map((p,i)=>`${i?'L':'M'}${px(p[axis]).toFixed(2)},${py(p[key][1]).toFixed(2)}`).join(' ');
  let grid='';for(let i=0;i<=4;i++){const value=ymin+(ymax-ymin)*i/4,y=py(value);grid+=`<line x1="${pad.l}" y1="${y}" x2="${W-pad.r}" y2="${y}" stroke="#2e3d44"/><text x="${pad.l-11}" y="${y+4}" text-anchor="end" fill="#9aadb4" font-size="11">${value.toFixed(2)}</text>`;}
  for(let i=0;i<=6;i++){const value=xmin+(xmax-xmin)*i/6;grid+=`<text x="${px(value)}" y="${H-15}" text-anchor="middle" fill="#9aadb4" font-size="11">${value.toFixed(1)}</text>`;}
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Analytic original and displaced road cross-section"><title>Analytic cross-section, metres</title>${grid}<path d="${path('source')}" fill="none" stroke="#a1b4bd" stroke-dasharray="6 5" stroke-width="2"/><path d="${path('deformed')}" fill="none" stroke="#d0e779" stroke-width="2.5"/><text x="${W-25}" y="${H-3}" text-anchor="end" fill="#9aadb4" font-size="10">source ${axis} (m)</text><text x="8" y="13" fill="#9aadb4" font-size="10">height (m)</text></svg>`;
}
export function sectionCSV(rows){return 'u,v,source_x,source_y,source_z,deformed_x,deformed_y,deformed_z,normal_displacement_m,hole_id\n'+rows.map(p=>[p.u,p.v,...p.source,...p.deformed,p.depth,p.holeId].join(',')).join('\n')+'\n';}
