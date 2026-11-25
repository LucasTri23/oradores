// Verificação opt-in: node tests/auth-demo.browser.cjs. Só usa contas e respostas fictícias.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'.test-artifacts','auth'),token='11111111-2222-4333-8444-555555555555';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let chrome,socket;
const mock=`
window.__errors=[];window.__authCalls=[];window.__rpcCalls=[];window.__cls=0;
addEventListener('error',e=>__errors.push(e.message));addEventListener('unhandledrejection',e=>__errors.push(String(e.reason)));
new PerformanceObserver(list=>list.getEntries().forEach(e=>{if(!e.hadRecentInput)__cls+=e.value;})).observe({type:'layout-shift',buffered:true});
const params=new URLSearchParams(location.search);Conta.usuario=async()=>params.get('screen')==='invite'?{id:'fake-user',email:'conta@example.invalid'}:null;
Conta.entrar=async url=>{__authCalls.push(url);throw new Error('Falha fictícia de autenticação');};
Conta.supabase=async()=>({rpc:async(name,args)=>{__rpcCalls.push(name);if(name==='get_workspace_invite_name')return {data:'Congregação Fictícia Alfa'};return {data:'fake-workspace'};}});
DesignaUI.registrarApp=()=>{};localStorage.setItem('bj_theme',params.get('theme')||'light');
`;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname);
  if(pathname==='/mock-auth.js'){res.setHeader('Content-Type','text/javascript');return res.end(mock);}
  if(pathname!=='/'&&!/^\/(assets|designacoes)\//.test(pathname)){res.statusCode=404;return res.end();}
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.statusCode=403;return res.end();}
  try{let data=fs.readFileSync(file);if(pathname==='/')data=data.toString().replace(/(<script src="\/assets\/shared\/conta[^>]+><\/script>)/,'$1<script src="/mock-auth.js"></script>').replace(/<script src="https:\/\/unpkg[^>]+><\/script>/,'');
    const ext=path.extname(file);res.setHeader('Content-Type',ext==='.html'?'text/html; charset=utf-8':ext==='.css'?'text/css':ext==='.js'?'text/javascript':ext==='.png'?'image/png':'application/octet-stream');res.end(data);
  }catch{res.statusCode=404;res.end();}
});
(async()=>{
  fs.mkdirSync(artifacts,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
  const binary=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'designa-auth-browser-'));let log='';
  chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'http://127.0.0.1:'+port+'/'],{windowsHide:true,stdio:['ignore','ignore','pipe']});chrome.stderr.on('data',d=>log+=d);
  const activePort=path.join(profile,'DevToolsActivePort');for(let i=0;i<80&&!fs.existsSync(activePort);i++)await sleep(150);if(!fs.existsSync(activePort))throw new Error('Chrome indisponível: '+log.slice(-1000));
  const debugPort=fs.readFileSync(activePort,'utf8').split('\n')[0],pages=await(await fetch('http://127.0.0.1:'+debugPort+'/json')).json(),target=pages.find(p=>p.type==='page');
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>socket.onopen=r);let seq=0;const pending=new Map();
  socket.onmessage=e=>{const m=JSON.parse(e.data),call=pending.get(m.id);if(call){pending.delete(m.id);m.error?call.reject(new Error(JSON.stringify(m.error))):call.resolve(m.result);}};
  const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(100);}throw new Error('Timeout: '+expression+'\n'+await evaluate('document.body.innerText'));};
  const navigate=async(query='')=>{await cmd('Page.navigate',{url:'http://127.0.0.1:'+port+'/'+query});await wait(`!!document.getElementById('designaAuthDemo')`);await evaluate('document.fonts.ready');await sleep(1100);};
  const viewport=async(width,height,mobile=false)=>{await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await sleep(250);};
  const screenshot=async name=>{const image=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(artifacts,name+'.png'),Buffer.from(image.data,'base64'));};
  await viewport(1440,1000);await navigate();await wait(`document.getElementById('designaAuthDemo').dataset.playing==='true'`);
  assert.equal(await evaluate(`document.getElementById('vLogin').hidden`),false);
  const logo=await evaluate(`[...document.querySelectorAll('.exit-brand img')].map(i=>i.getAttribute('src'))`);assert(logo.every(src=>src==='/assets/images/designa-icon-v1.png'));
  const first=await evaluate(`document.getElementById('designaAuthDemo').dataset.module`),baseline=await evaluate('__cls'),bounds=await evaluate(`JSON.stringify(document.querySelector('.ad-stage').getBoundingClientRect().toJSON())`);
  await sleep(6300);assert.notEqual(await evaluate(`document.getElementById('designaAuthDemo').dataset.module`),first);assert.equal(await evaluate(`JSON.stringify(document.querySelector('.ad-stage').getBoundingClientRect().toJSON())`),bounds);
  assert(await evaluate('__cls')-baseline<.001,'ciclos não devem provocar layout shift');console.log('Ciclo automático e layout estável: OK');
  await evaluate(`document.querySelector('.ad-pause').click()`);const paused=await evaluate(`document.getElementById('designaAuthDemo').dataset.module`);await sleep(6200);assert.equal(await evaluate(`document.getElementById('designaAuthDemo').dataset.module`),paused);assert.equal(await evaluate(`document.getElementById('designaAuthDemo').dataset.playing`),'false');
  await evaluate(`document.querySelector('.ad-pause').click()`);await wait(`document.getElementById('designaAuthDemo').dataset.playing==='true'`);
  const extra=await cmd('Target.createTarget',{url:'about:blank'});await cmd('Target.activateTarget',{targetId:extra.targetId});await wait('document.hidden');assert.equal(await evaluate(`document.getElementById('designaAuthDemo').dataset.playing`),'false');await cmd('Target.closeTarget',{targetId:extra.targetId});await cmd('Target.activateTarget',{targetId:target.id});await wait(`!document.hidden&&document.getElementById('designaAuthDemo').dataset.playing==='true'`);
  console.log('Pausa, retomada e aba oculta: OK');
  const keys=['oradores','designacoes','territorios','publicacoes'];
  for(let i=0;i<4;i++){await evaluate(`document.querySelectorAll('.ad-tab')[${i}].click()`);assert.equal(await evaluate(`document.getElementById('designaAuthDemo').dataset.module`),keys[i]);await sleep(3200);await screenshot('desktop-'+keys[i]);}
  await evaluate(`document.querySelectorAll('.ad-tab')[0].click()`);await sleep(4200);assert(await evaluate(`Number(getComputedStyle(document.querySelector('.ad-panel:not([hidden]) .ad-notice')).opacity)>.9`));await screenshot('desktop-confirmacao-simulada');
  await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await wait(`document.getElementById('designaAuthDemo').dataset.reduced==='true'`);
  assert.equal(await evaluate(`document.querySelector('.ad-pause').disabled`),true);const reducedIndex=await evaluate(`document.getElementById('designaAuthDemo').dataset.module`);await sleep(6200);assert.equal(await evaluate(`document.getElementById('designaAuthDemo').dataset.module`),reducedIndex);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.ad-territory-moving')).animationName`),'none');console.log('Movimento reduzido e navegação manual: OK');
  const screens=[['login','','vLogin'],['saida','?saiu=1','vSaiu'],['convite','?equipe='+token+'&screen=invite','vConvite']];
  for(const [name,query,id] of screens){for(const [device,width,height,mobile] of [['desktop',1440,1000,false],['tablet',834,1112,true],['mobile',390,844,true]]){
    await viewport(width,height,mobile);await navigate(query);assert.equal(await evaluate(`document.getElementById('${id}').hidden`),false);assert.equal(await evaluate(`document.querySelectorAll('#designaAuthDemo').length`),1);assert.equal(await evaluate(`document.getElementById('designaAuthDemo').closest('.exit-screen').id`),id);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
    if(device==='mobile'){await evaluate(`document.getElementById('designaAuthDemo').scrollIntoView()`);await sleep(150);assert.equal(await evaluate(`getComputedStyle(document.querySelector('.ad-notice')).display`),'none');}
    await screenshot(name+'-'+device);assert.deepEqual(await evaluate('__errors'),[]);
  }}
  await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await viewport(390,500,true);await navigate();await evaluate('scrollTo(0,0)');await wait(`document.getElementById('designaAuthDemo').dataset.playing==='false'`);await viewport(390,844,true);await screenshot('login-mobile-primeira-dobra');await evaluate(`document.getElementById('designaAuthDemo').scrollIntoView()`);await wait(`document.getElementById('designaAuthDemo').dataset.playing==='true'`);assert.equal(await evaluate(`getComputedStyle(document.body,'::before').animationName`),'none');await evaluate(`document.querySelectorAll('.ad-tab')[2].click()`);assert.equal(await evaluate(`getComputedStyle(document.querySelector('.ad-territory-moving')).animationName`),'auth-territory-mobile');await screenshot('login-mobile-movimento-simplificado');
  await viewport(1440,1000);await navigate('?equipe='+token+'&screen=invite&theme=dark');assert.equal(await evaluate(`document.getElementById('conviteTitulo').textContent`),'Congregação Fictícia Alfa');assert.deepEqual(await evaluate('__rpcCalls'),['get_workspace_invite_name']);await evaluate(`document.getElementById('conviteAcao').click()`);await wait(`document.getElementById('conviteTitulo').textContent==='Convite aceito.'`);assert.equal(await evaluate('location.search.includes("equipe=")'),false);await screenshot('convite-confirmado-dark');
  await navigate('?equipe='+token);await evaluate(`document.getElementById('conviteAcao').click()`);await wait(`document.getElementById('conviteErr').hidden===false`);assert((await evaluate('__authCalls[0]')).includes('equipe='+token));assert(!(await evaluate('__rpcCalls')).includes('accept_workspace_invite'));
  const report={desktop:true,tablet:true,mobile:true,automaticCycle:true,pauseResume:true,hiddenTab:true,reducedMotion:true,mobileSimplified:true,offscreenSuspension:true,floatingConfirmation:true,manualNavigation:true,singleDemo:true,logoPreserved:true,inviteConfirmation:true,authRedirectPreserved:true,cycleCLS:0,consoleErrors:0};
  fs.writeFileSync(path.join(artifacts,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await cmd('Browser.close');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{socket?.close();chrome?.kill();server.close();});
