// Ajuda do Designa: botão "?" com dúvidas frequentes em todas as páginas e
// passo a passo na primeira vez que a pessoa abre cada aba (ela escolhe ver ou pular).
(function(root){
  const CHAVE='designa_ajuda_vista_';
  const ler=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
  const gravar=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
  const visivel=el=>!!el&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';

  // Dúvidas que valem para o site todo.
  const GERAL=[
    ['O que é o Designa?','Um sistema da congregação dividido em módulos: Oradores (discursos públicos), Designações (indicadores, microfones, áudio e vídeo, presidente, leitor e saídas de campo), Territórios e Quadro de anúncios. Use os ícones no topo para trocar de módulo.'],
    ['Por que não consigo editar?','Sua conta tem acesso só para ver aquele módulo. Peça ao proprietário da congregação para liberar a edição em Início → Configurações → Equipe.'],
    ['Onde ficam as configurações?','Tudo fica em Início → Configurações: nome da congregação, dias das reuniões, quantas pessoas em cada função, locais e dias de saída de campo, equipe e mensagens.'],
    ['Onde cadastro as pessoas da congregação?','Em Início → Pessoas. Essa lista é única: as Designações e os dirigentes dos Territórios usam os mesmos nomes. O que cada pessoa pode fazer nas Designações é marcado em Designações → Pessoas.'],
    ['Como instalar no celular?','No Android, abra o menu do navegador e toque em "Instalar app" ou "Adicionar à tela inicial". No iPhone, toque em Compartilhar → "Adicionar à Tela de Início".'],
    ['Posso ver o passo a passo de novo?','Sim. Toque no botão "?" e depois em "Ver o passo a passo desta tela". Para rever todas as telas, use "Mostrar os passo a passo de novo".']
  ];

  // Conteúdo de cada módulo: como descobrir a aba atual, passo a passo de cada aba e dúvidas.
  const MODULOS={
    inicio:{
      nome:'Início',
      aba:()=>document.querySelector('[data-sec].active')?.dataset.sec||'painel',
      secao:a=>document.getElementById('sec-'+a),
      abas:{
        painel:{titulo:'Início',passos:[
          {texto:'Esta é a tela inicial do Designa. Aqui aparece um resumo do que vem por aí em cada módulo.'},
          {alvo:'#painelGrid',texto:'Os cartões mostram os próximos discursos, as próximas designações e os territórios. Toque em "Abrir…" para ir ao módulo.'},
          {alvo:'.dz-nav',texto:'Pelo menu você chega em Pessoas, Eventos e Configurações da congregação.'},
          {alvo:'.dz-ajuda-btn',texto:'Ficou com dúvida? Toque neste botão a qualquer momento para ver as dúvidas frequentes.'}
        ]},
        pessoas:{titulo:'Pessoas da congregação',passos:[
          {texto:'Aqui fica a lista única de pessoas da congregação. Todos os módulos usam esta lista.'},
          {alvo:'[onclick="abrirPessoaCong()"]',texto:'Use "Nova pessoa" para cadastrar alguém com nome, grupo e telefone.'},
          {alvo:'[onclick="juntarCadastros()"]',texto:'"Juntar cadastros existentes" traz para a lista quem já estava nas Designações, nos Territórios ou nos Oradores.'},
          {texto:'O que cada pessoa pode fazer (microfone, áudio, dirigente de campo…) é marcado em Designações → Pessoas.'}
        ]},
        eventos:{titulo:'Eventos',passos:[
          {texto:'Cadastre aqui assembleias, congressos, a visita do superintendente e a Celebração.'},
          {alvo:'[onclick="abrirEvento()"]',texto:'Ao salvar um evento, o Oradores e as Designações são atualizados sozinhos (por exemplo, marcando "sem reunião").'}
        ]},
        configuracoes:{titulo:'Configurações',passos:[
          {texto:'Todas as configurações da congregação ficam aqui, separadas por assunto.'},
          {alvo:'.config-tabs',texto:'Escolha o assunto: Congregação, Reuniões, Funções, Campo, Equipe e Mensagens.'},
          {texto:'Depois de alterar, toque em "Salvar alterações" no fim de cada bloco.'}
        ]}
      },
      faq:[
        ['Como dou acesso a outra pessoa?','Em Configurações → Equipe, crie um convite e envie o link. A pessoa entra com a conta Google. Você escolhe quais módulos ela pode ver e editar.'],
        ['Como marco uma assembleia ou congresso?','Em Eventos → Novo evento. As reuniões daquela data ficam marcadas como "sem reunião" no Oradores e nas Designações.']
      ]
    },
    designacoes:{
      nome:'Designações',
      aba:()=>document.querySelector('[data-aba].active')?.dataset.aba||'programacao',
      secao:a=>document.getElementById('sec-'+a),
      abas:{
        programacao:{titulo:'Programação',passos:[
          {texto:'Aqui você monta as designações de cada reunião do mês: indicadores, microfones, áudio e vídeo, Zoom, presidente e leitor.'},
          {alvo:'.mes-nav',texto:'Use as setas para trocar de mês. "Hoje" volta para o mês atual.'},
          {alvo:'#listaReunioes',texto:'Cada cartão é uma reunião. Toque no topo do cartão para escolher as pessoas de cada função.'},
          {alvo:'.legenda',texto:'O triângulo amarelo é um aviso: a pessoa já está em outra função na mesma reunião, faz discurso no dia ou fez a MESMA função na reunião anterior. Funções diferentes em dias diferentes não geram aviso.'},
          {alvo:'[onclick="sugerirMes()"]',texto:'"Sugerir vagas vazias" preenche as vagas com quem está há mais tempo sem fazer cada função. Quem já está designado continua.'},
          {alvo:'[onclick="abrirPdf()"]',texto:'Gere o PDF para o quadro de anúncios, envie pelo WhatsApp ou mande lembretes para cada designado.'}
        ]},
        campo:{titulo:'Saídas de campo',passos:[
          {texto:'Aqui você escolhe quem dirige cada saída de campo do mês.'},
          {alvo:'#campoMesNav',texto:'Troque de mês pelas setas. Dá para designar até 4 meses para frente.'},
          {alvo:'#listaCampo',texto:'Cada linha é uma saída (dia, horário e local). Toque para escolher o dirigente.'},
          {texto:'Ao escolher o dirigente, marque "Gostaria de deixar essa designação recorrente pelo mês?" para colocar a mesma pessoa em todas as datas daquela saída no mês.'},
          {texto:'Os locais e os dias de saída são cadastrados em Início → Configurações → Campo. Quem pode dirigir é marcado em Designações → Pessoas, na coluna "Campo".'}
        ]},
        pessoas:{titulo:'Pessoas',passos:[
          {texto:'Aqui você marca o que cada pessoa pode fazer.'},
          {alvo:'#listaPessoas',texto:'Toque numa função para liberar ou tirar. Embaixo aparece há quanto tempo a pessoa não faz AQUELA função.'},
          {texto:'A coluna "Campo" libera a pessoa para ser dirigente de campo.'},
          {alvo:'[onclick="abrirPessoa()"]',texto:'"Nova pessoa" cadastra alguém novo direto daqui. O cadastro vai para a lista da congregação.'}
        ]},
        historico:{titulo:'Histórico',passos:[
          {texto:'O histórico mostra quem alterou o quê nas designações, com data e hora. Útil para conferir mudanças feitas pela equipe.'}
        ]}
      },
      faq:[
        ['Coloquei alguém em Áudio na quarta. Por que não aparece aviso ao colocar no Microfone no sábado?','Está certo: o controle é por função. O tempo sem fazer e o aviso "fez na reunião anterior" só olham a MESMA função. Só aparece aviso quando a pessoa está em duas funções na MESMA reunião.'],
        ['A mesma pessoa pode ter duas funções na mesma reunião?','Pode. O sistema só mostra um aviso ("Já está como … nesta reunião") para você conferir.'],
        ['O que significa "há 3 semanas" ao lado do nome?','É quanto tempo faz que a pessoa fez AQUELA função. Quem está há mais tempo sem fazer aparece primeiro na lista.'],
        ['Alguém não aparece na lista de uma função. Por quê?','A pessoa não está liberada para essa função ou está inativa. Marque em Designações → Pessoas.'],
        ['Como funciona a designação recorrente do campo?','Ao escolher o dirigente de uma saída, marque a caixa de recorrência. A mesma pessoa é colocada em todas as datas daquela saída (mesmo dia da semana, horário e local) no mês, a partir de hoje.'],
        ['Até quando posso designar as saídas de campo?','Até 4 meses para frente, contando o mês atual.'],
        ['Onde cadastro os locais e os dias de saída de campo?','Em Início → Configurações → Campo. Cadastre os locais (Salão do Reino, casa de alguém…) e depois os dias da semana, horários e local de cada saída.'],
        ['A quantidade de microfones ou indicadores está errada.','Ajuste em Início → Configurações → Funções. Use 0 para não ter a função em uma das reuniões.']
      ]
    },
    oradores:{
      nome:'Oradores',
      aba:()=>(document.querySelector('.page.active')?.id||'page-home').replace('page-',''),
      secao:a=>document.getElementById('page-'+a),
      abas:{
        home:{titulo:'Programação de discursos',passos:[
          {texto:'Aqui fica a programação dos discursos públicos: quem vem, de qual congregação e com qual tema.'},
          {alvo:'nav',texto:'Pelo menu você chega no histórico, nos temas, no cadastro de oradores, nas sugestões e na análise.'},
          {texto:'Toque em uma data para designar o orador e o tema. Quem fez o tema recentemente gera aviso.'}
        ]},
        programa:{titulo:'Histórico',passos:[{texto:'O histórico mostra os discursos já feitos, para evitar repetir tema ou orador cedo demais.'}]},
        temas:{titulo:'Temas',passos:[{texto:'Lista de temas dos discursos públicos, com a última vez que cada um foi apresentado.'}]},
        oradores:{titulo:'Oradores',passos:[{texto:'Cadastro dos oradores (da sua congregação e de outras), com telefone e temas que cada um faz.'}]},
        sugestoes:{titulo:'Sugestões',passos:[{texto:'Sugestões de oradores e temas para as datas em aberto, com base no histórico.'}]},
        minha:{titulo:'Minha Congregação',passos:[{texto:'Oradores da sua congregação, discursos fora e compartilhamento de oradores com outras congregações.'}]},
        analytics:{titulo:'Análise',passos:[{texto:'Números e gráficos sobre os discursos: temas mais e menos usados, congregações que mais visitaram e mais.'}]}
      },
      faq:[
        ['Como compartilho oradores com outra congregação?','Em Minha Cong. → Compartilhar oradores. Envie pelo código da outra congregação ou por um link válido por 7 dias.'],
        ['Como importo uma lista antiga?','Use o botão de pasta no topo para importar o histórico, ou Oradores → Importar lista.']
      ]
    },
    territorios:{
      nome:'Territórios',
      aba:()=>(document.querySelector('.panel.active')?.id||'panel-indicar').replace('panel-',''),
      secao:a=>document.getElementById('panel-'+a),
      abas:{
        indicar:{titulo:'Indicar território',passos:[
          {texto:'Aqui você escolhe qual território entregar para um dirigente. Os que estão há mais tempo sem ser trabalhados aparecem primeiro.'},
          {alvo:'.dz-nav',texto:'Pelo menu você registra a devolução, vê o histórico e as estatísticas.'}
        ]},
        registrar:{titulo:'Registrar',passos:[{texto:'Registre aqui quando um território sair ou voltar, com a data e o dirigente.'}]},
        historico:{titulo:'Histórico',passos:[{texto:'Todas as saídas e devoluções de cada território.'}]},
        stats:{titulo:'Estatísticas',passos:[{texto:'Quanto tempo cada território está sem ser trabalhado e o andamento das campanhas.'}]}
      },
      faq:[
        ['Onde cadastro os dirigentes dos territórios?','Em Início → Configurações → Mensagens e territórios → Dirigentes.'],
        ['O dirigente de território é o mesmo dirigente de campo?','São cadastros diferentes: o dirigente de campo é marcado em Designações → Pessoas (coluna Campo).']
      ]
    },
    quadro:{
      nome:'Quadro de anúncios',
      aba:()=>'quadro',
      secao:()=>document.getElementById('quadroApp'),
      abas:{
        quadro:{titulo:'Quadro de anúncios',passos:[
          {texto:'Aqui você prepara o PDF do quadro de anúncios em 4 passos.'},
          {alvo:'#quadroConteudo',texto:'1. Escolha o conteúdo: só discursos, só designações ou a programação completa.'},
          {alvo:'#quadroMes',texto:'2. Escolha o mês inicial e quantos meses entram no PDF.'},
          {alvo:'.quadro-modelos',texto:'3. Escolha o modelo e, se quiser, ajuste as cores.'},
          {alvo:'.quadro-preview',texto:'4. Confira a prévia e baixe ou envie pelo WhatsApp.'}
        ]}
      },
      faq:[
        ['Os nomes estão "A definir". Por quê?','A designação ainda não foi feita no Oradores ou nas Designações. Preencha lá e atualize a prévia.'],
        ['As cores ficam salvas?','Sim, neste navegador, separadas por modelo e congregação.']
      ]
    }
  };

  let modulo=null,conf=null,ultimaAba=null,tour=null;

  function el(tag,classe,texto){const n=document.createElement(tag);if(classe)n.className=classe;if(texto!=null)n.textContent=texto;return n;}
  function janelaAberta(){
    return !!document.querySelector('dialog[open], .fundo:not([hidden]), .choice-overlay, .dz-ajuda-fundo, .modal-overlay.open, .modal.open, .overlay.open');
  }

  // ── Passo a passo ──
  function fecharTour(){
    if(!tour)return;
    tour.camada.remove();tour.cartao.remove();
    window.removeEventListener('resize',tour.reposicionar);window.removeEventListener('scroll',tour.reposicionar,true);
    document.removeEventListener('keydown',tour.teclas);
    tour=null;
  }
  function iniciarTour(chaveAba){
    const aba=conf.abas[chaveAba];if(!aba)return;
    fecharTour();
    const passos=aba.passos.filter(p=>!p.alvo||visivel(document.querySelector(p.alvo)));
    if(!passos.length)return;
    const camada=el('div','dz-tour-foco'),cartao=el('div','dz-tour-cartao');
    cartao.setAttribute('role','dialog');cartao.setAttribute('aria-modal','false');cartao.setAttribute('aria-label','Passo a passo: '+aba.titulo);
    document.body.append(camada,cartao);
    let i=0;
    function reposicionar(){
      const p=passos[i],alvo=p.alvo&&document.querySelector(p.alvo);
      const celular=window.innerWidth<900;
      if(alvo&&visivel(alvo)){
        const r=alvo.getBoundingClientRect(),m=6;
        Object.assign(camada.style,{display:'block',left:(r.left-m)+'px',top:(r.top-m)+'px',width:(r.width+m*2)+'px',height:(r.height+m*2)+'px'});
        camada.classList.remove('sem-alvo');
        if(celular){cartao.style.left='';cartao.style.top='';cartao.classList.add('rodape');cartao.classList.toggle('topo',r.top+r.height/2>window.innerHeight*.55);}
        else{
          cartao.classList.remove('rodape','topo');
          const w=cartao.offsetWidth,h=cartao.offsetHeight;
          let top=r.bottom+14;if(top+h>window.innerHeight-12)top=Math.max(12,r.top-h-14);
          const left=Math.min(Math.max(12,r.left),window.innerWidth-w-12);
          cartao.style.left=left+'px';cartao.style.top=top+'px';
        }
      }else{
        Object.assign(camada.style,{display:'block',left:'50%',top:'50%',width:'0',height:'0'});camada.classList.add('sem-alvo');
        cartao.classList.remove('rodape','topo');
        cartao.style.left=Math.max(12,(window.innerWidth-cartao.offsetWidth)/2)+'px';
        cartao.style.top=Math.max(12,(window.innerHeight-cartao.offsetHeight)/2)+'px';
      }
    }
    function mostrar(){
      const p=passos[i],alvo=p.alvo&&document.querySelector(p.alvo);
      cartao.replaceChildren();
      const topo=el('div','dz-tour-topo');topo.append(el('strong','',aba.titulo),el('span','',(i+1)+' de '+passos.length));
      const texto=el('p','',p.texto);
      const acoes=el('div','dz-tour-acoes');
      const pular=el('button','dz-btn',i===passos.length-1?'Fechar':'Pular');pular.type='button';pular.onclick=fecharTour;
      const esp=el('span','dz-tour-esp');
      acoes.append(pular,esp);
      if(i>0){const voltar=el('button','dz-btn','Voltar');voltar.type='button';voltar.onclick=()=>{i--;mostrar();};acoes.appendChild(voltar);}
      if(i<passos.length-1){const prox=el('button','dz-btn pri','Próximo');prox.type='button';prox.onclick=()=>{i++;mostrar();};acoes.appendChild(prox);}
      else{const ok=el('button','dz-btn pri','Entendi');ok.type='button';ok.onclick=fecharTour;acoes.appendChild(ok);}
      cartao.append(topo,texto,acoes);
      if(alvo&&visivel(alvo)){
        const r=alvo.getBoundingClientRect();
        if(r.top<70||r.bottom>window.innerHeight-90)alvo.scrollIntoView({block:'center',behavior:'instant'});
      }
      reposicionar();
      (cartao.querySelector('.dz-btn.pri')||pular).focus({preventScroll:true});
    }
    const teclas=e=>{if(e.key==='Escape')fecharTour();};
    tour={camada,cartao,reposicionar,teclas};
    window.addEventListener('resize',reposicionar);window.addEventListener('scroll',reposicionar,true);
    document.addEventListener('keydown',teclas);
    mostrar();
  }

  // Pergunta na primeira visita à aba: ver como funciona ou pular.
  function oferecerTour(chaveAba){
    const aba=conf.abas[chaveAba];if(!aba)return;
    gravar(CHAVE+modulo+'_'+chaveAba,'1');
    const caixa=el('div','dz-tour-convite');caixa.setAttribute('role','dialog');caixa.setAttribute('aria-label','Primeira vez nesta tela');
    caixa.innerHTML='<div class="dz-tour-icone"><i data-lucide="sparkles"></i></div>';
    const tx=el('div','dz-tour-tx');tx.append(el('strong','','Primeira vez em '+aba.titulo+'?'),el('span','','Quer ver rapidinho como esta tela funciona?'));
    const acoes=el('div','dz-tour-acoes');
    const pular=el('button','dz-btn','Pular');pular.type='button';pular.onclick=()=>caixa.remove();
    const ver=el('button','dz-btn pri','Ver como funciona');ver.type='button';ver.onclick=()=>{caixa.remove();iniciarTour(chaveAba);};
    acoes.append(pular,ver);caixa.append(tx,acoes);
    document.body.appendChild(caixa);
    if(window.lucide)lucide.createIcons();
    ver.focus({preventScroll:true});
  }

  // ── Dúvidas frequentes ──
  function abrirAjuda(){
    fecharTour();
    const fundo=el('div','dz-ajuda-fundo');fundo.onclick=e=>{if(e.target===fundo)fechar();};
    const jan=el('div','dz-ajuda');jan.setAttribute('role','dialog');jan.setAttribute('aria-modal','true');jan.setAttribute('aria-labelledby','dzAjudaTitulo');
    const fechar=()=>{fundo.remove();document.removeEventListener('keydown',esc);botao?.focus();};
    const esc=e=>{if(e.key==='Escape')fechar();};document.addEventListener('keydown',esc);
    const cab=el('div','dz-ajuda-cab');const h=el('h2','','Ajuda e dúvidas frequentes');h.id='dzAjudaTitulo';
    const x=el('button','dz-icon-btn');x.type='button';x.setAttribute('aria-label','Fechar ajuda');x.innerHTML='<i data-lucide="x"></i>';x.onclick=fechar;cab.append(h,x);
    const abaAtual=conf.aba(),temTour=!!conf.abas[abaAtual];
    const atalhos=el('div','dz-ajuda-atalhos');
    if(temTour){const b=el('button','dz-btn pri');b.type='button';b.innerHTML='<i data-lucide="play"></i>';b.append(' Ver o passo a passo desta tela');b.onclick=()=>{fechar();iniciarTour(abaAtual);};atalhos.appendChild(b);}
    const rever=el('button','dz-btn');rever.type='button';rever.innerHTML='<i data-lucide="rotate-ccw"></i>';rever.append(' Mostrar os passo a passo de novo');
    rever.onclick=()=>{try{Object.keys(localStorage).filter(k=>k.startsWith(CHAVE)).forEach(k=>localStorage.removeItem(k));}catch(e){}ultimaAba=null;rever.textContent='Pronto: cada tela vai perguntar de novo.';rever.disabled=true;};
    atalhos.appendChild(rever);
    const busca=el('input','dz-ajuda-busca');busca.type='search';busca.placeholder='Buscar dúvida…';busca.setAttribute('aria-label','Buscar dúvida');
    const lista=el('div','dz-ajuda-lista');
    const grupos=[[conf.nome,conf.faq||[]],['Geral',GERAL]];
    const normal=v=>String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
    function render(){
      const q=normal(busca.value.trim());lista.replaceChildren();let total=0;
      grupos.forEach(([titulo,itens])=>{
        const filtrados=itens.filter(([p,r])=>!q||normal(p+' '+r).includes(q));if(!filtrados.length)return;
        lista.appendChild(el('h3','',titulo));
        filtrados.forEach(([p,r])=>{const d=el('details');d.append(el('summary','',p),el('p','',r));if(q)d.open=true;lista.appendChild(d);total++;});
      });
      if(!total)lista.appendChild(el('p','dz-ajuda-vazio','Nenhuma dúvida encontrada. Tente outra palavra.'));
    }
    busca.oninput=render;render();
    jan.append(cab,atalhos,busca,lista);fundo.appendChild(jan);document.body.appendChild(fundo);
    if(window.lucide)lucide.createIcons();
    busca.focus();
  }

  let botao=null;
  function criarBotao(){
    botao=el('button','dz-ajuda-btn');botao.type='button';botao.title='Ajuda e dúvidas frequentes';botao.setAttribute('aria-label','Ajuda e dúvidas frequentes');
    botao.innerHTML='<i data-lucide="circle-help"></i><span>Ajuda</span>';botao.onclick=abrirAjuda;
    document.body.appendChild(botao);if(window.lucide)lucide.createIcons();
  }

  // Confere de tempos em tempos qual aba está aberta (cada módulo troca de aba de um jeito).
  function vigiar(){
    if(tour||document.querySelector('.dz-tour-convite'))return;
    const a=conf.aba();if(!a||a===ultimaAba)return;
    const sec=conf.secao(a);if(!visivel(sec)||janelaAberta())return;
    ultimaAba=a;
    if(conf.abas[a]&&!ler(CHAVE+modulo+'_'+a))oferecerTour(a);
  }

  function iniciar(nomeModulo){
    conf=MODULOS[nomeModulo];if(!conf)return;modulo=nomeModulo;
    const comecar=()=>{criarBotao();setInterval(vigiar,700);};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',comecar);else comecar();
  }

  // <script src="/assets/shared/ajuda.js" data-modulo="designacoes"> já liga a ajuda sozinho.
  const auto=document.currentScript?.dataset.modulo;
  if(auto)iniciar(auto);

  root.Ajuda={iniciar,abrir:()=>conf&&abrirAjuda(),tour:a=>conf&&iniciarTour(a||conf.aba()),MODULOS,GERAL};
})(window);
