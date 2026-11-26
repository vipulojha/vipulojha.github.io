// =====================================================================
// 30 · DOMINOES — each domino is 1.5× the last. 31 of them. A log-space
// camera rides the chain so the current domino always fills the frame.
// =====================================================================
import { SCENES, THREE, R, clamp, lerp, E, shader, pass, V, text, AU } from './00-core.js';

{
  const N = 31, H0 = 1; // 1 unit = 5 cm
  const h = k => H0 * 1.5 ** k, meters = k => .05 * 1.5 ** k;
  const xs = [0]; for (let k = 0; k < N - 1; k++) xs.push(xs[k] + h(k) * .16 + h(k) * .6);
  const dur = k => .5 + .012 * k ** 1.4; const T0 = []; { let t = .8; for (let k = 0; k < N; k++) { T0.push(t); t += dur(k); } }
  const END = T0[N - 1] + dur(N - 1);
  const thC = k => Math.asin(Math.min(.95, (h(k) * .6) / h(k)));
  function angle(k, t) {
    const a = t - T0[k]; if (a <= 0) return 0;
    const d = dur(k), c = thC(k);
    if (a < d) return c * (a / d) ** 2;
    if (k === N - 1) { const b = (a - d) / 1.2; return b >= 1 ? Math.PI / 2 : c + (Math.PI / 2 - c) * E.outBack(clamp(b)) ; }
    return c + (1.36 - c) * E.out2(clamp((a - d) / (dur(k + 1) * 1.3)));
  }
  const fmtM = m => m < 1 ? `${Math.round(m * 100)} cm` : m < 1000 ? `${m < 10 ? m.toFixed(1) : Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
  const MILES = [[17, 'Domino 18 is as tall as a 15-storey building.'], [24, 'Domino 25 is taller than the Burj Khalifa.'], [30, 'Domino 31 is taller than Mount Everest.']];

  let scene3, cam, mesh, ground, dust, dustMat, lastHit = -1, impactT = -1;
  SCENES.push({
    id: 'dominoes', title: 'Each one 1.5×', enterWith: 'line', hud: { color: '#f3e9dc' },
    beats: [{ dur: 2, hold: 3 }, { dur: END + 2, hold: 2 }, { dur: 2, hold: 4 }],
    bed: { chord: [0, 3, 7], oct: 2, cut: 500, vol: .06, level: [.25, .5, .35] },
    notes: [
      'A row of dominoes. Each one is exactly one and a half times the size of the one before. The first is five centimetres tall.',
      'Watch the counter. Domino 18 is about 49 metres. Domino 25 is taller than the Burj Khalifa. Domino 31, almost ten kilometres, is taller than Everest. Nothing about any single step looks dramatic.',
      'That is what a modest multiplier does when it compounds. Effective compute for frontier AI, meaning hardware times algorithmic efficiency, has been growing roughly tenfold a year.',
    ],
    create(ctx, s) {
      scene3 = new THREE.Scene(); cam = new THREE.PerspectiveCamera(40, 1.78, .05, 1e6);
      const fc = document.createElement('canvas'); fc.width = 256; fc.height = 512; const g = fc.getContext('2d');
      g.fillStyle = '#efe8da'; g.fillRect(0, 0, 256, 512); g.fillStyle = '#1b1712'; g.fillRect(28, 252, 200, 8);
      const pip = (x, y) => { g.beginPath(); g.arc(x, y, 20, 0, 7); g.fill(); };
      [[128, 128], [70, 70], [186, 186], [70, 186], [186, 70]].forEach(p => pip(...p)); [[70, 330], [186, 330], [70, 440], [186, 440], [70, 385], [186, 385]].forEach(p => pip(...p));
      const faceTex = new THREE.CanvasTexture(fc); faceTex.colorSpace = THREE.SRGBColorSpace;
      const side = new THREE.MeshStandardMaterial({ color: new THREE.Color('#e9e1d2'), roughness: .45 });
      const face = new THREE.MeshStandardMaterial({ map: faceTex, roughness: .4 });
      const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(.5, .5, 0); // pivot at back-bottom edge, extends +x (thickness), +y (height)
      mesh = new THREE.InstancedMesh(geo, [face, face, side, side, side, side], N); mesh.frustumCulled = false; scene3.add(mesh);
      scene3.add(new THREE.HemisphereLight(0xffe9d2, 0x2a1d14, .9));
      const sunL = new THREE.DirectionalLight(0xffd7a8, 3.2); sunL.position.set(-.4, .7, .6); scene3.add(sunL);
      const rim = new THREE.DirectionalLight(0x9ab0ff, .45); rim.position.set(.6, .3, -.8); scene3.add(rim);
      // ground with a log-scale grid that stays readable at every zoom level
      ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shader(`varying vec3 vW; uniform float uScale;
float grid(vec2 p,float s){ vec2 q=abs(fract(p/s-.5)-.5)*s; vec2 w=fwidth(p)*1.2; vec2 l=1.-smoothstep(vec2(0.),w,q); return max(l.x,l.y); }
void main(){ float lg=log(uScale)/log(10.); float f=fract(lg); float s0=pow(10.,floor(lg));
  float g=grid(vW.xz,s0)*(1.-f)+grid(vW.xz,s0*10.);
  vec3 c=vec3(.075,.06,.05)*(.8+.2*vnoise(vW.xz/s0*3.));
  c+=vec3(.35,.28,.22)*g*.35;
  float d=length(vW.xz-vec2(0.))/uScale; c*=1.;
  gl_FragColor=vec4(c,1.); }`, { uScale: { value: 1 } }, { depth: true, vert: `varying vec3 vW; varying vec2 vUv; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vUv=uv; gl_Position=projectionMatrix*viewMatrix*w; }` }));
      ground.rotation.x = -Math.PI / 2; ground.scale.setScalar(4e6); ground.position.x = 1e6; scene3.add(ground);
      // dust burst for the final impact
      const DN = 5000, dp = new Float32Array(DN * 3), dv = new Float32Array(DN * 4);
      for (let i = 0; i < DN; i++) { const a = Math.random() * 6.283, sp = .2 + Math.random(); dv.set([Math.cos(a) * sp, .15 + Math.random() * .6, Math.sin(a) * sp, Math.random()], i * 4); }
      const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('aV', new THREE.BufferAttribute(dv, 4));
      dustMat = shader(`varying float vA; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor=vec4(vec3(.75,.66,.55)*.9,(1.-d*2.)*(1.-d*2.)*vA*.07); }`,
        { uT: { value: -1 }, uO: { value: new THREE.Vector3() }, uS: { value: 1 }, uPx: { value: 1 } },
        { blend: true, vert: `attribute vec4 aV; uniform float uT,uS,uPx; uniform vec3 uO; varying float vA; varying vec2 vUv;
void main(){ float t=max(uT,0.); vec3 v=aV.xyz; float k=1.-exp(-t*1.4);
  vec3 p=uO+vec3(v.x*k*3.2,v.y*k*.5+aV.w*.08,v.z*k*3.2)*uS;
  vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=uPx*uS*(.02+aV.w*.05)*(1.+t*.4)/-mv.z;
  vA=step(0.,uT)*exp(-t*.35)*smoothstep(0.,.2,t); vUv=vec2(0.); }` });
      dust = new THREE.Points(dg, dustMat); dust.frustumCulled = false; scene3.add(dust);
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), P = new THREE.Vector3(), S = new THREE.Vector3();
      let tf = 0, ci = 0;
      return {
        enter() { lastHit = -1; impactT = -1; },
        update(s) {
          tf = s.on(1) ? s.at(1) : 0; if (s.on(2)) tf = END + s.at(2) + 2;
          for (let k = 0; k < N; k++) {
            const hk = h(k), th = angle(k, tf);
            Q.setFromAxisAngle(Z, -th);
            P.set(xs[k] + hk * .16, 0, 0); // rotate around front-bottom edge
            const off = new THREE.Vector3(-hk * .16, 0, 0).applyQuaternion(Q);
            M.compose(P.clone().add(off), Q, S.set(hk * .16, hk, hk * .5)); mesh.setMatrixAt(k, M);
            if (k > lastHit && tf - T0[k] >= dur(k)) { lastHit = k; if (s.on(1) && s.dir > 0 && s.at(1) < END + 1) AU.hit('domino', k / (N - 1)); if (k === N - 1) { impactT = tf; if (s.on(1)) AU.hit('boom'); } }
          }
          mesh.instanceMatrix.needsUpdate = true;
          // which domino is the camera on? continuous index (log space)
          let k = 0; while (k < N - 1 && tf > T0[k + 1]) k++;
          ci = Math.min(N - 1, k + clamp((tf - T0[k]) / dur(k)) * (k < N - 1 ? 1 : 0)) ;
          const c0 = Math.floor(ci), fr = ci - c0, hc = 1.5 ** ci;
          const xc = lerp(xs[c0], xs[Math.min(N - 1, c0 + 1)], fr) + hc * .3;
          const fin = clamp((tf - END) / 4);
          const orbit = .35 + s.t * .02 + s.mouse.x * .25 + fin * .5;
          const dist = hc * (2.6 + fin * 2.2);
          const shake = impactT > 0 ? Math.exp(-(tf - impactT) * 1.5) * hc * .03 : 0;
          cam.position.set(xc + Math.sin(orbit) * dist + Math.sin(s.t * 40) * shake, hc * (.55 + s.mouse.y * .2 + fin * .5) + Math.cos(s.t * 33) * shake, Math.cos(orbit) * dist);
          cam.lookAt(xc, hc * .42, 0); cam.near = hc * .02; cam.far = hc * 4000; cam.aspect = V.W / V.H; cam.fov = V.portrait ? 62 : 40; cam.updateProjectionMatrix();
          ground.material.uniforms.uScale.value = hc;
          dustMat.uniforms.uT.value = impactT > 0 ? tf - impactT : -1; dustMat.uniforms.uO.value.set(xs[N - 1] + h(N - 1) * .6, 0, 0); dustMat.uniforms.uS.value = h(N - 1); dustMat.uniforms.uPx.value = V.H;
          s.post = { bloom: .25, threshold: 1, exposure: 1.05, vignette: .5, grain: .035, ca: .0012, contrast: 1.06, lift: [.01, .012, .02] };
          s.ci = ci;
        },
        render(slot) {
          R.setRenderTarget(slot.hdr); R.setClearColor(new THREE.Color(.012, .014, .03), 1); R.clear();
          pass(sky, slot.hdr); R.render(scene3, cam);
        },
        draw2d(g, s) {
          const W = V.W, H = V.H, k = Math.min(W / 1920, H / 1080) * (V.portrait ? 1.6 : 1), x = (V.portrait ? 60 : 120) * k;
          text(g, 'Each domino is 1.5×\nthe one before.', { x, y: H * .2, size: (V.portrait ? 60 : 86) * k, font: 'Unbounded', weight: 300, color: '#f3e9dc', track: -.035, anim: 'rise', maxW: W - x * 2 }, s.k(0, .2, 1.4, E.lin), s.on(1) ? clamp(s.at(1) / .6) : 0);
          if (s.on(1) && !s.on(2)) {
            const c = Math.round(s.ci) ;
            g.globalAlpha = clamp(s.at(1) / .8);
            g.fillStyle = 'rgba(243,233,220,.7)'; g.font = `500 ${20 * k}px "Geist Mono", monospace`; g.fillText('DOMINO', x, H - 230 * k);
            g.fillStyle = '#f3e9dc'; g.font = `300 ${120 * k}px Unbounded, sans-serif`; g.fillText('#' + (c + 1), x, H - 110 * k);
            g.font = `400 ${34 * k}px "Geist Mono", monospace`; g.fillText(fmtM(meters(Math.min(N - 1, s.ci))), x + 4 * k, H - 58 * k);
            g.globalAlpha = 1;
            for (const [m, l] of MILES) {
              const t0 = T0[m] + dur(m) * .3, a = s.at(1) - t0; if (a < 0 || a > dur(m) + 2.2) continue;
              text(g, l, { x: W / 2, y: H * .16, size: (V.portrait ? 40 : 56) * k, font: 'Unbounded', weight: 300, color: '#fff', align: 'center', track: -.03, anim: 'blur', maxW: W * .86 }, clamp(a / 1.1), clamp((a - dur(m) - 1.4) / .8));
            }
          }
          if (s.on(2)) {
            text(g, 'Small multiplier.\nUnreasonable result.', { x, y: H * .22, size: (V.portrait ? 60 : 88) * k, font: 'Unbounded', weight: 300, color: '#fff', track: -.035, anim: 'rise', maxW: W - x * 2 }, s.k(2, .1, 1.3, E.lin));
            text(g, 'Effective compute for frontier AI has grown roughly 10× a year.', { x, y: H * .22 + 230 * k, size: 26 * k, font: 'Geist', weight: 400, color: 'rgba(255,255,255,.8)', anim: 'blur', maxW: W - x * 2 }, s.k(2, .9, 2.2, E.lin));
          }
        },
      };
    },
  });
  const sky = shader(`void main(){ float y=vUv.y; vec3 c=mix(vec3(.16,.09,.07),vec3(.015,.02,.05),smoothstep(.2,1.,y)); c+=vec3(.5,.22,.1)*exp(-pow((y-.42)*5.,2.))*.4; gl_FragColor=vec4(c,1.); }`);
}
