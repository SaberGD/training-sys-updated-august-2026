// ================= MARO AI — product film (54s, 16:9 + native 9:16 via ?v) =================
// Structure inspired by Google Flow's agent launch, dressed in the MARO app's own design language:
// near-black stage with a red glow from below, orange uppercase kickers over heavy Arabic headings, dark cards with an orange edge,
// red selected states, the app's real input bar. Text and UI live in separate zones so nothing overlaps.
const DUR=54;const LV=(h,v)=>VERT?v:h;const eob=x=>Math.max(0,eOutBack(x));
const A={bg:'#0B0908',card:'#141213',card2:'#1A1A1C',line:'rgba(255,255,255,0.10)',txt:'#F6F2EF',sub:'#C4BCB8',acc:'#EB8365',acc2:'#F2785A',edge:'#B44136',red:'#C0281A',red2:'#9E1D10',field:'#191C21',btn:'#121214'};
const K={txt:A.txt};
const IM={},RC={},BL={},GR={};
function maroAt(pose,x,y,vw,o={}){const v=VIS[POSE[pose]];const s=vw/(v.x1-v.x0);drawMaro(pose,x-(v.cx-1024)*s,y-(v.cy-1024)*s,s,o);}
function stage(t,k=1,glow=1){ctx.fillStyle=A.bg;ctx.fillRect(0,0,W,H);
  glowBlob(W*0.5+Math.sin(t*0.3)*40,H*1.1,LV(1150,1250),'rgba(160,26,12,0.62)',glow);glowBlob(W*0.08,-H*0.06,LV(760,760),'rgba(130,34,12,0.26)',glow);glowBlob(W*0.95,H*0.25,LV(620,620),'rgba(95,20,8,0.2)',glow);
  if(k<1){ctx.fillStyle=`rgba(0,0,0,${1-k})`;ctx.fillRect(0,0,W,H);}}
// text zone: H = right column, V = top band. kicker (orange caps) + short bar + heavy Arabic heading
function fitSize(lines,size,maxW){let s=size;for(const l of lines){const m=tw(l,s,900);if(m>maxW)s=s*maxW/m;}return s;}
function block(kicker,lines,t0,t1,t,o={}){const x=o.x??LV(1790,540),align=o.align??LV('right','center'),maxW=o.maxW??LV(660,960);
  const size=fitSize(lines,o.size??LV(90,84),maxW);const lh=size*1.25;const tot=76+lines.length*lh;const y0=(o.cy??LV(H/2,330))-tot/2;
  const a=eOut(P(t,t0,t0+0.6)),b=t1?eIn(P(t,t1,t1+0.4)):0;const v=a*(1-b);if(v<=0.001)return;
  ctx.save();ctx.globalAlpha=v;T(kicker,x,y0+14,LV(24,28),{w:700,col:A.acc,align,ls:4});const bw=70*eOut(P(t,t0+0.1,t0+0.7));ctx.fillStyle=A.acc2;
  ctx.fillRect(align==='right'?x-bw:align==='center'?x-bw/2:x,y0+42,bw,4);ctx.restore();
  lines.forEach((s,i)=>{const a2=eOut(P(t,t0+0.15+i*0.1,t0+0.85+i*0.1));const v2=a2*(1-b);if(v2<=0.001)return;ctx.save();ctx.globalAlpha=v2;const bl=(1-a2)*10+b*8;if(bl>0.3)ctx.filter=`blur(${bl}px)`;
    T(s,x,y0+76+lh*0.5+i*lh+(1-a2)*22,size,{w:900,col:o.col?.[i]??A.txt,align});ctx.restore();});}
const UIX=LV(-370,0),UIY=LV(0,300);   // centre of the UI zone (3D offsets from screen centre)
// ---------- 3D ----------
const FOC=LV(1600,1700);
function proj(x,y,z){const s=FOC/Math.max(1,FOC+z);return[W/2+x*s,H/2+y*s];}
function xf(o,lx,ly){const{x=0,y=0,z=0,rx=0,ry=0,rz=0}=o;let X=lx*Math.cos(rz)-ly*Math.sin(rz),Y=lx*Math.sin(rz)+ly*Math.cos(rz),Z=0;
  let Y2=Y*Math.cos(rx)-Z*Math.sin(rx),Z2=Y*Math.sin(rx)+Z*Math.cos(rx);let X3=X*Math.cos(ry)+Z2*Math.sin(ry),Z3=-X*Math.sin(ry)+Z2*Math.cos(ry);return proj(X3+x,Y2+y,Z3+z);}
function tri(src,s0,s1,s2,d0,d1,d2){const cx=(d0[0]+d1[0]+d2[0])/3,cy=(d0[1]+d1[1]+d2[1])/3,g=p=>[p[0]+(p[0]-cx)*0.012,p[1]+(p[1]-cy)*0.012];const D0=g(d0),D1=g(d1),D2=g(d2);
  ctx.save();ctx.beginPath();ctx.moveTo(...D0);ctx.lineTo(...D1);ctx.lineTo(...D2);ctx.closePath();ctx.clip();
  const den=(s1[0]-s0[0])*(s2[1]-s0[1])-(s2[0]-s0[0])*(s1[1]-s0[1]);const a=((d1[0]-d0[0])*(s2[1]-s0[1])-(d2[0]-d0[0])*(s1[1]-s0[1]))/den,c=((d2[0]-d0[0])*(s1[0]-s0[0])-(d1[0]-d0[0])*(s2[0]-s0[0]))/den;
  const b=((d1[1]-d0[1])*(s2[1]-s0[1])-(d2[1]-d0[1])*(s1[1]-s0[1]))/den,d=((d2[1]-d0[1])*(s1[0]-s0[0])-(d1[1]-d0[1])*(s2[0]-s0[0]))/den;
  ctx.transform(a,b,c,d,d0[0]-a*s0[0]-c*s0[1],d0[1]-b*s0[0]-d*s0[1]);ctx.drawImage(src,0,0);ctx.restore();}
// draw a canvas/image as a plane of size w x h centred at (x,y,z) with rotations; flat planes skip subdivision
function plane(src,o){const{w,h,alpha=1,N=6,shadow=0}=o;if(alpha<=0.003||!src)return;const flat=!o.rx&&!o.ry&&!o.rz;
  ctx.save();ctx.globalAlpha*=alpha;
  if(flat){const p0=xf(o,-w/2,-h/2),p1=xf(o,w/2,h/2);if(shadow){ctx.save();ctx.shadowColor='rgba(0,0,0,0.6)';ctx.shadowBlur=shadow;ctx.shadowOffsetY=shadow*0.3;ctx.drawImage(src,p0[0],p0[1],p1[0]-p0[0],p1[1]-p0[1]);ctx.restore();}else ctx.drawImage(src,p0[0],p0[1],p1[0]-p0[0],p1[1]-p0[1]);ctx.restore();return;}
  const n=N,sw=src.width/n,sh=src.height/n;const P_=[];for(let i=0;i<=n;i++){P_[i]=[];for(let j=0;j<=n;j++)P_[i][j]=xf(o,(i/n-0.5)*w,(j/n-0.5)*h);}
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const s00=[i*sw,j*sh],s10=[(i+1)*sw,j*sh],s01=[i*sw,(j+1)*sh],s11=[(i+1)*sw,(j+1)*sh];tri(src,s00,s10,s01,P_[i][j],P_[i+1][j],P_[i][j+1]);tri(src,s10,s11,s01,P_[i+1][j],P_[i+1][j+1],P_[i][j+1]);}
  ctx.restore();}
// image plane with depth-of-field (cross-fades the pre-blurred copy)
function photo(k,o){const d=clamp(o.dof||0);if(d<1)plane(RC[k],{...o,alpha:(o.alpha??1)*(1-d*0.999)});if(d>0)plane(BL[k],{...o,alpha:(o.alpha??1)*d});}
function PT(g,s,x,y,size,o={}){const{w=600,col=K.txt,align='right',alpha=1}=o;if(!s||alpha<=0)return;g.save();g.globalAlpha*=alpha;setFont(g,s,size,w,0);g.textAlign=align;g.textBaseline='middle';g.fillStyle=col;g.fillText(s,x,y);g.restore();}
function pw(g,s,size,w=600){g.save();setFont(g,s,size,w,0);const m=g.measureText(s).width;g.restore();return m;}
function wrapG(g,s,size,maxW,w=600){const words=s.split(' ');const L=[];let cur='';for(const wd of words){const tr=cur?cur+' '+wd:wd;if(pw(g,tr,size,w)>maxW&&cur){L.push(cur);cur=wd;}else cur=tr;}if(cur)L.push(cur);return L;}
const typed=(s,t,a,b)=>s.slice(0,Math.round(s.length*P(t,a,b)));const blink=t=>Math.floor(t*2.2)%2===0;
function rrG(g,x,y,w,h,r){g.beginPath();g.roundRect(x,y,w,h,r);}
// macOS-style pointer
function cursor(x,y,t,clicks=[]){let s=1;for(const c of clicks){const d=t-c;if(d>-0.08&&d<0.2)s=Math.min(s,1-0.18*Math.sin(clamp((d+0.08)/0.28)*Math.PI));}
  ctx.save();ctx.translate(x,y);ctx.scale(s*LV(1.25,1.4),s*LV(1.25,1.4));ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,34);ctx.lineTo(8,26);ctx.lineTo(14,39);ctx.lineTo(20,36);ctx.lineTo(14,24);ctx.lineTo(25,24);ctx.closePath();
  ctx.fillStyle='#fff';ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#000';ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();ctx.restore();}
// cursor path through keyframes [t,x,y]
function cpath(t,kf){if(t<=kf[0][0])return kf[0].slice(1);for(let i=0;i<kf.length-1;i++){const a=kf[i],b=kf[i+1];if(t<=b[0]){const p=eInOut(P(t,a[0],b[0]));return[lerp(a[1],b[1],p),lerp(a[2],b[2],p)];}}return kf[kf.length-1].slice(1);}

// ---------- app UI kit (offscreen canvases, placed in 3D) ----------
const pool={};function ocv(name,w,h){let c=pool[name];if(!c||c.width!==w||c.height!==h){c=document.createElement('canvas');c.width=w;c.height=h;pool[name]=c;}const g=c.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,w,h);return[c,g];}
function box(g,x,y,w,h,r,fill,stroke,lw=2){rrG(g,x,y,w,h,r);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=lw;g.stroke();}}
function ico(g,k,x,y,s,col=A.acc2){g.save();g.strokeStyle=col;g.fillStyle=col;g.lineWidth=s*0.085;g.lineCap='round';g.lineJoin='round';g.translate(x,y);
  if(k==='bulb'){g.beginPath();g.arc(0,-s*0.1,s*0.28,Math.PI*0.8,Math.PI*2.2);g.lineTo(s*0.12,s*0.24);g.lineTo(-s*0.12,s*0.24);g.closePath();g.stroke();g.beginPath();g.moveTo(-s*0.1,s*0.36);g.lineTo(s*0.1,s*0.36);g.stroke();}
  else if(k==='doc'){g.strokeRect(-s*0.24,-s*0.32,s*0.48,s*0.64);for(const yy of[-0.12,0.02,0.16]){g.beginPath();g.moveTo(-s*0.12,yy*s);g.lineTo(s*0.12,yy*s);g.stroke();}}
  else if(k==='wand'){g.beginPath();g.moveTo(-s*0.3,s*0.3);g.lineTo(s*0.12,-s*0.12);g.stroke();for(const[a,b,r]of[[0.22,-0.26,0.1],[-0.05,-0.32,0.06],[0.3,0.02,0.06]]){g.beginPath();g.moveTo(a*s-r*s,b*s);g.lineTo(a*s+r*s,b*s);g.moveTo(a*s,b*s-r*s);g.lineTo(a*s,b*s+r*s);g.stroke();}}
  else if(k==='brush'){g.beginPath();g.moveTo(s*0.3,-s*0.3);g.lineTo(-s*0.05,s*0.05);g.stroke();g.beginPath();g.moveTo(-s*0.05,s*0.05);g.quadraticCurveTo(-s*0.35,s*0.05,-s*0.3,s*0.32);g.quadraticCurveTo(-s*0.05,s*0.3,-s*0.05,s*0.05);g.fill();}
  else if(k==='plus'){g.beginPath();g.moveTo(-s*0.28,0);g.lineTo(s*0.28,0);g.moveTo(0,-s*0.28);g.lineTo(0,s*0.28);g.stroke();}
  else if(k==='mic'){rrG(g,-s*0.12,-s*0.32,s*0.24,s*0.42,s*0.12);g.stroke();g.beginPath();g.arc(0,-s*0.02,s*0.24,0.2,Math.PI-0.2);g.stroke();g.beginPath();g.moveTo(0,s*0.22);g.lineTo(0,s*0.34);g.stroke();}
  else if(k==='send'){g.beginPath();g.moveTo(s*0.3,-s*0.26);g.lineTo(-s*0.32,0);g.lineTo(s*0.3,s*0.26);g.lineTo(s*0.16,0);g.closePath();g.stroke();}
  g.restore();}
// home-screen mission card (RTL): icon box on the right, orange edge, red when selected
function missionCard(g,x,y,w,h,title,sub,icon,on=0){box(g,x,y,w,h,20,on>0.5?A.red:A.card,on>0.5?'rgba(255,170,140,0.55)':A.line);
  if(on>0&&on<=0.5){g.save();g.globalAlpha=on*2;box(g,x,y,w,h,20,A.red,null);g.restore();}
  g.fillStyle=on>0.5?'#E9573F':A.edge;g.fillRect(x+w-5,y+14,4,h-28);const bs=h*0.52;box(g,x+w-26-bs,y+(h-bs)/2,bs,bs,14,on>0.5?'rgba(0,0,0,0.18)':'#2a0f09','rgba(242,120,90,0.55)');ico(g,icon,x+w-26-bs/2,y+h/2,bs*0.78,on>0.5?'#FFD2C0':A.acc2);
  PT(g,title,x+w-46-bs,y+h*0.38,h*0.25,{w:700});PT(g,sub,x+w-46-bs,y+h*0.68,h*0.17,{col:on>0.5?'#FFE3D8':A.sub});
  g.save();g.strokeStyle=on>0.5?'rgba(255,255,255,0.8)':'#8a8280';g.lineWidth=3;g.lineCap='round';const ax=x+34,ay=y+h/2;g.beginPath();g.moveTo(ax+18,ay);g.lineTo(ax-6,ay);g.moveTo(ax+4,ay-10);g.lineTo(ax-6,ay);g.lineTo(ax+4,ay+10);g.stroke();g.restore();}
// the app's bottom input bar: [send][ field (mic) ][+][bulb]; tokens = strings or {chip}
function inputBar(name,w,tokens,t,o={}){const hb=o.hb??104,size=o.size??34,g0=14;const fx=hb+g0,fw=w-3*hb-3*g0;const tmp=ocv('_m',10,10)[1];
  // measure wrapped height
  const lines=[[]];let lw=0;const maxW=fw-hb-40;for(const tk of tokens){if(typeof tk==='string'){for(const wd of tk.split(/(\s+)/)){if(!wd)continue;const ww=pw(tmp,wd,size);if(lw+ww>maxW&&wd.trim()){lines.push([]);lw=0;}lines[lines.length-1].push(wd);lw+=ww;}}else{const cw=pw(tmp,tk.chip,size*0.9,700)+40;if(lw+cw>maxW){lines.push([]);lw=0;}lines[lines.length-1].push(tk);lw+=cw+10;}}
  const lh=size*1.45,hh=Math.max(hb,lines.length*lh+40);const[c,g]=ocv(name,w,hh);
  box(g,fx,0,fw,hh,20,A.field,'rgba(255,255,255,0.10)');box(g,fx+14,hh-hb+14,hb-28,hb-28,14,'#101216','rgba(255,255,255,0.08)');ico(g,'mic',fx+hb/2,hh-hb/2,hb*0.5,'#E6E3E1');
  const on=o.sendOn??0;box(g,0,hh-hb,hb,hb,20,on?A.red:'#4a1a0e',on?'rgba(255,170,140,0.7)':'rgba(255,255,255,0.06)');ico(g,'send',hb/2,hh-hb/2,hb*0.5,on?'#fff':'#c9a79d');
  box(g,w-2*hb-g0,hh-hb,hb,hb,20,A.btn,'rgba(255,255,255,0.10)');ico(g,'plus',w-1.5*hb-g0,hh-hb/2,hb*0.5,'#F2EEEC');box(g,w-hb,hh-hb,hb,hb,20,A.btn,'rgba(255,255,255,0.10)');ico(g,'bulb',w-hb/2,hh-hb/2,hb*0.5,'#F4A340');
  const empty=!tokens.some(tk=>typeof tk!=='string'||tk.length);let x=fx+fw-26,y=hh/2-(lines.length-1)*lh/2;
  if(empty)PT(g,'اكتب رسالتك إلى MARO AI...',x,hh/2,size*0.85,{col:'#7A7680'});
  lines.forEach((ln,li)=>{x=fx+fw-26;const yy=y+li*lh;for(const tk of ln){if(typeof tk==='string'){PT(g,tk,x,yy,size);x-=pw(g,tk,size);}else{const cw=pw(g,tk.chip,size*0.9,700)+40;const p=eob(tk.p??1);g.save();g.translate(x-cw/2,yy);g.scale(p,p);box(g,-cw/2,-size*0.72,cw,size*1.44,size*0.5,'rgba(235,131,101,0.18)',A.acc);PT(g,tk.chip,0,2,size*0.9,{w:700,align:'center',col:'#FFC2AE'});g.restore();x-=cw+10;}}
    if(li===lines.length-1&&(o.caret??true)&&!empty&&blink(t)){g.fillStyle=A.acc2;g.fillRect(x-6,yy-size*0.55,3,size*1.1);}});
  if(empty&&(o.caret??true)&&blink(t)){g.fillStyle=A.acc2;g.fillRect(fx+fw-22,hh/2-size*0.55,3,size*1.1);}
  return c;}
// chat surface: header, red user bubble, MARO card
function maroCard(g,x,y,w,h){box(g,x,y,w,h,24,A.card2,'rgba(255,255,255,0.12)');PT(g,'MARO AI',x+w-48,y+38,20,{w:700,col:A.acc});g.fillStyle=A.acc2;g.beginPath();g.arc(x+w-28,y+38,5,0,6.283);g.fill();}
function userBubble(g,xr,y,s,size){const bw=pw(g,s,size)+60,bh=size*2.2;const gr=g.createLinearGradient(0,y,0,y+bh);gr.addColorStop(0,'#C9321F');gr.addColorStop(1,'#A2210F');box(g,xr-bw,y,bw,bh,22,gr,'rgba(255,160,130,0.55)');PT(g,s,xr-30,y+bh/2+1,size,{col:'#fff'});return bh;}
function chatHeader(g,w,title){box(g,0,0,w,96,0,'#0F0D0D',null);PT(g,title,w-40,48,30,{w:700});g.fillStyle=A.acc2;g.fillRect(0,94,w,2);
  const gr=g.createLinearGradient(0,0,w,0);gr.addColorStop(0,'rgba(235,131,101,0)');gr.addColorStop(1,'rgba(235,131,101,0.9)');g.fillStyle=gr;g.fillRect(0,94,w,2);
  g.save();g.beginPath();g.arc(56,48,30,0,6.283);g.fillStyle='#1a0a08';g.fill();g.strokeStyle=A.acc2;g.lineWidth=2;g.stroke();g.beginPath();g.arc(56,50,22,0,6.283);g.fillStyle=A.red;g.fill();box(g,40,38,32,22,10,'#050505',null);g.strokeStyle='#FFB347';g.lineWidth=3;g.lineCap='round';for(const ex of[49,63]){g.beginPath();g.arc(ex,51,4,Math.PI*1.1,Math.PI*1.9);g.stroke();}g.restore();}
// ================= scenes =================
const COL=['V2a','V4','V1','V5','S1n','V3','V6','V2b','V7','V1','V2a','V5'];
function sCollage(t){stage(t);const cz=lerp(0,2400,P(t,0,4.9)*0.7+eIn(P(t,0,4.9))*0.3);const R=rng(5);
  const items=COL.map((k,i)=>{let x=(R()-0.5)*LV(2800,1500),y=(R()-0.5)*LV(1500,2700);if(Math.abs(x)<LV(760,560)&&Math.abs(y)<LV(360,520)){x=Math.sign(x||1)*LV(760+R()*300,560+R()*200);}return{k,x,y,z:500+i*400+R()*200,s:0.8+R()*0.45};});
  items.sort((a,b)=>b.z-a.z);for(const it of items){const z=it.z-cz;if(z<-FOC*0.8)continue;const im=IM[it.k];const w=LV(600,540)*it.s,h=w*im.height/im.width;const fa=clamp((z+FOC*0.8)/400)*P(t,0,0.8);
    photo(it.k,{x:it.x,y:it.y,z,w,h,dof:clamp(Math.abs(z-800)/1500),alpha:fa});}
  const sc=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,LV(820,700));sc.addColorStop(0,'rgba(11,9,8,0.92)');sc.addColorStop(0.6,'rgba(11,9,8,0.7)');sc.addColorStop(1,'rgba(11,9,8,0)');ctx.fillStyle=sc;ctx.fillRect(0,0,W,H);
  block('AI-POWERED CREATIVE WORKSPACE',['طوّر فكرتك..','وطلّع أحسن شغل عندك'],0.4,4.4,t,{x:W/2,align:'center',cy:H/2,maxW:LV(1100,960),size:LV(100,88)});}
function sPhones(t){stage(t);const t0=4.9,p=eOut(P(t,t0,t0+1.5)),q=eIn(P(t,7.8,8.3));
  for(const[k,i]of[['home',-1],['prompt',1],['ask',0]]){const c=PH[k];const hh=LV(i?700:820,i?860:1000);const ww=hh*c.width/c.height;
    plane(c,{x:UIX+i*LV(290,330),y:UIY+(i?40:0),z:lerp(700,0,p)+(i?160:0)+q*300,w:ww,h:hh,ry:lerp(0.7,-i*0.22,p),rx:lerp(0.25,0.04,p),alpha:P(t,t0,t0+0.5)*(1-q)});}
  block('SG-MARO AI',['دلوقتي مع','مارو AI'],t0+0.5,7.8,t,{col:[A.txt,A.acc2]});}
const TOOLS=[['عصف ذهني','اتجاهات وأفكار جديدة','bulb'],['Generate Brief','بريف إعلاني قابل للتنفيذ','doc'],['Image To Prompt','حوّل الصورة لبرومبت','wand'],['قيّملي تصميمي','مراجعة وتطوير التصميم','brush']];
function sAsk(t){stage(t);const t0=8.3,out=10.95;const w=LV(960,960);const cw=(w-20)/2,chh=132;const[c,g]=ocv('tools',w,chh*2+20);
  const sel=eOut(P(t,9.2,9.35));TOOLS.forEach(([ti,su,ic],i)=>{const col=1-(i%2),row=Math.floor(i/2);const pp=eob(P(t,t0+0.1+i*0.08,t0+0.5+i*0.08));g.save();g.globalAlpha=clamp(pp);const cx=col*(cw+20)+cw/2,cy=row*(chh+20)+chh/2;g.translate(cx,cy);g.scale(0.9+0.1*pp,0.9+0.1*pp);g.translate(-cx,-cy);missionCard(g,col*(cw+20),row*(chh+20),cw,chh,ti,su,ic,i===0?sel:0);g.restore();});
  const ox={x:UIX,y:UIY-LV(150,190),z:lerp(300,0,eOut(P(t,t0,t0+0.9))),w,h:c.height,ry:LV(0.05,0),alpha:P(t,t0,t0+0.4)*(1-P(t,out,out+0.25))};plane(c,ox);
  const q='ساعدني أطلّع أفكار لكامبين Vezeeta';const bar=inputBar('bar1',w,[typed(q,t,9.45,10.6)],t,{sendOn:t>10.6?1:0});
  const ob={x:UIX,y:UIY+LV(210,230),z:lerp(300,0,eOut(P(t,t0+0.2,t0+1.1))),w,h:bar.height,ry:LV(0.05,0),alpha:P(t,t0+0.2,t0+0.6)*(1-P(t,out,out+0.25))};plane(bar,ob);
  const cp0=xf(ox,w/2-cw/2,-c.height/2+chh/2),sp=xf(ob,-w/2+52,bar.height/2-52);
  const cp=cpath(t,[[8.6,W*0.62,H*0.96],[9.1,cp0[0]+30,cp0[1]+10],[9.5,cp0[0]+30,cp0[1]+10],[10.5,sp[0]+8,sp[1]+8],[11,sp[0]+8,sp[1]+8]]);if(t>8.6&&t<11.1)cursor(cp[0],cp[1],t,[9.2,10.75]);
  block('SELECT A MISSION',['اختار مهمتك..','واكتب اللي في دماغك'],t0+0.3,out-0.1,t);}
const IDEAS=[['عيلتك تستاهل','العيلة كلها حوالين الموبايل، والدكتور بيطلع لهم هولوجرام من الشاشة ويطمنهم.'],['دكتورك في جيبك','عيادة كاملة بتظهر فوق الموبايل.. كشف وحجز من غير ما تنزل من البيت.'],['الطمأنينة أقرب','كل تخصص في كارت مضيء: أسنان، عظام، قلب.. سلسلة بنفس الهوية.']];
function sChat(t){const a=11.0;stage(t);const w=LV(960,960),h=LV(900,1120);const[c,g]=ocv('chat',w,h);box(g,0,0,w,h,28,'#0C0B0B','rgba(255,255,255,0.10)');
  g.save();rrG(g,0,0,w,h,28);g.clip();chatHeader(g,w,'كامبين Vezeeta');g.restore();
  const bp=eob(P(t,a+0.3,a+0.6));if(bp>0){g.save();g.translate(w-30,150);g.scale(bp,bp);g.translate(-(w-30),-150);userBubble(g,w-30,120,'ساعدني أطلّع أفكار لكامبين Vezeeta',28);g.restore();}
  const cy0=230,s0=a+1.2;const think=P(t,a+0.6,a+0.8)*(1-P(t,s0,s0+0.1));
  if(think>0){g.save();g.globalAlpha=think;maroCard(g,30,cy0,300,110);for(let i=0;i<3;i++){const b=Math.max(0,Math.sin(t*9-i*0.9));g.globalAlpha=think*(0.45+0.55*b);g.fillStyle=A.acc2;g.beginPath();g.arc(250-i*30,cy0+75-b*5,7,0,6.283);g.fill();}g.restore();}
  if(t>=s0){const lines=[];const iw=w-150;wrapG(g,'من قلب البيت المصري، دي 3 أفكار تربط العيلة بالدكتور:',27,iw).forEach(l=>lines.push([l,27,600,A.txt,0]));lines.push(['',12]);
    IDEAS.forEach(([ti,de],i)=>{lines.push([ti,30,700,'#FFB199',1+i]);wrapG(g,de,25,iw).forEach(l=>lines.push([l,25,600,A.sub,0]));lines.push(['',16]);});
    let hgt=80;for(const[s,sz]of lines)hgt+=s?sz*1.7:sz;const ch=Math.min(h-cy0-30,hgt);maroCard(g,30,cy0,w-90,ch);
    let shown=Math.floor((t-s0)/0.075),y=cy0+76;const hl=eOut(P(t,15.3,15.55));
    for(const[s,sz,wt,col,id]of lines){if(shown--<=0)break;if(!s){y+=sz;continue;}y+=sz*0.85;if(id===1&&hl>0){const tw_=pw(g,s,sz,wt);box(g,w-90-tw_*hl-14,y-sz*0.8,tw_*hl+18,sz*1.6,8,'rgba(235,131,101,0.28)',null);}PT(g,s,w-90,y,sz,{w:wt,col});y+=sz*0.85;}}
  const o={x:UIX,y:UIY,z:lerp(300,0,eOut(P(t,a,a+1))),w,h,ry:LV(0.05,0),alpha:P(t,a,a+0.5)*(1-P(t,16.5,16.85))};plane(c,o);
  const tp=xf(o,w/2-90,-h/2+cy0+76+27*1.7*2+12+15);const cp=cpath(t,[[14.4,W*0.5,H*0.97],[15.1,tp[0]+10,tp[1]],[15.3,tp[0]+10,tp[1]],[15.75,tp[0]-LV(190,190),tp[1]],[16.6,tp[0]-LV(190,190),tp[1]]]);if(t>14.4&&t<16.6)cursor(cp[0],cp[1],t,[15.3]);
  block('MARO / AI ASSISTANT',['مساعدك الذكي..','وشريكك في الإبداع'],a+0.4,16.45,t);}
function sIdea(t){stage(t);block('FROM IDEA',['من الفكرة...'],16.85,18.4,t,{x:W/2,align:'center',cy:H/2,size:LV(150,130),maxW:LV(1400,960)});}
const PROMPTS=[['واقعي سينمائي','Cinematic shot of an Egyptian family gathered around a phone, a tiny doctor appears on screen, warm light'],['هولوجرام ثلاثي الأبعاد','A glowing 3D hologram clinic rising from a smartphone on the carpet, family watching in awe'],['إعلان مضيء','Doctors appear as soft light silhouettes behind a proud family, blue studio glow']];
function sExec(t){const a=18.5,send=20.55;stage(t);const w=LV(960,960);
  const bar=inputBar('bar2',w,[typed('اكتبلي برومبت للفكرة الأولى',t,18.9,20.0)],t,{sendOn:t>20.0?1:0,caret:t<send});const dn=eInOut(P(t,send+0.15,send+0.8));
  const ob={x:UIX,y:UIY+lerp(0,LV(350,430),dn),z:lerp(300,0,eOut(P(t,a,a+0.9))),w,h:bar.height,ry:LV(0.05,0),alpha:P(t,a,a+0.4)*(1-P(t,24.2,24.45))};plane(bar,ob);
  const ap=eOut(P(t,send+0.25,send+1.0));const ph=LV(560,700);const[c,g]=ocv('alts',w,ph);maroCard(g,0,0,w,ph);PT(g,'دي 3 برومبتات للفكرة، اختار اللي يعجبك:',w-40,90,29,{w:700});
  const pick=eOut(P(t,23.35,23.5));PROMPTS.forEach(([ti,en],i)=>{const y=170+i*LV(128,170);const op=P(t,send+0.7+i*0.25,send+1.1+i*0.25);g.save();g.globalAlpha=op;
    if(i===1&&pick>0)box(g,20,y-44,w-40,LV(118,160),16,`rgba(192,40,26,${0.22*pick})`,`rgba(242,120,90,${0.8*pick})`);
    g.beginPath();g.arc(w-62,y,15,0,6.283);g.strokeStyle=i===1&&pick>0?A.acc2:'#bdb5b1';g.lineWidth=3;g.stroke();if(i===1&&pick>0){g.beginPath();g.arc(w-62,y,8*pick,0,6.283);g.fillStyle=A.acc2;g.fill();}
    PT(g,ti,w-96,y,29,{w:700});wrapG(g,en,22,w-150).slice(0,LV(1,2)).forEach((l,j)=>PT(g,l,w-96,y+40+j*30,22,{col:A.sub}));g.restore();});
  const oa={x:UIX,y:UIY-LV(120,160),z:lerp(400,0,ap),w,h:ph,ry:LV(0.05,0),alpha:ap*(1-P(t,24.2,24.45))};plane(c,oa);
  const sp=xf(ob,-w/2+52,bar.height/2-52),rp=xf(oa,w/2-62,-ph/2+170+LV(128,170));
  const cp=cpath(t,[[19.2,W*0.5,H*0.97],[20.3,sp[0]+8,sp[1]+8],[21.4,sp[0]+8,sp[1]+8],[23.2,rp[0]+6,rp[1]+6],[24.3,rp[0]+6,rp[1]+6]]);if(t>19.2&&t<24.3)cursor(cp[0],cp[1],t,[send,23.35]);
  block('TO EXECUTION',['...للتنفيذ'],a+0.2,24.2,t,{size:LV(130,120)});}
const ASSETS=[['V1','العيلة'],['V4','الدكاترة'],['V2a','الموبايل'],['V5','العيادة']];
function sMention(t){const a=24.5;stage(t);const w=LV(960,960);const ch1=P(t,26.2,26.45),ch2=P(t,27.2,27.45);
  const tk=[typed('ضيف ',t,24.8,25.0)];if(t>=25.0&&t<26.2)tk.push('@');if(t>=26.2){tk.push({chip:'العيلة',p:ch1});tk.push(typed(' مع ',t,26.5,26.7)+(t>=26.7&&t<27.2?'@':''));}if(t>=27.2){tk.push({chip:'الدكاترة',p:ch2});tk.push(typed(' في مشهد واحد مضيء',t,27.5,28.3));}
  const bar=inputBar('bar3',w,tk,t,{sendOn:t>28.3?1:0});const ob={x:UIX,y:UIY+lerp(0,LV(300,380),eInOut(P(t,24.85,25.25))),z:lerp(300,0,eOut(P(t,a,a+0.9))),w,h:bar.height,ry:LV(0.05,0),alpha:P(t,a,a+0.4)*(1-P(t,28.55,28.8))};plane(bar,ob);
  const open1=t>=25.05&&t<26.3,open2=t>=26.72&&t<27.3;const pop=open1?eOut(P(t,25.05,25.3)):open2?eOut(P(t,26.72,26.95)):0;const hv=open1?0:1;
  const pw_=LV(620,700),ph=4*104+36;if(pop>0){const[c,g]=ocv('pick',pw_,ph);box(g,0,0,pw_,ph,24,A.card2,'rgba(255,255,255,0.12)');
    ASSETS.forEach(([k,n],i)=>{const y=18+i*104;if(i===hv)box(g,12,y,pw_-24,96,16,'rgba(192,40,26,0.35)','rgba(242,120,90,0.7)');g.save();rrG(g,pw_-40-80,y+10,80,76,14);g.clip();const im=IM[k];const s=Math.max(80/im.width,76/im.height);g.drawImage(im,pw_-80-im.width*s/2,y+48-im.height*s/2,im.width*s,im.height*s);g.restore();PT(g,n,pw_-140,y+48,30,{w:700});PT(g,'@'+n,40,y+48,22,{align:'left',col:A.sub});});
    const op={x:UIX+w/2-pw_/2,y:UIY-LV(80,90),z:0,w:pw_,h:ph,ry:LV(0.05,0),alpha:pop};plane(c,op);const tp=xf(op,pw_/2-150,-ph/2+18+hv*104+48);
    const cp=cpath(t,[[open1?25.1:26.75,tp[0]+160,tp[1]+120],[open1?25.95:26.98,tp[0],tp[1]],[28,tp[0],tp[1]]]);cursor(cp[0],cp[1],t,[26.2,27.2]);}
  block('ADD YOUR ASSETS',['ضيف عناصرك','بـ @ في ثانية'],a+0.2,28.5,t);}
const GEN=['V2a','V3','V4','V1','V5','V6','V7','V2b','S1n'];
function sGen(t){const a=28.8;stage(t);const W2=LV(980,960),H2=LV(900,1120);const[c,g]=ocv('grid',W2,H2);box(g,0,0,W2,H2,28,'#0C0B0B','rgba(255,255,255,0.10)');g.save();rrG(g,0,0,W2,H2,28);g.clip();chatHeader(g,W2,'كامبين Vezeeta · ٩ مشاهد');g.restore();
  PT(g,t<31.2?'مارو بيولّد...':'خلصت ✓',120,48,24,{align:'left',col:A.acc});
  const gx=24,gy=120,gw=W2-48,gh=H2-gy-24,cols=3,rows=3,gap=14,tw_=(gw-gap*2)/3,th_=(gh-gap*2)/3;
  GEN.forEach((k,i)=>{const cI=cols-1-(i%cols),r=Math.floor(i/cols);const x=gx+cI*(tw_+gap),y=gy+r*(th_+gap);const p=P(t,29.6+i*0.28,30.2+i*0.28);g.save();rrG(g,x,y,tw_,th_,16);g.clip();
    g.fillStyle='#1A1A1C';g.fillRect(x,y,tw_,th_);const sx=x+((t*0.6+i*0.13)%1.4-0.2)*tw_;const sg=g.createLinearGradient(sx-tw_*0.4,0,sx+tw_*0.4,0);sg.addColorStop(0,'rgba(192,40,26,0)');sg.addColorStop(0.5,'rgba(192,40,26,0.35)');sg.addColorStop(1,'rgba(192,40,26,0)');g.fillStyle=sg;g.fillRect(x,y,tw_,th_);
    if(p>0){g.globalAlpha=eOut(p);const bi=p<0.7?BL[k]:RC[k];const s2=Math.max(tw_/bi.width,th_/bi.height);g.drawImage(bi,x+(tw_-bi.width*s2)/2,y+(th_-bi.height*s2)/2,bi.width*s2,bi.height*s2);g.globalAlpha=1;}g.restore();
    if(p<1)PT(g,Math.round(Math.min(99,20+75*P(t,28.9,29.6+i*0.28)))+'٪',x+tw_-16,y+24,22,{w:700,col:A.acc,alpha:1-p});});
  plane(c,{x:UIX,y:UIY,z:lerp(400,0,eOut(P(t,a,a+1.2)))-P(t,31.5,34.5)*120,w:W2,h:H2,ry:LV(lerp(0.2,0.05,eOut(P(t,a,a+1.2))),0),rx:lerp(0.12,0,eOut(P(t,a,a+1.2))),alpha:P(t,a,a+0.5)*(1-P(t,34.2,34.5))});
  block('GENERATE',['صور وبرومبتات وبريفات..','كلها في مكان واحد'],a+0.4,34.2,t,{col:[A.txt,A.acc2]});}
function sHero(t){const a=34.5;stage(t);const p=eInOut(P(t,a,a+1.8));const im=IM.V2a;const w=lerp(LV(900,760),LV(1700,1000),p),h=w*im.height/im.width;
  photo('V2a',{x:0,y:0,z:0,w,h,ry:lerp(0.4,0,p),rx:lerp(0.1,0,p),alpha:P(t,a,a+0.4)*(1-P(t,36.4,36.8))});
  const q=P(t,36.3,38.6);['V4','V5','V6','V7','V2b'].forEach((k,i)=>{const x=(i-2)*LV(720,700)+lerp(LV(1300,1000),-LV(1300,1000),eInOut(q));const im2=IM[k];const hh=LV(700,900),ww=hh*im2.width/im2.height;
    photo(k,{x,y:0,z:Math.abs(x)*0.25,w:ww,h:hh,ry:-x/LV(2600,2000),dof:clamp((Math.abs(x)-350)/1500),alpha:P(t,36.3,36.6)*(1-P(t,38.4,38.7))});});}
function sCoach(t){const a=38.7;stage(t);const w=LV(960,960);const[c,g]=ocv('seg',w,120);box(g,0,0,w,120,26,A.card,'rgba(255,255,255,0.10)');const sw_=(w-36)/2;const sel=eInOut(P(t,40.9,41.15));
  const sx_=lerp(w-18-sw_,18,sel);box(g,sx_,16,sw_,88,20,A.red,'rgba(255,170,140,0.55)');PT(g,'حلّل تصميم وتعلّم منه',w-18-sw_/2,62,30,{w:700,align:'center',col:sel<0.5?'#fff':A.sub});PT(g,'قيّملي تصميمي',18+sw_/2,62,30,{w:700,align:'center',col:sel>0.5?'#fff':A.sub});
  const os={x:UIX,y:UIY-LV(360,440),z:lerp(300,0,eOut(P(t,a+0.3,a+1.1))),w,h:120,ry:LV(0.05,0),alpha:P(t,a+0.3,a+0.7)*(1-P(t,43.1,43.4))};plane(c,os);
  const im=IM.V4;const ph=LV(560,700),pwd=ph*im.width/im.height;plane(RC.V4,{x:UIX+LV(210,190),y:UIY+LV(90,110),z:lerp(300,0,eOut(P(t,a+0.5,a+1.3))),w:pwd,h:ph,ry:LV(0.05,0),alpha:P(t,a+0.5,a+0.9)*(1-P(t,43.1,43.4)),shadow:40});
  const[c2,g2]=ocv('score',LV(380,380),LV(460,520));const sc=P(t,41.3,41.6);maroCard(g2,0,0,c2.width,c2.height);const val=lerp(6,9,eOut(P(t,41.5,42.4)));const R=110,cx=c2.width/2,cy=c2.height/2+10;
  g2.lineWidth=16;g2.strokeStyle='#2a1a16';g2.beginPath();g2.arc(cx,cy,R,0,6.283);g2.stroke();if(sc>0){g2.strokeStyle=val>8?A.acc2:'#E0452A';g2.lineCap='round';g2.shadowColor=A.acc2;g2.shadowBlur=16;g2.beginPath();g2.arc(cx,cy,R,-Math.PI/2,-Math.PI/2+6.283*val/10*sc);g2.stroke();g2.shadowBlur=0;}
  PT(g2,sc>0?String(Math.round(val)):'–',cx,cy-6,86,{w:900,align:'center'});PT(g2,'/ 10',cx,cy+56,26,{align:'center',col:A.sub});PT(g2,'تقييم المدرب مارو',cx,c2.height-44,24,{w:700,align:'center',col:A.acc});
  plane(c2,{x:UIX-LV(270,260),y:UIY+LV(90,110),z:lerp(300,0,eOut(P(t,a+0.7,a+1.5))),w:c2.width,h:c2.height,ry:LV(0.05,0),alpha:P(t,a+0.7,a+1.1)*(1-P(t,43.1,43.4))});
  const bp=xf(os,-w/2+18+sw_/2,0);const cp=cpath(t,[[40.0,W*0.5,H*0.97],[40.75,bp[0]+10,bp[1]+8],[43.1,bp[0]+10,bp[1]+8]]);if(t>40.0&&t<43.2)cursor(cp[0],cp[1],t,[40.9]);
  block('MARO COACH',['خُد رأي مدرّب','في كل تصميم'],a+0.2,43.1,t);}
function sControl(t){const a=43.4;stage(t);const W2=LV(960,960),H2=LV(560,760);const[c,g]=ocv('bw',W2,H2);const ks=['V2a','V3','V1','V5','V6','V7'];const cols=3,gap=14;const tw_=(W2-gap*2)/3,th_=(H2-gap)/2;
  ks.forEach((k,i)=>{const x=(i%cols)*(tw_+gap),y=Math.floor(i/cols)*(th_+gap);const p=P(t,45.3+i*0.12,45.9+i*0.12);g.save();rrG(g,x,y,tw_,th_,16);g.clip();const src=p<0.5?RC[k]:GR[k];const s=Math.max(tw_/src.width,th_/src.height);
    g.drawImage(src,x+(tw_-src.width*s)/2,y+(th_-src.height*s)/2,src.width*s,src.height*s);const hz=Math.sin(Math.PI*p);if(hz>0){g.fillStyle=`rgba(192,40,26,${hz*0.45})`;g.fillRect(x,y,tw_,th_);}g.restore();});
  plane(c,{x:UIX,y:UIY-LV(110,130),z:lerp(300,0,eOut(P(t,a,a+1.1))),w:W2,h:H2,ry:LV(0.05,0),alpha:P(t,a,a+0.5)*(1-P(t,47.4,47.7)),shadow:40});
  const bar=inputBar('bar4',W2,[typed('خليهم أبيض وأسود بإحساس سينمائي',t,43.8,44.9)],t,{sendOn:t>44.9?1:0,caret:t<45.2});const ob={x:UIX,y:UIY+LV(290,380),z:0,w:W2,h:bar.height,ry:LV(0.05,0),alpha:P(t,a+0.1,a+0.5)*(1-P(t,47.4,47.7))};plane(bar,ob);
  const sp=xf(ob,-W2/2+52,bar.height/2-52);const cp=cpath(t,[[44.2,W*0.5,H*0.97],[45.0,sp[0]+8,sp[1]+8],[46,sp[0]+8,sp[1]+8]]);if(t>44.2&&t<46)cursor(cp[0],cp[1],t,[45.2]);
  block('FULL CONTROL',['تحكّم كامل..','في كل تفصيلة'],a+0.2,47.4,t);}
function sTunnel(t){const a=47.7;stage(t,1-P(t,50.6,51.0));const cz=lerp(0,5000,eInOut(P(t,a,51)));const ks=['V4','V5','V1','V6','V3','V7','V2b','V2a','S1n','V5','V1','V6'];
  const items=ks.map((k,i)=>{const side=i%2?1:-1;return{k,x:side*LV(720,560),z:200+i*480,ry:-side*1.0};}).sort((p,q)=>q.z-p.z);
  for(const it of items){const z=it.z-cz;if(z<-FOC*0.85)continue;const im=IM[it.k];const hh=LV(820,1000),ww=hh*im.width/im.height;photo(it.k,{x:it.x,y:0,z,w:ww,h:hh,ry:it.ry,dof:clamp((z-400)/2400),alpha:clamp((z+FOC*0.85)/300)*P(t,a,a+0.4)});}
  const hp=P(t,49.3,50.6);const im=IM.V2a;photo('V2a',{x:0,y:0,z:lerp(3400,300,eOut(hp)),w:LV(1500,1000),h:LV(1500,1000)*im.height/im.width,dof:1-hp,alpha:P(t,49.3,49.7)*(1-P(t,50.5,51))});}
function sEnd(t){const a=51.0;stage(t,1,1.3);const p=eOut(P(t,a+0.1,a+0.9));const cy=H/2-LV(30,80);
  maroAt('M5',W/2,cy-LV(215,250),LV(140,170),{expr:t>a+1.6&&t<a+1.9?'wink':'happy',et:t-a-1.6,t,alpha:p});
  T('MARO AI',W/2,cy+(1-p)*20,LV(120,130),{w:900,col:A.txt,alpha:p});
  T('AI-POWERED CREATIVE WORKSPACE',W/2,cy+LV(92,100),LV(24,28),{w:700,col:A.acc,ls:4,alpha:P(t,a+0.4,a+0.9)});
  T('مساعدك الذكي في الإبداع',W/2,cy+LV(150,165),LV(42,48),{w:700,col:A.txt,alpha:P(t,a+0.6,a+1.1)});
  const lp=P(t,a+0.9,a+1.4);if(lp>0){ctx.save();ctx.globalAlpha=lp;const L=LV(64,80);const y=H-LV(110,200);ctx.save();rr(ctx,W/2-L/2,y-L/2-LV(40,50),L,L,12);ctx.clip();ctx.drawImage(IM.logo,W/2-L/2,y-L/2-LV(40,50),L,L);ctx.restore();
    T('ai.sabergroupacademy.com',W/2,y+LV(22,30),LV(22,28),{w:600,col:A.sub});ctx.restore();}
  const fo=P(t,DUR-0.4,DUR);if(fo>0){ctx.fillStyle=`rgba(0,0,0,${fo})`;ctx.fillRect(0,0,W,H);}}
const SC=[[0,sCollage],[4.9,sPhones],[8.3,sAsk],[11.0,sChat],[16.8,sIdea],[18.5,sExec],[24.5,sMention],[28.8,sGen],[34.5,sHero],[38.7,sCoach],[43.4,sControl],[47.7,sTunnel],[51.0,sEnd]];
function scene(t){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=A.bg;ctx.fillRect(0,0,W,H);ctx.restore();let i=0;while(i<SC.length-1&&t>=SC[i+1][0])i++;SC[i][1](t);}
function nSub(t){for(const[a,b]of[[3.8,5.6],[28.8,30],[34.5,38.8],[47.7,51]])if(t>=a&&t<=b)return 6;return 3;}
// ================= render hooks =================
const grains=[];{const R=rng(7);for(let k=0;k<6;k++){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');const d=g.createImageData(256,256);for(let i=0;i<d.data.length;i+=4){const v=R()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255;}g.putImageData(d,0,0);grains.push(c);}}
function post(f){out.save();out.globalAlpha=0.035;out.globalCompositeOperation='overlay';out.translate((f*37)%256,(f*91)%256);out.fillStyle=out.createPattern(grains[f%6],'repeat');out.fillRect(-256,-256,W+512,H+512);out.restore();}
window.renderFrame=function(f){const t0=f/FPS,N=nSub(t0),shutter=0.5/FPS;out.fillStyle='#000';out.fillRect(0,0,W,H);
  for(let k=0;k<N;k++){const t=Math.max(0,t0+(N>1?(k/(N-1)-0.5)*shutter:0));ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';
    ctx.translate(W/2,H/2);const z=1.0+Math.sin(t*0.2)*0.006;ctx.scale(z,z);ctx.translate(-W/2+Math.sin(t*0.3)*5,-H/2+Math.cos(t*0.27)*4);scene(t);out.globalAlpha=1/(k+1);out.drawImage(sub,0,0);}
  out.globalAlpha=1;post(f);};
let PH={};
function bake(im,maxW,r){const s=Math.min(1,maxW/im.width);const c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);const g=c.getContext('2d');g.beginPath();g.roundRect(0,0,c.width,c.height,r);g.clip();g.drawImage(im,0,0,c.width,c.height);return c;}
function blurred(src,px){const c=document.createElement('canvas');c.width=Math.round(src.width/3);c.height=Math.round(src.height/3);const g=c.getContext('2d');g.filter=`blur(${px}px)`;g.drawImage(src,0,0,c.width,c.height);return c;}
function gray(src){const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const g=c.getContext('2d');g.filter='grayscale(1) contrast(1.15) brightness(0.95)';g.drawImage(src,0,0);return c;}
function phoneBake(img){const hh=1500,sh=hh*0.956,sw=sh*img.width/img.height,bz=(hh-sh)/2,bw=sw+bz*2;const c=document.createElement('canvas');c.width=Math.ceil(bw);c.height=hh;const g=c.getContext('2d');
  g.beginPath();g.roundRect(0,0,bw,hh,bw*0.16);const fg=g.createLinearGradient(0,0,bw,0);fg.addColorStop(0,'#5a5552');fg.addColorStop(0.08,'#2b2826');fg.addColorStop(0.92,'#2b2826');fg.addColorStop(1,'#5a5552');g.fillStyle=fg;g.fill();
  g.beginPath();g.roundRect(8,8,bw-16,hh-16,bw*0.15);g.fillStyle='#050505';g.fill();g.save();g.beginPath();g.roundRect(bz,bz,sw,sh,sw*0.13);g.clip();g.drawImage(img,bz,bz,sw,sh);g.restore();
  const iw=sw*0.29,ih=sw*0.085;g.beginPath();g.roundRect(bw/2-iw/2,bz+sh*0.012,iw,ih,ih/2);g.fillStyle='#000';g.fill();return c;}
window.ready=(async()=>{
  await Promise.all([600,700,800,900].flatMap(w=>[document.fonts.load(`${w} 40px Cairo`,'مارو'),document.fonts.load(`${w} 40px Cairo`,'AI')]));
  for(const[k,n]of Object.entries(POSE)){IMG[k]=await load(n+'.png');VM[k]=await load(n+'_vmask.png');const v=VIS[n];const c=document.createElement('canvas');c.width=v.x1-v.x0+1;c.height=v.y1-v.y0+1;FACE[k]=c;}
  LOGO=await load('logo_white.png');WATER=document.createElement('canvas');WATER.width=WATER.height=8;
  const files={V1:'V1_image_to_prompt_source.jpg',V2a:'V2a_prompt_result_16x9.png',V2b:'V2b_prompt_result_4x5.png',V3:'V3_prompt_result_variation.png',V4:'V4_pro_ad_hologram_doctors.png',V5:'V5_series_dental.png',V6:'V6_series_orthopedics.png',V7:'V7_series_cardiology.png',S1n:'S1_new_photoshop.png',S1o:'S1_scene_3am_desk.png'};
  for(const[k,f]of Object.entries(files)){IM[k]=await load(f);RC[k]=bake(IM[k],1400,36);BL[k]=blurred(RC[k],10);GR[k]=gray(RC[k]);}
  for(const k of['home','ask','prompt'])PH[k]=phoneBake(await load('app/'+k+'.png'));IM.logo=await load('logo.png');
  return true;})();
