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
  document.getElementById('mAgendTit').textContent='Inserir na Programação';
  document.getElementById('agDataLabel').textContent='Data ('+(Number(cfg.dia)===0?'domingo':'sábado')+')';
  openM('mAgend');
}
function editarAgend(jsonOrEnc){
  let p;
  try{p=JSON.parse(jsonOrEnc);}catch(e){p=JSON.parse(decodeURIComponent(jsonOrEnc));}
  preencherModalAgend(p);
  document.getElementById('mAgendTit').textContent='Editar — '+fD(p.data);
  document.getElementById('agDataLabel').textContent='Data ('+(Number(cfg.dia)===0?'domingo':'sábado')+')';
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
  document.getElementById('agId').value=p.id||'';
  document.getElementById('btnDelAgend').style.display=p.id?'inline-flex':'none';
  document.getElementById('agData').value=p.data||'';
  document.getElementById('agTema').value=p.temaNum||'';
  document.getElementById('agObs').value=p.obs||'';
  document.getElementById('agMotivo').value=p.motivo||'';
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
  if(p.nome&&!matched){
    // Has name but not in database — show "Novo" tab with data
    switchOradorTab('novo');
    document.getElementById('agNome').value=p.nome||'';
    document.getElementById('agCong').value=p.congregacao||'';
    document.getElementById('agTel').value=p.telefone||'';
  } else {
    switchOradorTab('cadastrado');
    document.getElementById('agNome').value='';
    document.getElementById('agCong').value='';
    document.getElementById('agTel').value='';
  }
}
function onAgSemDiscurso(){
  const chk=document.getElementById('agSemDiscurso').checked;
  document.getElementById('agCamposNormais').style.display=chk?'none':'block';
  document.getElementById('agCamposSemDisc').style.display=chk?'block':'none';
  document.getElementById('agTabCadastrado').style.display=chk?'none':'block';
  document.getElementById('agTabNovo').style.display='none';
  document.getElementById('tabCadastrado').style.display=chk?'none':'flex';
  document.getElementById('tabNovo').style.display=chk?'none':'flex';
  document.getElementById('agEspecialBox').style.display=chk?'none':'block';
}
function onAgEspecial(){
  const checked=document.getElementById('agEspecial').checked,color=document.getElementById('agEspecialCor');
  document.getElementById('agEspecialCampos').style.display=checked?'grid':'none';
  document.getElementById('agTemaField').style.display=checked?'none':'block';
  document.getElementById('agTemaDesc').style.display=checked?'none':'block';
  document.getElementById('agEspecialCorHex').textContent=color.value.toUpperCase();
  color.oninput=()=>document.getElementById('agEspecialCorHex').textContent=color.value.toUpperCase();
}
function onAgTema(){const n=parseInt(document.getElementById('agTema').value);document.getElementById('agTemaDesc').textContent=n&&TL[n]?TL[n]:'';}
function onAgOradorSel(){
  const v=document.getElementById('agOradorSel').value;
  if(v){const o=oradores.find(x=>x.id===v);if(o){document.getElementById('agNome').value=o.nome;document.getElementById('agCong').value=o.cong||'';document.getElementById('agTel').value=o.tel||'';}}
}
async function saveAgend(){
  if(!db)return toast('Supabase não conectado!');
  const idField=document.getElementById('agId').value.trim();
  const data_val=document.getElementById('agData').value;
  if(!data_val)return toast('Informe a data!');
  const isCadTab=document.getElementById('agTabCadastrado').style.display!=='none';
  const selV=document.getElementById('agOradorSel').value;
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
  const entry={
    data:data_val,
    semDiscurso:isSemDisc||false,
    temaNum:(isSemDisc||isEspecial)?null:(parseInt(document.getElementById('agTema').value)||null),
    tema:isEspecial?temaEspecial:'',
    nome:isSemDisc?null:(nome||null),
    congregacao:isSemDisc?'':cong,
    telefone:isSemDisc?'':tel,
    obs:isSemDisc?'':document.getElementById('agObs').value.trim(),
    motivo:isSemDisc?document.getElementById('agMotivo').value.trim():'',
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

