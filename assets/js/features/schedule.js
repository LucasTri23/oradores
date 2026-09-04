// PROGRAMAÇÃO (Histórico)
async function loadPrograma(){
  if(!db){renderPrograma();return;}
  const s=await FF.gets(FF.col(db,'programa'));
  programa=s.docs.map(d=>({id:d.id,...d.data()}));
  renderPrograma();renderHome();
}

function renderPrograma(){
  const hoje=new Date().toISOString().slice(0,10);
  const q=(document.getElementById('buscaHist')?.value||'').toLowerCase();
  // Une a programação manual ao histórico importado e remove repetições.
  const unicos=new Map();
  [...programa,...discursos].forEach(p=>{
    if(!p.data)return;
    const chave=[p.data,(p.nome||'').trim().toLocaleLowerCase('pt-BR'),p.temaNum||'',p.semDiscurso?'sem':''].join('|');
    if(!unicos.has(chave))unicos.set(chave,p);
  });
  let hist=[...unicos.values()].filter(p=>p.data<hoje);
  if(q) hist=hist.filter(p=>(p.nome||'').toLowerCase().includes(q)||(p.congregacao||'').toLowerCase().includes(q)||(p.data||'').includes(q)||String(p.temaNum||'').includes(q)||(p.tema||'').toLowerCase().includes(q));
  hist.sort((a,b)=>b.data>a.data?1:-1);
  const div=document.getElementById('listaPrograma');
  if(!div)return;
  if(!hist.length){div.innerHTML='<div class="empty"><div class="ico">📋</div>'+(q?'Nenhum resultado':'Nenhum histórico')+'</div>';return;}
  div.innerHTML=hist.map(p=>{
    const temOr=p.nome&&!ehSist(p.nome);
    const nT=p.temaNum;
    const nomeT=nT&&TL[nT]?TL[nT]:p.tema||'';
    let h='<div class="prog-row">';
    h+='<div style="min-width:70px;flex-shrink:0"><div style="font-size:12px;font-weight:700;color:var(--whi2)">'+fD(p.data)+'</div><div style="font-size:10px;color:var(--whi3)">'+diaSem(p.data)+'</div></div>';
    h+='<div style="flex:1;min-width:0">';
    if(nT) h+='<span class="badge bpur" style="margin-bottom:2px;display:inline-block">Nº '+nT+'</span> ';
    h+='<div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(nomeT||'<em style="color:var(--whi3)">Tema não definido</em>')+'</div>';
    h+='<div style="font-size:11px;color:var(--whi3);margin-top:2px">'+(temOr?p.nome+' · '+(p.congregacao||'—'):(p.nome||p.motivo||'—'))+'</div>';
    h+='</div></div>';
    return h;
  }).join('');
}

// AGENDAMENTO
function openNovoAgend(){
  preencherModalAgend({});
  document.getElementById('agData').value=nextSab();
  atualizarSugestoesSentinela();
  document.getElementById('mAgendTit').textContent='Inserir na Programação';
  document.getElementById('agDataLabel').textContent='Data ('+(diaReuniaoDoAno(Number(nextSab().slice(0,4)))===0?'domingo':'sábado')+')';
  openM('mAgend');
}
function editarAgend(jsonOrEnc){
  let p;
  try{p=JSON.parse(jsonOrEnc);}catch(e){p=JSON.parse(decodeURIComponent(jsonOrEnc));}
  preencherModalAgend(p);
  document.getElementById('mAgendTit').textContent='Editar — '+fD(p.data);
  document.getElementById('agDataLabel').textContent='Data ('+(diaReuniaoDoAno(Number((p.data||nextSab()).slice(0,4)))===0?'domingo':'sábado')+')';
  atualizarSugestoesSentinela();
  openM('mAgend');
}
function switchOradorTab(tab){
  const isCad=tab==='cadastrado';
  document.getElementById('agTabCadastrado').style.display=isCad?'block':'none';
  document.getElementById('agTabNovo').style.display=isCad?'none':'block';
  document.getElementById('tabCadastrado').classList.toggle('on',isCad);
  document.getElementById('tabNovo').classList.toggle('on',!isCad);
}
function preencherModalAgend(p){
  agTemaConfirmadoKey='';clearTimeout(agTemaVerificacaoTimer);
  document.getElementById('agId').value=p.id||'';
  document.getElementById('btnDelAgend').style.display=p.id?'inline-flex':'none';
  document.getElementById('agData').value=p.data||'';
  document.getElementById('agTema').value=p.temaNum||'';
  document.getElementById('agCantico').value=p.canticoNum||'';
  document.getElementById('agCanticoDesc').textContent=p.cantico||'';
  document.getElementById('agTemImagens').checked=!!p.temImagens;
  document.getElementById('agObs').value=p.obs||'';
  document.getElementById('agMotivo').value=p.motivo||'';
  document.getElementById('agSemDiscursoCor').value=/^#[0-9a-f]{6}$/i.test(p.semDiscursoCor||'')?p.semDiscursoCor:'#f59e0b';
  document.getElementById('agCadastrar').checked=false;
  document.getElementById('agSemDiscurso').checked=!!(p.semDiscurso);
  document.getElementById('agEspecial').checked=!!p.especial;
  document.getElementById('agEspecialTitulo').value=p.especialTitulo||p.tema||'';
  document.getElementById('agEspecialCor').value=/^#[0-9a-f]{6}$/i.test(p.especialCor||'')?p.especialCor:'#7c3aed';
  onAgSemDiscurso();
  onAgEspecial();
  onAgTema();
  // Populate select
  const sel=document.getElementById('agOradorSel');
  sel.innerHTML='<option value="">— Selecionar orador —</option>';
  [...oradores].sort((a,b)=>(a.nome||'').localeCompare(b.nome||'')).forEach(o=>{
    const opt=document.createElement('option');
    opt.value=o.id;opt.textContent=o.nome+' ('+(o.cong||'?')+')';
    if(p.nome&&p.nome===o.nome)opt.selected=true;
    sel.appendChild(opt);
  });
  const matched=p.nome&&oradores.find(o=>o.nome===p.nome);
  document.getElementById('agOradorBusca').value='';document.getElementById('agOradorSugestoes').classList.remove('open');
  if(p.nome&&!matched){
    // Has name but not in database — show "Novo" tab with data
    switchOradorTab('novo');
    document.getElementById('agNome').value=p.nome||'';
    document.getElementById('agCong').value=p.congregacao||'';
    document.getElementById('agTel').value=p.telefone||'';
  } else {
    switchOradorTab('cadastrado');
    document.getElementById('agOradorBusca').value=matched?(matched.nome+' — '+(matched.cong||'Sem congregação')):'';
    document.getElementById('agNome').value='';
    document.getElementById('agCong').value='';
    document.getElementById('agTel').value='';
  }
}
function onAgSemDiscurso(){
  const chk=document.getElementById('agSemDiscurso').checked;
  const color=document.getElementById('agSemDiscursoCor');
  document.getElementById('agCamposNormais').style.display=chk?'none':'block';
  document.getElementById('agCamposSemDisc').style.display=chk?'block':'none';
  document.getElementById('agTabCadastrado').style.display=chk?'none':'block';
  document.getElementById('agTabNovo').style.display='none';
  document.getElementById('tabCadastrado').style.display=chk?'none':'flex';
  document.getElementById('tabNovo').style.display=chk?'none':'flex';
  document.getElementById('agEspecialBox').style.display=chk?'none':'block';
  document.getElementById('agSemDiscursoCorHex').textContent=color.value.toUpperCase();
  color.oninput=()=>document.getElementById('agSemDiscursoCorHex').textContent=color.value.toUpperCase();
  atualizarSugestoesSentinela();
}
function onAgEspecial(){
  const checked=document.getElementById('agEspecial').checked,color=document.getElementById('agEspecialCor');
  document.getElementById('agEspecialCampos').style.display=checked?'grid':'none';
  document.getElementById('agTemaField').style.display=checked?'none':'block';
  document.getElementById('agTemaDesc').style.display=checked?'none':'block';
  document.getElementById('agEspecialCorHex').textContent=color.value.toUpperCase();
  color.oninput=()=>document.getElementById('agEspecialCorHex').textContent=color.value.toUpperCase();
  atualizarSugestoesSentinela();
}
let agTemaVerificacaoTimer=null,agTemaConfirmadoKey='';
function onAgTema(verificar=false){
  const n=parseInt(document.getElementById('agTema').value);document.getElementById('agTemaDesc').textContent=n&&TL[n]?TL[n]:'';
  if(!verificar)return;
  agTemaConfirmadoKey='';clearTimeout(agTemaVerificacaoTimer);
  if(n)agTemaVerificacaoTimer=setTimeout(()=>verificarUsoTema(n),450);
}
function confirmarTemaRepetido(avisos){
  document.getElementById('mTemaRepetido')?.remove();
  return new Promise(resolve=>{
    const overlay=document.createElement('div');overlay.id='mTemaRepetido';overlay.className='choice-overlay topic-warning-overlay';
    const modal=document.createElement('div');modal.className='choice-modal topic-warning-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    const icon=document.createElement('div');icon.className='topic-warning-icon';icon.innerHTML='<i data-lucide="history"></i>';
    const content=document.createElement('div');content.className='topic-warning-content';
    const title=document.createElement('div');title.className='choice-title';title.textContent='Atenção com este tema';content.appendChild(title);
    const hint=document.createElement('p');hint.className='choice-hint';hint.textContent='Confira antes de manter este tema na programação.';content.appendChild(hint);
    const list=document.createElement('div');list.className='topic-warning-list';
    avisos.forEach(aviso=>{const item=document.createElement('div');item.innerHTML='<i data-lucide="circle-alert"></i><span></span>';item.querySelector('span').textContent=aviso;list.appendChild(item);});content.appendChild(list);
    const actions=document.createElement('div');actions.className='topic-warning-actions';
    const change=document.createElement('button');change.type='button';change.className='btn bo';change.innerHTML='<i data-lucide="rotate-ccw"></i> Escolher outro tema';
    const keep=document.createElement('button');keep.type='button';keep.className='btn bp';keep.innerHTML='<i data-lucide="check"></i> Usar mesmo assim';
    let esc=null;const close=result=>{if(esc)document.removeEventListener('keydown',esc);overlay.remove();resolve(result);};change.onclick=()=>close(false);keep.onclick=()=>close(true);
    overlay.onclick=e=>{if(e.target===overlay)close(false);};esc=e=>{if(e.key==='Escape'&&document.body.contains(overlay))close(false);};document.addEventListener('keydown',esc);
    actions.appendChild(change);actions.appendChild(keep);content.appendChild(actions);modal.appendChild(icon);modal.appendChild(content);overlay.appendChild(modal);document.body.appendChild(overlay);
    if(window.lucide)lucide.createIcons();setTimeout(()=>keep.focus(),30);
  });
}
async function verificarUsoTema(numero){
  if(!numero||document.getElementById('agSemDiscurso').checked||document.getElementById('agEspecial').checked)return true;
  const idAtual=document.getElementById('agId').value,dataAtual=document.getElementById('agData').value;
  const chave=[numero,idAtual,dataAtual].join('|');if(agTemaConfirmadoKey===chave)return true;
  const hoje=new Date().toISOString().slice(0,10),limite=new Date();limite.setFullYear(limite.getFullYear()-1);const desde=isoLocal(limite);
  const futuros=programa.filter(p=>Number(p.temaNum)===numero&&p.data>=hoje&&p.id!==idAtual&&!(p.data===dataAtual&&p.id===idAtual)).sort((a,b)=>a.data.localeCompare(b.data));
  const historico=[...discursos,...programa].filter(p=>Number(p.temaNum)===numero&&p.data>=desde&&p.data<hoje&&p.id!==idAtual).filter((p,i,a)=>a.findIndex(x=>x.data===p.data&&Number(x.temaNum)===numero)===i).sort((a,b)=>b.data.localeCompare(a.data));
  if(!futuros.length&&!historico.length){agTemaConfirmadoKey=chave;return true;}
  const avisos=[];
  if(futuros.length){const p=futuros[0];avisos.push('Este tema já está agendado para '+fD(p.data)+(p.nome?' com '+p.nome:'')+(futuros.length>1?' e em mais '+(futuros.length-1)+' data(s)':'')+'.');}
  if(historico.length){const p=historico[0];avisos.push('Este tema foi apresentado nos últimos 12 meses, mais recentemente em '+fD(p.data)+(p.nome?' por '+p.nome:'')+'.');}
  const continuar=await confirmarTemaRepetido(avisos);
  if(continuar){agTemaConfirmadoKey=chave;return true;}
  document.getElementById('agTema').value='';document.getElementById('agTemaDesc').textContent='';return false;
}

let _canticosJWPromise=null,_sugestaoSentinelaSeq=0;
function palavrasTema(texto){
  const stop=new Set(['a','ao','aos','as','com','como','da','das','de','do','dos','e','em','esta','este','eu','na','nas','no','nos','o','os','para','por','que','se','seu','sua','um','uma','voce']);
  return normalizarTexto(texto).split(/[^a-z0-9]+/).filter(p=>p.length>2&&!stop.has(p));
}
function pontuarRelacaoSentinela(sentinela,discurso){
  const a=palavrasTema(sentinela),b=palavrasTema(discurso);let pontos=0;
  a.forEach(x=>b.forEach(y=>{if(x===y)pontos+=5;else if(x.length>4&&y.length>4&&(x.startsWith(y.slice(0,5))||y.startsWith(x.slice(0,5))))pontos+=2;}));
  const grupos=[
    ['deus','jeova','criador','criacao'],['jesus','cristo','messias','resgate'],['familia','casamento','marido','esposa','filhos','pais'],
    ['ansiedade','preocupacao','medo','coragem','confianca'],['fe','confiar','confianca','esperanca'],['amor','bondade','perdao','misericordia'],
    ['oracao','orar'],['biblia','escrituras','verdade','ensino'],['reino','governo','futuro','paraiso'],['morte','ressurreicao','vida'],
    ['feliz','felicidade','alegria'],['sofrimento','problemas','dificuldades','provas'],['amizade','amigo','companhia'],['jovem','jovens','criancas']
  ];
  grupos.forEach(g=>{if(g.some(x=>a.includes(x))&&g.some(x=>b.includes(x)))pontos+=3;});return pontos;
}
async function atualizarSugestoesSentinela(){
  const box=document.getElementById('agSugestoesSentinela');if(!box)return;
  if(!cfg.sugerirSentinela||document.getElementById('agEspecial')?.checked||document.getElementById('agSemDiscurso')?.checked){box.hidden=true;box.innerHTML='';return;}
  const data=document.getElementById('agData').value;if(!data){box.hidden=true;return;}
  const seq=++_sugestaoSentinelaSeq;box.hidden=false;box.innerHTML='<small>Buscando o estudo da Sentinela desta semana...</small>';
  const salvo=sentinelas.find(s=>s.data===data),temaSentinela=salvo?.tema||await fetchTemaJW(data);if(seq!==_sugestaoSentinelaSeq)return;
  if(!temaSentinela){box.innerHTML='<small>Não foi possível encontrar o tema da Sentinela desta semana.</small>';return;}
  const sugestoes=Object.entries(TL).filter(([n,t])=>t&&!bloqueados.has(Number(n))).map(([n,t])=>({n:Number(n),t,p:pontuarRelacaoSentinela(temaSentinela,t)})).filter(x=>x.p>0).sort((a,b)=>b.p-a.p||a.n-b.n).slice(0,5);
  box.innerHTML='<div class="watchtower-source"><strong>Sentinela:</strong> '+temaSentinela+'</div><div class="watchtower-hint">Sugestões relacionadas — escolha somente se forem adequadas:</div>';
  const list=document.createElement('div');list.className='watchtower-topic-list';
  sugestoes.forEach(s=>{const b=document.createElement('button');b.type='button';b.innerHTML='<strong>'+s.n+'</strong><span>'+s.t+'</span>';b.onclick=()=>{document.getElementById('agTema').value=s.n;onAgTema(true);};list.appendChild(b);});
  if(!sugestoes.length){const empty=document.createElement('small');empty.textContent='Nenhum discurso apresentou relação clara pelo título.';list.appendChild(empty);}box.appendChild(list);
}
function fetchCanticosJW(){
  if(_canticosJWPromise)return _canticosJWPromise;
  _canticosJWPromise=(async()=>{
    try{const salvo=JSON.parse(localStorage.getItem('oradores_canticos_jw')||'null');if(salvo&&Object.keys(salvo).length>100)return salvo;}catch(e){}
    const mapa={};
    try{
      const url='https://www.jw.org/pt/biblioteca/musicas-canticos/cante-de-coracao/';
      const r=await fetch('https://r.jina.ai/'+url);if(!r.ok)throw new Error('JW indisponível');const texto=await r.text();
      const re=/^\s*(?:\[)?(\d{1,3})\.\s*([^\]\n]+?)(?:\]\([^)]*\))?\s*(?:Reproduzir)?\s*$/gm;let m;
      while((m=re.exec(texto))){const titulo=m[2].replace(/\s+Reproduzir\s*$/i,'').trim();if(titulo.length>2)mapa[m[1]]=titulo;}
      if(Object.keys(mapa).length>50)localStorage.setItem('oradores_canticos_jw',JSON.stringify(mapa));
    }catch(e){}
    return mapa;
  })();return _canticosJWPromise;
}
async function obterTituloCantico(numero){if(!numero)return'';const mapa=await fetchCanticosJW();return mapa[String(numero)]||'';}
async function onAgCantico(){
  const input=document.getElementById('agCantico'),desc=document.getElementById('agCanticoDesc'),numero=parseInt(input.value);if(!numero){desc.textContent='';return;}
  desc.textContent='Buscando título no jw.org...';const titulo=await obterTituloCantico(numero);if(parseInt(input.value)!==numero)return;desc.textContent=titulo||'Título não encontrado — confira o número';
}
function onAgOradorSel(){
  const v=document.getElementById('agOradorSel').value;
  if(v){const o=oradores.find(x=>x.id===v);if(o){document.getElementById('agNome').value=o.nome;document.getElementById('agCong').value=o.cong||'';document.getElementById('agTel').value=o.tel||'';}}
}
let agSugestaoAtiva=-1;
function onAgOradorBusca(preservarSelecao=false){
  const input=document.getElementById('agOradorBusca'),box=document.getElementById('agOradorSugestoes'),query=normalizarTexto(input.value);
  if(!preservarSelecao)document.getElementById('agOradorSel').value='';agSugestaoAtiva=-1;
  const lista=[...oradores].filter(o=>!query||normalizarTexto((o.nome||'')+' '+(o.cong||'')).includes(query)).sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt-BR',{sensitivity:'base'})).slice(0,10);
  box.innerHTML='';
  if(!lista.length){const empty=document.createElement('div');empty.className='speaker-empty';empty.textContent='Nenhum orador encontrado';box.appendChild(empty);box.classList.add('open');return;}
  lista.forEach(o=>{
    const button=document.createElement('button');button.type='button';button.className='speaker-suggestion';button.dataset.id=o.id;
    const name=document.createElement('strong');name.textContent=o.nome;
    const meta=document.createElement('span');meta.textContent=(o.cong||'Sem congregação')+(o.tel?' · '+o.tel:'');
    button.appendChild(name);button.appendChild(meta);button.onmousedown=e=>{e.preventDefault();selecionarAgOrador(o.id);};box.appendChild(button);
  });
  box.classList.add('open');
}
function selecionarAgOrador(id){
  const o=oradores.find(x=>x.id===id);if(!o)return;
  document.getElementById('agOradorSel').value=id;document.getElementById('agOradorBusca').value=o.nome+' — '+(o.cong||'Sem congregação');document.getElementById('agOradorSugestoes').classList.remove('open');onAgOradorSel();
}
function limparAgOrador(){document.getElementById('agOradorBusca').value='';document.getElementById('agOradorSel').value='';document.getElementById('agNome').value='';document.getElementById('agCong').value='';document.getElementById('agTel').value='';onAgOradorBusca();document.getElementById('agOradorBusca').focus();}
function onAgOradorBuscaKey(event){
  const box=document.getElementById('agOradorSugestoes'),items=[...box.querySelectorAll('.speaker-suggestion')];if(!items.length)return;
  if(event.key==='ArrowDown'){event.preventDefault();agSugestaoAtiva=Math.min(agSugestaoAtiva+1,items.length-1);}else if(event.key==='ArrowUp'){event.preventDefault();agSugestaoAtiva=Math.max(agSugestaoAtiva-1,0);}else if(event.key==='Enter'&&agSugestaoAtiva>=0){event.preventDefault();selecionarAgOrador(items[agSugestaoAtiva].dataset.id);return;}else if(event.key==='Escape'){box.classList.remove('open');return;}else return;
  items.forEach((item,i)=>item.classList.toggle('active',i===agSugestaoAtiva));items[agSugestaoAtiva]?.scrollIntoView({block:'nearest'});
}
document.addEventListener('click',event=>{if(!event.target.closest('.speaker-combobox'))document.getElementById('agOradorSugestoes')?.classList.remove('open');});
async function saveAgend(){
  if(!db)return toast('Supabase não conectado!');
  const idField=document.getElementById('agId').value.trim();
  const data_val=document.getElementById('agData').value;
  if(!data_val)return toast('Informe a data!');
  const isCadTab=document.getElementById('agTabCadastrado').style.display!=='none';
  const selV=document.getElementById('agOradorSel').value;
  if(isCadTab&&!selV&&document.getElementById('agOradorBusca').value.trim())return toast('Escolha um orador nas sugestões.');
  let nome='',cong='',tel='';
  if(isCadTab&&selV){
    const o=oradores.find(x=>x.id===selV);
    if(o){nome=o.nome;cong=o.cong||'';tel=o.tel||'';}
  } else {
    nome=document.getElementById('agNome').value.trim();
    cong=document.getElementById('agCong').value.trim();
    tel=document.getElementById('agTel').value.trim();
    if(nome&&document.getElementById('agCadastrar').checked){
      try{
        await FF.add(FF.col(db,'oradores'),{nome,cong,tel,ultimoDiscurso:data_val,nota:0,obs:''});
        await loadOradores();
        toast('✓ Orador "'+nome+'" cadastrado!');
      }catch(e){toast('Erro ao cadastrar orador: '+e.message);}
    }
  }
  const isSemDisc=document.getElementById('agSemDiscurso').checked;
  const isEspecial=!isSemDisc&&document.getElementById('agEspecial').checked;
  const temaEspecial=isEspecial?document.getElementById('agEspecialTitulo').value.trim():'';
  if(isEspecial&&!temaEspecial)return toast('Digite o nome do discurso especial!');
  const temaNumInformado=parseInt(document.getElementById('agTema').value)||null;
  if(!isSemDisc&&!isEspecial&&temaNumInformado&&!(await verificarUsoTema(temaNumInformado)))return;
  const canticoNum=isSemDisc?null:(parseInt(document.getElementById('agCantico').value)||null);
  const cantico=canticoNum?(document.getElementById('agCanticoDesc').textContent&&!document.getElementById('agCanticoDesc').textContent.includes('Buscando')&&!document.getElementById('agCanticoDesc').textContent.includes('não encontrado')?document.getElementById('agCanticoDesc').textContent:await obterTituloCantico(canticoNum)):'';
  const entry={
    data:data_val,
    semDiscurso:isSemDisc||false,
    temaNum:(isSemDisc||isEspecial)?null:temaNumInformado,
    tema:isEspecial?temaEspecial:'',
    canticoNum,
    cantico,
    temImagens:!isSemDisc&&document.getElementById('agTemImagens').checked,
    nome:isSemDisc?null:(nome||null),
    congregacao:isSemDisc?'':cong,
    telefone:isSemDisc?'':tel,
    obs:isSemDisc?'':document.getElementById('agObs').value.trim(),
    motivo:isSemDisc?document.getElementById('agMotivo').value.trim():'',
    semDiscursoCor:isSemDisc?document.getElementById('agSemDiscursoCor').value:'#f59e0b',
    especial:isEspecial,
    especialTitulo:temaEspecial,
    especialCor:isEspecial?document.getElementById('agEspecialCor').value:'#7c3aed'
  };
  // Resolve o ID pelo campo ou por um registro existente na mesma data.
  let resolvedId=idField;
  if(!resolvedId){
    const snap=await FF.gets(FF.col(db,'programa'));
    const match=snap.docs.find(d=>d.data().data===data_val);
    if(match)resolvedId=match.id;
  }
  if(resolvedId){
    await FF.upd(FF.doc(db,'programa',resolvedId),entry);
    entry.id=resolvedId;
  } else {
    const ref=await FF.add(FF.col(db,'programa'),entry);
    entry.id=ref.id;
  }
  // Replace local entry for this date
  programa=programa.filter(p=>p.data!==data_val);
  programa.push(entry);
  // Atualiza ultimoDiscurso do orador para datas já passadas
  const hoje3=new Date().toISOString().slice(0,10);
  if(!isSemDisc&&nome&&data_val<=hoje3){
    const orCad=oradores.find(o=>o.nome===nome);
    if(orCad&&db&&(!orCad.ultimoDiscurso||data_val>orCad.ultimoDiscurso)){
      await FF.upd(FF.doc(db,'oradores',orCad.id),{ultimoDiscurso:data_val});
      orCad.ultimoDiscurso=data_val;
      renderOradores();
    }
  }
  closeM('mAgend');renderHome();toast('✓ Salvo!');
}
async function delAgendAtual(){
  const id=document.getElementById('agId').value,data=document.getElementById('agData').value;
  if(id)await delAgend(id,data,true);
}
async function delAgend(id,data,closeModal=false){
  if(!id||!confirm('Excluir este discurso da programação?'))return;
  await FF.del(FF.doc(db,'programa',id));programa=programa.filter(p=>p.id!==id);
  if(closeModal)closeM('mAgend');renderHome();renderPrograma();renderTemas();toast('Discurso excluído.');
}

// WA
function abrirWADir(tel){window.open('https://wa.me/55'+tel.replace(/\D/g,''),'_blank');}
function compartilharProgramacao(){
  const hoje=new Date().toISOString().slice(0,10);
  const itens=[...programa].filter(p=>p.data>=hoje).sort((a,b)=>a.data.localeCompare(b.data)).slice(0,8);
  if(!itens.length)return toast('Não há discursos futuros para compartilhar.');
  const linhas=itens.map(p=>'📅 '+fD(p.data)+' — '+(p.semDiscurso?(p.motivo||'Sem discurso'):(p.nome||'Orador a definir')+(p.temaNum?' | Tema '+p.temaNum:'')));
  const texto='*Programação de discursos — '+cfg.cong+'*\n\n'+linhas.join('\n');
  window.open('https://wa.me/?text='+encodeURIComponent(texto),'_blank');
}
