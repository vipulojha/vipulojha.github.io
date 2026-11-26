// =====================================================================
// 60 · LAMP — "Intelligence is how far you can see." One lantern in a
// dark field, a brighter one, eight billion of them, then dawn.
// All one fragment shader: ground, lantern light, volumetric halos,
// a log-zoom camera, a night sky that becomes sunrise.
// =====================================================================
import { SCENES, THREE, clamp, lerp, E, shader, pass, V, text, AU } from './00-core.js';

{
  const A = new THREE.Vector3(.5, .9, 4), B = new THREE.Vector3(7, .9, 20);
  const mat = shader(`uniform mat4 uInvVP; uniform vec3 uCam,uA,uB; uniform float uT,uIA,uIB,uField,uDawn,uPix;
const float CELL=7.;
vec3 sunDir(){ return normalize(vec3(.15,mix(-.12,.09,uDawn),1.)); }
vec3 skyN(vec3 rd){
  vec3 night=mix(vec3(.012,.016,.04),vec3(.002,.003,.01),clamp(rd.y*2.,0.,1.));
  vec3 q=rd*380.; vec3 cell=floor(q); float h=hash13(cell); night+=vec3(.9,.95,1.)*step(.997,h)*smoothstep(.5,.0,length(fract(q)-.5))*(1.-uDawn);
  vec3 sd=sunDir(); float s=max(dot(rd,sd),0.);
  vec3 dawn=mix(vec3(.95,.42,.2),vec3(.2,.34,.75),smoothstep(-.02,.45,rd.y));
  dawn+=vec3(2.5,1.3,.6)*pow(s,10.)*.55+vec3(60.,40.,22.)*smoothstep(.9992,.9996,s);
  dawn+=vec3(3.,1.6,.8)*exp(-abs(rd.y-sd.y)*160.)*exp(-abs(rd.x-sd.x)*1.5)*.3; // anamorphic streak
  return mix(night,dawn,uDawn); }
float lightAt(vec2 xz,float I,vec3 L,float k){ float d2=dot(xz-L.xz,xz-L.xz)+L.y*L.y; return I/(1.+d2*k); }
void main(){
  vec2 ndc=vUv*2.-1.; vec4 w=uInvVP*vec4(ndc,1.,1.); vec3 rd=normalize(w.xyz/w.w-uCam);
  vec3 col;
  float tHit=1e9;
  if(rd.y<-1e-4){
    float t=-uCam.y/rd.y; tHit=t; vec3 p=uCam+rd*t;
    vec3 alb=vec3(.07,.06,.045)*(.55+.45*fbm(p.xz*.35))*(.8+.2*vnoise(p.xz*4.));
    vec3 lt=vec3(1.,.62,.3)*(lightAt(p.xz,uIA,uA,.35)+lightAt(p.xz,uIB,uB,.06));
    // the field: one lantern per occupied cell
    float fp=t*uPix; float dotsL=0.; float pool=0.;
    vec2 c0=floor(p.xz/CELL);
    for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 c=c0+vec2(i,j); vec2 h=hash22(c);
      if(hash12(c+31.)>.88*uField||length(c)<3.) continue;
      vec2 lp=(c+.2+h*.6)*CELL; float d=length(p.xz-lp);
      pool+=1.2/(1.+d*d*.25);
      dotsL+=exp(-pow(d/max(fp*1.1,.12),2.))*1.1 + .05/(1.+pow(d/max(fp*5.,.8),2.)); }
    float avg=smoothstep(CELL*.25,CELL*1.6,fp);
    lt+=vec3(1.,.6,.3)*mix(pool*.35,.05,avg)*uField;
    vec3 sunL=vec3(1.4,.9,.6)*uDawn*uDawn*1.6*(.6+.4*fbm(p.xz*.02));
    col=alb*(lt+sunL+vec3(.02,.025,.05));
    col+=vec3(1.,.62,.3)*mix(dotsL,.1,avg)*uField*(1.-uDawn*.7)*.9;
    float fog=1.-exp(-t*mix(.0016,.00022,smoothstep(5.,800.,uCam.y)));
    col=mix(col,skyN(normalize(vec3(rd.x,.02,rd.z)))*mix(.5,.7,uDawn),fog);
  } else col=skyN(rd);
  // volumetric halos around the two named lanterns
  for(int i=0;i<2;i++){ vec3 L=i==0?uA:uB; float I=i==0?uIA:uIB; vec3 v=L-uCam; float tp=max(dot(v,rd),0.);
    if(tp<tHit){ float d=length(v-rd*tp); col+=vec3(1.,.66,.35)*I*(.05/(1.+d*d*6.)+.6*exp(-d*d*900./(1.+tp*tp*.02))); } }
  gl_FragColor=vec4(col,1.); }`, { uInvVP: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() }, uA: { value: A }, uB: { value: B }, uT: { value: 0 }, uIA: { value: 0 }, uIB: { value: 0 }, uField: { value: 0 }, uDawn: { value: 0 }, uPix: { value: .001 } });
  // god rays: radial blur of the bright sky toward the sun's screen position
  const rays = shader(`uniform sampler2D tSrc; uniform vec2 uSun; uniform float uAmt,uAsp;
void main(){ vec3 base=texture(tSrc,vUv).rgb; if(uAmt<=0.){ gl_FragColor=vec4(base,1.); return; }
  vec2 d=(uSun-vUv)/48.; vec2 uv=vUv; float decay=1.; vec3 acc=vec3(0.); float j=hash12(gl_FragCoord.xy);
  uv+=d*j;
  for(int i=0;i<48;i++){ uv+=d; vec3 s=texture(tSrc,clamp(uv,0.,1.)).rgb; acc+=clamp(s-vec3(1.2),0.,1.5)*decay; decay*=.955; }
  float fall=exp(-length((vUv-uSun)*vec2(uAsp,1.))*1.2);
  gl_FragColor=vec4(base+acc*uAmt*.035*vec3(1.,.8,.6)*fall,1.); }`, { tSrc: { value: null }, uSun: { value: new THREE.Vector2(.5, .5) }, uAmt: { value: 0 }, uAsp: { value: 1.78 } });
  const sunW = new THREE.Vector3();
  const cam = new THREE.PerspectiveCamera(50, 1.78, .1, 1e5);
  const pr = new THREE.Vector3();
  SCENES.push({
    id: 'lamp', title: 'How far you can see', enterWith: 'line', hud: { color: '#ffffff' },
    beats: [{ dur: 3.5, hold: 3, page: '1' }, { dur: 3, hold: 3, page: '2' }, { dur: 6, hold: 3, page: '8,000,000,000' }, { dur: 7, hold: 5, page: '☀' }],
    bed: { chord: [0, 7, 11, 14], oct: 3, cut: 600, vol: .045, level: [.25, .3, .45, .8] },
    notes: [
      'Forget test scores for a second. Think of intelligence as how far you can see. One person, with one lantern, in a dark field.',
      'Einstein carried a brighter lantern. He could see further than almost anyone. It was still night.',
      'Everyone alive: eight billion lanterns. The field is brighter, but it is still night. Most of what there is to know is still out there in the dark.',
      'Superintelligence is not a brighter lantern. It is the sun coming up.',
    ],
    create(ctx, s) {
      let u = 0;
      return {
        update(s) {
          u = s.p[0] + s.p[1] + s.p[2] + s.p[3];
          const f1 = E.io3(clamp(u - 0)), f2 = E.io3(clamp(u - 1)), f3 = E.io4(clamp(u - 2)), f4 = E.io3(clamp(u - 3));
          let h = lerp(1.7, 3.2, f2); h = Math.exp(lerp(Math.log(h), Math.log(1400), f3));
          const back = lerp(-1, -6, f2) - h * .55 * f3;
          cam.position.set(lerp(-.2, -1.6, f2) + s.mouse.x * h * .04, h + s.mouse.y * h * .02, back);
          const look = new THREE.Vector3(lerp(.4, 3, f2), lerp(.9, 1, f2) * (1 - f3), lerp(4, 12, f2) + h * .9 * f3);
          look.y += f4 * h * .75; look.z += f4 * h * 1.6;
          cam.lookAt(look); cam.fov = V.portrait ? 72 : 50; cam.aspect = V.W / V.H; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
          const m = mat.uniforms;
          m.uInvVP.value.multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse); m.uCam.value.copy(cam.position); m.uT.value = s.t;
          m.uIA.value = E.out2(clamp(s.at(0) / 1.6)) * 1.6; m.uIB.value = s.k(1, .3, 1.8) * 5.5; m.uField.value = s.k(2, 0, 3.2); m.uDawn.value = s.k(3, .8, 6.5, E.io2);
          m.uPix.value = 2 * Math.tan(cam.fov * Math.PI / 360) / (V.H * 1.4);
          s.post = { streak: .5 * (1 - m.uDawn.value) ** 3, flare: .3 * (1 - m.uDawn.value) ** 3, bloom: lerp(.6, .3, m.uDawn.value), threshold: 1.1, exposure: lerp(1.15, .62, m.uDawn.value), vignette: lerp(.6, .35, m.uDawn.value), grain: .03, ca: .0015, halation: .6 };
          if (s.cross(0, .2)) AU.hit('glass'); if (s.cross(1, .3)) AU.hit('shimmer'); if (s.cross(2, .2)) AU.hit('rise'); if (s.cross(3, .8)) { AU.hit('sub'); AU.hit('bell', 0, .4); } if (s.cross(3, 3)) AU.hit('shimmer');
        },
        render(slot, s) {
          const dawn = mat.uniforms.uDawn.value;
          if (dawn < .02) { pass(mat, slot.hdr); return; }
          pass(mat, slot.aux);
          sunW.set(.15, lerp(-.12, .09, dawn), 1).normalize().multiplyScalar(5e4).add(cam.position).project(cam);
          rays.uniforms.tSrc.value = slot.aux.texture; rays.uniforms.uSun.value.set(sunW.x * .5 + .5, sunW.y * .5 + .5); rays.uniforms.uAmt.value = dawn * (sunW.z < 1 ? 1 : 0); rays.uniforms.uAsp.value = V.W / V.H;
          pass(rays, slot.hdr);
        },
        draw2d(g, s) {
          const W = V.W, H = V.H, k = Math.min(W / 1920, H / 1080) * (V.portrait ? 1.6 : 1), x = (V.portrait ? 60 : 120) * k;
          const label = (P, str, a) => { pr.copy(P).project(cam); if (pr.z > 1 || a <= 0) return; const px = (pr.x * .5 + .5) * W, py = (1 - (pr.y * .5 + .5)) * H; g.globalAlpha = a; g.fillStyle = '#fff'; g.font = `500 ${18 * k}px "Geist Mono", monospace`; g.fillRect(px + 14 * k, py - 30 * k, 1.5, 22 * k); g.fillText(str, px + 22 * k, py - 30 * k); g.globalAlpha = 1; };
          const fade = 1 - s.k(2, 0, 1.5);
          label(A, 'YOU', s.k(0, 1, 2) * fade); label(B, 'EINSTEIN', s.k(1, .8, 1.8) * fade);
          const out = b => s.beat > b ? clamp(s.at(b + 1) / .5) : 0;
          text(g, 'Intelligence is how far\nyou can see.', { x, y: H * .18, size: (V.portrait ? 58 : 84) * k, font: 'Unbounded', weight: 300, color: '#fff', track: -.035, anim: 'blur', by: 'word', maxW: W - x * 2 }, s.k(0, .8, 2.6, E.lin), s.beat >= 2 ? clamp(s.at(2) / .6) : 0);
          if (s.beat === 1) text(g, 'A brighter lantern. Still night.', { x, y: H * .18 + 230 * k, size: 26 * k, font: 'Geist', color: 'rgba(255,255,255,.75)', anim: 'fade' }, s.k(1, 1, 2, E.lin), out(1));
          if (s.beat === 2 || (s.beat === 3 && out(2) < 1)) { text(g, 'Everyone alive.', { x, y: H * .2, size: (V.portrait ? 64 : 96) * k, font: 'Unbounded', weight: 300, color: '#fff', track: -.035, anim: 'rise' }, s.k(2, 1.6, 2.8, E.lin), out(2)); text(g, 'Eight billion lanterns. Still night.', { x, y: H * .2 + 70 * k, size: 26 * k, font: 'Geist', color: 'rgba(255,255,255,.75)', anim: 'fade' }, s.k(2, 2.4, 3.4, E.lin), out(2)); }
          if (s.beat === 3) text(g, 'Superintelligence.', { x: W / 2, y: H * .86, size: (V.portrait ? 64 : 120) * k, font: 'Unbounded', weight: 300, color: '#fff', align: 'center', track: -.04, anim: 'stretch', stagger: .6, glow: 'rgba(255,170,90,.6)' }, s.k(3, 2.8, 5.4, E.lin));
        },
      };
    },
  });
}
