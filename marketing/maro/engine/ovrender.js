// renders transparent PNG overlay frames: node ovrender.js <page> <outdir> <f0> <f1>
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const[page,dir,f0,f1]=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
  const b=await chromium.launch({args:['--allow-file-access-from-files']});const p=await b.newPage({viewport:{width:1080,height:1920}});
  p.on('pageerror',e=>console.log('ERR',e.message));await p.goto('file://'+__dirname+'/'+page);await p.evaluate(()=>window.ready);
  for(let f=+f0;f<+f1;f++){await p.evaluate(f=>renderFrame(f),f);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await p.screenshot({path:`${dir}/o_${String(f).padStart(5,'0')}.png`,omitBackground:true});if(f%120==0)console.log('frame',f);}
  await b.close();})();
