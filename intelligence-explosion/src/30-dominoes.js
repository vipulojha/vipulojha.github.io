// =====================================================================
// 30 · DOMINOES — each domino is 1.5× the last. 31 of them, obsidian with
// neon pips that shift hue as they grow. A mirror-black floor reflects
// them (true planar reflection), every impact rings a shockwave across
// the floor and throws sparks, and time slows at each milestone.
// =====================================================================
import { SCENES, THREE, R, clamp, lerp, E, shader, pass, V, text, AU } from './00-core.js';

{
  const N = 31;
  const h = k => 1.5 ** k, meters = k => .05 * 1.5 ** k;
  const xs = [0]; for (let k = 0; k < N - 1; k++) xs.push(xs[k] + h(k) * .16 + h(k) * .6);
  const dur = k => .5 + .012 * k ** 1.4; const T0 = []; { let t = .8; for (let k = 0; k < N; k++) { T0.push(t); t += dur(k); } }
  const END = T0[N - 1] + dur(N - 1);
  const thC = () => Math.asin(.6);
  function angle(k, t) {
    const a = t - T0[k]; if (a <= 0) return 0;
    const d = dur(k), c = thC();
    if (a < d) return c * (a / d) ** 2;
    if (k === N - 1) { const b = (a - d) / 1.4; return b >= 1 ? Math.PI / 2 : c + (Math.PI / 2 - c) * E.outBack(clamp(b)); }
    return c + (1.36 - c) * E.out2(clamp((a - d) / (dur(k + 1) * 1.3)));
  }
  const ciAt = tf => { let k = 0; while (k < N - 1 && tf > T0[k + 1]) k++; return Math.min(N - 1, k + (k < N - 1 ? clamp((tf - T0[k]) / dur(k)) : 0)); };
  const MILES = [[17, 'Domino 18 is as tall\nas a 15-storey building.'], [24, 'Domino 25 is taller\nthan the Burj Khalifa.'], [30, 'Domino 31 is taller\nthan Mount Everest.']];
  // slow motion around each milestone: real seconds → falling time
  const rate = ci => 1 - .72 * MILES.reduce((a, [m]) => a + Math.exp(-(((ci - m - .3) / .9) ** 2)), 0);
  const warp = real => { let tf = 0; const st = .04; for (let t = 0; t < real; t += st) tf += Math.min(st, real - t) * Math.max(.2, rate(ciAt(tf))); return tf; };
  const REAL_END = (() => { let tf = 0, t = 0; while (tf < END + 1.5 && t < 200) { tf += .04 * Math.max(.2, rate(ciAt(tf))); t += .04; } return t; })();
  const hue = k => new THREE.Color().setHSL(lerp(.52, 1.08, k / (N - 1)) % 1, .95, .6);
  const fmtM = m => m < 1 ? `${Math.round(m * 100)} cm` : m < 1000 ? `${m < 10 ? m.toFixed(1) : Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;

  let scene3, cam, rcam, mesh, ground, sparks, sparkMat, dust, dustMat, keyL, lastHit = -1, impactT = -1;
  const foot = Array.from({ length: N }, () => new THREE.Vector4(0, 0, 0, 1));
  const impT = new Float32Array(N), impX = new Float32Array(N), impC = [];
  for (let k = 0; k < N; k++) { impT[k] = T0[k] + dur(k); impX[k] = k < N - 1 ? xs[k + 1] : xs[k] + h(k) * .6; impC.push(hue(k)); }
  const sky = shader(`uniform float uT,uP; void main(){ float y=vUv.y;
    vec3 top=vec3(.01,.008,.03), mid=mix(vec3(.16,.03,.22),vec3(.3,.04,.12),uP), hor=mix(vec3(.1,.5,.7),vec3(1.,.35,.2),uP);
    vec3 c=mix(hor*.5,mid,smoothstep(.3,.5,y)); c=mix(c,top,smoothstep(.5,1.,y));
    float band=sin(vUv.x*6.+uT*.15+sin(vUv.x*13.-uT*.2))*.5+.5; c+=mix(vec3(.1,.9,.8),vec3(.9,.3,.9),vUv.x)*band*exp(-pow((y-.72-.05*sin(vUv.x*5.+uT*.1))*9.,2.))*.12;
    gl_FragColor=vec4(c,1.); }`, { uT: { value: 0 }, uP: { value: 0 } });

  SCENES.push({
    id: 'dominoes', title: 'Each one 1.5×', enterWith: 'shatter', hud: { color: '#9ef6ff' },
    beats: [{ dur: 2, hold: 3 }, { dur: REAL_END + 1, hold: 2 }, { dur: 2, hold: 4 }],
    bed: { chord: [0, 3, 7, 10], oct: 2, cut: 500, vol: .045, sub: .15, choir: 0, pulse: { kind: 'tick', rate: 2, vol: .12 }, level: [.3, .5, .4] },
    notes: [
      'A row of dominoes. Each one is exactly one and a half times the size of the one before. The first is five centimetres tall.',
      'Watch the counter. Domino 18 is about 49 metres. Domino 25 is taller than the Burj Khalifa. Domino 31, almost ten kilometres, is taller than Everest. Nothing about any single step looks dramatic.',
      'That is what a modest multiplier does when it compounds. Effective compute for frontier AI, meaning hardware times algorithmic efficiency, has been growing roughly tenfold a year.',
    ],
    create() {
      scene3 = new THREE.Scene(); cam = new THREE.PerspectiveCamera(40, 1.78, .05, 1e6); rcam = cam.clone();
      // face: obsidian with glowing pips + neon border (used as emissive map)
      // ---- high-quality face: 512×1024 emissive map with soft halos, plus a matching bump map so pips are engraved
      const FW = 512, FH = 1024, pipsAt = [[256, 256], [144, 144], [368, 368], [144, 368], [368, 144], [144, 660], [368, 660], [144, 880], [368, 880], [144, 770], [368, 770]];
      const faceCanvas = (glow) => { const c = document.createElement('canvas'); c.width = FW; c.height = FH; const g = c.getContext('2d');
        g.fillStyle = glow ? '#000' : '#fff'; g.fillRect(0, 0, FW, FH);
        const ink = glow ? '#fff' : '#000';
        if (glow) { g.shadowColor = 'rgba(255,255,255,.9)'; g.shadowBlur = 26; }
        g.strokeStyle = ink; g.lineWidth = 9; g.beginPath(); g.roundRect(22, 22, FW - 44, FH - 44, 26); g.stroke();
        g.fillStyle = ink; g.beginPath(); g.roundRect(80, FH / 2 - 7, FW - 160, 14, 7); g.fill();
        for (const [x, y] of pipsAt) { g.beginPath(); g.arc(x, y, 38, 0, 7); g.fill(); }
        if (glow) { g.shadowBlur = 0; g.fillStyle = '#fff'; for (const [x, y] of pipsAt) { g.beginPath(); g.arc(x, y, 30, 0, 7); g.fill(); } }
        return c; };
      const aniso = R.capabilities.getMaxAnisotropy();
      const em = new THREE.CanvasTexture(faceCanvas(true)); em.anisotropy = aniso;
      const bump = new THREE.CanvasTexture(faceCanvas(false)); bump.anisotropy = aniso;
      const tint = m => { m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance *= vColor * 1.5;\n#endif'); }; return m; };
      // ---- lacquered obsidian: clear-coated, reflecting a custom neon studio environment
      const face = tint(new THREE.MeshPhysicalMaterial({ color: 0x07070b, roughness: .34, metalness: .15, clearcoat: 1, clearcoatRoughness: .07, emissive: 0xffffff, emissiveMap: em, bumpMap: bump, bumpScale: 1.6, envMapIntensity: .9 }));
      const side = tint(new THREE.MeshPhysicalMaterial({ color: 0x08080d, roughness: .3, metalness: .2, clearcoat: 1, clearcoatRoughness: .06, emissive: 0x000000, envMapIntensity: 1 }));
      {
        const envScene = new THREE.Scene();
        envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), shader(`varying vec3 vP; void main(){ float y=normalize(vP).y; vec3 c=mix(vec3(.25,.05,.22),vec3(.01,.01,.03),smoothstep(-.1,.6,y)); c=mix(vec3(.02,.01,.02),c,smoothstep(-.4,0.,y)); gl_FragColor=vec4(c,1.); }`, {}, { side: THREE.BackSide, vert: `varying vec3 vP; varying vec2 vUv; void main(){ vP=position; vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }` })));
        const panel = (w, h, col, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m); };
        panel(4, 30, new THREE.Color(.3, 2.2, 3), -24, 6, 10); panel(4, 30, new THREE.Color(3, .4, 1.8), 24, 4, -12); panel(30, 6, new THREE.Color(2.4, 2.2, 2.6), 0, 30, 6); panel(12, 3, new THREE.Color(3, 1.6, .6), 8, 8, 26);
        const pm = new THREE.PMREMGenerator(R); scene3.environment = pm.fromScene(envScene, .02).texture; pm.dispose();
      }
      // ---- rounded geometry in true domino proportions (thickness .16, height 1, width .5), vertices clustered at the bevels
      const geo = (() => {
        const Wd = .16, Ht = 1, Dp = .5, r = .022, g = new THREE.BoxGeometry(Wd, Ht, Dp, 10, 24, 16);
        const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, v = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
        const bend = (u, L) => { const t = u / (L / 2), a = Math.abs(t); return Math.sign(t) * (1 - Math.pow(1 - a, 2.2)) * L / 2; };
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i); v.set(bend(v.x, Wd), bend(v.y, Ht), bend(v.z, Dp));
          c.set(clamp(v.x, -Wd / 2 + r, Wd / 2 - r), clamp(v.y, -Ht / 2 + r, Ht / 2 - r), clamp(v.z, -Dp / 2 + r, Dp / 2 - r));
          n.subVectors(v, c); if (n.lengthSq() > 1e-12) { n.normalize(); v.copy(c).addScaledVector(n, r); nor.setXYZ(i, n.x, n.y, n.z); }
          pos.setXYZ(i, v.x, v.y, v.z);
        }
        // face UVs from position so the pips never stretch
        for (const grp of g.groups.slice(0, 2)) for (let j = grp.start; j < grp.start + grp.count; j++) { const i = g.index.getX(j); v.fromBufferAttribute(pos, i); uv.setXY(i, grp.materialIndex === 0 ? .5 - v.z / Dp : .5 + v.z / Dp, v.y / Ht + .5); }
        g.translate(Wd / 2, Ht / 2, 0); return g;
      })();
      mesh = new THREE.InstancedMesh(geo, [face, face, side, side, side, side], N); mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
      for (let k = 0; k < N; k++) mesh.setColorAt(k, hue(k));
      scene3.add(mesh);
      scene3.add(new THREE.HemisphereLight(0x5a3a8a, 0x05030a, .45));
      keyL = new THREE.DirectionalLight(0xffc6e8, 2.4); scene3.add(keyL, keyL.target);
      keyL.castShadow = true; keyL.shadow.mapSize.set(Math.min(innerWidth, innerHeight) < 700 ? 2048 : 4096, Math.min(innerWidth, innerHeight) < 700 ? 2048 : 4096); keyL.shadow.bias = -.0004; keyL.shadow.normalBias = .02;
      const rim1 = new THREE.DirectionalLight(0x34e8ff, 3.5); rim1.position.set(.7, .35, -.6); scene3.add(rim1);
      const rim2 = new THREE.DirectionalLight(0xff3fa8, 2.5); rim2.position.set(-.8, .2, -.5); scene3.add(rim2);
      // mirror floor: true planar reflection (sampled through the mirrored camera), log grid, shockwaves
      ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shader(`varying vec3 vW; varying vec4 vR; uniform sampler2D tRefl; uniform float uScale,uTf,uHasRefl; uniform vec4 uFoot[${N}]; uniform float uImp[${N}]; uniform float uX[${N}]; uniform vec3 uCol[${N}];
float grid(vec2 p,float s){ vec2 q=abs(fract(p/s-.5)-.5)*s; vec2 w=fwidth(p)*1.2; vec2 l=1.-smoothstep(vec2(0.),w,q); return max(l.x,l.y)*clamp(1.-length(fwidth(p))/s*4.,0.,1.); }
void main(){ float lg=log(uScale)/log(10.); float f=fract(lg); float s0=pow(10.,floor(lg));
  vec3 c=vec3(.006,.005,.01);
  vec2 ruv=vR.xy/vR.w*.5+.5; vec3 refl=vec3(0.);
  if(uHasRefl>.5){ float b=.004; refl=(texture(tRefl,ruv).rgb*2.+texture(tRefl,ruv+vec2(b,0.)).rgb+texture(tRefl,ruv-vec2(b,0.)).rgb+texture(tRefl,ruv+vec2(0.,b*1.5)).rgb+texture(tRefl,ruv-vec2(0.,b*1.5)).rgb)/6.; }
  vec3 V=normalize(cameraPosition-vW); float fres=.25+.75*pow(1.-max(V.y,0.),4.);
  c+=refl*fres*.85*(.9+.1*vnoise(vW.xz/s0*4.));
  float ao=0.; for(int k=0;k<${N};k++){ vec4 F=uFoot[k]; float dx=max(max(F.x-vW.x,vW.x-F.y),0.), dz=max(abs(vW.z)-F.z,0.); ao+=exp(-length(vec2(dx,dz))/(F.w*.05))*.75; }
  c*=1.-min(ao,.85);
  float g=grid(vW.xz,s0)*(1.-f)+grid(vW.xz,s0*10.);
  c+=vec3(.25,.6,1.)*g*.12;
  for(int k=0;k<${N};k++){ float t=uTf-uImp[k]; if(t<0.||t>3.5) continue; float hk=pow(1.5,float(k));
    float r=t*hk*(1.2+float(k==${N - 1})*1.6); float d=abs(length(vW.xz-vec2(uX[k],0.))-r);
    c+=uCol[k]*exp(-d/(hk*.03+r*.02))*.9*exp(-t*1.3)*(1.+float(k==${N - 1})*3.); }
  gl_FragColor=vec4(c,1.); }`, { tRefl: { value: null }, uScale: { value: 1 }, uTf: { value: 0 }, uHasRefl: { value: 0 }, uFoot: { value: foot }, uImp: { value: impT }, uX: { value: impX }, uCol: { value: impC }, uRVP: { value: new THREE.Matrix4() } },
        { depth: true, vert: `uniform mat4 uRVP; varying vec3 vW; varying vec4 vR; varying vec2 vUv; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vR=uRVP*w; vUv=uv; gl_Position=projectionMatrix*viewMatrix*w; }` }));
      ground.rotation.x = -Math.PI / 2; scene3.add(ground);
      // sparks thrown at every impact, in that domino's hue
      const PER = 110, CN = PER * N, cv = new Float32Array(CN * 4), ck = new Float32Array(CN), cc = new Float32Array(CN * 3);
      for (let i = 0; i < CN; i++) { const a = Math.random() * 6.283, k = Math.floor(i / PER); cv.set([Math.cos(a) * (.3 + Math.random()), .4 + Math.random() * 1.6, Math.sin(a) * (.3 + Math.random()), Math.random()], i * 4); ck[i] = k; const c = hue(k); cc.set([c.r, c.g, c.b], i * 3); }
      const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CN * 3), 3)); cg.setAttribute('aV', new THREE.BufferAttribute(cv, 4)); cg.setAttribute('aK', new THREE.BufferAttribute(ck, 1)); cg.setAttribute('aC', new THREE.BufferAttribute(cc, 3));
      sparkMat = shader(`varying float vA; varying vec3 vC; void main(){ vec2 c=gl_PointCoord-.5; float d=dot(c,c); gl_FragColor=vec4(vC*exp(-d*30.)*vA*3.,1.); }`,
        { uTf: { value: 0 }, uImp: { value: impT }, uX: { value: impX }, uPx: { value: 1 } },
        { blend: 'add', vert: `attribute vec4 aV; attribute float aK; attribute vec3 aC; uniform float uTf,uPx; uniform float uImp[${N}]; uniform float uX[${N}]; varying float vA; varying vec3 vC; varying vec2 vUv;
void main(){ int k=int(aK+.5); float t=uTf-uImp[k]; float hk=pow(1.5,aK);
  vec3 o=vec3(uX[k],hk*.78,0.);
  vec3 p=o+vec3(aV.x*t*1.2,aV.y*t*1.6-t*t*3.2,aV.z*t*1.2)*hk*.4; p.y=max(p.y,0.);
  vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(uPx*hk*.03/-mv.z,1.,9.);
  vC=mix(vec3(1.,.95,.85),aC,clamp(t*2.,0.,1.)); vA=step(0.,t)*clamp(1.-t/(.8+aV.w),0.,1.); vUv=vec2(0.); }` });
      sparks = new THREE.Points(cg, sparkMat); sparks.frustumCulled = false; scene3.add(sparks);
      // the last one lands: a ring of glowing dust
      const DN = 6000, dv = new Float32Array(DN * 4);
      for (let i = 0; i < DN; i++) { const a = Math.random() * 6.283, sp = .2 + Math.random(); dv.set([Math.cos(a) * sp, .05 + Math.random() * .4, Math.sin(a) * sp, Math.random()], i * 4); }
      const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DN * 3), 3)); dg.setAttribute('aV', new THREE.BufferAttribute(dv, 4));
      dustMat = shader(`varying float vA; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor=vec4(vec3(1.,.45,.55)*(1.-d*2.)*vA,1.); }`,
        { uT: { value: -1 }, uO: { value: new THREE.Vector3() }, uS: { value: 1 }, uPx: { value: 1 } },
        { blend: 'add', vert: `attribute vec4 aV; uniform float uT,uS,uPx; uniform vec3 uO; varying float vA; varying vec2 vUv;
void main(){ float t=max(uT,0.); float k=1.-exp(-t*1.2);
  vec3 p=uO+vec3(aV.x*k*3.4,aV.y*k*.6+aV.w*.05,aV.z*k*3.4)*uS;
  vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(uPx*uS*(.012+aV.w*.02)/-mv.z,1.,30.);
  vA=step(0.,uT)*exp(-t*.5)*smoothstep(0.,.15,t)*.25; vUv=vec2(0.); }` });
      dust = new THREE.Points(dg, dustMat); dust.frustumCulled = false; scene3.add(dust);

      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), P = new THREE.Vector3(), S = new THREE.Vector3(), OFF = new THREE.Vector3();
      const KEY_DIR = new THREE.Vector3(-.55, .8, .45).normalize();
      let tf = 0, ci = 0, hc = 1, xc = 0;
      return {
        enter() { lastHit = -1; impactT = -1; },
        update(s) {
          tf = s.on(2) ? END + 2 + s.at(2) : s.on(1) ? warp(s.at(1)) : 0;
          for (let k = 0; k < N; k++) {
            const hk = h(k), th = angle(k, tf);
            Q.setFromAxisAngle(Z, -th); OFF.set(-hk * .16, 0, 0).applyQuaternion(Q);
            M.compose(P.set(xs[k] + hk * .16, 0, 0).add(OFF), Q, S.set(hk, hk, hk)); mesh.setMatrixAt(k, M);
            foot[k].set(xs[k] + hk * .16 - hk * .16, xs[k] + hk * .16 + Math.max(Math.sin(th) * hk * .55, 0), hk * .25, hk);
            if (k > lastHit && tf >= impT[k]) { lastHit = k; if (s.on(1) && !s.on(2) && s.dir > 0) AU.hit('domino', k / (N - 1)); if (k > 18 && s.on(1) && !s.on(2) && s.dir > 0) AU.hit('stomp'); if (k === N - 1) { impactT = impT[k]; if (s.on(1) && !s.on(2)) { AU.hit('boom'); AU.hit('shimmer'); AU.hit('thunder'); AU.hit('choir', 0, .6); } } }
          }
          mesh.instanceMatrix.needsUpdate = true;
          ci = ciAt(tf); const c0 = Math.floor(ci), fr = ci - c0; hc = 1.5 ** ci;
          xc = lerp(xs[c0], xs[Math.min(N - 1, c0 + 1)], fr) + hc * .3;
          const fin = clamp((tf - END) / 4), slow = 1 - rate(ci);
          const orbit = .45 + Math.sin(ci * .35) * .5 + s.mouse.x * .25 + fin * .6 + slow * .5;
          const dist = hc * (2.5 - slow * .7 + fin * 2.4);
          const shake = impactT > 0 ? Math.exp(-(tf - impactT) * 1.6) * hc * .04 : 0;
          cam.position.set(xc + Math.sin(orbit) * dist + Math.sin(s.t * 41) * shake, hc * (.28 + slow * -.12 + s.mouse.y * .15 + fin * .55) + Math.cos(s.t * 37) * shake, Math.cos(orbit) * dist);
          cam.up.set(Math.sin(ci * .4) * .12 * (1 - fin), 1, 0).normalize();
          cam.lookAt(xc, hc * .45, 0); cam.near = hc * .02; cam.far = hc * 4000; cam.aspect = V.W / V.H; cam.fov = V.portrait ? 64 : 42; cam.updateProjectionMatrix();
          // mirrored camera for the floor reflection
          rcam.copy(cam); rcam.position.y = -cam.position.y; rcam.up.set(cam.up.x, -cam.up.y, cam.up.z); rcam.lookAt(xc, -hc * .45, 0); rcam.updateProjectionMatrix(); rcam.updateMatrixWorld();
          const gu = ground.material.uniforms; gu.uScale.value = hc; gu.uTf.value = tf; gu.uRVP.value.multiplyMatrices(rcam.projectionMatrix, rcam.matrixWorldInverse);
          ground.scale.setScalar(hc * 3000); ground.position.set(xc, 0, 0);
          keyL.target.position.set(xc, 0, 0); keyL.position.set(xc + KEY_DIR.x * hc * 8, KEY_DIR.y * hc * 8, KEY_DIR.z * hc * 8);
          const sc = keyL.shadow.camera; sc.left = sc.bottom = -hc * 3.2; sc.right = sc.top = hc * 3.2; sc.near = hc * .5; sc.far = hc * 20; sc.updateProjectionMatrix();
          sparkMat.uniforms.uTf.value = tf; sparkMat.uniforms.uPx.value = V.H;
          dustMat.uniforms.uT.value = impactT > 0 ? tf - impactT : -1; dustMat.uniforms.uO.value.set(impX[N - 1], 0, 0); dustMat.uniforms.uS.value = h(N - 1); dustMat.uniforms.uPx.value = V.H;
          sky.uniforms.uT.value = s.t; sky.uniforms.uP.value = ci / (N - 1);
          const flash = impactT > 0 ? Math.exp(-(tf - impactT) * 3) : 0;
          s.post = { streak: .55, bloom: .6 + flash, threshold: .9, exposure: 1.05 + flash * .8, vignette: .55, grain: .035, ca: .0015 + slow * .004 + flash * .01, contrast: 1.08, halation: .4 };
          if (slow > .45 && (s.slowPrev || 0) <= .45 && s.on(1) && !s.on(2)) AU.hit('tapestop'); s.slowPrev = slow;
          if (s.bed) { s.bed.param('pulseRate', s.on(1) && !s.on(2) ? 2 + ci * .25 * (1 - slow) : .5); s.bed.param('choir', s.on(2) ? .15 : 0); }
          if (s.cross(0, .3)) AU.hit('click'); if (s.cross(2, .2)) AU.hit('rise');
          s.ci = ci; s.slow = slow; s.hue = hue(Math.round(ci));
        },
        render(slot) {
          // 1) reflection pass from below the floor
          ground.visible = false; R.setRenderTarget(slot.aux); R.setClearColor(0, 1); R.clear(); pass(sky, slot.aux); R.render(scene3, rcam); ground.visible = true;
          ground.material.uniforms.tRefl.value = slot.aux.texture; ground.material.uniforms.uHasRefl.value = 1;
          // 2) main view
          R.setRenderTarget(slot.hdr); R.setClearColor(0, 1); R.clear(); pass(sky, slot.hdr); R.render(scene3, cam);
        },
        draw2d(g, s) {
          const W = V.W, H = V.H, k = Math.min(W / 1920, H / 1080) * (V.portrait ? 1.6 : 1), x = (V.portrait ? 60 : 120) * k;
          const col = '#' + (s.hue || new THREE.Color('#9ef6ff')).getHexString();
          s.hudColor = col;
          text(g, 'Each domino is 1.5×\nthe one before.', { x, y: H * (V.portrait ? .14 : .2), size: (V.portrait ? 56 : 86) * k, font: 'Unbounded', weight: 300, color: '#fff', track: -.035, anim: 'spring', glow: 'rgba(80,220,255,.35)', maxW: W - x * 2 }, s.k(0, .2, 1.4, E.lin), s.on(1) ? clamp(s.at(1) / .6) : 0);
          if (s.on(1) && !s.on(2)) {
            const c = Math.min(N - 1, Math.round(s.ci)), by = H - (V.portrait ? 360 : 150) * k;
            g.globalAlpha = clamp(s.at(1) / .8);
            g.fillStyle = 'rgba(255,255,255,.6)'; g.font = `500 ${18 * k}px "Geist Mono", monospace`; g.fillText('DOMINO', x, by - 128 * k);
            g.save(); g.shadowColor = col; g.shadowBlur = 30 * k; g.fillStyle = col; g.font = `800 ${118 * k}px Unbounded, sans-serif`; g.fillText('#' + (c + 1), x, by - 10 * k); g.restore();
            g.fillStyle = '#fff'; g.font = `400 ${34 * k}px "Geist Mono", monospace`; g.fillText(fmtM(meters(s.ci)), x + 4 * k, by + 40 * k);
            // a log ruler that fills as the chain grows
            const rw = Math.min(W - 2 * x, 640 * k); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, by + 62 * k, rw, 3 * k); g.fillStyle = col; g.fillRect(x, by + 62 * k, rw * (s.ci / (N - 1)), 3 * k);
            g.globalAlpha = 1;
            for (const [m, l] of MILES) {
              const a = s.ci - m - .2; if (a < 0 || a > 1.4) continue;
              text(g, l, { x: W / 2, y: H * (V.portrait ? .16 : .17), size: (V.portrait ? 40 : 60) * k, font: 'Unbounded', weight: 300, color: '#fff', align: 'center', track: -.03, lh: 1.06, anim: 'flip', glow: col, maxW: W * .9 }, clamp(a / .4), clamp((a - 1) / .4));
            }
          }
          if (s.on(2)) {
            text(g, 'Small multiplier.\nUnreasonable result.', { x, y: H * .22, size: (V.portrait ? 56 : 88) * k, font: 'Unbounded', weight: 300, color: '#fff', track: -.035, anim: 'mask', by: 'line', stagger: .4, maxW: W - x * 2 }, s.k(2, .1, 1.3, E.lin));
            text(g, 'Effective compute for frontier AI has grown roughly 10× a year.', { x, y: H * .22 + 230 * k, size: 26 * k, font: 'Geist', weight: 400, color: 'rgba(255,255,255,.8)', anim: 'blur', maxW: W - x * 2 }, s.k(2, .9, 2.2, E.lin));
          }
        },
      };
    },
  });
}
