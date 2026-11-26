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
// Everything is synthesised live: no audio files. Signal flow:
//   voices → dry / hall reverb / room reverb / ping-pong delay → compressor → soft clip → master
// Beds are per-slide soundscapes (pads, choir, sub, noise texture, hum, arpeggio, pulse) that start
// when a slide is entered and are torn down after they fade out, so idle slides cost nothing.
const AU = (() => {
  const BASE = 36.7, DEG = [1, 9 / 8, 5 / 4, 11 / 8, 3 / 2, 27 / 16, 15 / 8];
  const note = (d, o = 3) => { const i = ((d % 7) + 7) % 7, oo = o + Math.floor(d / 7); return BASE * DEG[i] * 2 ** oo; };
  let ac = null, master, comp, hall, room, dry, dly, ana, muted = false, lastHit = {}, noiseBuf = null, brownBuf = null, unlockEl = null, onInit = null, sched = null;
  const beds = new Set();
  // --- iOS: a looping silent <audio> switches the audio session to "playback" so the silent switch doesn't mute Web Audio
  function silentWav() {
    const n = 8000, b = new ArrayBuffer(44 + n), v = new DataView(b), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
  }
  function unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { }
    try { if (!unlockEl) { unlockEl = new Audio(silentWav()); unlockEl.loop = true; unlockEl.setAttribute('playsinline', ''); } if (unlockEl.paused) unlockEl.play().catch(() => { }); } catch (e) { }
  }
  function irBuf(sec, damp) {
    const len = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len; lp += (Math.random() * 2 - 1 - lp) * (1 - damp * t); d[i] = lp * (1 - t) ** 2.6 * (i < 40 ? i / 40 : 1); } }
    return b;
  }
  function init() {
    unlock();
    if (ac) { if (ac.state !== 'running') ac.resume().catch(() => { }); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); } catch (e) { ac = null; return; }
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -15; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = .004; comp.release.value = .2;
    const shaper = ac.createWaveShaper(); const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 1.15); } shaper.curve = curve;
    master = ac.createGain(); master.gain.value = muted ? 0 : .85;
    ana = ac.createAnalyser(); ana.fftSize = 1024;
    comp.connect(shaper); shaper.connect(master); master.connect(ac.destination); master.connect(ana);
    dry = ac.createGain(); dry.connect(comp);
    hall = ac.createConvolver(); hall.buffer = irBuf(4.6, .9); const hg = ac.createGain(); hg.gain.value = .5; hall.connect(hg); hg.connect(comp);
    room = ac.createConvolver(); room.buffer = irBuf(.55, .5); const rg = ac.createGain(); rg.gain.value = .35; room.connect(rg); rg.connect(comp);
    // ping-pong delay (dotted eighth at ~92 bpm), darkened in the feedback loop
    dly = ac.createGain(); const dl = ac.createDelay(2), drr = ac.createDelay(2), fb = ac.createGain(), lp = ac.createBiquadFilter(), pl = ac.createStereoPanner(), pr = ac.createStereoPanner();
    dl.delayTime.value = .49; drr.delayTime.value = .49; fb.gain.value = .38; lp.type = 'lowpass'; lp.frequency.value = 2800; pl.pan.value = -.7; pr.pan.value = .7;
    dly.connect(dl); dl.connect(lp); lp.connect(drr); drr.connect(fb); fb.connect(dl); dl.connect(pl); drr.connect(pr); pl.connect(comp); pr.connect(comp);
    const sr = ac.sampleRate;
    noiseBuf = ac.createBuffer(1, sr * 2, sr); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    brownBuf = ac.createBuffer(1, sr * 4, sr); const bd = brownBuf.getChannelData(0); let last = 0; for (let i = 0; i < bd.length; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    sched = setInterval(tick, 40);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && ac && ac.state !== 'running') ac.resume().catch(() => { }); });
    if (onInit) try { onInit(); } catch (e) { }
  }
  // ---------- routing + primitive voices ----------
  const out = (g, wet = .3, rv = 'hall', delay = 0, pan = 0) => {
    let node = g; if (pan) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    node.connect(dry);
    if (wet > 0) { const w = ac.createGain(); w.gain.value = wet; node.connect(w); w.connect(rv === 'room' ? room : hall); }
    if (delay > 0) { const d = ac.createGain(); d.gain.value = delay; node.connect(d); d.connect(dly); }
  };
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(1e-4, t + a + d); }
  function osc(type, f, t, dur, peak, a = .005, wet = .3, f2 = null, rv, delay = 0, pan = 0) {
    if (f > 18000 || f <= 0) return;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + a + dur);
    env(g, t, a, peak, dur); o.connect(g); out(g, wet, rv, delay, pan); o.start(t); o.stop(t + a + dur + .05);
  }
  function noise(t, dur, peak, type = 'bandpass', f = 2000, q = 1, f2 = null, wet = .2, a = .003, rv, buf, delay = 0, pan = 0) {
    const s = ac.createBufferSource(); s.buffer = buf || noiseBuf; s.playbackRate.value = .6 + Math.random() * .8;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + dur);
    const g = ac.createGain(); env(g, t, a, peak, dur); s.connect(fl); fl.connect(g); out(g, wet, rv, delay, pan); s.start(t, Math.random() * .5); s.stop(t + a + dur + .05);
  }
  function fm(f, ratio, index, t, dur, peak, wet = .5, delay = .2, pan = 0) {
    if (f > 16000) return;
    const c = ac.createOscillator(), m = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
    c.frequency.value = f; m.frequency.value = Math.min(f * ratio, 18000); mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(f * index * .02 + 1, t + dur);
    m.connect(mg); mg.connect(c.frequency); c.connect(g); env(g, t, .002, peak, dur); out(g, wet, 'hall', delay, pan);
    c.start(t); m.start(t); c.stop(t + dur + .1); m.stop(t + dur + .1);
  }
  function pluck(f, t, dur, peak, wet = .35, delay = .25, pan = 0) {
    if (f > 12000) return;
    const g = ac.createGain(), fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 2; fl.frequency.setValueAtTime(Math.min(f * 8, 18000), t); fl.frequency.exponentialRampToValueAtTime(f * 1.2, t + dur * .6);
    for (const [ty, det, v] of [['triangle', 1, 1], ['sine', 2, .35], ['triangle', 1.003, .6]]) { if (f * det > 18000) continue; const o = ac.createOscillator(); o.type = ty; o.frequency.value = f * det; const og = ac.createGain(); og.gain.value = v; o.connect(og); og.connect(fl); o.start(t); o.stop(t + dur + .1); }
    fl.connect(g); env(g, t, .003, peak, dur); out(g, wet, 'hall', delay, pan);
  }
  // ---------- the sound library ----------
  const R_ = () => Math.random();
  const HITS = {
    tick: t => noise(t, .02, .25, 'highpass', 5000, .7, null, .05, .001, 'room'),
    click: t => { noise(t, .03, .4, 'bandpass', 3500, 2, null, .1, .001, 'room'); osc('sine', 1800, t, .02, .1, .001, .05); },
    type: t => { noise(t, .035, .35, 'bandpass', 2200 + R_() * 1800, 3, null, .08, .001, 'room'); osc('square', 140 + R_() * 40, t, .02, .05, .001, 0); },
    select: t => { osc('sine', note(4, 6), t, .22, .12, .004, .3); osc('sine', note(1, 7), t + .06, .3, .1, .004, .3); },
    delete: t => { osc('triangle', note(2, 6), t, .09, .12, .002, .1, note(0, 5)); noise(t, .05, .12, 'highpass', 3000, 1, null, .05); },
    whoosh: t => { noise(t, .8, .4, 'bandpass', 250, 1.3, 4200, .4, .3); noise(t + .05, .7, .15, 'highpass', 3000, .7, 9000, .3, .35, 'hall', null, 0, .4); },
    thud: t => { osc('sine', 90, t, .4, .5, .003, .2, 40); noise(t, .12, .2, 'lowpass', 400, 1, null, .1); },
    snap: t => { noise(t, .05, .5, 'highpass', 2500, 1, null, .15, .001); osc('sine', 900, t, .05, .15, .001, .1, 300); },
    riser: t => { noise(t, 2.4, .32, 'bandpass', 200, 3, 6000, .5, 2.2); osc('sawtooth', note(0, 3), t, 2.4, .05, 2.2, .4, note(0, 5)); osc('sawtooth', note(4, 3), t, 2.4, .035, 2.2, .4, note(4, 5)); },
    boom: t => { osc('sine', 70, t, 2.8, .95, .005, .4, 24); osc('triangle', 140, t, .6, .3, .002, .3, 40); noise(t, 1.6, .55, 'lowpass', 1100, .7, 50, .55, .004, 'hall', brownBuf); },
    shimmer: t => { [4, 6, 9, 11, 13, 16].forEach((d, i) => fm(note(d, 6), 2, .8, t + i * .055, 2.2, .035, .8, .35, (i % 2 ? .5 : -.5))); },
    pop: t => osc('sine', 700, t, .09, .25, .002, .15, 180),
    bell: t => { const f = note([0, 2, 4][Math.floor(R_() * 3)], 6); fm(f, 3.5, 2.2, t, 3.2, .09, .7, .3); fm(f * 2, 1.41, 1, t, 2, .03, .7, .2); },
    glass: t => { const f = note(4, 7); [1, 2.32, 4.25].forEach((m, i) => osc('sine', f * m, t, 3 / (1 + i), .05 / (1 + i), .003, .9, null, 'hall', .3)); },
    sub: t => osc('sine', 48, t, 2.4, .65, .02, .1, 34),
    domino: (t, v = 0) => { const k = Math.min(1, Math.max(0, v)); noise(t, .02 + k * .2, .45 + k * .3, 'bandpass', 4200 - k * 3800, 1.4, null, .15 + k * .4, .001); osc('triangle', 900 - k * 760, t, .05 + k * .1, .08, .001, .2); if (k > .25) osc('sine', 160 - k * 110, t, .25 + k * 1.4, .25 + k * .65, .003, .35, 38 - k * 10); },
    paper: t => { for (let i = 0; i < 7; i++) noise(t + i * .028 + R_() * .02, .045, .12, 'highpass', 2600 + R_() * 3400, 1, null, .1); },
    rise: t => { [0, 4, 7, 9, 11, 14].forEach((d, i) => osc('sine', note(d, 5), t + i * .12, 2.4, .045, .4, .8, null, 'hall', .25, i % 2 ? .4 : -.4)); },
    slam: t => { osc('sine', 60, t, 1.3, .95, .002, .3, 28); noise(t, .6, .75, 'lowpass', 2600, .7, 180, .45, .001); noise(t, .08, .5, 'highpass', 3000, 1, null, .2, .001); },
    flap: t => { for (let i = 0; i < 14; i++) noise(t + i * .04 + R_() * .02, .025, .22, 'bandpass', 2200 + R_() * 900, 2.2, null, .1, .001, 'room', null, 0, (R_() - .5) * 1.4); },
    wave: t => noise(t, 1.9, .42, 'lowpass', 280, .7, 2400, .55, .55, 'hall', brownBuf),
    // --- new designed sounds
    glitch: t => { for (let i = 0; i < 16; i++) { const tt = t + i * .022 + R_() * .01; osc('square', 80 + R_() * 2400, tt, .018 + R_() * .02, .07, .001, .05, null, 'room', 0, (R_() - .5) * 1.6); if (R_() < .3) noise(tt, .02, .2, 'highpass', 6000, 1, null, 0, .001); } osc('sawtooth', 55, t, .25, .25, .001, .1, 30); },
    shatter: t => { noise(t, .35, .55, 'highpass', 2500, .7, 9000, .4, .001); for (let i = 0; i < 26; i++) fm(2200 + R_() * 5200, 1.53 + R_(), 1.5, t + R_() * .5 * (i / 26), .25 + R_() * .7, .035, .6, .25, (R_() - .5) * 1.8); osc('sine', 75, t, .8, .5, .002, .3, 35); },
    ink: t => { noise(t, 2.2, .35, 'lowpass', 120, 2, 900, .7, 1.2, 'hall', brownBuf); osc('sine', note(0, 2), t, 2.2, .28, .9, .4, note(0, 2) * .7); fm(note(4, 5), 1.5, .6, t + .6, 2.4, .04, .9, .4); },
    kaleido: t => { for (let i = 0; i < 10; i++) fm(note([0, 2, 4, 7, 9][i % 5], 5 + Math.floor(i / 5)), 2, 1, t + i * .07, 1.6, .04, .8, .45, Math.sin(i) * .8); noise(t, 1.2, .18, 'bandpass', 800, 4, 6000, .6, .6); },
    zoom: t => { noise(t, 1.2, .5, 'bandpass', 180, 1.5, 7000, .4, .9); osc('sawtooth', 60, t, 1.2, .08, .9, .3, 600); osc('sine', 55, t + 1.05, 1.6, .6, .004, .3, 30); },
    tear: t => { for (let i = 0; i < 40; i++) noise(t + i * .022 * (1 + R_() * .3), .03 + R_() * .03, .18 + R_() * .2, 'bandpass', 1500 + R_() * 3500, 1.5, null, .08, .001, 'room', null, 0, -.6 + i / 40 * 1.2); },
    twang: t => { [0, 7].forEach((d, i) => osc('sawtooth', note(d, 3), t, 2.4, .12, .002, .4, note(d, 3) * .985, 'hall', .2)); noise(t, .06, .3, 'bandpass', 1800, 3, null, .2, .001); },
    sortdown: t => { for (let i = 0; i < 22; i++) osc('square', 3200 * Math.pow(.86, i), t + i * .045, .04, .06, .001, .1, null, 'room', .25, (i % 2 ? .5 : -.5)); },
    sparkle: t => { for (let i = 0; i < 12; i++) fm(note([4, 7, 9, 11, 14][i % 5], 6), 3, .5, t + R_() * .9, .5, .03, .8, .4, (R_() - .5) * 1.6); },
    choir: t => { [0, 4, 7, 11, 14].forEach((d, i) => vowel(note(d, 3), t + i * .08, 3.2, .05)); },
    thunder: t => { noise(t, .12, .7, 'highpass', 1200, .7, null, .3, .001); noise(t + .05, 3.2, .7, 'lowpass', 500, .8, 60, .7, .02, 'hall', brownBuf); osc('sine', 45, t + .05, 2.4, .45, .01, .4, 28); },
    crackle: t => { for (let i = 0; i < 9; i++) noise(t + R_() * .6, .006 + R_() * .01, .3 + R_() * .3, 'highpass', 1500 + R_() * 4000, .7, null, .1, .0005, 'room', null, 0, (R_() - .5)); },
    stamp: t => { osc('sine', 110, t, .35, .9, .001, .25, 45); noise(t, .09, .6, 'bandpass', 900, 1, null, .25, .001); noise(t + .002, .04, .4, 'highpass', 4000, 1, null, .1, .001); },
    scratch: t => noise(t, .07 + R_() * .05, .07, 'bandpass', 3000 + R_() * 2500, 6, null, .05, .01, 'room'),
    chirp: (t, v = 1) => { const f = 2600 + R_() * 2200, p = (R_() - .5) * 1.6; for (let i = 0; i < 2 + Math.floor(R_() * 3); i++) osc('sine', f * (1 + R_() * .2), t + i * .09, .06, .05 * v, .005, .5, f * (1.3 + R_() * .4), 'hall', .1, p); },
    bleep: (t, v = 1) => { const f = note(Math.floor(R_() * 7), 6); osc('square', f, t, .07, .03 * v, .002, .2, null, 'room', .35, (R_() - .5) * 1.4); },
    heart: t => { [0, .22].forEach((d, i) => osc('sine', 62, t + d, .22, i ? .45 : .7, .004, .15, 38)); },
    tapestop: t => { osc('sawtooth', note(0, 4), t, 1.1, .1, .01, .3, 25); noise(t, 1.1, .2, 'lowpass', 3000, 1, 80, .3, .05); },
    zap: t => { osc('sawtooth', 2400, t, .18, .12, .001, .2, 90); noise(t, .12, .3, 'highpass', 5000, 1, null, .2, .001); },
    ding: t => { fm(note(4, 6), 3.01, 1.2, t, 1.6, .08, .5, .25); },
    cricket: t => { const f = 4200 + R_() * 600, p = (R_() - .5) * 1.4; for (let i = 0; i < 4; i++) osc('sine', f, t + i * .032, .016, .018, .002, .25, null, 'hall', 0, p); },
    clangHit: t => clang(t, note(0, 4), .14),
    stomp: t => { osc('sine', 52, t, .5, .8, .002, .2, 32); noise(t, .2, .3, 'lowpass', 600, 1, 90, .2, .001); },
  };
  function vowel(f, t, dur, peak, pan = 0) {
    if (!ac) return;
    const o = ac.createOscillator(), o2 = ac.createOscillator(); o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f * 1.004;
    const sum = ac.createGain(); sum.gain.value = .5; o.connect(sum); o2.connect(sum);
    const g = ac.createGain();
    [[700, 8, 1], [1220, 10, .55], [2600, 12, .3]].forEach(([ff, q, v]) => { const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = ff; b.Q.value = q; const bg = ac.createGain(); bg.gain.value = v * 3; sum.connect(b); b.connect(bg); bg.connect(g); });
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + dur * .35); g.gain.linearRampToValueAtTime(0, t + dur);
    out(g, .9, 'hall', .1, pan); o.start(t); o2.start(t); o.stop(t + dur + .1); o2.stop(t + dur + .1);
  }
  // ---------- futuristic transition kit ----------
  // Building blocks, scheduled against a transition's duration so each sound peaks with its visual climax.
  function revSwell(t, dur, peak, f0 = 400, f1 = 7000, pan = 0) { // reverse-cymbal style swell that cuts at t+dur
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 1.2;
    fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(1e-4, t); g.gain.exponentialRampToValueAtTime(peak, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + .04);
    s.connect(fl); fl.connect(g); out(g, .35, 'hall', .15, pan); s.start(t); s.stop(t + dur + .1);
  }
  function sweepSaw(t, dur, f0, f1, peak, q = 9, c0 = 300, c1 = 6000, wet = .4) { // resonant synth riser / faller
    const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = q; fl.frequency.setValueAtTime(c0, t); fl.frequency.exponentialRampToValueAtTime(c1, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(1e-4, t); g.gain.exponentialRampToValueAtTime(peak, t + dur * .85); g.gain.exponentialRampToValueAtTime(1e-4, t + dur + .25);
    for (const det of [1, 1.006, .497]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * det, t); o.frequency.exponentialRampToValueAtTime(f1 * det, t + dur); o.connect(fl); o.start(t); o.stop(t + dur + .3); }
    fl.connect(g); out(g, wet, 'hall', .25);
  }
  function laser(t, dur, f0, f1, peak, pan = 0) { // charging / discharging energy tone with accelerating tremolo
    const o = ac.createOscillator(), g = ac.createGain(), tr = ac.createOscillator(), tg = ac.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    tr.frequency.setValueAtTime(6, t); tr.frequency.exponentialRampToValueAtTime(40, t + dur); tg.gain.value = peak * .5;
    g.gain.setValueAtTime(1e-4, t); g.gain.exponentialRampToValueAtTime(peak, t + dur * .9); g.gain.exponentialRampToValueAtTime(1e-4, t + dur + .08);
    tr.connect(tg); tg.connect(g.gain); o.connect(g); out(g, .3, 'hall', .3, pan); o.start(t); tr.start(t); o.stop(t + dur + .1); tr.stop(t + dur + .1);
  }
  function clang(t, f, peak) { fm(f, 1.414, 4, t, 1.6, peak, .6, .3); fm(f * 2.76, 1.7, 2, t, 1.1, peak * .5, .6, .3, .3); noise(t, .05, peak * 1.5, 'highpass', 4000, 1, null, .2, .001); }
  function subDrop(t, peak = .8, f0 = 130, f1 = 28, dur = 1.1) { osc('sine', f0, t, dur, peak, .004, .2, f1); osc('triangle', f0 * 2, t, .25, peak * .3, .002, .2, f1 * 2); }
  function chatter(t, dur, n, peak = .05, lo = 600, hi = 4000) { for (let i = 0; i < n; i++) { const tt = t + Math.random() * dur, f = lo * Math.pow(hi / lo, Math.random()); osc(Math.random() < .5 ? 'square' : 'sine', f, tt, .015 + Math.random() * .04, peak, .001, .15, Math.random() < .3 ? f * 1.5 : null, 'room', .25, (Math.random() - .5) * 1.8); } }
  function jet(t, dur, peak, up = true) { // flanger sweep: noise through a short feedback delay whose time glides
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const d = ac.createDelay(.05), fb = ac.createGain(), g = ac.createGain(), hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
    d.delayTime.setValueAtTime(up ? .012 : .0008, t); d.delayTime.exponentialRampToValueAtTime(up ? .0008 : .012, t + dur); fb.gain.value = .82;
    s.connect(hp); hp.connect(d); d.connect(fb); fb.connect(d); hp.connect(g); d.connect(g);
    g.gain.setValueAtTime(1e-4, t); g.gain.exponentialRampToValueAtTime(peak, t + dur * .5); g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    out(g, .3, 'hall', .1); s.start(t); s.stop(t + dur + .05);
  }
  function sonar(t, f, peak) { osc('sine', f, t, 1.4, peak, .004, .5, f * .98, 'hall', .55); osc('sine', f * 2.01, t, .4, peak * .3, .002, .5, null, 'hall', .4); }
  function servo(t, dur, peak) { const o = ac.createOscillator(), l = ac.createOscillator(), lg = ac.createGain(), bp = ac.createBiquadFilter(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(140, t + dur);
    l.frequency.value = 9; lg.gain.value = 25; l.connect(lg); lg.connect(o.frequency); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 3;
    g.gain.setValueAtTime(1e-4, t); g.gain.linearRampToValueAtTime(peak, t + .08); g.gain.setValueAtTime(peak, t + dur - .1); g.gain.linearRampToValueAtTime(1e-4, t + dur);
    o.connect(bp); bp.connect(g); out(g, .15, 'room'); o.start(t); l.start(t); o.stop(t + dur + .05); l.stop(t + dur + .05); }
  let crushCurve = null;
  function crush(t, dur, peak, f = 300) { // bit-crushed square burst
    if (!crushCurve) { crushCurve = new Float32Array(256); for (let i = 0; i < 256; i++) crushCurve[i] = Math.round((i / 127.5 - 1) * 3) / 3; }
    const o = ac.createOscillator(), ws = ac.createWaveShaper(), g = ac.createGain(); o.type = 'square'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * .25, t + dur); ws.curve = crushCurve;
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(1e-4, t + dur); o.connect(ws); ws.connect(g); out(g, .15, 'room', .2); o.start(t); o.stop(t + dur + .05);
    noise(t, dur * .6, peak * .8, 'bandpass', 2400, 2, 400, .1, .001);
  }
  function stutter(t, f, n, gap, peak) { for (let i = 0; i < n; i++) osc('square', f * (1 + (i % 3) * .5), t + i * gap, gap * .6, peak, .001, .1, null, 'room', .2, (i % 2 ? .6 : -.6)); }
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const TR = {
    portal: (t, d) => { revSwell(t, d * .55, .5); sweepSaw(t, d * .55, note(0, 2), note(0, 4), .07); subDrop(t + d * .55, .9); fm(note(pick([4, 7, 9]), 6), 2, 1.5, t + d * .55, 2, .05, .9, .45); chatter(t + d * .55, .6, 10, .03, 2000, 7000); },
    line: (t, d) => { laser(t, d * .48, 180, 2600, .12); jet(t, d * .5, .18, true); clang(t + d * .5, note(pick([0, 4]), 4), .12); osc('sine', 3000, t + d * .5, d * .5, .06, .002, .4, 120); subDrop(t + d * .52, .55, 90, 30, .8); },
    flaps: (t, d) => { servo(t, d * .9, .15); sweepSaw(t, d * .7, note(0, 3), note(4, 4), .06, 10); for (let i = 0; i < 26; i++) noise(t + d * .1 + (i / 26) * d * .75 + Math.random() * .02, .02, .34, 'bandpass', 1800 + Math.random() * 1600, 3, null, .1, .001, 'room', null, 0, -.8 + (i / 26) * 1.6); chatter(t, d, 18, .05, 1200, 5000); ding2(t + d * .92); subDrop(t + d * .9, .4, 100, 40, .6); },
    wash: (t, d) => { jet(t, d * .9, .25, false); noise(t, d, .35, 'lowpass', 250, .8, 3000, .5, d * .4, 'hall', brownBuf); fm(note(2, 5), 1.5, .8, t + d * .5, 2, .04, .9, .4); },
    slam: (t, d) => { const c = d * .285; revSwell(t, c, .6, 300, 9000); sweepSaw(t, c, note(0, 3), note(0, 5), .08, 12); clang(t + c, note(pick([0, 2]), 3), .18); subDrop(t + c, 1, 140, 26, 1.3); crush(t + c, .35, .12, 220); noise(t + c, 1.2, .25, 'highpass', 6000, .7, 2000, .6, .001); },
    daybreak: (t, d) => { [0, 4, 7, 11, 14].forEach((dg, i) => fm(note(dg, 4), 1, .6, t + i * .18, d * .9, .04, .9, .35, Math.sin(i * 1.7) * .7)); revSwell(t, d * .5, .25, 800, 9000); sonar(t + d * .5, note(7, 6), .07); vowel(note(0, 3), t + d * .3, d, .05); vowel(note(7, 3), t + d * .35, d, .04, .4); },
    dissolve: (t, d) => { chatter(t, d * .9, 40, .03, 300, 9000); const lp = 1; noise(t, d, .15, 'lowpass', 400, 4, 9000, .4, d * .5); sonar(t + d * .85, note(4, 6), .05); },
    tear: (t, d) => { for (let i = 0; i < 46; i++) noise(t + d * .15 + i * .022 * (1 + Math.random() * .3), .025 + Math.random() * .03, .16 + Math.random() * .18, 'bandpass', 1500 + Math.random() * 3500, 1.5, null, .08, .001, 'room', null, 0, -.7 + i / 46 * 1.4); sweepSaw(t, d * .6, note(0, 4), note(0, 2), .09, 14, 6000, 300); laser(t, d * .4, 300, 2400, .07); subDrop(t + d * .6, .7); clang(t + d * .6, note(4, 4), .08); },
    radial: (t, d) => { sonar(t, note(4, 5), .09); jet(t, d, .2, true); chatter(t + d * .3, d * .6, 12, .03); },
    glitch: (t, d) => { crush(t, .18, .16, 440); stutter(t + .12, note(pick([0, 4, 7]), 5), 9, .045, .06); chatter(t, d * .8, 34, .05, 200, 8000); crush(t + d * .55, .25, .14, 160); osc('sawtooth', 1200, t + d * .5, .35, .08, .002, .2, 60); },
    shatter: (t, d) => { revSwell(t, d * .12 + .15, .45, 1000, 9000); const c = t + d * .12 + .15; noise(c, .4, .55, 'highpass', 2500, .7, 9000, .4, .001); for (let i = 0; i < 30; i++) fm(2400 + Math.random() * 5600, 1.53 + Math.random(), 1.5, c + Math.random() * d * .6, .2 + Math.random() * .6, .03, .6, .3, (Math.random() - .5) * 1.8); subDrop(c, .8, 110, 30, 1.2); laser(c + .1, d * .6, 3000, 150, .05); },
    ink: (t, d) => { subDrop(t, .5, 70, 30, d); noise(t, d, .35, 'lowpass', 120, 2, 1200, .7, d * .5, 'hall', brownBuf); for (let i = 0; i < 12; i++) { const tt = t + d * .2 + Math.random() * d * .7, f = 300 + Math.random() * 900; osc('sine', f, tt, .12, .05, .004, .5, f * .4, 'hall', .3, (Math.random() - .5) * 1.4); } fm(note(4, 5), 1.5, .6, t + d * .55, 2.2, .04, .9, .4); },
    kaleido: (t, d) => { for (let i = 0; i < 14; i++) fm(note([0, 2, 4, 7, 9, 11][i % 6], 5 + Math.floor(i / 6)), 2.01, 1.1, t + i * d / 18, 1.4, .035, .8, .45, Math.sin(i * .9) * .9); jet(t, d, .16, true); sweepSaw(t, d * .5, note(0, 3), note(7, 4), .05, 8); },
    zoomblur: (t, d) => { sweepSaw(t, d * .6, 55, 880, .1, 10, 200, 9000); laser(t, d * .6, 120, 4000, .07); revSwell(t, d * .6, .5, 200, 8000); subDrop(t + d * .6, 1, 150, 25, 1.4); chatter(t + d * .6, .5, 12, .03, 3000, 9000); },
    pixelsort: (t, d) => { for (let i = 0; i < 26; i++) osc('square', 3600 * Math.pow(.87, i), t + i * d / 30, .035, .085, .001, .1, null, 'room', .25, (i % 2 ? .5 : -.5)); servo(t, d * .8, .1); crush(t + d * .75, .3, .16, 120); subDrop(t + d * .75, .6); },
    fade: (t, d) => { revSwell(t, d * .7, .2, 600, 5000); sonar(t + d * .7, note(4, 6), .05); },
  };
  function ding2(t) { fm(note(4, 6), 3.01, 1.2, t, 1.2, .05, .5, .25); }
  function trans(id, dur, rev) {
    if (!ac || muted || ac.state !== 'running' || !TR[id]) return;
    try { TR[id](ac.currentTime + .02, Math.max(.4, dur)); } catch (e) { }
  }
  function hit(name, v, delay = 0) {
    if (!ac || muted || !HITS[name] || ac.state !== 'running') return;
    const now = ac.currentTime; if (lastHit[name] && now - lastHit[name] < .035) return; lastHit[name] = now;
    try { HITS[name](now + .01 + delay, v); } catch (e) { }
  }
  // ---------- beds: per-slide soundscapes ----------
  class Bed {
    constructor(o) { this.o = o; this.nodes = null; this.level = 0; this.params = {}; this.nextArp = 0; this.nextPulse = 0; this.step = 0; this.killT = null; }
    _build() {
      const o = this.o, n = { stops: [], g: ac.createGain() }; n.g.gain.value = 0;
      n.fl = ac.createBiquadFilter(); n.fl.type = 'lowpass'; n.fl.frequency.value = o.cut || 900; n.fl.Q.value = .5; n.fl.connect(n.g); out(n.g, o.wet ?? .6, 'hall', o.delay || 0);
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .07; lg.gain.value = (o.cut || 900) * .35; lfo.connect(lg); lg.connect(n.fl.frequency); lfo.start(); n.stops.push(lfo);
      (o.chord || [0, 4, 7]).forEach((d, i) => {
        for (const det of [-1, 1]) {
          const os = ac.createOscillator(); os.type = o.wave || (i ? 'sine' : 'triangle'); os.frequency.value = note(d, o.oct ?? 4) * (1 + det * .0028);
          const vg = ac.createGain(); vg.gain.value = (o.vol || .05) / (1 + i * .4);
          const tr = ac.createOscillator(), tg = ac.createGain(); tr.frequency.value = .05 + Math.random() * .15; tg.gain.value = vg.gain.value * .5; tr.connect(tg); tg.connect(vg.gain);
          os.connect(vg); vg.connect(n.fl); os.start(); tr.start(); n.stops.push(os, tr);
        }
      });
      if (o.sub) { const s = ac.createOscillator(); s.frequency.value = note(o.chord?.[0] || 0, (o.oct ?? 4) - 2); const sg = ac.createGain(); sg.gain.value = o.sub; s.connect(sg); sg.connect(n.g); s.start(); n.stops.push(s); }
      if (o.choir) {
        n.choir = ac.createGain(); n.choir.gain.value = o.choir; n.choir.connect(n.g);
        (o.chord || [0, 4, 7]).slice(0, 3).forEach(d => { const f = note(d, (o.oct ?? 4)); const os = ac.createOscillator(); os.type = 'sawtooth'; os.frequency.value = f; const vib = ac.createOscillator(), vg = ac.createGain(); vib.frequency.value = 4.6 + Math.random(); vg.gain.value = f * .006; vib.connect(vg); vg.connect(os.frequency);
          [[700, 9, 1], [1150, 11, .5], [2500, 12, .25]].forEach(([ff, q, v]) => { const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = ff; b.Q.value = q; const bg = ac.createGain(); bg.gain.value = v * .5; os.connect(b); b.connect(bg); bg.connect(n.choir); });
          os.start(); vib.start(); n.stops.push(os, vib); });
      }
      if (o.noise) {
        const s = ac.createBufferSource(); s.buffer = o.noise.brown ? brownBuf : noiseBuf; s.loop = true; const f = ac.createBiquadFilter(); f.type = o.noise.type || 'bandpass'; f.frequency.value = o.noise.freq || 600; f.Q.value = o.noise.q || .8;
        const ng = ac.createGain(); ng.gain.value = o.noise.vol || .05; const wl = ac.createOscillator(), wg = ac.createGain(); wl.frequency.value = o.noise.wobble || .11; wg.gain.value = (o.noise.freq || 600) * .5; wl.connect(wg); wg.connect(f.frequency);
        s.connect(f); f.connect(ng); ng.connect(n.g); s.start(); wl.start(); n.stops.push(s, wl); n.noiseF = f; n.noiseG = ng;
      }
      if (o.hum) { [60, 120, 180, 300].forEach((hz, i) => { const h = ac.createOscillator(); h.type = i ? 'sine' : 'sawtooth'; h.frequency.value = hz; const hg = ac.createGain(); hg.gain.value = o.hum / (1 + i * 1.5); h.connect(hg); hg.connect(n.g); h.start(); n.stops.push(h); }); }
      this.nodes = n; this.nextArp = ac.currentTime + .1; this.nextPulse = ac.currentTime + .1;
    }
    set(level, bright, tc) {
      this.level = level; if (!ac) return;
      if (this.killT) { clearTimeout(this.killT); this.killT = null; }
      if (level > 0 && !this.nodes) { this._build(); beds.add(this); }
      if (!this.nodes) return;
      const t = ac.currentTime; this.nodes.g.gain.cancelScheduledValues(t); this.nodes.g.gain.setTargetAtTime(level, t, tc ?? (level > 0 ? .6 : .5));
      if (bright != null) this.nodes.fl.frequency.setTargetAtTime(bright, t, .8);
      if (level <= 0) this.killT = setTimeout(() => this._kill(), 4000);
    }
    _kill() { if (!this.nodes || this.level > 0) return; this.nodes.stops.forEach(s => { try { s.stop(); } catch (e) { } }); try { this.nodes.g.disconnect(); } catch (e) { } this.nodes = null; beds.delete(this); }
    param(name, v) { this.params[name] = v; if (!this.nodes || !ac) return; const t = ac.currentTime;
      if (name === 'cut') this.nodes.fl.frequency.setTargetAtTime(v, t, .3);
      if (name === 'noise' && this.nodes.noiseG) this.nodes.noiseG.gain.setTargetAtTime(v, t, .3);
      if (name === 'noiseFreq' && this.nodes.noiseF) this.nodes.noiseF.frequency.setTargetAtTime(v, t, .3);
      if (name === 'choir' && this.nodes.choir) this.nodes.choir.gain.setTargetAtTime(v, t, .8); }
    _sched(now) {
      if (!this.nodes || this.level < .02 || muted) return;
      const o = this.o, ahead = now + .25;
      if (o.arp) {
        const rate = (this.params.arpRate ?? o.arp.rate ?? 4); if (rate > 0) {
          if (this.nextArp < now) this.nextArp = now + .02;
          while (this.nextArp < ahead) {
            const seq = o.arp.notes, d = seq[this.step % seq.length], f = note(d, (o.arp.oct ?? 5) + (o.arp.up && (this.step % (seq.length * 2) >= seq.length) ? 1 : 0)), v = (o.arp.vol ?? .05) * Math.min(1, this.level * 1.6) * (this.params.arpVol ?? 1), pan = Math.sin(this.step * .9) * .5;
            const voice = o.arp.voice || 'pluck';
            if (voice === 'pluck') pluck(f, this.nextArp, o.arp.len || .5, v, .3, o.arp.delay ?? .3, pan);
            else if (voice === 'fm') fm(f, o.arp.ratio || 2, o.arp.index || 1, this.nextArp, o.arp.len || .8, v, .6, o.arp.delay ?? .3, pan);
            else osc(voice, f, this.nextArp, o.arp.len || .12, v, .003, .25, null, 'room', o.arp.delay ?? .35, pan);
            this.step++; this.nextArp += (1 / rate) * (o.arp.swing && this.step % 2 ? 1 + o.arp.swing : o.arp.swing ? 1 - o.arp.swing : 1);
          }
        }
      }
      if (o.pulse) {
        const rate = this.params.pulseRate ?? o.pulse.rate ?? 1; if (rate > 0) {
          if (this.nextPulse < now) this.nextPulse = now + .02;
          while (this.nextPulse < ahead) { const v = (o.pulse.vol ?? .4) * Math.min(1, this.level * 1.5); const kind = o.pulse.kind || 'heart';
            if (kind === 'heart') [0, .2].forEach((dd, i) => osc('sine', 62, this.nextPulse + dd, .22, v * (i ? .6 : 1), .004, .15, 38));
            else if (kind === 'tick') noise(this.nextPulse, .02, v, 'highpass', 5000, .7, null, .05, .001, 'room');
            else if (kind === 'kick') osc('sine', 58, this.nextPulse, .35, v, .002, .1, 32);
            this.nextPulse += 1 / rate; }
        }
      }
    }
  }
  function tick() { if (!ac || ac.state !== 'running') return; const now = ac.currentTime; beds.forEach(b => b._sched(now)); }
  function level() { if (!ana) return 0; const a = new Float32Array(ana.fftSize); ana.getFloatTimeDomainData(a); let s = 0; for (const x of a) s += x * x; return Math.sqrt(s / a.length); }
  return {
    init, hit, trans, note, Bed, level, get ctx() { return ac; }, set onInit(f) { onInit = f; },
    get muted() { return muted; },
    mute(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : .85, ac.currentTime, .15); },
  };
})();

const SCENES = [];
export { SCENES, THREE, R, HDR, QS, HEADLESS, QUICK, clamp, lerp, sstep, E, prng, Si, rig, GLSL, FSV, shader, pass, makeRT, grade, bloom, mOverlay, mCopy, V, computeVirtual, text, layout, SelBox, wordCanvas, samplePoints, AU, fsScene, fsCam };
