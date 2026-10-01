// ================= "AI reset the counter" — 9:16 kinetic motion reel synced to Mohamed Saber's voice-over (46.5s) =================
// every visual beat is keyed to a word timestamp from the speech-to-text of reel2/vo.mp3
const DUR=46.5;const eob=x=>Math.max(0,eOutBack(x));
const A={bg:'#0B0908',card:'#141213',line:'rgba(255,255,255,0.10)',txt:'#F6F2EF',sub:'#C4BCB8',acc:'#EB8365',acc2:'#F2785A',hot:'#FF7B20',red:'#C0281A',edge:'#B44136',green:'#45D483'};
const IM={};
function maroAt(pose,x,y,vw,o={}){const v=VIS[POSE[pose]];const s=vw/(v.x1-v.x0);drawMaro(pose,x-(v.cx-1024)*s,y-(v.cy-1024)*s,s,o);}
const ease=(t,a,b)=>eOut(P(t,a,b)),pop=(t,a,d=0.35)=>eob(P(t,a,a+d));
// ---------- stage ----------
function stage(t,o={}){const{glow=1,grid=1,tint=null}=o;ctx.fillStyle=A.bg;ctx.fillRect(0,0,W,H);
  glowBlob(W*0.5+Math.sin(t*0.4)*60,H*1.06,1250,'rgba(160,26,12,0.6)',glow);glowBlob(W*0.1,H*0.08,700,'rgba(130,34,12,0.25)',glow);glowBlob(W*0.95,H*0.45,600,'rgba(95,20,8,0.2)',glow);
  if(grid>0){ctx.save();ctx.globalAlpha=0.07*grid;ctx.strokeStyle='#FFB08A';ctx.lineWidth=1;const hz=H*0.62;   // perspective floor grid
    for(let i=-10;i<=10;i++){ctx.beginPath();ctx.moveTo(W/2+i*40,hz);ctx.lineTo(W/2+i*420,H);ctx.stroke();}
    for(let k=0;k<12;k++){const p=((k+(t*0.6)%1)/12);const y=hz+(H-hz)*p*p;ctx.globalAlpha=0.07*grid*p;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}ctx.restore();}
  // drifting embers
  ctx.save();ctx.globalCompositeOperation='lighter';const R=rng(3);for(let i=0;i<40;i++){const x=R()*W,sp=20+R()*50,y=(R()*H-t*sp)%H;const yy=y<0?y+H:y;ctx.globalAlpha=0.15+0.25*R();ctx.fillStyle='#FF8A50';ctx.beginPath();ctx.arc(x+Math.sin(t+i)*10,yy,1+R()*2.2,0,6.283);ctx.fill();}ctx.restore();
  if(tint){ctx.fillStyle=tint;ctx.fillRect(0,0,W,H);}}
// ---------- type ----------
// kinetic headline line: rises from a mask with a blur; optional out time
function kl(s,x,y,size,t0,t,o={}){const p=eOutExpo(P(t,t0,t0+0.45));if(p<=0)return;const q=o.t1?eIn(P(t,o.t1,o.t1+0.18)):0;if(q>=1)return;
  ctx.save();ctx.beginPath();ctx.rect(-50,y-size*0.95,W+100,size*1.8);ctx.clip();ctx.globalAlpha=1-q;if(p<1||q>0)ctx.filter=`blur(${(1-p)*8+q*6}px)`;
  T(s,x,y+(1-p)*size*1.2,size,{w:o.w??900,col:o.col??A.txt,align:o.align??'center',glow:o.glow??0,glowCol:o.glowCol??A.hot});ctx.restore();}
function kick(s,x,y,t0,t,o={}){const a=P(t,t0,t0+0.3)*(o.t1?1-P(t,o.t1,o.t1+0.25):1);if(a<=0)return;ctx.save();ctx.globalAlpha=a;T(s,x,y,o.size??26,{w:700,col:A.acc,ls:5,align:o.align??'center'});const bw=70*ease(t,t0+0.1,t0+0.5);ctx.fillStyle=A.acc2;ctx.fillRect(x-bw/2,y+24,bw,4);ctx.restore();}
function chip(s,x,y,size,t0,t,o={}){const p=pop(t,t0);if(p<=0)return;const out=o.t1?1-P(t,o.t1,o.t1+0.25):1;if(out<=0)return;const pw_=tw(s,size,800)+size*1.4,ph=size*1.9;
  ctx.save();ctx.globalAlpha=out;ctx.translate(x,y);ctx.scale(p,p);rr(ctx,-pw_/2,-ph/2,pw_,ph,ph/2);ctx.fillStyle=o.fill??'rgba(192,40,26,0.9)';ctx.shadowColor='rgba(255,90,40,0.6)';ctx.shadowBlur=30;ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle=o.stroke??'rgba(255,170,140,0.7)';ctx.lineWidth=2;ctx.stroke();T(s,0,2,size,{w:800,col:o.col??'#fff'});ctx.restore();}
// app-style card with an icon box (RTL)
function card(x,y,w,h,title,sub,draw,o={}){const{alpha=1,sc=1,on=0}=o;if(alpha<=0||sc<=0)return;ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.scale(sc,sc);
  rr(ctx,-w/2,-h/2,w,h,24);ctx.fillStyle=on?A.red:A.card;ctx.shadowColor='rgba(0,0,0,0.6)';ctx.shadowBlur=40;ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=on?'rgba(255,170,140,0.6)':A.line;ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle=on?'#E9573F':A.edge;ctx.fillRect(w/2-6,-h/2+16,4,h-32);const bs=h*0.6;rr(ctx,w/2-30-bs,-bs/2,bs,bs,18);ctx.fillStyle=on?'rgba(0,0,0,0.2)':'#2a0f09';ctx.fill();ctx.strokeStyle='rgba(242,120,90,0.55)';ctx.stroke();
  ctx.save();ctx.translate(w/2-30-bs/2,0);draw(bs*0.8,on);ctx.restore();T(title,w/2-56-bs,sub?-h*0.14:0,h*0.27,{w:900,align:'right'});if(sub)T(sub,w/2-56-bs,h*0.2,h*0.17,{w:600,align:'right',col:on?'#FFE3D8':A.sub});ctx.restore();}
// ---------- icons (stroke, centred) ----------
function stroke(s,col=A.acc2){ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=Math.max(2,s*0.075);ctx.lineCap='round';ctx.lineJoin='round';}
const ICO={
  pen:(s)=>{stroke(s);ctx.beginPath();ctx.moveTo(0,-s*0.36);ctx.lineTo(s*0.22,s*0.06);ctx.lineTo(0,s*0.3);ctx.lineTo(-s*0.22,s*0.06);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.arc(0,s*0.02,s*0.05,0,6.283);ctx.fill();ctx.beginPath();ctx.moveTo(0,-s*0.36);ctx.lineTo(0,-s*0.04);ctx.stroke();ctx.beginPath();ctx.moveTo(-s*0.14,s*0.4);ctx.lineTo(s*0.14,s*0.4);ctx.stroke();},
  film:(s)=>{stroke(s);rr(ctx,-s*0.38,-s*0.26,s*0.76,s*0.52,s*0.06);ctx.stroke();for(let i=-2;i<=2;i++){ctx.fillRect(i*s*0.14-s*0.03,-s*0.22,s*0.06,s*0.06);ctx.fillRect(i*s*0.14-s*0.03,s*0.16,s*0.06,s*0.06);}ctx.beginPath();ctx.moveTo(-s*0.06,-s*0.08);ctx.lineTo(s*0.1,0);ctx.lineTo(-s*0.06,s*0.08);ctx.closePath();ctx.fill();},
  motion:(s)=>{stroke(s);ctx.beginPath();ctx.moveTo(-s*0.38,s*0.25);ctx.bezierCurveTo(-s*0.1,s*0.25,-s*0.1,-s*0.25,s*0.38,-s*0.25);ctx.stroke();for(const[x,y]of[[-0.38,0.25],[0.38,-0.25]]){ctx.save();ctx.translate(x*s,y*s);ctx.rotate(Math.PI/4);ctx.fillRect(-s*0.07,-s*0.07,s*0.14,s*0.14);ctx.restore();}},
  trans:(s)=>{stroke(s);T('A',-s*0.14,-s*0.08,s*0.42,{w:900,col:A.acc2});T('ع',s*0.18,s*0.12,s*0.42,{w:900,col:A.acc2});ctx.beginPath();ctx.arc(0,0,s*0.4,-0.6,0.4);ctx.stroke();},
  graphic:(s)=>{stroke(s);rr(ctx,-s*0.34,-s*0.34,s*0.68,s*0.68,s*0.1);ctx.stroke();ctx.beginPath();ctx.arc(-s*0.1,-s*0.1,s*0.08,0,6.283);ctx.fill();ctx.beginPath();ctx.moveTo(-s*0.3,s*0.22);ctx.lineTo(-s*0.04,-s*0.02);ctx.lineTo(s*0.1,s*0.1);ctx.lineTo(s*0.3,-s*0.08);ctx.stroke();},
};
// ---------- scene A: the door (0 - 3.55) ----------
function sDoor(t){stage(t,{grid:0.6});const cx=W/2,cy=900,dw=440,dh=780;const fr=ease(t,0.05,0.6);const open=eInOut(P(t,1.45,2.2));
  // light behind the door
  if(open>0){ctx.save();ctx.globalCompositeOperation='lighter';const g=ctx.createRadialGradient(cx,cy,0,cx,cy,900);g.addColorStop(0,`rgba(255,215,170,${0.55*open})`);g.addColorStop(1,'rgba(255,120,40,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.restore();
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=open;for(let i=0;i<9;i++){const a=-0.5+i*0.125;const gg=ctx.createLinearGradient(cx,cy,cx+Math.sin(a)*1400,cy+Math.cos(a)*1400);gg.addColorStop(0,'rgba(255,200,140,0.22)');gg.addColorStop(1,'rgba(255,120,40,0)');ctx.fillStyle=gg;ctx.beginPath();ctx.moveTo(cx-dw*0.3,cy+dh/2);ctx.lineTo(cx+Math.sin(a-0.06)*1500,cy+Math.cos(a-0.06)*1500);ctx.lineTo(cx+Math.sin(a+0.06)*1500,cy+Math.cos(a+0.06)*1500);ctx.lineTo(cx+dw*0.3,cy+dh/2);ctx.fill();}ctx.restore();}
  ctx.save();ctx.globalAlpha=fr;rr(ctx,cx-dw/2,cy-dh/2,dw,dh,10);const ig=ctx.createLinearGradient(0,cy-dh/2,0,cy+dh/2);ig.addColorStop(0,'#FFE7CF');ig.addColorStop(1,'#FFB27A');ctx.fillStyle=open>0?ig:'#120a08';ctx.fill();
  if(open>0){ctx.save();ctx.beginPath();ctx.rect(cx-dw/2,cy-dh/2,dw,dh);ctx.clip();text3D('AI',cx,cy-20,230*lerp(0.7,1,open),{depth:14,front:'#fff',sA:'#FF9A50',sB:'#B4361A',alpha:open});ctx.restore();}
  // door leaf swings (scale x) towards the viewer on the left hinge
  const lw=dw*Math.cos(open*1.35);const skew=open*0.25;ctx.save();ctx.translate(cx-dw/2,cy);ctx.transform(1,-skew*0.5,0,1,0,0);rr(ctx,0,-dh/2-open*30,Math.max(0,lw),dh+open*60,8);const lg=ctx.createLinearGradient(0,0,lw,0);lg.addColorStop(0,'#2a0d08');lg.addColorStop(1,'#140806');ctx.fillStyle=lg;ctx.fill();
  ctx.strokeStyle='rgba(242,120,90,0.6)';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle=A.acc2;ctx.beginPath();ctx.arc(Math.max(8,lw-34),0,9,0,6.283);ctx.fill();ctx.restore();
  ctx.shadowColor=A.hot;ctx.shadowBlur=40;ctx.strokeStyle=A.acc2;ctx.lineWidth=6;rr(ctx,cx-dw/2-8,cy-dh/2-8,dw+16,dh+16,14);ctx.stroke();ctx.restore();
  kl('الذكاء الصناعي',W/2,250,104,0.14,t,{t1:1.6});kl('فتحلك باب',W/2,370,92,1.0,t,{col:A.hot,t1:1.6});
  kl('مش هيتفتح تاني',W/2,280,92,1.8,t,{t1:3.4});kl('غير بعد',W/2,400,70,2.5,t,{col:A.sub,t1:3.4});
  const yp=pop(t,2.98,0.4);if(yp>0){ctx.save();ctx.translate(W/2,1450);ctx.scale(yp,yp);text3D('20',-110,0,230,{depth:18});T('سنة',175,30,96,{w:900,col:A.hot});ctx.restore();}}
// ---------- scene B: you, watching for 10 years / the skills (3.55 - 9.24) ----------
function person(x,y,s,col='#F6F2EF',a=1){ctx.save();ctx.globalAlpha*=a;ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y-s*0.62,s*0.2,0,6.283);ctx.fill();ctx.beginPath();ctx.moveTo(x-s*0.32,y+s*0.4);ctx.quadraticCurveTo(x-s*0.32,y-s*0.34,x,y-s*0.34);ctx.quadraticCurveTo(x+s*0.32,y-s*0.34,x+s*0.32,y+s*0.4);ctx.closePath();ctx.fill();ctx.restore();}
function sSkills(t){stage(t);
  kl('وإنت واقف تتفرج',W/2,250,96,3.6,t,{t1:5.2});
  // year ticker 2015 -> 2025
  const yr=Math.round(lerp(2015,2025,eInOut(P(t,4.7,5.25))));const ya=P(t,4.6,4.8)*(1-P(t,5.9,6.15));if(ya>0){ctx.save();ctx.globalAlpha=ya;T('من',W/2,420,52,{w:700,col:A.sub});text3D(String(yr),W/2,560,190,{depth:14});kick('10 YEARS',W/2,700,4.8,t);ctx.restore();}
  // the bystander: small figure looking at a glowing stack of skills
  const pa=P(t,3.7,4.0)*(1-P(t,7.25,7.5));person(W/2,1180,240,'#2c1410',pa);if(pa>0){ctx.save();ctx.globalAlpha=pa*0.9;ctx.strokeStyle='rgba(242,120,90,0.5)';ctx.lineWidth=3;ctx.setLineDash([10,12]);ctx.beginPath();ctx.ellipse(W/2,1290,180,30,0,0,6.283);ctx.stroke();ctx.setLineDash([]);ctx.restore();}
  kl('عشان تتعلم أي مهارة',W/2,250,84,5.3,t,{t1:9.1});chip('Freelancing',W/2,380,52,6.72,t,{t1:9.1});
  const S=[['Graphic Design','تصميم جرافيك',ICO.graphic,7.5],['المونتاج','Video Editing',ICO.film,7.86],['Motion Graphics','موشن جرافيكس',ICO.motion,8.6]];
  S.forEach(([a,b,ic,t0],i)=>{const p=pop(t,t0,0.4);const out=1-P(t,9.05,9.3);if(p<=0||out<=0)return;card(W/2,640+i*230,880,190,a,b,s=>ic(s),{sc:p,alpha:out});});}
// ---------- scene C: the race you had to win (9.24 - 14.26) / D: AI resets the counter (14.26 - 16.38) ----------
function sRace(t){const shake=t>15.36&&t<15.75?(1-P(t,15.36,15.75))*18:0;ctx.save();ctx.translate(Math.sin(t*90)*shake,Math.cos(t*77)*shake);stage(t);
  kl('كنت محتاج تنافس ناس',W/2,250,88,9.3,t,{t1:14.1});kl('بقالها في المجال',W/2,360,64,10.6,t,{col:A.sub,t1:14.1});
  const base=1330,maxH=760;const reset=eInOut(P(t,15.36,15.8));
  const bars=[['إنت',0.04,9.6,A.red],['20 سنة',0.5,11.44,'#8a3a22'],['30 سنة',0.75,11.92,'#c4521f'],['40 سنة',1.0,12.32,A.hot]];
  bars.forEach(([lab,v,t0,col],i)=>{const x=W/2+(1.5-i)*215;const g=ease(t,t0,t0+0.6)*(1-reset)+(i===0?0:0);const h=Math.max(10,maxH*v*g)+reset*10;const a=P(t,9.5,9.8)*(1-P(t,16.2,16.4));if(a<=0)return;
    ctx.save();ctx.globalAlpha=a;const gr=ctx.createLinearGradient(0,base-h,0,base);gr.addColorStop(0,col);gr.addColorStop(1,'#2a0d08');rr(ctx,x-75,base-h,150,h,18);ctx.fillStyle=gr;ctx.shadowColor=col;ctx.shadowBlur=i===3?40:15;ctx.fill();ctx.shadowBlur=0;
    if(i>0&&g>0.05)T(String(Math.round(parseInt(lab)*g)),x,base-h-50,64,{w:900});T(lab,x,base+52,i?38:46,{w:800,col:i?A.sub:'#fff'});
    if(i===0){const wob=t>13.4&&t<15.3?Math.sin(t*14)*6:0;T('؟',x+wob,base-h-60,70,{w:900,col:A.acc2,alpha:P(t,13.4,13.6)*(1-reset)});}ctx.restore();});
  if(P(t,9.5,9.8)>0){ctx.save();ctx.globalAlpha=P(t,9.5,9.8)*(1-P(t,16.2,16.4));ctx.fillStyle='rgba(255,255,255,0.25)';ctx.fillRect(110,base,W-220,3);ctx.restore();}
  chip('وسابقينك بسنين',W/2,500,50,13.4,t,{t1:14.15,fill:'rgba(20,18,19,0.95)',stroke:A.acc2});
  // AI orb strikes the chart and zeroes it
  const fly=P(t,14.4,15.36);if(t>14.26&&t<16.4){kl('الـ AI دلوقتي',W/2,260,104,14.26,t,{t1:16.25});kl('صفّر العداد',W/2,385,104,15.36,t,{col:A.hot,glow:30,t1:16.25});
    if(t<15.5){const ox=lerp(W+200,W/2,eIn(fly)),oy=lerp(560,base-200,eIn(fly));glowBlob(ox,oy,220,'rgba(255,150,70,0.8)',1);T('AI',ox,oy,90,{w:900,col:'#fff',glow:40});}
    const r=P(t,15.36,15.9);if(r>0&&r<1){ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=`rgba(255,170,100,${1-r})`;ctx.lineWidth=14*(1-r);ctx.beginPath();ctx.arc(W/2,base-200,60+r*900,0,6.283);ctx.stroke();ctx.restore();}
    const zp=pop(t,15.45,0.4);if(zp>0){ctx.save();ctx.translate(W/2,960);ctx.scale(zp,zp);rr(ctx,-260,-150,520,300,40);ctx.fillStyle='#0F0D0D';ctx.fill();ctx.strokeStyle=A.acc2;ctx.lineWidth=4;ctx.stroke();
      const n=Math.max(0,Math.round(40*(1-eOut(P(t,15.45,15.95)))));T(String(n).padStart(2,'0'),0,10,210,{w:900,col:'#fff',glow:30});ctx.restore();}}
  ctx.restore();}
// ---------- scene E: the same starting line (16.38 - 25.2) ----------
function sStart(t){stage(t,{grid:1.2});const ly=1180;
  kl('كلنا بنبدأ',W/2,250,104,16.38,t,{t1:21.3});kl('من نفس النقطة',W/2,375,96,16.9,t,{col:A.hot,t1:21.3});
  const la=ease(t,16.5,17.2)*(1-P(t,25.0,25.2));if(la>0){ctx.save();ctx.globalAlpha=la;ctx.shadowColor=A.hot;ctx.shadowBlur=30;ctx.fillStyle=A.hot;ctx.fillRect(W/2-470*la,ly-4,940*la,8);ctx.shadowBlur=0;
    T('START',W/2,ly+70,40,{w:900,col:'rgba(255,170,130,0.75)',ls:14});ctx.restore();}
  const R=[['خبرة 10 سنين',18.26,-300],['20 سنة',18.86,0],['لسه بتبدأ',19.42,300]];
  R.forEach(([lab,t0,dx],i)=>{const d=eOutBack(P(t,t0,t0+0.45));if(d<=0)return;const a=1-P(t,21.3,21.5);if(a<=0)return;const y=lerp(700,ly-120,clamp(d));person(W/2+dx,y,190,'#F6F2EF',a);chip(lab,W/2+dx,y-210,32,t0+0.1,t,{fill:'rgba(20,18,19,0.95)',stroke:A.acc2,t1:21.3});});
  kl('كله بيبدأ من نفس المكان',W/2,560,70,20.16,t,{t1:21.3,col:A.sub});
  // no clear method: a blueprint with a broken path
  const ma=P(t,21.4,21.7)*(1-P(t,22.8,23.0));if(ma>0){kl('مفيش حد عنده',W/2,250,96,21.42,t,{t1:22.8});kl('منهجية واضحة',W/2,370,96,21.9,t,{col:A.hot,t1:22.8});
    ctx.save();ctx.globalAlpha=ma;rr(ctx,170,560,740,520,30);ctx.fillStyle='#10151E';ctx.fill();ctx.strokeStyle='rgba(120,170,255,0.35)';ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle='rgba(120,170,255,0.12)';for(let i=1;i<9;i++){ctx.beginPath();ctx.moveTo(170+i*82,560);ctx.lineTo(170+i*82,1080);ctx.stroke();}for(let i=1;i<6;i++){ctx.beginPath();ctx.moveTo(170,560+i*87);ctx.lineTo(910,560+i*87);ctx.stroke();}
    ctx.setLineDash([16,14]);ctx.strokeStyle='#8FB6FF';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(230,1020);ctx.bezierCurveTo(400,980,330,760,540,800);ctx.bezierCurveTo(700,830,640,650,850,620);ctx.stroke();ctx.setLineDash([]);
    [[400,930,21.7],[560,760,21.9],[760,700,22.1]].forEach(([x,y,t0])=>{const q=pop(t,t0);if(q>0){ctx.save();ctx.translate(x,y);ctx.scale(q,q);ctx.beginPath();ctx.arc(0,0,42,0,6.283);ctx.fillStyle=A.red;ctx.fill();T('?',0,4,58,{w:900});ctx.restore();}});
    const x2=ease(t,22.44,22.7);if(x2>0){ctx.strokeStyle=A.red;ctx.lineWidth=16;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(250,620);ctx.lineTo(250+580*x2,620+400*x2);ctx.stroke();}ctx.restore();}
  // everyone experiments / explores from the starting line
  if(t>22.8){kl('كله بيجرّب',W/2,250,104,22.84,t,{t1:25.05});kl('كله بيستكشف',W/2,375,96,23.54,t,{col:A.hot,t1:25.05});kl('من أول الخط',W/2,480,64,24.34,t,{col:A.sub,t1:25.05});
    const e=P(t,22.9,23.2)*(1-P(t,25.0,25.2));if(e>0){ctx.save();ctx.globalAlpha=e;for(let i=0;i<5;i++){const x=W/2+(i-2)*190;const y=ly-110;person(x,y,150,'#F6F2EF',1);
      const sw=Math.sin(t*2.2+i*1.7)*0.5;const beam=P(t,23.6+i*0.12,24.0+i*0.12);if(beam>0){ctx.save();ctx.globalCompositeOperation='lighter';ctx.translate(x,y-90);ctx.rotate(-Math.PI/2+sw);const g=ctx.createLinearGradient(0,0,520,0);g.addColorStop(0,`rgba(255,190,120,${0.45*beam})`);g.addColorStop(1,'rgba(255,120,40,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(520,-90);ctx.lineTo(520,90);ctx.closePath();ctx.fill();ctx.restore();}
      const q=pop(t,22.95+i*0.08);if(q>0&&t<23.6){T(['?','✦','?','✦','?'][i],x,y-260,60*q,{w:900,col:A.acc2});}}ctx.restore();}}}
// ---------- scene F: best time + AI merges into every field (25.2 - 32.05) ----------
function sMerge(t){stage(t);
  kl('عشان كده ده',W/2,240,80,25.22,t,{col:A.sub,t1:26.5});kl('أنسب وقت',W/2,360,124,25.76,t,{col:A.hot,glow:24,t1:26.5});
  // clock: hands race and land on NOW
  const ca=P(t,25.4,25.7)*(1-P(t,26.42,26.64));if(ca>0){ctx.save();ctx.globalAlpha=ca;const cx=W/2,cy=860,R=250;ctx.beginPath();ctx.arc(cx,cy,R,0,6.283);ctx.fillStyle='#120E0D';ctx.fill();ctx.strokeStyle=A.acc2;ctx.lineWidth=8;ctx.shadowColor=A.hot;ctx.shadowBlur=30;ctx.stroke();ctx.shadowBlur=0;
    for(let i=0;i<12;i++){const a=i/12*6.283;ctx.fillStyle=i%3?'#5a4a46':'#fff';ctx.beginPath();ctx.arc(cx+Math.sin(a)*(R-34),cy-Math.cos(a)*(R-34),i%3?5:9,0,6.283);ctx.fill();}
    const sp=eOut(P(t,25.5,26.3));const hA=sp*6.283*3,mA=sp*6.283*7;ctx.strokeStyle='#fff';ctx.lineCap='round';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.sin(hA)*120,cy-Math.cos(hA)*120);ctx.stroke();ctx.strokeStyle=A.hot;ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.sin(mA)*190,cy-Math.cos(mA)*190);ctx.stroke();
    ctx.restore();chip('دلوقتي',W/2,1210,56,26.0,t,{t1:26.42});}
  // AI core + four fields
  const core=P(t,26.66,27.0);if(core>0){kl('وتدمج الـ AI',W/2,240,100,26.72,t,{t1:32.0});kl('في مجالك.. أيًا كان مجالك',W/2,360,62,27.86,t,{col:A.sub,t1:32.0});
    const cx=W/2,cy=900;const pul=1+Math.sin(t*6)*0.04;glowBlob(cx,cy,330*core,'rgba(255,140,60,0.6)',1);ctx.save();ctx.translate(cx,cy);ctx.scale(core*pul,core*pul);ctx.beginPath();ctx.arc(0,0,120,0,6.283);const g=ctx.createRadialGradient(-30,-30,10,0,0,120);g.addColorStop(0,'#FFD2A8');g.addColorStop(0.5,A.hot);g.addColorStop(1,A.red);ctx.fillStyle=g;ctx.fill();T('AI',0,6,96,{w:900,col:'#fff'});ctx.restore();
    const F=[['مونتاج',ICO.film,29.18,-1,-1],['Graphics',ICO.graphic,29.76,1,-1],['Motion',ICO.motion,30.3,-1,1],['ترجمة',ICO.trans,31.66,1,1]];
    F.forEach(([lab,ic,t0,sx,sy])=>{const p=pop(t,t0,0.4);if(p<=0)return;const x=cx+sx*270,y=cy+sy*300;const out=1-P(t,31.95,32.1);
      const lk=ease(t,t0+0.15,t0+0.5);ctx.save();ctx.globalAlpha=out;ctx.strokeStyle=`rgba(255,150,80,${0.8*lk})`;ctx.lineWidth=5;ctx.setLineDash([14,10]);ctx.lineDashOffset=-t*60;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(lerp(cx,x,lk),lerp(cy,y,lk));ctx.stroke();ctx.setLineDash([]);ctx.restore();
      ctx.save();ctx.globalAlpha=out;ctx.translate(x,y);ctx.scale(p,p);rr(ctx,-150,-110,300,220,30);ctx.fillStyle=A.card;ctx.shadowColor='rgba(0,0,0,0.6)';ctx.shadowBlur=30;ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=lk>0.9?A.acc2:A.line;ctx.lineWidth=3;ctx.stroke();
      ctx.save();ctx.translate(0,-28);ic(90);ctx.restore();T(lab,0,62,42,{w:900});const b=pop(t,t0+0.45);if(b>0){ctx.save();ctx.translate(120,-90);ctx.scale(b,b);rr(ctx,-44,-26,88,52,26);ctx.fillStyle=A.red;ctx.fill();T('AI',0,2,30,{w:900});ctx.restore();}ctx.restore();});}}
// ---------- scene G: ride the wave (32.05 - 37.7) ----------
function sWave(t){const regret=eInOut(P(t,36.05,36.6));stage(t,{glow:1-regret*0.6,grid:0.5});
  kl('لازم تبدأ تتقن',W/2,240,100,32.1,t,{t1:34.15});kl('استخدام الـ AI',W/2,360,104,32.9,t,{col:A.hot,glow:20,t1:34.15});
  kl('اركب الموجة',W/2,250,110,34.24,t,{t1:36.0});kl('دلوقتي',W/2,375,90,35.7,t,{col:A.hot,t1:36.0});
  const rise=ease(t,32.3,34.8)*(1-regret*0.85);const base=lerp(1750,1150,rise);
  for(let L=3;L>=0;L--){ctx.save();const amp=lerp(30,130,rise)*(1-L*0.18),k=0.006+L*0.0015,ph=t*(1.6+L*0.4)+L;ctx.beginPath();ctx.moveTo(0,H);for(let x=0;x<=W;x+=10){ctx.lineTo(x,base+L*70+Math.sin(x*k+ph)*amp+Math.sin(x*0.013-ph*0.7)*amp*0.35);}ctx.lineTo(W,H);ctx.closePath();
    const g=ctx.createLinearGradient(0,base-150,0,H);const c0=regret>0.5?['#3a3433','#1a1716']:[['#FF9A50','#C0281A'],['#E5602F','#7a1a0d'],['#B4361A','#3a0c06'],['#7a1a0d','#1a0604']][L];g.addColorStop(0,c0[0]);g.addColorStop(1,c0[1]);ctx.fillStyle=g;ctx.globalAlpha=0.9-L*0.12;ctx.fill();ctx.restore();}
  // the rider on the crest
  const ra=P(t,34.4,34.8)*(1-regret);if(ra>0){const x=W/2+Math.sin(t*1.3)*60;const amp=lerp(30,130,rise);const y=base+Math.sin(x*0.006+t*1.6)*amp+Math.sin(x*0.013-t*1.12)*amp*0.35-20;ctx.save();ctx.globalAlpha=ra;ctx.translate(x,y);ctx.rotate(Math.cos(x*0.006+t*1.6)*0.3);
    rr(ctx,-110,-14,220,28,14);ctx.fillStyle='#fff';ctx.fill();person(0,-95,150,'#fff');chip('AI',0,-260,40,34.5,t,{});ctx.restore();}
  if(regret>0){ctx.fillStyle=`rgba(0,0,0,${0.35*regret})`;ctx.fillRect(0,0,W,H);kl('هتندم كتير',W/2,600,130,36.1,t,{col:'#FF4B3A',t1:37.6});
    const yp=pop(t,36.9,0.4);if(yp>0){ctx.save();ctx.translate(W/2,820);ctx.scale(yp,yp);T('بعد',-250,10,70,{w:800,col:A.sub});text3D('+10',10,0,170,{depth:12,front:'#ddd',sA:'#888',sB:'#333'});T('سنين',265,20,64,{w:800,col:A.sub});ctx.restore();}
    if(t>37.45){ctx.fillStyle=`rgba(0,0,0,${P(t,37.45,37.75)})`;ctx.fillRect(0,0,W,H);}}}
// ---------- scene H: comment CTA (37.75 - 40.85) ----------
function sComment(t){stage(t);kl('عايز تعرف أكتر',W/2,250,100,37.82,t,{t1:40.8});kl('عن الـ AI؟',W/2,370,104,38.76,t,{col:A.hot,t1:40.8});
  const a=P(t,37.9,38.3)*(1-P(t,40.7,40.88));if(a<=0)return;ctx.save();ctx.globalAlpha=a;const y0=lerp(640,560,ease(t,37.9,38.5));
  rr(ctx,110,y0,860,640,36);ctx.fillStyle='#121011';ctx.shadowColor='rgba(0,0,0,0.6)';ctx.shadowBlur=50;ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=A.line;ctx.lineWidth=2;ctx.stroke();
  T('Comments',W/2,y0+56,34,{w:800});ctx.fillStyle=A.line;ctx.fillRect(110,y0+100,860,2);
  // existing comments (skeleton)
  for(let i=0;i<2;i++){const yy=y0+150+i*110;ctx.fillStyle='#2a2524';ctx.beginPath();ctx.arc(900,yy+20,34,0,6.283);ctx.fill();rr(ctx,450,yy,400,22,11);ctx.fill();rr(ctx,550,yy+38,300,18,9);ctx.fill();}
  // typing a comment
  const fy=y0+520;rr(ctx,150,fy,780,90,45);ctx.fillStyle='#1d1a1b';ctx.fill();ctx.strokeStyle=t>39.3?A.acc2:A.line;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=A.red;ctx.beginPath();ctx.arc(880,fy+45,30,0,6.283);ctx.fill();T('أنا',880,fy+47,26,{w:800});
  const msg='عايز أعرف أكتر عن الـ AI';const n=Math.round(msg.length*P(t,39.3,39.9));const s=[...msg].slice(0,n).join('');if(s)T(s,830,fy+46,36,{w:700,align:'right'});else T('أضف تعليق...',830,fy+46,32,{col:'#6f6a6a',align:'right'});
  const sp=pop(t,39.95);ctx.save();ctx.translate(205,fy+45);ctx.scale(1+0.2*Math.sin(Math.PI*P(t,39.95,40.2)),1+0.2*Math.sin(Math.PI*P(t,39.95,40.2)));T('نشر',0,0,32,{w:900,col:t>39.9?A.hot:'#6f6a6a'});ctx.restore();
  // reply bubble
  const rp=pop(t,40.05,0.4);if(rp>0){ctx.save();ctx.translate(560,y0+400);ctx.scale(rp,rp);rr(ctx,-380,-60,760,120,30);const g=ctx.createLinearGradient(0,-60,0,60);g.addColorStop(0,'#C9321F');g.addColorStop(1,'#A2210F');ctx.fillStyle=g;ctx.fill();T('هرد عليك بالتفاصيل ✓',0,4,44,{w:900});ctx.restore();}
  ctx.restore();}
// ---------- scene I: name card (40.85 - 46.5) ----------
function sName(t){stage(t,{glow:1.3});const a0=40.88;
  kl('أنا',W/2,420,70,a0,t,{col:A.sub});
  const np=pop(t,41.02,0.5);if(np>0){ctx.save();ctx.translate(W/2,580);ctx.scale(np,np);text3D('محمد صابر',0,0,150,{depth:16});ctx.restore();}
  const T3=[['AI Automation Engineer',41.64],['Senior Graphic Designer',43.18],['Adobe Certified Instructor',44.02]];
  T3.forEach(([s,t0],i)=>{const p=pop(t,t0,0.4);if(p<=0)return;const y=800+i*130;ctx.save();ctx.translate(W/2,y);ctx.scale(p,p);const w=tw(s,44,800)+90;rr(ctx,-w/2,-46,w,92,46);ctx.fillStyle=i===0?A.red:'#141213';ctx.fill();ctx.strokeStyle=i===0?'rgba(255,170,140,0.7)':A.acc2;ctx.lineWidth=2.5;ctx.stroke();T(s,0,3,44,{w:800});ctx.restore();});
  const lp=ease(t,44.6,45.2);if(lp>0){ctx.save();ctx.globalAlpha=lp;const L=150;ctx.save();ctx.shadowColor='rgba(196,50,31,0.8)';ctx.shadowBlur=40;rr(ctx,W/2-L/2,1270,L,L,28);ctx.clip();ctx.drawImage(IM.logo,W/2-L/2,1270,L,L);ctx.restore();T('SABER GROUP ACADEMY',W/2,1470,30,{w:800,col:A.acc,ls:5});ctx.restore();}
  const fo=P(t,DUR-0.5,DUR);if(fo>0){ctx.fillStyle=`rgba(0,0,0,${fo})`;ctx.fillRect(0,0,W,H);}}
// ---------- captions (reel lower third, kept above the platform UI) ----------
const CAP=[[0.14,1.75,'الذكاء الصناعي فتحلك باب'],[1.78,3.5,'مش هيتفتح تاني غير بعد عشرين سنة'],[3.6,5.26,'وإنت واقف تتفرج من عشر سنين'],[5.28,7.2,'عشان تتعلم أي مهارة من مهارات الفريلانسنج'],[7.24,9.22,'Graphic · مونتاج · Motion Graphics'],
  [9.24,11.4,'كنت محتاج تنافس ناس بقالها'],[11.44,12.86,'عشرين وتلاتين وأربعين سنة'],[12.88,14.2,'في المجال وسابقينك بسنين'],[14.26,16.3,'الـ AI دلوقتي صفّر العداد ده'],[16.38,17.6,'كلنا بنبدأ من نفس النقطة'],[17.64,20.1,'سواء عندك خبرة عشر سنين، عشرين سنة، أو لسه بتبدأ'],
  [20.16,21.38,'كله بيبدأ من نفس المكان'],[21.42,22.8,'مفيش حد عنده منهجية واضحة'],[22.84,23.5,'كله بيجرّب'],[23.54,25.1,'كله بيستكشف من أول الخط'],[25.22,27.82,'عشان كده ده أنسب وقت تتعلم وتدمج الـ AI'],[27.86,29.14,'في مجالك.. أيًا كان مجالك'],
  [29.18,32.05,'مونتاج · Graphics · Motion Graphics · ترجمة'],[32.1,34.15,'لازم تبدأ تتقن استخدام الـ AI'],[34.24,36.06,'لو ماركبتش موجة الـ AI دي دلوقتي'],[36.1,37.6,'هتندم كتير بعد عشر سنين'],[37.82,39.84,'لو مهتم تعرف أكتر عن الـ AI سيبلي كومنت'],[39.86,40.85,'هرد عليك بالتفاصيل']];
function captions(t){const c=CAP.find(c=>t>=c[0]-0.05&&t<c[1]+0.12);if(!c)return;const a=P(t,c[0]-0.05,c[0]+0.1)*(1-P(t,c[1],c[1]+0.12));const size=c[2].length>34?36:42;const w=Math.min(960,tw(c[2],size,800)+70);
  ctx.save();ctx.globalAlpha=a;const y=1560+(1-a)*10;rr(ctx,W/2-w/2,y-42,w,84,20);ctx.fillStyle='rgba(10,8,8,0.82)';ctx.fill();ctx.strokeStyle='rgba(242,120,90,0.35)';ctx.lineWidth=1.5;ctx.stroke();
  // karaoke wipe: the spoken part brightens
  const p=clamp((t-c[0])/Math.max(0.3,c[1]-c[0]-0.15));ctx.save();ctx.beginPath();ctx.rect(W/2-w/2,y-42,w,84);ctx.clip();T(c[2],W/2,y+2,size,{w:800,col:'rgba(246,242,239,0.55)'});ctx.restore();
  ctx.save();ctx.beginPath();const tw2=w-70;ctx.rect(W/2+tw2/2-tw2*p,y-42,tw2*p+40,84);ctx.clip();T(c[2],W/2,y+2,size,{w:800,col:'#fff'});ctx.restore();ctx.restore();}
// ---------- timeline ----------
const SC=[[0,sDoor],[3.55,sSkills],[9.24,sRace],[16.36,sStart],[25.2,sMerge],[32.05,sWave],[37.75,sComment],[40.85,sName]];
const CUTS=SC.map(s=>s[0]).slice(1);
function scene(t){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=A.bg;ctx.fillRect(0,0,W,H);ctx.restore();let i=0;while(i<SC.length-1&&t>=SC[i+1][0])i++;
  const since=t-SC[i][0];const pz=i?1+0.1*Math.exp(-since*12):1;ctx.save();ctx.translate(W/2,H/2);ctx.scale(pz,pz);ctx.translate(-W/2,-H/2);SC[i][1](t);ctx.restore();
  // light flash on each cut (door light carries into the next scene)
  for(const c of CUTS){const d=t-c;if(d>-0.08&&d<0.22){const a=d<0?P(d,-0.08,0):1-P(d,0,0.22);ctx.fillStyle=`rgba(255,200,150,${0.55*a})`;ctx.fillRect(0,0,W,H);}}
  captions(t);}
function nSub(t){for(const c of CUTS)if(Math.abs(t-c)<0.25)return 8;if(t>15.3&&t<15.9)return 8;return 3;}
// ================= render hooks =================
const grains=[];{const R=rng(7);for(let k=0;k<6;k++){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');const d=g.createImageData(256,256);for(let i=0;i<d.data.length;i+=4){const v=R()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255;}g.putImageData(d,0,0);grains.push(c);}}
function post(f){const v=out.createRadialGradient(W/2,H/2,H*0.35,W/2,H/2,H*0.9);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,0.45)');out.fillStyle=v;out.fillRect(0,0,W,H);
  out.save();out.globalAlpha=0.045;out.globalCompositeOperation='overlay';out.translate((f*37)%256,(f*91)%256);out.fillStyle=out.createPattern(grains[f%6],'repeat');out.fillRect(-256,-256,W+512,H+512);out.restore();}
window.renderFrame=function(f){const t0=f/FPS,N=nSub(t0),shutter=0.5/FPS;out.fillStyle='#000';out.fillRect(0,0,W,H);
  for(let k=0;k<N;k++){const t=Math.max(0,t0+(N>1?(k/(N-1)-0.5)*shutter:0));ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';
    ctx.translate(W/2,H/2);const z=1.012+Math.sin(t*0.3)*0.008;ctx.scale(z,z);ctx.translate(-W/2+Math.sin(t*0.4)*5,-H/2+Math.cos(t*0.33)*4);scene(t);out.globalAlpha=1/(k+1);out.drawImage(sub,0,0);}
  out.globalAlpha=1;post(f);};
window.ready=(async()=>{
  await Promise.all([600,700,800,900].flatMap(w=>[document.fonts.load(`${w} 40px Cairo`,'مارو'),document.fonts.load(`${w} 40px Cairo`,'AI')]));
  for(const[k,n]of Object.entries(POSE)){IMG[k]=await load(n+'.png');VM[k]=await load(n+'_vmask.png');const v=VIS[n];const c=document.createElement('canvas');c.width=v.x1-v.x0+1;c.height=v.y1-v.y0+1;FACE[k]=c;}
  LOGO=await load('logo_white.png');WATER=document.createElement('canvas');WATER.width=WATER.height=8;IM.logo=await load('logo.png');return true;})();
