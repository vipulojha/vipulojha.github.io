// =====================================================================
// 20 · TOWER — the METR chart leaves the slide: a tower of paper sheets
// (one sheet = one hour), a red line climbing through a sea of clouds to
// the edge of space. Depth-aware sky / volumetric cloud composite.
// =====================================================================
import { SCENES, THREE, R, clamp, lerp, E, rig, shader, pass, V, text, AU } from './00-core.js';

{
  const SHEET_W = 53.3, SHEET_H = 30, NSHEET = 48;
  const X = y => (y - 2019) / (2027.6 - 2019) * SHEET_W - SHEET_W / 2, Y = h => h * SHEET_H;
  // measured curve: log-linear between points; projection: 3.61-month doubling to 200 h
  const meas = [];
  for (let i = 0; i < METR.length - 1; i++) {
    const a = METR[i], b = METR[i + 1];
    for (let k = 0; k < 24; k++) { const t = k / 24; meas.push(new THREE.Vector3(X(lerp(a.y, b.y, t)), Y(Math.exp(lerp(Math.log(a.h), Math.log(b.h), t))), .9)); }
  }
  const last = METR[METR.length - 1]; meas.push(new THREE.Vector3(X(last.y), Y(last.h), .9));
  const proj = []; const tEnd = last.y + Math.log2(200 / last.h) * 3.61 / 12;
  for (let k = 0; k <= 80; k++) { const t = lerp(last.y, tEnd, k / 80); proj.push(new THREE.Vector3(X(t), Y(last.h * 2 ** ((t - last.y) * 12 / 3.61)), .9)); }
  const TOP = proj[proj.length - 1].y;

  let scene3, cam, pages, tube, tubeCount, head, dashes = [], beads = [], comp, figure;
  const sun = new THREE.Vector3(-.55, .16, -.82).normalize();
  const KEYS = [
    { u: 0, pos: [8, 9, 62], look: [0, 12, 0], fov: 48 },
    { u: .55, pos: [34, 40, 78], look: [8, 46, 0], fov: 50 },
    { u: 1, pos: [46, 160, 70], look: [16, 150, 0], fov: 50 },
    { u: 1.45, pos: [-30, 300, 95], look: [16, 320, 0], fov: 54 },
    { u: 2, pos: [70, 540, 120], look: [20, 520, 0], fov: 52 },
    { u: 2.45, pos: [110, 1500, 330], look: [24, 2100, 0], fov: 56 },
    { u: 3, pos: [190, 4800, 900], look: [26, 6000, 0], fov: 62 },
    { u: 3.35, pos: [160, 2600, 620], look: [0, 200, 0], fov: 50 },
    { u: 3.6, pos: [110, 700, 300], look: [0, 60, 0], fov: 46 },
    { u: 4, pos: [58, 150, 96], look: [-4, 6, 0], fov: 44 },
  ];
  const TIP = [[0, 2], [.5, 40], [1, 147], [1.5, 330], [2, Y(17.4)], [2.6, 2400], [3, TOP], [4, TOP]];
  const tipAt = u => { for (let i = 0; i < TIP.length - 1; i++) if (u <= TIP[i + 1][0]) { const t = E.io2((u - TIP[i][0]) / (TIP[i + 1][0] - TIP[i][0])); return Math.exp(lerp(Math.log(TIP[i][1]), Math.log(TIP[i + 1][1]), t)); } return TOP; };
  const LINES = [
    ['Then it left the slide.', 'Task length AI agents can finish on their own · METR'],
    ['Doubling every 3.6 months.', 'METR, November 2026 · combined task suites, 50% success'],
    ['~200 hours by mid-2027.\nIf the trend just holds.', 'Dashed line: extrapolation. METR says estimates above ~16 hours are unreliable.'],
    ['Everything before 2025\nis down here.', 'GPT-4 managed five minutes. Each sheet of paper is one hour.'],
  ];

  SCENES.push({
    id: 'tower', title: 'The real chart', enterWith: 'portal', hud: { color: '#ffffff' },
    beats: [{ dur: 6, hold: 2 }, { dur: 7, hold: 2 }, { dur: 8, hold: 2 }, { dur: 5, hold: 3 }],
    bed: { chord: [0, 4, 7, 11], oct: 3, cut: 700, vol: .05, level: [.35, .45, .6, .4] },
    notes: [
      'This is METR\'s measurement: how long a task, measured in human time, an AI agent can finish on its own half the time. One sheet of paper here is one hour. The line left the slide in late 2025.',
      'Across METR\'s combined task suites the doubling time is about 3.6 months. Claude Mythos Preview was estimated at roughly 17 hours, with a very wide error bar (8.5 to 55 hours).',
      'Extrapolate the trend and you reach about 200 hours, five work weeks, by mid-2027. That is an extrapolation, not a forecast, and METR warns its estimates above ~16 hours are unreliable.',
      'Look down. GPT-4, the model that shocked everyone in 2023, sits at five minutes. Everything before 2025 is a smudge at the bottom of the tower.',
    ],
    create(ctx, s) {
      scene3 = new THREE.Scene(); cam = new THREE.PerspectiveCamera(48, 1.78, .5, 30000);
      // paper sheets (instanced), procedural paper + grid
      const pm = shader(`varying float vId; varying vec3 vN; varying vec3 vW; uniform vec3 uSun;
void main(){
  vec2 p=vUv*vec2(${SHEET_W.toFixed(1)},${SHEET_H.toFixed(1)});
  vec3 paper=vec3(.93,.91,.87)*(.93+.07*vnoise(p*3.))*(.97+.03*vnoise(p*40.));
  float gy=1.-smoothstep(0.,.07,abs(fract(p.y/5.+.5)-.5)*5.);
  float gx=0.; for(int i=0;i<9;i++){ float x=(float(i)/8.6)*${SHEET_W.toFixed(1)}; gx=max(gx,1.-smoothstep(0.,.08,abs(p.x-x))); }
  paper*=1.-gy*.06-gx*.08;
  if(vId<.5){ paper*=1.-(1.-smoothstep(0.,.25,abs(p.y-1.)))*.6; }
  float edge=smoothstep(0.,.6,min(min(p.x,${SHEET_W.toFixed(1)}-p.x),min(p.y,${SHEET_H.toFixed(1)}-p.y)));
  paper*=.82+.18*edge;
  vec3 n=normalize(vN); float ndl=dot(n,uSun);
  vec3 lit=paper*(vec3(1.,.93,.85)*(.35+max(ndl,0.)*.9)+vec3(.35,.4,.55)*.55);
  lit+=paper*vec3(1.,.8,.6)*max(-ndl,0.)*.45; // translucency
  gl_FragColor=vec4(toLin(lit),1.); }`, { uSun: { value: sun } }, {
        depth: true, side: THREE.DoubleSide, vert: `varying vec2 vUv; varying float vId; varying vec3 vN; varying vec3 vW;
void main(){ vUv=uv; vId=float(gl_InstanceID); vec4 w=modelMatrix*instanceMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix*instanceMatrix)*normal);
  gl_Position=projectionMatrix*viewMatrix*w; }` });
      pages = new THREE.InstancedMesh(new THREE.PlaneGeometry(SHEET_W, SHEET_H - .25), pm, NSHEET);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion();
      for (let i = 0; i < NSHEET; i++) { q.setFromEuler(new THREE.Euler((Math.sin(i * 7.1)) * .01, Math.sin(i * 3.3) * .025, Math.sin(i * 5.7) * .004)); m.compose(new THREE.Vector3(Math.sin(i * 1.7) * .3, SHEET_H / 2 + i * SHEET_H, Math.sin(i * 2.3) * .5), q, new THREE.Vector3(1, 1, 1)); pages.setMatrixAt(i, m); }
      pages.frustumCulled = false; scene3.add(pages);
      // red line
      const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, .1, .03) });
      const curve = new THREE.CatmullRomCurve3(meas);
      const tg = new THREE.TubeGeometry(curve, meas.length * 2, .5, 10, false); tube = new THREE.Mesh(tg, red); tubeCount = tg.index.count; tube.frustumCulled = false; scene3.add(tube);
      for (let i = 0; i < proj.length - 1; i += 2) {
        const seg = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(proj[i], proj[i + 1]), 1, 1.2 + proj[i].y * .004, 8, false), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, .1, .03) }));
        seg.userData.y = proj[i].y; seg.frustumCulled = false; dashes.push(seg); scene3.add(seg);
      }
      head = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 1.1, .4) })); scene3.add(head);
      METR.forEach(d => { const b = new THREE.Mesh(new THREE.SphereGeometry(.9, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, .5, .2) })); b.position.set(X(d.y), Y(d.h), .9); b.userData = d; scene3.add(b); beads.push(b); });
      figure = new THREE.Mesh(new THREE.CapsuleGeometry(.32, 1.15, 4, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(.02, .02, .025) })); figure.position.set(-31, .9, 9); scene3.add(figure);
      // sky / clouds / ground composite, depth-aware
      comp = shader(`uniform sampler2D tScene,tDepth; uniform mat4 uInvVP; uniform vec3 uCam,uSun; uniform float uTime,uAlt;
vec3 skyC(vec3 rd){
  float day=smoothstep(20.,500.,uAlt), sp=smoothstep(900.,4200.,uAlt);
  vec3 zen=mix(vec3(.10,.13,.34),vec3(.08,.25,.75),day); zen=mix(zen,vec3(.0,.0,.004),sp);
  vec3 hor=mix(vec3(.95,.45,.3),vec3(.72,.82,1.),day); hor=mix(hor,vec3(.18,.32,.85)*.7,sp);
  float y=clamp(rd.y+.02,0.,1.);
  vec3 c=mix(hor,zen,pow(y,mix(.42,.7,sp)));
  float sd=max(dot(rd,uSun),0.);
  c+=vec3(1.3,.75,.45)*pow(sd,6.)*.55*(1.-sp*.6)+vec3(40.,32.,24.)*smoothstep(.9993,.9996,sd);
  if(sp>0.){ vec3 q=rd*420.; vec3 cell=floor(q); float h=hash13(cell); float st=step(.9965,h)*smoothstep(.45,.0,length(fract(q)-.5)); c+=vec3(1.4)*st*sp*(.6+.4*sin(uTime*3.+h*90.)); }
  return c; }
vec3 horizonC(){ float day=smoothstep(20.,500.,uAlt), sp=smoothstep(900.,4200.,uAlt); vec3 hor=mix(vec3(.95,.45,.3),vec3(.72,.82,1.),day); return mix(hor,vec3(.18,.32,.85)*.7,sp); }
vec3 world(vec3 ro,vec3 rd){
  // distant mountain ridges
  float az=atan(rd.x,rd.z);
  float ridge=.006+.03*fbm(vec2(az*3.,1.7))*smoothstep(.0,.4,abs(sin(az*.5+1.)));
  float hz=ridge*(1.-smoothstep(200.,2000.,ro.y)*.8);
  if(rd.y>0.&&rd.y<hz){ return mix(vec3(.25,.27,.4)*vec3(1.,.9,.95),horizonC(),.55)*mix(.55,1.,smoothstep(0.,hz,rd.y)); }
  if(rd.y>=0.) return skyC(rd);
  float t=-ro.y/rd.y; vec3 p=ro+rd*t;
  // salt flat with polygon cracks + mirror sky
  vec2 g=p.xz*.08; vec2 ip=floor(g); float md=8.,md2=8.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){ vec2 o=vec2(i,j); vec2 c=o+hash22(ip+o)-fract(g); float d=dot(c,c); if(d<md){md2=md;md=d;}else if(d<md2)md2=d; }
  float crack=smoothstep(.0,.06,sqrt(md2)-sqrt(md));
  vec3 salt=vec3(.88,.85,.8)*(.85+.15*crack);
  vec3 refl=skyC(reflect(rd,vec3(0.,1.,0.)));
  float fres=.25+.6*pow(1.+rd.y,6.);
  vec3 c=mix(salt*(.55+.45*smoothstep(20.,500.,uAlt))*vec3(1.,.9,.85),refl,fres*.75);
  float fog=1.-exp(-t*.00045);
  return mix(c,horizonC(),fog); }
void main(){
  vec2 ndc=vUv*2.-1.;
  vec4 w=uInvVP*vec4(ndc,1.,1.); vec3 rd=normalize(w.xyz/w.w-uCam);
  float d=texture(tDepth,vUv).r;
  vec3 col; float dist=1e9;
  if(d<1.){ vec4 pw=uInvVP*vec4(ndc,d*2.-1.,1.); vec3 P=pw.xyz/pw.w; dist=length(P-uCam);
    col=texture(tScene,vUv).rgb; col=mix(col,horizonC()*.9,1.-exp(-dist*.00028)); }
  else col=world(uCam,rd);
  // volumetric sea of clouds between y=230 and y=350
  float y0=255.,y1=335.;
  float ta=(y0-uCam.y)/rd.y, tb=(y1-uCam.y)/rd.y; float tn=max(min(ta,tb),0.), tf=min(max(ta,tb),min(dist,9000.));
  if(abs(rd.y)<1e-4){ tn=0.; tf=(uCam.y>y0&&uCam.y<y1)?min(dist,3000.):0.; }
  if(tf>tn){
    float T=1.; vec3 acc=vec3(0.); const int N=28; float st=(tf-tn)/float(N);
    float j=hash12(gl_FragCoord.xy+fract(uTime)*37.);
    for(int i=0;i<N;i++){ vec3 p=uCam+rd*(tn+(float(i)+j)*st);
      float hgt=(p.y-y0)/(y1-y0);
      float dens=fbm3(p*.0055+vec3(uTime*.004,0.,uTime*.002))*1.75-.72-abs(hgt-.45)*1.1;
      dens=clamp(dens,0.,1.);
      if(dens>.001){ float a=1.-exp(-dens*st*.045);
        float sd=max(dot(rd,uSun),0.);
        vec3 lc=mix(vec3(.55,.52,.6),vec3(1.25,1.12,1.02),hgt)*(.75+.5*smoothstep(20.,500.,uAlt))+vec3(1.4,.8,.5)*pow(sd,6.)*.8*(1.-hgt*.5);
        lc=mix(lc,horizonC(),1.-exp(-(tn+float(i)*st)*.00025));
        acc+=T*a*lc; T*=1.-a; if(T<.02) break; } }
    col=col*T+acc; }
  gl_FragColor=vec4(col,1.); }`, { tScene: { value: null }, tDepth: { value: null }, uInvVP: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() }, uSun: { value: sun }, uTime: { value: 0 }, uAlt: { value: 0 } });
      let u = 0; const lab = new THREE.Vector3();
      return {
        update(s) {
          u = s.p[0] + s.p[1] + s.p[2] + s.p[3];
          const k = rig(KEYS, u, ['pos', 'look', 'fov']);
          const sway = [Math.sin(s.t * .31) * 1.5 + s.mouse.x * 6, Math.sin(s.t * .23) * 1. + s.mouse.y * 4, 0];
          const scale = 1 + k.pos[1] * .004;
          cam.position.set(k.pos[0] + sway[0] * scale, k.pos[1] + sway[1] * scale, k.pos[2]); cam.lookAt(k.look[0], k.look[1], k.look[2]);
          cam.fov = k.fov; cam.aspect = V.W / V.H; if (V.portrait) cam.fov = k.fov * 1.6; cam.updateProjectionMatrix();
          const tip = tipAt(u);
          let n = meas.findIndex(p => p.y > tip); if (n < 0) n = meas.length; const frac = n / meas.length;
          tube.geometry.setDrawRange(0, Math.floor(tubeCount * frac / 6) * 6);
          dashes.forEach(d => d.visible = d.userData.y < tip);
          const hp = tip <= meas[meas.length - 1].y ? meas[Math.max(0, n - 1)] : proj.find(p => p.y >= tip) || proj[proj.length - 1];
          head.position.copy(hp); head.scale.setScalar(1.3 + hp.y * .006);
          beads.forEach(b => { b.visible = b.position.y <= tip + .01; b.scale.setScalar(1 + b.position.distanceTo(cam.position) * .004); });
          s.post = { bloom: .5, threshold: 1.1, exposure: .82, contrast: 1.1, vignette: .45, grain: .03, ca: .0016, halation: .35 };
          if (s.cross(1, .4) || s.cross(2, .4)) AU.hit('riser'); if (s.cross(2, 5) || s.cross(3, .2)) AU.hit('boom');
          if (s.cross(0, 1.2) || s.cross(0, 3.4) || s.cross(1, 3.2)) AU.hit('pop');
        },
        render(slot, s) {
          R.setRenderTarget(slot.aux); R.setClearColor(0, 1); R.clear(); R.render(scene3, cam);
          comp.uniforms.tScene.value = slot.aux.texture; comp.uniforms.tDepth.value = slot.aux.depthTexture;
          comp.uniforms.uInvVP.value.multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse);
          comp.uniforms.uCam.value.copy(cam.position); comp.uniforms.uTime.value = s.t; comp.uniforms.uAlt.value = cam.position.y;
          pass(comp, slot.hdr);
        },
        draw2d(g, s) {
          const W = V.W, H = V.H, k = Math.min(W / 1920, H / 1080) * (V.portrait ? 1.6 : 1);
          // labels for models (projected)
          g.font = `500 ${16 * k}px "Geist Mono", monospace`;
          beads.forEach(b => {
            const d = b.userData; if (!d.lab || !b.visible) return;
            lab.copy(b.position).project(cam); if (lab.z > 1 || Math.abs(lab.x) > 1.1 || Math.abs(lab.y) > 1.1) return;
            const dist = b.position.distanceTo(cam.position), a = clamp(1.6 - dist / 260) * .95; if (a <= 0) return;
            const x = (lab.x * .5 + .5) * W, y = (1 - (lab.y * .5 + .5)) * H;
            g.globalAlpha = a; g.fillStyle = '#fff'; g.fillRect(x + 10 * k, y - 1, 26 * k, 2); g.fillText(d.lab, x + 42 * k, y + 5 * k);
          });
          g.globalAlpha = 1;
          const sh = g.createLinearGradient(0, H * .45, 0, H); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.42)'); g.fillStyle = sh; g.fillRect(0, H * .45, W, H * .55);
          for (let b = 0; b < 4; b++) {
            const pIn = s.k(b, .35, 1.6, E.lin), pOut = b < s.beat ? clamp(s.at(b + 1) / .7) : 0;
            if (!s.on(b) || pOut >= 1) continue;
            const [h1, cap] = LINES[b], x = V.portrait ? 60 * k : 120 * k, y = V.portrait ? H * .2 : H * .72;
            text(g, h1, { x, y, size: (V.portrait ? 64 : 92) * k, font: 'Unbounded', weight: 300, color: '#fff', track: -.035, lh: 1.08, anim: 'rise', glow: 'rgba(0,0,0,.35)', maxW: W - x * 2 }, pIn, pOut);
            const lines = h1.split('\n').length;
            text(g, cap, { x, y: y + (lines * (V.portrait ? 70 : 100) - 30) * k + 26 * k, size: 22 * k, font: 'Geist', weight: 400, color: 'rgba(255,255,255,.8)', anim: 'blur', maxW: W - x * 2 }, s.k(b, 1.1, 2.4, E.lin), pOut);
          }
        },
      };
    },
  });
}
