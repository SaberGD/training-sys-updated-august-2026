// ================= SABER GROUP 2026 LEARNING SYSTEM — course sales videos =================
// One engine, five videos (?vid=overview|beginner|mastery|modules|alumni), each 16:9 or 9:16 (?v).
const VID=Q.get('vid')||'overview';
const LV=(h,v)=>VERT?v:h;
const CX=W/2;
const WA='واتساب  01040784390';

// ---------- extra icons ----------
function icon2(k,s){ctx.save();ctx.strokeStyle=C.ember;ctx.fillStyle=C.ember;ctx.lineWidth=s*0.08;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor=C.ember;ctx.shadowBlur=s*0.2;const b=ctx;
  switch(k){
  case'clock':b.beginPath();b.arc(0,0,s*0.36,0,6.283);b.stroke();b.beginPath();b.moveTo(0,-s*0.2);b.lineTo(0,0);b.lineTo(s*0.15,s*0.1);b.stroke();break;
  case'user':b.beginPath();b.arc(0,-s*0.14,s*0.14,0,6.283);b.stroke();b.beginPath();b.arc(0,s*0.34,s*0.28,Math.PI*1.1,Math.PI*1.9);b.stroke();break;
  case'team':for(const[x,sc]of[[-0.2,0.8],[0.2,0.8],[0,1]]){b.beginPath();b.arc(s*x,-s*0.12*sc,s*0.1*sc,0,6.283);b.stroke();b.beginPath();b.arc(s*x,s*0.3,s*0.2*sc,Math.PI*1.15,Math.PI*1.85);b.stroke();}break;
  case'community':b.beginPath();b.arc(0,0,s*0.34,0,6.283);b.stroke();b.beginPath();b.ellipse(0,0,s*0.14,s*0.34,0,0,6.283);b.stroke();b.beginPath();b.moveTo(-s*0.34,0);b.lineTo(s*0.34,0);b.stroke();break;
  case'cert':b.beginPath();b.rect(-s*0.3,-s*0.34,s*0.6,s*0.46);b.stroke();b.beginPath();b.arc(0,s*0.18,s*0.12,0,6.283);b.stroke();b.beginPath();b.moveTo(-s*0.08,s*0.28);b.lineTo(-s*0.12,s*0.42);b.moveTo(s*0.08,s*0.28);b.lineTo(s*0.12,s*0.42);b.stroke();break;
  case'gift':b.beginPath();b.rect(-s*0.32,-s*0.08,s*0.64,s*0.42);b.stroke();b.beginPath();b.rect(-s*0.36,-s*0.2,s*0.72,s*0.12);b.stroke();b.beginPath();b.moveTo(0,-s*0.2);b.lineTo(0,s*0.34);b.stroke();b.beginPath();b.ellipse(-s*0.1,-s*0.28,s*0.1,s*0.07,0.4,0,6.283);b.ellipse(s*0.1,-s*0.28,s*0.1,s*0.07,-0.4,0,6.283);b.stroke();break;
  case'cloud':b.beginPath();b.arc(-s*0.14,s*0.04,s*0.16,Math.PI*0.5,Math.PI*1.5);b.arc(s*0.02,-s*0.08,s*0.2,Math.PI,Math.PI*2);b.arc(s*0.2,s*0.06,s*0.14,Math.PI*1.5,Math.PI*0.5);b.closePath();b.stroke();break;
  case'pen':b.beginPath();b.moveTo(0,-s*0.36);b.lineTo(s*0.2,s*0.06);b.lineTo(0,s*0.3);b.lineTo(-s*0.2,s*0.06);b.closePath();b.stroke();b.beginPath();b.moveTo(0,-s*0.36);b.lineTo(0,s*0.04);b.stroke();b.beginPath();b.arc(0,s*0.08,s*0.04,0,6.283);b.fill();break;
  case'palette':b.beginPath();b.arc(0,0,s*0.34,0.3,Math.PI*2-0.3);b.quadraticCurveTo(s*0.12,s*0.02,s*0.32,s*0.1);b.stroke();for(const[x,y]of[[-0.15,-0.15],[0.05,-0.2],[-0.2,0.08]]){b.beginPath();b.arc(s*x,s*y,s*0.05,0,6.283);b.fill();}break;
  case'mega':b.beginPath();b.moveTo(-s*0.3,-s*0.1);b.lineTo(s*0.2,-s*0.32);b.lineTo(s*0.2,s*0.32);b.lineTo(-s*0.3,s*0.1);b.closePath();b.stroke();b.beginPath();b.moveTo(-s*0.2,s*0.12);b.lineTo(-s*0.12,s*0.34);b.stroke();break;
  case'case':b.beginPath();b.rect(-s*0.34,-s*0.14,s*0.68,s*0.44);b.stroke();b.beginPath();b.rect(-s*0.12,-s*0.28,s*0.24,s*0.14);b.stroke();b.beginPath();b.moveTo(-s*0.34,s*0.04);b.lineTo(s*0.34,s*0.04);b.stroke();break;
  case'target':for(const r of[0.34,0.2,0.06]){b.beginPath();b.arc(0,0,s*r,0,6.283);b.stroke();}break;
  case'search':b.beginPath();b.arc(-s*0.06,-s*0.06,s*0.22,0,6.283);b.stroke();b.beginPath();b.moveTo(s*0.1,s*0.1);b.lineTo(s*0.32,s*0.32);b.stroke();break;
  case'layers':for(const y of[-0.16,0,0.16]){b.beginPath();b.moveTo(-s*0.34,s*y);b.lineTo(0,s*(y-0.14));b.lineTo(s*0.34,s*y);b.lineTo(0,s*(y+0.14));b.closePath();b.stroke();}break;
  case'rocket':b.beginPath();b.moveTo(0,-s*0.38);b.quadraticCurveTo(s*0.2,-s*0.1,s*0.12,s*0.2);b.lineTo(-s*0.12,s*0.2);b.quadraticCurveTo(-s*0.2,-s*0.1,0,-s*0.38);b.stroke();b.beginPath();b.arc(0,-s*0.08,s*0.06,0,6.283);b.stroke();b.beginPath();b.moveTo(-s*0.06,s*0.26);b.lineTo(0,s*0.38);b.lineTo(s*0.06,s*0.26);b.stroke();break;
  case'spark':for(const[x,y,r]of[[0,0,0.3],[0.28,-0.26,0.1],[-0.26,0.24,0.08]]){b.beginPath();b.moveTo(s*x,s*(y-r));b.quadraticCurveTo(s*x,s*y,s*(x+r),s*y);b.quadraticCurveTo(s*x,s*y,s*x,s*(y+r));b.quadraticCurveTo(s*x,s*y,s*(x-r),s*y);b.quadraticCurveTo(s*x,s*y,s*x,s*(y-r));b.fill();}break;
  case'video':b.beginPath();b.roundRect(-s*0.36,-s*0.26,s*0.72,s*0.52,s*0.1);b.stroke();b.beginPath();b.moveTo(-s*0.08,-s*0.12);b.lineTo(s*0.14,0);b.lineTo(-s*0.08,s*0.12);b.closePath();b.fill();break;
  default:ctx.restore();return icon(k,s);}
  ctx.restore();}
function itile(k,x,y,sz,o={}){const{alpha=1,bright=0}=o;if(alpha<=0)return;ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);
  rr(ctx,-sz/2,-sz/2,sz,sz,sz*0.24);const g=ctx.createLinearGradient(0,-sz/2,0,sz/2);g.addColorStop(0,'#2a0906');g.addColorStop(1,'#0c0202');ctx.fillStyle=g;ctx.shadowColor='rgba(255,123,32,0.6)';ctx.shadowBlur=30+bright*80;ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(196,50,31,0.9)';ctx.lineWidth=2.5;ctx.stroke();icon2(k,sz*0.52);
  if(bright>0){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=bright;rr(ctx,-sz/2,-sz/2,sz,sz,sz*0.24);ctx.fillStyle='#FFD9B0';ctx.fill();}ctx.restore();}
function numCircle(n,x,y,r,lit,a=1){if(a<=0)return;ctx.save();ctx.globalAlpha=a;ctx.translate(x,y);ctx.beginPath();ctx.arc(0,0,r,0,6.283);
  if(lit>0){const g=ctx.createLinearGradient(0,-r,0,r);g.addColorStop(0,'#FF8A3D');g.addColorStop(1,'#C4321F');ctx.fillStyle=g;ctx.shadowColor=C.ember;ctx.shadowBlur=40*lit;ctx.fill();ctx.shadowBlur=0;}
  else{ctx.fillStyle='rgba(20,6,4,0.95)';ctx.fill();}ctx.lineWidth=3;ctx.strokeStyle=lit>0?'#FFB070':'rgba(255,123,32,0.7)';ctx.stroke();
  T(n,0,3,r*0.78,{w:900,col:lit>0?'#fff':C.ember});ctx.restore();}
function strike(x1,x2,y,p){if(p<=0)return;ctx.save();ctx.strokeStyle='#FF3B2A';ctx.lineWidth=7;ctx.lineCap='round';ctx.shadowColor='#FF3B2A';ctx.shadowBlur=14;ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(lerp(x1,x2,p),y-10*p);ctx.stroke();ctx.restore();}
const fmt=n=>Math.round(n).toLocaleString('en-US');
function fadeIO(t,t0,t1,fi=0.25,fo=0.25){return P(t,t0,t0+fi)*(1-P(t,t1-fo,t1));}
function eyebrow(s,x,y,a){T(s,x,y,LV(22,20),{w:800,ls:LV(9,6),col:'rgba(255,180,120,0.85)',alpha:a});}

// ================= BEATS =================
// every beat draws its own background; t0/t1 = beat window (absolute seconds)
function bHook(t,t0,t1,lines,o={}){background(t,{glow:0.8});const push=1+P(t,t0,t1)*0.06;ctx.save();ctx.translate(CX,H/2);ctx.scale(push,push);ctx.translate(-CX,-H/2);
  const size=LV(o.size||124,o.sizeV||104);const gap=size*1.35;const y0=H/2-(lines.length-1)*gap/2+LV(0,-60);
  lines.forEach(([s,col],i)=>{const ti=t0+0.25+i*(o.step||0.75);const p=P(t,ti,ti+0.55);if(p<=0)return;
    text3D(s,CX,y0+i*gap,size,{rotY:lerp(-1.2,0,eOutExpo(p))+Math.sin(t*1.3+i)*0.03,alpha:clamp(p*3),front:col||C.white,depth:16});});
  if(o.eyebrow)eyebrow(o.eyebrow,CX,y0-gap*0.9,P(t,t0+0.1,t0+0.4));
  const mex=o.maro||(VERT?'happyB':null);if(mex){maroAt('M5',CX,LV(H-120,H-360),LV(130,240),{expr:mex,et:t-t0,t,alpha:P(t,t0+1.2,t0+1.5)});}
  ctx.restore();}
function bTitle(t,t0,t1,{eyebrow:eb,title,sub,sub2,pose='M2',expr='happyB',titleSize=150}){background(t);watermark(LV(1450,540)-(t-t0)*12,LV(560,1300),LV(1500,1400),0.45);
  const mx=LV(560,CX),my=LV(600,1330)+Math.sin(t*2.4)*12;const ms=LV(0.42,0.5);const inn=eOutExpo(P(t,t0,t0+0.5));
  drawMaro(pose,mx+(1-inn)*LV(-700,0),my+(1-inn)*LV(0,700),ms,{rot:Math.sin(t*1.7)*0.03,expr,et:t-t0,t,thrust:0.8});
  const tx=LV(1300,CX);const ty=LV(430,380);eyebrow(eb,tx,ty-LV(150,170),P(t,t0+0.2,t0+0.5));
  const r3=P(t,t0+0.3,t0+0.85);const ts=LV(titleSize,Math.min(titleSize,118));
  const lines=Array.isArray(title)?title:[title];lines.forEach((l,i)=>text3D(l,tx,ty+i*ts*1.1,ts,{rotY:lerp(-1.2,0,eOutExpo(P(t,t0+0.3+i*0.15,t0+0.85+i*0.15)))+Math.sin(t*1.3)*0.04,alpha:clamp(P(t,t0+0.3+i*0.15,t0+0.85+i*0.15)*3)}));
  const sy=ty+lines.length*ts*1.1+LV(10,20);
  if(sub){const sz=LV(58,56);typeOn(sub,tx+tw(sub,sz)/2,sy,sz,t0+1.0,t,{col:C.ember});}
  if(sub2){const lines2=wrapLines(sub2,LV(34,34),LV(900,900),700);lines2.forEach((l,i)=>T(l,tx,sy+LV(90,95)+i*50,LV(34,34),{w:700,col:'rgba(255,245,238,0.85)',alpha:P(t,t0+1.6+i*0.1,t0+1.9+i*0.1)}));}}
// numbered steps (journey). items: [{ar, en, icon}]
function bSteps(t,t0,t1,{heading,items,expr='happyB',maroPose='M4',note}){background(t);
  T(heading,CX,LV(150,260),LV(64,66),{w:900,alpha:P(t,t0,t0+0.3),glow:20});
  const n=items.length;const dt=Math.min(0.55,(t1-t0-1.6)/n);
  if(!VERT){const x0=W-230,x1=230;const y=520;
    const lp=eInOut(P(t,t0+0.3,t0+0.3+dt*n));ctx.save();ctx.strokeStyle='rgba(255,123,32,0.25)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();ctx.strokeStyle=C.ember;ctx.shadowColor=C.ember;ctx.shadowBlur=20;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(lerp(x0,x1,lp),y);ctx.stroke();ctx.restore();
    items.forEach((it,i)=>{const x=lerp(x0,x1,n>1?i/(n-1):0.5);const ti=t0+0.3+i*dt;const p=eob(P(t,ti,ti+0.35));if(p<=0)return;const lit=P(t,ti,ti+0.2);
      ctx.save();ctx.translate(x,y);ctx.scale(p,p);ctx.translate(-x,-y);numCircle(String(i+1).padStart(2,'0'),x,y,62,lit);ctx.restore();
      if(it.icon)itile(it.icon,x,y-165,96,{alpha:P(t,ti+0.1,ti+0.35)});
      const lines=wrapLines(it.ar,40,300,900);lines.forEach((l,j)=>T(l,x,y+120+j*52,40,{w:900,alpha:P(t,ti+0.15,ti+0.4)}));
      if(it.en)T(it.en,x,y+120+lines.length*52+6,20,{w:800,ls:4,col:'rgba(255,170,110,0.85)',alpha:P(t,ti+0.2,ti+0.45)});
      if(it.d){const dl=wrapLines(it.d,26,300,600);dl.forEach((l,j)=>T(l,x,y+120+lines.length*52+46+j*36,26,{w:600,col:'rgba(255,240,230,0.7)',alpha:P(t,ti+0.3,ti+0.55)}));}});
    if(note)T(note,CX,H-110,40,{w:800,col:C.ember,alpha:P(t,t0+0.4+dt*n,t0+0.7+dt*n)});}
  else{const y0=460,y1=1520;const x=190;const lp=eInOut(P(t,t0+0.3,t0+0.3+dt*n));
    ctx.save();ctx.strokeStyle='rgba(255,123,32,0.25)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x,y1);ctx.stroke();ctx.strokeStyle=C.ember;ctx.shadowColor=C.ember;ctx.shadowBlur=20;ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x,lerp(y0,y1,lp));ctx.stroke();ctx.restore();
    items.forEach((it,i)=>{const y=lerp(y0,y1,n>1?i/(n-1):0.5);const ti=t0+0.3+i*dt;const p=eob(P(t,ti,ti+0.35));if(p<=0)return;const lit=P(t,ti,ti+0.2);
      ctx.save();ctx.translate(x,y);ctx.scale(p,p);ctx.translate(-x,-y);numCircle(String(i+1).padStart(2,'0'),x,y,58,lit);ctx.restore();
      const a=P(t,ti+0.1,ti+0.4);ctx.save();ctx.globalAlpha=a;ctx.translate((1-a)*60,0);card(300,y-95,700,190,{r:28});
      T(it.ar,960,y-(it.d?34:(it.en?18:0)),44,{w:900,align:'right'});if(it.en)T(it.en,960,y+(it.d?10:30),20,{w:800,ls:4,align:'right',col:'rgba(255,170,110,0.85)'});
      if(it.d){const dl=wrapLines(it.d,26,600,600);dl.slice(0,2).forEach((l,j)=>T(l,960,y+48+j*34,26,{w:600,align:'right',col:'rgba(255,240,230,0.72)'}));}
      if(it.icon)itile(it.icon,370,y,90,{});ctx.restore();});
    if(note)T(note,CX,1700,40,{w:800,col:C.ember,alpha:P(t,t0+0.4+dt*n,t0+0.7+dt*n)});}}
// five-module orbit burst around a centre word, then an optional badge
function bOrbit(t,t0,t1,{heading,center='MASTERY',items,badge,badgeSub}){background(t,{glow:1.1});
  T(heading,CX,LV(140,250),LV(60,62),{w:900,alpha:P(t,t0,t0+0.3),glow:20});
  const cx=CX,cy=LV(badge?515:560,940),R=LV(badge?295:330,360);rays(cx,cy,Math.max(0,1-P(t,t0+0.2,t0+1.2)),t*0.3);
  const spin=(t-t0)*0.25;let landed=0;
  items.forEach((it,i)=>{const ti=t0+0.25+i*0.12;const p=P(t,ti,ti+0.5);if(p<=0)return;if(p>0.5)landed++;const r=R*eob(p);const a=spin+i*6.283/items.length-Math.PI/2;
    const x=cx+Math.cos(a)*r*LV(1.35,0.95),y=cy+Math.sin(a)*r;numCircle(String(i+1).padStart(2,'0'),x,y,LV(70,66),1,1);
    T(it.en,x,y+LV(100,98),LV(28,26),{w:900,ls:2,alpha:P(t,ti+0.3,ti+0.6)});T(it.ar,x,y+LV(138,134),LV(28,26),{w:700,col:'rgba(255,190,140,0.95)',alpha:P(t,ti+0.35,ti+0.65)});
    const fl=Math.max(0,1-P(t,ti,ti+0.6));if(fl>0){ctx.save();ctx.globalCompositeOperation='lighter';glowBlob(x,y,110,`rgba(255,210,160,${fl*0.8})`,1);ctx.restore();}});
  if(VERT){const bob=Math.sin(t*2.2)*10;drawMaro('M1',CX,1660+bob,0.21,{expr:'wow',et:t-t0-0.5,t,thrust:0.8,alpha:P(t,t0+0.5,t0+0.8)*(badge?1-P(t,t1-1.7,t1-1.3):1)});}
  const cp=P(t,t0+0.4,t0+0.9);text3D(center,cx,cy,LV(92,84),{alpha:clamp(cp*2),rotY:lerp(-1,0,eOutExpo(cp)),depth:12});
  if(landed>0)T(`${landed}`,cx,cy+LV(78,74),LV(34,32),{w:900,col:C.ember,alpha:0.9});
  if(badge){const bp=eob(P(t,t1-1.6,t1-1.2));if(bp>0){const bw=LV(760,900),by=LV(H-66,H-250);ctx.save();ctx.translate(cx,by);ctx.scale(bp,bp);rr(ctx,-bw/2,-52,bw,104,52);ctx.fillStyle=orangeFill(0,-52,0,104);ctx.shadowColor=C.ember;ctx.shadowBlur=50;ctx.fill();ctx.shadowBlur=0;
    T(badge,0,-10,LV(34,34),{w:900,ls:3});if(badgeSub)T(badgeSub,0,28,LV(24,24),{w:700,col:'rgba(255,240,230,0.9)'});ctx.restore();}}}
// gift cards (Beginner essentials)
function bGifts(t,t0,t1,{heading,cards,stamp,total,noValue}){background(t,{glow:1});T(heading,CX,LV(150,250),LV(60,60),{w:900,alpha:P(t,t0,t0+0.3),glow:20});
  cards.forEach((c,i)=>{const ti=t0+0.3+i*0.35;const p=eOutExpo(P(t,ti,ti+0.5));if(p<=0)return;const cw=LV(700,900),ch=LV(560,540);
    const x=LV(CX+(i?-1:1)*390,CX),y=LV(580,640+i*600);ctx.save();ctx.globalAlpha=p;ctx.translate(x,y+(1-p)*120);card(-cw/2,-ch/2,cw,ch,{r:32,glow:30});
    itile('gift',cw/2-80,-ch/2+80,86);T(c.title,cw/2-150,-ch/2+80,44,{w:900,align:'right'});
    c.items.forEach((s,j)=>{const a=P(t,ti+0.3+j*0.1,ti+0.5+j*0.1);ctx.save();ctx.globalAlpha*=a;ctx.fillStyle=C.ember;ctx.beginPath();ctx.arc(cw/2-60,-ch/2+185+j*62,8,0,6.283);ctx.fill();T(s,cw/2-90,-ch/2+185+j*62,34,{w:700,align:'right'});ctx.restore();});
    if(!noValue){T(`القيمة منفردًا: ${c.value} جنيه`,0,ch/2-60,32,{w:800,col:'rgba(255,190,140,0.95)'});
    const sp=P(t,t0+1.6,t0+1.8);strike(-170,170,ch/2-60,sp);}
    const st=eob(P(t,t0+1.8,t0+2.1));if(st>0){ctx.save();ctx.translate(-cw/2+170,ch/2-140);ctx.rotate(-0.12);ctx.scale(st*1.0,st*1.0);rr(ctx,-150,-44,300,88,20);ctx.fillStyle='#fff';ctx.shadowColor=C.ember;ctx.shadowBlur=30;ctx.fill();ctx.shadowBlur=0;T(stamp,0,3,44,{w:900,col:'#C4321F'});ctx.restore();}
    ctx.restore();});
  if(total){const tp=P(t,t0+2.3,t0+3.0);if(tp>0)T(`هدايا بقيمة ${fmt(total*eOut(tp))} جنيه.. مجانًا`,CX,LV(H-120,H-120),LV(52,50),{w:900,col:C.ember,glow:24,alpha:clamp(tp*3)});}}
// benefits ring / grid. items [{k,ar}]
function bBenefits(t,t0,t1,{heading,items,sub}){background(t,{glow:1.1});T(heading,CX,LV(130,240),LV(60,60),{w:900,alpha:P(t,t0,t0+0.3),glow:20});
  if(sub)T(sub,CX,LV(200,320),LV(34,34),{w:700,col:'rgba(255,240,230,0.8)',alpha:P(t,t0+0.2,t0+0.5)});
  const n=items.length;
  if(!VERT){const cx=CX,cy=610,R=300;maroAt('M5',cx,cy,140,{expr:'happyB',t,alpha:P(t,t0+0.3,t0+0.6)});rays(cx,cy,Math.max(0,1-P(t,t0+0.2,t0+1.2))*0.8,t*0.3);
    items.forEach((it,i)=>{const ti=t0+0.25+i*0.1;const p=P(t,ti,ti+0.5);if(p<=0)return;const a=-Math.PI/2+i*6.283/n+(t-t0)*0.12;const r=R*eob(p);const x=cx+Math.cos(a)*r*1.9,y=cy+Math.sin(a)*r;
      itile(it.k,x,y-24,110,{bright:Math.max(0,1-P(t,ti,ti+0.7))*0.8});T(it.ar,x,y+62,30,{w:800,alpha:P(t,ti+0.3,ti+0.6)});});}
  else{items.forEach((it,i)=>{const ti=t0+0.25+i*0.1;const p=eob(P(t,ti,ti+0.45));if(p<=0)return;const col=i%2,row=Math.floor(i/2);const x=col?290:790,y=520+row*330;
      ctx.save();ctx.translate(x,y);ctx.scale(p,p);card(-230,-140,460,280,{r:30});itile(it.k,0,-45,110,{bright:Math.max(0,1-P(t,ti,ti+0.7))*0.8});
      const ls=wrapLines(it.ar,32,400,800);ls.forEach((l,j)=>T(l,0,62+j*40,32,{w:800}));ctx.restore();});
    maroAt('M5',CX,1560+Math.ceil(n/2-3)*330,150,{expr:'happyB',t,alpha:P(t,t0+0.8,t0+1.1)});}}
// Google AI Pro gift
function bAIPro(t,t0,t1,{months}){background(t,{glow:1.2});const cx=CX,cy=LV(540,900);const p=eob(P(t,t0+0.1,t0+0.55));
  rays(cx,cy,Math.max(0,1-P(t,t0+0.1,t0+1.3)),t*0.25);
  ctx.save();ctx.translate(cx,cy);ctx.scale(p,p);const cw=LV(1000,920),ch=LV(560,1060);card(-cw/2,-ch/2,cw,ch,{r:40,glow:60,stroke:'rgba(255,170,100,0.8)',lw:3});
  rr(ctx,-170,-ch/2-30,340,62,31);ctx.fillStyle=orangeFill(0,-ch/2-30,0,62);ctx.fill();T('هدية لفترة محدودة',0,-ch/2+2,30,{w:900});
  T('GOOGLE AI PRO',0,-ch/2+LV(120,140),LV(64,62),{w:900,ls:4});T('تفعيل رسمي على إيميلك الشخصي',0,-ch/2+LV(185,210),LV(34,34),{w:700,col:'rgba(255,240,230,0.85)'});
  const m=Math.round(months*eOut(P(t,t0+0.5,t0+1.3)));text3D(String(m),LV(-170,0),LV(60,70),LV(190,210),{depth:16});T('شهر',LV(-170,0),LV(180,210),LV(44,46),{w:900,col:C.ember});
  if(!VERT){ctx.fillStyle='rgba(255,123,32,0.35)';ctx.fillRect(40,-40,3,220);}
  itile('cloud',LV(160,-170),LV(10,390),LV(110,110),{alpha:P(t,t0+0.9,t0+1.2)});T('5 تيرا تخزين',LV(160,-170),LV(110,490),LV(32,36),{w:900,alpha:P(t,t0+1.0,t0+1.3)});
  itile('video',LV(390,170),LV(10,390),LV(110,110),{alpha:P(t,t0+1.1,t0+1.4)});T('أحدث أدوات',LV(390,170),LV(110,475),LV(30,32),{w:800,alpha:P(t,t0+1.2,t0+1.5)});T('الصور والفيديو',LV(390,170),LV(150,515),LV(30,32),{w:800,alpha:P(t,t0+1.2,t0+1.5)});
  ctx.restore();}
// price card. price, early (optional), includes
function bPrice(t,t0,t1,{label,price,early,note,includes,maroExpr='fire'}){background(t,{glow:1.2});watermark(LV(1500,540),LV(540,1400),1500,0.3);
  const mx=LV(470,CX),my=LV(560,1450);maroAt('M2',mx,my-LV(200,210),LV(190,200),{expr:maroExpr,et:t-t0,t,thrust:0.8});
  const cx=LV(1250,CX);eyebrow(label,cx,LV(200,230),P(t,t0,t0+0.3));
  if(early){const p1=P(t,t0+0.2,t0+0.6);T(`${fmt(price)} جنيه`,cx,LV(310,340),LV(72,70),{w:900,alpha:p1,col:'rgba(255,245,238,0.75)'});const pw=tw(`${fmt(price)} جنيه`,LV(72,70));strike(cx-pw/2-10,cx+pw/2+10,LV(310,340),P(t,t0+0.8,t0+1.1));
    const e=Math.round(early*eOut(P(t,t0+1.1,t0+1.8)));const ep=P(t,t0+1.1,t0+1.4);if(ep>0){text3D(`${fmt(e)}`,cx,LV(470,500),LV(170,170),{alpha:clamp(ep*3),depth:18});T('جنيه · حجز مبكر',cx,LV(590,630),LV(44,44),{w:900,col:C.ember,alpha:ep});}}
  else{const e=Math.round(price*eOut(P(t,t0+0.3,t0+1.0)));const ep=P(t,t0+0.3,t0+0.6);text3D(`${fmt(e)}`,cx,LV(420,450),LV(180,180),{alpha:clamp(ep*3),depth:18});T('جنيه',cx,LV(545,580),LV(48,48),{w:900,col:C.ember,alpha:ep});}
  if(note)T(note,cx,LV(665,705),LV(30,30),{w:700,col:'rgba(255,240,230,0.8)',alpha:P(t,t0+1.6,t0+1.9)});
  if(includes){const y0=LV(760,800);const ls=wrapLines(includes,LV(30,30),LV(900,940),700);ls.forEach((l,i)=>T(l,cx,y0+i*44,LV(30,30),{w:700,col:'rgba(255,240,230,0.85)',alpha:P(t,t0+1.9+i*0.1,t0+2.2+i*0.1)}));}}
// custom price-less offer (alumni)
function bOffer(t,t0,t1,{label,big,sub}){background(t,{glow:1.2});const cx=CX,cy=LV(470,780);eyebrow(label,cx,cy-LV(220,260),P(t,t0,t0+0.3));
  big.forEach((l,i)=>{const p=P(t,t0+0.2+i*0.2,t0+0.75+i*0.2);text3D(l,cx,cy-LV(60,80)+i*LV(150,150),LV(140,120),{alpha:clamp(p*3),rotY:lerp(-1.1,0,eOutExpo(p)),depth:16});});
  if(sub)typeOn(sub,cx+tw(sub,LV(52,48))/2,cy+LV(240,280),LV(52,48),t0+1.0,t);
  maroAt('M5',cx,LV(H-190,H-420),LV(150,220),{expr:'love',et:t-t0-0.8,t,alpha:P(t,t0+0.6,t0+0.9)});}
// equation beat
function bEquation(t,t0,t1,{a,b,res,resSub}){background(t,{glow:1});const cx=CX;const ys=LV([380,380,650],[520,820,1260]);
  const blk=(s,x,y,t1_,sz,col)=>{const p=eob(P(t,t1_,t1_+0.4));if(p<=0)return;ctx.save();ctx.translate(x,y);ctx.scale(p,p);const w=tw(s,sz,900)+90;card(-w/2,-sz*0.95,w,sz*1.9,{r:sz*0.95,fill:col?orangeFill(0,-sz,0,sz*2):'rgba(12,6,5,0.92)',glow:col?50:0});T(s,0,3,sz,{w:900});ctx.restore();};
  if(!VERT){blk(a,1400,ys[0],t0+0.2,54);T('+',CX,ys[0],90,{w:900,col:C.ember,alpha:P(t,t0+0.6,t0+0.8)});blk(b,520,ys[0],t0+0.7,54);}
  else{blk(a,cx,ys[0],t0+0.2,50);T('+',cx,670,90,{w:900,col:C.ember,alpha:P(t,t0+0.6,t0+0.8)});blk(b,cx,ys[1],t0+0.7,50);}
  const ep=P(t,t0+1.2,t0+1.4);if(ep>0){ctx.save();ctx.globalAlpha=ep;ctx.fillStyle=C.ember;const y=LV(520,1040);ctx.fillRect(cx-60,y-14,120,8);ctx.fillRect(cx-60,y+6,120,8);ctx.restore();}
  blk(res,cx,ys[2],t0+1.5,LV(64,56),true);if(resSub)T(resSub,cx,ys[2]+LV(110,110),LV(36,34),{w:700,col:'rgba(255,240,230,0.85)',alpha:P(t,t0+2.0,t0+2.3)});}
// problem -> module flips (standalone modules)
function bFlips(t,t0,t1,{items}){background(t);const n=items.length,dt=(t1-t0)/n;const i=Math.min(n-1,Math.floor((t-t0)/dt));const it=items[i],ti=t0+i*dt;
  T('إيه أكتر حاجة موقفاك؟',CX,LV(120,230),LV(48,50),{w:800,col:'rgba(255,240,230,0.75)'});
  // progress dots
  for(let k=0;k<n;k++){ctx.fillStyle=k<=i?C.ember:'rgba(255,255,255,0.15)';ctx.beginPath();ctx.arc(CX+(k-(n-1)/2)*40,LV(180,300),k===i?10:7,0,6.283);ctx.fill();}
  const cw=LV(1180,940),cx=LV(1140,CX),cy=LV(560,860);
  const fl=P(t,ti+0.8,ti+1.1);const sx=Math.abs(Math.cos(fl*Math.PI));const front=fl<0.5;const inA=eOutExpo(P(t,ti,ti+0.35)),out=P(t,ti+dt-0.2,ti+dt);
  ctx.save();ctx.globalAlpha=inA*(1-out);ctx.translate(cx+(1-inA)*200-out*200,cy);ctx.scale(Math.max(0.02,sx),1);
  if(front){card(-cw/2,-170,cw,340,{r:36});T('المشكلة',cw/2-50,-110,28,{w:900,align:'right',col:'rgba(255,170,110,0.9)'});const ls=wrapLines(it.p,LV(58,52),cw-120,900);ls.forEach((l,j)=>T(`«${l}»`.replace('»«',''),cw/2-50,-20+j*70,LV(58,52),{w:900,align:'right'}));}
  else{rr(ctx,-cw/2,-170,cw,340,36);ctx.fillStyle=orangeFill(0,-170,0,340);ctx.shadowColor=C.ember;ctx.shadowBlur=60;ctx.fill();ctx.shadowBlur=0;
    T(`MODULE 0${i+1}`,cw/2-50,-118,24,{w:900,ls:5,align:'right',col:'rgba(255,240,230,0.9)'});T(it.m,cw/2-50,-45,LV(64,56),{w:900,align:'right'});
    const ls=wrapLines(it.d,32,cw-120,700);ls.slice(0,2).forEach((l,j)=>T(l,cw/2-50,30+j*44,32,{w:700,align:'right',col:'rgba(255,245,238,0.95)'}));
    T(`حجز مبكر ${fmt(it.early)} جنيه`,-cw/2+40,118,34,{w:900,align:'left'});T(`بدل ${fmt(it.price)}`,-cw/2+40,72,26,{w:700,align:'left',col:'rgba(255,240,230,0.75)'});}
  ctx.restore();
  const mx=LV(330,CX),my=LV(620,1450);maroAt(fl<0.5?'M3':'M4',mx,my-LV(190,180),LV(180,190),{expr:fl<0.5?'think':'check',et:t-(ti+1.0),t});}
function bCTA(t,t0,t1,{line1,line2,btn}){background(t,{glow:1.3});const endP=eInOut(P(t,t1-2.6,t1-2.0));
  ctx.save();ctx.globalAlpha=1-endP;
  const inn=eOutExpo(P(t,t0,t0+0.5));maroAt('M2',LV(lerp(-200,500,inn),CX),LV(470,1260)+Math.sin(t*2.4)*12,LV(280,300),{expr:'happyB',t,thrust:0.9});
  const tx=LV(1250,CX);const l1=wrapLines(line1,LV(70,64),LV(1050,960),900);l1.forEach((l,i)=>{const p=P(t,t0+0.3+i*0.15,t0+0.8+i*0.15);text3D(l,tx,LV(260,280)+i*LV(95,90),LV(70,64),{alpha:clamp(p*3),rotY:lerp(-1,0,eOutExpo(p)),depth:10});});
  const yb=LV(260,280)+l1.length*LV(95,90);if(line2)T(line2,tx,yb+10,LV(40,40),{w:700,col:'rgba(255,240,230,0.85)',alpha:P(t,t0+0.9,t0+1.2)});
  const bp=eob(P(t,t0+1.2,t0+1.5));if(bp>0){ctx.save();ctx.translate(tx,yb+LV(120,130));ctx.scale(bp,bp);const bw=tw(btn,44,900)+120;rr(ctx,-bw/2,-48,bw,96,48);ctx.fillStyle=orangeFill(0,-48,0,96);ctx.shadowColor=C.ember;ctx.shadowBlur=50;ctx.fill();ctx.shadowBlur=0;T(btn,0,3,44,{w:900});ctx.restore();}
  pill(WA,tx,yb+LV(240,260),34,{w:800,alpha:P(t,t0+1.5,t0+1.8)});
  ctx.restore();
  if(t>=t1-2.6){const p=eOutExpo(P(t,t1-2.6,t1-2.0));const L=LV(250,300);ctx.save();ctx.globalAlpha=p;const cy=H/2-LV(80,120);
    ctx.save();ctx.shadowColor='rgba(196,50,31,0.8)';ctx.shadowBlur=60;rr(ctx,CX-L/2,cy-L/2-60,L,L,L*0.2);ctx.clip();ctx.drawImage(IM.logo,CX-L/2,cy-L/2-60,L,L);ctx.restore();
    T('نظام التعلم الجديد 2026',CX,cy+L/2+30,LV(56,56),{w:900,glow:20});T('ابدأ من مكانك.. واوصل للسوق',CX,cy+L/2+105,LV(40,40),{w:700,col:C.ember});
    pill(WA,CX,cy+L/2+195,32,{w:800});ctx.restore();}}

// ================= VIDEO TIMELINES =================
const BENEFITS=[{k:'clock',ar:'متابعة على مدار اليوم'},{k:'user',ar:'متابعة فردية'},{k:'team',ar:'فريق مدربين كامل'},{k:'spark',ar:'Maro AI'},{k:'community',ar:'مجتمع مدى الحياة'},{k:'cert',ar:'Adobe + White List'}];
const MODS=[{en:'Technical',ar:'تحكم وتنفيذ'},{en:'Academic',ar:'فهم بصري'},{en:'Marketing',ar:'تفكير الحملات'},{en:'AI',ar:'سرعة وتحكم'},{en:'Professional',ar:'وصول للسوق'}];
// ================= v2: gentle transitions + new beats (no prices) =================
// scattered tutorials snap into one clear path
function bScatter(t,t0,t1){background(t);const R=rng(33);const n=5;const snap=eInOut(P(t,t0+1.5,t0+2.5));
  const a1=1-P(t,t0+1.3,t0+1.6);text3D('فيديوهات متفرقة..',CX,LV(170,300),LV(96,78),{alpha:P(t,t0+0.1,t0+0.5)*a1,rotY:lerp(-1,0,eOutExpo(P(t,t0+0.1,t0+0.6))),depth:12});
  for(let i=0;i<n;i++){const sx=LV(260+R()*1400,160+R()*760),sy=LV(330+R()*560,520+R()*1000),sr=(R()-0.5)*0.9;
    const tx=LV(W-230-i*(1460/(n-1)),CX),ty=LV(560,420+i*(1140/(n-1)));const x=lerp(sx+Math.sin(t*1.3+i)*14*(1-snap),tx,snap),y=lerp(sy+Math.cos(t*1.1+i)*12*(1-snap),ty,snap);
    const ap=P(t,t0+0.1+i*0.06,t0+0.4+i*0.06);if(ap<=0)continue;ctx.save();ctx.globalAlpha=ap;ctx.translate(x,y);ctx.rotate(sr*(1-snap));
    if(snap<0.98)itile('video',0,0,LV(140,120),{alpha:1-snap});
    if(snap>0.02){ctx.globalAlpha=ap*snap;numCircle(String(i+1).padStart(2,'0'),0,0,LV(62,56),P(t,t0+2.4+i*0.08,t0+2.6+i*0.08));}ctx.restore();}
  if(snap>0){ctx.save();ctx.globalAlpha=snap;ctx.strokeStyle='rgba(255,123,32,0.55)';ctx.lineWidth=4;ctx.shadowColor=C.ember;ctx.shadowBlur=16;ctx.beginPath();
    if(!VERT){ctx.moveTo(W-230,560);ctx.lineTo(W-230-1460*eInOut(P(t,t0+2.3,t0+3.0)),560);}else{ctx.moveTo(CX,420);ctx.lineTo(CX,420+1140*eInOut(P(t,t0+2.3,t0+3.0)));}ctx.stroke();ctx.restore();}
  const s2='مسار واضح.. خطوة بخطوة';typeOn(s2,CX+tw(s2,LV(72,62))/2,LV(820,1690),LV(72,62),t0+2.2,t,{col:C.ember});}
// assessment: five bars, the low ones light up as gaps
function bGaps(t,t0,t1){background(t);T('نشوف شغلك.. ونحدد الفجوة',CX,LV(140,250),LV(60,58),{w:900,alpha:P(t,t0,t0+0.3),glow:20});
  const vals=[0.82,0.42,0.34,0.72,0.3];const bx=LV(760,110),bw=LV(1000,860),by=LV(290,420),gap=LV(118,150);
  vals.forEach((v,i)=>{const y=by+i*gap;const ti=t0+0.4+i*0.18;const a=P(t,ti,ti+0.3);if(a<=0)return;ctx.save();ctx.globalAlpha=a;
    T(MODS[i].en,bx+bw,y-30,LV(30,30),{w:900,align:'right'});T(MODS[i].ar,bx+bw-tw(MODS[i].en,LV(30,30),900)-20,y-30,LV(26,26),{w:700,align:'right',col:'rgba(255,190,140,0.9)'});
    rr(ctx,bx,y,bw,18,9);ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fill();const fw=bw*v*eOutExpo(P(t,ti+0.1,ti+0.9));
    const low=v<0.5;const flag=low?P(t,t0+2.0,t0+2.3):0;rr(ctx,bx+bw-fw,y,fw,18,9);const g=ctx.createLinearGradient(bx+bw-fw,0,bx+bw,0);g.addColorStop(0,low&&flag>0?'#FF4A2A':'#FFB347');g.addColorStop(1,C.red);ctx.fillStyle=g;ctx.shadowColor=C.ember;ctx.shadowBlur=14;ctx.fill();ctx.shadowBlur=0;
    if(flag>0){const pl=0.6+0.4*Math.sin(t*9);ctx.save();ctx.globalAlpha*=flag;rr(ctx,bx-6,y-8,bw*(1-v)+6,34,17);ctx.strokeStyle=`rgba(255,90,50,${pl})`;ctx.lineWidth=3;ctx.setLineDash([10,8]);ctx.stroke();ctx.setLineDash([]);
      pill('فجوة',bx+60,y-30,22,{w:900,fill:'rgba(255,74,42,0.9)',stroke:'#FFB070',sc:eob(P(t,t0+2.0+i*0.05,t0+2.3+i*0.05))});ctx.restore();}
    ctx.restore();});
  const s='ونبني فوق اللي إنت عارفه';T(s,LV(bx+bw/2,CX),LV(900,1230),LV(46,46),{w:800,col:C.ember,alpha:P(t,t0+2.8,t0+3.1),glow:14});
  maroAt('M5',LV(360,CX),LV(560,1560),LV(230,260),{expr:t<t0+2.0?'scan':'think',et:t-t0-2.0,t,alpha:P(t,t0+0.2,t0+0.5)});}
// scrolling pill rows
function bMarquee(t,t0,t1,{heading,sub,rows}){background(t);const r3=P(t,t0+0.1,t0+0.6);text3D(heading,CX,LV(200,330),LV(96,76),{alpha:clamp(r3*3),rotY:lerp(-1,0,eOutExpo(r3)),depth:12});
  if(sub)T(sub,CX,LV(300,440),LV(38,36),{w:700,col:'rgba(255,240,230,0.85)',alpha:P(t,t0+0.6,t0+0.9)});
  rows.forEach((items,ri)=>{const y=LV(470+ri*120,640+ri*130);const v=(ri%2?1:-1)*LV(160,120);const ws=items.map(s=>tw(s,36,800)+86+24);const tot=ws.reduce((a,b)=>a+b,0);let x0=((t-t0)*v)%tot;if(x0>0)x0-=tot;
    ctx.save();ctx.globalAlpha=P(t,t0+0.3+ri*0.1,t0+0.7+ri*0.1);for(let rep=0;rep<4;rep++){let x=x0+rep*tot;items.forEach((s,i)=>{const cx=x+ws[i]/2;if(cx>-400&&cx<W+400)pill(s,cx,y,36,{w:800,fill:(i+ri)%3===0?'rgba(196,50,31,0.85)':'rgba(196,50,31,0.14)'});x+=ws[i];});}ctx.restore();});
  maroAt('M5',CX,LV(H-150,H-330),LV(150,230),{expr:'happyB',t,alpha:P(t,t0+0.8,t0+1.1)});}

const MODS2=MODS;
const VIDEOS={
 beginner2:[
  [0,3.6,t=>bHook(t,0,3.6,[['كل مصمم محترف..'],['بدأ من هنا.',C.ember]],{eyebrow:'BEGINNER DIPLOMA'})],
  [3.6,8.0,t=>bScatter(t,3.6,8.0),'blur'],
  [8.0,11.6,t=>bTitle(t,8.0,11.6,{eyebrow:'BEGINNER DIPLOMA',title:['ابدأ صح','من أول خطوة'],titleSize:130,sub:'دبلومة المبتدئين',pose:'M2'}),'iris'],
  [11.6,18.4,t=>bSteps(t,11.6,18.4,{heading:'رحلتك خطوة بخطوة',items:[{ar:'إتقان البرامج',en:'PHOTOSHOP + ILLUSTRATOR',icon:'brush',d:'من الصفر لحد تصميم كامل'},{ar:'تأسيس أكاديمي',en:'ACADEMIC',icon:'palette',d:'قواعد وألوان ومنظور وتحليل'},{ar:'ذكاء صناعي للمصممين',en:'AI',icon:'spark',d:'توليد الصور وWorkflow صح'},{ar:'تأهيل لسوق العمل',en:'BEHANCE',icon:'case',d:'تفكير إبداعي وReference وBehance'},{ar:'مشروع التخرج',en:'GRADUATION',icon:'cert',d:'Brief ومراجعات لحد قطعة قوية'}]}),'push'],
  [18.4,22.0,t=>bHook(t,18.4,22.0,[['مش هتخرج حافظ أدوات..'],['هتفكر كمصمم.',C.ember]],{size:96,sizeV:72,maro:'fire'}),'blur'],
  [22.0,25.8,t=>bGifts(t,22.0,25.8,{heading:'وهدايا جوه الدبلومة',noValue:true,stamp:'هدية',cards:[{title:'Academic Essentials',items:['أسس وقواعد التصميم','نظريات الألوان','المنظور','تحليل التصميم']},{title:'AI Essentials',items:['توليد الصور','اختيار الأداة المناسبة','Workflow عملي','دمج النتائج في التصميم']}]}),'wipe'],
  [25.8,29.4,t=>bBenefits(t,25.8,29.4,{heading:'مش هنسيبك تتفرج وتختفي',items:BENEFITS}),'zoom'],
  [29.4,32.6,t=>bAIPro(t,29.4,32.6,{months:18}),'iris'],
  [32.6,38.4,t=>bCTA(t,32.6,38.4,{line1:'ابدأ رحلة التصميم معانا',line2:'اسأل مسؤول المتابعة عن أقرب موعد وطريقة الحجز',btn:'احجز مكانك'}),'blur']],
 mastery2:[
  [0,3.6,t=>bHook(t,0,3.6,[['شغلك كويس..'],['بس حاسس إنه واقف؟',C.ember]],{eyebrow:'GRAPHIC DESIGN MASTERY'})],
  [3.6,7.6,t=>bTitle(t,3.6,7.6,{eyebrow:'GRAPHIC DESIGN MASTERY',title:['دلوقتي','وقت النقلة'],titleSize:140,sub:'مش هنعيدك من الصفر',pose:'M4'}),'blur'],
  [7.6,12.8,t=>bGaps(t,7.6,12.8),'push'],
  [12.8,18.4,t=>bOrbit(t,12.8,18.4,{heading:'خمس زوايا تصنع مصمم أقوى',items:MODS,badge:'GRADUATION PROJECT',badgeSub:'فرصة للتأهل للنشر عالميًا'}),'iris'],
  [18.4,22.4,t=>bEquation(t,18.4,22.4,{a:'تفكير تسويقي أقوى',b:'أدوات AI بوعي',res:'مصمم أسرع.. وبروحه',resSub:'مش شغل شبه أي حد'}),'wipe'],
  [22.4,26.4,t=>bMarquee(t,22.4,26.4,{heading:'ومستواك يظهر صح',sub:'من شغل كويس.. لفرص حقيقية',rows:[['Portfolio','Behance','Personal Branding','CV'],['عرض وشرح شغلك','الوصول للعملاء','البيع والتفاوض']]}),'blur'],
  [26.4,29.8,t=>bBenefits(t,26.4,29.8,{heading:'من أول يوم.. إنت جوه منظومة',items:BENEFITS}),'zoom'],
  [29.8,33.0,t=>bAIPro(t,29.8,33.0,{months:18}),'iris'],
  [33.0,38.8,t=>bCTA(t,33.0,38.8,{line1:'ابدأ بتقييم مستواك',line2:'ونحددلك المسار اللي يكمل الناقص فعلًا',btn:'احجز تقييمك'}),'blur']]
};
const TL=VIDEOS[VID];const DUR=TL[TL.length-1][1];
// ---------- gentle transition system ----------
const TD=0.9;   // transition length, centred on the cut
const LA=document.createElement('canvas'),LB=document.createElement('canvas');for(const c of[LA,LB]){c.width=W;c.height=H;}
function cam(c,t){c.translate(W/2,H/2);c.rotate(Math.sin(t*0.35)*0.005);const z=1.02+Math.sin(t*0.25)*0.01;c.scale(z,z);c.translate(-W/2+Math.sin(t*0.4)*8,-H/2+Math.cos(t*0.33)*5);}
function drawInto(layer,fn,t){const lc=layer.getContext('2d');lc.setTransform(1,0,0,1,0,0);lc.globalAlpha=1;lc.globalCompositeOperation='source-over';lc.filter='none';lc.clearRect(0,0,W,H);
  const saved=ctx;ctx=lc;cam(lc,t);fn(t);ctx=saved;}
function composite(kind,p,S){const c=ctx;c.save();c.setTransform(1,0,0,1,0,0);c.fillStyle=C.bg;c.fillRect(0,0,W,H);
  const put=(L,{a=1,s=1,dx=0,blur=0})=>{c.save();c.globalAlpha=a;if(blur>0.3)c.filter=`blur(${blur}px)`;c.translate(W/2+dx,H/2);c.scale(s,s);c.drawImage(L,-W/2,-H/2);c.restore();};
  if(kind==='blur'){put(LA,{a:1-p,s:1+p*0.06,blur:p*16});put(LB,{a:p,s:0.95+p*0.05,blur:(1-p)*16});}
  else if(kind==='zoom'){put(LA,{a:1-p,s:1+p*0.22,blur:p*8});put(LB,{a:p,s:0.86+p*0.14});}
  else if(kind==='push'){const d=W*0.38;put(LA,{a:1-p*0.9,dx:-p*d,s:1-p*0.04});put(LB,{a:0.15+p*0.85,dx:(1-p)*d,s:0.96+p*0.04});}
  else if(kind==='iris'){put(LA,{a:1,s:1+p*0.05});const r=eInOut(p)*Math.hypot(W,H)*0.6;c.save();c.beginPath();c.arc(S.x,S.y,Math.max(1,r),0,6.283);c.clip();put(LB,{});c.restore();
    if(p>0&&p<1){c.save();c.strokeStyle=`rgba(255,150,70,${0.9*(1-p)})`;c.lineWidth=6;c.shadowColor=C.ember;c.shadowBlur=40;c.beginPath();c.arc(S.x,S.y,Math.max(1,r),0,6.283);c.stroke();c.restore();}}
  else if(kind==='wipe'){put(LA,{a:1});const g=LB.getContext('2d');g.save();g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='destination-in';const x=lerp(W*1.3,-W*0.3,eInOut(p));const gr=g.createLinearGradient(x+300,0,x-300,H*0.25);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,1)');g.fillStyle=gr;g.fillRect(0,0,W,H);g.restore();put(LB,{});}
  c.restore();}
function scene(t){const i=Math.max(0,TL.findIndex(s=>t>=s[0]&&t<s[1]));const cur=TL[i<0?TL.length-1:i];
  // are we inside a transition window?
  let tr=null;for(let k=1;k<TL.length;k++){const tb=TL[k][0];if(t>=tb-TD/2&&t<tb+TD/2){tr=k;break;}}
  if(tr){const A=TL[tr-1],B=TL[tr];const p=eInOut(P(t,B[0]-TD/2,B[0]+TD/2));drawInto(LA,A[2],t);drawInto(LB,B[2],t);composite(B[3]||'blur',p,{x:W/2,y:VERT?H*0.45:H/2});}
  else{ctx.save();ctx.setTransform(1,0,0,1,0,0);cam(ctx,t);cur[2](t);ctx.restore();}
  ctx.save();ctx.setTransform(1,0,0,1,0,0);if(t<0.8)tearOverlay(t);const fo=P(t,DUR-0.3,DUR);if(fo>0){ctx.fillStyle=`rgba(0,0,0,${fo})`;ctx.fillRect(0,0,W,H);}ctx.restore();}
function nSub(t){for(const s of TL){if(s[0]>0&&Math.abs(t-s[0])<TD/2)return 3;}return t<0.8?5:2;}
window.DURATION=DUR;

// ================= render hooks =================
const grains=[];{const R=rng(7);for(let k=0;k<6;k++){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');const d=g.createImageData(256,256);for(let i=0;i<d.data.length;i+=4){const v=R()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255;}g.putImageData(d,0,0);grains.push(c);}}
function post(f){const v=out.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3,W/2,H/2,Math.max(W,H)*0.62);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,0.55)');out.fillStyle=v;out.fillRect(0,0,W,H);
  out.save();out.globalAlpha=0.06;out.globalCompositeOperation='overlay';out.translate((f*37)%256,(f*91)%256);out.fillStyle=out.createPattern(grains[f%6],'repeat');out.fillRect(-256,-256,W+512,H+512);out.restore();}
window.renderFrame=function(f){const t0=f/FPS,N=nSub(t0),shutter=0.5/FPS;out.fillStyle='#000';out.fillRect(0,0,W,H);
  for(let k=0;k<N;k++){const t=Math.max(0,t0+(N>1?(k/(N-1)-0.5)*shutter:0));ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';
    ctx.translate(W/2,H/2);ctx.rotate(Math.sin(t*0.35)*0.005);const z=1.02+Math.sin(t*0.25)*0.01;ctx.scale(z,z);ctx.translate(-W/2+Math.sin(t*0.4)*8,-H/2+Math.cos(t*0.33)*5);
    scene(t);out.globalAlpha=1/(k+1);out.drawImage(sub,0,0);}
  out.globalAlpha=1;post(f);};
const IM={};
window.ready=(async()=>{
  await Promise.all([600,700,800,900].flatMap(w=>[document.fonts.load(`${w} 40px Cairo`,'مارو'),document.fonts.load(`${w} 40px Cairo`,'AI')]));
  for(const[k,n]of Object.entries(POSE)){IMG[k]=await load(n+'.png');VM[k]=await load(n+'_vmask.png');const v=VIS[n];const c=document.createElement('canvas');c.width=v.x1-v.x0+1;c.height=v.y1-v.y0+1;FACE[k]=c;}
  LOGO=await load('logo_white.png');IM.logo=await load('logo.png');
  WATER=document.createElement('canvas');WATER.width=WATER.height=2048;const w=WATER.getContext('2d');w.filter='blur(10px)';w.drawImage(IMG.M5,0,0);w.filter='none';w.globalCompositeOperation='source-in';w.fillStyle='#4a0d07';w.fillRect(0,0,2048,2048);
  return true;})();
