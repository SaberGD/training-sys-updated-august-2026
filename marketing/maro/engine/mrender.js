// usage: node mrender.js sheet | stills <t...> | video <seconds> <out.mp4>
const {chromium}=require('playwright');const fs=require('fs');const {spawn}=require('child_process');
(async()=>{
  const [mode,...args]=process.argv.slice(2);
  const b=await chromium.launch({args:['--allow-file-access-from-files']});
  const p=await b.newPage({viewport:{width:1920,height:1080}});
  p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
  await p.goto('file://'+__dirname+'/maro.html'+(mode==='sheet'?'?mode=sheet':''));await p.evaluate(()=>window.ready);
  fs.mkdirSync('out',{recursive:true});
  if(mode==='sheet'){await p.evaluate(()=>renderFrame(0));await p.screenshot({path:'out/expressions.png'});}
  else if(mode==='stills'){for(const t of args){await p.evaluate(f=>renderFrame(f),Math.round(+t*60));await p.screenshot({path:`out/s_${t}.jpg`,type:'jpeg',quality:85});}}
  else{const secs=+args[0],name=args[1];const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate','60','-c:v','mjpeg','-i','-','-c:v','libx264','-preset','slow','-crf','17','-pix_fmt','yuv420p',name],{stdio:['pipe','ignore','inherit']});
    const N=Math.round(secs*60);for(let f=0;f<N;f++){await p.evaluate(f=>renderFrame(f),f);const buf=await p.screenshot({type:'jpeg',quality:94});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(f%60==0)console.log('frame',f,'/',N);}
    ff.stdin.end();await new Promise(r=>ff.on('close',r));}
  await b.close();
})();
