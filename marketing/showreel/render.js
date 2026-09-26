const {chromium}=require('playwright');const fs=require('fs');const {spawn}=require('child_process');
(async()=>{
  const mode=process.argv[2]||'stills';const V=!!process.env.VERTICAL;const [VW,VH]=V?[1080,1920]:[1920,1080];const tag=V?'-vertical':'';
  const b=await chromium.launch({args:['--allow-file-access-from-files']});
  const p=await b.newPage({viewport:{width:VW,height:VH}});
  p.on('console',m=>console.log('LOG',m.text()));p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto('file://'+__dirname+'/reel.html'+(V?'?v':''));await p.evaluate(()=>window.ready);
  if(mode==='stills'){
    const ts=process.argv.slice(3).map(Number);fs.mkdirSync('stills',{recursive:true});
    for(const t of ts){await p.evaluate(f=>renderFrame(f),Math.round(t*30));await p.screenshot({path:`stills/t${t}${tag}.jpg`,quality:80,type:'jpeg'});}
  }else{
    const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p',`video${tag}.mp4`],{stdio:['pipe','ignore','inherit']});
    for(let f=0;f<900;f++){await p.evaluate(f=>renderFrame(f),f);const buf=await p.screenshot({type:'jpeg',quality:95});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(f%100==0)console.log('frame',f);}
    ff.stdin.end();await new Promise(r=>ff.on('close',r));
  }
  await b.close();
})();
