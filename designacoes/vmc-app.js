// Aba "Vida e Ministério": apostila do jw.org, designações da reunião do meio de semana e PDF da programação.
// Usa o estado e as funções de app.js (sb, vinc, pessoas, reunioes, cfg, salvar, toast…).
const V=Vmc;
let semanasVmc=null,mesVmc=new Date(),edVmc=null;mesVmc.setDate(1);

// Data da reunião vem do dia configurado (pode mudar em 2027); a semana (segunda-feira) é o id.
function comData(s){
  const dia=R.diaMeioDoAno(Number(s.semana.slice(0,4)),cfgRegras())??3;
  const data=V.dataReuniao(s.semana,dia),r=reunioes.find(x=>x.data===data&&x.tipo==='meio');
  // Evento da congregação (assembleia, congresso…) marcado em Designações também vale aqui.
  const evento=r?.semReuniao&&!s.semReuniao?{semReuniao:true,motivo:r.motivo||'Não haverá reunião',porEvento:true}:{};
  return {...s,data,...evento};
}
async function carregarVmc(){semanasVmc=(await lista('desig_vmc')).filter(s=>s.semana).map(s=>comData({...s,semana:s.id||s.semana}));}
async function abrirAbaVmc(){
  $('vmcHora').value=V.horaValida(cfg.horaMeio)?cfg.horaMeio:'';$('vmcHora').disabled=!pode;
  if(!semanasVmc){$('vmcLista').innerHTML='<div class="vazio">Carregando…</div>';try{await carregarVmc();}catch(e){$('vmcLista').innerHTML='';const v=document.createElement('div');v.className='vazio';v.textContent='Não foi possível carregar: '+e.message;$('vmcLista').appendChild(v);return;}}
  renderVmc();
}
function mudarMesVmc(n){mesVmc=new Date(mesVmc.getFullYear(),mesVmc.getMonth()+n,1);renderVmc();}
function irHojeVmc(){mesVmc=new Date();mesVmc.setDate(1);renderVmc();}
const semanasDoMesVmc=()=>V.semanasDoMes(semanasVmc||[],mesVmc.getFullYear(),mesVmc.getMonth()+1);
const funcoesReuniao=()=>R.FUNCOES;
const ctxVmc=semana=>({semana,pessoas,semanas:(semanasVmc||[]).filter(s=>s.semana!==semana.semana).concat(semana),reunioes,funcoesReuniao:funcoesReuniao()});

function renderVmc(){
  $('vmcMesTitulo').textContent=maiuscula(mesVmc.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}));
  const div=$('vmcLista');div.innerHTML='';
  if(cfg.diaMeio==null){div.innerHTML='<div class="vazio">Falta escolher o dia da reunião do meio de semana em Configurações.</div>';return;}
  const lista=semanasDoMesVmc(),hoje=hojeISO();
  if(!lista.length){
    const v=document.createElement('div');v.className='vazio';
    v.textContent=pode?'A apostila deste mês ainda não foi importada. Toque em "Buscar apostila" para trazer as partes do jw.org.':'A apostila deste mês ainda não foi importada.';
    div.appendChild(v);return;
  }
  lista.forEach(s=>{
    const card=document.createElement('article');card.className='vmc-card'+(s.data<hoje?' passada':'');
    const topo=document.createElement(pode?'button':'div');topo.className='vmc-topo';if(pode){topo.type='button';topo.onclick=()=>abrirSemanaVmc(s.semana);topo.setAttribute('aria-label','Editar designações de '+s.data.split('-').reverse().join('/'));}
    const dt=new Date(s.data+'T12:00:00');
    topo.innerHTML='<div class="dia"><b></b><small></small></div><div class="tx"><strong></strong><span></span></div><span class="vmc-status"></span>';
    topo.querySelector('.dia b').textContent=s.data.slice(8,10);topo.querySelector('.dia small').textContent=MESES_CURTOS[dt.getMonth()];
    topo.querySelector('.tx strong').textContent=(s.leitura||s.rotulo||'').toLocaleUpperCase('pt-BR');
    const vs=V.vagas(s),feitas=vs.filter(v=>s.pessoas?.[v.chave]).length;
    topo.querySelector('.tx span').textContent=s.semReuniao?(s.motivo||'Sem reunião'):feitas+' de '+vs.length+' designações';
    const st=topo.querySelector('.vmc-status');st.textContent=s.semReuniao?'Sem reunião':feitas===vs.length?'Completa':'Pendente';st.classList.toggle('ok',!s.semReuniao&&feitas===vs.length);
    card.appendChild(topo);
    if(!s.semReuniao){
      const ul=document.createElement('div');ul.className='vmc-resumo';
      const pres=document.createElement('div');pres.className='vmc-l';pres.innerHTML='<span>Presidente</span><b></b>';pres.querySelector('b').textContent=nomeVaga(s,'presidente');ul.appendChild(pres);
      V.programa(s).filter(l=>l.vagas?.length&&l.parte).forEach(l=>{
        const row=document.createElement('div');row.className='vmc-l';row.innerHTML='<span></span><b></b>';
        row.querySelector('span').textContent=l.texto;
        const b=row.querySelector('b');b.textContent=l.vagas.map(v=>nomeVaga(s,v.chave)).join(' / ');
        const avisos=l.vagas.flatMap(v=>avisosVaga(s,v.chave));
        if(avisos.length){b.classList.add('alerta');b.title=avisos.join('\n');b.insertAdjacentHTML('beforeend',icone('triangle-alert'));}
        ul.appendChild(row);
      });
      card.appendChild(ul);
    }
    div.appendChild(card);
  });
  DesignaUI.desenharIcones();
}
function nomeVaga(s,chave){const id=s.pessoas?.[chave];return id?nomePessoa(id):'—';}
function avisosVaga(s,chave){
  const id=s.pessoas?.[chave],p=pessoas.find(x=>x.id===id),vaga=V.vagas(s).find(v=>v.chave===chave);
  return p&&vaga?V.conflitos({...ctxVmc(s),pessoa:p,vaga}):[];
}

// ── Buscar a apostila no jw.org (api/apostila) ──
async function buscarApostila(){
  try{exigirEdicao();}catch(e){return;}
  const b=$('vmcBuscar'),rotulo=b.innerHTML;b.disabled=true;b.textContent='Buscando…';
  try{
    const ano=mesVmc.getFullYear(),m=mesVmc.getMonth();
    // A semana que começa no fim do mês anterior pode estar na apostila anterior.
    const datas=[...new Set([R.iso(new Date(ano,m,1-7)),R.iso(new Date(ano,m,15)),R.iso(new Date(ano,m+1,0))])];
    const edicoes=new Map(),erros=[];
    for(const d of datas){
      const r=await fetch('/api/apostila?data='+d).catch(()=>null);
      const j=r?await r.json().catch(()=>({})):{};
      if(r?.ok&&j.semanas)edicoes.set(j.edicao,j);else erros.push(j.error||'Sem resposta do servidor.');
    }
    const semanas=[...new Map([...edicoes.values()].flatMap(e=>e.semanas.map(s=>[s.semana,{...s,edicao:e.edicao,nomeEdicao:e.nome}]))).values()];
    if(!semanas.length)throw new Error(erros[0]||'A apostila ainda não está disponível no jw.org.');
    if(!semanasVmc)await carregarVmc();
    const existentes=new Map(semanasVmc.map(s=>[s.semana,s]));
    const novas=semanas.filter(s=>!existentes.has(s.semana)).length;
    const nomes=[...edicoes.values()].map(e=>e.nome).join(' e ');
    if(!confirm('Apostila '+nomes+': '+semanas.length+' semana(s) — '+novas+' nova(s), '+(semanas.length-novas)+' para atualizar.\n\nNas semanas já importadas, quem está designado continua nas partes que não mudaram. Importar?'))return;
    let n=0;
    for(const s of semanas){
      const antiga=existentes.get(s.semana);
      const base={semana:s.semana,rotulo:s.rotulo,leitura:s.leitura,canticos:s.canticos,partes:s.partes,edicao:s.edicao,nomeEdicao:s.nomeEdicao,importadoEm:new Date().toISOString()};
      const {data:_d,porEvento:_p,...dados}=V.mesclarImportacao(base,antiga&&{...antiga,...(antiga.porEvento?{semReuniao:false,motivo:''}:{})});
      delete dados.id;
      b.textContent='Salvando '+(++n)+' de '+semanas.length+'…';
      await salvar('desig_vmc',s.semana,dados);
      semanasVmc=[...semanasVmc.filter(x=>x.semana!==s.semana),comData(dados)];
    }
    renderVmc();toast('✓ Apostila importada: '+semanas.length+' semana(s).',4500);
  }catch(e){if(e.message!=='Somente leitura')toast(e.message||'Não foi possível buscar a apostila.',7000);}
  finally{b.disabled=false;b.innerHTML=rotulo;DesignaUI.desenharIcones();}
}

async function salvarHoraVmc(){
  const h=$('vmcHora').value;if(h&&!V.horaValida(h))return toast('Horário inválido.');
  try{const novo={...cfg,horaMeio:h||null};delete novo.id;await salvar('desig_config','app',novo);cfg=novo;toast('✓ Horário de início salvo.');}
  catch(e){if(e.message!=='Somente leitura')toast('Não foi possível salvar: '+e.message,6000);}
}

// ── Editar uma semana ──
function abrirSemanaVmc(semana){
  const s=(semanasVmc||[]).find(x=>x.semana===semana);if(!s)return;
  edVmc=JSON.parse(JSON.stringify({pessoas:{},...s}));
  $('vTitulo').textContent=maiuscula(new Date(s.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}));
  $('vSub').textContent=(s.leitura||'')+(s.rotulo?' · Semana de '+s.rotulo:'');
  $('vSem').checked=!!edVmc.semReuniao;$('vSem').disabled=!!edVmc.porEvento;$('vMotivo').value=edVmc.motivo||'';
  renderEdVmc();abrirJanela('janVmc');
}
function alternarSemVmc(){edVmc.semReuniao=$('vSem').checked;renderEdVmc();}
function renderEdVmc(){
  $('vMotivoBox').hidden=!edVmc.semReuniao||!!edVmc.porEvento;
  $('vEvento').hidden=!edVmc.porEvento;if(edVmc.porEvento)$('vEvento').textContent='Sem reunião por causa de um evento da congregação: '+(edVmc.motivo||'')+'. Altere em Programação ou nos eventos da congregação.';
  const div=$('vPartes');div.innerHTML='';if(edVmc.semReuniao)return;
  const ctx=ctxVmc(edVmc),vagas=V.vagas(edVmc);
  const linhaPresidente={texto:'Presidente da reunião',vagas:[{chave:'presidente',rotulo:''}]};
  [linhaPresidente,...V.programa(edVmc)].forEach(l=>{
    if(l.secao){const h=document.createElement('div');h.className='vmc-secao '+l.secao;h.textContent=l.titulo;div.appendChild(h);return;}
    if(!l.vagas?.length)return;
    const row=document.createElement('div');row.className='vmc-ed';
    const t=document.createElement('div');t.className='vmc-ed-tx';t.textContent=l.texto+(l.min?' ('+l.min+' min)':'');
    if(l.cenario){const c=document.createElement('small');c.textContent=l.cenario;t.appendChild(c);}
    row.appendChild(t);
    const sels=document.createElement('div');sels.className='vmc-ed-sel';
    l.vagas.forEach(lv=>{
      const vaga=vagas.find(v=>v.chave===lv.chave);if(!vaga)return;
      const caixa=document.createElement('label');caixa.className='vmc-vaga';
      if(lv.rotulo)caixa.appendChild(Object.assign(document.createElement('span'),{textContent:lv.rotulo}));
      const sel=document.createElement('select');sel.add(new Option('— Vago —',''));
      const atual=edVmc.pessoas[vaga.chave]||'';
      const cands=V.candidatos({...ctx,vaga});
      if(vaga.funcao==='ajudante'&&!edVmc.pessoas[vaga.de])sel.disabled=true;
      cands.forEach(c=>sel.add(new Option(c.pessoa.nome+' · '+R.tempoSem(c.ultima,edVmc.data)+(c.avisos.length?' ⚠':''),c.pessoa.id)));
      if(atual&&!cands.some(c=>c.pessoa.id===atual))sel.add(new Option(nomePessoa(atual)+' (não marcada para esta parte)',atual));
      sel.value=atual;
      sel.onchange=()=>{if(sel.value)edVmc.pessoas[vaga.chave]=sel.value;else delete edVmc.pessoas[vaga.chave];
        // Trocar o estudante limpa o ajudante de outro sexo.
        if(vaga.funcao==='estudante'&&edVmc.pessoas[vaga.chave+'a']){const a=pessoas.find(p=>p.id===edVmc.pessoas[vaga.chave+'a']),e=pessoas.find(p=>p.id===sel.value);if(!e||(V.sexoDe(a)&&V.sexoDe(e)&&V.sexoDe(a)!==V.sexoDe(e)))delete edVmc.pessoas[vaga.chave+'a'];}
        renderEdVmc();};
      caixa.appendChild(sel);sels.appendChild(caixa);
      if(!cands.length&&vaga.funcao!=='ajudante'){const h=document.createElement('small');h.className='hint';h.textContent=vaga.funcao==='estudante'?(vaga.soIrmao?'Nenhum irmão disponível. Informe "Irmão" no cadastro das pessoas.':'Ninguém disponível.'):'Ninguém marcado para '+V.nomeFuncao(vaga.funcao)+'. Marque em Configurações → Funções.';caixa.appendChild(h);}
      if(atual){const p=pessoas.find(x=>x.id===atual);if(p)V.conflitos({...ctx,pessoa:p,vaga}).forEach(a=>{const av=document.createElement('div');av.className='aviso';av.innerHTML=icone('triangle-alert');av.appendChild(Object.assign(document.createElement('span'),{textContent:p.nome+': '+a}));caixa.appendChild(av);});}
    });
    row.appendChild(sels);div.appendChild(row);
  });
  DesignaUI.desenharIcones();
}
function sugerirSemanaVmc(){if(edVmc.semReuniao)return;[edVmc]=V.sugerir({alvo:[edVmc],semanas:(semanasVmc||[]).filter(s=>s.semana!==edVmc.semana),pessoas,reunioes,funcoesReuniao:funcoesReuniao()});renderEdVmc();toast('Vagas vazias preenchidas. Confira e salve.');}
function limparSemanaVmc(){edVmc.pessoas={};renderEdVmc();}
const dadosVmc=s=>{const{data:_d,porEvento:_p,id:_i,...d}=s;return {...d,pessoas:Object.fromEntries(Object.entries(s.pessoas||{}).filter(([,v])=>v))};};
async function salvarSemanaVmc(){
  const b=$('vSalvar');b.disabled=true;
  try{
    const base=edVmc.porEvento?{...edVmc,semReuniao:false,motivo:''}:{...edVmc,motivo:edVmc.semReuniao?$('vMotivo').value.trim():''};
    const dados=dadosVmc(base);
    await salvar('desig_vmc',edVmc.semana,dados);
    semanasVmc=[...semanasVmc.filter(s=>s.semana!==edVmc.semana),comData(dados)];
    fecharJanela('janVmc');renderVmc();toast('✓ Semana salva.');
  }catch(e){if(e.message!=='Somente leitura')toast('Não foi possível salvar: '+e.message,6000);}
  finally{b.disabled=false;}
}
async function sugerirVmcMes(){
  const alvo=semanasDoMesVmc().filter(s=>s.data>=hojeISO()&&!s.semReuniao);
  if(!alvo.length)return toast('Não há semanas futuras importadas neste mês.');
  if(!confirm('Preencher as vagas vazias das '+alvo.length+' semana(s) futuras deste mês? Quem já está designado continua.'))return;
  try{
    const outras=semanasVmc.filter(s=>!alvo.some(a=>a.semana===s.semana));
    for(const s of V.sugerir({alvo,semanas:outras,pessoas,reunioes,funcoesReuniao:funcoesReuniao()})){
      const dados=dadosVmc(s);await salvar('desig_vmc',s.semana,dados);
      semanasVmc=[...semanasVmc.filter(x=>x.semana!==s.semana),comData(dados)];
    }
    renderVmc();toast('✓ Vagas preenchidas. Confira os avisos, se houver.');
  }catch(e){if(e.message!=='Somente leitura')toast('Não foi possível salvar: '+e.message,6000);}
}

// ── PDF da programação (modelo da reunião do meio de semana) ──
function abrirPdfVmc(){$('vmcPdfMes').value=mesVmc.getFullYear()+'-'+String(mesVmc.getMonth()+1).padStart(2,'0');abrirJanela('janPdfVmc');}
async function baixarPdfVmc(enviar=false){
  const b=$(enviar?'vmcPdfShare':'vmcPdfBtn');b.disabled=true;
  try{
    const[ano,m]=$('vmcPdfMes').value.split('-').map(Number);const qtd=Number($('vmcPdfQtd').value);
    if(!ano||!m)throw new Error('Escolha o mês inicial.');
    const semanas=Array.from({length:qtd},(_,i)=>new Date(ano,m-1+i,1)).flatMap(d=>V.semanasDoMes(semanasVmc||[],d.getFullYear(),d.getMonth()+1));
    if(!semanas.length)throw new Error('Nenhuma semana importada neste período. Busque a apostila primeiro.');
    const nome=id=>id?nomePessoa(id):'';
    const dados=semanas.map(s=>({data:s.data,leitura:s.leitura,semReuniao:s.semReuniao,motivo:s.motivo,presidente:nome(s.pessoas?.presidente),
      linhas:V.programa(s,cfg.horaMeio).map(l=>l.secao?l:{...l,nomes:(l.vagas||[]).map(v=>nome(s.pessoas?.[v.chave])),rotulos:(l.vagas||[]).map(v=>v.rotulo)})}));
    const JsPDF=await PdfDesignacoes.carregarJsPDF();
    const pdf=PdfDesignacoes.criarPdfVmc(JsPDF,dados,{congregacao:vinc.nome});
    const arq='vida-e-ministerio-'+$('vmcPdfMes').value+'.pdf';
    if(enviar){const r=await DesignaUI.compartilharArquivo(pdf.output('blob'),arq,'Vida e Ministério — '+vinc.nome);if(r!=='cancelado')fecharJanela('janPdfVmc');return;}
    pdf.save(arq);fecharJanela('janPdfVmc');toast('PDF da programação gerado!');
  }catch(e){toast(e.message||'Não foi possível gerar o PDF.',6000);}
  finally{b.disabled=false;}
}

// Histórico (aba Histórico).
function descreverAlteracaoVmc(a){
  const antes=a.old_data||{},depois=a.new_data||{},semana=a.record_id;
  const titulo='Vida e Ministério da semana de '+semana.slice(8,10)+'/'+semana.slice(5,7);
  if(a.action==='DELETE')return{titulo:'Apagou '+titulo,detalhes:[]};
  if(a.action==='INSERT'&&!Object.keys(depois.pessoas||{}).length)return{titulo:'Importou a apostila: semana de '+semana.slice(8,10)+'/'+semana.slice(5,7),detalhes:[]};
  const det=[],rot=new Map(V.vagas(depois).map(v=>[v.chave,v]));
  const partes=new Map((depois.partes||[]).map(p=>[p.n,p]));
  const nomeV=k=>{const v=rot.get(k);if(!v)return k;if(v.parte)return (partes.get(v.parte)?.titulo||'Parte '+v.parte)+(v.rotulo&&v.funcao!=='leitura_biblia'?' ('+v.rotulo.toLowerCase()+')':'');return v.chave==='oracao_inicial'?'Oração inicial':v.chave==='oracao_final'?'Oração final':v.rotulo;};
  new Set([...Object.keys(antes.pessoas||{}),...Object.keys(depois.pessoas||{})]).forEach(k=>{const x=antes.pessoas?.[k]||null,y=depois.pessoas?.[k]||null;if(x!==y)det.push(nomeV(k)+': '+(x?nomePessoa(x):'—')+' → '+(y?nomePessoa(y):'—'));});
  if(!!antes.semReuniao!==!!depois.semReuniao)det.push(depois.semReuniao?'Marcou "sem reunião"':'Desmarcou "sem reunião"');
  return det.length?{titulo:'Alterou '+titulo,detalhes:det}:null;
}
