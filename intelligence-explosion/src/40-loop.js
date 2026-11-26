// =====================================================================
// 40 · LOOP — AI building AI, as flat mechanical posters drawn entirely in
// one fragment shader (SDF ink layers). Each beat: a new poster, faster.
// =====================================================================
import { SCENES, THREE, clamp, E, shader, pass, V, text, AU } from './00-core.js';

{
  const mat = shader(`uniform float uT,uAsp,uMix,uFrom,uTo,uSpeed,uZoom,uResY; uniform vec2 uOff,uMouse;
#define BLK vec3(.07,.065,.06)
#define PAP vec3(.95,.92,.86)
#define YEL vec3(.97,.78,.05)
#define RED vec3(.9,.23,.18)
#define PNK vec3(.96,.64,.71)
#define ORG vec3(.95,.42,.12)
#define BLU vec3(.18,.44,.84)
#define ULT vec3(.17,.16,.66)
float px;
void ink(inout vec3 c, vec3 k, float d){ c=mix(c,k,1.-smoothstep(-px,px,d)); }
void line(inout vec3 c, vec3 k, float d, float w){ ink(c,k,abs(d)-w); }
float gear(vec2 p,float R,float n,float th,float a){ p=rot(a)*p; float an=atan(p.y,p.x); return length(p)-(R+th*smoothstep(-.25,.25,cos(an*n))); }
vec3 posterA(vec2 p,float t){
  vec3 c=PAP; ink(c,YEL,length(p-vec2(.38,.32))-.34);
  vec2 c1=vec2(-.22,-.02), c2; float R1=.34,R2=.17,th=.045; c2=c1+vec2(R1+R2+th*.9,.04);
  c2=c1+normalize(c2-c1)*(R1+R2+th*.95);
  float a1=t*.6, a2=-a1*R1/R2+.18;
  float g1=gear(p-c1,R1,16.,th,a1); ink(c,BLK,g1-.006); ink(c,RED,g1);
  ink(c,PAP,length(p-c1)-.2); for(int i=0;i<6;i++){ float an=float(i)*1.047+a1; vec2 q=c1+vec2(cos(an),sin(an))*.27; ink(c,BLK,length(p-q)-.028); }
  ink(c,BLK,length(p-c1)-.07); ink(c,YEL,length(p-c1)-.035);
  float g2=gear(p-c2,R2,8.,th,a2); ink(c,BLK,g2-.006); ink(c,BLU,g2); ink(c,PAP,length(p-c2)-.07); ink(c,BLK,length(p-c2)-.03);
  vec2 pc=c2+rot(-a2)*vec2(.11,0.)*vec2(1.,1.);
  float L=.55; float pxp=pc.x+sqrt(max(L*L-(pc.y-c2.y)*(pc.y-c2.y),0.)); vec2 pp=vec2(pxp,c2.y);
  ink(c,BLK,sdBox(p-vec2(c2.x+.55,c2.y),vec2(.3,.085))); ink(c,PAP,sdBox(p-vec2(c2.x+.55,c2.y),vec2(.29,.075)));
  line(c,BLK,sdSeg(p,pc,pp),.018); ink(c,ORG,sdRBox(p-pp-vec2(.07,0.),vec2(.09,.065),.012)); ink(c,BLK,length(p-pc)-.03); ink(c,YEL,length(p-pc)-.015);
  return c; }
vec3 posterB(vec2 p,float t){
  vec3 c=ULT; float r=length(p); float an=atan(p.y,p.x);
  for(int i=0;i<8;i++){ float fi=float(i); float R=.08+fi*.058; float w=.018+.004*fi;
    float sp=(1.+fi*.55)*(mod(fi,2.)<.5?1.:-1.); float a=an-t*sp*.35;
    float seg=step(.0,sin(a*(1.+mod(fi,3.))+fi));
    vec3 k=mod(fi,4.)<1.?PNK:mod(fi,4.)<2.?YEL:mod(fi,4.)<3.?PAP:ORG;
    if(seg>.5) ink(c,k,abs(r-R)-w);
    vec2 dp=vec2(cos(t*sp*.35+fi),sin(t*sp*.35+fi))*R; ink(c,BLK,length(p-dp)-w*1.6); ink(c,k,length(p-dp)-w*1.1); }
  ink(c,YEL,r-.045); ink(c,BLK,r-.02);
  return c; }
vec3 posterC(vec2 p,float t){
  vec3 c=BLK; vec2 q=p+vec2(0.,.05);
  if(abs(q.x)<.52&&abs(q.y)<.42){
    float col=floor((q.x+.52)/.035), row=floor((q.y+.42)/.035);
    float rows=mod(t*2.2,24.); float cur=floor(rows); float fx=fract(rows);
    float sx=-.52+ (mod(cur,2.)<1.? fx : 1.-fx)*1.04;
    vec3 wc= mod(col,3.)<1.?BLU:mod(col,3.)<2.?RED:YEL;
    vec2 f=fract((q+vec2(.52,.42))/.035)-.5;
    float warp=abs(f.x)-.32, weft=abs(f.y)-.32;
    bool filled= row<cur || (row==cur && (mod(cur,2.)<1.? q.x<sx : q.x>sx));
    vec3 wf=mod(row,2.)<1.?PAP:PNK;
    if(filled){ bool over=mod(row+col,2.)<1.; if(over){ ink(c,wc*.85,warp); ink(c,wf,weft);} else { ink(c,wf,weft); ink(c,wc,warp);} }
    else ink(c,wc*.85,warp);
    if(abs(q.y-(cur*.035-.42+.0175))<.03) ink(c,ORG,sdRBox(q-vec2(sx,cur*.035-.42+.0175),vec2(.06,.022),.02));
  }
  float hb=.46+.02*sin(t*4.4); ink(c,PAP,sdBox(q-vec2(0.,hb),vec2(.56,.012)));
  return c; }
vec3 poster(float i,vec2 p,float t){ return i<.5?posterA(p,t):i<1.5?posterB(p,t):posterC(p,t); }

void main(){
  vec2 p=(vUv-.5)*vec2(uAsp,1.); px=1.2*uZoom/uResY;
  vec2 q=(p-uOff-uMouse*.035)*uZoom;
  vec3 A=poster(uFrom,q,uT*uSpeed), B=poster(uTo,q,uT*uSpeed);
  float m=1.-smoothstep(uMix*1.3-.02,uMix*1.3,length(p-uOff)*.9);
  vec3 c=mix(A,B,m);
  // print texture: misregistered ink + paper fibres
  c*=.94+.06*vnoise(vUv*vec2(uAsp,1.)*900.);
  c=mix(c,c*vec3(.98,.96,.92),.5);
  gl_FragColor=vec4(toLin(c),1.); }`, { uT: { value: 0 }, uAsp: { value: 1.78 }, uMix: { value: 1 }, uFrom: { value: 0 }, uTo: { value: 0 }, uSpeed: { value: 1 }, uZoom: { value: 1.1 }, uResY: { value: 1080 }, uOff: { value: new THREE.Vector2() }, uMouse: { value: new THREE.Vector2() } });

  // ink depth: a second, cheap pass darkens bare paper wherever an ink shape sits up-and-left of it
  const shade = shader(`uniform sampler2D tSrc; uniform vec3 uBg; uniform vec2 uOff;
void main(){ vec3 c=texture(tSrc,vUv).rgb; vec3 s=texture(tSrc,vUv+uOff).rgb; vec3 s2=texture(tSrc,vUv+uOff*.5).rgb;
  float onBg=1.-smoothstep(.01,.05,length(c-uBg)); float cst=smoothstep(.01,.05,length(s-uBg))*.6+smoothstep(.01,.05,length(s2-uBg))*.4;
  gl_FragColor=vec4(c*(1.-.34*onBg*cst),1.); }`, { tSrc: { value: null }, uBg: { value: new THREE.Vector3() }, uOff: { value: new THREE.Vector2() } });
  const BGS = ['#f2ebdb', '#2b29a8', '#121110'].map(h => new THREE.Color(h));
  const INK = ['#121110', '#f2ece0', '#f2ece0'];
  SCENES.push({
    id: 'loop', title: 'The loop', enterWith: 'slam', hud: { color: '#121110' },
    beats: [{ dur: 1.5, hold: 4 }, { dur: 1.5, hold: 6 }, { dur: 1.5, hold: 5 }],
    bed: { chord: [0, 4, 7, 9], oct: 4, cut: 1400, vol: .028, arp: { notes: [0, 2, 4, 7, 9, 7, 4, 2], oct: 5, rate: 3, voice: 'pluck', len: .35, vol: .055, delay: .2 }, pulse: { kind: 'tick', rate: 3, vol: .12 }, level: [.4, .55, .7] },
    notes: [
      'Until recently, people built AI. Now AI helps build AI: it writes the code, runs the experiments, reads the results.',
      'Anthropic reported that in August 2026 Claude led about 26 percent of its measured AI research work, up from under 1 percent in February. That figure is self-reported and not yet independently verified. About 30,000 agents were running at once on its main internal platform.',
      'That is the loop. A better model speeds up the work that produces the next model. Every turn is faster than the last.',
    ],
    create(ctx, s) {
      let tt = 0, prevBeat = 0;
      return {
        enter() { tt = 0; },
        update(s) {
          const sp = [1, 2.4, 5.5][s.beat]; tt += s.dt * sp * (1 + s.at(s.beat) * .03);
          s.post = { tonemap: 0, bloom: 0, vignette: .18, grain: .045, ca: .0018 };
          s.hudColor = INK[s.beat];
          if (s.cross(1, 0) || s.cross(2, 0)) AU.hit('whoosh');
          if (s.bed) { s.bed.param('arpRate', [3, 6, 12][s.beat] * (1 + s.at(s.beat) * .02)); s.bed.param('pulseRate', [1.5, 3, 6][s.beat]); }
          if (s.cross(1, .3)) AU.hit('stomp'); if (s.cross(1, .9)) AU.hit('ding'); if (s.cross(0, .25)) AU.hit('stomp'); if (s.cross(2, .2)) AU.hit('riser');
        },
        render(slot, s) {
          const u = mat.uniforms; u.uT.value = tt; u.uAsp.value = V.W / V.H; u.uSpeed.value = 1;
          const b = s.beat; u.uTo.value = b; u.uFrom.value = Math.max(0, b - 1); u.uMix.value = b === 0 ? 1 : E.io3(s.p[b]);
          if (s.dir < 0) { u.uFrom.value = b; u.uTo.value = b; u.uMix.value = 1; }
          u.uMouse.value.set(s.mouse.x, s.mouse.y); u.uOff.value.set(V.portrait ? 0 : V.W / V.H * (b === 2 ? .26 : .2), V.portrait ? -.18 : -.02); u.uZoom.value = b === 2 ? 1.5 : 1.1;
          u.uResY.value = slot.hdr.height; pass(mat, slot.aux);
          const bgc = BGS[u.uMix.value > .5 ? u.uTo.value : u.uFrom.value]; shade.uniforms.uBg.value.set(Math.pow(bgc.r, 2.2), Math.pow(bgc.g, 2.2), Math.pow(bgc.b, 2.2));
          shade.uniforms.tSrc.value = slot.aux.texture; shade.uniforms.uOff.value.set(-.011 / (V.W / V.H), .016); pass(shade, slot.hdr);
        },
        draw2d(g, s) {
          const W = V.W, H = V.H, k = Math.min(W / 1920, H / 1080) * (V.portrait ? 1.6 : 1), x = (V.portrait ? 60 : 110) * k, y = V.portrait ? H * .1 : H * .16;
          const c = INK[s.beat], big = (V.portrait ? 58 : 84) * k;
          if (s.beat === 0) text(g, 'AI is now helping\nbuild AI.', { x, y, size: big, font: 'Unbounded', weight: 800, color: c, track: -.04, lh: 1.02, anim: 'spring', maxW: W * .5 }, s.k(0, .2, 1.4, E.lin));
          if (s.beat === 1) {
            text(g, '26%', { x, y: y + 150 * k, size: big * 2.6, font: 'Unbounded', weight: 800, color: '#f7c60d', track: -.06, anim: 'track' }, s.k(1, .3, 1.4, E.lin));
            text(g, 'of Anthropic’s AI research work was led by Claude in August 2026.', { x, y: y + 240 * k, size: 34 * k, font: 'Geist', weight: 500, color: c, maxW: V.portrait ? W - x * 2 : W * .36, anim: 'blur' }, s.k(1, .9, 2.2, E.lin));
            text(g, 'Up from under 1% in February. Self-reported, September 2026.', { x, y: y + 360 * k, size: 20 * k, font: 'Geist Mono', weight: 400, color: 'rgba(242,236,224,.7)', maxW: V.portrait ? W - x * 2 : W * .34, anim: 'fade' }, s.k(1, 1.6, 2.6, E.lin));
          }
          if (s.beat === 2) text(g, 'Every turn\nof the loop\nis faster\nthan the last.', { x, y, size: big * .9, font: 'Unbounded', weight: 800, color: c, track: -.04, lh: 1.02, anim: 'rise', maxW: W * .6 }, s.k(2, .2, 1.4, E.lin));
        },
      };
    },
  });
}
