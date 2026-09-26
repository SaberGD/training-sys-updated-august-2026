
// ================= MARO motion engine =================
const W=1920,H=1080,FPS=60;
const Q=new URLSearchParams(location.search);const MODE=Q.get('mode')||'test';
const cv=document.getElementById('c');cv.width=W;cv.height=H;const out=cv.getContext('2d');
const sub=document.createElement('canvas');sub.width=W;sub.height=H;let ctx=sub.getContext('2d');
const C={bg:'#120403',bg2:'#2C0203',red:'#C4321F',ember:'#FF7B20',hi:'#FD9905',eye:'#FFB347',white:'#FFF7F2'};
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)),lerp=(a,b,t)=>a+(b-a)*t,P=(t,a,b)=>clamp((t-a)/(b-a));
const eOutExpo=x=>x>=1?1:1-Math.pow(2,-10*x),eInExpo=x=>x<=0?0:Math.pow(2,10*x-10);
const eOutBack=x=>{const c1=1.7,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)};
const eInOut=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2,eIn=x=>x*x*x,eOut=x=>1-Math.pow(1-x,3);
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const isAr=s=>/[؀-ۿ]/.test(s);
function setFont(c,s,size,w,ls){c.font=`${w} ${size}px Cairo`;c.direction=isAr(s)?'rtl':'ltr';c.letterSpacing=isAr(s)?'0px':(ls||0)+'px';}
function tw(s,size,w=900,ls=0){ctx.save();setFont(ctx,s,size,w,ls);const m=ctx.measureText(s).width;ctx.restore();return m;}
function T(s,x,y,size,o={}){const{w=900,col=C.white,align='center',alpha=1,ls=0,glow=0,glowCol=C.ember}=o;if(alpha<=0)return;
  ctx.save();ctx.globalAlpha*=alpha;setFont(ctx,s,size,w,ls);ctx.textAlign=align;ctx.textBaseline='middle';if(glow){ctx.shadowColor=glowCol;ctx.shadowBlur=glow;}ctx.fillStyle=col;ctx.fillText(s,x,y);ctx.restore();}
function hex2rgb(h){const n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255]}
function mix(a,b,t){const A=hex2rgb(a),B=hex2rgb(b);return`rgb(${A.map((v,i)=>Math.round(lerp(v,B[i],t))).join(',')})`}
function glowBlob(x,y,r,col,a=1){if(a<=0)return;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');ctx.save();ctx.globalAlpha*=a;ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);ctx.restore();}
function rr(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}

// ================= assets =================
const POSE={M1:'M1_maro_standing_front',M2:'M2_maro_waving',M3:'M3_maro_thinking',M4:'M4_maro_presenting',M5:'M5_maro_head_closeup'};
const IMG={},VM={},FACE={};let LOGO,WATER;
const load=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=src;});

// ================= MARO visor expressions =================
// drawn in visor-local pixels of the 2048 sprite; u = visor width
function eyes(f,u,h,fn){const ey=h*0.52;for(const sgn of[-1,1])fn(sgn,u*0.5+sgn*u*0.2,ey);}
function glowPen(f,u){f.strokeStyle=C.eye;f.fillStyle=C.eye;f.lineCap='round';f.lineJoin='round';f.shadowColor=C.ember;f.shadowBlur=u*0.05;f.lineWidth=u*0.052;}
function flame(f,x,y,s,t,ph){const fl=1+0.09*Math.sin(t*22+ph)+0.05*Math.sin(t*37+ph*2);
  f.save();f.translate(x,y+s*0.35);f.scale(s,s*fl);
  const g=f.createLinearGradient(0,0.4,0,-1.1);g.addColorStop(0,'#FFE39A');g.addColorStop(0.45,'#FF9A2E');g.addColorStop(1,'#E0400F');
  f.fillStyle=g;f.beginPath();f.moveTo(0,0.45);f.bezierCurveTo(-0.62,0.42,-0.7,-0.2,-0.28,-0.62);f.bezierCurveTo(-0.3,-0.3,-0.1,-0.22,-0.08,-0.28);
  f.bezierCurveTo(-0.2,-0.7,0.05,-1.0,0.2,-1.12);f.bezierCurveTo(0.12,-0.72,0.66,-0.5,0.62,0.02);f.bezierCurveTo(0.6,0.35,0.35,0.46,0,0.45);f.fill();
  f.fillStyle='rgba(30,4,2,0.85)';f.shadowBlur=0;f.beginPath();f.moveTo(0,0.4);f.bezierCurveTo(-0.3,0.38,-0.32,0.05,-0.12,-0.12);f.bezierCurveTo(-0.08,0.05,0.1,0.02,0.12,-0.1);f.bezierCurveTo(0.3,0.08,0.28,0.38,0,0.4);f.fill();f.restore();}
function heart(f,x,y,s){f.save();f.translate(x,y);f.scale(s,s);f.beginPath();f.moveTo(0,0.35);f.bezierCurveTo(-0.9,-0.2,-0.45,-0.95,0,-0.42);f.bezierCurveTo(0.45,-0.95,0.9,-0.2,0,0.35);f.fill();f.restore();}
function drawExpr(f,expr,et,t,u,h){
  f.save();glowPen(f,u);
  const arcEye=(x,y,sc=1)=>{f.beginPath();f.arc(x,y+u*0.035,u*0.085*sc,Math.PI*1.1,Math.PI*1.9);f.stroke();};
  const lineEye=(x,y,tilt=0)=>{f.beginPath();f.moveTo(x-u*0.075,y+tilt);f.lineTo(x+u*0.075,y-tilt);f.stroke();};
  const pop=Math.max(0.001,eOutBack(clamp(et/0.22)));
  switch(expr){
    case'happy':case'happyB':{let blink=false;if(expr==='happyB'){const c=(t%2.6);blink=c>2.45;}
      eyes(f,u,h,(s,x,y)=>blink?lineEye(x,y+u*0.02):arcEye(x,y,pop));break;}
    case'blink':eyes(f,u,h,(s,x,y)=>lineEye(x,y+u*0.02));break;
    case'wink':eyes(f,u,h,(s,x,y)=>s<0?arcEye(x,y):(f.save(),f.lineWidth=u*0.05,f.beginPath(),f.moveTo(x-u*0.08,y-u*0.03),f.lineTo(x+u*0.02,y+u*0.02),f.lineTo(x-u*0.08,y+u*0.07),f.stroke(),f.restore()));break;
    case'wow':eyes(f,u,h,(s,x,y)=>{f.beginPath();f.arc(x,y,u*0.075*pop,0,6.283);f.stroke();});break;
    case'think':{eyes(f,u,h,(s,x,y)=>{f.beginPath();f.arc(x+u*0.03,y-u*0.01,u*0.07,Math.PI*1.15,Math.PI*1.85);f.stroke();});
      for(let i=0;i<3;i++){const b=Math.max(0,Math.sin(t*7-i*0.9));f.beginPath();f.arc(u*0.5+(i-1)*u*0.09,h*0.52+u*0.2-b*u*0.04,u*0.028,0,6.283);f.fill();}break;}
    case'fire':eyes(f,u,h,(s,x,y)=>flame(f,x,y,u*0.16*pop,t,s));break;
    case'check':{const p=eOut(clamp(et/0.35));const pts=[[-0.16,0.0],[-0.05,0.12],[0.18,-0.13]];f.lineWidth=u*0.065;f.beginPath();
      const L1=Math.hypot(0.11,0.12),L2=Math.hypot(0.23,0.25),tot=L1+L2,d=p*tot;const cx=u*0.5,cy=h*0.52;
      f.moveTo(cx+pts[0][0]*u,cy+pts[0][1]*u);if(d<=L1){const k=d/L1;f.lineTo(cx+lerp(pts[0][0],pts[1][0],k)*u,cy+lerp(pts[0][1],pts[1][1],k)*u);}
      else{f.lineTo(cx+pts[1][0]*u,cy+pts[1][1]*u);const k=(d-L1)/L2;f.lineTo(cx+lerp(pts[1][0],pts[2][0],k)*u,cy+lerp(pts[1][1],pts[2][1],k)*u);}f.stroke();break;}
    case'love':eyes(f,u,h,(s,x,y)=>heart(f,x,y,u*0.12*pop*(1+0.08*Math.sin(t*9))));break;
    case'scan':{eyes(f,u,h,(s,x,y)=>lineEye(x,y));const sy=h*(0.5+0.38*Math.sin(t*4));const g=f.createLinearGradient(0,sy-u*0.05,0,sy+u*0.05);
      g.addColorStop(0,'rgba(255,122,32,0)');g.addColorStop(0.5,'rgba(255,170,80,0.55)');g.addColorStop(1,'rgba(255,122,32,0)');f.shadowBlur=0;f.fillStyle=g;f.fillRect(0,sy-u*0.05,u,u*0.1);break;}
    case'boot':{const g=MODE==='sheet'?0.05:(0.25+0.75*Math.max(0,Math.sin(t*9))**8);drawBootLogo(f,u,h,t,g);break;}
    case'collapse':{const k=1-eIn(clamp(et/0.16));f.save();f.translate(u*0.5,h*0.5);f.scale(1+0.3*(1-k),Math.max(0.02,k));f.translate(-u*0.5,-h*0.5);drawBootLogo(f,u,h,t,0.3);f.restore();
      if(k<0.2){f.fillStyle='#FFE0B0';f.shadowBlur=u*0.06;f.fillRect(u*0.15,h*0.5-u*0.006,u*0.7,u*0.012);}break;}
    case'power':{const r=rng(Math.floor(t*30)*7+3);if(r()>0.35){f.globalAlpha=0.25+r()*0.5;f.fillStyle='rgba(255,140,60,0.35)';f.shadowBlur=0;for(let y=0;y<h;y+=u*0.018)f.fillRect(0,y,u,u*0.006);}break;}
  }
  f.restore();
}
function drawBootLogo(f,u,h,t,g){
  const lw=u*0.5,lh=lw;const x=u*0.5-lw/2,y=h*0.5-lh/2;const r=rng(Math.floor(t*24)*13+1);
  f.save();f.shadowColor=C.ember;f.shadowBlur=u*0.03;
  const N=14;for(let i=0;i<N;i++){const sy=i/N,off=(r()-0.5)*g*u*0.12*(r()>0.5?1:0.2);
    f.drawImage(LOGO,0,sy*LOGO.height,LOGO.width,LOGO.height/N,x+off,y+sy*lh,lw,lh/N+1);}
  if(g>0.3){f.globalCompositeOperation='lighter';f.globalAlpha=g*0.5;f.filter='sepia(1) saturate(8) hue-rotate(-30deg)';f.drawImage(LOGO,x-g*u*0.02,y,lw,lh);f.filter='sepia(1) saturate(6) hue-rotate(150deg)';f.drawImage(LOGO,x+g*u*0.02,y,lw,lh);f.filter='none';}
  f.restore();
  f.save();f.globalAlpha=0.18;f.fillStyle='#000';for(let yy=0;yy<h;yy+=u*0.012)f.fillRect(0,yy,u,u*0.005);f.restore();
}

// draw MARO: anchor = sprite centre; s = scale of the 2048 sprite
function drawMaro(pose,x,y,s,o={}){
  const{rot=0,expr='happyB',et=9,t=0,alpha=1,thrust=0,flip=false}=o;const n=POSE[pose],v=VIS[n],img=IMG[pose];
  ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.rotate(rot);ctx.scale(flip?-s:s,s);
  if(thrust>0){ctx.save();ctx.globalCompositeOperation='lighter';
    for(const[fx,fy]of v.feet){const L=(170+60*Math.sin(t*31+fx))*thrust;const g=ctx.createLinearGradient(0,fy-1024,0,fy-1024+L);
      g.addColorStop(0,'rgba(255,240,200,0.95)');g.addColorStop(0.25,'rgba(255,150,50,0.8)');g.addColorStop(1,'rgba(200,40,10,0)');ctx.fillStyle=g;
      ctx.beginPath();ctx.ellipse(fx-1024,fy-1024+L*0.45,60*thrust,L*0.55,0,0,6.283);ctx.fill();
      const gg=ctx.createRadialGradient(fx-1024,fy-1024,0,fx-1024,fy-1024,220*thrust);gg.addColorStop(0,'rgba(255,160,60,0.6)');gg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gg;ctx.fillRect(fx-1024-230,fy-1024-230,460,460);}
    ctx.restore();}
  ctx.drawImage(img,-1024,-1024);
  if(expr&&expr!=='off'){const fc=FACE[pose],f=fc.getContext('2d');const u=fc.width,h=fc.height;
    f.setTransform(1,0,0,1,0,0);f.globalCompositeOperation='source-over';f.clearRect(0,0,u,h);
    drawExpr(f,expr,et,t,u,h);f.globalCompositeOperation='destination-in';f.drawImage(VM[pose],0,0);f.globalCompositeOperation='source-over';
    ctx.globalCompositeOperation='lighter';ctx.drawImage(fc,v.x0-1024,v.y0-1024);ctx.globalCompositeOperation='source-over';}
  ctx.restore();
}

// ================= design system pieces =================
function background(t,{glow=1,grid=0}={}){
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);
  glowBlob(W*0.02+Math.sin(t*0.5)*60,H*1.0+Math.cos(t*0.4)*40,1000,'rgba(196,50,31,0.55)',glow);
  glowBlob(W*1.0+Math.cos(t*0.45)*60,-40+Math.sin(t*0.6)*40,900,'rgba(255,123,32,0.28)',glow);
  glowBlob(W*0.5,H*0.5,900,'rgba(60,8,4,0.6)',glow);
}
function watermark(x,y,h,alpha){if(alpha<=0)return;ctx.save();ctx.globalAlpha=alpha;const s=h/2048;ctx.drawImage(WATER,x-1024*s,y-1024*s,2048*s,2048*s);ctx.restore();}
function text3D(s,x,y,size,o={}){const{rotY=0,depth=16,alpha=1,front=C.white,sA=C.ember,sB='#4a0c05',w=900,sc=1}=o;if(alpha<=0)return;
  ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.transform(Math.cos(rotY)*sc,Math.sin(rotY)*0.22*sc,0,sc,0,0);
  setFont(ctx,s,size,w,0);ctx.textAlign='center';ctx.textBaseline='middle';const dx=0.35+Math.sin(rotY)*1.4;
  for(let i=depth;i>0;i--){ctx.fillStyle=mix(sB,sA,Math.pow(1-i/depth,1.6));ctx.fillText(s,i*dx,i*0.9);}
  ctx.shadowColor='rgba(255,123,32,0.55)';ctx.shadowBlur=30;ctx.fillStyle=front;ctx.fillText(s,0,0);ctx.shadowBlur=0;
  ctx.restore();}
// RTL type-on with twin cursor bars (reference style); xr = right edge
function typeOn(s,xr,y,size,t0,t,o={}){const{col=C.ember,w=900,dur=0.55,glow=24}=o;const wf=tw(s,size,w);
  const p=eOutExpo(P(t,t0+0.2,t0+0.2+dur));const lead=xr-wf*p;
  if(p>0){ctx.save();ctx.beginPath();ctx.rect(lead-6,y-size,xr-lead+12,size*2);ctx.clip();T(s,xr,y,size,{w,col,align:'right',glow});ctx.restore();}
  const barA=t<t0?0:(p<1?1:1-P(t,t0+0.2+dur,t0+0.45+dur));if(barA>0&&(Math.floor(t*14)%2===0||p>0)){ctx.save();ctx.globalAlpha=barA;ctx.fillStyle=col;ctx.shadowColor=col;ctx.shadowBlur=18;
    ctx.fillRect(lead-16,y-size*0.45,6,size*0.9);ctx.fillRect(lead-30,y-size*0.45,6,size*0.9);ctx.restore();}}
function icon(k,s){ctx.save();ctx.strokeStyle=C.ember;ctx.fillStyle=C.ember;ctx.lineWidth=s*0.085;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor=C.ember;ctx.shadowBlur=s*0.2;const b=ctx;
  switch(k){
  case'bulb':b.beginPath();b.arc(0,-s*0.12,s*0.26,Math.PI*0.8,Math.PI*2.2);b.lineTo(s*0.11,s*0.22);b.lineTo(-s*0.11,s*0.22);b.closePath();b.stroke();b.beginPath();b.moveTo(-s*0.1,s*0.33);b.lineTo(s*0.1,s*0.33);b.stroke();
    for(const[a,l]of[[-0.9,0.12],[-0.5,0.1]]){b.beginPath();b.moveTo(s*0.36,-s*0.4);b.lineTo(s*0.36,-s*0.4);b.stroke();}b.beginPath();b.moveTo(s*0.38,-s*0.42);b.lineTo(s*0.38,-s*0.3);b.moveTo(s*0.32,-s*0.36);b.lineTo(s*0.44,-s*0.36);b.stroke();break;
  case'brush':b.beginPath();b.moveTo(s*0.32,-s*0.34);b.lineTo(-s*0.02,s*0.02);b.stroke();b.beginPath();b.ellipse(-s*0.12,s*0.14,s*0.12,s*0.09,-0.8,0,6.283);b.fill();break;
  case'gear':b.beginPath();for(let i=0;i<16;i++){const a=i/16*6.283,r=i%2?s*0.3:s*0.38;b.lineTo(Math.cos(a)*r,Math.sin(a)*r);}b.closePath();b.stroke();b.beginPath();b.arc(0,0,s*0.12,0,6.283);b.stroke();break;
  case'question':b.beginPath();b.arc(0,0,s*0.36,0,6.283);b.stroke();b.beginPath();b.arc(0,-s*0.07,s*0.12,Math.PI,Math.PI*2.35);b.lineTo(0,s*0.1);b.stroke();b.beginPath();b.arc(0,s*0.2,s*0.02,0,6.283);b.fill();break;
  case'wand':b.beginPath();b.moveTo(-s*0.32,s*0.32);b.lineTo(s*0.14,-s*0.14);b.stroke();for(const[x,y,r]of[[0.28,-0.3,0.1],[0.34,0.06,0.06],[-0.02,-0.36,0.06]]){b.beginPath();b.moveTo(s*x,s*(y-r));b.lineTo(s*x,s*(y+r));b.moveTo(s*(x-r),s*y);b.lineTo(s*(x+r),s*y);b.stroke();}break;
  case'doc':b.beginPath();b.moveTo(-s*0.24,-s*0.36);b.lineTo(s*0.1,-s*0.36);b.lineTo(s*0.26,-s*0.2);b.lineTo(s*0.26,s*0.36);b.lineTo(-s*0.24,s*0.36);b.closePath();b.stroke();b.beginPath();b.moveTo(-s*0.1,s*0.04);b.lineTo(s*0.12,s*0.04);b.moveTo(-s*0.1,s*0.18);b.lineTo(s*0.12,s*0.18);b.stroke();break;
  case'book':b.beginPath();b.moveTo(0,-s*0.22);b.quadraticCurveTo(-s*0.2,-s*0.32,-s*0.38,-s*0.24);b.lineTo(-s*0.38,s*0.26);b.quadraticCurveTo(-s*0.2,s*0.18,0,s*0.28);b.quadraticCurveTo(s*0.2,s*0.18,s*0.38,s*0.26);b.lineTo(s*0.38,-s*0.24);b.quadraticCurveTo(s*0.2,-s*0.32,0,-s*0.22);b.lineTo(0,s*0.28);b.stroke();break;
  case'coach':b.beginPath();b.moveTo(-s*0.22,s*0.38);b.lineTo(-s*0.22,s*0.14);b.bezierCurveTo(-s*0.42,-s*0.02,-s*0.34,-s*0.4,s*0.0,-s*0.4);b.bezierCurveTo(s*0.3,-s*0.4,s*0.38,-s*0.14,s*0.3,s*0.0);b.lineTo(s*0.38,s*0.12);b.lineTo(s*0.28,s*0.14);b.lineTo(s*0.26,s*0.38);b.stroke();
    b.beginPath();for(let i=0;i<12;i++){const a=i/12*6.283,r=i%2?s*0.08:s*0.12;b.lineTo(-s*0.02+Math.cos(a)*r,-s*0.13+Math.sin(a)*r);}b.closePath();b.stroke();break;}
  ctx.restore();}
function tile(k,x,y,sz,o={}){const{alpha=1,bright=0,rot=0}=o;if(alpha<=0)return;ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.rotate(rot);
  rr(ctx,-sz/2,-sz/2,sz,sz,sz*0.24);const g=ctx.createLinearGradient(0,-sz/2,0,sz/2);g.addColorStop(0,'#2a0906');g.addColorStop(1,'#0c0202');ctx.fillStyle=g;ctx.shadowColor='rgba(255,123,32,0.6)';ctx.shadowBlur=30+bright*80;ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(196,50,31,0.9)';ctx.lineWidth=2.5;ctx.stroke();
  ctx.save();rr(ctx,-sz/2,-sz/2,sz,sz,sz*0.24);ctx.clip();const hl=ctx.createLinearGradient(-sz/2,-sz/2,sz/2,sz/2);hl.addColorStop(0,'rgba(255,255,255,0.10)');hl.addColorStop(0.5,'rgba(255,255,255,0)');ctx.fillStyle=hl;ctx.fillRect(-sz/2,-sz/2,sz,sz);ctx.restore();
  icon(k,sz*0.52);
  if(bright>0){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=bright;rr(ctx,-sz/2,-sz/2,sz,sz,sz*0.24);ctx.fillStyle='#FFD9B0';ctx.fill();}
  ctx.restore();}
function rays(x,y,a,rot){if(a<=0)return;ctx.save();ctx.globalCompositeOperation='lighter';ctx.translate(x,y);ctx.rotate(rot);for(let i=0;i<20;i++){ctx.rotate(6.283/20);const g=ctx.createLinearGradient(0,0,1300,0);g.addColorStop(0,`rgba(255,170,90,${0.22*a})`);g.addColorStop(1,'rgba(255,120,40,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(1300,-70-(i%3)*30);ctx.lineTo(1300,70+(i%3)*30);ctx.fill();}ctx.restore();}

