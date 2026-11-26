// =====================================================================
// 90 · DECK ENGINE — scenes, beats, slots, transitions, HUD, UI, audio,
// hash routing, overview thumbnails, warm-up, adaptive quality.
// =====================================================================
import { SCENES, THREE, R, QS, HEADLESS, QUICK, clamp, E, shader, pass, makeRT, grade, bloom, mOverlay, V, computeVirtual, text, AU } from './00-core.js';
import { TRANSITIONS } from './05-transitions.js';

const $ = id => document.getElementById(id);
const QUAL = [1, .84, .7, .58];
let qi = 0, PW = 2, PH = 2, CW = 2, CH = 2;

// ---------- slots: two full pipelines (current + incoming) ----------
function makeSlot() {
  const oc = document.createElement('canvas'); const og = oc.getContext('2d');
  const otex = new THREE.CanvasTexture(oc); otex.colorSpace = THREE.NoColorSpace; otex.minFilter = THREE.LinearFilter; otex.generateMipmaps = false;
  return { hdr: null, aux: null, ldr: null, oc, og, otex, owner: -1 };
}
const slots = [makeSlot(), makeSlot()];
let trRT = null, accRT = [null, null], accI = 0;
function sizeSlots() {
  for (const s of slots) {
    [s.hdr, s.aux, s.ldr].forEach(r => r && r.dispose());
    s.hdr = makeRT(PW, PH, { depth: true }); s.aux = makeRT(PW, PH, { depthTex: true }); s.ldr = makeRT(PW, PH, { ldr: true });
    s.oc.width = PW; s.oc.height = PH; s.otex.dispose();
  }
  trRT && trRT.dispose(); trRT = makeRT(PW, PH, { ldr: true });
  accRT.forEach(r => r && r.dispose()); accRT = [makeRT(PW, PH, { ldr: true }), makeRT(PW, PH, { ldr: true })];
}
function resize() {
  CW = innerWidth; CH = innerHeight;
  const pr = Math.min(devicePixelRatio || 1, 2);
  let w = CW * pr, h = CH * pr; const cap = 2560 * 1600; if (w * h > cap) { const k = Math.sqrt(cap / (w * h)); w *= k; h *= k; }
  PW = Math.round(w * QUAL[qi]); PH = Math.round(h * QUAL[qi]);
  R.setPixelRatio(w / CW); R.setSize(CW, CH, false); canvas2.style.width = CW + 'px'; canvas2.style.height = CH + 'px';
  computeVirtual(CW, CH); sizeSlots(); bloom.size(PW, PH);
  scenes.forEach(sc => sc.hooks.resize && sc.hooks.resize(sc.s));
}
const canvas2 = R.domElement;

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
// graphics context loss (GPU reset, tab backgrounded on some phones): tell the viewer and reload cleanly
canvas2.addEventListener('webglcontextlost', e => { e.preventDefault(); const d = document.createElement('div'); d.id = 'lost'; d.textContent = 'Graphics were reset. Reloading…'; d.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:#030308;color:#cfd3ff;font:500 13px "Geist Mono",monospace;letter-spacing:.3em;z-index:40'; document.body.appendChild(d); }, false);
canvas2.addEventListener('webglcontextrestored', () => location.reload(), false);
const mAccum = shader(`uniform sampler2D tCur, tPrev; uniform float uK; void main(){ gl_FragColor=vec4(mix(texture(tCur,vUv).rgb,texture(tPrev,vUv).rgb,uK),1.); }`, { tCur: { value: null }, tPrev: { value: null }, uK: { value: 0 } });
// ---------- present pass (dither + black) ----------
const mPresent = shader(`uniform sampler2D tSrc; uniform float uBlack, uTime;
void main(){ vec3 c=texture(tSrc,vUv).rgb; c+= (hash13(vec3(gl_FragCoord.xy,fract(uTime)*91.))-.5)/255.; gl_FragColor=vec4(c*(1.-uBlack),1.); }`, { tSrc: { value: null }, uBlack: { value: 0 }, uTime: { value: 0 } });

// ---------- scene state ----------
const mouse = { x: 0, y: 0, tx: 0, ty: 0, down: false };
const ctxObj = { R, THREE, V, mouse, slots };
const scenes = SCENES.map((def, idx) => {
  const beats = def.beats.map(b => Object.assign({ dur: 1, hold: 2, delay: 0 }, b));
  const s = {
    idx, def, t: 0, dt: 0, beat: 0, bt: beats.map(() => 0), pbt: beats.map(() => 0), p: beats.map(() => 0), beats, enter: 0, dir: 1, mouse, q: 1, post: {}, page: null, V,
    at(i) { return Math.max(0, this.bt[i] - this.beats[i].delay); },
    k(i, t0, t1, ease = E.io3) { return ease(clamp((this.at(i) - t0) / Math.max(1e-4, t1 - t0))); },
    since(i) { return this.beat >= i ? this.at(i) : -1; },
    cross(i, t) { const d = this.beats[i].delay; return this.pbt[i] - d < t && this.bt[i] - d >= t && this.beat >= i; },
    on(i) { return this.beat >= i; },
  };
  const hooks = def.create(ctxObj, s) || {};
  const bed = def.bed ? new AU.Bed(def.bed) : null; s.bed = bed;
  return { def, s, hooks, bed, thumb: null };
});

let cur = 0, tr = null, black = false, auto = false, tNow = 0;
function stepState(sc, dt) {
  const s = sc.s; s.dt = dt; s.t += dt; s.enter += dt;
  for (let i = 0; i < s.beats.length; i++) {
    s.pbt[i] = s.bt[i];
    if (i <= s.beat) s.bt[i] += dt; else s.bt[i] = Math.max(0, s.bt[i] - dt * 2.4);
    s.p[i] = clamp((s.bt[i] - s.beats[i].delay) / s.beats[i].dur);
  }
  sc.hooks.update && sc.hooks.update(s);
}
const hudState = new Map();
function drawHUD(sc, og) {
  const s = sc.s, h = sc.def.hud || {}, beat = s.beats[s.beat];
  const str = s.page ?? beat.page ?? String(sc.s.idx + 1);
  let st = hudState.get(sc); if (!st || st.str !== str) { st = { str, t: tNow }; hudState.set(sc, st); }
  if (h.hidden || s.hideHud) return;
  // deck progress: one segment per slide, the current one filling beat by beat
  { const n = scenes.length, kk = Math.min(V.W / 1920, V.H / 1080) * (V.portrait ? 1.6 : 1), tw = Math.min(V.W * .3, 300 * kk), gap = 4 * kk, sw = (tw - gap * (n - 1)) / n, y = V.H - 40 * kk, x0 = 56 * kk;
    const col = s.hudColor || h.color || '#fff';
    og.save(); og.globalAlpha = .55;
    for (let i = 0; i < n; i++) { const f = i < sc.s.idx ? 1 : i > sc.s.idx ? 0 : clamp((s.beat + s.p[s.beat]) / s.beats.length); og.fillStyle = 'rgba(255,255,255,.18)'; og.fillRect(x0 + i * (sw + gap), y, sw, 2 * kk); og.fillStyle = col; og.fillRect(x0 + i * (sw + gap), y, sw * f, 2 * kk); }
    og.restore(); }
  const arial = h.font === 'arial';
  text(og, str, {
    x: V.W - 56, y: V.H - 44, size: arial ? 26 : 22, font: arial ? 'Arial' : 'Geist Mono', weight: arial ? 400 : 500, align: 'right',
    color: s.hudColor || h.color || '#fff', alpha: h.alpha ?? .9, anim: arial ? 'fade' : 'rise', stagger: .4,
  }, arial ? 1 : clamp((tNow - st.t) / .55));
}
function renderScene(sc, slot) {
  const s = sc.s;
  if (slot.owner !== s.idx) { slot.owner = s.idx; }
  R.setRenderTarget(slot.hdr); R.setClearColor(0x000000, 1); R.clear();
  sc.hooks.render && sc.hooks.render(slot, s);
  grade(slot, s.post, tNow);
  const og = slot.og, k = PW / V.W;
  og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, PW, PH); og.setTransform(k, 0, 0, k, 0, 0);
  sc.hooks.draw2d && sc.hooks.draw2d(og, s);
  drawHUD(sc, og);
  slot.otex.needsUpdate = true; mOverlay.uniforms.tOv.value = slot.otex;
  pass(mOverlay, slot.ldr);
}

// ---------- thumbnails ----------
const thumbRT = makeRT(384, 216, { ldr: true }); const thumbBuf = new Uint8Array(384 * 216 * 4);
const mCopyLdr = shader(`uniform sampler2D tSrc; void main(){ gl_FragColor=vec4(texture(tSrc,vUv).rgb,1.); }`, { tSrc: { value: null } });
function snapshot(sc, slot) {
  mCopyLdr.uniforms.tSrc.value = slot.ldr.texture; pass(mCopyLdr, thumbRT);
  R.readRenderTargetPixels(thumbRT, 0, 0, 384, 216, thumbBuf);
  const c = sc.thumb || document.createElement('canvas'); c.width = 384; c.height = 216; const g = c.getContext('2d'); const img = g.createImageData(384, 216);
  for (let y = 0; y < 216; y++) img.data.set(thumbBuf.subarray((215 - y) * 384 * 4, (216 - y) * 384 * 4), y * 384 * 4);
  g.putImageData(img, 0, 0); sc.thumb = c;
}

// ---------- navigation ----------
function enterScene(i, atEnd, dir) {
  const sc = scenes[i], s = sc.s; s.dir = dir; s.enter = 0;
  if (atEnd) { s.beat = s.beats.length - 1; s.bt = s.beats.map(b => b.delay + b.dur + 30); s.pbt = s.bt.slice(); }
  else { s.beat = 0; s.bt = s.beats.map(() => 0); s.pbt = s.beats.map(() => 0); s.t = 0; }
  s.p = s.beats.map(() => atEnd ? 1 : 0);
  sc.hooks.enter && sc.hooks.enter(s, atEnd);
  if (sc.bed) sc.bed.set(sc.def.bed.level?.[s.beat] ?? .5, sc.def.bed.cut);
}
AU.onInit = () => { const sc = scenes[cur]; if (sc && sc.bed) sc.bed.set(sc.def.bed.level?.[sc.s.beat] ?? .5); };
function exitScene(i) { const sc = scenes[i]; sc.hooks.exit && sc.hooks.exit(sc.s); if (sc.bed) sc.bed.set(0); }
function goScene(i, dir) {
  if (i < 0 || i >= scenes.length || tr) return;
  const from = cur;
  if (dir > 0) {
    const t = TRANSITIONS[scenes[i].def.enterWith] || TRANSITIONS.fade;
    enterScene(i, false, 1); tr = { A: from, B: i, t: 0, dur: t.dur, T: t, rev: false, speed: 1, fresh: true };
  } else {
    const t = TRANSITIONS[scenes[from].def.enterWith] || TRANSITIONS.fade;
    enterScene(i, true, -1); tr = { A: i, B: from, t: 0, dur: t.dur * .7, T: t, rev: true, speed: 1, fresh: true };
  }
  // crossfade the two soundscapes across the transition, and play the transition's own sound design
  const inc = scenes[i], out_ = scenes[from];
  if (out_.bed) out_.bed.set(0, null, tr.dur * .35);
  if (inc.bed) inc.bed.set(inc.def.bed.level?.[inc.s.beat] ?? .5, inc.def.bed.cut, tr.dur * .3);
  AU.trans(tr.T.id, tr.dur, tr.rev);
}
function finishTr() {
  if (!tr) return;
  const target = tr.rev ? tr.A : tr.B, leaving = tr.rev ? tr.B : tr.A;
  snapshot(scenes[leaving], slots[1]);  // the leaving scene was in slot 1 on its last frame
  exitScene(leaving); cur = target; tr = null; syncUI();
}
function next() {
  if (tr) { tr.speed = Math.min(tr.speed * 2.5, 8); return; }
  const sc = scenes[cur], s = sc.s;
  if (s.beat < s.beats.length - 1) { s.beat++; s.dir = 1; sc.hooks.beat && sc.hooks.beat(s, 1); if (sc.bed) sc.bed.set(sc.def.bed.level?.[s.beat] ?? .5); syncUI(); }
  else goScene(cur + 1, 1);
}
function back() {
  if (tr) { tr.speed = Math.min(tr.speed * 2.5, 8); return; }
  const sc = scenes[cur], s = sc.s;
  if (s.beat > 0) { s.beat--; s.dir = -1; sc.hooks.beat && sc.hooks.beat(s, -1); if (sc.bed) sc.bed.set(sc.def.bed.level?.[s.beat] ?? .5); syncUI(); }
  else goScene(cur - 1, -1);
}
function jump(i, beat = 0) {
  if (tr) finishTr();
  exitScene(cur); cur = clamp(i, 0, scenes.length - 1); enterScene(cur, false, 1);
  const s = scenes[cur].s; for (let b = 0; b < beat && b < s.beats.length - 1; b++) { s.bt[b] = s.beats[b].delay + s.beats[b].dur + 30; s.beat = b + 1; }
  syncUI();
}

// ---------- UI ----------
let notesWin = null;
function syncUI() {
  const sc = scenes[cur], s = sc.s;
  const h = `#${sc.def.id}-${s.beat + 1}`; if (location.hash !== h) history.replaceState(null, '', h);
  const note = (sc.def.notes || [])[s.beat] || '';
  $('notesMeta').textContent = `${fmtTime(tNow)} · slide ${cur + 1} of ${scenes.length} · beat ${s.beat + 1} of ${s.beats.length} · ${sc.def.title}`;
  $('notesText').textContent = note;
  $('live').textContent = `Slide ${cur + 1}: ${sc.def.title}`;
  if (notesWin && !notesWin.closed) { try { notesWin.document.getElementById('m').textContent = $('notesMeta').textContent; notesWin.document.getElementById('t').textContent = note; } catch (e) { } }
  [...$('ovGrid').children].forEach((b, i) => b.classList.toggle('cur', i === cur));
}
const fmtTime = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function buildOverview() {
  const g = $('ovGrid'); g.innerHTML = '';
  scenes.forEach((sc, i) => {
    const b = document.createElement('button'); b.type = 'button';
    const ph = sc.thumb ? sc.thumb : Object.assign(document.createElement('div'), { className: 'ph' });
    if (sc.thumb) { const c = document.createElement('canvas'); c.width = 384; c.height = 216; c.getContext('2d').drawImage(sc.thumb, 0, 0); b.appendChild(c); } else b.appendChild(ph);
    const sp = document.createElement('span'); sp.textContent = `${String(i + 1).padStart(2, '0')} · ${sc.def.title}`; b.appendChild(sp);
    b.addEventListener('click', e => { e.stopPropagation(); toggle('ov', false); jump(i); });
    if (i === cur) b.classList.add('cur'); g.appendChild(b);
  });
}
function toggle(id, on) {
  const el = $(id); const v = on ?? !el.classList.contains('on'); el.classList.toggle('on', v);
  if (id === 'ov' && v) { buildOverview(); }
  if (id === 'notes') $('bNotes').classList.toggle('on', v);
}
function openNotesWindow() {
  try {
    notesWin = window.open('', 'notes', 'width=520,height=360');
    if (!notesWin) { toggle('notes', true); return; }
    notesWin.document.write('<title>Speaker notes</title><body style="background:#111;color:#eee;font:18px/1.5 system-ui;padding:20px"><div id=m style="opacity:.6;font:13px monospace;margin-bottom:10px"></div><div id=t></div></body>');
    syncUI();
  } catch (e) { toggle('notes', true); }
}
function setAuto(v) { auto = v; $('bAuto').classList.toggle('on', v); }
function setMute(v) { AU.mute(v); $('bMute').classList.toggle('on', v); $('bMute').textContent = v ? 'M̶' : 'M'; }
function fullscreen() { const d = document; if (d.fullscreenElement) d.exitFullscreen?.(); else d.documentElement.requestFullscreen?.().catch(() => { }); }
const bind = (id, fn) => $(id).addEventListener('click', e => { e.stopPropagation(); AU.init(); fn(); });
bind('bPrev', back); bind('bNext', next); bind('bOv', () => toggle('ov')); bind('bNotes', () => toggle('notes'));
bind('bAuto', () => setAuto(!auto)); bind('bMute', () => setMute(!AU.muted)); bind('bFs', fullscreen); bind('bHelp', () => toggle('help'));
$('help').addEventListener('click', () => toggle('help', false));

addEventListener('keydown', e => {
  AU.init();
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(k)) { e.preventDefault(); next(); }
  else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); back(); }
  else if (k === 'Home') jump(0); else if (k === 'End') jump(scenes.length - 1);
  else if (k === 'f' || k === 'F') fullscreen();
  else if (k === 'a' || k === 'A') setAuto(!auto);
  else if (k === 'm' || k === 'M') setMute(!AU.muted);
  else if (k === 'n' || k === 'N') toggle('notes');
  else if (k === 'p' || k === 'P') openNotesWindow();
  else if (k === 'o' || k === 'O') toggle('ov');
  else if (k === '?' || k === 'h' || k === 'H') toggle('help');
  else if (k === '.' || k === 'b' || k === 'B') { black = !black; $('black').classList.toggle('on', black); }
  else if (k === 'Escape') { ['ov', 'help'].forEach(id => toggle(id, false)); }
  else if (/^[0-9]$/.test(k)) { const i = k === '0' ? 9 : +k - 1; if (i < scenes.length) jump(i); }
  wake();
});
let idleT = 0; const wake = () => { document.body.classList.remove('idle'); idleT = 0; };
let sx0 = null, sy0 = 0, swiped = false;
addEventListener('touchend', () => AU.init(), { passive: true });
canvas2.addEventListener('pointerdown', e => { AU.init(); sx0 = e.clientX; sy0 = e.clientY; swiped = false; mouse.down = true; });
addEventListener('pointerup', e => {
  mouse.down = false;
  if (sx0 === null) return; const dx = e.clientX - sx0, dy = e.clientY - sy0; sx0 = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { swiped = true; dx < 0 ? next() : back(); }
});
canvas2.addEventListener('click', e => { if (swiped) return; if (e.button === 0 && !scenes[cur].s.captureClicks) next(); });
canvas2.addEventListener('contextmenu', e => { e.preventDefault(); back(); });
const curEl = $('cur'); let cx = 0, cy = 0, tcx = 0, tcy = 0;
(function curLoop() { cx += (tcx - cx) * .22; cy += (tcy - cy) * .22; curEl.style.transform = `translate(${cx}px,${cy}px)`; requestAnimationFrame(curLoop); })();
addEventListener('pointerdown', () => curEl.classList.add('dn')); addEventListener('pointerup', () => curEl.classList.remove('dn'));
addEventListener('pointermove', e => { tcx = e.clientX; tcy = e.clientY; });
addEventListener('pointermove', e => { mouse.tx = e.clientX / CW * 2 - 1; mouse.ty = -(e.clientY / CH * 2 - 1); mouse.px = e.clientX / CW * V.W; mouse.py = e.clientY / CH * V.H; wake(); }, { passive: true });
addEventListener('hashchange', () => routeHash());
function routeHash() {
  const m = location.hash.slice(1).match(/^([a-z]+)(?:-(\d+))?$/); if (!m) return false;
  const i = scenes.findIndex(sc => sc.def.id === m[1]); if (i < 0) return false;
  const b = Math.max(0, (+m[2] || 1) - 1); if (i === cur && scenes[i].s.beat === b) return true;
  jump(i, b); return true;
}
addEventListener('resize', () => resize());

// ---------- frame loop ----------
let last = performance.now(), dtS = 16, qT = 0, goodT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(.1, (now - last) / 1000); last = now; if (HEADLESS && window.__fixedDt) dt = window.__fixedDt;
  tNow += dt; idleT += dt; if (idleT > 2.2) document.body.classList.add('idle');
  const mk = 1 - Math.exp(-5 * dt); mouse.x += (mouse.tx - mouse.x) * mk; mouse.y += (mouse.ty - mouse.y) * mk;
  // adaptive quality
  dtS += (dt * 1000 - dtS) * .05; qT += dt;
  if (!HEADLESS && qT > 2.5 && !tr) {
    if (dtS > 21 && qi < QUAL.length - 1) { qi++; qT = 0; goodT = 0; resize(); }
    else if (dtS < 14.5) { goodT += dt; if (goodT > 5 && qi > 0) { qi--; qT = 0; goodT = 0; resize(); } } else goodT = 0;
  }
  // auto-play
  if (auto && !tr) { const s = scenes[cur].s, b = s.beats[s.beat]; if (s.at(s.beat) > b.dur + b.hold) next(); }
  if (tr) {
    tr.t += Math.min(dt, 1 / 30) * tr.speed; const A = scenes[tr.A], B = scenes[tr.B];
    stepState(A, dt); stepState(B, dt);
    // slot 0 = the scene we're heading to, slot 1 = the scene we're leaving
    const goingTo = tr.rev ? A : B, leaving = tr.rev ? B : A;
    renderScene(goingTo, slots[0]); renderScene(leaving, slots[1]);
    const p = clamp(tr.t / tr.dur), pe = tr.T.linear ? p : .5 - .5 * Math.cos(Math.PI * p), P = tr.rev ? 1 - pe : pe;
    const m = tr.T.mat; m.uniforms.tA.value = (tr.rev ? slots[0] : slots[1]).ldr.texture; m.uniforms.tB.value = (tr.rev ? slots[1] : slots[0]).ldr.texture;
    m.uniforms.uP.value = P; m.uniforms.uTime.value = tNow; m.uniforms.uAsp.value = CW / CH;
    pass(m, trRT);
    // motion-blur trail: blend with the previous transition frame, strongest mid-way, none at the ends
    const prev = accRT[accI], nxt = accRT[1 - accI];
    mAccum.uniforms.tCur.value = trRT.texture; mAccum.uniforms.tPrev.value = prev.texture; mAccum.uniforms.uK.value = tr.fresh || REDUCED ? 0 : .55 * Math.sin(Math.PI * p);
    pass(mAccum, nxt); accI = 1 - accI; tr.fresh = false; present(nxt);
    if (p >= 1) finishTr();
  } else {
    const sc = scenes[cur]; stepState(sc, dt); renderScene(sc, slots[1]); present(slots[1].ldr);
  }
  if (Math.floor(tNow) !== Math.floor(tNow - dt)) $('notesMeta').textContent = `${fmtTime(tNow)} · slide ${cur + 1} of ${scenes.length} · beat ${scenes[cur].s.beat + 1} of ${scenes[cur].s.beats.length} · ${scenes[cur].def.title}`;
}
function present(rt) { mPresent.uniforms.tSrc.value = rt.texture; mPresent.uniforms.uBlack.value = 0; mPresent.uniforms.uTime.value = tNow; pass(mPresent, null); }

// ---------- boot: fonts, warm-up (compile everything), start ----------
async function boot() {
  resize();
  const fams = ['300 40px Unbounded', '800 40px Unbounded', '400 40px Geist', '700 40px Geist', '800 40px Geist', '500 40px "Geist Mono"', 'italic 400 40px Newsreader', '400 40px Anton', '700 40px "JetBrains Mono"', '400 40px Silkscreen'];
  await Promise.race([Promise.all(fams.map(f => document.fonts.load(f).catch(() => { }))), new Promise(r => setTimeout(r, 3500))]);
  const bar = $('loadbar'); const tick = () => new Promise(r => requestAnimationFrame(r));
  scenes.forEach(sc => sc.hooks.init && sc.hooks.init(sc.s));
  if (!QUICK) {
    const n = scenes.length + Object.keys(TRANSITIONS).length;
    let k = 0;
    for (const sc of scenes) {
      for (let b = 0; b < sc.s.beats.length; b += Math.max(1, sc.s.beats.length - 1)) { jump(sc.s.idx, b); stepState(sc, .016); renderScene(sc, slots[1]); }
      bar.style.width = (++k / n * 100) + '%'; await tick();
    }
    for (const t of Object.values(TRANSITIONS)) { t.mat.uniforms.tA.value = slots[0].ldr.texture; t.mat.uniforms.tB.value = slots[1].ldr.texture; pass(t.mat, trRT); bar.style.width = (++k / n * 100) + '%'; }
    await tick();
  }
  cur = 0; jump(0); routeHash();
  $('load').classList.add('gone'); setTimeout(() => $('load').remove(), 700);
  last = performance.now(); requestAnimationFrame(frame);
  window.__deck = { AU, next, back, jump, scenes, get cur() { return cur; }, get tr() { return tr; } };
}
boot();
