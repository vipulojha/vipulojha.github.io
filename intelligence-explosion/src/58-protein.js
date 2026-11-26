// =====================================================================
// 58 · PROTEIN — AI does science. A chain of 420 residues thrashes as an
// unfolded string, then folds itself into a helix bundle in seconds; the
// camera pulls back into a galaxy of 200 million predicted structures;
// a gold Nobel medal turns in the light.
// =====================================================================
import { SCENES, THREE, R, clamp, lerp, E, rig, prng, shader, pass, V, text, AU } from './00-core.js';

{
  const NR = 420;
  const rr = prng(31);
  // unfolded: a long loose line; folded: 6 alpha-helices packed in a bundle joined by loops
  const unf = [], fol = [];
  for (let i = 0; i < NR; i++) unf.push(new THREE.Vector3((i / NR - .5) * 9, Math.sin(i * .21) * .25, Math.cos(i * .17) * .25));
  {
    const H = 6, per = Math.floor(NR / H), ring = [[0, 0], [1.05, 0], [.52, .9], [-.52, .9], [-1.05, 0], [-.52, -.9]];
    for (let h = 0; h < H; h++) {
      const [cx, cz] = ring[h], dir = h % 2 ? -1 : 1, hel = per - 10;
      for (let j = 0; j < per; j++) {
        if (j < hel) { const a = j * 1.745, y = dir * (j / hel - .5) * 3.1; fol.push(new THREE.Vector3(cx + Math.cos(a) * .32, y, cz + Math.sin(a) * .32)); }
        else { const t = (j - hel) / 10, [nx, nz] = ring[(h + 1) % H]; const yEnd = dir * 1.55; fol.push(new THREE.Vector3(lerp(cx, nx, t), yEnd + dir * Math.sin(t * Math.PI) * .5, lerp(cz, nz, t) + Math.sin(t * Math.PI) * .3)); }
      }
    }
    while (fol.length < NR) fol.push(fol[fol.length - 1].clone());
  }
  const KEYS = [
    { u: 0, pos: [0, .6, 9.5], look: [0, 0, 0], fov: 44 },
    { u: 1, pos: [4.6, 1.6, 8.2], look: [-.6, 0, 0], fov: 42 },
    { u: 2, pos: [-3.6, 1.2, 7.8], look: [-.8, 0, 0], fov: 42 },
    { u: 2.55, pos: [4, 16, 30], look: [0, 0, 0], fov: 50 },
    { u: 3, pos: [-6, 22, 36], look: [0, 0, 0], fov: 52 },
    { u: 3.5, pos: [1.8, .6, 7.6], look: [.6, 0, 0], fov: 40 },
    { u: 4, pos: [2, .5, 7.4], look: [.6, 0, 0], fov: 40 },
  ];
  let scene3, cam, beads, bond, galaxy, gMat, medal, keyL;
  SCENES.push({
    id: 'protein', title: 'AI does science', enterWith: 'radial', hud: { color: '#9cffd9' },
    beats: [{ dur: 3, hold: 4 }, { dur: 5, hold: 4 }, { dur: 4, hold: 4 }, { dur: 3.5, hold: 5 }],
    bed: { chord: [0, 4, 9, 11], oct: 3, cut: 1100, vol: .032, choir: .05, arp: { notes: [0, 4, 7, 11, 9, 7], oct: 5, rate: 2.5, voice: 'fm', ratio: 2, index: .7, len: .9, vol: .022, delay: .45 }, level: [.35, .5, .6, .65] },
    notes: [
      'Proteins are the machines of life, and what they do depends on the shape they fold into. Working out one structure experimentally could take years.',
      'DeepMind\'s AlphaFold predicts a protein\'s 3D structure from its sequence, often in minutes, at accuracy competitive with experiments.',
      'Its public database holds more than 200 million predicted structures, nearly every protein known to science, free for anyone to use.',
      'In 2024, Demis Hassabis and John Jumper shared the Nobel Prize in Chemistry for it, alongside David Baker for computational protein design. AI is not just answering questions about science. It is doing science.',
    ],
    create() {
      scene3 = new THREE.Scene(); cam = new THREE.PerspectiveCamera(44, 1.78, .05, 500);
      scene3.add(new THREE.HemisphereLight(0x9fe8ff, 0x0b0820, .8));
      keyL = new THREE.DirectionalLight(0xffffff, 2.6); keyL.position.set(3, 4, 5); scene3.add(keyL);
      const rimL = new THREE.DirectionalLight(0x8f7bff, 1.1); rimL.position.set(-4, 1, -3); scene3.add(rimL);
      beads = new THREE.InstancedMesh(new THREE.SphereGeometry(.11, 14, 10), new THREE.MeshStandardMaterial({ roughness: .28, metalness: .15, emissive: 0x000000 }), NR);
      const c = new THREE.Color(); for (let i = 0; i < NR; i++) { c.setHSL(.66 - i / NR * .66, .85, .58); beads.setColorAt(i, c); }
      beads.frustumCulled = false; scene3.add(beads);
      bond = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(NR * 3), 3)), new THREE.LineBasicMaterial({ color: new THREE.Color(.5, .9, 1.4), transparent: true, opacity: .55 }));
      bond.frustumCulled = false; scene3.add(bond);
      // the database: a galaxy of tiny folded structures
      const GN = Math.min(innerWidth, innerHeight) < 700 ? 40000 : 90000, gp = new Float32Array(GN * 3), gc = new Float32Array(GN * 3);
      for (let i = 0; i < GN; i++) { const arm = i % 4, r = Math.pow(rr(), .55) * 26 + 1.2, a = arm / 4 * 6.283 + r * .32 + (rr() - .5) * .6; gp.set([Math.cos(a) * r, (rr() - .5) * (2.6 - r * .07), Math.sin(a) * r], i * 3); c.setHSL(.66 - rr() * .66, .8, .6); gc.set([c.r, c.g, c.b], i * 3); }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); gg.setAttribute('aC', new THREE.BufferAttribute(gc, 3));
      gMat = shader(`varying vec3 vC; varying float vA; void main(){ vec2 c=gl_PointCoord-.5; float d=dot(c,c); gl_FragColor=vec4(vC*exp(-d*20.)*vA,1.); }`, { uA: { value: 0 }, uT: { value: 0 }, uPx: { value: 1 } },
        { blend: 'add', vert: `attribute vec3 aC; uniform float uA,uT,uPx; varying vec3 vC; varying float vA; varying vec2 vUv;
void main(){ vec3 p=position; float a=uT*.03/(length(p.xz)*.08+.4); p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;
  vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(uPx*.05/-mv.z,1.,3.); vC=aC*1.2; vA=uA*(.5+.5*fract(sin(dot(position,vec3(12.9,78.2,37.7)))*437.)); vUv=vec2(0.); }` });
      gMat.depthTest = false; galaxy = new THREE.Points(gg, gMat); galaxy.frustumCulled = false; scene3.add(galaxy);
      // Nobel medal: a gold disc with a raised rim, lit by the key light
      medal = new THREE.Group();
      const gold = new THREE.MeshStandardMaterial({ color: 0xf5c451, metalness: .75, roughness: .25, emissive: 0x5a3c08 });
      const face = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .09, 64), gold); face.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1, .06, 12, 64), gold);
      const mc = document.createElement('canvas'); mc.width = mc.height = 512; const mg = mc.getContext('2d');
      mg.fillStyle = '#000'; mg.fillRect(0, 0, 512, 512); mg.fillStyle = '#fff'; mg.font = '600 46px Newsreader, Georgia'; mg.textAlign = 'center'; mg.fillText('NOBEL', 256, 200); mg.fillText('CHEMISTRY', 256, 262); mg.font = '400 40px Newsreader, Georgia'; mg.fillText('MMXXIV', 256, 330);
      mg.strokeStyle = '#fff'; mg.lineWidth = 6; mg.beginPath(); mg.arc(256, 256, 214, 0, 7); mg.stroke();
      const relief = new THREE.Mesh(new THREE.CircleGeometry(.95, 64), new THREE.MeshStandardMaterial({ color: 0xe8b443, metalness: .75, roughness: .3, bumpMap: new THREE.CanvasTexture(mc), bumpScale: 2.2, emissive: 0x1a0d00 }));
      relief.position.z = .047; const warm = new THREE.PointLight(0xffd27a, 6, 6, 1.5); warm.position.set(1.2, 1.2, 2.2); medal.add(face, rim, relief, warm); medal.position.set(2.6, 0, 0); medal.scale.setScalar(0); scene3.add(medal);
      const M = new THREE.Matrix4(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), Q = new THREE.Quaternion();
      let lastFold = 0;
      return {
        update(s) {
          const u = s.p[0] + s.p[1] + s.p[2] + s.p[3], k = rig(KEYS, u, ['pos', 'look', 'fov']);
          cam.position.set(k.pos[0] + Math.sin(s.t * .2) * .3 + s.mouse.x * .6, k.pos[1] + s.mouse.y * .4, k.pos[2]); cam.lookAt(...k.look);
          cam.fov = V.portrait ? k.fov * 1.55 : k.fov; cam.aspect = V.W / V.H; cam.updateProjectionMatrix();
          const fold = s.on(1) ? s.p[1] : 0, pos = bond.geometry.attributes.position;
          for (let i = 0; i < NR; i++) {
            const local = E.io3(clamp(fold * 1.7 - (i / NR) * .7)); // folding sweeps down the chain
            const th = (1 - local) * .18 + .012;
            P.copy(unf[i]).lerp(fol[i], local); P.x += Math.sin(s.t * 3 + i * .7) * th; P.y += Math.cos(s.t * 2.6 + i * .5) * th; P.z += Math.sin(s.t * 2.2 + i * .9) * th;
            if (s.on(3)) P.x -= s.k(3, 0, 1.5) * 1.4;
            M.compose(P, Q, S); beads.setMatrixAt(i, M); pos.setXYZ(i, P.x, P.y, P.z);
          }
          beads.instanceMatrix.needsUpdate = true; pos.needsUpdate = true;
          const fq = Math.floor(fold * 12); if (fq !== lastFold) { if (fq > lastFold && s.on(1)) AU.hit('bleep', 1.3); lastFold = fq; }
          gMat.uniforms.uA.value = s.k(2, .2, 2) * (1 - s.k(3, 0, 1.2) * .7); gMat.uniforms.uT.value = s.t; gMat.uniforms.uPx.value = V.H;
          beads.visible = bond.visible = true;
          const ms = s.on(3) ? E.outBack(s.k(3, .5, 2, E.lin)) : 0; medal.scale.setScalar(ms * (V.portrait ? .8 : 1)); medal.rotation.y = Math.sin(s.t * .6) * .55 - .25; medal.position.set(V.portrait ? 0 : 1.9, V.portrait ? -1.4 : 0, .5);
          s.post = { streak: .35, bloom: .55, threshold: 1, vignette: .5, grain: .03, ca: .0015, halation: .35, exposure: 1.05 };
          if (s.cross(1, .2)) AU.hit('riser'); if (s.cross(1, 4.6)) AU.hit('ding'); if (s.cross(2, .3)) { AU.hit('zoom'); AU.hit('sparkle', 0, .5); } if (s.cross(3, .5)) { AU.hit('clangHit'); AU.hit('choir', 0, .2); AU.hit('bell', 0, .6); }
          if (s.cross(0, .4)) AU.hit('glass');
          if (s.bed) s.bed.param('arpRate', [2, 6, 3, 2][s.beat]);
        },
        render(slot) { R.setRenderTarget(slot.hdr); R.setClearColor(new THREE.Color(.006, .012, .02), 1); R.clear(); pass2(slot); R.render(scene3, cam); },
        draw2d(g, s) {
          const W = V.W, H = V.H, k = Math.min(W / 1920, H / 1080) * (V.portrait ? 1.6 : 1), x = (V.portrait ? 60 : 120) * k, y = H * (V.portrait ? .1 : .16);
          const out = b => s.beat > b ? clamp(s.at(b + 1) / .5) : 0, mw = V.portrait ? W - 2 * x : W * .46;
          const HD = ['A protein’s shape\nused to take years.', 'AlphaFold folds it\nin minutes.', '200,000,000+\nstructures.', 'Nobel Prize\nin Chemistry, 2024.'];
          const CP = ['Each one solved by experiment, one at a time.', 'Google DeepMind · structure from sequence alone', 'AlphaFold Protein Structure Database · free to everyone', 'Demis Hassabis & John Jumper (with David Baker, for protein design)'];
          const AN = ['wave', 'spring', 'decode', 'flip'];
          for (let b = 0; b < 4; b++) if (s.beat >= b && out(b) < 1) {
            text(g, HD[b], { x, y, size: (V.portrait ? 54 : 80) * k, font: 'Unbounded', weight: b === 2 ? 800 : 300, color: b === 2 ? '#9cffd9' : '#fff', track: -.035, lh: 1.06, anim: AN[b], accent: '#ff7ad1', glow: b === 3 ? 'rgba(255,200,90,.5)' : undefined, maxW: mw }, s.k(b, .2, 1.6, E.lin), out(b));
            text(g, CP[b], { x, y: y + 200 * k, size: 21 * k, font: 'Geist Mono', color: 'rgba(200,255,240,.72)', anim: 'fade', maxW: mw }, s.k(b, 1.2, 2.2, E.lin), out(b));
          }
        },
      };
    },
  });
  // soft lab backdrop: dark teal with drifting caustic light
  const bgM = shader(`uniform float uT; void main(){ vec2 p=vUv; float c=fbm(p*3.+vec2(uT*.03,uT*.02))*fbm(p*5.-uT*.02); vec3 col=mix(vec3(.004,.016,.024),vec3(.02,.06,.08),c); col+=vec3(.05,.2,.25)*pow(c,3.)*.4; gl_FragColor=vec4(col,1.); }`, { uT: { value: 0 } });
  function pass2(slot) { bgM.uniforms.uT.value = performance.now() / 1000; pass(bgM, slot.hdr); }
}
