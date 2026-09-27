// ================= MARO LAUNCH — vertical 9:16 recomposition =================
// The 16:9 stage is rendered as usual (no background), then key blocks are cut out and
// stacked into a 1080x1920 frame over a native vertical background.
window.NOBG=true;window.NOTEAR=true;
const VW=1080,VH=1920;
cv.width=VW;cv.height=VH;
const vfr=document.createElement('canvas');vfr.width=VW;vfr.height=VH;const vx=vfr.getContext('2d');
const CH=[[1180,50,720,170],1.35,54,90];                       // chapter badge
const cxd=(w,s)=>(VW-w*s)/2;
// [src x,y,w,h], scale, dst x, dst y   (dst x 'c' = centred)
function R(src,s,dy,dx='c'){return[src,s,dx==='c'?cxd(src[2],s):dx,dy];}
function recipe(t){
  if(t<4.0)return[R([620,0,1300,1080],0.83,500),R([140,80,340,130],1.6,190)];
  if(t<6.4)return[R([360,0,1200,1080],0.9,470)];
  if(t<9.4)return[R([960,250,760,560],1.3,260),R([330,130,600,950],1.0,930)];
  if(t<14.4)return[CH,R([860,230,980,660],1.08,380),R([200,200,420,750],1.0,1140)];
  if(t<18.4)return[CH,R([690,240,1130,660],0.94,400),R([180,230,330,620],1.2,1110)];
  if(t<21.2)return[CH,R([110,230,820,570],1.25,330),R([990,370,840,380],1.2,1090),R([95,780,180,170],1.3,1590)];
  if(t<23.4)return[CH,R([380,170,1160,600],0.92,450),R([80,790,180,170],1.3,1250)];
  if(t<25.3)return[CH,R([360,190,1200,760],0.9,420),R([80,790,180,170],1.3,1320)];
  if(t<26.8)return[CH,R([160,300,800,540],1.25,300),R([1110,300,800,540],1.25,980),R([80,790,180,170],1.1,1640)];
  if(t<32.8)return[CH,R([240,140,640,860],1.02,250),R([990,240,860,420],1.2,1150),R([1060,630,640,340],0.9,1620)];
  if(t<37.0)return[CH,R([150,150,760,870],0.95,260),R([980,240,860,700],1.2,1090)];
  if(t<43.0)return[CH,R([80,320,780,600],0.85,300),R([970,200,860,810],1.2,880)];
  if(t<48.0)return[CH,R([80,240,1100,720],0.97,330),R([1220,240,640,720],1.15,1060)];
  if(t<53.6)return[R([400,0,1120,1080],0.96,400)];
  if(t<57.6)return[R([790,180,940,680],1.1,250),R([300,170,470,780],1.1,1030)];
  return[R([410,0,1100,1080],0.98,431)];
}
function bgV(t,c){c.fillStyle=C.bg;c.fillRect(0,0,VW,VH);
  const blob=(x,y,r,col)=>{const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);};
  blob(Math.sin(t*0.5)*60,VH+Math.cos(t*0.4)*40,1300,'rgba(196,50,31,0.55)');blob(VW+Math.cos(t*0.45)*60,-40+Math.sin(t*0.6)*40,1100,'rgba(255,123,32,0.28)');blob(VW/2,VH/2,1100,'rgba(60,8,4,0.6)');}
function tearV(t,c){if(t>=0.78)return;const open=t<0.12?7:lerp(7,VH*0.8,eInOut(P(t,0.12,0.74)));const Rn=rng(11);const j1=Array.from({length:7},()=>(Rn()-0.5)*70),j2=Array.from({length:7},()=>(Rn()-0.5)*70);
  const g=c.createLinearGradient(0,0,VW,VH);g.addColorStop(0,'#FF8A2A');g.addColorStop(1,'#F06A10');c.fillStyle=g;
  for(const[sg,j]of[[-1,j1],[1,j2]]){c.beginPath();c.moveTo(0,sg<0?-10:VH+10);c.lineTo(VW,sg<0?-10:VH+10);for(let k=6;k>=0;k--){const x=k*VW/6;c.lineTo(x,VH/2+sg*open/2+j[k]*(0.4+open/VH)+(x-VW/2)*-0.05);}c.closePath();c.fill();}}
const grainsV=[];{const Rg=rng(7);for(let k=0;k<6;k++){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');const d=g.createImageData(256,256);for(let i=0;i<d.data.length;i+=4){const v=Rg()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255;}g.putImageData(d,0,0);grainsV.push(c);}}
window.renderFrame=function(f){const t0=f/FPS,N=nSub(t0),shutter=0.5/FPS;const o=out;o.setTransform(1,0,0,1,0,0);o.globalAlpha=1;o.fillStyle='#000';o.fillRect(0,0,VW,VH);
  for(let k=0;k<N;k++){const t=Math.max(0,t0+(N>1?(k/(N-1)-0.5)*shutter:0));
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';ctx.clearRect(0,0,W,H);
    ctx.translate(W/2,H/2);ctx.rotate(Math.sin(t*0.35)*0.005);const z=1.02+Math.sin(t*0.25)*0.01;ctx.scale(z,z);ctx.translate(-W/2+Math.sin(t*0.4)*8,-H/2+Math.cos(t*0.33)*5);
    scene(t);
    bgV(t,vx);
    if(t<4.0){vx.save();vx.globalAlpha=0.35;vx.filter='blur(18px)';vx.drawImage(IM.S1,420,0,1080,1080,-420,0,1920,1920);vx.restore();}
    for(const[s,sc,dx,dy]of recipe(t)){vx.drawImage(sub,s[0],s[1],s[2],s[3],dx,dy,s[2]*sc,s[3]*sc);}
    tearV(t,vx);const fo=P(t,59.7,60);if(fo>0){vx.fillStyle=`rgba(0,0,0,${fo})`;vx.fillRect(0,0,VW,VH);}
    o.globalAlpha=1/(k+1);o.drawImage(vfr,0,0);}
  o.globalAlpha=1;const v=o.createRadialGradient(VW/2,VH/2,VW*0.3,VW/2,VH/2,VH*0.62);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,0.5)');o.fillStyle=v;o.fillRect(0,0,VW,VH);
  o.save();o.globalAlpha=0.06;o.globalCompositeOperation='overlay';o.translate((f*37)%256,(f*91)%256);o.fillStyle=o.createPattern(grainsV[f%6],'repeat');o.fillRect(-256,-256,VW+512,VH+512);o.restore();};
