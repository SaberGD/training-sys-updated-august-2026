// ================= MARO AI APP PROMO (32s, 16:9 + native 9:16 via ?v) =================
// A phone plays the real app screenshots (app/*.png, 590x1280) while a user logs in, taps, types, scrolls and gets answers.
const eob=x=>Math.max(0,eOutBack(x));const LV=(h,v)=>VERT?v:h;const DUR=32;
const IM={};
function maroAt(pose,x,y,vw,o={}){const v=VIS[POSE[pose]];const s=vw/(v.x1-v.x0);drawMaro(pose,x-(v.cx-1024)*s,y-(v.cy-1024)*s,s,o);}
function wrapLines(s,size,maxW,w=700,c=ctx){const words=s.split(' ');const lines=[];let cur='';for(const wd of words){const tr=cur?cur+' '+wd:wd;c.save();setFont(c,tr,size,w,0);const m=c.measureText(tr).width;c.restore();if(m>maxW&&cur){lines.push(cur);cur=wd;}else cur=tr;}if(cur)lines.push(cur);return lines;}
function pill(s,cx,cy,size,o={}){const{fill='rgba(196,50,31,0.16)',stroke='rgba(255,123,32,0.7)',col=C.white,alpha=1,sc=1,w=800,pad=30}=o;if(alpha<=0||sc<=0)return;const pw=tw(s,size,w)+pad*2,ph=size*1.9;
  ctx.save();ctx.globalAlpha*=alpha;ctx.translate(cx,cy);ctx.scale(sc,sc);rr(ctx,-pw/2,-ph/2,pw,ph,ph/2);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();T(s,0,2,size,{w,col});ctx.restore();}
// kinetic line: rises out of a mask, optional exit at t1
function kline(s,x,y,size,t0,t,o={}){const p=eOutExpo(P(t,t0,t0+0.55));if(p<=0)return;const q=o.t1?eIn(P(t,o.t1,o.t1+0.3)):0;if(q>=1)return;
  ctx.save();ctx.beginPath();ctx.rect(-4000,y-size*0.9,9000,size*1.75);ctx.clip();T(s,x,y+(1-p)*size*1.4-q*size*1.4,size,{...o,alpha:(o.alpha??1)*(1-q)});ctx.restore();}

// ================= screen canvas (screenshot pixel space, 2x supersampled) =================
const SW=590,SH=1280,SS=2;const scr=document.createElement('canvas');scr.width=SW*SS;scr.height=SH*SS;const sx=scr.getContext('2d');
function ST(s,x,y,size,o={}){const{w=600,col='#F4EEEA',align='right',alpha=1}=o;if(alpha<=0||!s)return;sx.save();sx.globalAlpha*=alpha;setFont(sx,s,size,w,0);sx.textAlign=align;sx.textBaseline='middle';sx.fillStyle=col;sx.fillText(s,x,y);sx.restore();}
function sw(s,size,w=600){sx.save();setFont(sx,s,size,w,0);const m=sx.measureText(s).width;sx.restore();return m;}
const typed=(s,t,t0,t1)=>s.slice(0,Math.round(s.length*P(t,t0,t1)));
const blink=t=>Math.floor(t*2.2)%2===0;
function fillR(x,y,w,h,col){sx.fillStyle=col;sx.fillRect(x,y,w,h);}
function caret(x,y,h,t,on=true){if(!on||!blink(t))return;sx.fillStyle='#FF7B20';sx.fillRect(x,y-h/2,2.4,h);}
// finger tap: approach ring -> press dot -> ripple
function tap(x,y,t,t0){const d=t-t0;if(d<-0.35||d>0.6)return;sx.save();
  if(d<0){const p=eOut(P(d,-0.35,0));sx.globalAlpha=p*0.9;sx.strokeStyle='rgba(255,255,255,0.9)';sx.lineWidth=3;sx.beginPath();sx.arc(x,y,lerp(60,26,p),0,6.283);sx.stroke();}
  else{const a=1-P(d,0.15,0.6);sx.globalAlpha=a;sx.fillStyle='rgba(255,255,255,0.55)';sx.beginPath();sx.arc(x,y,24*(1-0.15*Math.sin(Math.min(1,d/0.15)*Math.PI)),0,6.283);sx.fill();
    const r=eOut(P(d,0,0.5));sx.globalAlpha=(1-r)*0.9;sx.strokeStyle='#FF7B20';sx.lineWidth=4;sx.beginPath();sx.arc(x,y,26+r*70,0,6.283);sx.stroke();}
  sx.restore();}

// ---------- screens ----------
function sLogin(t){sx.drawImage(IM.login,0,0);
  if(t>1.1){fillR(58,664,436,52,'rgb(21,17,14)');const s=typed('SG-1001',t,1.15,1.8);ST(s,484,690,19,{w:700});caret(488,690,24,t,t<1.95);}
  if(t>2.0){fillR(58,785,436,52,'rgb(17,17,17)');const n=Math.round(8*P(t,2.05,2.45));sx.fillStyle='#F4EEEA';for(let i=0;i<n;i++){sx.beginPath();sx.arc(480-i*13,811,4.2,0,6.283);sx.fill();}caret(480-n*13-6,811,24,t,t<2.6);}
  const pr=t>2.6&&t<2.85?1-P(t,2.6,2.85):0;if(pr>0){sx.save();sx.globalAlpha=pr*0.35;rr(sx,44,868,503,64,12);sx.fillStyle='#fff';sx.fill();sx.restore();}
  tap(300,690,t,1.0);tap(300,811,t,1.95);tap(300,900,t,2.6);}
const HOME_MAX=683;
function sHome(t){const s=HOME_MAX*eInOut(P(t,4.45,5.7));sx.drawImage(IM.home_tall,0,-s);sx.drawImage(IM.home,0,0,SW,74,0,0,SW,74);tap(150,955,t,6.95);}
const Q1='تفاصيل كورس المبتدئين';const ANS_MAX=536;const T_SEND=9.5;
function sAsk(t){
  if(t<T_SEND+0.05){sx.drawImage(IM.ask,0,0);
    if(t>7.7){fillR(93,1180,334,44,'rgb(25,28,33)');const s=typed(Q1,t,7.9,9.2);ST(s,421,1202,17,{w:600});caret(421-sw(s,17)-4,1202,22,t);} }
  else{const sc=ANS_MAX*eInOut(P(t,12.55,13.95));
    sx.save();sx.beginPath();sx.rect(0,158,SW,992);sx.clip();fillR(0,158,SW,992,'rgb(10,10,10)');
    const rv=lerp(282,1150,eInOut(P(t,10.55,12.3)));             // MARO's answer reveals top-down
    sx.save();sx.beginPath();sx.rect(0,262,SW,rv-262);sx.clip();sx.drawImage(IM.answer_tall,0,-sc);sx.restore();
    if(rv<1150){const g=sx.createLinearGradient(0,rv-60,0,rv);g.addColorStop(0,'rgba(10,10,10,0)');g.addColorStop(1,'rgba(10,10,10,1)');sx.fillStyle=g;sx.fillRect(0,rv-60,SW,62);}
    const bp=eob(P(t,T_SEND+0.05,T_SEND+0.4));                    // user bubble pops in from the right
    if(bp>0){sx.save();sx.translate(567,215-sc);sx.scale(bp,bp);sx.translate(-567,-(215));sx.drawImage(IM.answer,230,170,340,90,230,170,340,90);sx.restore();}
    const dt=P(t,9.8,10.0)*(1-P(t,10.5,10.65));                    // MARO typing dots
    if(dt>0){sx.save();sx.globalAlpha=dt;rr(sx,22,280,120,56,18);sx.fillStyle='rgb(21,21,23)';sx.fill();sx.strokeStyle='rgba(255,123,32,0.35)';sx.lineWidth=1.5;sx.stroke();
      for(let i=0;i<3;i++){const b=Math.max(0,Math.sin(t*9-i*0.9));sx.globalAlpha=dt*(0.45+0.55*b);sx.fillStyle='#FF7B20';sx.beginPath();sx.arc(56+i*26,308-b*5,6,0,6.283);sx.fill();}sx.restore();}
    const hp=P(t,14.1,14.5)*(1-P(t,15.3,15.6));                    // highlight price + coupon paragraph
    if(hp>0){sx.save();sx.globalAlpha=hp;rr(sx,26,546,474,168,16);sx.strokeStyle='#FF7B20';sx.lineWidth=3.5;sx.shadowColor='#FF7B20';sx.shadowBlur=24;sx.stroke();sx.globalAlpha=hp*0.10;sx.fillStyle='#FF7B20';sx.fill();sx.restore();}
    sx.restore();
    sx.drawImage(IM.answer,0,0,SW,158,0,0,SW,158);sx.drawImage(IM.answer,0,1150,SW,130,0,1150,SW,130);}
  tap(260,1202,t,7.75);tap(42,1202,t,T_SEND);}
const IDEA='سيارة رياضية حمراء بتجري في شوارع القاهرة بالليل، لقطة سينمائية مليانة طاقة';
const PROMPT_OUT='Cinematic wide shot of a red sports car racing through the streets of Cairo at night, neon reflections on wet asphalt, light trails and motion blur, dramatic cinematic lighting, photorealistic, 35mm lens, shallow depth of field, high energy, ultra detailed, 1:1';
const PR_MAX=1136;
function sPrompt(t){const s=PR_MAX*eInOut(P(t,18.35,19.45));sx.save();sx.translate(0,-s);sx.drawImage(IM.prompt_tall,0,0);
  if(t>16.6){fillR(53,938,484,66,'rgb(11,11,11)');fillR(112,1004,425,48,'rgb(11,11,11)');const tx=typed(IDEA,t,16.75,18.1);const ls=wrapLines(tx,17,462,600,sx);ls.forEach((l,i)=>ST(l,527,966+i*30,17));
    const last=ls[ls.length-1]||'';caret(527-sw(last,17)-4,966+(Math.max(1,ls.length)-1)*30,22,t,t<18.4);}
  const bo=P(t,18.1,18.4);if(bo>0){const pr=t>19.65&&t<19.9?0.93:1;sx.save();sx.globalAlpha=bo;sx.translate(374,1841);sx.scale(pr,pr);rr(sx,-99,-30,198,60,14);const g=sx.createLinearGradient(0,-30,0,30);g.addColorStop(0,'#E25A33');g.addColorStop(1,'#B53A20');sx.fillStyle=g;sx.shadowColor='rgba(255,90,40,0.7)';sx.shadowBlur=22;sx.fill();sx.shadowBlur=0;ST('بناء البرومبت',30,1,18,{w:700,col:'#fff',align:'center'});
    sx.strokeStyle='#fff';sx.lineWidth=2.2;sx.lineCap='round';sx.beginPath();sx.moveTo(-72,10);sx.lineTo(-54,-8);sx.stroke();sx.restore();}
  if(t>19.85){fillR(24,2028,542,352,'rgb(13,13,13)');const tx=typed(PROMPT_OUT,t,19.95,21.8);const ls=wrapLines(tx,15.5,500,600,sx);
    ls.forEach((l,i)=>ST(l,44,2058+i*27,15.5,{align:'left',col:'#EDE4DE'}));const last=ls[ls.length-1]||'';caret(46+sw(last,15.5),2058+(Math.max(1,ls.length)-1)*27,20,t,t<22.0);}
  sx.restore();sx.drawImage(IM.prompt,0,0,SW,52,0,0,SW,52);
  tap(420,588,t,16.2);tap(300,990,t,16.55);tap(374,705,t,19.65);tap(100,832,t,22.0);
  const to=P(t,22.1,22.3)*(1-P(t,22.55,22.75));if(to>0){sx.save();sx.globalAlpha=to;sx.translate(295,1150+(1-to)*20);rr(sx,-120,-26,240,52,26);sx.fillStyle='rgba(30,30,32,0.96)';sx.fill();sx.strokeStyle='rgba(255,123,32,0.6)';sx.lineWidth=1.5;sx.stroke();ST('تم نسخ البرومبت ✓',0,1,16,{w:700,align:'center'});sx.restore();}}
// screen timeline with in-app push transitions (new page slides in from the left, RTL)
const SCREENS=[[0,sLogin],[3.0,sHome],[7.15,sAsk],[15.6,sPrompt]];const PUSH=0.36;
function drawScreen(t){sx.setTransform(SS,0,0,SS,0,0);sx.fillStyle='#0A0A0A';sx.fillRect(0,0,SW,SH);
  let i=0;while(i<SCREENS.length-1&&t>=SCREENS[i+1][0])i++;const d=t-SCREENS[i][0];
  if(i>0&&d<PUSH){const p=eInOut(d/PUSH);sx.save();sx.translate(SW*0.3*p,0);SCREENS[i-1][1](t);sx.fillStyle=`rgba(0,0,0,${0.5*p})`;sx.fillRect(0,0,SW,SH);sx.restore();
    sx.save();sx.translate(-SW*(1-p),0);sx.shadowColor='rgba(0,0,0,0.8)';sx.shadowBlur=40;sx.fillStyle='#0A0A0A';sx.fillRect(0,0,SW,SH);sx.shadowBlur=0;SCREENS[i][1](t);sx.restore();}
  else SCREENS[i][1](t);sx.setTransform(1,0,0,1,0,0);}

// ================= phone =================
function phone(cx,cy,h,o={}){const{rotY=0,rot=0,alpha=1,img=null,glow=1}=o;if(alpha<=0)return;
  const sh=h*0.956,swd=sh*SW/SH,bz=(h-sh)/2,bw=swd+bz*2;const rB=bw*0.16,rS=swd*0.13;
  ctx.save();ctx.globalAlpha*=alpha;ctx.translate(cx,cy);ctx.rotate(rot);ctx.transform(Math.cos(rotY),Math.sin(rotY)*0.16,0,1,0,0);
  ctx.save();ctx.shadowColor='rgba(0,0,0,0.75)';ctx.shadowBlur=h*0.08;ctx.shadowOffsetY=h*0.04;rr(ctx,-bw/2,-h/2,bw,h,rB);ctx.fillStyle='#0b0b0c';ctx.fill();ctx.restore();
  if(glow>0){ctx.save();ctx.globalAlpha*=glow;ctx.shadowColor='rgba(255,100,40,0.55)';ctx.shadowBlur=h*0.06;rr(ctx,-bw/2,-h/2,bw,h,rB);ctx.strokeStyle='rgba(255,120,60,0.35)';ctx.lineWidth=2;ctx.stroke();ctx.restore();}
  // frame + side buttons
  const fg=ctx.createLinearGradient(-bw/2,0,bw/2,0);fg.addColorStop(0,'#5a5552');fg.addColorStop(0.08,'#2b2826');fg.addColorStop(0.92,'#2b2826');fg.addColorStop(1,'#5a5552');
  rr(ctx,-bw/2,-h/2,bw,h,rB);ctx.fillStyle=fg;ctx.fill();rr(ctx,-bw/2+h*0.006,-h/2+h*0.006,bw-h*0.012,h-h*0.012,rB*0.95);ctx.fillStyle='#050505';ctx.fill();
  ctx.fillStyle='#3a3634';for(const[yy,hh,side]of[[-0.28,0.055,-1],[-0.2,0.09,-1],[-0.09,0.09,-1],[-0.2,0.14,1]])ctx.fillRect(side*(bw/2)+(side<0?-h*0.006:0),h*yy,h*0.006,h*hh);
  // screen
  ctx.save();rr(ctx,-swd/2,-sh/2,swd,sh,rS);ctx.clip();ctx.imageSmoothingQuality='high';
  if(img)ctx.drawImage(img,-swd/2,-sh/2,swd,sh);else ctx.drawImage(scr,-swd/2,-sh/2,swd,sh);
  const gl=ctx.createLinearGradient(-swd/2,-sh/2,swd/2,sh/2);gl.addColorStop(0,'rgba(255,255,255,0.07)');gl.addColorStop(0.45,'rgba(255,255,255,0)');ctx.fillStyle=gl;ctx.fillRect(-swd/2,-sh/2,swd,sh);ctx.restore();
  // dynamic island
  const iw=swd*0.29,ih=swd*0.085;rr(ctx,-iw/2,-sh/2+sh*0.012,iw,ih,ih/2);ctx.fillStyle='#000';ctx.fill();
  ctx.restore();}
// main phone camera keyframes [t, x, y, h, rotY]
const KF=VERT?[[0,540,2700,1250,0.5],[0.9,540,1150,1250,0],[3.1,540,1150,1250,0],[3.7,540,1235,1090,0.08],[7.1,540,1235,1090,0.08],[7.7,540,1130,1240,-0.08],[8.0,540,1130,1500,-0.05],[9.6,540,1130,1500,-0.05],[10.2,540,1130,1240,-0.08],[13.9,540,1130,1240,-0.08],[14.3,540,1010,1560,-0.03],[15.4,540,1010,1560,-0.03],[16.0,540,1150,1230,0.08],[16.5,540,1060,1400,0.05],[18.2,540,1060,1400,0.05],[18.8,540,1150,1230,0.08],[19.6,540,1150,1230,0.08],[20.0,540,1060,1400,0.05],[22.3,540,1060,1400,0.05],[22.7,540,1150,1230,0.08],[23.15,-760,1150,1230,0.6]]
            :[[0,960,1800,900,0.5],[0.9,960,545,960,0],[3.1,960,545,960,0],[3.7,620,545,980,0.16],[7.1,620,545,980,0.16],[7.7,1330,545,1000,-0.16],[8.0,1330,330,1500,-0.1],[9.6,1330,330,1500,-0.1],[10.2,1330,545,1000,-0.16],[13.9,1330,545,1000,-0.16],[14.3,1330,520,1260,-0.08],[15.4,1330,520,1260,-0.08],[16.0,620,545,1000,0.16],[16.5,620,260,1500,0.1],[18.2,620,260,1500,0.1],[18.8,620,545,1000,0.16],[19.6,620,545,1000,0.16],[20.0,620,330,1450,0.1],[22.3,620,330,1450,0.1],[22.7,620,545,1000,0.16],[23.15,-560,545,1000,0.6]];
function cam(t){let i=0;while(i<KF.length-2&&t>=KF[i+1][0])i++;const a=KF[i],b=KF[i+1];const p=eInOut(P(t,a[0],b[0]));return[1,2,3,4].map(k=>lerp(a[k],b[k],p));}

// ================= scenes =================
function sceneMain(t){background(t,{glow:1.1});
  const[x,y,h,ry]=cam(t);
  // S1 intro text + MARO
  if(t<3.6){const out=3.05;
    if(VERT){text3D('MARO AI',540,210,122,{depth:14,alpha:P(t,0.35,0.7)*(1-P(t,out,out+0.3))});kline('مساعدك الذكي.. في جيبك',540,345,54,0.6,t,{col:C.ember,t1:out});}
    else{text3D('MARO AI',1540,430,132,{depth:16,alpha:P(t,0.35,0.7)*(1-P(t,out,out+0.3))});kline('مساعدك الذكي.. في جيبك',1540,575,54,0.6,t,{col:C.ember,t1:out});kline('SABER GROUP ACADEMY',1540,660,28,0.8,t,{col:'rgba(255,247,242,0.6)',t1:out,ls:4});}
    const ma=P(t,0.5,0.9)*(1-P(t,out,out+0.3));if(ma>0)maroAt('M2',LV(400,190),LV(600,1720),LV(430,280),{expr:t>1.6&&t<1.9?'wink':'happy',et:t-1.6,t,alpha:ma});}
  // S2 home: all tools
  const tools=['المدرب مارو','Saber Prompt Studio','Image To Prompt','Generate Brief','قيّملي تصميمي','عصف ذهني','حلّل تصميم وتعلّم منه','عندي سؤال'];
  if(t>3.4&&t<7.6){const o1=7.1;
    if(VERT){kline('كل أدواتك',540,150,84,3.6,t,{t1:o1});kline('في أبلكيشن واحد',540,250,50,3.75,t,{col:C.ember,t1:o1});
      const rows=[[0,1,2],[3,4,5],[6,7]];rows.forEach((r,ri)=>{const ws=r.map(i=>tw(tools[i],28,800)+60);const tot=ws.reduce((a,b)=>a+b,0)+(r.length-1)*16;let xx=540+tot/2;
        r.forEach((i,k)=>{const cx=xx-ws[k]/2;xx-=ws[k]+16;const p=eob(P(t,4.7+i*0.1,5.05+i*0.1));pill(tools[i],cx,355+ri*78,28,{sc:p,alpha:1-P(t,o1,o1+0.3)});});});}
    else{kline('كل أدواتك',1760,260,110,3.6,t,{align:'right',t1:o1});kline('في أبلكيشن واحد',1760,380,58,3.75,t,{align:'right',col:C.ember,t1:o1});
      tools.forEach((s,i)=>{const col=i%2,row=Math.floor(i/2);const p=eob(P(t,4.7+i*0.1,5.05+i*0.1));const wpx=tw(s,30,800)+60;pill(s,1760-wpx/2-col*420,510+row*95,30,{sc:p,alpha:1-P(t,o1,o1+0.3)});});}}
  // S3 ask MARO
  if(t>7.5&&t<15.9){const oA=12.35,oB=15.45;
    const X=LV(930,540),A=LV('right','center');const y0=LV(330,160),g=LV(1,0.8);
    kline('عندك سؤال؟',X,y0,LV(118,92),7.65,t,{align:A,t1:oA});kline('اسأل مارو.. والرد في ثواني',X,y0+LV(125,110),LV(56,48),7.85,t,{align:A,col:C.ember,t1:oA});
    if(!VERT)kline('عن الكورسات والمواعيد والأسعار',X,y0+215,40,8.05,t,{align:A,col:'rgba(255,247,242,0.75)',t1:oA});
    kline('رد كامل بالتفاصيل',X,y0,LV(104,84),12.6,t,{align:A,t1:oB});kline('والعروض.. أول بأول',X,y0+LV(125,110),LV(56,48),12.8,t,{align:A,col:C.ember,t1:oB});}
  // S4 prompt studio
  if(t>15.8&&t<23.2){const o=22.75;const X=LV(1760,540),A=LV('right','center');
    kline('Saber Prompt Studio',X,LV(250,150),LV(84,66),16.0,t,{align:A,col:C.ember,t1:o});
    kline('اكتب فكرتك بالعربي..',X,LV(370,250),LV(60,48),16.2,t,{align:A,t1:o});kline('وخد برومبت احترافي جاهز',X,LV(460,325),LV(60,48),16.4,t,{align:A,t1:o});
    if(!VERT){['صور','فيديو','سوشيال','منتجات'].forEach((s,i)=>{const p=eob(P(t,20.0+i*0.1,20.35+i*0.1));const wpx=tw(s,32,800)+60;pill(s,1760-wpx/2-i*170,590,32,{sc:p,alpha:1-P(t,o,o+0.3)});});}}
  if(t<23.2){drawScreen(t);phone(x,y+Math.sin(t*1.3)*6,h,{rotY:ry,rot:t<0.9?(1-eOut(P(t,0,0.9)))*0.25:0});}
}
const TOOLS2=[['coach','المدرب مارو','توجيه احترافي لمشاريع التصميم والتسويق'],['rate','قيّملي تصميمي','مراجعة وتطوير التصميم'],['brain','عصف ذهني','اتجاهات وأفكار جديدة'],
  ['brief','Generate Brief','بريف إعلاني قابل للتنفيذ'],['analyze','حلّل تصميم وتعلّم منه','استخرج قواعد التصميم'],['tech','عندي مشكلة تقنية','حل مشاكل برامج التصميم']];
function sceneCarousel(t){background(t,{glow:1.2});const t0=23.0;
  kline('وأدوات أكتر.. كلها مع مارو',W/2,LV(95,170),LV(56,64),t0+0.1,t,{t1:27.5});
  const tt=t-t0-0.45;let s;if(tt<0)s=-2.2*(1-eOutExpo(P(t,t0-0.2,t0+0.45)));else{const k=Math.floor(tt/0.78);const f=tt-k*0.78;s=Math.min(5,k+eInOut(P(f,0.42,0.78)));}
  const sp=LV(470,640),hc=LV(760,1180),cy=LV(505,1040);
  const order=TOOLS2.map((_,i)=>i).sort((a,b)=>Math.abs(b-s)-Math.abs(a-s));
  for(const i of order){const d=i-s,ad=Math.abs(d);if(ad>2.6)continue;const sc=1-0.26*Math.min(1,ad);phone(W/2+d*sp,cy+ad*LV(30,40),hc*sc,{img:IM[TOOLS2[i][0]],rotY:-clamp(d,-1,1)*0.35,alpha:1-0.45*Math.min(1,ad),glow:1-Math.min(1,ad)});}
  const ci=Math.round(clamp(s,0,5)),la=clamp(1-Math.abs(ci-s)*3)*P(t,t0+0.3,t0+0.6);
  T(TOOLS2[ci][1],W/2,LV(935,1720),LV(52,62),{w:900,alpha:la});T(TOOLS2[ci][2],W/2,LV(990,1795),LV(30,36),{w:600,col:C.ember,alpha:la});}
function sceneEnd(t){const t0=27.8;background(t,{glow:1.4});
  const lp=eob(P(t,t0+0.05,t0+0.45));rays(W/2,LV(330,640),0.4*lp,t*0.5);const L=LV(220,280);ctx.save();ctx.translate(W/2,LV(330,640));ctx.scale(lp,lp);ctx.shadowColor='rgba(196,50,31,0.9)';ctx.shadowBlur=60;rr(ctx,-L/2,-L/2,L,L,46);ctx.clip();ctx.drawImage(IM.logo,-L/2,-L/2,L,L);ctx.restore();
  text3D('MARO AI',W/2,LV(560,930),LV(120,130),{depth:14,alpha:P(t,t0+0.3,t0+0.5)});
  kline('مساعدك الذكي.. معاك على طول',W/2,LV(680,1075),LV(52,56),t0+0.45,t);
  const bp=eob(P(t,t0+0.8,t0+1.15));pill('جرّب مارو دلوقتي',W/2,LV(800,1230),LV(40,46),{sc:bp,fill:'rgba(196,50,31,0.9)',stroke:'rgba(255,170,110,0.9)',pad:40});
  T('ai.sabergroupacademy.com',W/2,LV(905,1360),LV(34,40),{w:800,col:C.ember,alpha:P(t,t0+1.1,t0+1.4)});
  const ma=P(t,t0+0.6,t0+1.0);if(ma>0)maroAt('M2',LV(1700,820),LV(800,1640),LV(330,300),{expr:t>t0+2.2&&t<t0+2.5?'wink':'happy',et:t-t0-2.2,t,alpha:ma});
  const fo=P(t,DUR-0.35,DUR);if(fo>0){ctx.fillStyle=`rgba(0,0,0,${fo})`;ctx.fillRect(0,0,W,H);}}
function scene(t){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);ctx.restore();
  if(t<23.0)sceneMain(t);else if(t<27.8)sceneCarousel(t);else sceneEnd(t);
  const d=t-27.8;if(Math.abs(d)<0.14){const e=eInOut(1-Math.abs(d)/0.14);const r=e*Math.hypot(W,H)*0.6;ctx.fillStyle=C.ember;ctx.beginPath();ctx.arc(W/2,H/2,r,0,6.283);ctx.fill();ctx.fillStyle=C.red;ctx.beginPath();ctx.arc(W/2,H/2,Math.max(0,r-60*(1-e)),0,6.283);ctx.fill();}}
function nSub(t){for(const[a,b]of[[0,1.0],[2.95,3.8],[7.0,8.1],[9.5,10.3],[13.9,14.4],[15.3,16.6],[18.1,18.9],[19.5,20.1],[22.2,23.6],[27.6,28.2]])if(t>=a&&t<=b)return 8;if(t>23.6&&t<27.6)return 5;return 3;}
// ================= render hooks =================
const grains=[];{const R=rng(7);for(let k=0;k<6;k++){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');const d=g.createImageData(256,256);for(let i=0;i<d.data.length;i+=4){const v=R()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255;}g.putImageData(d,0,0);grains.push(c);}}
function post(f){const v=out.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*1.0);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,0.5)');out.fillStyle=v;out.fillRect(0,0,W,H);
  out.save();out.globalAlpha=0.05;out.globalCompositeOperation='overlay';out.translate((f*37)%256,(f*91)%256);out.fillStyle=out.createPattern(grains[f%6],'repeat');out.fillRect(-256,-256,W+512,H+512);out.restore();}
window.renderFrame=function(f){const t0=f/FPS,N=nSub(t0),shutter=0.5/FPS;out.fillStyle='#000';out.fillRect(0,0,W,H);
  for(let k=0;k<N;k++){const t=Math.max(0,t0+(N>1?(k/(N-1)-0.5)*shutter:0));ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';
    ctx.translate(W/2,H/2);ctx.rotate(Math.sin(t*0.35)*0.004);const z=1.015+Math.sin(t*0.25)*0.008;ctx.scale(z,z);ctx.translate(-W/2+Math.sin(t*0.4)*6,-H/2+Math.cos(t*0.33)*4);
    scene(t);out.globalAlpha=1/(k+1);out.drawImage(sub,0,0);}
  out.globalAlpha=1;post(f);};
window.ready=(async()=>{
  await Promise.all([600,700,800,900].flatMap(w=>[document.fonts.load(`${w} 40px Cairo`,'مارو'),document.fonts.load(`${w} 40px Cairo`,'AI')]));
  for(const[k,n]of Object.entries(POSE)){IMG[k]=await load(n+'.png');VM[k]=await load(n+'_vmask.png');const v=VIS[n];const c=document.createElement('canvas');c.width=v.x1-v.x0+1;c.height=v.y1-v.y0+1;FACE[k]=c;}
  LOGO=await load('logo_white.png');
  WATER=document.createElement('canvas');WATER.width=WATER.height=2048;const w=WATER.getContext('2d');w.filter='blur(10px)';w.drawImage(IMG.M5,0,0);w.filter='none';w.globalCompositeOperation='source-in';w.fillStyle='#4a0d07';w.fillRect(0,0,2048,2048);
  for(const k of['login','home','home_tall','ask','answer','answer_tall','prompt','prompt_tall','coach','rate','brain','brief','analyze','tech'])IM[k]=await load('app/'+k+'.png');
  IM.logo=await load('logo.png');return true;})();
