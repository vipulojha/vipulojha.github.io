// =====================================================================
// 80 · ENDGAME — selectall (control), futures (two worlds, interactive),
// questions (the close).
// =====================================================================
import { SCENES, THREE, R, clamp, lerp, E, prng, shader, pass, V, text, SelBox, AU } from './00-core.js';

// ---------------------------------------------------------------- selectall
{
  const bg = shader(`uniform float uT,uAsp,uRed; void main(){ vec2 p=(vUv-.5)*vec2(uAsp,1.);
  vec3 c=vec3(.012,.012,.02)+vec3(.35,.03,.02)*uRed*exp(-dot(p,p)*2.)*(.7+.3*fbm(p*3.+uT*.1));
  c*=.92+.08*sin(vUv.y*900.); float band=step(.985,hash11(floor(vUv.y*40.)+floor(uT*6.)*7.)); c+=vec3(.6,.05,.05)*band*uRed*.6; c+=vec3(1.,.2,.15)*exp(-abs(fract(vUv.y-uT*.15)-.5)*90.)*.05*uRed; gl_FragColor=vec4(c,1.); }`, { uT: { value: 0 }, uAsp: { value: 1.78 }, uRed: { value: 0 } });
  const sel = new SelBox();
  const COLS = 64, ROWS = 36;
  SCENES.push({
    id: 'selectall', title: 'Select all', enterWith: 'pixelsort', hud: { color: '#ff5a4a' },
    beats: [{ dur: 3, hold: 2 }, { dur: 3, hold: 4 }, { dur: 4, hold: 3 }, { dur: 4, hold: 6 }],
    bed: { chord: [0, 1, 7], oct: 2, cut: 400, vol: .045, wave: 'sawtooth', sub: .1, pulse: { kind: 'kick', rate: 1, vol: .3 }, level: [.25, .35, .5, .4] },
    notes: [
      'Control-A. Select everything: the research, the code, the experiments, the decisions.',
      'Anthropic says that in August its automated monitor reviewed more than a billion agent actions and blocked about one in 47,000 before they ran. Small rates times enormous volumes.',
      'The question is not whether these systems will be capable. It is who is holding the mouse, and whether what they want is what we want.',
      'Four problems we have to solve on a deadline: alignment, control, concentration of power, and speed. None of them are solved yet.',
    ],
    create(ctx, s) {
      const rr = prng(3), blocked = new Set(); for (let i = 0; i < 40; i++) blocked.add((rr() * COLS * ROWS) | 0);
      return {
        update(s) {
          s.post = { bloom: .6, threshold: .5, vignette: .5, grain: .04, ca: .002, exposure: 1.1 };
          if (s.cross(0, .5)) AU.hit('click'); if (s.cross(0, .8)) AU.hit('click'); if (s.cross(0, 1.2)) AU.hit('select'); if (s.cross(0, 1.4)) AU.hit('riser');
          if (s.cross(2, .3)) AU.hit('sub'); if (s.cross(3, .2)) AU.hit('boom');
          if (s.on(1) && Math.random() < s.dt * .8) AU.hit('glitch'); if (s.on(1) && Math.random() < s.dt * 1.2) AU.hit('zap');
          for (let i = 0; i < 4; i++) if (s.cross(3, .2 + i * .35)) AU.hit('glitch');
          if (s.bed) s.bed.param('pulseRate', [1, 1.4, 2, 2.6][s.beat]);
        },
        render(slot, s) { bg.uniforms.uT.value = s.t; bg.uniforms.uAsp.value = V.W / V.H; bg.uniforms.uRed.value = s.k(0, 1.2, 3) * (s.on(3) ? 1.4 : 1); pass(bg, slot.hdr); },
        draw2d(g, s) {
          const W = V.W, H = V.H, k = Math.min(W / 1920, H / 1080) * (V.portrait ? 1.6 : 1);
          // the field of work items
          const ox = W * .06, oy = H * .08, cw = W * .88 / COLS, chh = H * .84 / ROWS, sweep = s.k(0, 1.2, 3.2, E.lin) * 1.25;
          for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            const i = r * COLS + c, d = Math.hypot((c - COLS / 2) / COLS, (r - ROWS / 2) / ROWS * .6);
            const on = d < sweep, flick = .35 + .65 * Math.abs(Math.sin(s.t * (1 + (i % 7)) + i));
            const x = ox + c * cw, y = oy + r * chh;
            const isB = blocked.has(i) && s.on(1) && Math.sin(s.t * 2 + i) > .2;
            g.fillStyle = isB ? '#ff3b30' : `rgba(240,240,255,${.06 + .1 * flick})`; g.fillRect(x + cw * .2, y + chh * .25, cw * .6, chh * .5);
            if (on) { g.strokeStyle = isB ? '#ff3b30' : 'rgba(43,92,255,.85)'; g.lineWidth = 1; g.strokeRect(x + cw * .12, y + chh * .15, cw * .76, chh * .7); }
          }
          // Ctrl + A keycaps
          const kp = s.k(0, .4, 1, E.outBack), out0 = s.on(1) ? clamp(s.at(1) / .5) : 0;
          if (out0 < 1) {
            g.globalAlpha = kp * (1 - out0);
            const key = (x, label, down) => { const y = H / 2 - 80 * k + (down ? 10 * k : 0); g.fillStyle = '#1c1c22'; g.fillRect(x, y + 14 * k, 200 * k, 150 * k); g.fillStyle = down ? '#2a2a33' : '#33333d'; g.fillRect(x, y, 200 * k, 150 * k); g.fillStyle = '#fff'; g.font = `500 ${46 * k}px Geist, sans-serif`; g.fillText(label, x + 30 * k, y + 95 * k); };
            key(W / 2 - 250 * k, 'Ctrl', s.at(0) > .5); key(W / 2 + 50 * k, 'A', s.at(0) > .8);
            g.globalAlpha = 1;
          }
          if (s.at(0) > 1.2) sel.set({ x: ox, y: oy, w: W * .88, h: H * .84 }); else sel.hide();
          sel.draw(g, s.dt, k);
          const x = (V.portrait ? 60 : 120) * k, by = H * .5;
          const shade = (yy, hh) => { const gr = g.createLinearGradient(0, yy - hh, 0, yy + hh); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, 'rgba(0,0,0,.78)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, yy - hh, W, hh * 2); };
          const out = b => s.beat > b ? clamp(s.at(b + 1) / .5) : 0;
          if (s.beat === 1) { shade(by, 220 * k); text(g, 'Everything selected.', { x, y: by, size: (V.portrait ? 60 : 96) * k, font: 'Unbounded', weight: 300, color: '#fff', track: -.035, anim: 'glitch', maxW: W - 2 * x }, s.k(1, .2, 1.4, E.lin)); text(g, 'In August, Anthropic’s monitor reviewed over a billion agent actions and blocked about 1 in 47,000.', { x, y: by + 70 * k, size: 24 * k, font: 'Geist', color: 'rgba(255,255,255,.8)', anim: 'fade', maxW: W - 2 * x }, s.k(1, 1, 2, E.lin)); }
          if (s.beat === 2) {
            shade(by, 240 * k);
            text(g, 'So who’s holding\nthe mouse?', { x, y: by - 40 * k, size: (V.portrait ? 60 : 104) * k, font: 'Unbounded', weight: 300, color: '#fff', track: -.035, anim: 'decode', accent: '#ff5a4a', maxW: W - 2 * x }, s.k(2, .3, 1.6, E.lin));
            // a cursor that moves on its own
            const t = s.at(2), cx = W * (.62 + .2 * Math.sin(t * .9)), cy = H * (.45 + .2 * Math.sin(t * 1.3 + 1));
            g.save(); g.translate(cx, cy); g.scale(2.2 * k, 2.2 * k); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.2;
            g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 17); g.lineTo(4.5, 13); g.lineTo(7.5, 20); g.lineTo(10, 19); g.lineTo(7, 12); g.lineTo(13, 12); g.closePath(); g.fill(); g.stroke(); g.restore();
          }
          if (s.beat === 3) {
            shade(H * .5, H * .42);
            const L = [['Alignment.', 'Do systems far smarter than us want what we want, or only act like it while we watch?'], ['Control.', 'Once AI does most AI research, how do people keep a hand on the wheel?'], ['Power.', 'Whoever holds a superintelligence could out-lever any government in history.'], ['Speed.', 'Institutions move in years. This could move in months.']];
            L.forEach(([h, d], i) => {
              const y = H * .22 + i * 150 * k * (V.portrait ? 1.2 : 1), p = s.k(3, .2 + i * .35, 1.2 + i * .35, E.lin);
              text(g, h, { x, y, size: 54 * k, font: 'Unbounded', weight: 300, color: '#ff5a4a', track: -.03, anim: 'glitch' }, p);
              text(g, d, { x, y: y + 48 * k, size: 24 * k, font: 'Geist', color: 'rgba(255,255,255,.82)', anim: 'fade', maxW: W - 2 * x }, clamp(p * 1.4 - .3));
            });
          }
        },
      };
    },
  });
}

// ---------------------------------------------------------------- futures
{
  const mat = shader(`uniform float uT,uAsp,uSplit;
vec3 synthetic(vec2 p,float t){
  vec3 c=mix(vec3(.0,.02,.05),vec3(.0,.12,.2),smoothstep(-.1,.3,p.y));
  if(p.y<0.){ float z=.25/(-p.y+.001); vec2 g=vec2(p.x*z,z+t*.8); vec2 f=abs(fract(g)-.5); float l=max(1.-smoothstep(0.,.04*z,f.x),1.-smoothstep(0.,.04*z,f.y));
    c=vec3(.0,.02,.04)+vec3(.1,.9,1.)*l*exp(-z*.12)*.8; }
  for(int i=0;i<6;i++){ float fi=float(i); float x=(fi-2.5)*.28+sin(fi*3.)*.05; float h=.12+hash11(fi)*.35; float d=sdBox(p-vec2(x,h*.5),vec2(.035,h*.5)); c=mix(c,vec3(.01,.02,.03),1.-smoothstep(0.,.003,d)); c+=vec3(.1,.9,1.)*exp(-abs(d)*400.)*.5; }
  c+=vec3(.2,.9,1.)*exp(-abs(p.y)*80.)*.4;
  // falling data streams
  float col=floor(p.x*60.); float sp=.3+hash11(col)*.8; float y=fract(p.y*.6+t*sp*.25+hash11(col+3.));
  float on=step(.6,hash11(col+9.))*step(0.,p.y);
  c+=vec3(.15,1.,.8)*on*pow(y,18.)*.9+vec3(.05,.4,.4)*on*pow(y,4.)*.15*step(.5,fract(p.y*120.));
  return c; }
vec3 natural(vec2 p,float t){
  vec3 sky=mix(vec3(.95,.5,.28),vec3(.22,.38,.78),smoothstep(0.,.45,p.y));
  vec2 sp=vec2(.25,.08); float sd=length(p-sp); sky+=vec3(2.,1.3,.8)*exp(-sd*12.)*.8+vec3(20.)*smoothstep(.05,.04,sd);
  vec3 c=sky;
  // sun rays
  float ang=atan(p.y-sp.y,p.x-sp.x); c+=vec3(1.,.75,.45)*pow(.5+.5*sin(ang*14.+t*.2),6.)*exp(-sd*2.5)*.25*step(0.,p.y);
  // birds
  for(int b=0;b<7;b++){ float fb=float(b); vec2 bp=vec2(fract(t*.025*(1.+fb*.13)+fb*.17)*2.6-1.3,.18+.12*hash11(fb)+.02*sin(t*.5+fb));
    vec2 q=(p-bp)*vec2(1.,1.)*55.; float flap=sin(t*9.+fb*2.)*.35; float wing=abs(q.y-abs(q.x)*(.45+flap)); c=mix(c,vec3(.08,.06,.07),smoothstep(.22,.0,wing)*step(abs(q.x),1.)*.85); }
  for(int i=0;i<4;i++){ float fi=float(i); float h=-.02-fi*.08+fbm(vec2(p.x*(1.5+fi)+fi*7.,fi))*.18; if(p.y<h){ vec3 hc=mix(vec3(.55,.5,.3),vec3(.08,.18,.06),fi/3.); hc=mix(hc,sky*.6,.35/(1.+fi)); c=hc*(.85+.15*vnoise(p*80.)); } }
  // swaying grass in the foreground + fireflies
  float gl=-.42+.03*sin(p.x*40.+t*1.3)+.02*vnoise(vec2(p.x*90.,t*.6));
  if(p.y<gl) c=vec3(.03,.07,.02)*(1.+.4*vnoise(p*200.));
  for(int f=0;f<10;f++){ float ff=float(f); vec2 fp=vec2(hash11(ff)*2.4-1.2+.05*sin(t*.7+ff),-.38+.1*hash11(ff+4.)+.03*sin(t+ff*3.)); c+=vec3(1.,.85,.4)*exp(-length(p-fp)*260.)*(.5+.5*sin(t*3.+ff)); }
  return c; }
void main(){ vec2 p=(vUv-.5)*vec2(uAsp,1.);
  float edge=(uSplit-.5)*uAsp+sin(p.y*14.+uT*2.)*.012;
  float m=smoothstep(edge-.003,edge+.003,p.x);
  vec3 c=mix(synthetic(p,uT),natural(p,uT),m);
  c+=vec3(1.,.95,.85)*exp(-abs(p.x-edge)*220.)*.9;
  gl_FragColor=vec4(c,1.); }`, { uT: { value: 0 }, uAsp: { value: 1.78 }, uSplit: { value: .5 } });
  SCENES.push({
    id: 'futures', title: 'Two futures', enterWith: 'ink', hud: { color: '#ffffff' },
    beats: [{ dur: 2.5, hold: 6 }, { dur: 2.5, hold: 6 }],
    bed: { chord: [0, 4, 7, 11], oct: 4, cut: 1200, vol: .032, noise: { type: 'bandpass', freq: 700, vol: .05 }, level: [.45, .55] },
    notes: [
      'Same technology, two futures. Move the pointer across the screen. On one side, the world is handed over: capable, efficient, and no longer ours to steer. On the other, the same intelligence makes a world that is better for people: disease falls, poverty ends, and power stays spread out.',
      'Which side we land on is not decided by physics. It is decided by people, by the choices labs, governments and the rest of us make in the next few years.',
    ],
    create(ctx, s) {
      let split = .5, lastMove = -10, lastPx = null;
      return {
        update(s) {
          if (s.mouse.px !== lastPx) { lastPx = s.mouse.px; lastMove = s.t; }
          const target = s.t - lastMove < 3 && lastPx != null ? clamp(lastPx / V.W, .05, .95) : .5 + .3 * Math.sin(s.t * .35);
          split += (target - split) * (1 - Math.exp(-s.dt * 4));
          if (Math.random() < s.dt * 5) { if (Math.random() < split) AU.hit('bleep', 1.2); else AU.hit('chirp', 1.3); }
          if (s.bed) s.bed.param('noise', .02 + (1 - split) * .09);
          if (s.cross(0, .3)) AU.hit('kaleido'); if (s.cross(1, .4)) AU.hit('choir');
          s.split = split; s.post = { bloom: .45, threshold: 1.2, vignette: .45, grain: .03, ca: .0015, exposure: .85, contrast: 1.08 };
        },
        render(slot, s) { mat.uniforms.uT.value = s.t; mat.uniforms.uAsp.value = V.W / V.H; mat.uniforms.uSplit.value = s.split; pass(mat, slot.hdr); },
        draw2d(g, s) {
          const W = V.W, H = V.H, k = Math.min(W / 1920, H / 1080) * (V.portrait ? 1.6 : 1), x = (V.portrait ? 60 : 120) * k;
          text(g, 'Same technology.\nTwo futures.', { x: W / 2, y: H * .16, size: (V.portrait ? 54 : 84) * k, font: 'Unbounded', weight: 300, color: '#fff', align: 'center', track: -.035, anim: 'wave', glow: 'rgba(0,0,0,.5)' }, s.k(0, .2, 2, E.lin), s.on(1) ? clamp(s.at(1) / .5) : 0);
          g.font = `500 ${20 * k}px "Geist Mono", monospace`; g.fillStyle = 'rgba(255,255,255,.85)';
          const lx = s.split * W; g.textAlign = 'right'; g.fillText('HANDED OVER  ←', lx - 24 * k, H - 70 * k); g.textAlign = 'left'; g.fillText('→  FLOURISHING', lx + 24 * k, H - 70 * k);
          if (s.on(1)) text(g, 'Which side we land on\nis decided by people.\nIn the next few years.', { x: W / 2, y: H * .16, size: (V.portrait ? 50 : 76) * k, font: 'Unbounded', weight: 300, color: '#fff', align: 'center', track: -.035, anim: 'rise', glow: 'rgba(0,0,0,.5)' }, s.k(1, .4, 2, E.lin));
        },
      };
    },
  });
}

// ---------------------------------------------------------------- questions
// Finale: an hourglass whose sand flows UP. Time, given back.
{
  const mat = shader(`uniform float uT,uAsp,uRise; void main(){ vec2 p=(vUv-.5)*vec2(uAsp,1.);
  vec3 c=mix(vec3(.012,.012,.022),vec3(.32,.17,.1),smoothstep(.9,-.6,p.y)*uRise);
  c+=vec3(1.,.6,.35)*exp(-length(p-vec2(0.,-.75))*2.5)*uRise*.5;
  for(int i=0;i<18;i++){ float fi=float(i); vec2 o=vec2(sin(fi*7.3+uT*.03*(1.+hash11(fi))),cos(fi*3.1+uT*.025))*vec2(uAsp*.5,.45);
    float r=.03+hash11(fi+3.)*.07; float d=length(p-o); c+=vec3(1.,.75,.5)*smoothstep(r,r*.7,d)*.04*(.5+.5*sin(uT*.5+fi)); }
  gl_FragColor=vec4(c,1.); }`, { uT: { value: 0 }, uAsp: { value: 1.78 }, uRise: { value: 0 } });
  const SMALL = Math.min(innerWidth, innerHeight) < 700, NS = SMALL ? 14000 : 30000;
  const rb = yy => .06 + .62 * Math.pow(Math.sin(Math.min(1, Math.max(0, (yy - .04) / .92)) * Math.PI), .75);
  let scene3, cam, glass, sand, sMat, rig3;
  SCENES.push({
    id: 'questions', title: 'Questions', enterWith: 'daybreak', hud: { color: '#ffffff', alpha: .6 },
    beats: [{ dur: 5, hold: 8 }, { dur: 2, hold: 20 }],
    bed: { chord: [0, 4, 7, 14], oct: 3, cut: 1000, vol: .04, choir: .15, arp: { notes: [14, 11, 9, 7, 4], oct: 5, rate: .8, voice: 'fm', ratio: 3.5, index: 1, len: 2, vol: .018, delay: .5 }, level: [.6, .45] },
    notes: [
      'If it goes well, the most precious thing it gives us back is time. The sand is running the other way. So: what will you do with it?',
      'Sources: Metaculus community forecasts and AI Impacts expert surveys; DataReportal Digital 2026; hyperscaler 2026 capex guidance and BloombergNEF; IMO 2025 gold-level results; Humanity\'s Last Exam leaderboards; AlphaFold and the 2024 Nobel Prize in Chemistry; METR time-horizon research (2025–2026); Anthropic, September 2026 report on AI-led R&D; OpenAI, September 2026 Navier–Stokes announcement (under review); Alpöge and Claude, Lean proof of the Riemann hypothesis (Nov 2026); Dario Amodei, “Machines of Loving Grace” (2024).',
    ],
    create() {
      scene3 = new THREE.Scene(); cam = new THREE.PerspectiveCamera(36, 1.78, .1, 50); rig3 = new THREE.Group(); scene3.add(rig3);
      scene3.add(new THREE.HemisphereLight(0xffe2c0, 0x1a1020, .9)); const kl = new THREE.DirectionalLight(0xffd9a8, 2.6); kl.position.set(2, 3, 4); scene3.add(kl);
      // glass: a lathe of the bulb profile, drawn as a fresnel shell with a moving highlight
      const prof = []; for (let i = 0; i <= 80; i++) { const y = -1 + i / 40; prof.push(new THREE.Vector2(rb(Math.abs(y)) + .035, y)); }
      glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), shader(`varying vec3 vN; varying vec3 vV; uniform float uT;
void main(){ vec3 n=normalize(vN), v=normalize(vV); float f=pow(1.-abs(dot(n,v)),2.2);
  float hl=exp(-pow((n.x+.55+.08*sin(uT*.6))*9.,2.))*.9+exp(-pow((n.x-.7)*14.,2.))*.35;
  gl_FragColor=vec4(vec3(.75,.88,1.)*(f*.32+.012)+vec3(1.)*hl*.22,1.); }`, { uT: { value: 0 } },
        { blend: 'add', side: THREE.DoubleSide, vert: `varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalMatrix*normal; vV=-mv.xyz; vUv=uv; gl_Position=projectionMatrix*mv; }` }));
      glass.material.depthWrite = false; glass.renderOrder = 3;
      const brass = new THREE.MeshStandardMaterial({ color: 0xc99145, metalness: .85, roughness: .32 });
      const capT = new THREE.Mesh(new THREE.CylinderGeometry(.82, .82, .09, 48), brass); capT.position.y = 1.05;
      const capB = capT.clone(); capB.position.y = -1.05;
      rig3.add(glass, capT, capB);
      for (let i = 0; i < 3; i++) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 2.1, 12), brass); const a = i / 3 * 6.283 + .4; post.position.set(Math.cos(a) * .74, 0, Math.sin(a) * .74); rig3.add(post); }
      // sand: every grain knows its rank; ranks below the fill level sit in the TOP bulb (time flowing back), a thin band streams up the neck
      const sp = new Float32Array(NS * 3), sa = new Float32Array(NS * 4); for (let i = 0; i < NS; i++) sa.set([i / NS, Math.random() * 6.283, Math.random(), Math.random()], i * 4);
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aS', new THREE.BufferAttribute(sa, 4));
      sMat = shader(`varying vec3 vC; void main(){ vec2 c=gl_PointCoord-.5; if(dot(c,c)>.25) discard; gl_FragColor=vec4(vC,1.); }`, { uF: { value: 0 }, uT: { value: 0 }, uPx: { value: 1 } },
        { depth: true, vert: `attribute vec4 aS; uniform float uF,uT,uPx; varying vec3 vC; varying vec2 vUv;
float rb(float yy){ return .06+.62*pow(sin(clamp((yy-.04)/.92,0.,1.)*3.14159),.75); }
void main(){ float q=aS.x, f=uF, w=.012; float ht=f*.82, hb=(1.-f)*.82; vec3 p; float lit=1.;
  if(q<f){ float u=q/max(f,1e-4); float y=.95-u*ht; float r=rb(abs(y))*.9*sqrt(aS.z); p=vec3(cos(aS.y)*r,y,sin(aS.y)*r); }
  else if(q<f+w){ float u=(q-f)/w; u=fract(u+uT*1.3); float y=mix(-.95+hb,.95-ht,u); float r=.012*sqrt(aS.z); p=vec3(cos(aS.y)*r,y,sin(aS.y)*r); lit=1.6; }
  else { float u=(q-f-w)/max(1.-f-w,1e-4); float y=-.95+u*hb; float r=rb(abs(y))*.9*sqrt(aS.z); p=vec3(cos(aS.y)*r,y,sin(aS.y)*r); }
  vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(uPx*.012/-mv.z,1.,4.);
  vC=mix(vec3(.95,.62,.25),vec3(1.,.85,.5),aS.w)*(.55+.45*aS.z)*lit; vUv=vec2(0.); }` });
      sand = new THREE.Points(sg, sMat); sand.frustumCulled = false; rig3.add(sand);
      return {
        update(s) {
          s.post = { bloom: .45, threshold: 1.2, vignette: .5, grain: .03, ca: .001, streak: .15 };
          sMat.uniforms.uF.value = Math.min(.96, s.t * .035); sMat.uniforms.uT.value = s.t; sMat.uniforms.uPx.value = V.H;
          glass.material.uniforms.uT.value = s.t;
          const port = V.portrait, gone = port && s.on(1) ? s.k(1, 0, 1) : 0;
          rig3.position.set(port ? 0 : 1.55, port ? -.55 : -.05, 0); rig3.rotation.set(.08 + s.mouse.y * .1, s.t * .12 + s.mouse.x * .4, Math.sin(s.t * .3) * .03);
          rig3.scale.setScalar(Math.max(.001, E.outBack(s.k(0, .2, 1.6, E.lin)) * (port ? .82 : 1) * (1 - gone)));
          cam.position.set(0, .15, port ? 7.4 : 5.2); cam.lookAt(0, 0, 0); cam.aspect = V.W / V.H; cam.updateProjectionMatrix();
          if (s.cross(0, 1.2)) AU.hit('glass'); if (s.cross(0, 3)) AU.hit('rise'); if (s.cross(0, 1.6)) AU.hit('choir'); if (s.cross(1, .3)) AU.hit('bell'); for (let i = 0; i < 8; i++) if (s.cross(1, .2 + i * .15)) AU.hit('type');
          if (Math.random() < s.dt * 7) AU.hit('scratch');
        },
        render(slot, s) { mat.uniforms.uT.value = s.t; mat.uniforms.uAsp.value = V.W / V.H; mat.uniforms.uRise.value = s.k(0, 0, 5, E.io2); pass(mat, slot.hdr); R.setRenderTarget(slot.hdr); R.render(scene3, cam); },
        draw2d(g, s) {
          const W = V.W, H = V.H, k = Math.min(W / 1920, H / 1080) * (V.portrait ? 1.6 : 1), port = V.portrait, x = port ? W / 2 : 130 * k;
          text(g, 'What will you do\nwith the time?', { x, y: port ? H * .13 : H * .36, size: (port ? 72 : 128) * k, font: 'Newsreader', italic: true, weight: 400, color: '#fbf6ec', align: port ? 'center' : 'left', valign: 'middle', track: -.02, lh: 1.02, anim: 'blur', by: 'word', stagger: .6, glow: 'rgba(255,170,90,.25)' }, s.k(0, 1.2, 4.2, E.lin));
          if (s.on(1)) {
            const src = ['Metaculus forecasts (2020; Feb 2026) · AI Impacts expert surveys (2022, 2023)', 'METR · time-horizon research, 2025–2026', 'Anthropic · AI-led R&D report, Sep 2026 (self-reported)', 'DataReportal Digital 2026 · 2026 hyperscaler capex plans (guidance, BNEF)', 'IMO 2025 gold-level results · Humanity’s Last Exam leaderboards', 'AlphaFold DB · 2024 Nobel Prize in Chemistry', 'OpenAI Navier–Stokes (under review) · Alpöge & Claude, Lean proof of RH', 'Dario Amodei · “Machines of Loving Grace”, 2024'];
            src.forEach((l, i) => text(g, l, { x, y: (port ? H * .7 : H * .6) + i * 27 * k, size: (port ? 15 : 18) * k, font: 'Geist Mono', weight: 400, color: 'rgba(251,246,236,.62)', align: port ? 'center' : 'left', anim: 'decode', accent: '#ffb36b', maxW: port ? W - 40 * k : W * .5 }, s.k(1, .2 + i * .15, 1.2 + i * .15, E.lin)));
          }
        },
      };
    },
  });
}
