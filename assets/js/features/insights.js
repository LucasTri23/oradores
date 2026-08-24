// SUGESTÕES
async function loadSugestoes(){if(!db)return;const s=await FF.gets(FF.col(db,'sugestoes'));sugestoes=s.docs.map(d=>({id:d.id,...d.data()}));renderSugestoes();}
function calcSugStatus(s){
  const hoje=new Date().toISOString().slice(0,10);
  const dataRef=s.dataSugestao||s.criadoEm||'2020-01-01';
  // Normalize dataRef to string date
  const refStr=typeof dataRef==='string'?dataRef.slice(0,10):hoje;
  if(s.temaNum){
    // Agendamento futuro OU que foi feito após a data da sugestão
    const agFut=programa.find(p=>p.temaNum==s.temaNum&&p.data>=hoje&&p.nome&&!ehSist(p.nome));
    if(agFut)return{st:'agendado',info:fD(agFut.data)+' — '+agFut.nome};
    // Discurso realizado APÓS a data da sugestão
    const disc=discursos.filter(d=>d.temaNum==s.temaNum&&d.data>=refStr).sort((a,b)=>b.data>a.data?1:-1)[0];
    if(disc)return{st:'realizado',info:fD(disc.data)+' — '+disc.nome};
  }
  return{st:'pendente',info:''};
}

function renderSugestoes(){
  const div=document.getElementById('listaSug');if(!div)return;
  if(!sugestoes.length){div.innerHTML='<div class="empty"><div class="ico">💡</div>Nenhuma sugestão</div>';return;}
  const pp={};
  sugestoes.forEach(s=>{if(!pp[s.nome])pp[s.nome]=[];pp[s.nome].push(s);});
  div.innerHTML='';
  Object.entries(pp).forEach(([nome,itens])=>{
    const box=document.createElement('div');
    box.className='sug-item';
    let hd='<div style="display:flex;align-items:center;justify-content:space-between">';
    hd+='<div style="font-weight:600;font-size:13px">'+nome+'</div>';
    hd+='<span class="badge bgry">'+itens.length+' sugestão'+(itens.length>1?'ões':'')+'</span></div>';
    box.innerHTML=hd;
    itens.forEach(s=>{
      const nomeT=s.temaNum&&TL[s.temaNum]?TL[s.temaNum]:s.descricao||'—';
      const {st,info}=calcSugStatus(s);
      const stCor={pendente:'bamb',agendado:'bblu',realizado:'bgrn'}[st];
      const stLabel={pendente:'⏳ Pendente',agendado:'📅 Agendado',realizado:'✅ Realizado'}[st];
      const item=document.createElement('div');
      item.style.cssText='padding:8px 10px;background:var(--surf3);border-radius:7px;margin-top:6px;display:flex;align-items:flex-start;gap:10px';
      let ih='';
      if(s.temaNum)ih+='<span class="badge bpur" style="flex-shrink:0;margin-top:2px">Nº '+s.temaNum+'</span>';
      ih+='<div style="flex:1;min-width:0"><div style="font-size:13px">'+nomeT+'</div>';
      if(s.descricao&&s.descricao!==nomeT)ih+='<div style="font-size:11px;color:var(--whi3);margin-top:2px">'+s.descricao+'</div>';
      if(s.dataSugestao)ih+='<div style="font-size:11px;color:var(--whi3);margin-top:1px">📅 Sugerido em '+fD(s.dataSugestao)+'</div>';
      if(info)ih+='<div style="font-size:11px;color:var(--pur3);margin-top:1px">'+info+'</div>';
      ih+='</div>';
      item.innerHTML=ih;
      // Auto status badge (read-only, no dropdown)
      const badge=document.createElement('span');
      badge.className='badge '+stCor;
      badge.style.cssText='flex-shrink:0;margin-top:2px;font-size:10px;font-weight:700;padding:3px 8px';
      badge.textContent=stLabel;
      // Delete button
      const bd=document.createElement('button');
      bd.className='btn bo bs';bd.style.cssText='color:var(--red);opacity:.7;flex-shrink:0';bd.textContent='✕';
      bd.onclick=function(){delSug(s.id);};
      const acts=document.createElement('div');
      acts.style.cssText='display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0';
      acts.appendChild(badge);acts.appendChild(bd);
      item.appendChild(acts);
      box.appendChild(item);
    });
    div.appendChild(box);
  });
}
// setSugSt removida — status é calculado automaticamente
function onSugNum(){const n=parseInt(document.getElementById('sNum').value);document.getElementById('sNumName').textContent=n&&TL[n]?TL[n]:'';}
function abrirNovaSug(){['sNome','sNum','sDesc'].forEach(id=>document.getElementById(id).value='');document.getElementById('sData').value=new Date().toISOString().slice(0,10);document.getElementById('sNumName').textContent='';openM('mSug');}
async function saveSug(){
  if(!db)return toast('Supabase não conectado!');
  const nome=document.getElementById('sNome').value.trim();
  const num=parseInt(document.getElementById('sNum').value)||null;
  const desc=document.getElementById('sDesc').value.trim();
  if(!nome)return toast('Informe quem sugeriu!');
  const sDataVal=document.getElementById('sData').value||new Date().toISOString().slice(0,10);
  await FF.add(FF.col(db,'sugestoes'),{nome,temaNum:num,descricao:desc,dataSugestao:sDataVal,criadoEm:FF.ts()});
  closeM('mSug');await loadSugestoes();toast('✓ Salvo!');
}
async function delSug(id){if(!confirm('Remover?'))return;await FF.del(FF.doc(db,'sugestoes',id));await loadSugestoes();}

// ANALYTICS
function renderAnalytics(){
  const hoje=new Date().toISOString().slice(0,10);
  const ano=new Date().getFullYear();
  const validos=Object.keys(TL).filter(n=>!bloqueados.has(+n));
  const nunca=validos.filter(n=>!discursos.find(d=>d.temaNum==n)).length;
  document.getElementById('statGrid').innerHTML=
    '<div class="stat-box"><div class="stat-val">'+oradores.length+'</div><div class="stat-lbl">Oradores</div></div>'
    +'<div class="stat-box"><div class="stat-val">'+discursos.length+'</div><div class="stat-lbl">Discursos</div></div>'
    +'<div class="stat-box"><div class="stat-val">'+discursos.filter(d=>d.data?.startsWith(ano)).length+'</div><div class="stat-lbl">Em '+ano+'</div></div>'
    +'<div class="stat-box"><div class="stat-val">'+nunca+'</div><div class="stat-lbl">Temas nunca usados</div></div>'
    +'<div class="stat-box"><div class="stat-val">'+sugestoes.length+'</div><div class="stat-lbl">Sugestões</div></div>';
  const ct={};
  discursos.forEach(d=>{if(d.temaNum&&d.temaNum>0)ct[d.temaNum]=(ct[d.temaNum]||0)+1;});
  const topT=Object.entries(ct).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const mx=topT[0]?.[1]||1;
  document.getElementById('rankTemas').innerHTML=topT.map(([n,c])=>
    '<div class="rank-row"><div style="flex:1;min-width:0"><div>Nº'+n+' — '+(TL[n]||'?').slice(0,35)+((TL[n]||'').length>35?'…':'')+'</div><div class="rank-bar" style="width:'+Math.round(c/mx*100)+'%"></div></div><strong>'+c+'×</strong></div>'
  ).join('');
  const rank=oradores.map(o=>{const u=getUltimoDiscurso(o);const m=u?Math.floor((new Date()-new Date(u+'T12:00:00'))/(864e5*30.44)):999;return{o,u,m};}).sort((a,b)=>b.m-a.m).slice(0,8);
  document.getElementById('rankSem').innerHTML=rank.map(({o,u,m})=>
    '<div class="rank-row"><div><div style="font-size:12px">'+o.nome+'</div><div style="font-size:10px;color:var(--whi3)">'+(o.cong||'—')+'</div></div><span class="badge '+corTempo(u)+'">'+(m>900?'Nunca':(mesesAno(u)||'—'))+'</span></div>'
  ).join('');
  renderCongregacoesAnalytics();
  if(window.lucide)lucide.createIcons();
}
function renderCongregacoesAnalytics(){
  const div=document.getElementById('rankCongs');if(!div)return;
  const query=normalizarTexto(document.getElementById('buscaCongAnalise')?.value||'');
  const grupos=new Map();
  oradores.forEach(o=>{const nome=String(o.cong||'').trim();if(!nome)return;if(!grupos.has(nome))grupos.set(nome,[]);grupos.get(nome).push(o);});
  const lista=[...grupos.entries()].filter(([cong,itens])=>!query||normalizarTexto(cong).includes(query)||itens.some(o=>normalizarTexto(o.nome).includes(query))).sort(([a],[b])=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}));
  const count=document.getElementById('congResultCount');if(count)count.textContent=lista.length+' de '+grupos.size+' congregações';
  div.innerHTML='';
  if(!lista.length){div.innerHTML='<div class="empty">Nenhuma congregação encontrada.</div>';return;}
  const grid=document.createElement('div');grid.className='cong-analysis-grid';
  lista.forEach(([cong,itens])=>{
    const button=document.createElement('button');button.className='cong-analysis-item';button.onclick=()=>verCong(encodeURIComponent(cong));
    const name=document.createElement('span');name.textContent=cong;
    const total=document.createElement('strong');total.textContent=itens.length;
    button.appendChild(name);button.appendChild(total);grid.appendChild(button);
  });
  div.appendChild(grid);
}
function verCong(enc){
  const cong=decodeURIComponent(enc);
  const ors=oradores.filter(o=>o.cong===cong).sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt-BR',{sensitivity:'base'}));
  document.getElementById('mCongTit').textContent=cong+' ('+ors.length+')';
  document.getElementById('mCongLista').innerHTML=ors.length?ors.map(o=>{
    const ultimo=getUltimoDiscurso(o);
    const t=mesesAno(ultimo);
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">'
      +'<div><div style="font-size:13px;font-weight:500">'+o.nome+'</div><div style="font-size:11px;color:var(--whi3)">'+(o.tel||'sem contato')+'</div></div>'
      +(t?'<span class="badge '+corTempo(ultimo)+'">'+t+'</span>':'')+'</div>';
  }).join(''):'<div style="color:var(--whi3);font-size:13px;padding:8px 0">Nenhum orador.</div>';
  openM('mCong');
}

// SENTINELA
async function loadSentinelas(){if(!db)return;const s=await FF.gets(FF.col(db,'sentinela'));sentinelas=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>b.data>a.data?1:-1);renderSentinelas();}
// Salva no histórico um tema descoberto automaticamente no jw.org (Home, cards ou aba Sentinela),
// sem duplicar se essa data já estiver registrada (manual ou automático).
let _salvandoSentinela=new Set();
async function registrarSentinelaAuto(data,tema){
  if(!db||sentinelas.find(s=>s.data===data)||_salvandoSentinela.has(data))return;
  _salvandoSentinela.add(data);
  try{
    const ref=await FF.add(FF.col(db,'sentinela'),{tema,data,criadoEm:FF.ts()});
    sentinelas.push({id:ref.id,tema,data});
    sentinelas.sort((a,b)=>b.data>a.data?1:-1);
    if(document.getElementById('page-sentinela')?.classList.contains('active'))renderSentinelas();
  }catch(e){/* Firestore indisponível — o tema já aparece na tela mesmo sem salvar */}
  finally{_salvandoSentinela.delete(data);}
}
function renderSentinelas(){
  const div=document.getElementById('sentLista');if(!div)return;
  if(!sentinelas.length){div.innerHTML='<div style="color:var(--whi3);font-size:13px">Nenhum tema salvo.</div>';return;}
  div.innerHTML='';
  sentinelas.forEach(s=>{
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)';
    const info=document.createElement('div');
    info.innerHTML='<div style="font-size:13px">'+s.tema+'</div><div style="font-size:11px;color:var(--whi3);margin-top:1px">'+(s.data?fD(s.data):'—')+'</div>';
    const btn=document.createElement('button');
    btn.className='btn bo bs';btn.style.cssText='color:var(--red);opacity:.7';btn.textContent='✕';
    btn.onclick=function(){delSent(s.id);};
    row.appendChild(info);row.appendChild(btn);
    div.appendChild(row);
  });
}
async function saveSentinela(){
  if(!db)return toast('Supabase não conectado!');
  const tema=document.getElementById('sentTema').value.trim();
  const data=document.getElementById('sentData').value;
  if(!tema)return toast('Informe o tema!');
  await FF.add(FF.col(db,'sentinela'),{tema,data,criadoEm:FF.ts()});
  document.getElementById('sentTema').value='';
  await loadSentinelas();renderHome();toast('✓ Salvo!');
}
async function delSent(id){if(!confirm('Remover?'))return;await FF.del(FF.doc(db,'sentinela',id));await loadSentinelas();renderHome();}

// Busca automática do tema de A Sentinela no jw.org.
// O site não é servido com cabeçalhos CORS, então o navegador não consegue buscar direto;
// usamos um proxy CORS público só para repassar o HTML. Se o proxy ou o jw.org mudarem,
// a busca falha silenciosamente e cai no preenchimento manual (que continua funcionando).
function parseRangeSentinela(str){
  const meses={janeiro:0,fevereiro:1,'março':2,marco:2,abril:3,maio:4,junho:5,julho:6,agosto:7,setembro:8,outubro:9,novembro:10,dezembro:11};
  str=str.trim().toLowerCase();
  let m=str.match(/(\d{1,2})\s*de\s*([a-zçã]+)\s*[–-]\s*(\d{1,2})\s*de\s*([a-zçã]+)\s*de\s*(\d{4})/);
  if(m){
    const[,d1,mo1,d2,mo2,y]=m;
    const mo1i=meses[mo1],mo2i=meses[mo2];
    if(mo1i===undefined||mo2i===undefined)return null;
    const y0=mo1i>mo2i?(+y-1):+y;
    return[new Date(y0,mo1i,+d1,0,0,0),new Date(+y,mo2i,+d2,23,59,59)];
  }
  m=str.match(/(\d{1,2})\s*[–-]\s*(\d{1,2})\s*de\s*([a-zçã]+)\s*de\s*(\d{4})/);
  if(m){
    const[,d1,d2,mo,y]=m;
    const moi=meses[mo];
    if(moi===undefined)return null;
    return[new Date(+y,moi,+d1,0,0,0),new Date(+y,moi,+d2,23,59,59)];
  }
  return null;
}
// Núcleo da busca — não mexe em DOM/toast, só resolve pro título encontrado (ou null).
// Cacheado por data (por Promise, não só valor) pra não disparar buscas duplicadas quando
// renderHome() é chamado várias vezes em sequência durante o carregamento inicial.
let _jwTemaCache={};
function fetchTemaJW(dataAlvo){
  if(_jwTemaCache[dataAlvo])return _jwTemaCache[dataAlvo];
  // Tabela pesquisada previamente (data.js) — instantâneo, sem depender do proxy externo.
  const local=SENTINELA_SEMANAS.find(s=>dataAlvo>=s.de&&dataAlvo<=s.ate);
  if(local){
    const p2=Promise.resolve(local.tema);
    _jwTemaCache[dataAlvo]=p2;
    return p2;
  }
  const p=(async()=>{
    const mesesPt=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const alvo=new Date(dataAlvo+'T12:00:00');
    for(let off=0;off<=3;off++){
      const d=new Date(alvo.getFullYear(),alvo.getMonth()-off,1);
      const slug='sentinela-estudo-'+mesesPt[d.getMonth()]+'-'+d.getFullYear();
      try{
        const url='https://www.jw.org/pt/biblioteca/revistas/'+slug+'/';
        // r.jina.ai espelha a página como texto/markdown limpo, sem exigir CORS do jw.org
        const r=await fetch('https://r.jina.ai/'+url);
        if(!r.ok)continue;
        const texto=await r.text();
        const re=/##\s*\[([^\]]+)\]\([^)]*\)\s*\n+\s*Estudo para a semana de\s*([^.\n]+)\./gi;
        let m;
        while((m=re.exec(texto))){
          const titulo=m[1].trim();
          const range=parseRangeSentinela(m[2]);
          if(range&&alvo>=range[0]&&alvo<=range[1])return titulo;
        }
      }catch(e){/* tenta a próxima edição */}
    }
    return null;
  })();
  _jwTemaCache[dataAlvo]=p;
  return p;
}
// Botão manual da aba Sentinela (mantido para forçar nova busca / outra data)
async function buscarSentinelaJW(){
  const dataInput=document.getElementById('sentData').value;
  const dataAlvo=dataInput||nextSab();
  toast('🔎 Buscando no jw.org...',6000);
  delete _jwTemaCache[dataAlvo]; // força nova tentativa mesmo se já tinha falhado antes
  const titulo=await fetchTemaJW(dataAlvo);
  if(titulo){
    document.getElementById('sentTema').value=titulo;
    if(!dataInput)document.getElementById('sentData').value=dataAlvo;
    toast('✓ Tema encontrado: '+titulo);
  } else {
    toast('Não encontrei o tema para essa data no jw.org. Preencha manualmente.',4000);
  }
}
// Auto-preenche os campos ao abrir a aba Sentinela, sem precisar clicar em nada
async function autoFillSentinelaTab(){
  const temaEl=document.getElementById('sentTema'),dataEl=document.getElementById('sentData');
  if(temaEl.value.trim())return; // já tem algo digitado, não sobrescreve
  const dataAlvo=dataEl.value||nextSab();
  const titulo=await fetchTemaJW(dataAlvo);
  if(titulo&&!temaEl.value.trim()){
    temaEl.value=titulo;
    if(!dataEl.value)dataEl.value=dataAlvo;
    registrarSentinelaAuto(dataAlvo,titulo);
  }
}

