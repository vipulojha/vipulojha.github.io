// =====================================================================
// 55 · GIGAWATTS — the build-out. A night continent; a billion small
// lights of demand; then data centres erupt from the ground in clusters,
// power lines pulse between them, and lightning cracks across the grid.
// =====================================================================
import { SCENES, THREE, R, clamp, lerp, E, rig, prng, shader, V, text, AU } from './00-core.js';

{
  const NB = 900, CL = 14;
  const KEYS = [
    { u: 0, pos: [0, 420, 420], look: [0, 0, 0], fov: 46 },
    { u: 1, pos: [160, 220, 330], look: [0, 10, 0], fov: 44 },
    { u: 2, pos: [-120, 90, 210], look: [10, 30, 0], fov: 46 },
    { u: 3, pos: [-40, 60, 150], look: [10, 40, 0], fov: 50 },
  ];
  let scene3, cam, blds, bMat, lights, lMat, lines, lnMat, bolt, boltGeo, ground;
  const rr = prng(21), clusters = [];
  for (let i = 0; i < CL; i++) clusters.push([(rr() - .5) * 520, (rr() - .5) * 360, .6 + rr() * .8]);
  SCENES.push({
    id: 'gigawatts', title: 'The build-out', enterWith: 'flaps', hud: { color: '#ffd36b' },
    beats: [{ dur: 3, hold: 4 }, { dur: 4, hold: 4 }, { dur: 4, hold: 5 }],
    bed: { chord: [0, 2, 7], oct: 2, cut: 450, vol: .045, wave: 'sawtooth', hum: .018, sub: .12, noise: { brown: true, type: 'lowpass', freq: 250, vol: .18 }, level: [.3, .45, .65] },
    notes: [
      'Demand first. DataReportal\'s Digital 2026 report counts more than a billion people using AI tools. ChatGPT alone reported around 900 million weekly users in February 2026.',
      'Then supply. The big cloud companies plan roughly $700 billion of capital spending in 2026, most of it for AI data centres, close to double 2025. Estimates vary by source and by how you count.',
      'And it is measured in power now, not chips. Meta\'s Louisiana campus is planned to scale to 5 gigawatts. A common rule of thumb is about $50 billion per gigawatt of AI capacity. Over 23 gigawatts of data centres were under construction worldwide in late 2025.',
    ],
    create() {
      scene3 = new THREE.Scene(); cam = new THREE.PerspectiveCamera(46, 1.78, 1, 6000);
      // ground: night continent with coastline + a billion lights (procedural)
      ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), shader(`varying vec3 vW; uniform float uT,uPop,uGrid;
void main(){ vec2 p=vW.xz;
  float land=fbm(p*.0022+3.)+.12*fbm(p*.01); float isL=smoothstep(.46,.5,land);
  vec3 c=mix(vec3(.004,.008,.02),vec3(.012,.012,.018),isL);
  float coast=exp(-abs(land-.48)*120.); c+=vec3(.1,.3,.5)*coast*.25;
  // city lights: clustered, twinkling
  vec2 g=floor(p*.35); float h=hash12(g); float dens=smoothstep(.55,.85,fbm(p*.006+9.))*isL;
  float on=step(1.-dens*.8*uPop,h); vec2 f=fract(p*.35)-.5; float dot1=exp(-dot(f,f)*40.);
  c+=vec3(1.,.72,.35)*on*dot1*(.6+.4*sin(uT*2.+h*40.))*3.;
  c+=vec3(1.,.6,.3)*dens*uPop*.09;
  // power grid lines
  vec2 q=abs(fract(p/60.)-.5); float gl=(1.-smoothstep(0.,fwidth(p.x/60.)*1.5,q.x))+(1.-smoothstep(0.,fwidth(p.y/60.)*1.5,q.y));
  c+=vec3(.2,.6,1.)*gl*.18*uGrid*isL;
  float f2=1.-exp(-length(vW-cameraPosition)*.0009); c=mix(c,vec3(.01,.012,.03),f2);
  gl_FragColor=vec4(c,1.); }`, { uT: { value: 0 }, uPop: { value: 0 }, uGrid: { value: 0 } }, { depth: true, vert: `varying vec3 vW; varying vec2 vUv; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vUv=uv; gl_Position=projectionMatrix*viewMatrix*w; }` }));
      ground.rotation.x = -Math.PI / 2; scene3.add(ground);
      // data centres: instanced boxes that erupt, with glowing window bands and hot roofs
      const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, .5, 0);
      bMat = shader(`varying vec3 vL; varying vec3 vN; varying float vS; varying float vRise; uniform float uT;
void main(){ vec3 base=vec3(.02,.022,.03);
  float bands=step(.55,fract(vL.y*14.))*step(.08,abs(vN.y-1.));
  float flick=.7+.3*sin(uT*3.+vS*50.);
  vec3 col=base+vec3(.25,.7,1.)*bands*.9*flick*vRise;
  if(vN.y>.5) col=vec3(1.,.55,.2)*1.6*vRise*(.7+.3*sin(uT*1.5+vS*9.));
  col*=.6+.4*max(dot(vN,normalize(vec3(.4,.8,.3))),0.);
  gl_FragColor=vec4(col,1.); }`, { uT: { value: 0 }, uRise: { value: 0 } }, { depth: true, vert: `attribute float aSeed; uniform float uT,uRise; varying vec3 vL; varying vec3 vN; varying float vS; varying float vRise; varying vec2 vUv;
void main(){ float k=clamp((uRise*1.6-aSeed*.6),0.,1.); float e=1.-pow(1.-k,4.); float ov=1.+sin(k*3.14159)*.15;
  vec3 p=position; p.y*=max(e*ov,.001);
  vec4 w=modelMatrix*instanceMatrix*vec4(p,1.); vL=position; vN=normalize(mat3(instanceMatrix)*normal); vS=aSeed; vRise=e; vUv=vec2(0.);
  gl_Position=projectionMatrix*viewMatrix*w; if(e<.01) gl_Position=vec4(2.,2.,2.,1.); }` });
      blds = new THREE.InstancedMesh(geo, bMat, NB); const seeds = new Float32Array(NB); const M = new THREE.Matrix4();
      for (let i = 0; i < NB; i++) {
        const c = clusters[i % CL], a = rr() * 6.283, r = Math.sqrt(rr()) * 38 * c[2];
        const w = 3 + rr() * 9, d = 3 + rr() * 9, hgt = (6 + rr() * 28) * (1.3 - r / 60) * c[2];
        M.compose(new THREE.Vector3(c[0] + Math.cos(a) * r, 0, c[1] + Math.sin(a) * r), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rr() - .5) * .3), new THREE.Vector3(w, hgt, d));
        blds.setMatrixAt(i, M); seeds[i] = (i % CL) / CL * .7 + rr() * .3;
      }
      geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1)); blds.frustumCulled = false; scene3.add(blds);
      // power lines between clusters with travelling pulses
      const SEG = 40, pl = [], pt = [];
      for (let i = 0; i < CL; i++) for (let j = i + 1; j < CL; j++) {
        const A = clusters[i], B = clusters[j], d = Math.hypot(A[0] - B[0], A[1] - B[1]); if (d > 260) continue; const sd = rr();
        for (let k = 0; k < SEG; k++) for (let e = 0; e < 2; e++) { const t = (k + e) / SEG; pl.push(lerp(A[0], B[0], t), 2 + Math.sin(t * Math.PI) * d * .12, lerp(A[1], B[1], t)); pt.push(t, sd, d); }
      }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pl, 3)); lg.setAttribute('aT', new THREE.Float32BufferAttribute(pt, 3));
      lnMat = shader(`varying float vA; void main(){ gl_FragColor=vec4(vec3(.35,.8,1.)*vA,1.); }`, { uT: { value: 0 }, uOn: { value: 0 } }, { blend: 'add', vert: `attribute vec3 aT; uniform float uT,uOn; varying float vA; varying vec2 vUv;
void main(){ float ph=fract(uT*.5+aT.y); float pulse=exp(-pow((aT.x-ph)*12.,2.)); vA=uOn*(.12+pulse*2.2)*step(aT.x,uOn*1.2); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); vUv=vec2(0.); }` });
      lnMat.depthTest = false; lines = new THREE.LineSegments(lg, lnMat); lines.frustumCulled = false; scene3.add(lines);
      // lightning: rebuilt every few frames as jagged polylines between cluster tops and the sky
      boltGeo = new THREE.BufferGeometry(); boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 2 * 16 * 3), 3));
      bolt = new THREE.LineSegments(boltGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(4, 4.5, 6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false }));
      bolt.frustumCulled = false; scene3.add(bolt);
      let boltT = 0;
      function makeBolts() {
        const a = boltGeo.attributes.position.array; let n = 0;
        for (let b = 0; b < 6; b++) {
          const c = clusters[(Math.random() * CL) | 0], top = [c[0] + (Math.random() - .5) * 30, 30 + Math.random() * 20, c[1] + (Math.random() - .5) * 30];
          let p = [top[0] + (Math.random() - .5) * 60, 260, top[2] + (Math.random() - .5) * 60];
          for (let s = 0; s < 16; s++) { const t = (s + 1) / 16; const q = [lerp(p[0], top[0], .25) + (Math.random() - .5) * 26 * (1 - t), lerp(p[1], top[1], 1 / (16 - s)), lerp(p[2], top[2], .25) + (Math.random() - .5) * 26 * (1 - t)]; a.set(p, n); a.set(q, n + 3); n += 6; p = q; }
        }
        boltGeo.attributes.position.needsUpdate = true;
      }
      let flash = 0;
      return {
        update(s) {
          const u = s.p[0] + s.p[1] + s.p[2]; const k = rig(KEYS, u, ['pos', 'look', 'fov']);
          cam.position.set(k.pos[0] + Math.sin(s.t * .1) * 20 + s.mouse.x * 30, k.pos[1] + s.mouse.y * 20, k.pos[2]); cam.lookAt(...k.look);
          cam.fov = V.portrait ? k.fov * 1.5 : k.fov; cam.aspect = V.W / V.H; cam.updateProjectionMatrix();
          ground.material.uniforms.uT.value = s.t; ground.material.uniforms.uPop.value = s.k(0, .2, 2.6); ground.material.uniforms.uGrid.value = s.k(1, 0, 2);
          bMat.uniforms.uT.value = s.t; bMat.uniforms.uRise.value = s.k(1, .2, 3.6, E.lin);
          lnMat.uniforms.uT.value = s.t; lnMat.uniforms.uOn.value = s.k(2, 0, 1.5, E.lin);
          boltT -= s.dt; flash *= Math.exp(-s.dt * 9);
          if (s.on(2) && boltT <= 0) { makeBolts(); boltT = .12 + Math.random() * .5; if (Math.random() < .5) { flash = 1; AU.hit('zap'); AU.hit('thunder', 0, .15 + Math.random() * .4); } }
          bolt.material.opacity = s.on(2) ? flash : 0;
          s.post = { streak: .5, flare: .2, bloom: .75 + flash * .6, threshold: .8, exposure: 1 + flash * .5, vignette: .55, grain: .035, ca: .0015 + flash * .006, halation: .5 };
          if (s.cross(1, .3)) AU.hit('riser'); if (s.cross(1, 2.4)) AU.hit('boom'); if (s.cross(2, 0)) AU.hit('sub');
          for (const t of [.5, .9, 1.3, 1.7, 2.1, 2.6, 3.1]) if (s.cross(1, t)) AU.hit('stomp');
          if (s.cross(0, .4)) AU.hit('sparkle'); if (s.cross(0, .4)) AU.hit('glitch'); if (s.cross(1, 1.6)) AU.hit('ding');
          if (s.on(2)) for (let i = 0; i < 3; i++) if (s.cross(2, 1.2 + i * .5)) AU.hit('type');
          if (s.bed) s.bed.param('noise', s.on(2) ? .3 : .15);
        },
        render(slot) { R.setRenderTarget(slot.hdr); R.setClearColor(new THREE.Color(.004, .005, .014), 1); R.clear(); R.render(scene3, cam); },
        draw2d(g, s) {
          const W = V.W, H = V.H, k = Math.min(W / 1920, H / 1080) * (V.portrait ? 1.6 : 1), x = (V.portrait ? 60 : 120) * k, y = H * (V.portrait ? .12 : .18);
          const out = b => s.beat > b ? clamp(s.at(b + 1) / .5) : 0;
          if (s.beat === 0 || out(0) < 1) {
            text(g, '1,000,000,000+', { x, y, size: (V.portrait ? 64 : 110) * k, font: 'Unbounded', weight: 800, color: '#ffd36b', track: -.05, anim: 'decode', accent: '#fff', glow: 'rgba(255,170,60,.5)' }, s.k(0, .3, 2.2, E.lin), out(0));
            text(g, 'people now use AI.', { x, y: y + 80 * k, size: (V.portrait ? 40 : 52) * k, font: 'Unbounded', weight: 300, color: '#fff', anim: 'blur', by: 'word' }, s.k(0, 1.2, 2.6, E.lin), out(0));
            text(g, 'DataReportal, Digital 2026', { x, y: y + 130 * k, size: 18 * k, font: 'Geist Mono', color: 'rgba(255,255,255,.6)', anim: 'fade' }, s.k(0, 2, 3, E.lin), out(0));
          }
          if (s.beat === 1 || (s.beat === 2 && out(1) < 1)) {
            text(g, 'Supply: ~$700 billion', { x, y, size: (V.portrait ? 50 : 84) * k, font: 'Unbounded', weight: 300, color: '#fff', track: -.035, anim: 'stretch' }, s.k(1, .2, 1.5, E.lin), out(1));
            text(g, 'of data-centre spending planned for 2026.', { x, y: y + 64 * k, size: 30 * k, font: 'Geist', color: 'rgba(255,255,255,.85)', anim: 'blur', by: 'word' }, s.k(1, .9, 2.2, E.lin), out(1));
            // two glowing bars: 2025 vs 2026
            const bw = Math.min(W * .4, 620 * k), by = y + 130 * k, a = s.k(1, 1.3, 3, E.out3) * (1 - out(1));
            [[2025, 365, '#64d8ff'], [2026, 700, '#ffb347']].forEach(([yr, v, c], i) => {
              const yy = by + i * 70 * k; g.globalAlpha = Math.min(1, a * 2); g.fillStyle = 'rgba(255,255,255,.65)'; g.font = `500 ${18 * k}px "Geist Mono", monospace`; g.fillText(yr, x, yy + 22 * k);
              g.save(); g.shadowColor = c; g.shadowBlur = 24 * k; g.fillStyle = c; g.fillRect(x + 80 * k, yy, bw * v / 700 * a, 30 * k); g.restore();
              g.fillStyle = '#fff'; g.font = `500 ${22 * k}px "Geist Mono", monospace`; g.fillText('$' + Math.round(v * a) + 'B', x + 92 * k + bw * v / 700 * a, yy + 24 * k);
            });
            g.globalAlpha = 1;
            text(g, 'Hyperscaler capex plans; 2025 ≈ $365B. Figures vary by source.', { x, y: by + 170 * k, size: 17 * k, font: 'Geist Mono', color: 'rgba(255,255,255,.55)', anim: 'fade' }, s.k(1, 2.4, 3.4, E.lin), out(1));
          }
          if (s.beat === 2) {
            text(g, 'Measured in\ngigawatts.', { x, y, size: (V.portrait ? 60 : 100) * k, font: 'Unbounded', weight: 800, color: '#bfe9ff', track: -.05, lh: 1, anim: 'glitch', glow: 'rgba(120,200,255,.6)' }, s.k(2, .2, 1.4, E.lin));
            const L = ['5 GW · one planned Meta campus in Louisiana', '~$50B · rough cost per gigawatt of AI capacity', '23 GW+ · under construction worldwide, late 2025'];
            L.forEach((l, i) => text(g, l, { x, y: y + (V.portrait ? 150 : 210) * k + i * 42 * k, size: 24 * k, font: 'Geist Mono', weight: 500, color: '#fff', anim: 'decode', accent: '#64d8ff' }, s.k(2, 1.2 + i * .5, 2.6 + i * .5, E.lin)));
          }
        },
      };
    },
  });
}
