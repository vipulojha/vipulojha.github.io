// =====================================================================
// 70 · CALENDAR — the compressed century. One printed year, then ten,
// then a hundred, each filling day by day as the camera pulls back.
// =====================================================================
import { SCENES, THREE, clamp, lerp, E, shader, pass, V, text, AU } from './00-core.js';

{
  const paper = shader(`uniform float uT,uAsp; void main(){ vec2 p=vUv*vec2(uAsp,1.);
  vec3 c=vec3(.95,.925,.87)*(.94+.06*fbm(p*9.))*(.985+.015*vnoise(p*600.));
  c*=1.-.18*length(vUv-vec2(.4,.6)); gl_FragColor=vec4(toLin(c),1.); }`, { uT: { value: 0 }, uAsp: { value: 1.78 } });
  const MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], MN = 'JFMAMJJASOND';
  const INK = '#2b2620', RED = '#c8321e';
  function cal(g, x, y, w, h, year, f, k) {
    g.strokeStyle = 'rgba(43,38,32,.35)'; g.lineWidth = Math.max(.6, w * .002);
    if (w > 240) {
      const mw = w / 4, mh = (h - w * .07) / 3, top = y + w * .07;
      g.fillStyle = INK; g.font = `600 ${w * .05}px Geist, sans-serif`; g.fillText(year, x, y + w * .05);
      let day = 0;
      for (let m = 0; m < 12; m++) {
        const mx = x + (m % 4) * mw, my = top + Math.floor(m / 4) * mh, cw = (mw * .9) / 7, chh = (mh * .78) / 6;
        g.fillStyle = 'rgba(43,38,32,.6)'; g.font = `500 ${Math.max(6, mw * .07)}px "Geist Mono", monospace`; g.fillText(MN[m], mx, my + mh * .12);
        const off = (m * 3 + year) % 7;
        for (let d = 0; d < MD[m]; d++, day++) {
          const c = (d + off) % 7, r = Math.floor((d + off) / 7), cx = mx + c * cw, cy = my + mh * .18 + r * chh;
          const on = day / 365 < f;
          g.fillStyle = on ? (c === 6 ? '#8f1d0e' : RED) : 'rgba(43,38,32,.07)';
          g.fillRect(cx + 1, cy + 1, cw - 2, chh - 2);
        }
      }
    } else if (w > 50) {
      g.fillStyle = INK; g.font = `600 ${w * .11}px Geist, sans-serif`; g.fillText(year, x, y + w * .1);
      for (let m = 0; m < 12; m++) { const mx = x + (m % 4) * w / 4, my = y + w * .16 + Math.floor(m / 4) * (h - w * .16) / 3; const mf = clamp(f * 12 - m); g.fillStyle = 'rgba(43,38,32,.08)'; g.fillRect(mx + 1, my + 1, w / 4 - 2, (h - w * .16) / 3 - 2); g.fillStyle = RED; g.fillRect(mx + 1, my + 1, (w / 4 - 2) * mf, (h - w * .16) / 3 - 2); }
    } else { g.fillStyle = 'rgba(43,38,32,.1)'; g.fillRect(x, y, w, h); g.fillStyle = RED; g.fillRect(x, y + h * (1 - f), w, h * f); }
  }
  SCENES.push({
    id: 'calendar', title: 'The compressed century', enterWith: 'tear', hud: { color: '#2b2620' },
    beats: [{ dur: 6, hold: 2 }, { dur: 7, hold: 2 }, { dur: 8, hold: 4 }],
    bed: { chord: [0, 4, 7], oct: 4, cut: 1800, vol: .03, level: [.3, .4, .55] },
    notes: [
      'This is one year of scientific progress at today\'s pace. Each red square is a day of work by every researcher on Earth.',
      'Now run research ten times faster. Every calendar year, a decade of progress prints.',
      'At a hundred times, the whole 21st century of science could print by the mid-2030s. Dario Amodei calls this the compressed 21st century: 50 to 100 years of progress in biology in 5 to 10 years. The bottleneck stops being thinking and becomes experiments, factories and permission.',
    ],
    create(ctx, s) {
      let lastDay = 0;
      return {
        update(s) {
          s.post = { tonemap: 0, bloom: 0, vignette: .25, grain: .04, ca: .0008 };
          const Y = s.on(2) ? lerp(10, 100, E.io2(s.p[2])) : s.on(1) ? lerp(1, 10, E.io2(s.p[1])) : s.p[0];
          s.Y = Y; const tick = Math.floor(Y * (s.on(1) ? 12 : 60)); if (tick !== lastDay) { lastDay = tick; AU.hit(s.on(2) ? 'click' : 'tick'); }
          if (s.cross(1, 0) || s.cross(2, 0)) AU.hit('paper'); if (s.cross(2, 7.6)) AU.hit('bell');
        },
        render(slot) { paper.uniforms.uAsp.value = V.W / V.H; pass(paper, slot.hdr); },
        draw2d(g, s) {
          const W = V.W, H = V.H, k = Math.min(W / 1920, H / 1080) * (V.portrait ? 1.6 : 1);
          // world: 10×10 grid of year cards, card i = 2026 + i
          const cw = 300, ch = 240, gap = 30, gx = i => (i % 10) * (cw + gap), gy = i => Math.floor(i / 10) * (ch + gap);
          const views = [{ x: -20, y: -20, w: cw + 40, h: ch + 40 }, { x: -40, y: -60, w: 10 * (cw + gap) + 50, h: ch + 120 }, { x: -60, y: -60, w: 10 * (cw + gap) + 90, h: 10 * (ch + gap) + 90 }];
          const z = s.on(2) ? 1 + E.io3(clamp(s.at(2) / 2.2)) : s.on(1) ? E.io3(clamp(s.at(1) / 1.8)) : 0;
          const a = views[Math.floor(Math.min(z, 1.999))], b = views[Math.min(2, Math.floor(Math.min(z, 1.999)) + 1)], f = z - Math.floor(Math.min(z, 1.999));
          const lv = (p, q) => Math.exp(lerp(Math.log(p), Math.log(q), f));
          const vw = lv(a.w, b.w), vh = lv(a.h, b.h), vx = lerp(a.x, b.x, f), vy = lerp(a.y, b.y, f);
          const area = { x: V.portrait ? 40 * k : W * .34, y: V.portrait ? H * .34 : H * .12, w: V.portrait ? W - 80 * k : W * .62, h: V.portrait ? H * .5 : H * .76 };
          const sc = Math.min(area.w / vw, area.h / vh);
          g.save(); g.translate(area.x + (area.w - vw * sc) / 2, area.y + (area.h - vh * sc) / 2); g.scale(sc, sc); g.translate(-vx, -vy);
          for (let i = 0; i < 100; i++) { const x = gx(i), y = gy(i); if ((x - vx) * sc > area.w + 400 || (y - vy) * sc > area.h + 400) continue; cal(g, x, y, cw, ch, 2026 + i, clamp(s.Y - i), k); }
          g.restore();
          const x = (V.portrait ? 60 : 110) * k, big = (V.portrait ? 54 : 72) * k;
          const out = b => s.beat > b ? clamp(s.at(b + 1) / .5) : 0;
          const H1 = ['One year\nof science.', 'At 10×,\na decade\nevery year.', 'At 100×,\na century\nby 2036.'];
          for (let b = 0; b < 3; b++) if (s.beat >= b && out(b) < 1) text(g, H1[b], { x, y: V.portrait ? H * .1 : H * .2, size: big, font: 'Unbounded', weight: 300, color: INK, track: -.04, lh: 1.05, anim: 'rise', maxW: V.portrait ? W - 2 * x : W * .3 }, s.k(b, .2, 1.3, E.lin), out(b));
          // counters
          const cy = V.portrait ? H * .26 : H * .74;
          g.font = `500 ${18 * k}px "Geist Mono", monospace`; g.fillStyle = 'rgba(43,38,32,.6)'; g.fillText('CALENDAR', x, cy); g.fillText('SCIENCE', x + 230 * k, cy);
          const cal0 = s.on(2) ? Math.round(lerp(2027, 2036, s.p[2])) : s.on(1) ? 2027 : 2026;
          g.font = `300 ${54 * k}px Unbounded, sans-serif`; g.fillStyle = INK; g.fillText(cal0, x, cy + 62 * k); g.fillStyle = RED; g.fillText(Math.floor(2026 + s.Y), x + 230 * k, cy + 62 * k);
          if (s.beat === 2) text(g, 'After Dario Amodei, “Machines of Loving Grace” (2024)', { x, y: cy + 110 * k, size: 18 * k, font: 'Geist', color: 'rgba(43,38,32,.6)', anim: 'fade' }, s.k(2, 3, 4, E.lin));
        },
      };
    },
  });
}
