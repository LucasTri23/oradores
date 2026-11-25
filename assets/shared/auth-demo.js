// @ts-check
/* Demonstração isolada: dados inventados, sem clientes de autenticação ou consultas ao banco. */
(function(root){
  'use strict';
  const CYCLE=6000;
  const MODELS=[
    {key:'oradores',label:'Oradores',title:'Programação de discursos',subtitle:'Abril · Congregação Exemplo',notice:'Discurso confirmado',detail:'André Ribeiro · programação de exemplo',html:`
      <div class="ad-section-head"><span>Próximos discursos</span><span class="ad-counter">3 programados</span></div>
      <table class="ad-table"><thead><tr><th>Data</th><th>Orador / tema</th><th>Situação</th></tr></thead><tbody>
      <tr class="ad-row"><td><b class="ad-date">07<small>ABR</small></b></td><td><strong>André Ribeiro</strong><small>Uma esperança para o futuro</small></td><td><span class="ad-state-stack"><span class="ad-before ad-loop ad-tag">A confirmar</span><span class="ad-after ad-loop ad-tag ad-tag-done">Confirmado <span aria-hidden="true">✓</span></span></span></td></tr>
      <tr class="ad-row"><td><b class="ad-date">14<small>ABR</small></b></td><td><strong>Felipe Martins</strong><small>Encontre alegria no dia a dia</small></td><td><span class="ad-tag ad-tag-done">Confirmado</span></td></tr>
      <tr class="ad-row"><td><b class="ad-date">21<small>ABR</small></b></td><td><strong>Eduardo Alves</strong><small>Como fortalecer a família</small></td><td><span class="ad-tag">Agendado</span></td></tr>
      </tbody></table>`},
    {key:'designacoes',label:'Designações',title:'Cada função, uma pessoa',subtitle:'Reunião de exemplo · sábado, 18h',notice:'Programação de exemplo concluída',detail:'Todas as funções desta demonstração preenchidas',html:`
      <div class="ad-section-head"><span>Funções da reunião</span><span class="ad-state-stack ad-counter"><span class="ad-before ad-loop">3 de 4 definidas</span><span class="ad-after ad-loop">4 de 4 definidas</span></span></div>
      <div class="ad-assignments">
      <div class="ad-assignment ad-row"><span class="ad-avatar">AC</span><div><small>Presidente</small><strong>Augusto Carvalho</strong></div><span class="ad-check">✓</span></div>
      <div class="ad-assignment ad-row"><span class="ad-avatar">PM</span><div><small>Leitor</small><strong>Pedro Melo</strong></div><span class="ad-check">✓</span></div>
      <div class="ad-assignment ad-row"><span class="ad-avatar">RM</span><div><small>Áudio e vídeo</small><strong>Renato Moraes</strong></div><span class="ad-check">✓</span></div>
      <div class="ad-assignment ad-row ad-assignment-target"><span class="ad-avatar">LC</span><div><small>Microfones</small><span class="ad-state-stack"><strong class="ad-before ad-loop ad-vacancy">A designar</strong><strong class="ad-after ad-loop">Leonardo Costa</strong></span></div><span class="ad-after ad-loop ad-check">✓</span></div>
      </div>`},
    {key:'territorios',label:'Territórios',title:'O trabalho bem acompanhado',subtitle:'Territórios · Congregação Exemplo',notice:'Território de exemplo designado',detail:'Território 08 · Rafael Reis',html:`
      <div class="ad-section-head"><span>Distribuição de territórios</span><span class="ad-counter">Visão da equipe</span></div>
      <div class="ad-territory-board">
      <div class="ad-territory-column"><span class="ad-column-label"><i></i> Disponíveis</span><div class="ad-territory-placeholder">Território 12<small>Jardim Novo · exemplo</small></div></div>
      <div class="ad-territory-column"><span class="ad-column-label"><i></i> Em andamento</span><div class="ad-territory-placeholder">Território 03<small>Centro · exemplo</small></div></div>
      <div class="ad-territory-moving ad-loop"><span class="ad-territory-number">08</span><strong>Vila das Flores</strong><small>Área fictícia</small><span class="ad-state-stack"><span class="ad-before ad-loop ad-tag">Disponível</span><span class="ad-after ad-loop ad-tag ad-tag-done">Rafael Reis</span></span></div>
      </div>`},
    {key:'publicacoes',label:'Publicações',title:'Do pedido à entrega',subtitle:'Pedidos de exemplo · acompanhamento',notice:'Recebimento de exemplo registrado',detail:'2 exemplares reservados para Sofia Duarte',html:`
      <div class="ad-section-head"><span>Pedidos da congregação</span><span class="ad-counter">2 pedidos</span></div>
      <div class="ad-publication ad-row"><div class="ad-publication-icon" aria-hidden="true">▤</div><div><strong>Sofia Duarte</strong><small>Publicação de exemplo · 2 exemplares</small></div></div>
      <div class="ad-order-track"><span>Solicitado</span><i></i><span>Enviado</span><i class="ad-track-progress ad-loop"></i><span class="ad-track-done ad-loop">Recebido</span></div>
      <div class="ad-order-detail"><span>Situação</span><span class="ad-state-stack"><span class="ad-before ad-loop ad-tag">Aguardando chegada</span><span class="ad-after ad-loop ad-tag ad-tag-done">Pronto para retirar</span></span></div>
      <p class="ad-stock-note">A contagem mensal do estoque permanece independente dos pedidos.</p>`},
  ];
  /** @param {number} index */
  const nextIndex=index=>(index+1)%MODELS.length;
  /** @param {number} remaining @param {number} elapsed */
  const remainingAfterPause=(remaining,elapsed)=>Math.max(0,remaining-Math.max(0,elapsed));
  /** @param {keyof HTMLElementTagNameMap} tag @param {string=} className @param {string=} text */
  function element(tag,className='',text){const n=document.createElement(tag);n.className=className;if(text!==undefined)n.textContent=text;return n;}
  if(typeof document==='undefined'){if(typeof module!=='undefined')module.exports={MODELS,CYCLE,nextIndex,remainingAfterPause};return;}

  /** @type {HTMLElement|null} */ let host=null;
  /** @type {HTMLElement|null} */ let currentScreen=null;
  /** @type {HTMLButtonElement|null} */ let pauseButton=null;
  /** @type {HTMLElement|null} */ let announcement=null;
  /** @type {HTMLButtonElement[]} */ const tabs=[];
  /** @type {HTMLElement[]} */ const panels=[];
  /** @type {ReturnType<typeof setTimeout>|null} */ let timer=null;
  /** @type {ReturnType<typeof setTimeout>|null} */ let entryTimer=null;
  let index=0,remaining=CYCLE,started=0,running=false,inViewport=false,focusWithin=false,userPaused=false;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  try{userPaused=sessionStorage.getItem('designa-auth-motion-paused')==='1';}catch{/* A preferência é opcional. */}

  function stop(){
    if(timer!==null){clearTimeout(timer);timer=null;}
    if(running)remaining=remainingAfterPause(remaining,performance.now()-started);
    running=false;
  }
  function sync(){
    const active=!!currentScreen&&!currentScreen.hidden;
    const play=active&&inViewport&&!document.hidden&&!reduced.matches&&!userPaused&&!focusWithin;
    if(!play)stop();
    document.body.classList.toggle('auth-motion-paused',!play);
    if(host){host.dataset.reduced=String(reduced.matches);host.dataset.playing=String(play);}
    if(pauseButton){
      pauseButton.disabled=reduced.matches;
      pauseButton.textContent=reduced.matches?'Movimento reduzido':userPaused?'Retomar animações':'Pausar animações';
      pauseButton.setAttribute('aria-pressed',String(userPaused||reduced.matches));
    }
    if(play&&!running){running=true;started=performance.now();timer=setTimeout(()=>{timer=null;running=false;remaining=CYCLE;select(nextIndex(index),false);},remaining);}
  }
  /** @param {number} selected @param {boolean} manual */
  function select(selected,manual){
    stop();index=selected;remaining=CYCLE;
    tabs.forEach((t,i)=>t.setAttribute('aria-pressed',String(i===selected)));
    panels.forEach((p,i)=>p.hidden=i!==selected);
    if(host)host.dataset.module=MODELS[index].key;
    if(manual&&announcement)announcement.textContent='Demonstração de '+MODELS[index].label+' selecionada. Dados fictícios.';
    sync();
  }
  function build(){
    const demo=element('section','auth-demo');demo.id='designaAuthDemo';demo.setAttribute('aria-label','Demonstração do Designa com dados exclusivamente fictícios');
    const heading=element('div','ad-toolbar'),identity=element('div','ad-identity');
    const mark=element('span','ad-workspace-mark');mark.setAttribute('aria-hidden','true');mark.textContent='▦';
    identity.append(mark,element('strong','','Congregação Exemplo'),element('span','ad-example-label','Demonstração'));
    pauseButton=document.createElement('button');pauseButton.type='button';pauseButton.className='ad-pause';pauseButton.setAttribute('aria-controls',demo.id);
    pauseButton.onclick=()=>{userPaused=!userPaused;try{sessionStorage.setItem('designa-auth-motion-paused',userPaused?'1':'0');}catch{/* Sem armazenamento, a pausa continua válida nesta página. */}sync();};
    heading.append(identity,pauseButton);demo.appendChild(heading);
    const nav=element('div','ad-tabs');nav.setAttribute('role','group');nav.setAttribute('aria-label','Escolher demonstração de módulo');
    MODELS.forEach((m,i)=>{const tab=document.createElement('button');tab.type='button';tab.className='ad-tab';tab.textContent=m.label;tab.setAttribute('aria-controls','auth-demo-panel-'+m.key);const line=element('span','ad-tab-progress ad-loop');line.setAttribute('aria-hidden','true');tab.appendChild(line);tab.onclick=()=>select(i,true);tabs.push(tab);nav.appendChild(tab);});
    nav.addEventListener('focusin',()=>{focusWithin=true;sync();});
    nav.addEventListener('focusout',()=>queueMicrotask(()=>{focusWithin=nav.contains(document.activeElement);sync();}));demo.appendChild(nav);
    const stage=element('div','ad-stage');
    MODELS.forEach((m,i)=>{
      const panel=element('section','ad-panel');panel.id='auth-demo-panel-'+m.key;panel.setAttribute('aria-label',m.label+' — demonstração');
      const title=element('div','ad-panel-heading');title.append(element('h3','',m.title),element('p','',m.subtitle));
      const body=element('div','ad-panel-content');body.innerHTML=m.html;body.setAttribute('aria-hidden','true');
      const summaries=['Exemplo fictício de um discurso passando de a confirmar para confirmado.','Exemplo fictício de uma pessoa preenchendo a função de microfones na reunião.','Exemplo fictício de um território sendo designado a um dirigente.','Exemplo fictício de recebimento de publicações para uma pessoa, sem alterar a contagem mensal do estoque.'];
      panel.append(title,element('p','sr-only',summaries[i]),body);
      const notice=element('div','ad-notice ad-loop');notice.setAttribute('aria-hidden','true');const check=element('span','ad-notice-check','✓'),copy=element('div');copy.append(element('small','','Confirmação simulada'),element('strong','',m.notice),element('span','',m.detail));notice.append(check,copy);panel.appendChild(notice);
      stage.appendChild(panel);panels.push(panel);
    });demo.appendChild(stage);
    const footer=element('div','ad-footer');footer.append(element('span','','Prévia do produto'),element('span','','Dados fictícios · nenhuma ação real'));
    demo.appendChild(footer);announcement=element('p','sr-only');announcement.setAttribute('role','status');announcement.setAttribute('aria-live','polite');demo.appendChild(announcement);
    host=demo;
    if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{inViewport=entries.some(e=>e.isIntersecting);sync();},{threshold:.15});observer.observe(demo);}else inViewport=true;
    select(0,false);
  }
  /** @param {string} id */
  function setScreen(id){
    if(!['vLogin','vSaiu','vConvite'].includes(id)){currentScreen=null;sync();return;}
    const screen=document.getElementById(id),main=screen?.querySelector('main');if(!screen||!main)return;
    if(currentScreen===screen&&host?.parentElement===main){sync();return;}
    stop();currentScreen=screen;screen.dataset.authPremium='true';
    if(!host)build();if(host)main.appendChild(host);
    if(entryTimer!==null)clearTimeout(entryTimer);
    screen.classList.add('auth-entering');entryTimer=setTimeout(()=>screen.classList.remove('auth-entering'),1000);
    sync();
  }
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  root.DesignaAuthDemo={setScreen};
})(typeof window!=='undefined'?window:globalThis);
