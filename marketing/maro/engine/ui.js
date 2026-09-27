const eob=x=>Math.max(0,eOutBack(x));
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


function tearOverlay(t){if(t>=0.78)return;const open=t<0.12?7:lerp(7,H*0.78,eInOut(P(t,0.12,0.74)));const R=rng(11);
  const jag=Array.from({length:10},()=>(R()-0.5)*80);const jag2=Array.from({length:10},()=>(R()-0.5)*80);const tilt=-0.035;
  const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#FF8A2A');g.addColorStop(1,'#F06A10');
  const edge=(sign,j)=>{const pts=[];for(let k=0;k<=9;k++){const x=k*W/9;pts.push([x,H/2+sign*open/2+j[k]*(0.4+open/H)+ (x-W/2)*tilt]);}return pts;};
  const top=edge(-1,jag),bot=edge(1,jag2);
  ctx.save();ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(W,-10);for(let k=9;k>=0;k--)ctx.lineTo(top[k][0],top[k][1]);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(0,H+10);ctx.lineTo(W,H+10);for(let k=9;k>=0;k--)ctx.lineTo(bot[k][0],bot[k][1]);ctx.closePath();ctx.fill();
  ctx.lineWidth=10;ctx.strokeStyle='rgba(60,10,4,0.35)';for(const e of[top,bot]){ctx.beginPath();e.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}ctx.restore();}

