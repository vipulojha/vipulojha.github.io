// =====================================================================
// 00 · CORE — renderer, render targets, fullscreen passes, GLSL library,
// easing, post pipeline, glyph text engine, selection box, audio.
// =====================================================================
import * as THREE from 'three';

const QS = new URLSearchParams(location.search);
const HEADLESS = QS.has('headless'), QUICK = QS.has('quick') || HEADLESS;
if (HEADLESS) document.body.classList.add('headless');

const canvas = document.getElementById('gl');
if (!document.createElement('canvas').getContext('webgl2')) {
  document.getElementById('nogl').style.display = 'grid';
  document.getElementById('load').remove();
  throw new Error('WebGL2 unavailable');
}
const R = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: HEADLESS });
R.autoClear = false; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
R.outputColorSpace = THREE.LinearSRGBColorSpace;
R.toneMapping = THREE.NoToneMapping;
const HDR = (R.extensions.has('EXT_color_buffer_float') || R.extensions.has('EXT_color_buffer_half_float')) ? THREE.HalfFloatType : THREE.UnsignedByteType;

// ---------- math / easing ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const E = {
  lin: t => t,
  in2: t => t * t, out2: t => 1 - (1 - t) ** 2, io2: t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2,
  in3: t => t ** 3, out3: t => 1 - (1 - t) ** 3, io3: t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
  out4: t => 1 - (1 - t) ** 4, io4: t => t < .5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2,
  out5: t => 1 - (1 - t) ** 5, io5: t => t < .5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2,
  inExpo: t => t === 0 ? 0 : 2 ** (10 * t - 10), outExpo: t => t === 1 ? 1 : 1 - 2 ** (-10 * t),
  ioExpo: t => t === 0 ? 0 : t === 1 ? 1 : t < .5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2,
  outBack: t => { const c = 1.70158, c3 = c + 1; return 1 + c3 * (t - 1) ** 3 + c * (t - 1) ** 2; },
  inBack: t => { const c = 1.70158; return (c + 1) * t ** 3 - c * t * t; },
  spring: t => 1 - Math.cos(t * Math.PI * 4.5) * Math.exp(-t * 6),
  smooth: t => t * t * (3 - 2 * t), smoother: t => t * t * t * (t * (t * 6 - 15) + 10),
};
function prng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; }
const Si = x => { const i = Math.floor(x), f = x - i, h = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }; const u = f * f * (3 - 2 * f); return lerp(h(i), h(i + 1), u) * 2 - 1; };
// Catmull-Rom through keyed poses: keys = [{u, ...arrays}], returns blended arrays at u
function rig(keys, u, fields) {
  let i = 0; while (i < keys.length - 2 && u > keys[i + 1].u) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[Math.min(keys.length - 1, i + 1)], k3 = keys[Math.min(keys.length - 1, i + 2)];
  const t = E.smooth(clamp((u - k1.u) / Math.max(1e-6, k2.u - k1.u)));
  const out = {};
  for (const f of fields) {
    const a = [].concat(k0[f]), b = [].concat(k1[f]), c = [].concat(k2[f]), d = [].concat(k3[f]);
    out[f] = b.map((_, j) => { const p0 = a[j], p1 = b[j], p2 = c[j], p3 = d[j]; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t); });
    if (!Array.isArray(k1[f])) out[f] = out[f][0];
  }
  return out;
}

// ---------- GLSL library ----------
const GLSL = /* glsl */`
precision highp float;
out highp vec4 fragOut;
#define gl_FragColor fragOut
varying vec2 vUv;
#define PI 3.14159265
float hash11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float hash13(vec3 p3){p3=fract(p3*.1031);p3+=dot(p3,p3.zyx+31.32);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
vec3 hash33(vec3 p3){p3=fract(p3*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yxz+33.33);return fract((p3.xxy+p3.yxx)*p3.zyx);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
 return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x),u.y);}
float vnoise3(vec3 p){vec3 i=floor(p),f=fract(p);vec3 u=f*f*(3.-2.*f);
 float a=hash13(i),b=hash13(i+vec3(1,0,0)),c=hash13(i+vec3(0,1,0)),d=hash13(i+vec3(1,1,0));
 float e=hash13(i+vec3(0,0,1)),f1=hash13(i+vec3(1,0,1)),g=hash13(i+vec3(0,1,1)),h=hash13(i+vec3(1,1,1));
 return mix(mix(mix(a,b,u.x),mix(c,d,u.x),u.y),mix(mix(e,f1,u.x),mix(g,h,u.x),u.y),u.z);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vnoise(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return s;}
float fbm3(vec3 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vnoise3(p);p=p*2.02+vec3(5.1,1.7,9.3);a*=.5;}return s;}
float sdBox(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.))+min(max(d.x,d.y),0.);}
float sdRBox(vec2 p,vec2 b,float r){return sdBox(p,b-r)-r;}
float sdSeg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
vec3 toLin(vec3 c){return pow(c,vec3(2.2));}
vec3 toSrgb(vec3 c){return pow(max(c,0.),vec3(1./2.2));}
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 blackbody(float t){t*=.01;vec3 c;c.r=t<=66.?1.:clamp(1.29*pow(t-60.,-.1332),0.,1.);
 c.g=t<=66.?clamp(.39*log(t)-.63,0.,1.):clamp(1.13*pow(t-60.,-.0755),0.,1.);
 c.b=t>=66.?1.:t<=19.?0.:clamp(.54*log(t-10.)-1.19,0.,1.);return toLin(c);}
`;
const FSV = `varying vec2 vUv; void main(){ vUv = position.xy*.5+.5; gl_Position = vec4(position.xy,0.,1.); }`;

const fsGeo = new THREE.BufferGeometry();
fsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsScene = new THREE.Scene(), fsMesh = new THREE.Mesh(fsGeo);
fsMesh.frustumCulled = false; fsScene.add(fsMesh);
function shader(frag, uniforms = {}, opt = {}) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: opt.vert || FSV, fragmentShader: GLSL + frag, uniforms,
    depthTest: !!opt.depth, depthWrite: !!opt.depth, transparent: !!opt.blend,
    blending: opt.blend === 'add' ? THREE.AdditiveBlending : opt.blend ? THREE.NormalBlending : THREE.NoBlending,
    side: opt.side || THREE.FrontSide,
  });
}
function pass(mat, target = null, clear = false) {
  fsMesh.material = mat; R.setRenderTarget(target);
  if (clear) R.clear();
  R.render(fsScene, fsCam);
}
function makeRT(w, h, o = {}) {
  const rt = new THREE.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), {
    type: o.ldr ? THREE.UnsignedByteType : HDR, depthBuffer: !!o.depth, stencilBuffer: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, colorSpace: THREE.NoColorSpace,
  });
  if (o.depthTex) { rt.depthTexture = new THREE.DepthTexture(rt.width, rt.height); rt.depthBuffer = true; }
  return rt;
}

// ---------- post pipeline (bloom pyramid + grade) ----------
const POST_DEFAULT = { exposure: 1, bloom: .35, threshold: .9, ca: .0012, vignette: .28, grain: .028, sat: 1, contrast: 1, lift: [0, 0, 0], gain: [1, 1, 1], tonemap: 1, halation: .25, fade: [0, 0, 0, 0], streak: 0, flare: 0 };
const mDown = shader(`uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThresh; uniform float uFirst;
void main(){ vec2 o=uTexel;
 vec3 c = texture(tSrc,vUv).rgb*4.;
 c += texture(tSrc,vUv+vec2(-o.x,-o.y)).rgb + texture(tSrc,vUv+vec2(o.x,-o.y)).rgb + texture(tSrc,vUv+vec2(-o.x,o.y)).rgb + texture(tSrc,vUv+vec2(o.x,o.y)).rgb;
 c += (texture(tSrc,vUv+vec2(-2.*o.x,0)).rgb + texture(tSrc,vUv+vec2(2.*o.x,0)).rgb + texture(tSrc,vUv+vec2(0,-2.*o.y)).rgb + texture(tSrc,vUv+vec2(0,2.*o.y)).rgb)*.5;
 c /= 10.;
 if(uFirst>.5){ float l=max(c.r,max(c.g,c.b)); float k=smoothstep(uThresh*.6,uThresh*1.4,l); c*=k; c=min(c,vec3(30.)); }
 gl_FragColor=vec4(c,1.); }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: 1 }, uFirst: { value: 0 } });
const mUp = shader(`uniform sampler2D tSrc; uniform sampler2D tAdd; uniform vec2 uTexel;
void main(){ vec2 o=uTexel*1.5; vec3 c=vec3(0.);
 c += texture(tSrc,vUv+vec2(-o.x,-o.y)).rgb; c += texture(tSrc,vUv+vec2(0,-o.y)).rgb*2.; c += texture(tSrc,vUv+vec2(o.x,-o.y)).rgb;
 c += texture(tSrc,vUv+vec2(-o.x,0)).rgb*2.; c += texture(tSrc,vUv).rgb*4.; c += texture(tSrc,vUv+vec2(o.x,0)).rgb*2.;
 c += texture(tSrc,vUv+vec2(-o.x,o.y)).rgb; c += texture(tSrc,vUv+vec2(0,o.y)).rgb*2.; c += texture(tSrc,vUv+vec2(o.x,o.y)).rgb;
 gl_FragColor=vec4(c/16. + texture(tAdd,vUv).rgb,1.); }`, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() } });
const mGrade = shader(`uniform sampler2D tHdr; uniform sampler2D tBloom; uniform float uTime;
uniform float uExposure,uBloom,uCA,uVig,uGrain,uSat,uCon,uTone,uHal,uStreak,uFlare; uniform vec3 uLift,uGain; uniform vec4 uFade; uniform vec2 uRes;
vec3 aces(vec3 x){ x*=.6; return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
void main(){
 vec2 d=vUv-.5; float r2=dot(d,d);
 vec3 c;
 if(uCA>0.){ vec2 off=d*uCA*(1.+r2*4.); c=vec3(texture(tHdr,vUv-off).r,texture(tHdr,vUv).g,texture(tHdr,vUv+off).b); }
 else c=texture(tHdr,vUv).rgb;
 vec3 b=texture(tBloom,vUv).rgb;
 c += b*uBloom + b*vec3(1.,.35,.15)*uHal*uBloom*.6;
 if(uStreak>0.){ vec3 st=vec3(0.); for(int i=-7;i<=7;i++){ float f=float(i); st+=texture(tBloom,vec2(vUv.x+f*.04,vUv.y)).rgb*exp(-abs(f)*.3); } c+=st*uStreak*vec3(.5,.68,1.)*.09; }
 if(uFlare>0.){ vec2 g=1.-vUv; vec3 fl=vec3(0.); for(int i=0;i<4;i++){ float f=float(i); vec2 q=.5+(g-.5)*(.4+f*.45); fl+=texture(tBloom,q).rgb*vec3(.4+.2*f,.6,1.-.2*f)*exp(-length(q-.5)*2.); }
   float hd=length((vUv-.5)*vec2(1.7,1.)); fl+=texture(tBloom,.5+normalize(vUv-.5+1e-4)*.45).rgb*smoothstep(.05,0.,abs(hd-.45))*vec3(1.,.6,.9); c+=fl*uFlare*.18; }
 c *= uExposure;
 if(uTone>.5){ c=aces(c); c=pow(c,vec3(1./2.2)); } else { c=toSrgb(clamp(c,0.,1.)); }
 c = (c-.5)*uCon+.5;
 float l=luma(c); c=mix(vec3(l),c,uSat);
 c = c*uGain + uLift*(1.-c);
 c *= 1.-uVig*smoothstep(.1,.85,r2*2.2);
 float g=hash13(vec3(vUv*uRes,fract(uTime*7.31)*100.))-.5; c += g*uGrain;
 c = mix(c,uFade.rgb,uFade.a);
 gl_FragColor=vec4(clamp(c,0.,1.),1.); }`, {
  tHdr: { value: null }, tBloom: { value: null }, uTime: { value: 0 }, uExposure: { value: 1 }, uBloom: { value: .3 }, uCA: { value: 0 }, uVig: { value: .3 },
  uGrain: { value: .03 }, uSat: { value: 1 }, uCon: { value: 1 }, uTone: { value: 1 }, uHal: { value: .2 }, uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) },
  uFade: { value: new THREE.Vector4() }, uRes: { value: new THREE.Vector2(1, 1) }, uStreak: { value: 0 }, uFlare: { value: 0 },
});
const mOverlay = shader(`uniform sampler2D tOv; void main(){ vec4 o=texture(tOv,vUv); gl_FragColor=vec4(o.rgb,o.a); }`, { tOv: { value: null } }, { blend: true });
const mCopy = shader(`uniform sampler2D tSrc; void main(){ gl_FragColor=vec4(texture(tSrc,vUv).rgb,1.); }`, { tSrc: { value: null } });

class Bloom {
  constructor() { this.d = []; this.u = []; this.w = 0; }
  size(w, h) {
    if (w === this.w && h === this.h) return; this.w = w; this.h = h;
    [...this.d, ...this.u].forEach(r => r.dispose()); this.d = []; this.u = [];
    let cw = w, ch = h;
    for (let i = 0; i < 6; i++) { cw = Math.max(2, cw >> 1); ch = Math.max(2, ch >> 1); this.d.push(makeRT(cw, ch)); this.u.push(makeRT(cw, ch)); }
  }
  run(src, thresh) {
    let s = src;
    for (let i = 0; i < 6; i++) {
      mDown.uniforms.tSrc.value = s.texture; mDown.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
      mDown.uniforms.uThresh.value = thresh; mDown.uniforms.uFirst.value = i === 0 ? 1 : 0;
      pass(mDown, this.d[i]); s = this.d[i];
    }
    let acc = this.d[5];
    for (let i = 4; i >= 0; i--) {
      mUp.uniforms.tSrc.value = acc.texture; mUp.uniforms.tAdd.value = this.d[i].texture; mUp.uniforms.uTexel.value.set(1 / acc.width, 1 / acc.height);
      pass(mUp, this.u[i]); acc = this.u[i];
    }
    return acc;
  }
}
const bloom = new Bloom();
function grade(slot, post, time) {
  const P = Object.assign({}, POST_DEFAULT, post);
  const b = P.bloom > 0 ? bloom.run(slot.hdr, P.threshold) : slot.hdr;
  const u = mGrade.uniforms;
  u.tHdr.value = slot.hdr.texture; u.tBloom.value = b.texture; u.uTime.value = time;
  u.uExposure.value = P.exposure; u.uBloom.value = P.bloom; u.uCA.value = P.ca; u.uVig.value = P.vignette; u.uGrain.value = P.grain;
  u.uStreak.value = P.streak; u.uFlare.value = P.flare; u.uSat.value = P.sat; u.uCon.value = P.contrast; u.uTone.value = P.tonemap; u.uHal.value = P.halation;
  u.uLift.value.fromArray(P.lift); u.uGain.value.fromArray(P.gain); u.uFade.value.fromArray(P.fade); u.uRes.value.set(slot.ldr.width, slot.ldr.height);
  pass(mGrade, slot.ldr);
}

// ---------- virtual stage ----------
const V = { W: 1920, H: 1080, sx: 1 };
function computeVirtual(w, h) {
  const a = w / h;
  if (a >= 1) { V.W = clamp(1080 * a, 1440, 2200); V.H = V.W / a; }
  else { V.W = 1000; V.H = 1000 / a; }
  V.portrait = a < 1; V.cx = V.W / 2; V.cy = V.H / 2;
}

// ---------- glyph text engine (canvas 2D, per-glyph animation) ----------
const measureCache = new Map();
function fontStr(o) { return `${o.italic ? 'italic ' : ''}${o.weight || 400} ${o.size}px "${o.font || 'Geist'}", ${o.fallback || 'Arial, sans-serif'}`; }
function glyphW(ctx, f, ch) { const k = f + '|' + ch; let w = measureCache.get(k); if (w === undefined) { ctx.font = f; w = ctx.measureText(ch).width; measureCache.set(k, w); } return w; }
const layoutCache = new Map();
function layout(ctx, str, o) {
  const key = str + '§' + o.size + o.font + o.weight + o.italic + (o.maxW || 0) + (o.track || 0) + (o.lh || 0) + (o.align || '');
  let L = layoutCache.get(key); if (L) return L;
  const f = fontStr(o), tr = (o.track || 0) * o.size, lh = (o.lh || 1.08) * o.size;
  const paras = String(str).split('\n'); const lines = [];
  for (const para of paras) {
    const words = para.split(' '); let line = [], lw = 0;
    const wordW = w => [...w].reduce((s, c) => s + glyphW(ctx, f, c) + tr, 0);
    const spW = glyphW(ctx, f, ' ') + tr;
    for (const w of words) {
      const ww = wordW(w);
      if (o.maxW && line.length && lw + spW + ww > o.maxW) { lines.push(line); line = []; lw = 0; }
      line.push(w); lw += (line.length > 1 ? spW : 0) + ww;
    }
    lines.push(line);
  }
  let gi = 0, wi = 0; const glyphs = []; let maxW = 0;
  lines.forEach((words, li) => {
    let x = 0; const lg = [];
    words.forEach((w, k) => {
      if (k) { x += glyphW(ctx, f, ' ') + tr; }
      for (const ch of w) { const gw = glyphW(ctx, f, ch); lg.push({ ch, x, w: gw, li, wi, gi: gi++ }); x += gw + tr; }
      wi++;
    });
    const width = Math.max(0, x - tr); maxW = Math.max(maxW, width);
    const ox = o.align === 'center' ? -width / 2 : o.align === 'right' ? -width : 0;
    lg.forEach(g => { g.x += ox; g.y = li * lh; glyphs.push(g); });
  });
  L = { glyphs, lines: lines.length, words: wi, n: gi, width: maxW, height: (lines.length - 1) * lh + o.size, lh, f };
  if (layoutCache.size > 600) layoutCache.clear();
  layoutCache.set(key, L); return L;
}
const SCRAMBLE = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=<>/\\';
const TNOW = () => performance.now() / 1000;
// draw(ctx, str, opts, p (in 0..1), q (out 0..1)) → bounds {x,y,w,h}
function text(ctx, str, o, p = 1, q = 0) {
  const L = layout(ctx, str, o);
  const anim = o.anim || 'fade', by = o.by || (anim === 'blur' ? 'word' : 'glyph');
  const N = by === 'word' ? L.words : by === 'line' ? L.lines : L.n;
  const st = o.stagger ?? (anim === 'type' ? 1 : .55);
  const ease = o.ease || (anim === 'drop' ? E.outBack : anim === 'type' ? E.lin : E.out4);
  let y0 = o.y; if (o.valign === 'middle') y0 -= L.height / 2 - o.size * .78; else if (o.valign === 'bottom') y0 -= L.height - o.size * .2; else if (o.valign === 'top') y0 += o.size * .8;
  ctx.font = L.f; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = o.color || '#fff';
  const ga = o.alpha ?? 1; let caretX = null, caretY = y0;
  const unit = g => by === 'word' ? g.wi : by === 'line' ? g.li : g.gi;
  const ep = i => { const d = N > 1 ? i / (N - 1) * st : 0; return clamp((p - d) / Math.max(1e-4, 1 - st)); };
  for (const g of L.glyphs) {
    const u = unit(g), e0 = ep(u);
    const eq = q > 0 ? clamp((q - (N > 1 ? u / (N - 1) * st * .5 : 0)) / Math.max(1e-4, 1 - st * .5)) : 0;
    if (eq >= 1) continue;
    if (anim === 'type') { if (e0 < 1 || eq > 0 && eq >= 1) { if (caretX === null && e0 < 1) { caretX = o.x + g.x; caretY = y0 + g.y; } continue; } }
    const e = anim === 'type' ? 1 : ease(e0);
    if (e <= 0.001 && anim !== 'type') continue;
    let a = ga, dx = 0, dy = 0, r = 0, sx = 1, sy = 1, blur = 0, clip = false, sk = 0, ch = g.ch, col = o.color || '#fff', split = 0, glow = o.glow, clipW = 1;
    const gx = o.x + g.x, gy = y0 + g.y;
    switch (anim) {
      case 'rise': dy = (1 - e) * o.size * 1.05 - E.in3(eq) * o.size * 1.05; clip = true; break;
      case 'blur': a *= e * (1 - eq); blur = (1 - e) * o.size * .18 + eq * o.size * .12; dy = (1 - e) * o.size * .08; break;
      case 'fade': a *= e * (1 - eq); break;
      case 'track': { const c = (g.gi - L.n / 2); dx = c * (1 - e) * o.size * .45; a *= e * (1 - eq); blur = (1 - e) * 6; break; }
      case 'scatter': { const rr = prng(g.gi * 9973 + 7); const ang = rr() * 6.283, dist = (1 - e) * o.size * (3 + rr() * 5); dx = Math.cos(ang) * dist; dy = Math.sin(ang) * dist; r = (1 - e) * (rr() - .5) * 4; a *= Math.min(1, e * 2) * (1 - eq); break; }
      case 'drop': dy = -(1 - e) * o.size * 1.6 * (o.alt && g.gi % 2 ? -1 : 1); r = (1 - Math.min(1, e)) * .5 * ((g.gi % 2) ? 1 : -1); a *= Math.min(1, e0 * 3) * (1 - eq); break;
      // --- extended styles ---
      case 'decode': { if (e0 <= 0) { a = 0; break; } if (e0 < 1) { const k = Math.floor(TNOW() * 24 + g.gi * 7); ch = SCRAMBLE[(k * 31 + g.gi * 17) % SCRAMBLE.length]; col = o.accent || col; } a *= Math.min(1, e0 * 4) * (1 - eq); blur = eq * o.size * .15; break; }
      case 'glitch': { a *= Math.min(1, e0 * 3) * (1 - eq); const step = Math.floor(TNOW() * 14), h = prng(step * 131 + g.gi * 7)(); const live = e0 < 1 || h > .93 || eq > 0; if (live) { dx = (h - .5) * o.size * .4 * (e0 < 1 ? 1 - e0 : .5); split = o.size * .06 * (1 - e * .6 + eq); } break; }
      case 'flip': { const ang = (1 - e) * Math.PI * .5 + eq * Math.PI * .5; sy = Math.max(.001, Math.cos(ang)); sk = (1 - e) * .35; a *= Math.min(1, e0 * 2) * (1 - eq); dy = -(1 - sy) * o.size * .35; break; }
      case 'wave': { a *= e * (1 - eq); dy = Math.sin(TNOW() * 2.6 + g.gi * .45) * o.size * .055 + (1 - e) * o.size * .6; r = Math.sin(TNOW() * 2 + g.gi * .7) * .03; break; }
      case 'neon': { const fl = e0 >= 1 ? (Math.sin(TNOW() * 40 + g.gi) > .985 ? .35 : 1) : (prng(Math.floor(e0 * 18) + g.gi * 13)() > .5 ? 1 : .08); a *= Math.min(1, e0 * 6) * fl * (1 - eq); glow = o.glow || col; break; }
      case 'stretch': { sy = lerp(3.2, 1, e) * (1 + eq * 2); sx = lerp(.15, 1, e); blur = (1 - e) * o.size * .12 + eq * o.size * .2; a *= Math.min(1, e0 * 2) * (1 - eq); break; }
      case 'mask': { clipW = e; a *= 1 - eq; dx = (1 - e) * -o.size * .25; break; }
      case 'zoom': { const z = lerp(2.6, 1, e) * (1 + eq * 1.5); sx = sy = z; blur = (1 - e) * o.size * .2 + eq * o.size * .2; a *= e * (1 - eq); break; }
      case 'spring': { const sp = E.spring(clamp(e0)); dy = (1 - sp) * o.size * .9; sx = sy = .6 + .4 * sp; a *= Math.min(1, e0 * 4) * (1 - eq); break; }
    }
    if (o.fn) { const t = o.fn(g, e, eq, L); if (t) { dx += t.dx || 0; dy += t.dy || 0; r += t.r || 0; sx *= t.sx ?? 1; sy *= t.sy ?? 1; a *= t.a ?? 1; sk += t.sk || 0; } }
    if (a <= .002) continue;
    ctx.save();
    if (clip) { ctx.beginPath(); ctx.rect(gx - o.size, gy - o.size * 1.05, g.w + o.size * 2, o.size * 1.4); ctx.clip(); }
    if (clipW < 1) { const lx = o.x + (o.align === 'center' ? -L.width / 2 : o.align === 'right' ? -L.width : 0); ctx.beginPath(); ctx.rect(lx - o.size, gy - o.size * 1.1, (L.width + o.size * 2) * clipW, o.size * 1.5); ctx.clip(); }
    ctx.globalAlpha = a; ctx.fillStyle = col;
    if (blur > .4) ctx.filter = `blur(${blur.toFixed(1)}px)`;
    ctx.translate(gx + g.w / 2 + dx, gy + dy); if (r) ctx.rotate(r); if (sk) ctx.transform(1, 0, sk, 1, 0, 0); if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
    if (split) { ctx.globalAlpha = a * .8; ctx.fillStyle = '#ff2a4d'; ctx.fillText(ch, -g.w / 2 - split, 0); ctx.fillStyle = '#21e8ff'; ctx.fillText(ch, -g.w / 2 + split, 0); ctx.globalAlpha = a; ctx.fillStyle = col; }
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = o.size * .35; }
    ctx.fillText(ch, -g.w / 2, 0);
    ctx.restore();
    caretX = o.x + g.x + g.w; caretY = gy;
  }
  if (o.caret && (anim === 'type')) {
    const t = performance.now() / 1000;
    if (caretX === null) caretX = o.x + (o.align === 'center' ? 0 : 0);
    if (Math.floor(t * 2) % 2 === 0 || p < 1) { ctx.globalAlpha = 1; ctx.fillStyle = o.caretColor || o.color || '#000'; ctx.fillRect(caretX + 3, caretY - o.size * .82, Math.max(2, o.size * .045), o.size * .98); }
  }
  ctx.globalAlpha = 1; ctx.filter = 'none';
  const bx = o.x + (o.align === 'center' ? -L.width / 2 : o.align === 'right' ? -L.width : 0);
  return { x: bx, y: y0 - o.size * .8, w: L.width, h: L.height, L };
}

// ---------- fake-PowerPoint selection box ----------
class SelBox {
  constructor() { this.r = null; this.t = null; this.v = 0; this.vt = 0; this.app = 0; }
  set(r, snap) { if (!r) { this.vt = 0; return; } if (!this.r || snap || this.vt === 0) { this.r = { ...r }; this.app = 0; } this.t = { ...r }; this.vt = 1; }
  hide() { this.vt = 0; }
  draw(ctx, dt, k = 1) {
    this.v += (this.vt - this.v) * Math.min(1, dt * 14); this.app = Math.min(1, this.app + dt * 3.2);
    if (!this.r || this.v < .02) return;
    const f = Math.min(1, dt * 16); for (const key of ['x', 'y', 'w', 'h']) this.r[key] += (this.t[key] - this.r[key]) * f;
    const s = E.outBack(this.app), { x, y, w, h } = this.r, cx = x + w / 2, cy = y + h / 2;
    ctx.save(); ctx.globalAlpha = this.v; ctx.translate(cx, cy); ctx.scale(lerp(.92, 1, s), lerp(.92, 1, s)); ctx.translate(-cx, -cy);
    ctx.strokeStyle = '#2b5cff'; ctx.lineWidth = 2.4 * k; ctx.strokeRect(x, y, w, h);
    ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y - 34 * k); ctx.stroke();
    const knob = (px, py, rr) => { ctx.beginPath(); ctx.arc(px, py, rr, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2 * k; ctx.stroke(); };
    knob(cx, y - 40 * k, 8 * k);
    for (const [px, py] of [[x, y], [cx, y], [x + w, y], [x, cy], [x + w, cy], [x, y + h], [cx, y + h], [x + w, y + h]]) knob(px, py, 7 * k);
    ctx.restore();
  }
}

// ---------- word masks (for 3D/particle/chrome treatments) ----------
function wordCanvas(str, font, w = 1024, h = 512, blur = 0) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = h * .78; g.font = font.replace('%s', size);
  const mw = g.measureText(str).width; if (mw > w * .92) { size *= w * .92 / mw; g.font = font.replace('%s', size); }
  if (blur) g.filter = `blur(${blur}px)`;
  g.fillText(str, w / 2, h * .54); return c;
}
function samplePoints(c, n, seed = 1) {
  const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data, pts = [];
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (d[(y * c.width + x) * 4] > 128) pts.push([x / c.width - .5, .5 - y / c.height]);
  const r = prng(seed), out = [];
  for (let i = 0; i < n; i++) out.push(pts[(r() * pts.length) | 0] || [0, 0]);
  return out;
}

// ---------- AUDIO: procedural, just intonation on D1 ----------
const AU = (() => {
  const BASE = 36.7, DEG = [1, 9 / 8, 5 / 4, 11 / 8, 3 / 2, 27 / 16, 15 / 8];
  const note = (d, o = 3) => { const i = ((d % 7) + 7) % 7, oo = o + Math.floor(d / 7); return BASE * DEG[i] * 2 ** oo; };
  let ac = null, master, comp, hall, room, dry, muted = false, lastHit = {}, noiseBuf = null;
  const beds = [];
  function irBuf(sec, damp) {
    const len = ac.sampleRate * sec, b = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len; lp += (Math.random() * 2 - 1 - lp) * (1 - damp * t); d[i] = lp * (1 - t) ** 2.6; } }
    return b;
  }
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -15; comp.knee.value = 10; comp.ratio.value = 5;
    const shaper = ac.createWaveShaper(); const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 1.2); } shaper.curve = curve;
    master = ac.createGain(); master.gain.value = muted ? 0 : .8;
    comp.connect(shaper); shaper.connect(master); master.connect(ac.destination);
    dry = ac.createGain(); dry.connect(comp);
    hall = ac.createConvolver(); hall.buffer = irBuf(4.6, .9); const hg = ac.createGain(); hg.gain.value = .5; hall.connect(hg); hg.connect(comp);
    room = ac.createConvolver(); room.buffer = irBuf(.55, .5); const rg = ac.createGain(); rg.gain.value = .35; room.connect(rg); rg.connect(comp);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    beds.forEach(b => b._start && b._start());
  }
  const out = (g, wet = .3, rv = 'hall') => { g.connect(dry); if (wet > 0) { const w = ac.createGain(); w.gain.value = wet; g.connect(w); w.connect(rv === 'room' ? room : hall); } };
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(1e-4, t + a + d); }
  function osc(type, f, t, dur, peak, a = .005, wet = .3, f2 = null, rv) {
    if (f > 18000) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur); env(g, t, a, peak, dur); o.connect(g); out(g, wet, rv); o.start(t); o.stop(t + a + dur + .05);
  }
  function noise(t, dur, peak, type = 'bandpass', f = 2000, q = 1, f2 = null, wet = .2, a = .003, rv) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = .5 + Math.random();
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ac.createGain(); env(g, t, a, peak, dur); s.connect(fl); fl.connect(g); out(g, wet, rv); s.start(t, Math.random()); s.stop(t + a + dur + .05);
  }
  const HITS = {
    tick: t => noise(t, .02, .25, 'highpass', 5000, .7, null, .05, .001, 'room'),
    click: t => { noise(t, .03, .4, 'bandpass', 3500, 2, null, .1, .001, 'room'); osc('sine', 1800, t, .02, .1, .001, .05); },
    type: t => { noise(t, .035, .35, 'bandpass', 2200 + Math.random() * 1800, 3, null, .08, .001, 'room'); osc('square', 140 + Math.random() * 40, t, .02, .05, .001, 0); },
    select: t => { osc('sine', note(4, 6), t, .22, .12, .004, .3); osc('sine', note(1, 7), t + .06, .3, .1, .004, .3); },
    delete: t => { osc('triangle', note(2, 6), t, .09, .12, .002, .1, note(0, 5)); noise(t, .05, .12, 'highpass', 3000, 1, null, .05); },
    whoosh: t => noise(t, .7, .35, 'bandpass', 300, 1.2, 3500, .35, .25),
    thud: t => { osc('sine', 90, t, .4, .5, .003, .2, 40); noise(t, .12, .2, 'lowpass', 400, 1, null, .1); },
    snap: t => { noise(t, .05, .5, 'highpass', 2500, 1, null, .15, .001); osc('sine', 900, t, .05, .15, .001, .1, 300); },
    riser: t => { noise(t, 2.2, .3, 'bandpass', 200, 3, 5000, .5, 2); osc('sawtooth', note(0, 3), t, 2.2, .05, 2, .4, note(0, 5)); },
    boom: t => { osc('sine', 70, t, 2.6, .9, .005, .4, 26); noise(t, 1.4, .5, 'lowpass', 900, .7, 60, .5, .005); },
    shimmer: t => { [4, 6, 9, 11, 13].forEach((d, i) => osc('sine', note(d, 7), t + i * .05, 1.8, .045, .01, .8)); },
    pop: t => osc('sine', 700, t, .09, .25, .002, .15, 180),
    bell: t => { const f = note([0, 2, 4][Math.floor(Math.random() * 3)], 7); [1, 2.76, 5.4, 8.93].forEach((m, i) => osc('sine', f * m, t, 2.4 / (1 + i), .08 / (1 + i * 1.5), .002, .7)); },
    glass: t => { const f = note(4, 7); [1, 2.32, 4.25].forEach((m, i) => osc('sine', f * m, t, 3 / (1 + i), .05 / (1 + i), .003, .9)); },
    sub: t => osc('sine', 48, t, 2.2, .6, .02, .1, 36),
    domino: (t, v = 0) => { const k = clamp(v); noise(t, .02 + k * .2, .4 + k * .3, 'bandpass', 4200 - k * 3800, 1.4, null, .15 + k * .4, .001); if (k > .25) osc('sine', 160 - k * 110, t, .2 + k * 1.2, .2 + k * .6, .003, .3, 40 - k * 10); },
    paper: t => { for (let i = 0; i < 6; i++) noise(t + i * .03 + Math.random() * .02, .04, .12, 'highpass', 3000 + Math.random() * 3000, 1, null, .1); },
    rise: t => { [0, 4, 7, 9, 11].forEach((d, i) => osc('sine', note(d, 5), t + i * .12, 2.2, .05, .4, .8)); },
    slam: t => { osc('sine', 60, t, 1.2, .9, .002, .3, 30); noise(t, .5, .7, 'lowpass', 2500, .7, 200, .4, .001); },
    flap: t => { for (let i = 0; i < 9; i++) noise(t + i * .045 + Math.random() * .02, .025, .2, 'bandpass', 2600, 2, null, .1, .001, 'room'); },
    wave: t => noise(t, 1.8, .4, 'lowpass', 300, .7, 2200, .5, .5),
  };
  function hit(name, v, delay = 0) {
    if (!ac || muted || !HITS[name]) return;
    const now = ac.currentTime; if (lastHit[name] && now - lastHit[name] < .035) return; lastHit[name] = now;
    try { HITS[name](now + .01 + delay, v); } catch (e) { }
  }
  // Pads: a seamless additive drone per scene, a chord of just-intonation degrees.
  class Bed {
    constructor(o) { this.o = o; this.g = null; this.voices = []; this.level = 0; beds.push(this); }
    _start() {
      if (!ac || this.g) return; const o = this.o;
      this.g = ac.createGain(); this.g.gain.value = 0; this.fl = ac.createBiquadFilter(); this.fl.type = 'lowpass'; this.fl.frequency.value = o.cut || 900; this.fl.Q.value = .4;
      this.fl.connect(this.g); out(this.g, o.wet ?? .6);
      (o.chord || [0, 4, 7]).forEach((d, i) => {
        for (const det of [-1, 1]) {
          const os = ac.createOscillator(); os.type = o.wave || (i ? 'sine' : 'triangle'); os.frequency.value = note(d, o.oct ?? 4) * (1 + det * .0025);
          const vg = ac.createGain(); vg.gain.value = (o.vol || .05) / (1 + i * .4);
          const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .05 + Math.random() * .12; lg.gain.value = vg.gain.value * .6; lfo.connect(lg); lg.connect(vg.gain);
          os.connect(vg); vg.connect(this.fl); os.start(); lfo.start(); this.voices.push(os, lfo);
        }
      });
    }
    set(level, bright) { if (!ac) return; this._start(); const t = ac.currentTime; this.g.gain.cancelScheduledValues(t); this.g.gain.setTargetAtTime(level, t, .6); if (bright != null) this.fl.frequency.setTargetAtTime(bright, t, .8); }
  }
  return {
    init, hit, note, Bed, get ctx() { return ac; },
    get muted() { return muted; },
    mute(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : .8, ac.currentTime, .15); },
  };
})();

const SCENES = [];
export { SCENES, THREE, R, HDR, QS, HEADLESS, QUICK, clamp, lerp, sstep, E, prng, Si, rig, GLSL, FSV, shader, pass, makeRT, grade, bloom, mOverlay, mCopy, V, computeVirtual, text, layout, SelBox, wordCanvas, samplePoints, AU, fsScene, fsCam };
