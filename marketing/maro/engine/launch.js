const eob=x=>Math.max(0,eOutBack(x));
// ================= MARO LAUNCH VIDEO (60s, 16:9) =================
const DUR=60;
const IM={};
const VZ={blue:'#1C68C8',sky:'#4594EC',ice:'#82BAF9',ink:'#28202F',rose:'#D5ADCD',mauve:'#977277'};

// ---------- helpers ----------
function wrapLines(s,size,maxW,w=700){const words=s.split(' ');const lines=[];let cur='';for(const wd of words){const tr=cur?cur+' '+wd:wd;if(tw(tr,size,w)>maxW&&cur){lines.push(cur);cur=wd;}else cur=tr;}if(cur)lines.push(cur);return lines;}
function card(x,y,w,h,o={}){const{r=28,fill='rgba(12,6,5,0.92)',stroke='rgba(196,50,31,0.55)',alpha=1,glow=0,lw=2}=o;if(alpha<=0)return;ctx.save();ctx.globalAlpha*=alpha;rr(ctx,x,y,w,h,r);ctx.fillStyle=fill;if(glow){ctx.shadowColor='rgba(255,110,40,0.55)';ctx.shadowBlur=glow;}ctx.fill();ctx.shadowBlur=0;if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}ctx.restore();}
function orangeFill(x,y,w,h){const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#E25A33');g.addColorStop(1,'#B53A20');return g;}
function pill(s,cx,cy,size,o={}){const{fill='rgba(196,50,31,0.16)',stroke='rgba(255,123,32,0.7)',col=C.white,alpha=1,sc=1,w=800,pad=30,ls=0}=o;if(alpha<=0||sc<=0)return;const pw=tw(s,size,w,ls)+pad*2,ph=size*1.9;
  ctx.save();ctx.globalAlpha*=alpha;ctx.translate(cx,cy);ctx.scale(sc,sc);rr(ctx,-pw/2,-ph/2,pw,ph,ph/2);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();T(s,0,2,size,{w,col,ls});ctx.restore();}
// image with rounded corners and a fake-3D yaw (rotY) / tilt
function imgCard(img,cx,cy,w,h,o={}){const{rotY=0,alpha=1,blur=0,r=22,shadow=true,src=null,border='rgba(255,140,70,0.5)'}=o;if(alpha<=0)return;
  ctx.save();ctx.globalAlpha*=alpha;ctx.translate(cx,cy);ctx.transform(Math.cos(rotY),Math.sin(rotY)*0.16,0,1,0,0);
  if(shadow){ctx.save();ctx.shadowColor='rgba(0,0,0,0.7)';ctx.shadowBlur=60;ctx.shadowOffsetY=30;rr(ctx,-w/2,-h/2,w,h,r);ctx.fillStyle='#000';ctx.fill();ctx.restore();}
  ctx.save();rr(ctx,-w/2,-h/2,w,h,r);ctx.clip();if(blur)ctx.filter=`blur(${blur}px)`;
  if(src)ctx.drawImage(img,src[0],src[1],src[2],src[3],-w/2,-h/2,w,h);else ctx.drawImage(img,-w/2,-h/2,w,h);ctx.filter='none';ctx.restore();
  if(border){rr(ctx,-w/2,-h/2,w,h,r);ctx.strokeStyle=border;ctx.lineWidth=2;ctx.stroke();}ctx.restore();}
function coverSrc(img,w,h){const ar=w/h,iar=img.width/img.height;if(iar>ar){const sw=img.height*ar;return[(img.width-sw)/2,0,sw,img.height];}const sh=img.width/ar;return[0,(img.height-sh)/2,img.width,sh];}
const tinyC=document.createElement('canvas'),tinyX=tinyC.getContext('2d');
function pixelResolve(img,cx,cy,w,h,q,o={}){const block=Math.max(1,Math.round(80*Math.pow(1-q,2.3)));
  if(block<=1){imgCard(img,cx,cy,w,h,o);return;}
  tinyC.width=Math.ceil(w/block);tinyC.height=Math.ceil(h/block);tinyX.imageSmoothingEnabled=true;tinyX.drawImage(img,0,0,tinyC.width,tinyC.height);
  ctx.save();ctx.imageSmoothingEnabled=false;imgCard(tinyC,cx,cy,w,h,o);ctx.restore();
  // scan line
  const sy=cy-h/2+((q*2.5)%1)*h;const g=ctx.createLinearGradient(0,sy-50,0,sy+4);g.addColorStop(0,'rgba(255,123,32,0)');g.addColorStop(1,'rgba(255,200,150,0.85)');ctx.fillStyle=g;ctx.fillRect(cx-w/2,sy-50,w,54);}
function scanBar(cx,cy,w,h,p){if(p<=0||p>=1)return;const y=cy-h/2+p*h;ctx.save();ctx.globalCompositeOperation='lighter';const g=ctx.createLinearGradient(0,y-70,0,y+6);g.addColorStop(0,'rgba(255,123,32,0)');g.addColorStop(1,'rgba(255,190,120,0.8)');ctx.fillStyle=g;ctx.fillRect(cx-w/2,y-70,w,76);ctx.fillStyle='#FFE2C0';ctx.fillRect(cx-w/2,y,w,3);ctx.restore();}
// place MARO by his visor: visor centre at (x,y) with visor width vw
function maroAt(pose,x,y,vw,o={}){const v=VIS[POSE[pose]];const s=vw/(v.x1-v.x0);drawMaro(pose,x-(v.cx-1024)*s,y-(v.cy-1024)*s,s,o);}
function typingDots(x,y,t,alpha=1){for(let i=0;i<3;i++){const b=Math.max(0,Math.sin(t*9-i*0.9));ctx.save();ctx.globalAlpha=alpha*(0.5+0.5*b);ctx.fillStyle=C.white;ctx.beginPath();ctx.arc(x+(i-1)*22,y-b*6,7,0,6.283);ctx.fill();ctx.restore();}}
// chat message: kind 'user' (right, dark) | 'maro' (left, orange). returns height
function msg(kind,text,xr,y,maxW,t0,t,o={}){const size=o.size||34;const lines=wrapLines(text,size,maxW-70,700);const lh=size*1.55;const w=Math.min(maxW,Math.max(...lines.map(l=>tw(l,size,700)))+70),h=lines.length*lh+40;
  const p=eob(P(t,t0,t0+0.35));if(p<=0)return h;const x=kind==='user'?xr-w:xr-maxW;
  ctx.save();const ox=kind==='user'?x+w:x;ctx.translate(ox,y);ctx.scale(p,p);ctx.translate(-ox,-y);
  if(kind==='user')card(x,y,w,h,{r:26,fill:'rgba(14,7,6,0.95)',stroke:'rgba(196,50,31,0.7)'});else{rr(ctx,x,y,w,h,26);ctx.fillStyle=orangeFill(x,y,w,h);ctx.shadowColor='rgba(255,100,40,0.5)';ctx.shadowBlur=40;ctx.fill();ctx.shadowBlur=0;}
  const reveal=kind==='user'?P(t,t0+0.15,t0+0.15+Math.min(1.0,text.length*0.02)):P(t,t0+0.1,t0+0.1+lines.length*0.25);
  let shown=Math.floor(text.length*reveal);
  lines.forEach((l,i)=>{let s=l;if(kind==='user'){const before=lines.slice(0,i).join(' ').length+(i?1:0);s=l.slice(0,Math.max(0,shown-before));}else{const q=clamp(reveal*lines.length-i);if(q<=0)return;ctx.globalAlpha=q;}
    T(s,x+w-35,y+20+lh*(i+0.5),size,{w:700,align:'right'});ctx.globalAlpha=1;});
  if(o.check&&reveal>=1){const cp=eob(P(t,t0+0.1+lines.length*0.25,t0+0.4+lines.length*0.25));ctx.save();ctx.translate(x+34,y+h/2);ctx.scale(cp,cp);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,20,0,6.283);ctx.fill();ctx.strokeStyle='#C23A20';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-9,0);ctx.lineTo(-2,8);ctx.lineTo(10,-7);ctx.stroke();ctx.restore();}
  ctx.restore();return h;}
// chapter badge (top right, RTL)
function chapter(t,t0,t1,num,ar,en){const a=P(t,t0,t0+0.3)*(1-P(t,t1-0.25,t1));if(a<=0)return;const p=eOutExpo(P(t,t0,t0+0.5));
  ctx.save();ctx.globalAlpha=a;text3D(num,W-150,130,112,{rotY:lerp(-1,0,p),depth:12,alpha:1});
  typeOn(ar,W-245,112,50,t0+0.1,t,{col:C.white,dur:0.4,glow:10});T(en,W-245,165,19,{w:700,ls:8,align:'right',col:'rgba(255,170,110,0.8)',alpha:P(t,t0+0.4,t0+0.7)});ctx.restore();}
function gauge(cx,cy,r,val,max,a=1,col=C.ember){if(a<=0)return;ctx.save();ctx.globalAlpha=a;ctx.lineCap='round';ctx.lineWidth=16;ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,Math.PI*1.5);ctx.stroke();
  ctx.strokeStyle=col;ctx.shadowColor=col;ctx.shadowBlur=24;ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+6.283*val/max);ctx.stroke();ctx.shadowBlur=0;
  T(String(Math.round(val)),cx,cy-8,r*0.8,{w:900});T('/ '+max,cx,cy+r*0.5,r*0.26,{w:700,col:'rgba(255,200,160,0.8)'});ctx.restore();}
function bar(label,val,x,y,w,t0,t){const p=eOutExpo(P(t,t0,t0+0.8));const a=P(t,t0-0.1,t0+0.2);if(a<=0)return;ctx.save();ctx.globalAlpha=a;
  T(label,x+w,y-26,30,{w:700,align:'right'});T(`${(val*p).toFixed(0)}/10`,x,y-26,30,{w:900,align:'left',col:C.ember});
  rr(ctx,x,y,w,16,8);ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fill();const fw=w*val/10*p;rr(ctx,x+w-fw,y,fw,16,8);const g=ctx.createLinearGradient(x+w-fw,0,x+w,0);g.addColorStop(0,'#FFB347');g.addColorStop(1,C.red);ctx.fillStyle=g;ctx.shadowColor=C.ember;ctx.shadowBlur=16;ctx.fill();ctx.restore();}
function promptBox(text,x,y,w,t0,t,o={}){const size=o.size||27;const lines=wrapLines(text,size,w-60,600);const lh=size*1.5;const h=lines.length*lh+90;const a=P(t,t0,t0+0.25);if(a<=0)return;
  ctx.save();ctx.globalAlpha=a;card(x,y,w,h,{fill:'rgba(10,5,4,0.94)',stroke:'rgba(255,123,32,0.6)',glow:30});
  T(o.label||'PROMPT',x+30,y+34,18,{w:900,ls:6,align:'left',col:C.ember});
  const n=Math.floor(text.length*P(t,t0+0.2,t0+0.2+(o.dur||1.4)));let used=0;
  lines.forEach((l,i)=>{const s=l.slice(0,Math.max(0,n-used));used+=l.length+1;T(s,x+30,y+70+lh*(i+0.5),size,{w:600,align:'left',col:'rgba(255,245,238,0.92)'});
    if(s.length>0&&s.length<l.length&&Math.floor(t*10)%2===0){ctx.fillStyle=C.ember;ctx.fillRect(x+30+tw(s,size,600)+4,y+70+lh*i+6,3,size);}});
  ctx.restore();}

// ---------- posters built in code (before / after) ----------
const PB=document.createElement('canvas'),PA=document.createElement('canvas');
function buildPosters(){for(const c of[PB,PA]){c.width=1080;c.height=1350;}
  // BEFORE: cluttered, weak hierarchy, too many colours
  let g=PB.getContext('2d');g.drawImage(IM.V2b,0,0);g.textAlign='center';g.textBaseline='middle';
  g.fillStyle='rgba(255,230,0,0.9)';g.beginPath();for(let i=0;i<24;i++){const a=i/24*6.283,r=i%2?95:130;g.lineTo(880+Math.cos(a)*r,210+Math.sin(a)*r);}g.fill();
  g.font='900 58px Cairo';g.fillStyle='#E0101A';g.fillText('خصم!!',880,200);
  g.font='700 40px Cairo';g.fillStyle='#22C55E';g.fillText('احجز دكتورك دلوقتي وبسرعة',420,150);
  g.font='600 34px Cairo';g.fillStyle='#A855F7';g.fillText('أفضل الدكاترة في كل التخصصات',420,210);
  g.fillStyle='#FF00AA';g.fillRect(40,1130,1000,70);g.font='700 36px Cairo';g.fillStyle='#FFFF00';g.fillText('كل عيادة على بعد موبايل - حمل التطبيق الآن',540,1166);
  g.font='600 26px Cairo';g.fillStyle='#fff';g.fillText('أسنان - عظام - قلب - أطفال - جلدية - باطنة - أنف وأذن - عيون',540,1240);
  g.fillStyle='#00E5FF';g.fillRect(40,1270,1000,50);g.font='700 28px Cairo';g.fillStyle='#E0101A';g.fillText('اتصل الآن  19999  -  خدمة 24 ساعة',540,1296);
  // AFTER: one message, clear hierarchy, room to breathe
  g=PA.getContext('2d');g.drawImage(IM.V2b,0,0);const gr=g.createLinearGradient(0,0,0,560);gr.addColorStop(0,'rgba(8,20,45,0.85)');gr.addColorStop(1,'rgba(8,20,45,0)');g.fillStyle=gr;g.fillRect(0,0,1080,560);
  g.textAlign='center';g.textBaseline='middle';g.fillStyle='#fff';g.font='900 92px Cairo';g.shadowColor='rgba(0,0,0,0.35)';g.shadowBlur=20;g.fillText('كل عيادة..',540,150);g.fillText('على بُعد موبايل',540,265);g.shadowBlur=0;
  g.font='600 34px Cairo';g.fillStyle='rgba(255,255,255,0.85)';g.fillText('الاطمئنان على اللي بتحبهم بقى أقرب',540,360);
  g.beginPath();g.roundRect(390,1215,300,80,40);g.fillStyle=VZ.blue;g.fill();g.font='700 34px Cairo';g.fillStyle='#fff';g.fillText('احجز دلوقتي',540,1256);}

// ---------- student-work grid for the USP ----------
const GRID=[];{const R=rng(21);for(let r=-3;r<=3;r++)for(let c=-5;c<=5;c++)GRID.push({r,c,k:Math.floor(R()*7),ph:R()*6});}
function gridTile(img,x,y,s,lit,a){ctx.save();ctx.globalAlpha=a;const sz=150*s;ctx.translate(x,y-lit*16);rr(ctx,-sz/2,-sz/2,sz,sz,20*s);ctx.save();ctx.clip();const src=coverSrc(img,1,1);ctx.drawImage(img,src[0],src[1],src[2],src[3],-sz/2,-sz/2,sz,sz);
  ctx.fillStyle=`rgba(18,4,3,${0.72-lit*0.6})`;ctx.fillRect(-sz/2,-sz/2,sz,sz);ctx.restore();rr(ctx,-sz/2,-sz/2,sz,sz,20*s);ctx.strokeStyle=`rgba(255,123,32,${0.25+lit*0.75})`;ctx.lineWidth=2+lit*2;if(lit>0.05){ctx.shadowColor=C.ember;ctx.shadowBlur=40*lit;}ctx.stroke();ctx.restore();}

// ================= SHOTS =================
const SCR={tl:[975,320],tr:[1413,337],br:[1392,623],bl:[966,598],cx:1190,cy:470};
function shotHook(t){ // 0 - 4.0
  const push=eInExpo(P(t,2.9,4.0));const s=lerp(1.0,1.12,P(t,0,2.9))*lerp(1,5.2,push);
  ctx.save();ctx.translate(W/2,H/2);ctx.scale(s,s);ctx.translate(-lerp(W/2,SCR.cx,push*0.9+P(t,0,2.9)*0.1),-lerp(H/2,SCR.cy,push*0.9+P(t,0,2.9)*0.1));
  ctx.drawImage(IM.S1,0,0,W,H);
  // laptop screen dims to black glass as we push in (match-cut into MARO's visor)
  const dim=P(t,3.1,3.8);if(dim>0){ctx.fillStyle=`rgba(4,3,3,${dim})`;ctx.beginPath();for(const k of['tl','tr','br','bl'])ctx.lineTo(...SCR[k]);ctx.closePath();ctx.fill();}
  ctx.restore();
  if(t>3.75){ctx.fillStyle=`rgba(3,2,2,${P(t,3.75,4.0)})`;ctx.fillRect(0,0,W,H);}
  const a=1-P(t,2.9,3.2);
  // clock
  ctx.save();ctx.globalAlpha=a*P(t,0.6,0.9);text3D('03:12',260,150,96,{depth:10});T('AM',400,176,26,{w:900,col:C.ember,align:'left'});ctx.restore();
  ctx.save();ctx.globalAlpha=a;
  typeOn('الساعة 3 الفجر..',W-120,770,72,0.7,t,{col:C.white,dur:0.4});
  typeOn('والتسليم الصبح..',W-120,870,72,1.35,t,{col:C.white,dur:0.4});
  typeOn('ومفيش ولا فكرة.',W-120,970,78,2.0,t,{col:C.ember,dur:0.45});
  ctx.restore();}
function shotBoot(t){ // 4.0 - 6.4 (MARO powers on out of the black screen)
  background(t,{glow:P(t,4.0,4.8)});const v=VIS[POSE.M5];const s=lerp(0.7,0.76,P(t,4,6.4));const x=W/2-(v.cx-1024)*s,y=H/2-(v.cy-1024)*s;
  let expr='off',et=0;if(t>=4.15&&t<4.4)expr='power';else if(t>=4.4&&t<5.3)expr='boot';else if(t>=5.3&&t<5.46){expr='collapse';et=t-5.3;}else if(t>=5.46){expr=(t>5.95&&t<6.05)?'blink':'happy';et=t-5.46;}
  drawMaro('M5',x,y,s,{expr,et,t,alpha:P(t,4.0,4.25)});
  if(t>=5.46){const q=P(t,5.46,6.0);ctx.save();ctx.globalCompositeOperation='lighter';glowBlob(W/2,H/2,700*eOut(q)+100,'rgba(255,150,70,0.5)',1-q);ctx.restore();}}
function shotHello(t){ // 6.4 - 9.4
  background(t);watermark(1450-t*12,560,1500,0.5);
  const mx=620,my=600+Math.sin(t*2.4)*14;drawMaro('M2',mx,my,0.44,{rot:Math.sin(t*1.7)*0.03,expr:(t>8.3&&t<8.7)?'wink':'happyB',et:(t>8.3&&t<8.7)?t-8.3:t-6.4,t,thrust:0.8});
  const tx=1330;T('SABER GROUP  ·  AI ASSISTANT',tx,320,24,{w:700,ls:10,col:'rgba(255,190,140,0.75)',alpha:P(t,6.6,6.9)});
  const r3=P(t,6.7,7.3);text3D('أنا مارو',tx,460,176,{rotY:lerp(-1.25,0,eOutExpo(r3))+Math.sin(t*1.3)*0.05,alpha:clamp(r3*3)});
  T('مساعدك الذكي من صابر جروب',tx,610,46,{w:700,alpha:P(t,7.3,7.6),col:'rgba(255,245,238,0.9)'});
  typeOn('معاك.. على طول',tx+tw('معاك.. على طول',80)/2,720,80,7.7,t,{col:C.ember});}
function shotBrainstorm(t){ // 9.4 - 14.4
  background(t);chapter(t,9.45,14.4,'01','عصف ذهني','BRAINSTORM');
  const thinking=t<11.3;maroAt('M3',400,470+Math.sin(t*2)*10,300,{expr:thinking?(t>10.2?'think':'happyB'):(t>13.0?'love':'happy'),et:t-11.3,t,thrust:0.6});
  msg('user','عندي كامبين لفيزيتا لازم يحسس العيلة بالأمان.. ومش لاقي فكرة',W-110,250,900,9.7,t);
  if(t>10.7&&t<11.35)typingDots(W-1000,460,t,P(t,10.7,10.85));
  const ideas=['كل عيادة.. على بُعد موبايل','الاطمئنان على اللي بتحبهم بقى أقرب','دكاترة بتحرس العيلة'];
  ideas.forEach((s,i)=>{const t0=11.35+i*0.28;const p=P(t,t0,t0+0.45);if(p<=0)return;const e=eOutExpo(p);
    const tx=W-110-430,ty=500+i*145;const sx=lerp(400,tx,e),sy=lerp(420,ty,e);const sel=i===0?eob(P(t,12.8,13.2)):0,dim=i>0?P(t,12.8,13.1)*0.55:0;
    ctx.save();ctx.globalAlpha=1-dim;ctx.translate(sx,sy);ctx.scale(lerp(0.3,1,e)*(1+sel*0.06),lerp(0.3,1,e)*(1+sel*0.06));
    if(i===0&&sel>0){rr(ctx,-430,-58,860,116,28);ctx.fillStyle=orangeFill(0,-58,0,116);ctx.shadowColor=C.ember;ctx.shadowBlur=50*sel;ctx.fill();ctx.shadowBlur=0;}
    else card(-430,-58,860,116,{r:28});
    T(String(i+1),380,0,44,{w:900,col:i===0&&sel>0?'#fff':C.ember});T(s,330,2,40,{w:800,align:'right'});
    if(i===0&&sel>0){ctx.save();ctx.translate(-370,0);ctx.scale(sel,sel);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,26,0,6.283);ctx.fill();ctx.strokeStyle='#C23A20';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(-3,9);ctx.lineTo(12,-9);ctx.stroke();ctx.restore();}
    ctx.restore();});}
function shotBrief(t){ // 14.4 - 18.4
  background(t);chapter(t,14.45,18.4,'02','بريف إعلاني جاهز','GENERATE BRIEF');
  maroAt('M1',340,520+Math.sin(t*2.2)*10,250,{expr:t<17.3?'scan':'check',et:t-17.3,t,thrust:0.6});
  const x=700,y=250,w=1110,h=640;const a=eOutExpo(P(t,14.5,15.0));ctx.save();ctx.translate(x+w/2,y+h/2);ctx.scale(lerp(0.8,1,a),lerp(0.8,1,a));ctx.translate(-(x+w/2),-(y+h/2));
  card(x,y,w,h,{alpha:a,glow:40});ctx.globalAlpha=a;
  T('BRIEF  ·  VEZEETA FAMILY CAMPAIGN',x+40,y+50,20,{w:900,ls:6,align:'left',col:C.ember});T('بريف الكامبين',x+w-40,y+52,34,{w:900,align:'right'});
  ctx.fillStyle='rgba(255,123,32,0.35)';ctx.fillRect(x+40,y+92,w-80,2);
  const rows=[['البراند','فيزيتا'],['الجمهور','العيلة المصرية 25 – 45'],['الرسالة','كل عيادة.. على بُعد موبايل'],['النبرة','دافية ومطمّنة'],['المطلوب','كي فيجوال + 3 بوستات تخصصات + ستوري']];
  rows.forEach(([k,v],i)=>{const t0=15.0+i*0.38,yy=y+160+i*100;const ra=P(t,t0,t0+0.2);if(ra<=0)return;ctx.save();ctx.globalAlpha*=ra;
    ctx.fillStyle=C.ember;ctx.beginPath();ctx.arc(x+w-50,yy,7,0,6.283);ctx.fill();T(k,x+w-75,yy,32,{w:800,align:'right',col:'rgba(255,190,140,0.95)'});ctx.restore();
    typeOn(v,x+w-270,yy,34,t0+0.05,t,{col:C.white,w:700,dur:0.3,glow:0});
    ctx.fillStyle='rgba(255,255,255,0.06)';ctx.fillRect(x+40,yy+46,w-80,1);});
  ctx.restore();}
const V1_PROMPT='Studio-style healthcare campaign portrait of a warm Egyptian multigenerational family against a saturated blue background. The father sits centrally while the mother, grandparents, boy and girl gather close, smiling. Pink and cyan floor lighting, polished commercial realism, premium advertising finish.';
const V2_PROMPT='Cinematic realistic advertising photograph for a healthcare booking app. A warm, sunlit Egyptian family living room. A smartphone lies flat on the rug, and a miniature doctor\'s clinic rises out of its glowing screen like a living diorama. The father leans in and talks with a tiny friendly doctor...';
function shotImg2Prompt(t){ // 18.4 - 21.2
  background(t);chapter(t,18.45,26.8,'03','أدوات الصور بالـ AI','AI IMAGE TOOLS');
  pill('Image  →  Prompt',520,265,26,{w:900,alpha:P(t,18.6,18.9),ls:2});
  const a=eOutExpo(P(t,18.5,19.0));imgCard(IM.V1,520+(1-a)*-300,560,780,439,{rotY:0.22,alpha:a});
  scanBar(520,560,780,439,P(t,19.0,19.9));
  maroAt('M5',185,860,150,{expr:'scan',t,alpha:a});
  promptBox(V1_PROMPT,1000,380,820,19.5,t,{dur:1.4,label:'PROMPT  ·  EXTRACTED'});}
function shotPromptGen(t){ // 21.2 - 23.4
  background(t);chapter(t,18.45,26.8,'03','أدوات الصور بالـ AI','AI IMAGE TOOLS');
  pill('Prompt Generator',W/2,210,26,{w:900,alpha:P(t,21.3,21.6),ls:2});
  msg('user','موبايل نايم على أرض الصالة وطالع منه عيادة صغيرة.. والعيلة حواليه',W/2+560,290,1120,21.35,t,{size:36});
  const ar=eOutExpo(P(t,21.9,22.2));ctx.save();ctx.globalAlpha=ar;ctx.strokeStyle=C.ember;ctx.lineWidth=5;ctx.shadowColor=C.ember;ctx.shadowBlur=20;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(W/2,440);ctx.lineTo(W/2,440+60*ar);ctx.moveTo(W/2-18,480);ctx.lineTo(W/2,500);ctx.lineTo(W/2+18,480);ctx.stroke();ctx.restore();
  promptBox(V2_PROMPT,W/2-560,530,1120,22.0,t,{dur:1.2,size:28,label:'PROMPT  ·  GENERATED BY MARO'});
  maroAt('M5',170,880,150,{expr:t<22.9?'think':'check',et:t-22.9,t});}
function shotGenerate(t){ // 23.4 - 26.8
  background(t);chapter(t,18.45,26.8,'03','أدوات الصور بالـ AI','AI IMAGE TOOLS');
  pill('Image Generation',W/2,190,26,{w:900,alpha:P(t,23.5,23.8),ls:2});
  const split=eInOut(P(t,25.3,25.9));const bw=lerp(1150,780,split),bh=bw*9/16,cx=lerp(W/2,W/2-420,split),cy=560;
  const q=P(t,23.7,25.0);if(t<23.7){card(cx-bw/2,cy-bh/2,bw,bh,{fill:'rgba(10,5,4,0.9)'});}else pixelResolve(IM.V2a,cx,cy,bw,bh,q);
  if(q>0&&q<1)T(`AI GENERATING  ${Math.floor(eOut(q)*100)}%`,W/2,cy+bh/2+50,24,{w:700,ls:8,col:C.gold||'#FFB070'});
  if(split>0)imgCard(IM.V3,W/2+420+(1-split)*500,cy,780,439,{alpha:split});
  if(t>=25.0){const fl=Math.exp(-(t-25.0)*7);if(fl>0.02){ctx.save();ctx.globalCompositeOperation='lighter';glowBlob(cx,cy,900,`rgba(255,220,190,${0.8*fl})`,1);ctx.restore();}}
  if(split>0.5)T('نتيجتين.. من برومبت واحد',W/2,cy+300,40,{w:800,alpha:P(t,25.8,26.1)});
  maroAt('M5',170,880,150,{expr:t<25.0?'scan':'wow',et:t-25.0,t});}
function shotCritique(t){ // 26.8 - 32.8
  background(t);chapter(t,26.85,32.8,'04','قيّملي تصميمي','RATE MY DESIGN');
  const after=P(t,29.6,30.1);const pw=600,ph=750,cx=560,cy=585;const a=eOutExpo(P(t,26.9,27.4));
  imgCard(PB,cx,cy,pw,ph,{rotY:0.14,alpha:a});
  if(after>0){ctx.save();ctx.beginPath();const cutY=cy-ph/2-40+after*(ph+80);ctx.rect(0,0,W,cutY);ctx.clip();imgCard(PA,cx,cy,pw,ph,{rotY:0.14,border:'rgba(255,190,120,0.9)'});ctx.restore();scanBar(cx,cy,pw,ph,after);}
  T(after<1?'قبل':'بعد تعديلات مارو',cx,cy-ph/2-38,34,{w:900,col:after<1?'rgba(255,255,255,0.8)':C.ember,alpha:a});
  const notes=[[cx-60,cy-300,'العنوان تايه.. كبّره وخليه أول حاجة العين تشوفها'],[cx+200,cy-340,'ألوان كتير.. ثبّت على لون واحد'],[cx,cy+280,'التصميم محتاج يتنفس.. سيب مساحة فاضية']];
  const na=1-P(t,29.5,29.8);
  notes.forEach(([px,py,s],i)=>{const t0=27.7+i*0.45;const p=eob(P(t,t0,t0+0.35));if(p<=0||na<=0)return;const ny=300+i*150;ctx.save();ctx.globalAlpha=na;
    ctx.strokeStyle=C.ember;ctx.lineWidth=3;ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(lerp(px,1000,eOut(P(t,t0,t0+0.4))),ny);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=C.ember;ctx.shadowColor=C.ember;ctx.shadowBlur=20;ctx.beginPath();ctx.arc(px,py,26*p,0,6.283);ctx.fill();ctx.shadowBlur=0;T(String(i+1),px,py+2,30*p,{w:900});
    ctx.translate(1000,ny);ctx.scale(p,p);card(0,-52,840,104,{r:24});T(s,810,2,29,{w:700,align:'right'});ctx.restore();});
  const score=t<30.1?6*eOut(P(t,28.9,29.4)):lerp(6,9,eOut(P(t,30.1,30.9)));gauge(1560,760,110,score,10,P(t,28.9,29.2),t<30.1?'#FF5A2A':C.ember);
  if(t>30.2)T('+3 نقط',1560,930,40,{w:900,col:C.ember,alpha:P(t,30.3,30.6)});
  maroAt('M5',1160,780,170,{expr:t<30.2?'scan':'love',et:t-30.2,t,alpha:P(t,28.8,29.1)});}
function shotAnalyze(t){ // 32.8 - 37.0
  background(t);chapter(t,32.85,37.0,'05','حلل تصميم وتعلم منه','ANALYZE & LEARN');
  const cx=560,cy=585,pw=600,ph=750;const a=eOutExpo(P(t,32.9,33.4));const ex=eOutExpo(P(t,33.3,33.9));
  // exploded layers
  for(let k=2;k>=1;k--){ctx.save();ctx.globalAlpha=0.25*ex;imgCard(IM.V4,cx-k*40*ex,cy-k*22*ex,pw,ph,{rotY:0.2,shadow:false,border:'rgba(255,123,32,0.6)'});ctx.restore();}
  imgCard(IM.V4,cx+20*ex,cy+12*ex,pw,ph,{rotY:0.2,alpha:a});
  const gx=cx+20*ex,gy=cy+12*ex;const ga=P(t,33.8,34.1);
  if(ga>0){ctx.save();ctx.globalAlpha=ga;ctx.translate(gx,gy);ctx.transform(Math.cos(0.2),Math.sin(0.2)*0.16,0,1,0,0);ctx.strokeStyle='rgba(255,200,150,0.85)';ctx.lineWidth=2;ctx.setLineDash([10,8]);
    for(const f of[1/3,2/3]){ctx.beginPath();ctx.moveTo(-pw/2+pw*f,-ph/2);ctx.lineTo(-pw/2+pw*f,ph/2);ctx.stroke();ctx.beginPath();ctx.moveTo(-pw/2,-ph/2+ph*f);ctx.lineTo(pw/2,-ph/2+ph*f);ctx.stroke();}ctx.setLineDash([]);
    [[0,160,'1'],[-150,-120,'2'],[0,-300,'3']].forEach(([x,y,n],i)=>{const p=eob(P(t,34.1+i*0.15,34.4+i*0.15));ctx.fillStyle=C.ember;ctx.shadowColor=C.ember;ctx.shadowBlur=18;ctx.beginPath();ctx.arc(x,y,24*p,0,6.283);ctx.fill();ctx.shadowBlur=0;T(n,x,y+2,28*p,{w:900});});ctx.restore();}
  // palette
  const sw=[VZ.blue,VZ.sky,VZ.ice,VZ.rose,VZ.ink];sw.forEach((c,i)=>{const p=eob(P(t,34.3+i*0.08,34.6+i*0.08));if(p<=0)return;ctx.save();ctx.translate(1040+i*120,300);ctx.scale(p,p);rr(ctx,-48,-48,96,96,20);ctx.fillStyle=c;ctx.fill();ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=2;ctx.stroke();ctx.restore();T(c,1040+i*120,370,17,{w:700,col:'rgba(255,220,200,0.7)',alpha:p>0?1:0});});
  T('الباليتة',1760,300,32,{w:900,align:'right',alpha:P(t,34.3,34.6)});
  const lessons=[['التكوين','قاعدة الأثلاث.. العيلة في التلتين اللي تحت'],['الترتيب','العيلة ← الدكاترة ← مساحة العنوان'],['الفكرة','دكاترة بتحرس العيلة.. الأمان من غير كلام']];
  lessons.forEach(([k,v],i)=>{const t0=34.8+i*0.4;const p=eOutExpo(P(t,t0,t0+0.4));if(p<=0)return;const y=500+i*140;ctx.save();ctx.globalAlpha=p;ctx.translate((1-p)*80,0);card(1000,y-55,820,110,{r:24});
    T(k,1790,y-16,26,{w:900,align:'right',col:C.ember});T(v,1790,y+22,30,{w:700,align:'right'});ctx.restore();});
  maroAt('M5',1100,930,130,{expr:'scan',t,alpha:P(t,33.0,33.3)});}
function shot247(t){ // 37.0 - 43.0
  background(t);chapter(t,37.05,43.0,'06','مارو صاحي 24 ساعة','ALWAYS ON');
  const roll=eInOut(P(t,39.7,40.2));const clockA=P(t,37.1,37.4);
  ctx.save();ctx.globalAlpha=clockA;ctx.beginPath();ctx.rect(80,330,760,240);ctx.clip();
  text3D('03:12',440,450-roll*240,190,{depth:16});T('AM',720,510-roll*240,40,{w:900,col:C.ember});
  text3D('11:40',440,690-roll*240,190,{depth:16});T('PM',720,750-roll*240,40,{w:900,col:C.ember});ctx.restore();
  maroAt('M5',450,780,200,{expr:t<38.6?'think':(t<39.6?'check':(t<41.5?'think':'love')),et:t<39.6?t-38.6:t-41.5,t,alpha:clockA});
  // phone-style chat panel
  const px=980,py=210,pw=840,ph=790;card(px,py,pw,ph,{r:40,alpha:P(t,37.1,37.4),glow:30});
  ctx.save();ctx.beginPath();ctx.rect(px+10,py+80,pw-20,ph-90);ctx.clip();const scroll=eInOut(P(t,40.0,40.5))*390;ctx.translate(0,-scroll);
  T('MARO',px+pw/2,py+40+scroll,20,{w:900,ls:8,col:C.ember,alpha:P(t,37.1,37.4)});
  const h1=msg('user','الصورة بتبوظ وتتكسر لما أكبّرها في البوستر!',px+pw-30,py+110,700,37.4,t);
  if(t>38.0&&t<38.5)typingDots(px+90,py+150+h1,t);
  msg('maro','حوّلها Smart Object قبل ما تعمل Scale.. وهتفضل محافظة على جودتها',px+30+740,py+140+h1,740,38.5,t,{check:true});
  const y2=py+500;msg('user','لو فاتتني محاضرة؟',px+pw-30,y2,700,40.5,t);
  if(t>41.0&&t<41.5)typingDots(px+90,y2+130,t);
  msg('maro','ولا يهمك.. كل المحاضرات بتتسجل وتفضل معاك حتى بعد الكورس',px+30+740,y2+110,740,41.5,t,{check:true});
  ctx.restore();}
function shotCoach(t){ // 43.0 - 48.0
  background(t);chapter(t,43.05,48.0,'07','المدرب مارو','COACH MARO');
  const a=eOutExpo(P(t,43.1,43.6));const bx=90,by=250,bw=1080,bh=700;
  ctx.save();ctx.globalAlpha=a;ctx.translate(bx+bw/2,by+bh/2);ctx.transform(Math.cos(0.12),Math.sin(0.12)*0.16,0,1,0,0);ctx.translate(-(bx+bw/2),-(by+bh/2));
  card(bx,by,bw,bh,{r:32,glow:30});T('مشروع التخرج',bx+bw-40,by+50,36,{w:900,align:'right'});T('VEZEETA  ·  FAMILY CAMPAIGN',bx+40,by+52,20,{w:900,ls:6,align:'left',col:C.ember});
  [IM.V5,IM.V6,IM.V7].forEach((im,i)=>{const p=eOutExpo(P(t,43.4+i*0.15,43.9+i*0.15));const w=300,h=375;imgCard(im,bx+bw-40-w/2-i*(w+30),by+130+h/2+(1-p)*80,w,h,{alpha:p,shadow:false,r:16});});
  T('أسنان',bx+bw-40-150,by+560,28,{w:700,alpha:P(t,43.9,44.2)});T('عظام',bx+bw-40-150-330,by+560,28,{w:700,alpha:P(t,44.0,44.3)});T('قلب',bx+bw-40-150-660,by+560,28,{w:700,alpha:P(t,44.1,44.4)});
  ctx.restore();
  const sx=1230,sy=250,sw=620,sh=700;card(sx,sy,sw,sh,{r:32,alpha:P(t,43.6,43.9),glow:30});
  ctx.save();ctx.globalAlpha=P(t,43.6,43.9);T('تقييم المدرب مارو',sx+sw-40,sy+52,34,{w:900,align:'right'});maroAt('M5',sx+70,sy+55,70,{expr:t<46.4?'scan':'fire',et:t-46.4,t});ctx.restore();
  bar('الفكرة',9,sx+40,sy+170,sw-80,44.2,t);bar('الهوية البصرية',8,sx+40,sy+280,sw-80,44.5,t);bar('التسويق',7,sx+40,sy+390,sw-80,44.8,t);
  const tp=eob(P(t,45.6,46.0));if(tp>0){ctx.save();ctx.translate(sx+sw/2,sy+560);ctx.scale(tp,tp);rr(ctx,-sw/2+30,-90,sw-60,180,24);ctx.fillStyle=orangeFill(0,-90,0,180);ctx.shadowColor=C.ember;ctx.shadowBlur=40;ctx.fill();ctx.shadowBlur=0;
    T('نصيحة مارو',sw/2-60,-50,26,{w:900,align:'right',col:'rgba(255,240,230,0.9)'});T('ضيف بوست للتطبيق نفسه',sw/2-60,5,34,{w:800,align:'right'});T('يقفل السلسلة.. هتفرق جامد',sw/2-60,52,34,{w:800,align:'right'});ctx.restore();}}
function shotUSP(t){ // 48.0 - 53.6
  background(t,{glow:1.1});
  const imgs=[IM.V1,IM.V2a,IM.V3,IM.V4,IM.V5,IM.V6,IM.V7];const pan=(t-48)*60;
  const bx=W/2+Math.cos((t-48)*1.3)*520,by=H/2+Math.sin((t-48)*2.1)*260;  // MARO's light-ball
  ctx.save();ctx.filter=`blur(${lerp(0,3,P(t,48.6,49.2))}px)`;
  for(const g of GRID){const x=W/2+g.c*185-pan,y=H/2+g.r*185+40;if(x<-150||x>W+150)continue;const d=Math.hypot(x-bx,y-by);const lit=Math.exp(-(d*d)/(2*140*140));const a=P(t,48.0+Math.abs(g.c)*0.05,48.4+Math.abs(g.c)*0.05)*(0.35+0.65*Math.exp(-(Math.hypot(g.c*0.6,g.r)**2)/12));gridTile(imgs[g.k],x,y,1,lit,a);}
  ctx.restore();
  ctx.save();ctx.globalCompositeOperation='lighter';glowBlob(bx,by,160,'rgba(255,170,90,0.95)',P(t,48.2,48.5));glowBlob(bx,by,40,'rgba(255,240,220,1)',P(t,48.2,48.5));ctx.restore();
  ctx.fillStyle='rgba(18,4,3,0.55)';ctx.fillRect(0,H/2-230,W,460);
  const r3=P(t,48.6,49.1);text3D('المكان الوحيد',W/2,H/2-110,150,{rotY:lerp(-1.1,0,eOutExpo(r3)),alpha:clamp(r3*3),depth:18});
  const s1='اللي بيديلك مساعد ذكي شخصي..';typeOn(s1,W/2+tw(s1,60,800)/2,H/2+40,60,49.5,t,{col:C.white,w:800});
  const s2='معاك 24 ساعة.. طول الكورس وبعده';typeOn(s2,W/2+tw(s2,64)/2,H/2+140,64,50.6,t,{col:C.ember});
  const fly=P(t,52.4,53.6);if(fly>0){const mx=lerp(-300,W+300,eInOut(fly));maroAt('M2',mx,300+Math.sin(fly*6)*40,160,{expr:'happy',t,thrust:1.6,rot:0.25});}}
function coupon(cx,cy,t,t0,a=1){const cp=P(t,t0,t0+0.35);if(cp<=0)return;const e=eob(cp);const sc=lerp(1.5,1,e);
  ctx.save();ctx.globalAlpha=a*clamp(cp*2.5);ctx.translate(cx,cy);ctx.rotate((1-eOutExpo(cp))*0.1);ctx.scale(sc,sc);const w=820,h=150,split=w/2-280;
  rr(ctx,-w/2,-h/2,w,h,24);const g=ctx.createLinearGradient(-w/2,0,w/2,0);g.addColorStop(0,'#7a140b');g.addColorStop(0.35,C.red);g.addColorStop(1,C.ember);ctx.fillStyle=g;ctx.shadowColor=C.ember;ctx.shadowBlur=50;ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle=C.bg;for(const y of[-h/2,h/2]){ctx.beginPath();ctx.arc(-split,y,18,0,6.283);ctx.fill();}
  ctx.setLineDash([10,10]);ctx.strokeStyle='rgba(255,247,242,0.6)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-split,-h/2+24);ctx.lineTo(-split,h/2-24);ctx.stroke();ctx.setLineDash([]);
  const mid=(w/2-split)/2;T('خصم إضافي',mid,-36,30,{w:700,col:'rgba(255,247,242,0.9)'});T('400 جنيه',mid,24,74,{w:900});
  const lm=(-w/2-split)/2;const secs=172799-Math.max(0,Math.floor(t-t0));const hh=String(Math.floor(secs/3600)).padStart(2,'0'),mm=String(Math.floor(secs%3600/60)).padStart(2,'0'),ss=String(secs%60).padStart(2,'0');
  T('لمدة 48 ساعة',lm,-36,26,{w:700,col:'rgba(255,247,242,0.85)'});T(`${hh}:${mm}:${ss}`,lm,22,48,{w:900,ls:2});ctx.restore();}
function shotCTA(t){ // 53.6 - 60
  background(t,{glow:1.3});watermark(1500,540,1500,0.35);
  const endP=eInOut(P(t,57.3,58.0));
  ctx.save();ctx.globalAlpha=1-endP;
  const inn=eOutExpo(P(t,53.6,54.2));maroAt('M2',lerp(-200,520,inn),470+Math.sin(t*2.4)*14,300,{expr:t<55.0?'happy':'fire',et:t-55.0,t,thrust:0.9});
  const r3=P(t,54.0,54.6);text3D('جرّب مارو دلوقتي',1260,260,120,{rotY:lerp(-1.1,0,eOutExpo(r3)),alpha:clamp(r3*3),depth:16});
  T('المساعد الذكي المدعوم بالذكاء الاصطناعي',1260,390,40,{w:700,alpha:P(t,54.6,54.9)});T('من صابر جروب',1260,445,40,{w:900,col:C.ember,alpha:P(t,54.8,55.1)});
  coupon(1260,610,t,55.2);
  const up=eOutExpo(P(t,56.0,56.3));if(up>0){const url='ai.sabergroupacademy.com';const n=Math.floor(url.length*P(t,56.1,56.8));ctx.save();ctx.translate(1260,790);ctx.scale(up,up);rr(ctx,-400,-44,800,88,44);ctx.fillStyle='rgba(255,255,255,0.06)';ctx.fill();ctx.strokeStyle='rgba(255,176,112,0.8)';ctx.lineWidth=2.5;ctx.shadowColor=C.ember;ctx.shadowBlur=30;ctx.stroke();ctx.shadowBlur=0;
    const full=tw(url,42,900,1);T(url.slice(0,n),-full/2,2,42,{w:900,align:'left',ls:1});ctx.restore();}
  ctx.restore();
  // end card: slides up and morphs to full screen (reference outro)
  if(t>=57.0){const p=eOutExpo(P(t,57.0,57.6)),m=eInOut(P(t,57.6,58.3));const cw=lerp(700,W,m),ch=lerp(420,H,m),cy=lerp(H+260,H/2,p)*(1-m)+H/2*m;
    ctx.save();rr(ctx,W/2-cw/2,cy-ch/2,cw,ch,lerp(32,0,m));ctx.clip();ctx.fillStyle='#0d0302';ctx.fillRect(0,0,W,H);
    const g=ctx.createRadialGradient(W/2,cy+ch*0.4,0,W/2,cy+ch*0.4,ch);g.addColorStop(0,'rgba(196,50,31,0.55)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    const k=ch/H;ctx.translate(W/2,cy);ctx.scale(k,k);
    const L=260;ctx.save();ctx.shadowColor='rgba(196,50,31,0.8)';ctx.shadowBlur=60;rr(ctx,-L/2,-330,L,L,52);ctx.clip();ctx.drawImage(IM.logo,-L/2,-330,L,L);ctx.restore();
    T('معاك.. على طول',0,50,96,{w:900,glow:30});T('ai.sabergroupacademy.com',0,160,40,{w:800,col:C.ember,ls:1});
    maroAt('M5',0,340,150,{expr:t>59.0&&t<59.4?'wink':'happy',et:t-59.0,t});ctx.restore();}}

const SHOTS=[[0,4.0,shotHook,'cut'],[4.0,6.4,shotBoot,'cut'],[6.4,9.4,shotHello,'whipL'],[9.4,14.4,shotBrainstorm,'whipL'],[14.4,18.4,shotBrief,'whipU'],
  [18.4,21.2,shotImg2Prompt,'whipL'],[21.2,23.4,shotPromptGen,'whipL'],[23.4,26.8,shotGenerate,'whipL'],[26.8,32.8,shotCritique,'whipU'],[32.8,37.0,shotAnalyze,'whipL'],
  [37.0,43.0,shot247,'whipU'],[43.0,48.0,shotCoach,'whipL'],[48.0,53.6,shotUSP,'zoom'],[53.6,60.01,shotCTA,'whipL']];
function scene(t){
  let i=SHOTS.findIndex(s=>t>=s[0]&&t<s[1]);if(i<0)i=SHOTS.length-1;const[t0,t1,fn]=SHOTS[i];const nxt=SHOTS[i+1];
  let ox=0,oy=0,sc=1;
  const outT=0.2,inT=0.26;
  if(nxt&&nxt[3]!=='cut'&&t>t1-outT){const p=eInExpo(P(t,t1-outT,t1));if(nxt[3]==='whipL')ox=-p*W*1.2;else if(nxt[3]==='whipU')oy=-p*H*1.3;else sc=1+p*3;}
  if(SHOTS[i][3]!=='cut'&&t<t0+inT){const p=1-eOutExpo(P(t,t0,t0+inT));if(SHOTS[i][3]==='whipL')ox=p*W*1.2;else if(SHOTS[i][3]==='whipU')oy=p*H*1.3;else sc=1-p*0.6;}
  ctx.save();ctx.translate(W/2+ox,H/2+oy);ctx.scale(sc,sc);ctx.translate(-W/2,-H/2);fn(t);ctx.restore();
  if(t<0.8&&!window.NOTEAR)tearOverlay(t);
  // fade out
  const fo=P(t,59.7,60);if(fo>0){ctx.fillStyle=`rgba(0,0,0,${fo})`;ctx.fillRect(0,0,W,H);}}
function nSub(t){for(const s of SHOTS){if(s[3]!=='cut'&&Math.abs(t-s[0])<0.3)return 12;}if(t<0.8)return 6;if(t>52.3&&t<53.7)return 8;if(t>2.9&&t<4.0)return 8;return 3;}

// ================= render hooks =================
const grains=[];{const R=rng(7);for(let k=0;k<6;k++){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');const d=g.createImageData(256,256);for(let i=0;i<d.data.length;i+=4){const v=R()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255;}g.putImageData(d,0,0);grains.push(c);}}
function post(f){const v=out.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*1.0);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,0.55)');out.fillStyle=v;out.fillRect(0,0,W,H);
  out.save();out.globalAlpha=0.06;out.globalCompositeOperation='overlay';out.translate((f*37)%256,(f*91)%256);out.fillStyle=out.createPattern(grains[f%6],'repeat');out.fillRect(-256,-256,W+512,H+512);out.restore();}
window.renderFrame=function(f){const t0=f/FPS,N=nSub(t0),shutter=0.5/FPS;out.fillStyle='#000';out.fillRect(0,0,W,H);
  for(let k=0;k<N;k++){const t=Math.max(0,t0+(N>1?(k/(N-1)-0.5)*shutter:0));ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';
    ctx.translate(W/2,H/2);ctx.rotate(Math.sin(t*0.35)*0.005);const z=1.02+Math.sin(t*0.25)*0.01;ctx.scale(z,z);ctx.translate(-W/2+Math.sin(t*0.4)*8,-H/2+Math.cos(t*0.33)*5);
    scene(t);out.globalAlpha=1/(k+1);out.drawImage(sub,0,0);}
  out.globalAlpha=1;post(f);};
window.ready=(async()=>{
  await Promise.all([600,700,800,900].flatMap(w=>[document.fonts.load(`${w} 40px Cairo`,'مارو'),document.fonts.load(`${w} 40px Cairo`,'AI')]));
  for(const[k,n]of Object.entries(POSE)){IMG[k]=await load(n+'.png');VM[k]=await load(n+'_vmask.png');const v=VIS[n];const c=document.createElement('canvas');c.width=v.x1-v.x0+1;c.height=v.y1-v.y0+1;FACE[k]=c;}
  LOGO=await load('logo_white.png');
  WATER=document.createElement('canvas');WATER.width=WATER.height=2048;const w=WATER.getContext('2d');w.filter='blur(10px)';w.drawImage(IMG.M5,0,0);w.filter='none';w.globalCompositeOperation='source-in';w.fillStyle='#4a0d07';w.fillRect(0,0,2048,2048);
  const files={S1:'S1_scene_3am_desk.png',V1:'V1_image_to_prompt_source.jpg',V2a:'V2a_prompt_result_16x9.png',V2b:'V2b_prompt_result_4x5.png',V3:'V3_prompt_result_variation.png',V4:'V4_pro_ad_hologram_doctors.png',V5:'V5_series_dental.png',V6:'V6_series_orthopedics.png',V7:'V7_series_cardiology.png',logo:'logo.png'};
  for(const[k,f]of Object.entries(files))IM[k]=await load(f);
  buildPosters();return true;})();

function tearOverlay(t){if(t>=0.78)return;const open=t<0.12?7:lerp(7,H*0.78,eInOut(P(t,0.12,0.74)));const R=rng(11);
  const jag=Array.from({length:10},()=>(R()-0.5)*80);const jag2=Array.from({length:10},()=>(R()-0.5)*80);const tilt=-0.035;
  const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#FF8A2A');g.addColorStop(1,'#F06A10');
  const edge=(sign,j)=>{const pts=[];for(let k=0;k<=9;k++){const x=k*W/9;pts.push([x,H/2+sign*open/2+j[k]*(0.4+open/H)+ (x-W/2)*tilt]);}return pts;};
  const top=edge(-1,jag),bot=edge(1,jag2);
  ctx.save();ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(W,-10);for(let k=9;k>=0;k--)ctx.lineTo(top[k][0],top[k][1]);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(0,H+10);ctx.lineTo(W,H+10);for(let k=9;k>=0;k--)ctx.lineTo(bot[k][0],bot[k][1]);ctx.closePath();ctx.fill();
  ctx.lineWidth=10;ctx.strokeStyle='rgba(60,10,4,0.35)';for(const e of[top,bot]){ctx.beginPath();e.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}ctx.restore();}

