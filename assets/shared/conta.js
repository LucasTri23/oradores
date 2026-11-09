// Login, congregação, permissões e partes comuns da interface (tema, seletor de módulo, menu da conta).
// O nome do sistema fica só aqui: troque APP_NOME se quiser mudar o nome.
window.APP_NOME='Designa';

window.Conta=(function(){
  const MODULOS={
    oradores:{nome:'Oradores',caminho:'/oradores',icone:'mic',descricao:'Programação de discursos, oradores, histórico e quadro de anúncios.'},
    territorios:{nome:'Territórios',caminho:'/territorios',icone:'map',descricao:'Registro de territórios, cartões de mapa, dirigentes e campanhas.'},
    designacoes:{nome:'Designações',caminho:'/designacoes',icone:'clipboard-list',descricao:'Presidente, leitor, indicadores, microfones e áudio e vídeo das reuniões.'}
  };
  let cliente=null;

  async function config(){
    try{const salvo=JSON.parse(localStorage.getItem('bj_supabase')||'null');if(salvo?.url&&salvo?.key)return salvo;}catch(e){}
    try{const r=await fetch('/api/config');if(r.ok){const c=await r.json();if(c.url&&c.key)return c;}}catch(e){}
    return null;
  }

  // Permite reaproveitar um cliente já criado (o Oradores cria o seu).
  function usarCliente(c){cliente=c;}

  async function supabase(){
    if(cliente)return cliente;
    const c=await config();
    if(!c)throw new Error('O acesso ainda não foi configurado. Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY na Vercel.');
    const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    cliente=createClient(c.url,c.key);
    return cliente;
  }

  async function usuario(){
    const sb=await supabase();
    const {data}=await sb.auth.getSession();
    return data.session?.user||null;
  }

  async function entrar(redirectTo){
    const sb=await supabase();
    const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirectTo||location.href,queryParams:{prompt:'select_account'}}});
    if(error)throw error;
  }

  async function sair(){
    const sb=await supabase();
    await sb.auth.signOut();
    try{localStorage.removeItem('oradores_workspace');}catch(e){}
  }

  // Converte a linha de workspace_members em {modulos, somenteLeitura}. Funciona mesmo antes do SQL novo.
  function acessoDe(linha){
    if(!linha)return null;
    if(linha.role==='owner')return {modulos:Object.keys(MODULOS),somenteLeitura:[]};
    const modulos=Array.isArray(linha.modules)?linha.modules:['oradores'];
    const somenteLeitura=(Array.isArray(linha.readonly)?linha.readonly:[]).filter(m=>modulos.includes(m));
    return {modulos,somenteLeitura};
  }

  // Vínculo da conta com a congregação: {workspaceId, role, modulos, somenteLeitura, nome} ou null.
  async function vinculo(user){
    const sb=await supabase();
    const {data,error}=await sb.from('workspace_members').select('*').eq('user_id',user.id).maybeSingle();
    if(error)throw new Error('Não foi possível consultar sua congregação. Tente novamente.');
    if(!data)return null;
    const {data:ws}=await sb.from('workspaces').select('name').eq('id',data.workspace_id).maybeSingle();
    try{localStorage.setItem('oradores_workspace',data.workspace_id);}catch(e){}
    return {workspaceId:data.workspace_id,role:data.role,...acessoDe(data),nome:ws?.name||'Minha Congregação'};
  }

  function podeVer(v,modulo){return !!v&&v.modulos.includes(modulo);}
  function podeEditar(v,modulo){return podeVer(v,modulo)&&!v.somenteLeitura.includes(modulo);}

  return {MODULOS,supabase,usarCliente,usuario,entrar,sair,vinculo,acessoDe,podeVer,podeEditar};
})();

window.DesignaUI=(function(){
  const icone=n=>'<i data-lucide="'+n+'"></i>';
  const desenharIcones=()=>{if(window.lucide)lucide.createIcons();};

  // Tema claro/escuro compartilhado por todos os módulos (mesma chave do Oradores).
  function aplicarTema(){
    let t='light';try{t=localStorage.getItem('bj_theme')||'light';}catch(e){}
    document.documentElement.dataset.theme=t;
    document.querySelectorAll('[data-dz-tema]').forEach(b=>{b.innerHTML=icone(t==='dark'?'sun':'moon');b.title=t==='dark'?'Tema claro':'Tema escuro';});
    desenharIcones();
  }
  function alternarTema(){
    const t=document.documentElement.dataset.theme==='dark'?'light':'dark';
    try{localStorage.setItem('bj_theme',t);}catch(e){}
    aplicarTema();
  }

  // Seletor "Oradores ⇄ Territórios": só aparece quando a pessoa acessa mais de um módulo.
  function montarSeletor(el,vinc,atual){
    if(!el)return;
    el.innerHTML='';
    const meus=Object.entries(Conta.MODULOS).filter(([k])=>Conta.podeVer(vinc,k));
    if(meus.length<2){el.hidden=true;return;}
    el.hidden=false;el.classList.add('dz-switch');
    meus.forEach(([k,m])=>{
      const a=document.createElement('a');a.href=m.caminho;a.className=k===atual?'on':'';a.title=m.nome;
      a.innerHTML=icone(m.icone)+'<span></span>';a.querySelector('span').textContent=m.nome;
      el.appendChild(a);
    });
    desenharIcones();
  }

  // Botão da conta com menu: Início, Configurações da congregação, tema e Sair.
  function montarConta(el,user,opcoes={}){
    if(!el||!user)return;
    const nome=user.user_metadata?.full_name||user.user_metadata?.name||user.email||'Conta';
    const foto=user.user_metadata?.avatar_url||user.user_metadata?.picture||'';
    el.innerHTML='';
    const btn=document.createElement('button');btn.type='button';btn.className='dz-user';btn.setAttribute('aria-label','Menu da conta');
    if(foto){const img=document.createElement('img');img.src=foto;img.alt='';img.referrerPolicy='no-referrer';btn.appendChild(img);}
    else{const av=document.createElement('span');av.className='dz-avatar';av.textContent=nome.trim().charAt(0).toUpperCase();btn.appendChild(av);}
    const span=document.createElement('span');span.textContent=nome.split(' ')[0];btn.appendChild(span);
    btn.insertAdjacentHTML('beforeend',icone('chevron-down'));
    const pop=document.createElement('div');pop.className='dz-popover';
    const email=document.createElement('div');email.textContent=user.email||'';pop.appendChild(email);
    const item=(ic,txt,acao)=>{const b=document.createElement(typeof acao==='string'?'a':'button');if(typeof acao==='string')b.href=acao;else{b.type='button';b.onclick=acao;}b.innerHTML=icone(ic);b.appendChild(document.createTextNode(' '+txt));pop.appendChild(b);};
    item('layout-dashboard','Início','/');
    item('settings','Configurações da congregação','/#configuracoes');
    item('sun-moon','Alternar tema',()=>{alternarTema();pop.classList.remove('open');});
    item('log-out','Sair',opcoes.sair||(async()=>{await Conta.sair();location.replace('/');}));
    btn.onclick=e=>{e.stopPropagation();pop.classList.toggle('open');};
    document.addEventListener('click',e=>{if(!pop.contains(e.target))pop.classList.remove('open');});
    el.append(btn,pop);
    desenharIcones();
  }

  function toast(msg,ms=3500){
    let t=document.getElementById('dzToast');
    if(!t){t=document.createElement('div');t.id='dzToast';t.className='dz-toast';document.body.appendChild(t);}
    t.textContent=msg;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),ms);
  }

  // Compartilha um arquivo (ex.: PDF do quadro) pelo menu do celular — WhatsApp, e-mail…
  // Onde não dá para compartilhar arquivos (ex.: computador), baixa o arquivo.
  async function compartilharArquivo(blob,nome,texto=''){
    const arquivo=new File([blob],nome,{type:blob.type||'application/pdf'});
    if(navigator.canShare&&navigator.canShare({files:[arquivo]})){
      try{await navigator.share({files:[arquivo],title:nome,text:texto});return 'compartilhado';}
      catch(e){if(e.name==='AbortError')return 'cancelado';}
    }
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=nome;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
    toast('Este aparelho não envia arquivos direto. O PDF foi baixado — anexe no WhatsApp.',6000);
    return 'baixado';
  }

  // Permite instalar o Designa no celular (abre em tela cheia, com ícone).
  function registrarApp(){
    if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js').catch(()=>{});
  }

  return {aplicarTema,alternarTema,montarSeletor,montarConta,toast,registrarApp,desenharIcones,compartilharArquivo};
})();
