/**
 * The material pass is intentionally separate from the measurement passes.
 * Aggregate relief changes only the beauty shading normal, never the mesh,
 * view-space normal export, depth, binary mask, or integer instance IDs.
 * uLight is a view-space direction supplied by the application each frame.
 */
export const vertexShader = `
attribute float depression;
attribute float boundaryField;
attribute vec3 originalPosition;
attribute float holeId;
attribute float holeDepth;
attribute float surfacePart;
varying vec3 vNormal;
varying vec3 vWorldNormal;
varying vec3 vOriginal;
varying vec3 vView;
varying float vDepression;
varying float vBoundary;
varying float vHoleId;
varying float vHoleDepth;
varying float vSurfacePart;
void main(){
  vNormal=normalize(normalMatrix*normal);
  // Road meshes use an identity/uniform-scale model transform.
  vWorldNormal=normalize(mat3(modelMatrix)*normal);
  vOriginal=originalPosition;
  vDepression=depression;
  vBoundary=boundaryField;
  vHoleId=holeId;
  vHoleDepth=holeDepth;
  vSurfacePart=surfacePart;
  vec4 mv=modelViewMatrix*vec4(position,1.0);
  vView=mv.xyz;
  gl_Position=projectionMatrix*mv;
}`;

export const fragmentShader = `
precision highp float;
uniform int uMode;
uniform float uDepth;
uniform float uNear;
uniform float uFar;
uniform vec3 uLight;
uniform float uAmbient;
uniform float uLightIntensity;
uniform float uBefore;
uniform float uAggregateScale;
uniform float uWetness;
uniform float uMaterialDetail;
varying vec3 vNormal;
varying vec3 vWorldNormal;
varying vec3 vOriginal;
varying vec3 vView;
varying float vDepression;
varying float vBoundary;
varying float vHoleId;
varying float vHoleDepth;
varying float vSurfacePart;
const float PI=3.141592653589793;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
vec2 hash2(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453123);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
}
// Jittered cells give stones a stable footprint and a per-stone tone. The
// second-nearest distance supplies mortar gaps; derivatives antialias them.
vec3 stoneCells(vec2 p){
  vec2 cell=floor(p),local=fract(p);
  float first=10.,second=10.,tone=0.;
  for(int y=-1;y<=1;y++){
    for(int x=-1;x<=1;x++){
      vec2 offset=vec2(float(x),float(y));
      vec2 seed=cell+offset;
      vec2 delta=offset+.16+.68*hash2(seed)-local;
      float dist=dot(delta,delta);
      if(dist<first){second=first;first=dist;tone=hash(seed+17.);}
      else if(dist<second){second=dist;}
    }
  }
  float gap=sqrt(second)-sqrt(first);
  float aa=max(.012,min(.22,fwidth(p.x)+fwidth(p.y)));
  float edge=smoothstep(.035-aa*.4,.12+aa*.4,gap);
  float radius=.27+.13*tone;
  float island=1.-smoothstep(radius-.045-aa*.3,radius+.035+aa*.3,sqrt(first));
  float coverage=edge*island;
  // Hide unresolved cells instead of producing high-frequency sparkles.
  float resolved=1.-smoothstep(.65,1.8,max(fwidth(p.x),fwidth(p.y)));
  return vec3(mix(.50,coverage,resolved),mix(.5,tone,resolved),sqrt(first));
}
vec3 packDepth(float value){
  float k=floor(clamp(value,0.,1.)*16777215.+.5);
  float r=floor(k/65536.);float g=floor((k-r*65536.)/256.);float b=k-r*65536.-g*256.;
  return vec3(r,g,b)/255.;
}
// Screen-space surface derivatives turn a sub-millimetre procedural height
// field into a shading normal. This does not displace or add any geometry.
vec3 reliefNormal(vec3 n,float height){
  vec3 sx=dFdx(vView),sy=dFdy(vView);
  vec3 rx=cross(sy,n),ry=cross(n,sx);
  float det=dot(sx,rx);
  vec3 grad=sign(det)*(dFdx(height)*rx+dFdy(height)*ry);
  return normalize(max(abs(det),1e-12)*n-grad);
}
vec3 toSRGB(vec3 c){
  return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));
}
void main(){
  vec3 geometricNormal=normalize(vNormal);
  if(!gl_FrontFacing)geometricNormal=-geometricNormal;
  float depth=-vView.z;
  float top=1.-step(.5,vSurfacePart);
  float footprint=step(vBoundary,0.)*top;
  // These branches return before all material noise, perturbation, and light.
  if(uMode==1){gl_FragColor=vec4(.63,.81,.67,1.);return;}
  if(uMode==2){gl_FragColor=vec4(geometricNormal*.5+.5,1.);return;}
  if(uMode==3){gl_FragColor=vec4(vec3(footprint),1.);return;}
  if(uMode==4){float t=clamp((depth-2.)/12.,0.,1.);gl_FragColor=vec4(vec3(1.-t),1.);return;}
  if(uMode==5){gl_FragColor=vec4(packDepth((depth-uNear)/(uFar-uNear)),1.);return;}
  if(uMode==6||uMode==7){
    // IDs exist on the whole top mesh so interpolating the boundary does not
    // turn an inside edge pixel into ID zero. The mask is applied first.
    float id=footprint*floor(clamp(vHoleId,0.,255.)+.5);
    if(uMode==6){gl_FragColor=vec4(id/255.,0.,0.,1.);return;}
    // Screen-only preview palette. Mode 6 remains the raw R=ID byte export.
    vec3 tint=vec3(0.);
    if(id>.5&&id<1.5)tint=vec3(.81,.90,.48);
    else if(id<2.5&&id>=1.5)tint=vec3(.37,.68,.87);
    else if(id<3.5&&id>=2.5)tint=vec3(.96,.52,.38);
    else if(id<4.5&&id>=3.5)tint=vec3(.96,.79,.33);
    else if(id<5.5&&id>=4.5)tint=vec3(.67,.48,.85);
    else if(id<6.5&&id>=5.5)tint=vec3(.34,.83,.77);
    else if(id<7.5&&id>=6.5)tint=vec3(.91,.49,.65);
    else if(id>=7.5)tint=vec3(.91,.65,.35);
    gl_FragColor=vec4(tint,1.);return;
  }

  vec2 p=vOriginal.xz;
  vec3 worldNormal=normalize(vWorldNormal);
  if(!gl_FrontFacing)worldNormal=-worldNormal;
  float detail=clamp(uMaterialDetail,0.,1.);
  float scale=max(uAggregateScale,.05);
  float wet=clamp(uWetness,0.,1.);
  float broad=noise(p*2.8),coarse=noise(p*18.),grain=noise(p*95.);
  vec3 fineStone=vec3(.5),largeStone=vec3(.5);
  float largePresence=0.;
  // This uniform branch also avoids cell evaluation in the control material.
  if(detail>.001){
    fineStone=stoneCells(p*(54.*scale));
    largeStone=stoneCells(p*(24.*scale)+31.);
    largePresence=smoothstep(.35,.72,noise(p*(7.*scale)+9.));
  }
  float stones=mix(fineStone.x,largeStone.x,largePresence*.66);
  float stoneTone=mix(fineStone.y,largeStone.y,largePresence*.66);
  float weather=noise(p*9.+47.);

  float damaged=clamp(1.-uBefore,0.,1.)*step(.0001,uDepth);
  float inside=(1.-smoothstep(-.035,.012,vBoundary))*damaged*top;
  float relativeDepth=clamp(vDepression/max(vHoleDepth,.001),0.,1.);
  // Compare the damaged normal to the underlying analytic surface. A sloped
  // road is therefore not automatically classified as an exposed pit wall.
  vec3 sourceCross=cross(dFdx(vOriginal),dFdy(vOriginal));
  vec3 sourceNormal=sourceCross/max(length(sourceCross),1e-8);
  if(dot(sourceNormal,worldNormal)<0.)sourceNormal=-sourceNormal;
  float deflection=1.-clamp(dot(worldNormal,sourceNormal),0.,1.);
  float wall=smoothstep(.035,.25,deflection);
  float floorWeight=smoothstep(.56,.88,relativeDepth)*(1.-smoothstep(.055,.25,deflection));
  float rim=exp(-pow(vBoundary/.065,2.))*damaged*top;

  // Control material: the previous restrained, flat-grain asphalt and pit
  // colors. The same geometry, camera and lighting make a useful ablation.
  vec3 baseAsphalt=vec3(.075,.083,.088)*(.91+.12*grain+.08*coarse+.06*broad)
    +smoothstep(.72,.92,grain)*vec3(.009);
  vec3 baseWall=mix(vec3(.081,.069,.055),vec3(.126,.102,.074),wall);
  vec3 basePit=mix(baseWall,vec3(.049,.052,.050),floorWeight)*(.94+.09*coarse+.05*grain);
  vec3 baseline=mix(baseAsphalt,basePit,inside)*(1.-rim*.12);

  // Dark binder with two scales of exposed mineral aggregate. Per-cell tint
  // changes color, not geometry or labels. Weathering is a material blend.
  vec3 binder=vec3(.035,.041,.044)*(.92+.12*broad);
  vec3 mineral=mix(vec3(.070,.075,.072),vec3(.160,.149,.125),stoneTone);
  vec3 asphalt=mix(binder,mineral,stones*.72)*(.94+.10*coarse);
  vec3 erodedWall=mix(vec3(.084,.067,.047),vec3(.207,.171,.117),stones*(.52+.36*stoneTone));
  erodedWall*=.87+.20*weather+.06*grain;
  vec3 looseFloor=mix(vec3(.039,.042,.036),vec3(.089,.083,.060),stones*.65)*(.89+.17*coarse);
  vec3 pit=mix(erodedWall,looseFloor,floorWeight);
  vec3 detailed=mix(asphalt,pit,inside);
  // A narrow dusty/crumbled shoulder, not simulated occlusion or a shadow.
  vec3 edgeStone=mix(vec3(.110,.101,.077),vec3(.186,.168,.125),stoneTone);
  detailed=mix(detailed,edgeStone,rim*(.14+.20*weather));

  // Actual road side geometry exposes a coarse rock cross-section. It stays
  // absent from pothole masks/IDs while normals and depth still include it.
  vec2 sideUV=mix(vOriginal.xy,vOriginal.zy,step(abs(worldNormal.z),abs(worldNormal.x)));
  vec3 sideStone=vec3(.5);
  if(top<.5&&detail>.001)sideStone=stoneCells(sideUV*(15.*scale)+14.);
  float strata=.5+.5*sin(vOriginal.y*92.+noise(sideUV*8.)*2.);
  vec3 sideMaterial=mix(vec3(.075,.071,.060),vec3(.193,.180,.146),sideStone.x*(.50+.35*sideStone.y));
  sideMaterial*=.88+.14*strata;
  vec3 albedo=mix(baseline,detailed,detail);
  albedo=mix(albedo,sideMaterial,1.-top);

  float paint=(1.-smoothstep(.035,.055,abs(abs(p.x)-3.15)))
    *step(.26,fract((p.y+10.)/2.))*top*(1.-inside);
  albedo=mix(albedo,vec3(.62,.63,.51)*(.94+.06*grain),paint);
  albedo*=mix(1.,.57,wet);
  float relief=(stones-.5)*.0010+(grain-.5)*.00024;
  relief=mix(relief,(sideStone.x-.5)*.0017,1.-top);
  relief*=detail*(1.-paint*.8)*(1.-wet*.60);
  vec3 n=geometricNormal;
  if(detail>.001)n=reliefNormal(geometricNormal,relief);

  vec3 lightDir=normalize(uLight);
  vec3 viewDir=normalize(-vView);
  vec3 halfDir=normalize(lightDir+viewDir);
  float NoL=max(dot(n,lightDir),0.);
  float NoV=max(dot(n,viewDir),.001);
  float NoH=max(dot(n,halfDir),0.);
  float VoH=max(dot(viewDir,halfDir),0.);
  float roughness=mix(.91,.68,stones*detail);
  roughness=mix(roughness,.97,floorWeight*inside*.5);
  roughness=mix(roughness,.23,wet);
  roughness=mix(roughness,.74,paint*(1.-wet));
  float alpha=roughness*roughness;
  float a2=alpha*alpha;
  float denom=NoH*NoH*(a2-1.)+1.;
  float distribution=a2/(PI*denom*denom);
  float k=(roughness+1.)*(roughness+1.)/8.;
  float geometry=(NoL/(NoL*(1.-k)+k))*(NoV/(NoV*(1.-k)+k));
  vec3 fresnel=vec3(.04)+vec3(.96)*pow(1.-VoH,5.);
  vec3 specular=distribution*geometry*fresnel/max(4.*NoL*NoV,.001);
  float ambient=uAmbient*(.78+.22*max(worldNormal.y,0.));
  // uLightIntensity retains the existing application's display exposure. The
  // BRDF is an illustrative dielectric GGX model, without cast shadow or AO.
  vec3 color=albedo*ambient+uLightIntensity*NoL*(albedo*(1.-fresnel)+PI*specular);
  gl_FragColor=vec4(toSRGB(color),1.);
}`;
