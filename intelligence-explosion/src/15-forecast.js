// =====================================================================
// 15 · FORECAST — "The horizon is collapsing." A flight down an endless
// neon timeline. Each year is a rung; each decade a glowing gate. The
// forecasts are beacons on the road ahead, and they keep sliding toward us.
// One pinhole camera model is shared by the shader and the 2D labels.
// =====================================================================
import { SCENES, THREE, clamp, lerp, E, shader, pass, V, text, AU } from './00-core.js';

{
  const H0 = 1.15, F = 1.25, PITCH = .02; // camera height, focal length (in screen heights), downward pitch
  const zOf = y => -(y - 2025) * 2.6;      // one year = 1.6 units down the road
  const mat = shader(`uniform float uT,uAsp,uCamZ,uM,uS,uMtrail,uStrail,uSon,uWarp;
const float H0=${H0.toFixed(3)}, F=${F.toFixed(3)}, PITCH=${PITCH.toFixed(3)};
float zOf(float y){ return -(y-2025.)*2.6; }
vec3 beacon(vec3 ro,vec3 rd,vec3 c,float r,vec3 col){ vec3 v=c-ro; float tp=max(dot(v,rd),0.); float d=length(v-rd*tp); return col*(exp(-d*d/(r*r))*5.+.0006/(d*d+.0006)); }
void main(){
  vec2 p=(vUv-.5)*vec2(uAsp,1.);
  vec3 rc=normalize(vec3(p,-F));
  vec3 rd=vec3(rc.x, rc.y*cos(PITCH)+rc.z*sin(PITCH), -rc.y*sin(PITCH)+rc.z*cos(PITCH));
  vec3 ro=vec3(0.,H0,uCamZ);
  // sky: deep blue to magenta horizon, stars, a huge low sun-disc of "the future"
  float hy=rd.y;
  vec3 col=mix(vec3(.55,.08,.35),vec3(.02,.02,.08),smoothstep(-.02,.3,hy));
  col=mix(col,vec3(.004,.004,.02),smoothstep(.3,.9,hy));
  vec2 sp=vec2(atan(rd.x,-rd.z),hy); float sd=length((sp-vec2(0.,.06))*vec2(1.,1.));
  float disc=smoothstep(.22,.215,sd);
  float bands=step(.5,fract((sp.y-.06)*38.-uT*.3))+step(.1,sp.y-.06+.0);
  col+=disc*mix(vec3(1.,.3,.55),vec3(1.,.8,.35),smoothstep(-.1,.25,sp.y))*.9*clamp(bands,0.,1.);
  col+=vec3(1.,.3,.6)*exp(-sd*5.)*.35;
  vec3 q=rd*300.; float h=hash13(floor(q)); col+=vec3(.9,.9,1.)*step(.997,h)*smoothstep(.5,0.,length(fract(q)-.5))*smoothstep(.05,.3,hy);
  float tHit=1e9;
  if(rd.y<0.){
    float t=-ro.y/rd.y; tHit=t; vec3 P=ro+rd*t;
    float year=2025.-P.z/2.6;
    float fw=fwidth(year);
    float rung=1.-smoothstep(0.,fw*1.5,abs(fract(year)-.5)*2.-1.+fw*1.5);
    rung=smoothstep(1.-fw*2.,1.,1.-abs(fract(year+.5)-.5)*2.)*0.;
    float lineY=(1.-smoothstep(0.,fw*1.3,.5-abs(fract(year)-.5)))*clamp(1.-fw*1.5,0.,1.);
    float fwd=fwidth(year/10.); float dec=(1.-smoothstep(0.,fwd*1.6,.5-abs(fract(year/10.)-.5)))*clamp(1.-fwd*3.,0.,1.);
    float xl=abs(P.x); float rails=exp(-pow((xl-2.2)*14.,2.))+exp(-pow(xl*30.,2.))*.5;
    float fwx=fwidth(P.x/1.1); float lanes=(1.-smoothstep(0.,fwx*1.3,.5-abs(fract(P.x/1.1)-.5)))*clamp(1.-fwx*2.,0.,1.);
    vec3 g=vec3(.01,.008,.03);
    g+=vec3(.15,.85,1.)*lineY*.35*smoothstep(3.,0.,xl-2.2) + vec3(1.,.4,.8)*dec*.9*smoothstep(4.,0.,xl-2.)+vec3(.2,.5,1.)*lanes*.12;
    g+=vec3(.25,.9,1.)*rails*1.4;
    // the past glows warm behind the beacons' trails
    float tr1=uMtrail>0.?smoothstep(.25,0.,abs(P.x+1.1))*step(zOf(2033.+ (uM-2033.)) ,P.z)*step(P.z,zOf(uMtrail))*0.:0.;
    // reflections of the sky
    vec3 rr=reflect(rd,vec3(0.,1.,0.)); vec2 rsp=vec2(atan(rr.x,-rr.z),rr.y); float rsd=length(rsp-vec2(0.,.06));
    g+=vec3(1.,.35,.6)*exp(-rsd*4.)*.12;
    float fog=1.-exp(-t*.012);
    col=mix(g,vec3(.2,.04,.16),fog*.9);
  }
  // decade gates: glowing arches standing over the road
  for(int i=0;i<7;i++){ float yr=2030.+float(i)*10.; float z=zOf(yr); float t=(z-ro.z)/rd.z; if(t<=0.||t>tHit) continue;
    vec3 P=ro+rd*t; float a=abs(length(vec2(P.x,P.y*1.15))-2.35); float fade=exp(-t*.02);
    col+=vec3(1.,.35,.75)*(exp(-a*a*900.)*1.6+exp(-a*14.)*.12)*step(0.,P.y)*fade; }
  // the forecasts: cyan = Metaculus community, amber = expert survey
  col+=beacon(ro,rd,vec3(-1.5,.95,zOf(uM)),.12,vec3(.3,.95,1.));
  col+=beacon(ro,rd,vec3(1.5,.95,zOf(uS)),.12,vec3(1.,.7,.25))*uSon;
  // comet trails along the road behind each beacon
  for(int k=0;k<2;k++){ float x=k==0?-1.5:1.5; float y0=k==0?uMtrail:uStrail; float y1=k==0?uM:uS; vec3 c=k==0?vec3(.3,.95,1.):vec3(1.,.7,.25)*uSon;
    if(y0<=y1) continue;
    for(int s=0;s<24;s++){ float f=float(s)/23.; float yr=mix(y1,y0,f); vec3 C=vec3(x,.95,zOf(yr)); vec3 v=C-ro; float tp=max(dot(v,rd),0.); float d=length(v-rd*tp);
      col+=c*exp(-d*d/(.0016+f*.004))*(1.-f)*.35; } }
  col*=1.+uWarp*.6;
  gl_FragColor=vec4(col,1.); }`, { uT: { value: 0 }, uAsp: { value: 1.78 }, uCamZ: { value: 0 }, uM: { value: 2070 }, uS: { value: 2060 }, uMtrail: { value: 2070 }, uStrail: { value: 2060 }, uSon: { value: 0 }, uWarp: { value: 0 } });
  // same camera in JS for labels
  function proj(x, y, z, camZ) {
    const vx = x, vy = y - H0, vz = z - camZ;
    const yc = vy * Math.cos(PITCH) - vz * Math.sin(PITCH), zc = vy * Math.sin(PITCH) + vz * Math.cos(PITCH);
    if (zc > -.05) return null;
    const px = vx / -zc * F, py = yc / -zc * F;
    return { x: V.W / 2 + px * V.H, y: V.H / 2 - py * V.H, d: -zc };
  }
  SCENES.push({
    id: 'forecast', title: 'The horizon is collapsing', enterWith: 'kaleido', hud: { color: '#ff9fd0' },
    beats: [{ dur: 3, hold: 4 }, { dur: 3.5, hold: 4 }, { dur: 3.5, hold: 4 }, { dur: 3, hold: 2 }],
    bed: { chord: [0, 5, 9, 12], oct: 3, cut: 1100, vol: .04, wave: 'sawtooth', sub: .12, arp: { notes: [0, 4, 7, 11, 14, 11, 7, 4], oct: 4, rate: 6, voice: 'sawtooth', len: .1, vol: .03, delay: .45 }, pulse: { kind: 'kick', rate: 1.53, vol: .35 }, level: [.4, .5, .6, .75] },
    notes: [
      'In 2020, the forecasting community on Metaculus put the arrival of general AI about fifty years away: around 2070.',
      'By February 2026, the same community\'s median was 2033. The beacon has been sliding down the road toward us.',
      'Experts moved too. In AI Impacts\' 2022 survey of thousands of AI researchers, the 50% date for machines beating humans at every task was about 2060. One year later, in the 2023 survey, it was 2047: thirteen years closer in twelve months.',
      'The horizon is not standing still. It is coming toward us. So what are the forecasters seeing?',
    ],
    create() {
      return {
        update(s) {
          const u = mat.uniforms; u.uT.value = s.t; u.uAsp.value = V.W / V.H;
          const m = s.on(1) ? lerp(2070, 2033, E.io3(s.p[1])) : 2070, sv = s.on(2) ? lerp(2060, 2047, E.io3(clamp((s.at(2) - .6) / 2.8))) : 2060;
          u.uM.value = m; u.uMtrail.value = s.on(1) ? lerp(2070, m, clamp(s.at(1) - 2.6)) : 2070; u.uS.value = sv; u.uStrail.value = s.on(2) ? lerp(2060, sv, clamp(s.at(2) - 3.2)) : 2060;
          u.uSon.value = s.k(2, 0, .8);
          const rush = s.on(3) ? E.inExpo(s.p[3]) : 0;
          u.uCamZ.value = Math.sin(s.t * .3) * .05 - Math.min(s.t * .05, 3) - rush * (Math.abs(zOf(2033)) - 4); u.uWarp.value = rush;
          s.camZ = u.uCamZ.value;
          s.post = { streak: .5, flare: .2, bloom: .55, threshold: 1.1, exposure: .9, vignette: .5, grain: .035, ca: .002 + rush * .02, halation: .4 };
          if (s.cross(1, .1)) AU.hit('riser'); if (s.cross(1, 3.3)) AU.hit('bell'); if (s.cross(2, .5)) AU.hit('glass'); if (s.cross(2, 3.3)) AU.hit('bell'); if (s.cross(3, .1)) { AU.hit('zoom'); AU.hit('riser'); } if (s.cross(1, 2.9) || s.cross(2, 3.1)) AU.hit('ding'); if (s.cross(1, .1) || s.cross(2, .6)) AU.hit('whoosh'); if (s.cross(0, .3)) AU.hit('glitch');
          if (s.bed) s.bed.param('arpRate', s.on(3) ? 6 + s.p[3] * 18 : 6);
        },
        render(slot) { pass(mat, slot.hdr); },
        draw2d(g, s) {
          const W = V.W, H = V.H, k = Math.min(W / 1920, H / 1080) * (V.portrait ? 1.6 : 1), x = (V.portrait ? 60 : 120) * k;
          // decade labels on the gates
          g.font = `500 ${18 * k}px "Geist Mono", monospace`; g.textAlign = 'center';
          for (let yr = 2030; yr <= 2090; yr += 10) { const pp = proj(0, 2.75, zOf(yr), s.camZ); if (!pp) continue; g.globalAlpha = clamp(1.4 - pp.d / 60); g.fillStyle = '#ffd1ec'; g.font = `500 ${clamp(30 / pp.d * 10, 9, 26) * k}px "Geist Mono", monospace`; g.fillText(yr, pp.x, pp.y); }
          g.globalAlpha = 1; g.textAlign = 'left';
          const tag = (bx, yr, col, l1, l2, a) => { const pp = proj(bx, .95, zOf(yr), s.camZ); if (!pp || a <= 0) return; g.globalAlpha = a; const left = bx < 0; const tx = pp.x + (left ? -24 : 24) * k; g.textAlign = left ? 'right' : 'left'; g.fillStyle = col; g.font = `300 ${58 * k}px Unbounded, sans-serif`; g.fillText(Math.round(yr), tx, pp.y - 46 * k); g.font = `500 ${17 * k}px "Geist Mono", monospace`; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(l1, tx, pp.y - 14 * k); g.fillText(l2, tx, pp.y + 6 * k); g.textAlign = 'left'; g.globalAlpha = 1; };
          const rush = s.on(3) ? s.p[3] : 0;
          tag(-1.5, mat.uniforms.uM.value, '#7ff3ff', 'METACULUS COMMUNITY', s.on(1) ? 'FEB 2026' : 'IN 2020', (1 - rush * 2));
          tag(1.5, mat.uniforms.uS.value, '#ffc46b', 'AI RESEARCHER SURVEY', s.on(2) && s.at(2) > 2 ? '2023' : '2022', s.k(2, .2, 1) * (1 - rush * 2));
          const out = b => s.beat > b ? clamp(s.at(b + 1) / .5) : 0;
          const H1 = ['General AI?\nAbout fifty years away.', 'Six years later:\n2033.', 'Experts: 13 years closer\nin a single year.', 'The horizon is\ncoming toward us.'];
          const anims = ['decode', 'flip', 'mask', 'zoom'];
          for (let b = 0; b < 4; b++) if (s.beat >= b && out(b) < 1) text(g, H1[b], { x, y: H * (V.portrait ? .12 : .16), size: (V.portrait ? 50 : 76) * k, font: 'Unbounded', weight: 300, color: '#fff', track: -.035, lh: 1.08, anim: anims[b], by: b === 2 ? 'line' : undefined, accent: '#ff7ad1', glow: 'rgba(255,60,160,.35)', maxW: W - 2 * x }, s.k(b, .2, 1.6, E.lin), out(b));
          const caps = ['Metaculus forecasting community, 2020', 'Metaculus community median, February 2026', 'AI Impacts expert surveys: ~2060 (2022) → 2047 (2023)', ''];
          if (caps[s.beat]) text(g, caps[s.beat], { x, y: H * (V.portrait ? .12 : .16) + 190 * k, size: 20 * k, font: 'Geist Mono', color: 'rgba(255,220,240,.7)', anim: 'fade' }, s.k(s.beat, 1, 2, E.lin));
        },
      };
    },
  });
}
