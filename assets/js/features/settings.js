// GEMINI AI
async function gemini(prompt,key,retry=0){
  const url='https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key='+key;
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
  if(r.status===429){if(retry<2){await new Promise(res=>setTimeout(res,3000*(retry+1)));return gemini(prompt,key,retry+1);}throw new Error('Limite atingido (429). Aguarde e tente novamente.');}
  if(!r.ok)throw new Error('HTTP '+r.status);
  const data=await r.json();return data.candidates?.[0]?.content?.parts?.[0]?.text||'Sem resposta.';
}
function buildCtx(){
  const ct={};discursos.forEach(d=>{if(d.temaNum&&d.temaNum>0)ct[d.temaNum]=(ct[d.temaNum]||0)+1;});
  const topT=Object.entries(ct).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([n,c])=>'T'+n+'('+( TL[n]||'?')+'):'+c+'x').join(', ');
  const sem=oradores.map(o=>{const u=getUltimoDiscurso(o);const m=u?Math.floor((new Date()-new Date(u+'T12:00:00'))/(864e5*30.44)):999;return o.nome+'('+( o.cong||'—')+'):'+( m>900?'nunca':m+'m');}).sort().slice(0,10).join(', ');
  return (cfg.cong||'Minha Congregação')+'\nOradores:'+oradores.length+' | Discursos:'+discursos.length+'\nTop temas: '+topT+'\nSem discursar: '+sem;
}
function toggleAI(){document.getElementById('aiPanel').classList.toggle('open');}
function closeAI(){document.getElementById('aiPanel').classList.remove('open');}
async function sendAI(){const inp=document.getElementById('aiIn');const msg=inp.value.trim();if(!msg)return;inp.value='';await askAI(msg);}
async function askAI(msg){
  const gk=localStorage.getItem('bj_gem');
  document.getElementById('aiPanel').classList.add('open');
  addAIMsg('u',msg);
  if(!gk){addAIMsg('b','⚠️ Configure a chave Gemini em ⚙️ Config.');return;}
  const bot=addAIMsg('b','⏳ Pensando...');
  try{const r=await gemini(buildCtx()+'\n\nVocê é um assistente de organização de discursos. Responda em português.\n\nPergunta: '+msg,gk);bot.textContent=r;}
  catch(e){bot.textContent='✗ '+e.message;}
}
function addAIMsg(tipo,txt){const d=document.createElement('div');d.className='ai-msg '+tipo;d.textContent=txt;const c=document.getElementById('aiMsgs');c.appendChild(d);d.scrollIntoView({behavior:'smooth',block:'nearest'});return d;}

// CONFIG
async function loadConfig(){
  if(!db)return;
  // App config
  const appDoc=await FF.get(FF.doc(db,'config','app'));
  if(appDoc.exists){
    const d=appDoc.data();
    if(d.cong)cfg.cong=d.cong;
    if(d.end)cfg.end=d.end;
    if(d.hor)cfg.hor=d.hor;
    if(d.dia===0||d.dia===6)cfg.dia=d.dia;
    cfg.sugerirSentinela=!!d.sugerirSentinela;
    if(d.groupMsg)cfg.groupMsg=d.groupMsg;
  } else {
    // migração única do localStorage
    const lc=localStorage.getItem('bj_cfg');
    if(lc){cfg=JSON.parse(lc);FF.set(FF.doc(db,'config','app'),cfg);}
  }
  // Mensagens
  const msgsDoc=await FF.get(FF.doc(db,'config','mensagens'));
  if(msgsDoc.exists&&msgsDoc.data().lista){
    const mensagensSalvas=msgsDoc.data().lista;
    mensagens=mensagensSalvas.map(m=>({...m,texto:repararEmojisMensagem(m.texto),tipo:m.tipo||(String(m.titulo||'').toLowerCase().includes('convite')?'convite':'geral')}));
    if(mensagens.some((m,i)=>m.texto!==mensagensSalvas[i]?.texto))await FF.set(FF.doc(db,'config','mensagens'),{lista:mensagens});
  } else {
    const lm=localStorage.getItem('bj_msgs');
    if(lm){mensagens=JSON.parse(lm).map(m=>({...m,texto:repararEmojisMensagem(m.texto),tipo:m.tipo||(String(m.titulo||'').toLowerCase().includes('convite')?'convite':'geral')}));FF.set(FF.doc(db,'config','mensagens'),{lista:mensagens});}
  }
  // Temas (overrides + bloqueados)
  const temasDoc=await FF.get(FF.doc(db,'config','temas'));
  if(temasDoc.exists){
    const d=temasDoc.data();
    if(d.overrides)Object.assign(TL,d.overrides);
    if(d.bloqueados)bloqueados=new Set((d.bloqueados||[]).map(Number));
  } else {
    // migração única do localStorage
    const lt=localStorage.getItem('bj_temas');
    const lb=localStorage.getItem('bj_bloqueados');
    if(lt){const ov=JSON.parse(lt);Object.entries(ov).forEach(([k,v])=>{if(v==='(Não use.)')bloqueados.add(+k);else TL[k]=v;});}
    if(lb)bloqueados=new Set(JSON.parse(lb).map(Number));
    if(lt||lb)salvarConfigTemas();
  }
  renderMensagens();
  updateBranding();
  document.getElementById('cfgNome').value=cfg.cong;document.getElementById('cfgEnd').value=cfg.end;document.getElementById('cfgHor').value=cfg.hor;document.getElementById('cfgDia').value=String(cfg.dia);
  document.getElementById('cfgGemini').value=localStorage.getItem('bj_gem')||'';
  document.getElementById('cfgGroupMsg').value=cfg.groupMsg||'';
  document.getElementById('cfgSugerirSentinela').checked=!!cfg.sugerirSentinela;
}

function salvarConfigTemas(){
  if(!db)return;
  const overrides={};
  Object.keys(TL).forEach(k=>{if(TL[k]!==TEMAS[k])overrides[k]=TL[k];});
  FF.set(FF.doc(db,'config','temas'),{overrides,bloqueados:[...bloqueados]});
}

function saveConfig(){
  cfg.cong=document.getElementById('cfgNome').value;
  cfg.end=document.getElementById('cfgEnd').value;
  cfg.hor=document.getElementById('cfgHor').value;
  cfg.dia=Number(document.getElementById('cfgDia').value);
  cfg.sugerirSentinela=document.getElementById('cfgSugerirSentinela').checked;
  cfg.groupMsg=document.getElementById('cfgGroupMsg').value.trim();
  const gem=document.getElementById('cfgGemini').value.trim();if(gem)localStorage.setItem('bj_gem',gem);else localStorage.removeItem('bj_gem');
  if(db)FF.set(FF.doc(db,'config','app'),cfg);
  updateBranding();renderMensagens();renderHome();toast('✓ Salvo!');
}

// MINHA CONGREGAÇÃO — DISCURSANTES
let discursantes=[];
let mcFiltro='todos';

function setMCFilter(el){
  document.querySelectorAll('[data-mc]').forEach(x=>x.classList.remove('on'));
  el.classList.add('on');mcFiltro=el.dataset.mc;renderMinha();
}

async function loadDiscursantes(){
  if(!db)return;
  const s=await FF.gets(FF.col(db,'discursantes'));
  discursantes=s.docs.map(d=>({id:d.id,...d.data()}));
  renderMinha();
}

function saidasDiscursante(d){
  const saidas=Array.isArray(d.saidas)?d.saidas.filter(s=>s&&s.data).map(s=>({...s,id:String(s.id||Date.now()+Math.random())})):[];
  if(d.proxSaida&&!saidas.some(s=>s.data===d.proxSaida&&String(s.destino||'')===String(d.destino||''))){
    saidas.push({id:'legacy',data:d.proxSaida,destino:d.destino||'',obs:d.obs||''});
  }
  return saidas.sort((a,b)=>String(a.data).localeCompare(String(b.data)));
}

function proximaSaidaDiscursante(d,hoje=new Date().toISOString().slice(0,10)){
  return saidasDiscursante(d).find(s=>s.data>=hoje)||null;
}

function renderMinha(){
  const div=document.getElementById('listaMinha');if(!div)return;
  const hoje=new Date().toISOString().slice(0,10);
  let lista=[...discursantes];
  if(mcFiltro==='agendado') lista=lista.filter(d=>proximaSaidaDiscursante(d,hoje));
  if(mcFiltro==='sem') lista=lista.filter(d=>!proximaSaidaDiscursante(d,hoje));
  lista.sort((a,b)=>{
    // Mais recente primeiro: usa proxSaida se existir, senão ultSaida
    const da=proximaSaidaDiscursante(a,hoje)?.data||a.ultSaida||'';
    const db=proximaSaidaDiscursante(b,hoje)?.data||b.ultSaida||'';
    if(da&&db)return db>da?1:-1;
    if(da)return -1;
    if(db)return 1;
    return (a.nome||'').localeCompare(b.nome||'');
  });
  if(!lista.length){div.innerHTML='<div class="empty"><div class="ico">🏠</div>Nenhum discursante cadastrado</div>';return;}
  div.innerHTML='';
  lista.forEach(d=>{
    const futuras=saidasDiscursante(d).filter(s=>s.data>=hoje),proxima=futuras[0]||null,temProx=!!proxima;
    const card=document.createElement('div');
    card.style.cssText='background:var(--surf);border:1px solid '+(temProx?'rgba(37,99,235,.35)':'var(--border)')+';border-radius:10px;padding:13px 15px;margin-bottom:7px;display:flex;align-items:flex-start;gap:10px';
    // Info
    const info=document.createElement('div');info.style.cssText='flex:1;min-width:0';
    const nm=document.createElement('div');nm.style.cssText='font-weight:700;font-size:14px;color:var(--whi)';nm.textContent=d.nome||'—';
    info.appendChild(nm);
    if(proxima?.destino){
      const dest=document.createElement('div');dest.style.cssText='font-size:11px;color:var(--pur3);margin-top:1px';
      dest.textContent='→ '+proxima.destino;
      info.appendChild(dest);
    }
    if(temProx){
      const prox=document.createElement('div');prox.style.cssText='margin-top:4px';
      prox.innerHTML='<span class="badge bpur">📅 Próxima: '+fD(proxima.data)+'</span>';
      info.appendChild(prox);
    }
    if(futuras.length>1){
      const details=document.createElement('details');details.className='outbound-more';
      const summary=document.createElement('summary');summary.textContent='Ver outros '+(futuras.length-1)+' discursos agendados';details.appendChild(summary);
      futuras.slice(1).forEach(saida=>{const item=document.createElement('div');item.className='outbound-date';item.innerHTML='<strong>'+fD(saida.data)+'</strong><span>'+(saida.destino||'Destino não informado')+'</span>';details.appendChild(item);});info.appendChild(details);
    }
    if(d.ultSaida){
      const ult=document.createElement('div');ult.style.cssText='font-size:11px;color:var(--whi3);margin-top:3px';
      ult.textContent='Última saída: '+fD(d.ultSaida);
      info.appendChild(ult);
    }
    if(!d.ultSaida&&!temProx){
      const sem=document.createElement('div');sem.style.cssText='font-size:11px;color:var(--whi3);margin-top:3px;font-style:italic';
      sem.textContent='Nenhuma saída registrada';
      info.appendChild(sem);
    }
    if(d.obs){const o=document.createElement('div');o.style.cssText='font-size:11px;color:var(--whi3);margin-top:3px;font-style:italic';o.textContent=d.obs;info.appendChild(o);}
    card.appendChild(info);
    // Buttons
    const btns=document.createElement('div');btns.style.cssText='display:flex;gap:4px;flex-shrink:0';
    if(d.tel){
      const wa=document.createElement('button');wa.className='btn bgn bs';wa.textContent='💬';wa.title='WhatsApp';
      wa.onclick=function(){abrirWADir(d.tel);};btns.appendChild(wa);
    }
    const add=document.createElement('button');add.className='btn bo bs';add.innerHTML='<i data-lucide="calendar-plus"></i><span> Outro</span>';add.title='Adicionar outro discurso';
    add.onclick=function(){addSaidaDiscursante(d.id);};btns.appendChild(add);
    const ed=document.createElement('button');ed.className='btn bo bs';ed.textContent='✏️';ed.title='Editar';
    ed.onclick=function(){editDiscursante(d.id);};btns.appendChild(ed);
    const dl=document.createElement('button');dl.className='btn bo bs';dl.style.cssText='color:var(--red);opacity:.7';dl.textContent='🗑';
    dl.onclick=function(){delDiscursante(d.id);};btns.appendChild(dl);
    card.appendChild(btns);
    div.appendChild(card);
  });
  if(window.lucide)lucide.createIcons();
}

function popularSelectDiscursante(selectedId){
  const sel=document.getElementById('dcSelect');
  sel.innerHTML='<option value="">— Selecionar irmão —</option>';
  // Oradores cadastrados na congregação definida pelo usuário.
  const congLocal=(cfg.cong||'').toLocaleUpperCase('pt-BR').trim();
  const minha=oradores.filter(o=>{
    const c=(o.cong||'').toLocaleUpperCase('pt-BR').trim();
    return congLocal&&c===congLocal;
  }).sort((a,b)=>(a.nome||'').localeCompare(b.nome||''));
  // Also add already-registered discursantes by name (in case not in oradores)
  const extras=discursantes.filter(d=>!minha.find(o=>o.nome===d.nome));
  const todos=[...minha,...extras.map(d=>({id:'_d_'+d.id,nome:d.nome,tel:d.tel,cong:cfg.cong}))];
  todos.forEach(o=>{
    const opt=document.createElement('option');
    opt.value=o.id;opt.textContent=o.nome+(o.tel?' ('+o.tel+')':'');
    if(selectedId&&o.id===selectedId)opt.selected=true;
    sel.appendChild(opt);
  });
  if(minha.length===0){
    const opt=document.createElement('option');opt.disabled=true;
    opt.textContent='Nenhum orador cadastrado em "'+(cfg.cong||'Minha Congregação')+'"';
    sel.appendChild(opt);
  }
}

function onDcSelect(){
  const sel=document.getElementById('dcSelect');
  const v=sel.value;
  const info=document.getElementById('dcInfo');
  if(!v){info.style.display='none';return;}
  const o=oradores.find(x=>x.id===v);
  if(o){
    document.getElementById('dcOradorId').value=o.id;
    info.style.display='block';
    info.innerHTML='<strong>'+o.nome+'</strong><br>'+(o.cong||'')+(o.tel?' · '+o.tel:'');
  }
}

function novoDiscursante(){
  document.getElementById('dcId').value='';
  document.getElementById('dcOradorId').value='';
  document.getElementById('dcSaidaId').value='';
  ['dcUlt','dcProx','dcDest','dcObs'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('dcInfo').style.display='none';
  document.getElementById('mDiscTit').textContent='Novo Discursante';
  popularSelectDiscursante(null);
  openM('mDiscursante');
}

function editDiscursante(id){
  const d=discursantes.find(x=>x.id===id);if(!d)return;
  const proxima=proximaSaidaDiscursante(d);
  document.getElementById('dcId').value=id;
  document.getElementById('dcOradorId').value=d.oradorId||'';
  document.getElementById('dcSaidaId').value=proxima?.id||'';
  document.getElementById('dcUlt').value=d.ultSaida||'';
  document.getElementById('dcProx').value=proxima?.data||'';
  document.getElementById('dcDest').value=proxima?.destino||'';
  document.getElementById('dcObs').value=proxima?.obs||'';
  document.getElementById('mDiscTit').textContent='Editar — '+d.nome;
  popularSelectDiscursante(d.oradorId||null);
  // Show info
  const info=document.getElementById('dcInfo');
  const o=oradores.find(x=>x.id===d.oradorId);
  if(o){info.style.display='block';info.innerHTML='<strong>'+o.nome+'</strong><br>'+(o.cong||'')+(o.tel?' · '+o.tel:'');}
  else{info.style.display='none';}
  openM('mDiscursante');
}

function addSaidaDiscursante(id){
  const d=discursantes.find(x=>x.id===id);if(!d)return;
  editDiscursante(id);
  document.getElementById('dcSaidaId').value='';
  document.getElementById('dcProx').value='';document.getElementById('dcDest').value='';document.getElementById('dcObs').value='';
  document.getElementById('mDiscTit').textContent='Adicionar discurso — '+d.nome;
}

async function saveDiscursante(){
  if(!db)return toast('Supabase não conectado!');
  const id=document.getElementById('dcId').value.trim();
  const saidaId=document.getElementById('dcSaidaId').value.trim();
  const oradorId=document.getElementById('dcOradorId').value.trim();
  const selV=document.getElementById('dcSelect').value;
  const o=oradores.find(x=>x.id===selV);
  if(!o&&!id)return toast('Selecione um irmão!');
  const nome=o?o.nome:(discursantes.find(d=>d.id===id)?.nome||'');
  const tel=o?o.tel||'':'';
  const existente=discursantes.find(d=>d.id===id),novaData=document.getElementById('dcProx').value||null;
  let saidas=existente?saidasDiscursante(existente):[];
  if(novaData){
    const compromisso={id:saidaId||String(Date.now()),data:novaData,destino:document.getElementById('dcDest').value.trim(),obs:document.getElementById('dcObs').value.trim()};
    if(saidaId){const pos=saidas.findIndex(s=>s.id===saidaId);if(pos>=0)saidas[pos]=compromisso;else saidas.push(compromisso);}else saidas.push(compromisso);
  }
  saidas=saidas.filter((s,i,a)=>a.findIndex(x=>x.id===s.id)===i).sort((a,b)=>a.data.localeCompare(b.data));
  const proxima=saidas.find(s=>s.data>=new Date().toISOString().slice(0,10))||null;
  const data={
    nome,tel,oradorId:selV||oradorId||'',
    ultSaida:document.getElementById('dcUlt').value||null,
    proxSaida:proxima?.data||null,
    destino:proxima?.destino||'',
    obs:proxima?.obs||'',
    saidas
  };
  if(id){
    await FF.upd(FF.doc(db,'discursantes',id),data);
    discursantes=discursantes.map(d=>d.id===id?{...d,...data}:d);
  } else {
    const ref=await FF.add(FF.col(db,'discursantes'),data);
    discursantes.push({id:ref.id,...data});
  }
  closeM('mDiscursante');renderMinha();toast('✓ Salvo!');
}

async function delDiscursante(id){
  if(!confirm('Remover este discursante?'))return;
  await FF.del(FF.doc(db,'discursantes',id));
  discursantes=discursantes.filter(d=>d.id!==id);
  renderMinha();
}

// MENSAGENS
function saveMensagens(){if(db)FF.set(FF.doc(db,'config','mensagens'),{lista:mensagens});}

function renderMensagens(){
  const div=document.getElementById('msgsList');if(!div)return;
  div.innerHTML='';
  mensagens.forEach((m,i)=>{
    const box=document.createElement('div');
    box.style.cssText='background:var(--surf2);border:1px solid var(--border2);border-radius:8px;padding:12px;margin-bottom:8px';
    const head=document.createElement('div');
    head.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:8px';
    const inp=document.createElement('input');
    inp.value=m.titulo;inp.placeholder='Nome da mensagem';
    inp.style.cssText='flex:1;font-size:12px;font-weight:600';
    inp.oninput=function(){mensagens[i].titulo=this.value;saveMensagens();};
    const del=document.createElement('button');
    del.className='btn bo bs';del.style.cssText='color:var(--red);opacity:.7;flex-shrink:0';del.textContent='✕';
    del.onclick=function(){if(confirm('Remover esta mensagem?')){mensagens.splice(i,1);saveMensagens();renderMensagens();}};
    head.appendChild(inp);head.appendChild(del);
    const type=document.createElement('select');type.style.cssText='width:auto;min-width:130px;font-size:11px';type.innerHTML='<option value="geral">Mensagem comum</option><option value="convite">Convite</option>';type.value=m.tipo||'geral';type.onchange=function(){mensagens[i].tipo=this.value;saveMensagens();};
    head.insertBefore(type,del);
    const ta=document.createElement('textarea');
    ta.value=m.texto;ta.rows=4;ta.placeholder='Texto da mensagem...';ta.style.cssText='font-size:12px;line-height:1.6';
    ta.oninput=function(){mensagens[i].texto=this.value;saveMensagens();};
    box.appendChild(head);box.appendChild(ta);
    div.appendChild(box);
  });
}

function addMsg(){
  mensagens.push({id:Date.now(),tipo:'geral',titulo:'Nova mensagem',texto:'Olá {orador}!\n\n📖 Tema: {tema}\n📅 Data: {data}\n📍 {cong}\n\n🙏'});
  saveMensagens();renderMensagens();
}

function decodeHtmlEntities(str){
  // Decode HTML entities that may appear in localStorage strings
  const txt=document.createElement('textarea');
  txt.innerHTML=str;
  return txt.value;
}
function repararEmojisMensagem(valor){
  return String(valor||'')
    .replace(/^[ \t�]*(?=Tema\s*:)/gim,'📖 ')
    .replace(/^[ \t�]*(?=Data\s*:)/gim,'📅 ')
    .replace(/^[ \t�]*(?=(?:Congrega(?:ção|cao)|Endere(?:ço|co))\s*:)/gim,'📍 ')
    .replace(/^[ \t]*�+[ \t]*$/gm,'🙏')
    .replace(/^[ \t]*�+[ \t]*(?=\S)/gm,'📍 ');
}
function buildMsg(template,sem){
  const nT=sem.temaNum;
  const nomeT=nT&&TL[nT]?TL[nT]:sem.tema||'—';
  const temaCompleto=nT?('Nº '+nT+' — '+nomeT):nomeT;
  const canticoCompleto=sem.canticoNum?(sem.canticoNum+' — '+(sem.cantico||'Título não carregado')):'—';
  const tmpl=repararEmojisMensagem(decodeHtmlEntities(template));
  return tmpl
    .replace(/{orador}/g,sem.nome||'—')
    .replace(/{tema}/g,temaCompleto)
    .replace(/{numtema}/g,nT||'—')
    .replace(/{cantico}/g,canticoCompleto)
    .replace(/{imagens}/g,sem.temImagens?'Terá imagens':'Não terá imagens')
    .replace(/{data}/g,fDL(sem.data))
    .replace(/{minha_cong}/g,cfg.cong)
    .replace(/{cong_orador}/g,sem.congregacao||'—')
    .replace(/{cong}/g,cfg.cong) // mantido por compatibilidade com mensagens antigas — sempre foi a MINHA congregação
    .replace(/{end}/g,cfg.end);
}

function abrirWhatsAppOrador(orador,mensagem,agenda={}){
  const sem={...agenda,nome:orador.nome,congregacao:orador.cong||'',telefone:orador.tel||''};
  const tel=String(orador.tel||'').replace(/\D/g,'');
  window.open('https://wa.me/55'+tel+'?text='+encodeURIComponent(buildMsg(mensagem.texto,sem)),'_blank','noopener');
}

function criarModalEscolha(titulo){
  document.getElementById('mOradorMensagem')?.remove();
  const overlay=document.createElement('div');overlay.id='mOradorMensagem';overlay.className='choice-overlay';overlay.onclick=e=>{if(e.target===overlay)overlay.remove();};
  const modal=document.createElement('div');modal.className='choice-modal';
  const head=document.createElement('div');head.className='choice-title';head.textContent=titulo;modal.appendChild(head);
  overlay.appendChild(modal);document.body.appendChild(overlay);return{overlay,modal};
}

function abrirMensagensOrador(oradorId){
  const orador=oradores.find(o=>o.id===oradorId);if(!orador)return;
  if(!orador.tel)return toast('Este orador não possui WhatsApp cadastrado.');
  if(!mensagens.length)return toast('Crie uma mensagem em Configurações.');
  const{overlay,modal}=criarModalEscolha('Mensagem para '+orador.nome);
  const hint=document.createElement('p');hint.className='choice-hint';hint.textContent='Escolha o modelo. Convites pedirão uma data futura que ainda está sem orador.';modal.appendChild(hint);
  mensagens.forEach(m=>{
    const button=document.createElement('button');button.className='message-choice';
    const tag=document.createElement('small');tag.textContent=(m.tipo==='convite'?'Convite':'Mensagem comum');
    const title=document.createElement('strong');title.textContent=m.titulo||'Sem título';
    const preview=document.createElement('span');preview.textContent=decodeHtmlEntities(m.texto||'').replace(/\s+/g,' ').slice(0,95);
    button.appendChild(tag);button.appendChild(title);button.appendChild(preview);
    button.onclick=()=>{overlay.remove();m.tipo==='convite'?selecionarDataConvite(orador,m):abrirWhatsAppOrador(orador,m,{data:new Date().toISOString().slice(0,10)});};modal.appendChild(button);
  });
  const close=document.createElement('button');close.className='btn bo choice-close';close.textContent='Cancelar';close.onclick=()=>overlay.remove();modal.appendChild(close);
}

function selecionarDataConvite(orador,mensagem){
  const hoje=new Date().toISOString().slice(0,10),ano=new Date().getFullYear();
  const ocupadas=new Set(programa.filter(p=>p.nome||p.semDiscurso).map(p=>p.data));
  const datas=[...allMeetingDays(ano),...allMeetingDays(ano+1)].filter(data=>data>=hoje&&!ocupadas.has(data)).slice(0,30);
  const{overlay,modal}=criarModalEscolha('Escolha uma data em aberto');
  const hint=document.createElement('p');hint.className='choice-hint';hint.textContent='A mensagem será preenchida com a data escolhida. O orador só será agendado depois que você confirmar com ele.';modal.appendChild(hint);
  if(!datas.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Não há datas futuras em aberto.';modal.appendChild(empty);}
  const list=document.createElement('div');list.className='open-date-list';
  datas.forEach(data=>{
    const existente=programa.find(p=>p.data===data)||{};
    const button=document.createElement('button');button.className='open-date';
    const date=document.createElement('strong');date.textContent=fDL(data);
    const topic=document.createElement('span');topic.textContent=existente.temaNum?'Tema '+existente.temaNum+(TL[existente.temaNum]?' — '+TL[existente.temaNum]:''):existente.tema||'Tema ainda não definido';
    button.appendChild(date);button.appendChild(topic);button.onclick=()=>{abrirWhatsAppOrador(orador,mensagem,{...existente,data});overlay.remove();};list.appendChild(button);
  });
  modal.appendChild(list);const close=document.createElement('button');close.className='btn bo choice-close';close.textContent='Cancelar';close.onclick=()=>overlay.remove();modal.appendChild(close);
}

function abrirMsgPadrao(jsonOrEnc){
  let sem;try{sem=JSON.parse(jsonOrEnc);}catch(e){sem=JSON.parse(decodeURIComponent(jsonOrEnc));}
  if(mensagens.length===0){toast('Nenhuma mensagem configurada. Configure em ⚙️ Config.');return;}
  if(mensagens.length===1){
    const txt=buildMsg(mensagens[0].texto,sem);
    const tel=sem.telefone?sem.telefone.replace(/\D/g,''):'';
    window.open(tel?'https://wa.me/55'+tel+'?text='+encodeURIComponent(txt):'https://wa.me/?text='+encodeURIComponent(txt),'_blank');
    return;
  }
  // Multiple messages — show picker modal
  mostrarPickerMsg(sem);
}

function abrirMensagensAgendamento(jsonOrEnc){
  let sem;try{sem=JSON.parse(jsonOrEnc);}catch(e){sem=JSON.parse(decodeURIComponent(jsonOrEnc));}
  sem=typeof completarDadosPrograma==='function'?completarDadosPrograma(sem):sem;
  if(!sem.telefone)return toast('Este orador não possui WhatsApp cadastrado.');
  if(!mensagens.length)return toast('Crie uma mensagem em Configurações.');
  mostrarPickerMsg(sem);
}

function mostrarPickerMsg(sem){
  const existing=document.getElementById('mMsgPicker');
  if(existing)existing.remove();
  const overlay=document.createElement('div');
  overlay.id='mMsgPicker';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:600;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
  const modal=document.createElement('div');
  modal.style.cssText='background:var(--surf);border:1px solid var(--border2);border-radius:12px;padding:20px;width:100%;max-width:440px;max-height:85vh;overflow-y:auto';
  const title=document.createElement('div');
  title.style.cssText='font-family:Space Grotesk,sans-serif;font-size:16px;font-weight:700;color:var(--whi);margin-bottom:14px';
  title.textContent='Escolha a mensagem';
  modal.appendChild(title);
  mensagens.forEach(m=>{
    const btn=document.createElement('button');
    btn.style.cssText='display:block;width:100%;text-align:left;padding:12px 14px;background:var(--surf2);border:1px solid var(--border2);border-radius:8px;color:var(--whi2);font-size:13px;cursor:pointer;margin-bottom:8px;transition:.15s';
    btn.onmouseover=function(){this.style.borderColor='var(--pur)';};
    btn.onmouseout=function(){this.style.borderColor='var(--border2)';};
    const preview=buildMsg(m.texto,sem).slice(0,80)+'...';
    btn.innerHTML='<strong style="color:var(--whi);display:block;margin-bottom:3px">'+m.titulo+'</strong><span style="font-size:11px;color:var(--whi3)">'+preview+'</span>';
    btn.onclick=function(){
      const txt=buildMsg(m.texto,sem);
      const tel=sem.telefone?sem.telefone.replace(/\D/g,''):'';
      window.open(tel?'https://wa.me/55'+tel+'?text='+encodeURIComponent(txt):'https://wa.me/?text='+encodeURIComponent(txt),'_blank');
      overlay.remove();
    };
    modal.appendChild(btn);
  });
  const close=document.createElement('button');
  close.className='btn bo';close.style.cssText='width:100%;justify-content:center;margin-top:4px';close.textContent='Cancelar';
  close.onclick=function(){overlay.remove();};
  modal.appendChild(close);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}
