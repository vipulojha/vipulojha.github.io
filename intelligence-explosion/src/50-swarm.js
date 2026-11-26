// =====================================================================
// 50 · SWARM — "A country of them". One warm agent in the dark, then
// thirty thousand, then a field without edges. Light-streak arcs show
// agents handing work to each other. A rolling odometer of thought.
// =====================================================================
import { SCENES, THREE, R, clamp, lerp, E, rig, prng, shader, V, text, AU } from './00-core.js';

{
  const G = 640, SP = 1.0; // grid of agents
  const CREAM = '#fbf6ec';
  const KEYS = [
    { u: 0, pos: [1.6, .7, 2.6], look: [0, .25, 0], fov: 38 },
    { u: .9, pos: [3, 1.6, 6], look: [0, .2, 0], fov: 40 },
    { u: 1.2, pos: [40, 26, 95], look: [0, 0, 0], fov: 44 },
    { u: 2, pos: [95, 70, 170], look: [0, -5, 0], fov: 46 },
    { u: 2.6, pos: [-120, 60, 150], look: [0, 0, 0], fov: 46 },
    { u: 3, pos: [-60, 140, 260], look: [0, 0, -20], fov: 50 },
    { u: 4, pos: [0, 520, 760], look: [0, 0, -160], fov: 54 },
  ];
  const RADII = [.01, Math.sqrt(30000 / Math.PI), Math.sqrt(30000 / Math.PI), 300];
  let scene3, cam, agents, arcs, flies, ground;
  function odometer(g, x, y, v, size, color) {
    const digits = Math.max(1, Math.floor(Math.log10(Math.max(1, v))) + 1), str = [];
    g.font = `300 ${size}px Unbounded, sans-serif`; const cw = g.measureText('0').width * 1.02, cmw = g.measureText(',').width;
    let cx = x;
    for (let i = digits - 1; i >= 0; i--) {
      const d = Math.floor(v / 10 ** i) % 10; let roll = 0;
      const lower = v % 10 ** i; if (i === 0) roll = v % 1; else if (lower >= 10 ** i - 1) roll = lower - (10 ** i - 1);
      roll = E.io3(clamp((roll - .7) / .3));
      g.save(); g.beginPath(); g.rect(cx - 4, y - size * 1.02, cw + 8, size * 1.25); g.clip(); g.fillStyle = color;
      g.fillText(d, cx, y - roll * size * 1.15); g.fillText((d + 1) % 10, cx, y + (1 - roll) * size * 1.15); g.restore();
      cx += cw; if (i % 3 === 0 && i) { g.fillStyle = color; g.fillText(',', cx, y); cx += cmw; }
    }
    return cx;
  }
  SCENES.push({
    id: 'swarm', title: 'A country of them', enterWith: 'zoomblur', hud: { color: CREAM },
    beats: [{ dur: 3, hold: 3, page: '1' }, { dur: 4, hold: 3, page: '30,000' }, { dur: 11, hold: 2, page: '10,000' }, { dur: 6, hold: 6, page: '1,000,000' }],
    bed: { chord: [0, 4, 7, 9, 11], oct: 3, cut: 900, vol: .028, choir: .1, arp: { notes: [4, 7, 9, 11, 14, 16], oct: 6, rate: 1, voice: 'fm', ratio: 3, index: .6, len: 1.2, vol: .022, delay: .5 }, level: [.3, .5, .6, .75] },
    notes: [
      'One agent. One small warm light working in the dark.',
      'In August 2026, about 30,000 AI agents were running at the same time on Anthropic\'s main internal research platform. Every one of their actions passed through an automated monitor.',
      'In September, OpenAI said that a swarm growing to 10,000 agents, running for 88 hours, produced a proof that the Navier–Stokes equations can blow up in finite time. That claim is still under independent review. Then in November, Levent Alpöge and Claude released a 17-million-line Lean proof of the Riemann hypothesis, which the Lean community certified on November 21, with some independent checks still running.',
      'Now picture a million of them, each thinking fifty times faster than you. That is about 1.6 years of thought every second. The counter is an illustration of that rate, not a measurement.',
    ],
    create(ctx, s) {
      scene3 = new THREE.Scene(); cam = new THREE.PerspectiveCamera(40, 1.78, .05, 6000);
      const n = G * G, pos = new Float32Array(n * 3), seed = new Float32Array(n), rr = prng(5);
      for (let j = 0, i = 0; j < G; j++) for (let k = 0; k < G; k++, i++) {
        const x = (k - G / 2) * SP + (rr() - .5) * .6, z = (j - G / 2) * SP + (rr() - .5) * .6; pos.set([x, 0, z], i * 3); seed[i] = rr();
      }
      pos.set([0, 0, 0], ((G / 2) * G + G / 2) * 3);
      const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(pos, 3)); ag.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      const am = shader(`varying float vA; varying float vH; void main(){ vec2 c=gl_PointCoord-.5; float d=dot(c,c); float g=exp(-d*28.)+exp(-d*9.)*.25; gl_FragColor=vec4(vec3(1.,.62,.3)*g*vA*(1.+vH*2.),1.); }`,
        { uR: { value: 1 }, uT: { value: 0 }, uPx: { value: 1 } },
        { blend: 'add', vert: `attribute float aSeed; uniform float uR,uT,uPx; varying float vA; varying float vH; varying vec2 vUv;
void main(){ float d=length(position.xz); float vis=smoothstep(uR+1.5,uR-1.5,d); if(d<.01) vis=1.;
  float work=pow(.5+.5*sin(uT*(1.+aSeed*3.)+aSeed*60.),12.); float front=exp(-pow((d-uR)/2.5,2.))*step(2.,uR); vH=work+front*2.5;
  vec3 p=position+vec3(0.,.12+.04*sin(uT*2.+aSeed*20.),0.);
  vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
  float hero=d<.01?1.6:1.; gl_PointSize=clamp(uPx*.09*hero/-mv.z,1.6,46.)*(vis>0.?1.:0.);
  vA=vis*(.55+.45*aSeed)*hero*(1.-smoothstep(300.,900.,-mv.z)*.6); vUv=vec2(0.); }` });
      am.depthTest = false; agents = new THREE.Points(ag, am); agents.frustumCulled = false;
      // light-streak arcs
      const NA = 900, SEG = 24, ap = new Float32Array(NA * SEG * 2 * 3), at = new Float32Array(NA * SEG * 2 * 3);
      for (let a = 0; a < NA; a++) {
        const r0 = Math.sqrt(rr()) * 320, an = rr() * 6.283, A = [Math.cos(an) * r0, 0, Math.sin(an) * r0];
        const d = 3 + rr() * 30, bn = rr() * 6.283, B = [A[0] + Math.cos(bn) * d, 0, A[2] + Math.sin(bn) * d];
        const end = Math.max(Math.hypot(A[0], A[2]), Math.hypot(B[0], B[2])), sd = rr();
        for (let k = 0; k < SEG; k++) for (let e = 0; e < 2; e++) {
          const t = (k + e) / SEG, i = ((a * SEG + k) * 2 + e) * 3;
          ap.set([lerp(A[0], B[0], t), Math.sin(t * Math.PI) * d * .45 + .12, lerp(A[2], B[2], t)], i); at.set([t, sd, end], i);
        }
      }
      const arg = new THREE.BufferGeometry(); arg.setAttribute('position', new THREE.BufferAttribute(ap, 3)); arg.setAttribute('aT', new THREE.BufferAttribute(at, 3));
      const arm = shader(`varying float vA; void main(){ gl_FragColor=vec4(vec3(1.,.8,.55)*vA,1.); }`, { uR: { value: 0 }, uT: { value: 0 }, uOn: { value: 0 } },
        { blend: 'add', vert: `attribute vec3 aT; uniform float uR,uT,uOn; varying float vA; varying vec2 vUv;
void main(){ float ph=fract(uT*.35+aT.y); float pulse=exp(-pow((aT.x-ph*1.4+.2)*7.,2.));
  vA=uOn*step(aT.z,uR)*(pulse*1.6+.05); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); vUv=vec2(0.); }` });
      arm.depthTest = false; arcs = new THREE.LineSegments(arg, arm); arcs.frustumCulled = false;
      // fireflies around the first lamp
      const fn = 90, fp = new Float32Array(fn * 3); for (let i = 0; i < fn; i++) fp.set([rr(), rr(), rr()], i * 3);
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
      const fm = shader(`varying float vA; void main(){ vec2 c=gl_PointCoord-.5; gl_FragColor=vec4(vec3(1.,.85,.5)*exp(-dot(c,c)*30.)*vA,1.); }`, { uT: { value: 0 }, uPx: { value: 1 } },
        { blend: 'add', vert: `uniform float uT,uPx; varying float vA; varying vec2 vUv;
void main(){ vec3 s=position; float t=uT*(.2+s.x*.3)+s.y*30.;
  vec3 p=vec3(sin(t)*(1.+s.z*3.),.4+.6*s.y+sin(t*1.7)*.3,cos(t*.8)*(1.+s.x*3.));
  vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.,uPx*.012/-mv.z); vA=.6+.4*sin(uT*5.+s.z*40.); vUv=vec2(0.); }` });
      fm.depthTest = false; flies = new THREE.Points(fg, fm); flies.frustumCulled = false;
      ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), shader(`varying vec3 vW; uniform float uR;
void main(){ float d=length(vW.xz); vec3 c=vec3(.01,.011,.016)*(.7+.3*vnoise(vW.xz*.3));
  c+=vec3(1.,.6,.3)*.22/(1.+d*d*2.5);
  c+=vec3(1.,.55,.28)*.028*smoothstep(uR+4.,uR*.6,d); c+=vec3(1.,.7,.4)*.12*exp(-pow((d-uR)/4.,2.))*step(2.,uR);
  float f=1.-exp(-length(vW-cameraPosition)*.0016); c=mix(c,vec3(.015,.016,.03),f);
  gl_FragColor=vec4(c,1.); }`, { uR: { value: 1 } }, { depth: true, vert: `varying vec3 vW; varying vec2 vUv; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vUv=uv; gl_Position=projectionMatrix*viewMatrix*w; }` }));
      ground.rotation.x = -Math.PI / 2; scene3.add(ground, arcs, agents, flies);
      let rad = .01, snap = true;
      return {
        enter(s, atEnd) { rad = atEnd ? RADII[3] : .01; snap = true; },
        beat(s) { if (s.dir < 0) rad = RADII[s.beat] || .01; },
        update(s) {
          const u = s.p[0] + s.p[1] + s.p[2] + s.p[3];
          const k = rig(KEYS, u, ['pos', 'look', 'fov']);
          cam.position.set(k.pos[0] + s.mouse.x * k.pos[1] * .15 + Math.sin(s.t * .2) * k.pos[1] * .03, k.pos[1] + s.mouse.y * k.pos[1] * .1, k.pos[2]);
          cam.lookAt(...k.look); cam.fov = V.portrait ? k.fov * 1.5 : k.fov; cam.aspect = V.W / V.H; cam.updateProjectionMatrix();
          const target = s.beat >= 1 ? RADII[s.beat] : .01; if (snap) { rad = target; snap = false; }
          rad = s.beat >= 1 ? Math.exp(lerp(Math.log(Math.max(rad, .01)), Math.log(target), 1 - Math.exp(-s.dt * 2.2))) : lerp(rad, .01, 1 - Math.exp(-s.dt * 3));
          agents.material.uniforms.uR.value = rad; agents.material.uniforms.uT.value = s.t; agents.material.uniforms.uPx.value = V.H * 1.6;
          arcs.material.uniforms.uR.value = rad; arcs.material.uniforms.uT.value = s.t; arcs.material.uniforms.uOn.value = clamp(rad / 20);
          flies.material.uniforms.uT.value = s.t; flies.material.uniforms.uPx.value = V.H * 1.6;
          ground.material.uniforms.uR.value = rad;
          s.post = { streak: .45, bloom: .75, threshold: .6, exposure: 1.1, vignette: .55, grain: .028, ca: .0015, halation: .5, lift: [.0, .006, .02] };
          if (s.cross(1, 0) || s.cross(3, 0)) AU.hit('riser'); if (s.cross(2, .1)) AU.hit('whoosh'); if (s.cross(2, 5.4)) AU.hit('bell'); if (s.cross(0, .4)) AU.hit('glass');
          if (s.bed) { s.bed.param('arpRate', [.8, 3, 5, 10][s.beat]); s.bed.param('choir', [.06, .12, .16, .22][s.beat]); }
          if (s.on(3) && Math.floor(s.at(3)) !== Math.floor(s.at(3) - s.dt) && s.at(3) > 1.5) AU.hit('tick');
          if (s.cross(2, 5.6)) AU.hit('choir'); if (s.cross(1, 1)) AU.hit('sparkle');
        },
        render(slot) { R.setRenderTarget(slot.hdr); R.setClearColor(new THREE.Color(.008, .009, .016), 1); R.clear(); R.render(scene3, cam); },
        draw2d(g, s) {
          const W = V.W, H = V.H, k = Math.min(W / 1920, H / 1080) * (V.portrait ? 1.6 : 1), x = (V.portrait ? 60 : 120) * k, big = (V.portrait ? 64 : 104) * k;
          const vg = g.createRadialGradient(x + 300 * k, H * .78, 10, x + 300 * k, H * .78, 900 * k); vg.addColorStop(0, 'rgba(0,0,0,.45)'); vg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
          const head = (str, b, t0, t1, y, out) => text(g, str, { x, y, size: big, font: 'Unbounded', weight: 300, color: CREAM, track: -.035, lh: 1.06, anim: 'blur', by: 'word', maxW: W - x * 2 }, s.k(b, t0, t1, E.lin), out);
          const cap = (str, b, t0, y, out) => text(g, str, { x, y, size: 23 * k, font: 'Geist', weight: 400, color: 'rgba(251,246,236,.72)', anim: 'fade', maxW: W - x * 2 }, s.k(b, t0, t0 + 1, E.lin), out);
          const yb = V.portrait ? H * .7 : H * .74;
          const outOf = b => s.beat > b ? clamp(s.at(b + 1) / .6) : 0;
          if (s.beat === 0 || (s.beat === 1 && outOf(0) < 1)) head('One.', 0, .6, 1.8, yb, outOf(0));
          if (s.beat >= 1 && outOf(1) < 1) { head('30,000 at once.', 1, .8, 2.2, yb, outOf(1)); cap('Agents at work on Anthropic’s main internal platform · August 2026', 1, 1.8, yb + 70 * k, outOf(1)); }
          if (s.beat >= 2 && outOf(2) < 1) {
            const q1 = Math.max(outOf(2), clamp((s.at(2) - 5.2) / .6));
            head('10,000 of them, 88 hours:\nNavier–Stokes.', 2, .3, 1.8, yb - big * 1.1, q1); cap('OpenAI, September 2026 · claimed blow-up proof, under independent review', 2, 1.4, yb + 70 * k, q1);
            if (s.at(2) > 5.6) { head('17 million lines of proof:\nthe Riemann hypothesis.', 2, 5.8, 7.4, yb - big * 1.1, outOf(2)); cap('Levent Alpöge with Claude · Lean proof certified by the Lean community, 21 Nov 2026', 2, 7, yb + 70 * k, outOf(2)); }
          }
          if (s.beat >= 3) {
            head('Now a million of them,\nat fifty times your speed.', 3, .4, 2, H * (V.portrait ? .16 : .2));
            const yrs = Math.max(0, s.at(3) - 1.5) * 1e6 * 50 / 31557600;
            const a = s.k(3, 1.6, 2.4, E.lin); g.globalAlpha = a;
            const ex = odometer(g, x, yb + 20 * k, yrs, 120 * k, CREAM);
            g.font = `300 ${44 * k}px Unbounded, sans-serif`; g.fillStyle = CREAM; g.fillText(' years of thought', ex, yb + 20 * k);
            g.font = `400 ${18 * k}px "Geist Mono", monospace`; g.fillStyle = 'rgba(251,246,236,.55)'; g.fillText('ILLUSTRATION · 1,000,000 × 50 = ~1.6 years of thinking per second', x, yb + 80 * k);
            g.globalAlpha = 1;
          }
        },
      };
    },
  });
}
