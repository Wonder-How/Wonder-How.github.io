import * as THREE from 'three';
import {OrbitControls} from '../lib/OrbitControls.js';
import {buildRoad,surfaceSample} from './geometry.mjs';
import {vertexShader,fragmentShader} from './shaders.mjs';
import {benchmarkRenderer,rendererIdentity,summarize} from './performance.mjs';
import {scenePreset,clone} from './scenes.mjs';
import {crossSection,sectionSVG,sectionCSV} from './inspection.mjs';
import {zipStore} from './zip.mjs';

const $=selector=>document.querySelector(selector);
const state=scenePreset('varied');
const lighting={raking:{direction:[-.85,.55,.5],ambient:.30,intensity:1.35},soft:{direction:[-.4,1,.65],ambient:.54,intensity:.80}};
let renderer,scene,camera,controls,material,model,damagedGroup,originalGroup,outlineGroup;
let selected=0,mode=0,view='wide',lightPreset='raking',before=false,paused=false,busy=false,animateLight=false,lightAngle=0;
let comparison=null,lastBenchmark=null,sectionAxis='u',pending={},inputTimer,toastTimer,presetName='varied';

function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500);}
function download(name,value,type='application/json'){
  const blob=value instanceof Blob?value:new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function getOptions(){return {surface:state.surface,mesh:state.mesh,edgeMode:state.edgeMode,resolution:state.resolution,potholes:clone(state.potholes)};}
function setBusy(value){busy=value;document.body.classList.toggle('busy',value);controls.enabled=!value;$('#benchmark').disabled=value;$('#export').disabled=value||before;$('#compare').disabled=value;}
function configureGeometry(data,original=false){
  const geometry=new THREE.BufferGeometry(),n=data.positions.length/3;
  geometry.setAttribute('position',new THREE.BufferAttribute(original?data.originalPositions:data.positions,3));
  geometry.setAttribute('originalPosition',new THREE.BufferAttribute(data.originalPositions,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(data.uv,2));
  geometry.setAttribute('depression',new THREE.BufferAttribute(original?new Float32Array(n):data.depression,1));
  geometry.setAttribute('boundaryField',new THREE.BufferAttribute(original?new Float32Array(n).fill(1):data.boundaryField,1));
  geometry.setAttribute('holeId',new THREE.BufferAttribute(data.holeIds||new Float32Array(n),1));
  geometry.setAttribute('surfacePart',new THREE.BufferAttribute(data.surfacePart||new Float32Array(n),1));
  const holeDepth=new Float32Array(n);
  for(let i=0;i<n;i++)holeDepth[i]=state.potholes[Math.round(data.holeIds?.[i]||0)-1]?.depth||0;
  geometry.setAttribute('holeDepth',new THREE.BufferAttribute(holeDepth,1));
  geometry.setIndex(new THREE.BufferAttribute(data.indices,1));
  if(data.normals&&!original)geometry.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));else geometry.computeVertexNormals();
  geometry.computeBoundingSphere();return geometry;
}
function disposeGroup(group){if(!group)return;scene.remove(group);group.traverse(o=>{o.geometry?.dispose();if(o.material&&o.material!==material)o.material.dispose();});}
function rebuild(patch={}){
  if(busy)throw new Error('Wait for the current measurement or export to finish.');
  let next={...getOptions(),...clone(patch)};
  // Backward-compatible editing of the currently selected hole.
  if(['area','depth','roughness','seed','origin'].some(k=>Object.hasOwn(patch,k))&&!patch.potholes){
    next.potholes=clone(state.potholes);const hole=next.potholes[selected];
    for(const k of ['area','depth','roughness','seed'])if(Object.hasOwn(patch,k))hole[k]=patch[k];
    if(patch.origin)hole.origin={...hole.origin,...patch.origin};
  }
  let generated;
  try{generated=buildRoad(next);}catch(error){pending={};clearTimeout(inputTimer);syncUI();placementStatus(error);throw error;}
  Object.assign(state,clone(generated.options));selected=Math.min(selected,state.potholes.length-1);model=generated;
  pending={};clearTimeout(inputTimer);comparison=null;
  disposeGroup(damagedGroup);disposeGroup(originalGroup);disposeGroup(outlineGroup);
  damagedGroup=new THREE.Group();originalGroup=new THREE.Group();outlineGroup=new THREE.Group();
  for(const data of [model,model.border].filter(Boolean)){
    damagedGroup.add(new THREE.Mesh(configureGeometry(data),material));
    originalGroup.add(new THREE.Mesh(configureGeometry(data,true),material));
  }
  for(const [index,boundary] of (model.boundaries||[model.boundary]).entries()){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(boundary,3));
    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:index===selected?0xe6f39a:0x95b45e,transparent:true,opacity:.9}));
    line.position.y=.012;outlineGroup.add(line);
  }
  scene.add(damagedGroup,originalGroup,outlineGroup);
  material.uniforms.uDepth.value=Math.max(...state.potholes.map(h=>h.depth));
  syncUI();applyVisibility();placementStatus();drawSection();
  if(view==='close'&&$('#follow-site').checked)setCameraView('close');
  render();return model.metrics;
}
function tryChange(patch){try{rebuild(patch);return true;}catch(error){toast(error.message);return false;}}
function placementStatus(error){const el=$('#placement-status');el.dataset.state=error?'error':'ok';el.textContent=error?`${error.message} Last valid scene retained.`:`${state.potholes.length} independent potholes · ${state.edgeMode==='clip'?'road-edge clipping enabled':'full footprints retained'}.`;}
function applyVisibility(){if(!damagedGroup)return;damagedGroup.visible=!before;originalGroup.visible=before;outlineGroup.visible=$('#outline').checked&&!before&&mode!==3&&mode!==6;$('.legend').hidden=!outlineGroup.visible;material.uniforms.uBefore.value=Number(before);$('#export').disabled=before||busy;}
function activeButton(selector,key,value){document.querySelectorAll(selector).forEach(b=>{const active=String(b.dataset[key])===String(value);b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
function syncUI(){
  const h=state.potholes[selected];
  activeButton('[data-surface]','surface',state.surface);activeButton('[data-resolution]','resolution',state.resolution);activeButton('[data-mesh]','mesh',state.mesh);
  $('#allow-edge').checked=state.edgeMode==='clip';$('#hole-count').textContent=`${state.potholes.length} / 8`;
  $('#hole-list').replaceChildren();
  state.potholes.forEach((hole,i)=>{const b=document.createElement('button');b.className='hole-item'+(i===selected?' active':'');b.dataset.hole=String(i);b.setAttribute('aria-pressed',String(i===selected));const id=document.createElement('b');id.textContent=String(i+1).padStart(2,'0');const label=document.createElement('span');label.textContent=String(hole.id);const size=document.createElement('small');size.textContent=`${hole.area.toFixed(2)} m² / ${hole.depth.toFixed(2)} m`;b.append(id,label,size);$('#hole-list').append(b);});
  $('#add-hole').disabled=state.potholes.length>=8;$('#remove-hole').disabled=state.potholes.length<=1;$('#selected-heading').textContent=`Selected: ${h.id}`;
  for(const name of ['area','depth','roughness','seed'])$('#'+name).value=h[name];
  $('#area-out').value=h.area.toFixed(2)+' m²';$('#depth-out').value=h.depth.toFixed(2)+' m';$('#roughness-out').value=h.roughness.toFixed(2);
  for(const axis of ['u','v']){$('#origin-'+axis).value=h.origin[axis];$('#origin-'+axis+'-out').value=h.origin[axis].toFixed(2)+' m';}
  $('#before').checked=before;$('#preset').value=presetName;
  $('#scene-caption').textContent=`${{flat:'FLAT',slope:'SLOPED',curve:'CURVED'}[state.surface]} ROAD / ${state.potholes.length} POTHOLE${state.potholes.length===1?'':'S'}`;
  const m=model.metrics;
  $('#measured').innerHTML=`${m.measuredArea.toFixed(3)}<em>m²</em>`;
  $('#area-error').textContent=`Total error ${(m.relativeAreaError*100).toFixed(3)}% · max per-hole ${(m.maxPerHoleRelativeAreaError*100).toFixed(3)}%`;
  $('#max-depth').innerHTML=`${m.maxDepth.toFixed(3)}<em>m</em>`;
  $('#triangles').textContent=`${m.triangles.toLocaleString()} / ${(m.borderTriangles||0).toLocaleString()}`;
  $('#mesh-description').textContent=state.mesh==='adaptive'?'Local conforming quadtree':'Graded tensor grid';
  $('#build-time').innerHTML=`${m.buildMs.toFixed(1)}<em>ms</em>`;
  $('#scene-summary').textContent=`${state.mesh} · ${state.resolution} · ${state.edgeMode==='clip'?'clipped edges':'contained footprints'}`;
  $('#area-table').replaceChildren();
  model.perHole.forEach((p,i)=>{const tr=document.createElement('tr');if(i===selected)tr.className='selected';for(const value of [String(p.id),p.targetArea.toFixed(3),p.measuredArea.toFixed(5),(100*p.relativeAreaError).toFixed(4)+'%',p.clipped?'Clipped':'Inside']){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('#area-table').append(tr);});
  $('#comparison-results').replaceChildren();$('#download-comparison').disabled=!comparison;
}
function selectHole(index){if(!Number.isInteger(index)||index<0||index>=state.potholes.length)throw new RangeError('Invalid pothole index.');selected=index;syncUI();drawSection();outlineGroup.children.forEach((o,i)=>o.material.color.setHex(i===selected?0xe6f39a:0x95b45e));if(view==='close'&&$('#follow-site').checked)setCameraView('close');render();}
function updateSelected(patch){const holes=clone(state.potholes);holes[selected]={...holes[selected],...patch,origin:{...holes[selected].origin,...patch.origin}};return rebuild({potholes:holes});}
function addHole(){
  if(state.potholes.length>=8)throw new RangeError('At most eight potholes are supported.');
  let id=1;while(state.potholes.some(h=>h.id===`H${id}`))id++;
  for(const v of [-4.5,-3,-1.5,0,1.5,3,4.5])for(const u of [-2.5,-.7,.7,2.5]){
    const newHole={id:`H${id}`,area:.45,depth:.16,roughness:.2,seed:19+id,origin:{u,v}};
    try{const metrics=rebuild({potholes:[...clone(state.potholes),newHole]});selectHole(state.potholes.length-1);return metrics;}catch(error){if(!/overlap|fit|bound|too close|mixed owners/i.test(error.message))throw error;}
  }
  placementStatus(new Error('No non-overlapping location found. Reduce existing footprints first.'));throw new Error('No non-overlapping location found.');
}
function removeHole(){if(state.potholes.length<=1)throw new Error('Keep at least one pothole.');const holes=clone(state.potholes);holes.splice(selected,1);selected=Math.min(selected,holes.length-1);return rebuild({potholes:holes});}
function loadPreset(name){if(busy)throw new Error('Wait for the current operation.');selected=0;presetName=name;before=false;rebuild(scenePreset(name));setMode(0);setCameraView('wide');}
function setMode(value){if(![0,1,2,3,4,6].includes(Number(value)))throw new RangeError('Unknown inspection mode.');mode=Number(value);material.uniforms.uMode.value=mode===6?7:mode;material.wireframe=mode===1;activeButton('[data-mode]','mode',mode);$('#mode-caption').textContent={0:'Drag to orbit · scroll to zoom · right-drag to pan',1:'Actual mesh topology · local refinement around each pothole',2:'Camera-space geometric normals · material detail excluded',3:'Visible top-surface footprint · white = damaged road',4:'Camera-axis depth preview · 2–14 m · near = white',6:'Colored instance preview · exported IDs are raw 8-bit red values'}[mode];applyVisibility();render();}
function setBefore(value){before=Boolean(value);$('#before').checked=before;applyVisibility();render();}
function setCameraView(value){
  if(!['wide','close','top'].includes(value))throw new RangeError('View must be wide, close, or top.');view=value;camera.up.set(0,1,0);
  if(value==='wide'){camera.position.set(8.5,8.4,11.5);controls.target.set(0,.3,0);}
  else if(value==='top'){camera.position.set(0,17,.001);camera.up.set(0,0,-1);controls.target.set(0,0,0);}
  else{const h=state.potholes[selected],s=surfaceSample(state.surface,h.origin.u,h.origin.v),p=new THREE.Vector3(...s.position),n=new THREE.Vector3(...s.normal),t=new THREE.Vector3(1,s.du,0).normalize(),b=t.clone().cross(n).normalize(),scale=Math.max(.7,Math.sqrt(h.area/2));controls.target.copy(p).addScaledVector(n,-h.depth*.4);camera.position.copy(p).addScaledVector(t,1.55*scale).addScaledVector(b,1.95*scale).addScaledVector(n,1.15*scale);}
  controls.update();activeButton('[data-view]','view',value);render();
}
function setLighting(value){if(!lighting[value])throw new RangeError('Unknown lighting preset.');lightPreset=value;material.uniforms.uAmbient.value=lighting[value].ambient;material.uniforms.uLightIntensity.value=lighting[value].intensity;activeButton('[data-light]','light',value);render();}
function setMaterialDetail(value){material.uniforms.uMaterialDetail.value=value?1:0;activeButton('[data-detail]','detail',Number(Boolean(value)));render();}
function setWetness(value){if(!Number.isFinite(value)||value<0||value>1)throw new RangeError('Wetness must be in [0,1].');material.uniforms.uWetness.value=value;$('#wetness').value=value;render();}
function setLightAnimation(value){animateLight=Boolean(value);$('#animate-light').checked=animateLight;render();}
function setLightAngle(value){lightAngle=Number(value);setLightAnimation(false);render();}
function render(){if(!renderer)return;camera.updateMatrixWorld();const angle=lightAngle+(animateLight?performance.now()*.00025:0),d=lighting[lightPreset].direction;const light=new THREE.Vector3(d[0]*Math.cos(angle)-d[2]*Math.sin(angle),d[1],d[0]*Math.sin(angle)+d[2]*Math.cos(angle));material.uniforms.uLight.value.copy(light.normalize().transformDirection(camera.matrixWorldInverse));renderer.render(scene,camera);}
function resize(){if(!renderer||busy)return;const r=$('#viewport').getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();render();}
function pause(){paused=true;}
function resume(){paused=false;}
function showPanel(name){if(!['validation','section','performance'].includes(name))throw new Error('Unknown panel.');activeButton('[data-panel]','panel',name);for(const id of ['validation','section','performance'])$('#panel-'+id).hidden=id!==name;if(name==='section')drawSection();}
function drawSection(){if(model)$('#cross-section').innerHTML=sectionSVG(crossSection(state,selected,sectionAxis),sectionAxis);}
function queueInput(name,value){
  if(name.startsWith('origin-'))pending.origin={...pending.origin,[name.slice(-1)]:value};else pending[name]=value;
  const output=$('#'+name+'-out');if(output)output.value=value.toFixed(2)+(name==='area'?' m²':name==='depth'||name.startsWith('origin-')?' m':'');
  clearTimeout(inputTimer);inputTimer=setTimeout(()=>{const patch=pending;pending={};try{updateSelected(patch);}catch(error){toast(error.message);}},100);
}
function commitPending(){if(Object.keys(pending).length){const patch=pending;pending={};clearTimeout(inputTimer);updateSelected(patch);}}
async function compareResolutions(){
  if(busy)throw new Error('Wait for the current operation.');commitPending();const options=getOptions(),rows=[];setBusy(true);
  try{for(const resolution of ['low','medium','high']){await new Promise(r=>setTimeout(r,0));buildRoad({...options,resolution});const samples=[];let metrics;for(let i=0;i<3;i++){metrics=buildRoad({...options,resolution}).metrics;samples.push(metrics.buildMs);await new Promise(r=>setTimeout(r,0));}rows.push({resolution,triangles:metrics.triangles,borderTriangles:metrics.borderTriangles,area:metrics.measuredArea,maxPerHoleRelativeAreaError:metrics.maxPerHoleRelativeAreaError,cpuBuildMs:summarize(samples),samples});}comparison={parameters:options,rows};
    $('#comparison-results').innerHTML='<b>Same parameters; only sampling changes. CPU builds: one warm-up + three measured.</b><div class="table-scroll"><table><thead><tr><th>Resolution</th><th>Top triangles</th><th>Max per-hole error</th><th>CPU median / p95</th></tr></thead><tbody>'+rows.map(r=>`<tr><td>${r.resolution}</td><td>${r.triangles.toLocaleString()}</td><td>${(r.maxPerHoleRelativeAreaError*100).toFixed(4)}%</td><td>${r.cpuBuildMs.median.toFixed(2)} / ${r.cpuBuildMs.p95.toFixed(2)} ms</td></tr>`).join('')+'</tbody></table></div>';$('#download-comparison').disabled=false;return comparison;
  }finally{setBusy(false);}
}
function showBenchmark(result){
  const gpu=result.gpuElapsedMs,memory=result.memory;
  $('#benchmark-status').textContent=`${result.identity.renderer} · ${result.gpuQueries.valid}/${result.protocol.frames} valid GPU queries · ${result.gpuQueries.discardedDisjoint} discarded disjoint · 1280 × 720`;
  const card=(label,value,note)=>`<div class="benchmark-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
  $('#benchmark-results').innerHTML=card('GPU elapsed',gpu?gpu.median.toFixed(3)+' ms':'Unavailable',gpu?'p95 '+gpu.p95.toFixed(3)+' ms':result.gpuUnavailableReason)+card('CPU render submission',result.cpuSubmitMs.median.toFixed(3)+' ms','p95 '+result.cpuSubmitMs.p95.toFixed(3)+' ms')+card('Model typed arrays',(memory.modelTypedArrays.uniqueViewedBytes/1048576).toFixed(2)+' MiB','Unique storage, counted from actual arrays')+card('Geometry upload estimate',(memory.geometryBufferEstimate.bytes/1048576).toFixed(2)+' MiB','Includes original and border buffers')+'<p>GPU time comes only from timer queries. Frame intervals include browser scheduling. Buffer storage is an estimate, not actual VRAM; JS heap and raw samples are included in the downloaded report.</p>';
  $('#download-benchmark').disabled=false;
}
async function benchmark({frames=120,warmup=30,buildSamplesMs=[],metadata={},...rest}={}){
  if(busy)throw new Error('Wait for the current operation.');commitPending();
  const saved={paused,animateLight,before,mode,pixelRatio:renderer.getPixelRatio(),size:renderer.getSize(new THREE.Vector2()),aspect:camera.aspect,outline:$('#outline').checked};
  setBusy(true);paused=true;animateLight=false;before=false;$('#outline').checked=false;setMode(0);renderer.setPixelRatio(1);renderer.setSize(1280,720,false);camera.aspect=1280/720;camera.updateProjectionMatrix();
  try{const result=await benchmarkRenderer({renderer,scene,camera,render,model,frames,warmup,buildSamplesMs,metadata:{surface:state.surface,potholes:state.potholes.length,resolution:state.resolution,mesh:state.mesh,shading:material.uniforms.uMaterialDetail.value?'improved':'baseline',parameters:getOptions(),presentation:{lightPreset,wetness:material.uniforms.uWetness.value,lightAngle},...metadata},...rest});lastBenchmark=result;showBenchmark(result);return result;}
  finally{renderer.setPixelRatio(saved.pixelRatio);renderer.setSize(saved.size.x,saved.size.y,false);camera.aspect=saved.aspect;camera.updateProjectionMatrix();paused=saved.paused;animateLight=saved.animateLight;before=saved.before;$('#outline').checked=saved.outline;setBusy(false);setMode(saved.mode);}
}
function flipRows(bytes,w,h){const output=new Uint8Array(bytes.length);for(let y=0;y<h;y++)output.set(bytes.subarray((h-y-1)*w*4,(h-y)*w*4),y*w*4);return output;}
function png(bytes,w,h){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(bytes),w,h),0,0);return new Promise(resolve=>canvas.toBlob(resolve,'image/png'));}
function capturePixels(target,pass,w,h){material.uniforms.uMode.value=pass;material.wireframe=false;renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();render();const bytes=new Uint8Array(w*h*4);renderer.readRenderTargetPixels(target,0,0,w,h,bytes);return flipRows(bytes,w,h);}
function cameraMetadata(w,h){
  camera.updateMatrixWorld();const p=camera.projectionMatrix.elements;
  return {version:'1.0.0',width:w,height:h,units:'meters',pixelOrder:'row-major, top-left origin; pixel centers (x+0.5,y+0.5)',depth:{file:'depth_meters.f32',dtype:'float32',endianness:'little',invalid:'NaN for no road geometry',meaning:'positive optical-axis depth = -viewPosition.z; not range or normal displacement',near:camera.near,far:camera.far,quantizationMeters:(camera.far-camera.near)/16777215},intrinsics:{fx:w*p[0]/2,fy:h*p[5]/2,cx:w/2,cy:h/2},cameraConvention:'Three.js +X right, +Y up, viewing -Z; image y down',matrixOrder:'column-major',cameraToWorld:camera.matrixWorld.toArray(),worldToCamera:camera.matrixWorldInverse.toArray(),projection:camera.projectionMatrix.toArray(),mask:{meaning:'visible original top-surface footprint, interpolated boundaryField<=0; border=0',pothole:255,background:0},instances:{file:'instances.png',encoding:'8-bit RED channel only, ID 0=background/undamaged/border',mapping:state.potholes.map((hole,i)=>({value:i+1,id:hole.id}))},normal:{space:'camera/view',encoding:'RGB=round(255*(normalized geometric normal+1)/2)',validity:'alpha=255 on road geometry (including border), alpha=0 outside',materialNormalDetailIncluded:false},rasterization:{multisampling:false,antialiasing:false,overlays:false,sameMeshCameraPixelGrid:true},parameters:getOptions(),presentation:{view,lightPreset,lightAngle,materialDetail:material.uniforms.uMaterialDetail.value,wetness:material.uniforms.uWetness.value},implementation:'CPU normal displacement, local quadtree or graded tensor grid, WebGL/GLSL shading; analytic height fields only'};
}
async function exportBundle({download:save=true,width=1280,height=720}={}){
  if(busy)throw new Error('Wait for the current operation.');commitPending();const w=Math.round(width),h=Math.round(height);
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<32||h<32||w>4096||h>4096)throw new RangeError('Export dimensions must be 32..4096.');
  const saved={mode,aspect:camera.aspect,before,paused,animateLight,background:scene.background,outline:$('#outline').checked};
  const target=new THREE.WebGLRenderTarget(w,h,{depthBuffer:true,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});target.texture.colorSpace=THREE.NoColorSpace;
  setBusy(true);paused=true;animateLight=false;before=false;applyVisibility();outlineGroup.visible=false;scene.background=null;camera.aspect=w/h;camera.updateProjectionMatrix();
  try{const color=capturePixels(target,0,w,h),mask=capturePixels(target,3,w,h),normals=capturePixels(target,2,w,h),depthPreview=capturePixels(target,4,w,h),packed=capturePixels(target,5,w,h),instances=capturePixels(target,6,w,h);
    const depthBytes=new Uint8Array(w*h*4),dv=new DataView(depthBytes.buffer);
    for(let i=0;i<w*h;i++){const offset=i*4,k=packed[offset]*65536+packed[offset+1]*256+packed[offset+2];dv.setFloat32(offset,packed[offset+3]?camera.near+k/16777215*(camera.far-camera.near):NaN,true);mask[offset+3]=255;instances[offset+3]=255;}
    const metadata=cameraMetadata(w,h),images=await Promise.all([color,mask,normals,depthPreview,instances].map(bytes=>png(bytes,w,h)));
    const readme='Pothole Lab final v1.0\nAll image passes use the SAME deformed top and border geometry, perspective camera and pixel grid. No MSAA or UI/outline overlays.\nRGB uses procedural aggregate and material-only normal detail. Normal/depth/mask/instance data are independent of lighting and material detail.\nMask=255 on visible damaged top surface, 0 elsewhere. instances.png: RED byte is ID 1..N within the mask; border and background=0.\nDepth is camera-axis depth -view.z in metres, NOT range or normal displacement. Read depth_meters.f32 as little-endian float32 (height,width), top-left; NaN outside geometry.\n24-bit packed depth is decoded to float32. Quantization bound is not total mesh/raster accuracy.\nNormals are normalized geometric camera-space normals, encoded RGB=(n+1)/2; alpha indicates visible road or border.\nArea metrics measure footprint on the ORIGINAL undamaged height field. Per-hole areas are independent; overlapping support disks are explicitly rejected.\nAnalytic height fields only; no arbitrary imported terrain or physical vehicle dynamics. See camera.json and metrics.json.\n';
    const entries=[['rgb.png',images[0]],['mask.png',images[1]],['normals.png',images[2]],['depth_preview.png',images[3]],['instances.png',images[4]],['depth_meters.f32',depthBytes],['camera.json',JSON.stringify(metadata,null,2)],['metrics.json',JSON.stringify({...model.metrics,perHole:model.perHole},null,2)],['scene.json',JSON.stringify(getOptions(),null,2)],['README.txt',readme]];
    const blob=await zipStore(entries);if(save){download(`pothole-${state.surface}-${state.potholes.length}-instances.zip`,blob);toast('Exported aligned RGB, mask, instances, normals and metric depth.');}return {blob,metadata,depthBytes,color,mask,normals,instances,depthPreview};
  }finally{target.dispose();renderer.setRenderTarget(null);renderer.setClearColor(0x202b32,1);scene.background=saved.background;camera.aspect=saved.aspect;camera.updateProjectionMatrix();before=saved.before;paused=saved.paused;animateLight=saved.animateLight;$('#outline').checked=saved.outline;setBusy(false);setMode(saved.mode);}
}
function bindEvents(){
  $('#preset').addEventListener('change',e=>{try{loadPreset(e.target.value);}catch(error){toast(error.message);}});
  const bind=(selector,attribute,handler)=>$(selector).addEventListener('click',e=>{const b=e.target.closest(`[data-${attribute}]`);if(b)try{handler(b.dataset[attribute]);}catch(error){toast(error.message);}});
  bind('#surfaces','surface',surface=>tryChange({surface}));bind('#resolutions','resolution',resolution=>tryChange({resolution}));bind('#meshes','mesh',mesh=>tryChange({mesh}));
  bind('#modes','mode',setMode);bind('#camera-views','view',setCameraView);bind('#lighting','light',setLighting);bind('#material-detail','detail',v=>setMaterialDetail(v==='1'));bind('#inspection-tabs','panel',showPanel);bind('#hole-list','hole',i=>selectHole(Number(i)));
  bind('#section-axis','axis',axis=>{sectionAxis=axis;activeButton('[data-axis]','axis',axis);drawSection();});
  $('#allow-edge').addEventListener('change',e=>tryChange({edgeMode:e.target.checked?'clip':'reject'}));
  for(const name of ['area','depth','roughness','origin-u','origin-v'])$('#'+name).addEventListener('input',e=>queueInput(name,Number(e.target.value)));
  $('#seed').addEventListener('change',e=>{try{updateSelected({seed:Number(e.target.value)});}catch(error){toast(error.message);}});
  $('#random-seed').addEventListener('click',()=>{try{updateSelected({seed:(state.potholes[selected].seed+7919)%1000000});}catch(error){toast(error.message);}});
  $('#add-hole').addEventListener('click',()=>{try{addHole();}catch(error){toast(error.message);}});$('#remove-hole').addEventListener('click',()=>{try{removeHole();}catch(error){toast(error.message);}});
  $('#before').addEventListener('change',e=>setBefore(e.target.checked));$('#outline').addEventListener('change',()=>{applyVisibility();render();});$('#animate-light').addEventListener('change',e=>setLightAnimation(e.target.checked));$('#wetness').addEventListener('input',e=>setWetness(Number(e.target.value)));
  $('#focus-mode').addEventListener('click',()=>{document.body.classList.toggle('focus');$('#focus-mode').textContent=document.body.classList.contains('focus')?'Restore layout ↙':'Expand view ↗';resize();});
  $('#compare').addEventListener('click',()=>compareResolutions().catch(error=>toast(error.message)));
  $('#download-comparison').addEventListener('click',()=>{if(!comparison)return;const rows=comparison.rows;download('sampling-comparison.csv','resolution,top_triangles,border_triangles,measured_area_m2,max_per_hole_relative_error,cpu_median_ms,cpu_p95_ms\n'+rows.map(r=>[r.resolution,r.triangles,r.borderTriangles,r.area,r.maxPerHoleRelativeAreaError,r.cpuBuildMs.median,r.cpuBuildMs.p95].join(',')).join('\n'),'text/csv');});
  $('#download-section').addEventListener('click',()=>download('analytic-section.csv',sectionCSV(crossSection(state,selected,sectionAxis)),'text/csv'));
  $('#benchmark').addEventListener('click',()=>{showPanel('performance');$('#benchmark-status').textContent='Warming up shaders, then collecting 120 frames at 1280 × 720…';benchmark().catch(error=>{$('#benchmark-status').textContent=error.message;toast(error.message);});});
  $('#download-benchmark').addEventListener('click',()=>{if(lastBenchmark)download('performance.json',lastBenchmark);});
  $('#export').addEventListener('click',()=>exportBundle().catch(error=>toast(error.message)));
  $('#save-scene').addEventListener('click',()=>{commitPending();download('pothole-scene.json',getOptions());});$('#load-scene').addEventListener('click',()=>$('#scene-file').click());
  $('#scene-file').addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw new Error('Scene JSON is too large.');const parsed=JSON.parse(await file.text());selected=0;rebuild(parsed);setCameraView('wide');toast('Scene restored.');}catch(error){toast(error.message);}finally{e.target.value='';}});
}
function init(){
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;$('#viewport').prepend(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color(0x202b32);camera=new THREE.PerspectiveCamera(48,1,.1,50);
  material=new THREE.ShaderMaterial({vertexShader,fragmentShader,side:THREE.DoubleSide,uniforms:{uMode:{value:0},uDepth:{value:.36},uNear:{value:.1},uFar:{value:50},uLight:{value:new THREE.Vector3()},uAmbient:{value:.30},uLightIntensity:{value:1.35},uBefore:{value:0},uAggregateScale:{value:1},uWetness:{value:0},uMaterialDetail:{value:1}}});
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.addEventListener('change',()=>{if(!busy)render();});
  bindEvents();rebuild();setCameraView('wide');new ResizeObserver(resize).observe($('#viewport'));resize();$('#loading').remove();
  const identity=rendererIdentity(renderer);$('#render-status').textContent=`${identity.classification==='hardware-identified'?'Hardware WebGL':identity.classification==='software'?'Software WebGL':'WebGL renderer'} · ${identity.timerExtensionAvailable?'GPU timer available':'GPU timer unavailable'}`;
  let frames=0,last=performance.now();function frame(now){if(!paused&&!busy){render();frames++;}if(now-last>1400){$('#live-fps').textContent=`${(frames*1000/(now-last)).toFixed(0)} FPS · current browser, not GPU time`;frames=0;last=now;}requestAnimationFrame(frame);}requestAnimationFrame(frame);
  window.potholeLab={get options(){return getOptions();},get model(){return model;},get metrics(){return model.metrics;},get renderer(){return renderer;},get camera(){return camera;},get scene(){return scene;},get selected(){return selected;},get comparison(){return comparison;},get performance(){return lastBenchmark;},get presentation(){return {view,lightPreset,before,animateLight,lightAngle,materialDetail:material.uniforms.uMaterialDetail.value,wetness:material.uniforms.uWetness.value};},rebuild,loadPreset,selectHole,updateSelected,addHole,removeHole,setMode,setBefore,setCameraView,setLighting,setMaterialDetail,setWetness,setLightAnimation,setLightAngle,showPanel,render,resize,pause,resume,benchmark,compareResolutions,exportBundle,crossSection:()=>crossSection(state,selected,sectionAxis)};
  window.dispatchEvent(new Event('pothole-ready'));
}
try{init();}catch(error){console.error(error);if($('#loading'))$('#loading').textContent='Initialization failed: '+error.message;}
