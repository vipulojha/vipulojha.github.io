// =====================================================================
// 57 · EXAMS — "The tests keep breaking." A paper exam floats in the dark.
// It gets aced, stamped, then burns from the bottom up (noise threshold,
// charred edge, glowing embers) to reveal the next, harder test.
// =====================================================================
import { SCENES, THREE, R, clamp, lerp, E, prng, shader, pass, V, text, AU } from './00-core.js';

{
  const PW = 1024, PH = 1400;
  let scene3, cam, page, pMat, embers, eMat, bg, cv = [], tex = [];
  function paper(g, title, sub) {
    g.fillStyle = '#f4efe4'; g.fillRect(0, 0, PW, PH);
    const r = prng(4); for (let i = 0; i < 2400; i++) { g.fillStyle = `rgba(120,100,70,${r() * .05})`; g.fillRect(r() * PW, r() * PH, 2, 2); }
    g.fillStyle = '#1b1a17'; g.font = '700 54px Geist, Arial'; g.fillText(title, 80, 150); g.font = '400 30px Geist, Arial'; g.fillStyle = '#5b574f'; g.fillText(sub, 80, 200);
    g.fillStyle = '#c33'; g.fillRect(80, 236, PW - 160, 4);
  }
  function scribble(g, x, y, w, seed) { const r = prng(seed); g.strokeStyle = '#2a3f8f'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 40; i++) g.lineTo(x + i / 40 * w, y + Math.sin(i * 1.7 + r() * 3) * 9 + (r() - .5) * 6); g.stroke(); }
  function drawIMO(stamp) {
    const g = cv[0].getContext('2d'); paper(g, 'INTERNATIONAL MATHEMATICAL OLYMPIAD', 'Sunshine Coast, Australia · July 2025 · 6 problems, 42 points');
    for (let p = 0; p < 6; p++) { const y = 320 + p * 160; g.fillStyle = '#1b1a17'; g.font = '600 32px Geist, Arial'; g.fillText(`Problem ${p + 1}`, 80, y); g.font = '400 26px "Newsreader", Georgia'; g.fillStyle = '#3d3a34'; g.fillText(['Determine all functions f such that ...', 'Let ABC be a triangle with circumcircle ...', 'Prove that for every positive integer n ...', 'A sequence a₁, a₂, ... satisfies ...', 'Alice and Bazza play a game in which ...', 'Find the minimum number of tiles ...'][p], 80, y + 40); for (let l = 0; l < 2; l++) scribble(g, 100, y + 80 + l * 26, 620 - l * 140, p * 7 + l); g.fillStyle = p < 5 ? '#c33' : '#999'; g.font = '700 36px Geist, Arial'; g.fillText(p < 5 ? '7/7' : '0/7', PW - 200, y + 10); }
    g.fillStyle = '#1b1a17'; g.font = '800 64px Geist, Arial'; g.fillText('35 / 42', 80, PH - 80);
    if (stamp > 0) { const s = E.outBack(clamp(stamp)); g.save(); g.translate(PW * .62, PH * .78); g.rotate(-.22); g.scale(3 - 2 * s, 3 - 2 * s); g.globalAlpha = Math.min(1, stamp * 2) * .9; g.strokeStyle = '#d4a017'; g.lineWidth = 12; g.strokeRect(-260, -95, 520, 190); g.fillStyle = '#d4a017'; g.font = '800 104px Geist, Arial'; g.textAlign = 'center'; g.fillText('GOLD', 0, 38); g.font = '600 26px Geist, Arial'; g.fillText('MEDAL LEVEL', 0, 78); g.restore(); }
    tex[0].needsUpdate = true;
  }
  function drawHLE(fill, score) {
    const g = cv[1].getContext('2d'); paper(g, "HUMANITY'S LAST EXAM", '2,500 expert questions · 100+ subjects · built to be AI-proof');
    const cols = 5, rows = 22, total = cols * rows * 1; let n = 0;
    for (let c = 0; c < 4; c++) for (let r = 0; r < rows; r++, n++) {
      const x = 90 + c * 220, y = 300 + r * 44; g.fillStyle = '#6b665c'; g.font = '500 20px "Geist Mono", monospace'; g.fillText(String(n + 1).padStart(3, '0'), x, y + 8);
      const filled = n / (4 * rows) < fill, pick = (n * 7 + 3) % 5;
      for (let b = 0; b < 5; b++) { g.beginPath(); g.arc(x + 62 + b * 28, y + 1, 10, 0, 7); g.strokeStyle = '#8a8475'; g.lineWidth = 2; g.stroke(); if (filled && b === pick) { g.fillStyle = '#1b1a17'; g.fill(); } }
    }
    g.fillStyle = '#c33'; g.font = '800 120px Geist, Arial'; g.fillText(Math.round(score) + '%', 80, PH - 70); g.fillStyle = '#5b574f'; g.font = '500 26px "Geist Mono", monospace'; g.fillText('TOP AI SCORE', 80, PH - 200);
    tex[1].needsUpdate = true;
  }
  function drawNext() {
    const g = cv[2].getContext('2d'); paper(g, 'THE NEXT TEST', 'not written yet');
    g.fillStyle = 'rgba(27,26,23,.08)'; g.font = '800 900px Geist, Arial'; g.textAlign = 'center'; g.fillText('?', PW / 2, PH * .82); g.textAlign = 'left'; tex[2].needsUpdate = true;
  }
  SCENES.push({
    id: 'exams', title: 'The tests keep breaking', enterWith: 'dissolve', hud: { color: '#ffb36b' },
    beats: [{ dur: 4, hold: 4 }, { dur: 6, hold: 4 }, { dur: 4, hold: 4 }],
    bed: { chord: [0, 3, 7, 10], oct: 3, cut: 700, vol: .045, level: [.3, .45, .55] },
    notes: [
      'July 2025: experimental reasoning models from Google DeepMind and OpenAI each reached gold-medal level at the International Mathematical Olympiad, 35 of 42 points, writing their proofs in natural language.',
      'Humanity\'s Last Exam was built in late 2024 by thousands of experts to be the hardest closed test there is: 2,500 questions. At launch in January 2025, frontier models scored in single digits. By February 2026 the best reported score was about 48%. Leaderboards disagree on later numbers.',
      'So the tests keep breaking, and we keep having to write harder ones.',
    ],
    create() {
      for (let i = 0; i < 3; i++) { const c = document.createElement('canvas'); c.width = PW; c.height = PH; cv.push(c); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; tex.push(t); }
      scene3 = new THREE.Scene(); cam = new THREE.PerspectiveCamera(32, 1.78, .1, 50);
      pMat = shader(`varying vec3 vN; uniform sampler2D tA,tB; uniform float uBurn,uT;
void main(){
  vec2 uv=vUv;
  float n=fbm(uv*vec2(3.,4.)+1.7)*.75+uv.y*.45+vnoise(uv*40.)*.05;
  float th=uBurn*1.35-.12;
  vec3 A=toLin(texture(tA,uv).rgb), B=toLin(texture(tB,uv).rgb);
  float light=.62+.2*dot(normalize(vN),normalize(vec3(-.3,.4,1.)));
  vec3 col;
  float d=n-th;
  if(d<0.){ col=B*light*.92; float bed=exp(d*30.); col=mix(col,col*.4,bed*.6); }
  else { col=A*light; float ch=smoothstep(.09,0.,d); col=mix(col,vec3(.05,.03,.02),ch*.85); }
  float glow=exp(-abs(d)*70.)*step(.001,uBurn)*step(uBurn,.999);
  col+=vec3(1.,.42,.08)*glow*1.8+vec3(1.,.85,.5)*exp(-abs(d)*320.)*step(.001,uBurn)*step(uBurn,.999)*2.2;
  gl_FragColor=vec4(col,1.); }`, { tA: { value: null }, tB: { value: null }, uBurn: { value: 0 }, uT: { value: 0 } },
        { depth: true, side: THREE.DoubleSide, vert: `varying vec3 vN; varying vec2 vUv; uniform float uT; void main(){ vUv=uv; vec3 p=position; p.z+=sin(p.y*2.+uT)*.015+p.x*p.x*.04; vN=normalMatrix*normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }` });
      page = new THREE.Mesh(new THREE.PlaneGeometry(1, PH / PW, 40, 40), pMat); scene3.add(page);
      const EN = 1800, ep = new Float32Array(EN * 3); for (let i = 0; i < EN; i++) ep.set([Math.random() - .5, Math.random(), Math.random()], i * 3);
      const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
      eMat = shader(`varying float vA; void main(){ vec2 c=gl_PointCoord-.5; gl_FragColor=vec4(vec3(1.,.5,.12)*exp(-dot(c,c)*30.)*vA*3.,1.); }`, { uT: { value: 0 }, uBurn: { value: 0 }, uPx: { value: 1 } },
        { blend: 'add', vert: `uniform float uT,uBurn,uPx; varying float vA; varying vec2 vUv;
void main(){ vec3 s=position; float life=fract(s.y+uT*(.25+s.z*.4)); float y0=uBurn*1.35-.6;
  vec3 p=vec3(s.x*1.05+sin(uT*2.+s.z*30.)*.05*life, (y0*1.4-.55)+life*1.2*(.4+s.z), .05+s.z*.15);
  vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(uPx*.004/-mv.z,1.,6.);
  vA=(1.-life)*step(.01,uBurn)*step(uBurn,.99)*smoothstep(0.,.1,life); vUv=vec2(0.); }` });
      embers = new THREE.Points(eg, eMat); embers.frustumCulled = false; scene3.add(embers);
      bg = shader(`uniform float uT,uHeat; void main(){ vec2 p=vUv; float sm=fbm(p*3.+vec2(0.,-uT*.08))*fbm(p*6.-uT*.05);
        vec3 c=vec3(.025,.012,.01)+vec3(.35,.12,.03)*sm*.5+vec3(1.,.35,.06)*uHeat*exp(-p.y*3.)*.25*(.6+.4*sm); gl_FragColor=vec4(c,1.); }`, { uT: { value: 0 }, uHeat: { value: 0 } });
      let lastFill = -1, lastSt = -1, lastKey = '';
      return {
        init() { drawIMO(0); drawHLE(0, 3); drawNext(); },
        update(s) {
          const st = s.k(0, 1.4, 2.2, E.lin); if (st !== lastSt) { lastSt = st; drawIMO(st); }
          const b1 = s.on(1) ? clamp(s.at(1) / 1.8) : 0, b2 = s.on(2) ? clamp(s.at(2) / 1.8) : 0;
          const fill = s.k(1, 1.6, 5.2, E.lin); const sc = lerp(3, 48, s.k(1, 1.6, 5.4, E.io2)); if (Math.round(sc) !== lastFill) { lastFill = Math.round(sc); if (s.on(1) && fill < 1) AU.hit('tick'); }
          const key = Math.round(fill * 88) + '|' + Math.round(sc); if (key !== lastKey) { lastKey = key; drawHLE(fill, sc); }
          const u = pMat.uniforms; u.uT.value = s.t;
          if (s.on(2)) { u.tA.value = tex[1]; u.tB.value = tex[2]; u.uBurn.value = b2; } else { u.tA.value = tex[0]; u.tB.value = tex[1]; u.uBurn.value = b1; }
          eMat.uniforms.uT.value = s.t; eMat.uniforms.uBurn.value = u.uBurn.value; eMat.uniforms.uPx.value = V.H;
          bg.uniforms.uT.value = s.t; bg.uniforms.uHeat.value = Math.sin(Math.PI * u.uBurn.value);
          const ox = V.portrait ? 0 : .52, oy = V.portrait ? -.28 : -.02;
          page.position.set(ox, oy + Math.sin(s.t * .8) * .02, 0); page.rotation.set(-.08 + Math.sin(s.t * .5) * .03, V.portrait ? 0 : -.38 + s.mouse.x * .15, .03 * Math.sin(s.t * .4));
          embers.position.copy(page.position); embers.rotation.copy(page.rotation);
          cam.position.set(0, 0, V.portrait ? 3.6 : 2.6); cam.lookAt(0, 0, 0); cam.aspect = V.W / V.H; cam.updateProjectionMatrix();
          s.post = { bloom: .5, threshold: 1.4, exposure: .92, vignette: .55, grain: .04, ca: .0015, halation: .6, streak: .1 };
          if (s.cross(0, 1.4)) AU.hit('slam'); if (s.cross(1, .05) || s.cross(2, .05)) AU.hit('wave');
        },
        render(slot) { pass(bg, slot.hdr); R.setRenderTarget(slot.hdr); R.render(scene3, cam); },
        draw2d(g, s) {
          const W = V.W, H = V.H, k = Math.min(W / 1920, H / 1080) * (V.portrait ? 1.6 : 1), x = (V.portrait ? 60 : 120) * k, y = H * (V.portrait ? .1 : .3);
          const out = b => s.beat > b ? clamp(s.at(b + 1) / .5) : 0, mw = V.portrait ? W - 2 * x : W * .42;
          if (s.beat === 0 || out(0) < 1) { text(g, 'Gold at the\nMath Olympiad.', { x, y, size: (V.portrait ? 54 : 78) * k, font: 'Unbounded', weight: 300, color: '#fff', track: -.035, lh: 1.06, anim: 'rise', maxW: mw }, s.k(0, .2, 1.4, E.lin), out(0)); text(g, 'July 2025 · experimental models from Google DeepMind and OpenAI · 35 / 42', { x, y: y + 190 * k, size: 20 * k, font: 'Geist Mono', color: 'rgba(255,220,180,.75)', anim: 'fade', maxW: mw }, s.k(0, 1.2, 2.2, E.lin), out(0)); }
          if (s.beat === 1 || (s.beat === 2 && out(1) < 1)) { text(g, 'Humanity’s\nLast Exam.', { x, y, size: (V.portrait ? 54 : 78) * k, font: 'Unbounded', weight: 300, color: '#fff', track: -.035, lh: 1.06, anim: 'decode', accent: '#ff9a3c', maxW: mw }, s.k(1, 1, 2.4, E.lin), out(1)); text(g, 'Single digits at launch (Jan 2025). ~48% a year later (Feb 2026).', { x, y: y + 190 * k, size: 20 * k, font: 'Geist Mono', color: 'rgba(255,220,180,.75)', anim: 'fade', maxW: mw }, s.k(1, 2.4, 3.4, E.lin), out(1)); }
          if (s.beat === 2) text(g, 'So we keep\nwriting harder\ntests.', { x, y, size: (V.portrait ? 54 : 78) * k, font: 'Unbounded', weight: 300, color: '#fff', track: -.035, lh: 1.06, anim: 'neon', glow: 'rgba(255,140,60,.6)', maxW: mw }, s.k(2, 1.6, 2.8, E.lin));
        },
      };
    },
  });
}
