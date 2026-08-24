// STATE
let db=null,FF=null,supabase=null,currentUser=null,activeWorkspaceId=null,oradores=[],discursos=[],sugestoes=[],sentinelas=[],programa=[];
let notaAtual=0,temaFiltro='todos',orSort='az';
let bloqueados=new Set();
let cfg={cong:'Minha Congregação',end:'',hor:'19:00',dia:6,groupMsg:'Próximo discurso público:\n\nOrador: {orador}\nTema: {tema}\nData: {data}\nCongregação: {minha_cong}'};
let mensagens=[
  {id:1,titulo:'Convite padrão',texto:'Olá {orador}, tudo bem?\n\nGostaríamos de convidá-lo para proferir o discurso público na nossa congregação:\n\n📖 Tema: {tema}\n📅 Data: {data}\n🏠 Congregação: {cong}\n📍 Endereço: {end}\n\nAguardamos sua confirmação. 🙏'},
  {id:2,titulo:'Lembrete',texto:'Olá {orador}! Passando para lembrar do discurso público:\n\n📖 {tema}\n📅 {data}\n📍 {cong}\n\nObrigado! 🙏'},
];
let TL={...TEMAS}; // temasLocal — updatable copy

// TEMA E INICIALIZAÇÃO
function toggleTheme(){const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;localStorage.setItem('bj_theme',next);updateThemeButton();}
function updateThemeButton(){const b=document.getElementById('themeBtn');if(b){b.innerHTML='<i data-lucide="'+(document.documentElement.dataset.theme==='dark'?'sun':'moon')+'"></i>';if(window.lucide)lucide.createIcons();}}
function updateUserHeader(){
  if(!currentUser)return;
  const meta=currentUser.user_metadata||{},name=meta.full_name||meta.name||currentUser.email?.split('@')[0]||'Conta';
  document.getElementById('userName').textContent=name.split(' ')[0];document.getElementById('userEmail').textContent=currentUser.email||'';
  const avatar=document.getElementById('userAvatar');avatar.src=meta.avatar_url||meta.picture||'';avatar.style.display=avatar.src?'block':'none';
}
function updateBranding(){
  const congregation=String(cfg.cong||'Minha Congregação').trim()||'Minha Congregação';
  document.title='Oradores — '+congregation;
  ['headerCongName','sidebarCongName'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.textContent='— '+congregation;
  });
}
function toggleUserMenu(force){const pop=document.getElementById('accountPopover');if(pop)pop.classList.toggle('open',typeof force==='boolean'?force:!pop.classList.contains('open'));}
document.addEventListener('click',e=>{if(!e.target.closest('.user-menu')&&!e.target.closest('.account-popover'))toggleUserMenu(false);});
window.addEventListener('DOMContentLoaded',()=>{updateBranding();if(window.lucide)lucide.createIcons();});

async function loadAll(){
  await Promise.all([loadConfig(),loadOradores(),loadDiscursos(),loadSugestoes(),loadSentinelas(),loadPrograma(),loadDiscursantes()]);
  renderHome();renderPrograma();renderOradores();renderTemas();renderAnalytics();
}

// NAV
function irTab(p){
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  const t=document.querySelector('[data-p="'+p+'"]');if(t)t.classList.add('active');
  const pg=document.getElementById('page-'+p);if(pg)pg.classList.add('active');
  if(p==='home')renderHome();
  if(p==='analytics')renderAnalytics();
  if(p==='minha')renderMinha();
  if(p==='oradores')renderOradores();
  if(p==='sugestoes')renderSugestoes();
  if(p==='temas')renderTemas();
  if(p==='programa')renderPrograma();
  if(p==='sentinela')autoFillSentinelaTab();
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>irTab(t.dataset.p)));

// UTILS
function fD(iso){if(!iso)return'—';const[y,m,d]=iso.slice(0,10).split('-');return d+'/'+m+'/'+y;}
function fDL(iso){
  if(!iso)return'—';
  const dt=new Date(iso+'T12:00:00');
  const dias=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const mes=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return dias[dt.getDay()]+', '+dt.getDate()+' de '+mes[dt.getMonth()]+' de '+dt.getFullYear()+' — '+cfg.hor;
}
function fDSem(iso){
  if(!iso)return'—';
  const dt=new Date(iso+'T12:00:00');
  const dias=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const mes=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return dias[dt.getDay()]+', '+dt.getDate()+' de '+mes[dt.getMonth()]+' de '+dt.getFullYear();
}
function diaSem(iso){if(!iso)return'';try{const dt=new Date(iso+'T12:00:00');return['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dt.getDay()];}catch(e){return'';}}
function normalizarTexto(valor){
  return String(valor||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function normalizarCongregacao(valor){
  return normalizarTexto(valor)
    .replace(/\b(congregacao|cong)\b/g,' ')
    .replace(/\b(de|da|do|das|dos)\b/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function chaveIdentidadeOrador(orador){
  return normalizarTexto(orador?.nome)+'|'+normalizarCongregacao(orador?.cong||orador?.congregacao);
}
function mesesAno(iso){
  if(!iso)return null;
  const hoje=new Date();const ult=new Date(iso+'T12:00:00');const ms=hoje-ult;if(ms<0)return null;
  const m=Math.floor(ms/(864e5*30.44));
  if(m<1)return'Este mês';if(m===1)return'1 mês';
  if(m<12)return m+' meses';
  const a=Math.floor(m/12);const r=m%12;
  return a+(a>1?' anos':' ano')+(r>0?' e '+r+(r>1?' meses':' mês'):'');
}
function corTempo(iso){
  if(!iso)return'bred';
  const m=Math.floor((new Date()-new Date(iso+'T12:00:00'))/(864e5*30.44));
  return m<6?'bgrn':m<12?'bamb':'bred';
}
// Calcula a última data de discurso de um orador a partir do Histórico (programa) e dos discursos importados,
// em vez de confiar só no campo ultimoDiscurso salvo no cadastro — assim fica sempre em sincronia com o que é editado lá.
function getUltimoDiscurso(o){
  const hoje=new Date().toISOString().slice(0,10);
  let max=o.ultimoDiscurso||null;
  programa.forEach(p=>{
    if(p.nome===o.nome&&!p.semDiscurso&&p.data&&p.data<=hoje){
      if(!max||p.data>max)max=p.data;
    }
  });
  discursos.forEach(d=>{
    if((d.oradorId===o.id||d.nome===o.nome)&&d.data){
      if(!max||d.data>max)max=d.data;
    }
  });
  return max;
}
function ehSist(nome){if(!nome)return true;const s=['CONGRESSO','ASSEMBLEIA','CELEBRAÇÃO','VISITA','REUNIÃO','DISCURSO ESPECIAL','TRANSIÇÃO','STREAM'];return s.some(x=>nome.toUpperCase().includes(x));}
function nextSab(){
  const d=new Date();d.setHours(12,0,0,0);
  const target=Number(cfg.dia)===0?0:6,dow=d.getDay();
  const diff=(target-dow+7)%7;
  d.setDate(d.getDate()+diff);
  return d.toISOString().slice(0,10);
}
function currentOrNextProg(){
  // Returns the programa entry to highlight: exact saturday match, or closest future
  const sab=nextSab();
  const today=new Date().toISOString().slice(0,10);
  // Dedup by date
  const byDate={};
  programa.forEach(p=>{if(p.data)byDate[p.data]=p;});
  const sorted=Object.values(byDate).filter(p=>p.data>=today).sort((a,b)=>a.data<b.data?-1:1);
  // Prefer exact saturday match, fallback to first future
  return sorted.find(p=>p.data===sab)||sorted[0]||null;
}
function openM(id){document.getElementById(id).classList.add('open');}
function closeM(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.mbg').forEach(b=>b.addEventListener('click',e=>{if(e.target===b)b.classList.remove('open');}));
function toast(msg,dur=2800){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),dur);}
