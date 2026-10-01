// ================= overlay layer for the talking-head montage (transparent PNG frames, 9:16) =================
// drawn only while the footage is on screen; animation inserts already carry their own captions.
const EDL=[['A',0,3.55],['F',3.55,7.4],['A',7.4,9.24],['F',9.24,11.3],['A',11.3,16.36],['F',16.36,18.2],['A',18.2,20.1],['F',20.1,21.4],['A',21.4,22.8],['F',22.8,23.5],['A',23.5,25.2],
  ['F',25.2,28.9],['A',28.9,32.05],['F',32.05,34.2],['A',34.2,37.75],['F',37.75,39.3],['A',39.3,40.85],['F',40.85,45.2],['A',45.2,46.5]];
const segAt=t=>EDL.find(s=>t>=s[1]&&t<s[2])||EDL[EDL.length-1];
function darkChip(s,x,y,size,t0,t,t1){chip(s,x,y,size,t0,t,{t1,fill:'rgba(14,11,11,0.92)',stroke:'rgba(242,120,90,0.8)'});}
function lowerName(t){const a0=41.02;const p=pop(t,a0,0.45);if(p<=0)return;const y=1240;ctx.save();ctx.translate(W/2,y);ctx.scale(p,p);rr(ctx,-330,-80,660,160,30);ctx.fillStyle='rgba(14,11,11,0.93)';ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=40;ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle=A.acc2;ctx.lineWidth=3;ctx.stroke();ctx.fillStyle=A.acc2;ctx.fillRect(320,-50,6,100);T('محمد صابر',0,-6,84,{w:900});T('MOHAMED SABER',0,52,24,{w:700,col:A.acc,ls:6});ctx.restore();
  [['AI Automation Engineer',41.64],['Senior Graphic Designer',43.18],['Adobe Certified Instructor',44.02]].forEach(([s,t0],i)=>{const q=pop(t,t0,0.4);if(q<=0)return;const yy=1390+i*96;const w=tw(s,38,800)+80;ctx.save();ctx.translate(W/2,yy);ctx.scale(q,q);rr(ctx,-w/2,-38,w,76,38);ctx.fillStyle=i===0?A.red:'rgba(14,11,11,0.93)';ctx.fill();ctx.strokeStyle=i===0?'rgba(255,170,140,0.7)':A.acc2;ctx.lineWidth=2.5;ctx.stroke();T(s,0,3,38,{w:800});ctx.restore();});}
function ticker(t){const a=P(t,4.6,4.8)*(1-P(t,5.6,5.8));if(a<=0)return;const yr=Math.round(lerp(2015,2025,eInOut(P(t,4.7,5.25))));ctx.save();ctx.globalAlpha=a;rr(ctx,W/2-210,1110,420,170,30);ctx.fillStyle='rgba(14,11,11,0.92)';ctx.fill();ctx.strokeStyle=A.acc2;ctx.lineWidth=3;ctx.stroke();
  T('من',W/2,1150,34,{w:700,col:A.sub});T(String(yr),W/2,1225,96,{w:900,glow:20});ctx.restore();}
function startLine(t){const la=ease(t,16.9,17.5)*(1-P(t,18.0,18.2));if(la<=0)return;ctx.save();ctx.globalAlpha=la;ctx.shadowColor=A.hot;ctx.shadowBlur=30;ctx.fillStyle=A.hot;ctx.fillRect(W/2-420*la,1330,840*la,8);ctx.shadowBlur=0;T('START',W/2,1385,34,{w:900,col:'rgba(255,190,150,0.95)',ls:14});ctx.restore();}
function overlays(t){const s=segAt(t);if(s[0]!=='F')return;
  const fin=P(t,s[1],s[1]+0.12)*(1-P(t,s[2]-0.1,s[2]));ctx.save();ctx.globalAlpha=fin;
  const D=t0=>t0>=s[1]-0.3&&t0<s[2];   // only this segment's labels
  const CH=[[0,'وإنت واقف تتفرج',1000,52,3.6,4.55],[1,'أي مهارة',1120,58,5.86],[2,'Freelancing',1250,58,6.72],
    [1,'كنت محتاج تنافس ناس',1120,54,9.6],[2,'بقالها سنين في المجال',1245,48,10.6],
    [1,'كلنا بنبدأ',1100,58,16.4],[2,'من نفس النقطة',1225,58,17.1],[1,'كله بيبدأ',1120,56,20.16],[2,'من نفس المكان',1245,56,20.76],[2,'كله بيجرّب',1180,64,22.84],
    [1,'عشان كده ده',1060,50,25.22,26.6],[2,'أنسب وقت',1180,68,25.76,26.6],[1,'تتعلم وتدمج',1080,54,26.26],[2,'الـ AI في مجالك',1205,58,27.28],
    [1,'لازم تبدأ تتقن',1110,56,32.1],[2,'استخدام الـ AI',1235,62,33.32],[1,'عايز تعرف أكتر؟',1120,56,37.82],[2,'سيبلي كومنت',1245,58,38.9]];
  for(const[k,txt,y,sz,t0,t1]of CH){if(!D(t0))continue;if(k===2)chip(txt,W/2,y,sz,t0,t,{t1});else darkChip(txt,W/2,y,sz,t0,t,t1);}
  if(s[1]<=4.6&&s[2]>5)ticker(t),kick('10 YEARS',W/2,1320,4.8,t,{t1:5.6});if(s[1]<=17&&s[2]>17)startLine(t);
  // F11 name
  lowerName(t);
  ctx.restore();
  if(t<40.85)captions(t);}
window.renderFrame=function(f){const t=f/FPS;out.clearRect(0,0,W,H);ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.filter='none';ctx.clearRect(0,0,W,H);overlays(t);out.drawImage(sub,0,0);};
