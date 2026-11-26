// =====================================================================
// 08 · INTRO — cold open. A singularity bends the starlight around it,
// detonates, and sixty thousand particles fly out on curling paths before
// assembling into the title. Then: "But first, a slide."
// =====================================================================
import { SCENES, THREE, R, clamp, lerp, E, prng, shader, pass, V, text, samplePoints, AU } from './00-core.js';

{
  const SMALL = Math.min(innerWidth, innerHeight) < 700;
  const N = SMALL ? 26000 : 64000;
  let scene3, cam, pts, pm, bg, titleReady = false;
  function titleCanvas() {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 1024; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 2048, 1024); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 250; g.font = `800 ${size}px Unbounded, Arial Black, sans-serif`;
    const w = g.measureText('INTELLIGENCE').width; if (w > 1900) { size *= 1900 / w; g.font = `800 ${size}px Unbounded, Arial Black, sans-serif`; }
    g.fillText('THE', 1024, 512 - size * 1.15); g.fillText('INTELLIGENCE', 1024, 512); g.fillText('EXPLOSION', 1024, 512 + size * 1.15);
    return c;
  }
  SCENES.push({
    id: 'intro', title: 'Cold open', enterWith: 'fade', hud: { hidden: true },
    beats: [{ dur: 4.5, hold: 2 }, { dur: 8, hold: 4 }, { dur: 2.6, hold: 1.5 }],
    bed: { chord: [0, 7, 12], oct: 2, cut: 300, vol: .055, sub: .2, noise: { brown: true, type: 'lowpass', freq: 180, vol: .3, wobble: .05 }, pulse: { kind: 'heart', rate: .8, vol: .55 }, level: [.55, .65, .35] },
    notes: [
      'Lights down. One point of light, so dense it bends the stars behind it.',
      'Then it goes. Everything that follows in this talk is what happens after that moment.',
      'So let\'s start with the people whose job is to see it coming.',
    ],
    create(ctx, s) {
      scene3 = new THREE.Scene(); cam = new THREE.PerspectiveCamera(42, 1.78, .01, 100);
      const geo = new THREE.BufferGeometry(), rr = prng(77);
      const pos = new Float32Array(N * 3), seed = new Float32Array(N * 4);
      for (let i = 0; i < N; i++) { seed.set([rr(), rr(), rr(), rr()], i * 4); }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
      pm = shader(`varying vec3 vC; varying float vA; void main(){ vec2 c=gl_PointCoord-.5; float d=dot(c,c); if(d>.25) discard; gl_FragColor=vec4(vC*(exp(-d*14.)*1.3+.2)*vA,1.); }`,
        { uB: { value: 0 }, uF: { value: 0 }, uT: { value: 0 }, uPx: { value: 1 }, uOut: { value: 0 } },
        { blend: 'add', vert: `attribute vec4 aSeed; uniform float uB,uF,uT,uPx,uOut; varying vec3 vC; varying float vA; varying vec2 vUv;
vec3 hsh(vec3 p){ return fract(sin(vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))))*43758.5453); }
void main(){
  vec4 s=aSeed;
  float th=s.x*6.2831, ph=acos(2.*s.y-1.);
  vec3 dir=vec3(sin(ph)*cos(th),cos(ph)*.62,sin(ph)*sin(th));
  // singularity: a tight, shivering core
  vec3 core=dir*(.008+.012*s.z)*(1.+.3*sin(uT*30.+s.w*50.));
  // explosion: fast out, drag, swirl around y
  float b=clamp(uB,0.,1.);
  float r=(1.-exp(-b*6.*(.6+s.z)))*(1.2+s.w*3.2);
  float sw=b*(2.2/(r+.25))*(s.z-.5)*2.;
  vec3 ex=dir*r; ex.xz=mat2(cos(sw),-sin(sw),sin(sw),cos(sw))*ex.xz;
  ex+=vec3(sin(uT*.7+s.x*20.),cos(uT*.6+s.y*17.),sin(uT*.5+s.z*13.))*.08*b;
  // assemble into the title
  float k=clamp((uF*1.45-s.w*.45),0.,1.); k=k*k*k*(k*(k*6.-15.)+10.);
  vec3 tgt=position; vec3 arc=vec3(0.,0.,sin(k*3.14159)*(.6+s.z));
  vec3 p=mix(mix(core,ex,smoothstep(0.,.02,b)),tgt,k)+arc*(1.-k)*k*2.;
  p+=vec3(sin(uT*1.3+s.x*40.),cos(uT*1.1+s.y*30.),0.)*.004*k;
  // leaving: blow away toward the camera
  p+=normalize(vec3(tgt.xy+.001,1.))*uOut*uOut*(1.5+s.z*6.);
  vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
  gl_PointSize=clamp(uPx*(.004+s.z*.005)/-mv.z,1.,4.);
  float hue=clamp(tgt.x*.28+.5,0.,1.);
  vec3 g=mix(vec3(.37,.95,1.),vec3(.55,.36,1.),smoothstep(0.,.4,hue)); g=mix(g,vec3(1.,.24,.6),smoothstep(.35,.7,hue)); g=mix(g,vec3(1.,.78,.36),smoothstep(.65,1.,hue));
  vec3 hot=vec3(1.,.9,.75)*1.2;
  vC=mix(hot,g*.9,clamp(b*1.6-.2,0.,1.))*mix(.55,1.,k)*(${SMALL ? '.3' : '.26'});
  vA=(.35+.65*s.z)*(1.-smoothstep(.6,1.,uOut))*mix(.03,1.,smoothstep(0.,.03,b));
  vUv=vec2(0.); }` });
      pts = new THREE.Points(geo, pm); pts.frustumCulled = false; scene3.add(pts);
      bg = shader(`uniform float uT,uAsp,uMass,uShock,uFlash,uNeb;
vec3 stars(vec2 p){ vec3 c=vec3(0.);
  for(int l=0;l<3;l++){ float sc=60.+float(l)*90.; vec2 q=p*sc; vec2 id=floor(q); vec2 f=fract(q)-.5; vec2 h=hash22(id+float(l)*13.);
    float on=step(.965,h.x); float d=length(f-(h-.5)*.7); float tw=.6+.4*sin(uT*(1.+h.y*4.)+h.x*60.);
    c+=vec3(.75+.25*h.y,.85,1.)*on*smoothstep(.12,.0,d)*tw*(1.-float(l)*.25); }
  return c; }
void main(){ vec2 p=(vUv-.5)*vec2(uAsp,1.); float r=length(p);
  // gravitational lensing of the starfield around the core
  vec2 q=p - normalize(p+1e-5)*uMass*.012/(r+.02);
  // shock wave refraction
  float ring=uShock*1.8; float w=exp(-pow((r-ring)*14.,2.))*(1.-clamp(uShock,0.,1.));
  q+=normalize(p+1e-5)*w*.04;
  vec3 c=stars(q+uT*.002);
  float n=fbm(q*2.2+vec2(uT*.01,0.)); float n2=fbm(q*4.+7.);
  c+=uNeb*(vec3(.18,.06,.32)*smoothstep(.45,.8,n)+vec3(.02,.12,.2)*smoothstep(.5,.85,n2))*.9;
  // core glow + photon ring
  c+=uMass*pow(min(uAsp,1.),2.5)*(vec3(1.,.85,.7)*.0011/(r*r+.0002)+vec3(1.,.7,.45)*exp(-pow((r-.03)*140.,2.))*.9);
  c+=vec3(1.,.8,.6)*w*3.;
  c+=vec3(1.,.95,.9)*uFlash*exp(-r*3.)*3.;
  gl_FragColor=vec4(c,1.); }`, { uT: { value: 0 }, uAsp: { value: 1.78 }, uMass: { value: 1 }, uShock: { value: 0 }, uFlash: { value: 0 }, uNeb: { value: 0 } });
      return {
        init() {
          const P = samplePoints(titleCanvas(), N, 9), a = pts.geometry.attributes.position;
          for (let i = 0; i < N; i++) a.setXYZ(i, P[i][0] * 3.7, P[i][1] * 1.85, (Math.random() - .5) * .05);
          a.needsUpdate = true; titleReady = true;
        },
        update(s) {
          const b = s.on(1) ? s.at(1) : 0, out = s.on(2) ? s.k(2, .5, 2.6, E.in2) : 0;
          pm.uniforms.uB.value = clamp(b / 3.2); pm.uniforms.uF.value = clamp((b - 3.4) / 3.6); pm.uniforms.uT.value = s.t; pm.uniforms.uOut.value = out;
          pm.uniforms.uPx.value = V.H * (V.portrait ? 2.2 : 1.5);
          const u = bg.uniforms; u.uT.value = s.t; u.uAsp.value = V.W / V.H; u.uMass.value = s.on(1) ? Math.max(0, 1 - b * 4) : E.out3(clamp(s.at(0) / 2.5));
          u.uShock.value = s.on(1) ? b / 2.2 : 0; u.uFlash.value = s.on(1) ? Math.exp(-b * 5) * (b > 0 ? 1 : 0) : 0; u.uNeb.value = s.on(1) ? E.out2(clamp(b / 4)) : 0;
          const dolly = s.on(1) ? lerp(7.5, 4.6, E.io3(clamp((b - 3) / 5))) : 7.5;
          cam.position.set(s.mouse.x * .25, s.mouse.y * .15, (dolly + out * 1.5) * (V.portrait ? 1.9 : 1)); cam.lookAt(0, 0, 0);
          cam.aspect = V.W / V.H; cam.fov = V.portrait ? 60 : 42; cam.updateProjectionMatrix();
          const shake = s.on(1) ? Math.exp(-b * 2.5) * .06 : 0; cam.position.x += Math.sin(s.t * 70) * shake; cam.position.y += Math.cos(s.t * 63) * shake;
          s.post = { streak: .6, flare: V.portrait ? .12 : .3, bloom: .55, threshold: 1.1, exposure: 1, vignette: .55, grain: .035, ca: .0025 + (s.on(1) ? Math.exp(-b * 3) * .02 : 0), halation: .5 };
          if (s.cross(0, .3)) AU.hit('sub'); if (s.cross(1, 0)) { AU.hit('boom'); AU.hit('slam'); } if (s.cross(1, .4)) AU.hit('shimmer'); if (s.cross(1, 3.2)) AU.hit('riser'); if (s.cross(1, 6.6)) AU.hit('bell');
          if (s.cross(2, 1.2)) AU.hit('whoosh');
          if (s.cross(1, 0)) AU.hit('shatter'); if (s.cross(1, 3.6)) AU.hit('sparkle'); if (s.cross(1, 6.2)) AU.hit('choir'); if (s.cross(2, .9)) AU.hit('glitch'); if (s.cross(0, 1.2)) AU.hit('glitch');
          if (s.bed) { s.bed.param('pulseRate', s.on(1) ? 0 : Math.min(1.6, .75 + s.at(0) * .08)); s.bed.param('noise', s.on(1) ? .12 : .3); }
        },
        render(slot) { pass(bg, slot.hdr); if (titleReady) { R.setRenderTarget(slot.hdr); R.render(scene3, cam); } },
        draw2d(g, s) {
          const W = V.W, H = V.H, k = Math.min(W / 1920, H / 1080) * (V.portrait ? 1.6 : 1);
          if (!s.on(1)) {
            text(g, 'A PRESENTATION ON THE NEXT TEN YEARS', { x: W / 2, y: H * .84, size: 18 * k, font: 'Geist Mono', weight: 500, color: 'rgba(255,255,255,.75)', align: 'center', track: .35, anim: 'decode', accent: '#5ef2ff', stagger: .8 }, s.k(0, 1, 3.6, E.lin));
            text(g, 'sound on  ·  press → or tap to begin', { x: W / 2, y: H * .9, size: 14 * k, font: 'Geist Mono', color: 'rgba(255,255,255,.4)', align: 'center', track: .25, anim: 'neon' }, s.k(0, 3.2, 4, E.lin));
          }
          if (s.on(1) && !s.on(2)) {
            text(g, 'What happens when minds start building better minds.', { x: W / 2, y: H * (V.portrait ? .76 : .86), size: (V.portrait ? 30 : 30) * k, font: 'Newsreader', italic: true, color: '#f2ecff', align: 'center', anim: 'blur', by: 'word', maxW: W * .86 }, s.k(1, 6.8, 9, E.lin));
          }
          if (s.on(2)) text(g, 'How close is it?', { x: W / 2, y: H * .52, size: (V.portrait ? 46 : 64) * k, font: 'Unbounded', weight: 300, color: '#fff', align: 'center', valign: 'middle', track: -.03, anim: 'glitch' }, s.k(2, .9, 1.6, E.lin), s.k(2, 2.1, 2.5, E.lin));
        },
      };
    },
  });
}
