// =====================================================================
// 05 · TRANSITIONS — full-screen shaders blending frame A → frame B.
// Each: { dur, sound, mat } ; uniforms tA, tB, uP (0..1), uTime, uAsp.
// =====================================================================
import { THREE, shader } from './00-core.js';

const TU = () => ({ tA: { value: null }, tB: { value: null }, uP: { value: 0 }, uTime: { value: 0 }, uAsp: { value: 1.78 } });
const T = {};
function def(id, dur, sound, frag) { T[id] = { id, dur, sound, mat: shader(`uniform sampler2D tA,tB; uniform float uP,uTime,uAsp;\n` + frag, TU()) }; }

// 1 · fade — smoothstep crossfade
def('fade', .8, null, `void main(){ float p=smoothstep(0.,1.,uP); gl_FragColor=vec4(mix(texture(tA,vUv).rgb,texture(tB,vUv).rgb,p),1.); }`);

// 2 · portal — next scene opens as a growing window while the old frame zooms past
def('portal', 1.6, 'whoosh', `
void main(){
  float p=uP, e=p<.5?4.*p*p*p:1.-pow(-2.*p+2.,3.)/2.;
  vec2 c=vUv-.5;
  // old frame zooms in with radial smear
  float z=1.+e*3.5; vec3 a=vec3(0.);
  for(int i=0;i<10;i++){ float k=float(i)/10.; a+=texture(tA,.5+c/(z*(1.+k*e*.25))).rgb; } a/=10.;
  // window
  float s=mix(.0,1.,e); vec2 hs=vec2(.5*s,.5*s);
  vec2 q=c; float d=max(abs(q.x)-hs.x,abs(q.y)-hs.y);
  vec2 buv=.5+c/max(s,1e-3)*mix(.82,1.,e);
  vec3 b=texture(tB,clamp(buv,0.,1.)).rgb;
  float inside=1.-smoothstep(-.002,.002,d);
  vec3 col=mix(a*(1.-e*.6),b,inside);
  col+=vec3(1.)*exp(-abs(d)*900.)*(1.-e)*.9*step(.02,s);
  gl_FragColor=vec4(col,1.); }`);

// 3 · line — collapse to a vibrating glowing string, then expand
def('line', 2.2, 'wave', `
void main(){
  float p=uP; bool first=p<.5; float k=first? p*2. : (1.-p)*2.;  // 0 → 1 → 0
  float e=pow(k,2.2);
  float h=max(1.-e,.003);
  float vib=sin(vUv.x*38.+uTime*55.)*.004*smoothstep(.85,1.,k)+sin(vUv.x*13.-uTime*31.)*.002*smoothstep(.8,1.,k);
  float y=(vUv.y-.5-vib)/h+.5;
  vec3 col=vec3(0.);
  if(y>0.&&y<1.){ for(int i=0;i<12;i++){ float o=(float(i)/11.-.5)*.06*e; vec2 uv=vec2(vUv.x,clamp(y+o,0.,1.)); col+= first? texture(tA,uv).rgb : texture(tB,uv).rgb; } col/=12.; }
  float d=abs(vUv.y-.5-vib);
  vec3 hot=vec3(1.,.95,.85);
  col+= hot*(exp(-d*900.)*1.2+exp(-d*60.)*.35)*smoothstep(.6,1.,k);
  col+= vec3(1.,.5,.3)*exp(-d*12.)*.12*smoothstep(.75,1.,k);
  gl_FragColor=vec4(col,1.); }`);

// 4 · flaps — split-flap tiles flip in a diagonal sweep (2-3 flips, overshoot)
def('flaps', 2.0, 'flap', `
void main(){
  vec2 g=vec2(16.,9.); vec2 cell=floor(vUv*g), f=fract(vUv*g);
  float h=hash12(cell);
  float start=(cell.x+ (g.y-1.-cell.y))/(g.x+g.y)*.55 + h*.12;
  float t=clamp((uP-start)/.33,0.,1.);
  float flips=2.+step(.5,h);
  float ang=t*flips*PI; // each half turn shows a face
  float face=floor(ang/PI+.5);
  float c=cos(ang); float sy=abs(c);
  float settle=t>=1.?0.:sin(t*PI)*.0;
  vec2 lf=vec2(f.x,(f.y-.5)/max(sy,.001)+.5);
  vec2 uv=(cell+lf)/g;
  vec3 A=texture(tA,uv).rgb, B=texture(tB,uv).rgb;
  vec3 mid=mix(A,B,.5)*.35+vec3(.02);
  vec3 col = t<=0.? A : t>=1.? B : (face>=flips? B : mod(face,2.)==1.? mid : A);
  if(t>0.&&t<1.){ if(lf.y<0.||lf.y>1.) col=vec3(.01); col*=.55+.45*sy; }
  float edge=smoothstep(.0,.03,f.x)*smoothstep(1.,.97,f.x)*smoothstep(0.,.03,f.y)*smoothstep(1.,.97,f.y);
  col*=mix(.82,1.,edge*(t>0.&&t<1.?0.:1.)+ (t>0.&&t<1.?.6:0.));
  gl_FragColor=vec4(col,1.); }`);

// 5 · wash — a foaming wave sweeps across and drains, revealing B
def('wash', 2.4, 'wave', `
void main(){
  float p=uP; vec2 uv=vUv;
  float front=mix(-.25,1.3,p) + (fbm(vec2(uv.y*3.,uTime*.6))-.5)*.18 + sin(uv.y*9.+uTime*3.)*.02;
  float d=uv.x-front; // <0 : behind wave (B)
  float wet=smoothstep(.0,-.35,d)*(1.-smoothstep(.7,1.,p));
  vec2 ref=vec2(fbm(uv*6.+vec2(0.,uTime*1.5))-.5, fbm(uv*6.+7.-vec2(0.,uTime*2.))-.5)*.035*wet;
  float drip=smoothstep(.6,.0,fract(uv.x*23.)+.0)*0.;
  vec3 A=texture(tA,uv).rgb, B=texture(tB,uv+ref).rgb;
  float lip=exp(-abs(d)*40.);
  float foam=smoothstep(.45,.75,fbm(uv*vec2(18.,10.)+vec2(uTime*2.,0.)))*lip;
  vec3 col=mix(A,B,step(d,0.));
  col=mix(col,col*vec3(.75,.88,1.)+vec3(.02,.05,.08),wet*.5);
  col+=vec3(.9,.97,1.)*(foam*1.2+lip*.25);
  // streaks of water running down the glass
  float st=smoothstep(.97,1.,sin(uv.x*140.+hash11(floor(uv.x*140.))*6.))*wet*smoothstep(0.,.6,uv.y);
  col+=st*.15;
  gl_FragColor=vec4(col,1.); }`);

// 6 · slam — the new frame slams down onto the old one: impact ripple + shake + ink
def('slam', 1.9, 'slam', `
void main(){
  float p=uP, C=.285;
  float pre=clamp(p/C,0.,1.), post=clamp((p-C)/(1.-C),0.,1.);
  vec2 c=vUv-.5;
  float shake=(1.-post)*step(C,p)*.02;
  c+=vec2(sin(uTime*90.),cos(uTime*77.))*shake*exp(-post*6.);
  float sc=mix(3.2,1.,pre*pre);
  float ang=(1.-pre)*.25;
  vec2 bc=rot(ang)*c*sc;
  // ripple after impact
  float r=length(c*vec2(uAsp,1.)); float ring=post*1.6;
  float rip=exp(-pow((r-ring)*9.,2.))*(1.-post)*.03;
  bc+=normalize(c+1e-4)*rip;
  vec2 buv=bc+.5;
  vec3 A=texture(tA,.5+c*mix(1.,.9,pre)).rgb*mix(1.,.35,pre);
  float inB=step(abs(buv.x-.5),.5)*step(abs(buv.y-.5),.5);
  vec3 B=texture(tB,clamp(buv,0.,1.)).rgb;
  float ink=smoothstep(.35,.65,fbm(vUv*14.)+post*1.4-.5);
  vec3 col=mix(A,B*mix(.6,1.,ink),inB);
  // dust ring
  col+=vec3(.95,.9,.8)*exp(-pow((r-ring*.8)*14.,2.))*(1.-post)*.35*step(C,p);
  col*=1.+ (1.-post)*step(C,p)*.25*exp(-post*10.);
  gl_FragColor=vec4(col,1.); }`);

// 7 · daybreak — frame breaks into bokeh discs, glows, re-forms as B
def('daybreak', 3.0, 'shimmer', `
void main(){
  float p=uP; float k=sin(p*PI); // 0→1→0
  vec2 g=vec2(34.,20.); vec2 uv=vUv;
  vec3 acc=vec3(0.); float wsum=0.;
  vec2 cell=floor(uv*g);
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec2 cc=cell+vec2(i,j); vec2 jit=hash22(cc)-.5;
    vec2 ctr=(cc+.5+jit*.8*k)/g;
    vec3 src = p<.5 ? texture(tA,ctr).rgb : texture(tB,ctr).rgb;
    float rad=(.5+hash12(cc+7.)*.9)*k*1.6/g.y;
    float d=length((uv-ctr)*vec2(uAsp,1.));
    float disc=smoothstep(rad,rad*.82,d)*(.6+.4*smoothstep(rad*.5,rad,d));
    acc+=src*disc*(1.+luma(src)*2.); wsum+=disc;
  }
  vec3 bok=acc/max(wsum,1.);
  vec3 base = p<.5 ? texture(tA,uv).rgb : texture(tB,uv).rgb;
  vec3 col=mix(base,bok*1.2+vec3(.03,.02,.01),smoothstep(.0,.5,k));
  col+=vec3(1.,.8,.55)*k*k*.25;
  col=col/(1.+col*.25*k);
  col+=(hash12(uv*1000.+uTime)-.5)*.04*k;
  gl_FragColor=vec4(col,1.); }`);

// 8 · dissolve — chunky pixels dissolve through noise
def('dissolve', 1.4, 'paper', `
void main(){
  float p=uP; float bs=mix(80.,6.,abs(p-.5)*2.);
  vec2 cell=floor(vUv*vec2(bs*uAsp,bs));
  float n=hash12(cell)*.7+vnoise(cell*.15)*.3;
  float m=step(n,p*1.15-.05);
  vec2 puv=(cell+.5)/vec2(bs*uAsp,bs);
  float near=smoothstep(.12,0.,abs(n-(p*1.15-.05)));
  vec3 A=mix(texture(tA,vUv).rgb,texture(tA,puv).rgb,near), B=mix(texture(tB,vUv).rgb,texture(tB,puv).rgb,near);
  gl_FragColor=vec4(mix(A,B,m)+near*.08,1.); }`);

// 9 · tear — vertical ripped seam, sheets peel apart with fibrous edges
def('tear', 2.4, 'paper', `
void main(){
  float p=uP; float e=p*p*(3.-2.*p);
  float seam=.5+(fbm(vec2(vUv.y*8.,3.))-.5)*.08+(vnoise(vec2(vUv.y*60.,1.))-.5)*.012;
  float open=e*.62;
  float side=sign(vUv.x-seam);
  float x0=vUv.x-side*open; // sample position on the torn sheet
  float curl=e*1.3;
  float dx=abs(x0-seam);
  vec2 suv=vec2(x0 + side*sin(dx*3.)*curl*.05, vUv.y + (vUv.y-.5)*e*.06*side);
  bool onSheet = side<0. ? x0<seam : x0>seam;
  vec3 col=texture(tB,vUv).rgb;
  float shade=1.;
  if(onSheet && suv.x>0.&&suv.x<1.){
    col=texture(tA,suv).rgb*(1.-e*.25)*(1.-smoothstep(.0,.1,.1-dx)*.15*e);
    float fib=smoothstep(.012,.0,dx)*(.6+.4*vnoise(vec2(vUv.y*300.,dx*500.)));
    col=mix(col,vec3(.97,.95,.9),fib*step(.001,e));
  } else {
    // drop shadow from the sheets onto B
    float dd=min(abs(vUv.x-(seam-open)),abs(vUv.x-(seam+open)));
    col*=1.-.45*exp(-dd*30.)*e;
  }
  gl_FragColor=vec4(col,1.); }`);

// 10 · radial — clock sweep with a soft lit edge
def('radial', 1.2, 'whoosh', `
void main(){
  vec2 c=(vUv-.5)*vec2(uAsp,1.); float a=atan(c.x,c.y)/(2.*PI)+.5;
  float p=uP*1.1; float m=smoothstep(p,p-.04,a);
  vec3 col=mix(texture(tA,vUv).rgb,texture(tB,vUv).rgb,m);
  col+=vec3(1.)*exp(-abs(a-p)*120.)*.4*step(.02,uP)*step(uP,.98);
  gl_FragColor=vec4(col,1.); }`);


// 11 · glitch — datamosh: row tearing, RGB split, block corruption, hard cut at .5
def('glitch', 1.1, 'snap', `
void main(){
  float p=uP; float k=1.-abs(p*2.-1.); k=pow(k,.7);
  float step_=floor(uTime*24.);
  float row=floor(vUv.y*mix(8.,60.,hash11(step_)));
  float tear=(hash12(vec2(row,step_))-.5)*.25*k*step(.55,hash12(vec2(row*.7,step_+3.)));
  vec2 blk=floor(vUv*vec2(16.,9.)*(1.+floor(hash11(step_+9.)*3.)));
  float corrupt=step(1.-k*.35,hash12(blk+step_));
  vec2 uv=vUv+vec2(tear,0.);
  uv+= corrupt*(hash22(blk+step_)-.5)*.15;
  float sp=.025*k;
  bool useB = p>.5 ? hash12(vec2(row,step_+1.))>k*.4 : hash12(vec2(row,step_+1.))<k*.4;
  vec3 c;
  if(useB) c=vec3(texture(tB,uv+vec2(sp,0)).r,texture(tB,uv).g,texture(tB,uv-vec2(sp,0)).b);
  else c=vec3(texture(tA,uv+vec2(sp,0)).r,texture(tA,uv).g,texture(tA,uv-vec2(sp,0)).b);
  c=mix(c,floor(c*4.)/4.,corrupt*.8);
  c+=(hash12(vUv*900.+step_)-.5)*.25*k;
  c*=1.-.25*k*step(.5,fract(vUv.y*200.));
  gl_FragColor=vec4(c,1.); }`);

// 12 · shatter — the frame breaks into Voronoi glass shards that tumble away toward the camera
def('shatter', 2.2, 'slam', `
void main(){
  float p=uP;
  vec2 P=vUv*vec2(uAsp,1.)*5.;
  // nearest shard cell
  vec2 ip=floor(P), best=vec2(0.); float md=9.;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 o=vec2(i,j); vec2 c=ip+o+hash22(ip+o)*.9; float d=length(P-c); if(d<md){md=d;best=c;} }
  float h=hash12(best);
  float t=clamp((p-.08-h*.25)/.6,0.,1.); t=t*t;
  vec2 ctr=best/vec2(uAsp,1.)/5.;
  vec2 away=normalize(ctr-.5+1e-3);
  // shard moves out, rotates, scales up (toward camera)
  vec2 d=vUv-ctr;
  float sc=1.+t*2.5; float an=t*(h-.5)*6.;
  vec2 src=ctr+rot(-an)*(d/sc) - away*t*.6 - vec2(0.,-t*t*.4);
  // which shard owns src? (approximate: keep if src maps back into same cell)
  vec2 Q=src*vec2(uAsp,1.)*5.; vec2 iq=floor(Q); float md2=9.; vec2 b2=vec2(0.);
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 o=vec2(i,j); vec2 c=iq+o+hash22(iq+o)*.9; float dd=length(Q-c); if(dd<md2){md2=dd;b2=c;} }
  bool mine=length(b2-best)<.01 && t<1.;
  vec3 B=texture(tB,vUv).rgb*mix(.4,1.,smoothstep(.3,1.,p));
  vec3 col=B;
  if(t<=0.) col=texture(tA,vUv).rgb;
  else if(mine && src.x>0.&&src.x<1.&&src.y>0.&&src.y<1.){ col=texture(tA,src).rgb*(1.-t*.5); col+=vec3(.9,.95,1.)*smoothstep(.06,.0,md2*.0+abs(md-length(P-best))+.0)*.0; }
  // edge glints on cracks just before break
  float crack=smoothstep(.05,.0,abs(md-.0)-.0);
  gl_FragColor=vec4(col,1.); }`);

// 13 · ink — B blooms through A like ink in water
def('ink', 2.2, 'wave', `
void main(){
  vec2 p=(vUv-.5)*vec2(uAsp,1.);
  float n=fbm(p*3.+vec2(uTime*.2,0.))*.55+fbm(p*9.-uTime*.1)*.2;
  float r=length(p)-n*.6;
  float th=mix(-.6,1.4,uP);
  float m=smoothstep(th+.03,th-.03,r);
  float edge=exp(-pow((r-th)*30.,2.));
  vec2 warp=vec2(fbm(p*5.+3.),fbm(p*5.+8.))-.5;
  vec3 A=texture(tA,vUv+warp*edge*.04).rgb, B=texture(tB,vUv-warp*edge*.03).rgb;
  vec3 c=mix(A,B,m); c=mix(c,c*.15,edge*.7);
  gl_FragColor=vec4(c,1.); }`);

// 14 · kaleido — fold A into a spinning kaleidoscope, unfold as B
def('kaleido', 2.0, 'shimmer', `
void main(){
  float p=uP, k=sin(p*PI);
  vec2 c=(vUv-.5)*vec2(uAsp,1.);
  float a=atan(c.y,c.x)+k*2.5*(p<.5?1.:-1.), r=length(c);
  float seg=mix(1.,8.,k); float sa=6.2831/seg;
  float fa=mod(a,sa); fa=min(fa,sa-fa);
  vec2 q=vec2(cos(fa),sin(fa))*r*(1.+k*.6);
  vec2 uv=mix(vUv,q/vec2(uAsp,1.)+.5,smoothstep(0.,.35,k));
  uv=abs(fract(uv*.5+.5)*2.-1.);
  vec3 col=p<.5?texture(tA,uv).rgb:texture(tB,uv).rgb;
  col*=1.+k*.3;
  gl_FragColor=vec4(col,1.); }`);

// 15 · zoomblur — hyperspace: radial streaks out of A, into B
def('zoomblur', 1.5, 'whoosh', `
void main(){
  float p=uP, k=sin(p*PI);
  vec2 c=vUv-.5; vec3 acc=vec3(0.);
  for(int i=0;i<24;i++){ float f=float(i)/23.; float s=1.-f*k*.55;
    vec2 uv=.5+c*s*(p<.5?1.+p*.6:1.6-p*.6);
    acc+= p<.5?texture(tA,uv).rgb:texture(tB,uv).rgb; }
  acc/=24.;
  acc+=vec3(.6,.8,1.)*pow(k,3.)*.35*smoothstep(.0,.6,length(c));
  gl_FragColor=vec4(acc,1.); }`);

// 16 · pixelsort — rows melt downward in sorted streaks, revealing B
def('pixelsort', 1.8, 'paper', `
void main(){
  float p=uP; float col=floor(vUv.x*260.);
  float h=hash11(col*1.31);
  float t=clamp(p*1.6-h*.6,0.,1.);
  float drop=t*t*1.3;
  vec2 uv=vec2(vUv.x,vUv.y+drop);
  vec3 c;
  if(uv.y>1.) c=texture(tB,vUv).rgb;
  else { float sm=t*.25; vec3 a=vec3(0.); for(int i=0;i<8;i++){ a+=texture(tA,vec2(uv.x,uv.y+float(i)/7.*sm)).rgb; } c=a/8.;
    c=mix(c,texture(tB,vUv).rgb,smoothstep(.85,1.,uv.y)*t); }
  gl_FragColor=vec4(c,1.); }`);

const TRANSITIONS = T;
export { TRANSITIONS };
