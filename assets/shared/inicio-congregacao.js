// Tela inicial do Designa: Pessoas da congregação (lista única) e Eventos (assembleia, congresso, visita…).
// Usa da página: $, toast, vinc, user.
const C=Congregacao;
let pessoasCong=null,eventosCong=null,pessoaCongEditando=null,eventoEditando=null,nomeEventoManual=false;
const podeCong=()=>Object.keys(Conta.MODULOS).some(m=>Conta.podeEditar(vinc,m));

async function sbCong(){return Conta.supabase();}
async function carregarPessoasCong(){
  if(!pessoasCong)pessoasCong=(await C.listar(await sbCong(),vinc.workspaceId,'cong_pessoas')).sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt-BR'));
  return pessoasCong;
}
async function carregarEventos(){
  if(!eventosCong)eventosCong=(await C.listar(await sbCong(),vinc.workspaceId,'cong_eventos')).sort((a,b)=>String(a.inicio).localeCompare(String(b.inicio)));
  return eventosCong;
}
const ddmm=d=>d?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'';

// ── Pessoas ──
async function renderPessoasCong(){
  const div=$('pcLista');
  try{await carregarPessoasCong();}catch(e){div.innerHTML='';const v=document.createElement('div');v.className='vazio';v.textContent='Não foi possível carregar: '+e.message+' (se o banco ainda não foi atualizado, rode o supabase.sql).';div.appendChild(v);return;}
  div.innerHTML='';
  const busca=C.normalizar($('pcBusca').value);
  const lista=pessoasCong.filter(p=>!busca||C.normalizar(p.nome).includes(busca));
  if(!pessoasCong.length){
    const v=document.createElement('div');v.className='vazio';
    v.textContent='Ninguém cadastrado ainda. Use "Juntar cadastros existentes" para trazer as pessoas que já estão nas Designações, nos dirigentes dos Territórios e os oradores da sua congregação.';
    div.appendChild(v);return;
  }
  const grupos=[...Object.entries(C.GRUPOS).map(([g,t])=>[t,lista.filter(p=>p.ativo!==false&&(p.grupo||'')===g)]),['Inativos',lista.filter(p=>p.ativo===false)]];
  grupos.forEach(([titulo,ps])=>{
    if(!ps.length)return;
    const sec=document.createElement('div');sec.className='pc-grupo';
    const h=document.createElement('h3');h.textContent=titulo==='Ancião'?'Anciãos':titulo==='Servo ministerial'?'Servos ministeriais':titulo==='Publicador'?'Publicadores':titulo;
    const n=document.createElement('small');n.textContent=ps.length;h.appendChild(n);sec.appendChild(h);
    ps.forEach(p=>{
      const row=document.createElement('div');row.className='pc-linha'+(p.ativo===false?' inativa':'');
      const av=document.createElement('span');av.className='av';av.textContent=(p.nome||'?').trim().charAt(0).toUpperCase();
      const tx=document.createElement('div');tx.className='tx';tx.onclick=()=>abrirPessoaCong(p.id);
      const st=document.createElement('strong');st.textContent=p.nome;const sp=document.createElement('span');
      sp.textContent=[p.telefone,p.obs].filter(Boolean).join(' · ')||'Sem telefone';tx.append(st,sp);
      row.append(av,tx);
      const tel=C.telefoneWa(p.telefone);
      if(tel){const a=document.createElement('a');a.className='dz-icon-btn wa';a.href='https://wa.me/'+tel;a.target='_blank';a.rel='noopener';a.title='Abrir conversa no WhatsApp';a.innerHTML='<i data-lucide="message-circle"></i>';row.appendChild(a);}
      sec.appendChild(row);
    });
    div.appendChild(sec);
  });
  DesignaUI.desenharIcones();
}
function abrirPessoaCong(id){
  pessoaCongEditando=id?pessoasCong.find(p=>p.id===id):null;
  const p=pessoaCongEditando||{nome:'',grupo:'publicador',telefone:'',obs:'',ativo:true};
  $('pcTitulo').textContent=pessoaCongEditando?p.nome:'Nova pessoa';
  $('pcNome').value=p.nome||'';$('pcGrupo').value=p.grupo||'';$('pcTel').value=p.telefone||'';$('pcObs').value=p.obs||'';$('pcAtivo').checked=p.ativo!==false;
  ['pcNome','pcGrupo','pcTel','pcObs','pcAtivo'].forEach(i=>$(i).disabled=!podeCong());
  $('pcExcluir').hidden=!pessoaCongEditando;
  $('janPessoaC').hidden=false;
}
async function salvarPessoaCong(){
  const nome=$('pcNome').value.trim();if(nome.length<2)return toast('Informe o nome.');
  if(pessoasCong.some(p=>C.normalizar(p.nome)===C.normalizar(nome)&&p.id!==pessoaCongEditando?.id))return toast('Já existe uma pessoa com esse nome.');
  const id=pessoaCongEditando?.id||C.novoId();
  const dados={nome,grupo:$('pcGrupo').value,telefone:$('pcTel').value.trim(),obs:$('pcObs').value.trim(),ativo:$('pcAtivo').checked};
  try{
    await C.salvar(await sbCong(),vinc.workspaceId,user.id,'cong_pessoas',id,dados);
    pessoasCong=[...pessoasCong.filter(p=>p.id!==id),{...dados,id}].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
    $('janPessoaC').hidden=true;renderPessoasCong();toast('✓ Salvo.');
  }catch(e){toast('Não foi possível salvar: '+e.message,6000);}
}
async function excluirPessoaCong(){
  const p=pessoaCongEditando;if(!p)return;
  if(!confirm('Excluir '+p.nome+' da lista da congregação? Se só não participa mais, prefira desmarcar "Ativo". Nas Designações, as vagas dessa pessoa aparecerão como "pessoa removida".'))return;
  try{
    const sb=await sbCong();
    await C.apagar(sb,vinc.workspaceId,'cong_pessoas',p.id);
    if(Conta.podeEditar(vinc,'designacoes'))await C.apagar(sb,vinc.workspaceId,'desig_pessoas',p.id).catch(()=>{});
    pessoasCong=pessoasCong.filter(x=>x.id!==p.id);$('janPessoaC').hidden=true;renderPessoasCong();toast('Pessoa excluída.');
  }catch(e){toast('Não foi possível excluir: '+e.message,6000);}
}

// Traz para a lista única quem já está cadastrado nos módulos (sem repetir nomes).
async function juntarCadastros(){
  try{
    const sb=await sbCong(),ws=vinc.workspaceId;
    await carregarPessoasCong();
    const designacoes=Conta.podeVer(vinc,'designacoes')?await C.listar(sb,ws,'desig_pessoas'):[];
    let dirigentes=[];
    if(Conta.podeVer(vinc,'territorios')){const cfg=await C.listar(sb,ws,'terr_tj_config');dirigentes=cfg.find(c=>c.id==='contatos')?.lista||[];}
    let oradores=[];
    if(Conta.podeVer(vinc,'oradores')){
      const[lista,config]=await Promise.all([C.listar(sb,ws,'oradores'),C.listar(sb,ws,'config')]);
      const limpa=v=>C.normalizar(v).replace(/\b(congregacao|cong|de|da|do)\b/g,'').replace(/\s+/g,' ').trim();
      const minha=limpa(config.find(c=>c.id==='app')?.cong||vinc.nome);
      oradores=lista.filter(o=>o.minhaCongregacao===true||(o.minhaCongregacao!==false&&minha&&limpa(o.cong)===minha));
    }
    const{novas,atualizadas}=C.juntarCadastros({central:pessoasCong,designacoes,dirigentes,oradores});
    if(!novas.length&&!atualizadas.length)return toast('Nenhum cadastro novo para juntar. Está tudo na lista.',5000);
    if(!confirm('Encontrei '+novas.length+' pessoa(s) nova(s)'+(atualizadas.length?' e '+atualizadas.length+' telefone(s) para completar':'')+' nas Designações, nos dirigentes dos Territórios e nos oradores da sua congregação. Juntar na lista?'))return;
    for(const p of [...novas,...atualizadas])await C.salvar(sb,ws,user.id,'cong_pessoas',p.id,p);
    pessoasCong=null;await renderPessoasCong();
    toast('✓ Lista atualizada. Confira o grupo de cada pessoa.',5000);
  }catch(e){toast('Não foi possível juntar: '+e.message,6000);}
}

// ── Eventos ──
const ICONE_EVENTO={assembleia:'users-round',congresso:'tent',visita:'briefcase',celebracao:'wine',outro:'calendar'};
async function renderEventos(){
  const div=$('evLista');
  try{await carregarEventos();}catch(e){div.innerHTML='';const v=document.createElement('div');v.className='vazio';v.textContent='Não foi possível carregar: '+e.message;div.appendChild(v);return;}
  div.innerHTML='';
  if(!eventosCong.length){const v=document.createElement('div');v.className='vazio';v.textContent='Nenhum evento cadastrado. Cadastre a próxima assembleia, congresso ou visita do superintendente.';div.appendChild(v);return;}
  const hoje=hojeISO();
  const futuros=eventosCong.filter(e=>(e.fim||e.inicio)>=hoje),passados=eventosCong.filter(e=>(e.fim||e.inicio)<hoje).reverse();
  const bloco=(titulo,lista,passado)=>{
    if(!lista.length)return;
    const h=document.createElement('div');h.className='sub';h.textContent=titulo;div.appendChild(h);
    lista.forEach(ev=>{
      const b=document.createElement('button');b.type='button';b.className='ev-card'+(passado?' passado':'');b.onclick=()=>abrirEvento(ev.id);
      const ic=document.createElement('span');ic.className='ic';ic.innerHTML='<i data-lucide="'+(ICONE_EVENTO[ev.tipo]||'calendar')+'"></i>';
      const tx=document.createElement('div');
      const st=document.createElement('strong');st.textContent=ev.titulo;
      const q=document.createElement('div');q.className='quando';const per=C.periodo(ev);q.textContent=(per.fim!==per.inicio?ddmm(per.inicio)+' a '+ddmm(per.fim):ddmm(per.inicio))+(ev.semanaToda?' · semana toda':'');
      const ef=document.createElement('div');ef.className='efeitos';
      [[ev.semDiscurso,'Sem discurso público'],[C.semReuniao(ev),'Sem designações (sem reunião)'],[!C.semReuniao(ev),'Com designações']].forEach(([on,t])=>{if(on){const s=document.createElement('span');s.className='dz-badge';s.textContent=t;ef.appendChild(s);}});
      tx.append(st,q,ef);b.append(ic,tx);div.appendChild(b);
    });
  };
  bloco('Próximos',futuros,false);bloco('Já passaram',passados,true);
  DesignaUI.desenharIcones();
}
function aplicarPadraoTipo(tipo,mudarNome){
  const t=C.TIPOS_EVENTO[tipo];
  $('evSemDiscurso').checked=t.semDiscurso;$(t.semanaToda?'evSemana':'evSoDias').checked=true;$(t.temDesignacoes?'evComDesig':'evSemDesig').checked=true;resumoEvento();
  if(mudarNome)$('evNome').value=tipo==='outro'?'':t.nome;
}
function tipoEventoMudou(){aplicarPadraoTipo($('evTipo').value,!nomeEventoManual);}
function abrirEvento(id){
  eventoEditando=id?eventosCong.find(e=>e.id===id):null;
  const ev=eventoEditando;
  $('evTitulo').textContent=ev?'Editar evento':'Novo evento';
  $('evTipo').value=ev?.tipo||'assembleia';
  if(ev){$('evNome').value=ev.titulo;$('evInicio').value=ev.inicio;$('evFim').value=ev.fim||ev.inicio;$('evSemDiscurso').checked=!!ev.semDiscurso;$(ev.semanaToda?'evSemana':'evSoDias').checked=true;$(C.semReuniao(ev)?'evSemDesig':'evComDesig').checked=true;resumoEvento();}
  else{$('evInicio').value='';$('evFim').value='';aplicarPadraoTipo('assembleia',true);}
  nomeEventoManual=!!ev;
  $('evNome').oninput=()=>{nomeEventoManual=true;};
  $('evInicio').onchange=()=>{if(!$('evFim').value||$('evFim').value<$('evInicio').value)$('evFim').value=$('evInicio').value;resumoEvento();};
  ['evTipo','evNome','evInicio','evFim','evSemDiscurso','evSoDias','evSemana','evSemDesig','evComDesig'].forEach(i=>{$(i).disabled=!podeCong();$(i).onchange=$(i).onchange||resumoEvento;});
  $('evFim').addEventListener('change',resumoEvento);
  $('evExcluir').hidden=!ev;
  $('janEvento').hidden=false;
}

// Datas de reunião entre duas datas (pelos dias configurados no Oradores e nas Designações).
async function datasDeReuniao(inicio,fim){
  const sb=await sbCong(),ws=vinc.workspaceId;
  let oradoresCfg=null,desigCfg={};
  if(Conta.podeVer(vinc,'oradores')){const c=(await C.listar(sb,ws,'config')).find(x=>x.id==='app');if(c)oradoresCfg={dia:c.dia,dia2027:c.dia2027};}
  if(Conta.podeVer(vinc,'designacoes')){desigCfg=(await C.listar(sb,ws,'desig_config')).find(x=>x.id==='app')||{};}
  const cfg={diaMeio:desigCfg.diaMeio,diaFim:desigCfg.diaFim,oradores:oradoresCfg};
  const datas={fim:[],meio:[]};
  const d=new Date(inicio.slice(0,7)+'-01T12:00:00'),ate=fim.slice(0,7);
  while(Regras.iso(d).slice(0,7)<=ate){
    Regras.reunioesDoMes(d.getFullYear(),d.getMonth()+1,cfg,[]).forEach(r=>{if(r.data>=inicio&&r.data<=fim)datas[r.tipo].push(r.data);});
    d.setMonth(d.getMonth()+1);
  }
  return datas;
}

// Grava o evento e aplica (ou desfaz) as mudanças no Oradores e nas Designações.
async function aplicarEvento(novo,antigo){
  const sb=await sbCong(),ws=vinc.workspaceId;
  const pn=C.periodo(novo),pa=C.periodo(antigo);
  const inicio=[pn?.inicio,pa?.inicio].filter(Boolean).sort()[0];
  const fim=[pn?.fim,pa?.fim].filter(Boolean).sort().pop();
  const datas=await datasDeReuniao(inicio,fim);
  const editaOradores=Conta.podeEditar(vinc,'oradores'),editaDesig=Conta.podeEditar(vinc,'designacoes');
  const programa=editaOradores?await C.listar(sb,ws,'programa'):[];
  const reunioes=editaDesig?await C.listar(sb,ws,'desig_reunioes'):[];
  const plano=C.planejarEvento({novo,antigo,programa,reunioes,datas});
  if(plano.conflitos.length&&!confirm('Já há orador agendado em: '+plano.conflitos.map(c=>c.data.slice(8,10)+'/'+c.data.slice(5,7)+' ('+c.nome+')').join(', ')+'.\nEssas datas ficarão como "sem discurso". O orador fica guardado e volta se você apagar ou mudar o evento. Continuar?'))return null;
  for(const p of plano.programaSalvar)await C.salvar(sb,ws,user.id,'programa',p.id||C.novoId(),p.dados);
  for(const id of plano.programaApagar)await C.apagar(sb,ws,'programa',id);
  for(const r of plano.reunioesSalvar)await C.salvar(sb,ws,user.id,'desig_reunioes',r.data,r);
  const avisos=[];
  if(!editaOradores&&(novo?.semDiscurso||antigo?.semDiscurso))avisos.push('o Oradores não foi atualizado (você não tem permissão de edição nele)');
  if(!editaDesig&&(C.semReuniao(novo)||C.semReuniao(antigo)))avisos.push('as Designações não foram atualizadas (você não tem permissão de edição nelas)');
  return {plano,avisos};
}

async function salvarEvento(){
  const titulo=$('evNome').value.trim(),inicio=$('evInicio').value,fim=$('evFim').value||inicio;
  if(titulo.length<2)return toast('Informe o nome do evento.');
  if(!inicio)return toast('Informe a data de início.');
  if(fim<inicio)return toast('O fim não pode ser antes do início.');
  const id=eventoEditando?.id||C.novoId();
  const novo={id,tipo:$('evTipo').value,titulo,inicio,fim,semDiscurso:$('evSemDiscurso').checked,semanaToda:$('evSemana').checked,temDesignacoes:$('evComDesig').checked};
  const b=$('evSalvar');b.disabled=true;
  try{
    const r=await aplicarEvento(novo,eventoEditando);if(!r)return;
    await C.salvar(await sbCong(),vinc.workspaceId,user.id,'cong_eventos',id,novo);
    eventosCong=null;$('janEvento').hidden=true;await renderEventos();
    const n1=r.plano.programaSalvar.length+r.plano.programaApagar.length,n2=r.plano.reunioesSalvar.length;
    toast('✓ Evento salvo.'+(n1?' Oradores: '+n1+' data(s) atualizada(s).':'')+(n2?' Designações: '+n2+' reunião(ões) atualizada(s).':'')+(r.avisos.length?' Atenção: '+r.avisos.join('; ')+'.':''),7000);
  }catch(e){toast('Não foi possível salvar: '+e.message,6000);}
  finally{b.disabled=false;}
}
async function excluirEvento(){
  const ev=eventoEditando;if(!ev)return;
  if(!confirm('Excluir "'+ev.titulo+'"? O Oradores e as Designações voltam como estavam antes do evento.'))return;
  try{
    const r=await aplicarEvento(null,ev);if(!r)return;
    await C.apagar(await sbCong(),vinc.workspaceId,'cong_eventos',ev.id);
    eventosCong=null;$('janEvento').hidden=true;await renderEventos();
    toast('Evento excluído.'+(r.avisos.length?' Atenção: '+r.avisos.join('; ')+'.':''),6000);
  }catch(e){toast('Não foi possível excluir: '+e.message,6000);}
}

// Explica em uma frase o que o evento vai fazer, conforme as escolhas.
function resumoEvento(){
  const ini=$('evInicio').value;if(!ini){$('evResumo').textContent='';return;}
  const ev={inicio:ini,fim:$('evFim').value||ini,semanaToda:$('evSemana').checked};
  const p=C.periodo(ev);
  const quando=p.inicio===p.fim?'em '+ddmm(p.inicio):'de '+ddmm(p.inicio)+' a '+ddmm(p.fim);
  const partes=[$('evSemDesig').checked?'as reuniões '+quando+' ficam sem designações':'as reuniões '+quando+' continuam com designações'];
  if($('evSemDiscurso').checked)partes.push('o fim de semana fica sem discurso público no Oradores');
  $('evResumo').textContent='Resumo: '+partes.join(' e ')+'.';
}
