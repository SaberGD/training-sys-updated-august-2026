// ================= MARO AI — product film in the style of Google Flow's "Introducing your Agent" (54s, 16:9 + native 9:16 via ?v) =================
// charcoal stage, soft blur-in headlines, floating UI in real 3D perspective, a cursor that clicks, images that resolve out of grey haze.
const DUR=54;const LV=(h,v)=>VERT?v:h;const eob=x=>Math.max(0,eOutBack(x));
const K={bg0:'#232325',bg1:'#0e0e0f',panel:'#1c1c1e',panel2:'#252528',line:'rgba(255,255,255,0.14)',txt:'#F2F2F3',dim:'#9B9BA0',acc:'#FF7B20',sel:'rgba(255,123,32,0.35)'};
const IM={},RC={},BL={},GR={};
function maroAt(pose,x,y,vw,o={}){const v=VIS[POSE[pose]];const s=vw/(v.x1-v.x0);drawMaro(pose,x-(v.cx-1024)*s,y-(v.cy-1024)*s,s,o);}
// ---------- stage ----------
function stage(t,k=1){const g=ctx.createRadialGradient(W/2,H*0.42,0,W/2,H*0.5,Math.hypot(W,H)*0.62);g.addColorStop(0,K.bg0);g.addColorStop(1,K.bg1);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  if(k<1){ctx.fillStyle=`rgba(0,0,0,${1-k})`;ctx.fillRect(0,0,W,H);}}
// headline: each line fades up out of a blur; exits the same way
function head(lines,x,y,size,t0,t1,t,o={}){const{align='center',lh=1.18,col=K.txt,w=700,stagger=0.12}=o;
  lines.forEach((s,i)=>{const a=eOut(P(t,t0+i*stagger,t0+i*stagger+0.7)),b=t1?eIn(P(t,t1,t1+0.45)):0;const v=a*(1-b);if(v<=0.001)return;
    ctx.save();ctx.globalAlpha=v;const bl=(1-a)*14+b*10;if(bl>0.3)ctx.filter=`blur(${bl}px)`;ctx.shadowColor='rgba(0,0,0,0.55)';ctx.shadowBlur=30;
    T(s,x,y+i*size*lh+(1-a)*size*0.25,size,{w,col,align});ctx.restore();});}
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
// ---------- UI kit (drawn into offscreen canvases, then placed in 3D) ----------
const pool={};function ocv(name,w,h){let c=pool[name];if(!c||c.width!==w||c.height!==h){c=document.createElement('canvas');c.width=w;c.height=h;pool[name]=c;}const g=c.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,w,h);return[c,g];}
function PT(g,s,x,y,size,o={}){const{w=600,col=K.txt,align='right',alpha=1}=o;if(!s||alpha<=0)return;g.save();g.globalAlpha*=alpha;setFont(g,s,size,w,0);g.textAlign=align;g.textBaseline='middle';g.fillStyle=col;g.fillText(s,x,y);g.restore();}
function pw(g,s,size,w=600){g.save();setFont(g,s,size,w,0);const m=g.measureText(s).width;g.restore();return m;}
function wrapG(g,s,size,maxW,w=600){const words=s.split(' ');const L=[];let cur='';for(const wd of words){const tr=cur?cur+' '+wd:wd;if(pw(g,tr,size,w)>maxW&&cur){L.push(cur);cur=wd;}else cur=tr;}if(cur)L.push(cur);return L;}
const typed=(s,t,a,b)=>s.slice(0,Math.round(s.length*P(t,a,b)));const blink=t=>Math.floor(t*2.2)%2===0;
function rrG(g,x,y,w,h,r){g.beginPath();g.roundRect(x,y,w,h,r);}
function iconPlus(g,x,y,s,col=K.txt){g.save();g.strokeStyle=col;g.lineWidth=s*0.09;g.lineCap='round';g.beginPath();g.moveTo(x-s/2,y);g.lineTo(x+s/2,y);g.moveTo(x,y-s/2);g.lineTo(x,y+s/2);g.stroke();g.restore();}
function iconSend(g,x,y,r,hot){g.save();g.beginPath();g.arc(x,y,r,0,6.283);g.fillStyle=hot?K.acc:'#2c2c2f';g.fill();g.strokeStyle='#fff';g.lineWidth=r*0.12;g.lineCap='round';g.lineJoin='round';const s=r*0.42;
  g.beginPath();g.moveTo(x+s,y);g.lineTo(x-s,y);g.moveTo(x-s*0.2,y-s*0.75);g.lineTo(x-s,y);g.lineTo(x-s*0.2,y+s*0.75);g.stroke();g.restore();}
function iconMic(g,x,y,s){g.save();g.strokeStyle=K.txt;g.lineWidth=s*0.09;g.lineCap='round';rrG(g,x-s*0.18,y-s*0.5,s*0.36,s*0.62,s*0.18);g.stroke();g.beginPath();g.arc(x,y-s*0.05,s*0.34,0.15,Math.PI-0.15);g.stroke();g.beginPath();g.moveTo(x,y+s*0.3);g.lineTo(x,y+s*0.48);g.stroke();g.restore();}
function iconSliders(g,x,y,s){g.save();g.strokeStyle=K.txt;g.lineWidth=s*0.09;g.lineCap='round';for(const[k,dx]of[[-0.3,0.18],[0,-0.2],[0.3,0.08]]){g.beginPath();g.moveTo(x-s/2,y+k*s);g.lineTo(x+s/2,y+k*s);g.stroke();g.beginPath();g.moveTo(x+dx*s,y+k*s-s*0.13);g.lineTo(x+dx*s,y+k*s+s*0.13);g.stroke();}g.restore();}
// prompt box (RTL): tokens = strings or {chip:'name'}; returns caret x for the cursor
function promptBox(name,w,h,tokens,t,o={}){const[c,g]=ocv(name,w,h);const{size=LV(46,44),hotSend=false,thumbs=[],pillOn=-1,pill=null,caretOn=true,stroke=3}=o;
  rrG(g,stroke,stroke,w-stroke*2,h-stroke*2,LV(64,58));g.fillStyle='rgba(22,22,24,0.94)';g.fill();g.strokeStyle='rgba(255,255,255,0.92)';g.lineWidth=stroke;g.stroke();
  let x=w-70,y=LV(92,88)+(thumbs.length?110:0);thumbs.forEach((k,i)=>{const s=96;g.save();rrG(g,w-70-s-i*(s+16),44,s,s,18);g.clip();const im=IM[k];const sc=Math.max(s/im.width,s/im.height);g.drawImage(im,w-70-s-i*(s+16)+(s-im.width*sc)/2,44+(s-im.height*sc)/2,im.width*sc,im.height*sc);g.restore();});
  const lh=size*1.35,maxX=70;for(const tk of tokens){if(typeof tk==='string'){for(const wd of tk.split(/(\s+)/)){if(!wd)continue;const ww=pw(g,wd,size);if(x-ww<maxX&&wd.trim()){x=w-70;y+=lh;}PT(g,wd,x,y,size);x-=ww;}}
    else{const cw=pw(g,tk.chip,size*0.92)+44;const p=eob(tk.p??1);if(x-cw<maxX){x=w-70;y+=lh;}g.save();g.translate(x-cw/2,y);g.scale(p,p);rrG(g,-cw/2,-size*0.72,cw,size*1.44,size*0.5);g.fillStyle='#3a3a3e';g.fill();PT(g,tk.chip,0,2,size*0.92,{align:'center'});g.restore();x-=cw+10;}}
  if(caretOn&&blink(t)){g.fillStyle='#fff';g.fillRect(x-6,y-size*0.55,3,size*1.1);}
  const by=h-LV(70,66);iconPlus(g,w-84,by,40);iconSend(g,86,by,40,hotSend);iconSliders(g,190,by,40);iconMic(g,270,by,44);
  if(pill){const pwid=pw(g,pill,30,700)+56;const on=pillOn;g.save();rrG(g,w-140-pwid,by-28,pwid,56,28);g.fillStyle=on>0?`rgba(255,255,255,${0.9*on})`:'rgba(255,255,255,0.08)';g.fill();g.strokeStyle='rgba(255,255,255,0.25)';g.lineWidth=2;g.stroke();PT(g,pill,w-140-pwid/2,by+2,30,{w:700,align:'center',col:on>0.5?'#111':K.txt});g.restore();}
  return c;}
// macOS-style pointer
function cursor(x,y,t,clicks=[]){let s=1;for(const c of clicks){const d=t-c;if(d>-0.08&&d<0.2)s=Math.min(s,1-0.18*Math.sin(clamp((d+0.08)/0.28)*Math.PI));}
  ctx.save();ctx.translate(x,y);ctx.scale(s*LV(1.25,1.4),s*LV(1.25,1.4));ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,34);ctx.lineTo(8,26);ctx.lineTo(14,39);ctx.lineTo(20,36);ctx.lineTo(14,24);ctx.lineTo(25,24);ctx.closePath();
  ctx.fillStyle='#fff';ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#000';ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();ctx.restore();}
// cursor path through keyframes [t,x,y]
function cpath(t,kf){if(t<=kf[0][0])return kf[0].slice(1);for(let i=0;i<kf.length-1;i++){const a=kf[i],b=kf[i+1];if(t<=b[0]){const p=eInOut(P(t,a[0],b[0]));return[lerp(a[1],b[1],p),lerp(a[2],b[2],p)];}}return kf[kf.length-1].slice(1);}

// ================= scenes =================
const COL=['V2a','V4','V1','V5','S1n','V3','V6','V2b','V7','S1o','V2a','V5'];
function sCollage(t){stage(t);const cz=lerp(0,2600,eIn(P(t,0,4.9))*0.35+P(t,0,4.9)*0.65);
  const R=rng(5);const items=COL.map((k,i)=>{const r=()=>R();return{k,x:(r()-0.5)*LV(2600,1500),y:(r()-0.5)*LV(1400,2500),z:600+i*420+r()*200,s:0.8+r()*0.5};});
  items.sort((a,b)=>(b.z-cz)-(a.z-cz));for(const it of items){const z=it.z-cz;if(z<-FOC*0.8)continue;const im=IM[it.k];const w=LV(620,560)*it.s,h=w*im.height/im.width;
    const dof=clamp(Math.abs(z-900)/1400);plane(BL[it.k],{x:it.x,y:it.y,z,w,h,alpha:clamp((z+FOC*0.8)/400)*0.95});if(dof<1)plane(RC[it.k],{x:it.x,y:it.y,z,w,h,alpha:clamp((z+FOC*0.8)/400)*(1-dof)});}
  const sc=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,LV(700,650));sc.addColorStop(0,'rgba(20,20,22,0.55)');sc.addColorStop(1,'rgba(20,20,22,0)');ctx.fillStyle=sc;ctx.fillRect(0,0,W,H);
  head(['طوّر فكرتك..','وطلّع أحسن شغل عندك'],W/2,H/2-LV(50,70),LV(92,84),0.35,4.2,t);}
// phones in 3D (static screenshots baked into phone canvases)
function sPhones(t){stage(t);const t0=4.9,p=eOut(P(t,t0,t0+1.6)),q=eInOut(P(t,7.4,8.3));
  const ph=[['home',-1],['ask',0],['prompt',1]];for(const[k,i]of ph){const c=PH[k];const hh=LV(900,1200);const ww=hh*c.width/c.height;
    plane(c,{x:i*LV(560,620)+(i?0:0),y:LV(60,120)+Math.abs(i)*40,z:lerp(900,0,p)+Math.abs(i)*300+q*-400,w:ww,h:hh,ry:lerp(0.9,-i*0.35,p),rx:lerp(0.35,0.08,p),alpha:P(t,t0,t0+0.6)*(1-q)});}
  head(['دلوقتي مع','MARO AI'],W/2,H/2-LV(60,110),LV(96,92),t0+0.7,7.35,t);}
function sAsk(t){stage(t);const t0=8.3;const q='ساعدني أطلّع أفكار لكامبين Vezeeta';const pOn=eOut(P(t,10.35,10.55));
  const w=LV(1320,960),h=LV(330,380);const c=promptBox('pb1',w,h,[typed(q,t,8.7,10.0)],t,{pill:'عصف ذهني',pillOn:pOn});
  const o={x:0,y:LV(0,0),z:lerp(400,0,eOut(P(t,t0,t0+0.8))),w,h,ry:lerp(-0.25,-0.06,eOut(P(t,t0,t0+1.2))),rx:0.06,alpha:P(t,t0,t0+0.4)*(1-P(t,10.9,11.2))};plane(c,o);
  const pill=xf(o,w/2-140-(pw(pool.pb1.getContext('2d'),'عصف ذهني',30,700)+56)/2,h/2-LV(70,66));const cp=cpath(t,[[t0,W*0.72,H*0.95],[9.9,pill[0]+140,pill[1]+140],[10.3,pill[0]+8,pill[1]+6],[11,pill[0]+8,pill[1]+6]]);
  if(t>9.4&&t<11.1)cursor(cp[0],cp[1],t,[10.35]);}
const IDEAS=[['عيلتك تستاهل','العيلة كلها حوالين الموبايل، والدكتور بيطلع لهم هولوجرام من الشاشة ويطمنهم.'],['دكتورك في جيبك','عيادة كاملة بتظهر فوق الموبايل.. كشف وحجز من غير ما تنزل من البيت.'],['الطمأنينة أقرب','كل تخصص في كارت مضيء: أسنان، عظام، قلب.. سلسلة إعلانات بنفس الهوية.']];
function chatPanel(t,w,h,a){const[c,g]=ocv('chat',w,h);rrG(g,1,1,w-2,h-2,28);g.fillStyle=K.panel;g.fill();g.strokeStyle=K.line;g.lineWidth=2;g.stroke();
  PT(g,'كامبين Vezeeta',w-80,58,30,{w:700});g.strokeStyle=K.txt;g.lineWidth=3;for(let k=0;k<3;k++){g.beginPath();g.moveTo(w-52,46+k*11);g.lineTo(w-30,46+k*11);g.stroke();}
  PT(g,'✕',40,58,26,{align:'left',col:K.dim});
  const bw=Math.min(w-120,pw(g,'ساعدني أطلّع أفكار لكامبين Vezeeta',26)+50);rrG(g,w-40-bw,100,bw,70,20);g.fillStyle='#2e2e31';g.fill();PT(g,'ساعدني أطلّع أفكار لكامبين Vezeeta',w-65,136,26);
  const th=P(t,a+0.2,a+0.4)*(1-P(t,a+1.1,a+1.2));if(th>0)PT(g,'بيفكر...',w-40,214,26,{col:K.dim,alpha:th*(0.6+0.4*Math.sin(t*6))});
  let y=220;const s0=a+1.2;const intro='من قلب البيت المصري، دي كذا فكرة تربط العيلة بالدكتور:';const L0=wrapG(g,intro,27,w-90);const all=[];L0.forEach(l=>all.push([l,27,600,K.txt,0]));all.push(['',10]);
  IDEAS.forEach(([ti,de],i)=>{all.push([ti,29,700,K.txt,1+i]);wrapG(g,de,25,w-90).forEach(l=>all.push([l,25,600,'#C9C9CD',0]));all.push(['',14]);});
  let shown=Math.floor((t-s0)/0.07);const hl=eOut(P(t,a+4.35,a+4.6));
  for(const[s,sz,wt,col,id]of all){if(shown--<=0)break;if(!s){y+=sz;continue;}y+=sz*0.85;if(id===1&&hl>0){const tw_=pw(g,s,sz,wt);g.save();g.globalAlpha=hl;rrG(g,w-44-tw_*hl,y-sz*0.75,tw_*hl+8,sz*1.5,6);g.fillStyle=K.sel;g.fill();g.restore();}PT(g,s,w-40,y,sz,{w:wt,col});y+=sz*0.85;}
  return c;}
function sPartner(t){const a=11.0;stage(t);
  // blurred workspace behind
  for(let i=0;i<6;i++){const k=['V2a','V1','V3','V5','V6','V7'][i];plane(BL[k],{x:LV(-300,-250)+(i%3)*LV(420,380)-LV(200,160),y:LV(-260,-520)+Math.floor(i/3)*LV(360,380),z:300,w:LV(400,360),h:LV(300,280),alpha:0.35*P(t,a,a+0.6)*(1-P(t,16.6,17))});}
  const w=LV(640,900),h=LV(900,1000);const c=chatPanel(t,w,h,a);const o={x:LV(-470,0),y:LV(20,300),z:lerp(300,0,eOut(P(t,a,a+1))),w,h,ry:LV(0.1,0),rx:0,alpha:P(t,a,a+0.5)*(1-P(t,16.5,16.9))};plane(c,o,{});
  head(['مساعدك الذكي..','وشريكك في الإبداع'],LV(1760,W/2),LV(430,330),LV(92,76),a+0.5,16.4,t,{align:LV('right','center')});
  const tp=xf(o,w/2-40,-h/2+220+27*3.4+60);const cp=cpath(t,[[a+3.6,W*0.3,H*0.9],[a+4.3,tp[0]+10,tp[1]],[a+4.6,tp[0]-LV(160,140),tp[1]],[a+5.5,tp[0]-LV(160,140),tp[1]]]);if(t>a+3.6)cursor(cp[0],cp[1],t,[a+4.3]);}
function sIdea(t){stage(t);head(['من الفكرة...'],W/2,H/2,LV(150,130),16.85,18.45,t,{w:800});}
const PROMPTS=[['واقعي سينمائي','Cinematic shot of an Egyptian family gathered around a phone, a tiny doctor appears on screen, warm light'],['هولوجرام ثلاثي الأبعاد','A glowing 3D hologram clinic rising from a smartphone on the carpet, family watching in awe'],['إعلان مضيء','Doctors appear as soft light silhouettes behind a proud family, blue studio glow, ad key visual']];
function sExec(t){const a=18.6;stage(t);const q='اكتبلي برومبت للفكرة الأولى';const sendAt=20.55;
  const w=LV(1320,960),h=LV(330,380);const box=promptBox('pb2',w,h,[typed(q,t,a+0.5,a+1.6)],t,{hotSend:t>sendAt,caretOn:t<sendAt});
  const lift=eInOut(P(t,sendAt+0.2,sendAt+1.1));const ob={x:0,y:lerp(0,LV(330,560),lift),z:lerp(0,500,lift),w,h,ry:lerp(-0.05,0.3,lift),rx:lerp(0.04,0.25,lift),alpha:P(t,a,a+0.4)*(1-lift*0.6)*(1-P(t,24.2,24.5))};
  // alternatives panel rises in 3D
  if(lift>0){const[c,g]=ocv('alts',LV(1100,900),LV(760,900));const pw_=c.width,ph_=c.height;rrG(g,1,1,pw_-2,ph_-2,28);g.fillStyle=K.panel;g.fill();g.strokeStyle=K.line;g.lineWidth=2;g.stroke();
    PT(g,'دي كذا برومبت للفكرة، اختار اللي يعجبك:',pw_-44,60,30,{w:700});const pick=eOut(P(t,23.35,23.55));
    PROMPTS.forEach(([ti,en],i)=>{const y=150+i*LV(200,245);const ap=P(t,sendAt+0.9+i*0.25,sendAt+1.3+i*0.25);g.save();g.globalAlpha=ap;PT(g,ti,pw_-100,y,30,{w:700});
      g.beginPath();g.arc(pw_-58,y,15,0,6.283);g.strokeStyle='#d8d8dc';g.lineWidth=3;g.stroke();if(i===1&&pick>0){g.beginPath();g.arc(pw_-58,y,9*pick,0,6.283);g.fillStyle=K.acc;g.fill();}
      wrapG(g,en,24,pw_-150,600).slice(0,LV(2,3)).forEach((l,j)=>PT(g,l,pw_-100,y+46+j*34,24,{col:'#BDBDC2'}));g.restore();});
    const oa={x:LV(0,0),y:LV(-60,-120),z:lerp(700,0,lift),w:c.width,h:c.height,ry:lerp(0.5,-0.18,lift),rx:lerp(0.3,0.1,lift),alpha:lift*(1-P(t,24.2,24.5))};plane(c,oa);
    const rp=xf(oa,c.width/2-58,-c.height/2+150+LV(200,245));const cp=cpath(t,[[22.5,W*0.8,H*0.95],[23.3,rp[0]+4,rp[1]+4],[24,rp[0]+4,rp[1]+4]]);if(t>22.4&&t<24.3)cursor(cp[0],cp[1],t,[23.35]);}
  plane(box,ob);
  const sp=xf(ob,-w/2+86,h/2-LV(70,66));const cp=cpath(t,[[a+1.2,W*0.3,H*0.95],[20.3,sp[0]+6,sp[1]+6],[21,sp[0]+6,sp[1]+6]]);if(t>a+1.3&&t<20.9)cursor(cp[0],cp[1],t,[sendAt]);
  head(['...للتنفيذ'],W/2,H/2+LV(0,-560),LV(150,120),21.15,22.6,t,{w:800});}
const ASSETS=[['V1','العيلة'],['V4','الدكاترة'],['V2a','الموبايل'],['V5','العيادة']];
function sMention(t){const a=24.5;stage(t);const w=LV(1320,960),h=LV(400,460);
  const ch1=P(t,26.2,26.45),ch2=P(t,27.2,27.45);const toks=['ضيف '];if(t>=25.1&&t<26.2)toks[0]='ضيف @';
  if(t>=26.2){toks.push({chip:'العيلة',p:ch1});toks.push(typed(' مع ',t,26.5,26.8)+(t>=26.8&&t<27.2?'@':''));}if(t>=27.2){toks.push({chip:'الدكاترة',p:ch2});toks.push(typed(' في مشهد واحد مضيء',t,27.5,28.3));}
  const th=[];if(t>=26.2)th.push('V1');if(t>=27.2)th.push('V4');
  const c=promptBox('pb3',w,h,toks,t,{thumbs:th});const ob={x:0,y:LV(120,260),z:0,w,h,ry:-0.12,rx:0.1,rz:-0.02,alpha:P(t,a,a+0.4)*(1-P(t,28.6,28.9))};plane(c,ob);
  // asset picker pops above the box while typing @
  const pk=(t>25.15&&t<26.25)?1:(t>26.8&&t<27.25?1:0);const pop=pk?eOut(P(t,t<26.5?25.15:26.8,(t<26.5?25.15:26.8)+0.25)):0;
  if(pop>0){const[c2,g]=ocv('pick',520,LV(420,420));rrG(g,1,1,518,418,24);g.fillStyle=K.panel2;g.fill();g.strokeStyle=K.line;g.lineWidth=2;g.stroke();
    const hover=t<26.5?0:1;ASSETS.forEach(([k,n],i)=>{const y=30+i*96;if(i===hover){rrG(g,14,y-8,492,88,16);g.fillStyle='rgba(255,255,255,0.08)';g.fill();}g.save();rrG(g,400,y,80,72,14);g.clip();const im=IM[k];const s=Math.max(80/im.width,72/im.height);g.drawImage(im,440-im.width*s/2,y+36-im.height*s/2,im.width*s,im.height*s);g.restore();PT(g,n,380,y+37,30,{w:700});});
    const op={x:LV(330,220),y:LV(-250,-230),z:0,w:520,h:420,ry:-0.12,rx:0.1,alpha:pop};plane(c2,op);
    const hv=t<26.5?0:1;const tp=xf(op,-60,-210+30+hv*96+37);const cp=cpath(t,[[t<26.5?25.3:26.85,tp[0]+120,tp[1]+80],[t<26.5?26.0:27.05,tp[0],tp[1]],[28,tp[0],tp[1]]]);cursor(cp[0],cp[1],t,[26.2,27.2]);}}
// generation grid: grey haze tiles resolve into images
const GEN=['V2a','V3','V4','V1','V5','V6','V7','V2b','S1n'];
function genTile(g,k,x,y,w,h,p,t,i){g.save();rrG(g,x,y,w,h,18);g.clip();const im=p<0.5?BL[k]:RC[k];const s=Math.max(w/im.width,h/im.height);
  if(p<1){g.fillStyle='#4a4a4e';g.fillRect(x,y,w,h);const gg=g.createRadialGradient(x+w*(0.3+0.4*Math.sin(t*0.8+i)),y+h*0.5,0,x+w/2,y+h/2,w*0.7);gg.addColorStop(0,'rgba(140,140,146,0.8)');gg.addColorStop(1,'rgba(60,60,64,0)');g.fillStyle=gg;g.fillRect(x,y,w,h);}
  if(p>0){g.globalAlpha=eOut(p);const bi=p<1?BL[k]:RC[k];const s2=Math.max(w/bi.width,h/bi.height);g.drawImage(bi,x+(w-bi.width*s2)/2,y+(h-bi.height*s2)/2,bi.width*s2,bi.height*s2);g.globalAlpha=1;}
  g.restore();if(p<1){PT(g,Math.round(20+70*P(t,28.9,31)+i*2)+'٪',x+w-20,y+26,20,{col:'rgba(255,255,255,0.7)'});}}
function sGen(t){const a=28.8;stage(t);const W2=LV(1560,960),H2=LV(900,1500);const[c,g]=ocv('grid',W2,H2);rrG(g,1,1,W2-2,H2-2,26);g.fillStyle='#161618';g.fill();g.strokeStyle=K.line;g.lineWidth=2;g.stroke();
  const side=LV(360,0);if(side){rrG(g,20,20,side,H2-40,20);g.fillStyle=K.panel;g.fill();PT(g,'كامبين Vezeeta',side-10,56,24,{w:700});rrG(g,40,90,side-40,90,16);g.fillStyle='#2e2e31';g.fill();PT(g,'ولّد الفكرة دي في',side-10,120,22);PT(g,'٩ مشاهد مختلفة',side-10,152,22);
    PT(g,t<31?'بيولّد...':'خلصت ✓',side-10,220,22,{col:K.dim});}
  const gx=side?side+40:24,gw=W2-gx-24,cols=3,rows=3,gap=16,tw_=(gw-gap*(cols-1))/cols,th_=(H2-48-gap*(rows-1))/rows;
  GEN.forEach((k,i)=>{const cI=cols-1-(i%cols),r=Math.floor(i/cols);const p=P(t,29.6+i*0.28,30.2+i*0.28);genTile(g,k,gx+cI*(tw_+gap),24+r*(th_+gap),tw_,th_,p,t,i);});
  const o={x:0,y:LV(0,60),z:lerp(600,120,eOut(P(t,a,a+1.4)))-P(t,31,34.5)*200,w:W2,h:H2,ry:lerp(0.35,0.05,eOut(P(t,a,a+1.4))),rx:lerp(0.2,0.05,eOut(P(t,a,a+1.4))),alpha:P(t,a,a+0.5)*(1-P(t,34.2,34.6))};plane(c,o);
  const k2=P(t,31.4,31.8)*(1-P(t,33.9,34.3));if(k2>0){ctx.fillStyle=`rgba(10,10,11,${0.45*k2})`;ctx.fillRect(0,0,W,H);}
  head(['صور وبرومبتات وبريفات..','كلها في مكان واحد'],W/2,H/2-LV(50,60),LV(84,70),31.5,33.9,t);}
function sHero(t){const a=34.5;stage(t);const p=eInOut(P(t,a,a+1.8));const im=IM.V2a;const w=lerp(LV(900,760),LV(1700,1000),p),h=w*im.height/im.width;
  photo('V2a',{x:0,y:0,z:0,w,h,ry:lerp(0.45,0,p),rx:lerp(0.12,0,p),alpha:P(t,a,a+0.4)*(1-P(t,36.4,36.8))});
  const q=P(t,36.3,38.6);const row=['V4','V5','V6','V7','V2b'];row.forEach((k,i)=>{const x=(i-2)*LV(720,700)+lerp(LV(1400,1000),-LV(1500,1100),eInOut(q));const im2=IM[k];const hh=LV(700,900),ww=hh*im2.width/im2.height;const z=Math.abs(x)*0.25;
    photo(k,{x,y:0,z,w:ww,h:hh,ry:-x/LV(2600,2000),dof:clamp((Math.abs(x)-350)/1500),alpha:P(t,36.3,36.6)*(1-P(t,38.4,38.8))});});}
function sModels(t){const a=38.7;stage(t);head(['خُد رأي','مدرّب حقيقي','في كل تصميم'],LV(1760,W/2),LV(330,260),LV(96,84),a+0.2,43.1,t,{align:LV('right','center'),stagger:0.1});
  const w=LV(760,860),h=LV(290,300);const[c,g]=ocv('seg',w,h);rrG(g,1,1,w-2,h-2,26);g.fillStyle=K.panel;g.fill();g.strokeStyle=K.line;g.lineWidth=2;g.stroke();
  const sw_=(w-60)/2;const sel=eInOut(P(t,40.9,41.2));const sx_=lerp(w-30-sw_,30,sel);rrG(g,sx_,28,sw_,86,43);g.fillStyle='rgba(235,235,238,0.95)';g.fill();
  PT(g,'حلّل تصميم',w-30-sw_/2,72,32,{w:700,align:'center',col:sel<0.5?'#111':K.txt});PT(g,'قيّملي تصميمي',30+sw_/2,72,32,{w:700,align:'center',col:sel>0.5?'#111':K.txt});
  PT(g,'المدرب مارو',w-40,200,30,{w:600});g.strokeStyle=K.txt;g.lineWidth=3;g.beginPath();g.moveTo(40,192);g.lineTo(50,204);g.lineTo(60,192);g.stroke();
  const sc=P(t,41.5,42.2);if(sc>0){g.save();g.globalAlpha=sc;rrG(g,120,172,180,58,29);g.fillStyle='rgba(255,123,32,0.16)';g.fill();g.strokeStyle=K.acc;g.lineWidth=2;g.stroke();PT(g,Math.round(lerp(6,9,eOut(P(t,41.6,42.4))))+' / 10',210,202,28,{w:700,align:'center',col:K.acc});g.restore();}
  const o={x:LV(-460,0),y:LV(80,480),z:0,w,h,ry:LV(0.08,0),alpha:P(t,a+0.6,a+1.1)*(1-P(t,43.1,43.5))};plane(c,o);
  const bp=xf(o,-w/2+30+sw_/2,-h/2+72);const cp=cpath(t,[[40.1,W*0.55,H*0.95],[40.8,bp[0]+10,bp[1]+8],[42.6,bp[0]+10,bp[1]+8]]);if(t>40.1&&t<43.2)cursor(cp[0],cp[1],t,[40.9]);}
function sControl(t){const a=43.4;stage(t);const W2=LV(1500,960),H2=LV(740,1180);const[c,g]=ocv('bw',W2,H2);const ks=['V2a','V3','V1','V5','V6','V7'];const cols=3,rows=2,gap=14;const tw_=(W2-gap*(cols-1))/cols,th_=(H2-gap*(rows-1))/rows;
  ks.forEach((k,i)=>{const x=(i%cols)*(tw_+gap),y=Math.floor(i/cols)*(th_+gap);const p=P(t,45.3+i*0.12,45.9+i*0.12);g.save();rrG(g,x,y,tw_,th_,18);g.clip();
    const src=p<0.5?RC[k]:GR[k];const s=Math.max(tw_/src.width,th_/src.height);g.drawImage(src,x+(tw_-src.width*s)/2,y+(th_-src.height*s)/2,src.width*s,src.height*s);
    const hz=Math.sin(Math.PI*p);if(hz>0){g.fillStyle=`rgba(120,120,125,${hz*0.8})`;g.fillRect(x,y,tw_,th_);}g.restore();});
  plane(c,{x:0,y:LV(-40,-80),z:lerp(300,0,eOut(P(t,a,a+1.2))),w:W2,h:H2,ry:0,rx:lerp(0.15,0,eOut(P(t,a,a+1.2))),alpha:P(t,a,a+0.5)*(1-P(t,47.4,47.8))});
  const w=LV(760,760),h=LV(170,190);const pb=promptBox('pb4',w,h,[typed('خليهم أبيض وأسود بإحساس سينمائي',t,a+0.4,a+1.5)],t,{size:30,hotSend:t>45.2,caretOn:t<45.2});
  plane(pb,{x:LV(0,0),y:LV(430,720),z:0,w,h,ry:0,alpha:P(t,a+0.1,a+0.5)*(1-P(t,45.9,46.3))});
  const k2=P(t,46.1,46.4)*(1-P(t,47.3,47.7));if(k2>0){ctx.fillStyle=`rgba(10,10,11,${0.35*k2})`;ctx.fillRect(0,0,W,H);}
  head(['تحكّم كامل..','في كل تفصيلة'],W/2,H/2-LV(60,70),LV(96,84),46.15,47.3,t);}
function sTunnel(t){const a=47.7;stage(t,1-P(t,50.6,51.1));const cz=lerp(0,5200,eInOut(P(t,a,51)));const ks=['V4','V5','V1','V6','V3','V7','V2b','V2a','S1n','V5','V1','V6'];
  const items=[];ks.forEach((k,i)=>{const side=i%2?1:-1;items.push({k,x:side*LV(720,560),z:200+i*480,ry:-side*1.0});});items.sort((p,q)=>q.z-p.z);
  for(const it of items){const z=it.z-cz;if(z<-FOC*0.85)continue;const im=IM[it.k];const hh=LV(820,1000),ww=hh*im.width/im.height;photo(it.k,{x:it.x,y:0,z,w:ww,h:hh,ry:it.ry,dof:clamp((z-400)/2400),alpha:clamp((z+FOC*0.85)/300)*P(t,a,a+0.4)});}
  const im=IM.V2a;const hp=P(t,49.3,50.6);photo('V2a',{x:0,y:0,z:lerp(3400,300,eOut(hp)),w:LV(1500,1000),h:LV(1500,1000)*im.height/im.width,dof:1-hp,alpha:P(t,49.3,49.7)*(1-P(t,50.5,51))});}
function sEnd(t){const a=51.0;ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);const p=eOut(P(t,a+0.2,a+1.0));
  ctx.save();ctx.globalAlpha=p;const ico=LV(84,96);const txt='MARO AI';const tw2=tw(txt,LV(84,90),700);const gx=W/2+(ico+56)/2;
  maroAt('M5',gx-tw2/2-ico/2-56,H/2-LV(40,60),ico,{expr:'happy',t});T(txt,gx+0,H/2-LV(40,60),LV(84,90),{w:700,col:'#fff'});ctx.restore();
  T('مساعدك الذكي في الإبداع',W/2,H/2+LV(78,84),LV(32,38),{w:600,col:'#E8E8EA',alpha:eOut(P(t,a+0.6,a+1.3))});
  T('من صابر جروب أكاديمي · ai.sabergroupacademy.com',W/2,H-LV(90,160),LV(18,24),{w:600,col:'rgba(255,255,255,0.35)',alpha:P(t,a+1,a+1.5)});
  const fo=P(t,DUR-0.4,DUR);if(fo>0){ctx.fillStyle=`rgba(0,0,0,${fo})`;ctx.fillRect(0,0,W,H);}}
const SC=[[0,sCollage],[4.9,sPhones],[8.3,sAsk],[11.0,sPartner],[16.8,sIdea],[18.5,sExec],[24.5,sMention],[28.8,sGen],[34.5,sHero],[38.7,sModels],[43.4,sControl],[47.7,sTunnel],[51.0,sEnd]];
function scene(t){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=K.bg1;ctx.fillRect(0,0,W,H);ctx.restore();let i=0;while(i<SC.length-1&&t>=SC[i+1][0])i++;SC[i][1](t);}
function nSub(t){for(const[a,b]of[[3.8,5.6],[20.7,21.9],[28.8,30],[34.5,38.8],[43.4,44.4],[47.7,51]])if(t>=a&&t<=b)return 6;return 3;}
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
  for(const k of['home','ask','prompt'])PH[k]=phoneBake(await load('app/'+k+'.png'));
  return true;})();
