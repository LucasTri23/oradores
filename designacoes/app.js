// Módulo Designações: programação das reuniões, pessoas e configurações.
const $=id=>document.getElementById(id);
const R=Regras;
const toast=(m,ms)=>DesignaUI.toast(m,ms);
const icone=n=>'<i data-lucide="'+n+'"></i>';
const MESES_CURTOS=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const maiuscula=s=>s.charAt(0).toUpperCase()+s.slice(1);

let sb=null,vinc=null,user=null,pode=false;
let pessoas=[],reunioes=[],cfg={},cfgOradores=null,campo=[];
let oradores={programa:[],discursantes:[]};
let mes=new Date();mes.setDate(1);
let edicao=null,edCampo=null;
let campoQuadroPrefs={};
let mesCampo=new Date();mesCampo.setDate(1);

// ── Banco ──
async function lista(colecao){
  const{data,error}=await sb.from('app_records').select('id,data').eq('workspace_id',vinc.workspaceId).eq('collection',colecao);
  if(error)throw error;
  return (data||[]).map(r=>({...r.data,id:r.id}));
}
function exigirEdicao(){if(!pode){toast('Você tem acesso só para ver as designações.');throw new Error('Somente leitura');}}
async function salvar(colecao,id,dados){
  exigirEdicao();
  const{id:_,...limpo}=dados;
  const{error}=await sb.from('app_records').upsert({id:String(id),workspace_id:vinc.workspaceId,collection:colecao,data:limpo,owner_id:user.id},{onConflict:'workspace_id,collection,id'});
  if(error)throw error;
}
async function apagar(colecao,id){
  exigirEdicao();
  const{error}=await sb.from('app_records').delete().eq('workspace_id',vinc.workspaceId).eq('collection',colecao).eq('id',String(id));
  if(error)throw error;
}
const novoId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);

async function carregar(){
  const[ps,rs,cs,central,cp]=await Promise.all([lista('desig_pessoas'),lista('desig_reunioes'),lista('desig_config'),lista('cong_pessoas').catch(()=>[]),lista('desig_campo').catch(()=>[])]);
  // Nome, grupo e telefone vêm da lista única da congregação; aqui ficam só as funções de cada pessoa.
  const funcoesPorId=new Map(ps.map(p=>[p.id,p.funcoes||{}]));
  const antigas=ps.filter(p=>p.nome&&!central.some(c=>c.id===p.id||Congregacao.normalizar(c.nome)===Congregacao.normalizar(p.nome)));
  // Migração única: quem só existia nas Designações vai para a lista da congregação (mesmo id).
  if(antigas.length&&pode){
    for(const p of antigas){try{await Congregacao.salvar(sb,vinc.workspaceId,user.id,'cong_pessoas',p.id,{nome:p.nome,grupo:p.grupo||'',telefone:'',obs:p.obs||'',ativo:p.ativo!==false});central.push({id:p.id,nome:p.nome,grupo:p.grupo||'',telefone:'',obs:p.obs||'',ativo:p.ativo!==false});}catch(e){}}
  }
  const lista_=[...central,...antigas.filter(a=>!central.some(c=>c.id===a.id))];
  pessoas=lista_.map(p=>({id:p.id,nome:p.nome,grupo:p.grupo||'',sexo:p.sexo||'',telefone:p.telefone||'',obs:p.obs||'',ativo:p.ativo!==false,funcoes:funcoesPorId.get(p.id)||{}}))
    .sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt-BR'));
  reunioes=rs.filter(r=>r.data);
  campo=cp.filter(c=>c.data&&c.saidaId);
  cfg=cs.find(c=>c.id==='app')||{};
  campoQuadroPrefs=cs.find(c=>c.id==='campo_quadro')||{};
  // Dados do Oradores (para avisos e para o dia do fim de semana), se a pessoa tiver acesso.
  if(Conta.podeVer(vinc,'oradores')){
    try{
      const[programa,discursantes,config]=await Promise.all([lista('programa'),lista('discursantes'),lista('config')]);
      oradores={programa,discursantes};
      const app=config.find(c=>c.id==='app');
      cfgOradores=app?{dia:app.dia,dia2027:app.dia2027,cong:app.cong,end:app.end}:null;
    }catch(e){oradores={programa:[],discursantes:[]};}
  }
}
const cfgRegras=()=>({...cfg,oradores:cfgOradores});
// Funções que a congregação usa (quantidade maior que zero em alguma reunião).
function funcoesEmUso(){
  const q=R.quantidades(cfg);
  return Object.keys(R.FUNCOES).filter(f=>(q.meio[f]||0)>0||(q.fim[f]||0)>0);
}
// Dirigente de campo: marcado junto com as outras funções em Configurações → Funções.
const CAMPO=R.FUNCAO_CAMPO.chave;
const infoFuncao=f=>f===CAMPO?R.FUNCAO_CAMPO:R.FUNCOES[f];
const hojeISO=()=>R.iso(new Date());
const nomePessoa=id=>pessoas.find(p=>p.id===id)?.nome||'(pessoa removida)';
const reuniaoSalva=data=>reunioes.find(r=>r.data===data);

// ── Navegação ──
function irAba(){
  const aba=['#pessoas','#config','#historico','#campo','#vmc'].includes(location.hash)?location.hash.slice(1):'programacao';
  // O que cada pessoa pode fazer agora fica em Configurações → Funções.
  if(aba==='config'||aba==='pessoas'){location.href='/#configuracoes';return;}
  document.querySelectorAll('.secao').forEach(s=>s.hidden=s.id!=='sec-'+aba);
  document.querySelectorAll('[data-aba]').forEach(a=>a.classList.toggle('active',a.dataset.aba===aba));
  if(aba==='programacao')renderProgramacao();
  if(aba==='campo')renderCampo();
  if(aba==='vmc')abrirAbaVmc();
  if(aba==='config')renderConfig();
  if(aba==='historico')renderHistorico();
}
window.addEventListener('hashchange',irAba);
function fecharJanela(id){$(id).hidden=true;}
function abrirJanela(id){$(id).hidden=false;DesignaUI.desenharIcones();}

// ── Programação ──
function mudarMes(n){mes=new Date(mes.getFullYear(),mes.getMonth()+n,1);renderProgramacao();}
function irHoje(){mes=new Date();mes.setDate(1);renderProgramacao();}
function reunioesDoMesAtual(){return R.reunioesDoMes(mes.getFullYear(),mes.getMonth()+1,cfgRegras(),reunioes);}
function tituloReuniao(r){
  return maiuscula(new Date(r.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}));
}

function renderProgramacao(){
  $('mesTitulo').textContent=maiuscula(mes.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}));
  const div=$('listaReunioes');div.innerHTML='';
  if(cfg.diaMeio==null){
    div.innerHTML='<div class="vazio" style="grid-column:1/-1">Falta escolher o dia da reunião do meio de semana em Configurações.</div>';
  }
  const lista=reunioesDoMesAtual();
  const qtd=R.quantidades(cfg),hoje=hojeISO();
  lista.forEach(r=>{
    const card=document.createElement('article');
    card.className='reuniao'+(r.data<hoje?' passada':'')+(pode?'':' leitura');

    const dt=new Date(r.data+'T12:00:00');
    const topo=document.createElement(pode?'button':'div');topo.className='reuniao-topo';if(pode){topo.type='button';topo.setAttribute('aria-label','Editar reuni?o de '+r.data);topo.onclick=()=>abrirReuniao(r.data);}
    topo.innerHTML='<div class="dia"><b></b><small></small></div><div class="tx"><strong></strong><span></span></div><span class="tipo"></span>';
    topo.querySelector('.dia b').textContent=r.data.slice(8,10);
    topo.querySelector('.dia small').textContent=MESES_CURTOS[dt.getMonth()];
    topo.querySelector('.tx strong').textContent=maiuscula(dt.toLocaleDateString('pt-BR',{weekday:'long'}));
    const preenchidas=R.FUNCOES_POR_TIPO[r.tipo].reduce((s,f)=>s+R.pessoasDe(r,f).length,0);
    const total=R.FUNCOES_POR_TIPO[r.tipo].reduce((s,f)=>s+qtd[r.tipo][f],0);
    topo.querySelector('.tx span').textContent=r.semReuniao?'Sem reunião':preenchidas+' de '+total+' vagas preenchidas';
    const tipo=topo.querySelector('.tipo');tipo.textContent=R.TIPOS[r.tipo];if(r.tipo==='fim')tipo.classList.add('fim');
    card.appendChild(topo);
    if(r.semReuniao){
      const s=document.createElement('div');s.className='sem-reuniao';s.textContent=r.motivo||'Não haverá reunião nesta data.';card.appendChild(s);
    }else R.FUNCOES_POR_TIPO[r.tipo].forEach(f=>{
      const vagas=qtd[r.tipo][f];if(!vagas)return;
      const linha=document.createElement('div');linha.className='funcao-linha'+(card.querySelectorAll('.funcao-linha').length>=2?' funcao-secundaria':'');
      const lbl=document.createElement('span');lbl.innerHTML=icone(R.FUNCOES[f].icone);lbl.appendChild(document.createTextNode(R.FUNCOES[f].curto||R.FUNCOES[f].nome));
      const nomes=document.createElement('div');nomes.className='nomes';
      const ids=(r.pessoas?.[f]||[]);
      for(let i=0;i<vagas;i++){
        const id=ids[i];const chip=document.createElement('span');
        if(!id){chip.className='nome vago';chip.textContent='vago';}
        else{
          const p=pessoas.find(x=>x.id===id);
          const avisos=p?R.conflitos({reuniao:r,pessoa:p,funcao:f,reunioes,oradores}):[];
          chip.className='nome'+(avisos.length?' alerta':'');chip.textContent=nomePessoa(id);
          if(avisos.length){chip.title=avisos.join('\n');chip.insertAdjacentHTML('beforeend',icone('triangle-alert'));}
        }
        nomes.appendChild(chip);
      }
      linha.append(lbl,nomes);card.appendChild(linha);
    });
    if(card.querySelectorAll('.funcao-linha').length>2){const b=document.createElement('button');b.type='button';b.className='mobile-funcoes dz-btn';b.textContent='Ver todas as fun??es';b.setAttribute('aria-expanded','false');b.onclick=()=>{const aberto=card.classList.toggle('expandida');b.setAttribute('aria-expanded',String(aberto));b.textContent=aberto?'Recolher fun??es':'Ver todas as fun??es';};card.appendChild(b);}
    div.appendChild(card);
  });
  if(!lista.length&&cfg.diaMeio!=null)div.innerHTML='<div class="vazio" style="grid-column:1/-1">Nenhuma reunião neste mês.</div>';
  DesignaUI.desenharIcones();
}

function abrirReuniao(data){
  const base=reunioesDoMesAtual().find(r=>r.data===data)||reuniaoSalva(data);if(!base)return;
  edicao=JSON.parse(JSON.stringify({pessoas:{},...base}));
  $('rTitulo').textContent=tituloReuniao(edicao);
  $('rSub').textContent=R.TIPOS[edicao.tipo];
  $('rSem').checked=!!edicao.semReuniao;$('rMotivo').value=edicao.motivo||'';
  mostrarNotaEvento();
  renderEdicao();abrirJanela('janReuniao');
}
function alternarSemReuniao(){edicao.semReuniao=$('rSem').checked;renderEdicao();}

function renderEdicao(){
  $('rMotivoBox').hidden=!edicao.semReuniao;
  const div=$('rFuncoes');div.innerHTML='';
  if(edicao.semReuniao)return;
  const qtd=R.quantidades(cfg);
  // Histórico com a edição atual no lugar da versão salva.
  const historico=[...reunioes.filter(r=>r.data!==edicao.data),edicao];
  R.FUNCOES_POR_TIPO[edicao.tipo].forEach(f=>{
    const vagas=qtd[edicao.tipo][f];if(!vagas)return;
    const atual=(edicao.pessoas[f]||[]).slice(0,vagas);while(atual.length<vagas)atual.push(null);edicao.pessoas[f]=atual;
    const bloco=document.createElement('div');bloco.className='ed-funcao';
    const h=document.createElement('h4');h.innerHTML=icone(R.FUNCOES[f].icone);h.appendChild(document.createTextNode(R.FUNCOES[f].nome+(vagas>1?' ('+vagas+' pessoas)':'')));
    bloco.appendChild(h);
    const grade=document.createElement('div');grade.className='ed-vagas';
    const cands=R.candidatos({reuniao:edicao,funcao:f,pessoas,reunioes:historico,oradores});
    for(let i=0;i<vagas;i++){
      const sel=document.createElement('select');
      sel.add(new Option('— Vago —',''));
      cands.forEach(c=>{
        const outroSlot=atual.some((id,j)=>j!==i&&id===c.pessoa.id);if(outroSlot)return;
        // Sempre diz de qual função é o tempo (ex.: "Microfones: nunca fez"), para não confundir com outra função.
        const txt=c.pessoa.nome+' · '+(R.FUNCOES[f].curto||R.FUNCOES[f].nome)+': '+R.tempoSem(c.ultima,edicao.data)+(c.avisos.length?' ⚠':'');
        sel.add(new Option(txt,c.pessoa.id));
      });
      // Pessoa já designada que não pode mais fazer a função continua visível.
      if(atual[i]&&!cands.some(c=>c.pessoa.id===atual[i]))sel.add(new Option(nomePessoa(atual[i])+' (não marcada para esta função)',atual[i]));
      sel.value=atual[i]||'';
      sel.onchange=()=>{edicao.pessoas[f][i]=sel.value||null;renderEdicao();};
      if(vagas>1){
        // Nome da vaga (Auditório, Entrada, Microfone 1…), como no quadro de anúncios.
        const caixa=document.createElement('label');caixa.style.cssText='display:flex;flex-direction:column;gap:3px;font:600 10px Inter,sans-serif;color:var(--whi3);text-transform:uppercase;letter-spacing:.04em';
        caixa.appendChild(document.createTextNode(R.rotuloVaga(f,i,vagas)));caixa.appendChild(sel);grade.appendChild(caixa);
      }else grade.appendChild(sel);
    }
    bloco.appendChild(grade);
    atual.filter(Boolean).forEach(id=>{
      const p=pessoas.find(x=>x.id===id);if(!p)return;
      R.conflitos({reuniao:edicao,pessoa:p,funcao:f,reunioes:historico,oradores}).forEach(a=>{
        const av=document.createElement('div');av.className='aviso';av.innerHTML=icone('triangle-alert');
        const t=document.createElement('span');t.textContent=p.nome+': '+a;av.appendChild(t);bloco.appendChild(av);
      });
    });
    if(!cands.length){const v=document.createElement('div');v.className='hint';v.style.margin='6px 0 0';v.textContent='Ninguém marcado para esta função. Marque em Início → Configurações → Funções.';bloco.appendChild(v);}
    div.appendChild(bloco);
  });
  DesignaUI.desenharIcones();
}
function sugerirReuniao(){
  if(edicao.semReuniao)return;
  const outras=reunioes.filter(r=>r.data!==edicao.data);
  [edicao]=R.sugerir({reunioesAlvo:[edicao],todas:outras,pessoas,cfg,oradores});
  renderEdicao();toast('Vagas vazias preenchidas. Confira e salve.');
}
function limparReuniao(){R.FUNCOES_POR_TIPO[edicao.tipo].forEach(f=>edicao.pessoas[f]=[]);renderEdicao();}
async function salvarReuniao(){
  const b=$('rSalvar');b.disabled=true;
  try{
    const dados={data:edicao.data,tipo:edicao.tipo,semReuniao:!!edicao.semReuniao,motivo:edicao.semReuniao?$('rMotivo').value.trim():'',pessoas:{}};
    // Mantém a ligação com o evento da congregação (para voltar como era se o evento for apagado).
    if(edicao.eventoId){dados.eventoId=edicao.eventoId;dados.eventoAntes=edicao.eventoAntes||{semReuniao:false,motivo:''};}
    R.FUNCOES_POR_TIPO[edicao.tipo].forEach(f=>dados.pessoas[f]=(edicao.pessoas[f]||[]).filter(Boolean));
    await salvar('desig_reunioes',edicao.data,dados);
    reunioes=[...reunioes.filter(r=>r.data!==edicao.data),{...dados,id:edicao.data}];
    const copiouZoom=dados.semReuniao?false:await copiarZoomParaSemana(dados);
    fecharJanela('janReuniao');renderProgramacao();
    toast(copiouZoom?'✓ Reunião salva. O Zoom da outra reunião da semana também foi atualizado.':'✓ Reunião salva.',copiouZoom?5000:3500);return true;
  }catch(e){if(e.message!=='Somente leitura')toast('Não foi possível salvar: '+e.message,6000);}
  finally{b.disabled=false;}
}

// Zoom semanal: leva quem está no Zoom para a outra reunião da mesma semana.
async function copiarZoomParaSemana(r){
  if(!R.zoomSemanal(cfg))return false;
  const q=R.quantidades(cfg),outro=r.tipo==='meio'?'fim':'meio';
  if(!q[r.tipo].zoom||!q[outro].zoom)return false;
  const dataPar=R.parSemanal(r.data,r.tipo,cfgRegras());if(!dataPar)return false;
  const par=reuniaoSalva(dataPar)||{data:dataPar,tipo:outro,pessoas:{}};
  if(par.semReuniao)return false;
  const zoom=(r.pessoas.zoom||[]).slice(0,q[outro].zoom);
  if(JSON.stringify(zoom)===JSON.stringify(R.pessoasDe(par,'zoom')))return false;
  const dados={data:par.data,tipo:par.tipo,semReuniao:false,motivo:'',pessoas:{...(par.pessoas||{}),zoom}};
  await salvar('desig_reunioes',par.data,dados);
  reunioes=[...reunioes.filter(x=>x.data!==par.data),{...dados,id:par.data}];
  return true;
}

async function sugerirMes(){
  const alvo=reunioesDoMesAtual().filter(r=>r.data>=hojeISO()&&!r.semReuniao);
  if(!alvo.length)return toast('Não há reuniões futuras neste mês.');
  if(!confirm('Preencher as vagas vazias das '+alvo.length+' reuniões futuras deste mês? Quem já está designado continua.'))return;
  try{
    const outras=reunioes.filter(r=>!alvo.some(a=>a.data===r.data));
    const sugeridas=R.sugerir({reunioesAlvo:alvo,todas:outras,pessoas,cfg,oradores});
    for(const r of sugeridas){
      const dados={data:r.data,tipo:r.tipo,semReuniao:false,motivo:'',pessoas:{}};
      R.FUNCOES_POR_TIPO[r.tipo].forEach(f=>dados.pessoas[f]=(r.pessoas[f]||[]).filter(Boolean));
      await salvar('desig_reunioes',r.data,dados);
      reunioes=[...reunioes.filter(x=>x.data!==r.data),{...dados,id:r.data}];
    }
    renderProgramacao();toast('✓ Vagas preenchidas. Confira os avisos, se houver.');
  }catch(e){if(e.message!=='Somente leitura')toast('Não foi possível salvar: '+e.message,6000);}
}

// Linhas prontas (função → nomes) para PDF e WhatsApp.
function linhasDe(r){
  const qtd=R.quantidades(cfg);
  return R.FUNCOES_POR_TIPO[r.tipo].filter(f=>qtd[r.tipo][f]>0).map(f=>({funcao:R.FUNCOES[f].nome,nomes:R.pessoasDe(r,f).map(nomePessoa)}));
}
function compartilharMes(){
  const lista=reunioesDoMesAtual();
  if(!lista.length)return toast('Nenhuma reunião neste mês.');
  const linhas=['*Designações — '+mes.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})+'*'];
  if(vinc.nome)linhas.push(vinc.nome);
  lista.forEach(r=>{
    const dt=new Date(r.data+'T12:00:00');
    linhas.push('','*'+dt.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'})+'* · '+R.TIPOS[r.tipo]);
    if(r.semReuniao){linhas.push(r.motivo||'Não haverá reunião');return;}
    linhasDe(r).forEach(l=>linhas.push(l.funcao+': '+(l.nomes.join(', ')||'a definir')));
  });
  window.open('https://wa.me/?text='+encodeURIComponent(linhas.join('\n')),'_blank','noopener');
}
// ── Quadro de anúncios (PDF): a pessoa escolhe o modelo; a escolha fica salva neste aparelho ──
let modeloPdf='tabelas';
try{modeloPdf=localStorage.getItem('desig_pdf_modelo')||'tabelas';}catch(e){}
function escolherModeloPdf(m){
  modeloPdf=m;try{localStorage.setItem('desig_pdf_modelo',m);}catch(e){}
  document.querySelectorAll('#pdfModelos .escolha').forEach(b=>b.classList.toggle('on',b.dataset.modelo===m));
}
function abrirPdf(){$('pdfMes').value=mes.getFullYear()+'-'+String(mes.getMonth()+1).padStart(2,'0');escolherModeloPdf(modeloPdf);abrirJanela('janPdf');}

// Dados de um mês no formato do modelo "Tabelas" (igual ao Word).
function dadosTabelas(ano,m){
  return QuadroDados.montarMes({data:new Date(ano,m-1,1),regras:R,cfg,cfgOradores,reunioes,pessoas,programa:oradores.programa,temas:typeof TEMAS==='undefined'?{}:TEMAS,incluirDiscursos:Conta.podeVer(vinc,'oradores')});
}

async function baixarPdf(enviar=false){
  const b=$(enviar?'pdfShare':'pdfBtn');b.disabled=true;
  try{
    const[ano,m]=$('pdfMes').value.split('-').map(Number);const qtd=Number($('pdfQtd').value);
    if(!ano||!m)throw new Error('Escolha o mês inicial.');
    const datas=Array.from({length:qtd},(_,i)=>new Date(ano,m-1+i,1));
    const JsPDF=await PdfDesignacoes.carregarJsPDF();
    let pdf;
    if(modeloPdf==='cartoes'){
      const meses=datas.map(d=>({data:d,reunioes:R.reunioesDoMes(d.getFullYear(),d.getMonth()+1,cfgRegras(),reunioes).map(r=>({...r,linhas:linhasDe(r)}))}));
      pdf=PdfDesignacoes.criarPdfDesignacoes(JsPDF,meses,vinc.nome);
    }else{
      const meses=datas.map(d=>dadosTabelas(d.getFullYear(),d.getMonth()+1));
      pdf=PdfDesignacoes.criarPdfTabelas(JsPDF,meses,{congregacao:vinc.nome,endereco:cfgOradores?.end||''});
    }
    const nomeArq='designacoes-'+$('pdfMes').value+'-'+qtd+'-meses.pdf';
    if(enviar){const r=await DesignaUI.compartilharArquivo(pdf.output('blob'),nomeArq,'Designações — '+vinc.nome);if(r!=='cancelado')fecharJanela('janPdf');return;}
    pdf.save(nomeArq);
    fecharJanela('janPdf');toast('PDF do quadro de anúncios gerado!');
  }catch(e){toast(e.message||'Não foi possível gerar o PDF.',6000);}
  finally{b.disabled=false;}
}

// ── Configurações ──
function renderConfig(){
  const sel=$('cfgDiaMeio');sel.innerHTML='';
  sel.add(new Option('Escolha…',''));
  [1,2,3,4,5].forEach(d=>sel.add(new Option(R.DIAS[d],String(d))));
  sel.value=cfg.diaMeio==null?'':String(cfg.diaMeio);
  $('cfgDiaFim').value=String(cfg.diaFim===0?0:6);
  const doOradores=cfgOradores&&(cfgOradores.dia===0||cfgOradores.dia===6);
  $('lblDiaFim').hidden=!!doOradores;
  $('avisoDiaFim').hidden=!doOradores;
  if(doOradores)$('avisoDiaFim').textContent='Fim de semana: '+R.DIAS[cfgOradores.dia]+(R.mostrarPergunta2027()&&(cfgOradores.dia2027===0||cfgOradores.dia2027===6)?' (em 2027: '+R.DIAS[cfgOradores.dia2027]+')':'')+' — definido nas configurações do Oradores.';
  const qtd=R.quantidades(cfg);const tb=$('tabelaQtd');tb.innerHTML='';
  Object.keys(R.FUNCOES).forEach(f=>{
    const tr=document.createElement('tr');
    const emUso=(qtd.meio[f]||0)>0||(qtd.fim[f]||0)>0;
    const tdUsar=document.createElement('td');const usar=document.createElement('input');usar.type='checkbox';usar.checked=emUso;usar.disabled=!pode;usar.style.width='18px';usar.style.height='18px';
    tdUsar.appendChild(usar);tr.appendChild(tdUsar);
    const td=document.createElement('td');td.textContent=R.FUNCOES[f].nome;tr.appendChild(td);
    const campos=[];
    ['meio','fim'].forEach(t=>{
      const c=document.createElement('td');
      if(R.FUNCOES_POR_TIPO[t].includes(f)){const i=document.createElement('input');i.type='number';i.min=0;i.max=6;i.value=qtd[t][f];i.dataset.t=t;i.dataset.f=f;i.disabled=!pode||!emUso;c.appendChild(i);campos.push(i);}
      else{c.textContent='—';c.style.color='var(--whi3)';}
      tr.appendChild(c);
    });
    // Desligar zera a função nas duas reuniões; religar volta para a quantidade padrão.
    usar.onchange=()=>campos.forEach(i=>{i.disabled=!usar.checked;i.value=usar.checked?(R.QTD_PADRAO[i.dataset.t][f]||1):0;});
    tr.style.opacity=emUso?'':'.6';usar.addEventListener('change',()=>tr.style.opacity=usar.checked?'':'.6');
    tb.appendChild(tr);
  });
  sel.disabled=!pode;$('cfgDiaFim').disabled=!pode;
  $('cfgZoomSemanal').checked=R.zoomSemanal(cfg);$('cfgZoomSemanal').disabled=!pode;
}
let salvandoConfig=false;
async function salvarConfig(){
  if(salvandoConfig)return;
  const botao=$('salvarConfigBtn'),status=$('salvarConfigStatus'),rotulo=botao.innerHTML;
  salvandoConfig=true;botao.disabled=true;botao.textContent='Salvando…';status.textContent='Salvando configurações…';
  try{
    const quantidades={meio:{},fim:{}};
    // Os checkboxes "Usar" não têm data-t/data-f: somente os números são persistidos.
    $('tabelaQtd').querySelectorAll('input[type="number"][data-t][data-f]').forEach(i=>{
      const valor=i.value===''?0:Number(i.value);
      if(!Number.isInteger(valor)||valor<0||valor>6)throw new Error('Informe quantidades inteiras entre 0 e 6.');
      quantidades[i.dataset.t][i.dataset.f]=valor;
    });
    const diaMeio=$('cfgDiaMeio').value===''?null:Number($('cfgDiaMeio').value);
    const novo={...cfg,diaMeio,diaFim:Number($('cfgDiaFim').value),quantidades,zoomSemanal:$('cfgZoomSemanal').checked};delete novo.id;
    await salvar('desig_config','app',novo);cfg=novo;renderConfig();
    status.textContent='Configurações salvas. As quantidades serão usadas na programação e nos PDFs.';
    toast('✓ Configurações salvas.');
  }catch(e){
    status.textContent=e.message==='Somente leitura'?'Você não tem permissão para alterar as configurações.':'Não foi possível salvar. '+e.message;
    toast(status.textContent,6000);
  }finally{salvandoConfig=false;botao.disabled=!pode;botao.innerHTML=rotulo;}
}
async function escolherDiaMeio(dia){
  try{const novo={...cfg,diaMeio:dia};delete novo.id;await salvar('desig_config','app',novo);cfg=novo;fecharJanela('janDia');renderProgramacao();toast('✓ Reunião do meio de semana: '+R.DIAS[dia]+'.');}
  catch(e){if(e.message!=='Somente leitura')toast('Não foi possível salvar: '+e.message,6000);}
}

// ── Reunião marcada por um evento da congregação ──
function mostrarNotaEvento(){
  document.querySelectorAll('#janReuniao .evento-nota').forEach(n=>n.remove());
  if(!edicao?.eventoId)return;
  const nota=document.createElement('div');nota.className='evento-nota';
  nota.innerHTML=icone('calendar-range')+'<span></span>';
  nota.querySelector('span').textContent='Marcada pelo evento "'+(edicao.motivo||'evento')+'". Para mudar as datas, edite o evento em Início → Eventos.';
  $('rSub').after(nota);DesignaUI.desenharIcones();
}

// ── Saídas de campo ──
const nomeLocal=id=>R.locaisCampo(cfg).find(l=>l.id===id)?.nome||(id?'(local removido)':'—');
const limiteCampoISO=()=>R.limiteCampo(hojeISO());
const mesLimiteCampo=()=>{const l=limiteCampoISO();return new Date(Number(l.slice(0,4)),Number(l.slice(5,7))-1,1);};
const campoDoMesAtual=()=>R.campoDoMes(mesCampo.getFullYear(),mesCampo.getMonth()+1,cfg,campo);
function mudarMesCampo(n){
  const novo=new Date(mesCampo.getFullYear(),mesCampo.getMonth()+n,1);
  if(novo>mesLimiteCampo())return toast('Dá para designar as saídas de campo até '+R.MESES_CAMPO+' meses para frente.');
  mesCampo=novo;renderCampo();
}
function irHojeCampo(){mesCampo=new Date();mesCampo.setDate(1);renderCampo();}
async function salvarDiaCampoQuadro(dia,ocultar){
  exigirEdicao();
  const atual=(await lista('desig_config')).find(c=>c.id==='campo_quadro')||{};
  const dias=new Set(CampoQuadro.ocultosValidos(atual.diasOcultos));
  if(ocultar)dias.add(dia);else dias.delete(dia);
  const proximo={...atual,diasOcultos:[...dias]};
  await salvar('desig_config','campo_quadro',proximo);campoQuadroPrefs=proximo;
}
async function adicionarSaidaCampoQuadro({dia,hora,localId,novoLocal}){
  exigirEdicao();
  if(!Number.isInteger(dia)||dia<0||dia>6||!R.horaValida(hora))throw new Error('Informe um dia e horário válidos.');
  const atual=(await lista('desig_config')).find(c=>c.id==='app')||{};
  const locais=[...(atual.campo?.locais||[])],saidas=[...(atual.campo?.saidas||[])];
  if(!localId){
    if(!String(novoLocal||'').trim())throw new Error('Informe o nome do novo local.');
    const existente=locais.find(l=>R.normalizar(l.nome)===R.normalizar(novoLocal));
    localId=existente?.id||novoId();
    if(!existente)locais.push({id:localId,nome:novoLocal.trim(),endereco:''});
  }else if(!locais.some(l=>l.id===localId))throw new Error('Este local foi removido. Atualize a página e escolha outro.');
  if(saidas.some(s=>Number(s.dia)===dia&&s.hora===hora&&s.localId===localId))throw new Error('Já existe uma saída neste dia, horário e local.');
  saidas.push({id:novoId(),dia,hora,localId});
  const proximo={...atual,campo:{...atual.campo,locais,saidas}};
  await salvar('desig_config','app',proximo);cfg=proximo;
}
function renderCampo(){
  $('campoMesTitulo').textContent=maiuscula(mesCampo.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}));
  $('campoProx').disabled=new Date(mesCampo.getFullYear(),mesCampo.getMonth()+1,1)>mesLimiteCampo();
  const lista=campoDoMesAtual();
  CampoQuadro.render($('listaCampo'),{lista,ocultos:campoQuadroPrefs.diasOcultos,pode,hoje:hojeISO(),locais:R.locaisCampo(cfg),
    abrir:abrirCampo,nome:nomePessoa,local:nomeLocal,toast,render:renderCampo,salvarDia:salvarDiaCampoQuadro,adicionar:adicionarSaidaCampoQuadro,
    conflitos:c=>R.conflitosCampo({item:c,pessoaId:c.dirigente,campo:lista,reunioes})});
}

function abrirCampo(id){
  const c=campoDoMesAtual().find(x=>x.id===id);if(!c)return;
  if(!R.dentroDoLimiteCampo(c.data,hojeISO()))return toast('Dá para designar até '+R.MESES_CAMPO+' meses para frente.');
  edCampo={...c};
  const dt=new Date(c.data+'T12:00:00');
  $('cTitulo').textContent=maiuscula(dt.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}))+(c.hora?' · '+c.hora:'');
  $('cSub').textContent='Saída de campo · '+nomeLocal(c.localId);
  const loc=$('cLocal');loc.innerHTML='';
  R.locaisCampo(cfg).forEach(l=>loc.add(new Option(l.nome+(l.endereco?' — '+l.endereco:''),l.id)));
  if(c.localId&&![...loc.options].some(o=>o.value===c.localId))loc.add(new Option(nomeLocal(c.localId),c.localId));
  if(!loc.options.length)loc.add(new Option('Sem local cadastrado',''));
  loc.value=c.localId||loc.options[0].value;
  $('cSem').checked=!!c.semSaida;
  $('cGrupoOpcao').hidden=![0,6].includes(dt.getDay());$('cDeGrupo').checked=!!c.grupoId;
  const grupos=$('cGrupo');grupos.innerHTML='';grupos.add(new Option('Escolha o grupo',''));R.gruposCampo(cfg).forEach(g=>grupos.add(new Option(g.nome,g.id)));if(c.grupoId&&!R.gruposCampo(cfg).some(g=>g.id===c.grupoId))grupos.add(new Option((c.grupoNome||'Grupo')+' (removido)',c.grupoId));grupos.value=c.grupoId||'';
  const nomeMes=dt.toLocaleDateString('pt-BR',{month:'long'});
  $('cRecorrenteTxt').textContent='Gostaria de deixar essa designação recorrente pelo mês?';
  const plural=['todos os domingos','todas as segundas-feiras','todas as terças-feiras','todas as quartas-feiras','todas as quintas-feiras','todas as sextas-feiras','todos os sábados'][dt.getDay()];
  $('cRecorrenteHint').textContent='Coloca a mesma pessoa em '+plural+(c.hora?' às '+c.hora:'')+' de '+nomeMes+' (a partir de hoje), nesta mesma saída.';
  $('cRecorrente').checked=false;
  $('cRecorrenteBox').hidden=!!c.removida;
  renderEdCampo();abrirJanela('janCampo');
}
function renderEdCampo(){
  const sem=$('cSem').checked;
  $('cDirigenteBox').hidden=sem;
  const sel=$('cDirigente');sel.innerHTML='';sel.add(new Option('— Vago —',''));
  const cands=R.candidatosCampo({item:edCampo,pessoas,campo:campoDoMesAtual().concat(campo.filter(c=>!c.data.startsWith(edCampo.data.slice(0,7)))),reunioes});
  cands.forEach(c=>sel.add(new Option(c.pessoa.nome+' · dirigiu: '+R.tempoSem(c.ultima,edCampo.data)+(c.avisos.length?' ⚠':''),c.pessoa.id)));
  if(edCampo.dirigente&&!cands.some(c=>c.pessoa.id===edCampo.dirigente))sel.add(new Option(nomePessoa(edCampo.dirigente)+' (não marcado como dirigente)',edCampo.dirigente));
  sel.value=edCampo.dirigente||'';
  $('cGrupoBox').hidden=!$('cDeGrupo').checked;sel.disabled=$('cDeGrupo').checked;
  const av=$('cAvisos');av.innerHTML='';
  if(!sem&&edCampo.dirigente)R.conflitosCampo({item:edCampo,pessoaId:edCampo.dirigente,campo:campoDoMesAtual(),reunioes}).forEach(a=>{
    const d=document.createElement('div');d.className='aviso';d.innerHTML=icone('triangle-alert');const t=document.createElement('span');t.textContent=a;d.appendChild(t);av.appendChild(d);
  });
  if(!cands.length){const v=document.createElement('div');v.className='hint';v.style.margin='6px 0 0';v.textContent='Ninguém marcado como dirigente de campo. Marque em Início → Configurações → Funções, coluna "Dirigente".';av.appendChild(v);}
  DesignaUI.desenharIcones();
}
function alterarGrupoCampo(){
  try{edCampo=R.aplicarGrupoCampo(edCampo,$('cDeGrupo').checked?$('cGrupo').value:null,cfg,pessoas);}
  catch(e){if($('cGrupo').value)toast(e.message);edCampo.dirigente=null;}
  renderEdCampo();
}
function escolherDirigente(){edCampo.dirigente=$('cDirigente').value||null;renderEdCampo();}
const dadosCampo=c=>({grupoId:c.grupoId||null,grupoNome:c.grupoNome||'',data:c.data,saidaId:c.saidaId,hora:c.hora||'',localId:c.localId||'',dirigente:c.semSaida?null:(c.dirigente||null),semSaida:!!c.semSaida,recorrente:!!c.recorrente});
async function salvarCampo(){
  const b=$('cSalvar');b.disabled=true;
  try{
    exigirEdicao();
    const hoje=hojeISO();
    let base={...edCampo,localId:$('cLocal').value||'',semSaida:$('cSem').checked,dirigente:$('cSem').checked?null:($('cDirigente').value||null),recorrente:false};
    if(!base.semSaida){base=R.aplicarGrupoCampo(base,$('cDeGrupo').checked?$('cGrupo').value:null,cfg,pessoas);if($('cDeGrupo').checked&&!$('cGrupo').value)throw new Error('Escolha um grupo.');}
    let registros=[base];
    if($('cRecorrente').checked&&!base.semSaida){
      if(!base.dirigente)throw new Error('Escolha o dirigente antes de deixar recorrente.');
      const saida=R.saidasCampo(cfg).find(s=>s.id===base.saidaId);
      const ano=Number(base.data.slice(0,4)),m=Number(base.data.slice(5,7));
      const mesmo=R.recorrenciaCampo({saida:{...saida,hora:base.hora},ano,mes:m,dirigente:base.dirigente,aPartirDe:hoje<base.data?hoje:base.data,hoje,localId:base.localId});
      const atuais=new Map(campoDoMesAtual().map(c=>[c.id,c]));
      const outros=mesmo.filter(r=>r.id!==base.id&&atuais.get(r.id)?.dirigente&&atuais.get(r.id).dirigente!==base.dirigente);
      const semSaida=mesmo.filter(r=>atuais.get(r.id)?.semSaida);
      let substituir=true;
      if(outros.length)substituir=confirm(outros.length+' data(s) deste mês já têm outro dirigente ('+outros.map(r=>r.data.slice(8,10)+'/'+r.data.slice(5,7)).join(', ')+').\n\nOK = trocar por '+nomePessoa(base.dirigente)+'\nCancelar = manter quem já está e preencher só as datas vagas');
      registros=mesmo.filter(r=>r.id===base.id||(!semSaida.includes(r)&&(substituir||!outros.includes(r))))
        .map(r=>({...r,...(r.id===base.id?base:{}),grupoId:base.grupoId,grupoNome:base.grupoNome,recorrente:true}));
    }
    for(const r of registros){
      if(!R.dentroDoLimiteCampo(r.data,hoje))continue;
      const dados=dadosCampo(r);
      await salvar('desig_campo',r.id,dados);
      campo=[...campo.filter(c=>R.idCampo(c.data,c.saidaId)!==r.id),{...dados,id:r.id}];
    }
    fecharJanela('janCampo');renderCampo();
    toast(registros.length>1?'✓ '+nomePessoa(base.dirigente)+' designado em '+registros.length+' saídas deste mês.':'✓ Saída salva.',4500);
  }catch(e){if(e.message!=='Somente leitura')toast(e.message.startsWith('Escolha')?e.message:'Não foi possível salvar: '+e.message,6000);}
  finally{b.disabled=false;}
}
function compartilharCampo(){
  const lista=campoDoMesAtual();
  if(!lista.length)return toast('Nenhuma saída neste mês.');
  const linhas=['*Saídas de campo — '+mesCampo.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})+'*'];
  if(vinc.nome)linhas.push(vinc.nome);
  let dataAnterior='';
  lista.forEach(c=>{
    if(c.data!==dataAnterior){const dt=new Date(c.data+'T12:00:00');linhas.push('','*'+dt.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'})+'*');dataAnterior=c.data;}
    linhas.push((c.hora||'')+' · '+nomeLocal(c.localId)+(c.grupoId?' · Campo de grupo: '+c.grupoNome:'')+' — '+(c.semSaida?'sem saída':c.dirigente?nomePessoa(c.dirigente):'a definir'));
  });
  window.open('https://wa.me/?text='+encodeURIComponent(linhas.join('\n')),'_blank','noopener');
}

// ── Lembretes no WhatsApp (cada designado recebe as suas designações) ──
const enviadosLembrete=new Set();
function rotuloParaPessoa(f,i,vagas){
  if(vagas<=1)return R.FUNCOES[f].nome;
  const r=R.rotuloVaga(f,i,vagas);
  return f==='indicadores'?'Indicador ('+r+')':r;
}
function lembretesDoMes(){
  const hoje=hojeISO(),q=R.quantidades(cfg),porPessoa=new Map();
  reunioesDoMesAtual().filter(r=>!r.semReuniao&&r.data>=hoje).forEach(r=>{
    R.FUNCOES_POR_TIPO[r.tipo].forEach(f=>{
      const vagas=q[r.tipo][f];if(!vagas)return;
      (r.pessoas?.[f]||[]).slice(0,vagas).forEach((id,i)=>{
        if(!id)return;
        if(!porPessoa.has(id))porPessoa.set(id,[]);
        porPessoa.get(id).push({data:r.data,tipo:r.tipo,funcao:rotuloParaPessoa(f,i,vagas)});
      });
    });
  });
  return [...porPessoa.entries()].map(([id,itens])=>({pessoa:pessoas.find(p=>p.id===id)||{id,nome:nomePessoa(id)},itens:itens.sort((a,b)=>a.data.localeCompare(b.data))}))
    .sort((a,b)=>a.pessoa.nome.localeCompare(b.pessoa.nome,'pt-BR'));
}
function textoLembrete(pessoa,itens){
  const mesNome=mes.toLocaleDateString('pt-BR',{month:'long'});
  const linhas=['Olá, '+String(pessoa.nome||'').split(' ')[0]+'!','','*Suas designações em '+mesNome+'*'+(vinc.nome?' — '+vinc.nome:''),''];
  itens.forEach(it=>{
    const dt=new Date(it.data+'T12:00:00');
    linhas.push('• '+maiuscula(dt.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''))+', '+it.data.slice(8,10)+'/'+it.data.slice(5,7)+' ('+(it.tipo==='fim'?'fim de semana':'meio de semana')+') — '+it.funcao);
  });
  linhas.push('','Se não puder em alguma data, avise com antecedência. Obrigado!');
  return linhas.join('\n');
}
function abrirLembretes(){
  const lista=lembretesDoMes();
  if(!lista.length)return toast('Nenhuma designação daqui para frente neste mês.');
  $('lemSub').textContent=maiuscula(mes.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}))+' · '+lista.length+' pessoa(s) designada(s). Toque em Enviar para abrir o WhatsApp com a mensagem pronta.';
  const div=$('lemLista');div.innerHTML='';
  lista.forEach(({pessoa,itens})=>{
    const row=document.createElement('div');row.className='lem';
    const tx=document.createElement('div');tx.className='tx';
    const st=document.createElement('strong');st.textContent=pessoa.nome;
    const sp=document.createElement('span');sp.textContent=itens.length+' designação(ões)'+(pessoa.telefone?' · '+pessoa.telefone:' · sem telefone (você escolhe o contato)');
    tx.append(st,sp);
    const b=document.createElement('a');b.className='dz-btn'+(enviadosLembrete.has(pessoa.id)?' ok':'');b.target='_blank';b.rel='noopener';
    const tel=Congregacao.telefoneWa(pessoa.telefone);
    b.href='https://wa.me/'+tel+'?text='+encodeURIComponent(textoLembrete(pessoa,itens));
    b.innerHTML=icone('send')+'<span>'+(enviadosLembrete.has(pessoa.id)?'Enviado ✓':'Enviar')+'</span>';
    b.onclick=()=>{enviadosLembrete.add(pessoa.id);setTimeout(()=>{b.classList.add('ok');b.querySelector('span').textContent='Enviado ✓';},300);};
    row.append(tx,b);div.appendChild(row);
  });
  abrirJanela('janLembretes');
}

// ── Histórico: quem alterou o quê ──
function quandoFoi(iso){
  const d=new Date(iso),agora=new Date(),min=Math.round((agora-d)/6e4);
  const hora=d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  if(min<1)return 'agora';
  if(min<60)return 'há '+min+' min';
  const ontem=new Date(agora);ontem.setDate(agora.getDate()-1);
  if(d.toDateString()===agora.toDateString())return 'hoje às '+hora;
  if(d.toDateString()===ontem.toDateString())return 'ontem às '+hora;
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' às '+hora;
}
function descreverAlteracao(a){
  const antes=a.old_data||{},depois=a.new_data||{};
  const nomes=ids=>(ids||[]).filter(Boolean).map(nomePessoa).join(', ')||'—';
  if(a.collection==='desig_reunioes'){
    const data=a.record_id;const dt=new Date(data+'T12:00:00');
    const titulo='reunião de '+dt.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','')+', '+data.slice(8,10)+'/'+data.slice(5,7);
    if(a.action==='DELETE')return{titulo:'Apagou a '+titulo,detalhes:[]};
    const det=[];
    if(!!depois.semReuniao!==!!antes.semReuniao)det.push(depois.semReuniao?'Marcou "sem reunião"'+(depois.motivo?' ('+depois.motivo+')':''):'Desmarcou "sem reunião"');
    Object.keys(R.FUNCOES).forEach(f=>{
      const x=(antes.pessoas?.[f]||[]).filter(Boolean),y=(depois.pessoas?.[f]||[]).filter(Boolean);
      if(JSON.stringify(x)!==JSON.stringify(y))det.push(R.FUNCOES[f].nome+': '+nomes(x)+' → '+nomes(y));
    });
    if(!det.length)return null;
    return{titulo:(a.action==='INSERT'?'Designou a ':'Alterou a ')+titulo,detalhes:det};
  }
  if(a.collection==='desig_pessoas'){
    const nome=nomePessoa(a.record_id);
    if(a.action==='DELETE')return{titulo:'Tirou '+nome+' das Designações',detalhes:[]};
    const x=antes.funcoes||{},y=depois.funcoes||{};
    const det=[...Object.keys(R.FUNCOES),CAMPO].filter(f=>!!x[f]!==!!y[f]).map(f=>(y[f]?'Liberou ':'Tirou ')+infoFuncao(f).nome);
    if(typeof Vmc!=='undefined'){Object.keys(Vmc.FUNCOES_VMC).filter(f=>!!x[f]!==!!y[f]).forEach(f=>det.push((y[f]?'Liberou ':'Tirou ')+Vmc.FUNCOES_VMC[f].nome));if((x.estudante!==false)!==(y.estudante!==false))det.push(y.estudante===false?'Tirou das partes de estudante':'Voltou às partes de estudante');}
    return det.length?{titulo:'Funções de '+nome,detalhes:det}:null;
  }
  if(a.collection==='cong_pessoas'){
    const nome=depois.nome||antes.nome||'pessoa';
    return{titulo:a.action==='INSERT'?'Cadastrou '+nome:a.action==='DELETE'?'Excluiu '+nome+' da lista':'Atualizou o cadastro de '+nome,detalhes:[]};
  }
  if(a.collection==='desig_campo'){
    const c=a.action==='DELETE'?antes:depois,data=c.data||String(a.record_id).slice(0,10);
    const titulo='saída de campo de '+data.slice(8,10)+'/'+data.slice(5,7)+(c.hora?' às '+c.hora:'');
    if(a.action==='DELETE')return{titulo:'Apagou a '+titulo,detalhes:[]};
    const det=[];
    if((antes.dirigente||null)!==(depois.dirigente||null))det.push('Dirigente: '+(antes.dirigente?nomePessoa(antes.dirigente):'—')+' → '+(depois.dirigente?nomePessoa(depois.dirigente):'—'));
    if(!!antes.semSaida!==!!depois.semSaida)det.push(depois.semSaida?'Marcou "sem saída"':'Desmarcou "sem saída"');
    if((antes.localId||'')!==(depois.localId||''))det.push('Local: '+nomeLocal(antes.localId)+' → '+nomeLocal(depois.localId));
    if(!det.length)return null;
    return{titulo:'Alterou a '+titulo+(depois.recorrente?' (recorrente no mês)':''),detalhes:det};
  }
  if(a.collection==='desig_vmc'&&typeof descreverAlteracaoVmc==='function')return descreverAlteracaoVmc(a);
  if(a.collection==='desig_config')return{titulo:'Alterou as configurações das Designações',detalhes:[]};
  return null;
}
async function renderHistorico(){
  const div=$('listaHistorico');div.innerHTML='<div class="vazio">Carregando…</div>';
  try{
    const[{data,error},membros]=await Promise.all([
      sb.from('app_record_audit').select('record_id,collection,action,old_data,new_data,changed_by,changed_at').eq('workspace_id',vinc.workspaceId)
        .in('collection',['desig_reunioes','desig_pessoas','desig_config','cong_pessoas','desig_campo','desig_vmc']).order('changed_at',{ascending:false}).limit(80),
      sb.rpc('list_workspace_access',{target_workspace:vinc.workspaceId})
    ]);
    if(error)throw error;
    const quem=new Map((membros.data||[]).map(m=>[m.user_id,m.email||'']));
    div.innerHTML='';
    const itens=(data||[]).map(a=>({a,d:descreverAlteracao(a)})).filter(x=>x.d);
    if(!itens.length){div.innerHTML='<div class="vazio">Nenhuma alteração registrada ainda.</div>';return;}
    itens.forEach(({a,d})=>{
      const email=quem.get(a.changed_by)||'',nome=email?email.split('@')[0]:'Alguém da equipe';
      const row=document.createElement('div');row.className='hist';
      const av=document.createElement('span');av.className='av';av.textContent=nome.charAt(0).toUpperCase();
      const tx=document.createElement('div');tx.className='tx';
      const t=document.createElement('div');const b=document.createElement('strong');b.textContent=nome;t.append(b,document.createTextNode(' · '+d.titulo));tx.appendChild(t);
      if(d.detalhes.length){const ul=document.createElement('ul');d.detalhes.forEach(x=>{const li=document.createElement('li');li.textContent=x;ul.appendChild(li);});tx.appendChild(ul);}
      const s=document.createElement('small');s.textContent=quandoFoi(a.changed_at)+(email?' · '+email:'');tx.appendChild(s);
      row.append(av,tx);div.appendChild(row);
    });
  }catch(e){div.innerHTML='';const v=document.createElement('div');v.className='vazio';v.textContent='Não foi possível carregar o histórico: '+e.message;div.appendChild(v);}
}

// ── Apagar designações (para recomeçar) ──
// Tira só as pessoas designadas: reuniões, semanas da apostila, eventos e configurações continuam.
let origemApagar='programacao';
async function salvarVarios(colecao,itens){
  exigirEdicao();
  for(let i=0;i<itens.length;i+=200){
    const lote=itens.slice(i,i+200).map(({id,dados})=>{const{id:_,...limpo}=dados;return {id:String(id),workspace_id:vinc.workspaceId,collection:colecao,data:limpo,owner_id:user.id};});
    const{error}=await sb.from('app_records').upsert(lote,{onConflict:'workspace_id,collection,id'});if(error)throw error;
  }
}
function alvosApagar(){
  const per=$('apPeriodo').value,hoje=hojeISO(),m=origemApagar==='vmc'?mesVmc:mes;
  const prefixo=m.getFullYear()+'-'+String(m.getMonth()+1).padStart(2,'0');
  const dentro=d=>!!d&&(per==='tudo'||(per==='futuro'&&d>=hoje)||(per==='mes'&&d.startsWith(prefixo)));
  return {
    prog:$('apProg').checked?reunioes.filter(r=>dentro(r.data)&&Object.values(r.pessoas||{}).some(ids=>(ids||[]).some(Boolean))):[],
    vmc:$('apVmc').checked?(semanasVmc||[]).filter(s=>dentro(s.data)&&Object.values(s.pessoas||{}).some(Boolean)):[],
    campo:$('apCampo').checked?campo.filter(c=>dentro(c.data)&&(c.dirigente||c.grupoId)):[]
  };
}
function resumoApagar(){
  const a=alvosApagar(),total=a.prog.length+a.vmc.length+a.campo.length;
  $('apResumo').textContent=total?'Vai limpar: '+[a.prog.length&&a.prog.length+' reunião(ões) da Programação',a.vmc.length&&a.vmc.length+' semana(s) da Vida e Ministério',a.campo.length&&a.campo.length+' saída(s) de campo'].filter(Boolean).join(', ')+'.':'Nada para apagar com essas opções.';
  $('apAvisoHist').hidden=$('apPeriodo').value!=='tudo';
  $('apBtn').disabled=!total||$('apConfirma').value.trim().toUpperCase()!=='APAGAR';
}
async function abrirApagar(origem='programacao'){
  try{exigirEdicao();}catch(e){return;}
  origemApagar=origem;
  if(!semanasVmc){try{await carregarVmc();}catch(e){}}
  $('apConfirma').value='';$('apPeriodo').value='futuro';$('apProg').checked=true;$('apVmc').checked=true;$('apCampo').checked=false;
  const m=origem==='vmc'?mesVmc:mes;$('apMesOpcao').textContent='Só '+m.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  resumoApagar();abrirJanela('janApagar');
}
async function apagarDesignacoes(){
  const a=alvosApagar(),b=$('apBtn');if($('apConfirma').value.trim().toUpperCase()!=='APAGAR')return;
  b.disabled=true;b.textContent='Apagando…';
  try{
    if(a.prog.length){
      const itens=a.prog.map(r=>({id:r.data,dados:{...r,pessoas:{}}}));await salvarVarios('desig_reunioes',itens);
      const ids=new Set(itens.map(i=>i.id));reunioes=reunioes.map(r=>ids.has(r.data)?{...r,pessoas:{}}:r);
    }
    if(a.vmc.length){
      const itens=a.vmc.map(s=>({id:s.semana,dados:dadosVmc({...s,pessoas:{}})}));await salvarVarios('desig_vmc',itens);
      const ids=new Set(itens.map(i=>i.id));semanasVmc=semanasVmc.map(s=>ids.has(s.semana)?{...s,pessoas:{}}:s);
    }
    if(a.campo.length){
      const limpar=c=>({...dadosCampo(c),dirigente:null,grupoId:null,grupoNome:'',recorrente:false});
      const itens=a.campo.map(c=>({id:c.id,dados:limpar(c)}));await salvarVarios('desig_campo',itens);
      const ids=new Set(itens.map(i=>i.id));campo=campo.map(c=>ids.has(c.id)?{...c,...limpar(c)}:c);
    }
    fecharJanela('janApagar');irAba();
    toast('✓ Designações apagadas. Agora é só refazer.',4500);
  }catch(e){if(e.message!=='Somente leitura')toast('Não foi possível apagar tudo: '+e.message+'. Atualize a página e confira.',7000);}
  finally{b.textContent='Apagar';resumoApagar();}
}

// ── Início ──
async function iniciar(){
  document.querySelectorAll('.nomeApp').forEach(e=>e.textContent=APP_NOME);
  DesignaUI.aplicarTema();DesignaUI.registrarApp();
  try{
    user=await Conta.usuario();
    if(!user){location.replace('/?voltar=/designacoes');return;}
    vinc=await Conta.vinculo(user);
    if(!vinc||!Conta.podeVer(vinc,'designacoes')){location.replace('/');return;}
    sb=await Conta.supabase();
    pode=Conta.podeEditar(vinc,'designacoes');
    document.querySelectorAll('.nomeCong').forEach(e=>e.textContent=vinc.nome);
    DesignaUI.montarSeletor($('dzSwitch'),vinc,'designacoes');
    DesignaUI.montarConta($('dzConta'),user);
    DesignaUI.aplicarTema();
    if(!pode){
      document.body.classList.add('somente-leitura');
      const aviso=document.createElement('div');aviso.className='dz-readonly';
      aviso.innerHTML=icone('eye')+'<span>Você tem acesso <strong>só para ver</strong> as designações. Para editar, peça ao proprietário da congregação.</span>';
      $('principal').prepend(aviso);
    }
    await carregar();
        $('carregando').hidden=true;
    irAba();
    if(cfg.diaMeio==null&&pode)abrirJanela('janDia');
  }catch(e){$('carregando').textContent='Não foi possível carregar: '+e.message;}
}
window.addEventListener('load',iniciar);
