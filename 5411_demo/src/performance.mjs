/**
 * Reproducible WebGL2 measurements. GPU time is measured only with
 * EXT_disjoint_timer_query_webgl2; it is never inferred from CPU wall time.
 * API: https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/
 * The caller must pause other rendering and keep scene/camera/buffer size fixed.
 */
const now=()=>performance.now();
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));

export function summarize(values){
  const clean=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!clean.length)return null;
  const q=p=>{const i=(clean.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return clean[lo]+(clean[hi]-clean[lo])*(i-lo);};
  return {n:clean.length,median:q(.5),p95:q(.95),min:clean[0],max:clean.at(-1),mean:clean.reduce((a,b)=>a+b,0)/clean.length};
}

export function rendererIdentity(renderer){
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const vendor=debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):null;
  const name=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  const software=/swiftshader|llvmpipe|softpipe|software|lavapipe|microsoft basic render/i.test(name||'');
  const hardware=/nvidia|geforce|quadro|radeon|intel.*(?:uhd|iris|arc)|apple.*gpu|adreno|mali|powervr/i.test(name||'');
  return {vendor,renderer:name,webglVersion:gl.getParameter(gl.VERSION),shadingLanguageVersion:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),softwareRenderer:software,hardwareRendererIdentified:!software&&hardware,classification:software?'software':hardware?'hardware-identified':'unknown',timerExtensionAvailable:!!gl.getExtension('EXT_disjoint_timer_query_webgl2'),contextAttributes:gl.getContextAttributes(),userAgent:globalThis.navigator?.userAgent||null};
}

function collectArrays(value){
  const seen=new Set(),arrays=[];
  function walk(v,path,depth){
    if(v===null||typeof v!=='object'||seen.has(v)||depth>8)return;
    seen.add(v);
    if(ArrayBuffer.isView(v)){if(!(v instanceof DataView))arrays.push({path,array:v});return;}
    if(v instanceof ArrayBuffer)return;
    for(const [key,child] of Object.entries(v))walk(child,path?`${path}.${key}`:key,depth+1);
  }
  walk(value,'model',0);return arrays;
}
function arrayStorage(arrays){
  const buffers=new Map();let sumViewBytes=0;
  for(const {array} of arrays){sumViewBytes+=array.byteLength;let b=buffers.get(array.buffer);if(!b){b={size:array.buffer.byteLength,ranges:[]};buffers.set(array.buffer,b);}b.ranges.push([array.byteOffset,array.byteOffset+array.byteLength]);}
  let uniqueViewedBytes=0,retainedBackingBufferBytes=0;
  for(const b of buffers.values()){
    retainedBackingBufferBytes+=b.size;b.ranges.sort((a,c)=>a[0]-c[0]);let begin=-1,end=-1;
    for(const [a,z] of b.ranges){if(a>end){if(end>=0)uniqueViewedBytes+=end-begin;begin=a;end=z;}else end=Math.max(end,z);}if(end>=0)uniqueViewedBytes+=end-begin;
  }
  return {typedArrayCount:arrays.length,uniqueBackingBuffers:buffers.size,sumViewBytes,uniqueViewedBytes,retainedBackingBufferBytes};
}
function textureBytes(texture,width,height,depth=1){
  // Values below are THREE numeric constants, avoiding a runtime import.
  const channels=new Map([[1021,1],[1022,3],[1023,4],[1026,1],[1027,1],[1028,1],[1029,1],[1030,2],[1031,2],[1032,3],[1033,4]]).get(texture.format)??4;
  const bytesPerElement=new Map([[1009,1],[1010,1],[1011,2],[1012,2],[1013,4],[1014,4],[1015,4],[1016,2],[1017,2],[1018,2],[1020,4],[35902,4],[35899,4]]).get(texture.type)??1;
  // Packed depth-stencil / RGB565 / RGBA4444 / RGBA5551 are one packed element.
  const packed=[1017,1018,1019,1020,35902,35899].includes(texture.type);
  const baseBytes=width*height*depth*(packed?bytesPerElement:channels*bytesPerElement);
  return {width,height,depth,format:texture.format,type:texture.type,channels,bytesPerElement,baseBytes,mipFactor:texture.generateMipmaps?4/3:1,estimatedBytes:Math.ceil(baseBytes*(texture.generateMipmaps?4/3:1))};
}
export function memoryEstimates({renderer,scene,model,renderTargets=[]}){
  const arrays=collectArrays(model),geometries=new Set(),gpuBuffers=new Set();let declaredGeometryBufferBytes=0,attributeCount=0;
  scene?.traverse?.(object=>{const g=object.geometry;if(!g||geometries.has(g))return;geometries.add(g);const attrs=[...Object.values(g.attributes||{}),g.index,...Object.values(g.morphAttributes||{}).flat()].filter(Boolean);for(const attribute of attrs){const owner=attribute.isInterleavedBufferAttribute?attribute.data:attribute;if(gpuBuffers.has(owner))continue;gpuBuffers.add(owner);attributeCount++;declaredGeometryBufferBytes+=owner.array?.byteLength||0;}});
  const targets=renderTargets.filter(Boolean).map((rt,index)=>{
    const textures=rt.textures?.length?rt.textures:[rt.texture].filter(Boolean);
    const attachments=textures.map(t=>textureBytes(t,rt.width,rt.height,rt.depth||1));
    // Exact driver depth layout and multisample allocation are not exposed.
    const colorBytes=attachments.reduce((s,t)=>s+t.estimatedBytes,0),depthBytes=rt.depthBuffer?rt.width*rt.height*4:0;
    const samples=Math.max(1,rt.samples||1);
    return {index,width:rt.width,height:rt.height,requestedSamples:rt.samples||0,colorAttachments:attachments,colorTextureBytes:colorBytes,depthAttachmentEstimateBytes:depthBytes,multisampleStorageEstimateBytes:samples>1?(colorBytes+depthBytes)*samples:0,estimatedBytes:colorBytes+depthBytes+(samples>1?(colorBytes+depthBytes)*samples:0)};
  });
  const heap=performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize,jsHeapSizeLimit:performance.memory.jsHeapSizeLimit,scope:'Whole browser JS context; implementation-specific; includes more than this geometry.'}:null;
  return {modelTypedArrays:{...arrayStorage(arrays),arrays:arrays.map(({path,array})=>({path,type:array.constructor.name,length:array.length,byteLength:array.byteLength}))},geometryBufferEstimate:{geometries:geometries.size,bufferAllocations:attributeCount,bytes:declaredGeometryBufferBytes,scope:'Declared unique Three.js BufferAttribute/InterleavedBuffer and index storage in the scene, including currently invisible objects; an estimate of buffer uploads, not measured VRAM.'},renderTargetEstimate:{targets,totalBytes:targets.reduce((s,t)=>s+t.estimatedBytes,0),scope:'Requested texture formats and a 4-byte/pixel depth estimate; excludes default framebuffer, driver padding/caches, compiled shaders, browser compositor and hidden allocations.'},javascriptHeap:heap,rendererInfo:renderer?{geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures}:null,warning:'These counts and estimates are not actual GPU VRAM usage.'};
}

/**
 * render(): synchronous render only; no asynchronous export/readback or unrelated draws.
 * frames: measured render submissions, warmup: unmeasured frames (shader compilation included).
 * frameWallMs measures requestAnimationFrame intervals and includes browser scheduling.
 * buildSamplesMs is independently collected CPU geometry build time, never GPU time.
 */
export async function benchmarkRenderer({renderer,scene,camera,render,model,frames=120,warmup=30,yieldFrame=nextFrame,buildSamplesMs=[],renderTargets=[],metadata={},queryTimeoutMs=5000}={}){
  if(!renderer?.getContext)throw new TypeError('renderer must be a Three.js WebGLRenderer.');
  if(!Number.isInteger(frames)||frames<2||frames>10000||!Number.isInteger(warmup)||warmup<0)throw new RangeError('frames must be 2..10000 and warmup >= 0.');
  const draw=render||(()=>renderer.render(scene,camera));
  const gl=renderer.getContext(),identity=rendererIdentity(renderer),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const gpuSamples=[],cpuSamples=[],wallSamples=[],pending=[];
  let discardedDisjoint=0,discardedTimeout=0,invalidResults=0,queryFailures=0;
  const started=new Date().toISOString(),bufferSize={width:gl.drawingBufferWidth,height:gl.drawingBufferHeight};
  let lastWall=null;
  function collect(){
    if(!ext)return;
    if(gl.getParameter(ext.GPU_DISJOINT_EXT)){
      discardedDisjoint+=pending.length;
      for(const entry of pending)gl.deleteQuery(entry.query);
      pending.length=0;return;
    }
    for(let i=pending.length-1;i>=0;i--){
      const entry=pending[i],available=gl.getQueryParameter(entry.query,gl.QUERY_RESULT_AVAILABLE);
      if(available){
        const ns=gl.getQueryParameter(entry.query,gl.QUERY_RESULT);
        if(Number.isFinite(ns)&&ns>=0)gpuSamples.push({frame:entry.frame,ms:ns/1e6});else invalidResults++;
        gl.deleteQuery(entry.query);pending.splice(i,1);
      }else if(now()-entry.submittedAt>queryTimeoutMs){discardedTimeout++;gl.deleteQuery(entry.query);pending.splice(i,1);}
    }
  }
  // Returning to the event loop is required before WebGL query results can appear.
  for(let i=0;i<warmup;i++){await yieldFrame();draw();}
  if(ext)gl.getParameter(ext.GPU_DISJOINT_EXT); // clear prior disjoint state
  try{
    for(let frame=0;frame<frames;frame++){
      await yieldFrame();collect();
      if(gl.isContextLost())throw new Error('WebGL context was lost during benchmark.');
      const at=now();if(lastWall!==null)wallSamples.push(at-lastWall);lastWall=at;
      const query=ext?gl.createQuery():null;
      if(ext&&!query)queryFailures++;
      if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
      const cpuStart=now();draw();cpuSamples.push(now()-cpuStart);
      if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({query,frame,submittedAt:now()});}
      // Do not gl.finish(): it would serialize submission and alter the workload.
      gl.flush();
    }
    while(pending.length){await yieldFrame();collect();}
  }finally{for(const entry of pending)gl.deleteQuery(entry.query);}
  gpuSamples.sort((a,b)=>a.frame-b.frame);
  const gpuReason=!ext?'EXT_disjoint_timer_query_webgl2 unavailable':gpuSamples.length?null:'No valid GPU query result (disjoint, unavailable, or query failure).';
  return {schemaVersion:1,startedAt:started,finishedAt:new Date().toISOString(),metadata,identity,viewport:bufferSize,protocol:{frames,warmup,queryTimeoutMs,renderScheduling:'One render per requestAnimationFrame; no gl.finish or GPU readback in measured draw. Other application rendering must be paused.',cpuBuild:'Independent buildRoad calls supplied by caller; compilation excluded from measured render warmup.',frameWall:'Intervals between measured animation callbacks; includes browser scheduling and is not GPU elapsed time.'},cpuSubmitMs:summarize(cpuSamples),frameWallMs:summarize(wallSamples),cpuBuildMs:summarize(buildSamplesMs),gpuElapsedMs:summarize(gpuSamples.map(v=>v.ms)),gpuUnavailableReason:gpuReason,gpuQueries:{submitted:ext?frames-queryFailures:0,valid:gpuSamples.length,discardedDisjoint,discardedTimeout,invalidResults,queryFailures},memory:memoryEstimates({renderer,scene,model,renderTargets}),lastRender:renderer.info?.render?{...renderer.info.render}:null,samples:{cpuSubmitMs:cpuSamples,frameWallMs:wallSamples,cpuBuildMs:[...buildSamplesMs],gpuElapsedMs:gpuSamples}};
}

export function performanceCSV(results){
  const header=['surface','potholes','resolution','shading','renderer_class','width','height','triangles','cpu_build_median_ms','cpu_build_p95_ms','cpu_submit_median_ms','cpu_submit_p95_ms','frame_wall_median_ms','frame_wall_p95_ms','gpu_median_ms','gpu_p95_ms','gpu_valid','disjoint_discarded','geometry_buffer_estimate_bytes','model_typed_array_bytes','rt_texture_estimate_bytes'];
  const quote=v=>v==null?'':`"${String(v).replaceAll('"','""')}"`;
  const rows=results.map(r=>{const m=r.metadata||{};return [m.surface,m.potholes,m.resolution,m.shading,r.identity.classification,r.viewport.width,r.viewport.height,r.lastRender?.triangles,r.cpuBuildMs?.median,r.cpuBuildMs?.p95,r.cpuSubmitMs?.median,r.cpuSubmitMs?.p95,r.frameWallMs?.median,r.frameWallMs?.p95,r.gpuElapsedMs?.median,r.gpuElapsedMs?.p95,r.gpuQueries.valid,r.gpuQueries.discardedDisjoint,r.memory.geometryBufferEstimate.bytes,r.memory.modelTypedArrays.uniqueViewedBytes,r.memory.renderTargetEstimate.totalBytes].map(quote).join(',');});
  return [header.join(','),...rows].join('\n')+'\n';
}
