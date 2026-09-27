// ================= NATIVE 9:16 SHOTS (1080x1920) — same timing as the 16:9 cut =================
const SCR={tl:[975,320],tr:[1413,337],br:[1392,623],bl:[966,598],cx:1190,cy:470};
function shotHook(t){ // 0 - 4.0 : tall crop on the laptop, text in the lower third
  const push=eInExpo(P(t,2.9,4.0));const k0=H/1080;                       // image fills the full height
  const s=k0*lerp(1.0,1.1,P(t,0,2.9))*lerp(1,4.6,push);
  const fx=lerp(SCR.cx-40,SCR.cx,push),fy=lerp(560,SCR.cy,push*0.9+P(t,0,2.9)*0.1);
  ctx.save();ctx.translate(W/2,H*0.42);ctx.scale(s,s);ctx.translate(-fx,-fy);ctx.drawImage(IM.S1,0,0,1920,1080);
  const dim=P(t,3.1,3.8);if(dim>0){ctx.fillStyle=`rgba(4,3,3,${dim})`;ctx.beginPath();for(const k of['tl','tr','br','bl'])ctx.lineTo(...SCR[k]);ctx.closePath();ctx.fill();}
  ctx.restore();
  const a=1-P(t,2.9,3.2);
  const g=ctx.createLinearGradient(0,H*0.55,0,H);g.addColorStop(0,'rgba(10,3,2,0)');g.addColorStop(1,`rgba(10,3,2,${0.92*a})`);ctx.fillStyle=g;ctx.fillRect(0,H*0.55,W,H*0.45);
  if(t>3.75){ctx.fillStyle=`rgba(3,2,2,${P(t,3.75,4.0)})`;ctx.fillRect(0,0,W,H);}
  ctx.save();ctx.globalAlpha=a*P(t,0.6,0.9);text3D('03:12',230,240,100,{depth:10});T('AM',380,266,28,{w:900,col:C.ember,align:'left'});ctx.restore();
  ctx.save();ctx.globalAlpha=a;
  typeOn('الساعة 3 الفجر..',W-70,1330,78,0.7,t,{col:C.white,dur:0.4});
  typeOn('والتسليم الصبح..',W-70,1440,78,1.35,t,{col:C.white,dur:0.4});
  typeOn('ومفيش ولا فكرة.',W-70,1555,86,2.0,t,{col:C.ember,dur:0.45});
  ctx.restore();}
function shotBoot(t){ // 4.0 - 6.4
  background(t,{glow:P(t,4.0,4.8)});const v=VIS[POSE.M5];const s=lerp(0.6,0.66,P(t,4,6.4));const x=W/2-(v.cx-1024)*s,y=H/2-(v.cy-1024)*s;
  let expr='off',et=0;if(t>=4.15&&t<4.4)expr='power';else if(t>=4.4&&t<5.3)expr='boot';else if(t>=5.3&&t<5.46){expr='collapse';et=t-5.3;}else if(t>=5.46){expr=(t>5.95&&t<6.05)?'blink':'happy';et=t-5.46;}
  drawMaro('M5',x,y,s,{expr,et,t,alpha:P(t,4.0,4.25)});
  if(t>=5.46){const q=P(t,5.46,6.0);ctx.save();ctx.globalCompositeOperation='lighter';glowBlob(W/2,H/2,700*eOut(q)+100,'rgba(255,150,70,0.5)',1-q);ctx.restore();}}
function shotHello(t){ // 6.4 - 9.4 : title on top, MARO below
  background(t);watermark(W/2+120-(t-6.4)*12,1240,1500,0.45);
  T('SABER GROUP  ·  AI ASSISTANT',W/2,300,24,{w:700,ls:8,col:'rgba(255,190,140,0.75)',alpha:P(t,6.6,6.9)});
  const r3=P(t,6.7,7.3);text3D('أنا مارو',W/2,450,176,{rotY:lerp(-1.25,0,eOutExpo(r3))+Math.sin(t*1.3)*0.05,alpha:clamp(r3*3)});
  T('مساعدك الذكي من صابر جروب',W/2,605,50,{w:700,alpha:P(t,7.3,7.6),col:'rgba(255,245,238,0.9)'});
  typeOn('معاك.. على طول',W/2+tw('معاك.. على طول',84)/2,720,84,7.7,t,{col:C.ember});
  const my=1310+Math.sin(t*2.4)*14;drawMaro('M2',W/2,my,0.5,{rot:Math.sin(t*1.7)*0.03,expr:(t>8.3&&t<8.7)?'wink':'happyB',et:(t>8.3&&t<8.7)?t-8.3:t-6.4,t,thrust:0.8});}
function shotBrainstorm(t){ // 9.4 - 14.4 : chat + idea cards stacked, MARO at the bottom
  background(t);chapter(t,9.45,14.4,'01','عصف ذهني','BRAINSTORM');
  const thinking=t<11.3;const mx=W/2,my=1430+Math.sin(t*2)*10;
  maroAt('M3',mx,my,380,{expr:thinking?(t>10.2?'think':'happyB'):(t>13.0?'love':'happy'),et:t-11.3,t,thrust:0.6});
  msg('user','عندي كامبين لفيزيتا لازم يحسس العيلة بالأمان.. ومش لاقي فكرة',W-60,270,960,9.7,t,{size:38});
  if(t>10.7&&t<11.35)typingDots(W/2,560,t,P(t,10.7,10.85));
  const ideas=['كل عيادة.. على بُعد موبايل','الاطمئنان على اللي بتحبهم بقى أقرب','دكاترة بتحرس العيلة'];
  ideas.forEach((s,i)=>{const t0=11.35+i*0.28;const p=P(t,t0,t0+0.45);if(p<=0)return;const e=eOutExpo(p);
    const tx=W/2,ty=640+i*175;const sx=lerp(mx,tx,e),sy=lerp(my,ty,e);const sel=i===0?eob(P(t,12.8,13.2)):0,dim=i>0?P(t,12.8,13.1)*0.55:0;
    ctx.save();ctx.globalAlpha=1-dim;ctx.translate(sx,sy);ctx.scale(lerp(0.3,1,e)*(1+sel*0.04),lerp(0.3,1,e)*(1+sel*0.04));
    if(i===0&&sel>0){rr(ctx,-480,-70,960,140,28);ctx.fillStyle=orangeFill(0,-70,0,140);ctx.shadowColor=C.ember;ctx.shadowBlur=50*sel;ctx.fill();ctx.shadowBlur=0;}
    else card(-480,-70,960,140,{r:28});
    T(String(i+1),435,0,46,{w:900,col:i===0&&sel>0?'#fff':C.ember});T(s,385,2,42,{w:800,align:'right'});
    if(i===0&&sel>0){ctx.save();ctx.translate(-415,0);ctx.scale(sel,sel);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,26,0,6.283);ctx.fill();ctx.strokeStyle='#C23A20';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(-3,9);ctx.lineTo(12,-9);ctx.stroke();ctx.restore();}
    ctx.restore();});}
function shotBrief(t){ // 14.4 - 18.4 : brief card (label above value), MARO below
  background(t);chapter(t,14.45,18.4,'02','بريف إعلاني جاهز','GENERATE BRIEF');
  maroAt('M1',W/2,1560+Math.sin(t*2.2)*10,230,{expr:t<17.3?'scan':'check',et:t-17.3,t,thrust:0.6});
  const x=50,y=260,w=980,h=1040;const a=eOutExpo(P(t,14.5,15.0));ctx.save();ctx.translate(x+w/2,y+h/2);ctx.scale(lerp(0.85,1,a),lerp(0.85,1,a));ctx.translate(-(x+w/2),-(y+h/2));
  card(x,y,w,h,{alpha:a,glow:40});ctx.globalAlpha=a;
  T('BRIEF  ·  VEZEETA',x+40,y+56,22,{w:900,ls:6,align:'left',col:C.ember});T('بريف الكامبين',x+w-40,y+56,40,{w:900,align:'right'});
  ctx.fillStyle='rgba(255,123,32,0.35)';ctx.fillRect(x+40,y+104,w-80,2);
  const rows=[['البراند','فيزيتا'],['الجمهور','العيلة المصرية 25 – 45'],['الرسالة','كل عيادة.. على بُعد موبايل'],['النبرة','دافية ومطمّنة'],['المطلوب','كي فيجوال + 3 بوستات تخصصات + ستوري']];
  rows.forEach(([k,v],i)=>{const t0=15.0+i*0.38,yy=y+170+i*172;const ra=P(t,t0,t0+0.2);if(ra<=0)return;ctx.save();ctx.globalAlpha*=ra;
    ctx.fillStyle=C.ember;ctx.beginPath();ctx.arc(x+w-50,yy,8,0,6.283);ctx.fill();T(k,x+w-75,yy,32,{w:800,align:'right',col:'rgba(255,190,140,0.95)'});ctx.restore();
    typeOn(v,x+w-75,yy+62,40,t0+0.05,t,{col:C.white,w:700,dur:0.3,glow:0});
    if(i<4){ctx.fillStyle='rgba(255,255,255,0.06)';ctx.fillRect(x+40,yy+118,w-80,1);}});
  ctx.restore();}
const V1_PROMPT='Studio-style healthcare campaign portrait of a warm Egyptian multigenerational family against a saturated blue background. The father sits centrally while the mother, grandparents, boy and girl gather close, smiling. Pink and cyan floor lighting, polished commercial realism, premium advertising finish.';
const V2_PROMPT='Cinematic realistic advertising photograph for a healthcare booking app. A warm, sunlit Egyptian family living room. A smartphone lies flat on the rug, and a miniature doctor\'s clinic rises out of its glowing screen like a living diorama. The father leans in and talks with a tiny friendly doctor...';
function shotImg2Prompt(t){ // 18.4 - 21.2 : image on top, extracted prompt under it
  background(t);chapter(t,18.45,26.8,'03','أدوات الصور بالـ AI','AI IMAGE TOOLS');
  pill('Image  →  Prompt',W/2,270,28,{w:900,alpha:P(t,18.6,18.9),ls:2});
  const a=eOutExpo(P(t,18.5,19.0));imgCard(IM.V1,W/2,590,960,540,{rotY:0.08,alpha:a});
  scanBar(W/2,590,960,540,P(t,19.0,19.9));
  promptBox(V1_PROMPT,50,920,980,19.5,t,{dur:1.4,size:30,label:'PROMPT  ·  EXTRACTED'});
  maroAt('M5',W/2,1560,240,{expr:'scan',t,alpha:a});}
function shotPromptGen(t){ // 21.2 - 23.4
  background(t);chapter(t,18.45,26.8,'03','أدوات الصور بالـ AI','AI IMAGE TOOLS');
  pill('Prompt Generator',W/2,270,28,{w:900,alpha:P(t,21.3,21.6),ls:2});
  msg('user','موبايل نايم على أرض الصالة وطالع منه عيادة صغيرة.. والعيلة حواليه',W-50,340,980,21.35,t,{size:40});
  const ar=eOutExpo(P(t,21.9,22.2));ctx.save();ctx.globalAlpha=ar;ctx.strokeStyle=C.ember;ctx.lineWidth=6;ctx.shadowColor=C.ember;ctx.shadowBlur=20;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(W/2,560);ctx.lineTo(W/2,560+70*ar);ctx.moveTo(W/2-20,608);ctx.lineTo(W/2,630);ctx.lineTo(W/2+20,608);ctx.stroke();ctx.restore();
  promptBox(V2_PROMPT,50,670,980,22.0,t,{dur:1.2,size:31,label:'PROMPT  ·  GENERATED BY MARO'});
  maroAt('M5',W/2,1450,280,{expr:t<22.9?'think':'check',et:t-22.9,t});}
function shotGenerate(t){ // 23.4 - 26.8 : one result resolves, then two results stacked
  background(t);chapter(t,18.45,26.8,'03','أدوات الصور بالـ AI','AI IMAGE TOOLS');
  pill('Image Generation',W/2,270,28,{w:900,alpha:P(t,23.5,23.8),ls:2});
  const split=eInOut(P(t,25.3,25.9));const bw=lerp(980,920,split),bh=bw*9/16,cx=W/2,cy=lerp(760,600,split);
  const q=P(t,23.7,25.0);if(t<23.7){card(cx-bw/2,cy-bh/2,bw,bh,{fill:'rgba(10,5,4,0.9)'});}else pixelResolve(IM.V2a,cx,cy,bw,bh,q);
  if(q>0&&q<1)T(`AI GENERATING  ${Math.floor(eOut(q)*100)}%`,W/2,cy+bh/2+56,26,{w:700,ls:8,col:'#FFB070'});
  if(split>0)imgCard(IM.V3,W/2,1170+(1-split)*500,920,518,{alpha:split});
  if(t>=25.0){const fl=Math.exp(-(t-25.0)*7);if(fl>0.02){ctx.save();ctx.globalCompositeOperation='lighter';glowBlob(cx,cy,800,`rgba(255,220,190,${0.8*fl})`,1);ctx.restore();}}
  if(split>0.5)T('نتيجتين.. من برومبت واحد',W/2,1510,46,{w:800,alpha:P(t,25.8,26.1)});
  maroAt('M5',W/2,1660,150,{expr:t<25.0?'scan':'wow',et:t-25.0,t,alpha:1-split*0.0});}
function shotCritique(t){ // 26.8 - 32.8 : poster on top, notes below, score + MARO at the bottom
  background(t);chapter(t,26.85,32.8,'04','قيّملي تصميمي','RATE MY DESIGN');
  const after=P(t,29.6,30.1);const pw=520,ph=650,cx=W/2,cy=650;const a=eOutExpo(P(t,26.9,27.4));const k=pw/600;
  imgCard(PB,cx,cy,pw,ph,{rotY:0.06,alpha:a});
  if(after>0){ctx.save();ctx.beginPath();const cutY=cy-ph/2-40+after*(ph+80);ctx.rect(0,0,W,cutY);ctx.clip();imgCard(PA,cx,cy,pw,ph,{rotY:0.06,border:'rgba(255,190,120,0.9)'});ctx.restore();scanBar(cx,cy,pw,ph,after);}
  T(after<1?'قبل':'بعد تعديلات مارو',cx,cy-ph/2-40,38,{w:900,col:after<1?'rgba(255,255,255,0.8)':C.ember,alpha:a});
  const notes=[[cx-60*k,cy-300*k,'العنوان تايه.. كبّره وخليه أول حاجة العين تشوفها'],[cx+200*k,cy-340*k,'ألوان كتير.. ثبّت على لون واحد'],[cx,cy+280*k,'التصميم محتاج يتنفس.. سيب مساحة فاضية']];
  const na=1-P(t,29.5,29.8);
  notes.forEach(([px,py,s],i)=>{const t0=27.7+i*0.45;const p=eob(P(t,t0,t0+0.35));if(p<=0||na<=0)return;const ny=1080+i*125;ctx.save();ctx.globalAlpha=na;
    ctx.strokeStyle=C.ember;ctx.lineWidth=3;ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(lerp(px,W-80,eOut(P(t,t0,t0+0.4))),lerp(py,ny-50,eOut(P(t,t0,t0+0.4))));ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=C.ember;ctx.shadowColor=C.ember;ctx.shadowBlur=20;ctx.beginPath();ctx.arc(px,py,24*p,0,6.283);ctx.fill();ctx.shadowBlur=0;T(String(i+1),px,py+2,28*p,{w:900});
    ctx.translate(W/2,ny);ctx.scale(p,p);card(-490,-50,980,100,{r:24});T(s,460,2,31,{w:700,align:'right'});ctx.restore();});
  const score=t<30.1?6*eOut(P(t,28.9,29.4)):lerp(6,9,eOut(P(t,30.1,30.9)));gauge(W/2+200,1520,105,score,10,P(t,28.9,29.2),t<30.1?'#FF5A2A':C.ember);
  if(t>30.2)T('+3 نقط',W/2+200,1680,40,{w:900,col:C.ember,alpha:P(t,30.3,30.6)});
  maroAt('M5',W/2-190,1530,180,{expr:t<30.2?'scan':'love',et:t-30.2,t,alpha:P(t,28.8,29.1)});}
function shotAnalyze(t){ // 32.8 - 37.0 : exploded poster on top, palette + lessons below
  background(t);chapter(t,32.85,37.0,'05','حلل تصميم وتعلم منه','ANALYZE & LEARN');
  const cx=W/2,cy=640,pw=520,ph=650;const k=pw/600;const a=eOutExpo(P(t,32.9,33.4));const ex=eOutExpo(P(t,33.3,33.9));
  for(let j=2;j>=1;j--){ctx.save();ctx.globalAlpha=0.25*ex;imgCard(IM.V4,cx-j*34*ex,cy-j*20*ex,pw,ph,{rotY:0.1,shadow:false,border:'rgba(255,123,32,0.6)'});ctx.restore();}
  imgCard(IM.V4,cx+18*ex,cy+10*ex,pw,ph,{rotY:0.1,alpha:a});
  const gx=cx+18*ex,gy=cy+10*ex;const ga=P(t,33.8,34.1);
  if(ga>0){ctx.save();ctx.globalAlpha=ga;ctx.translate(gx,gy);ctx.transform(Math.cos(0.1),Math.sin(0.1)*0.16,0,1,0,0);ctx.strokeStyle='rgba(255,200,150,0.85)';ctx.lineWidth=2;ctx.setLineDash([10,8]);
    for(const f of[1/3,2/3]){ctx.beginPath();ctx.moveTo(-pw/2+pw*f,-ph/2);ctx.lineTo(-pw/2+pw*f,ph/2);ctx.stroke();ctx.beginPath();ctx.moveTo(-pw/2,-ph/2+ph*f);ctx.lineTo(pw/2,-ph/2+ph*f);ctx.stroke();}ctx.setLineDash([]);
    [[0,160*k,'1'],[-150*k,-120*k,'2'],[0,-300*k,'3']].forEach(([x,y,n],i)=>{const p=eob(P(t,34.1+i*0.15,34.4+i*0.15));ctx.fillStyle=C.ember;ctx.shadowColor=C.ember;ctx.shadowBlur=18;ctx.beginPath();ctx.arc(x,y,24*p,0,6.283);ctx.fill();ctx.shadowBlur=0;T(n,x,y+2,28*p,{w:900});});ctx.restore();}
  T('الباليتة',W-70,1060,34,{w:900,align:'right',alpha:P(t,34.3,34.6)});
  const sw=[VZ.blue,VZ.sky,VZ.ice,VZ.rose,VZ.ink];sw.forEach((c,i)=>{const p=eob(P(t,34.3+i*0.08,34.6+i*0.08));if(p<=0)return;const x=W-160-i*170;ctx.save();ctx.translate(x,1150);ctx.scale(p,p);rr(ctx,-55,-55,110,110,22);ctx.fillStyle=c;ctx.fill();ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=2;ctx.stroke();ctx.restore();T(c,x,1228,18,{w:700,col:'rgba(255,220,200,0.7)'});});
  maroAt('M5',150,1080,120,{expr:'scan',t,alpha:P(t,33.0,33.3)});
  const lessons=[['التكوين','قاعدة الأثلاث.. العيلة في التلتين اللي تحت'],['الترتيب','العيلة ← الدكاترة ← مساحة العنوان'],['الفكرة','دكاترة بتحرس العيلة.. الأمان من غير كلام']];
  lessons.forEach(([kk,v],i)=>{const t0=34.8+i*0.4;const p=eOutExpo(P(t,t0,t0+0.4));if(p<=0)return;const y=1330+i*130;ctx.save();ctx.globalAlpha=p;ctx.translate((1-p)*80,0);card(50,y-56,980,112,{r:24});
    T(kk,1000,y-18,26,{w:900,align:'right',col:C.ember});T(v,1000,y+22,31,{w:700,align:'right'});ctx.restore();});}
function shot247(t){ // 37.0 - 43.0 : clock + MARO on top, chat panel below
  background(t);chapter(t,37.05,43.0,'06','مارو صاحي 24 ساعة','ALWAYS ON');
  const roll=eInOut(P(t,39.7,40.2));const clockA=P(t,37.1,37.4);
  ctx.save();ctx.globalAlpha=clockA;ctx.beginPath();ctx.rect(40,250,760,220);ctx.clip();
  text3D('03:12',400,360-roll*220,170,{depth:14});T('AM',680,415-roll*220,38,{w:900,col:C.ember});
  text3D('11:40',400,580-roll*220,170,{depth:14});T('PM',680,635-roll*220,38,{w:900,col:C.ember});ctx.restore();
  maroAt('M5',900,360,150,{expr:t<38.6?'think':(t<39.6?'check':(t<41.5?'think':'love')),et:t<39.6?t-38.6:t-41.5,t,alpha:clockA});
  const px=40,py=520,pw=1000,ph=1150;card(px,py,pw,ph,{r:40,alpha:P(t,37.1,37.4),glow:30});
  ctx.save();ctx.beginPath();ctx.rect(px+10,py+80,pw-20,ph-90);ctx.clip();const scroll=0;ctx.translate(0,-scroll);
  T('MARO',px+pw/2,py+42+scroll,22,{w:900,ls:8,col:C.ember,alpha:P(t,37.1,37.4)});
  const h1=msg('user','الصورة بتبوظ وتتكسر لما أكبّرها في البوستر!',px+pw-30,py+110,880,37.4,t,{size:46});
  if(t>38.0&&t<38.5)typingDots(px+100,py+160+h1,t);
  const h2=msg('maro','حوّلها Smart Object قبل ما تعمل Scale.. وهتفضل محافظة على جودتها',px+30+900,py+150+h1,900,38.5,t,{check:true,size:46});
  const y2=py+200+h1+h2;msg('user','لو فاتتني محاضرة؟',px+pw-30,y2,880,40.5,t,{size:46});
  if(t>41.0&&t<41.5)typingDots(px+100,y2+160,t);
  msg('maro','ولا يهمك.. كل المحاضرات بتتسجل وتفضل معاك حتى بعد الكورس',px+30+900,y2+130,900,41.5,t,{check:true,size:46});
  ctx.restore();}
function shotCoach(t){ // 43.0 - 48.0 : project board on top, coach score card below
  background(t);chapter(t,43.05,48.0,'07','المدرب مارو','COACH MARO');
  const a=eOutExpo(P(t,43.1,43.6));const bx=40,by=250,bw=1000,bh=600;
  ctx.save();ctx.globalAlpha=a;ctx.translate(bx+bw/2,by+bh/2);ctx.scale(lerp(0.9,1,a),lerp(0.9,1,a));ctx.translate(-(bx+bw/2),-(by+bh/2));
  card(bx,by,bw,bh,{r:32,glow:30});T('مشروع التخرج',bx+bw-40,by+54,38,{w:900,align:'right'});T('VEZEETA  ·  FAMILY',bx+40,by+56,20,{w:900,ls:5,align:'left',col:C.ember});
  const iw=286,ih=358;[IM.V5,IM.V6,IM.V7].forEach((im,i)=>{const p=eOutExpo(P(t,43.4+i*0.15,43.9+i*0.15));imgCard(im,bx+bw-38-iw/2-i*(iw+21),by+110+ih/2+(1-p)*80,iw,ih,{alpha:p,shadow:false,r:16});});
  ['أسنان','عظام','قلب'].forEach((s,i)=>T(s,bx+bw-38-iw/2-i*(iw+21),by+515,30,{w:700,alpha:P(t,43.9+i*0.1,44.2+i*0.1)}));
  ctx.restore();
  const sx=40,sy=890,sw=1000,sh=790;card(sx,sy,sw,sh,{r:32,alpha:P(t,43.6,43.9),glow:30});
  ctx.save();ctx.globalAlpha=P(t,43.6,43.9);T('تقييم المدرب مارو',sx+sw-40,sy+56,38,{w:900,align:'right'});maroAt('M5',sx+80,sy+58,80,{expr:t<46.4?'scan':'fire',et:t-46.4,t});ctx.restore();
  bar('الفكرة',9,sx+40,sy+180,sw-80,44.2,t);bar('الهوية البصرية',8,sx+40,sy+290,sw-80,44.5,t);bar('التسويق',7,sx+40,sy+400,sw-80,44.8,t);
  const tp=eob(P(t,45.6,46.0));if(tp>0){ctx.save();ctx.translate(sx+sw/2,sy+600);ctx.scale(tp,tp);rr(ctx,-sw/2+30,-100,sw-60,200,24);ctx.fillStyle=orangeFill(0,-100,0,200);ctx.shadowColor=C.ember;ctx.shadowBlur=40;ctx.fill();ctx.shadowBlur=0;
    T('نصيحة مارو',sw/2-70,-55,28,{w:900,align:'right',col:'rgba(255,240,230,0.9)'});T('ضيف بوست للتطبيق نفسه',sw/2-70,5,38,{w:800,align:'right'});T('يقفل السلسلة.. هتفرق جامد',sw/2-70,58,38,{w:800,align:'right'});ctx.restore();}}
function shotUSP(t){ // 48.0 - 53.6 : tall grid scrolling up, light-ball wanders
  background(t,{glow:1.1});
  const imgs=[IM.V1,IM.V2a,IM.V3,IM.V4,IM.V5,IM.V6,IM.V7];const pan=(t-48)*60;
  const bx=W/2+Math.cos((t-48)*1.3)*330,by=H/2+Math.sin((t-48)*2.1)*560;
  ctx.save();ctx.filter=`blur(${lerp(0,3,P(t,48.6,49.2))}px)`;
  for(const g of GRID){const x=W/2+g.r*185,y=H/2+g.c*185+40-pan;if(y<-150||y>H+150||x<-150||x>W+150)continue;const d=Math.hypot(x-bx,y-by);const lit=Math.exp(-(d*d)/(2*140*140));
    const a=P(t,48.0+Math.abs(g.c)*0.05,48.4+Math.abs(g.c)*0.05)*(0.35+0.65*Math.exp(-(Math.hypot(g.r*0.8,g.c*0.5)**2)/12));gridTile(imgs[g.k],x,y,1,lit,a);}
  ctx.restore();
  ctx.save();ctx.globalCompositeOperation='lighter';glowBlob(bx,by,160,'rgba(255,170,90,0.95)',P(t,48.2,48.5));glowBlob(bx,by,40,'rgba(255,240,220,1)',P(t,48.2,48.5));ctx.restore();
  ctx.fillStyle='rgba(18,4,3,0.6)';ctx.fillRect(0,H/2-330,W,620);
  const r3=P(t,48.6,49.1);text3D('المكان الوحيد',W/2,H/2-180,138,{rotY:lerp(-1.1,0,eOutExpo(r3)),alpha:clamp(r3*3),depth:18});
  const s1='اللي بيديلك مساعد ذكي شخصي..';typeOn(s1,W/2+tw(s1,54,800)/2,H/2,54,49.5,t,{col:C.white,w:800});
  const s2a='معاك 24 ساعة..',s2b='طول الكورس وبعده';typeOn(s2a,W/2+tw(s2a,64)/2,H/2+110,64,50.6,t,{col:C.ember});typeOn(s2b,W/2+tw(s2b,64)/2,H/2+200,64,51.0,t,{col:C.ember});
  const fly=P(t,52.4,53.6);if(fly>0){const my=lerp(H+300,-300,eInOut(fly));maroAt('M2',W/2+Math.sin(fly*6)*120,my,170,{expr:'happy',t,thrust:1.6,rot:-0.1});}}
function shotCTA(t){ // 53.6 - 60 : text + coupon on top, MARO below, then end card
  background(t,{glow:1.3});watermark(W/2,1250,1500,0.35);
  const endP=eInOut(P(t,57.3,58.0));
  ctx.save();ctx.globalAlpha=1-endP;
  const r3=P(t,54.0,54.6);text3D('جرّب مارو',W/2,280,140,{rotY:lerp(-1.1,0,eOutExpo(r3)),alpha:clamp(r3*3),depth:16});
  text3D('دلوقتي',W/2,430,140,{rotY:lerp(-1.1,0,eOutExpo(P(t,54.15,54.75))),alpha:clamp(P(t,54.15,54.75)*3),depth:16});
  T('المساعد الذكي المدعوم بالذكاء الاصطناعي',W/2,560,40,{w:700,alpha:P(t,54.6,54.9)});T('من صابر جروب',W/2,615,42,{w:900,col:C.ember,alpha:P(t,54.8,55.1)});
  coupon(W/2,790,t,55.2);
  const up=eOutExpo(P(t,56.0,56.3));if(up>0){const url='ai.sabergroupacademy.com';const n=Math.floor(url.length*P(t,56.1,56.8));ctx.save();ctx.translate(W/2,965);ctx.scale(up,up);rr(ctx,-440,-46,880,92,46);ctx.fillStyle='rgba(255,255,255,0.06)';ctx.fill();ctx.strokeStyle='rgba(255,176,112,0.8)';ctx.lineWidth=2.5;ctx.shadowColor=C.ember;ctx.shadowBlur=30;ctx.stroke();ctx.shadowBlur=0;
    const full=tw(url,44,900,1);T(url.slice(0,n),-full/2,2,44,{w:900,align:'left',ls:1});ctx.restore();}
  const inn=eOutExpo(P(t,53.6,54.2));maroAt('M2',W/2,lerp(H+500,1290,inn)+Math.sin(t*2.4)*14,300,{expr:t<55.0?'happy':'fire',et:t-55.0,t,thrust:0.9});
  ctx.restore();
  if(t>=57.0){const p=eOutExpo(P(t,57.0,57.6)),m=eInOut(P(t,57.6,58.3));const cw=lerp(760,W,m),ch=lerp(1000,H,m),cy=lerp(H+600,H/2,p)*(1-m)+H/2*m;
    ctx.save();rr(ctx,W/2-cw/2,cy-ch/2,cw,ch,lerp(40,0,m));ctx.clip();ctx.fillStyle='#0d0302';ctx.fillRect(0,0,W,H);
    const g=ctx.createRadialGradient(W/2,cy+ch*0.35,0,W/2,cy+ch*0.35,ch);g.addColorStop(0,'rgba(196,50,31,0.55)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    const k=ch/H;ctx.translate(W/2,cy);ctx.scale(k,k);
    const L=300;ctx.save();ctx.shadowColor='rgba(196,50,31,0.8)';ctx.shadowBlur=60;rr(ctx,-L/2,-460,L,L,60);ctx.clip();ctx.drawImage(IM.logo,-L/2,-460,L,L);ctx.restore();
    T('معاك.. على طول',0,-30,104,{w:900,glow:30});T('ai.sabergroupacademy.com',0,90,42,{w:800,col:C.ember,ls:1});
    maroAt('M5',0,420,200,{expr:t>59.0&&t<59.4?'wink':'happy',et:t-59.0,t});ctx.restore();}}
