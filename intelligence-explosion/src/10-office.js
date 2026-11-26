// =====================================================================
// 10 · OFFICE — "The Future of AI". A deliberately bad PowerPoint that
// edits itself, then redesigns one word nine times, then hands off to
// the real chart.
// =====================================================================
import { SCENES, THREE, R, clamp, lerp, sstep, E, prng, shader, pass, V, text, SelBox, wordCanvas, samplePoints, AU } from './00-core.js';

// METR 50%-success time horizons (hours). Approximate, from METR's published
// figures (TH1/TH1.1). Opus 4.6 uses the corrected ~12 h estimate; Mythos
// Preview is the 17.4 h early estimate (95% CI 8.5–55 h).
const METR = [
  { y: 2019.12, h: 0.0006, n: 'GPT-2' }, { y: 2020.42, h: 0.0025, n: 'GPT-3' }, { y: 2022.2, h: 0.01, n: 'GPT-3.5' },
  { y: 2023.2, h: 0.08, n: 'GPT-4', lab: 'GPT-4 · 5 min' }, { y: 2024.37, h: 0.15, n: 'GPT-4o' }, { y: 2024.8, h: 0.35, n: 'Claude 3.5 Sonnet' },
  { y: 2024.96, h: 0.65, n: 'o1' }, { y: 2025.15, h: 0.98, n: 'Claude 3.7 Sonnet', lab: 'Claude 3.7 Sonnet · 1 hour' }, { y: 2025.3, h: 1.5, n: 'o3' },
  { y: 2025.6, h: 2.3, n: 'GPT-5' }, { y: 2025.9, h: 4.8, n: 'Claude Opus 4.5', lab: 'Opus 4.5 · 4.8 hours' },
  { y: 2026.1, h: 12, n: 'Claude Opus 4.6', lab: 'Opus 4.6 · ~12 hours' }, { y: 2026.3, h: 17.4, n: 'Claude Mythos Preview', lab: 'Mythos Preview · ~17 hours' },
];
function drawMetrCard(c) {
  const g = c.getContext('2d'), W = c.width, H = c.height;
  g.fillStyle = '#fbfaf7'; g.fillRect(0, 0, W, H);
  const L = 150, Rr = W - 80, T = 190, B = H - 130;
  g.fillStyle = '#111'; g.font = '600 46px Geist, Arial'; g.fillText('How long a task can AI finish on its own?', L - 40, 92);
  g.fillStyle = '#6b6b6b'; g.font = '400 26px Geist, Arial'; g.fillText('Task length (human time) at 50% success · METR', L - 40, 136);
  const X = y => L + (y - 2019) / (2026.6 - 2019) * (Rr - L), Y = h => B - h / 18 * (B - T);
  g.strokeStyle = '#e3e0d8'; g.lineWidth = 2; g.font = '400 22px "Geist Mono", monospace'; g.fillStyle = '#8a8a8a';
  for (let h = 0; h <= 18; h += 3) { g.beginPath(); g.moveTo(L, Y(h)); g.lineTo(Rr, Y(h)); g.stroke(); g.textAlign = 'right'; g.fillText(h + ' h', L - 14, Y(h) + 7); }
  g.textAlign = 'center'; for (let y = 2019; y <= 2026; y++) g.fillText(y, X(y), B + 40);
  g.strokeStyle = '#d4331a'; g.lineWidth = 6; g.lineJoin = 'round'; g.beginPath(); METR.forEach((d, i) => i ? g.lineTo(X(d.y), Y(d.h)) : g.moveTo(X(d.y), Y(d.h))); g.stroke();
  METR.forEach(d => { g.beginPath(); g.arc(X(d.y), Y(d.h), 7, 0, 7); g.fillStyle = '#d4331a'; g.fill(); });
  g.textAlign = 'right'; g.fillStyle = '#111'; g.font = '500 24px Geist, Arial';
  [[METR[3], 'GPT-4 · 5 min'], [METR[10], 'Opus 4.5 · 4.8 h'], [METR[11], 'Opus 4.6 · ~12 h'], [METR[12], 'Mythos Preview · ~17 h']].forEach(([d, l]) => g.fillText(l, X(d.y) - 16, Y(d.h) - 14));
  g.textAlign = 'left'; g.fillStyle = '#9a9a9a'; g.font = '400 19px Geist, Arial'; g.fillText('Approximate values. Later estimates have wide error bars.', L - 40, H - 40);
}

{
  const sel = new SelBox();
  const RED = 11.6, VD = 1.7, WIPE = .45, NV = 9;
  const BG = ['#ffffff', '#f1f2f2', '#cfe0ee', '#ffd21f', '#8fe0b8', '#2347d9', '#ff9db8', '#c9a58c', '#b8c9e0'];
  const HUDC = ['#111111', '#e51e16', '#0b2346', '#111111', '#0a3d2a', '#ffffff', '#3a0d1c', '#ffffff', '#1c2b45'];
  const WIPES = [null, 'circle', 'diagonal', 'bars', 'pixels', 'columns', 'wavy', 'ring', 'gl'];
  let chart, chrome, pts, ptsMat, cam, scene3, maskTex, blurTex, prevTitleN = -1, prevBul = 5, lastVar = -1;
  const u = () => Math.min(V.W / 1920, V.H / 1080) * (V.portrait ? 1.7 : 1);

  function wipePath(g, kind, e, i) {
    const W = V.W, H = V.H; g.beginPath();
    switch (kind) {
      case 'circle': g.arc(W * .72, H * .5, Math.hypot(W, H) * E.in2(e), 0, 7); break;
      case 'diagonal': { const x = lerp(-H, W + H, E.io3(e)); g.moveTo(-10, -10); g.lineTo(x, -10); g.lineTo(x - H, H + 10); g.lineTo(-10, H + 10); break; }
      case 'bars': { const n = 9; for (let k = 0; k < n; k++) { const ek = clamp(e * 1.6 - k / n * .6); g.rect(0, k * H / n, W * E.out3(ek), H / n + 1); } break; }
      case 'pixels': { const n = 24, cs = W / n, rr = prng(7); for (let y = 0; y < H / cs + 1; y++) for (let x = 0; x < n; x++) if (rr() < e * 1.05) g.rect(x * cs, y * cs, cs + 1, cs + 1); break; }
      case 'columns': { const n = 12; for (let k = 0; k < n; k++) { const ek = E.out3(clamp(e * 1.7 - k / n * .7)); const cw = W / n; g.rect(k * cw + cw / 2 * (1 - ek), 0, cw * ek + 1, H); } break; }
      case 'wavy': { const x0 = lerp(-60, W + 60, E.io3(e)); g.moveTo(-10, -10); for (let y = -10; y <= H + 10; y += 20) g.lineTo(x0 + Math.sin(y * .012 + e * 9) * 50, y); g.lineTo(-10, H + 10); break; }
      case 'ring': { const r = Math.hypot(W, H) * .6 * E.in2(e); g.arc(W / 2, H / 2, r, 0, 7); break; }
    }
  }
  // ---------- the nine redesigns ----------
  function variant(g, i, tt) {
    const W = V.W, H = V.H, k = u();
    g.fillStyle = BG[i]; if (i < 7) g.fillRect(0, 0, W, H);
    const big = Math.min(W * .9, H * 1.4);
    switch (i) {
      case 0: { // white, grid lines draw in
        g.strokeStyle = '#e6e6e6'; g.lineWidth = 1.5;
        for (let c = 0; c < 13; c++) { const e = E.out3(clamp(tt * 2.2 - c * .05)); const x = (c + .5) / 13 * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H * e); g.stroke(); }
        for (let r = 0; r < 8; r++) { const e = E.out3(clamp(tt * 2.2 - .3 - r * .05)); const y = (r + .5) / 8 * H; g.beginPath(); g.moveTo(0, y); g.lineTo(W * e, y); g.stroke(); }
        return text(g, 'I can fix it.', { x: W / 2, y: H / 2, size: big * .12, font: 'Geist', weight: 700, align: 'center', valign: 'middle', color: '#111', track: -.04, anim: 'rise' }, clamp(tt * 2));
      }
      case 1: { // red disc drifting in from the right
        const x = lerp(W * 1.35, W * .74, E.out4(clamp(tt / 1.4)));
        g.fillStyle = '#e51e16'; g.beginPath(); g.arc(x, H * .48, H * .42, 0, 7); g.fill();
        return text(g, 'Better.', { x: W * .1, y: H * .58, size: big * .22, font: 'Geist', weight: 800, color: '#111', track: -.05, anim: 'blur', by: 'glyph' }, clamp(tt * 1.8));
      }
      case 2: { // Newsreader italic, letters rise skewed + rotating, four rules
        g.strokeStyle = 'rgba(11,35,70,.35)'; g.lineWidth = 1.5;
        [.2, .32, .74, .86].forEach((yy, j) => { const e = E.out3(clamp(tt * 1.8 - j * .1)); g.beginPath(); g.moveTo(W * .06, H * yy); g.lineTo(W * (.06 + .88 * e), H * yy); g.stroke(); });
        return text(g, 'Better.', { x: W / 2, y: H * .66, size: big * .3, font: 'Newsreader', italic: true, weight: 400, align: 'center', color: '#0b2346', track: -.03, anim: 'fade', stagger: .5,
          fn: (gg, e) => ({ dy: (1 - e) * big * .2, r: (1 - e) * -.5, sk: (1 - e) * .5 }) }, clamp(tt * 1.6));
      }
      case 3: { // Anton, stretched to fill the width, sine-modulated, alternate drop
        const word = 'BETTER', n = word.length; const ws = []; let sum = 0;
        for (let j = 0; j < n; j++) { const w = 1 + .38 * Math.sin(tt * 3.2 + j * 1.3); ws.push(w); sum += w; }
        const total = W * .94; let x = W * .03; const size = 200; g.font = `400 ${size}px Anton, Impact, sans-serif`; g.fillStyle = '#111';
        for (let j = 0; j < n; j++) {
          const cw = ws[j] / sum * total, mw = g.measureText(word[j]).width, e = E.outBack(clamp(tt * 2.6 - j * .12));
          const dir = j % 2 ? -1 : 1, oy = (1 - e) * H * 1.1 * dir;
          g.save(); g.translate(x, H * .9 + oy); g.scale(cw / mw, H * .82 / (size * .74)); g.fillText(word[j], 0, 0); g.restore(); x += cw;
        }
        return { x: W * .03, y: H * .08, w: total, h: H * .82 };
      }
      case 4: { // pixel font, stepped at 14 fps, snapping blocks scroll
        const ts = Math.floor(tt * 14) / 14; g.fillStyle = '#0a3d2a';
        const bs = H / 18; for (let c = -1; c < W / bs + 2; c++) { const off = (Math.floor(ts * 14) % 4) * bs / 4 * 4; if ((c + Math.floor(ts * 14 / 4)) % 3 === 0) g.fillRect(c * bs - off % bs, H - bs * 1.6, bs * .8, bs * .8); }
        return text(g, 'better.', { x: W / 2, y: H * .56, size: big * .17, font: 'Silkscreen', weight: 400, align: 'center', valign: 'middle', color: '#0a3d2a', anim: 'fade', stagger: .7, ease: x => x > 0 ? 1 : 0,
          fn: (gg, e) => ({ dy: Math.round(Math.sin(ts * 9 + gg.gi) * 3) * 6 }) }, clamp(ts * 2.4));
      }
      case 5: { // blue, 19 lines of mono with a radial wave, a giant "better" drops on top
        const rows = 19, rh = H / rows, fs = rh * .78; g.font = `700 ${fs}px "JetBrains Mono", monospace`; g.fillStyle = 'rgba(255,255,255,.55)';
        const cw = g.measureText('m').width, line = 'better than ';
        for (let r = 0; r < rows; r++) for (let c = 0; c * cw < W + cw; c++) {
          const ch = line[(c + r * 3) % line.length]; const x = c * cw + cw / 2, y = (r + .5) * rh;
          const d = Math.hypot(x - W / 2, (y - H / 2) * 1.4) / W; const s = 1 + .55 * Math.max(0, Math.sin(d * 18 - tt * 7));
          g.save(); g.translate(x, y + fs * .35); g.scale(s, s); g.fillText(ch, -cw / 2, 0); g.restore();
        }
        return text(g, 'better', { x: W / 2, y: H * .6, size: big * .26, font: 'Geist', weight: 800, align: 'center', valign: 'middle', color: '#fff', track: -.05, anim: 'drop', alt: true, stagger: .35 }, clamp(tt * 1.7));
      }
      case 6: { // pink, ten concentric rings of "better", counter-rotating
        const cx = W / 2, cy = H / 2, R0 = Math.min(W, H) * .07, rs = Math.max(W, H) * .062;
        for (let ring = 0; ring < 10; ring++) {
          const r = R0 + ring * rs * (1 + ring * .06), fs = rs * .62, dir = ring % 2 ? 1 : -1;
          g.font = `800 ${fs}px Unbounded, sans-serif`; g.fillStyle = ring % 2 ? '#3a0d1c' : '#fff4e4';
          const word = 'better · ', ww = g.measureText(word).width, reps = Math.max(1, Math.floor(2 * Math.PI * r / ww));
          const str = word.repeat(reps); let a = tt * .5 * dir / (1 + ring * .3) + ring;
          const grow = E.out3(clamp(tt * 2.2 - ring * .07)); if (grow <= 0) continue;
          for (const ch of str) { const cw = g.measureText(ch).width; const ang = a + cw / 2 / r; g.save(); g.translate(cx + Math.cos(ang) * r * grow, cy + Math.sin(ang) * r * grow); g.rotate(ang + Math.PI / 2); g.fillText(ch, -cw / 2, fs * .35); g.restore(); a += cw / r; }
        }
        return { x: cx - R0 * 2.2, y: cy - R0 * 2.2, w: R0 * 4.4, h: R0 * 4.4 };
      }
    }
    // GL variants: just report the word box for the selection frame
    const ww = Math.min(W * .86, H * 1.72), hh = ww / 2 * .62;
    return { x: (W - ww) / 2, y: H / 2 - hh / 2, w: ww, h: hh };
  }

  SCENES.push({
    id: 'office', title: 'The Future of AI', enterWith: 'fade', hud: { font: 'arial', color: '#7f7f7f', alpha: 1 },
    beats: [{ dur: .6, hold: 3, page: '1' }, { dur: 2.4, hold: 4, page: '2' }, { dur: 31, hold: 2, page: '2' }],
    notes: [
      'Here is a presentation about the future of AI. It looks like every presentation about the future of AI.',
      'An agenda. Some bullets. A chart called "projected". Do not touch anything for the next half minute. Let the deck work.',
      'The deck rewrites itself: deletes the agenda, fixes the chart, and redesigns one word nine times in about fifteen seconds. That speed is the point. Then it lands on the one chart that matters.',
    ],
    create(ctx, s) {
      chart = document.createElement('canvas'); chart.width = 1600; chart.height = 900;
      // GL: liquid chrome word + paper confetti word
      const sharp = wordCanvas('Better.', '800 %spx Geist, Arial', 1024, 512), soft = wordCanvas('Better.', '800 %spx Geist, Arial', 1024, 512, 14);
      maskTex = new THREE.CanvasTexture(sharp); blurTex = new THREE.CanvasTexture(soft);
      chrome = shader(`uniform sampler2D tMask,tBlur; uniform float uAsp,uT,uFade; uniform vec3 uBg,uBg2;
vec3 env(vec3 r){ float y=r.y;
  vec3 c=mix(vec3(.06,.04,.035),vec3(1.4,.72,.4),smoothstep(-.45,.05,y));
  c=mix(c,vec3(.28,.42,1.1),smoothstep(.12,.85,y));
  c+=vec3(2.,1.2,.7)*exp(-pow((y-.02)*9.,2.));
  c+=vec3(6.)*smoothstep(.025,0.,abs(y-.36+.08*sin(r.x*3.+uT*.8)));
  return c; }
void main(){
  vec2 p=(vUv-.5)*vec2(uAsp,1.);
  float ww=min(uAsp*.86,1.72); vec2 wuv=p/vec2(ww,ww*.5)+.5;
  vec2 rip=vec2(fbm(wuv*5.+uT*.7),fbm(wuv*5.-uT*.6+3.))-.5;
  vec2 q=wuv+rip*.012;
  float m=texture(tMask,q).r, hb=texture(tBlur,q).r;
  vec2 e=vec2(1./512.,0.);
  float hx=texture(tBlur,q+e.xy).r-texture(tBlur,q-e.xy).r, hy=texture(tBlur,q+e.yx).r-texture(tBlur,q-e.yx).r;
  vec3 n=normalize(vec3(-hx*9.+rip.x*.6,-hy*9.+rip.y*.6,1.));
  vec3 r=reflect(vec3(0.,0.,-1.),n);
  float fres=pow(1.-n.z,2.);
  vec3 chromeC=env(r)*(.6+.6*fres);
  float sh=texture(tBlur,wuv+vec2(-.012,.03)).r;
  vec3 bg=mix(uBg,uBg2,uFade)*(1.-sh*.35*(1.-uFade));
  float inside=smoothstep(.42,.58,m)*(1.-uFade);
  gl_FragColor=vec4(mix(bg,chromeC,inside),1.); }`,
        { tMask: { value: maskTex }, tBlur: { value: blurTex }, uAsp: { value: 1.78 }, uT: { value: 0 }, uFade: { value: 0 }, uBg: { value: new THREE.Color('#c9a58c') }, uBg2: { value: new THREE.Color('#b8c9e0') } });
      chrome.uniforms.uBg.value.convertSRGBToLinear(); chrome.uniforms.uBg2.value.convertSRGBToLinear();
      // confetti: ~7000 paper pieces fly in from depth to form the word
      const N = 7000, P = samplePoints(sharp, N, 3), rr = prng(11);
      const aT = new Float32Array(N * 3), aS = new Float32Array(N * 3), aSeed = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        aT.set([P[i][0] * 3.4, P[i][1] * 1.7, (rr() - .5) * .04], i * 3);
        const a = rr() * 6.283, rad = 1.5 + rr() * 4; aS.set([Math.cos(a) * rad, Math.sin(a) * rad * .7, -8 - rr() * 30], i * 3); aSeed[i] = rr();
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(aT, 3)); geo.setAttribute('aS', new THREE.BufferAttribute(aS, 3)); geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
      ptsMat = shader(`varying float vR; varying float vShade; varying float vSeed;
void main(){ vec2 c=gl_PointCoord-.5; c=rot(vR)*c; if(abs(c.x)>.42||abs(c.y)>.27) discard;
  vec3 paper=mix(vec3(.96,.94,.9),vec3(.9,.42,.45),step(.93,vSeed)); paper=mix(paper,vec3(.25,.4,.85),step(.97,vSeed));
  gl_FragColor=vec4(toLin(paper)*vShade,1.); }`,
        { uP: { value: 0 }, uScatter: { value: 0 }, uTime: { value: 0 }, uSize: { value: 30 } },
        { depth: true, vert: `attribute vec3 aS; attribute float aSeed; uniform float uP,uScatter,uTime,uSize; varying float vR; varying float vShade; varying float vSeed; varying vec2 vUv;
void main(){ float k=clamp((uP-aSeed*.45)/.55,0.,1.); k=1.-pow(1.-k,3.);
  vec3 p=mix(aS,position,k);
  p+=(1.-k)*vec3(sin(uTime*2.+aSeed*40.),cos(uTime*1.7+aSeed*30.),0.)*.25;
  vec3 dir=normalize(vec3(position.xy*1.2+vec2(sin(aSeed*91.),cos(aSeed*53.))*.6,1.));
  p+=dir*uScatter*(1.5+aSeed*5.);
  vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=uSize/-mv.z;
  vR=aSeed*30.+uTime*(1.+aSeed*3.)*(1.-k*.9)+uScatter*aSeed*8.; vShade=.55+.45*abs(cos(vR*1.3+aSeed*5.)); vSeed=aSeed; vUv=vec2(0.); }` });
      pts = new THREE.Points(geo, ptsMat); pts.frustumCulled = false;
      scene3 = new THREE.Scene(); scene3.add(pts); cam = new THREE.PerspectiveCamera(36, 1.78, .1, 100);
      return {
        init() { drawMetrCard(chart); },
        enter() { prevTitleN = -1; prevBul = 5; lastVar = -1; sel.hide(); },
        update(s) {
          const T = s.at(2), red = s.on(2) && T >= RED;
          s.hideHud = !red; s.post = red && T >= RED + 7 * VD - WIPE ? { tonemap: 0, bloom: .7, threshold: .95, vignette: .15, grain: .02, ca: .001 } : { tonemap: 0, bloom: 0, vignette: 0, grain: .012, ca: 0 };
          if (red) { const a = Math.min(NV - 1, Math.floor((T - RED) / VD)); s.page = String(3 + a); s.hudColor = T > 27.9 ? '#111' : HUDC[a]; }
          else { s.page = null; s.hudColor = null; }
          // sounds for the self-editing sequence
          if (s.on(2)) {
            if (s.cross(2, 3.4) || s.cross(2, 5.4) || s.cross(2, 7.6) || s.cross(2, 8.2)) AU.hit('select');
            if (s.cross(2, 3.9)) AU.hit('riser');
            if (s.cross(2, 7.9)) AU.hit('pop');
            if (s.cross(2, RED)) AU.hit('snap');
            for (let i = 1; i < NV; i++) if (s.cross(2, RED + i * VD)) AU.hit(i === 7 ? 'shimmer' : i === 8 ? 'paper' : 'whoosh');
            if (s.cross(2, RED + 8 * VD + 1.9)) AU.hit('whoosh');
            if (s.cross(2, 27.9)) AU.hit('flap');
            if (s.cross(2, 29.4)) AU.hit('thud');
          }
        },
        render(slot, s) {
          const T = s.at(2); if (!s.on(2) || T < RED + 7 * VD - WIPE) return;
          const asp = V.W / V.H; chrome.uniforms.uAsp.value = asp; chrome.uniforms.uT.value = s.t;
          chrome.uniforms.uFade.value = sstep(RED + 8 * VD - WIPE, RED + 8 * VD + .3, T);
          pass(chrome, slot.hdr);
          if (T > RED + 8 * VD - WIPE) {
            const lt = T - (RED + 8 * VD - WIPE);
            ptsMat.uniforms.uP.value = clamp(lt / 1.6); ptsMat.uniforms.uScatter.value = E.in3(clamp((lt - 2.3) / 1.6)); ptsMat.uniforms.uTime.value = s.t;
            ptsMat.uniforms.uSize.value = slot.hdr.height * .02;
            cam.aspect = asp; cam.fov = asp < 1 ? 70 : 36; cam.position.set(Math.sin(lt * .3) * .4, .05, lerp(5.6, 4.4, E.out3(clamp(lt / 2.5)))); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
            R.setRenderTarget(slot.hdr); R.render(scene3, cam);
          }
        },
        draw2d(g, s) {
          const W = V.W, H = V.H, k = u(), T = s.at(2), red = s.on(2) && T >= RED;
          if (!red) {
            g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
            // footer bar
            g.fillStyle = '#a9c0e2'; g.fillRect(0, H - 78 * k, W, 8 * k); g.fillStyle = '#3f6fb5'; g.fillRect(0, H - 70 * k, W, 70 * k);
            g.fillStyle = '#7f7f7f'; g.font = `${26 * k}px Arial`; g.textAlign = 'right'; g.fillText(s.on(1) ? '2' : '1', W - 56 * k, H - 100 * k); g.textAlign = 'left';
            if (!s.on(1) || (s.p[1] < 1 && s.dir < 0 && s.beat === 0)) {
              const a = E.out2(clamp(s.at(0) / .5));
              g.globalAlpha = a * (1 - s.p[1]);
              text(g, 'The Future of AI', { x: W / 2, y: H * .46, size: 96 * k, font: 'Arial', weight: 400, align: 'center', color: '#000', anim: 'fade' });
              text(g, 'An Overview', { x: W / 2, y: H * .46 + 90 * k, size: 44 * k, font: 'Arial', weight: 400, align: 'center', color: '#595959', anim: 'fade' });
              g.globalAlpha = 1;
            }
            if (s.on(1)) {
              const tA = s.at(1), port = V.portrait;
              // title (self-editing)
              let title = 'Agenda', typing = false;
              if (s.on(2)) {
                const del = (str, t0, t1) => str.slice(0, Math.max(0, str.length - Math.floor(clamp((T - t0) / (t1 - t0)) * (str.length + .999))));
                const typ = (str, t0, t1) => str.slice(0, Math.floor(clamp((T - t0) / (t1 - t0)) * str.length));
                if (T < 1.05) title = del('Agenda', .3, 1.0);
                else if (T < 8.4) title = typ('This slide is bad.', 1.1, 2.9);
                else if (T < 9.55) title = del('This slide is bad.', 8.4, 9.4);
                else title = typ('I can fix it.', 9.6, 10.9);
                typing = T > .25;
                if (prevTitleN !== -1 && title.length !== prevTitleN) AU.hit(title.length > prevTitleN ? 'type' : 'delete');
                prevTitleN = title.length;
              }
              const tx = (port ? 80 : 140) * k, ty = 190 * k;
              g.globalAlpha = E.out2(clamp(tA / .3));
              g.fillStyle = '#000'; g.font = `${80 * k}px Arial`; g.fillText(title, tx, ty);
              if (typing && (Math.floor(s.t * 2.2) % 2 === 0 || (T > .3 && T < 11))) { const tw = g.measureText(title).width; g.fillRect(tx + tw + 4 * k, ty - 66 * k, 3 * k, 80 * k); }
              const titleBox = { x: tx - 16 * k, y: ty - 80 * k, w: Math.max(260 * k, g.measureText(title).width + 40 * k), h: 104 * k };
              // bullets fly in from the left, then get deleted one by one
              const items = ['Introduction', 'Benefits and challenges', 'Best practices', 'Next steps', 'Questions'];
              const nB = s.on(2) ? 5 - Math.floor(clamp((T - 5.8) / 1.5) * 5.999) : 5;
              if (nB < prevBul) AU.hit('delete'); prevBul = nB;
              const bx = (port ? 90 : 170) * k, by = 330 * k;
              g.font = `${46 * k}px Arial`;
              for (let i = 0; i < nB; i++) { const e = E.out3(clamp((tA - .3 - i * .35) / .5)); g.globalAlpha = e; g.fillStyle = '#000'; g.fillText('•  ' + items[i], bx - (1 - e) * 700 * k, by + i * 92 * k); }
              g.globalAlpha = 1;
              const bulBox = { x: bx - 20 * k, y: by - 56 * k, w: 640 * k, h: 92 * k * 5 };
              // Excel-style chart
              const cb = port ? { x: 80 * k, y: 900 * k, w: W - 160 * k, h: 560 * k } : { x: 1040 * k, y: 290 * k, w: 760 * k, h: 520 * k };
              const chartGone = s.on(2) && T > 7.9;
              const ce = E.out2(clamp((tA - 1.6) / .6));
              if (!chartGone && ce > 0) {
                g.globalAlpha = ce;
                g.fillStyle = '#595959'; g.font = `${30 * k}px Arial`; g.textAlign = 'center'; g.fillText('AI Progress (Projected)', cb.x + cb.w / 2, cb.y + 34 * k);
                const px = cb.x + 70 * k, pw = cb.w - 100 * k, py = cb.y + 70 * k, ph = cb.h - 150 * k;
                g.strokeStyle = '#d9d9d9'; g.lineWidth = 1.5 * k; g.font = `${20 * k}px Arial`; g.fillStyle = '#595959'; g.textAlign = 'right';
                for (let i = 0; i <= 5; i++) { const y = py + ph - i / 5 * ph; g.beginPath(); g.moveTo(px, y); g.lineTo(px + pw, y); g.stroke(); g.fillText(i * 20, px - 10 * k, y + 7 * k); }
                g.textAlign = 'center'; ['2022', '2023', '2024', '2025', '2026'].forEach((l, i) => g.fillText(l, px + i / 4 * pw, py + ph + 30 * k));
                const bend = s.on(2) ? E.io3(clamp((T - 3.9) / 1.1)) : 0;
                const lin = [10, 22, 31, 40, 52], ex = [3, 5, 9, 24, 100];
                g.strokeStyle = '#4472c4'; g.lineWidth = 4.5 * k; g.beginPath();
                for (let i = 0; i < 5; i++) { const v = lerp(lin[i], ex[i], bend); const x = px + i / 4 * pw, y = py + ph - v / 100 * ph; i ? g.lineTo(x, y) : g.moveTo(x, y); }
                g.stroke();
                g.fillStyle = '#4472c4'; g.fillRect(cb.x + cb.w / 2 - 70 * k, cb.y + cb.h - 30 * k, 16 * k, 16 * k); g.fillStyle = '#595959'; g.textAlign = 'left'; g.fillText('Series 1', cb.x + cb.w / 2 - 44 * k, cb.y + cb.h - 15 * k);
                g.globalAlpha = 1;
              }
              g.textAlign = 'left';
              if (s.on(2)) {
                if (T >= 3.4 && T < 5.4) sel.set(cb); else if (T >= 5.4 && T < 7.6) sel.set(bulBox); else if (T >= 7.6 && T < 8.05) sel.set(cb); else if (T >= 8.2) sel.set(titleBox); else sel.hide();
              } else sel.hide();
            }
          } else {
            // redesign sequence
            const a = Math.min(NV - 1, Math.floor((T - RED) / VD)), tt = T - RED - a * VD;
            let box;
            if (tt < WIPE && a > 0) {
              const e = tt / WIPE, kind = WIPES[a];
              if (a < 7) { variant(g, a - 1, tt + VD); g.save(); wipePath(g, kind, e, a); g.clip(); box = variant(g, a, tt); g.restore(); }
              else if (a === 7) { g.save(); g.beginPath(); g.rect(0, 0, W, H); wipePath(g, kind, e, a); g.clip('evenodd'); variant(g, 6, tt + VD); g.restore(); box = variant(g, 7, tt); }
              else box = variant(g, a, tt);
            } else box = variant(g, a, tt);
            if (a !== lastVar) { lastVar = a; if (a > 0) AU.hit('select', 0, .05); }
            const cardT = T - 27.9;
            if (cardT < 0 && box) sel.set(box); else sel.hide();
            // the real chart flies in as a card, flips, then fills the frame
            if (cardT > 0) {
              const fl = E.out4(clamp(cardT / 1.3)), fill = E.io4(clamp((cardT - 1.6) / 1));
              const cw0 = Math.min(W * .62, H * .62 * 16 / 9), ch0 = cw0 * 9 / 16;
              const scale = Math.max(W / cw0, H / ch0);
              const sc = lerp(1, scale, fill), ang = (1 - fl) * Math.PI * .5;
              g.save(); g.translate(W / 2, H / 2 + (1 - fl) * H * .6); g.rotate((1 - fl) * -.25 * (1 - fill)); g.scale(Math.cos(ang) * sc, sc);
              g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 60 * (1 - fill); g.shadowOffsetY = 30 * (1 - fill);
              g.drawImage(chart, -cw0 / 2, -ch0 / 2, cw0, ch0); g.restore();
            }
          }
          sel.draw(g, s.dt, k);
        },
      };
    },
  });
}
